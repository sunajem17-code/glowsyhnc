import test from 'node:test'
import assert from 'node:assert/strict'
import { getDisplayableAppearanceAnalysis, isCurrentAppearanceAnalysis } from '../client/src/utils/appearanceAnalysis.js'

const point = title => ({ title, observation: `Evidence for ${title}.` })

test('accepts current structured findings from the matching scan', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 11,
    scanId: 'scan-1',
    strengths: [point('Symmetry'), point('Proportions')],
    improvementOpportunities: [point('Skin texture'), point('Jaw definition')],
  }, 'scan-1'), true)
})

test('rejects production version-3 two-point analyses even when scan IDs match', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 3,
    scanId: 'scan-1',
    strengths: [point('Old pro one'), point('Old pro two')],
    improvementOpportunities: [point('Old con one'), point('Old con two')],
  }, 'scan-1'), false)
})

test('rejects incomplete findings and responses belonging to a different scan', () => {
  const analysis = { version: 11, scanId: 'scan-1', strengths: [point('Symmetry')], improvementOpportunities: [point('Skin')] }
  assert.equal(isCurrentAppearanceAnalysis(analysis, 'scan-2'), false)
  assert.equal(isCurrentAppearanceAnalysis({ ...analysis, improvementOpportunities: [{ title: 'No observation' }] }, 'scan-1'), false)
})

test('keeps older saved findings visible while refresh is pending or unavailable', () => {
  const saved = { version: 3, scanId: 'scan-1', strengths: [point('Saved symmetry'), point('Saved proportions')], improvementOpportunities: [point('Saved skin texture'), point('Saved jaw definition')] }
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', aiScore: { appearanceAnalysis: saved } }, 'scan-1')
  assert.deepEqual(visible.strengths.map(row => row.title), ['Saved symmetry', 'Saved proportions'])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Saved skin texture', 'Saved jaw definition'])
  assert.equal(isCurrentAppearanceAnalysis(saved, 'scan-1'), false)
})

test('uses scan-local legacy score bullets when a saved scan has no structured analysis', () => {
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', aiScore: {
    keyStrengths: ['Balanced symmetry', 'Clear cheekbones'],
    keyWeaknesses: ['Soft jawline', 'Uneven skin texture'],
  } }, 'scan-1')
  assert.deepEqual(visible.strengths.map(row => row.title), ['Balanced symmetry', 'Clear cheekbones'])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Soft jawline', 'Uneven skin texture'])
  assert.ok(visible.strengths.every(row => row.legacy))
})
