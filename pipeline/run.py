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

import ledger
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

# Which cost basis leaves the books on a partial sale. "fifo" matches what US
# brokers report on a 1099-B by default; "average" matches the Supabase
# apply_transaction() function, so switch to it if you re-enable the DB path
# and want both to agree. Only affects the realised/unrealised split, never the
# total.
SELL_METHOD = "fifo"

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


def load_holdings() -> tuple[dict, list]:
    """
    Resolve positions from the first source that has them, and return the
    ledger events alongside so the caller can reconstruct real history.

    Priority: transactions.json > Supabase holdings > holdings.json snapshot.

    The ledger wins because it is the only source that can be *checked* — every
    other source is a snapshot you have to trust. Benchmark, risk-free rate and
    history window always come from holdings.json regardless.
    """
    config = json.loads(HOLDINGS_FILE.read_text())

    try:
        events = ledger.load_ledger()
    except ledger.LedgerError as e:
        print(f"✗ transactions.json is invalid: {e}")
        print("  Refusing to fall back to a snapshot — fix the ledger and re-run.")
        raise SystemExit(1)

    if events:
        positions = ledger.positions_as_of(events, method=SELL_METHOD)
        print(f"✓ Replayed {len(events)} ledger events → {len(positions)} open positions ({SELL_METHOD})")

        # Reconcile against the snapshot so a missing buy or unrecorded split
        # can't reach the dashboard unnoticed. Until check_reconciliation() has
        # a policy, say so loudly rather than pretending the check passed.
        try:
            issues = ledger.check_reconciliation(positions, config.get("positions", []))
            for msg in issues:
                print(f"⚠  reconciliation: {msg}")
            if not issues:
                print("✓ Ledger reconciles with holdings.json")
        except NotImplementedError:
            print("⚠  Reconciliation check not implemented — see pipeline/ledger.py")

        config["positions"] = positions
        return config, events

    print("⚠  transactions.json has no events; falling back to snapshot sources")
    db_positions = fetch_supabase_holdings()
    if db_positions is not None:
        print(f"✓ Loaded {len(db_positions)} positions from Supabase")
        config["positions"] = db_positions
        return config, []

    positions = config["positions"]
    all_placeholder = all(p["shares"] == 0 for p in positions)
    if all_placeholder:
        print("⚠  All holdings are placeholder (shares=0). Using sample data for demo.")
        for p in positions:
            if p["ticker"] in SAMPLE_OVERRIDES:
                p.update(SAMPLE_OVERRIDES[p["ticker"]])
    return config, []


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


def build_value_series(
    events: list, histories: dict[str, pd.DataFrame], benchmark: str
) -> tuple[pd.Series, pd.Series]:
    """
    Reconstruct the portfolio's actual daily market value, and the external cash
    flows that moved it.

    For each date: value = Σ (split-adjusted shares held) × (adjusted close).
    Because price histories are back-adjusted across splits and the share counts
    are pushed into the same post-split denomination, the product is correct on
    every date — including dates before a split that hadn't happened yet.

    This replaces the constant-weight approximation, which projected *today's*
    allocation backwards over the whole window and so reported the return of a
    portfolio you never actually held.

    Returns (value_series, flow_series) indexed on the common trading days.
    """
    ledger_tickers = sorted({e.ticker for e in events})

    # The benchmark's calendar is the spine — NOT the intersection of every
    # ticker's. Intersecting looks safer but is a trap: one recently-listed
    # holding (SKHY listed 2026-07-10, 30 bars) would truncate the *whole*
    # portfolio's history to that window, silently collapsing the growth chart
    # and every risk metric to a few weeks. The benchmark trades the full NYSE
    # calendar, and on days before a ticker listed you held none of it, so its
    # contribution is a genuine zero rather than a gap.
    dates = sorted(pd.to_datetime(histories[benchmark]["date"]).unique())
    if not dates:
        raise SystemExit("✗ Benchmark history is empty")

    # Start at the first date the portfolio was actually worth something, so a
    # long run of zero-value days can't drag the return series down.
    plain_dates = [d.date() for d in dates]
    total = pd.Series(0.0, index=pd.DatetimeIndex(dates))
    for t in ledger_tickers:
        prices = (
            histories[t]
            .assign(date=lambda d: pd.to_datetime(d["date"]))
            .set_index("date")["close"]
            .reindex(dates)
            .ffill()
        )
        # Ask the data whether it is back-adjusted rather than trusting the
        # provider's field name — see detect_split_adjustment().
        is_adj = ledger.detect_split_adjustment(
            events, t, {d.date(): float(v) for d, v in prices.items() if pd.notna(v)}
        )
        if any(e.type == "split" and e.ticker == t for e in events):
            print(f"  {t}: price series is {'split-adjusted' if is_adj else 'as-traded'}")
        shares = pd.Series(
            ledger.adjusted_shares_timeline(
                events, t, plain_dates, method=SELL_METHOD, price_split_adjusted=is_adj
            ),
            index=pd.DatetimeIndex(dates),
        )
        # No price AND no position is a real zero (before the ticker listed, or
        # after you closed it). No price WHILE holding shares is a data gap, so
        # leave it NaN and fail loudly below rather than understating the value.
        contribution = (shares * prices).mask(prices.isna() & (shares.abs() < 1e-9), 0.0)
        total = total + contribution

    # Bucket each cash flow onto the first trading day on or after its date.
    #
    # A naive date lookup drops any flow dated on a weekend or market holiday —
    # and a dropped deposit is catastrophic rather than cosmetic: the portfolio
    # value jumps by the purchase amount with no flow to subtract, so the time-
    # weighted return books the whole deposit as performance. A $2,797 weekend
    # buy read as +263% TWR before this was fixed.
    #
    # Flows landing at or before the first trading day are folded into the
    # opening value, which is the TWR baseline and never itself a return, so
    # they correctly contribute nothing.
    import bisect

    date_keys = [d.date() for d in dates]
    flow_values = [0.0] * len(dates)
    late: list = []
    off_calendar: list = []
    for flow_date, amount in ledger.external_flows(events):
        i = bisect.bisect_left(date_keys, flow_date)
        if i >= len(date_keys):
            late.append(flow_date)
            continue
        if date_keys[i] != flow_date and flow_date >= date_keys[0]:
            off_calendar.append((flow_date, date_keys[i]))
        flow_values[i] += amount

    for bad, moved_to in off_calendar:
        print(f"⚠  {bad} ({bad.strftime('%A')}) is not a trading day — "
              f"treating that cash flow as {moved_to}. Check the date in transactions.json.")
    for bad in late:
        print(f"⚠  {bad} is after the price history ends; its cash flow is ignored.")

    flows = pd.Series(flow_values, index=pd.DatetimeIndex(dates))

    if total.isna().any():
        gaps = [str(d.date()) for d in total[total.isna()].index[:5]]
        raise SystemExit(
            f"✗ Holding shares with no price on {', '.join(gaps)}. "
            f"Check the tickers in transactions.json against the price provider."
        )

    first = total[total > 1e-6].index.min()
    if pd.isna(first):
        raise SystemExit("✗ Ledger produces no positive portfolio value")
    return total.loc[first:], flows.loc[first:]


