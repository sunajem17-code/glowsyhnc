// ─────────────────────────────────────────────────────────────────────────────
// Supabase persistence routes
// All routes require JWT auth. Service key stays server-side only.
//
// In production the JWT userId IS the Supabase UUID (both paths in auth.js use
// the same UUID). We use req.userId directly instead of the old email-lookup
// chain that hit SQLite synchronously on every request.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express')
const { authMiddleware: auth } = require('../middleware/auth')
const { getSupabase, isConfigured, updateUserById } = require('../supabase')
const { calculatePotentialScore } = require('../utils/potentialScore')

const router = express.Router()

// Helper: 503 if Supabase not configured
function requireSupabase(res) {
  if (!isConfigured()) {
    res.status(503).json({ error: 'Supabase not configured — add SUPABASE_URL and SUPABASE_SERVICE_KEY to server/.env' })
    return false
  }
  return true
}

// Helper: turn a stored 'scan-images' bucket path into a usable signed URL.
// Returns null (not the raw path) if signing fails, so the client can fall
// back to its own placeholder instead of trying to render a bare path as
// an <img src>. Passes through unchanged if already a full URL.
const HISTORY_SIGNED_URL_EXPIRY_SECONDS = 3600
async function resolveImageUrl(sb, value) {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  try {
    const { data, error } = await sb.storage
      .from('scan-images')
      .createSignedUrl(value, HISTORY_SIGNED_URL_EXPIRY_SECONDS)
    if (error) {
      console.warn('[Supabase] Signed URL creation failed:', error.message)
      return null
    }
    return data.signedUrl
  } catch (err) {
    console.warn('[Supabase] Signed URL creation error (non-fatal):', err.message)
    return null
  }
}

// ── POST /supabase/scans ───────────────────────────────────────────────────────
// Save a completed scan + optional plan tasks in one call.
router.post('/scans', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    // req.userId is the Supabase UUID in production (same UUID used at registration)
    const sbUserId = req.userId

    const { faceImageUrl, hairstyleRec1, hairstyleRec2, hairstyleRec3 } = req.body
    const { ownedResult, latestOwnedResult, ownedImagePath } = require('../lib/coachScanContext')
    // Older clients omit scanId, so link only a recent server-generated result.
    // Browser-supplied scores and premium/status fields are never authoritative.
    const verified = req.body.scanId ? ownedResult(req.body.scanId, req.userId) : latestOwnedResult(req.userId)
    if (!verified) return res.status(404).json({ error: 'Completed server analysis not found. Please retry your scan.' })
    const image = ownedImagePath(faceImageUrl, req.userId) || ownedImagePath(verified.row.face_photo_url, req.userId) || null
    if (image) require('../db').prepare('UPDATE scans SET face_photo_url = ? WHERE id = ? AND user_id = ?').run(image, verified.row.id, req.userId)
    const result = verified.result

    // Insert scan
    const { data: scan, error: scanErr } = await sb
      .from('scans')
      .upsert({
        id: verified.row.id,
        user_id: sbUserId,
        overall_score: result.overallScore,
        tier: result.tier,
        face_score: result.faceScore,
        grooming_score: result.groomingScore,
        harmony: result.pillars?.harmony ?? null,
        angularity: result.pillars?.angularity ?? null,
        features: result.pillars?.features ?? null,
        dimorphism: result.pillars?.dimorphism ?? null,
        potential_score: result.potentialScore,
        face_image_url: image,
        hairstyle_recommendation_1: hairstyleRec1 ?? null,
        hairstyle_recommendation_2: hairstyleRec2 ?? null,
        hairstyle_recommendation_3: hairstyleRec3 ?? null,
        hair_type_detected: result.hairType ?? null,
        face_shape: result.facialStructure ?? null,
        extended_metrics: result.extendedMetrics ?? null,
      })
      .select('id')
      .single()

    if (scanErr) throw scanErr

    // Insert progress entry
    await sb.from('progress').insert({
      user_id:       sbUserId,
      scan_id:       scan.id,
      overall_score: result.overallScore,
      face_score:    result.faceScore,
    })

    // Save plan tasks if provided
    const { tasks } = req.body
    if (Array.isArray(tasks) && tasks.length) {
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
    res.status(500).json({ error: 'internal_error' })
  }
})

