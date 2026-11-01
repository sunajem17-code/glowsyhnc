import test from 'node:test'
import assert from 'node:assert/strict'
import { getProgressCardReturnTo, getSavedProgressResultPresentation } from './scanResultContext.js'

test('opening a saved Progress card remembers where its back button should return', () => {
  assert.equal(getProgressCardReturnTo({ source: 'progress-card', returnTo: '/timeline' }), '/timeline')
  assert.equal(getProgressCardReturnTo({ source: 'progress-card', returnTo: '/history' }), '/history')
  assert.equal(getProgressCardReturnTo(null), null)
})

test('free saved Progress results stay masked until a paid unlock is active', () => {
  assert.deepEqual(getSavedProgressResultPresentation({ savedProgressCard: true, isPremium: false, hasUnlockedAccess: false }), {
    blurResultCard: true,
    showUnlockedChrome: false,
  })
})

test('a completed purchase clears blur immediately, before premium state finishes refreshing', () => {
  assert.deepEqual(getSavedProgressResultPresentation({ savedProgressCard: true, isPremium: false, hasUnlockedAccess: true }), {
    blurResultCard: false,
    showUnlockedChrome: true,
  })
})

test('fresh free scans keep the pre-unlock layout and premium saved results remain clear', () => {
  assert.deepEqual(getSavedProgressResultPresentation({ savedProgressCard: false, isPremium: false, hasUnlockedAccess: false }), {
    blurResultCard: false,
    showUnlockedChrome: false,
  })
  assert.deepEqual(getSavedProgressResultPresentation({ savedProgressCard: true, isPremium: true, hasUnlockedAccess: true }), {
    blurResultCard: false,
    showUnlockedChrome: true,
  })
})
