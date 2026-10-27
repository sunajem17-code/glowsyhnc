const crypto = require('node:crypto')
const db = require('../db')
const { getSupabase } = require('../supabase')

const KIND = 'server_analysis_v1'
const timeout = (promise, ms = 8000) => {
  let timer
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Scan data request timed out')), ms) })]).finally(() => clearTimeout(timer))
}
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return null } }
const clean = value => {
  if (typeof value === 'string') return value.slice(0, 1200)
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean' || value == null) return value
  if (Array.isArray(value)) return value.slice(0, 30).map(clean)
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 50).filter(([key]) => !/url|imagePath|imageData|base64|token|secret/i.test(key)).map(([key, val]) => [key, clean(val)]))
  return null
}

// The existing scans table already has a JSON face_data field and completion
// timestamp. Store server output here; never reconstruct authority from a
// browser-supplied score or scanContext.
function startScan(userId) {
  if (!userId || userId === 'demo') return null
  const id = crypto.randomUUID()
  db.prepare('INSERT INTO scans (id, user_id, scan_date, face_data) VALUES (?, ?, ?, ?)')
    .run(id, userId, new Date().toISOString(), JSON.stringify({ kind: KIND, status: 'processing' }))
  return id
}
async function finishScan(id, userId, result) {
  if (!id) return result
  const completedAt = new Date().toISOString()
  const updated = db.prepare(`UPDATE scans SET face_data = ?, glow_score = ?, face_total_score = ?, presentation_score = ?, insights = ?, analyzed_at = ? WHERE id = ? AND user_id = ?`)
    .run(JSON.stringify({ kind: KIND, status: 'completed', result }), result.overallScore, result.faceScore, result.groomingScore,
      JSON.stringify({ strengths: result.keyStrengths, improvements: result.keyWeaknesses, recommendation: result.topImprovement }), completedAt, id, userId)
  if (updated.changes !== 1) throw new Error('Completed scan could not be saved')
  require('./appearanceDiagnostics').recordAppearanceCounts('scan_saved_local', result.appearanceAnalysis?.strengths, result.appearanceAnalysis?.improvementOpportunities)
  // Cloud summary persistence is handled by the existing save route. Local
  // server history is available immediately, before its asynchronous upload.
  return { ...result, scanId: id }
}
function failScan(id, userId) {
  if (id) db.prepare('UPDATE scans SET face_data = ? WHERE id = ? AND user_id = ?')
    .run(JSON.stringify({ kind: KIND, status: 'failed' }), id, userId)
}
function ownedResult(id, userId) {
  const row = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(id, userId)
  const data = parse(row?.face_data)
  return data?.kind === KIND && data.status === 'completed' ? { row, result: data.result } : null
}

// A selected scan can outlive the server instance that created its local
// analysis row. Resolve that same scan from the authenticated user's cloud
// history when the local row is gone; never substitute another scan.
async function ownedCoachScan(id, userId) {
  const local = ownedResult(id, userId)
  if (local) return { scan: normalize(local.row), result: local.result, row: local.row }

  // Legacy local rows predate the server_analysis_v1 envelope. Keep the
  // owner-scoped row available for photo reanalysis without rewriting its
  // original scores or history.
  const legacyRow = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(id, userId)
  const legacyData = parse(legacyRow?.face_data)
  if (legacyRow && legacyData && (legacyData.status == null || legacyData.status === 'completed')) {
    const scan = normalize(legacyRow)
    if (scan) return { scan, result: legacyData.result || legacyData, row: legacyRow }
  }

  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await timeout(supabase.from('scans').select('*')
    .eq('id', id).eq('user_id', userId).maybeSingle())
  if (error) throw new Error('Selected scan lookup failed')
  if (!data || String(data.user_id) !== String(userId)) return null
  const scan = normalize(data)
  return scan ? { scan, result: null, row: data } : null
}

function latestOwnedResult(userId) {
  const rows = db.prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY scan_date DESC LIMIT 12').all(userId)
  const row = rows.find(row => parse(row.face_data)?.kind === KIND && parse(row.face_data)?.status === 'completed')
  if (!row || Date.now() - Date.parse(row.analyzed_at) > 15 * 60 * 1000) return null
  return { row, result: parse(row.face_data).result }
}

function normalize(row) {
  const data = parse(row.face_data)
  if (data?.kind === KIND && data.status !== 'completed') return null
  const result = data?.kind === KIND ? data.result : (data?.result && typeof data.result === 'object' ? data.result : data)
  const extendedMetrics = parse(row.extended_metrics)
  const score = result?.overallScore ?? row.overall_score ?? row.glow_score
  if (score == null || !Number.isFinite(Number(score))) return null
  const legacyFace = data?.kind === KIND ? null : result
  const bodyData = parse(row.body_data)
  return {
    id: row.id, completedAt: row.analyzed_at || row.created_at || row.scan_date,
    scores: clean({ overall: Number(score), face: result?.faceScore ?? row.face_score ?? row.face_total_score,
      grooming: result?.groomingScore ?? row.grooming_score ?? row.presentation_score,
      pillars: result?.pillars ?? { harmony: row.harmony, angularity: row.angularity, features: row.features, dimorphism: row.dimorphism },
      faceSubScores: result?.faceSubScores ?? legacyFace }),
    measurements: clean(result?.evidenceSummary?.measurements),
    profileMeasurements: clean(result?.evidenceSummary?.profile),
    measurementStatus: clean(result?.evidenceSummary?.status),
    notAssessable: clean(result?.evidenceSummary?.notAssessable),
    measurementLimitations: clean(result?.evidenceSummary?.limitations),
    observations: clean(result?.visualObservations), faceMetrics: clean(result?.faceMetrics),
    appearanceAnalysis: clean(result?.appearanceAnalysis ?? extendedMetrics?.appearanceAnalysis ?? legacyFace?.appearanceAnalysis),
    strengths: clean(result?.keyStrengths), improvements: clean(result?.keyWeaknesses),
    recommendation: clean(result?.topImprovement),
    hairType: clean(result?.hairType ?? row.hair_type_detected),
    savedHairstyleRecommendations: clean([row.hairstyle_recommendation_1, row.hairstyle_recommendation_2, row.hairstyle_recommendation_3].filter(Boolean)),
    profile: clean(result?.profileData),
    physique: clean(result?.physiqueScore ?? bodyData?.physiqueScore ?? bodyData?.physique_score ?? bodyData?.physiqueResult ?? bodyData),
    extendedMetrics: clean(result?.extendedMetrics ?? extendedMetrics),
    source: result ? 'saved_analysis' : 'legacy_saved_summary',
    // Kept internal, excluded from the prompt and response metadata.
    imagePath: row.face_image_url || row.face_photo_url || null,
  }
}

