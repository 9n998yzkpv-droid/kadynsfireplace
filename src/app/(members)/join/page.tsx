'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { normalizePhone } from '@/lib/phone'

const inputStyle = { border: '1px solid var(--border)', background: 'var(--bg)' }

export default function JoinPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [newsletter, setNewsletter] = useState(true)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const e164 = normalizePhone(phone)
    if (!name.trim()) return setError('Please enter your name.')
    if (!e164) return setError('Please enter a valid phone number (e.g. 702-555-0123).')

    setBusy(true)
    const supabase = supabaseBrowser()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        // Picked up by the handle_new_user() DB trigger to create the
        // members profile row.
        data: {
          member_name: name.trim(),
          member_phone: e164,
          newsletter_opt_in: newsletter,
        },
      },
    })
    setBusy(false)
    if (err) {
      // A failed profile insert (duplicate phone) rolls the signup back and
      // surfaces as a generic database error — translate it.
      if (/database error/i.test(err.message)) {
        setError('That phone number is already registered — try logging in instead.')
      } else if (/rate limit/i.test(err.message)) {
        setError('Too many attempts — wait a minute and try again.')
      } else {
        setError(err.message)
      }
      return
    }
    setStep('code')
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const supabase = supabaseBrowser()
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    if (err) {
      setBusy(false)
      setError('That code didn’t match — check the digits and try again.')
      return
    }
    if (newsletter) {
      // Best-effort: membership shouldn't fail because the newsletter add did.
      await fetch('/api/member/newsletter', { method: 'POST' }).catch(() => {})
    }
    router.push('/account')
    router.refresh()
  }

  return (
    <div className="card mt-8 p-8">
      <h1 className="font-serif-display mb-1 text-2xl tracking-tight">Join the Fireplace</h1>
      <p className="mb-6 text-[15px]" style={{ color: 'var(--text-secondary)' }}>
        Members can ask questions about the portfolio and posts — and get answers straight to
        their inbox. Free.
      </p>

      {step === 'form' ? (
        <form onSubmit={requestCode} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="label">Full name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              className="rounded-md px-3 py-2 text-[15px]"
              style={inputStyle}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Phone number</span>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="702-555-0123"
              autoComplete="tel"
              className="rounded-md px-3 py-2 text-[15px]"
              style={inputStyle}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="rounded-md px-3 py-2 text-[15px]"
              style={inputStyle}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              We’ll email you a 6-digit code to verify it’s you.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
            />
            Also email me new posts (unsubscribe anytime)
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md px-5 py-2.5 text-[15px] font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {busy ? 'Sending code…' : 'Send verification code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-4">
          <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>
            We emailed a 6-digit code to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
            Enter it below.
          </p>
          <input
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            aria-label="Verification code"
            className="rounded-md px-3 py-2 text-center text-xl tracking-[0.4em]"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="rounded-md px-5 py-2.5 text-[15px] font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {busy ? 'Verifying…' : 'Verify and join'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('form'); setCode(''); setError('') }}
            className="text-sm underline underline-offset-4"
            style={{ color: 'var(--text-muted)' }}
          >
            Wrong email? Go back
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 text-sm" style={{ color: 'var(--red)' }}>{error}</p>
      )}

      <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Already a member?{' '}
        <Link href="/login" className="underline underline-offset-4" style={{ color: 'var(--accent)' }}>
          Log in
        </Link>
      </p>
    </div>
  )
}
