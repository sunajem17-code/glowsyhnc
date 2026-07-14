import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TourShell from './TourShell'
import WelcomeStep from './steps/WelcomeStep'
import CompletionStep from './steps/CompletionStep'
import AICoachDemoStep from './steps/AICoachDemoStep'
import CommunityDemoStep from './steps/CommunityDemoStep'
import PhotoRankerDemoStep from './steps/PhotoRankerDemoStep'
import HairMaxxDemoStep from './steps/HairMaxxDemoStep'
import CompareDemoStep from './steps/CompareDemoStep'
import DailyCheckinDemoStep from './steps/DailyCheckinDemoStep'
import ActionPlanStep from './steps/ActionPlanStep'
import WorkoutPlanStep from './steps/WorkoutPlanStep'
import ProgressStep from './steps/ProgressStep'
import LeaderboardStep from './steps/LeaderboardStep'
import ReferralStep from './steps/ReferralStep'

// Feature steps are appended here one at a time as they're built — each entry
// is { id, Component }. Final order (per plan): AI Coach, Community, Photo
// Ranker, HairMaxx, Compare, Daily Check-in, then the five static walkthrough
// steps. Built out of order (per the plan's build sequence), so this array is
// always rewritten in full rather than appended to, to keep final order correct.
const FEATURE_STEPS = [
  { id: 'ai-coach', Component: AICoachDemoStep },
  { id: 'community', Component: CommunityDemoStep },
  { id: 'photo-ranker', Component: PhotoRankerDemoStep },
  { id: 'hairmaxx', Component: HairMaxxDemoStep },
  { id: 'compare', Component: CompareDemoStep },
  { id: 'daily-checkin', Component: DailyCheckinDemoStep },
  { id: 'action-plan', Component: ActionPlanStep },
  { id: 'workout-plan', Component: WorkoutPlanStep },
  { id: 'progress', Component: ProgressStep },
  { id: 'leaderboard', Component: LeaderboardStep },
  { id: 'referral', Component: ReferralStep },
]

const pageVariants = {
  enter: (dir) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
}
const pageTrans = { type: 'spring', stiffness: 380, damping: 36 }

function buildScreens() {
  return [
    { id: 'welcome', Component: WelcomeStep, featureNumber: null },
    ...FEATURE_STEPS.map((s, i) => ({
      id: s.id,
      Component: s.Component,
      featureNumber: i + 1,
    })),
    { id: 'completion', Component: CompletionStep, featureNumber: null },
  ]
}

export default function FeatureTour({ onDone }) {
  const [screens] = useState(buildScreens)
  const [stepIndex, setStepIndex] = useState(0)
  const [dir, setDir] = useState(1)

  const screen = screens[stepIndex]
  const isWelcome = screen.id === 'welcome'
  const isCompletion = screen.id === 'completion'

  function goNext() {
    if (stepIndex >= screens.length - 1) {
      onDone()
      return
    }
    setDir(1)
    setStepIndex(i => i + 1)
  }

  const StepComponent = screen.Component

  return (
    <TourShell
      featureStepNumber={screen.featureNumber}
      featureStepTotal={FEATURE_STEPS.length}
      onNext={goNext}
      onSkip={onDone}
      hideSkip={isCompletion}
      nextLabel={isWelcome ? "Show me around" : isCompletion ? 'Go to Dashboard' : 'Next'}
    >
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={screen.id}
          custom={dir}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={pageTrans}
          className="h-full"
        >
          <StepComponent />
        </motion.div>
      </AnimatePresence>
    </TourShell>
  )
}
