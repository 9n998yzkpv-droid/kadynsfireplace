// Efficient-frontier math, ported from the Python `optimizer.py` + `market_data.py`
// so it runs entirely in the browser. No server, no SciPy.
//
// The Python version used SLSQP to solve, for a sweep of target returns, the
// long-only min-variance QP. We get the same long-only frontier here by a
// risk-aversion (lambda) sweep solved with projected-gradient descent — each
// solve is an exact long-only min-variance portfolio for its lambda, and the
// non-dominated envelope of those points is the efficient frontier.

export interface FrontierPoint {
  return: number // annualized, decimal (0.15 = 15%)
  volatility: number // annualized, decimal
  weights: number[]
}

export interface CloudPoint {
  return: number
  volatility: number
  sharpe: number
}

export interface AssetStat {
  ticker: string
  return: number
  volatility: number
}

export type Bounds = [number, number][] | null

// ── linear-algebra helpers ────────────────────────────────────────────────
function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

function matVec(M: number[][], v: number[]): number[] {
  const n = v.length
  const out = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < n; j++) s += M[i][j] * v[j]
    out[i] = s
  }
  return out
}

function quadForm(M: number[][], w: number[]): number {
  return dot(w, matVec(M, w))
}

export function portfolioPerformance(
  weights: number[],
  mean: number[],
  cov: number[][],
): { ret: number; vol: number } {
  const ret = dot(weights, mean)
  const vol = Math.sqrt(Math.max(0, quadForm(cov, weights)))
  return { ret, vol }
}

// ── statistics from a baked daily log-return matrix ───────────────────────
// returnsBySymbol[sym] are aligned daily log returns. Annualize like the
// Python: mean * 252, sample covariance * 252, plus a tiny ridge for
// positive-definiteness.
export function computeStats(
  tickers: string[],
  returnsBySymbol: Record<string, number[]>,
  lookback?: number,
): { mean: number[]; cov: number[][]; assets: AssetStat[] } {
  const n = tickers.length
  const full = tickers.map((t) => returnsBySymbol[t])
  const T0 = Math.min(...full.map((r) => r.length))
  const T = lookback && lookback < T0 ? lookback : T0
  // align to the most recent T observations
  const series = full.map((r) => r.slice(r.length - T))

  const mean = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let t = 0; t < T; t++) s += series[i][t]
    mean[i] = s / T
  }

  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0
      for (let t = 0; t < T; t++) s += (series[i][t] - mean[i]) * (series[j][t] - mean[j])
      const c = s / (T - 1) // sample covariance
      cov[i][j] = c
      cov[j][i] = c
    }
  }

  // annualize
  for (let i = 0; i < n; i++) {
    mean[i] *= 252
    for (let j = 0; j < n; j++) cov[i][j] *= 252
    cov[i][i] += 1e-8 // ridge
  }

  const assets: AssetStat[] = tickers.map((t, i) => ({
    ticker: t,
    return: mean[i],
    volatility: Math.sqrt(cov[i][i]),
  }))

  return { mean, cov, assets }
}

// ── projection onto { w : sum(w)=1, lo<=w<=hi } ───────────────────────────
// Find nu such that sum(clamp(x_i - nu, lo_i, hi_i)) = 1 (monotone in nu),
// via bisection. This is the Euclidean projection used by projected gradient.
function projectBudgetBox(x: number[], lo: number[], hi: number[]): number[] {
  const n = x.length
  const g = (nu: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Math.min(hi[i], Math.max(lo[i], x[i] - nu))
    return s
  }
  // bracket: g is non-increasing in nu. g(min(x-hi)) = sum(hi); g(max(x-lo)) = sum(lo)
  let a = Math.min(...x.map((xi, i) => xi - hi[i]))
  let b = Math.max(...x.map((xi, i) => xi - lo[i]))
  for (let it = 0; it < 80; it++) {
    const mid = (a + b) / 2
    if (g(mid) > 1) a = mid
    else b = mid
  }
  const nu = (a + b) / 2
  return x.map((xi, i) => Math.min(hi[i], Math.max(lo[i], xi - nu)))
}

// Gershgorin upper bound on the largest eigenvalue of cov (for step size).
function maxEigBound(cov: number[][]): number {
  let m = 0
  for (let i = 0; i < cov.length; i++) {
    let s = 0
    for (let j = 0; j < cov.length; j++) s += Math.abs(cov[i][j])
    m = Math.max(m, s)
  }
  return m
}

