import test from 'node:test'
import assert from 'node:assert/strict'
import { hasLocalPremiumUiAccess, hasLocalUnlockedScanUiAccess, hasPremiumUiAccess, hasUnlockedScanUiAccess, isLocalDeveloperPreview, isLocalProPreviewEnabled, markScanResultsUnlocked } from './developerUnlock.js'

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

test('settings preview exposes premium UI only on local development hosts', () => {
  assert.equal(hasLocalPremiumUiAccess(false, true, true, 'localhost'), true)
  assert.equal(hasLocalPremiumUiAccess(false, true, true, '127.0.0.1'), true)
  assert.equal(hasLocalPremiumUiAccess(false, true, true, 'ascendus.store'), false)
  assert.equal(hasLocalPremiumUiAccess(false, true, false, 'localhost'), false)
  assert.equal(hasLocalPremiumUiAccess(true, false, false, 'ascendus.store'), true)
})

test('an enabled local preview stays in mock mode even for an actually premium account', () => {
  assert.equal(isLocalProPreviewEnabled(true, true, 'localhost'), true)
  assert.equal(isLocalProPreviewEnabled(true, true, 'ascendus.store'), false)
  assert.equal(isLocalProPreviewEnabled(false, true, 'localhost'), false)
})

test('a previously unlocked saved scan stays unlocked when reopened after preview access ends', () => {
  assert.equal(hasUnlockedScanUiAccess(false, false, { resultsUnlocked: true }), true)
  assert.equal(hasUnlockedScanUiAccess(false, false, { resultsUnlocked: false }), false)
})

test('local preview scan access is not enabled on non-local hosts', () => {
  assert.equal(hasLocalUnlockedScanUiAccess(false, true, null, true, 'localhost'), true)
  assert.equal(hasLocalUnlockedScanUiAccess(false, true, null, true, 'ascendus.store'), false)
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
