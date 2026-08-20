"""
Regression tests for the ledger replay engine.

Run:  python3 pipeline/test_ledger.py

Stdlib unittest, no pytest dependency, so CI can run it with the same
interpreter that runs the pipeline. These guard the failure modes that are
invisible on a dashboard: a split applied to the wrong side of the books, a
deposit counted as performance, or a price series whose adjustment convention
flipped under us.
"""
from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import ledger as L


def ev(**kw) -> L.Event:
    return L.Event(kw, 0)


class TestSplits(unittest.TestCase):
    def test_split_preserves_total_cost(self):
        """A 2-for-1 doubles shares and halves basis; total cost is invariant."""
        events = [
            ev(type="buy", ticker="MNST", date="2025-01-02", shares=10, price=80.0),
            ev(type="split", ticker="MNST", date="2026-08-11", ratio=2),
        ]
        st = L.replay(events)["MNST"]
        self.assertAlmostEqual(st.shares, 20.0)
        self.assertAlmostEqual(st.avg_cost_basis, 40.0)
        self.assertAlmostEqual(st.cost_basis_total, 800.0)

    def test_reverse_split(self):
        """ratio < 1 is a reverse split: fewer shares, higher basis."""
        events = [
            ev(type="buy", ticker="XYZ", date="2025-01-02", shares=100, price=2.0),
            ev(type="split", ticker="XYZ", date="2025-06-01", ratio=0.1),
        ]
        st = L.replay(events)["XYZ"]
        self.assertAlmostEqual(st.shares, 10.0)
        self.assertAlmostEqual(st.avg_cost_basis, 20.0)
        self.assertAlmostEqual(st.cost_basis_total, 200.0)

    def test_split_applies_only_to_prior_lots(self):
        """Shares bought after the split are already in post-split terms."""
        events = [
            ev(type="buy", ticker="MNST", date="2025-01-02", shares=10, price=80.0),
            ev(type="split", ticker="MNST", date="2026-08-11", ratio=2),
            ev(type="buy", ticker="MNST", date="2026-08-12", shares=5, price=46.0),
        ]
        st = L.replay(events)["MNST"]
        self.assertAlmostEqual(st.shares, 25.0)           # 10*2 + 5
        self.assertAlmostEqual(st.cost_basis_total, 1030.0)  # 800 + 230

    def test_split_isolated_to_its_ticker(self):
        events = [
            ev(type="buy", ticker="MNST", date="2025-01-02", shares=10, price=80.0),
            ev(type="buy", ticker="VOO", date="2025-01-02", shares=2, price=600.0),
            ev(type="split", ticker="MNST", date="2026-08-11", ratio=2),
        ]
        states = L.replay(events)
        self.assertAlmostEqual(states["MNST"].shares, 20.0)
        self.assertAlmostEqual(states["VOO"].shares, 2.0)


