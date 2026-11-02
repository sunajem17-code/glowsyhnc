async function requireScanOwner(sb, userId) {
  if (!sb || userId === 'demo') return
  const { data, error } = await sb.from('users').select('id').eq('id', userId).maybeSingle()
  if (error) throw Object.assign(new Error('Account verification is temporarily unavailable. Please try again.'), { code: 'scan_owner_unavailable', status: 503 })
  if (!data || data.id !== userId) throw Object.assign(new Error('Your session is out of date. Please sign in again to save your scan.'), { code: 'scan_owner_missing', status: 401 })
}

module.exports = { requireScanOwner }
