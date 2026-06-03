# FinanceOS — Personal Portfolio Dashboard + Blog

A static finance site running **100% free** on GitHub Pages + GitHub Actions:

- **Dashboard** — real-dollar portfolio analytics with RIA-grade risk/return metrics
- **Data pipeline** — Python script (pandas + numpy) that runs nightly via GitHub Actions cron, writes `public/data.json`, and commits it back; the commit triggers a Pages redeploy
- **Blog** — markdown-driven finance education (add posts by dropping `.md` files in `posts/`)

No server. No database. No ongoing costs.

---

## Architecture

```
holdings.json  ←  you edit this
      ↓
pipeline/run.py  (GitHub Actions, nightly 21:30 UTC)
      ↓  reads FMP API (secret)
public/data.json  ←  committed back to repo
      ↓
Next.js static export (npm run build → out/)
      ↓
GitHub Pages  (auto-deployed on push)
```

---

## One-Time Setup (follow in order)

### 1. Create the GitHub repository

```bash
git init
git add .
git commit -m "initial commit"
gh repo create financeblog --public --source=. --push
# Or: create on github.com and push manually
```

### 2. Set the `FMP_API_KEY` secret

1. Get a free API key at [financialmodelingprep.com](https://financialmodelingprep.com/developer/docs)  
   (free tier: 250 requests/day, no credit card required)
2. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `FMP_API_KEY`, Value: your key

### 3. Enable GitHub Pages

1. Go to **Settings → Pages**
2. Source: **GitHub Actions** (not a branch)
3. Save

### 4. Edit `holdings.json` with your real positions

```json
{
  "positions": [
    { "ticker": "NVDA", "shares": 40, "cost_basis_per_share": 180.00, "purchase_date": "2022-09-20" }
  ],
  "benchmark": "SPY",
  "risk_free_rate_annual": 0.043,
  "history_years": 3
}
```

Leave `shares: 0` to stay in demo mode with sample data.

### 5. Trigger the first pipeline run

Go to **Actions → Data Pipeline + Deploy → Run workflow**.

The run will:
1. Fetch price history from FMP
2. Compute all metrics
3. Commit `public/data.json`
4. Build and deploy the static site to Pages

Your site will be live at `https://<your-username>.github.io/financeblog/`.

> **If your repo name is not `financeblog`**, update `basePath` in `next.config.js` to match.

---

## Local Development

```bash
# Frontend
npm install
npm run dev          # → http://localhost:3000

# Pipeline (needs FMP_API_KEY in env)
pip install -r pipeline/requirements.txt
set FMP_API_KEY=your_key_here        # Windows
export FMP_API_KEY=your_key_here     # Mac/Linux
python pipeline/run.py
```

The pipeline writes `public/data.json`. Restart the dev server (or it hot-reloads on file change) to see updated data.

---

## Adding a Blog Post

Drop a Markdown file in `posts/`:

```
posts/my-new-post.md
```

Required frontmatter:

```markdown
---
title: "My Post Title"
date: "2024-03-01"
excerpt: "One-line summary shown on the blog index."
---

Your post content here...
```

Commit and push — the next pipeline run (or a manual `workflow_dispatch`) will redeploy.

---

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

## Swapping Data Providers

The fetch layer (`pipeline/fetch.py`) has a clean provider interface. To add Twelve Data or Alpha Vantage:

1. Create a class that implements `get_history(ticker, years) → DataFrame` and `get_quote(ticker) → float`
2. Change `PROVIDER = "fmp"` to your new provider name
3. Add the env var for its API key

---

## Cron Schedule

The pipeline runs **daily at 21:30 UTC** (Mon–Fri) — about 30 minutes after US market close.

To enable hourly refreshes during market hours, uncomment the second `cron` entry in `.github/workflows/pipeline.yml`:

```yaml
# - cron: '0 14-21 * * 1-5'
```

Free GitHub Actions includes 2,000 minutes/month for public repos (unlimited) and 500 min/month for private repos.
