'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Position } from '@/lib/types'

const COLORS = ['#1e40af', '#5c72c7', '#9aa8dd', '#5a544b', '#8a8273', '#bcb5a5', '#d8d2c4']

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="card text-xs" style={{ padding: '8px 12px', boxShadow: '0 2px 10px rgba(26,23,20,0.06)' }}>
      <p className="font-semibold">{d.ticker}</p>
      <p style={{ color: 'var(--text-muted)' }}>{d.weight_pct.toFixed(2)}% of portfolio</p>
    </div>
  )
}

export default function AllocationChart({ positions }: { positions: Position[] }) {
  const data = positions.map((p) => ({ ...p, value: p.market_value }))

  return (
    <div className="h-full">
      <p className="label mb-5">Allocation</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="ticker"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={90}
            paddingAngle={1.5}
            stroke="var(--bg)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(v) => <span style={{ fontSize: 12, color: '#5a544b' }}>{v}</span>}
            iconSize={9}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
