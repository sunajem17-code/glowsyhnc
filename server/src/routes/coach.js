const express = require('express')
const { verifyToken, claudeLimit, resolvePro } = require('../middleware/claudeGate')
const db = require('../db')

const FREE_COACH_LIMIT = 3

const router = express.Router()

const { loadContext, clean } = require('../lib/coachScanContext')
const { answer } = require('../lib/coachIntelligence')

router.get('/context', verifyToken, resolvePro, claudeLimit, async (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Pro required — upgrade to access this feature' })
  try {
    const context = await loadContext(req.userId)
    res.json({ access: req.proSource || 'subscription', isPro: req.isPro, status: context.status, hasCompletedScan: !!context.latest, scanId: context.latest?.id ?? null })
  } catch { res.status(503).json({ error: 'Saved scan context is temporarily unavailable. Please retry.' }) }
})

// POST /api/coach/message
router.post('/message', verifyToken, resolvePro, claudeLimit, async (req, res) => {
  const { messages, conversationId } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' })
  }

  if (messages.length > 40 || messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 6000) || messages.at(-1).role !== 'user' || !messages.at(-1).content.trim()) {
    return res.status(400).json({ error: 'Invalid conversation messages' })
  }

  // Free users: enforce 3-message lifetime limit (tracked server-side)
  if (!req.isPro && !req.isDemo) {
    const row = db.prepare('SELECT coach_messages_used FROM users WHERE id = ?').get(req.userId)
    const used = row?.coach_messages_used ?? 0
    if (used >= FREE_COACH_LIMIT) {
      return res.status(403).json({ error: 'Pro required — upgrade to access this feature' })
    }
    db.prepare('UPDATE users SET coach_messages_used = coach_messages_used + 1 WHERE id = ?').run(req.userId)
  }

  // Demo users: block entirely
  if (req.isDemo) {
    return res.status(403).json({ error: 'Pro required — upgrade to access this feature' })
  }

  try {
    // The last user message is new input; prior assistant turns come only from
    // this user's bounded server session, not client-forged conversation data.
    const context = await loadContext(req.userId)
    const preferences = {}
    for (const key of ['goal', 'goal_type', 'improvement_focus', 'hairType']) {
      if (typeof req.body.preferences?.[key] === 'string') preferences[key] = req.body.preferences[key].slice(0, 300)
    }
    const result = await answer({ userId: req.userId, conversationId,
      question: messages.at(-1).content, context, isPro: req.isPro, preferences: clean(preferences) })
    res.json(result)
  } catch (err) {
    console.error('[coach] Request failed', { status: err.status || 503 })
    if (err.status === 409) return res.status(409).json({ error: 'A coach reply is already in progress. Please wait.' })
    res.status(503).json({ error: 'Adonis could not load your scan or complete this reply. Please retry. Your results have not been replaced.' })
  }
})

module.exports = router
