const express = require('express')
const Stripe = require('stripe')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, getSupabase, getScanHistory, isConfigured, getStreakByUserId } = require('../supabase')

const router = express.Router()

router.get('/profile', authMiddleware, async (req, res) => {
  // Supabase is source of truth in production
  const sbUser = await getUserById(req.userId).catch(() => null)

  // SQLite fallback for local dev only
  const localUser = isConfigured()
    ? null
    : db.prepare('SELECT id, email, name, avatar_url, subscription_tier, created_at FROM users WHERE id = ?').get(req.userId)

  // Streak: Supabase in production, SQLite in local dev
  const streak = isConfigured()
    ? await getStreakByUserId(req.userId)
    : db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.userId)

  if (!sbUser && !localUser) return res.status(404).json({ error: 'User not found' })

  const base = sbUser || localUser
  const user = {
    id: base.id,
    name: base.name,
    email: base.email,
    avatarUrl: localUser?.avatar_url || null,
    subscriptionTier: base.subscription_tier || 'free',
    is_pro: sbUser?.is_pro === true || sbUser?.is_pro === 1 || false,
    stripe_subscription_id: sbUser?.stripe_subscription_id || null,
    createdAt: base.created_at,
  }

  res.json({ user, streak })
})

router.put('/profile', authMiddleware, async (req, res) => {
  const { name, avatarUrl } = req.body
  if (isConfigured()) {
    const updates = {}
    if (name) updates.name = name
    if (avatarUrl) updates.avatar_url = avatarUrl
    if (Object.keys(updates).length) {
      try { const { updateUserById } = require('../supabase'); await updateUserById(req.userId, updates) } catch (err) { console.warn('[updateProfile] Supabase update skipped:', err.message) }
    }
  } else {
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId)
    if (avatarUrl) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.userId)
  }
  res.json({ success: true })
})

