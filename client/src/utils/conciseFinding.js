export function conciseFinding(value, maxWords = 8) {
  if (typeof value !== 'string') return ''
  const firstPart = value.trim().split(/\s+[—–]\s+|[.;,]/, 1)[0]?.trim() || ''
  const normalized = firstPart.replace(/^(?:your|the scan (?:notes|shows|suggests)|the assessment finds)\s+/i, '')
  const words = normalized.split(/\s+/).filter(Boolean).slice(0, maxWords)
  if (!words.length) return ''
  return words.join(' ').replace(/^\p{L}/u, letter => letter.toUpperCase())
}
