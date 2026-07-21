// SERVER ONLY. Service-role client that bypasses row-level security.
// Import this exclusively from route handlers / server code, never from
// anything reachable by a client component — the key is a master key.
import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
