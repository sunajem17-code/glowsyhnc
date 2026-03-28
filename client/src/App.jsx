import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import useStore from './store/useStore'
import Layout from './components/Layout'
import Onboarding from './pages/Onboarding'
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

function ProtectedRoute({ children }) {
  const isAuthenticated = useStore(s => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/auth" replace />
}

export default function App() {
  const { theme, hasOnboarded, isAuthenticated } = useStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <Routes>
          {!hasOnboarded && (
            <Route path="*" element={<Onboarding />} />
          )}
          <Route path="/auth" element={
            isAuthenticated ? <Navigate to="/" replace /> : <Auth />
          } />
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
          </Route>
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  )
}
