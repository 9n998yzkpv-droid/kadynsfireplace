'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const path = usePathname()
  const active = 'text-white border-b-2 border-blue-500 pb-1'
  const inactive = 'text-slate-400 hover:text-white transition-colors'

  return (
    <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white tracking-tight hover:text-blue-400 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C12 2 7 8 7 13C7 15.21 8.47 17.1 10.5 17.79C10.19 17.25 10 16.63 10 16C10 14.34 11.34 13 13 13C13 14.1 13.9 15 15 15C15 13 14 11 12 9C14.5 10 17 12.5 17 16C17 18.76 14.76 21 12 21C9.24 21 7 18.76 7 16H5C5 19.87 8.13 23 12 23C15.87 23 19 19.87 19 16C19 9 12 2 12 2Z" fill="white"/>
          </svg>
          Kadyn&apos;s Fireplace
        </Link>
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className={path.startsWith('/dashboard') ? active : inactive}>Dashboard</Link>
          <Link href="/blog" className={path.startsWith('/blog') ? active : inactive}>Blog</Link>
          <Link href="/publisher" className={path.startsWith('/publisher') ? active : inactive}>Publisher</Link>
        </nav>
      </div>
    </header>
  )
}
