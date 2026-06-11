'use client'
import type { DashboardData } from '@/lib/types'
import TopLine from './TopLine'
import MetricsGrid from './MetricsGrid'
import GrowthChart from './GrowthChart'
import AllocationChart from './AllocationChart'
import CorrelationMatrix from './CorrelationMatrix'
import PositionsTable from './PositionsTable'

export default function Dashboard({ data }: { data: DashboardData }) {
  const bm = data.portfolio.benchmark

  return (
    <div className="space-y-12">
      {/* Sample data banner */}
      {data.is_sample_data && (
        <div className="card px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text)' }}>Demo mode</strong> — showing sample data. Edit{' '}
          <code className="rounded px-1" style={{ background: 'var(--surface2)' }}>holdings.json</code>{' '}
          and re-run the pipeline to see your real portfolio.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif-display text-3xl tracking-tight">Portfolio Dashboard</h1>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Last updated: {data.last_updated}
        </span>
      </div>

      {/* Top-line stat row */}
      <TopLine portfolio={data.portfolio} />

      {/* Growth chart + Allocation side-by-side */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-10">
        <div className="lg:col-span-2">
          <GrowthChart data={data.growth_chart} benchmark={bm} />
        </div>
        <div>
          <AllocationChart positions={data.positions} />
        </div>
      </div>

      {/* Metrics grid */}
      <MetricsGrid portfolio={data.portfolio} riskContrib={data.risk_contribution} />

      {/* Positions table */}
      <PositionsTable positions={data.positions} riskContrib={data.risk_contribution} />

      {/* Correlation matrix */}
      <CorrelationMatrix matrix={data.matrices.correlation} />
    </div>
  )
}
