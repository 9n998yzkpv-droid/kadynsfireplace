// Refreshes the Supabase auth session cookie on member-facing routes so
// server components always see a live session. Next.js only picks this up at
// the project root (src/middleware.ts).
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { MEMBERS_ENABLED } from '@/lib/flags'

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!MEMBERS_ENABLED || !url || !key) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Triggers a token refresh if the access token is expired.
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    '/join',
    '/login',
    '/account',
    '/be-heard/:path*',
    '/publisher/:path*',
    '/api/member/:path*',
    '/api/admin/:path*',
  ],
}
