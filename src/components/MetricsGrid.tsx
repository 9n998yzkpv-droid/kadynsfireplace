'use client'
import type { PortfolioMetrics } from '@/lib/types'

function fmt(n: number | undefined, decimals = 3) {
  if (n === undefined || n === null || isNaN(n as number)) return '—'
  return (n as number).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

interface MetricDef {
  label: string
  value: string | number
  unit?: string
  tooltip: string
  positive?: boolean
}

function Metric({ label, value, unit = '', tooltip, positive }: MetricDef) {
  const color = positive === undefined ? 'var(--text)' : positive ? 'var(--green)' : 'var(--red)'
  return (
    <div className="pt-3" style={{ borderTop: '1px solid var(--border-faint)' }}>
      <p className="label mb-1.5" data-tooltip={tooltip}>
        {label}
        <span className="info-mark" aria-hidden="true">ℹ</span>
      </p>
      <p className="text-xl font-medium" style={{ color, letterSpacing: '-0.01em' }}>
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
            {unit}
          </span>
        )}
      </p>
    </div>
  )
}

export default function MetricsGrid({
  portfolio: p,
  riskContrib,
}: {
  portfolio: PortfolioMetrics
  riskContrib: Record<string, number>
}) {
  const metrics: MetricDef[] = [
    {
      label: 'Annualised Return',
      value: `${p.annualised_return >= 0 ? '+' : ''}${fmt(p.annualised_return, 2)}`,
      unit: '%',
      tooltip: 'How much your portfolio would grow in a year if every day performed like the average. Think of it as your yearly pace.',
      positive: p.annualised_return >= p.risk_free_rate,
    },
    {
      label: 'Annualised Volatility',
      value: fmt(p.annualised_volatility, 2),
      unit: '%',
      tooltip: 'How much your portfolio bounces around day to day, stretched to a yearly number. Higher means a bumpier ride — both up and down.',
    },
    {
      label: 'Sharpe Ratio',
      value: fmt(p.sharpe_ratio),
      tooltip: 'Are you getting paid enough for the risk you\'re taking? Above 1 is solid, above 2 is excellent. Below 0 means a savings account would\'ve beaten you.',
      positive: p.sharpe_ratio >= 1,
    },
    {
      label: 'Sortino Ratio',
      value: fmt(p.sortino_ratio),
      tooltip: 'Like the Sharpe Ratio, but only counts the bad volatility (drops). Going up a lot isn\'t "risk" — this metric agrees with that.',
      positive: p.sortino_ratio >= 1,
    },
    {
      label: 'Max Drawdown',
      value: fmt(p.max_drawdown, 2),
      unit: '%',
      tooltip: `The worst drop from a high point to a low point in your portfolio's history. This is the biggest "dip" you had to sit through.`,
      positive: p.max_drawdown > -20,
    },
    {
      label: 'Beta',
      value: fmt(p.beta),
      tooltip: `How much your portfolio moves when the market (${p.benchmark}) moves. 1.0 means you move in sync. Above 1 means you swing harder; below 1 means you're steadier.`,
    },
    {
      label: "Jensen's Alpha",
      value: `${p.alpha >= 0 ? '+' : ''}${fmt(p.alpha, 2)}`,
      unit: '% / yr',
      tooltip: 'The extra return you earned beyond what the market would predict for your level of risk. Positive means you\'re doing something right.',
      positive: p.alpha >= 0,
    },
    {
      label: 'R-Squared',
      value: fmt(p.r_squared),
      tooltip: `How closely your portfolio follows the market (${p.benchmark}). 1.0 means it moves exactly like the index. Closer to 0 means your picks are doing their own thing.`,
    },
    {
      label: 'Treynor Ratio',
      value: fmt(p.treynor_ratio, 3),
      tooltip: 'How much return you\'re earning for the market risk you\'re exposed to. Higher is better — it means more reward per unit of market-level risk.',
      positive: p.treynor_ratio >= 0,
    },
    {
      label: 'Tracking Error',
      value: fmt(p.tracking_error, 2),
      unit: '% / yr',
      tooltip: `How much your portfolio's returns differ from the market (${p.benchmark}) day to day. Low means you're hugging the index; high means you're charting your own course.`,
    },
    {
      label: 'Information Ratio',
      value: fmt(p.information_ratio),
      tooltip: 'How consistently you beat (or trail) the market. Above 0.5 means your active decisions are paying off reliably, not just by luck.',
      positive: p.information_ratio >= 0.5,
    },
    {
      label: 'VaR 95%',
      value: `${fmt(p.var_95_historical_pct, 2)}`,
      unit: '%',
      tooltip: 'On 95% of days, your portfolio shouldn\'t lose more than this percentage. Think of it as a "bad day" estimate — the kind of drop you\'d only expect once a month.',
      positive: false,
    },
    {
      label: `Corr. to ${p.benchmark}`,
      value: fmt(p.correlation_to_benchmark),
      tooltip: `How closely your daily returns mirror the market (${p.benchmark}). +1 means they move together perfectly. 0 means no connection. -1 means they move in opposite directions.`,
    },
  ]

  return (
    <div>
      <p className="label mb-6">Risk &amp; Return Metrics</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {metrics.map((m) => (
          <Metric key={m.label} {...m} />
        ))}
      </div>
    </div>
  )
}
