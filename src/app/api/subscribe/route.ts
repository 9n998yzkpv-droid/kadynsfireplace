import { NextRequest, NextResponse } from 'next/server'
import { NEWSLETTER_ENABLED } from '@/lib/flags'
import { addSubscriber, newsletterConfigured } from '@/lib/newsletter'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  // Same convention as /api/publish: flag off means the endpoint doesn't exist.
  if (!NEWSLETTER_ENABLED) return new NextResponse(null, { status: 404 })
  try {
    const body = await req.json().catch(() => ({}))

    // Honeypot — the form's hidden "company" field. Humans never see it, so a
    // filled value means a bot; pretend success so it doesn't adapt.
    if (body.company) return NextResponse.json({ ok: true })

    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    if (!newsletterConfigured()) {
      return NextResponse.json(
        { error: 'Subscriptions are not open just yet — check back soon.' },
        { status: 503 }
      )
    }

    await addSubscriber(email)
    return NextResponse.json({ ok: true })
  } catch {
    // Never surface Resend error details to the public form.
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
