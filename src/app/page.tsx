import Link from 'next/link'

const projects = [
  {
    title: 'Portfolio Dashboard',
    description:
      'Live portfolio analytics with risk metrics, growth charts, and allocation breakdowns. Built to make professional-grade portfolio analysis accessible to everyone.',
    tags: ['Next.js', 'Recharts', 'Yahoo Finance API'],
    href: '/dashboard',
    status: 'Live',
  },
  {
    title: 'EF Dashboard',
    description:
      'Efficient Frontier visualization tool that maps the risk-return tradeoff across portfolio combinations. Helps you understand where your portfolio sits on the optimal curve.',
    tags: ['Python', 'Optimization', 'Data Viz'],
    href: null,
    status: 'Built',
  },
  {
    title: 'Arb Scanner',
    description:
      'Arbitrage opportunity scanner that monitors price discrepancies across markets in real time. Demonstrates how market inefficiencies work and how they get corrected.',
    tags: ['Python', 'Real-time Data', 'Market Microstructure'],
    href: null,
    status: 'Built',
  },
]

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <section className="mt-8 mb-16">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          Kadyn&apos;s Fireplace
        </h1>
        <p className="text-lg mb-8" style={{ color: 'var(--accent-light)' }}>
          Pulling up a chair to talk finance.
        </p>
        <div
          className="rounded-lg p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm leading-relaxed mb-4" style={{ color: '#cbd5e1' }}>
            The lack of equity in America doesn&apos;t just affect one generation, it has set
            entire families back for decades. When people are shut out of markets, they miss
            the single most powerful tool for building long-term wealth. That gap, which
            compounds every year we miss out, expands in the wrong direction.
          </p>
          <p className="text-sm leading-relaxed mb-4 font-bold" style={{ color: '#cbd5e1' }}>
            This project exists to make finance less intimidating. Every dashboard, every
            metric explanation, every blog post is written for the person who was never taught
            this stuff — because most people weren&apos;t. Understanding how money works
            shouldn&apos;t require a finance degree or a family that already has wealth.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>
            Equity, in markets and in opportunity is the point. Pull up a chair.
          </p>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-base font-semibold text-white mb-4">Projects</h2>
        <div className="space-y-4">
          {projects.map((p) => {
            const inner = (
              <div
                className={`rounded-lg p-5 transition-colors ${p.href ? 'hover:border-blue-600' : ''}`}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-base font-semibold text-white">{p.title}</h3>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: p.status === 'Live' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                      color: p.status === 'Live' ? 'var(--green)' : 'var(--text-muted)',
                      border: `1px solid ${p.status === 'Live' ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.2)'}`,
                    }}
                  >
                    {p.status === 'Live' ? 'Live' : 'Built'}
                  </span>
                </div>
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                  {p.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )

            if (p.href) {
              return (
                <Link key={p.title} href={p.href} className="block">
                  {inner}
                </Link>
              )
            }
            return <div key={p.title}>{inner}</div>
          })}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-base font-semibold text-white mb-4">Latest from the Blog</h2>
        <Link
          href="/blog"
          className="block rounded-lg p-5 transition-colors hover:border-blue-600"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Plain-English explainers on portfolio math, risk metrics, and how to actually
            read them.
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--accent-light)' }}>
            Read the blog &rarr;
          </p>
        </Link>
      </section>
    </div>
  )
}
