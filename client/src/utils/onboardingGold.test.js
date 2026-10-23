import test from 'node:test'
import assert from 'node:assert/strict'
import { GOLD } from './theme.js'
import { ONBOARDING_GOLD } from './onboardingGold.js'

test('onboarding gold accents use the shared Ascendus gold token', () => {
  assert.equal(ONBOARDING_GOLD, GOLD)
  assert.equal(ONBOARDING_GOLD, '#C6A85C')
})
