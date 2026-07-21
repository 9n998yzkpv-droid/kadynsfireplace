# Kadyn's Fireplace — Portfolio Dashboard, Blog & Memberships

A Next.js 14 (App Router) site deployed on **Vercel**:

- **Dashboard** — real-dollar portfolio analytics with RIA-grade risk/return metrics
- **Blog** — markdown-driven finance education with an in-browser publisher
- **Newsletter** — double-opt-in email subscriptions via Resend, auto-broadcast on publish
- **Memberships** — free member accounts (email OTP login), phone + name on file
- **Portfolio management** — admin-only holdings/transactions tools backed by Supabase
- **Be Heard** — members ask questions about holdings, posts, or topics; answers are emailed back

A Python pipeline (GitHub Actions cron) computes the dashboard metrics nightly and commits
`public/data.json`, which triggers a Vercel redeploy.

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

> Don't run `npm run build` while the dev server is running — they share `.next/`
> and the dev server's cache gets corrupted (fix: stop the server, `rm -rf .next`).

## Feature flags — `src/lib/flags.ts`

| Flag | Currently | Gates |
|------|-----------|-------|
| `PUBLISHER_ENABLED` | on | `/publisher` + `/api/publish` |
| `NEWSLETTER_ENABLED` | on | subscribe form + `/api/subscribe` + publish broadcasts |
| `MEMBERS_ENABLED` | **off** | `/join`, `/login`, `/account`, `/be-heard`, member/admin APIs |
| `PROJECTS_ENABLED` | off | `/projects/*` interactive tools |

Every flag fails closed: while off, the routes return 404 and the nav doesn't advertise them.

---

## Memberships (Supabase) — one-time setup

Members sign up with **name + phone + email** and verify with a **6-digit email code**
(free via Resend). Phone numbers are stored unique in E.164; the schema reserves
`phone_verified_at` so SMS verification (Twilio) can be added later without a migration.

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Run the migration**: paste `supabase/migrations/0001_members_portfolio_questions.sql`
   into the SQL Editor and run it. This creates `members`, `holdings`, `transactions`,
   `questions`, the `apply_transaction()` / `rebuild_holdings()` functions, triggers, and
   all row-level-security policies.
3. **Wire Resend as the auth mailer**: Supabase's built-in sender is rate-limited to a few
   emails/hour. In **Authentication → SMTP Settings** enable custom SMTP with:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
   - Sender = an address on your verified Resend domain
4. **Make the email a code, not a link**: in **Authentication → Email Templates → Magic Link**,
   set the body to include `{{ .Token }}` (the 6-digit OTP) instead of the confirmation URL.
5. **Set env vars** (Vercel + `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PHONES`.
6. **Set GitHub repo secrets** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Settings → Secrets →
   Actions) so the nightly pipeline can read holdings from the DB.
7. Flip `MEMBERS_ENABLED` to `true` and deploy.

**Admin access** is an env allowlist, not a database flag: a logged-in member whose phone
is listed in `ADMIN_PHONES` (comma-separated E.164) gets the publisher's Portfolio and
Questions tabs. Nothing a user does at signup can grant admin — only someone with deploy
access can change the allowlist. Admin API writes go through the service-role key
server-side; RLS gives members/anon no write path to portfolio data at all.

## Portfolio management (publisher → Portfolio tab)

- **Record transactions** (buy/sell, quantity, price, date, note). The `apply_transaction()`
  SQL function updates holdings atomically: buys use weighted-average cost basis, sells
  reduce the position (overselling is rejected), selling everything closes it.
- **Transactions are the source of truth**; holdings are the current-state rollup.
  `rebuild_holdings()` (run it in the SQL editor) recomputes the rollup from the full log
  if they ever drift.
- **Direct holdings add/edit/remove** exists for seeding and corrections, but bypasses the
  log. Best seeding move: record your existing positions as buys dated at purchase.
