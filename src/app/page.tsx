import Link from 'next/link'
import { getAllPosts } from '@/lib/blog'
import { PROJECTS_ENABLED } from '@/lib/flags'
import data from '../../public/data.json'

const projects = [
  {
    title: 'EF Dashboard',
    description:
      'Efficient Frontier visualization that maps the risk-return tradeoff across portfolio combinations — optimized live in your browser.',
    tags: ['In-browser', 'Optimization', 'Data Viz'],
    href: '/projects/ef-dashboard',
    status: 'Live',
  },
  {
    title: 'Arb Scanner',
    description:
      'Scans live Polymarket prediction markets for mispricings and mutually-exclusive arbitrage, showing how inefficiencies get corrected.',
    tags: ['In-browser', 'Real-time Data', 'Market Microstructure'],
    href: '/projects/arb-scanner',
    status: 'Live',
  },
]

type GrowthPoint = { date: string; portfolio: number; SPY: number }

function sparkPaths(series: GrowthPoint[], w: number, h: number) {
  const pad = 6
  const all = series.flatMap((p) => [p.portfolio, p.SPY])
  const min = Math.min(...all)
  const max = Math.max(...all)
  const x = (i: number) => pad + (i / (series.length - 1)) * (w - pad * 2)
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
  const toPath = (key: 'portfolio' | 'SPY') =>
    series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  return { portfolio: toPath('portfolio'), spy: toPath('SPY') }
}

export default function HomePage() {
  const posts = getAllPosts().slice(0, 3)
  const growth = data.growth_chart as GrowthPoint[]
  const paths = sparkPaths(growth, 560, 200)
  const last = growth[growth.length - 1]
  const vsSpy = last.portfolio - last.SPY
  const stats = [
    { label: 'Total return', value: `${data.portfolio.total_return_pct >= 0 ? '+' : ''}${data.portfolio.total_return_pct.toFixed(1)}%` },
    { label: 'Sharpe ratio', value: data.portfolio.sharpe_ratio.toFixed(2) },
    { label: 'vs SPY', value: `${vsSpy >= 0 ? '+' : ''}${vsSpy.toFixed(1)} pts` },
  ]

  return (
    <div>
      {/* Mission — short and breathable */}
      <section className="mx-auto mt-12 mb-20 max-w-[42rem] sm:mt-20">
        <p className="label mb-6">Kadyn&apos;s Fireplace</p>
        <h1
          className="font-serif-display mb-8 text-4xl leading-[1.15] sm:text-5xl"
          style={{ letterSpacing: '-0.01em' }}
        >
          Pulling up a chair to talk finance.
        </h1>
        <p className="font-serif-display mb-5 text-xl leading-relaxed sm:text-2xl sm:leading-relaxed">
          When people are shut out of markets, they miss the single most powerful tool for
          building long-term wealth — and that gap compounds every year.
        </p>
        <p className="text-[17px] leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
          Every dashboard, metric explanation, and post here is written for the person who
          was never taught this stuff. Equity, in markets and in opportunity, is the point.
          Pull up a chair.
        </p>
      </section>

      {/* Dashboard — the centerpiece project */}
      <section className="mb-20">
        <Link
          href="/dashboard"
          className="group block overflow-hidden transition-shadow hover:shadow-[0_2px_24px_rgba(26,23,20,0.07)]"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.15fr]">
            <div className="p-8 sm:p-10">
              <p className="label mb-5">Live · Portfolio Dashboard</p>
              <h2 className="font-serif-display mb-4 text-2xl tracking-tight sm:text-3xl">
                A real portfolio, all the math shown.
              </h2>
              <p className="mb-8 text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Live analytics on my actual holdings — risk metrics, growth against the
                S&amp;P&nbsp;500, allocation breakdowns — with every number explained in
                plain English.
              </p>
              <div className="mb-8 flex gap-8">
                {stats.map((s) => (
                  <div key={s.label}>
                    <p className="text-xl font-semibold tracking-tight">{s.value}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
              <p
                className="text-sm font-medium transition-colors group-hover:text-[var(--accent)]"
                style={{ color: 'var(--text)' }}
              >
                Open the dashboard &rarr;
              </p>
            </div>
            <div
              className="flex flex-col justify-end p-6 sm:p-8"
              style={{ background: 'var(--surface2)' }}
            >
              <svg
                viewBox="0 0 560 200"
                className="w-full"
                role="img"
                aria-label="Portfolio growth versus SPY over the past year"
              >
                <path d={paths.spy} fill="none" stroke="var(--benchmark)" strokeWidth="1.5" />
                <path d={paths.portfolio} fill="none" stroke="var(--accent)" strokeWidth="2" />
              </svg>
              <div className="mt-4 flex items-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-2">
                  <span className="inline-block h-[2px] w-4" style={{ background: 'var(--accent)' }} />
                  Portfolio
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block h-[2px] w-4" style={{ background: 'var(--benchmark)' }} />
                  SPY
                </span>
                <span className="ml-auto">Updated {data.last_updated.split(' ')[0]}</span>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* Latest writing — real posts, front and center */}
      <section className="mb-20 pt-10" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="mb-10 flex items-baseline justify-between">
          <p className="label">Latest writing</p>
          <Link
            href="/blog"
            className="text-sm font-medium hover:opacity-70"
            style={{ color: 'var(--accent)', transition: 'opacity 0.15s' }}
          >
            All posts &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group block">
              <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {p.date} · {p.readingTime}
              </p>
              <h3 className="mb-2 text-[17px] font-semibold tracking-tight transition-colors group-hover:text-[var(--accent)]">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {p.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* More projects — compact (hidden until projects are released) */}
      {PROJECTS_ENABLED && (
        <section className="pt-10" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="label mb-10">More projects</p>
          <div className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2">
            {projects.map((p) => (
              <Link key={p.title} href={p.href} className="group block">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-[17px] font-semibold tracking-tight transition-colors group-hover:text-[var(--accent)]">
                    {p.title}
                  </h3>
                  <span className="pill">{p.status}</span>
                </div>
                <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {p.description}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.tags.join(' · ')}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
