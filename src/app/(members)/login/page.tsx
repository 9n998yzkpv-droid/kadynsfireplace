'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

const inputStyle = { border: '1px solid var(--border)', background: 'var(--bg)' }

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const supabase = supabaseBrowser()
    // shouldCreateUser: false — logging in must never mint a memberless user.
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    if (err) {
      if (/signups not allowed/i.test(err.message)) {
        setError('No membership found for that email — join below instead.')
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
    router.push('/account')
    router.refresh()
  }

  return (
    <div className="card mt-8 p-8">
      <h1 className="font-serif-display mb-1 text-2xl tracking-tight">Member login</h1>
      <p className="mb-6 text-[15px]" style={{ color: 'var(--text-secondary)' }}>
        We’ll email you a 6-digit code — no password to remember.
      </p>

      {step === 'email' ? (
        <form onSubmit={requestCode} className="flex flex-col gap-4">
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
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md px-5 py-2.5 text-[15px] font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {busy ? 'Sending code…' : 'Send login code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-4">
          <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>
            We emailed a 6-digit code to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
          </p>
          <input
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            aria-label="Login code"
            className="rounded-md px-3 py-2 text-center text-xl tracking-[0.4em]"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="rounded-md px-5 py-2.5 text-[15px] font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {busy ? 'Verifying…' : 'Log in'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('email'); setCode(''); setError('') }}
            className="text-sm underline underline-offset-4"
            style={{ color: 'var(--text-muted)' }}
          >
            Wrong email? Go back
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}

      <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Not a member yet?{' '}
        <Link href="/join" className="underline underline-offset-4" style={{ color: 'var(--accent)' }}>
          Join free
        </Link>
      </p>
    </div>
  )
}
