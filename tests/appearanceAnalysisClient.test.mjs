import test from 'node:test'
import assert from 'node:assert/strict'
import { getDisplayableAppearanceAnalysis, isCurrentAppearanceAnalysis } from '../client/src/utils/appearanceAnalysis.js'
import { getValidatedFaceRecommendations } from '../client/src/utils/scanRoutineRecommendations.js'

const point = title => ({ title, observation: `Evidence for ${title}.` })

test('accepts current structured findings from the matching scan', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 15,
    scanId: 'scan-1',
    strengths: [point('Symmetry'), point('Proportions')],
    improvementOpportunities: [point('Skin texture'), point('Jaw definition')],
  }, 'scan-1'), true)
})

test('face routine reuses only current scan-linked actionable findings', () => {
  const scan = { id: 'local-scan-1', serverScanId: 'scan-1', aiScore: { appearanceAnalysis: {
    version: 15,
    scanId: 'scan-1',
    strengths: [point('Balanced symmetry')],
    improvementOpportunities: [{ ...point('Improve skin texture'), recommendation: 'Start with a gentle cleanser, moisturizer, and SPF 30+ each morning.' }],
  } } }
  assert.deepEqual(getValidatedFaceRecommendations(scan).map(item => ({ title: item.title, recommendation: item.recommendation, source: item.source })), [
    { title: 'Improve skin texture', recommendation: 'Start with a gentle cleanser, moisturizer, and SPF 30+ each morning.', source: 'Face scan' },
  ])
  assert.deepEqual(getValidatedFaceRecommendations({ ...scan, aiScore: { appearanceAnalysis: { ...scan.aiScore.appearanceAnalysis, version: 11 } } }), [])
  assert.deepEqual(getValidatedFaceRecommendations({ ...scan, aiScore: { appearanceAnalysis: { ...scan.aiScore.appearanceAnalysis, scanId: 'other-scan' } } }), [])
})

test('rejects stale two-point server responses even when scan IDs match', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 10,
    scanId: 'scan-1',
    strengths: [point('Old pro one'), point('Old pro two')],
    improvementOpportunities: [point('Old con one'), point('Old con two')],
  }, 'scan-1'), false)
})

test('rejects incomplete findings and responses belonging to a different scan', () => {
  const analysis = { version: 15, scanId: 'scan-1', strengths: [point('Symmetry')], improvementOpportunities: [point('Skin')] }
  assert.equal(isCurrentAppearanceAnalysis(analysis, 'scan-2'), false)
  assert.equal(isCurrentAppearanceAnalysis({ ...analysis, improvementOpportunities: [{ title: 'No observation' }] }, 'scan-1'), false)
})

test('does not treat a new analysis with an empty Pros array as current', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 15,
    scanId: 'scan-1',
    strengths: [],
    improvementOpportunities: [point('Skin texture')],
  }, 'scan-1'), false)
})

test('reanalysis version 15 treats saved version 14 wording as stale', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 14,
    scanId: 'scan-1',
    strengths: [point('Eye area is even and unobstructed')],
    improvementOpportunities: [point('Midface proportions look workable')],
  }, 'scan-1'), false)
})

test('keeps older saved findings visible while refresh is pending or unavailable', () => {
  const saved = { version: 10, scanId: 'scan-1', strengths: [point('Saved symmetry'), point('Saved proportions')], improvementOpportunities: [point('Saved skin texture'), point('Saved jaw definition')] }
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

test('structured findings replace legacy score bullets instead of being appended to them', () => {
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', aiScore: {
    appearanceAnalysis: { version: 12, strengths: [point('Balanced symmetry'), point('Defined cheekbones')], improvementOpportunities: [point('Soft jawline')] },
    keyStrengths: ['Overall facial balance', 'Symmetry is fairly balanced', 'Clear cheekbones'],
    keyWeaknesses: ['Improve jawline definition', 'Lower-face definition could improve'],
  } }, 'scan-1')
  assert.deepEqual(visible.strengths.map(row => row.title), ['Balanced symmetry', 'Defined cheekbones'])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Soft jawline'])
})

test('semantic dedup removes true overlap while retaining distinct supported findings', () => {
  const scan = { id: 'scan-1', aiScore: { appearanceAnalysis: {
    strengths: [point('Overall facial balance'), point('Symmetry is fairly balanced'), point('Balanced eye spacing')],
    improvementOpportunities: [point('Features read as moderately defined'), point('Midface proportions look workable'), point('Enhance midface proportions')],
  } } }
  const visible = getDisplayableAppearanceAnalysis(scan, 'scan-1')
  assert.deepEqual(visible.strengths.map(row => row.title), ['Symmetry is fairly balanced', 'Balanced eye spacing'])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Features read as moderately defined', 'Enhance midface proportions'])
})

test('keeps valid saved scan findings visible while the improved analysis refresh is pending', () => {
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', appearanceAnalysis: {
    strengths: [point('Eye area is even and unobstructed'), point('Skin looks reasonably clear'), point('Balanced eye spacing')],
    improvementOpportunities: [point('Features read as moderately defined')],
  } }, 'scan-1')
  assert.deepEqual(visible.strengths.map(row => row.title), [
    'Eye area is even and unobstructed', 'Skin looks reasonably clear', 'Balanced eye spacing',
  ])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Features read as moderately defined'])
})

test('deduplicates overlapping features but preserves distinct findings regardless of wording', () => {
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', appearanceAnalysis: {
    strengths: [], improvementOpportunities: [
      point('Jawline looks soft in this angle'),
      point('Lower face is partially compressed by posture'),
      point('Angularity is limited'),
      point('Under-eye area looks slightly tired'),
      point('Expression softens definition'),
    ],
  } }, 'scan-1')
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), [
    'Jawline looks soft in this angle', 'Lower face is partially compressed by posture',
    'Angularity is limited', 'Under-eye area looks slightly tired', 'Expression softens definition',
  ])
})

test('preserves five distinct Pros after removing two repeated balance observations', () => {
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', appearanceAnalysis: {
    strengths: [
      point('Overall facial balance'), point('Balanced symmetry'), point('Symmetry is fairly balanced'),
      point('Balanced eye spacing'), point('Clear cheekbone structure'), point('Even skin tone'), point('Defined chin proportions'),
    ],
    improvementOpportunities: [point('Soft jawline')],
  } }, 'scan-1')
  assert.deepEqual(visible.strengths.map(row => row.title), [
    'Balanced symmetry', 'Balanced eye spacing', 'Clear cheekbone structure', 'Even skin tone', 'Defined chin proportions',
  ])
})

test('uses saved score bullets when structured findings were filtered to empty', () => {
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', aiScore: {
    appearanceAnalysis: { version: 15, strengths: [], improvementOpportunities: [] },
    keyStrengths: ['Balanced symmetry', 'Defined cheekbones'],
    keyWeaknesses: ['Soft jawline'],
  } }, 'scan-1')
  assert.deepEqual(visible.strengths.map(row => row.title), ['Balanced symmetry', 'Defined cheekbones'])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Soft jawline'])
})
