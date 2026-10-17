import test from 'node:test'
import assert from 'node:assert/strict'
import { findStoredPotentialScore, getRevealRatings, getRevealView } from './revealRatings.js'

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
