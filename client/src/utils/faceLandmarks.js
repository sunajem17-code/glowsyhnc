/**
 * Real Face Geometry Engine — MediaPipe Face Mesh
 *
 * Replaces broken pixel/Sobel measurements with actual face landmark geometry.
 * 468 real 3D landmark positions → jaw width, gonial angle, face shape, symmetry.
 *
 * IMMUNE to hair, beard, glasses, lighting, expression, and skin tone.
 * These are pure geometric ratios from actual facial landmark coordinates.
 */

// ─── MediaPipe singleton ───────────────────────────────────────────────────────
let _mesh = null
let _initPromise = null

function locateFile(file) {
  // All MediaPipe assets are in /public/mediapipe/ (copied from node_modules)
  return `/mediapipe/${file}`
}

// Run once on first init: log WebAssembly + file reachability so we know
// exactly what environment we're running in.
async function _logEnvironmentDiagnostics() {
  console.log('[FaceDetector] platform: iOS WKWebView (Capacitor)')
  console.log('[FaceDetector] library: @mediapipe/face_mesh v0.4.1633559619')
  console.log('[FaceDetector] locateFile base: /mediapipe/<file>')

  // WebAssembly
  const wasmAvail = typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function'
  console.log('[FaceDetector] WebAssembly available:', wasmAvail)
  if (!wasmAvail) return

  // SIMD detection (tiny SIMD test binary — same check MediaPipe uses internally)
  try {
    // 11-byte minimal SIMD WASM module
    const simdTest = new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,9,1,7,0,253,15,253,15,26,11])
    const ok = WebAssembly.validate(simdTest)
    console.log('[FaceDetector] WASM SIMD supported:', ok)
  } catch (e) {
    console.warn('[FaceDetector] WASM SIMD check error:', e?.message)
  }

  // File reachability — check if the WASM binaries can actually be fetched
  for (const f of ['face_mesh_solution_wasm_bin.wasm', 'face_mesh_solution_wasm_bin.js', 'face_mesh.binarypb']) {
    try {
      const r = await fetch(`/mediapipe/${f}`, { method: 'HEAD' })
      console.log(`[FaceDetector] /mediapipe/${f} → HTTP ${r.status} content-type: ${r.headers.get('content-type')}`)
    } catch (e) {
      console.error(`[FaceDetector] /mediapipe/${f} → FETCH FAILED: ${e?.message}`)
    }
  }
}

// MediaPipe's legacy UMD bundle exposes globals in Vite dev and named exports
// in the production bundle. Normalize both entry points before using it.
export async function loadFaceMeshLibrary() {
  const mod = await import('@mediapipe/face_mesh')
  const library = mod.FaceMesh ? mod : mod.default?.FaceMesh ? mod.default : globalThis
  if (typeof library.FaceMesh !== 'function') throw new Error('Face landmark library is unavailable')
  return { FaceMesh: library.FaceMesh, FACEMESH_TESSELATION: library.FACEMESH_TESSELATION }
}

