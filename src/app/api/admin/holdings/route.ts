import { NextRequest, NextResponse } from 'next/server'
import { MEMBERS_ENABLED } from '@/lib/flags'
import { getAdminMember } from '@/lib/members'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { triggerPortfolioRefresh } from '@/lib/portfolioRefresh'

// Admin-only holdings CRUD. Direct edits here are manual overrides of the
// current-state rollup — recording transactions (see ../transactions) is the
// preferred way to change positions, since the transaction log is the source
// of truth.
//
// Auth: Supabase session + phone on the ADMIN_PHONES allowlist. All writes go
// through the service role, which bypasses RLS — that's why the guard runs
// first on every verb.

const TICKER_RE = /^[A-Za-z0-9.\-]{1,10}$/

// 404 when the feature is off (same convention as /api/publish), 401 when the
// caller isn't an allowlisted admin.
async function guard(): Promise<NextResponse | null> {
  if (!MEMBERS_ENABLED) return new NextResponse(null, { status: 404 })
  const admin = await getAdminMember()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  return null
}

function parsePositive(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied
  const { data, error } = await supabaseAdmin()
    .from('holdings')
    .select('*')
    .order('ticker')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ holdings: data })
}

export async function POST(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  try {
    const body = await req.json()
    const ticker = String(body.ticker ?? '').trim().toUpperCase()
    const shares = parsePositive(body.shares)
    const basis = Number(body.avg_cost_basis)

    if (!TICKER_RE.test(ticker)) {
      return NextResponse.json({ error: 'Ticker must be 1–10 letters/numbers.' }, { status: 400 })
    }
    if (shares === null || !Number.isFinite(basis) || basis < 0) {
      return NextResponse.json(
        { error: 'Shares must be positive and cost basis non-negative.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin()
      .from('holdings')
      .insert({ ticker, shares, avg_cost_basis: basis })
      .select()
      .single()
    if (error) {
      const msg = error.code === '23505' ? `${ticker} already has a position — edit it instead.` : error.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    await triggerPortfolioRefresh()
    return NextResponse.json({ holding: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  try {
    const body = await req.json()
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.shares !== undefined) {
      const shares = parsePositive(body.shares)
      if (shares === null) return NextResponse.json({ error: 'Shares must be positive.' }, { status: 400 })
      updates.shares = shares
    }
    if (body.avg_cost_basis !== undefined) {
      const basis = Number(body.avg_cost_basis)
      if (!Number.isFinite(basis) || basis < 0) {
        return NextResponse.json({ error: 'Cost basis must be non-negative.' }, { status: 400 })
      }
      updates.avg_cost_basis = basis
    }
    if (body.ticker !== undefined) {
      const ticker = String(body.ticker).trim().toUpperCase()
      if (!TICKER_RE.test(ticker)) {
        return NextResponse.json({ error: 'Ticker must be 1–10 letters/numbers.' }, { status: 400 })
      }
      updates.ticker = ticker
    }

    const { data, error } = await supabaseAdmin()
      .from('holdings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await triggerPortfolioRefresh()
    return NextResponse.json({ holding: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  try {
    const body = await req.json()
    const id = String(body.id ?? '')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { error } = await supabaseAdmin().from('holdings').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await triggerPortfolioRefresh()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
