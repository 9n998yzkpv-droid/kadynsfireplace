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
  const color = positive === undefined ? 'text-white' : positive ? 'positive' : 'negative'
  return (
    <div className="card" style={{ minHeight: 90 }}>
      <p className="label mb-2" data-tooltip={tooltip}>{label} ℹ</p>
      <p className={`text-xl font-semibold ${color}`}>
        {value}{unit && <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
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
      tooltip: 'Mean daily return × 252. The arithmetic expected annual return.',
      positive: p.annualised_return >= p.risk_free_rate,
    },
    {
      label: 'Annualised Volatility',
      value: fmt(p.annualised_volatility, 2),
      unit: '%',
      tooltip: 'Std dev of daily returns × √252. Measures total return dispersion — up AND down.',
    },
    {
      label: 'Sharpe Ratio',
      value: fmt(p.sharpe_ratio),
      tooltip: '(Return − Risk-free) ÷ Volatility. >1 = good; >2 = excellent. Negative = underperforming T-bills.',
      positive: p.sharpe_ratio >= 1,
    },
    {
      label: 'Sortino Ratio',
      value: fmt(p.sortino_ratio),
      tooltip: 'Like Sharpe but divides by downside deviation only. Upside volatility is not "risk."',
      positive: p.sortino_ratio >= 1,
    },
    {
      label: 'Max Drawdown',
      value: fmt(p.max_drawdown, 2),
      unit: '%',
      tooltip: `Worst peak-to-trough decline in the history. Peak: ${p.max_drawdown_peak_date} → Trough: ${p.max_drawdown_trough_date}.`,
      positive: p.max_drawdown > -20,
    },
    {
      label: 'Beta',
      value: fmt(p.beta),
      tooltip: `Sensitivity to ${p.benchmark}. 1.0 = moves with market; >1 = amplified; <1 = dampened.`,
    },
    {
      label: "Jensen's Alpha",
      value: `${p.alpha >= 0 ? '+' : ''}${fmt(p.alpha, 2)}`,
      unit: '% / yr',
      tooltip: 'Return above what CAPM predicts for this beta. Positive = genuine edge over market compensation for risk.',
      positive: p.alpha >= 0,
    },
    {
      label: 'R-Squared',
      value: fmt(p.r_squared),
      tooltip: `Fraction of portfolio variance explained by ${p.benchmark} moves. 1.0 = pure index; 0 = uncorrelated.`,
    },
    {
      label: 'Treynor Ratio',
      value: fmt(p.treynor_ratio, 3),
      tooltip: '(Return − Risk-free) ÷ Beta. Like Sharpe but uses systematic risk. Better for diversified portfolios.',
      positive: p.treynor_ratio >= 0,
    },
    {
      label: 'Tracking Error',
      value: fmt(p.tracking_error, 2),
      unit: '% / yr',
      tooltip: `Std dev of (portfolio − ${p.benchmark}) daily returns × √252. Low = index-like; high = active.`,
    },
    {
      label: 'Information Ratio',
      value: fmt(p.information_ratio),
      tooltip: 'Active return ÷ Tracking error. How much extra return per unit of active risk. >0.5 = good.',
      positive: p.information_ratio >= 0.5,
    },
    {
      label: 'VaR 95% (Hist.)',
      value: `$${p.var_95_historical_dollar?.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      tooltip: `Worst expected 1-day loss 95% of the time, using actual historical returns (${fmt(p.var_95_historical_pct, 2)}%).`,
      positive: false,
    },
    {
      label: 'VaR 95% (Param.)',
      value: `$${p.var_95_parametric_dollar?.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      tooltip: `Parametric VaR assumes normal returns: −(μ − 1.645σ) × value. (${fmt(p.var_95_parametric_pct, 2)}%). Underestimates fat tails.`,
      positive: false,
    },
    {
      label: `Corr. to ${p.benchmark}`,
      value: fmt(p.correlation_to_benchmark),
      tooltip: `Pearson correlation of daily returns with ${p.benchmark}. +1 = in lockstep; 0 = independent; −1 = inverse.`,
    },
  ]

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">Risk &amp; Return Metrics</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {metrics.map((m) => (
          <Metric key={m.label} {...m} />
        ))}
      </div>
    </div>
  )
}
