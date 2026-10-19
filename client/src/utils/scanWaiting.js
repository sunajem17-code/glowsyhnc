export const SCAN_WAITING_MESSAGES = [
  'Your scan is just the beginning',
  'Small steps...',
  'Lasting change',
  'Your next chapter starts with you',
  'Now its time for you to...',
  'INVEST IN YOURSELF',
]

const TYPE_MS_PER_CHARACTER = 55
const characterDuration = character => character === '.' ? 180 : TYPE_MS_PER_CHARACTER
const MESSAGE_HOLD_MS = 1600
const MESSAGE_FADE_MS = 350
export const SCAN_WAITING_DURATIONS = SCAN_WAITING_MESSAGES.map((message, index) =>
  [...message].reduce((duration, character) => duration + characterDuration(character), 0) + (index === SCAN_WAITING_MESSAGES.length - 1 ? 0 : MESSAGE_HOLD_MS),
)
export const SCAN_WAITING_READY_GATE_MS = SCAN_WAITING_DURATIONS.slice(0, -1).reduce((total, duration) => total + duration, 0)
export const SCAN_WAITING_TOTAL_MS = SCAN_WAITING_DURATIONS.reduce((total, duration) => total + duration, 0)

export function waitingFrame(elapsed, ready) {
  if (ready && elapsed >= SCAN_WAITING_TOTAL_MS) {
    const index = SCAN_WAITING_MESSAGES.length - 1
    return { index, characters: SCAN_WAITING_MESSAGES[index].length, progress: 100, done: true }
  }
  if (!ready && elapsed >= SCAN_WAITING_READY_GATE_MS) {
    return {
      index: SCAN_WAITING_MESSAGES.length - 2,
      characters: SCAN_WAITING_MESSAGES[SCAN_WAITING_MESSAGES.length - 2].length,
      progress: Math.round((SCAN_WAITING_READY_GATE_MS / SCAN_WAITING_TOTAL_MS) * 100),
      done: false,
    }
  }
  const maxElapsed = ready ? SCAN_WAITING_TOTAL_MS : SCAN_WAITING_READY_GATE_MS
  const boundedElapsed = Math.min(Math.max(0, elapsed), maxElapsed)
  let stageStart = 0
  let index = SCAN_WAITING_DURATIONS.findIndex((duration, stageIndex) => {
    if (boundedElapsed < stageStart + duration) return true
    stageStart += duration
    return false
  })

  if (index < 0) index = SCAN_WAITING_MESSAGES.length - 1
  let characters = 0
  let characterEnd = stageStart
  for (const character of SCAN_WAITING_MESSAGES[index]) {
    characterEnd += characterDuration(character)
    if (boundedElapsed < characterEnd) break
    characters++
  }
  return {
    index,
    characters,
    progress: Math.round((boundedElapsed / SCAN_WAITING_TOTAL_MS) * 100),
    done: Boolean(ready && elapsed >= SCAN_WAITING_TOTAL_MS),
  }
}

// Fade only after the completed sentence has had its reading time.
// The next sentence starts typing from its first character after this fade.
export function waitingTextOpacity(elapsed, ready) {
  const frame = waitingFrame(elapsed, ready)
  if (frame.index === SCAN_WAITING_MESSAGES.length - 1 ||
      (!ready && elapsed >= SCAN_WAITING_READY_GATE_MS)) return 1
  const stageEnd = SCAN_WAITING_DURATIONS.slice(0, frame.index + 1).reduce((sum, duration) => sum + duration, 0)
  return Math.max(0, Math.min(1, (stageEnd - elapsed) / MESSAGE_FADE_MS))
}
