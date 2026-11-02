import test from 'node:test'
import assert from 'node:assert/strict'
import { createNativeCameraSession } from './nativeCameraSession.js'

test('replaces a camera left running across a web reload', async () => {
  let running = true
  const calls = []
  const session = createNativeCameraSession({
    async stop() { calls.push('stop'); running = false },
    async start(options) {
      assert.equal(running, false)
      calls.push(options.position)
      running = true
    },
  })
  const owner = Symbol()
  await session.open(owner, { position: 'front' })
  await session.close(owner)
  assert.deepEqual(calls, ['stop', 'front', 'stop'])
  assert.equal(running, false)
})

test('late cleanup cannot stop another overlay; startup and shutdown never overlap', async () => {
  let busy = false
  let position
  const session = createNativeCameraSession({
    async stop() { assert.equal(busy, false); busy = true; await Promise.resolve(); position = null; busy = false },
    async start(options) { assert.equal(busy, false); busy = true; await Promise.resolve(); position = options.position; busy = false },
  })
  const first = Symbol(), second = Symbol()
  await Promise.all([
    session.open(first, { position: 'front' }),
    session.open(second, { position: 'rear' }),
    session.close(first),
  ])
  assert.equal(position, 'rear')
  await session.close(second)
  assert.equal(position, null)
})

test('failed startup is cleaned up and does not poison the retry queue', async () => {
  let starts = 0
  const session = createNativeCameraSession({
    async stop() { throw new Error('camera already stopped') },
    async start() { if (++starts === 1) throw new Error('startup failed') },
  })
  const owner = Symbol()
  await assert.rejects(session.open(owner, {}), /startup failed/)
  await session.open(owner, {})
  assert.equal(starts, 2)
})
