// ─────────────────────────────────────────────────────────────────────────────
// Supabase server-side client (service key — never expose to browser)
// ─────────────────────────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js')

let _client = null

function getSupabase() {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  // Supabase's own dashboard labels this key SUPABASE_SERVICE_ROLE_KEY when
  // you copy it — SUPABASE_SERVICE_KEY is just the name this app happened to
  // use historically. Accept either so regenerating the key from Supabase's
  // UI and pasting their suggested env var name doesn't silently break every
  // production write (server/src/routes/email-webhooks.js already accepts
  // both for this same reason).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
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

// ── Scan cache helpers ────────────────────────────────────────────────────────
// Persistent L2 cache backed by the scan_cache Supabase table.
// TTL: 7 days. Falls back silently if Supabase is unavailable.
// Table DDL: server/migrations/001_create_scan_cache.sql

const SCAN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

/**
 * Look up a cached scan result by its image hash.
 * Returns the cached result object, or null on miss / stale / error.
 */
async function getScanCache(imageHash) {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('scan_cache')
      .select('result, created_at')
      .eq('hash', imageHash)
      .maybeSingle()
    if (error || !data) return null

    const ageMs = Date.now() - new Date(data.created_at).getTime()
    if (ageMs > SCAN_CACHE_TTL_MS) {
      // Stale — purge so the next scan refreshes it
      try { await sb.from('scan_cache').delete().eq('hash', imageHash) } catch {}
      return null
    }
    return data.result
  } catch (err) {
    console.warn('[Supabase] scan_cache read failed (non-fatal):', err.message)
    return null
  }
}

/**
 * Persist a scan result to the cache. Upserts so re-scans of the same
 * photo overwrite rather than duplicate. Fire-and-forget safe.
 */
async function setScanCache(imageHash, result) {
  const sb = getSupabase()
  if (!sb) return
  try {
    const { error } = await sb
      .from('scan_cache')
      .upsert(
        { hash: imageHash, result, created_at: new Date().toISOString() },
        { onConflict: 'hash' }
      )
    if (error) console.warn('[Supabase] scan_cache write error:', error.message)
  } catch (err) {
    console.warn('[Supabase] scan_cache write failed (non-fatal):', err.message)
  }
}

// ── Webhook idempotency helpers ───────────────────────────────────────────────
// Prevents re-processing Stripe events when Stripe re-delivers them (at-least-once).

async function isWebhookProcessed(eventId) {
  const sb = getSupabase()
  if (!sb) return false
  try {
    const { data } = await sb
      .from('processed_webhook_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle()
    return !!data
  } catch {
    return false // fail open: process the event rather than silently drop it
  }
}

async function markWebhookProcessed(eventId, eventType) {
  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('processed_webhook_events').insert({ event_id: eventId, event_type: eventType })
  } catch (err) {
    console.warn('[Supabase] markWebhookProcessed failed (non-fatal):', err.message)
  }
}

// ── Streak helper ─────────────────────────────────────────────────────────────

async function getStreakByUserId(userId) {
  const sb = getSupabase()
  if (!sb || !userId) return null
  try {
    const { data } = await sb.from('streaks').select('*').eq('user_id', userId).maybeSingle()
    return data
  } catch {
    return null
  }
}

module.exports = {
  getSupabase,
  getOrCreateUser,
  getUserByEmail,
  getUserById,
  createUser,
  updateUserById,
  isConfigured,
  getScanCache,
  setScanCache,
  isWebhookProcessed,
  markWebhookProcessed,
  getStreakByUserId,
}
