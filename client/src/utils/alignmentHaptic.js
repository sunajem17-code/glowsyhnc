// Confirm entry once, rather than buzzing on every camera frame.
export function createAlignmentHapticGate(now = Date.now) {
  let wasAligned = false
  let lastTap = -Infinity
  return aligned => {
    const time = now()
    const trigger = aligned && !wasAligned && time - lastTap >= 1500
    wasAligned = aligned
    if (trigger) lastTap = time
    return trigger
  }
}
