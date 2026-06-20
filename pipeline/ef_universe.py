"""
EF universe baker — produces public/ef-data.json for the in-browser Efficient
Frontier tool.

The browser can't call Yahoo Finance (no CORS), so we bake an aligned daily
log-return matrix for a curated universe here (server-side / CI), and the client
computes mean/covariance for whatever subset the user picks.

Stdlib only (urllib + json + math) so it runs anywhere — no pandas/requests/
yfinance needed. Mirrors the Yahoo chart provider already used in fetch.py.

Run:  python3 pipeline/ef_universe.py
Out:  public/ef-data.json
"""
from __future__ import annotations

import json
import math
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
OUTPUT_FILE = REPO_ROOT / "public" / "ef-data.json"

YEARS = 2          # how much daily history to bake (UI can slice to 1y)
BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) financeblog/1.0"}

# Curated, long-lived universe. Ticker -> display name. All trade the NYSE
# calendar so their common-date intersection is ~full history.
UNIVERSE: dict[str, str] = {
    # Mega/large-cap tech
    "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet", "AMZN": "Amazon",
    "META": "Meta Platforms", "NVDA": "NVIDIA", "TSLA": "Tesla", "AMD": "AMD",
    "AVGO": "Broadcom", "CRM": "Salesforce", "NFLX": "Netflix", "ORCL": "Oracle",
    "ADBE": "Adobe", "CSCO": "Cisco", "INTC": "Intel",
    # Other large-cap sectors
    "JPM": "JPMorgan Chase", "BAC": "Bank of America", "V": "Visa",
    "MA": "Mastercard", "JNJ": "Johnson & Johnson", "UNH": "UnitedHealth",
    "WMT": "Walmart", "COST": "Costco", "HD": "Home Depot",
    "PG": "Procter & Gamble", "KO": "Coca-Cola", "PEP": "PepsiCo",
    "MCD": "McDonald's", "DIS": "Disney", "XOM": "Exxon Mobil",
    # Sector ETFs (SPDR)
    "XLK": "Technology Sector", "XLF": "Financials Sector",
    "XLV": "Health Care Sector", "XLE": "Energy Sector",
    "XLY": "Consumer Discretionary", "XLP": "Consumer Staples",
    "XLI": "Industrials Sector", "XLB": "Materials Sector",
    "XLU": "Utilities Sector", "XLRE": "Real Estate Sector",
    "XLC": "Communication Services",
    # Index / asset-class ETFs
    "SPY": "S&P 500", "QQQ": "Nasdaq 100", "IWM": "Russell 2000",
    "DIA": "Dow Jones 30", "EFA": "Developed ex-US", "EEM": "Emerging Markets",
    "VTI": "Total US Market", "TLT": "20Y+ Treasuries", "GLD": "Gold",
    "SLV": "Silver", "HYG": "High-Yield Bonds", "LQD": "Inv-Grade Bonds",
    "AGG": "US Aggregate Bonds",
}


def fetch_closes(ticker: str, years: int = YEARS) -> dict[str, float]:
    """Return {YYYY-MM-DD: adjclose} for `years` of daily history from Yahoo."""
    now = int(datetime.now(timezone.utc).timestamp())
    start = int((datetime.now(timezone.utc) - timedelta(days=365 * years + 10)).timestamp())
    url = f"{BASE}/{ticker}?period1={start}&period2={now}&interval=1d"
    req = urllib.request.Request(url, headers=HEADERS)
    data = json.load(urllib.request.urlopen(req, timeout=30))

    chart = data.get("chart", {})
    if chart.get("error"):
        raise ValueError(f"{ticker}: {chart['error']}")
    res = (chart.get("result") or [None])[0]
    if not res:
        raise ValueError(f"{ticker}: no result")
    ts = res.get("timestamp") or []
    ind = res.get("indicators", {})
    adj = (ind.get("adjclose") or [{}])[0].get("adjclose")
    raw = (ind.get("quote") or [{}])[0].get("close")
    closes = adj if adj else raw
    out: dict[str, float] = {}
    for t, c in zip(ts, closes or []):
        if c is None:
            continue
        d = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
        out[d] = float(c)
    return out


def main() -> None:
    print(f"Baking EF universe ({len(UNIVERSE)} tickers, {YEARS}y daily)…")
    closes_by_ticker: dict[str, dict[str, float]] = {}
    ok_tickers: list[str] = []

    for i, tk in enumerate(UNIVERSE):
        for attempt in range(3):
            try:
                closes = fetch_closes(tk)
                if len(closes) < 60:
                    raise ValueError("too few rows")
                closes_by_ticker[tk] = closes
                ok_tickers.append(tk)
                print(f"  [{i+1:>2}/{len(UNIVERSE)}] {tk:<5} {len(closes)} days")
                break
            except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as e:
                if attempt == 2:
                    print(f"  [{i+1:>2}/{len(UNIVERSE)}] {tk:<5} SKIP ({e})")
                else:
                    time.sleep(1.0 + attempt)
        time.sleep(0.2)  # be polite to the public endpoint

    if len(ok_tickers) < 2:
        raise SystemExit("Not enough tickers fetched — aborting.")

    # Common trading days across all successfully-fetched tickers.
    common = set.intersection(*(set(closes_by_ticker[t]) for t in ok_tickers))
    dates = sorted(common)
    if len(dates) < 30:
        raise SystemExit(f"Only {len(dates)} common days — aborting.")
    print(f"Common trading days: {len(dates)}  ({dates[0]} → {dates[-1]})")

    # Aligned daily log returns per ticker; return dates are dates[1:].
    returns: dict[str, list[float]] = {}
    stats: dict[str, dict[str, float]] = {}
    for t in ok_tickers:
        series = [closes_by_ticker[t][d] for d in dates]
        rets = [round(math.log(series[k] / series[k - 1]), 6) for k in range(1, len(series))]
        returns[t] = rets
        n = len(rets)
        mean = sum(rets) / n
        var = sum((r - mean) ** 2 for r in rets) / (n - 1)  # sample variance
        stats[t] = {
            "mean_annual": round(mean * 252, 6),
            "vol_annual": round(math.sqrt(var * 252), 6),
        }

    output = {
        "as_of": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "years": YEARS,
        "trading_days": len(dates) - 1,
        "dates": dates[1:],  # align with returns (one shorter than prices)
        "tickers": [
            {"symbol": t, "name": UNIVERSE.get(t, t), **stats[t]} for t in ok_tickers
        ],
        "returns": returns,  # log returns, aligned to `dates`
    }

    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, separators=(",", ":")))
    kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"\n✓ Wrote {OUTPUT_FILE}  ({kb:.0f} KB, {len(ok_tickers)} tickers)")


if __name__ == "__main__":
    main()
