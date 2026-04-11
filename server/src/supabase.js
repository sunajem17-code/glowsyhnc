// ─────────────────────────────────────────────────────────────────────────────
// Supabase server-side client (service key — never expose to browser)
// ─────────────────────────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js')

let _client = null

/**
 * Returns a Supabase admin client using the service key.
 * Returns null if env vars are not configured — callers must check.
 */
function getSupabase() {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key || url.includes('your-project')) return null
  _client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _client
}

/**
 * Look up a Supabase user by email. Creates one if it doesn't exist.
 * Returns the Supabase UUID string, or null on failure.
 */
async function getOrCreateUser(email, profile = {}) {
  const sb = getSupabase()
  if (!sb || !email) return null

  // Try existing
  const { data: existing } = await sb
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return existing.id

  // Create new
  const { data: created, error } = await sb
    .from('users')
    .insert({ email, ...profile })
    .select('id')
    .single()

  if (error) {
    console.warn('[Supabase] getOrCreateUser failed:', error.message)
    return null
  }
  return created.id
}

/**
 * Check if Supabase is configured and reachable.
 */
function isConfigured() {
  return getSupabase() !== null
}

module.exports = { getSupabase, getOrCreateUser, isConfigured }
