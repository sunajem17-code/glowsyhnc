import test from 'node:test'
import assert from 'node:assert/strict'
import { getComparisonScans, mergeScanHistory, normalizeHistoryScan } from './scanHistory.js'
import { getRevealRatings } from './revealRatings.js'

test('comparison excludes the current scan and its server alias, and keeps other completed scans', () => {
  const candidates = getComparisonScans({ id: 'current', serverScanId: 'cloud-current' }, [
    { id: 'current', glowScore: 8 },
    { id: 'cloud-current', glowScore: 8 },
    { id: 'other', glowScore: 7, facePhotoUrl: 'data:image/jpeg;base64,other' },
    { id: 'unfinished' },
  ])
  assert.deepEqual(candidates.map(scan => scan.id), ['other'])
  assert.equal(candidates[0].facePhotoUrl, 'data:image/jpeg;base64,other')
})

test('history includes device-saved scans when the legacy server history is empty', () => {
  const scan = { id: 'local', scanDate: '2026-10-18T12:00:00Z', aiScore: {
    overallScore: 8.3, potentialScore: 9.7, faceMetrics: { cheekbones: { score: 7.8 } },
  }, facePhotoUrl: 'data:image/jpeg;base64,photo' }
  const rows = mergeScanHistory([], [scan], scan)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].facePhotoUrl, scan.facePhotoUrl)
  assert.equal(rows[0].aiScore, scan.aiScore)
  assert.deepEqual(getRevealRatings(rows[0]), getRevealRatings(scan))
})

test('current results retain newer metrics and deduplicate their server record', () => {
  const current = { id: 'local', serverScanId: 'server', glowScore: 8.3, aiScore: { overallScore: 8.3, potentialScore: 9.7 } }
  const rows = mergeScanHistory([{ id: 'server', glow_score: 8.3 }], [{ id: 'local', glowScore: 8.3 }], current)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].aiScore.potentialScore, 9.7)
})

test('legacy results normalize safely and incomplete captures stay out of history', () => {
  const legacy = normalizeHistoryScan({ id: 'old', glow_score: 7.2, face_data: '{"symmetry":8}', body_data: '{broken', insights: '["Tip"]', scan_date: '2026-10-17' })
  assert.equal(legacy.glowScore, 7.2)
  assert.equal(legacy.faceData.symmetry, 8)
  assert.equal(legacy.bodyData, null)
  assert.deepEqual(legacy.insights, ['Tip'])
  assert.equal(mergeScanHistory([], [{ id: 'unfinished' }], null).length, 0)
})
