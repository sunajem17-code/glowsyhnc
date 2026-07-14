import { useEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BottomNav from './BottomNav'
import AchievementToast from './AchievementToast'
import useStore from '../store/useStore'
import { checkAchievements } from '../utils/achievements'

// Matches MotionPage's own variants — most tab content already animates its
// entrance this way, but MotionPage's `exit` never fires because nothing
// upstream of it is an AnimatePresence boundary. This is that boundary.
const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export default function Layout() {
  const location           = useLocation()
  const outlet             = useOutlet()
  const scans              = useStore(s => s.scans)
  const currentPlan        = useStore(s => s.currentPlan)
  const streak             = useStore(s => s.streak)
  const referralCount      = useStore(s => s.referralCount)
  const achievements       = useStore(s => s.achievements)
  const unlockAchievement  = useStore(s => s.unlockAchievement)

  // Check for new achievements whenever key state changes
  useEffect(() => {
    const toUnlock = checkAchievements({ scans, currentPlan, streak, referralCount, achievements })
    toUnlock.forEach(key => unlockAchievement(key))
  }, [scans?.length, currentPlan, streak?.current, referralCount, achievements?.length])

  return (
    <div className="flex flex-col h-full bg-page">
      <AchievementToast />
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
