'use client'
import type { PortfolioMetrics } from '@/lib/types'

function fmt(n: number, decimals = 2) {
  return n?.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtDollar(n: number) {
  return '$' + fmt(Math.abs(n))
}

function Card({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean
}) {
  const color = positive === undefined ? '' : positive ? 'positive' : 'negative'
  return (
    <div className="card">
      <p className="label mb-2">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

export default function TopLine({ portfolio: p }: { portfolio: PortfolioMetrics }) {
  const gain = p.total_return_dollar >= 0
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card label="Portfolio Value" value={`$${fmt(p.total_value)}`} sub={`Cost basis: $${fmt(p.total_cost_basis)}`} />
      <Card
        label="Total Return"
        value={`${gain ? '+' : '−'}${fmtDollar(p.total_return_dollar)}`}
        sub={`${gain ? '+' : ''}${fmt(p.total_return_pct)}%`}
        positive={gain}
      />
      <Card label="CAGR" value={`${p.cagr > 0 ? '+' : ''}${fmt(p.cagr)}%`} sub="Annualised compound growth" positive={p.cagr >= 0} />
      <Card label="Sharpe Ratio" value={fmt(p.sharpe_ratio, 2)} sub="Excess return per unit of risk" positive={p.sharpe_ratio >= 1} />
    </div>
  )
}
