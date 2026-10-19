function canUnlock(userId, env = process.env) {
  if (!userId || env.DEV_UNLOCK_ENABLED !== 'true') return false
  if (env.DEV_UNLOCK_ALLOW_ALL === 'true') return true
  if (env.NODE_ENV !== 'production' && env.LOCAL_DEV_UNLOCK_ANY_USER === 'true') return true
  return (env.DEV_UNLOCK_USER_IDS || '').split(',').map(v => v.trim()).includes(userId)
}
module.exports = { canUnlock }
