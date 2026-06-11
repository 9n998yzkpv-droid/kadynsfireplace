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
    <div className="card text-xs" style={{ padding: '8px 12px', minWidth: 160, boxShadow: '0 2px 10px rgba(26,23,20,0.06)' }}>
      <p className="label mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: 'var(--text-secondary)' }}>
          {p.name === 'portfolio' ? 'Portfolio' : p.name}:{' '}
          <strong style={{ color: 'var(--text)' }}>{p.value?.toFixed(1)}</strong>
        </p>
      ))}
    </div>
  )
}

export default function GrowthChart({ data, benchmark }: Props) {
  // Sample every Nth point for readability
  const thinned = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 180)) === 0)

  return (
    <div>
      <p className="label mb-5">Portfolio vs {benchmark} — Growth of $100</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={thinned} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(26,23,20,0.08)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#7c766b' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(26,23,20,0.08)' }}
            tickFormatter={(d) => d.slice(0, 7)}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#7c766b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v.toFixed(0)}`}
            width={42}
          />
          <ReferenceLine y={100} stroke="rgba(26,23,20,0.15)" strokeDasharray="4 4" />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#5a544b' }}
            formatter={(v) => (
              <span style={{ color: '#5a544b' }}>{v === 'portfolio' ? 'Portfolio' : v}</span>
            )}
          />
          <Line
            type="monotone"
            dataKey="portfolio"
            stroke="#1e40af"
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3, fill: '#1e40af', strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey={benchmark}
            stroke="#a8a093"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3, fill: '#a8a093', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
