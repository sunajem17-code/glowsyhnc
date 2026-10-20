import test from 'node:test'
import assert from 'node:assert/strict'
import { getDeveloperRefreshState, isDeveloperRefreshAvailable } from './developerRefresh.js'

test('developer refresh is restricted to local development hosts', () => {
  assert.equal(isDeveloperRefreshAvailable(true, 'localhost'), true)
  assert.equal(isDeveloperRefreshAvailable(true, '127.0.0.1'), true)
  assert.equal(isDeveloperRefreshAvailable(false, 'localhost'), false)
  assert.equal(isDeveloperRefreshAvailable(true, 'ascendus.store'), false)
})

test('developer refresh clears local scan flow while preserving onboarding and account state', () => {
  const reset = getDeveloperRefreshState()
  assert.deepEqual(reset.scans, [])
  assert.equal(reset.currentScan, null)
  assert.equal(reset.currentPlan, null)
  assert.equal(reset.scanCount, 0)
  assert.equal(reset.pendingAchievement, null)
  assert.equal('hasOnboarded' in reset, false)
  assert.equal('isPremium' in reset, false)
  assert.equal('token' in reset, false)
})

