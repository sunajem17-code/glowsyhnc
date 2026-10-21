import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLocalCoachPreviewReply } from './coachPreview.js'

test('local coach preview returns a useful reply without needing a server', () => {
  const reply = buildLocalCoachPreviewReply('What should I do for my skin?', { glowScore: 7.2 })
  assert.match(reply, /gentle cleanser/i)
  assert.match(reply, /SPF/i)
})

test('local coach preview includes scan context for general questions', () => {
  const reply = buildLocalCoachPreviewReply('What should I focus on?', { glowScore: 7.2 })
  assert.match(reply, /7\.2\/10/)
  assert.match(reply, /routine/i)
})

test('local coach preview has a safe fallback for unrecognized prompts', () => {
  const reply = buildLocalCoachPreviewReply('Tell me something', null)
  assert.match(reply, /scan/i)
  assert.match(reply, /sleep/i)
})