class TestSellAccounting(unittest.TestCase):
    """FIFO and average agree on totals but split realised/unrealised differently."""

    EVENTS = [
        ev(type="buy", ticker="AAA", date="2025-01-02", shares=10, price=10.0),
        ev(type="buy", ticker="AAA", date="2025-06-02", shares=10, price=20.0),
        ev(type="sell", ticker="AAA", date="2025-09-02", shares=10, price=30.0),
    ]

    def test_fifo_sells_oldest_lot(self):
        st = L.replay(self.EVENTS, method="fifo")["AAA"]
        self.assertAlmostEqual(st.realised_pl, 200.0)      # 300 proceeds - 100 basis
        self.assertAlmostEqual(st.shares, 10.0)
        self.assertAlmostEqual(st.avg_cost_basis, 20.0)    # the $20 lot remains

    def test_average_sells_blended_basis(self):
        st = L.replay(self.EVENTS, method="average")["AAA"]
        self.assertAlmostEqual(st.realised_pl, 150.0)      # 300 - 150 blended
        self.assertAlmostEqual(st.shares, 10.0)
        self.assertAlmostEqual(st.avg_cost_basis, 15.0)

    def test_methods_agree_on_total_pl(self):
        """Whatever the method, realised + unrealised at one price is identical."""
        price = 30.0
        for method in ("fifo", "average"):
            st = L.replay(self.EVENTS, method=method)["AAA"]
            total = st.realised_pl + (st.shares * price - st.cost_basis_total)
            self.assertAlmostEqual(total, 300.0, msg=f"method={method}")

    def test_fees_capitalise_into_basis(self):
        events = [ev(type="buy", ticker="AAA", date="2025-01-02", shares=10, price=10.0, fee=5.0)]
        st = L.replay(events)["AAA"]
        self.assertAlmostEqual(st.cost_basis_total, 105.0)

    def test_overselling_is_rejected(self):
        events = [
            ev(type="buy", ticker="AAA", date="2025-01-02", shares=5, price=10.0),
            ev(type="sell", ticker="AAA", date="2025-02-02", shares=6, price=12.0),
        ]
        with self.assertRaises(L.LedgerError):
            L.replay(events)

    def test_sell_after_split_uses_split_adjusted_shares(self):
        """Selling 15 of 20 post-split shares is legal even though only 10 were bought."""
        events = [
            ev(type="buy", ticker="MNST", date="2025-01-02", shares=10, price=80.0),
            ev(type="split", ticker="MNST", date="2026-08-11", ratio=2),
            ev(type="sell", ticker="MNST", date="2026-08-12", shares=15, price=46.0),
        ]
        st = L.replay(events)["MNST"]
        self.assertAlmostEqual(st.shares, 5.0)
        self.assertAlmostEqual(st.realised_pl, 690.0 - 600.0)  # 15*46 - 15*40


class TestSplitAdjustmentDetection(unittest.TestCase):
    """The bug that produced a fake 26% drawdown: guessing the price convention."""

    SPLIT = [ev(type="split", ticker="MNST", date="2026-08-11", ratio=2)]

    def test_detects_as_traded_series(self):
        prices = {date(2026, 8, 7): 90.36, date(2026, 8, 11): 45.53}
        self.assertFalse(L.detect_split_adjustment(self.SPLIT, "MNST", prices))

    def test_detects_back_adjusted_series(self):
        prices = {date(2026, 8, 7): 45.18, date(2026, 8, 11): 45.53}
        self.assertTrue(L.detect_split_adjustment(self.SPLIT, "MNST", prices))

    def test_no_split_defaults_to_adjusted(self):
        prices = {date(2026, 8, 7): 90.36, date(2026, 8, 11): 45.53}
        self.assertTrue(L.detect_split_adjustment([], "MNST", prices))

    def test_timeline_matches_value_under_both_conventions(self):
        """
        The invariant that matters: shares x price must give the same market
        value whichever convention the provider used.
        """
        events = [
            ev(type="buy", ticker="MNST", date="2025-01-02", shares=10, price=80.0),
        ] + self.SPLIT
        d = date(2026, 8, 10)  # the day before the split

        raw = L.adjusted_shares_timeline(events, "MNST", [d], price_split_adjusted=False)[0]
        adj = L.adjusted_shares_timeline(events, "MNST", [d], price_split_adjusted=True)[0]

        self.assertAlmostEqual(raw * 90.36, adj * 45.18, places=4)
        self.assertAlmostEqual(raw, 10.0)
        self.assertAlmostEqual(adj, 20.0)


