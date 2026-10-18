import test from 'node:test'
import assert from 'node:assert/strict'
import { waitingFrame, waitingTextOpacity, SCAN_WAITING_MESSAGES } from './scanWaiting.js'

test('waiting text reveals the requested lines in order with a synchronized percentage', () => {
  assert.deepEqual(waitingFrame(0, true), { index: 0, characters: 0, progress: 0, done: false })
  assert.deepEqual(waitingFrame(55, true), { index: 0, characters: 1, progress: 0, done: false })
  assert.equal(waitingFrame(3305, true).index, 1)
  assert.equal(waitingFrame(6050, true).index, 2)
  assert.equal(waitingFrame(8420, true).index, 3)
  assert.equal(waitingFrame(11835, true).index, 4)
  assert.deepEqual(waitingFrame(16230, true), { index: 5, characters: 18, progress: 100, done: true })
})

test('ellipsis dots appear individually with a readable pause between them', () => {
  for (const [elapsed, expected] of [[3910, 'Small steps'], [4090, 'Small steps.'], [4270, 'Small steps..'], [4450, 'Small steps...']]) {
    const frame = waitingFrame(elapsed, true)
    assert.equal(SCAN_WAITING_MESSAGES[frame.index].slice(0, frame.characters), expected)
  }
})

test('waits at the final prompt until scan results are ready', () => {
  assert.deepEqual(waitingFrame(120000, false), { index: 4, characters: 26, progress: 94, done: false })
})

test('completed text holds, fades away, then the next line starts empty without overlap', () => {
  assert.equal(waitingFrame(1705, true).characters, 31)
  assert.equal(waitingTextOpacity(2955, true), 1)
  assert.equal(waitingTextOpacity(3130, true), 0.5)
  assert.equal(waitingFrame(3305, true).characters, 0)
  assert.equal(waitingTextOpacity(3305, true), 1)
  assert.equal(waitingTextOpacity(120000, false), 1)
})
