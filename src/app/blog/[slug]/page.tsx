import type { Metadata } from 'next'
import { getAllPosts, getPost } from '@/lib/blog'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SubscribeForm from '@/components/SubscribeForm'

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const post = await getPost(params.slug)
    const description = post.excerpt || undefined
    return {
      title: post.title,
      description,
      openGraph: {
        type: 'article',
        title: post.title,
        description,
        ...(post.date ? { publishedTime: post.date } : {}),
      },
      twitter: { card: 'summary_large_image', title: post.title, description },
    }
  } catch {
    return {}
  }
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
      <SubscribeForm />
    </div>
  )
}