class TestReturns(unittest.TestCase):
    def test_twr_ignores_deposits(self):
        """
        The whole point of time-weighting: doubling the account with a deposit
        must not read as a 100% gain.
        """
        values = [1000.0, 1000.0, 2000.0, 2100.0]
        flows = [0.0, 0.0, 1000.0, 0.0]   # $1,000 deposited on day 2
        rets = L.time_weighted_returns(values, flows)
        self.assertAlmostEqual(rets[1], 0.0)              # deposit day: no return
        self.assertAlmostEqual(rets[2], 0.05)             # 2000 -> 2100
        self.assertAlmostEqual((1 + rets[0]) * (1 + rets[1]) * (1 + rets[2]) - 1, 0.05)

    def test_twr_survives_zero_start(self):
        rets = L.time_weighted_returns([0.0, 100.0, 110.0], [0.0, 100.0, 0.0])
        self.assertEqual(rets[0], 0.0)
        self.assertAlmostEqual(rets[1], 0.10)

    def test_xirr_recovers_a_known_rate(self):
        """$1,000 in, $1,100 out exactly one year later = 10%."""
        rate = L.xirr([(date(2025, 1, 1), 1000.0), (date(2026, 1, 1), -1100.0)])
        self.assertIsNotNone(rate)
        self.assertAlmostEqual(rate, 0.10, places=3)

    def test_xirr_weights_by_time_invested(self):
        """A late contribution had less time to compound, so IRR exceeds simple return."""
        flows = [
            (date(2025, 1, 1), 1000.0),
            (date(2025, 11, 1), 1000.0),
            (date(2026, 1, 1), -2200.0),
        ]
        rate = L.xirr(flows)
        self.assertIsNotNone(rate)
        self.assertGreater(rate, 0.10)

    def test_xirr_returns_none_without_a_sign_change(self):
        self.assertIsNone(L.xirr([(date(2025, 1, 1), 100.0), (date(2026, 1, 1), 100.0)]))

    def test_external_flows_net_buys_and_sells(self):
        events = [
            ev(type="buy", ticker="AAA", date="2025-01-02", shares=10, price=10.0, fee=1.0),
            ev(type="sell", ticker="AAA", date="2025-06-02", shares=5, price=20.0),
            ev(type="dividend", ticker="AAA", date="2025-07-02", amount=3.0),
        ]
        flows = dict(L.external_flows(events))
        self.assertAlmostEqual(flows[date(2025, 1, 2)], 101.0)   # cost + fee in
        self.assertAlmostEqual(flows[date(2025, 6, 2)], -100.0)  # proceeds out
        self.assertAlmostEqual(flows[date(2025, 7, 2)], -3.0)    # cash dividend out


class TestValidation(unittest.TestCase):
    def test_rejects_unknown_event_type(self):
        with self.assertRaises(L.LedgerError):
            ev(type="merger", ticker="AAA", date="2025-01-02")

    def test_rejects_bad_date(self):
        with self.assertRaises(L.LedgerError):
            ev(type="buy", ticker="AAA", date="01/02/2025", shares=1, price=1.0)

    def test_rejects_negative_shares(self):
        with self.assertRaises(L.LedgerError):
            ev(type="buy", ticker="AAA", date="2025-01-02", shares=-1, price=1.0)

    def test_allows_zero_price_for_gifted_shares(self):
        e = ev(type="buy", ticker="AAA", date="2025-01-02", shares=1, price=0)
        self.assertEqual(e.price, 0.0)


class TestRealLedger(unittest.TestCase):
    """Guards the checked-in transactions.json against corruption."""

    def test_ledger_loads_and_reconciles_mnst_split(self):
        events = L.load_ledger()
        if not events:
            self.skipTest("no transactions.json")
        positions = {p["ticker"]: p for p in L.positions_as_of(events)}
        if "MNST" in positions:
            m = positions["MNST"]
            # Whatever the lots, the split must leave a round post-split count:
            # total cost is unchanged by a split, so basis x shares must match
            # the sum of what was actually paid.
            st = L.replay(events)["MNST"]
            self.assertAlmostEqual(
                m["shares"] * m["cost_basis_per_share"], st.cost_basis_total, places=2
            )

    def test_events_are_chronological_after_load(self):
        events = L.load_ledger()
        dates = [e.date for e in events]
        self.assertEqual(dates, sorted(dates))


if __name__ == "__main__":
    unittest.main(verbosity=2)
