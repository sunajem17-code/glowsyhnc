import ScreenLoading from './components/ScreenLoading'
import { loadScreen } from './utils/screenLoader'
import { hasCompletedOnboarding, onboardingStartup } from './utils/onboardingStartup.js'
import { StartupCheck, DevelopmentOnboardingReset } from './components/OnboardingStartup'
import NotificationPrompt from './components/NotificationPrompt'
import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { captureEmailUTM } from './utils/affiliate-tracker'
import { initRevenueCat } from './utils/iap'
import { scheduleStreakReminder } from './utils/notifications'
import { AnimatePresence } from 'framer-motion'
import useStore from './store/useStore'
import Layout from './components/Layout'
import UpdatePrompt from './components/UpdatePrompt'
import Splash, { CinematicIntro } from './pages/Splash'
import PremiumOnboarding from './pages/PremiumOnboarding'
import UnlockRevealSlideshow from './components/UnlockRevealSlideshow'
import { getStartupSplash } from './utils/splashFlow'

const lazyScreen = loader => lazy(() => loadScreen(loader))

// Heavy routes — lazy loaded so the initial bundle only ships what's needed
const Dashboard      = lazyScreen(() => import('./pages/Dashboard'))
const Extras         = lazyScreen(() => import('./pages/Extras'))
const ScanHome       = lazyScreen(() => import('./pages/ScanHome'))
const Scan           = lazyScreen(() => import('./pages/Scan'))
const Results        = lazyScreen(() => import('./pages/Results'))
const ActionPlan     = lazyScreen(() => import('./pages/ActionPlan'))
const Progress       = lazyScreen(() => import('./pages/Progress'))
const Streak         = lazyScreen(() => import('./pages/Streak'))
const Profile        = lazyScreen(() => import('./pages/Profile'))
const Premium        = lazyScreen(() => import('./pages/Premium'))
const Leaderboard    = lazyScreen(() => import('./pages/Leaderboard'))
const PrivacyPolicy  = lazyScreen(() => import('./pages/PrivacyPolicy'))
const Terms          = lazyScreen(() => import('./pages/Terms'))
const Compare        = lazyScreen(() => import('./pages/Compare'))
const AICoach        = lazyScreen(() => import('./pages/AICoach'))
const PaymentSuccess = lazyScreen(() => import('./pages/PaymentSuccess'))
const Landing        = lazyScreen(() => import('./pages/Landing'))
const SwipeMaxx      = lazyScreen(() => import('./pages/SwipeMaxx'))
const TinderMaxx     = lazyScreen(() => import('./pages/TinderMaxx'))
const Community      = lazyScreen(() => import('./pages/Community'))
const SettingsScreen = lazyScreen(() => import('./pages/Settings'))
const ScanUnlockGate = lazyScreen(() => import('./pages/ScanUnlockGate'))
const ScanReady      = lazyScreen(() => import('./pages/ScanReady'))
const ScanQualityFail = lazyScreen(() => import('./pages/ScanQualityFail'))
const WorkoutPlan    = lazyScreen(() => import('./pages/WorkoutPlan'))
const FaceBodyRoutine = lazyScreen(() => import('./pages/FaceBodyRoutine'))
const ScanHistory    = lazyScreen(() => import('./pages/ScanHistory'))
const ScanTimeline   = lazyScreen(() => import('./pages/ScanTimeline'))
const AnalysisInspector = import.meta.env.DEV ? lazyScreen(() => import('./pages/AnalysisInspector')) : null

// Stores the referral code from /r/:code links and redirects to onboarding
function ReferralRedirect() {
  const { code } = useParams()
  useEffect(() => {
    if (code) sessionStorage.setItem('asc_ref_code', code.toUpperCase())
  }, [code])
  return <Navigate to="/" replace />
}

