import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProductionEvidence, requestProductionAnalysis } from './productionAnalysis.js'
import { withDeadline } from './requestTimeout.js'

// Synthetic geometry is confined to this test. No fixture is used by the app.
function frontLandmarks() {
  const points = Array.from({ length: 468 }, () => ({ x: .5, y: .5, z: 0 }))
  for (const [i, x, y] of [
    [10,.5,.18],[152,.5,.9],[234,.25,.5],[454,.75,.5],
    [172,.3,.75],[397,.7,.75],[176,.43,.84],[400,.57,.84],
    [33,.32,.4],[133,.43,.4],[159,.375,.385],[145,.375,.415],
    [362,.57,.4],[263,.68,.4],[386,.625,.385],[374,.625,.415],
    [98,.46,.56],[327,.54,.56],[1,.5,.55],[2,.5,.61],
    [61,.42,.68],[291,.58,.68],[0,.5,.655],[13,.5,.665],
    [14,.5,.685],[17,.5,.695],[105,.38,.33],[334,.62,.33],
  ]) points[i] = { x, y, z: 0 }
  return points
}

async function evidenceFor(t, sideProfileGeometry = null) {
  const originalImage = globalThis.Image
  t.after(() => { globalThis.Image = originalImage })
  globalThis.Image = class {
    naturalWidth = 1000
    naturalHeight = 1500
    set src(_) { queueMicrotask(() => this.onload()) }
  }
  return buildProductionEvidence({ frontImage: 'isolated-front', frontLandmarks: frontLandmarks(), sideProfileGeometry })
}
// Node has no browser Image constructor.
globalThis.Image ??= class {}

test('missing profile landmarks still sends both photos and returns the API result unchanged', async t => {
  const evidence = await evidenceFor(t)
  assert.equal(evidence.status, 'measured')
  assert.equal(evidence.profile.status, 'not_assessable')
  assert.deepEqual(evidence.profile.measurements, [])
  let payload
  const response = { scanId: 'isolated-test-scan', overallScore: 6.2, profileScore: 6.1, visualObservations: ['test observation'], appearanceAnalysis: currentAppearance('isolated-test-scan') }
  const result = await requestProductionAnalysis({
    faceImage: 'isolated-front', sideImage: 'isolated-side', evidence,
    apiClient: { ai: { score: async input => { payload = input; return response } } },
  })
  assert.equal(payload.sideImage, 'isolated-side')
  assert.equal(payload.faceImage, 'isolated-front')
  assert.equal(payload.sideProfileGeometry, undefined)
  assert.equal(payload.analysisEvidence.profile.status, 'not_assessable')
  assert.equal(result.scanId, response.scanId)
  assert.equal(result.overallScore, response.overallScore)
  assert.equal(result.profileScore, response.profileScore)
  assert.deepEqual(result.analysisEvidence.categories.observed, response.visualObservations)
})

test('successful native profile measurements remain in the request', async t => {
  const geometry = { detected: true, facialConvexityDegrees: 168.25 }
  const evidence = await evidenceFor(t, geometry)
  assert.equal(evidence.profile.status, 'measured')
  let payload
  await requestProductionAnalysis({ faceImage: 'front', sideImage: 'side', evidence, sideProfileGeometry: geometry,
    apiClient: { ai: { score: async input => { payload = input; return { scanId: 'fixture', appearanceAnalysis: currentAppearance('fixture') } } } },
  })
  assert.equal(payload.sideProfileGeometry.facialConvexityDegrees, 168.25)
})

test('unreliable front geometry still blocks analysis', async () => {
  let called = false
  await assert.rejects(requestProductionAnalysis({ evidence: { status: 'additional_image_required' },
    apiClient: { ai: { score: async () => { called = true } } },
  }), error => error.errorCode === 'analysis_quality_failed')
  assert.equal(called, false)
})

test('API failure is propagated instead of creating a successful result', async t => {
  const evidence = await evidenceFor(t)
  const error = new Error('Provider unavailable')
  await assert.rejects(requestProductionAnalysis({ evidence,
    apiClient: { ai: { score: async () => { throw error } } },
  }), error)
})

test('an unresponsive analysis times out and a subsequent retry succeeds', async t => {
  const evidence = await evidenceFor(t)
  await assert.rejects(requestProductionAnalysis({ evidence, timeoutMs: 5,
    apiClient: { ai: { score: () => new Promise(() => {}) } },
  }), /Analysis timed out/)
  const retry = await requestProductionAnalysis({ evidence,
    apiClient: { ai: { score: async () => ({ scanId: 'retry-result', appearanceAnalysis: currentAppearance('retry-result') }) } },
  })
  assert.equal(retry.scanId, 'retry-result')
})

function currentAppearance(scanId) {
  const finding = title => ({ title, observation: `${title} is visible in the scan.`, significance: 'This changes how the face reads.', recommendation: 'Try one simple, safe change.' })
  return { version: 7, scanId, strengths: [finding('Clear eyes')], improvementOpportunities: [finding('Soft jaw edge')], positiveObservations: [] }
}

test('keeps a scored scan usable when detailed Pros and Cons need to load from the results card', async t => {
  const evidence = await evidenceFor(t)
  let fallbackCalled = false
  const result = await requestProductionAnalysis({ faceImage: 'data:image/jpeg;base64,QUJD', evidence,
    apiClient: {
      ai: { score: async () => ({ scanId: 'scan-needing-advice', overallScore: 6.2, faceSubScores: { symmetry: 6.5 } }) },
      coach: { appearance: async () => { fallbackCalled = true; throw new Error('fallback should load from the results card') } },
    },
  })
  assert.equal(result.scanId, 'scan-needing-advice')
  assert.equal(result.overallScore, 6.2)
  assert.equal(result.appearanceAnalysis, undefined)
  assert.equal(fallbackCalled, false)
})

test('uses scan-embedded Pros and Cons without a second appearance request', async t => {
  const evidence = await evidenceFor(t)
  let fallbackCalled = false
  const advice = currentAppearance('scan-with-embedded-advice')
  const result = await requestProductionAnalysis({ faceImage: 'data:image/jpeg;base64,QUJD', evidence,
    apiClient: {
      ai: { score: async () => ({ scanId: advice.scanId, overallScore: 6.2, appearanceAnalysis: advice }) },
      coach: { appearance: async () => { fallbackCalled = true; throw new Error('embedded advice should be used') } },
    },
  })
  assert.deepEqual(result.appearanceAnalysis, advice)
  assert.equal(fallbackCalled, false)
})

test('optional detection deadline rejects a stuck detector and accepts successful detection', async () => {
  await assert.rejects(withDeadline(new Promise(() => {}), 5, 'Optional profile geometry timed out'), /profile geometry timed out/)
  assert.deepEqual(await withDeadline(Promise.resolve({ detected: true }), 1000, 'timeout'), { detected: true })
})

test('deadline clears its timer when an operation succeeds or fails', async t => {
  const clear = t.mock.method(globalThis, 'clearTimeout')
  await withDeadline(Promise.resolve('result'), 1000, 'timeout')
  await assert.rejects(withDeadline(Promise.reject(new Error('failure')), 1000, 'timeout'), /failure/)
  assert.equal(clear.mock.callCount(), 2)
})
