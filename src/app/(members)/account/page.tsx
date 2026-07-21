import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getVerifiedMember, isAdminPhone } from '@/lib/members'
import SignOutButton from '@/components/members/SignOutButton'

export const metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const member = await getVerifiedMember()
  if (!member) redirect('/login')

  const joined = new Date(member.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="card mt-8 p-8">
      <div className="mb-6 flex items-baseline justify-between gap-2">
        <h1 className="font-serif-display text-2xl tracking-tight">Your membership</h1>
        <span className="pill" style={{ color: 'var(--green)' }}>Verified</span>
      </div>

      <dl className="flex flex-col gap-4 text-[15px]">
        <div>
          <dt className="label">Name</dt>
          <dd>{member.name}</dd>
        </div>
        <div>
          <dt className="label">Phone</dt>
          <dd>{member.phone}</dd>
        </div>
        <div>
          <dt className="label">Email</dt>
          <dd>{member.email}</dd>
        </div>
        <div>
          <dt className="label">Member since</dt>
          <dd>{joined}</dd>
        </div>
      </dl>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Link
          href="/be-heard"
          className="rounded-md px-4 py-2 text-[15px] font-medium text-white transition-opacity hover:opacity-85"
          style={{ background: 'var(--accent)' }}
        >
          Ask a question
        </Link>
        <SignOutButton />
      </div>

      {isAdminPhone(member.phone) && (
        <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          You&apos;re an admin —{' '}
          <Link href="/publisher" className="underline underline-offset-4" style={{ color: 'var(--accent)' }}>
            open the publisher
          </Link>
          .
        </p>
      )}
    </div>
  )
}
