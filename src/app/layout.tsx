import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif' })

const SITE_DESCRIPTION = 'Finance education, portfolio analytics, and equity for everyone.'

export const metadata: Metadata = {
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: {
    default: "Kadyn's Fireplace",
    template: "%s · Kadyn's Fireplace",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: "Kadyn's Fireplace",
    title: "Kadyn's Fireplace",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: "Kadyn's Fireplace",
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <Nav />
        <main className="fade-in mx-auto w-full max-w-[1140px] px-6 py-12">{children}</main>
        <footer className="mt-24" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="mx-auto flex w-full max-w-[1140px] flex-wrap items-center justify-between gap-2 px-6 py-8">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              &copy; {new Date().getFullYear()} Kadyn&apos;s Fireplace
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Educational content — not financial advice.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
