// Older saved feedback can contain ratings; keep Pros/Cons focused on findings.
export function withoutRatings(value = '') {
  return String(value)
    .replace(/\s*\([^)]*\b\d+(?:\.\d+)?\s*(?:\/\s*10|out of 10)[^)]*\)/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:\/\s*10|out of 10)\b/gi, '')
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !/\b(?:scores?|ratings?|rated)\b/i.test(sentence))
    .join(' ').replace(/\s{2,}/g, ' ').trim()
}