// ── GET /supabase/scans ────────────────────────────────────────────────────────
// Load all scans for the authenticated user.
router.get('/scans', auth, async (req, res) => {
  try {
    // Local development uses SQLite and device-saved ratings. Missing cloud
    // credentials must not turn every history refresh into a service failure.
    if (!isConfigured() && process.env.NODE_ENV !== 'production') {
      const { getLocalProgressHistory } = require('../utils/localProgressHistory')
      return res.json({ scans: getLocalProgressHistory(require('../db'), req.userId), source: 'local' })
    }
    if (!requireSupabase(res)) return
    const sb = getSupabase()
    const { data: scans, error } = await sb
      .from('scans')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // face_image_url / body_image_url are stored as private-bucket storage
    // paths (e.g. "scan/<uid>/<ts>.jpg"), not directly-usable URLs — the
    // 'scan-images' bucket is private with owner-only RLS, so every read
    // needs a freshly signed URL. Resolve them here so the client never has
    // to know about storage paths. A 1-hour expiry is plenty for a single
    // page view; if it's already a full URL (http/https), pass it through.
    const resolved = await Promise.all((scans ?? []).map(async (s) => ({
      ...s,
      // Older scan rows may predate Potential being returned by the scoring
      // endpoint. Backfill it in the server response using the same server-
      // owned derivation so existing reveal screens can recover the value.
      potential_score: s.potential_score ?? calculatePotentialScore(s.overall_score),
      face_image_url: await resolveImageUrl(sb, s.face_image_url),
      body_image_url: await resolveImageUrl(sb, s.body_image_url),
    })))

    res.json({ scans: resolved })
  } catch (err) {
    console.error('[Supabase] Load scans failed:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

// ── GET /supabase/progress ─────────────────────────────────────────────────────
// Load progress history for charts.
router.get('/progress', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const { data: progress, error } = await sb
      .from('progress')
      .select('*, scans(tier, body_category, created_at)')
      .eq('user_id', req.userId)
      .order('date', { ascending: true })

    if (error) throw error
    res.json({ progress: progress ?? [] })
  } catch (err) {
    console.error('[Supabase] Load progress failed:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

// ── PATCH /supabase/tasks/:id ──────────────────────────────────────────────────
// Toggle task completion. Uses Supabase task UUID.
router.patch('/tasks/:id', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const { isCompleted } = req.body

    const { data: updated, error } = await sb
      .from('plan_tasks')
      .update({
        is_completed: !!isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId) // ownership scope — prevents IDOR
      .select('id')

    if (error) throw error
    if (!updated?.length) return res.status(404).json({ error: 'Task not found' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[Supabase] Update task failed:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

// ── GET /supabase/tasks ────────────────────────────────────────────────────────
// Load current plan tasks for user.
router.get('/tasks', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const { data: tasks, error } = await sb
      .from('plan_tasks')
      .select('*')
      .eq('user_id', req.userId)
      .order('week_number', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json({ tasks: tasks ?? [] })
  } catch (err) {
    console.error('[Supabase] Load tasks failed:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

// ── GET /supabase/routine ─────────────────────────────────────────────────────
// Load the signed-in user's current scan-linked routine document.
router.get('/routine', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const { data, error } = await getSupabase()
      .from('routine_plans')
      .select('routine, face_scan_id, body_scan_id, updated_at')
      .eq('user_id', req.userId)
      .maybeSingle()
    if (error) throw error
    res.json({ routine: data?.routine ?? null, faceScanId: data?.face_scan_id ?? null, bodyScanId: data?.body_scan_id ?? null, updatedAt: data?.updated_at ?? null })
  } catch (err) {
    console.error('[Supabase] Load routine failed:', err.message)
    res.status(500).json({ error: 'Could not load your saved routine.' })
  }
})

// ── PUT /supabase/routine ─────────────────────────────────────────────────────
// Store plan + check-in state under the JWT user ID; never accept a user ID.
router.put('/routine', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  const routine = req.body?.routine
  if (!routine || typeof routine !== 'object' || Array.isArray(routine)) return res.status(400).json({ error: 'A routine document is required.' })
  let serialized
  try { serialized = JSON.stringify(routine) } catch { return res.status(400).json({ error: 'Routine data must be valid JSON.' }) }
  if (serialized.length > 250_000) return res.status(413).json({ error: 'Routine document is too large.' })
  const faceScanId = typeof req.body.faceScanId === 'string' ? req.body.faceScanId : null
  const bodyScanId = typeof req.body.bodyScanId === 'string' ? req.body.bodyScanId : null
  try {
    const sb = getSupabase()
    for (const scanId of [faceScanId, bodyScanId].filter(Boolean)) {
      const { data: ownedScan, error: scanError } = await sb.from('scans').select('id').eq('id', scanId).eq('user_id', req.userId).maybeSingle()
      if (scanError) throw scanError
      if (!ownedScan) return res.status(403).json({ error: 'Routine scans must belong to your account.' })
    }
    const { error } = await sb.from('routine_plans').upsert({
      user_id: req.userId,
      routine,
      face_scan_id: faceScanId,
      body_scan_id: bodyScanId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    console.error('[Supabase] Save routine failed:', err.message)
    res.status(500).json({ error: 'Could not save your routine.' })
  }
})

// ── PUT /supabase/user ─────────────────────────────────────────────────────────
// Update user profile fields (gender, phase, pro status, etc).
router.put('/user', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const allowed = ['gender', 'height_cm', 'weight_kg', 'hair_type', 'assigned_phase', 'goal_type', 'improvement_focus', 'ai_consent', 'consent_at']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    if (Object.keys(updates).length) {
      await updateUserById(req.userId, updates)
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[Supabase] Update user failed:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

// ── POST /supabase/upload-image ────────────────────────────────────────────────
// Upload a base64 image to Supabase Storage (private bucket).
// Returns a short-lived signed URL (60 s) — never a permanent public URL.
// The bucket must be set to Private in Supabase with owner-only RLS policies.
const SIGNED_URL_EXPIRY_SECONDS = 60

router.post('/upload-image', auth, async (req, res) => {
  if (!requireSupabase(res)) return
  try {
    const sb = getSupabase()
    const { imageData, mediaType, folder } = req.body
    if (!imageData) return res.status(400).json({ error: 'imageData (base64) required' })

    const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
    const mime = ALLOWED_MIME.includes(mediaType) ? mediaType : 'image/jpeg'

    const buffer = Buffer.from(imageData, 'base64')
    const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: 'Image too large — maximum 10 MB' })
    }

    const ext        = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
    const storagePath = `scan/${req.userId}/${Date.now()}.${ext}`

    const { error: uploadErr } = await sb.storage
      .from('scan-images')
      .upload(storagePath, buffer, { contentType: mime, upsert: false })

    if (uploadErr) throw uploadErr

    // Use a short-lived signed URL instead of a permanent public URL.
    // Never call getPublicUrl() — the bucket is private.
    const { data: signedData, error: signErr } = await sb.storage
      .from('scan-images')
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS)

    if (signErr) throw signErr

    // Return the storage path so callers can generate fresh signed URLs on demand.
    res.json({ url: signedData.signedUrl, path: storagePath })
  } catch (err) {
    console.error('[Supabase] Image upload failed:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

// ── GET /supabase/status ───────────────────────────────────────────────────────
// Health check: is Supabase configured and reachable? Auth required.
router.get('/status', auth, async (req, res) => {
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
