'use client'

interface Props {
  matrix: Record<string, Record<string, number>>
}

function cellColor(v: number): string {
  // Blue (positive) to white to red (negative)
  if (v >= 0.9) return '#1e3a8a'
  if (v >= 0.7) return '#1d4ed8'
  if (v >= 0.5) return '#2563eb'
  if (v >= 0.3) return '#3b82f6'
  if (v >= 0.1) return '#93c5fd'
  if (v >= -0.1) return '#1e2d4a'
  if (v >= -0.3) return '#fca5a5'
  if (v >= -0.5) return '#ef4444'
  if (v >= -0.7) return '#dc2626'
  return '#7f1d1d'
}

function textColor(v: number): string {
  return Math.abs(v) > 0.4 ? '#ffffff' : '#94a3b8'
}

export default function CorrelationMatrix({ matrix }: Props) {
  const tickers = Object.keys(matrix)

  return (
    <div className="card">
      <p className="label mb-1">Correlation Matrix</p>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Pairwise Pearson correlation of daily returns. Blue = positive co-movement; Red = inverse.
        High correlation between holdings means less diversification benefit.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
          <thead>
            <tr>
              <th style={{ width: 60 }} />
              {tickers.map((t) => (
                <th key={t} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '0 4px 4px', textAlign: 'center', width: 64 }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((row) => (
              <tr key={row}>
                <td style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', paddingRight: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {row}
                </td>
                {tickers.map((col) => {
                  const v = matrix[row]?.[col] ?? 0
                  const isDiag = row === col
                  return (
                    <td
                      key={col}
                      style={{
                        background: isDiag ? '#152a52' : cellColor(v),
                        color: isDiag ? '#64748b' : textColor(v),
                        borderRadius: 4,
                        padding: '6px 4px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: isDiag ? 400 : 600,
                        width: 64,
                      }}
                    >
                      {isDiag ? '—' : v.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
