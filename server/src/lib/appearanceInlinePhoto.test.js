const test = require('node:test')
const assert = require('node:assert/strict')

const memoryDb = { prepare: () => ({ get: () => null, run: () => { throw new Error('inline-only refresh must not write a database row') } }) }
function stub(name, exports) {
  const id = require.resolve(name)
  require.cache[id] = { id, filename: id, loaded: true, exports }
}
stub('../db', memoryDb)
stub('../supabase', { getSupabase: () => null })
stub('./aiProvider', { createAIClient: () => { throw new Error('test must use its injected AI client') } })
stub('./coachScanContext', {
  ownedResult: () => null,
  ownedCoachScan: async () => null,
  normalize: () => null,
  imageForScan: async () => null,
  clean: value => value,
  timeout: promise => promise,
})
stub('./appearanceDiagnostics', { recordAppearanceCounts: () => {} })

const { getBreakdown } = require('./appearanceBreakdown')
const photo = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'private-test-photo' } }
const finding = (title, observation) => ({
  guideId: 'none', title, observation, significance: 'Supports a clearer scan review.', recommendation: 'Use the same photo setup next time.',
  confidence: 'medium', basedOn: ['photo:front'],
})
const response = {
  photoQuality: { status: 'clear', reason: 'Even light.', retakeSteps: [] },
  strengths: [finding('Balanced symmetry', 'The visible facial midline appears balanced.')],
  improvementOpportunities: [finding('Soft jaw definition', 'The jaw edge is not clearly defined in this view.')],
  positiveObservations: [], recommendedActions: [], products: [], limitations: [],
}

test('authenticated device-only scan can refresh from its inline photo without inventing a server-owned row', async () => {
  let sentPhoto
  const analysis = await getBreakdown('alice', 'scan-local-123', {
    find: async () => null,
    providedPhoto: photo,
    scanScores: { faceSubScores: { jawlineDefinition: 4.7, symmetry: 5.8, unrelated: 10.5 }, pillars: { harmony: 7.2 } },
    client: { generate: async request => {
      sentPhoto = request.messages[0].content[0]
      const prompt = JSON.parse(request.messages[0].content[1].text)
      assert.deepEqual(prompt.savedScores, {}) // No device score is authoritative.
      return { content: [{ type: 'text', text: JSON.stringify(response) }] }
    } },
  })

  assert.deepEqual(sentPhoto, photo)
  assert.equal(analysis.scanId, 'scan-local-123')
  assert.equal(analysis.source, 'device_scan_photo')
  assert.equal(analysis.strengths.length, 1)
  assert.equal(analysis.improvementOpportunities.length, 1)
})

test('an unknown scan without its original inline photo remains unavailable', async () => {
  await assert.rejects(getBreakdown('alice', 'scan-local-123', { find: async () => null }), { status: 404 })
})