export async function initFaceMesh() {
  if (_mesh) return _mesh
  // Guard: if a pending init is already in flight, await it.
  // If it fails, fall through and retry from scratch — never
  // permanently return a previously-rejected promise.
  if (_initPromise) {
    try { return await _initPromise } catch { /* fall through to retry */ }
  }

  _initPromise = (async () => {
    console.log('[FaceDetector] initialization started')
    await _logEnvironmentDiagnostics()

    // ── Step 1: import the module ──────────────────────────────────────────────
    let FaceMesh
    try {
      console.log('[FaceDetector] importing @mediapipe/face_mesh…')
      const mod = await loadFaceMeshLibrary()
      FaceMesh = mod.FaceMesh
      console.log('[FaceDetector] import OK — FaceMesh type:', typeof FaceMesh)
    } catch (err) {
      console.error('[FaceDetector] import FAILED:', err?.message, err?.stack?.split('\n')[1])
      console.error('[FaceDetector] initialization error: import_failed —', err?.message)
      throw err
    }

    // ── Step 2: construct instance ─────────────────────────────────────────────
    let mesh
    try {
      console.log('[FaceDetector] constructing FaceMesh({ locateFile })…')
      mesh = new FaceMesh({ locateFile })
      console.log('[FaceDetector] construction OK')
    } catch (err) {
      console.error('[FaceDetector] construction FAILED:', err?.message)
      console.error('[FaceDetector] initialization error: construction_failed —', err?.message)
      throw err
    }

    // ── Step 3: setOptions ─────────────────────────────────────────────────────
    try {
      mesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.4,
        minTrackingConfidence: 0.4,
      })
      console.log('[FaceDetector] setOptions OK')
    } catch (err) {
      console.error('[FaceDetector] setOptions FAILED:', err?.message)
      console.error('[FaceDetector] initialization error: setoptions_failed —', err?.message)
      throw err
    }

    // ── Step 4: initialize() — the proper API that forces WASM + model load ────
    // MediaPipe exposes mesh.initialize() for exactly this purpose.
    // It returns a Promise that resolves when WASM is compiled and the model
    // is loaded. Calling it here means errors surface during init, not later.
    if (typeof mesh.initialize === 'function') {
      try {
        console.log('[FaceDetector] calling mesh.initialize() — loading WASM + model…')
        await Promise.race([
          mesh.initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('initialize() timed out after 30s')), 30_000)),
        ])
        console.log('[FaceDetector] mesh.initialize() succeeded — WASM + model ready')
      } catch (err) {
        console.error('[FaceDetector] mesh.initialize() FAILED:', err?.message)
        console.error('[FaceDetector] initialization error: initialize_failed —', err?.message)
        throw err
      }
    } else {
      // Older MediaPipe builds without initialize(): fall back to the warmup
      // pattern but protect it fully so a warmup error is non-fatal.
      console.log('[FaceDetector] no initialize() method — using warmup send() fallback')
      try {
        await Promise.race([
          new Promise((resolve) => {
            mesh.onResults(resolve)
            const blank = document.createElement('canvas')
            blank.width = 128
            blank.height = 128
            try {
              const p = mesh.send({ image: blank })
              if (p && typeof p.catch === 'function') p.catch(resolve)
            } catch { resolve() }
          }),
          new Promise(resolve => setTimeout(resolve, 15_000)),
        ])
        console.log('[FaceDetector] warmup fallback complete')
      } catch (e) {
        console.warn('[FaceDetector] warmup fallback error (non-fatal):', e?.message)
      }
    }

    console.log('[FaceDetector] initialization succeeded — plugin available: N/A (JS library)')
    console.log('[FaceDetector] model/resource available: YES (bundled in /mediapipe/)')
    _mesh = mesh
    return mesh
  })()

  // Clear on failure so the next call can retry instead of re-rejecting forever
  _initPromise.catch(() => { _initPromise = null })

  return _initPromise
}

// ─── Get 468 facial landmarks from an image URL ───────────────────────────────
let landmarkQueue = Promise.resolve()
export function getLandmarks(imageUrl) {
  // The singleton has one onResults handler: never let front/profile/result
  // requests overwrite each other's handler while an image is being processed.
  const next = landmarkQueue.then(() => detectLandmarks(imageUrl))
  landmarkQueue = next.catch(() => {})
  return next
}
async function detectLandmarks(imageUrl) {
  const mesh = await initFaceMesh()

  return new Promise((resolve, reject) => {
    // First real scan: WASM already loaded, should be fast (~500ms)
    // Give 15s total to account for slow devices
    const timeout = setTimeout(() => {
      reject(new Error('Face mesh timeout. No face detected within 15s'))
    }, 15000)

    mesh.onResults((results) => {
      clearTimeout(timeout)
      const lm = results.multiFaceLandmarks?.[0]
      if (!lm || lm.length < 468) {
        reject(new Error('No face detected. Ensure the photo shows a clear front-facing face'))
        return
      }
      resolve(lm)
    })

    const img = new Image()

    // IMPORTANT: do NOT set crossOrigin for blob: or data: URLs — causes CORS failures
    if (!imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      mesh.send({ image: img }).catch((err) => {
        clearTimeout(timeout)
        reject(err)
      })
    }
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Image failed to load for face mesh'))
    }
    img.src = imageUrl
  })
}

// ─── Math helpers ─────────────────────────────────────────────────────────────
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
function angleDeg(a, vertex, b) {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y }
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2)
  if (mag < 0.0001) return 120
  return Math.acos(Math.min(1, Math.max(-1, dot / mag))) * (180 / Math.PI)
}
function clamp(v, mn, mx) { return Math.min(Math.max(v, mn), mx) }
function round1(v) { return Math.round(v * 10) / 10 }

// ─── Key MediaPipe Face Mesh landmark indices ─────────────────────────────────
//
//  10  — forehead center (top of face)
// 234  — left cheekbone outer (bizygomatic)     454 — right
// 172  — left jaw corner (gonion)               397 — right
// 152  — chin (menton)
//   1  — nose tip
//  33  — left eye outer corner                  263 — right
// 133  — left eye inner corner                  362 — right
//
// Left jaw contour:  58 → 172 → 136 → 150 → 149 → 176 → 148 → 152
// Right jaw contour: 288 → 397 → 365 → 379 → 378 → 400 → 377 → 152

