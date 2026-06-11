'use client'

import { useState, useEffect } from 'react'

interface ProjectDisclaimerProps {
  projectSlug: string
  projectName: string
  children: React.ReactNode
}

export default function ProjectDisclaimer({ projectSlug, projectName, children }: ProjectDisclaimerProps) {
  const [accepted, setAccepted] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const key = `disclaimer-${projectSlug}`
    if (sessionStorage.getItem(key) === 'accepted') {
      setAccepted(true)
    }
    setLoaded(true)
  }, [projectSlug])

  function handleAccept() {
    sessionStorage.setItem(`disclaimer-${projectSlug}`, 'accepted')
    setAccepted(true)
  }

  if (!loaded) return null

  if (!accepted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(26,23,20,0.4)' }}>
        <div className="card mx-4 w-full max-w-lg" style={{ boxShadow: '0 4px 24px rgba(26,23,20,0.1)' }}>
          <div className="mb-4 flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h2 className="font-serif-display text-xl tracking-tight">{projectName}</h2>
          </div>

          <div className="mb-6 space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This tool is provided for <strong style={{ color: 'var(--text)' }}>educational and discretionary testing purposes only</strong>.
              It is not financial advice, and no information presented should be interpreted as a recommendation
              to buy, sell, or hold any security.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              All data is provided as-is with no guarantee of accuracy. Past performance does not indicate
              future results. Use this tool at your own risk and always do your own research before making
              any investment decisions.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              By continuing, you acknowledge that you understand these terms.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/"
              className="flex-1 rounded-md py-2 text-center text-sm font-medium transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              Go Back
            </a>
            <button
              onClick={handleAccept}
              className="flex-1 rounded-md py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              I Understand, Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
