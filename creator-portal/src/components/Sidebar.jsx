'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/submit', label: 'Submit Video' },
  { to: '/dashboard/submissions', label: 'My Submissions' },
  { to: '/dashboard/payout-calendar', label: 'Payout Calendar' },
  { to: '/dashboard/briefs', label: 'Offers' },
  { to: '/dashboard/link-account', label: 'Link Account' },
  { to: '/settings', label: 'Settings' },
]

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Review', end: true },
  { to: '/admin/dashboard', label: 'Submissions' },
  { to: '/admin/payouts', label: 'Payout Run' },
  { to: '/admin/creators', label: 'Creators' },
  { to: '/admin/briefs', label: 'Manage Briefs' },
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
  const { session, creator, isAdmin } = useAuth()
  const router = useRouter()
  const avatarUrl = session?.user?.user_metadata?.avatar_url

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-5 py-5">
        <span className="text-xl font-black tracking-[0.2em] text-gold uppercase">Ascendus</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} to={item.to} label={item.label} end={item.end} onClick={onNav} />
        ))}

        {isAdmin && (
          <>
            <div className="mx-3 my-3 h-px bg-border" />
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Admin
            </p>
            {ADMIN_NAV_ITEMS.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} end={item.end} onClick={onNav} />
            ))}
          </>
        )}
      </nav>

      {/* Profile */}
      <div className="border-t border-border px-3 py-4 space-y-3">
        {isAdmin && (
          <button
            onClick={() => router.push('/admin')}
            className="w-full flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm text-gold hover:bg-gold/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Admin Panel
          </button>
        )}
        <div className="flex items-center gap-2.5 px-2">
          {avatarUrl && <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full shrink-0" />}
          <span className="flex-1 truncate text-sm text-text">{creator?.discord_handle}</span>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface sticky top-0">
        <NavContent onNav={() => {}} />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <span className="text-base font-black tracking-[0.2em] text-gold uppercase">Ascendus</span>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border p-2 text-text-muted hover:text-text transition-colors"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] bg-surface h-full flex flex-col shadow-2xl">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border p-2 text-text-muted hover:text-text"
                aria-label="Close menu"
              >
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
