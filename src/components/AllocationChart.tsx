'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Position } from '@/lib/types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card text-xs" style={{ padding: '8px 12px' }}>
      <p className="font-semibold">{d.ticker}</p>
      <p style={{ color: 'var(--text-muted)' }}>{d.weight_pct.toFixed(2)}% of portfolio</p>
      <p>${d.market_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
    </div>
  )
}

export default function AllocationChart({ positions }: { positions: Position[] }) {
  const data = positions.map((p) => ({ ...p, value: p.market_value }))

  return (
    <div className="card h-full">
      <p className="label mb-4">Allocation</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="ticker"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>}
            iconSize={10}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
