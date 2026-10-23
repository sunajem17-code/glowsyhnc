import test from 'node:test'
import assert from 'node:assert/strict'
import { getProgressSaveFlight, getProgressSaveSequence } from './progressSaveAnimation.js'

test('saved results card flies from its current bounds into the centered archive slot', () => {
  const flight = getProgressSaveFlight(
    { left: 20, top: 100, width: 360, height: 500 },
    { width: 390, height: 844 },
  )

  assert.deepEqual(flight, {
    from: { left: 20, top: 100, width: 360, height: 500 },
    to: { left: 149, top: 358, width: 92, height: 128 },
  })
})

test('save flight is skipped when source or viewport geometry is unavailable', () => {
  assert.equal(getProgressSaveFlight(null, { width: 390, height: 844 }), null)
  assert.equal(getProgressSaveFlight({ left: 0, top: 0, width: 0, height: 300 }, { width: 390, height: 844 }), null)
  assert.equal(getProgressSaveFlight({ left: 0, top: 0, width: 300, height: 400 }, { width: 0, height: 844 }), null)
})

test('reduced-motion or missing source geometry shows the saved card in the archive instead of skipping to navigation', () => {
  const reducedMotionSequence = getProgressSaveSequence(
    { left: 20, top: 100, width: 360, height: 500 },
    { width: 390, height: 844 },
    true,
  )
  assert.deepEqual(reducedMotionSequence, {
    from: { left: 149, top: 358, width: 92, height: 128 },
    to: { left: 149, top: 358, width: 92, height: 128 },
    phase: 'saved',
    holdMs: 1400,
    animateCard: false,
  })

  const missingSourceSequence = getProgressSaveSequence(null, { width: 390, height: 844 }, false)
  assert.deepEqual(missingSourceSequence, reducedMotionSequence)
})
