import { NavLink, useLocation } from 'react-router-dom'
import { Camera, Grid2x2, TrendingUp, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { GOLD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const navItems = [
  { to: '/scan',      icon: Camera,    label: 'Scan' },
  { to: '/extras',   icon: Grid2x2,   label: 'Extras' },
  { to: '/progress', icon: TrendingUp, label: 'Progress' },
  { to: '/community',icon: Users,     label: 'Community' },
]

// Single source of truth for which routes are tab roots (lateral destinations
// reached by tapping the bar) vs. pushed detail screens reached by tapping
// into content — Layout uses this to gate the edge-swipe-back gesture, since
// "back" from a tab root isn't a meaningful concept the way it is from a
// pushed screen.
export const TAB_ROOT_PATHS = navItems.map(item => item.to)

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav
      className="flex-shrink-0 relative"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--bg)',
        borderTop: 'none',
      }}
    >
      <div className="flex items-center justify-around h-[74px]">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              onClick={triggerHaptic}
              className="relative flex flex-col items-center gap-1.5 px-4 py-2 min-w-[56px]"
            >
              <div className="relative">
                <Icon
                  size={24}
                  strokeWidth={isActive ? 2.5 : 1.7}
                  style={{
                    color: isActive ? GOLD : 'var(--text-secondary)',
                    transition: 'color 0.2s',
                  }}
                />
                </div>
              <span
                className="text-[11px] font-body font-medium transition-colors duration-200"
                style={{ color: isActive ? GOLD : 'var(--text-secondary)' }}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
