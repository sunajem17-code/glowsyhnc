import test from 'node:test'
import assert from 'node:assert/strict'
import { completeDemoRevealRatings, findStoredPotentialScore, getRatingColor, getResultsHeading, recoverMissingRevealRatings, recoverPotentialScore, getRevealRatings, getRevealView } from './revealRatings.js'

test('uses named server ratings rather than unrelated pillars or fabricated potential', () => {
  const ratings = getRevealRatings({ glowScore: 7, pillars: { features: 9 }, aiScore: {
    overallScore: 7.3, faceMetrics: { cheekbones: { score: 6.2 }, skinQuality: { score: 8.1 } },
    faceSubScores: { symmetry: 7.7, jawlineDefinition: 6.8 },
  } })
  assert.deepEqual(ratings.map(r => r.value), [7.3, null, 7.7, 8.1, 6.8, 6.2])
})
test('missing scores remain unavailable instead of becoming zero', () => {
  assert.deepEqual(getRevealRatings({}).map(r => r.value), [null, null, null, null, null, null])
})
test('reads cheekbones from saved extended face metrics when core face metrics are absent', () => {
  const ratings = getRevealRatings({ aiScore: { extendedMetrics: { midface: { cheekbones: { score: 7.4 } } } } })
  assert.equal(ratings[5].value, 7.4)
})
test('reads cheekbones from snake-case extended metrics returned by the server', () => {
  const ratings = getRevealRatings({ extended_metrics: JSON.stringify({ midface: { cheekbones: { score: 7.4 } } }) })
  assert.equal(ratings[5].value, 7.4)
})
test('unlocked results keep the neutral Your Results heading regardless of tier', () => {
  assert.equal(getResultsHeading({ gender: 'male', aiScore: { overallScore: 4.5 } }), 'Your Results')
  assert.equal(getResultsHeading({ gender: 'male', aiScore: { overallScore: 7.3 } }), 'Your Results')
  assert.equal(getResultsHeading({ gender: 'female', glowScore: 6.7 }), 'Your Results')
})
test('fills only explicitly marked local demo scans with demo-only missing metrics', () => {
  const demo = completeDemoRevealRatings({ aiScore: {
    demoMode: true,
    overallScore: 7,
    faceSubScores: { symmetry: 7.2, skinClarity: 7.1, jawlineDefinition: 6.8, facialProportions: 7.4 },
  } })
  assert.deepEqual(getRevealRatings(demo).map(({ value }) => value), [7, 8.4, 7.2, 7.1, 6.8, 7.1])
  const legacyDemo = completeDemoRevealRatings({ aiScore: {
    overallScore: 7,
    insights: ['Demo mode. Sign up for a real account to get AI-powered analysis'],
    faceSubScores: { symmetry: 7.2, skinClarity: 7.1, jawlineDefinition: 6.8, facialProportions: 7.4 },
  } })
  assert.ok(getRevealRatings(legacyDemo).every(({ value }) => value != null))
  assert.equal(completeDemoRevealRatings({ aiScore: { overallScore: 7 } }).aiScore.potentialScore, undefined)
})
test('colors vary continuously through midrange scores', () => {
  assert.notEqual(getRatingColor(5.5), getRatingColor(6.5))
  assert.notEqual(getRatingColor(6.8), getRatingColor(7.2))
})
test('score colors pass through distinct red, orange, yellow, and green stops', () => {
  assert.equal(getRatingColor(0), 'rgb(239, 68, 68)')
  assert.equal(getRatingColor(2.1), 'rgb(255, 141, 55)')
  assert.equal(getRatingColor(4.5), 'rgb(249, 115, 22)')
  assert.equal(getRatingColor(5.7), 'rgb(217, 119, 6)')
  assert.equal(getRatingColor(6.1), 'rgb(224, 169, 0)')
  assert.equal(getRatingColor(6.5), 'rgb(250, 204, 21)')
  assert.equal(getRatingColor(7), 'rgb(163, 230, 53)')
  assert.equal(getRatingColor(8.8), 'rgb(48, 229, 32)')
  assert.equal(getRatingColor(10), 'rgb(34, 197, 94)')
  assert.notEqual(getRatingColor(7), getRatingColor(8.1), '7.0 should be yellow-green and visibly different from higher green scores')
  const orange = getRatingColor(5.5).match(/\d+/g).map(Number)
  assert.ok(orange[0] > orange[1] && orange[1] > orange[2], '5.5 should read orange, not yellow')
})
test('recovers legacy Potential from the scorer without sending client scores', async () => {
  const scan = { id: 'old-local', glowScore: 6.1, facePhotoUrl: 'data:image/jpeg;base64,test' }
  let payload
  const api = { supabase: { getScans: async () => ({ scans: [] }) }, ai: { score: async data => { payload = data; return { overallScore: 6.1, potentialScore: 7.5 } } } }
  assert.equal(await recoverPotentialScore(scan, api), 7.5)
  assert.equal(payload.faceImage, scan.facePhotoUrl)
  assert.equal('overallScore' in payload, false)
})
test('recovers missing Potential and cheekbones from the same server-scored scan', async () => {
  const scan = { id: 'missing-ratings', glowScore: 6.1, facePhotoUrl: 'data:image/jpeg;base64,test' }
  let payload
  const api = {
    supabase: { getScans: async () => ({ scans: [] }) },
    ai: { score: async data => {
      payload = data
      return {
        overallScore: 6.1,
        potentialScore: 7.5,
        faceMetrics: {
          symmetry: { score: 7.1 }, skinQuality: { score: 6.9 },
          jawline: { score: 7.2 }, cheekbones: { score: 7.4 },
        },
      }
    } },
  }
  assert.deepEqual(await recoverMissingRevealRatings(scan, api), { values: [null, 7.5, 7.1, 6.9, 7.2, 7.4] })
  assert.equal(payload.faceImage, scan.facePhotoUrl)
  assert.equal('overallScore' in payload, false)
})
test('keeps server-stored Potential if rescoring the other missing metric fails', async () => {
  const scan = { id: 'old-scan', glowScore: 6.1, scanDate: '2026-10-17T12:00:00.000Z', facePhotoUrl: 'data:image/jpeg;base64,test' }
  const api = {
    supabase: { getScans: async () => ({ scans: [{ overall_score: 6.1, potential_score: 7.5, created_at: '2026-10-17T12:00:20.000Z' }] }) },
    ai: { score: async () => { throw new Error('service unavailable') } },
  }
  assert.deepEqual(await recoverMissingRevealRatings(scan, api), { values: [null, 7.5, null, null, null, null] })
})
test('recovers missing Potential and cheekbones from the same matching server scan', async () => {
  const scan = { id: 'old-scan', glowScore: 6.1, scanDate: '2026-10-17T12:00:00.000Z' }
  const api = {
    supabase: { getScans: async () => ({ scans: [{
      overall_score: 6.1,
      potential_score: 7.5,
      created_at: '2026-10-17T12:00:20.000Z',
      extended_metrics: JSON.stringify({ midface: { cheekbones: { score: 7.4 } } }),
    }] }) },
    ai: { score: async () => { throw new Error('no photo should be needed') } },
  }
  assert.deepEqual(await recoverMissingRevealRatings(scan, api), { values: [null, 7.5, null, null, null, 7.4] })
})
test('does not attach Potential from a different scoring result', async () => {
  const api = { supabase: { getScans: async () => ({ scans: [] }) }, ai: { score: async () => ({ overallScore: 8, potentialScore: 9 }) } }
  await assert.rejects(recoverPotentialScore({ id: 'mismatch', glowScore: 6, facePhotoUrl: 'data:image/jpeg;base64,test' }, api), /does not match/)
})
test('matches a saved potential score to the same scan by score and timestamp', () => {
  const scan = { glowScore: 6.1, scanDate: '2026-10-17T12:00:00.000Z' }
  const saved = [
    { overall_score: 6.1, potential_score: 7.5, created_at: '2026-10-17T12:00:20.000Z' },
    { overall_score: 6.1, potential_score: 8.2, created_at: '2026-10-15T12:00:00.000Z' },
  ]
  assert.equal(findStoredPotentialScore(scan, saved), 7.5)
})
test('does not use a saved potential score from a different scan score', () => {
  assert.equal(findStoredPotentialScore({ glowScore: 6.1 }, [{ overall_score: 6.4, potential_score: 7.8 }]), null)
})
test('every reveal state has visible content, including paywall query changes and missing scan', () => {
  assert.equal(getRevealView({ hasScan: true, paywallRequested: true, premium: false }), 'paywall')
  assert.equal(getRevealView({ hasScan: true, paywallRequested: true, premium: true }), 'ratings')
  assert.equal(getRevealView({ hasScan: true }), 'ratings')
  assert.equal(getRevealView({ pending: true }), 'pending')
  assert.equal(getRevealView({}), 'empty')
})
