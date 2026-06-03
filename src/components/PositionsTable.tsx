'use client'
import type { Position } from '@/lib/types'

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export default function PositionsTable({
  positions,
  riskContrib,
}: {
  positions: Position[]
  riskContrib: Record<string, number>
}) {
  return (
    <div className="card">
      <p className="label mb-4">Positions</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Ticker', 'Shares', 'Price', 'Cost Basis', 'Market Value', 'Gain/Loss $', 'Gain/Loss %', 'Weight', 'Risk Contrib.'].map((h) => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => {
              const gain = p.unrealized_gl_dollar >= 0
              const rc = riskContrib[p.ticker]
              return (
                <tr
                  key={p.ticker}
                  style={{
                    borderBottom: i < positions.length - 1 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: 'white', textAlign: 'right' }}>{p.ticker}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{p.shares}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>${fmt(p.latest_price)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>${fmt(p.cost_basis_per_share)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>${fmt(p.market_value)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: gain ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {gain ? '+' : '−'}${fmt(Math.abs(p.unrealized_gl_dollar))}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: gain ? 'var(--green)' : 'var(--red)' }}>
                    {gain ? '+' : ''}{fmt(p.unrealized_gl_pct)}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(p.weight_pct)}%</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {rc !== undefined ? `${fmt(rc)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
