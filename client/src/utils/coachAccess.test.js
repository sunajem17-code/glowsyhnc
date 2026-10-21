import test from 'node:test'
import assert from 'node:assert/strict'
import { getCoachAccessMode } from './coachAccess.js'

test('local Pro Preview sends Adonis to local preview instead of the paid server route', () => {
  assert.equal(getCoachAccessMode({ isPremium: true, localPreviewEnabled: true }, true, 'localhost'), 'local-preview')
})

test('paid accounts continue to use the server coach', () => {
  assert.equal(getCoachAccessMode({ isPremium: true, localPreviewEnabled: false }, false, 'ascendus.store'), 'server')
})

test('free accounts without local preview remain gated', () => {
  assert.equal(getCoachAccessMode({ isPremium: false, localPreviewEnabled: false }, true, 'localhost'), 'paywall')
})

test('local preview cannot enable the coach outside local development', () => {
  assert.equal(getCoachAccessMode({ isPremium: false, localPreviewEnabled: true }, true, 'ascendus.store'), 'paywall')
})
