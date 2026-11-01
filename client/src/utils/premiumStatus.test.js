import test from 'node:test'
import assert from 'node:assert/strict'
import { canApplyNegativePremiumRefresh } from './premiumStatus.js'

test('a current negative status can correct stale premium state', () => {
  assert.equal(canApplyNegativePremiumRefresh({
    revisionAtStart: 4,
    currentRevision: 4,
    nativePremiumStatus: false,
    serverStatus: false,
  }), true)
})

test('a refresh started before a purchase cannot demote the new entitlement', () => {
  assert.equal(canApplyNegativePremiumRefresh({
    revisionAtStart: 4,
    currentRevision: 5,
    nativePremiumStatus: false,
    serverStatus: false,
  }), false)
})

test('RevenueCat premium access cannot be contradicted by a stale server false', () => {
  assert.equal(canApplyNegativePremiumRefresh({
    revisionAtStart: 4,
    currentRevision: 4,
    nativePremiumStatus: true,
    serverStatus: false,
  }), false)
})

test('an explicit native free result can apply when the server is unavailable', () => {
  assert.equal(canApplyNegativePremiumRefresh({
    revisionAtStart: 4,
    currentRevision: 4,
    nativePremiumStatus: false,
  }), true)
})
