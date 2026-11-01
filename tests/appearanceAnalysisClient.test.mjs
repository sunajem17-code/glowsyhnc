import test from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentAppearanceAnalysis, getDisplayableAppearanceAnalysis, isCurrentAppearanceAnalysis } from '../client/src/utils/appearanceAnalysis.js'

const point = title => ({
  title,
  observation: `Evidence for ${title}.`,
  significance: `${title} affects how the face reads.`,
  recommendation: `Try one simple change related to ${title.toLowerCase()}.`,
})

test('accepts current structured findings from the matching scan', () => {
  assert.equal(isCurrentAppearanceAnalysis({
    version: 11,
    scanId: 'scan-1',
    strengths: [point('Symmetry'), point('Proportions')],
    improvementOpportunities: [point('Skin texture'), point('Jaw definition')],
  }, 'scan-1'), true)
})

test('accepts version-7 advice embedded in the primary scan response', () => {
  const analysis = {
    version: 7,
    scanId: 'scan-1',
    strengths: [{ ...point('Balanced eyes'), significance: 'This gives the face a calm look.', recommendation: 'Keep the brow hairs tidy.' }],
    improvementOpportunities: [{ ...point('Soft jaw edge'), significance: 'The lower face reads less sharp.', recommendation: 'Ask for a low taper with less width at the sides.' }],
  }

  assert.equal(isCurrentAppearanceAnalysis(analysis, 'scan-1'), true)
  const visible = getDisplayableAppearanceAnalysis({ id: 'local-scan', serverScanId: 'scan-1', aiScore: { appearanceAnalysis: analysis } }, 'scan-1')
  assert.equal(visible.strengths[0].recommendation, analysis.strengths[0].recommendation)
  assert.equal(visible.improvementOpportunities[0].recommendation, analysis.improvementOpportunities[0].recommendation)
})

test('does not surface stale or legacy advice while waiting for current scan tips', () => {
  const stale = { version: 3, scanId: 'scan-1', strengths: [point('Old symmetry')], improvementOpportunities: [point('Old jawline')] }
  const scan = { id: 'scan-1', aiScore: { appearanceAnalysis: stale, keyStrengths: ['Old bullet'], keyWeaknesses: ['Old weakness'] } }

  assert.equal(getCurrentAppearanceAnalysis(scan, 'scan-1'), null)
})

test('returns complete current scan tips for immediate display', () => {
  const analysis = { version: 7, scanId: 'scan-1', strengths: [point('Balanced eyes')], improvementOpportunities: [point('Soft jaw edge')] }
  const scan = { id: 'local-scan', serverScanId: 'scan-1', aiScore: { appearanceAnalysis: analysis } }

  assert.deepEqual(getCurrentAppearanceAnalysis(scan, 'scan-1'), { ...analysis, positiveObservations: [] })
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

test('does not mix legacy score summaries into an existing structured analysis', () => {
  const structured = {
    version: 11,
    scanId: 'scan-1',
    strengths: [point('Clear brow shape')],
    improvementOpportunities: [point('Jawline clarity')],
  }
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', aiScore: {
    appearanceAnalysis: structured,
    keyStrengths: ['Old one-line strength'],
    keyWeaknesses: ['Old one-line weakness'],
  } }, 'scan-1')

  assert.deepEqual(visible.strengths.map(row => row.title), ['Clear brow shape'])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Jawline clarity'])
})

test('moves clearly negative caveats out of Pros into Cons', () => {
  const mixedFinding = {
    title: 'Moderate lower-face presence',
    observation: 'The jaw and chin are visible, but the lower face does not look especially sharp or strongly defined. It is not the dominant feature here.',
    significance: 'The lower-face outline is less defined than the upper face.',
    recommendation: 'If you want a crisper look, try a tidier hairstyle.',
  }
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', aiScore: {
    appearanceAnalysis: {
      version: 11,
      scanId: 'scan-1',
      strengths: [point('Clear brow shape'), mixedFinding],
      improvementOpportunities: [],
    },
  } }, 'scan-1')

  assert.deepEqual(visible.strengths.map(row => row.title), ['Clear brow shape'])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Moderate lower-face presence'])
})

test('does not duplicate a moved finding when Cons already covers the same face area', () => {
  const mixedFinding = {
    title: 'Moderate lower-face presence',
    observation: 'The lower face does not look especially sharp or strongly defined.',
    significance: 'The lower-face outline is less defined than the upper face.',
    recommendation: 'If you want a crisper look, try a tidier hairstyle.',
  }
  const existingCons = point('Lower-face definition')
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', aiScore: {
    appearanceAnalysis: {
      version: 11,
      scanId: 'scan-1',
      strengths: [mixedFinding],
      improvementOpportunities: [existingCons],
    },
  } }, 'scan-1')

  assert.deepEqual(visible.strengths, [])
  assert.deepEqual(visible.improvementOpportunities.map(row => row.title), ['Lower-face definition'])
})

test('keeps more than six distinct structured findings in both categories', () => {
  const many = (prefix, count) => Array.from({ length: count }, (_, index) => ({
    title: `${prefix} ${index + 1}`,
    observation: `Distinct photo evidence for ${prefix.toLowerCase()} ${index + 1}.`,
    significance: `This ${prefix.toLowerCase()} detail affects the overall look.`,
    recommendation: `Try one safe change related to ${prefix.toLowerCase()} ${index + 1}.`,
  }))
  const structured = {
    version: 12,
    scanId: 'scan-1',
    strengths: many('Strength', 8),
    improvementOpportunities: many('Improvement', 9),
  }
  const visible = getDisplayableAppearanceAnalysis({ id: 'scan-1', aiScore: { appearanceAnalysis: structured } }, 'scan-1')

  assert.equal(isCurrentAppearanceAnalysis(structured, 'scan-1'), true)
  assert.equal(visible.strengths.length, 8)
  assert.equal(visible.improvementOpportunities.length, 9)
})

test('hides internal photo evidence labels from reader-facing finding text', () => {
  const source = { id: 'scan-1', aiScore: { appearanceAnalysis: {
    version: 12,
    scanId: 'scan-1',
    strengths: [{ title: 'In photo:front, strong symmetry', observation: 'In photo:front, the eyes sit evenly.', significance: 'This makes the face read balanced.', recommendation: 'Keep grooming even.' }],
    improvementOpportunities: [{ title: 'Jaw definition', observation: 'In photo:front, the jaw edge looks soft.', significance: 'The lower face reads less sharp.', recommendation: 'Try a haircut with less volume at the sides.' }],
  } } }
  const visible = getDisplayableAppearanceAnalysis(source, 'scan-1')
  assert.equal(visible.strengths[0].title, 'Strong symmetry')
  assert.equal(visible.strengths[0].observation, 'The eyes sit evenly.')
  assert.equal(visible.improvementOpportunities[0].observation, 'The jaw edge looks soft.')
  assert.ok(!JSON.stringify(visible).includes('photo:front'))
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
