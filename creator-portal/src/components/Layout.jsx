'use client'
import { Sidebar } from './Sidebar'

export function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        {children}
      </main>
    </div>
  )
}
