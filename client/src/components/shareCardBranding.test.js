import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const wordmarkPath = fileURLToPath(new URL('../assets/ascendus-wordmark.png', import.meta.url))

test('share card wordmark uses the supplied transparent horizontal lockup', () => {
  const png = readFileSync(wordmarkPath)

  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a')
  assert.equal(png.readUInt32BE(16), 214)
  assert.equal(png.readUInt32BE(20), 42)
  assert.equal(png[25] & 0b0100, 0b0100, 'wordmark PNG keeps its alpha channel')
})
