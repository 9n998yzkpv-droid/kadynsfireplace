import type { Metadata } from 'next'
import Link from 'next/link'
import SubscribeForm from '@/components/SubscribeForm'

export const metadata: Metadata = {
  title: 'Subscription',
  robots: { index: false },
}

const COPY: Record<string, { heading: string; body: string; showForm: boolean }> = {
  ok: {
    heading: "You're subscribed 🎉",
    body: 'Every new post will land in your inbox. If you use Gmail, drag our emails to your Primary tab so they actually notify you.',
    showForm: false,
  },
  invalid: {
    heading: 'This link is invalid or has expired',
    body: 'Confirmation links only work for 3 days. Enter your email below and we’ll send you a fresh one.',
    showForm: true,
  },
  error: {
    heading: 'Something went wrong on our end',
    body: 'Your confirmation didn’t go through. Try the link again in a minute, or re-subscribe below.',
    showForm: true,
  },
}

export default function SubscribedPage({ searchParams }: { searchParams: { status?: string } }) {
  const { heading, body, showForm } = COPY[searchParams.status ?? 'ok'] ?? COPY.ok
  return (
    <div className="mx-auto max-w-[42rem]">
      <h1 className="font-serif-display mb-3 text-4xl tracking-tight">{heading}</h1>
      <p className="mb-8 text-[17px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {body}
      </p>
      {showForm ? (
        <SubscribeForm />
      ) : (
        <Link href="/blog" className="text-[15px] underline underline-offset-4" style={{ color: 'var(--accent)' }}>
          Read the latest posts →
        </Link>
      )}
    </div>
  )
}
