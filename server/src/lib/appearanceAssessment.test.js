const test = require('node:test')
const assert = require('node:assert/strict')
const { assessImageSuitability, validate, DIMENSIONS } = require('./appearanceAssessment')

const validSuitability = JSON.stringify({
  status: 'assessable',
  checks: Object.fromEntries(['lighting', 'headAngle', 'obstruction', 'filters', 'cameraDistortion']
    .map(key => [key, { status: 'clear', observation: 'The image is clear enough to assess.' }])),
  limitations: [],
  guidance: [],
  profileUsable: false,
})

test('retries once when the model suitability response omits its required status', async () => {
  const prompts = []
  const results = [JSON.stringify({ checks: {} }), validSuitability]
  const suitability = await assessImageSuitability({
    callModel: async prompt => { prompts.push(prompt); return results.shift() },
    faceImage: 'test-image',
    sideImage: null,
  })

  assert.equal(suitability.status, 'assessable')
  assert.equal(prompts.length, 2)
  assert.match(prompts[1], /previous response did not match the required JSON schema/i)
})

test('fails closed when both suitability responses have an invalid status', async () => {
  let calls = 0

  await assert.rejects(
    () => assessImageSuitability({ callModel: async () => { calls += 1; return '{}' }, faceImage: 'test-image' }),
    error => error.code === 'invalid_assessment' && error.message === 'Invalid image suitability'
  )

  assert.equal(calls, 2)
})

test('rejects a scored assessment when its written evidence explanation is missing', () => {
  const raw = {
    confidence: 'moderate',
    scoreRange: { min: 3.8, max: 4.2 },
    scoreExplanation: null,
    dimensions: Object.fromEntries(DIMENSIONS.map(key => [key, {
      status: 'broadly_average',
      evidenceLevel: 'ordinary',
      observation: 'Visible features appear broadly typical in this image.',
    }])),
    strengths: [],
    limitations: [],
    suggestions: [],
    unassessableDetails: [],
  }

  assert.throws(() => validate(raw, {
    assessmentProfile: 'male',
    imageSuitability: { status: 'assessable' },
    knownMinor: false,
  }), /requires a concise explanation/i)
})
