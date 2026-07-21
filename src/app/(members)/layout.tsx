import { notFound } from 'next/navigation'
import { MEMBERS_ENABLED } from '@/lib/flags'

// Same convention as /publisher and /projects: while the flag is off, every
// member-facing route in this group simply doesn't exist.
export default function MembersLayout({ children }: { children: React.ReactNode }) {
  if (!MEMBERS_ENABLED) notFound()
  return <div className="mx-auto w-full max-w-md">{children}</div>
}
