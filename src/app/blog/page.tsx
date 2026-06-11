import Link from 'next/link'
import { getAllPosts } from '@/lib/blog'

export default function BlogIndex() {
  const posts = getAllPosts()
  return (
    <div className="mx-auto max-w-[42rem]">
      <h1 className="font-serif-display mb-3 text-4xl tracking-tight">Finance Blog</h1>
      <p className="mb-12 text-[17px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Plain-English explainers on portfolio math, risk metrics, and how to actually read them.
      </p>
      <div>
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="group block py-7"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <p className="mb-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              {p.date} · {p.readingTime}
            </p>
            <h2 className="mb-1.5 text-xl font-semibold tracking-tight transition-colors group-hover:text-[var(--accent)]">
              {p.title}
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {p.excerpt}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
