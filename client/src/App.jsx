import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { captureEmailUTM } from './utils/affiliate-tracker'
import { AnimatePresence } from 'framer-motion'
import useStore from './store/useStore'
import Layout from './components/Layout'
import Splash from './pages/Splash'
import PremiumOnboarding from './pages/PremiumOnboarding'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Scan from './pages/Scan'
import Results from './pages/Results'
import ActionPlan from './pages/ActionPlan'
import Progress from './pages/Progress'
import DailyCheckin from './pages/DailyCheckin'
import Profile from './pages/Profile'
import Premium from './pages/Premium'
import HairMaxx from './pages/HairMaxx'
import Leaderboard from './pages/Leaderboard'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import Referral from './pages/Referral'
import Compare from './pages/Compare'
import AICoach from './pages/AICoach'
import PaymentSuccess from './pages/PaymentSuccess'
import PremiumSplash from './pages/PremiumSplash'
import Landing from './pages/Landing'

const SESSION_KEY = 'asc_pro_splash_shown'

function ProtectedRoute({ children }) {
  const isAuthenticated = useStore(s => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/auth" replace />
}

export default function App() {
  const { theme, hasOnboarded, isAuthenticated, checkProTrial, isPremium, refreshProStatus } = useStore()
  const [splashDone, setSplashDone] = useState(false)
  const [proSplashDone, setProSplashDone] = useState(
    () => !!sessionStorage.getItem(SESSION_KEY)
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Capture email UTM params on every load (for email click attribution)
  useEffect(() => { captureEmailUTM() }, [])

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
      <AnimatePresence mode="wait">
        <Routes>
          {/* Legal pages + payment return — always accessible */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />

          {/* Landing page for unauthenticated visitors — beats path="*" by specificity */}
          {!isAuthenticated && (
            <Route path="/" element={<Landing />} />
          )}

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
              </Route>
            </>
          )}
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  )
}
