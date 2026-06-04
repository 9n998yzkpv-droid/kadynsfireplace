"""
Data fetcher abstraction.  Swap the provider via the DATA_PROVIDER env var.
Supported:
  - "yahoo" (default) Yahoo Finance chart API — no API key, covers US stocks +
            ETFs, returns adjusted close. Best free option for full coverage.
  - "fmp"   Financial Modeling Prep stable API — needs FMP_API_KEY. NOTE: the
            free tier only serves a curated set of large-caps (many ETFs and
            mid-caps return 402 Payment Required), so it is not the default.
Interface contract every provider must satisfy:
  - get_history(ticker, years) -> pd.DataFrame with columns [date, close] sorted asc
  - get_quote(ticker)          -> float (latest price)
"""
from __future__ import annotations

import os
import json
import time
import requests
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Default to Yahoo (no key needed). Override with DATA_PROVIDER=fmp.
PROVIDER = os.environ.get("DATA_PROVIDER", "yahoo").lower()

# ---------------------------------------------------------------------------
# Simple on-disk cache: saves one JSON file per ticker per provider run.
# Prevents re-fetching during the same script execution and stays well under
# the 250 req/day free-tier limit for ~6 tickers.
# ---------------------------------------------------------------------------
_cache: dict[str, pd.DataFrame] = {}


def _cache_path(ticker: str) -> Path:
    import tempfile
    # Namespace the cache per provider so FMP (raw close) and Yahoo
    # (adjusted close) series never get mixed across runs.
    d = Path(tempfile.gettempdir()) / f"pricecache_{PROVIDER}"
    d.mkdir(exist_ok=True)
    return d / f"{ticker}.json"


def _load_from_disk(ticker: str) -> pd.DataFrame | None:
    p = _cache_path(ticker)
    if p.exists():
        raw = json.loads(p.read_text())
        df = pd.DataFrame(raw)
        df["date"] = pd.to_datetime(df["date"])
        return df.sort_values("date").reset_index(drop=True)
    return None


def _save_to_disk(ticker: str, df: pd.DataFrame) -> None:
    data = df.copy()
    data["date"] = data["date"].dt.strftime("%Y-%m-%d")
    _cache_path(ticker).write_text(json.dumps(data.to_dict(orient="records")))


# ---------------------------------------------------------------------------
# FMP provider
# ---------------------------------------------------------------------------

class FMPProvider:
    # FMP migrated free-tier keys to the "stable" API in 2024; the legacy
    # /api/v3/ endpoints now return 403 for free keys.
    BASE = "https://financialmodelingprep.com/stable"

    def __init__(self):
        self.api_key = os.environ.get("FMP_API_KEY", "")
        if not self.api_key:
            raise EnvironmentError("FMP_API_KEY env var is not set.")

    def _get(self, endpoint: str, params: dict) -> dict | list:
        params["apikey"] = self.api_key
        url = f"{self.BASE}/{endpoint}"
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def get_history(self, ticker: str, years: int = 3) -> pd.DataFrame:
        """Return daily adjusted-close history for `years` years, sorted ascending."""
        if ticker in _cache:
            return _cache[ticker]

        disk = _load_from_disk(ticker)
        if disk is not None:
            _cache[ticker] = disk
            return disk

        start = (datetime.today() - timedelta(days=365 * years + 30)).strftime("%Y-%m-%d")
        # stable/historical-price-eod/full returns a FLAT list of daily bars:
        # [{"symbol","date","open","high","low","close","volume"}, ...]
        data = self._get(
            "historical-price-eod/full",
            {"symbol": ticker, "from": start},
        )
        # Be tolerant of both the flat list (stable) and the legacy nested shape
        records = data.get("historical", []) if isinstance(data, dict) else data
        if not records:
            raise ValueError(f"No historical data returned for {ticker}")

        df = pd.DataFrame(records)[["date", "close"]].copy()
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

        # Rate-limit courtesy pause between requests
        time.sleep(0.3)

        _cache[ticker] = df
        _save_to_disk(ticker, df)
        return df

    def get_quote(self, ticker: str) -> float:
        """Return the latest price. Falls back to last row of history if API fails."""
        try:
            # stable/quote?symbol=TICKER -> [{"symbol","name","price", ...}]
            data = self._get("quote", {"symbol": ticker})
            if data and isinstance(data, list):
                return float(data[0]["price"])
        except Exception:
            pass
        # Fallback: last close from history
        hist = self.get_history(ticker)
        return float(hist["close"].iloc[-1])


