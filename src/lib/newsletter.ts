// Newsletter plumbing, backed by Resend (resend.com).
//
// The subscriber list lives in a Resend Audience — Resend is the database.
// You can view/export contacts any time from the Resend dashboard (Audiences →
// export CSV), and Resend tracks unsubscribes automatically so the list stays
// legally usable (CAN-SPAM) without us storing anything ourselves.
//
// Free tier limits (as of mid-2026): 1,000 contacts, 3,000 emails/month.

import crypto from 'crypto'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import html from 'remark-html'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID ?? ''
const NEWSLETTER_FROM = process.env.NEWSLETTER_FROM ?? ''
// Signs confirmation links. Falls back to the API key so a missing secret
// degrades to "still works" rather than "silently unverifiable tokens" —
// but set NEWSLETTER_SECRET so rotating the API key doesn't void pending links.
const CONFIRM_SECRET = process.env.NEWSLETTER_SECRET || RESEND_API_KEY
const CONFIRM_TTL_MS = 3 * 24 * 60 * 60 * 1000 // links valid for 3 days

export function newsletterConfigured(): boolean {
  return Boolean(RESEND_API_KEY && RESEND_AUDIENCE_ID)
}

async function resendApi(endpoint: string, options: RequestInit = {}) {
  return fetch(`https://api.resend.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
}

// Adds an email to the audience. A 409 means the contact already exists — in
// that case PATCH it back to subscribed, since reaching this point requires
// clicking a fresh confirmation link (i.e. renewed consent after unsubscribing).
export async function addSubscriber(email: string): Promise<void> {
  const res = await resendApi(`/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ email, unsubscribed: false }),
  })
  if (res.ok) return
  if (res.status === 409) {
    const patch = await resendApi(`/audiences/${RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      body: JSON.stringify({ unsubscribed: false }),
    })
    if (patch.ok) return
  }
  const text = await res.text()
  throw new Error(`Resend contacts API error ${res.status}: ${text}`)
}

// --- Double opt-in confirmation links -------------------------------------
// Stateless: the link carries base64url(email).timestamp.HMAC, so there's
// nothing to store and nothing to clean up. Only someone who can read the
// inbox can produce a valid token for that address.

function sign(payload: string): string {
  return crypto.createHmac('sha256', CONFIRM_SECRET).update(payload).digest('hex')
}

export function createConfirmToken(email: string): string {
  const e = Buffer.from(email, 'utf8').toString('base64url')
  const ts = Date.now().toString()
  return `${e}.${ts}.${sign(`${e}.${ts}`)}`
}

// Returns the email for a valid, unexpired token; null otherwise.
export function verifyConfirmToken(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [e, ts, mac] = parts
  const expected = sign(`${e}.${ts}`)
  const a = Buffer.from(mac, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  const issued = Number(ts)
  if (!Number.isFinite(issued) || Date.now() - issued > CONFIRM_TTL_MS) return null
  try {
    return Buffer.from(e, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

// Sends the "confirm your subscription" email. This first touch doubles as an
// engagement signal to Gmail — opening + clicking it trains inbox placement
// for everything we send afterwards.
export async function sendConfirmationEmail(email: string, confirmUrl: string): Promise<void> {
  if (!newsletterConfigured() || !NEWSLETTER_FROM) {
    throw new Error('Newsletter is not configured')
  }
  const emailHtml = `
<div style="background:#f7f5f0;padding:24px 12px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d6;border-radius:10px;padding:32px;font-family:Georgia,serif;color:#1a1714;font-size:16px;line-height:1.65;">
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Confirm your subscription</h1>
    <p style="margin:0 0 20px;">One click and you'll get every new post from Kadyn's Fireplace — plain-English finance writing, free, unsubscribe anytime.</p>
    <p style="margin:0 0 24px;">
      <a href="${confirmUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:6px;font-family:system-ui,sans-serif;font-size:15px;font-weight:600;">Confirm subscription</a>
    </p>
    <p style="margin:0 0 8px;color:#5a544b;font-size:14px;">Using Gmail? Drag this email to your <strong>Primary</strong> tab so new posts actually notify you.</p>
    <p style="margin:0;color:#7c766b;font-size:13px;">Didn't sign up? Just ignore this email — you won't be subscribed.</p>
  </div>
</div>`
  const res = await resendApi('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: NEWSLETTER_FROM,
      to: [email],
      subject: 'Confirm your subscription to Kadyn’s Fireplace',
      html: emailHtml,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend email API error ${res.status}: ${text}`)
  }
}