// Minimize  lambda * wᵀΣw - μᵀw  s.t. sum(w)=1, lo<=w<=hi  (projected gradient).
function solveQP(
  mean: number[],
  cov: number[][],
  lambda: number,
  lo: number[],
  hi: number[],
  w0: number[],
  L: number,
): number[] {
  const step = 1 / (2 * lambda * L + 1e-12)
  let w = projectBudgetBox(w0, lo, hi)
  for (let it = 0; it < 800; it++) {
    const cw = matVec(cov, w)
    const grad = new Array(w.length)
    for (let i = 0; i < w.length; i++) grad[i] = 2 * lambda * cw[i] - mean[i]
    const next = projectBudgetBox(
      w.map((wi, i) => wi - step * grad[i]),
      lo,
      hi,
    )
    let diff = 0
    for (let i = 0; i < w.length; i++) diff += Math.abs(next[i] - w[i])
    w = next
    if (diff < 1e-9) break
  }
  return w
}

function cleanWeights(w: number[]): number[] {
  const c = w.map((x) => (x < 1e-4 ? 0 : x))
  const s = c.reduce((a, b) => a + b, 0)
  return s > 0 ? c.map((x) => x / s) : w
}

// ── efficient frontier (long-only, optional per-asset bounds) ─────────────
export function efficientFrontier(
  mean: number[],
  cov: number[][],
  bounds: Bounds,
  numPoints = 60,
): FrontierPoint[] {
  const n = mean.length
  const lo = bounds ? bounds.map((b) => b[0]) : new Array(n).fill(0)
  const hi = bounds ? bounds.map((b) => b[1]) : new Array(n).fill(1)
  const L = maxEigBound(cov)

  // lambda sweep: high lambda -> min variance, low lambda -> max return.
  const lambdas: number[] = []
  const hiL = 5000
  const loL = 0.01
  for (let k = 0; k < numPoints; k++) {
    const f = k / (numPoints - 1)
    lambdas.push(Math.exp(Math.log(hiL) + f * (Math.log(loL) - Math.log(hiL))))
  }

  const raw: FrontierPoint[] = []
  let w = new Array(n).fill(1 / n)
  for (const lambda of lambdas) {
    w = solveQP(mean, cov, lambda, lo, hi, w, L) // warm-started continuation
    const cw = cleanWeights(w)
    const { ret, vol } = portfolioPerformance(cw, mean, cov)
    raw.push({ return: ret, volatility: vol, weights: cw })
  }

  // efficient envelope: sort by vol asc, keep strictly-increasing return.
  raw.sort((a, b) => a.volatility - b.volatility)
  const env: FrontierPoint[] = []
  let maxRet = -Infinity
  for (const p of raw) {
    if (p.return > maxRet + 1e-6) {
      env.push(p)
      maxRet = p.return
    }
  }
  return env
}

// ── random long-only portfolios (Dirichlet(1)) for the scatter cloud ──────
function dirichlet1(n: number): number[] {
  const x = new Array(n)
  let s = 0
  for (let i = 0; i < n; i++) {
    const u = Math.max(1e-12, Math.random())
    x[i] = -Math.log(u) // Gamma(1) = Exponential
    s += x[i]
  }
  for (let i = 0; i < n; i++) x[i] /= s
  return x
}

export function randomPortfolios(
  mean: number[],
  cov: number[][],
  bounds: Bounds,
  num = 2500,
): CloudPoint[] {
  const n = mean.length
  const lo = bounds ? bounds.map((b) => b[0]) : null
  const hi = bounds ? bounds.map((b) => b[1]) : null
  const out: CloudPoint[] = []
  for (let k = 0; k < num; k++) {
    let w = dirichlet1(n)
    if (lo && hi) {
      // clip + renormalize fallback, matching the Python's relaxed sampler
      w = w.map((wi, i) => Math.min(hi[i], Math.max(lo[i], wi)))
      const s = w.reduce((a, b) => a + b, 0)
      if (s <= 0) continue
      w = w.map((wi) => wi / s)
    }
    const { ret, vol } = portfolioPerformance(w, mean, cov)
    out.push({ return: ret, volatility: vol, sharpe: vol > 0 ? ret / vol : 0 })
  }
  return out
}

// Convenience markers.
export function minVariancePoint(frontier: FrontierPoint[]): FrontierPoint {
  return frontier.reduce((a, b) => (b.volatility < a.volatility ? b : a))
}

export function maxSharpePoint(frontier: FrontierPoint[]): FrontierPoint {
  return frontier.reduce((a, b) => {
    const sa = a.volatility > 0 ? a.return / a.volatility : -Infinity
    const sb = b.volatility > 0 ? b.return / b.volatility : -Infinity
    return sb > sa ? b : a
  })
}
