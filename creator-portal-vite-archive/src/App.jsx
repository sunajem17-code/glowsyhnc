import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute, ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { AuthProvider } from './lib/AuthContext'
import { Login } from './pages/Login'
import { Settings } from './pages/Settings'
import { Admin } from './pages/Admin'
import { AdminPayoutRun } from './pages/AdminPayoutRun'
import { AdminCreators } from './pages/AdminCreators'
import { AdminBriefs } from './pages/AdminBriefs'
import { Dashboard } from './pages/dashboard/Dashboard'
import { Leaderboard } from './pages/dashboard/Leaderboard'
import { PayoutCalendar } from './pages/dashboard/PayoutCalendar'
import { ActiveBriefs } from './pages/dashboard/ActiveBriefs'
import { SubmitVideo } from './pages/dashboard/SubmitVideo'
import { MySubmissions } from './pages/dashboard/MySubmissions'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/leaderboard" element={<Leaderboard />} />
              <Route path="/dashboard/payout-calendar" element={<PayoutCalendar />} />
              <Route path="/dashboard/briefs" element={<ActiveBriefs />} />
              <Route path="/dashboard/submit" element={<SubmitVideo />} />
              <Route path="/dashboard/submissions" element={<MySubmissions />} />
              <Route path="/settings" element={<Settings />} />

              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/payouts" element={<AdminPayoutRun />} />
                <Route path="/admin/creators" element={<AdminCreators />} />
                <Route path="/admin/briefs" element={<AdminBriefs />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
