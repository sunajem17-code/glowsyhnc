const test = require('node:test')
const assert = require('node:assert/strict')
const { core } = require('./aiSchemas')

test('appearance findings require at least five Cons and keep Pros fewer than Cons', () => {
  const schema = core(true).properties.appearance_analysis

  assert.equal(schema.properties.strengths.type, 'array')
  assert.equal(schema.properties.strengths.maxItems, 4)
  assert.equal(schema.properties.improvement_opportunities.type, 'array')
  assert.equal(schema.properties.improvement_opportunities.minItems, 5)
  assert.equal(Object.hasOwn(schema.properties.improvement_opportunities, 'maxItems'), false)
  for (const key of ['strengths', 'improvement_opportunities', 'positive_observations']) {
    assert.equal(schema.properties[key].type, 'array')
  }

  const finding = schema.properties.strengths.items
  assert.deepEqual(Object.keys(finding.properties), ['title', 'observation', 'significance', 'recommendation'])
  assert.deepEqual(finding.required, ['title', 'observation', 'significance', 'recommendation'])
  assert.equal(finding.additionalProperties, false)
})
