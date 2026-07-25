import { NavLink, useLocation } from 'react-router-dom'
import { Home, Camera, ClipboardList, TrendingUp, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { GOLD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/scan', icon: Camera, label: 'Scan' },
  { to: '/plan', icon: ClipboardList, label: 'Plan' },
  { to: '/progress', icon: TrendingUp, label: 'Progress' },
  { to: '/community', icon: Users, label: 'Community' },
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
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -1px 0 var(--border)',
      }}
    >
      <div className="flex items-center justify-around h-[68px]">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              onClick={triggerHaptic}
              className="relative flex flex-col items-center gap-1 px-4 py-2"
            >
              <div className="relative">
                <Icon
                  size={21}
                  strokeWidth={isActive ? 2.5 : 1.7}
                  style={{
                    color: isActive ? GOLD : 'var(--text-secondary)',
                    transition: 'color 0.2s',
                  }}
                />
                {isActive && (
                  <motion.div
                    layoutId="navGoldDot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}` }}
                    transition={SPRING_STANDARD}
                  />
                )}
              </div>
              <span
                className="text-[10px] font-body font-medium transition-colors duration-200"
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