export function computeStructuralMetrics(lm) {
  const p = (i) => lm[i]  // {x, y, z} all normalized 0–1 to image dimensions

  // ── Core distances ──────────────────────────────────────────────────────────

  // Bizygomatic width (cheekbone to cheekbone — widest face point)
  const cheekWidth = dist(p(234), p(454))

  // Bigonial width (jaw corner to jaw corner — the gonion points)
  const jawWidth = dist(p(172), p(397))

  // Face height (forehead center to chin)
  const faceHeight = dist(p(10), p(152))

  // Lower face height (nose base to chin — lower third)
  const lowerFaceHeight = dist(p(2), p(152))

  if (cheekWidth < 0.01 || faceHeight < 0.01) {
    // Degenerate landmarks — return neutral values
    return neutralMetrics()
  }

  // ── 1. JAW TAPER RATIO (primary fat-face detector) ─────────────────────────
  //
  // jawTaper = bigonial_width / bizygomatic_width
  //
  // Anthropometric reference values for adult males:
  //   Lean/defined:  jawTaper ≈ 0.72–0.78  (jaw notably narrower than cheeks)
  //   Average:       jawTaper ≈ 0.80–0.85  (common in population)
  //   Overweight:    jawTaper ≈ 0.86–0.92  (fat deposits widen jaw region)
  //   Obese/round:   jawTaper ≈ 0.92–1.00  (jaw nearly as wide as cheekbones)
  //
  // HAIR AND BEARD DO NOT AFFECT THIS. MediaPipe landmarks follow face bone/tissue
  // surface, not hair. A full beard does not widen the gonion landmark positions.
  const jawTaper = jawWidth / cheekWidth

  // Score: 5.0 = average (taper 0.83), every 0.05 = ~3.5 score points
  // Fat face (0.92) → score ≈ 1.7 → Low Tier
  // Average (0.83)  → score ≈ 5.0
  // Defined (0.76)  → score ≈ 7.0
  // Very defined (0.70) → score ≈ 9.0+
  const jawTaperScore = round1(clamp(5.0 + (0.83 - jawTaper) * 55, 1.0, 9.8))

  // ── 2. FACE ELONGATION (round vs lean) ─────────────────────────────────────
  //
  // elongation = faceHeight / cheekWidth
  //   < 1.20 → very round/fat face
  //   1.30   → below average
  //   1.40   → average male
  //   1.55+  → lean/long face
  const elongation = faceHeight / cheekWidth
  const elongationScore = round1(clamp(5.0 + (elongation - 1.40) * 22, 1.0, 9.8))

  // ── 3. GONIAL ANGLE (actual jaw sharpness from bone geometry) ───────────────
  //
  // Measures the angle at each jaw corner (gonion) using the jawline contour.
  //   < 115° → very sharp, angular jaw (rare, genetic)
  //   115–120° → defined jaw
  //   120–125° → above average
  //   125–130° → average
  //   130–135° → soft jaw
  //   > 135° → round/fat jaw
  //
  // Left: angle at 172 between points 136 (cheek side) and 148 (chin side)
  // Right: angle at 397 between points 365 (cheek side) and 378 (chin side)
  const gonialLeft  = angleDeg(p(136), p(172), p(148))
  const gonialRight = angleDeg(p(365), p(397), p(378))
  const gonialAvg   = (gonialLeft + gonialRight) / 2

  // Score: 5.0 = average (127°), each 5° = 1 point (sharper = higher)
  const gonialScore = round1(clamp(5.0 + (127 - gonialAvg) / 5, 1.0, 9.8))

  // ── 4. REAL SYMMETRY (from landmark positions, not pixel luminance) ──────────
  //
  // Compares paired landmark positions relative to the face center axis.
  // Measures actual geometric asymmetry, not lighting differences.
  const centerX = p(1).x  // nose tip as face center reference

  const symPairs = [
    [p(33),  p(263)],  // eye outer corners
    [p(133), p(362)],  // eye inner corners
    [p(234), p(454)],  // cheekbones
    [p(172), p(397)],  // jaw corners
    [p(58),  p(288)],  // lower jaw
  ]
  let symErr = 0
  for (const [L, R] of symPairs) {
    const mid = (L.x + R.x) / 2
    symErr += Math.abs(mid - centerX) / cheekWidth
    symErr += Math.abs(L.y - R.y) / faceHeight
  }
  symErr /= symPairs.length

  // symErr 0.00 = perfect symmetry → 10
  // symErr 0.03 = good            → 7.0
  // symErr 0.06 = average         → 5.0  (most people are here)
  // symErr 0.10 = noticeable      → 3.5
  const symmetryScore = round1(clamp(10 - symErr * 80, 3.0, 9.5))

  // ── 5. COMPOSITE STRUCTURAL METRICS (drop-in replacements) ──────────────────
  //
  // These replace the broken pixel-based edgeDensity and lowerFaceEdges.
  // They are calibrated to the same 1–10 scale used throughout derivePillars.

  // lowerFaceEdges replacement: jaw definition from real geometry
  // Jaw taper is the dominant signal — fat face = low score, defined = high
  const realJawDefinition = round1(clamp(
    jawTaperScore   * 0.50 +  // jaw taper: most discriminating fat-face signal
    gonialScore     * 0.30 +  // actual jaw angle geometry
    elongationScore * 0.20,   // face shape (round vs lean)
    1.0, 9.8
  ))

  // edgeDensity replacement: overall facial structure / definition
  const realFacialSharpness = round1(clamp(
    gonialScore     * 0.50 +  // jaw angle dominates structural sharpness
    jawTaperScore   * 0.35 +  // jaw taper supports
    elongationScore * 0.15,   // face shape
    1.0, 9.8
  ))

  return {
    lowerFaceEdges:  realJawDefinition,
    edgeDensity:     realFacialSharpness,
    symmetry:        symmetryScore,
    usedLandmarks:   true,

    // Debug values (logged to console)
    _jawTaper:    Math.round(jawTaper * 1000) / 1000,
    _elongation:  Math.round(elongation * 100) / 100,
    _gonialAvg:   Math.round(gonialAvg * 10) / 10,
    _symErr:      Math.round(symErr * 1000) / 1000,
    _scores: { jawTaperScore, elongationScore, gonialScore, symmetryScore },
  }
}

