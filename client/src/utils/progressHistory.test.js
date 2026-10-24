import test from 'node:test'
import assert from 'node:assert/strict'
import { formatProgressTrendLabels, getProgressScore, getProgressTrendAxisTicks, getProgressTrendChartSeries, getProgressTrendSeries, isPhysiqueProgressScan, mergeProgressHistory } from './progressHistory.js'

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
  const [row] = mergeProgressHistory([remote], [{ ...scan, tier: 'Mid tier normie' }], { ...scan, tier: 'Mid tier normie' })
  assert.equal(row.id, 'db-1')
  assert.equal(row.localMediaScanId, 'scan-1')
  assert.equal(row.tier, 'Mid tier normie')
})
test('unselected local scans can enrich matching cloud history without being published', () => {
  const local = { ...scan, progressSavedAt: undefined, tier: 'Mid Tier Normie' }
  const remote = { id: 'db-1', created_at: '2026-10-17T12:00:10Z', overall_score: 6.1 }
  const rows = mergeProgressHistory([remote], [local], null)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].localMediaScanId, 'scan-1')
  assert.equal(rows[0].tier, 'Mid Tier Normie')
  assert.deepEqual(mergeProgressHistory([], [{ ...local, scanDate: '2026-10-18T12:00:00Z' }], null), [])
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

test('locked Potential chart keeps scan dates when saved scans do not contain Potential scores', () => {
  const scans = [
    { id: 'newest', created_at: '2026-10-20T12:00:00Z', overall_score: 8.1 },
    { id: 'oldest', created_at: '2026-10-10T12:00:00Z', overall_score: 6.2 },
  ]

  assert.deepEqual(getProgressTrendChartSeries(scans, 'face', 'potential', true), [
    { scanId: 'oldest', timestamp: '2026-10-10T12:00:00Z', score: null },
    { scanId: 'newest', timestamp: '2026-10-20T12:00:00Z', score: null },
  ])
})

test('unlocked Potential chart does not fabricate points when saved scans lack Potential scores', () => {
  const scans = [
    { id: 'newest', created_at: '2026-10-20T12:00:00Z', overall_score: 8.1 },
    { id: 'oldest', created_at: '2026-10-10T12:00:00Z', overall_score: 6.2 },
  ]

  assert.deepEqual(getProgressTrendChartSeries(scans, 'face', 'potential', false), [])
})

test('locked trend ratings use evenly spaced values across the 0–10 scale', () => {
  assert.deepEqual(getProgressTrendAxisTicks(true), [0, 2, 4, 6, 8, 10])
  assert.equal(getProgressTrendAxisTicks(false), undefined)
})

test('score trend spans the earliest and latest scans in chronological order', () => {
  const newest = { id: 'newest', created_at: '2026-10-20T12:00:00Z', overall_score: 8.1 }
  const oldest = { id: 'oldest', created_at: '2026-10-10T12:00:00Z', overall_score: 6.2 }
  const middle = { id: 'middle', created_at: '2026-10-15T12:00:00Z', overall_score: 7.1 }
  const series = getProgressTrendSeries([newest, oldest, middle], 'face', 'overall')
  assert.deepEqual(series.map(point => point.scanId), ['oldest', 'middle', 'newest'])
  assert.deepEqual(series.map(point => point.score), [6.2, 7.1, 8.1])
})

test('trend axis uses chronological scan numbers and retains dates for the tooltip', () => {
  const labels = formatProgressTrendLabels([
    { timestamp: '2026-10-19T12:00:00Z' },
    { timestamp: '2026-10-19T18:00:00Z' },
    { timestamp: '2026-10-20T12:00:00Z' },
  ])
  assert.deepEqual(labels.map(item => item.shortLabel), ['1', '2', '3'])
  assert.deepEqual(labels.map(item => item.fullLabel), ['10-19-2026', '10-19-2026', '10-20-2026'])
})
