import { useEffect } from 'react'
import { useLocation, useNavigationType, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BottomNav, { TAB_ROOT_PATHS } from './BottomNav'
import AchievementToast from './AchievementToast'
import ProcessingOverlay from './ProcessingOverlay'
import useStore from '../store/useStore'
import { checkAchievements } from '../utils/achievements'
import { useSwipeBack } from '../hooks/useSwipeBack'
import { EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'

// Matches MotionPage's own variants — most tab content already animates its
// entrance this way, but MotionPage's `exit` never fires because nothing
// upstream of it is an AnimatePresence boundary. This is that boundary.
//
// `initial` depends on navigation type: a POP (back button or swipe-back)
// enters from the left to mirror the direction it's "returning" from, per
// the spatial-consistency principle — anything else (a normal tap-forward)
// keeps the original fade-up. `exit` reads `custom`: a committed swipe-back
// hands off its release velocity so the page continues sliding off to the
// right at the same speed the finger was moving, instead of the default fade.
function buildPageVariants(isPop, isTabSwitch) {
  // Tab switches: plain fade — no y-slide which looks weird at tab level
  if (isTabSwitch) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_STANDARD } },
    }
  }
  return {
    initial: isPop ? { opacity: 0, x: -32 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: (custom) => custom
      ? { x: custom.width, transition: { ...SPRING_STANDARD, velocity: custom.velocity } }
      : { opacity: 0, y: -8, transition: { duration: 0.22, ease: EASE_STANDARD } },
  }
}

export default function Layout() {
  const location           = useLocation()
  const navigationType     = useNavigationType()
  const outlet             = useOutlet()
  const scans              = useStore(s => s.scans)
  const currentPlan        = useStore(s => s.currentPlan)
  const streak             = useStore(s => s.streak)
  const referralCount      = useStore(s => s.referralCount)
  const achievements       = useStore(s => s.achievements)
  const unlockAchievement  = useStore(s => s.unlockAchievement)
  const scanLaunching      = useStore(s => s.scanLaunching)

  // Check for new achievements whenever key state changes
  useEffect(() => {
    const toUnlock = checkAchievements({ scans, currentPlan, streak, referralCount, achievements })
    toUnlock.forEach(key => unlockAchievement(key))
  }, [scans?.length, currentPlan, streak?.current, referralCount, achievements?.length])

  // Edge-swipe-back is only meaningful on a pushed detail screen with real
  // history behind it — not on a tab root (nowhere in-app to "go back" to)
  // and not on the very first location of the session (nothing behind it).
  const swipeEnabled = !TAB_ROOT_PATHS.includes(location.pathname) && location.key !== 'default'
  const { x, swipeExit, resetAfterExit, edgeHandlers } = useSwipeBack({ enabled: swipeEnabled })

  const isTabSwitch = TAB_ROOT_PATHS.includes(location.pathname)
  const pageVariants = buildPageVariants(navigationType === 'POP', isTabSwitch)

  return (
    <div className="flex flex-col h-full bg-page">
      <AnimatePresence>
        {scanLaunching && <ProcessingOverlay key="scan-launch" label="Loading…" />}
      </AnimatePresence>
      <AchievementToast />
      <main className="flex-1 overflow-hidden relative">
        {/* Thin left-edge hit zone for the interruptible swipe-back gesture.
            Scoped to a 24px strip (matching iOS's own edge-pan width) so it
            never competes with interior horizontal gestures like the
            before/after CompareSlider, which never starts a drag this close
            to the screen edge. Inert entirely on tab roots. */}
        <div
          {...edgeHandlers}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 24,
            zIndex: 40,
            touchAction: swipeEnabled ? 'none' : 'auto',
            pointerEvents: swipeEnabled ? 'auto' : 'none',
          }}
        />
        <AnimatePresence mode="wait" initial={false} onExitComplete={resetAfterExit}>
          <motion.div
            key={location.pathname}
            custom={swipeExit}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.22, ease: EASE_STANDARD }}
            style={{ x }}
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
