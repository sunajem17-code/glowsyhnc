const ARCHIVE_CARD = { width: 92, height: 128 }

export function getProgressSaveFlight(cardRect, viewport) {
  if (!cardRect || !viewport || cardRect.width <= 0 || cardRect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return null
  }

  return {
    from: {
      left: cardRect.left,
      top: cardRect.top,
      width: cardRect.width,
      height: cardRect.height,
    },
    to: {
      left: (viewport.width - ARCHIVE_CARD.width) / 2,
      top: (viewport.height - ARCHIVE_CARD.height) / 2,
      ...ARCHIVE_CARD,
    },
  }
}

export function getProgressSaveSequence(cardRect, viewport, reduceMotion = false) {
  const flight = getProgressSaveFlight(cardRect, viewport)
  if (flight && !reduceMotion) return { ...flight, phase: 'flight', holdMs: 950, animateCard: true }
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) return null

  const archiveCard = {
    left: (viewport.width - ARCHIVE_CARD.width) / 2,
    top: (viewport.height - ARCHIVE_CARD.height) / 2,
    ...ARCHIVE_CARD,
  }
  const confirmation = getProgressSaveFlight(archiveCard, viewport)
  return confirmation ? { ...confirmation, phase: 'saved', holdMs: 1400, animateCard: false } : null
}
