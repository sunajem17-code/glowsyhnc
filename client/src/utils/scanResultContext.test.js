import test from 'node:test'
import assert from 'node:assert/strict'
import { getProgressCardReturnTo, getSafePostAuthDestination, getSavedProgressResultPresentation } from './scanResultContext.js'

test('post-auth navigation accepts only known internal destinations', () => {
  assert.equal(getSafePostAuthDestination('/progress'), '/progress')
  assert.equal(getSafePostAuthDestination('/unlock?paywall=1'), '/unlock?paywall=1')
  assert.equal(getSafePostAuthDestination('//outside.example'), '/scan')
  assert.equal(getSafePostAuthDestination('\\\\outside.example'), '/scan')
})

test('opening a saved Progress card remembers where its back button should return', () => {
  assert.equal(getProgressCardReturnTo({ source: 'progress-card', returnTo: '/timeline' }), '/timeline')
  assert.equal(getProgressCardReturnTo({ source: 'progress-card', returnTo: '/history' }), '/history')
  assert.equal(getProgressCardReturnTo({ source: 'progress-card', returnTo: '//outside.example' }), '/timeline')
  assert.equal(getProgressCardReturnTo({ source: 'progress-card', returnTo: '\\\\outside.example' }), '/timeline')
  assert.equal(getProgressCardReturnTo(null), null)
})

test('free saved Progress results keep normal results chrome while masking only the card', () => {
  assert.deepEqual(getSavedProgressResultPresentation({ savedProgressCard: true, isPremium: false, hasUnlockedAccess: true }), {
    blurResultCard: true,
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
