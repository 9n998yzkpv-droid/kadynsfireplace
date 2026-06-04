'use client'

import { useState, useEffect, useCallback } from 'react'

interface PostMeta {
  slug: string
  title: string
  date: string
  excerpt: string
  readingTime: string
}

type View = 'list' | 'editor'

export default function Publisher() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('list')

  const [posts, setPosts] = useState<PostMeta[]>([])
  const [loading, setLoading] = useState(false)

  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [success, setSuccess] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<PostMeta | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/publish?password=${encodeURIComponent(password)}`)
      if (res.status === 401) {
        setAuthed(false)
        setPassword('')
        setError('Session expired')
        return
      }
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch {
      setError('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => {
    if (authed) fetchPosts()
  }, [authed, fetchPosts])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    setAuthed(true)
    setError('')
  }

  function openNewPost() {
    setEditingSlug(null)
    setTitle('')
    setDate(new Date().toISOString().slice(0, 10))
    setExcerpt('')
    setContent('')
    setSuccess('')
    setError('')
    setView('editor')
  }

  async function openEditPost(slug: string) {
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/publish?password=${encodeURIComponent(password)}&slug=${slug}`)
      if (!res.ok) {
        setError('Failed to load post')
        return
      }
      const data = await res.json()
      setEditingSlug(slug)
      setTitle(data.title)
      setDate(data.date)
      setExcerpt(data.excerpt)
      setContent(data.content)
      setView('editor')
    } catch {
      setError('Failed to load post')
    }
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
        body: JSON.stringify({
          password,
          title,
          date,
          excerpt,
          content,
          existingSlug: editingSlug,
        }),
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

      setSuccess(editingSlug ? 'Post updated! Site will redeploy in ~30 seconds.' : `Published! Site will redeploy in ~30 seconds. View at /blog/${data.slug}`)
      await fetchPosts()
      setTimeout(() => {
        setView('list')
        setSuccess('')
      }, 1500)
    } catch {
      setError('Failed to connect to server')
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')

    try {
      const res = await fetch('/api/publish', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, slug: deleteTarget.slug }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 401) {
          setAuthed(false)
          setPassword('')
        }
        setError(data.error || 'Failed to delete')
        return
      }

      setDeleteTarget(null)
      await fetchPosts()
    } catch {
      setError('Failed to connect to server')
    } finally {
      setDeleting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 rounded-md text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500'
  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)' }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-24">
        <div className="card">
          <h1 className="text-xl font-bold text-white mb-1">Publisher Mode</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Enter your password to manage posts.
          </p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className={inputClass}
              style={inputStyle}
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

  if (view === 'editor') {
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => { setView('list'); setError(''); setSuccess('') }}
          className="text-sm mb-6 inline-block"
          style={{ color: 'var(--text-muted)' }}
        >
          &larr; Back to Posts
        </button>
        <h1 className="text-2xl font-bold mb-1">
          {editingSlug ? 'Edit Post' : 'New Post'}
        </h1>
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
              className={inputClass}
              style={inputStyle}
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
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="flex-[2]">
              <label className="label block mb-1">Excerpt</label>
              <input
                type="text"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className={inputClass}
                style={inputStyle}
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
              className={`${inputClass} font-mono leading-relaxed resize-y`}
              style={inputStyle}
              placeholder={"## Introduction\n\nStart writing your post here...\n\n- Supports **bold**, *italic*, `code`\n- Tables, blockquotes, and lists\n- Full GitHub-flavored Markdown"}
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
          {success && <p className="text-sm" style={{ color: 'var(--green)' }}>{success}</p>}

          <button
            type="submit"
            disabled={publishing}
            className="px-6 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {publishing ? 'Saving...' : editingSlug ? 'Update Post' : 'Publish Post'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Publisher Mode</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''} published
          </p>
        </div>
        <button
          onClick={openNewPost}
          className="px-4 py-2 rounded-md text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--accent)' }}
        >
          + New Post
        </button>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: 'var(--red)' }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading posts...</p>
      ) : posts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No posts yet. Click &ldquo;+ New Post&rdquo; to write your first one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.slug} className="card flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  {p.date} · {p.readingTime}
                </p>
                <h2 className="font-semibold text-white text-base truncate">{p.title}</h2>
                <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{p.excerpt}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEditPost(p.slug)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-white mb-2">Delete Post</h2>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
              Are you sure you want to delete:
            </p>
            <p className="text-sm font-semibold text-white mb-4">
              &ldquo;{deleteTarget.title}&rdquo;
            </p>
            <p className="text-xs mb-6" style={{ color: 'var(--red)' }}>
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-md text-sm font-medium transition-colors"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--red)' }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
