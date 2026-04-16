// ─────────────────────────────────────────────────────────────────────────────
// Supabase persistence routes
// All routes require JWT auth. Service key stays server-side only.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express')
const { authMiddleware: auth } = require('../middleware/auth')
const { getSupabase, getOrCreateUser, isConfigured } = require('../supabase')
const db = require('../db')

const router = express.Router()

// Helper: get user email from SQLite by JWT userId
function getUserEmail(userId) {
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId)
  return row?.email ?? null
}

// Helper: 503 if Supabase not configured
function requireSupabase(res) {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Supabase not configured — add SUPABASE_URL and SUPABASE_SERVICE_KEY to server/.env' })
    return false
  }
  return true
}

// ── POST /supabase/scans ───────────────────────────────────────────────────────
// Save a completed scan + optional plan tasks in one call.
router.post('/scans', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const email = getUserEmail(req.userId)
    if (!email) return res.status(404).json({ error: 'User not found' })

    const sbUserId = await getOrCreateUser(email, { gender: req.body.gender })
    if (!sbUserId) return res.status(500).json({ error: 'Failed to sync user to Supabase' })

    const {
      overallScore, tier, faceScore, bodyScore, bodyCategory, groomingScore,
      harmony, angularity, features, dimorphism, potentialScore,
      celebrityMatches, faceImageUrl, bodyImageUrl,
      bodyFatEstimate, shoulderWaistRatio, postureGrade,
      hairstyleRec1, hairstyleRec2, hairstyleRec3,
      hairTypeDetected, faceShape,
    } = req.body

    // Insert scan
    const { data: scan, error: scanErr } = await sb
      .from('scans')
      .insert({
        user_id:                     sbUserId,
        overall_score:               overallScore,
        tier,
        face_score:                  faceScore,
        body_score:                  bodyScore,
        body_category:               bodyCategory,
        grooming_score:              groomingScore,
        harmony,
        angularity,
        features,
        dimorphism,
        potential_score:             potentialScore,
        celebrity_match_1:           celebrityMatches?.[0]?.celebrity   ?? null,
        celebrity_match_1_similarity: celebrityMatches?.[0]?.similarity ?? null,
        celebrity_match_2:           celebrityMatches?.[1]?.celebrity   ?? null,
        celebrity_match_2_similarity: celebrityMatches?.[1]?.similarity ?? null,
        celebrity_match_3:           celebrityMatches?.[2]?.celebrity   ?? null,
        celebrity_match_3_similarity: celebrityMatches?.[2]?.similarity ?? null,
        face_image_url:              faceImageUrl  ?? null,
        body_image_url:              bodyImageUrl  ?? null,
        body_fat_estimate:           bodyFatEstimate ?? null,
        shoulder_waist_ratio:        shoulderWaistRatio ?? null,
        posture_grade:               postureGrade  ?? null,
        hairstyle_recommendation_1:  hairstyleRec1 ?? null,
        hairstyle_recommendation_2:  hairstyleRec2 ?? null,
        hairstyle_recommendation_3:  hairstyleRec3 ?? null,
        hair_type_detected:          hairTypeDetected ?? null,
        face_shape:                  faceShape     ?? null,
      })
      .select('id')
      .single()

    if (scanErr) throw scanErr

    // Insert progress entry
    await sb.from('progress').insert({
      user_id:       sbUserId,
      scan_id:       scan.id,
      overall_score: overallScore,
      body_score:    bodyScore,
      face_score:    faceScore,
    })

    // Save plan tasks if provided
    const { tasks } = req.body
    if (Array.isArray(tasks) && tasks.length) {
      // Replace this user's tasks with the new plan
      await sb.from('plan_tasks').delete().eq('user_id', sbUserId)
      const rows = tasks.map(t => ({
        user_id:      sbUserId,
        week_number:  t.weekNumber ?? t.week ?? null,
        task_name:    t.title ?? t.task_name ?? '',
        category:     t.category ?? null,
        duration:     t.duration ?? null,
        frequency:    t.frequency ?? null,
        pillar:       t.pillar ?? null,
        is_completed: !!(t.completed),
      }))
      const { error: tasksErr } = await sb.from('plan_tasks').insert(rows)
      if (tasksErr) console.warn('[Supabase] Tasks insert warning:', tasksErr.message)
    }

    // Update user profile fields
    const profileUpdates = {}
    if (req.body.gender) profileUpdates.gender = req.body.gender
    if (req.body.assignedPhase) profileUpdates.assigned_phase = req.body.assignedPhase
    if (Object.keys(profileUpdates).length) {
      await sb.from('users').update(profileUpdates).eq('id', sbUserId)
    }

    console.log('[Supabase] Scan saved:', scan.id)
    res.json({ scanId: scan.id, userId: sbUserId })
  } catch (err) {
    console.error('[Supabase] Save scan failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /supabase/scans ────────────────────────────────────────────────────────
// Load all scans for the authenticated user.
router.get('/scans', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const email = getUserEmail(req.userId)
    if (!email) return res.status(404).json({ error: 'User not found' })

    const { data: sbUser } = await sb
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!sbUser) return res.json({ scans: [] })

    const { data: scans, error } = await sb
      .from('scans')
      .select('*')
      .eq('user_id', sbUser.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ scans: scans ?? [] })
  } catch (err) {
    console.error('[Supabase] Load scans failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /supabase/progress ─────────────────────────────────────────────────────
// Load progress history for charts.
router.get('/progress', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const email = getUserEmail(req.userId)
    if (!email) return res.status(404).json({ error: 'User not found' })

    const { data: sbUser } = await sb
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!sbUser) return res.json({ progress: [] })

    const { data: progress, error } = await sb
      .from('progress')
      .select('*, scans(tier, body_category, created_at)')
      .eq('user_id', sbUser.id)
      .order('date', { ascending: true })

    if (error) throw error
    res.json({ progress: progress ?? [] })
  } catch (err) {
    console.error('[Supabase] Load progress failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /supabase/tasks/:id ──────────────────────────────────────────────────
// Toggle task completion. Uses Supabase task UUID.
router.patch('/tasks/:id', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const { isCompleted } = req.body

    const { error } = await sb
      .from('plan_tasks')
      .update({
        is_completed: !!isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    console.error('[Supabase] Update task failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /supabase/tasks ────────────────────────────────────────────────────────
// Load current plan tasks for user.
router.get('/tasks', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const email = getUserEmail(req.userId)
    if (!email) return res.status(404).json({ error: 'User not found' })

    const { data: sbUser } = await sb
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!sbUser) return res.json({ tasks: [] })

    const { data: tasks, error } = await sb
      .from('plan_tasks')
      .select('*')
      .eq('user_id', sbUser.id)
      .order('week_number', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json({ tasks: tasks ?? [] })
  } catch (err) {
    console.error('[Supabase] Load tasks failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /supabase/user ─────────────────────────────────────────────────────────
// Update user profile fields (gender, phase, pro status, etc).
router.put('/user', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const email = getUserEmail(req.userId)
    if (!email) return res.status(404).json({ error: 'User not found' })

    const sbUserId = await getOrCreateUser(email)
    if (!sbUserId) return res.status(500).json({ error: 'Failed to sync user' })

    const allowed = ['gender', 'height_cm', 'weight_kg', 'hair_type', 'assigned_phase', 'goal_type', 'improvement_focus', 'ai_consent', 'consent_at']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    if (Object.keys(updates).length) {
      const { error } = await sb.from('users').update(updates).eq('id', sbUserId)
      if (error) throw error
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[Supabase] Update user failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /supabase/upload-image ────────────────────────────────────────────────
// Upload a base64 image to Supabase Storage. Returns the public URL.
router.post('/upload-image', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const { imageData, mediaType, folder } = req.body
    if (!imageData) return res.status(400).json({ error: 'imageData (base64) required' })

    const buffer  = Buffer.from(imageData, 'base64')
    const ext     = (mediaType || '').includes('png') ? 'png' : 'jpg'
    const path    = `${folder ?? 'scan'}/${req.userId}/${Date.now()}.${ext}`
    const mime    = mediaType || 'image/jpeg'

    const { error: uploadErr } = await sb.storage
      .from('scan-images')
      .upload(path, buffer, { contentType: mime, upsert: false })

    if (uploadErr) throw uploadErr

    const { data: { publicUrl } } = sb.storage
      .from('scan-images')
      .getPublicUrl(path)

    res.json({ url: publicUrl })
  } catch (err) {
    console.error('[Supabase] Image upload failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /supabase/status ───────────────────────────────────────────────────────
// Health check: is Supabase configured and reachable?
router.get('/status', async (req, res) => {
  if (!isConfigured()) {
    return res.json({ configured: false, message: 'Add SUPABASE_URL and SUPABASE_SERVICE_KEY to server/.env' })
  }
  try {
    const sb = getSupabase()
    const { error } = await sb.from('users').select('id').limit(1)
    if (error) throw error
    res.json({ configured: true, connected: true })
  } catch (err) {
    res.json({ configured: true, connected: false, error: err.message })
  }
})

module.exports = router
