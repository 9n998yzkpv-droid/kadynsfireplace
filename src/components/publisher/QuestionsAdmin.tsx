'use client'

// Questions tab inside publisher mode: read, answer, and hide member
// questions. Answering emails the member automatically (the answer is saved
// even if the email fails — the status line says which happened).
// Same auth model as PortfolioAdmin: admin member session required.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface AdminQuestion {
  id: string
  target_type: 'holding' | 'post' | 'topic'
  target_ref: string
  body: string
  status: 'new' | 'answered' | 'hidden'
  answer: string | null
  answered_at: string | null
  created_at: string
  members: { name: string; email: string } | null
}

type Access = 'checking' | 'ok' | 'unauthorized' | 'disabled'

const inputClass =
  'w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow'
const inputStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}
const primaryBtn =
  'rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50'
const secondaryBtn = 'rounded-md text-sm font-medium transition-colors disabled:opacity-50'
const secondaryStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
}

function targetLabel(q: AdminQuestion): string {
  if (q.target_type === 'holding') return `About ${q.target_ref}`
  if (q.target_type === 'post') return `On post: ${q.target_ref}`
  return `Topic: ${q.target_ref}`
}

export default function QuestionsAdmin() {
  const [access, setAccess] = useState<Access>('checking')
  const [questions, setQuestions] = useState<AdminQuestion[]>([])
  const [statusFilter, setStatusFilter] = useState('new')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [answering, setAnswering] = useState<string | null>(null) // question id
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const params = statusFilter ? `?status=${statusFilter}` : ''
    const res = await fetch(`/api/admin/questions${params}`)
    if (res.status === 401) return setAccess('unauthorized')
    if (res.status === 404) return setAccess('disabled')
    if (!res.ok) {
      setAccess('ok')
      setError('Failed to load questions')
      return
    }
    const data = await res.json()
    setQuestions(data.questions ?? [])
    setAccess('ok')
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  async function patch(payload: Record<string, unknown>, okMessage: (data: { emailSent?: boolean }) => string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return false
      }
      setNotice(okMessage(data))
      await load()
      return true
    } catch {
      setError('Failed to connect to server')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function sendAnswer(q: AdminQuestion) {
    const ok = await patch(
      { id: q.id, action: 'answer', answer: draft },
      (d) =>
        d.emailSent
          ? `Answer saved and emailed to ${q.members?.name ?? 'the member'}.`
          : 'Answer saved — but the email could not be sent (check Resend config).'
    )
    if (ok) {
      setAnswering(null)
      setDraft('')
    }
  }

  if (access === 'checking') {
    return <p style={{ color: 'var(--text-muted)' }}>Checking access…</p>
  }

  if (access === 'disabled') {
    return (
      <div className="card px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Memberships aren&apos;t enabled yet. Set up Supabase and flip{' '}
        <code className="rounded px-1" style={{ background: 'var(--surface2)' }}>MEMBERS_ENABLED</code>{' '}
        to manage member questions here.
      </div>
    )
  }

  if (access === 'unauthorized') {
    return (
      <div className="card px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p className="mb-2">Answering questions needs a member login on the admin allowlist.</p>
        <Link href="/login" className="underline underline-offset-4" style={{ color: 'var(--accent)' }}>
          Log in with your member account →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            { key: 'new', label: 'New' },
            { key: 'answered', label: 'Answered' },
            { key: 'hidden', label: 'Hidden' },
            { key: '', label: 'All' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className="rounded-full px-3.5 py-1 text-xs font-medium transition-colors"
              style={
                statusFilter === f.key
                  ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
                  : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
      {notice && <p className="text-sm" style={{ color: 'var(--green)' }}>{notice}</p>}

      {questions.length === 0 ? (
        <p className="py-6 text-sm" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          No {statusFilter || ''} questions.
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="card">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill">{targetLabel(q)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {q.members?.name ?? 'Unknown member'} · {new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <span
                  className="text-xs font-medium capitalize"
                  style={{
                    color:
                      q.status === 'answered'
                        ? 'var(--green)'
                        : q.status === 'hidden'
                          ? 'var(--red)'
                          : 'var(--text-muted)',
                  }}
                >
                  {q.status}
                </span>
              </div>

              <p className="text-[15px]">{q.body}</p>

              {q.answer && answering !== q.id && (
                <div className="mt-3 rounded-md p-3 text-sm" style={{ background: 'var(--surface2)' }}>
                  <p className="label mb-1">Your answer</p>
                  <p className="whitespace-pre-wrap">{q.answer}</p>
                </div>
              )}

              {answering === q.id ? (
                <div className="mt-4 space-y-3">
                  <textarea
                    autoFocus
                    rows={4}
                    maxLength={5000}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Answer ${q.members?.name?.split(' ')[0] ?? 'the member'} — this gets emailed to them.`}
                    className={`${inputClass} resize-y`}
                    style={inputStyle}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendAnswer(q)}
                      disabled={busy || draft.trim().length === 0}
                      className={`px-4 py-2 ${primaryBtn}`}
                      style={{ background: 'var(--accent)' }}
                    >
                      {busy ? 'Sending…' : 'Save & email answer'}
                    </button>
                    <button
                      onClick={() => { setAnswering(null); setDraft('') }}
                      className={`px-4 py-2 ${secondaryBtn}`}
                      style={secondaryStyle}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => { setAnswering(q.id); setDraft(q.answer ?? '') }}
                    className={`px-3 py-1.5 text-xs ${secondaryBtn}`}
                    style={secondaryStyle}
                  >
                    {q.answer ? 'Edit answer' : 'Answer'}
                  </button>
                  <button
                    onClick={() =>
                      patch(
                        { id: q.id, action: q.status === 'hidden' ? 'unhide' : 'hide' },
                        () => (q.status === 'hidden' ? 'Question restored.' : 'Question hidden.')
                      )
                    }
                    disabled={busy}
                    className={`px-3 py-1.5 text-xs ${secondaryBtn}`}
                    style={{ ...secondaryStyle, color: q.status === 'hidden' ? 'var(--text-secondary)' : 'var(--red)' }}
                  >
                    {q.status === 'hidden' ? 'Unhide' : 'Hide'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