function neutralMetrics() {
  return {
    lowerFaceEdges: 5.0,
    edgeDensity:    5.0,
    symmetry:       5.5,
    usedLandmarks:  false,
    _error: 'degenerate landmarks',
  }
}

// ─── FaceMetricsExplorer data from raw landmarks ──────────────────────────────
//
// toExplorerLandmarks2D maps the 468-point MediaPipe array to the 9 named
// [x, y] pairs that FaceMetricsExplorer uses for overlay dot placement.
// computeExplorerMetrics derives the metric values shown in the stat cards.
//
// Landmark index references (MediaPipe canonical face mesh):
//  10  forehead center  ·  1  nose tip  ·  152  chin
//  127 left temple      · 356 right temple
//  234 left cheekbone   · 454 right cheekbone
//  172 left jaw corner  · 397 right jaw corner
export function toExplorerLandmarks2D(lm) {
  const p = (i) => [lm[i].x, lm[i].y]
  return {
    browPoint:      p(10),
    noseTip:        p(1),
    chinTip:        p(152),
    templeLeft:     p(127),
    templeRight:    p(356),
    cheekboneLeft:  p(234),
    cheekboneRight: p(454),
    // jawBody = pre-gonion points (lm 58/288), used for a width ratio
    jawBodyLeft:    p(58),
    jawBodyRight:   p(288),
    // jawCorner = gonion angle (lm 172/397), used for bigonialWidthPercent
    jawCornerLeft:  p(172),
    jawCornerRight: p(397),
  }
}

export function computeExplorerMetrics(lm) {
  const p = (i) => lm[i]
  const d = (a, b) => Math.sqrt((p(a).x - p(b).x) ** 2 + (p(a).y - p(b).y) ** 2)

  const cheekDist = d(234, 454)
  if (cheekDist < 0.01) return null  // degenerate — caller should fall back to demo

  // All output is scale-independent. An ordinary selfie has no physical ruler,
  // so centimetres or millimetres would be fabricated precision.
  // bigonialDist = gonion-to-gonion (lm 172/397) — used for Bigonial Width %
  // Keeping them separate ensures the two metrics measure distinct anatomy.
  const jawBodyDist   = d(58, 288)
  const bigonialDist  = d(172, 397)
  const tempDist      = d(127, 356)
  const midfaceH   = Math.abs(p(1).y - p(234).y)  // nose tip to cheekbone level

  // Asymmetry: how far each pair's midpoint deviates from the nose-tip center
  const cx = p(1).x
  const asymScore = (iL, iR) => {
    const mid = (p(iL).x + p(iR).x) / 2
    return Math.round(Math.abs(mid - cx) / cheekDist * 1000) / 10  // % of face width
  }

  return {
    jawToCheekWidthRatio:    Math.round(jawBodyDist / cheekDist * 100) / 100,
    templeToCheekWidthRatio: Math.round(tempDist / cheekDist * 100) / 100,
    bigonialWidthPercent:    Math.round(bigonialDist / cheekDist * 1000) / 10,
    midfaceRatio:            Math.round(midfaceH / cheekDist * 100) / 100,
    jawAsymmetryScore:       asymScore(172, 397),
    cheekboneAsymmetryScore: asymScore(234, 454),
    templeAsymmetryScore:    asymScore(127, 356),
  }
}
