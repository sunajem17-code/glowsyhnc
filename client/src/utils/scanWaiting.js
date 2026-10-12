export function waitingFrame(elapsed, readyAt) {
  if (readyAt != null) return { index: 3, done: elapsed - readyAt >= 2200 }
  return { index: Math.floor(elapsed / 2600) % 3, done: false }
}
