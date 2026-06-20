'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EF_PRESETS, loadEFData, type EFData } from '@/lib/ef/data'
import {
  computeStats,
  efficientFrontier,
  maxSharpePoint,
  minVariancePoint,
  randomPortfolios,
  type AssetStat,
  type Bounds,
  type FrontierPoint,
} from '@/lib/ef/optimizer'
import { analyzePortfolio, type AnalysisSection } from '@/lib/ef/analysis'

const DEFAULT = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'JPM', 'JNJ', 'V']
const MAX_TICKERS = 15

interface Results {
  frontier: FrontierPoint[]
  cloud: { x: number; y: number; sharpe: number }[]
  assets: AssetStat[]
  tickers: string[]
  minVarIdx: number
  maxSharpeIdx: number
}

// interpolate light-slate -> accent blue by normalized Sharpe
function sharpeColor(t: number): string {
  const a = [203, 213, 225] // #cbd5e1
  const b = [30, 64, 175] // #1e40af
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * Math.max(0, Math.min(1, t))))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export default function EFDashboard() {
  const [data, setData] = useState<EFData | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [selected, setSelected] = useState<string[]>(DEFAULT)
  const [period, setPeriod] = useState<'1y' | '2y'>('2y')
  const [adding, setAdding] = useState('')
  const [bounds, setBounds] = useState<Record<string, { min: string; max: string }>>({})
  const [showConstraints, setShowConstraints] = useState(false)
  const [results, setResults] = useState<Results | null>(null)
  const [selPoint, setSelPoint] = useState<FrontierPoint | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisSection[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    loadEFData()
      .then(setData)
      .catch((e) => setLoadErr(e.message))
  }, [])

  const universe = useMemo(() => (data ? data.tickers.map((t) => t.symbol) : []), [data])
  const nameOf = useMemo(() => {
    const m: Record<string, string> = {}
    data?.tickers.forEach((t) => (m[t.symbol] = t.name))
    return m
  }, [data])

  function addTicker(raw: string) {
    const t = raw.trim().toUpperCase()
    setAdding('')
    if (!t) return
    if (!universe.includes(t)) {
      setErr(`${t} isn't in the offline dataset.`)
      return
    }
    if (selected.includes(t)) return
    if (selected.length >= MAX_TICKERS) {
      setErr(`Up to ${MAX_TICKERS} tickers.`)
      return
    }
    setErr('')
    setSelected([...selected, t])
  }

  function getBounds(tickers: string[]): Bounds {
    if (!showConstraints) return null
    const b: [number, number][] = tickers.map((t) => {
      const v = bounds[t] || { min: '', max: '' }
      const lo = v.min !== '' ? parseFloat(v.min) / 100 : 0
      const hi = v.max !== '' ? parseFloat(v.max) / 100 : 1
      return [lo, hi]
    })
    const sumMin = b.reduce((a, x) => a + x[0], 0)
    const sumMax = b.reduce((a, x) => a + x[1], 0)
    if (sumMin > 1.0001) throw new Error(`Min weights sum to ${(sumMin * 100).toFixed(0)}% — must be ≤ 100%.`)
    if (sumMax < 0.9999) throw new Error(`Max weights sum to ${(sumMax * 100).toFixed(0)}% — must be ≥ 100%.`)
    for (let i = 0; i < b.length; i++)
      if (b[i][0] > b[i][1]) throw new Error(`${tickers[i]}: min can't exceed max.`)
    const trivial = b.every((x) => x[0] === 0 && x[1] === 1)
    return trivial ? null : b
  }

  function analyze() {
    if (!data) return
    if (selected.length < 2) {
      setErr('Pick at least 2 tickers.')
      return
    }
    setErr('')
    setBusy(true)
    // let the spinner paint before the synchronous solve
    setTimeout(() => {
      try {
        const lookback = period === '1y' ? 252 : undefined
        const tickers = [...selected]
        const { mean, cov, assets } = computeStats(tickers, data.returns, lookback)
        const b = getBounds(tickers)
        const frontier = efficientFrontier(mean, cov, b)
        const cloudRaw = randomPortfolios(mean, cov, b)
        const cloud = cloudRaw.map((p) => ({
          x: p.volatility * 100,
          y: p.return * 100,
          sharpe: p.sharpe,
        }))
        const minVar = minVariancePoint(frontier)
        const maxShp = maxSharpePoint(frontier)
        const res: Results = {
          frontier,
          cloud,
          assets,
          tickers,
          minVarIdx: frontier.indexOf(minVar),
          maxSharpeIdx: frontier.indexOf(maxShp),
        }
        setResults(res)
        selectPoint(maxShp, res)
      } catch (e) {
        setErr((e as Error).message)
        setResults(null)
      } finally {
        setBusy(false)
      }
    }, 20)
  }

  function selectPoint(p: FrontierPoint, res: Results) {
    setSelPoint(p)
    setAnalysis(
      analyzePortfolio({ point: p, tickers: res.tickers, assets: res.assets, frontier: res.frontier }),
    )
  }

  // chart datasets
  const frontierData = useMemo(
    () =>
      results?.frontier.map((p, i) => ({ x: p.volatility * 100, y: p.return * 100, idx: i })) ?? [],
    [results],
  )
  const assetData = useMemo(
    () =>
      results?.assets.map((a) => ({
        x: a.volatility * 100,
        y: a.return * 100,
        label: a.ticker,
      })) ?? [],
    [results],
  )
  const sharpeRange = useMemo(() => {
    if (!results) return [0, 1]
    const s = results.cloud.map((p) => p.sharpe)
    return [Math.min(...s), Math.max(...s)]
  }, [results])

  if (loadErr)
    return (
      <div className="card py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        {loadErr}
      </div>
    )
  if (!data)
    return (
      <div className="card py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading market dataset…
      </div>
    )

  const selSharpe = selPoint && selPoint.volatility > 0 ? selPoint.return / selPoint.volatility : 0
  const alloc = selPoint
    ? results!.tickers
        .map((t, i) => ({ t, w: selPoint.weights[i] }))
        .filter((a) => a.w > 0.001)
        .sort((a, b) => b.w - a.w)
    : []

  return (
    <div className="rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Controls */}
      <div className="border-b p-5" style={{ borderColor: 'var(--border)' }}>
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((t) => (
            <button
              key={t}
              onClick={() => setSelected(selected.filter((x) => x !== t))}
              className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              title={nameOf[t]}
            >
              {t}
              <span style={{ color: 'var(--text-muted)' }} className="group-hover:text-[var(--red)]">
                ×
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            list="ef-universe"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTicker(adding)
              }
            }}
            placeholder="Add ticker…"
            className="w-32 rounded-md px-2.5 py-1.5 text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          />
          <datalist id="ef-universe">
            {universe
              .filter((s) => !selected.includes(s))
              .map((s) => (
                <option key={s} value={s}>
                  {nameOf[s]}
                </option>
              ))}
          </datalist>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '1y' | '2y')}
            className="rounded-md px-2 py-1.5 text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <option value="1y">1 Year</option>
            <option value="2y">2 Years</option>
          </select>

          <div className="flex flex-wrap gap-1.5">
            {EF_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setSelected(p.tickers.filter((t) => universe.includes(t)).slice(0, MAX_TICKERS))
                  setErr('')
                }}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:text-[var(--accent)]"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={analyze}
            disabled={busy}
            className="ml-auto rounded-md px-5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {busy ? 'Optimizing…' : 'Analyze'}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => setShowConstraints((s) => !s)}
            className="text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            {showConstraints ? '▾' : '▸'} Per-asset weight limits
          </button>
          {err && (
            <span className="text-xs font-medium" style={{ color: 'var(--red)' }}>
              {err}
            </span>
          )}
        </div>

        {showConstraints && (
          <div className="mt-3 flex flex-wrap gap-3">
            {selected.map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-xs">
                <span className="w-12 font-medium">{t}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={bounds[t]?.min ?? ''}
                  onChange={(e) =>
                    setBounds({ ...bounds, [t]: { min: e.target.value, max: bounds[t]?.max ?? '' } })
                  }
                  className="w-14 rounded px-1.5 py-1"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="100"
                  value={bounds[t]?.max ?? ''}
                  onChange={(e) =>
                    setBounds({ ...bounds, [t]: { min: bounds[t]?.min ?? '', max: e.target.value } })
                  }
                  className="w-14 rounded px-1.5 py-1"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart + results */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
        <div className="min-h-[420px] p-4">
          {!results ? (
            <div
              className="flex h-[400px] flex-col items-center justify-center text-center text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3">
                <path d="M3 3v18h18" />
                <path d="M7 16l4-8 4 4 5-9" />
              </svg>
              Pick tickers and hit <strong className="mx-1">Analyze</strong> to build the frontier.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={420}>
                <ScatterChart margin={{ top: 16, right: 20, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke="var(--grid)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Volatility"
                    unit="%"
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={(v) => v.toFixed(0)}
                    label={{ value: 'Annual volatility (risk) →', position: 'bottom', offset: 12, fontSize: 12, fill: 'var(--text-secondary)' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Return"
                    unit="%"
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={(v) => v.toFixed(0)}
                    label={{ value: 'Annual return →', angle: -90, position: 'insideLeft', offset: 16, fontSize: 12, fill: 'var(--text-secondary)' }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: 'var(--border)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload
                      return (
                        <div className="card" style={{ padding: '8px 12px', fontSize: 12 }}>
                          <div>Return: {p.y.toFixed(1)}%</div>
                          <div>Risk: {p.x.toFixed(1)}%</div>
                          {p.label && <div className="font-semibold">{p.label}</div>}
                        </div>
                      )
                    }}
                  />
                  <Scatter
                    data={results.cloud}
                    isAnimationActive={false}
                    shape={(props: any) => {
                      const [lo, hi] = sharpeRange
                      const t = hi > lo ? (props.payload.sharpe - lo) / (hi - lo) : 0.5
                      return <circle cx={props.cx} cy={props.cy} r={2} fill={sharpeColor(t)} fillOpacity={0.45} />
                    }}
                  />
                  <Scatter
                    data={frontierData}
                    line={{ stroke: 'var(--accent)', strokeWidth: 2 }}
                    lineJointType="monotoneX"
                    isAnimationActive={false}
                    shape={(props: any) => (
                      <circle cx={props.cx} cy={props.cy} r={3} fill="var(--accent)" style={{ cursor: 'pointer' }} />
                    )}
                    onClick={(d: any) => {
                      const idx = d?.idx ?? d?.payload?.idx
                      if (idx != null && results) selectPoint(results.frontier[idx], results)
                    }}
                  />
                  <Scatter data={assetData} isAnimationActive={false} shape="diamond" fill="var(--red)">
                    <LabelList dataKey="label" position="top" style={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  </Scatter>
                  {selPoint && (
                    <Scatter
                      data={[{ x: selPoint.volatility * 100, y: selPoint.return * 100 }]}
                      isAnimationActive={false}
                      shape="star"
                      fill="var(--green)"
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>

              <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 px-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <Legend color="var(--accent)" label="Efficient frontier (click a point)" />
                <Legend color="var(--red)" label="Individual assets" shape="diamond" />
                <Legend color="var(--green)" label="Selected portfolio" shape="star" />
                <span>· dots = 2,500 random portfolios, shaded by Sharpe</span>
              </div>

              {/* target-risk slider as a robust alternative to clicking */}
              <div className="mt-3 flex items-center gap-3 px-2">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Target&nbsp;risk
                </span>
                <input
                  type="range"
                  min={0}
                  max={results.frontier.length - 1}
                  value={selPoint ? results.frontier.indexOf(selPoint) : results.maxSharpeIdx}
                  onChange={(e) => selectPoint(results.frontier[parseInt(e.target.value)], results)}
                  className="flex-1 accent-[var(--accent)]"
                />
                <button
                  onClick={() => selectPoint(results.frontier[results.maxSharpeIdx], results)}
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  Max Sharpe
                </button>
                <button
                  onClick={() => selectPoint(results.frontier[results.minVarIdx], results)}
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  Min risk
                </button>
              </div>
            </>
          )}
        </div>

        {/* Results sidebar */}
        <div className="border-t p-5 lg:border-l lg:border-t-0" style={{ borderColor: 'var(--border)' }}>
          {!selPoint ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Select a point on the frontier to see its allocation, metrics, and a plain-English read.
            </p>
          ) : (
            <div className="fade-in">
              <p className="label mb-3">Selected portfolio</p>
              <div className="mb-5 grid grid-cols-3 gap-2">
                <Metric label="Return" value={`${(selPoint.return * 100).toFixed(1)}%`} color="var(--green)" />
                <Metric label="Risk" value={`${(selPoint.volatility * 100).toFixed(1)}%`} />
                <Metric label="Sharpe" value={selSharpe.toFixed(2)} />
              </div>

              <p className="label mb-2">Allocation</p>
              <div className="mb-5 space-y-1.5">
                {alloc.map((a) => (
                  <div key={a.t} className="flex items-center gap-2 text-xs">
                    <span className="w-12 font-medium">{a.t}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface2)' }}>
                      <div className="h-full rounded-full" style={{ width: `${a.w * 100}%`, background: 'var(--accent)' }} />
                    </div>
                    <span className="w-10 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {(a.w * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>

              <p className="label mb-2">Analysis</p>
              <div className="space-y-3">
                {analysis.map((s) => (
                  <div key={s.title}>
                    <p className="text-xs font-semibold">{s.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {s.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-5 py-3 text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        Runs entirely in your browser on a baked price dataset (as of {data.as_of}; {data.tickers.length} tickers,{' '}
        {data.trading_days} trading days). No server, no account.
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md p-2" style={{ background: 'var(--surface2)' }}>
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-base font-semibold tabular-nums" style={{ color: color || 'var(--text)' }}>
        {value}
      </p>
    </div>
  )
}

function Legend({ color, label, shape }: { color: string; label: string; shape?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block"
        style={{
          width: 8,
          height: 8,
          background: color,
          borderRadius: shape === 'diamond' ? 0 : '999px',
          transform: shape === 'diamond' ? 'rotate(45deg)' : shape === 'star' ? 'none' : 'none',
          clipPath: shape === 'star' ? 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' : 'none',
        }}
      />
      {label}
    </span>
  )
}
