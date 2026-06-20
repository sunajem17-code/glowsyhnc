/**
 * Regression test for the scoring pipeline.
 *
 * Run before shipping any scoring logic change:
 *   node server/src/test-scoring.js
 *
 * Tests the calculateFinalScore function in isolation — no Anthropic API calls,
 * no network, no database. Covers all edge cases that have caused prod regressions.
 */

// ── Inline the function under test (copied from aiScore.js) ───────────────────
// Keep this in sync manually, or extract calculateFinalScore to a shared util.
const FACE_WEIGHT     = 0.70
const PHYSIQUE_WEIGHT = 0.30

function calculateFinalScore(faceResult, gender = 'male', physiqueResult = null) {
  if (!faceResult || typeof faceResult !== 'object') {
    throw new Error('calculateFinalScore: faceResult is required and must be an object')
  }
  physiqueResult = physiqueResult ?? null

  const clamp = (v, fallback = 5.0) => Math.min(Math.max(Number(v) || fallback, 1.0), 10.0)

  const p = faceResult.pillars || {}
  let harmony     = clamp(p.harmony)
  let angularity  = clamp(p.angularity)
  let features    = clamp(p.features)
  let dimorphism  = clamp(p.dimorphism)
  const hasPillars = p.harmony != null && p.angularity != null && p.features != null && p.dimorphism != null

  const pillarAvg    = (harmony + angularity + features + dimorphism) / 4
  const aestheticRaw = hasPillars ? pillarAvg : clamp(faceResult.face_score)

  const faceScore     = Math.round(aestheticRaw * 10) / 10
  const groomingScore = clamp(faceResult.grooming_score)

  const physiqueOverall = physiqueResult?.overall ?? null
  const hasPhysique     = physiqueOverall != null
  const blendedRaw      = hasPhysique
    ? aestheticRaw * FACE_WEIGHT + clamp(physiqueOverall) * PHYSIQUE_WEIGHT
    : aestheticRaw

  const final = Math.round(blendedRaw * 10) / 10

  let tier
  if (gender === 'female') {
    if      (final >= 9.5) tier = 'True Eve'
    else if (final >= 9.0) tier = 'Eve Lite'
    else if (final >= 8.0) tier = 'Eve'
    else if (final >= 7.0) tier = 'Stacy'
    else if (final >= 6.0) tier = 'High Tier Becky'
    else if (final >= 5.0) tier = 'Mid Tier Becky'
    else if (final >= 4.0) tier = 'Low Tier Becky'
    else                   tier = 'Sub 3'
  } else {
    if      (final >= 9.5) tier = 'True Adam'
    else if (final >= 9.0) tier = 'Adam Lite'
    else if (final >= 8.0) tier = 'Chad'
    else if (final >= 7.0) tier = 'Chadlite'
    else if (final >= 6.0) tier = 'High Tier Normie'
    else if (final >= 5.0) tier = 'Mid Tier Normie'
    else if (final >= 4.0) tier = 'Low Tier Normie'
    else                   tier = 'Sub 3'
  }

  if (final >= 8.0 && hasPillars) {
    const pillarFloor = Math.round((final - 1.5) * 10) / 10
    harmony    = Math.max(harmony,    pillarFloor)
    angularity = Math.max(angularity, pillarFloor)
    features   = Math.max(features,   pillarFloor)
    dimorphism = Math.max(dimorphism, pillarFloor)
  }

  return { final, tier, faceScore, faceOnlyScore: Math.round(aestheticRaw * 10) / 10, groomingScore, harmony, angularity, features, dimorphism, hasPillars }
}

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0
let failed = 0

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function run(label, fn) {
  console.log(`\n▶ ${label}`)
  try {
    fn()
  } catch (err) {
    console.error(`  ✗ THREW: ${err.message}`)
    failed++
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const FACE_GOOD = {
  face_score: 7.2,
  grooming_score: 6.8,
  facial_structure: 'Oval',
  pillars: { harmony: 7.0, angularity: 7.2, features: 7.4, dimorphism: 7.1 },
  sub_scores: {},
}

const FACE_NO_PILLARS = {
  face_score: 6.5,
  grooming_score: 6.0,
  facial_structure: 'Square',
  sub_scores: {},
}

const PHYSIQUE_GOOD = {
  overall: 7.5,
  body_fat_level: 'Athletic',
  muscularity: 7.0,
  proportions: 7.5,
  posture: 7.8,
}

const PHYSIQUE_NAN = {
  overall: NaN,
  body_fat_level: 'Unknown',
}

// ── Test scenarios ─────────────────────────────────────────────────────────────

run('Scenario 1: Face only, no gender set (defaults to male)', () => {
  const r = calculateFinalScore(FACE_GOOD, undefined, null)
  assert('returns a final score', typeof r.final === 'number' && !isNaN(r.final))
  assert('final matches pillar avg', r.final === Math.round(((7.0+7.2+7.4+7.1)/4)*10)/10, `got ${r.final}`)
  assert('tier assigned', typeof r.tier === 'string' && r.tier.length > 0)
  assert('no physique blend', r.final === r.faceOnlyScore, `final=${r.final} faceOnly=${r.faceOnlyScore}`)
  assert('physique did not affect score', r.faceOnlyScore === r.final)
})

run('Scenario 2: Face only, gender set to female', () => {
  const r = calculateFinalScore(FACE_GOOD, 'female', null)
  assert('final is a number', typeof r.final === 'number' && !isNaN(r.final))
  assert('tier is female tier', ['True Eve','Eve Lite','Eve','Stacy','High Tier Becky','Mid Tier Becky','Low Tier Becky','Sub 3'].includes(r.tier), `got "${r.tier}"`)
})

run('Scenario 3: Face + body photo', () => {
  const r = calculateFinalScore(FACE_GOOD, 'male', PHYSIQUE_GOOD)
  const faceAvg = (7.0+7.2+7.4+7.1)/4
  const expected = Math.round((faceAvg * FACE_WEIGHT + 7.5 * PHYSIQUE_WEIGHT) * 10) / 10
  assert('physique is blended in', r.final === expected, `expected ${expected} got ${r.final}`)
  assert('final != faceOnlyScore when physique present', r.final !== r.faceOnlyScore)
})

run('Scenario 4: Face + body photo + side profile (side doesn\'t change score calc)', () => {
  // Side profile data is parsed inside getFaceScore and attached to faceResult.profile.
  // calculateFinalScore doesn't receive it separately — pillars already reflect it.
  const faceWithSide = { ...FACE_GOOD, profile: { profile_score: 7.8, nose_bridge: 'strong', jawline_projection: 'projected', chin_projection: 'average' } }
  const r = calculateFinalScore(faceWithSide, 'male', PHYSIQUE_GOOD)
  assert('returns a valid score', typeof r.final === 'number' && !isNaN(r.final))
  assert('tier assigned', typeof r.tier === 'string')
})

run('Scenario 5: Face + body photo with null gender (edge case)', () => {
  const r = calculateFinalScore(FACE_GOOD, null, PHYSIQUE_GOOD)
  assert('returns a number (defaults to male tiers)', typeof r.final === 'number' && !isNaN(r.final))
  assert('tier is male tier', ['True Adam','Adam Lite','Chad','Chadlite','High Tier Normie','Mid Tier Normie','Low Tier Normie','Sub 3'].includes(r.tier), `got "${r.tier}"`)
})

run('Scenario 6: Face without pillars (falls back to face_score)', () => {
  const r = calculateFinalScore(FACE_NO_PILLARS, 'male', null)
  assert('hasPillars is false', r.hasPillars === false)
  assert('final derived from face_score', r.final === 6.5, `got ${r.final}`)
})

run('Scenario 7: Physique scoring fails — face-only result returned', () => {
  // Simulates: physique step threw, physiqueResult was set to null before calculateFinalScore
  const r = calculateFinalScore(FACE_GOOD, 'male', null)
  assert('still returns a score', typeof r.final === 'number' && !isNaN(r.final))
  assert('face-only score is used', r.final === r.faceOnlyScore)
  assert('no NaN in result', !Object.values(r).some(v => typeof v === 'number' && isNaN(v)))
})

run('Scenario 8: Physique with NaN overall — clamped to fallback', () => {
  const r = calculateFinalScore(FACE_GOOD, 'male', PHYSIQUE_NAN)
  assert('does not produce NaN final', !isNaN(r.final))
  assert('final is a reasonable number', r.final >= 1.0 && r.final <= 10.0)
})

run('Scenario 9: faceResult is null — throws clear error', () => {
  let threw = false
  try {
    calculateFinalScore(null, 'male', null)
  } catch (e) {
    threw = true
    assert('error message is specific', e.message.includes('faceResult is required'), e.message)
  }
  assert('threw an error', threw)
})

run('Scenario 10: faceResult is undefined — throws clear error', () => {
  let threw = false
  try {
    calculateFinalScore(undefined, 'male', null)
  } catch (e) {
    threw = true
  }
  assert('threw an error', threw)
})

run('Scenario 11: Score boundaries (clamped to 1–10)', () => {
  const extreme = { ...FACE_GOOD, pillars: { harmony: 999, angularity: -5, features: 0, dimorphism: 11 } }
  const r = calculateFinalScore(extreme, 'male', null)
  assert('final within 1–10', r.final >= 1.0 && r.final <= 10.0, `got ${r.final}`)
})

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('REGRESSION DETECTED — do not ship until all tests pass')
  process.exit(1)
} else {
  console.log('All tests passed ✓')
  process.exit(0)
}
