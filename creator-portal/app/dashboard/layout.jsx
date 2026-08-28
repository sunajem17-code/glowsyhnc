'use client'
import { useAuth } from '../../src/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sidebar } from '../../src/components/Sidebar'

export default function DashboardLayout({ children }) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) router.push('/login')
  }, [loading, session, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted">
        Loading…
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      {/* pt-14 on mobile = room for fixed top bar; lg:pt-0 removes it on desktop */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pt-20 lg:px-8 lg:py-8 lg:pt-8">
        {children}
      </main>
    </div>
  )
}
