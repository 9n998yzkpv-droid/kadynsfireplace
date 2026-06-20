import { notFound } from 'next/navigation'
import { PUBLISHER_ENABLED } from '@/lib/flags'

// The publisher is an admin tool that writes/deletes posts in the GitHub repo.
// Until it has real auth + a rotated secret, keep it 404 for everyone. Flip
// PUBLISHER_ENABLED in src/lib/flags.ts to turn it back on.
export default function PublisherLayout({ children }: { children: React.ReactNode }) {
  if (!PUBLISHER_ENABLED) notFound()
  return <>{children}</>
}
