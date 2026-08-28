import { createClient } from '@supabase/supabase-js'

// Service-role client: bypasses RLS. Use only in API routes and RSC.
// Never expose to the browser.
// Created lazily so missing env vars only throw at request time, not build time.
let _client = null

export function getSupabaseAdmin() {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('[supabase-server] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required')
  }
  _client = createClient(url, serviceKey, { auth: { persistSession: false } })
  return _client
}

// Named export for backwards-compat with existing importers.
// Accessing this at module evaluation time is safe — only the getter runs.
export const supabaseAdmin = new Proxy({}, {
  get(_t, prop) {
    return getSupabaseAdmin()[prop]
  },
})
