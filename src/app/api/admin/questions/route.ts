import { NextRequest, NextResponse } from 'next/server'
import { MEMBERS_ENABLED } from '@/lib/flags'
import { getAdminMember } from '@/lib/members'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendAnswerEmail } from '@/lib/newsletter'

// Admin view of "Be Heard" questions: list (with member name/email via the
// FK embed), answer, and hide/unhide. Answering emails the member — the
// answer is saved first, so a failed send never loses the written answer;
// the response tells the admin whether the email went out.

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
  const status = searchParams.get('status') ?? ''

  let query = supabaseAdmin()
    .from('questions')
    .select('*, members(name, email)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (status && ['new', 'answered', 'hidden'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data })
}

export async function PATCH(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  try {
    const body = await req.json()
    const id = String(body.id ?? '')
    const action = String(body.action ?? '')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const db = supabaseAdmin()

    if (action === 'hide' || action === 'unhide') {
      // Unhiding restores 'answered' if an answer exists, else 'new'.
      const { data: q } = await db.from('questions').select('answer').eq('id', id).single()
      const status = action === 'hide' ? 'hidden' : q?.answer ? 'answered' : 'new'
      const { error } = await db.from('questions').update({ status }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, status })
    }

    if (action === 'answer') {
      const answer = String(body.answer ?? '').trim()
      if (answer.length < 1 || answer.length > 5000) {
        return NextResponse.json(
          { error: 'Answers need to be between 1 and 5,000 characters.' },
          { status: 400 }
        )
      }

      const { data: q, error } = await db
        .from('questions')
        .update({ answer, status: 'answered', answered_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, members(name, email)')
        .single()
      if (error || !q) {
        return NextResponse.json({ error: error?.message ?? 'Question not found' }, { status: 400 })
      }

      const member = q.members as { name: string; email: string } | null
      let emailSent = false
      if (member?.email) {
        try {
          const targetLabel =
            q.target_type === 'holding'
              ? `About ${q.target_ref}`
              : q.target_type === 'post'
                ? `On the post “${q.target_ref}”`
                : `Topic: ${q.target_ref}`
          await sendAnswerEmail({
            to: member.email,
            memberName: member.name,
            question: q.body,
            answer,
            targetLabel,
          })
          emailSent = true
        } catch (err) {
          console.error('Answer email failed:', err)
        }
      }
      return NextResponse.json({ ok: true, emailSent })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
