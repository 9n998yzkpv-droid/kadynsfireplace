'use client'

import { useState } from 'react'

export default function Publisher() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [success, setSuccess] = useState('')

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    setAuthed(true)
    setError('')
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setPublishing(true)

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, title, date, excerpt, content }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          setAuthed(false)
          setPassword('')
        }
        setError(data.error || 'Something went wrong')
        return
      }

      setSuccess(`Published! View at /blog/${data.slug}`)
      setTitle('')
      setExcerpt('')
      setContent('')
      setDate(new Date().toISOString().slice(0, 10))
    } catch {
      setError('Failed to connect to server')
    } finally {
      setPublishing(false)
    }
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-24">
        <div className="card">
          <h1 className="text-xl font-bold text-white mb-1">Publisher Mode</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Enter your password to write and publish posts.
          </p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-3 py-2 rounded-md text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            />
            {error && <p className="text-sm mt-2" style={{ color: 'var(--red)' }}>{error}</p>}
            <button
              type="submit"
              className="w-full mt-4 py-2 rounded-md text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--accent)' }}
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Publisher Mode</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Write in Markdown. Posts go live immediately.
      </p>

      <form onSubmit={handlePublish} className="space-y-4">
        <div>
          <label className="label block mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-md text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            placeholder="e.g. Understanding Sharpe Ratios"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="label block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex-[2]">
            <label className="label block mb-1">Excerpt</label>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              placeholder="Short summary for the blog listing"
            />
          </div>
        </div>

        <div>
          <label className="label block mb-1">Content (Markdown)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={18}
            className="w-full px-3 py-2 rounded-md text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed resize-y"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            placeholder={"## Introduction\n\nStart writing your post here...\n\n- Supports **bold**, *italic*, `code`\n- Tables, blockquotes, and lists\n- Full GitHub-flavored Markdown"}
          />
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
        {success && (
          <p className="text-sm" style={{ color: 'var(--green)' }}>
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={publishing}
          className="px-6 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {publishing ? 'Publishing...' : 'Publish Post'}
        </button>
      </form>
    </div>
  )
}
