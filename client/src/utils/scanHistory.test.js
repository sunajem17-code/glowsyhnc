import test from 'node:test'
import assert from 'node:assert/strict'
import { getComparisonScans, getHistoryScoreColor, mergeScanHistory, normalizeHistoryScan } from './scanHistory.js'
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

test('history score colors move from red through yellow to green with score', () => {
  assert.equal(getHistoryScoreColor(0), '#EF4444')
  assert.equal(getHistoryScoreColor(5), '#FACC15')
  assert.equal(getHistoryScoreColor(10), '#22C55E')
  assert.notEqual(getHistoryScoreColor(5.5), getHistoryScoreColor(6.5))
  assert.equal(getHistoryScoreColor(12), '#22C55E')
  assert.equal(getHistoryScoreColor(-2), '#EF4444')
  assert.equal(getHistoryScoreColor(null), 'rgba(255,255,255,0.4)')
})

test('PSL ranges and withheld assessments remain in history without a fabricated point score', () => {
  const make = (id, scoreRange) => ({ id, scanDate: '2026-10-20T12:00:00Z', glowScore: null,
    aiScore: { overallScore: null, assessment: { rubricVersion: 'appearance-psl-v2', scoreRange } } })
  const assessed = make('psl', { min: 4.5, max: 5.2 })
  const withheld = make('withheld', null)
  const rows = mergeScanHistory([], [assessed, withheld], null)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].glowScore, null)
  assert.deepEqual(rows[0].aiScore.assessment.scoreRange, { min: 4.5, max: 5.2 })
  assert.equal(rows[1].aiScore.assessment.scoreRange, null)
})
