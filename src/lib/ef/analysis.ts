// Local, rule-based portfolio "read" — replaces the Anthropic-key Claude advisor
// from the Python app so the tool stays 100% client-side with no API key.
// Everything here is deterministic math on the selected portfolio.

import type { AssetStat, FrontierPoint } from './optimizer'

export interface AnalysisSection {
  title: string
  body: string
}

interface AnalysisInput {
  point: { return: number; volatility: number; weights: number[] }
  tickers: string[]
  assets: AssetStat[]
  frontier: FrontierPoint[]
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

export function analyzePortfolio({
  point,
  tickers,
  assets,
  frontier,
}: AnalysisInput): AnalysisSection[] {
  const { return: ret, volatility: vol, weights } = point
  const sharpe = vol > 0 ? ret / vol : 0

  // position along the frontier: 0 = min-variance, 1 = max-return
  const vols = frontier.map((p) => p.volatility)
  const minVol = Math.min(...vols)
  const maxVol = Math.max(...vols)
  const posn = maxVol > minVol ? (vol - minVol) / (maxVol - minVol) : 0
  const posture = posn < 0.34 ? 'conservative' : posn < 0.67 ? 'moderate' : 'aggressive'

  // concentration
  const holdings = tickers
    .map((t, i) => ({ t, w: weights[i] }))
    .filter((h) => h.w > 0.001)
    .sort((a, b) => b.w - a.w)
  const hhi = holdings.reduce((s, h) => s + h.w * h.w, 0)
  const effN = hhi > 0 ? 1 / hhi : holdings.length
  const top = holdings[0]
  const top3 = holdings.slice(0, 3).reduce((s, h) => s + h.w, 0)

  const sections: AnalysisSection[] = []

  sections.push({
    title: 'Risk / return posture',
    body:
      `This sits in the ${posture} zone of the frontier ` +
      `(${(posn * 100).toFixed(0)}% of the way from minimum-risk to maximum-return). ` +
      `Expected return ${pct(ret)} for ${pct(vol)} annual volatility, a Sharpe of ${sharpe.toFixed(2)} ` +
      `— ${sharpe > 1 ? 'a strong' : sharpe > 0.5 ? 'a reasonable' : 'a modest'} amount of return per unit of risk ` +
      `(rf assumed 0). Suits ${posture === 'aggressive' ? 'an investor with a long horizon and tolerance for drawdowns' : posture === 'moderate' ? 'a balanced investor seeking growth with some ballast' : 'a capital-preservation-minded investor'}.`,
  })

  sections.push({
    title: 'Concentration',
    body:
      `${holdings.length} of ${tickers.length} assets carry weight; ` +
      `effective diversification ≈ ${effN.toFixed(1)} independent positions. ` +
      `Largest holding is ${top.t} at ${pct(top.w)}, and the top 3 are ${pct(top3)} of the book. ` +
      (top.w > 0.4
        ? `That is a heavy single-name tilt — concentrated bets raise idiosyncratic risk.`
        : effN < 2.5
          ? `Fairly concentrated — most of the risk rides on a couple of names.`
          : `Reasonably spread across names.`),
  })

  // best/worst risk-adjusted constituents for context
  const ranked = [...assets].sort(
    (a, b) => b.return / Math.max(b.volatility, 1e-9) - a.return / Math.max(a.volatility, 1e-9),
  )
  sections.push({
    title: 'What is driving it',
    body:
      `Of the chosen assets, ${ranked[0].ticker} had the best standalone risk-adjusted return ` +
      `(${pct(ranked[0].return)} at ${pct(ranked[0].volatility)} vol) and ` +
      `${ranked[ranked.length - 1].ticker} the weakest. The optimizer leans toward names that ` +
      `combine higher return with low correlation to the rest of the basket — which is why the ` +
      `frontier portfolio can sit above any single asset.`,
  })

  sections.push({
    title: 'Watch-outs',
    body:
      (top.w > 0.4 ? `Single-name concentration in ${top.t}. ` : '') +
      `Mean and covariance are estimated from ~2 years of daily history — they assume the recent ` +
      `regime persists, which it may not. Correlations tend to spike toward 1 in a crisis, so realized ` +
      `diversification is usually worse than the backtest. Rebalancing drift, taxes, and trading costs ` +
      `are not modeled here.`,
  })

  return sections
}
