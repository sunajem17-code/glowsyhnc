import { useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
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
      <footer className="flex items-center justify-center gap-4 py-2 pb-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Link to="/privacy" className="font-body text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Privacy Policy</Link>
        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>·</span>
        <Link to="/terms" className="font-body text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Terms of Service</Link>
      </footer>
      <BottomNav />
    </div>
  )
}
