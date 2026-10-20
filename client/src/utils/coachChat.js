export const ADONIS_GREETING = "I'm Adonis, the coach you can ask anything. What do you need help with today?"

export function getCoachChatSendState({ text, hasScan, loading = false }) {
  if (!text?.trim() || loading) return 'ignore'
  return hasScan ? 'send' : 'needs-scan'
}

export function getMessageEntryMotion(role) {
  return {
    initial: role === 'user'
      ? { opacity: 0, x: 22, y: 8, scale: 0.96 }
      : { opacity: 0, x: -8, y: 6, scale: 0.98 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    transition: { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 },
  }
}

export function getScanRequiredMessages(text) {
  return [
    { role: 'user', content: text.trim() },
    { role: 'assistant', content: 'Please take a scan first so I can give you personalized coaching.' },
  ]
}

export async function waitForMinimumCoachThinking(startedAt, {
  minimumMs = 2000,
  now = Date.now,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const remaining = minimumMs - (now() - startedAt)
  if (remaining > 0) await wait(remaining)
}
