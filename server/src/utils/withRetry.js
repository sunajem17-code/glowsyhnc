/**
 * Retry an async Anthropic SDK call with exponential backoff.
 * Retries on 429 (rate limit) and 529 (overloaded). All other errors throw immediately.
 *
 * Backoff schedule: wait 2s → 5s → 10s between attempts (3 retries, 4 total attempts).
 */
async function withRetry(fn, label = 'api') {
  const MAX_RETRIES = 3
  const BACKOFF_MS  = [0, 2000, 5000, 10000] // indexed by attempt number (1-based)

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status  = err.status ?? err.statusCode ?? 0
      const apiMsg  = err.error?.error?.message || err.error?.message || ''
      const rawMsg  = err.message || ''
      const fullMsg = apiMsg || rawMsg
      const lower   = fullMsg.toLowerCase()

      const is429 = status === 429
        || lower.includes('rate limit') || lower.includes('rate_limit')
        || lower.includes('too many')   || lower.includes('quota')
        || lower.includes('exceeded')
      const is529 = status === 529
        || lower.includes('overloaded') || lower.includes('capacity')

      const typeTag = is429 ? '429_RATE_LIMIT' : is529 ? '529_OVERLOADED' : `${status}_ERROR`
      console.error(`[${label}] attempt=${attempt} status=${status} type=${typeTag} msg="${fullMsg.slice(0, 300)}"`)

      if (!is429 && !is529) throw err

      if (attempt > MAX_RETRIES) {
        console.error(`[${label}] GAVE UP after ${MAX_RETRIES} retries — ${typeTag}`)
        const enriched = new Error(`[${typeTag}] after ${MAX_RETRIES} retries: ${fullMsg || `HTTP ${status}`}`)
        enriched.status = status
        enriched.retryExhausted = true
        throw enriched
      }

      const waitMs = BACKOFF_MS[attempt] ?? 10000
      console.error(`[${label}] waiting ${waitMs}ms before retry ${attempt}/${MAX_RETRIES}...`)
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }
  }
}

module.exports = { withRetry }
