import test from 'node:test'
import assert from 'node:assert/strict'
import { hasCompletedOnboarding, hasCompletedStartingPoint, onboardingOwner, onboardingStartup, startingPointCompletionKey } from './onboardingStartup.js'

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
