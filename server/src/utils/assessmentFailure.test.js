const test = require('node:test')
const assert = require('node:assert/strict')
const { assessmentFailureDetails } = require('./assessmentFailure')

test('assessment validation failures expose the rule reason without raw model content', () => {
  const details = assessmentFailureDetails(Object.assign(new Error('Missing score range'), { code: 'invalid_assessment' }))

  assert.deepEqual(details, { errorCode: 'invalid_assessment', reason: 'Missing score range' })
})

test('non-validation failures do not expose arbitrary error messages', () => {
  const details = assessmentFailureDetails(new Error('sensitive provider response'))

  assert.deepEqual(details, { errorCode: 'assessment_failed' })
})
