'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    await supabaseBrowser().auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="rounded-md px-4 py-2 text-[15px] font-medium transition-opacity disabled:opacity-60"
      style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
