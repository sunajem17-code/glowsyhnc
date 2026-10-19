import test from 'node:test'
import assert from 'node:assert/strict'
import { isLocalDeveloperPreview } from './developerUnlock.js'

test('developer preview unlock is only available in dev on loopback hosts', () => {
  assert.equal(isLocalDeveloperPreview(true, 'localhost'), true)
  assert.equal(isLocalDeveloperPreview(true, '127.0.0.1'), true)
  assert.equal(isLocalDeveloperPreview(false, 'localhost'), false)
  assert.equal(isLocalDeveloperPreview(true, 'ascendus.store'), false)
})
