"""
Main pipeline entry point.
Run: python pipeline/run.py
Reads holdings.json, fetches price data, computes metrics, writes public/data.json.
"""

from __future__ import annotations

import json
import sys
import os
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path

# Force UTF-8 stdout so status messages with Unicode (✓, →, ⚠) print on
# Windows consoles (cp1252) the same way they do on Linux CI runners.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

# Add pipeline dir to path so it's importable from repo root too
sys.path.insert(0, str(Path(__file__).parent))

from fetch import get_history, get_quote
from metrics import (
    position_metrics,
    cagr,
    annualised_return,
    annualised_volatility,
    sharpe_ratio,
    sortino_ratio,
    max_drawdown,
    beta_alpha,
    treynor_ratio,
    tracking_error_ir,
    value_at_risk,
    covariance_matrix,
    risk_contribution,
)

REPO_ROOT = Path(__file__).parent.parent
HOLDINGS_FILE = REPO_ROOT / "holdings.json"
OUTPUT_FILE = REPO_ROOT / "public" / "data.json"

# ---------------------------------------------------------------------------
# Sample holdings used when shares = 0 (placeholder mode).
# These make the dashboard visually complete before you enter real numbers.
# ---------------------------------------------------------------------------
SAMPLE_OVERRIDES = {
    "MNST": {"shares": 50,  "cost_basis_per_share": 48.00,  "purchase_date": "2022-01-15"},
    "VOO":  {"shares": 20,  "cost_basis_per_share": 350.00, "purchase_date": "2022-03-10"},
    "FTEC": {"shares": 30,  "cost_basis_per_share": 110.00, "purchase_date": "2022-06-01"},
    "NVDA": {"shares": 40,  "cost_basis_per_share": 180.00, "purchase_date": "2022-09-20"},
    "UUUU": {"shares": 200, "cost_basis_per_share": 6.50,   "purchase_date": "2023-01-05"},
}


def fetch_supabase_holdings() -> list[dict] | None:
    """
    Pull live holdings from the Supabase DB (the admin manages them through
    the publisher UI; transactions are the source of truth there).
    Returns None when Supabase isn't configured, unreachable, or empty —
    the caller then falls back to holdings.json so the pipeline never breaks.
    Requires SUPABASE_URL and SUPABASE_ANON_KEY env vars; the anon key only
    grants what row-level security allows (public read on holdings).
    """
    import requests

    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_ANON_KEY", "")
    if not url or not key:
        return None
    try:
        res = requests.get(
            f"{url}/rest/v1/holdings",
            params={"select": "ticker,shares,avg_cost_basis", "order": "ticker"},
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=15,
        )
        res.raise_for_status()
        rows = res.json()
    except Exception as e:  # noqa: BLE001 — any failure means "use the file"
        print(f"⚠  Supabase fetch failed ({e}); falling back to holdings.json")
        return None
    if not rows:
        print("⚠  Supabase holdings table is empty; falling back to holdings.json")
        return None
    return [
        {
            "ticker": r["ticker"],
            "shares": float(r["shares"]),
            "cost_basis_per_share": float(r["avg_cost_basis"]),
        }
        for r in rows
    ]


def load_holdings() -> dict:
    # Benchmark / risk-free rate / history window always come from
    # holdings.json — only the positions themselves live in the DB.
    config = json.loads(HOLDINGS_FILE.read_text())

    db_positions = fetch_supabase_holdings()
    if db_positions is not None:
        print(f"✓ Loaded {len(db_positions)} positions from Supabase")
        config["positions"] = db_positions
        return config

    positions = config["positions"]
    all_placeholder = all(p["shares"] == 0 for p in positions)
    if all_placeholder:
        print("⚠  All holdings are placeholder (shares=0). Using sample data for demo.")
        for p in positions:
            if p["ticker"] in SAMPLE_OVERRIDES:
                p.update(SAMPLE_OVERRIDES[p["ticker"]])
    return config


def returns_from_history(hist: pd.DataFrame) -> pd.Series:
    """Daily percentage returns from a price series, date-indexed."""
    s = hist.set_index("date")["close"]
    return s.pct_change().dropna()


def weighted_portfolio_returns(
    ticker_returns: dict[str, pd.Series], weights: dict[str, float]
) -> pd.Series:
    """
    Build a daily portfolio return series.
    Portfolio return = Σ w_i × R_i  (constant-weight approximation).
    Aligns all tickers on common trading days (inner join).
    """
    df = pd.DataFrame(ticker_returns).dropna()
    w = np.array([weights[t] for t in df.columns])
    w = w / w.sum()  # re-normalise after dropping NaN rows
    port = df.values @ w
    return pd.Series(port, index=df.index)


def growth_series(price_series: pd.Series, label: str) -> list[dict]:
    """Normalise a price series to 100 at the start for the growth chart."""
    base = price_series.iloc[0]
    normalised = (price_series / base * 100).round(2)
    return [
        {"date": str(d.date()), label: float(v)}
        for d, v in zip(normalised.index, normalised.values)
    ]


