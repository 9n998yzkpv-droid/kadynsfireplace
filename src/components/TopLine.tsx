'use client'
import type { PortfolioMetrics } from '@/lib/types'

function fmt(n: number, decimals = 2) {
  return n?.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function Stat({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean
}) {
  const color = positive === undefined ? 'var(--text)' : positive ? 'var(--green)' : 'var(--red)'
  return (
    <div>
      <p className="label mb-2">{label}</p>
      <p
        className="text-3xl font-medium sm:text-4xl"
        style={{ color, letterSpacing: '-0.02em' }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default function TopLine({ portfolio: p }: { portfolio: PortfolioMetrics }) {
  const gain = p.total_return_dollar >= 0
  return (
    <div
      className="grid grid-cols-2 gap-x-8 gap-y-8 py-8 sm:grid-cols-4"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <Stat
        label="Total Return"
        value={`${gain ? '+' : ''}${fmt(p.total_return_pct)}%`}
        sub="Since inception"
        positive={gain}
      />
      <Stat label="CAGR" value={`${p.cagr > 0 ? '+' : ''}${fmt(p.cagr)}%`} sub="Annualised compound growth" positive={p.cagr >= 0} />
      <Stat label="Sharpe Ratio" value={fmt(p.sharpe_ratio, 2)} sub="Excess return per unit of risk" positive={p.sharpe_ratio >= 1} />
      <Stat label="Sortino Ratio" value={fmt(p.sortino_ratio, 2)} sub="Downside risk-adjusted return" positive={p.sortino_ratio >= 1} />
    </div>
  )
}
