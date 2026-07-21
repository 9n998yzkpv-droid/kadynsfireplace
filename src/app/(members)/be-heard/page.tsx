import Link from 'next/link'
import { getVerifiedMember } from '@/lib/members'
import { supabaseServer } from '@/lib/supabase/server'
import { getPublicHoldings } from '@/lib/publicHoldings'
import { getAllPosts } from '@/lib/blog'
import QuestionForm from '@/components/members/QuestionForm'

export const metadata = { title: 'Be Heard' }
export const dynamic = 'force-dynamic'

interface MemberQuestion {
  id: string
  target_type: 'holding' | 'post' | 'topic'
  target_ref: string
  body: string
  status: string
  answer: string | null
  answered_at: string | null
  created_at: string
}

function targetLabel(q: MemberQuestion, postTitles: Map<string, string>): string {
  if (q.target_type === 'holding') return `About ${q.target_ref}`
  if (q.target_type === 'post') return `On “${postTitles.get(q.target_ref) ?? q.target_ref}”`
  return `Topic: ${q.target_ref}`
}

export default async function BeHeardPage() {
  // getVerifiedMember() fails closed (null) when Supabase env vars are
  // missing — don't construct a client before that check has run.
  const member = await getVerifiedMember()

  // Non-members see the pitch, not the form.
  if (!member) {
    return (
      <div className="card mt-8 p-8 text-center">
        <h1 className="font-serif-display mb-2 text-2xl tracking-tight">Be Heard</h1>
        <p className="mx-auto mb-6 max-w-sm text-[15px]" style={{ color: 'var(--text-secondary)' }}>
          Members can ask about a holding, a post, or anything finance — and get the answer
          straight to their inbox. Membership is free.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/join"
            className="rounded-md px-5 py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-85"
            style={{ background: 'var(--accent)' }}
          >
            Join free
          </Link>
          <Link
            href="/login"
            className="rounded-md px-5 py-2.5 text-[15px] font-medium"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Log in
          </Link>
        </div>
      </div>
    )
  }

  const supabase = supabaseServer() // safe: member ≠ null implies configured
  const [{ holdings }, posts, { data: questionRows }] = await Promise.all([
    getPublicHoldings(),
    Promise.resolve(getAllPosts()),
    supabase
      .from('questions')
      .select('id, target_type, target_ref, body, status, answer, answered_at, created_at')
      .order('created_at', { ascending: false }),
  ])
  const questions = (questionRows ?? []) as MemberQuestion[]
  const postTitles = new Map(posts.map((p) => [p.slug, p.title]))

  return (
    <div>
      <div className="mt-4">
        <h1 className="font-serif-display mb-1 text-2xl tracking-tight">Be Heard</h1>
        <p className="mb-6 text-[15px]" style={{ color: 'var(--text-secondary)' }}>
          Ask about a holding, a post, or any finance topic. Answers land in your inbox
          ({member.email}) and show up below.
        </p>
      </div>

      <QuestionForm
        tickers={holdings.map((h) => h.ticker)}
        posts={posts.map((p) => ({ slug: p.slug, title: p.title }))}
      />

      <div className="mt-10">
        <h2 className="font-serif-display mb-4 text-xl tracking-tight">Your questions</h2>
        {questions.length === 0 ? (
          <p className="py-6 text-sm" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            Nothing asked yet — your questions and answers will appear here.
          </p>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="card">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="pill">{targetLabel(q, postTitles)}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: q.status === 'answered' ? 'var(--green)' : 'var(--text-muted)' }}
                  >
                    {q.status === 'answered' ? 'Answered' : 'Awaiting answer'}
                  </span>
                </div>
                <p className="text-[15px]">{q.body}</p>
                {q.status === 'answered' && q.answer && (
                  <div
                    className="mt-4 rounded-md p-4 text-[15px]"
                    style={{ background: 'var(--surface2)' }}
                  >
                    <p className="label mb-1.5">Kadyn&apos;s answer</p>
                    <p className="whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{q.answer}</p>
                  </div>
                )}
                <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Asked {new Date(q.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
