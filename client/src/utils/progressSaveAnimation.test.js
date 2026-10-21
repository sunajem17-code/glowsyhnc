import test from 'node:test'
import assert from 'node:assert/strict'
import { getProgressSaveFlight } from './progressSaveAnimation.js'

test('saved results card flies from its current bounds to the center of the progress button', () => {
  const flight = getProgressSaveFlight(
    { left: 20, top: 100, width: 360, height: 500 },
    { left: 40, top: 700, width: 320, height: 64 },
  )

  assert.deepEqual(flight, {
    from: { left: 20, top: 100, width: 360, height: 500 },
    to: { left: 178, top: 710, width: 44, height: 44 },
  })
})
