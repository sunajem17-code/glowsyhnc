const test = require('node:test')
const assert = require('node:assert/strict')
const { calculatePotentialScore, withPotentialScore } = require('./potentialScore')

test('potential is calculated from the server scored overall and capped at ten', () => {
  assert.equal(calculatePotentialScore(6.1), 7.5)
  assert.equal(calculatePotentialScore(9.2), 10)
})

test('missing or invalid overall scores do not create a potential score', () => {
  assert.equal(calculatePotentialScore(null), null)
  assert.equal(calculatePotentialScore('not a score'), null)
})

test('cached scan results missing the field are backfilled server-side', () => {
  assert.deepEqual(withPotentialScore({ overallScore: 6.1 }), {
    overallScore: 6.1,
    potentialScore: 7.5,
  })
  assert.deepEqual(withPotentialScore({ overallScore: 6.1, potentialScore: 8.2 }), {
    overallScore: 6.1,
    potentialScore: 8.2,
  })
})