// ── DELETE /api/user/account ──────────────────────────────────────────────────
// 1. Cancel active Stripe subscription (if any) — non-fatal on failure
// 2. Cascade-delete all user data from Supabase
// 3. Cascade-delete all user data from SQLite
router.delete('/account', authMiddleware, async (req, res) => {
  const userId = req.userId
  console.log('[deleteAccount] Starting deletion for userId:', userId)

  // ── Fetch user (need stripe_subscription_id) — non-fatal if not found ───────
  let user = await getUserById(userId).catch(() => null)
  if (!user) user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  // Don't 404 — proceed with deletion even if we can't find the row (e.g. user
  // already partially deleted, or primary record is in the profiles table).

  // ── 1. Cancel Stripe subscription ────────────────────────────────────────
  const subId = user?.stripe_subscription_id
  if (subId) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        httpClient: Stripe.createFetchHttpClient(),
        maxNetworkRetries: 1,
      })
      await stripe.subscriptions.cancel(subId)
      console.log('[deleteAccount] Stripe subscription cancelled:', subId)
    } catch (err) {
      // Non-fatal — may already be cancelled or test key mismatch
      console.warn('[deleteAccount] Stripe cancel skipped:', err.message)
    }
  }

  // ── 2. Supabase cascade delete ────────────────────────────────────────────
  const sb = getSupabase()
  if (sb) {
    // Delete FK-dependent tables first, then the user row
    const sbTables = [
      'task_completions',
      'daily_checkins',
      'streaks',
      'plan_tasks',
      'progress',
      'scans',
      'leaderboard',
      'action_plans',
    ]
    for (const table of sbTables) {
      try {
        await sb.from(table).delete().eq('user_id', userId)
      } catch (err) {
        console.warn(`[deleteAccount] Supabase ${table} delete skipped:`, err.message)
      }
    }
    // Also clean up optional tables (may or may not exist in this environment)
    for (const table of ['email_sends', 'scan_cache', 'affiliate_clicks']) {
      try {
        await sb.from(table).delete().eq('user_id', userId)
      } catch (err) {
        console.warn(`[deleteAccount] Supabase ${table} delete skipped:`, err.message)
      }
    }
    try {
      await sb.from('profiles').delete().eq('id', userId)
      console.log('[deleteAccount] Supabase profiles row deleted')
    } catch (err) {
      console.warn('[deleteAccount] Supabase profiles delete skipped:', err.message)
    }
    try {
      await sb.from('users').delete().eq('id', userId)
      console.log('[deleteAccount] Supabase users row deleted')
    } catch (err) {
      console.warn('[deleteAccount] Supabase users delete skipped:', err.message)
    }

    // ── Delete scan images from Supabase Storage ────────────────────────────
    // Files are stored under scan-images/{folder}/{userId}/... where folder
    // is always 'scan' (the default in /supabase/upload-image). We list only
    // this user's prefix so we never touch any other user's files.
    try {
      const { data: files, error: listErr } = await sb.storage
        .from('scan-images')
        .list(`scan/${userId}`)
      if (listErr) {
        console.warn('[deleteAccount] Storage list failed:', listErr.message)
      } else if (files && files.length > 0) {
        const paths = files.map(f => `scan/${userId}/${f.name}`)
        const { error: removeErr } = await sb.storage
          .from('scan-images')
          .remove(paths)
        if (removeErr) {
          console.warn('[deleteAccount] Storage remove failed:', removeErr.message)
        } else {
          console.log(`[deleteAccount] Storage: removed ${paths.length} file(s) for userId:`, userId)
        }
      } else {
        console.log('[deleteAccount] Storage: no scan images found for userId:', userId)
      }
    } catch (err) {
      console.warn('[deleteAccount] Storage cleanup error:', err.message)
    }
  }

  // ── 3. SQLite cascade delete ──────────────────────────────────────────────
  try {
    // task_completions may reference tasks; delete via plan ownership
    const plans = db.prepare('SELECT id FROM action_plans WHERE user_id = ?').all(userId)
    for (const plan of plans) {
      try { db.prepare('DELETE FROM tasks WHERE plan_id = ?').run(plan.id) } catch (err) { console.warn('[deleteAccount] tasks by plan delete skipped:', err.message) }
      try { db.prepare('DELETE FROM task_completions WHERE plan_id = ?').run(plan.id) } catch (err) { console.warn('[deleteAccount] task_completions by plan delete skipped:', err.message) }
    }
    // Also try direct user_id column in case schema differs
    try { db.prepare('DELETE FROM task_completions WHERE user_id = ?').run(userId) } catch (err) { console.warn('[deleteAccount] task_completions by user delete skipped:', err.message) }
    db.prepare('DELETE FROM daily_checkins WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM streaks WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM action_plans WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM scans WHERE user_id = ?').run(userId)
    try { db.prepare('DELETE FROM community_likes WHERE user_id = ?').run(userId) } catch (err) { console.warn('[deleteAccount] community_likes delete skipped:', err.message) }
    try { db.prepare('DELETE FROM community_posts WHERE user_id = ?').run(userId) } catch (err) { console.warn('[deleteAccount] community_posts delete skipped:', err.message) }
    try { db.prepare('DELETE FROM leaderboard WHERE user_id = ?').run(userId) } catch (err) { console.warn('[deleteAccount] leaderboard delete skipped:', err.message) }
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    console.log('[deleteAccount] SQLite cleanup done')
  } catch (err) {
    console.error('[deleteAccount] SQLite cleanup error:', err.message)
  }

  console.log('[deleteAccount] Done for userId:', userId)
  res.json({ success: true })
})

// ── GET /api/user/scan-history ────────────────────────────────────────────────
// Returns the 12 most recent scan history entries for the logged-in user.
router.get('/scan-history', authMiddleware, async (req, res) => {
  const history = await getScanHistory(req.userId, 12)
  res.json({ history })
})

// ── GET /api/user/unsubscribe?uid=:userId ─────────────────────────────────────
// One-click unsubscribe link for CAN-SPAM / GDPR compliance.
// Linked from marketing email footers. No auth required — the uid IS the token.
router.get('/unsubscribe', async (req, res) => {
  const { uid } = req.query
  if (!uid) return res.status(400).send('Missing uid parameter.')
  try {
    const sb = getSupabase()
    if (sb) {
      await sb.from('users').update({ email_unsubscribed: true }).eq('id', uid)
    } else {
      db.prepare('UPDATE users SET email_unsubscribed = 1 WHERE id = ?').run(uid)
    }
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#111;color:#fff;">
        <h2>You've been unsubscribed.</h2>
        <p style="color:#aaa">You won't receive any more marketing emails from Ascendus.<br>
        You can re-enable emails anytime in your account settings.</p>
      </body></html>
    `)
  } catch (err) {
    console.error('[unsubscribe] error:', err.message)
    res.status(500).send('Something went wrong. Please contact support@ascendus.store.')
  }
})

module.exports = router
