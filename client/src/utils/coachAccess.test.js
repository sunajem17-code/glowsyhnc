import test from 'node:test'
import assert from 'node:assert/strict'
import { getCoachAccessMode } from './coachAccess.js'

test('local preview settings do not bypass server-authoritative premium access', () => {
  assert.equal(getCoachAccessMode({ isPremium: true, localPreviewEnabled: true }, true, 'localhost'), 'server')
})

test('local Pro Preview routes messages to the server for real AI replies', () => {
  assert.equal(getCoachAccessMode({ isPremium: false, localPreviewEnabled: true }, true, 'localhost'), 'server')
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
