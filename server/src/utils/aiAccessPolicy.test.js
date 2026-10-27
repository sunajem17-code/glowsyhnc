'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { isPublicDemoBlocked } = require('./aiAccessPolicy')

test('the public demo identity cannot use paid AI in production', () => {
  assert.equal(isPublicDemoBlocked(true, 'production'), true)
  assert.equal(isPublicDemoBlocked(true, 'development'), false)
  assert.equal(isPublicDemoBlocked(false, 'production'), false)
})