- **Auto-refresh**: any portfolio write dispatches the *Update Portfolio Data* workflow,
  which rebuilds `public/data.json` from the DB and commits it → Vercel redeploys →
  dashboard reflects the trade in ~2–3 minutes. The nightly cron is the backstop.
  Requires the `GITHUB_TOKEN` on Vercel to have **Actions read/write** on the repo.
- `holdings.json` is now config + fallback: the pipeline reads `benchmark`,
  `risk_free_rate_annual`, and `history_years` from it, and uses its positions only when
  Supabase is unconfigured, unreachable, or empty.
- `/api/portfolio` is a public read endpoint for current positions (DB first, file
  fallback, 5-minute cache).

## Be Heard (member Q&A)

Members ask about **a holding** (dropdown of live positions), **a blog post**, or **a
topic**. Non-members see a join prompt. Questions land in the publisher's **Questions**
tab; answering saves the answer and emails it to the member (the save survives a failed
send, and the UI says which happened). Answers are visible only to the asking member and
the admin. Hide spam with the Hide button — it never deletes.

## Adding a blog post

Drop a Markdown file in `posts/`, or use `/publisher` (writes a commit via the GitHub
API — needs `PUBLISHER_PASSWORD` and a `GITHUB_TOKEN` with contents write).

## Newsletter (email subscriptions)

Visitors subscribe on `/blog` (and at the bottom of every post). Signup is **double
opt-in**: the form sends a confirmation email with a signed link (HMAC, 3-day expiry —
stateless); only clicking it adds the address to the **Resend Audience**, which is the
subscriber database (view/export at resend.com → Audiences). Unsubscribes are handled by
Resend automatically, so the list stays CAN-SPAM compliant.

Member signup offers a newsletter checkbox — since the OTP already proves inbox ownership,
opted-in members are added to the audience directly, without a second confirmation email.

When a **new** post is published through the publisher, it is automatically emailed to
every subscriber (edits don't re-send). Resend free tier: 1,000 contacts, 3,000
emails/month — that pool also covers OTP codes and Be Heard answer emails.

## Environment variables

Copy `.env.example` to `.env.local`; set the same values in the Vercel project.

| Variable | Used for |
|----------|----------|
| `PUBLISHER_PASSWORD` | `/publisher` posts auth (503 if unset) |
| `GITHUB_TOKEN` / `GITHUB_REPO` | publisher post commits + portfolio refresh dispatch |
| `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` / `NEWSLETTER_FROM` / `NEWSLETTER_SECRET` | newsletter + transactional email |
| `SITE_URL` | canonical origin in emails/webhooks |
| `N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET` | optional post-publish distribution |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | memberships (safe client-side; RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only admin writes — never expose |
| `ADMIN_PHONES` | comma-separated E.164 admin allowlist |

GitHub Actions additionally needs repo secrets `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

## Metrics reference

All metrics computed in `pipeline/metrics.py` with inline formula comments.

| Metric | Formula | What it measures |
|--------|---------|-----------------|
| CAGR | `(end/start)^(252/n) - 1` | Smoothed annual growth |
| Sharpe | `(Rp - Rf) / σ` | Excess return per unit of total risk |
| Sortino | `(Rp - Rf) / σ_down` | Excess return per unit of *downside* risk |
| Max Drawdown | `(trough - peak) / peak` | Worst peak-to-valley loss |
| Beta | `Cov(Rp, Rb) / Var(Rb)` | Market sensitivity |
| Jensen's Alpha | `Rp - [Rf + β(Rm - Rf)]` | Return above CAPM expectation |
| Treynor | `(Rp - Rf) / β` | Excess return per unit of systematic risk |
| Info Ratio | `(Rp - Rb) / TE` | Active return per unit of active risk |
| VaR 95% | Historical & parametric | Max 1-day loss at 95% confidence |

## Cron schedule

The pipeline runs **daily at 21:35 UTC** (Mon–Fri) — about 30 minutes after US market
close — plus on demand whenever the admin records a portfolio change. To enable hourly
refreshes during market hours, add a second `cron` entry in
`.github/workflows/update-portfolio.yml`.
