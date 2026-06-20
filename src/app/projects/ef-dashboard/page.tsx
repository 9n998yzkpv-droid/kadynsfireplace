'use client'

import Link from 'next/link'
import ProjectDisclaimer from '@/components/ProjectDisclaimer'
import EFDashboard from '@/components/projects/EFDashboard'

export default function EFDashboardPage() {
  return (
    <ProjectDisclaimer projectSlug="ef-dashboard" projectName="Efficient Frontier Dashboard">
      <div>
        <div className="mb-10 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="font-serif-display text-3xl tracking-tight">Efficient Frontier Dashboard</h1>
              <span className="pill">Live</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Portfolio optimization tool that maps the risk-return tradeoff across portfolio combinations.
            </p>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-3">
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">What It Does</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Pick a basket of stocks and visualize the efficient frontier — the set of portfolios that
              offer the highest return for each level of risk.
            </p>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">How It Works</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Computes annualized mean returns and covariance from a baked price dataset, then runs a
              long-only mean-variance optimizer to trace the frontier — all in your browser.
            </p>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">Built With</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {['TypeScript', 'Recharts', 'Projected-gradient QP', 'Yahoo Finance data'].join(' · ')}
            </p>
          </div>
        </div>

        <EFDashboard />

        <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="label mb-5">Other Projects</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/projects/arb-scanner" className="group flex-1 py-2">
              <p className="text-sm font-semibold transition-colors group-hover:text-[var(--accent)]">Arb Scanner</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Live Polymarket mispricing &amp; arbitrage scanner
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
