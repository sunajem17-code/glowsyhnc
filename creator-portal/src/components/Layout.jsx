import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import ascendusIcon from '../assets/ascendus-icon.png'

const navLinkClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-gold/10 text-gold' : 'text-text-muted hover:text-text'
  }`

export function Layout() {
  const { creator, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <img src={ascendusIcon} alt="Ascendus" className="h-7 w-7 mix-blend-screen" />
              <span className="text-lg font-semibold tracking-tight text-gold">Ascendus</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/dashboard/briefs" className={navLinkClass}>
                Briefs
              </NavLink>
              <NavLink to="/dashboard/submit" className={navLinkClass}>
                Submit
              </NavLink>
              <NavLink to="/dashboard/submissions" className={navLinkClass}>
                My Submissions
              </NavLink>
              <NavLink to="/dashboard/payouts" className={navLinkClass}>
                Payouts
              </NavLink>
              <NavLink to="/settings" className={navLinkClass}>
                Settings
              </NavLink>
              {isAdmin && (
                <>
                  <span className="mx-1 h-4 w-px bg-border" />
                  <NavLink to="/admin" end className={navLinkClass}>
                    Review
                  </NavLink>
                  <NavLink to="/admin/payouts" className={navLinkClass}>
                    Payout Run
                  </NavLink>
                  <NavLink to="/admin/creators" className={navLinkClass}>
                    Creators
                  </NavLink>
                  <NavLink to="/admin/briefs" className={navLinkClass}>
                    Manage Briefs
                  </NavLink>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">{creator?.discord_handle}</span>
            <button
              onClick={() => signOut()}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-gold/40 hover:text-gold"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
