import test from 'node:test'
import assert from 'node:assert/strict'
import { getProgressScore, isPhysiqueProgressScan, mergeProgressHistory } from './progressHistory.js'

const scan = { id: 'scan-1', scanDate: '2026-10-17T12:00:00Z', progressSavedAt: '2026-10-17T12:01:00Z', aiScore: { overallScore: 6.1, potentialScore: 7.5 } }
test('device-saved rating appears in Progress when cloud history is empty', () => {
  const result = mergeProgressHistory([], [scan], { ...scan, facePhotoUrl: 'data:image/jpeg;base64,test' })
  assert.equal(result.length, 1)
  assert.equal(result[0].overall_score, 6.1)
  assert.equal(result[0].potential_score, 7.5)
  assert.equal(result[0].face_image_url, 'data:image/jpeg;base64,test')
})
test('does not duplicate a rating already saved by the cloud', () => {
  const remote = { id: 'db-1', created_at: '2026-10-17T12:00:10Z', overall_score: 6.1 }
  assert.deepEqual(mergeProgressHistory([remote], [scan], scan), [remote])
})
test('does not publish unselected scans to Progress', () => {
  assert.deepEqual(mergeProgressHistory([], [{ ...scan, progressSavedAt: undefined }], null), [])
})

test('Progress keeps body scans in their own history and reads body-only score payloads', () => {
  const body = {
    id: 'body-1', scanType: 'physique', scanDate: '2026-10-18T12:00:00Z',
    physiqueScore: { overall: 6.4, proportions: 6.8, leanness: 5.2, frame: 7.1, posture: 6.3, overall_presentation: 6.6 },
  }
  const [row] = mergeProgressHistory([], [body], null)
  assert.equal(isPhysiqueProgressScan(row), true)
  assert.equal(row.overall_score, 6.4)
  assert.equal(getProgressScore(row, 'physique', 'proportions'), 6.8)
  assert.equal(getProgressScore(row, 'physique', 'leanness'), 5.2)
})

test('legacy body-only results with a null face score are still identified as physique scans', () => {
  assert.equal(isPhysiqueProgressScan({ glowScore: null, aiScore: {}, physiqueScore: { overall: 6.2 } }), true)
})

test('face progress series reads scores from the saved AI result without fabricating missing metrics', () => {
  const face = { overall_score: 7, potential_score: 8.1, aiScore: { faceSubScores: { symmetry: 7.4 } } }
  assert.equal(getProgressScore(face, 'face', 'overall'), 7)
  assert.equal(getProgressScore(face, 'face', 'potential'), 8.1)
  assert.equal(getProgressScore(face, 'face', 'symmetry'), 7.4)
  assert.equal(getProgressScore(face, 'face', 'skin'), null)
})
