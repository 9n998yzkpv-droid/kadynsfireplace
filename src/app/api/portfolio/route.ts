import { NextResponse } from 'next/server'
import { getPublicHoldings } from '@/lib/publicHoldings'

// Public read endpoint for current holdings — the DB-backed replacement for
// hardcoded positions. The dashboard's analytics (Sharpe, correlations, …)
// still come from public/data.json, which the Python pipeline now builds FROM
// this same DB table; this endpoint exists so anything that needs raw current
// positions (or future clients) can read them without a rebuild.

export const dynamic = 'force-dynamic'

export async function GET() {
  const { holdings, source } = await getPublicHoldings()
  return NextResponse.json(
    { holdings, source },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  )
}