def main():
    print("Loading holdings…")
    config = load_holdings()
    positions = config["positions"]
    benchmark = config["benchmark"]
    rf = config["risk_free_rate_annual"]
    years = config.get("history_years", 3)

    tickers = [p["ticker"] for p in positions]
    all_tickers = tickers + [benchmark]

    print(f"Fetching history for: {', '.join(all_tickers)}")
    histories: dict[str, pd.DataFrame] = {}
    for t in all_tickers:
        print(f"  → {t}")
        histories[t] = get_history(t, years=years)

    print("Fetching latest quotes…")
    latest_prices: dict[str, float] = {}
    for t in tickers:
        latest_prices[t] = get_quote(t)
        print(f"  {t}: ${latest_prices[t]:.2f}")

    # ── portfolio totals ─────────────────────────────────────────────────────
    total_value = sum(p["shares"] * latest_prices[p["ticker"]] for p in positions)
    total_cost = sum(p["shares"] * p["cost_basis_per_share"] for p in positions)

    # ── position-level metrics ────────────────────────────────────────────────
    position_data = []
    for p in positions:
        pos = position_metrics(
            ticker=p["ticker"],
            shares=p["shares"],
            cost_basis_per_share=p["cost_basis_per_share"],
            latest_price=latest_prices[p["ticker"]],
            portfolio_cost_total=total_cost,
            portfolio_value_total=total_value,
        )
        position_data.append(pos)

    # ── daily returns ─────────────────────────────────────────────────────────
    ticker_returns = {t: returns_from_history(histories[t]) for t in tickers}
    bench_returns = returns_from_history(histories[benchmark])

    # Value-weights for portfolio return series
    value_weights = {
        p["ticker"]: p["shares"] * latest_prices[p["ticker"]]
        for p in positions
    }
    total_w = sum(value_weights.values())
    weight_fractions = {t: v / total_w for t, v in value_weights.items()}

    port_returns = weighted_portfolio_returns(ticker_returns, weight_fractions)

    # ── portfolio price series (synthetic index, base = 100) ───────────────
    # Build a synthetic portfolio index from the daily return stream. CAGR and
    # max-drawdown are scale-invariant (the multiplier cancels), so the base is
    # arbitrary — but it must be POSITIVE. Basing it on total_cost breaks when
    # cost basis is still 0/unset (0/0 → NaN), so we use a constant 100.0, which
    # also serves as the normalized growth-chart line.
    port_price = (1 + port_returns).cumprod() * 100.0
    port_price.index = pd.to_datetime(port_price.index)

    # ── compute all metrics ───────────────────────────────────────────────────
    print("Computing metrics…")

    ba = beta_alpha(port_returns, bench_returns, rf)
    te_ir = tracking_error_ir(port_returns, bench_returns)
    var = value_at_risk(port_returns, total_value)
    dd = max_drawdown(port_price)

    # Covariance / correlation across individual holdings
    returns_df = pd.DataFrame({t: ticker_returns[t] for t in tickers}).dropna()
    cov_corr = covariance_matrix(returns_df)

    # Risk contribution
    w_array = np.array([weight_fractions[t] for t in tickers])
    cov_arr = returns_df.cov().values * 252
    risk_contrib = risk_contribution(w_array, cov_arr, tickers)

    portfolio_metrics = {
        "total_value": round(total_value, 2),
        "total_cost_basis": round(total_cost, 2),
        "total_return_dollar": round(total_value - total_cost, 2),
        "total_return_pct": round((total_value - total_cost) / total_cost * 100, 2) if total_cost > 0 else 0,
        "cagr": round(cagr(port_price) * 100, 2),
        "annualised_return": round(annualised_return(port_returns) * 100, 2),
        "annualised_volatility": round(annualised_volatility(port_returns) * 100, 2),
        "sharpe_ratio": round(sharpe_ratio(port_returns, rf), 3),
        "sortino_ratio": round(sortino_ratio(port_returns, rf), 3),
        "max_drawdown": round(dd["max_drawdown"] * 100, 2),
        "max_drawdown_peak_date": dd["peak_date"],
        "max_drawdown_trough_date": dd["trough_date"],
        "beta": ba["beta"],
        "alpha": round(ba["alpha"] * 100, 3),
        "r_squared": ba["r_squared"],
        "correlation_to_benchmark": ba["correlation"],
        "treynor_ratio": round(treynor_ratio(port_returns, ba["beta"], rf), 4),
        "tracking_error": round(te_ir["tracking_error"] * 100, 3),
        "information_ratio": te_ir["information_ratio"],
        "var_95_historical_dollar": var["var_historical_dollar"],
        "var_95_historical_pct": var["var_historical_pct"],
        "var_95_parametric_dollar": var["var_parametric_dollar"],
        "var_95_parametric_pct": var["var_parametric_pct"],
        "risk_free_rate": round(rf * 100, 2),
        "benchmark": benchmark,
    }

    # ── growth chart data ────────────────────────────────────────────────────
    # Align portfolio and benchmark to same dates
    bench_price = histories[benchmark].set_index("date")["close"]
    bench_price.index = pd.to_datetime(bench_price.index)

    port_norm = port_price / port_price.iloc[0] * 100
    bench_norm = bench_price / bench_price.iloc[0] * 100

    # Build merged growth series
    combined = pd.DataFrame({"portfolio": port_norm, benchmark: bench_norm}).dropna()
    growth_data = [
        {"date": str(d.date()), "portfolio": round(float(combined["portfolio"][d]), 2),
         benchmark: round(float(combined[benchmark][d]), 2)}
        for d in combined.index
    ]
    # Thin to ~252 points max for chart performance (weekly sampling)
    if len(growth_data) > 252:
        step = len(growth_data) // 252
        growth_data = growth_data[::step]

    # ── assemble output ──────────────────────────────────────────────────────
    output = {
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "is_sample_data": all(p["shares"] == 0 for p in json.loads(HOLDINGS_FILE.read_text())["positions"]),
        "portfolio": portfolio_metrics,
        "positions": position_data,
        "risk_contribution": risk_contrib,
        "matrices": cov_corr,
        "growth_chart": growth_data,
    }

    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, indent=2, default=str))
    print(f"\n✓ Wrote {OUTPUT_FILE}")
    print(f"  Portfolio value: ${total_value:,.2f}  |  Sharpe: {portfolio_metrics['sharpe_ratio']}")


if __name__ == "__main__":
    main()
