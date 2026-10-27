import test from 'node:test'
import assert from 'node:assert/strict'
import { isCurrentAppearanceAnalysis } from '../client/src/utils/appearanceAnalysis.js'

const point = title => ({ title, observation: `Evidence for ${title}.` })

test('accepts current structured findings from the matching scan', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 10,
    scanId: 'scan-1',
    strengths: [point('Symmetry'), point('Proportions')],
    improvementOpportunities: [point('Skin texture'), point('Jaw definition')],
  }, 'scan-1'), true)
})

test('rejects stale two-point server responses even when scan IDs match', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 9,
    scanId: 'scan-1',
    strengths: [point('Old pro one'), point('Old pro two')],
    improvementOpportunities: [point('Old con one'), point('Old con two')],
  }, 'scan-1'), false)
})

test('rejects incomplete findings and responses belonging to a different scan', () => {
  const analysis = { version: 10, scanId: 'scan-1', strengths: [point('Symmetry')], improvementOpportunities: [point('Skin')] }
  assert.equal(isCurrentAppearanceAnalysis(analysis, 'scan-2'), false)
  assert.equal(isCurrentAppearanceAnalysis({ ...analysis, improvementOpportunities: [{ title: 'No observation' }] }, 'scan-1'), false)
})
