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
    href: '/projects/ef-dashboard',
    status: 'Live',
  },
  {
    title: 'Arb Scanner',
    description:
      'Arbitrage opportunity scanner that monitors price discrepancies across markets in real time. Demonstrates how market inefficiencies work and how they get corrected.',
    tags: ['Python', 'Real-time Data', 'Market Microstructure'],
    href: '/projects/arb-scanner',
    status: 'Live',
  },
]

export default function HomePage() {
  return (
    <div>
      {/* Mission — editorial centerpiece */}
      <section className="mx-auto mt-12 mb-28 max-w-[42rem] sm:mt-20">
        <p className="label mb-6">Kadyn&apos;s Fireplace</p>
        <h1
          className="font-serif-display mb-10 text-4xl leading-[1.15] sm:text-5xl"
          style={{ letterSpacing: '-0.01em' }}
        >
          Pulling up a chair to talk finance.
        </h1>
        <p className="font-serif-display mb-6 text-xl leading-relaxed sm:text-2xl sm:leading-relaxed">
          The lack of equity in America doesn&apos;t just affect one generation, it has set
          entire families back for decades. When people are shut out of markets, they miss
          the single most powerful tool for building long-term wealth. That gap, which
          compounds every year we miss out, expands in the wrong direction.
        </p>
        <p className="mb-6 text-[17px] leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
          This project exists to make finance less intimidating. Every dashboard, every
          metric explanation, every blog post is written for the person who was never taught
          this stuff — because most people weren&apos;t. Understanding how money works
          shouldn&apos;t require a finance degree or a family that already has wealth.
        </p>
        <p className="text-[17px] leading-[1.75]">
          Equity, in markets and in opportunity is the point. Pull up a chair.
        </p>
      </section>

      {/* Projects */}
      <section className="mb-28 pt-10" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="label mb-10">Projects</p>
        <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.title} href={p.href} className="group block">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3
                  className="text-[17px] font-semibold tracking-tight transition-colors group-hover:text-[var(--accent)]"
                >
                  {p.title}
                </h3>
                <span className="pill">{p.status}</span>
              </div>
              <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {p.description}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {p.tags.join(' · ')}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Blog teaser */}
      <section className="pt-10" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="label mb-6">Latest from the blog</p>
        <Link href="/blog" className="group block max-w-[42rem]">
          <p className="mb-3 text-[17px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Plain-English explainers on portfolio math, risk metrics, and how to actually
            read them.
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
            Read the blog &rarr;
          </p>
        </Link>
      </section>
    </div>
  )
}
