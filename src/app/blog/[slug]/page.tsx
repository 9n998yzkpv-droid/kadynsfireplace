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
    <div className="mx-auto max-w-[42rem]">
      <Link
        href="/blog"
        className="mb-10 inline-block text-sm transition-colors hover:text-[var(--text)]"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Back to Blog
      </Link>
      <p className="label mb-3">
        {post.date} · {post.readingTime}
      </p>
      <article
        className="prose"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </div>
  )
}
