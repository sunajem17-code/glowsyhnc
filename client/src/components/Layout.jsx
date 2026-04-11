import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import AchievementToast from './AchievementToast'
import useStore from '../store/useStore'
import { checkAchievements } from '../utils/achievements'

export default function Layout() {
  const store = useStore()
  const { unlockAchievement, scans, currentPlan, streak, referralCount, achievements } = store

  // Check for new achievements whenever key state changes
  useEffect(() => {
    const toUnlock = checkAchievements({ scans, currentPlan, streak, referralCount, achievements })
    toUnlock.forEach(key => unlockAchievement(key))
  }, [scans?.length, currentPlan, streak?.current, referralCount, achievements?.length])

  return (
    <div className="flex flex-col h-full bg-page">
      <AchievementToast />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
