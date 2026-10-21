import test from 'node:test'
import assert from 'node:assert/strict'
import { getProgressStatPresentation, getScanHistoryViewState } from './scanHistoryPresentation.js'

test('free progress hides gated stat values while retaining a lock state', () => {
  assert.deepEqual(getProgressStatPresentation(2, false), { locked: true, value: null })
})

test('Pro progress displays the real stat value', () => {
  assert.deepEqual(getProgressStatPresentation(2, true), { locked: false, value: 2 })
})

test('saved scan cards remain visible while history is refreshing', () => {
  assert.equal(getScanHistoryViewState({ scanCount: 2, loading: true }), 'list')
})

test('free users with saved scans are shown the scan-card list, not an upgrade gate', () => {
  assert.equal(getScanHistoryViewState({ scanCount: 1, isPremium: false }), 'list')
})
