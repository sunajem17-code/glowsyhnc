import test from 'node:test'
import assert from 'node:assert/strict'
import { getShareCardCaptureSize, getShareCardMetrics, SHARE_CARD_BRAND_LAYOUT } from './shareCardDimensions.js'
import { REVEAL_RATINGS_LAYOUT, SHARE_RATINGS_LAYOUT } from './revealRatingsLayout.js'
import { getCenteredSquareCrop } from './shareCardPhoto.js'

test('share cards export at TikTok-ready 4K portrait resolution', () => {
  assert.deepEqual(getShareCardCaptureSize(), { width: 2160, height: 3840, scale: 6 })
})

test('share card wordmark sits directly below the score panel with tracked brand lettering', () => {
  assert.deepEqual(SHARE_CARD_BRAND_LAYOUT, {
    marginTop: 16,
    fontSize: 15,
    letterSpacing: '0.22em',
  })
})

test('share card metrics mirror the current Results screen without legacy metric substitutions', () => {
  const metrics = getShareCardMetrics({
    glowScore: 7.1,
    potentialScore: 8.5,
    aiScore: { faceMetrics: {
      symmetry: { score: 6.9 }, skinQuality: { score: 7.6 },
      jawline: { score: 6.7 }, cheekbones: { score: 6.8 },
    } },
  })
  assert.deepEqual(metrics.map(({ label, value }) => [label, value]), [
    ['Overall', 7.1], ['Potential', 8.5], ['Symmetry', 6.9],
    ['Skin Quality', 7.6], ['Jawline', 6.7], ['Cheekbones', 6.8],
  ])
})

test('share ratings use the same grid geometry as the live results ratings', () => {
  assert.deepEqual(REVEAL_RATINGS_LAYOUT, {
    panelPaddingTop: 56,
    panelPaddingBottom: 40,
    panelPaddingHorizontal: 16,
    columnGap: 24,
    metricRowPaddingBottom: 28,
    labelHeight: 21,
    labelMarginBottom: 12,
    valueHeight: 36,
    valueMarginBottom: 12,
    barHeight: 7,
  })
})

test('share ratings use the same vertical spacing as the live results screen', () => {
  assert.deepEqual(SHARE_RATINGS_LAYOUT, {
    ...REVEAL_RATINGS_LAYOUT,
    panelPaddingBottom: REVEAL_RATINGS_LAYOUT.panelPaddingBottom - 8,
    valueMarginBottom: REVEAL_RATINGS_LAYOUT.valueMarginBottom + 8,
    metricRowPaddingBottom: REVEAL_RATINGS_LAYOUT.metricRowPaddingBottom - 8,
  })
})

test('share portrait crops the longer dimension without distorting a face', () => {
  assert.deepEqual(getCenteredSquareCrop(600, 900), { x: 0, y: 150, width: 600, height: 600 })
  assert.deepEqual(getCenteredSquareCrop(1200, 800), { x: 200, y: 0, width: 800, height: 800 })
  assert.deepEqual(getCenteredSquareCrop(500, 500), { x: 0, y: 0, width: 500, height: 500 })
})
