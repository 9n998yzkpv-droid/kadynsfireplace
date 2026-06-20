'use client'

import Link from 'next/link'
import ProjectDisclaimer from '@/components/ProjectDisclaimer'
import ArbScanner from '@/components/projects/ArbScanner'

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
              Real-time mispricing &amp; arbitrage scanner for Polymarket prediction markets.
            </p>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-3">
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">What It Does</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Scans live Polymarket markets for arbitrage in mutually-exclusive events — where the YES
              prices across all outcomes don&apos;t sum to 100¢ — plus the widest spreads and biggest moves.
            </p>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">How It Works</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Fetches open markets from Polymarket&apos;s public API, groups mutually-exclusive (neg-risk)
              events, and computes the locked-in edge net of an assumed cost buffer — live, in your browser.
            </p>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">Built With</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {['TypeScript', 'Polymarket Gamma API', 'Fetch'].join(' · ')}
            </p>
          </div>
        </div>

        <ArbScanner />

        <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="label mb-5">Other Projects</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/projects/ef-dashboard" className="group flex-1 py-2">
              <p className="text-sm font-semibold transition-colors group-hover:text-[var(--accent)]">EF Dashboard</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Efficient frontier portfolio optimization
              </p>
            </Link>
            <Link href="/dashboard" className="group flex-1 py-2">
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
