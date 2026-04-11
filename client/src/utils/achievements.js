export const ACHIEVEMENTS = {
  first_scan: {
    key: 'first_scan',
    emoji: '📸',
    title: 'First Scan',
    desc: 'Complete your first AI scan',
    color: '#C6A85C',
  },
  week_1_plan: {
    key: 'week_1_plan',
    emoji: '📅',
    title: 'Glow Up Begins',
    desc: 'Complete Week 1 of your plan',
    color: '#34C759',
  },
  streak_7: {
    key: 'streak_7',
    emoji: '🔥',
    title: 'Consistent',
    desc: '7-day check-in streak',
    color: '#EF4444',
  },
  streak_30: {
    key: 'streak_30',
    emoji: '⚡',
    title: 'Dedicated',
    desc: '30-day check-in streak',
    color: '#F59E0B',
  },
  score_plus_half: {
    key: 'score_plus_half',
    emoji: '📈',
    title: 'Transformer',
    desc: 'Improve your score by +0.5 points',
    color: '#3B82F6',
  },
  score_plus_one: {
    key: 'score_plus_one',
    emoji: '🚀',
    title: 'Big Glow Up',
    desc: 'Improve your score by +1.0 points',
    color: '#8B5CF6',
  },
  referrer_5: {
    key: 'referrer_5',
    emoji: '👥',
    title: 'Recruiter',
    desc: 'Refer 5 friends to Ascendus',
    color: '#EC4899',
  },
  top_tier: {
    key: 'top_tier',
    emoji: '🏆',
    title: 'Top Tier',
    desc: 'Reach Chadlite tier or above',
    color: '#C6A85C',
  },
  plan_complete: {
    key: 'plan_complete',
    emoji: '👑',
    title: 'Looksmax Legend',
    desc: 'Complete the full 12-week plan',
    color: '#F59E0B',
  },
}

// Check which achievements should be unlocked given current state
export function checkAchievements(state) {
  const toUnlock = []
  const { scans, currentPlan, streak, referralCount, achievements } = state

  const already = (key) => achievements?.includes(key)

  // First scan
  if (scans?.length >= 1 && !already('first_scan')) toUnlock.push('first_scan')

  // Streak 7
  if ((streak?.current ?? 0) >= 7 && !already('streak_7')) toUnlock.push('streak_7')

  // Streak 30
  if ((streak?.current ?? 0) >= 30 && !already('streak_30')) toUnlock.push('streak_30')

  // Referral 5
  if ((referralCount ?? 0) >= 5 && !already('referrer_5')) toUnlock.push('referrer_5')

  // Score improvement
  if (scans?.length >= 2) {
    const latest = scans[0]?.glowScore ?? 0
    const first = scans[scans.length - 1]?.glowScore ?? 0
    const diff = latest - first
    if (diff >= 0.5 && !already('score_plus_half')) toUnlock.push('score_plus_half')
    if (diff >= 1.0 && !already('score_plus_one')) toUnlock.push('score_plus_one')
  }

  // Top tier
  const latestTier = scans?.[0]?.tier
  if (['Chadlite', 'Chad', 'Gigachad'].includes(latestTier) && !already('top_tier')) {
    toUnlock.push('top_tier')
  }

  // Week 1 plan complete (7+ tasks done)
  if (currentPlan) {
    const completedCount = currentPlan.tasks?.filter(t => t.completed)?.length ?? 0
    if (completedCount >= 7 && !already('week_1_plan')) toUnlock.push('week_1_plan')
  }

  // Plan complete (all tasks done)
  if (currentPlan) {
    const total = currentPlan.tasks?.length ?? 0
    const completed = currentPlan.tasks?.filter(t => t.completed)?.length ?? 0
    if (total > 0 && completed >= total && !already('plan_complete')) toUnlock.push('plan_complete')
  }

  return toUnlock
}
