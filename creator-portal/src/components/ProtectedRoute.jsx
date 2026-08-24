import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted">
        Loading…
      </div>
    )
  }

  if (!session) return <Navigate to="/" replace />

  return <Outlet />
}

export function AdminRoute() {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted">
        Loading…
      </div>
    )
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
