import Link from 'next/link'
import type { Metadata } from 'next'
import Portrait from '@/components/Portrait'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Kadyn Rawls — an accounting and finance student at the University of Nevada, Reno, writing plain-English finance education at Kadyn’s Fireplace.',
}

const facts = [
  { label: 'School', value: 'University of Nevada, Reno' },
  { label: 'Class of', value: '2030' },
  { label: 'Studying', value: 'Accounting & Finance' },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[52rem]">
      {/* Hero — portrait + intro */}
      <section className="mb-16 mt-8 sm:mt-12">
        <p className="label mb-6">About</p>
        <div className="grid grid-cols-1 gap-8 sm:gap-10 md:grid-cols-[260px_1fr] md:items-center">
          <div className="mx-auto w-full max-w-[260px] md:mx-0">
            <Portrait />
          </div>
          <div>
            <h1
              className="font-serif-display mb-4 text-4xl leading-[1.1] sm:text-5xl"
              style={{ letterSpacing: '-0.01em' }}
            >
              Hi, I&apos;m Kadyn.
            </h1>
            <p
              className="font-serif-display text-xl leading-relaxed sm:text-2xl"
              style={{ color: 'var(--text-secondary)' }}
            >
              Student, writer, and the one pulling up a chair here at the Fireplace.
            </p>
          </div>
        </div>
      </section>

      {/* Facts strip */}
      <section
        className="mb-16 grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-3"
        style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--border)' }}
      >
        {facts.map((f) => (
          <div key={f.label} className="p-5" style={{ background: 'var(--surface)' }}>
            <p className="label mb-2">{f.label}</p>
            <p className="text-[15px] font-medium">{f.value}</p>
          </div>
        ))}
      </section>

      {/* Story */}
      <section className="mx-auto mb-16 max-w-[42rem]">
        <div className="space-y-6 text-[17px] leading-[1.8]" style={{ color: 'var(--text-secondary)' }}>
          <p>
            I&apos;m a student at the University of Nevada, Reno (Class of 2030), double majoring
            in accounting and finance. Ever since I was a kid, I&apos;ve been interested in
            personal finance, fascinated by how much these skills could shape the rest of my
            life.
          </p>
          <p>
            But somewhere along the way, I noticed something. A lot of people never see the
            potential in investing, not because they can&apos;t, but because no one ever showed
            them. The barrier was almost always the same: a little missing knowledge, and the
            confidence that&apos;s supposed to come with it.
          </p>
          <p>
            So here I am. <span style={{ color: 'var(--text)' }}>Kadyn&apos;s Fireplace</span> is
            my attempt to close that gap, to keep educating others, and myself, one post at a
            time.
          </p>
          <p>
            I&apos;m starting with the fundamentals and sprinkling in a few of my own investment
            theses. Over time, I want to go deeper: into where quantitative finance meets
            old-fashioned value investing, into economics, and into whatever else I think the
            rest of us will genuinely benefit from.
          </p>
          <p className="font-serif-display text-xl" style={{ color: 'var(--text)' }}>
            Pull up a chair.
          </p>
        </div>
      </section>

      {/* Connect */}
      <section className="mx-auto max-w-[42rem] pt-10" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="label mb-4">Let&apos;s connect</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="https://www.linkedin.com/in/kadyn-rawls-06bb37328/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:opacity-70"
            style={{ color: 'var(--accent)', transition: 'opacity 0.15s' }}
          >
            LinkedIn &rarr;
          </a>
          <Link
            href="/blog"
            className="text-sm font-medium hover:opacity-70"
            style={{ color: 'var(--accent)', transition: 'opacity 0.15s' }}
          >
            Read the blog &rarr;
          </Link>
        </div>
      </section>
    </div>
  )
}
