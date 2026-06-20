'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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

  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleDocxImport(file: File) {
    setImporting(true)
    setError('')
    setSuccess('')
    try {
      const mammoth = (await import('mammoth')).default
      const TurndownService = (await import('turndown')).default

      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer })

      const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
      })
      turndown.addRule('strikethrough', {
        filter: (node: HTMLElement) => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
        replacement: (c: string) => `~~${c}~~`,
      })

      const markdown = turndown.turndown(result.value)

      const titleMatch = markdown.match(/^#\s+(.+)$/m)
      const extractedTitle = titleMatch
        ? titleMatch[1].trim()
        : file.name.replace(/\.docx?$/i, '').replace(/[-_]/g, ' ')

      const contentWithoutTitle = titleMatch
        ? markdown.replace(/^#\s+.+\n*/, '').trim()
        : markdown.trim()

      setTitle(extractedTitle)
      setContent(contentWithoutTitle)
      setDate(new Date().toISOString().slice(0, 10))

      const firstParagraph = contentWithoutTitle
        .split('\n\n')
        .find(p => p && !p.startsWith('#') && !p.startsWith('-') && !p.startsWith('|'))
      if (firstParagraph) {
        setExcerpt(firstParagraph.slice(0, 160).replace(/\n/g, ' '))
      }

      setSuccess(`Imported "${file.name}" — review and publish when ready.`)
      setView('editor')
      setEditingSlug(null)
    } catch {
      setError('Failed to import .docx file. Make sure it is a valid Word document.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/publish', { headers: { 'x-publisher-password': password } })
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
      const res = await fetch(`/api/publish?slug=${encodeURIComponent(slug)}`, {
        headers: { 'x-publisher-password': password },
      })
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
    'w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow'
  const inputStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
  }
  const primaryBtn =
    'rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50'
  const secondaryBtn =
    'rounded-md text-sm font-medium transition-colors disabled:opacity-50'
  const secondaryStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  }

  if (!authed) {
    return (
      <div className="mx-auto mt-24 max-w-sm">
        <div className="card">
          <h1 className="font-serif-display mb-1 text-2xl tracking-tight">Publisher Mode</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
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
            {error && <p className="mt-2 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
            <button
              type="submit"
              className={`mt-4 w-full py-2 ${primaryBtn}`}
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
      <div className="mx-auto max-w-[42rem]">
        <button
          onClick={() => { setView('list'); setError(''); setSuccess('') }}
          className="mb-8 inline-block text-sm transition-colors hover:text-[var(--text)]"
          style={{ color: 'var(--text-muted)' }}
        >
          &larr; Back to Posts
        </button>
        <div className="mb-1 flex items-center justify-between">
          <h1 className="font-serif-display text-3xl tracking-tight">
            {editingSlug ? 'Edit Post' : 'New Post'}
          </h1>
          {!editingSlug && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className={`px-3 py-1.5 text-xs ${secondaryBtn}`}
                style={secondaryStyle}
              >
                {importing ? 'Importing...' : 'Import .docx'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleDocxImport(file)
                }}
              />
            </>
          )}
        </div>
        <p className="mb-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          Write in Markdown or import a .docx from Google Docs. Posts go live immediately.
        </p>

        <form onSubmit={handlePublish} className="space-y-5">
          <div>
            <label className="label mb-1.5 block">Title</label>
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
              <label className="label mb-1.5 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="flex-[2]">
              <label className="label mb-1.5 block">Excerpt</label>
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
            <label className="label mb-1.5 block">Content (Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={18}
              className={`${inputClass} resize-y font-mono leading-relaxed`}
              style={inputStyle}
              placeholder={"## Introduction\n\nStart writing your post here...\n\n- Supports **bold**, *italic*, `code`\n- Tables, blockquotes, and lists\n- Full GitHub-flavored Markdown"}
            />
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
          {success && <p className="text-sm" style={{ color: 'var(--green)' }}>{success}</p>}

          <button
            type="submit"
            disabled={publishing}
            className={`px-6 py-2 ${primaryBtn}`}
            style={{ background: 'var(--accent)' }}
          >
            {publishing ? 'Saving...' : editingSlug ? 'Update Post' : 'Publish Post'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[42rem]">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-serif-display text-3xl tracking-tight">Publisher Mode</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {posts.length} post{posts.length !== 1 ? 's' : ''} published
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className={`px-4 py-2 text-sm ${secondaryBtn}`}
            style={secondaryStyle}
          >
            {importing ? 'Importing...' : 'Import .docx'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleDocxImport(file)
            }}
          />
          <button
            onClick={openNewPost}
            className={`px-4 py-2 ${primaryBtn}`}
            style={{ background: 'var(--accent)' }}
          >
            + New Post
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading posts...</p>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No posts yet. Click &ldquo;+ New Post&rdquo; to write your first one.
          </p>
        </div>
      ) : (
        <div>
          {posts.map((p) => (
            <div
              key={p.slug}
              className="flex items-center justify-between gap-4 py-5"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.date} · {p.readingTime}
                </p>
                <h2 className="truncate text-base font-semibold tracking-tight">{p.title}</h2>
                <p className="truncate text-sm" style={{ color: 'var(--text-secondary)' }}>{p.excerpt}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => openEditPost(p.slug)}
                  className={`px-3 py-1.5 text-xs ${secondaryBtn}`}
                  style={secondaryStyle}
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className={`px-3 py-1.5 text-xs ${secondaryBtn}`}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--red)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(26,23,20,0.4)' }}>
          <div className="card mx-4 w-full max-w-sm" style={{ boxShadow: '0 4px 24px rgba(26,23,20,0.1)' }}>
            <h2 className="font-serif-display mb-2 text-xl tracking-tight">Delete Post</h2>
            <p className="mb-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to delete:
            </p>
            <p className="mb-4 text-sm font-semibold">
              &ldquo;{deleteTarget.title}&rdquo;
            </p>
            <p className="mb-6 text-xs" style={{ color: 'var(--red)' }}>
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className={`flex-1 py-2 ${secondaryBtn}`}
                style={secondaryStyle}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex-1 py-2 ${primaryBtn}`}
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
