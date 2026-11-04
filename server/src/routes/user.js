const express = require('express')
const Stripe = require('stripe')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, getSupabase, isConfigured, getStreakByUserId } = require('../supabase')

const router = express.Router()

router.get('/profile', authMiddleware, async (req, res) => {
  // Supabase is source of truth in production
  const sbUser = await getUserById(req.userId).catch(() => null)

  // SQLite fallback for local dev only
  const localUser = isConfigured()
    ? null
    : db.prepare('SELECT id, email, name, avatar_url, subscription_tier, created_at FROM users WHERE id = ?').get(req.userId)

  // The existing aggregate streak comes from Supabase in production. Per-scan
  // type counters are maintained by the scoring routes in SQLite, so merge
  // those columns when available to keep the face/physique streaks visible
  // after profile refreshes without changing subscription/profile authority.
  const localStreak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.userId)
  const streak = isConfigured()
    ? await getStreakByUserId(req.userId)
    : localStreak
  const streakWithScanTypes = streak && localStreak
    ? {
        ...streak,
        face_current_streak: localStreak.face_current_streak,
        face_longest_streak: localStreak.face_longest_streak,
        face_last_scan_date: localStreak.face_last_scan_date,
        physique_current_streak: localStreak.physique_current_streak,
        physique_longest_streak: localStreak.physique_longest_streak,
        physique_last_scan_date: localStreak.physique_last_scan_date,
      }
    : streak || localStreak

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
    // Historical flag retained for accounts that received the old developer
    // promotion. It only gates the dev-only share-card score override.
    promoRedeemed: sbUser?.promo_redeemed === true || sbUser?.promo_redeemed === 1 || false,
  }

  res.json({ user, streak: streakWithScanTypes })
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
  console.log('[deleteAccount] Starting account cleanup')

  // ── Fetch user (need stripe_subscription_id) — non-fatal if not found ───────
  let user = await getUserById(userId).catch(() => null)
  if (!user) {
    // Express 4 doesn't auto-catch a synchronous throw inside an async
    // handler — unlike every other step below, this one wasn't wrapped, so a
    // SQLite error here would hang the request instead of failing loudly.
    try {
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    } catch (err) {
      console.error('[deleteAccount] SQLite user lookup error:', err.message)
    }
  }
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
      console.log('[deleteAccount] Stripe subscription cancellation completed')
    } catch (err) {
      // Non-fatal — may already be cancelled or test key mismatch
      console.warn('[deleteAccount] Stripe cancel skipped:', err.message)
    }
  }

  try {
    const sb = getSupabase()
    // Local tables differ by app generation. Missing legacy tables/columns
    // are harmless; disk, constraint and permission errors must surface.
    const remove = (sql, value = userId) => {
      try { db.prepare(sql).run(value) }
      catch (error) { if (!/no such (table|column)/i.test(error.message)) throw error }
    }
    let plans = []
    try { plans = db.prepare('SELECT id FROM action_plans WHERE user_id = ?').all(userId) }
    catch (error) { if (!/no such (table|column)/i.test(error.message)) throw error }
    for (const plan of plans) {
      remove('DELETE FROM task_completions WHERE plan_id = ?', plan.id)
      remove('DELETE FROM tasks WHERE plan_id = ?', plan.id)
    }
    for (const table of ['task_completions', 'daily_checkins', 'streaks', 'scans', 'community_likes', 'community_comments', 'community_ratings', 'community_posts', 'leaderboard', 'action_plans']) {
      remove(`DELETE FROM ${table} WHERE user_id = ?`)
    }
    remove('DELETE FROM community_reports WHERE reporter_id = ?')
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    if (db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) throw new Error('Account remains')
    if (sb) await require('../lib/deleteAccountData').deleteCloudAccountData(sb, userId)
    require('../lib/coachIntelligence').clearAccountContext(userId)
    res.json({ success: true, appleSubscriptionCancelled: false })
  } catch {
    // No success response for partially deleted records or failed storage.
    res.status(503).json({ error: 'Account deletion could not be completed. Please retry or contact support.' })
  }
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
      const { error } = await sb.from('users').update({ email_unsubscribed: true }).eq('id', uid)
      if (error) throw new Error(error.message)
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
