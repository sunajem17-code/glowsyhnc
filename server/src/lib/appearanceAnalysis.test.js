const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeAppearanceAnalysis } = require('./appearanceAnalysis')

test('normalizes primary scorer Pros and Cons into the saved results shape', () => {
  const result = normalizeAppearanceAnalysis({
    strengths: [{ title: 'Balanced symmetry', observation: 'Eyes and nose align near the midline.', significance: 'This gives the front view a cohesive read.', recommendation: 'Keep front-facing framing.' }],
    improvement_opportunities: Array.from({ length: 5 }, (_, index) => ({ title: `Jawline improvement ${index + 1}`, observation: `The lower face detail ${index + 1} is visible.`, significance: 'The lower face has less visible angular contrast.', recommendation: 'Try a specific grooming or styling change.' })),
    positive_observations: [],
  }, 'scan-123')

  assert.deepEqual(result, {
    version: 15,
    scanId: 'scan-123',
    strengths: [{ title: 'Balanced symmetry', observation: 'Eyes and nose align near the midline.', significance: 'This gives the front view a cohesive read.', recommendation: 'Keep front-facing framing.' }],
    improvementOpportunities: Array.from({ length: 5 }, (_, index) => ({ title: `Jawline improvement ${index + 1}`, observation: `The lower face detail ${index + 1} is visible.`, significance: 'The lower face has less visible angular contrast.', recommendation: 'Try a specific grooming or styling change.' })),
    positiveObservations: [],
  })
})

test('rejects a scorer response without actual Pros and Cons', () => {
  assert.throws(() => normalizeAppearanceAnalysis({ strengths: [], improvement_opportunities: [] }, 'scan-123'), /one to four Pros and at least five Cons/)
  assert.throws(() => normalizeAppearanceAnalysis({
    strengths: [{ title: 'Eyes', observation: 'Clear.', significance: 'Positive.', recommendation: 'Keep.' }],
    improvement_opportunities: Array.from({ length: 4 }, (_, index) => ({ title: `Upgrade ${index}`, observation: 'Visible.', significance: 'Matters.', recommendation: 'Try this.' })),
  }, 'scan-123'), /at least five cons/i)
})

test('preserves the scan ID value and type supplied by the scan route', () => {
  const analysis = normalizeAppearanceAnalysis({
    strengths: [{ title: 'Clear brow shape', observation: 'The brows have a clear edge.', significance: 'This frames the eyes.', recommendation: 'Keep the natural brow shape.' }],
    improvement_opportunities: Array.from({ length: 5 }, (_, index) => ({ title: `Brow shape ${index + 1}`, observation: 'The brow edge is visible.', significance: 'This frames the eyes.', recommendation: 'Trim stray hairs carefully.' })),
    positive_observations: [],
  }, 42)

  assert.equal(analysis.scanId, 42)
  assert.equal(typeof analysis.scanId, 'number')
})

test('rejects incomplete finding rows instead of saving blank points', () => {
  assert.throws(() => normalizeAppearanceAnalysis({
    strengths: [{ title: 'Symmetry', observation: '' }],
    improvement_opportunities: Array.from({ length: 5 }, (_, index) => ({ title: `Jawline ${index}`, observation: 'Soft edge.' })),
    positive_observations: [],
  }, 'scan-123'), /complete title and observation/)
})
