const test = require('node:test')
const assert = require('node:assert/strict')
const { communityScanScores } = require('./communityScanScores')

test('unpaid posts cannot expose ratings, even with supplied scores and scan IDs', async () => {
  const scores = await communityScanScores({ isPro: false, userId: 'owner', postType: 'glow-up', afterScanId: 'scan', scoreAfter: 9,
    ownedScan() { throw new Error('must not read locked ratings') } })
  assert.deepEqual(scores, { before: null, after: null })
})
test('paid posts use only results owned by the authenticated account', async () => {
  const calls = []
  const scores = await communityScanScores({ isPro: true, userId: 'owner', postType: 'glow-up', beforeScanId: 'foreign-scan', afterScanId: 'own-scan', scoreAfter: 10,
    async ownedScan(id, userId) {
      calls.push([id, userId])
      return id === 'own-scan' ? { result: { overallScore: 6.2 } } : null
    } })
  assert.deepEqual(scores, { before: null, after: 6.2 })
  assert.ok(calls.every(([, userId]) => userId === 'owner'))
})
test('question and rate-me posts do not expose saved AI scores', async () => {
  for (const postType of ['question', 'rate-me']) {
    assert.deepEqual(await communityScanScores({ isPro: true, postType, afterScanId: 'scan', ownedScan() { throw new Error('must not load scores') } }), { before: null, after: null })
  }
})