async function loadContext(userId, { database = db, supabase = getSupabase() } = {}) {
  if (!userId || userId === 'demo') throw new Error('Authenticated scan owner required')
  const local = database.prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY scan_date DESC LIMIT 12').all(userId)
  let remote = [], profile = null
  if (supabase) {
    const [scans, user] = await timeout(Promise.all([
      supabase.from('scans').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    ]))
    if (scans.error || user.error) throw new Error('Saved scan context is temporarily unavailable')
    remote = scans.data || []; profile = user.data ? Object.fromEntries(['goal_type', 'improvement_focus', 'hair_type', 'gender', 'ai_consent'].map(key => [key, user.data[key]])) : null
  }
  // Defense in depth even when a service-role query implementation changes.
  const rows = [...local, ...remote].filter(row => String(row.user_id) === String(userId))
  const byId = new Map()
  for (const row of rows) {
    const scan = normalize(row)
    if (!scan) continue
    const existing = byId.get(scan.id)
    if (!existing) byId.set(scan.id, scan)
    else { if (scan.source === 'saved_analysis' && existing.source !== 'saved_analysis') byId.set(scan.id, { ...scan, imagePath: scan.imagePath || existing.imagePath }); else if (!existing.imagePath) existing.imagePath = scan.imagePath }
  }
  const scans = [...byId.values()].sort((a, b) => (Date.parse(b.completedAt) || 0) - (Date.parse(a.completedAt) || 0)).slice(0, 3)
  const newest = local.find(row => parse(row.face_data)?.kind === KIND)
  const pending = parse(newest?.face_data)?.status === 'processing'
  const age = Date.now() - Date.parse(newest?.scan_date)
  const status = pending && age < 180000 ? 'processing' : scans.length ? 'completed' : pending ? 'failed' : 'no_scan'
  return { status, latest: scans[0] || null, previous: scans.slice(1), profile: clean(profile),
    imageConsent: profile?.ai_consent === true, supabase }
}

function publicContext(context, isPro) {
  function view(scan) {
    if (!scan) return null
    const { imagePath, ...data } = scan
    if (!isPro) {
      delete data.scores; delete data.faceMetrics; delete data.extendedMetrics; delete data.profile; delete data.physique
      if (data.appearanceAnalysis) {
        const stripReferences = findings => Array.isArray(findings)
          ? findings.map(({ scoreReferences, ...finding }) => finding)
          : findings
        data.appearanceAnalysis = {
          ...data.appearanceAnalysis,
          strengths: stripReferences(data.appearanceAnalysis.strengths),
          improvementOpportunities: stripReferences(data.appearanceAnalysis.improvementOpportunities),
          positiveObservations: stripReferences(data.appearanceAnalysis.positiveObservations),
        }
      }
    }
    return data
  }
  return { status: context.status, latest: view(context.latest), previous: context.previous.map(view), goals: context.profile }
}

function ownedImagePath(path, userId) {
  if (typeof path !== 'string') return null
  const parts = path.split('/')
  return parts.length === 3 && parts[0] === 'scan' && parts[1] === String(userId) && /^[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i.test(parts[2]) ? path : null
}

// No remote URL fetch: only a private bucket path owned by this JWT user.
// Supabase Storage transforms keep vision input small; unsupported transforms
// fail into structured-only coaching rather than sending the original image.
async function imageForScan(context, userId, providedImage = null, explicitlyRequested = false) {
  if (providedImage) return providedImage
  const path = context.latest?.imagePath
  if ((!context.imageConsent && !explicitlyRequested) || !context.supabase || !ownedImagePath(path, userId)) return null
  const { data, error } = await timeout(context.supabase.storage.from('scan-images').download(path, { transform: { width: 768, height: 768, resize: 'contain' } }))
  if (error || !data || data.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(data.type)) throw new Error('Scan image unavailable')
  return { type: 'image', source: { type: 'base64', media_type: data.type, data: Buffer.from(await data.arrayBuffer()).toString('base64') } }
}

function parseProvidedImage(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i)
  if (!match) return null
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > 1024 * 1024) return null
  return { type: 'image', source: { type: 'base64', media_type: match[1].toLowerCase(), data: buffer.toString('base64') } }
}

module.exports = { startScan, finishScan, failScan, ownedResult, ownedCoachScan, latestOwnedResult, loadContext, publicContext, imageForScan, parseProvidedImage, ownedImagePath, normalize, clean, timeout }