def main():
    print("Loading holdings…")
    config, events = load_holdings()
    positions = config["positions"]
    benchmark = config["benchmark"]
    rf = config["risk_free_rate_annual"]
    years = config.get("history_years", 3)

    tickers = [p["ticker"] for p in positions]
    # Positions closed earlier in the window still moved the portfolio's value
    # while they were open, so their history is needed too — otherwise selling
    # a loser would retroactively erase it from the return series.
    historical_tickers = sorted({e.ticker for e in events} | set(tickers))
    all_tickers = sorted(set(historical_tickers) | {benchmark})

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

    if events:
        # Real history: value reconstructed from shares actually held, then
        # time-weighted so deposits don't masquerade as performance.
        value_series, flow_series = build_value_series(events, histories, benchmark)
        daily = ledger.time_weighted_returns(
            [float(v) for v in value_series.values],
            [float(f) for f in flow_series.values],
        )
        port_returns = pd.Series(daily, index=value_series.index[1:])
        print(f"✓ Rebuilt {len(value_series)} days of actual portfolio value")
    else:
        # No ledger — fall back to the old constant-weight approximation.
        port_returns = weighted_portfolio_returns(ticker_returns, weight_fractions)
        value_series = flow_series = None

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

    # ── ledger-derived performance ───────────────────────────────────────────
    # Unrealised P&L alone understates (or flatters) what actually happened once
    # you have sold anything or collected a dividend, so surface all three.
    ledger_metrics: dict = {}
    if events:
        realised = ledger.realised_summary(events, method=SELL_METHOD)
        unrealised = total_value - total_cost
        net_contributed = sum(f for _, f in ledger.external_flows(events))

        # IRR needs the terminal value as a closing outflow: "if I liquidated
        # today, what annual rate did my contributions actually compound at?"
        flows = ledger.external_flows(events)
        flows.append((value_series.index[-1].date(), -total_value))
        irr = ledger.xirr(flows)

        # Time-weighted total return over the window — the like-for-like number
        # to compare against the benchmark, since it ignores contribution timing.
        twr_total = float((1 + port_returns).prod() - 1)

        ledger_metrics = {
            "realised_pl": realised["realised_pl"],
            "unrealised_pl": round(unrealised, 2),
            "dividends_received": realised["dividends_received"],
            "fees_paid": realised["fees_paid"],
            "total_pl": round(unrealised + realised["realised_pl"] + realised["dividends_received"], 2),
            "net_contributed": round(net_contributed, 2),
            "time_weighted_return": round(twr_total * 100, 2),
            "money_weighted_return": round(irr * 100, 2) if irr is not None else None,
            "sell_method": SELL_METHOD,
            "transaction_count": len(events),
            "first_transaction": min(e.date for e in events).isoformat(),
            "closed_positions": realised["closed_positions"],
        }

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
        **ledger_metrics,
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
        "is_sample_data": (
            not events
            and all(p["shares"] == 0 for p in json.loads(HOLDINGS_FILE.read_text())["positions"])
        ),
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
    if ledger_metrics:
        mwr = ledger_metrics["money_weighted_return"]
        print(
            f"  TWR: {ledger_metrics['time_weighted_return']}%  |  "
            f"IRR: {mwr if mwr is not None else 'n/a'}%  |  "
            f"Realised: ${ledger_metrics['realised_pl']:,.2f}  |  "
            f"Unrealised: ${ledger_metrics['unrealised_pl']:,.2f}"
        )


if __name__ == "__main__":
    main()
