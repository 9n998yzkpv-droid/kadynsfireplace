"""
Transaction-ledger replay engine — the source of truth for what is actually held.

Why this exists
---------------
holdings.json only ever stored a *snapshot*: shares, one blended cost basis, and
one made-up purchase date. That is enough to price the portfolio today, but it
cannot answer the questions that actually matter:

  * What did I really earn?  A snapshot has no cash-flow timing, so any return
    derived from it silently assumes you held today's portfolio for the whole
    window. Adding shares over time breaks that assumption badly.
  * What happens at a stock split?  A snapshot has to be hand-edited, and if you
    forget, the dashboard halves the position overnight (MNST, 2026-08-11).
  * What have I already realised?  A snapshot forgets every sale that ever
    happened.

So transactions.json is append-only and complete: every buy, every sell, every
corporate action. Everything else — current holdings, cost basis, realised P&L,
the daily value series, TWR and IRR — is *derived* by replaying it. Nothing is
hand-maintained, so nothing can drift.

Conventions
-----------
* Prices are always **as traded on that day**, never back-adjusted. The replay
  does the adjusting.
* A split's `ratio` is the multiplier on your share count: 2 = 2-for-1 (shares
  double, cost per share halves, total cost unchanged); 0.1 = 1-for-10 reverse.
* Share counts returned by `positions_as_of` are in *as-traded* terms for that
  date. `adjusted_shares_timeline` converts them into today's split-adjusted
  terms so they line up with an adjusted-close price series.

Stdlib only, so it imports and unit-tests without the pipeline's pandas/scipy
stack.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict, deque
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Literal

REPO_ROOT = Path(__file__).parent.parent
LEDGER_FILE = REPO_ROOT / "transactions.json"

# Share counts below this are treated as a closed position. Brokers hand out
# fractional shares to ~6dp, so this sits an order of magnitude below that.
EPSILON = 1e-7

EventType = Literal["buy", "sell", "split", "dividend"]
SellMethod = Literal["fifo", "average"]


class LedgerError(ValueError):
    """Raised when the ledger is structurally invalid or economically impossible."""


# ── parsing ─────────────────────────────────────────────────────────────────

def _parse_date(value: object, ctx: str) -> date:
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise LedgerError(f"{ctx}: date must be YYYY-MM-DD, got {value!r}") from None


def _parse_number(value: object, ctx: str, *, allow_zero: bool = False) -> float:
    try:
        n = float(value)  # type: ignore[arg-type]
    except (ValueError, TypeError):
        raise LedgerError(f"{ctx}: expected a number, got {value!r}") from None
    if n < 0 or (n == 0 and not allow_zero):
        raise LedgerError(f"{ctx}: must be {'non-negative' if allow_zero else 'positive'}, got {n}")
    return n


class Event:
    """One row of the ledger, validated at construction."""

    __slots__ = ("type", "ticker", "date", "shares", "price", "fee", "ratio", "amount", "note")

    def __init__(self, raw: dict, index: int):
        ctx = f"event[{index}]"
        self.type: str = str(raw.get("type", "")).lower()
        if self.type not in ("buy", "sell", "split", "dividend"):
            raise LedgerError(f"{ctx}: type must be buy/sell/split/dividend, got {self.type!r}")

        self.ticker: str = str(raw.get("ticker", "")).strip().upper()
        if not self.ticker:
            raise LedgerError(f"{ctx}: ticker is required")

        self.date: date = _parse_date(raw.get("date"), ctx)
        self.note: str = str(raw.get("note", "") or "")

        self.shares = self.price = self.fee = self.ratio = self.amount = 0.0

        if self.type in ("buy", "sell"):
            self.shares = _parse_number(raw.get("shares"), f"{ctx}.shares")
            # price may legitimately be 0 (gifted/vested shares).
            self.price = _parse_number(raw.get("price"), f"{ctx}.price", allow_zero=True)
            self.fee = _parse_number(raw.get("fee", 0), f"{ctx}.fee", allow_zero=True)
        elif self.type == "split":
            self.ratio = _parse_number(raw.get("ratio"), f"{ctx}.ratio")
        else:  # dividend
            self.amount = _parse_number(raw.get("amount"), f"{ctx}.amount", allow_zero=True)

    def __repr__(self) -> str:  # pragma: no cover — debugging aid
        return f"<{self.type} {self.ticker} {self.date}>"


def load_ledger(path: Path | None = None) -> list[Event]:
    """
    Read transactions.json and return events in replay order.

    Sorted by (date, original file position): same-day events replay in the
    order you wrote them, which is what you want when a split and a buy land on
    the same date — write the split first if it applied before your fill.
    """
    p = path or LEDGER_FILE
    if not p.exists():
        return []
    raw = p.read_text()
    try:
        doc = json.loads(raw)
    except json.JSONDecodeError as first_error:
        # A hand-maintained JSON file collects trailing commas — you delete the
        # last event and the comma above it is suddenly illegal. That is a typo,
        # not a corrupt ledger, so repair it in memory and say so loudly rather
        # than refusing to run. Anything else still fails hard.
        repaired = re.sub(r",(\s*[\]}])", r"\1", raw)
        try:
            doc = json.loads(repaired)
        except json.JSONDecodeError:
            raise LedgerError(f"{p.name} is not valid JSON: {first_error}") from None
        print(f"⚠  {p.name}: ignoring a trailing comma near line {first_error.lineno}. "
              f"It still parses, but tidy it up.")

    raw_events = doc.get("events", []) if isinstance(doc, dict) else doc
    if not isinstance(raw_events, list):
        raise LedgerError(f"{p.name}: 'events' must be a list")

    events = [Event(r, i) for i, r in enumerate(raw_events)]
    # Stable sort on date alone: equal dates keep their original file order.
    return sorted(events, key=lambda e: e.date)


# ── lot tracking ────────────────────────────────────────────────────────────

class Lot:
    """An open tax lot: shares acquired on one date at one cost per share."""

    __slots__ = ("date", "shares", "cost_per_share")

    def __init__(self, d: date, shares: float, cost_per_share: float):
        self.date = d
        self.shares = shares
        self.cost_per_share = cost_per_share

    @property
    def cost(self) -> float:
        return self.shares * self.cost_per_share


class TickerState:
    """Replay state for a single ticker."""

    def __init__(self, ticker: str):
        self.ticker = ticker
        self.lots: deque[Lot] = deque()
        self.realised_pl = 0.0        # cumulative realised gain/loss, net of fees
        self.dividends = 0.0          # cumulative cash dividends received
        self.fees = 0.0               # cumulative fees paid (buys + sells)
        self.proceeds = 0.0           # cumulative gross sale proceeds

    @property
    def shares(self) -> float:
        return sum(l.shares for l in self.lots)

    @property
    def cost_basis_total(self) -> float:
        return sum(l.cost for l in self.lots)

    @property
    def avg_cost_basis(self) -> float:
        s = self.shares
        return (self.cost_basis_total / s) if s > EPSILON else 0.0


def _consume_lots(state: TickerState, qty: float, method: SellMethod) -> float:
    """
    Remove `qty` shares from the open lots and return their total cost basis.

    fifo    — oldest lots first. What US brokers report by default, and what
              matches a 1099-B unless you elected otherwise.
    average — every share carries the blended basis. Simpler, and what the
              Supabase apply_transaction() function already does, so it keeps
              the two paths agreeing if you ever turn the DB path back on.

    Both leave total cost basis correct; they differ in *which* cost leaves the
    books on a partial sale, and therefore in realised vs unrealised split.
    """
    remaining = qty
    basis_removed = 0.0

    if method == "average":
        avg = state.avg_cost_basis
        basis_removed = avg * qty
        # Shrink every lot proportionally so the remaining lots keep their dates
        # (still needed for holding-period reporting) but carry the blended cost.
        held = state.shares
        keep = (held - qty) / held if held > EPSILON else 0.0
        for lot in state.lots:
            lot.shares *= keep
            lot.cost_per_share = avg
        while state.lots and state.lots[0].shares <= EPSILON:
            state.lots.popleft()
        return basis_removed

    # fifo
    while remaining > EPSILON and state.lots:
        lot = state.lots[0]
        take = min(lot.shares, remaining)
        basis_removed += take * lot.cost_per_share
        lot.shares -= take
        remaining -= take
        if lot.shares <= EPSILON:
            state.lots.popleft()
    return basis_removed


# ── replay ──────────────────────────────────────────────────────────────────

def replay(
    events: Iterable[Event],
    as_of: date | None = None,
    method: SellMethod = "fifo",
) -> dict[str, TickerState]:
    """
    Replay the ledger up to and including `as_of` (default: everything).

    Returns {ticker: TickerState}, including tickers whose position is now
    closed — their realised P&L still counts toward total return.
    """
    states: dict[str, TickerState] = {}

    for ev in events:
        if as_of is not None and ev.date > as_of:
            break
        st = states.setdefault(ev.ticker, TickerState(ev.ticker))

        if ev.type == "buy":
            # Fees capitalise into basis: they are part of what the shares cost.
            cost_per_share = ev.price + (ev.fee / ev.shares if ev.shares else 0.0)
            st.lots.append(Lot(ev.date, ev.shares, cost_per_share))
            st.fees += ev.fee

        elif ev.type == "sell":
            held = st.shares
            if ev.shares > held + 1e-6:
                raise LedgerError(
                    f"{ev.date} sell of {ev.shares:g} {ev.ticker}: only {held:g} held. "
                    f"A missing buy, or a split recorded after a sale that preceded it?"
                )
            basis = _consume_lots(st, ev.shares, method)
            gross = ev.shares * ev.price
            st.realised_pl += gross - basis - ev.fee
            st.proceeds += gross
            st.fees += ev.fee

        elif ev.type == "split":
            # Total cost is invariant across a split; only its per-share
            # denomination changes. Applying it lot-by-lot preserves holding
            # periods, which a snapshot-level edit cannot do.
            for lot in st.lots:
                lot.shares *= ev.ratio
                lot.cost_per_share /= ev.ratio

        elif ev.type == "dividend":
            st.dividends += ev.amount

    return states


def positions_as_of(
    events: Iterable[Event],
    as_of: date | None = None,
    method: SellMethod = "fifo",
) -> list[dict]:
    """Open positions only, in the shape pipeline/run.py expects from holdings.json."""
    states = replay(events, as_of, method)
    out = []
    for ticker, st in sorted(states.items()):
        if st.shares > EPSILON:
            out.append({
                "ticker": ticker,
                "shares": round(st.shares, 6),
                "cost_basis_per_share": round(st.avg_cost_basis, 4),
                "purchase_date": min(l.date for l in st.lots).isoformat(),
            })
    return out


def realised_summary(events: Iterable[Event], method: SellMethod = "fifo") -> dict:
    """Cumulative realised P&L, dividends and fees across every ticker ever held."""
    states = replay(events, None, method)
    return {
        "realised_pl": round(sum(s.realised_pl for s in states.values()), 2),
        "dividends_received": round(sum(s.dividends for s in states.values()), 2),
        "fees_paid": round(sum(s.fees for s in states.values()), 2),
        "closed_positions": sorted(t for t, s in states.items() if s.shares <= EPSILON),
    }


# ── split-adjusted share timeline ───────────────────────────────────────────

def split_factor_after(events: Iterable[Event], ticker: str, d: date) -> float:
    """
    Product of every split ratio for `ticker` that took effect *after* `d`.

    This is the bridge between the ledger and an adjusted-close price series.
    Yahoo back-adjusts prices across splits, so a pre-split date shows half the
    price actually traded. Multiplying the raw share count by this factor puts
    shares in the same post-split denomination as the price, and the product —
    the position's market value — comes out right on every date.
    """
    factor = 1.0
    for ev in events:
        if ev.type == "split" and ev.ticker == ticker and ev.date > d:
            factor *= ev.ratio
    return factor


def detect_split_adjustment(
    events: Iterable[Event],
    ticker: str,
    prices: dict[date, float],
) -> bool:
    """
    Decide, from the price data itself, whether a series is back-adjusted for
    this ticker's splits. Returns True if it is.

    Do not trust the provider's label here. Yahoo's `adjclose` field is
    documented as adjusted but did not reflect MNST's 2026-08-11 2-for-1 for at
    least a week after the fact — the series still stepped 90.36 → 45.53 across
    the split. Guessing wrong in either direction corrupts every historical
    value by a factor of the split ratio, which shows up as a fake ~50%
    drawdown, so the safe move is to look.

    The test: on a 2-for-1, an *unadjusted* series halves overnight, while an
    adjusted one steps normally. So compare the observed ratio across the split
    against 1/ratio and against 1, and take whichever it is nearer. Self-
    correcting — the day the provider backfills its adjustment, this flips on
    its own with no code change.
    """
    splits = [e for e in events if e.type == "split" and e.ticker == ticker]
    if not splits or not prices:
        return True  # no split in the window: the distinction cannot matter

    ordered = sorted(prices)
    votes_adjusted = 0
    votes_raw = 0

    for sp in splits:
        after = next((d for d in ordered if d >= sp.date), None)
        before = next((d for d in reversed(ordered) if d < sp.date), None)
        if after is None or before is None:
            continue
        p_before, p_after = prices[before], prices[after]
        if p_before <= 0:
            continue
        observed = p_after / p_before
        if abs(observed - 1.0 / sp.ratio) < abs(observed - 1.0):
            votes_raw += 1
        else:
            votes_adjusted += 1

    if votes_raw == 0 and votes_adjusted == 0:
        return True
    return votes_adjusted >= votes_raw


def adjusted_shares_timeline(
    events: Iterable[Event],
    ticker: str,
    dates: list[date],
    method: SellMethod = "fifo",
    price_split_adjusted: bool = True,
) -> list[float]:
    """
    Shares held at the close of each date in `dates`, denominated to match the
    price series they will be multiplied by.

    The goal on every date is the same: shares × price must equal the position's
    true market value that day.

      price_split_adjusted=True  — the series back-adjusts pre-split prices
        downward, so historical share counts are scaled *up* by the splits that
        came after, cancelling out.
      price_split_adjusted=False — the series is as-traded, so the raw share
        count held that day is already the right multiplier.

    Pass the result of detect_split_adjustment() rather than assuming.

    `dates` must be ascending. Replay walks forward once, so this is O(events +
    dates) rather than a full replay per date.
    """
    evs = [e for e in events if e.ticker == ticker]
    raw_shares = 0.0
    i = 0
    out: list[float] = []

    for d in dates:
        while i < len(evs) and evs[i].date <= d:
            ev = evs[i]
            if ev.type == "buy":
                raw_shares += ev.shares
            elif ev.type == "sell":
                raw_shares -= ev.shares
            elif ev.type == "split":
                raw_shares *= ev.ratio
            i += 1
        held = max(raw_shares, 0.0)
        out.append(held * split_factor_after(evs, ticker, d) if price_split_adjusted else held)

    return out


# ── cash flows, IRR, TWR ────────────────────────────────────────────────────

def external_flows(events: Iterable[Event]) -> list[tuple[date, float]]:
    """
    Net external cash moved into the portfolio per date, positive = contribution.

    A buy is money in, a sell is money out; dividends taken as cash are money
    out too (they left the portfolio). These are exactly the flows that must be
    neutralised before a return figure means anything: without them, depositing
    $1,000 looks identical to earning $1,000.
    """
    by_date: dict[date, float] = defaultdict(float)
    for ev in events:
        if ev.type == "buy":
            by_date[ev.date] += ev.shares * ev.price + ev.fee
        elif ev.type == "sell":
            by_date[ev.date] -= ev.shares * ev.price - ev.fee
        elif ev.type == "dividend":
            by_date[ev.date] -= ev.amount
    return sorted(by_date.items())


def xirr(flows: list[tuple[date, float]], guess: float = 0.1) -> float | None:
    """
    Money-weighted (dollar-weighted) annual return: the discount rate at which
    the contributions plus the final value net to zero.

    This is the number that answers "what did *my money* earn", because it
    weights each dollar by how long it was actually invested. Newton first,
    bisection as the fallback — Newton diverges on the irregular, sign-flipping
    flows a real trading history produces.

    `flows` must include the terminal portfolio value as a final negative entry
    (money coming back out). Returns None when no rate solves it.
    """
    if len(flows) < 2:
        return None
    if not (any(f > 0 for _, f in flows) and any(f < 0 for _, f in flows)):
        return None  # all one sign — no root exists

    t0 = flows[0][0]
    years = [((d - t0).days / 365.0) for d, _ in flows]
    amounts = [a for _, a in flows]

    def npv(rate: float) -> float:
        if rate <= -0.9999:
            return float("inf")
        return sum(a / (1.0 + rate) ** t for a, t in zip(amounts, years))

    rate = guess
    for _ in range(100):
        f = npv(rate)
        if abs(f) < 1e-7:
            return rate
        step = 1e-6
        derivative = (npv(rate + step) - f) / step
        if abs(derivative) < 1e-12:
            break
        new_rate = rate - f / derivative
        if new_rate <= -0.9999 or abs(new_rate) > 1e6:
            break
        if abs(new_rate - rate) < 1e-9:
            return new_rate
        rate = new_rate

    lo, hi = -0.9999, 10.0
    f_lo = npv(lo)
    if f_lo * npv(hi) > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        f_mid = npv(mid)
        if abs(f_mid) < 1e-9:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def time_weighted_returns(
    values: list[float],
    flows: list[float],
) -> list[float]:
    """
    Daily time-weighted returns from a value series and same-length flow series.

    r_t = (V_t - F_t) / V_{t-1} - 1

    Subtracting the day's external flow before comparing strips out deposits and
    withdrawals, leaving only what the *investments* did. This is the
    like-for-like number to put next to SPY: it is what your allocation returned
    per dollar, independent of when you happened to add money. (IRR answers the
    other question — see xirr.)

    Days where the prior value is ~0 (before the first buy, or a fully-closed
    portfolio) contribute a flat 0.0 rather than a divide-by-zero.
    """
    out = []
    for i in range(1, len(values)):
        prev = values[i - 1]
        if prev <= EPSILON:
            out.append(0.0)
            continue
        out.append((values[i] - flows[i]) / prev - 1.0)
    return out


# ── reconciliation ──────────────────────────────────────────────────────────

def check_reconciliation(
    derived: list[dict],
    expected: list[dict],
    tolerance: float = 0.01,
) -> list[str]:
    """
    Compare the holdings the ledger *derives* against the holdings you believe
    you have (holdings.json, or a broker statement), and report the differences.

    Returns a list of human-readable discrepancy strings; empty means they agree.

    `derived`  — output of positions_as_of()
    `expected` — [{"ticker", "shares", "cost_basis_per_share"}, ...]
    `tolerance`— relative difference to ignore, e.g. 0.01 = 1%

    TODO(kadyn): decide the policy and implement it here.

    This is the guard that makes the whole ledger trustworthy: if a buy is
    missing or a split is unrecorded, this is the only place it surfaces before
    the wrong number reaches the dashboard. The judgement call is what to do
    about a mismatch, and the trade-off is real:

      * Hard-fail (raise LedgerError) — the dashboard can never show a number
        you haven't reconciled, but a single forgotten $5 buy takes the whole
        site's data refresh down until you fix it.
      * Warn and continue on the derived numbers — trusts the ledger, keeps the
        site updating, but a silent drift can sit there for weeks.
      * Tiered — warn under some threshold, fail over it. More code, but it
        distinguishes "rounding" from "you forgot a transaction".

      Worth weighing: this runs unattended in GitHub Actions at 21:35 UTC on
      weekdays, so nobody reads a warning in real time; and shares vs cost basis
      may deserve different strictness (a share-count mismatch means a missing
      transaction, whereas a basis mismatch can be a legitimate FIFO-vs-average
      difference).

    Suggested shape — roughly 8 lines:

        issues = []
        exp = {e["ticker"]: e for e in expected}
        for pos in derived:
            e = exp.get(pos["ticker"])
            if e is None:
                issues.append(f"{pos['ticker']}: in ledger, not in holdings.json")
                continue
            # ...compare shares (and basis?) against tolerance, append on mismatch
        # ...tickers in expected but not derived
        return issues
    """
    raise NotImplementedError("check_reconciliation: see the TODO above")


# ── CLI ─────────────────────────────────────────────────────────────────────

def _cli() -> int:
    """
    Inspect the ledger without touching the network.

        python3 pipeline/ledger.py                 # derived state today
        python3 pipeline/ledger.py --as-of 2026-08-10
        python3 pipeline/ledger.py --method average

    Edit transactions.json, run this, eyeball the numbers against your broker.
    A full `pipeline/run.py` needs ~6 price fetches; this needs none, so it is
    the loop to use while typing in history.
    """
    import argparse

    ap = argparse.ArgumentParser(description="Replay transactions.json and show derived state.")
    ap.add_argument("--as-of", metavar="YYYY-MM-DD", help="replay only up to this date")
    ap.add_argument("--method", choices=("fifo", "average"), default="fifo")
    ap.add_argument("--file", type=Path, default=None, help="ledger path (default transactions.json)")
    args = ap.parse_args()

    try:
        events = load_ledger(args.file)
    except LedgerError as e:
        print(f"✗ {e}")
        return 1

    if not events:
        print("Ledger is empty — add events to transactions.json.")
        return 1

    as_of = _parse_date(args.as_of, "--as-of") if args.as_of else None

    try:
        positions = positions_as_of(events, as_of, args.method)
        summary = realised_summary(events, args.method)
    except LedgerError as e:
        print(f"✗ Replay failed: {e}")
        return 1

    label = f" as of {as_of}" if as_of else ""
    print(f"\n{len(events)} events, {events[0].date} → {events[-1].date}  ({args.method}){label}\n")

    print(f"  {'TICKER':<8}{'SHARES':>14}{'BASIS':>12}{'COST':>14}  FIRST LOT")
    print("  " + "─" * 64)
    total_cost = 0.0
    for p in positions:
        cost = p["shares"] * p["cost_basis_per_share"]
        total_cost += cost
        print(f"  {p['ticker']:<8}{p['shares']:>14.6f}{p['cost_basis_per_share']:>12.4f}"
              f"{cost:>14,.2f}  {p['purchase_date']}")
    print("  " + "─" * 64)
    print(f"  {'TOTAL':<8}{'':>14}{'':>12}{total_cost:>14,.2f}\n")

    if summary["realised_pl"] or summary["dividends_received"] or summary["fees_paid"]:
        print(f"  Realised P&L      {summary['realised_pl']:>14,.2f}")
        print(f"  Dividends         {summary['dividends_received']:>14,.2f}")
        print(f"  Fees paid         {summary['fees_paid']:>14,.2f}")
    if summary["closed_positions"]:
        print(f"  Closed positions  {', '.join(summary['closed_positions'])}")

    splits = [e for e in events if e.type == "split"]
    if splits:
        print("\n  Corporate actions:")
        for s in splits:
            print(f"    {s.date}  {s.ticker}  x{s.ratio:g}")

    # Side-by-side against the snapshot, purely to eyeball. What the pipeline
    # *does* about a mismatch is check_reconciliation()'s job, not this one's.
    snapshot = REPO_ROOT / "holdings.json"
    if snapshot.exists():
        try:
            expected = json.loads(snapshot.read_text()).get("positions", [])
        except (json.JSONDecodeError, OSError):
            expected = []
        if expected:
            print("\n  vs holdings.json snapshot:")
            derived = {p["ticker"]: p["shares"] for p in positions}
            for e in expected:
                d = derived.get(e["ticker"])
                if d is None:
                    print(f"    {e['ticker']:<8} not in ledger")
                elif abs(d - float(e["shares"])) > 1e-6:
                    print(f"    {e['ticker']:<8} ledger {d:.6f}  vs snapshot {float(e['shares']):.6f}")
            for t in derived:
                if not any(e["ticker"] == t for e in expected):
                    print(f"    {t:<8} in ledger, not in snapshot")

    try:
        issues = check_reconciliation(positions, expected if snapshot.exists() else [])
        print("\n  Policy check: " + ("PASS" if not issues else f"{len(issues)} issue(s)"))
        for m in issues:
            print(f"    ⚠  {m}")
    except NotImplementedError:
        print("\n  Policy check: not implemented (see check_reconciliation)")

    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