// Sends a member their answered "Be Heard" question. Transactional (goes to
// one member who explicitly asked), so no unsubscribe footer is required.
export async function sendAnswerEmail(params: {
  to: string
  memberName: string
  question: string
  answer: string
  targetLabel: string
}): Promise<void> {
  if (!RESEND_API_KEY || !NEWSLETTER_FROM) {
    throw new Error('Email sending is not configured')
  }
  const emailHtml = `
<div style="background:#f7f5f0;padding:24px 12px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d6;border-radius:10px;padding:32px;font-family:Georgia,serif;color:#1a1714;font-size:16px;line-height:1.65;">
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Kadyn answered your question</h1>
    <p style="margin:0 0 6px;color:#7c766b;font-size:12px;font-family:system-ui,sans-serif;letter-spacing:0.1em;text-transform:uppercase;">You asked · ${escapeHtml(params.targetLabel)}</p>
    <blockquote style="margin:0 0 20px;padding-left:16px;border-left:2px solid #e6e1d6;color:#5a544b;font-style:italic;">${escapeHtml(params.question)}</blockquote>
    <p style="margin:0 0 6px;color:#7c766b;font-size:12px;font-family:system-ui,sans-serif;letter-spacing:0.1em;text-transform:uppercase;">The answer</p>
    <p style="margin:0 0 24px;white-space:pre-wrap;">${escapeHtml(params.answer)}</p>
    <p style="margin:0;color:#7c766b;font-size:13px;">Thanks for being a member, ${escapeHtml(params.memberName)}. Reply-worthy follow-up? Ask again any time from the Be Heard page.</p>
  </div>
</div>`
  const res = await resendApi('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: NEWSLETTER_FROM,
      to: [params.to],
      subject: 'Your question was answered — Kadyn’s Fireplace',
      html: emailHtml,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend email API error ${res.status}: ${text}`)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Emails need self-contained inline-styled HTML — the site's stylesheet
// doesn't exist inside an inbox. Palette mirrors globals.css.
function buildEmailHtml(post: { title: string; excerpt: string; contentHtml: string; url: string }): string {
  return `
<div style="background:#f7f5f0;padding:24px 12px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d6;border-radius:10px;padding:32px;font-family:Georgia,serif;color:#1a1714;font-size:16px;line-height:1.65;">
    <h1 style="margin:0 0 8px;font-size:26px;line-height:1.25;">${escapeHtml(post.title)}</h1>
    ${post.excerpt ? `<p style="margin:0 0 20px;color:#5a544b;font-style:italic;">${escapeHtml(post.excerpt)}</p>` : ''}
    ${post.contentHtml}
    <p style="margin:28px 0 0;">
      <a href="${post.url}" style="color:#1e40af;">Read this post on the site →</a>
    </p>
  </div>
  <p style="max-width:600px;margin:16px auto 0;text-align:center;color:#7c766b;font-size:12px;font-family:system-ui,sans-serif;">
    You're receiving this because you subscribed to new posts.
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7c766b;">Unsubscribe</a>
  </p>
</div>`
}

// Sends a new post to every subscriber via a Resend Broadcast. Takes raw
// markdown and renders it the same way the blog pages do, so the email matches
// what's on the site. The {{{RESEND_UNSUBSCRIBE_URL}}} placeholder is filled in
// per-recipient by Resend.
export async function sendPostBroadcast(post: {
  title: string
  excerpt: string
  markdown: string
  url: string
}): Promise<void> {
  if (!newsletterConfigured() || !NEWSLETTER_FROM) return

  const processed = await remark().use(remarkGfm).use(html, { sanitize: false }).process(post.markdown)
  const emailHtml = buildEmailHtml({
    title: post.title,
    excerpt: post.excerpt,
    contentHtml: processed.toString(),
    url: post.url,
  })

  const createRes = await resendApi('/broadcasts', {
    method: 'POST',
    body: JSON.stringify({
      audience_id: RESEND_AUDIENCE_ID,
      from: NEWSLETTER_FROM,
      subject: post.title,
      html: emailHtml,
      name: `Post: ${post.title}`,
    }),
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    throw new Error(`Resend broadcast create error ${createRes.status}: ${text}`)
  }
  const { id } = await createRes.json()

  const sendRes = await resendApi(`/broadcasts/${id}/send`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!sendRes.ok) {
    const text = await sendRes.text()
    throw new Error(`Resend broadcast send error ${sendRes.status}: ${text}`)
  }
}
