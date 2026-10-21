import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveBackendOrigin } from './backend.js'

test('development keeps all backend calls on the Vite origin', () => {
  for (const value of [undefined, 'http://localhost:3002', 'https://example.com']) {
    assert.equal(resolveBackendOrigin(value, true), '')
  }
})

test('built clients preserve HTTP for local previews and normalize hosted origins', () => {
  assert.equal(resolveBackendOrigin('http://localhost:3002/'), 'http://localhost:3002')
  assert.equal(resolveBackendOrigin('example.com/'), 'https://example.com')
  assert.equal(resolveBackendOrigin(), 'https://glowsyhnc-production-e16b.up.railway.app')
})
