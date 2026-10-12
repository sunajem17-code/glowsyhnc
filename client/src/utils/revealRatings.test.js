import test from 'node:test'
import assert from 'node:assert/strict'
import { getRevealRatings, getRevealView } from './revealRatings.js'

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
test('every reveal state has visible content, including paywall query changes and missing scan', () => {
  assert.equal(getRevealView({ hasScan: true, paywallRequested: true, premium: false }), 'paywall')
  assert.equal(getRevealView({ hasScan: true, paywallRequested: true, premium: true }), 'ratings')
  assert.equal(getRevealView({ hasScan: true }), 'ratings')
  assert.equal(getRevealView({ pending: true }), 'pending')
  assert.equal(getRevealView({}), 'empty')
})
