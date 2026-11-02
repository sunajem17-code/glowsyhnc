import { getRevealRatings } from './revealRatings.js'

export const SHARE_CARD_WIDTH = 360
export const SHARE_CARD_HEIGHT = 640
// 1080 × 1920 is high-resolution for sharing while keeping html2canvas within
// mobile browser memory limits (the previous 4K canvas used 4× the pixels).
export const SHARE_CARD_EXPORT_WIDTH = 1080
export const SHARE_CARD_EXPORT_HEIGHT = 1920
export const SHARE_CARD_BRAND_LAYOUT = Object.freeze({
  marginTop: 16,
  fontSize: 15,
  letterSpacing: '0.22em',
})
export const SHARE_CARD_METRIC_LAYOUT = Object.freeze({
  labelFontSize: 15,
  labelFontWeight: 700,
  labelLetterSpacing: '0.08em',
  labelMarginBottom: 6,
  scoreFontSize: 26,
  scoreMinHeight: 34,
  scoreMarginBottom: 6,
  barHeight: 6,
  columnGap: 20,
  rowGap: 14,
})

export function getShareCardCaptureSize() {
  return {
    width: SHARE_CARD_EXPORT_WIDTH,
    height: SHARE_CARD_EXPORT_HEIGHT,
    scale: SHARE_CARD_EXPORT_WIDTH / SHARE_CARD_WIDTH,
  }
}

export function getShareCardMetrics(scan) {
  return getRevealRatings(scan)
}
