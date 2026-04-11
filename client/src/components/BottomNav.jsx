import { NavLink, useLocation } from 'react-router-dom'
import { Home, Camera, ClipboardList, TrendingUp, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

const GOLD = '#C6A85C'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/scan', icon: Camera, label: 'Scan' },
  { to: '/plan', icon: ClipboardList, label: 'Plan' },
  { to: '/progress', icon: TrendingUp, label: 'Progress' },
  { to: '/coach', icon: Sparkles, label: 'Coach' },
]

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
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
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
