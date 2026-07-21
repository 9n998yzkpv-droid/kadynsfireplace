import { NextRequest, NextResponse } from 'next/server'
import { MEMBERS_ENABLED } from '@/lib/flags'
import { supabaseServer } from '@/lib/supabase/server'
import { getVerifiedMember } from '@/lib/members'

// Members submit "Be Heard" questions here. The insert runs with the
// member's own session (anon key + cookies), so the RLS policy — verified,
// active member inserting as themselves — is enforced by the database even
// if this handler had a bug. Validation here is for friendly errors.

const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/
const SLUG_RE = /^[a-z0-9-]{1,200}$/

export async function POST(req: NextRequest) {
  if (!MEMBERS_ENABLED) return new NextResponse(null, { status: 404 })
  try {
    // Configuration check happens inside getVerifiedMember (fails closed);
    // only construct the session client once we know a member exists.
    const member = await getVerifiedMember()
    if (!member) {
      return NextResponse.json({ error: 'You need to be a member to ask.' }, { status: 401 })
    }
    const supabase = supabaseServer()

    const body = await req.json()
    const targetType = String(body.target_type ?? '')
    let targetRef = String(body.target_ref ?? '').trim()
    const question = String(body.body ?? '').trim()

    if (targetType === 'holding') {
      targetRef = targetRef.toUpperCase()
      if (!TICKER_RE.test(targetRef)) {
        return NextResponse.json({ error: 'Pick a holding to ask about.' }, { status: 400 })
      }
    } else if (targetType === 'post') {
      if (!SLUG_RE.test(targetRef)) {
        return NextResponse.json({ error: 'Pick a post to ask about.' }, { status: 400 })
      }
    } else if (targetType === 'topic') {
      if (targetRef.length < 1 || targetRef.length > 200) {
        return NextResponse.json({ error: 'Give your topic a short name.' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid target type.' }, { status: 400 })
    }

    if (question.length < 10 || question.length > 2000) {
      return NextResponse.json(
        { error: 'Questions need to be between 10 and 2,000 characters.' },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('questions').insert({
      member_id: member.id,
      target_type: targetType,
      target_ref: targetRef,
      body: question,
    })
    if (error) {
      return NextResponse.json({ error: 'Could not submit your question.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
