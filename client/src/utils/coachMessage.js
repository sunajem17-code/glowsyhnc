export function safeCoachLink(value, amazonOnly = false) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (amazonOnly && !['amazon.ca', 'www.amazon.ca'].includes(url.hostname)) return null
    return url.href
  } catch { return null }
}

// Supports already-saved replies as well as new ones. The server remains the
// source of affiliate destinations; presentation never invents product URLs.
export function parseCoachMessage(content = '') {
  const blocks = []
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const url = safeCoachLink(line, true)
    if (url) {
      const previous = blocks.at(-1)
      const pair = previous?.type === 'paragraph' ? previous.text.match(/^(.{1,160}?)\s+—\s+([\s\S]+)$/) : null
      if (pair) blocks.pop()
      blocks.push({ type: 'product', name: pair?.[1] || 'Recommended product', reason: pair?.[2] || '', url })
    } else if (/^Affiliate links:/i.test(line)) {
      blocks.push({ type: 'disclosure', text: line })
    } else {
      const numbered = line.match(/^(\d+)[.)]\s+(.+)$/)
      blocks.push(numbered ? { type: 'step', number: numbered[1], text: numbered[2] } : { type: 'paragraph', text: line })
    }
  }
  return blocks
}
export const blockText = block => block.type === 'product' ? `${block.name}\n${block.reason}` : block.text
export function coachRevealCount(elapsedMs, total) {
  // Word-sized batches at roughly 600 characters/sec, independent of FPS.
  return Math.min(total, Math.max(0, Math.floor(elapsedMs * .6)))
}
