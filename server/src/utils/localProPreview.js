// Explicit, server-configured test access for the existing localhost Pro UI.
// Never derive this from request-body premium flags, and never enable it in
// production or for other accounts sharing the development server.
function hasLocalProPreview(req, env = process.env) {
  if (env.NODE_ENV !== 'development' || req.isDemo || !req.userId) return false
  const address = req.socket?.remoteAddress
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false
  const owners = (env.LOCAL_PRO_PREVIEW_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
  return owners.includes(req.userId)
}

module.exports = { hasLocalProPreview }
