import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { captureEmailUTM } from './utils/affiliate-tracker'
import { initRevenueCat } from './utils/iap'
import { scheduleStreakReminder } from './utils/notifications'
import { AnimatePresence } from 'framer-motion'
import useStore from './store/useStore'
import Layout from './components/Layout'
import UpdatePrompt from './components/UpdatePrompt'
import Splash from './pages/Splash'
import PremiumOnboarding from './pages/PremiumOnboarding'
import PremiumSplash from './pages/PremiumSplash'
import UnlockRevealSlideshow from './components/UnlockRevealSlideshow'

// Heavy routes — lazy loaded so the initial bundle only ships what's needed
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Extras         = lazy(() => import('./pages/Extras'))
const ScanHome       = lazy(() => import('./pages/ScanHome'))
const Scan           = lazy(() => import('./pages/Scan'))
const Results        = lazy(() => import('./pages/Results'))
const ActionPlan     = lazy(() => import('./pages/ActionPlan'))
const Progress       = lazy(() => import('./pages/Progress'))
const DailyCheckin   = lazy(() => import('./pages/DailyCheckin'))
const Profile        = lazy(() => import('./pages/Profile'))
const Premium        = lazy(() => import('./pages/Premium'))
const HairMaxx       = lazy(() => import('./pages/HairMaxx'))
const Leaderboard    = lazy(() => import('./pages/Leaderboard'))
const PrivacyPolicy  = lazy(() => import('./pages/PrivacyPolicy'))
const Terms          = lazy(() => import('./pages/Terms'))
const Compare        = lazy(() => import('./pages/Compare'))
const AICoach        = lazy(() => import('./pages/AICoach'))
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'))
const Landing        = lazy(() => import('./pages/Landing'))
const SwipeMaxx      = lazy(() => import('./pages/SwipeMaxx'))
const TinderMaxx     = lazy(() => import('./pages/TinderMaxx'))
const Community      = lazy(() => import('./pages/Community'))
const SettingsScreen = lazy(() => import('./pages/Settings'))
const ScanUnlockGate = lazy(() => import('./pages/ScanUnlockGate'))
const WorkoutPlan    = lazy(() => import('./pages/WorkoutPlan'))

const SESSION_KEY = 'asc_pro_splash_shown'

function ProtectedRoute({ children }) {
  const isAuthenticated = useStore(s => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/auth" replace />
}

// Where to land right after onboarding finishes. finishOnboarding() and
// handlePromoSuccess() in PremiumOnboarding.jsx set this flag synchronously
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
  const hasOnboarded        = useStore(s => s.hasOnboarded)
  const isAuthenticated     = useStore(s => s.isAuthenticated)
  const isPremium           = useStore(s => s.isPremium)
  const userId              = useStore(s => s.user?.id)
  const refreshProStatus        = useStore(s => s.refreshProStatus)
  const logout                  = useStore(s => s.logout)
  const showUnlockSlideshow     = useStore(s => s.showUnlockSlideshow)
  const setShowUnlockSlideshow  = useStore(s => s.setShowUnlockSlideshow)
  const currentScan             = useStore(s => s.currentScan)
  const [splashDone, setSplashDone] = useState(false)
  const [proSplashDone, setProSplashDone] = useState(
    () => !!sessionStorage.getItem(SESSION_KEY)
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

  // Auto-logout when any API call gets a 401 (expired token)
  useEffect(() => {
    const handle = () => { logout?.(); window.location.replace('/auth') }
    window.addEventListener('auth:session-expired', handle)
    return () => window.removeEventListener('auth:session-expired', handle)
  }, [])

  const handleSplashDone = useCallback(() => { setSplashDone(true) }, [])

  const handleProSplashDone = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, '1')
    setProSplashDone(true)
  }, [])

  // ── UNLOCK SLIDESHOW: absolute top-level, no portal needed ──────
  if (showUnlockSlideshow && currentScan) {
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

  // ── GATE 1: Splash ───────────────────────────────────────────────
  if (!splashDone && isAuthenticated) {
    return <Splash onDone={handleSplashDone} />
  }

  // ── GATE 2: PremiumSplash ────────────────────────────────────────
  // Also check sessionStorage directly: handleUnlockSuccess sets this key
  // synchronously before React commits the isPremium=true batch, so reading
  // it here during the same render correctly suppresses PremiumSplash when
  // the user just unlocked in-session (UnlockRevealSlideshow is their celebration).
  if (isAuthenticated && isPremium && !proSplashDone && !sessionStorage.getItem(SESSION_KEY)) {
    return (
      <AnimatePresence>
        <PremiumSplash onDone={handleProSplashDone} />
      </AnimatePresence>
    )
  }

  return (
    <BrowserRouter>
      <UpdatePrompt />
      <Suspense fallback={<div className="min-h-screen bg-[#F7F5F0] dark:bg-[#121212]" />}>
      <AnimatePresence mode="wait">
        <Routes>
          {/* Legal pages + payment return — always accessible */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/landing" element={<Landing />} />

          {/* Unauthenticated "/" falls through to PremiumOnboarding via * below */}

          {/* /auth no longer used — redirect everything to root (onboarding or app) */}
          <Route path="/auth" element={<Navigate to="/" replace />} />

          {!hasOnboarded ? (
            <Route path="*" element={<PremiumOnboarding />} />
          ) : (
            <>
              <Route path="/" element={
                <ProtectedRoute><Layout /></ProtectedRoute>
              }>
                <Route index element={<PostAuthLanding />} />
                <Route path="scan" element={<ScanHome />} />
                <Route path="scan/capture" element={<Scan />} />
                <Route path="results" element={<Results />} />
                <Route path="extras" element={<Extras />} />
                <Route path="plan" element={<ActionPlan />} />
                <Route path="progress" element={<Progress />} />
                <Route path="checkin" element={<DailyCheckin />} />
                <Route path="profile" element={<Profile />} />
                <Route path="premium" element={<Premium />} />
                <Route path="hairmaxx" element={<HairMaxx />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="compare" element={<Compare />} />
                <Route path="coach" element={<AICoach />} />
                <Route path="swipemaxx" element={<SwipeMaxx />} />
                <Route path="tindermaxx" element={<TinderMaxx />} />
                <Route path="community" element={<Community />} />
                <Route path="settings" element={<SettingsScreen />} />
                <Route path="workout-plan" element={<WorkoutPlan />} />
                <Route path="unlock" element={<ScanUnlockGate />} />
              </Route>
            </>
          )}
        </Routes>
      </AnimatePresence>
      </Suspense>
    </BrowserRouter>
  )
}
