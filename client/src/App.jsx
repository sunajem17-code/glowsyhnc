import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { captureEmailUTM } from './utils/affiliate-tracker'
import { initRevenueCat } from './utils/iap'
import { requestNotificationPermission, scheduleStreakReminder } from './utils/notifications'
import { AnimatePresence } from 'framer-motion'
import useStore from './store/useStore'
import Layout from './components/Layout'
import UpdatePrompt from './components/UpdatePrompt'
import Splash from './pages/Splash'
import PremiumOnboarding from './pages/PremiumOnboarding'
import Auth from './pages/Auth'
import AgeGate from './pages/AgeGate'

// Heavy routes — lazy loaded so the initial bundle only ships what's needed
const Dashboard      = lazy(() => import('./pages/Dashboard'))
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
const Referral       = lazy(() => import('./pages/Referral'))
const Compare        = lazy(() => import('./pages/Compare'))
const AICoach        = lazy(() => import('./pages/AICoach'))
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'))
const PremiumSplash  = lazy(() => import('./pages/PremiumSplash'))
const Landing        = lazy(() => import('./pages/Landing'))
const SwipeMaxx      = lazy(() => import('./pages/SwipeMaxx'))
const TinderMaxx     = lazy(() => import('./pages/TinderMaxx'))
const Community      = lazy(() => import('./pages/Community'))
const ScanUnlockGate = lazy(() => import('./pages/ScanUnlockGate'))

const SESSION_KEY = 'asc_pro_splash_shown'

function ProtectedRoute({ children }) {
  const isAuthenticated = useStore(s => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/auth" replace />
}

export default function App() {
  const { theme, hasOnboarded, isAuthenticated, checkProTrial, isPremium, refreshProStatus, user, logout, ageConfirmed, setAgeConfirmed } = useStore()
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
  useEffect(() => { initRevenueCat(user?.id ?? null).catch(() => {}) }, [user?.id])

  // Check if pro trial has expired on load
  useEffect(() => {
    if (checkProTrial) checkProTrial()
  }, [])

  // Refresh Pro status on startup and whenever app comes back to foreground
  useEffect(() => {
    if (!isAuthenticated) return
    refreshProStatus()
    const onVisible = () => { if (document.visibilityState === 'visible') refreshProStatus() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [isAuthenticated])

  // Request notification permission + schedule streak reminder after login
  useEffect(() => {
    if (!isAuthenticated) return
    requestNotificationPermission().then(granted => {
      if (granted) scheduleStreakReminder().catch(() => {})
    }).catch(() => {})
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

  // COPPA: age gate is shown once per install, before anything else
  if (!ageConfirmed) {
    return <AgeGate onConfirmed={setAgeConfirmed} />
  }

  // Skip splash entirely for unauthenticated users — they land on the SEO landing
  // page directly, which is better for conversion AND Google crawling.
  if (!splashDone && isAuthenticated) {
    return <Splash onDone={() => setSplashDone(true)} />
  }

  // Show premium splash once per session for Pro users (only after main splash)
  if (isAuthenticated && isPremium && !proSplashDone) {
    return (
      <AnimatePresence>
        <PremiumSplash onDone={() => {
          sessionStorage.setItem(SESSION_KEY, '1')
          setProSplashDone(true)
        }} />
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

          {/* Auth always accessible — must be outside hasOnboarded gate */}
          <Route path="/auth" element={
            isAuthenticated ? <Navigate to="/" replace /> : <Auth />
          } />

          {!hasOnboarded ? (
            <Route path="*" element={<PremiumOnboarding />} />
          ) : (
            <>
              <Route path="/" element={
                <ProtectedRoute><Layout /></ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="scan" element={<Scan />} />
                <Route path="results" element={<Results />} />
                <Route path="plan" element={<ActionPlan />} />
                <Route path="progress" element={<Progress />} />
                <Route path="checkin" element={<DailyCheckin />} />
                <Route path="profile" element={<Profile />} />
                <Route path="premium" element={<Premium />} />
                <Route path="hairmaxx" element={<HairMaxx />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="referral" element={<Referral />} />
                <Route path="compare" element={<Compare />} />
                <Route path="coach" element={<AICoach />} />
                <Route path="swipemaxx" element={<SwipeMaxx />} />
                <Route path="tindermaxx" element={<TinderMaxx />} />
                <Route path="community" element={<Community />} />
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
