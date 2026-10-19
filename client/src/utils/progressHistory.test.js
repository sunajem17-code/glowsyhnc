import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeProgressHistory } from './progressHistory.js'

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
