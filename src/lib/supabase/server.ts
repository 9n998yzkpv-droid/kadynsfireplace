// Server-side Supabase client for server components and route handlers.
// Reads the auth session from cookies; still runs under RLS (anon key), so
// it can only do what the logged-in member is allowed to do.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function supabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component — session refresh is handled by
            // middleware, so swallowing the write here is safe.
          }
        },
      },
    }
  )
}
