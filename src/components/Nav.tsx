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
        <Link href="/" className="font-semibold text-white tracking-tight hover:text-blue-400 transition-colors">
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
