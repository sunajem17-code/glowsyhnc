const FLIGHT_SIZE = 44

export function getProgressSaveFlight(cardRect, buttonRect) {
  if (!cardRect || !buttonRect || cardRect.width <= 0 || cardRect.height <= 0 || buttonRect.width <= 0 || buttonRect.height <= 0) {
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
      left: buttonRect.left + (buttonRect.width - FLIGHT_SIZE) / 2,
      top: buttonRect.top + (buttonRect.height - FLIGHT_SIZE) / 2,
      width: FLIGHT_SIZE,
      height: FLIGHT_SIZE,
    },
  }
}
