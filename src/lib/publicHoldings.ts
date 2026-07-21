// Public-read view of current holdings: DB first (RLS allows anon SELECT on
// holdings only), holdings.json fallback so callers always get an answer.
// Used by /api/portfolio and the Be Heard target selector.
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

export interface PublicHolding {
  ticker: string
  shares: number
  avg_cost_basis: number
}

function fileHoldings(): PublicHolding[] {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'holdings.json'), 'utf8')
    const config = JSON.parse(raw)
    return (config.positions ?? []).map((p: Record<string, unknown>) => ({
      ticker: String(p.ticker),
      shares: Number(p.shares),
      avg_cost_basis: Number(p.cost_basis_per_share),
    }))
  } catch {
    return []
  }
}

export async function getPublicHoldings(): Promise<{
  holdings: PublicHolding[]
  source: 'database' | 'file'
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key) {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase
      .from('holdings')
      .select('ticker, shares, avg_cost_basis')
      .order('ticker')
    if (!error && data && data.length > 0) {
      return {
        holdings: data.map((h) => ({
          ticker: h.ticker,
          shares: Number(h.shares),
          avg_cost_basis: Number(h.avg_cost_basis),
        })),
        source: 'database',
      }
    }
  }

  return { holdings: fileHoldings(), source: 'file' }
}
