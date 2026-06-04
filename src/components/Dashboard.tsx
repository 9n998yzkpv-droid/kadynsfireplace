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
    <div className="space-y-6">
      {/* Sample data banner */}
      {data.is_sample_data && (
        <div className="rounded-lg border border-yellow-700 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300">
          <strong>Demo mode</strong> — showing sample data. Edit{' '}
          <code className="rounded bg-yellow-900/40 px-1">holdings.json</code>{' '}
          and re-run the pipeline to see your real portfolio.
        </div>
      )}

      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Portfolio Dashboard</h1>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Last updated: {data.last_updated}
        </span>
      </div>

      {/* Top-line value cards */}
      <TopLine portfolio={data.portfolio} />

      {/* Growth chart + Allocation side-by-side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
