const { getRedis } = require('../middleware/ratelimit')
const { AsyncLocalStorage } = require('node:async_hooks')
const { createHash } = require('node:crypto')

const MONTHLY_LIMIT_MICROS = 2_000_000 // $2.00, in millionths of a dollar
const BUDGET_TTL_SECONDS = 40 * 24 * 60 * 60
const IMAGE_EDIT_RESERVE_MICROS = 300_000 // conservative ceiling for one 1024px image edit
const localBudgets = new Map()
const budgetUserContext = new AsyncLocalStorage()

const RESERVE_LUA = `
local spent = tonumber(redis.call('HGET', KEYS[1], 'spent') or '0')
local reserved = tonumber(redis.call('HGET', KEYS[1], 'reserved') or '0')
local amount = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
if spent + reserved + amount > limit then return 0 end
redis.call('HINCRBY', KEYS[1], 'reserved', amount)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
return 1
`

const SETTLE_LUA = `
local reserved = tonumber(redis.call('HGET', KEYS[1], 'reserved') or '0')
local amount = tonumber(ARGV[1])
local actual = tonumber(ARGV[2])
redis.call('HSET', KEYS[1], 'reserved', math.max(0, reserved - amount))
redis.call('HINCRBY', KEYS[1], 'spent', actual)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
return 1
`

const READ_LUA = `
return { tonumber(redis.call('HGET', KEYS[1], 'spent') or '0'), tonumber(redis.call('HGET', KEYS[1], 'reserved') or '0') }
`

function runWithBudgetUser(userId, callback) {
  return budgetUserContext.run({ userId: String(userId) }, callback)
}

function currentBudgetUserId() {
  const userId = budgetUserContext.getStore()?.userId
  if (userId) return userId
  // Keep direct calls in local development usable, but never allow an
  // unscoped production request to draw from a shared/unattributed budget.
  if (process.env.NODE_ENV !== 'production') return 'local-development'
  throw budgetError('monthly_ai_budget_unavailable')
}

function keyForMonth(userId, date = new Date()) {
  const accountHash = createHash('sha256').update(String(userId)).digest('hex').slice(0, 32)
  return `ai-budget:monthly:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}:${accountHash}`
}

function budgetError(code = 'monthly_ai_budget_reached') {
  const message = code === 'monthly_ai_budget_reached'
    ? 'The app has reached its $2 monthly AI budget. AI features will be available again next month.'
    : 'The monthly AI spending guard is unavailable. Please try again later.'
  return Object.assign(new Error(message), { status: code === 'monthly_ai_budget_reached' ? 429 : 503, code })
}

async function redisClient() {
  const redis = getRedis()
  if (!redis && process.env.NODE_ENV === 'production') throw budgetError('monthly_ai_budget_unavailable')
  return redis
}

async function reserveCost(amountMicros, userId = currentBudgetUserId()) {
  const amount = Math.max(1, Math.ceil(amountMicros))
  const key = keyForMonth(userId)
  const redis = await redisClient()
  if (redis) {
    let accepted
    try {
      accepted = await redis.eval(RESERVE_LUA, [key], [amount, MONTHLY_LIMIT_MICROS, BUDGET_TTL_SECONDS])
    } catch (error) {
      console.error('[ai-budget] reservation failed; blocking provider request:', error.message)
      throw budgetError('monthly_ai_budget_unavailable')
    }
    if (Number(accepted) !== 1) throw budgetError()
  } else {
    const state = localBudgets.get(key) || { spent: 0, reserved: 0 }
    if (state.spent + state.reserved + amount > MONTHLY_LIMIT_MICROS) throw budgetError()
    state.reserved += amount
    localBudgets.set(key, state)
  }

  let settled = false
  return {
    amountMicros: amount,
    async settle(actualMicros = amount) {
      if (settled) return
      settled = true
      const actual = Math.max(0, Math.ceil(actualMicros))
      if (redis) {
        try {
          await redis.eval(SETTLE_LUA, [key], [amount, actual, BUDGET_TTL_SECONDS])
        } catch (error) {
          // Leave the reservation in place if settlement fails. This can reduce
          // availability, but never releases spend that might already be billed.
          settled = false
          console.error('[ai-budget] settlement failed; keeping reservation:', error.message)
        }
      } else {
        const state = localBudgets.get(key) || { spent: 0, reserved: amount }
        state.reserved = Math.max(0, state.reserved - amount)
        state.spent += actual
        localBudgets.set(key, state)
      }
    },
  }
}

