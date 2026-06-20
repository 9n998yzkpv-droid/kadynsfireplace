'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  daysUntil,
  fetchPolymarket,
  findArbs,
  toMarkets,
  type ArbOpportunity,
  type PolyMarket,
} from '@/lib/arb/polymarket'

type SortKey = 'volume24h' | 'spread' | 'change24h' | 'closes'

export default function ArbScanner() {
  const [markets, setMarkets] = useState<PolyMarket[]>([])
  const [arbs, setArbs] = useState<ArbOpportunity[]>([])
  const [updated, setUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [buffer, setBuffer] = useState(0)
  const [auto, setAuto] = useState(false)
  const [sort, setSort] = useState<SortKey>('volume24h')
  const [query, setQuery] = useState('')
  const eventsRef = useRef<Awaited<ReturnType<typeof fetchPolymarket>>>([])

  const recompute = useCallback((buf: number) => {
    setArbs(findArbs(eventsRef.current, buf))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const events = await fetchPolymarket()
      eventsRef.current = events
      setMarkets(toMarkets(events))
      setArbs(findArbs(events, buffer))
      setUpdated(new Date())
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [buffer])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [auto, refresh])

  const rows = markets
    .filter((m) => !query || m.question.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'volume24h') return b.volume24h - a.volume24h
      if (sort === 'spread') return b.spread - a.spread
      if (sort === 'change24h') return Math.abs(b.change24h) - Math.abs(a.change24h)
      const da = daysUntil(a.endDate) ?? 1e9
      const db = daysUntil(b.endDate) ?? 1e9
      return da - db
    })
    .slice(0, 40)

  return (
    <div className="rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b p-4" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-md px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? 'Scanning…' : 'Refresh'}
        </button>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[var(--accent)]" />
          Auto-refresh 30s
        </label>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Cost buffer
          <input
            type="number"
            min={0}
            step={0.5}
            value={buffer}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0
              setBuffer(v)
              recompute(v)
            }}
            className="w-14 rounded px-1.5 py-1"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          />
          ¢/leg
        </label>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          {updated ? `${markets.length} markets · updated ${updated.toLocaleTimeString()}` : ''}
        </span>
      </div>

      {err && (
        <div className="border-b px-4 py-2 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--red)' }}>
          {err}
        </div>
      )}

      {/* Arbitrage opportunities */}
      <div className="border-b p-5" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="label">Mutually-exclusive arbitrage</p>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {arbs.length} found
          </span>
        </div>
        <p className="mb-4 max-w-2xl text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Across an exhaustive set of mutually-exclusive outcomes, the YES prices should sum to 100¢. When they
          don&apos;t, you can buy the whole basket (or every NO) and lock in the gap. Edge is gross of gas and slippage.
        </p>

        {arbs.length === 0 ? (
          <div className="card py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Scanning Polymarket…' : 'No mispricings above threshold right now — these markets are efficiently priced.'}
          </div>
        ) : (
          <div className="space-y-2">
            {arbs.slice(0, 12).map((a) => (
              <ArbCard key={a.eventSlug + a.eventTitle} arb={a} />
            ))}
          </div>
        )}
      </div>

      {/* Live market scanner */}
      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="label">Live market scanner</p>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter markets…"
              className="w-40 rounded-md px-2.5 py-1 text-xs"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md px-2 py-1 text-xs"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <option value="volume24h">Top volume (24h)</option>
              <option value="spread">Widest spread</option>
              <option value="change24h">Biggest move (24h)</option>
              <option value="closes">Closing soonest</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="py-2 pr-3 text-left font-medium">Market</th>
                <th className="px-2 py-2 text-right font-medium">YES</th>
                <th className="px-2 py-2 text-right font-medium">Spread</th>
                <th className="px-2 py-2 text-right font-medium">24h</th>
                <th className="px-2 py-2 text-right font-medium">Vol 24h</th>
                <th className="px-2 py-2 text-right font-medium">Closes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const d = daysUntil(m.endDate)
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-faint)' }}>
                    <td className="max-w-[280px] truncate py-2 pr-3" title={m.question}>
                      <a
                        href={`https://polymarket.com/event/${m.eventSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[var(--accent)] hover:underline"
                      >
                        {m.question}
                      </a>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{m.yes.toFixed(0)}¢</td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {m.spread.toFixed(1)}¢
                    </td>
                    <td
                      className="px-2 py-2 text-right tabular-nums"
                      style={{ color: m.change24h >= 0 ? 'var(--green)' : 'var(--red)' }}
                    >
                      {m.change24h >= 0 ? '+' : ''}
                      {m.change24h.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      ${fmt(m.volume24h)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {d == null ? '—' : d < 1 ? '<1d' : `${Math.round(d)}d`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t px-5 py-3 text-[11px] leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        Live Polymarket data, fetched and scored entirely in your browser — no server, no account. The original
        cross-market (Kalshi ↔ Polymarket) scanner runs in the downloadable Python app, since Kalshi blocks direct
        browser access.
      </div>
    </div>
  )
}

function ArbCard({ arb }: { arb: ArbOpportunity }) {
  const [open, setOpen] = useState(false)
  const profitable = arb.netEdge > 0
  return (
    <div className="rounded-lg p-3" style={{ border: '1px solid var(--border)', background: 'var(--surface2)' }}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={`https://polymarket.com/event/${arb.eventSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-semibold hover:text-[var(--accent)] hover:underline"
            title={arb.eventTitle}
          >
            {arb.eventTitle}
          </a>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {arb.outcomes} outcomes · ΣYES {arb.sumYes.toFixed(1)}¢ ({arb.deviation >= 0 ? '+' : ''}
            {arb.deviation.toFixed(1)}) · {arb.direction}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold tabular-nums" style={{ color: profitable ? 'var(--green)' : 'var(--text-muted)' }}>
            {arb.netEdge >= 0 ? '+' : ''}
            {arb.netEdge.toFixed(1)}¢
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            net / $1 basket
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {open ? '▾' : '▸'}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-xs sm:grid-cols-3" style={{ borderColor: 'var(--border)' }}>
          {arb.legs.map((l, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate" title={l.label} style={{ color: 'var(--text-secondary)' }}>
                {l.label || `Outcome ${i + 1}`}
              </span>
              <span className="tabular-nums">{l.yes.toFixed(0)}¢</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toFixed(0)
}
