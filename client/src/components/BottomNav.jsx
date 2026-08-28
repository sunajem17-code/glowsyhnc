import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { triggerHaptic } from '../utils/haptics'

// Umax-style tab icons as SVG
function ScanIcon({ active }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="5" height="5" rx="1"/>
      <rect x="16" y="3" width="5" height="5" rx="1"/>
      <rect x="3" y="16" width="5" height="5" rx="1"/>
      <line x1="16" y1="16" x2="21" y2="16"/>
      <line x1="16" y1="19" x2="21" y2="19"/>
      <line x1="19" y1="16" x2="19" y2="21"/>
    </svg>
  )
}

function ExtrasIcon({ active }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="1.5" fill={active ? '#fff' : 'rgba(255,255,255,0.4)'}/>
      <circle cx="6" cy="12" r="1.5" fill={active ? '#fff' : 'rgba(255,255,255,0.4)'}/>
      <circle cx="18" cy="12" r="1.5" fill={active ? '#fff' : 'rgba(255,255,255,0.4)'}/>
    </svg>
  )
}

function DailyIcon({ active }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'}/>
      <path d="M9 12l2 2 4-4" stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'}/>
    </svg>
  )
}

function CoachIcon({ active }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      <circle cx="9" cy="10" r="1" fill={active ? '#fff' : 'rgba(255,255,255,0.4)'}/>
      <circle cx="12" cy="10" r="1" fill={active ? '#fff' : 'rgba(255,255,255,0.4)'}/>
      <circle cx="15" cy="10" r="1" fill={active ? '#fff' : 'rgba(255,255,255,0.4)'}/>
    </svg>
  )
}

const navItems = [
  { to: '/scan',     Icon: ScanIcon,   label: 'scan' },
  { to: '/extras',   Icon: ExtrasIcon,  label: 'extras' },
  { to: '/progress', Icon: DailyIcon,   label: 'daily' },
  { to: '/coach',    Icon: CoachIcon,   label: 'coach' },
]

export const TAB_ROOT_PATHS = navItems.map(item => item.to)

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: '#0a0a0a',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}
    >
      <div className="flex items-center justify-around" style={{ height: 68 }}>
        {navItems.map(({ to, Icon, label }) => {
          const isActive = location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              onClick={triggerHaptic}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none' }}
            >
              <Icon active={isActive} />
              <span style={{ fontSize: 11, color: isActive ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: isActive ? 600 : 400, fontFamily: 'inherit' }}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
