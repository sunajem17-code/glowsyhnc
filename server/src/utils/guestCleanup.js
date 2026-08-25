// ─────────────────────────────────────────────────────────────────────────────
// Deletes guest accounts (is_guest=true) that never converted to a real
// account within 24h. The migration that added is_guest said this would
// happen ("cleaned up by a periodic job after 24h if never converted") but
// no such job ever existed — guest rows just accumulated indefinitely.
// scans.user_id is ON DELETE CASCADE, so a guest's unconverted scans are
// removed along with them, which is correct: they were never claimed by a
// real account. A guest that *did* convert (Apple sign-in) already had
// is_guest flipped to false and their scans re-parented, so this can't
// touch them.
//
// Entitlement guard: a guest row can end up holding a real is_pro/premium
// grant — RevenueCat's app_user_id is set to the Supabase UUID as soon as a
// session exists (before Apple Sign-In), so a purchase/webhook event that
// fires in that window writes entitlement onto the still-guest row (RC's
// own TRANSFER events later move it to the real account, but never revoke
// the stale copy left behind — confirmed live via processed_webhook_events:
// 19 TRANSFER vs 5 INITIAL_PURCHASE). Deleting on age alone would silently
// destroy that entitlement record, so anything premium/pro is fetched and
// explicitly excluded before the delete, however it got there.
// ─────────────────────────────────────────────────────────────────────────────
const { getSupabase } = require('../supabase')

async function cleanupStaleGuests() {
  const sb = getSupabase()
  if (!sb) return { deleted: 0, skipped: 'supabase not configured' }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error: selectError } = await sb
    .from('users')
    .select('id, subscription_tier, is_pro')
    .eq('is_guest', true)
    .lt('created_at', cutoff)

  if (selectError) {
    console.error('[GuestCleanup] select failed:', selectError.message)
    return { deleted: 0, error: selectError.message }
  }
  if (!candidates?.length) return { deleted: 0 }

  const toDelete = candidates.filter(u => u.subscription_tier !== 'premium' && u.is_pro !== true)
  const skippedEntitled = candidates.length - toDelete.length
  if (skippedEntitled > 0) {
    console.warn(`[GuestCleanup] skipping ${skippedEntitled} stale guest row(s) that hold an active entitlement — investigate before deleting these manually`)
  }
  if (!toDelete.length) return { deleted: 0, skippedEntitled }

  const { data, error } = await sb
    .from('users')
    .delete()
    .in('id', toDelete.map(u => u.id))
    .select('id')

  if (error) {
    console.error('[GuestCleanup] delete failed:', error.message)
    return { deleted: 0, error: error.message }
  }

  const deleted = data?.length || 0
  if (deleted > 0) console.log(`[GuestCleanup] removed ${deleted} stale guest account(s) older than 24h`)
  return { deleted, skippedEntitled }
}

module.exports = { cleanupStaleGuests }
