# FinanceOS — Personal Portfolio Dashboard + Blog

A static finance site running **100% free** on GitHub Pages + GitHub Actions:

- **Dashboard** — real-dollar portfolio analytics with RIA-grade risk/return metrics
- **Data pipeline** — Python script (pandas + numpy) that runs nightly via GitHub Actions cron, writes `public/data.json`, and commits it back; the commit triggers a Pages redeploy
- **Blog** — markdown-driven finance education (add posts by dropping `.md` files in `posts/`)

No server. No database. No ongoing costs.

---


## Adding a Blog Post

Drop a Markdown file in `posts/`:

```
posts/my-new-post.md
```

## Newsletter (email subscriptions)

Visitors can subscribe on `/blog` (and at the bottom of every post). Signup is
**double opt-in**: submitting the form sends a confirmation email with a signed
link (HMAC, 3-day expiry — stateless, nothing stored for pending signups); only
clicking it adds the address to the **Resend Audience** — that's the subscriber
database. View or export the list anytime at resend.com → Audiences (CSV
export). Unsubscribes are handled by Resend automatically, so the list stays
CAN-SPAM compliant, and every stored address has documented consent.

When a **new** post is published through the publisher, it is automatically
emailed to every subscriber (edits to existing posts do not re-send).

**One-time setup:**

1. Create a free account at [resend.com](https://resend.com) (free tier: 1,000
   contacts, 3,000 emails/month).
2. Verify your sending domain (Resend → Domains → add DNS records). Sending
   requires a domain you control — a gmail.com address won't work as a sender.
3. Create an Audience (Resend → Audiences) and copy its ID.
4. Create an API key (Resend → API Keys).
5. Set these env vars in the Vercel project (and `.env.local` for local dev):
   - `RESEND_API_KEY`
   - `RESEND_AUDIENCE_ID`
   - `NEWSLETTER_FROM` — e.g. `Kadyn <posts@yourdomain.com>` (must use the
     verified domain)
   - `NEWSLETTER_SECRET` — random string (e.g. `openssl rand -hex 32`) that
     signs confirmation links; falls back to `RESEND_API_KEY` if unset
6. Flip `NEWSLETTER_ENABLED` to `true` in `src/lib/flags.ts` and deploy.

Until the flag is on, the form is hidden and `/api/subscribe` returns 404.

## Metrics Reference

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


---

## Cron Schedule

The pipeline runs **daily at 21:30 UTC** (Mon–Fri) — about 30 minutes after US market close.

To enable hourly refreshes during market hours, uncomment the second `cron` entry in `.github/workflows/pipeline.yml`:

```yaml
# - cron: '0 14-21 * * 1-5'
```
Free GitHub Actions includes 2,000 minutes/month for public repos 
