import { NextRequest, NextResponse } from 'next/server'
import { NEWSLETTER_ENABLED } from '@/lib/flags'
import { addSubscriber, verifyConfirmToken } from '@/lib/newsletter'

// Lands here from the confirmation email. Adds the contact and redirects to a
// human-readable page either way — this URL is only ever opened in a browser.
export async function GET(req: NextRequest) {
  if (!NEWSLETTER_ENABLED) return new NextResponse(null, { status: 404 })
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  const email = verifyConfirmToken(token)
  if (!email) {
    return NextResponse.redirect(new URL('/subscribed?status=invalid', url.origin))
  }
  try {
    await addSubscriber(email)
    return NextResponse.redirect(new URL('/subscribed?status=ok', url.origin))
  } catch {
    return NextResponse.redirect(new URL('/subscribed?status=error', url.origin))
  }
}
