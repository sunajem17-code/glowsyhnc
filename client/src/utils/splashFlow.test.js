import test from 'node:test'
import assert from 'node:assert/strict'
import { getSplashCopy, getStartupSplash } from './splashFlow.js'

test('startup goes from the cinematic intro to one welcome splash, then into the app', () => {
  assert.equal(getStartupSplash({ cinematicDone: false, splashDone: false }), 'cinematic')
  assert.equal(getStartupSplash({ cinematicDone: true, splashDone: false }), 'welcome')
  assert.equal(getStartupSplash({ cinematicDone: true, splashDone: true }), 'app')
})

test('cinematic ends on the message and reserves the brand for the welcome splash', () => {
  const copy = getSplashCopy()
  assert.deepEqual(copy.cinematicLines, [
    'You know you can improve',
    'But where should you start?',
    'Find your starting point with...',
  ])
  assert.equal(copy.cinematicBrandText, null)
  assert.equal(copy.cinematicSubtitle, null)
  assert.equal(copy.welcomeTitle, 'ASCENDUS')
  assert.equal(copy.welcomeSubtitle, 'Your journey starts here')
})
