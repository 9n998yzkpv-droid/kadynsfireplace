// Feature flags.
//
// Flip PROJECTS_ENABLED to true when the interactive projects (EF Dashboard,
// Arb Scanner) are ready to go public. While false:
//   - the "More projects" section is hidden on the home page
//   - the /projects/* routes return 404 (gated in src/app/projects/layout.tsx)
export const PROJECTS_ENABLED: boolean = false

// Flip PUBLISHER_ENABLED to true ONLY once the publisher has real auth and a
// rotated secret. While false:
//   - the /publisher page returns 404 (src/app/publisher/layout.tsx)
//   - the /api/publish handlers (GET/POST/DELETE) all return 404
//   - the nav no longer advertises Publisher
// This is a public write/delete endpoint to your content repo. It is safe to be
// ON only because: the secret comes from PUBLISHER_PASSWORD (no hardcoded
// fallback — fails closed if unset), it's sent via header (never in URLs/logs),
// and compared in constant time. You MUST set a strong PUBLISHER_PASSWORD in the
// deploy environment, or the endpoint returns 503.
export const PUBLISHER_ENABLED: boolean = true

// Flip MEMBERS_ENABLED to true once the Supabase project exists and its env
// vars are set. While false:
//   - /join, /login, /account and /be-heard return 404
//   - the nav doesn't advertise membership
//   - the member/admin API routes return 404
// Required env vars (see README "Memberships"):
//   NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  — public anon key (safe to expose; RLS applies)
//   SUPABASE_SERVICE_ROLE_KEY      — server-only key for admin writes. NEVER
//                                    expose to the client.
//   ADMIN_PHONES                   — comma-separated E.164 allowlist of admin
//                                    phone numbers (e.g. +17026864526)
// Verification is email OTP (free via Supabase + Resend SMTP). The schema
// reserves phone_verified_at so SMS OTP can be layered in later.
export const MEMBERS_ENABLED: boolean = false

// Flip NEWSLETTER_ENABLED to true once Resend is configured. While false:
//   - the subscribe form is hidden everywhere it's rendered
//   - the /api/subscribe endpoint returns 404
//   - publishing a post does NOT attempt an email broadcast
// Required env vars in the deploy environment (see README "Newsletter"):
//   RESEND_API_KEY      — API key from resend.com
//   RESEND_AUDIENCE_ID  — the Audience that stores subscriber emails
//   NEWSLETTER_FROM     — verified sender, e.g. 'Kadyn <posts@yourdomain.com>'
// If the flag is on but env vars are missing, subscribe fails closed with 503
// and broadcasts are skipped — nothing breaks, but nothing sends either.
export const NEWSLETTER_ENABLED: boolean = true
