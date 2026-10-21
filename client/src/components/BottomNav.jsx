import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bot, Camera, Grid2x2, TrendingUp } from 'lucide-react'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const navItems = [
  { to: '/scan',      icon: Camera,    label: 'Scan' },
  { to: '/timeline', icon: TrendingUp, label: 'Progress' },
  { to: '/progress', icon: Bot, label: 'AI Coach' },
  { to: '/extras', icon: Grid2x2, label: 'Extras' },
]

// Single source of truth for which routes are tab roots (lateral destinations
// reached by tapping the bar) vs. pushed detail screens reached by tapping
// into content — Layout uses this to gate the edge-swipe-back gesture, since
// "back" from a tab root isn't a meaningful concept the way it is from a
// pushed screen.
export const TAB_ROOT_PATHS = navItems.map(item => item.to)

export default function BottomNav() {
  const location = useLocation()
  const [hoveredTo, setHoveredTo] = useState(null)

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
        {navItems.map(({ to, icon: Icon, image, label }) => {
          const isActive = location.pathname.startsWith(to)
          const isHighlighted = isActive || hoveredTo === to
          return (
            <NavLink
              key={to}
              to={to}
              onClick={triggerHaptic}
              onMouseEnter={() => setHoveredTo(to)}
              onMouseLeave={() => setHoveredTo(null)}
              onFocus={() => setHoveredTo(to)}
              onBlur={() => setHoveredTo(null)}
              className="relative flex flex-col items-center gap-1.5 px-4 py-2 min-w-[56px]"
            >
              <div className="relative w-6 h-6 flex items-center justify-center">
                {image ? (
                  <img
                    src={image}
                    alt=""
                    aria-hidden="true"
                    className="w-10 h-10 max-w-none object-contain flex-shrink-0"
                    style={{
                      filter: isHighlighted
                        ? 'grayscale(1) sepia(1) saturate(1.4) hue-rotate(5deg) brightness(0.95)'
                        : 'grayscale(1) brightness(0.8)',
                      mixBlendMode: 'screen',
                      opacity: isHighlighted ? 1 : 0.55,
                      transition: 'filter 0.2s, opacity 0.2s',
                    }}
                  />
                ) : <Icon
                  size={24}
                  strokeWidth={isHighlighted ? 2.5 : 1.7}
                  style={{
                    color: isHighlighted ? GOLD : 'var(--text-secondary)',
                    transition: 'color 0.2s',
                  }}
                />}
                </div>
              <span
                className="text-[11px] font-body font-medium transition-colors duration-200"
                style={{ color: isHighlighted ? GOLD : 'var(--text-secondary)' }}
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
