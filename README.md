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


## Adding a Blog Post

Drop a Markdown file in `posts/`:

```
posts/my-new-post.md
```

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
