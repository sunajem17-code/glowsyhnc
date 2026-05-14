'use strict'
/**
 * Email Webhook Routes
 * All routes (except /track-click and /resend-events) require x-webhook-secret header
 */

const express = require('express')
const router  = express.Router()
const { createLimiter } = require('../middleware/ratelimit')
const { sendUpgradeNudge, sendWeeklyRecap, trackAffiliateClick } = require('../../ascendus-mailer')

// 20 clicks per IP per hour — prevents affiliate click spam
const clickLimiter = createLimiter('track-click', 20, '1 h', 60 * 60 * 1000)
const { createClient } = require('@supabase/supabase-js')

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const supabase = supabaseKey
  ? createClient(process.env.SUPABASE_URL, supabaseKey)
  : null

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  const secret = req.headers['x-webhook-secret']
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ── POST /webhooks/nudge-email ────────────────────────────────────────────────
router.post('/nudge-email', requireSecret, async (req, res) => {
  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  try {
    const result = await sendUpgradeNudge(user_id)
    return res.json(result)
  } catch (err) {
    console.error('nudge-email error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /webhooks/weekly-recap ───────────────────────────────────────────────
// Accepts { user_id } for single OR { batch: true, user_ids: [...] } for bulk
router.post('/weekly-recap', requireSecret, async (req, res) => {
  const { user_id, batch, user_ids } = req.body

  if (batch && Array.isArray(user_ids)) {
    // Batch mode — process sequentially with delay to respect rate limits
    const results = []
    for (const uid of user_ids) {
      try {
        const r = await sendWeeklyRecap(uid)
        results.push({ user_id: uid, ...r })
      } catch (err) {
        results.push({ user_id: uid, error: err.message })
      }
      await new Promise(r => setTimeout(r, 300)) // 300ms between sends
    }
    return res.json({ batch: true, results, total: results.length })
  }

  if (!user_id) return res.status(400).json({ error: 'user_id or batch+user_ids required' })

  try {
    const result = await sendWeeklyRecap(user_id)
    return res.json(result)
  } catch (err) {
    console.error('weekly-recap error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /webhooks/track-click — rate-limited (20/hr per IP) ─────────────────
router.post('/track-click', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
    const allowed = await clickLimiter(ip)
    if (!allowed) return res.status(429).json({ error: 'too_many_requests' })
    const { ref, source, campaign } = req.body
    const result = await trackAffiliateClick({ ref, source, campaign, ip })
    return res.json(result)
  } catch (err) {
    console.error('track-click error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /webhooks/run-daily-nudge — all-in-one: fetch users + send nudges ────
// Make.com calls this with just the webhook secret — no Supabase key needed
router.post('/run-daily-nudge', requireSecret, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('free_users_day3')
      .select('user_id')

    if (error) return res.status(500).json({ error: error.message })
    if (!users || users.length === 0) return res.json({ sent: 0, message: 'No eligible users' })

    const results = []
    for (const { user_id } of users) {
      try {
        const r = await sendUpgradeNudge(user_id)
        results.push({ user_id, ...r })
      } catch (err) {
        results.push({ user_id, error: err.message })
      }
      await new Promise(r => setTimeout(r, 300))
    }

    const sent    = results.filter(r => r.success).length
    const skipped = results.filter(r => r.skipped).length
    const failed  = results.filter(r => r.error).length
    console.log(`📧 Daily nudge run: ${sent} sent, ${skipped} skipped, ${failed} failed`)
    return res.json({ sent, skipped, failed, total: users.length, results })
  } catch (err) {
    console.error('run-daily-nudge error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /webhooks/resend-events — Resend webhook ─────────────────────────────
router.post('/resend-events', requireSecret, async (req, res) => {
  // Resend sends events like email.opened, email.clicked
  const event = req.body

  try {
    if (event.type === 'email.opened' || event.type === 'email.clicked') {
      const resendId = event.data?.email_id
      if (resendId) {
        const field = event.type === 'email.opened' ? 'opened' : 'clicked'
        await supabase
          .from('email_sends')
          .update({ [field]: true })
          .eq('resend_id', resendId)
      }
    }
    return res.json({ received: true })
  } catch (err) {
    console.error('resend-events error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
