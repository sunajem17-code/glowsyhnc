const db = require('../db')
const { getUserById, isConfigured } = require('../supabase')
async function requireCurrentAccount(userId) {
  if (typeof userId !== 'string' || !userId) throw Object.assign(new Error('Invalid session'), { status: 401 })
  let user
  try {
    user = isConfigured()
      ? await getUserById(userId, { strict: true })
      : db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  } catch {
    throw Object.assign(new Error('Account verification temporarily unavailable'), { status: 503 })
  }
  if (!user || user.id !== userId) throw Object.assign(new Error('Account deleted or session no longer valid'), { status: 401 })
  return user
}
module.exports = { requireCurrentAccount }
