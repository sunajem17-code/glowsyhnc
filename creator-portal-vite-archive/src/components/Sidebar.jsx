import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import ascendusIcon from '../assets/ascendus-icon.png'

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-gold/10 text-gold' : 'text-text-muted hover:bg-surface-raised hover:text-text'
  }`

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/submit', label: 'Submit Video' },
  { to: '/dashboard/submissions', label: 'My Videos' },
  { to: '/dashboard/leaderboard', label: 'Leaderboard' },
  { to: '/dashboard/payout-calendar', label: 'Payout Calendar' },
  { to: '/dashboard/briefs', label: 'Offers' },
  { to: '/settings', label: 'Settings' },
]

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Review', end: true },
  { to: '/admin/payouts', label: 'Payout Run' },
  { to: '/admin/creators', label: 'Creators' },
  { to: '/admin/briefs', label: 'Manage Briefs' },
]

export function Sidebar() {
  const { session, creator, isAdmin, signOut } = useAuth()
  const avatarUrl = session?.user?.user_metadata?.avatar_url

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-6">
        <img src={ascendusIcon} alt="Ascendus" className="h-7 w-7 mix-blend-screen" />
        <span className="text-lg font-semibold tracking-tight text-gold">Ascendus</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="mx-3 my-3 h-px bg-border" />
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Admin
            </p>
            {ADMIN_NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center gap-2.5 px-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 text-sm font-semibold text-gold">
              {creator?.discord_handle?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <span className="flex-1 truncate text-sm text-text">{creator?.discord_handle}</span>
        </div>
        <button
          onClick={() => signOut()}
          className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-text-muted transition-colors hover:border-gold/40 hover:text-gold"
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}
