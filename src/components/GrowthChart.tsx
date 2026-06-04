'use client'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, ReferenceLine
} from 'recharts'

interface Props {
  data: Array<{ date: string; portfolio: number; [key: string]: number | string }>
  benchmark: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card text-xs" style={{ padding: '8px 12px', minWidth: 160 }}>
      <p className="label mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toFixed(1)}</strong>
        </p>
      ))}
    </div>
  )
}

export default function GrowthChart({ data, benchmark }: Props) {
  // Sample every Nth point for readability
  const thinned = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 180)) === 0)

  return (
    <div className="card">
      <p className="label mb-4">Portfolio vs {benchmark} — Growth of $100</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={thinned} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3a6e" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            tickFormatter={(d) => d.slice(0, 7)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v.toFixed(0)}`}
            width={42}
          />
          <ReferenceLine y={100} stroke="#1e3a6e" strokeDasharray="4 2" />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(v) => v === 'portfolio' ? 'Portfolio' : v}
          />
          <Line
            type="monotone"
            dataKey="portfolio"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey={benchmark}
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
