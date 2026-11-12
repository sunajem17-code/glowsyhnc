import test from 'node:test'
import assert from 'node:assert/strict'
import { createPostHogAnalytics, sanitizePostHogEvent } from './posthogAnalytics.js'

function fixture(config = {}) {
  const calls = []
  const sdk = Object.fromEntries(['init', 'opt_out_capturing', 'opt_in_capturing', 'capture'].map(name => [name, (...args) => calls.push([name, ...args])]))
  return { calls, adapter: createPostHogAnalytics(sdk, { token: 'test-token', host: 'https://us.i.posthog.com', platform: 'ios', ...config }) }
}
test('missing configuration never initializes or captures', () => {
  const { calls, adapter } = fixture({ token: '' })
  adapter.setEnabled(true); adapter.capture('screen_view', { screen_name: '/scan' })
  assert.equal(calls.length, 0)
})
test('privacy toggle gates captures and reuses one SDK instance', () => {
  const { calls, adapter } = fixture()
  adapter.capture('screen_view')
  assert.equal(calls.length, 0)
  adapter.setEnabled(true); adapter.capture('screen_view', { screen_name: '/scan', photo: 'private' })
  adapter.setEnabled(false); adapter.capture('screen_view')
  adapter.setEnabled(true); adapter.capture('screen_view', { screen_name: '/plan' })
  assert.equal(calls.filter(c => c[0] === 'init').length, 1)
  assert.equal(calls.filter(c => c[0] === 'capture').length, 2)
  assert.ok(calls.some(c => c[0] === 'opt_out_capturing'))
  assert.equal(calls.find(c => c[0] === 'init')[2].disable_session_recording, true)
  assert.equal(calls.find(c => c[0] === 'capture')[2].photo, undefined)
})
test('outbound filter strips URLs, identities and scan data and rejects automatic events', () => {
  const clean = sanitizePostHogEvent({ event: 'screen_view', properties: {
    distinct_id: 'anonymous-id', screen_name: '/scan', '$current_url': 'https://x/?token=private',
    '$set': { email: 'private' }, photo: 'private', score: 5, email: 'private',
  } })
  assert.deepEqual(clean.properties, { distinct_id: 'anonymous-id', screen_name: '/scan' })
  assert.equal(sanitizePostHogEvent({ event: '$autocapture', properties: {} }), null)
})
test('outbound filter keeps the project token so PostHog accepts the event', () => {
  const clean = sanitizePostHogEvent({ event: 'screen_view', properties: { token: 'phc_test', distinct_id: 'a', screen_name: '/scan' } })
  assert.equal(clean.properties.token, 'phc_test')
})

test('SDK failures do not break application flow', () => {
  const adapter = createPostHogAnalytics({ init() { throw new Error('offline') } }, { token: 'test', host: 'https://us.i.posthog.com' })
  assert.doesNotThrow(() => { adapter.setEnabled(true); adapter.capture('screen_view') })
})
