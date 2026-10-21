// Shared geometry for the live results ratings and their exported share card.
export const REVEAL_RATINGS_LAYOUT = Object.freeze({
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

// Keep labels and scores in the same positions as live results, but lower the
// share bars slightly; compensate the row and panel padding so nothing else moves.
export const SHARE_RATINGS_LAYOUT = Object.freeze({
  ...REVEAL_RATINGS_LAYOUT,
  panelPaddingBottom: REVEAL_RATINGS_LAYOUT.panelPaddingBottom - 8,
  valueMarginBottom: REVEAL_RATINGS_LAYOUT.valueMarginBottom + 8,
  metricRowPaddingBottom: REVEAL_RATINGS_LAYOUT.metricRowPaddingBottom - 8,
})
