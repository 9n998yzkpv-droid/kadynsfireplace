'use client'
import type { Position } from '@/lib/types'

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

const num: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

export default function PositionsTable({
  positions,
  riskContrib,
}: {
  positions: Position[]
  riskContrib: Record<string, number>
}) {
  return (
    <div>
      <p className="label mb-5">Positions</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Ticker', 'Shares', 'Price', 'Gain/Loss %', 'Weight', 'Risk Contrib.'].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: '6px 12px',
                    textAlign: i === 0 ? 'left' : 'right',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    ...(i === 0 ? { position: 'sticky', left: 0, background: 'var(--bg)', paddingLeft: 0 } : {}),
                  }}
                >
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
                    borderBottom: i < positions.length - 1 ? '1px solid var(--border-faint)' : undefined,
                  }}
                >
                  <td
                    style={{
                      padding: '10px 12px 10px 0',
                      fontWeight: 600,
                      textAlign: 'left',
                      position: 'sticky',
                      left: 0,
                      background: 'var(--bg)',
                    }}
                  >
                    {p.ticker}
                  </td>
                  <td style={{ ...num, color: 'var(--text-secondary)' }}>{p.shares}</td>
                  <td style={num}>${fmt(p.latest_price)}</td>
                  <td style={{ ...num, color: gain ? 'var(--green)' : 'var(--red)' }}>
                    {gain ? '+' : ''}{fmt(p.unrealized_gl_pct)}%
                  </td>
                  <td style={{ ...num, color: 'var(--text-secondary)' }}>{fmt(p.weight_pct)}%</td>
                  <td style={{ ...num, color: 'var(--text-secondary)' }}>
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
