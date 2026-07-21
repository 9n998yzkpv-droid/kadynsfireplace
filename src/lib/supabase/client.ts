// Browser-side Supabase client. Uses the public anon key — safe to ship to
// the client because row-level security (see supabase/migrations) is the
// actual gate on every table.
import { createBrowserClient } from '@supabase/ssr'

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
