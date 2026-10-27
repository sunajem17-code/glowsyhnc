const express = require('express')
const { verifyToken, claudeLimit, resolvePro } = require('../middleware/claudeGate')
const db = require('../db')

const FREE_COACH_LIMIT = 3

const router = express.Router()

const { loadContext, clean, ownedCoachScan, parseProvidedImage } = require('../lib/coachScanContext')
const { answer } = require('../lib/coachIntelligence')

router.get('/context', verifyToken, resolvePro, claudeLimit, async (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Pro required — upgrade to access this feature' })
  try {
    const context = await loadContext(req.userId)
    res.json({ access: req.proSource || 'subscription', isPro: req.isPro, status: context.status, hasCompletedScan: !!context.latest, scanId: context.latest?.id ?? null })
  } catch { res.status(503).json({ error: 'Saved scan context is temporarily unavailable. Please retry.' }) }
})

// On-demand enrichment of an owned completed scan; never delays capture/scoring.
async function serveSavedAppearance(req, res, next) {
  if (req.isDemo) return next()
  if (typeof req.body.scanId !== 'string' || req.body.scanId.length > 100) return next()
  try {
    const saved = await ownedCoachScan(req.body.scanId, req.userId)
    if (!saved) return next()
    const { cachedBreakdown } = require('../lib/appearanceBreakdown')
    const analysis = cachedBreakdown(saved.result || { appearanceAnalysis: saved.scan.appearanceAnalysis }, req.body.scanId)
    if (analysis) {
      require('../lib/appearanceDiagnostics').recordAppearanceCounts('saved_analysis_loaded', analysis.strengths, analysis.improvementOpportunities)
      return res.json({ analysis })
    }
    return next()
  } catch {
    return res.status(503).json({ error: 'Your saved scan could not be loaded. Please retry.' })
  }
}

router.post('/appearance', verifyToken, resolvePro, serveSavedAppearance, claudeLimit, async (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign in to analyze your saved scan.' })
  if (typeof req.body.scanId !== 'string' || req.body.scanId.length > 100) return res.status(400).json({ error: 'A saved scan ID is required.' })
  try {
    const { getBreakdown } = require('../lib/appearanceBreakdown')
    res.json({ analysis: await getBreakdown(req.userId, req.body.scanId) })
  } catch (err) {
    if (err.code === 'monthly_ai_budget_reached' || err.code === 'monthly_ai_budget_unavailable') {
      return res.status(err.status || 503).json({ error: err.code })
    }
    res.status([404, 422].includes(err.status) ? err.status : 503).json({ error: [404, 422].includes(err.status) ? err.message : 'Your appearance analysis could not be completed. Please retry. Your scan is safe.' })
  }
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
    if (typeof req.body.scanId === 'string') {
      const selected = await ownedCoachScan(req.body.scanId, req.userId)
      if (!selected) return res.status(404).json({ error: 'The selected scan is unavailable. Return to your results and retry.' })
      const scan = selected.scan
      context.previous = [context.latest, ...context.previous].filter(row => row && row.id !== scan.id).slice(0, 2)
      context.latest = scan
      context.status = 'completed'
    }
    const providedImage = parseProvidedImage(req.body.scanPhotoData)
    if (req.body.scanPhotoData && !providedImage) return res.status(400).json({ error: 'The attached scan photo must be a supported image under 1 MB.' })
    const preferences = {}
    for (const key of ['goal', 'goal_type', 'improvement_focus', 'hairType']) {
      if (typeof req.body.preferences?.[key] === 'string') preferences[key] = req.body.preferences[key].slice(0, 300)
    }
    const result = await answer({ userId: req.userId, conversationId,
      question: messages.at(-1).content, context, isPro: req.isPro,
      includeScanPhoto: req.body.includeScanPhoto === true || typeof req.body.scanId === 'string',
      providedImage,
      preferences: clean(preferences) })
    res.json(result)
  } catch (err) {
    console.error('[coach] Request failed', { status: err.status || 503 })
    if (err.code === 'monthly_ai_budget_reached' || err.code === 'monthly_ai_budget_unavailable') {
      return res.status(err.status || 503).json({ error: err.code })
    }
    if (err.status === 409) return res.status(409).json({ error: 'A coach reply is already in progress. Please wait.' })
    res.status(503).json({ error: 'Adonis could not load your scan or complete this reply. Please retry. Your results have not been replaced.' })
  }
})

module.exports = router
