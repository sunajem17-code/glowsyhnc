import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPremiumUiAccess, hasUnlockedScanUiAccess, isLocalDeveloperPreview, markScanResultsUnlocked } from './developerUnlock.js'

test('developer preview unlock is only available in dev on loopback hosts', () => {
  assert.equal(isLocalDeveloperPreview(true, 'localhost'), true)
  assert.equal(isLocalDeveloperPreview(true, '127.0.0.1'), true)
  assert.equal(isLocalDeveloperPreview(false, 'localhost'), false)
  assert.equal(isLocalDeveloperPreview(true, 'ascendus.store'), false)
})

test('developer preview unlock opens premium UI without changing paid entitlement', () => {
  assert.equal(hasPremiumUiAccess(false, true), true)
  assert.equal(hasPremiumUiAccess(false, false), false)
  assert.equal(hasPremiumUiAccess(true, false), true)
})

test('a previously unlocked saved scan stays unlocked when reopened after preview access ends', () => {
  assert.equal(hasUnlockedScanUiAccess(false, false, { resultsUnlocked: true }), true)
  assert.equal(hasUnlockedScanUiAccess(false, false, { resultsUnlocked: false }), false)
})

test('developer unlock marks only the selected saved scan as reusable unlocked results', () => {
  const state = {
    currentScan: { id: 'scan-1' },
    scans: [{ id: 'scan-1' }, { id: 'scan-2' }],
  }
  const next = markScanResultsUnlocked(state, 'scan-1')
  assert.equal(next.currentScan.resultsUnlocked, true)
  assert.equal(next.scans[0].resultsUnlocked, true)
  assert.equal(next.scans[1].resultsUnlocked, undefined)
})
