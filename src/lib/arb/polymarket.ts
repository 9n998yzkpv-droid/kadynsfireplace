// Polymarket client + arbitrage logic, running entirely in the browser.
//
// The Python arb_scanner did cross-market (Kalshi vs Polymarket) arb, but Kalshi
// is CloudFront-blocked from browsers (403, no CORS), so that leg can't run
// client-side — it stays in the downloadable Python app. Polymarket's Gamma API
// *does* send `Access-Control-Allow-Origin: *`, so we build a Polymarket-native
// scanner here:
//   1. Mutually-exclusive (negRisk) arbitrage — when the YES prices across a set
//      of exhaustive, mutually-exclusive outcomes sum to != 100c, you can buy the
//      whole basket for a locked-in edge.
//   2. A live market table (price, spread, 24h move, volume, liquidity, close).

const GAMMA = 'https://gamma-api.polymarket.com'

export interface PolyMarket {
  question: string
  eventTitle: string
  eventSlug: string
  yes: number // cents
  no: number // cents
  bestBid: number | null // cents
  bestAsk: number | null // cents
  spread: number // cents (ask - bid)
  change24h: number // percentage points
  volume24h: number // USD
  liquidity: number // USD
  endDate: string | null
}

export interface ArbOpportunity {
  eventTitle: string
  eventSlug: string
  outcomes: number
  sumYes: number // cents
  deviation: number // sumYes - 100
  direction: 'Buy every YES' | 'Buy every NO'
  grossEdge: number // cents per $1 basket
  netEdge: number // after cost buffer
  legs: { label: string; yes: number }[]
}

interface RawMarket {
  question?: string
  outcomes?: string | string[]
  outcomePrices?: string | string[]
  bestBid?: number | null
  bestAsk?: number | null
  spread?: number | null
  oneDayPriceChange?: number | null
  volume24hr?: number | null
  liquidity?: number | null
  liquidityNum?: number | null
  endDate?: string | null
  groupItemTitle?: string
}

interface RawEvent {
  title?: string
  slug?: string
  negRisk?: boolean
  enableNegRisk?: boolean
  markets?: RawMarket[]
}

function parseArr(raw: string | string[] | undefined): string[] | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : null
}

async function fetchEventsPage(offset: number): Promise<RawEvent[]> {
  const url = `${GAMMA}/events?closed=false&active=true&limit=100&offset=${offset}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Polymarket ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.data ?? [])
}

export async function fetchPolymarket(pages = 5): Promise<RawEvent[]> {
  const offsets = Array.from({ length: pages }, (_, i) => i * 100)
  const results = await Promise.allSettled(offsets.map(fetchEventsPage))
  const events: RawEvent[] = []
  for (const r of results) if (r.status === 'fulfilled') events.push(...r.value)
  if (!events.length) throw new Error('Could not reach Polymarket.')
  return events
}

export function toMarkets(events: RawEvent[]): PolyMarket[] {
  const out: PolyMarket[] = []
  for (const e of events) {
    for (const m of e.markets ?? []) {
      const prices = parseArr(m.outcomePrices)
      if (!prices || prices.length < 2) continue
      const yes = parseFloat(prices[0]) * 100
      const no = parseFloat(prices[1]) * 100
      if (!Number.isFinite(yes) || !Number.isFinite(no)) continue
      const bid = num(m.bestBid)
      const ask = num(m.bestAsk)
      const spread =
        bid != null && ask != null ? (ask - bid) * 100 : (num(m.spread) ?? 0) * 100
      out.push({
        question: m.question || m.groupItemTitle || e.title || 'Market',
        eventTitle: e.title || '',
        eventSlug: e.slug || '',
        yes,
        no,
        bestBid: bid != null ? bid * 100 : null,
        bestAsk: ask != null ? ask * 100 : null,
        spread,
        change24h: (num(m.oneDayPriceChange) ?? 0) * 100,
        volume24h: num(m.volume24hr) ?? 0,
        liquidity: num(m.liquidity) ?? num(m.liquidityNum) ?? 0,
        endDate: m.endDate ?? null,
      })
    }
  }
  return out
}

// Mutually-exclusive (negRisk) arbitrage. costBuffer = assumed cost per leg (cents)
// to cover slippage/fees — Polymarket has no taker fee, so 0 is the honest default.
export function findArbs(events: RawEvent[], costBuffer = 0, minEdge = 0.5): ArbOpportunity[] {
  const arbs: ArbOpportunity[] = []
  for (const e of events) {
    const exclusive = e.negRisk || e.enableNegRisk
    const markets = e.markets ?? []
    if (!exclusive || markets.length < 3) continue

    const legs: { label: string; yes: number }[] = []
    let ok = true
    for (const m of markets) {
      const prices = parseArr(m.outcomePrices)
      if (!prices || prices.length < 2) {
        ok = false
        break
      }
      const yes = parseFloat(prices[0]) * 100
      if (!Number.isFinite(yes)) {
        ok = false
        break
      }
      legs.push({ label: m.groupItemTitle || m.question || '', yes })
    }
    if (!ok || legs.length < 3) continue

    const sumYes = legs.reduce((s, l) => s + l.yes, 0)
    const deviation = sumYes - 100
    const grossEdge = Math.abs(deviation)
    const netEdge = grossEdge - costBuffer * legs.length
    if (grossEdge < minEdge) continue

    arbs.push({
      eventTitle: e.title || '',
      eventSlug: e.slug || '',
      outcomes: legs.length,
      sumYes,
      deviation,
      direction: deviation < 0 ? 'Buy every YES' : 'Buy every NO',
      grossEdge,
      netEdge,
      legs: legs.sort((a, b) => b.yes - a.yes),
    })
  }
  return arbs.sort((a, b) => b.netEdge - a.netEdge)
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const end = Date.parse(iso)
  if (!Number.isFinite(end)) return null
  return (end - Date.now()) / 86_400_000
}