function ProtectedRoute({ children }) {
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const startup = useStore(onboardingStartup)
  if (startup === 'checking') return <StartupCheck />
  if (startup === 'signin') return <Navigate to="/auth" replace />
  if (startup === 'onboarding') return <Navigate to="/onboarding" replace />
  return isAuthenticated ? children : <Navigate to="/auth" replace />
}

// Where to land right after onboarding finishes. finishOnboarding() sets this
// flag synchronously
// BEFORE flipping hasOnboarded (which swaps this whole <Routes> tree in from
// the onboarding catch-all below), so this route reads it on the very first
// render of the real app tree — deterministic, no race against an async
// navigate() call. Falls back to /scan (the normal landing page) otherwise.
const POST_ONBOARD_DEST_KEY = 'asc_post_onboard_dest'
function PostAuthLanding() {
  const dest = sessionStorage.getItem(POST_ONBOARD_DEST_KEY)
  if (dest) {
    sessionStorage.removeItem(POST_ONBOARD_DEST_KEY)
    return <Navigate to={dest} replace />
  }
  return <Navigate to="/scan" replace />
}

export default function App() {
  const theme               = useStore(s => s.theme)
  const hasOnboarded        = useStore(hasCompletedOnboarding)
  const startupDecision     = useStore(onboardingStartup)
  const isAuthenticated     = useStore(s => s.isAuthenticated)
  const userId              = useStore(s => s.user?.id)
  const refreshProStatus        = useStore(s => s.refreshProStatus)
  const expireSession           = useStore(s => s.expireSession)
  const showUnlockSlideshow     = useStore(s => s.showUnlockSlideshow)
  const setShowUnlockSlideshow  = useStore(s => s.setShowUnlockSlideshow)
  const currentScan             = useStore(s => s.currentScan)
  const [cinematicDone, setCinematicDone] = useState(
    () => localStorage.getItem('asc_cinematic_shown') === '1'
  )
  const [splashDone, setSplashDone] = useState(
    () => localStorage.getItem('asc_welcome_splash_shown') === '1'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Capture email UTM params on every load (for email click attribution)
  useEffect(() => { captureEmailUTM() }, [])

  // Initialize RevenueCat — pass user ID when logged in so purchases are linked
  useEffect(() => {
    initRevenueCat(userId ?? null).catch(() => {})
  }, [userId])

  // Refresh Pro status on startup and whenever app comes back to foreground
  useEffect(() => {
    if (!isAuthenticated) return
    refreshProStatus()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshProStatus() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isAuthenticated])

  // Schedule streak reminder only — permission is requested during onboarding
  useEffect(() => {
    if (!isAuthenticated) return
    scheduleStreakReminder().catch(() => {})
  }, [isAuthenticated])

  // Network connectivity monitoring — graceful offline handling via browser API
  useEffect(() => {
    const handleOffline = () => console.warn('[Network] Device went offline')
    window.addEventListener('offline', handleOffline)
    return () => window.removeEventListener('offline', handleOffline)
  }, [])

  // Expired credentials require sign-in without discarding completed setup.
  useEffect(() => {
    const handle = () => { expireSession() }
    window.addEventListener('auth:session-expired', handle)
    return () => window.removeEventListener('auth:session-expired', handle)
  }, [expireSession])

  const handleSplashDone = useCallback(() => {
    localStorage.setItem('asc_welcome_splash_shown', '1')
    setSplashDone(true)
  }, [])

  // No route, redirect, premium overlay or splash can bypass this decision.
  if (startupDecision === 'checking') return <StartupCheck />
  if (startupDecision === 'signin') return <BrowserRouter><PremiumOnboarding initialSignIn /></BrowserRouter>
  const resetRoute = import.meta.env.DEV && window.location.pathname === '/dev/reset-onboarding'

  // ── UNLOCK SLIDESHOW: absolute top-level, no portal needed ──────
  if (!resetRoute && hasOnboarded && showUnlockSlideshow && currentScan) {
    return (
      <UnlockRevealSlideshow
        scan={currentScan}
        onFinish={() => {
          setShowUnlockSlideshow(false)
          window.location.replace('/results')
        }}
      />
    )
  }

  // ── GATE 0: Cinematic intro — plays once per session for everyone ──
  const startupSplash = getStartupSplash({ cinematicDone, splashDone })

  if (!resetRoute && !hasOnboarded && startupSplash === 'cinematic') {
    return (
      <CinematicIntro onDone={() => {
        localStorage.setItem('asc_cinematic_shown', '1')
        setCinematicDone(true)
      }} />
    )
  }

  // ── GATE 1: Splash ───────────────────────────────────────────────
  if (!resetRoute && !hasOnboarded && startupSplash === 'welcome') {
    return <Splash onDone={handleSplashDone} />
  }

  return (
    <BrowserRouter>
      <UpdatePrompt />
      <NotificationPrompt enabled={isAuthenticated && hasOnboarded} userId={userId} />
      <Suspense fallback={<ScreenLoading />}>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Legal pages + payment return — always accessible */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/landing" element={<Landing />} />
          {AnalysisInspector && <Route path="/dev/analysis-inspector" element={<AnalysisInspector />} />}
          <Route path="/r/:code" element={<ReferralRedirect />} />

          {/* Unauthenticated "/" falls through to PremiumOnboarding via * below */}

          {/* Returning users can sign in directly without restarting setup. */}
          <Route path="/auth" element={isAuthenticated && hasOnboarded ? <Navigate to="/" replace /> : <PremiumOnboarding initialSignIn />} />
          <Route path="/onboarding" element={hasOnboarded ? <Navigate to="/" replace /> : <PremiumOnboarding />} />
          {import.meta.env.DEV && <Route path="/dev/reset-onboarding" element={<DevelopmentOnboardingReset />} />}

          {!hasOnboarded ? (
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          ) : (
            <>
              {/* Full-screen reveal must not wait for the outgoing scan outlet's
                  nested exit animation or inherit its transformed viewport. */}
              <Route path="/unlock" element={<ProtectedRoute><ScanUnlockGate /></ProtectedRoute>} />
              <Route path="/physique-results" element={<Navigate to="/timeline" replace />} />
              <Route path="/results" element={<Navigate to="/unlock" replace />} />
              <Route path="/" element={
                <ProtectedRoute><Layout /></ProtectedRoute>
              }>
                <Route index element={<PostAuthLanding />} />
                <Route path="scan" element={<ScanHome />} />
                <Route path="scan/capture" element={<Scan />} />
                {/* The reveal/unlock screen is the single post-scan destination. */}
                <Route path="extras" element={<Extras />} />
                <Route path="plan" element={<ActionPlan />} />
                <Route path="progress" element={<Progress />} />
                <Route path="checkin" element={<Navigate to="/face-body-routine" replace />} />
                <Route path="streak" element={<Streak />} />
                <Route path="profile" element={<Profile />} />
                <Route path="premium" element={<Navigate to="/unlock?paywall=1" replace />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="compare" element={<Compare />} />
                <Route path="history" element={<ScanHistory />} />
                <Route path="timeline" element={<ScanTimeline />} />
                <Route path="coach" element={<AICoach />} />
                <Route path="swipemaxx" element={<SwipeMaxx />} />
                <Route path="tindermaxx" element={<TinderMaxx />} />
                <Route path="community" element={<Community />} />
                <Route path="settings" element={<SettingsScreen />} />
                <Route path="workout-plan" element={<WorkoutPlan />} />
                <Route path="face-body-routine" element={<FaceBodyRoutine />} />
                <Route path="physique-scan" element={<Navigate to="/scan" replace />} />
                <Route path="scan/ready" element={<ScanReady />} />
                <Route path="scan/quality-fail" element={<ScanQualityFail />} />
              </Route>
            </>
          )}
        </Routes>
      </AnimatePresence>
      </Suspense>
    </BrowserRouter>
  )
}
