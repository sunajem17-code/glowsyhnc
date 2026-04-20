const express = require('express')
const Stripe = require('stripe')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, getSupabase } = require('../supabase')

const router = express.Router()

router.get('/profile', authMiddleware, async (req, res) => {
  // Supabase is source of truth for subscription/pro status
  const sbUser = await getUserById(req.userId).catch(() => null)

  // SQLite fallback for everything else (streak, local dev)
  const localUser = db.prepare('SELECT id, email, name, avatar_url, subscription_tier, created_at FROM users WHERE id = ?').get(req.userId)
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.userId)

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

router.put('/profile', authMiddleware, (req, res) => {
  const { name, avatarUrl } = req.body
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId)
  if (avatarUrl) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.userId)
  res.json({ success: true })
})

// ── DELETE /api/user/account ──────────────────────────────────────────────────
// 1. Cancel active Stripe subscription (if any) — non-fatal on failure
// 2. Cascade-delete all user data from Supabase
// 3. Cascade-delete all user data from SQLite
router.delete('/account', authMiddleware, async (req, res) => {
  const userId = req.userId
  console.log('[deleteAccount] Starting deletion for userId:', userId)

  // ── Fetch user (need stripe_subscription_id) ──────────────────────────────
  let user = await getUserById(userId).catch(() => null)
  if (!user) user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ error: 'User not found' })

  // ── 1. Cancel Stripe subscription ────────────────────────────────────────
  const subId = user.stripe_subscription_id
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
    try {
      await sb.from('users').delete().eq('id', userId)
      console.log('[deleteAccount] Supabase user row deleted')
    } catch (err) {
      console.error('[deleteAccount] Supabase user delete failed:', err.message)
    }
  }

  // ── 3. SQLite cascade delete ──────────────────────────────────────────────
  try {
    // task_completions may reference tasks; delete via plan ownership
    const plans = db.prepare('SELECT id FROM action_plans WHERE user_id = ?').all(userId)
    for (const plan of plans) {
      try { db.prepare('DELETE FROM tasks WHERE plan_id = ?').run(plan.id) } catch {}
      try { db.prepare('DELETE FROM task_completions WHERE plan_id = ?').run(plan.id) } catch {}
    }
    // Also try direct user_id column in case schema differs
    try { db.prepare('DELETE FROM task_completions WHERE user_id = ?').run(userId) } catch {}
    db.prepare('DELETE FROM daily_checkins WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM streaks WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM action_plans WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM scans WHERE user_id = ?').run(userId)
    try { db.prepare('DELETE FROM leaderboard WHERE user_id = ?').run(userId) } catch {}
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    console.log('[deleteAccount] SQLite cleanup done')
  } catch (err) {
    console.error('[deleteAccount] SQLite cleanup error:', err.message)
  }

  console.log('[deleteAccount] Done for userId:', userId)
  res.json({ success: true })
})

module.exports = router
