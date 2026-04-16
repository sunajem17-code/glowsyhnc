// ─────────────────────────────────────────────────────────────────────────────
// Supabase server-side client (service key — never expose to browser)
// ─────────────────────────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js')

let _client = null

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

// ── User helpers ──────────────────────────────────────────────────────────────

async function getUserByEmail(email) {
  const sb = getSupabase()
  if (!sb || !email) return null
  const { data } = await sb.from('users').select('*').eq('email', email).maybeSingle()
  return data
}

async function getUserById(id) {
  const sb = getSupabase()
  if (!sb || !id) return null
  const { data } = await sb.from('users').select('*').eq('id', id).maybeSingle()
  return data
}

async function createUser(userData) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { data, error } = await sb.from('users').insert(userData).select().single()
  if (error) throw error
  return data
}

async function updateUserById(id, updates) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  const { error } = await sb.from('users').update(updates).eq('id', id)
  if (error) throw error
}

/**
 * Look up a Supabase user by email. Creates one if it doesn't exist.
 * Returns the Supabase UUID string, or null on failure.
 */
async function getOrCreateUser(email, profile = {}) {
  const sb = getSupabase()
  if (!sb || !email) return null

  const { data: existing } = await sb
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return existing.id

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

function isConfigured() {
  return getSupabase() !== null
}

module.exports = {
  getSupabase,
  getOrCreateUser,
  getUserByEmail,
  getUserById,
  createUser,
  updateUserById,
  isConfigured,
}
