'use client'

import { useState } from 'react'
import { NEWSLETTER_ENABLED } from '@/lib/flags'

export default function SubscribeForm({
  className = 'mt-14',
  showHeader = true,
}: {
  className?: string
  showHeader?: boolean
}) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot — hidden from humans
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (!NEWSLETTER_ENABLED) return null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <div
      className={`rounded-[10px] p-6 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {showHeader && (
        <>
          <h3 className="mb-1 text-lg font-semibold tracking-tight">Get new posts in your inbox</h3>
          <p className="mb-4 text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Plain-English finance writing, emailed when a new post goes live. Free, and you can
            unsubscribe anytime.
          </p>
        </>
      )}
      {status === 'success' ? (
        <p className="text-[15px] font-medium" style={{ color: 'var(--green)' }}>
          Almost there — we sent you a confirmation link. If it&apos;s not in your inbox, check
          Spam or Promotions (and drag it to Primary so new posts notify you).
        </p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="flex-1 rounded-md px-3 py-2 text-[15px]"
              style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
            />
            <input
              type="text"
              name="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="rounded-md px-5 py-2 text-[15px] font-medium text-white transition-opacity disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
          {status === 'error' && (
            <p className="mt-2 text-sm" style={{ color: 'var(--red)' }}>
              {message}
            </p>
          )}
        </>
      )}
    </div>
  )
}
