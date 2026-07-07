// Newsletter plumbing, backed by Resend (resend.com).
//
// The subscriber list lives in a Resend Audience — Resend is the database.
// You can view/export contacts any time from the Resend dashboard (Audiences →
// export CSV), and Resend tracks unsubscribes automatically so the list stays
// legally usable (CAN-SPAM) without us storing anything ourselves.
//
// Free tier limits (as of mid-2026): 1,000 contacts, 3,000 emails/month.

import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import html from 'remark-html'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID ?? ''
const NEWSLETTER_FROM = process.env.NEWSLETTER_FROM ?? ''

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

// Adds an email to the audience. Re-subscribing an existing address is treated
// as success so the API never reveals whether an email is already on the list.
export async function addSubscriber(email: string): Promise<void> {
  const res = await resendApi(`/audiences/${RESEND_AUDIENCE_ID}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ email, unsubscribed: false }),
  })
  if (!res.ok && res.status !== 409) {
    const text = await res.text()
    throw new Error(`Resend contacts API error ${res.status}: ${text}`)
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
