import Link from 'next/link'
import { getAllPosts } from '@/lib/blog'

export default function BlogIndex() {
  const posts = getAllPosts()
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Finance Blog</h1>
      <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
        Plain-English explainers on portfolio math, risk metrics, and how to actually read them.
      </p>
      <div className="space-y-4">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="block card hover:border-blue-600 transition-colors">
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              {p.date} · {p.readingTime}
            </p>
            <h2 className="font-semibold text-white text-base mb-1">{p.title}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{p.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
