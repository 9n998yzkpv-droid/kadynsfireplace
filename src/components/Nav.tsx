'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PUBLISHER_ENABLED, NEWSLETTER_ENABLED } from '@/lib/flags'

export default function Nav() {
  const path = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isProjects = path.startsWith('/projects') || path.startsWith('/dashboard')
  const linkStyle = (active: boolean) => ({
    color: active ? 'var(--text)' : 'var(--text-muted)',
    transition: 'color 0.15s',
  })

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: 'var(--bg)',
        borderBottom: `1px solid ${scrolled ? 'var(--border)' : 'transparent'}`,
        transition: 'border-color 0.2s',
      }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1140px] items-center justify-between px-6">
        <Link
          href="/"
          className="font-serif-display flex items-center gap-2 whitespace-nowrap text-[15px] tracking-tight hover:opacity-70 sm:text-[17px]"
          style={{ color: 'var(--text)', transition: 'opacity 0.15s' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2C12 2 7 8 7 13C7 15.21 8.47 17.1 10.5 17.79C10.19 17.25 10 16.63 10 16C10 14.34 11.34 13 13 13C13 14.1 13.9 15 15 15C15 13 14 11 12 9C14.5 10 17 12.5 17 16C17 18.76 14.76 21 12 21C9.24 21 7 18.76 7 16H5C5 19.87 8.13 23 12 23C15.87 23 19 19.87 19 16C19 9 12 2 12 2Z" fill="currentColor"/>
          </svg>
          {/* Icon-only on phones — the wordmark plus five nav items can't share ~375px */}
          <span className="hidden sm:inline">Kadyn&apos;s Fireplace</span>
        </Link>
        <nav className="flex items-center gap-3 text-[13px] font-medium sm:gap-8 sm:text-sm">
          <Link href="/dashboard" className="hover:!text-[var(--text)]" style={linkStyle(isProjects)}>Portfolio</Link>
          <Link href="/blog" className="hover:!text-[var(--text)]" style={linkStyle(path.startsWith('/blog'))}>Blog</Link>
          <Link href="/about" className="hover:!text-[var(--text)]" style={linkStyle(path.startsWith('/about'))}>About</Link>
          {PUBLISHER_ENABLED && (
            <Link href="/publisher" className="hidden hover:!text-[var(--text)] sm:inline" style={linkStyle(path.startsWith('/publisher'))}>Publisher</Link>
          )}
          {NEWSLETTER_ENABLED && (
            <Link
              href="/subscribe"
              className="rounded-md px-2.5 py-1.5 font-medium text-white transition-opacity hover:opacity-85 sm:px-3"
              style={{ background: 'var(--accent)' }}
            >
              Subscribe
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
