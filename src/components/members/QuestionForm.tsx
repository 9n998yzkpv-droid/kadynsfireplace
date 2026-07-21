'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TargetType = 'holding' | 'post' | 'topic'

const inputStyle = { border: '1px solid var(--border)', background: 'var(--bg)' }

export default function QuestionForm({
  tickers,
  posts,
}: {
  tickers: string[]
  posts: { slug: string; title: string }[]
}) {
  const router = useRouter()
  const [targetType, setTargetType] = useState<TargetType>('holding')
  const [targetRef, setTargetRef] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function switchType(t: TargetType) {
    setTargetType(t)
    setTargetRef('')
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const res = await fetch('/api/member/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_ref: targetRef, body }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong — try again.')
        return
      }
      setSuccess('Question sent! You’ll get the answer by email — and it’ll show up below.')
      setBody('')
      setTargetRef('')
      router.refresh()
    } catch {
      setError('Failed to connect — try again.')
    } finally {
      setBusy(false)
    }
  }

  const typeOptions: { key: TargetType; label: string }[] = [
    { key: 'holding', label: 'A holding' },
    { key: 'post', label: 'A blog post' },
    { key: 'topic', label: 'A topic' },
  ]

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <span className="label mb-2 block">What&apos;s it about?</span>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchType(t.key)}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={
                targetType === t.key
                  ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
                  : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {targetType === 'holding' && (
          <>
            <label className="label mb-1.5 block" htmlFor="q-target">Holding</label>
            <select
              id="q-target"
              required
              value={targetRef}
              onChange={(e) => setTargetRef(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-[15px]"
              style={inputStyle}
            >
              <option value="" disabled>Pick a position…</option>
              {tickers.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </>
        )}
        {targetType === 'post' && (
          <>
            <label className="label mb-1.5 block" htmlFor="q-target">Post</label>
            <select
              id="q-target"
              required
              value={targetRef}
              onChange={(e) => setTargetRef(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-[15px]"
              style={inputStyle}
            >
              <option value="" disabled>Pick a post…</option>
              {posts.map((p) => (
                <option key={p.slug} value={p.slug}>{p.title}</option>
              ))}
            </select>
          </>
        )}
        {targetType === 'topic' && (
          <>
            <label className="label mb-1.5 block" htmlFor="q-target">Topic</label>
            <input
              id="q-target"
              required
              maxLength={200}
              value={targetRef}
              onChange={(e) => setTargetRef(e.target.value)}
              placeholder="e.g. Roth IRAs, position sizing, market timing"
              className="w-full rounded-md px-3 py-2 text-[15px]"
              style={inputStyle}
            />
          </>
        )}
      </div>

      <div>
        <label className="label mb-1.5 block" htmlFor="q-body">Your question</label>
        <textarea
          id="q-body"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask away — the more specific, the better the answer."
          className="w-full resize-y rounded-md px-3 py-2 text-[15px]"
          style={inputStyle}
        />
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
      {success && <p className="text-sm" style={{ color: 'var(--green)' }}>{success}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md px-5 py-2.5 text-[15px] font-medium text-white transition-opacity disabled:opacity-60"
        style={{ background: 'var(--accent)' }}
      >
        {busy ? 'Sending…' : 'Send question'}
      </button>
    </form>
  )
}
