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

## Portfolio ledger — `transactions.json`

**This is the source of truth for the portfolio.** Every buy, sell and corporate
action goes here; holdings, cost basis, realised P&L, TWR and IRR are all *derived*
by replaying it (`pipeline/ledger.py`). Never hand-edit position numbers again.

```jsonc
{ "type": "buy",      "ticker": "MNST", "date": "2026-03-14", "shares": 4.25, "price": 88.10, "fee": 0 }
{ "type": "sell",     "ticker": "NVDA", "date": "2026-05-02", "shares": 1.0,  "price": 210.40 }
{ "type": "split",    "ticker": "MNST", "date": "2026-08-11", "ratio": 2 }     // 2 = 2-for-1, 0.1 = 1-for-10 reverse
{ "type": "dividend", "ticker": "VOO",  "date": "2026-06-30", "amount": 4.12 } // cash only; DRIP → record a buy
```

Rules:

- **Prices are always as-traded on the day.** Never back-adjust for a split — the
  replay engine does that, and doing it yourself double-counts.
- **Splits are events, not edits.** Recording one adjusts every prior lot (shares
  × ratio, basis ÷ ratio, total cost unchanged) and preserves holding periods.
  Adjusting `holdings.json` by hand instead loses history and silently corrupts
  every past-dated value.
- Same-date events replay in file order — list a split before a same-day fill if
  it applied first.
- Fees capitalise into basis on buys and reduce proceeds on sells.
- `SELL_METHOD` in `pipeline/run.py` picks which basis leaves the books on a
  partial sale: `fifo` (broker/1099-B default) or `average`. It changes the
  realised/unrealised split, never the total.

Why this replaced the snapshot: a snapshot has no cash-flow timing, so any return
derived from it assumes you held today's portfolio for the whole window. Once you
add shares over time that is simply the wrong number. The ledger yields both
honest ones — **time-weighted return** (what the allocation earned, deposits
stripped out — the fair comparison to SPY) and **money-weighted return / XIRR**
(what your actual dollars earned, weighted by time invested).

### Publishing a ledger change

```bash
npm run ledger:publish
```

Validates the JSON, runs the engine tests, replays the ledger, shows you the
derived holdings and the diff, then commits and pushes after you confirm
(`--yes` skips the prompt, `--dry-run` validates only). Pushing `transactions.json`
to `main` now triggers the *Update Portfolio Data* workflow directly — the
dashboard rebuilds in ~2 minutes instead of waiting for the weekday-only cron,
which would otherwise leave a Friday edit unpublished until Monday.

**These numbers are public the moment they land.** Run `npm run ledger` and check
the derived holdings against your broker before publishing.

Dates must be **real trading days.** A weekend or holiday date is rolled forward
to the next session with a warning — a flow that cannot be placed on the calendar
would otherwise be dropped, and a dropped deposit is booked as pure performance
(a $2,797 Saturday buy once produced a +263% time-weighted return).

### Editing the ledger

Edit `transactions.json`, then replay it offline to check your work — no price
fetches, so it is instant:

```bash
npm run ledger
```

It prints derived shares, cost basis and total cost per ticker, realised P&L,
every corporate action, and a side-by-side against the `holdings.json` snapshot.
Inspect a past date or the other basis method with:

```bash
python3 pipeline/ledger.py --as-of 2026-08-10 --method average
```

Then run the engine tests and the full pipeline:

```bash
python3 pipeline/test_ledger.py
```

```bash
python3 pipeline/run.py
```

### Price-series adjustment

`detect_split_adjustment()` works out from the data whether the price provider has
back-adjusted a split, rather than trusting the field name. Yahoo's `adjclose` did
**not** reflect MNST's 2026-08-11 split for at least a week after the fact. Guessing
wrong scales every historical value by the split ratio and shows up as a fake ~50%
drawdown, so the pipeline measures the step across each split date and decides. It
self-corrects the day the provider backfills.

### Source-of-truth precedence

`transactions.json` → Supabase `holdings` → `holdings.json` positions.

The ledger wins because it is the only source that can be *checked*. `holdings.json`
still supplies `benchmark`, `risk_free_rate_annual` and `history_years`.

> ⚠️ While `transactions.json` has events, transactions recorded through the
> publisher's Portfolio tab **do not reach the dashboard** — the DB path is skipped
> entirely, and `apply_transaction()` has no concept of splits. Pick one: keep the
> ledger (edit the file, commit) or empty the ledger and go back to the DB.

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
  both `transactions.json` and Supabase are empty or unavailable.
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
