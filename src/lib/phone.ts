// Phone normalization shared by the signup form (client) and the API
// (server). Everything is stored as E.164 (+17026864526) so uniqueness and
// the admin allowlist compare apples to apples.

// Returns E.164 or null if the input can't be a valid number.
// Bare 10-digit numbers are assumed US (+1) — the audience is US-based.
export function normalizePhone(input: string): string | null {
  const raw = input.trim()
  const digits = raw.replace(/[^0-9]/g, '')
  if (raw.startsWith('+')) {
    return /^[0-9]{8,15}$/.test(digits) ? `+${digits}` : null
  }
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}
