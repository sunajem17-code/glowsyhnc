import useStore from '../store/useStore'

export function syncScanStreak(streak) {
  if (!streak || !Number.isFinite(Number(streak.current)) || !Number.isFinite(Number(streak.longest))) return
  const lastDate = streak.lastDate
    ? new Date(`${streak.lastDate}T12:00:00`).toDateString()
    : null
  const normalized = {
    current: Number(streak.current),
    longest: Number(streak.longest),
    lastDate,
    face: streak.face ? {
      current: Number(streak.face.current) || 0,
      longest: Number(streak.face.longest) || 0,
      lastDate: streak.face.lastDate || null,
    } : undefined,
    physique: streak.physique ? {
      current: Number(streak.physique.current) || 0,
      longest: Number(streak.physique.longest) || 0,
      lastDate: streak.physique.lastDate || null,
    } : undefined,
  }
  useStore.getState().updateStreak(normalized)
}

export function recordLocalScanStreak(scanType = 'face') {
  const type = scanType === 'physique' ? 'physique' : 'face'
  const today = new Date().toDateString()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = yesterdayDate.toDateString()
  const currentStreak = useStore.getState().streak || {}
  const typedStreak = currentStreak[type] || { current: 0, longest: 0, lastDate: null }
  const current = typedStreak.lastDate === today
    ? typedStreak.current
    : typedStreak.lastDate === yesterday ? typedStreak.current + 1 : 1
  const longest = Math.max(typedStreak.longest || 0, current)
  const overallCurrent = currentStreak.lastDate === today
    ? currentStreak.current
    : currentStreak.lastDate === yesterday ? currentStreak.current + 1 : 1
  useStore.getState().updateStreak({
    ...currentStreak,
    current: overallCurrent,
    longest: Math.max(currentStreak.longest || 0, overallCurrent),
    lastDate: today,
    [type]: { current, longest, lastDate: today },
  })
}
