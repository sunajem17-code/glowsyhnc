import test from 'node:test'
import assert from 'node:assert/strict'
import { hasCompletedOnboarding, hasCompletedScan, hasCompletedStartingPoint, normalizeOnboardingCompletion, onboardingOwner, onboardingStartup, startingPointCompletionKey } from './onboardingStartup.js'

test('onboarding completion survives logout for the same account', () => {
  const completed = { user: { id: 'u1' }, onboardingCompletedByUser: { 'user:u1': true } }
  assert.equal(hasCompletedOnboarding(completed), true)
  assert.equal(onboardingStartup({ ...completed, onboardingHydrated: true, isAuthenticated: false, token: null }), 'signin')
})

test('clearing the account completion record sends a deleted account through onboarding', () => {
  assert.equal(onboardingStartup({ user: null, onboardingCompletedByUser: {}, onboardingHydrated: true, isAuthenticated: false }), 'onboarding')
})

test('starting point completion is independently account-scoped', () => {
  const state = { user: { id: 'u1' }, startingPointCompletedByUser: { [startingPointCompletionKey({ id: 'u1' })]: true } }
  assert.equal(hasCompletedStartingPoint(state), true)
  assert.equal(hasCompletedStartingPoint({ ...state, user: { id: 'u2' } }), false)
})

test('a completed scan survives relaunch even if onboarding completion was lost', () => {
  const saved = { user: { id: 'u1' }, scans: [{ id: 'scan-1', analyzedAt: '2026-11-01', glowScore: 6 }] }
  const restored = { ...saved, ...normalizeOnboardingCompletion(saved), onboardingHydrated: true, isAuthenticated: true, token: 'token' }
  assert.equal(hasCompletedScan(restored), true)
  assert.equal(onboardingStartup(restored), 'app')
  assert.equal(onboardingStartup({ ...restored, isAuthenticated: false, token: null }), 'signin')
  assert.equal(hasCompletedScan({ ...restored, user: { id: 'u2' } }), false)
})

test('capturing a photo, a failed scan, and demo results do not complete onboarding', () => {
  for (const scan of [{ id: 'scan-1' }, { id: 'scan-1', status: 'failed' }, { id: 'demo', analyzedAt: 'now', glowScore: 6, aiScore: { demoMode: true } }]) {
    const saved = { user: { id: 'u1' }, scans: [scan] }
    const restored = { ...saved, ...normalizeOnboardingCompletion(saved), onboardingHydrated: true }
    assert.equal(hasCompletedScan(restored), false)
    assert.equal(onboardingStartup(restored), 'onboarding')
  }
})

test('removing scan history does not forget a previously completed scan', () => {
  const saved = { user: { id: 'u1' }, scans: [], completedScanByUser: { 'user:u1': true } }
  assert.equal(hasCompletedScan({ ...saved, ...normalizeOnboardingCompletion(saved) }), true)
})
