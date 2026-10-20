const { createHash } = require('node:crypto')

function normalizeContext(body = {}) {
  const strings = value => Array.isArray(value) && value.length <= 30 && value.every(v => typeof v === 'string' && v.length <= 500)
  if (!strings(body.weaknesses ?? []) || !strings(body.skinIssues ?? []) ||
      (body.scanId != null && (typeof body.scanId !== 'string' || body.scanId.length > 200)) ||
      (body.pillars != null && (typeof body.pillars !== 'object' || Array.isArray(body.pillars)))) throw new Error('invalid_context')
  const score = value => {
    if (value == null) return null
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) throw new Error('invalid_context')
    return value
  }
  return {
    scanId: body.scanId ?? null,
    weaknesses: [...new Set(body.weaknesses ?? [])].sort(),
    skinIssues: [...new Set(body.skinIssues ?? [])].sort(),
    skinScore: score(body.skinScore), groomingScore: score(body.groomingScore),
    pillars: Object.fromEntries(['harmony', 'angularity', 'features', 'dimorphism'].map(k => [k, score(body.pillars?.[k])])),
    gender: body.gender === 'female' ? 'female' : 'male',
  }
}
function contextKey(context) {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex')
}
function validProducts(products) {
  return Array.isArray(products) && products.length > 0 && products.length <= 10 &&
    products.every(p => p && ['name', 'description', 'searchQuery'].every(k => typeof p[k] === 'string' && p[k].trim() && p[k].length <= 1000))
}
function createPersonalizationStore(db, getSupabase) {
  return {
    async get(userId, key) {
      const sb = getSupabase()
      if (sb) {
        const { data, error } = await sb.from('personalized_recommendations').select('payload').eq('user_id', userId).eq('context_key', key).maybeSingle()
        if (error) throw error
        return data?.payload ?? null
      }
      const row = db.prepare('SELECT payload FROM personalized_recommendations WHERE user_id = ? AND context_key = ?').get(userId, key)
      return row ? JSON.parse(row.payload) : null
    },
    async save(userId, key, payload) {
      const sb = getSupabase()
      if (sb) {
        // First completed request wins, including across server instances.
        const { error } = await sb.from('personalized_recommendations').upsert({ user_id: userId, context_key: key, payload }, { onConflict: 'user_id,context_key', ignoreDuplicates: true })
        if (error) throw error
      } else {
        db.prepare('INSERT OR IGNORE INTO personalized_recommendations (user_id, context_key, payload) VALUES (?, ?, ?)').run(userId, key, JSON.stringify(payload))
      }
      return this.get(userId, key)
    },
  }
}
module.exports = { normalizeContext, contextKey, validProducts, createPersonalizationStore }
