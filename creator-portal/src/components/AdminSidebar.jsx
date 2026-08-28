'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/AuthContext'

const ADMIN_NAV = [
  { to: '/admin', label: 'Review Queue', end: true },
  { to: '/admin/creators', label: 'Creators' },
  { to: '/admin/payouts', label: 'Payout Run' },
]

function NavItem({ to, label, end, onClick }) {
  const pathname = usePathname()
  const isActive = end ? pathname === to : pathname.startsWith(to)
  return (
    <Link
      href={to}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive ? 'bg-gold/10 text-gold' : 'text-text-muted hover:bg-surface-raised hover:text-text'
      }`}
    >
      {label}
    </Link>
  )
}

function NavContent({ onNav }) {
  const { creator, session } = useAuth()
  const router = useRouter()
  const avatarUrl = session?.user?.user_metadata?.avatar_url

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-2">
        <span className="text-xl font-black tracking-[0.2em] text-gold uppercase">Ascendus</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted/50 bg-surface-raised px-1.5 py-0.5 rounded ml-1">ADMIN</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {ADMIN_NAV.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} end={item.end} onClick={onNav} />
        ))}
      </nav>

      {/* Switch to creator view */}
      <div className="border-t border-border px-3 py-4 space-y-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-gold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Creator View
        </button>
        <div className="flex items-center gap-2.5 px-1">
          {avatarUrl && <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full shrink-0" />}
          <span className="text-xs text-text-muted truncate">{creator?.discord_handle}</span>
        </div>
      </div>
    </div>
  )
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface sticky top-0">
        <NavContent onNav={() => {}} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-black tracking-[0.2em] text-gold uppercase">Ascendus</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/50 bg-surface-raised px-1.5 py-0.5 rounded">ADMIN</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border p-2 text-text-muted hover:text-text transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-surface h-full flex flex-col shadow-2xl">
            <div className="absolute top-3 right-3">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-border p-2 text-text-muted hover:text-text">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavContent onNav={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
