'use client'

import Link from 'next/link'
import ProjectDisclaimer from '@/components/ProjectDisclaimer'

const ARB_SCANNER_URL = process.env.NEXT_PUBLIC_ARB_SCANNER_URL || ''

export default function ArbScannerPage() {
  return (
    <ProjectDisclaimer projectSlug="arb-scanner" projectName="Arb Scanner">
      <div>
        <div className="mb-10 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="font-serif-display text-3xl tracking-tight">Arb Scanner</h1>
              <span className="pill">Live</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Real-time arbitrage opportunity scanner across Kalshi and Polymarket prediction markets.
            </p>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-3">
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">What It Does</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Monitors price discrepancies between Kalshi and Polymarket in real time, scoring
              each opportunity by edge, liquidity, and execution cost.
            </p>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">How It Works</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Fetches markets from both platforms, fuzzy-matches equivalent contracts, computes
              the arbitrage spread net of fees, and streams results via SSE.
            </p>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">Built With</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {['Python', 'aiohttp', 'httpx', 'RapidFuzz', 'SSE'].join(' · ')}
            </p>
          </div>
        </div>

        {ARB_SCANNER_URL ? (
          <div
            className="overflow-hidden rounded-lg"
            style={{ border: '1px solid var(--border)', height: 'calc(100vh - 340px)', minHeight: '500px' }}
          >
            <iframe
              src={ARB_SCANNER_URL}
              className="h-full w-full"
              style={{ background: 'var(--surface)' }}
              title="Arb Scanner"
            />
          </div>
        ) : (
          <div className="card py-16 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <p className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Scanner server is not connected.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Set <code className="rounded px-1" style={{ background: 'var(--surface2)' }}>NEXT_PUBLIC_ARB_SCANNER_URL</code> to
              your deployed server URL, or run locally with <code className="rounded px-1" style={{ background: 'var(--surface2)' }}>python -m arb_scanner.server</code>
            </p>
          </div>
        )}

        <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="label mb-5">Other Projects</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/projects/ef-dashboard"
              className="group flex-1 py-2"
            >
              <p className="text-sm font-semibold transition-colors group-hover:text-[var(--accent)]">EF Dashboard</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Efficient frontier portfolio optimization
              </p>
            </Link>
            <Link
              href="/dashboard"
              className="group flex-1 py-2"
            >
              <p className="text-sm font-semibold transition-colors group-hover:text-[var(--accent)]">Portfolio Dashboard</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Live portfolio analytics and risk metrics
              </p>
            </Link>
          </div>
        </div>
      </div>
    </ProjectDisclaimer>
  )
}
