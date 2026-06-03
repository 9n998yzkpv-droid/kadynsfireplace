import { getAllPosts, getPost } from '@/lib/blog'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  let post
  try {
    post = await getPost(params.slug)
  } catch {
    notFound()
  }

  return (
    <div className="max-w-2xl">
      <Link href="/blog" className="text-sm mb-6 inline-block" style={{ color: 'var(--text-muted)' }}>
        ← Back to Blog
      </Link>
      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        {post.date} · {post.readingTime}
      </p>
      <article
        className="prose"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </div>
  )
}