# ---------------------------------------------------------------------------
# Yahoo Finance provider (default) — no API key required
# ---------------------------------------------------------------------------

class YahooProvider:
    """Yahoo Finance chart API. No key, covers US stocks + ETFs, returns
    adjusted close (accounts for splits & dividends) for total-return accuracy."""
    BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
    HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) financeblog/1.0"}

    def _get(self, ticker: str, params: dict) -> dict:
        r = requests.get(f"{self.BASE}/{ticker}", params=params,
                         headers=self.HEADERS, timeout=30)
        r.raise_for_status()
        return r.json()

    def get_history(self, ticker: str, years: int = 3) -> pd.DataFrame:
        """Return daily adjusted-close history for `years` years, sorted ascending."""
        if ticker in _cache:
            return _cache[ticker]
        disk = _load_from_disk(ticker)
        if disk is not None:
            _cache[ticker] = disk
            return disk

        now = int(datetime.now(timezone.utc).timestamp())
        start = int((datetime.now(timezone.utc) - timedelta(days=365 * years + 30)).timestamp())
        data = self._get(ticker, {"period1": start, "period2": now, "interval": "1d"})

        chart = data.get("chart", {})
        if chart.get("error"):
            raise ValueError(f"Yahoo error for {ticker}: {chart['error']}")
        results = chart.get("result") or []
        if not results:
            raise ValueError(f"No historical data returned for {ticker}")
        res = results[0]
        timestamps = res.get("timestamp") or []
        indicators = res.get("indicators", {})
        # Prefer adjusted close (splits + dividends); fall back to raw close.
        adj = (indicators.get("adjclose") or [{}])[0].get("adjclose")
        raw = (indicators.get("quote") or [{}])[0].get("close")
        closes = adj if adj else raw
        if not timestamps or not closes:
            raise ValueError(f"No price series for {ticker}")

        # Yahoo emits null for halted/holiday rows — drop those pairs.
        rows = [
            (datetime.fromtimestamp(t, tz=timezone.utc).date(), c)
            for t, c in zip(timestamps, closes) if c is not None
        ]
        df = pd.DataFrame(rows, columns=["date", "close"])
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

        time.sleep(0.2)  # be polite to the public endpoint
        _cache[ticker] = df
        _save_to_disk(ticker, df)
        return df

    def get_quote(self, ticker: str) -> float:
        """Latest price from chart meta; falls back to last history close."""
        try:
            data = self._get(ticker, {"range": "1d", "interval": "1d"})
            meta = data["chart"]["result"][0]["meta"]
            px = meta.get("regularMarketPrice")
            if px is not None:
                return float(px)
        except Exception:
            pass
        hist = self.get_history(ticker)
        return float(hist["close"].iloc[-1])


# ---------------------------------------------------------------------------
# Public interface — use these functions everywhere else in the pipeline
# ---------------------------------------------------------------------------

_provider = None

def _get_provider():
    global _provider
    if _provider is None:
        if PROVIDER == "yahoo":
            _provider = YahooProvider()
        elif PROVIDER == "fmp":
            _provider = FMPProvider()
        else:
            raise ValueError(f"Unknown provider: {PROVIDER!r} (use 'yahoo' or 'fmp')")
    return _provider


def get_history(ticker: str, years: int = 3) -> pd.DataFrame:
    """Daily adjusted-close history. Returns DataFrame[date, close] sorted asc."""
    return _get_provider().get_history(ticker, years)


def get_quote(ticker: str) -> float:
    """Latest price for ticker."""
    return _get_provider().get_quote(ticker)
