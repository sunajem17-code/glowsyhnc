import test from 'node:test'
import assert from 'node:assert/strict'
import { getCoachChatSendState, getMessageEntryMotion, getScanRequiredMessages, waitForMinimumCoachThinking, ADONIS_GREETING } from './coachChat.js'

test('an empty or in-flight message does not submit', () => {
  assert.equal(getCoachChatSendState({ text: '  ', hasScan: true }), 'ignore')
  assert.equal(getCoachChatSendState({ text: 'hello', hasScan: true, loading: true }), 'ignore')
})

test('a non-empty message without a scan asks for a scan instead of sending', () => {
  assert.equal(getCoachChatSendState({ text: 'help me', hasScan: false }), 'needs-scan')
})

test('a message sent without a scan is shown before Adonis asks for a scan', () => {
  assert.deepEqual(getScanRequiredMessages('help me'), [
    { role: 'user', content: 'help me' },
    { role: 'assistant', content: 'Please take a scan first so I can give you personalized coaching.' },
  ])
})

test('a non-empty message with a scan can be sent without a premium flag', () => {
  assert.equal(getCoachChatSendState({ text: 'help me', hasScan: true }), 'send')
})

test('sent user messages animate in from the right while coach replies enter from the left', () => {
  const userMotion = getMessageEntryMotion('user')
  const coachMotion = getMessageEntryMotion('assistant')
  assert.equal(userMotion.initial.x, 22)
  assert.equal(coachMotion.initial.x, -8)
  assert.deepEqual(userMotion.animate, { opacity: 1, x: 0, y: 0, scale: 1 })
})

test('Adonis greeting introduces the coach and asks what help is needed', () => {
  assert.equal(ADONIS_GREETING, "I'm Adonis, the coach you can ask anything. What do you need help with today?")
})

test('fast replies wait for the minimum thinking time', async () => {
  let waited = 0
  await waitForMinimumCoachThinking(100, {
    now: () => 250,
    wait: async ms => { waited = ms },
  })
  assert.equal(waited, 1850)
})

test('slow replies do not get an extra delay', async () => {
  let waited = false
  await waitForMinimumCoachThinking(100, {
    now: () => 2200,
    wait: async () => { waited = true },
  })
  assert.equal(waited, false)
})
