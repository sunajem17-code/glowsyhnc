// Supabase resolves errors in the result object; a resolved Promise is not
// evidence that deletion succeeded. Only absent legacy tables are optional.
const missing = error => ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code)
async function deleteCloudAccountData(sb, userId) {
  const tables = ['task_completions', 'daily_checkins', 'streaks', 'plan_tasks', 'progress', 'scans', 'leaderboard', 'action_plans', 'community_likes', 'community_comments', 'community_ratings', 'community_posts', 'email_sends', 'scan_cache', 'affiliate_clicks']
  for (const table of tables) {
    const { error } = await sb.from(table).delete().eq('user_id', userId)
    if (error && !(table !== 'scans' && missing(error))) throw new Error('Account data cleanup failed')
  }
  const { error: reportError } = await sb.from('community_reports').delete().eq('reporter_id', userId)
  if (reportError && !missing(reportError)) throw new Error('Account report cleanup failed')
  const { error: profileError } = await sb.from('profiles').delete().eq('id', userId)
  if (profileError && !missing(profileError)) throw new Error('Profile cleanup failed')
  // Remove batches from offset zero, so deletions cannot skip later files.
  const bucket = sb.storage.from('scan-images')
  for (;;) {
    const { data, error } = await bucket.list(`scan/${userId}`, { limit: 100, offset: 0 })
    if (error) throw new Error('Account photo cleanup failed')
    if (!data?.length) break
    const { error: removeError } = await bucket.remove(data.map(file => `scan/${userId}/${file.name}`))
    if (removeError) throw new Error('Account photo cleanup failed')
  }
  // Delete the authentication record last; on failure the user can retry.
  const { error } = await sb.from('users').delete().eq('id', userId)
  if (error) throw new Error('Account deletion failed')
  const { data, error: verifyError } = await sb.from('users').select('id').eq('id', userId).maybeSingle()
  if (verifyError || data) throw new Error('Account deletion could not be confirmed')
}
module.exports = { deleteCloudAccountData }
