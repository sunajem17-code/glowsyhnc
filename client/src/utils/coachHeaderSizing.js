const COACH_HEADER_SCALE = 0.92

export function scaleCoachHeaderSize(value) {
  return Number((value * COACH_HEADER_SCALE).toFixed(4))
}
