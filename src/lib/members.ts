// SERVER ONLY — member/admin helpers used by server components and route
// handlers. (Client components should use src/lib/supabase/client.ts and
// src/lib/phone.ts directly.)
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseServer } from './supabase/server'

export interface Member {
  id: string
  name: string
  phone: string
  email: string
  newsletter_opt_in: boolean
  is_active: boolean
  created_at: string
  verified_at: string | null
  phone_verified_at: string | null
}

export function membersConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// The comma-separated E.164 allowlist that defines who is an admin.
// Living in an env var (not the DB) means a compromised signup flow or SQL
// injection can't grant admin — only someone with deploy access can.
function adminPhones(): string[] {
  return (process.env.ADMIN_PHONES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
}

export function isAdminPhone(phone: string): boolean {
  return adminPhones().includes(phone)
}

// Returns the logged-in, email-verified, active member — or null.
// This is THE definition of "verified member" for gating.
export async function getVerifiedMember(
  supabase?: SupabaseClient
): Promise<Member | null> {
  // Fail closed (nobody is a member) rather than throwing if the flag is on
  // but the Supabase env vars aren't set yet.
  if (!membersConfigured()) return null
  supabase = supabase ?? supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('members').select('*').eq('id', user.id).single()
  const member = data as Member | null
  if (!member || !member.verified_at || !member.is_active) return null
  return member
}

// Admin = verified member whose phone is on the ADMIN_PHONES allowlist.
export async function getAdminMember(): Promise<Member | null> {
  const member = await getVerifiedMember()
  if (!member || !isAdminPhone(member.phone)) return null
  return member
}
