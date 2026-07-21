import { NextRequest, NextResponse } from 'next/server'
import { MEMBERS_ENABLED } from '@/lib/flags'
import { getAdminMember } from '@/lib/members'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { triggerPortfolioRefresh } from '@/lib/portfolioRefresh'

// Admin-only transaction log. POST records a buy/sell through the
// apply_transaction() SQL function, which atomically updates the holdings
// rollup (weighted-average basis on buys, share reduction on sells, position
// closed at zero). GET returns history with optional ticker/date filters.

const TICKER_RE = /^[A-Za-z0-9.\-]{1,10}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function guard(): Promise<NextResponse | null> {
  if (!MEMBERS_ENABLED) return new NextResponse(null, { status: 404 })
  const admin = await getAdminMember()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  return null
}

export async function GET(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') ?? '').trim().toUpperCase()
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''

  let query = supabaseAdmin()
    .from('transactions')
    .select('*')
    .order('executed_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (ticker) {
    if (!TICKER_RE.test(ticker)) {
      return NextResponse.json({ error: 'Invalid ticker filter' }, { status: 400 })
    }
    query = query.eq('ticker', ticker)
  }
  if (from) {
    if (!DATE_RE.test(from)) return NextResponse.json({ error: 'Invalid from date' }, { status: 400 })
    query = query.gte('executed_at', from)
  }
  if (to) {
    if (!DATE_RE.test(to)) return NextResponse.json({ error: 'Invalid to date' }, { status: 400 })
    query = query.lte('executed_at', to)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data })
}

export async function POST(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  try {
    const body = await req.json()
    const ticker = String(body.ticker ?? '').trim().toUpperCase()
    const type = String(body.type ?? '')
    const quantity = Number(body.quantity)
    const price = Number(body.price)
    const executedAt = String(body.executed_at ?? '')
    const note = body.note ? String(body.note).slice(0, 500) : null

    if (!TICKER_RE.test(ticker)) {
      return NextResponse.json({ error: 'Ticker must be 1–10 letters/numbers.' }, { status: 400 })
    }
    if (type !== 'buy' && type !== 'sell') {
      return NextResponse.json({ error: 'Type must be buy or sell.' }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be positive.' }, { status: 400 })
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Price must be non-negative.' }, { status: 400 })
    }
    if (!DATE_RE.test(executedAt) || Number.isNaN(Date.parse(executedAt))) {
      return NextResponse.json({ error: 'Date must be YYYY-MM-DD.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin().rpc('apply_transaction', {
      p_ticker: ticker,
      p_type: type,
      p_quantity: quantity,
      p_price: price,
      p_executed_at: executedAt,
      p_note: note,
    })
    if (error) {
      // Postgres exceptions from apply_transaction (e.g. overselling) come
      // back with readable messages — surface them as validation errors.
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    // Rebuild the dashboard's data.json from the DB (fire-and-forget).
    await triggerPortfolioRefresh()
    return NextResponse.json({ id: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
