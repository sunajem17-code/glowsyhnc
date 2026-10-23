import test from 'node:test'
import assert from 'node:assert/strict'
import { getProgressStatPresentation, getProgressTrendPresentation, getScanHistoryRowPresentation, getScanHistoryViewState, shouldShowProgressData } from './scanHistoryPresentation.js'

test('non-Pro Progress keeps the Face Scans, Best Score, and Current Streak stat values locked', () => {
  assert.deepEqual(getProgressStatPresentation(2, false), { locked: true, value: null })
})

test('Pro progress displays the real stat value', () => {
  assert.deepEqual(getProgressStatPresentation(2, true), { locked: false, value: 2 })
})

test('Progress trend card and scan history remain visible without Pro', () => {
  assert.equal(shouldShowProgressData(false), true)
  assert.equal(shouldShowProgressData(true), true)
})

test('non-Max users keep the trend controls but replace the score line with a lock', () => {
  assert.deepEqual(getProgressTrendPresentation(false), { locked: true })
})

test('Ascendus Max members can see the score trend line', () => {
  assert.deepEqual(getProgressTrendPresentation(true), { locked: false })
  assert.equal(shouldShowProgressData(false), true)
})

test('saved scan cards remain visible while history is refreshing', () => {
  assert.equal(getScanHistoryViewState({ scanCount: 2, loading: true }), 'list')
})

test('free users with saved scans are shown the scan-card list, not an upgrade gate', () => {
  assert.equal(getScanHistoryViewState({ scanCount: 1, isPremium: false }), 'list')
})

test('free scan-history cards use the blurred rating treatment while Pro cards remain clear', () => {
  assert.deepEqual(getScanHistoryRowPresentation(false), { blurRating: true })
  assert.deepEqual(getScanHistoryRowPresentation(true), { blurRating: false })
})
