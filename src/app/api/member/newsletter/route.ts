import { NextResponse } from 'next/server'
import { MEMBERS_ENABLED, NEWSLETTER_ENABLED } from '@/lib/flags'
import { getVerifiedMember } from '@/lib/members'
import { addSubscriber, newsletterConfigured } from '@/lib/newsletter'

// Adds the logged-in member's email to the newsletter audience, honoring the
// opt-in they checked at signup. No double opt-in email needed here: entering
// the OTP code already proved they control the inbox, and the checkbox is the
// documented consent.
export async function POST() {
  if (!MEMBERS_ENABLED || !NEWSLETTER_ENABLED) return new NextResponse(null, { status: 404 })
  try {
    const member = await getVerifiedMember()
    if (!member) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    if (!member.newsletter_opt_in) {
      return NextResponse.json({ error: 'Not opted in' }, { status: 400 })
    }
    if (!newsletterConfigured()) {
      return NextResponse.json({ error: 'Newsletter not configured' }, { status: 503 })
    }
    await addSubscriber(member.email)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
