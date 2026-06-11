'use client'

interface Props {
  matrix: Record<string, Record<string, number>>
}

function cellColor(v: number): string {
  // Navy (positive) through bone (neutral) to oxblood (negative)
  if (v >= 0.9) return '#1e40af'
  if (v >= 0.7) return '#3d5bc0'
  if (v >= 0.5) return '#93a5de'
  if (v >= 0.3) return '#c3cdee'
  if (v >= 0.1) return '#e4e8f7'
  if (v >= -0.1) return '#f2efe9'
  if (v >= -0.3) return '#f3e0dc'
  if (v >= -0.5) return '#e5b8b0'
  if (v >= -0.7) return '#b0473c'
  return '#991b1b'
}

function textColor(v: number): string {
  return v >= 0.7 || v <= -0.7 ? '#ffffff' : '#1a1714'
}

export default function CorrelationMatrix({ matrix }: Props) {
  const tickers = Object.keys(matrix)

  return (
    <div>
      <p className="label mb-2">Correlation Matrix</p>
      <p className="mb-5 max-w-[42rem] text-sm" style={{ color: 'var(--text-muted)' }}>
        Pairwise Pearson correlation of daily returns. Blue = positive co-movement; Red = inverse.
        High correlation between holdings means less diversification benefit.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3 }}>
          <thead>
            <tr>
              <th style={{ width: 60, position: 'sticky', left: 0, background: 'var(--bg)' }} />
              {tickers.map((t) => (
                <th key={t} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', padding: '0 4px 4px', textAlign: 'center', width: 64 }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((row) => (
              <tr key={row}>
                <td style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', color: 'var(--text-muted)', paddingRight: 8, textAlign: 'right', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--bg)' }}>
                  {row}
                </td>
                {tickers.map((col) => {
                  const v = matrix[row]?.[col] ?? 0
                  const isDiag = row === col
                  return (
                    <td
                      key={col}
                      style={{
                        background: isDiag ? 'var(--surface2)' : cellColor(v),
                        color: isDiag ? 'var(--text-muted)' : textColor(v),
                        borderRadius: 4,
                        padding: '7px 4px',
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: isDiag ? 400 : 500,
                        width: 64,
                        minWidth: 56,
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
