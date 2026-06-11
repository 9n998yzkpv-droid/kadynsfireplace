'use client'

import Link from 'next/link'
import ProjectDisclaimer from '@/components/ProjectDisclaimer'

const EF_DASHBOARD_URL = process.env.NEXT_PUBLIC_EF_DASHBOARD_URL || ''

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
              Enter stock tickers and visualize the efficient frontier — the set of portfolios that
              offer the highest return for each level of risk.
            </p>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">How It Works</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Fetches historical price data, computes mean returns and covariance, then runs
              quadratic optimization to find optimal portfolio weights.
            </p>
          </div>
          <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="label mb-2">Built With</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {['Python', 'Flask', 'Plotly.js', 'SciPy', 'Yahoo Finance'].join(' · ')}
            </p>
          </div>
        </div>

        {EF_DASHBOARD_URL ? (
          <div
            className="overflow-hidden rounded-lg"
            style={{ border: '1px solid var(--border)', height: 'calc(100vh - 340px)', minHeight: '500px' }}
          >
            <iframe
              src={EF_DASHBOARD_URL}
              className="h-full w-full"
              style={{ background: 'var(--surface)' }}
              title="Efficient Frontier Dashboard"
            />
          </div>
        ) : (
          <div className="card py-16 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} aria-hidden="true">
              <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-9" />
            </svg>
            <p className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Dashboard server is not connected.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Set <code className="rounded px-1" style={{ background: 'var(--surface2)' }}>NEXT_PUBLIC_EF_DASHBOARD_URL</code> to
              your deployed Flask server URL, or run the server locally with <code className="rounded px-1" style={{ background: 'var(--surface2)' }}>python app.py</code>
            </p>
          </div>
        )}

        <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="label mb-5">Other Projects</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/projects/arb-scanner"
              className="group flex-1 py-2"
            >
              <p className="text-sm font-semibold transition-colors group-hover:text-[var(--accent)]">Arb Scanner</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Cross-platform arbitrage opportunity scanner
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
