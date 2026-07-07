import type { Metadata } from 'next'
import SubscribeForm from '@/components/SubscribeForm'

export const metadata: Metadata = {
  title: 'Subscribe',
  description:
    'Get plain-English finance writing in your inbox — new posts from Kadyn’s Fireplace, free, unsubscribe anytime.',
}

export default function SubscribePage() {
  return (
    <div className="mx-auto max-w-[42rem]">
      <h1 className="font-serif-display mb-3 text-4xl tracking-tight">
        Get new posts in your inbox
      </h1>
      <p className="mb-8 text-[17px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Plain-English writing on portfolio math, risk, and how markets actually work — written
        for the person who was never taught this stuff. New posts land in your inbox the moment
        they go live. Free, no spam, unsubscribe anytime.
      </p>
      <SubscribeForm className="mt-0" showHeader={false} />
    </div>
  )
}