async function monthlyBudgetStatus(userId = currentBudgetUserId()) {
  const key = keyForMonth(userId)
  const redis = await redisClient()
  let spent, reserved
  if (redis) {
    try {
      ;[spent, reserved] = await redis.eval(READ_LUA, [key], [])
    } catch (error) {
      console.error('[ai-budget] status read failed:', error.message)
      throw budgetError('monthly_ai_budget_unavailable')
    }
  } else {
    const state = localBudgets.get(key) || { spent: 0, reserved: 0 }
    spent = state.spent
    reserved = state.reserved
  }
  return { limitMicros: MONTHLY_LIMIT_MICROS, spentMicros: Number(spent) || 0, reservedMicros: Number(reserved) || 0 }
}

const MODEL_RATES = {
  openai: {
    'gpt-5.4-mini': { input: 0.75, output: 4.5 },
    'gpt-5.4-mini-2026-03-17': { input: 0.75, output: 4.5 },
  },
  anthropic: {
    'claude-haiku-4-5': { input: 1, output: 5 },
    'claude-haiku-4-5-20251001': { input: 1, output: 5 },
    'claude-sonnet-4-6': { input: 3, output: 15 },
  },
}

function ratesFor(provider, model) {
  const rates = MODEL_RATES[provider]?.[model]
  if (!rates) throw budgetError('monthly_ai_budget_unavailable')
  return rates
}

function contentEstimate(content) {
  if (typeof content === 'string') return { textChars: content.length, images: 0 }
  if (!Array.isArray(content)) return { textChars: 0, images: 0 }
  return content.reduce((total, block) => {
    if (block?.type === 'image') total.images += 1
    else if (typeof block?.text === 'string') total.textChars += block.text.length
    return total
  }, { textChars: 0, images: 0 })
}

function estimateTokens(request) {
  const blocks = [request.system, ...(request.messages || []).map(message => message?.content)]
  const estimate = blocks.reduce((total, content) => {
    const part = contentEstimate(content)
    // Treat each text character as a token and reserve 24K tokens per image.
    // This intentionally over-reserves during parallel calls; the reservation
    // is reconciled against provider-reported usage when the response returns.
    return total + part.textChars + part.images * 24_000
  }, 0)
  // Tool schemas and response formats are also sent as model input. They can
  // be sizeable, so count their serialized text conservatively as well.
  const toolChars = JSON.stringify(request.tools || []).length + JSON.stringify(request.responseSchema || {}).length
  return Math.max(1, Math.ceil(estimate + toolChars))
}

function usageCostMicros(provider, model, usage) {
  const rates = ratesFor(provider, model)
  const input = Number(usage?.input_tokens) || 0
  const output = Number(usage?.output_tokens) || 0
  const cacheRead = Number(usage?.cache_read_input_tokens) || 0
  const cacheWrite = Number(usage?.cache_creation_input_tokens) || 0
  // Charge cached Anthropic input at the full base rate, deliberately
  // conservative, so caching cannot cause the budget to undercount.
  return Math.ceil((input + cacheRead + cacheWrite) * rates.input + output * rates.output)
}

async function reserveProviderRequest(provider, model, request) {
  const rates = ratesFor(provider, model)
  const maxInputTokens = estimateTokens(request)
  const maxOutputTokens = Math.max(512, Number(request.max_tokens) || 1024)
  const amount = maxInputTokens * rates.input + maxOutputTokens * rates.output
  const reservation = await reserveCost(amount)
  const settleUsage = usage => {
    // If a provider response is missing its usage block, retain the whole
    // reservation rather than treating an unreported call as free.
    const hasUsage = Number.isFinite(Number(usage?.input_tokens)) && Number.isFinite(Number(usage?.output_tokens))
    return reservation.settle(hasUsage ? usageCostMicros(provider, model, usage) : reservation.amountMicros)
  }
  return {
    settleUsage,
    settleReserved: () => reservation.settle(reservation.amountMicros),
  }
}

async function reserveImageEdit() {
  const reservation = await reserveCost(IMAGE_EDIT_RESERVE_MICROS)
  return {
    settle: () => reservation.settle(IMAGE_EDIT_RESERVE_MICROS),
    settleReserved: () => reservation.settle(reservation.amountMicros),
  }
}

module.exports = { reserveProviderRequest, reserveImageEdit, monthlyBudgetStatus, budgetError, runWithBudgetUser, MONTHLY_LIMIT_MICROS }
