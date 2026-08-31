import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Scissors, CheckSquare, CalendarCheck, Settings, TrendingUp } from 'lucide-react'
import MotionPage from '../components/MotionPage'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const CARDS = [
  {
    to: '/timeline',
    icon: TrendingUp,
    title: 'Progress',
    subtitle: 'Timeline of your recent scans and ratings',
    accent: '#C6A85C',
  },
  {
    to: '/hairmaxx',
    icon: Scissors,
    title: 'HairMaxx',
    subtitle: 'Find your best hairstyle',
    accent: '#C6A85C',
  },
  {
    to: '/checkin',
    icon: CheckSquare,
    title: 'Daily To-Do',
    subtitle: 'Track habits and tasks',
    accent: '#C6A85C',
  },
  {
    to: '/workout-plan',
    icon: CalendarCheck,
    title: 'Routine Tracker',
    subtitle: 'Build your glow-up plan',
    accent: '#C6A85C',
  },
]

export default function Extras() {
  const navigate = useNavigate()

  return (
    <MotionPage>
      <div
        className="flex flex-col min-h-full px-5 pb-8"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1
              className="font-heading font-bold text-[28px] leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Extras
            </h1>
            <p
              className="font-body text-[14px] mt-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Tools to accelerate your ascent
            </p>
          </div>
          <button
            onClick={() => { triggerHaptic(); navigate('/settings') }}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-transform flex-shrink-0 mt-1"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            aria-label="Settings"
          >
            <Settings size={17} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Stacked full-width feature cards */}
        <div className="flex flex-col gap-5">
          {CARDS.map(({ to, icon: Icon, title, subtitle }, i) => (
            <motion.button
              key={to}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07, ease: EASE_STANDARD }}
              onClick={() => { triggerHaptic(); navigate(to) }}
              className="flex items-center gap-5 w-full rounded-2xl px-5 py-6 text-left active:scale-[0.98] transition-transform"
              style={{
                background: 'var(--card)',
                border: '1px solid rgba(198,168,92,0.18)',
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.12)' }}
              >
                <Icon size={24} style={{ color: GOLD }} />
              </div>
              <div className="flex flex-col">
                <span
                  className="font-heading font-bold text-[19px] leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {title}
                </span>
                <span
                  className="font-body text-[14px] mt-1 leading-snug"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {subtitle}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </MotionPage>
  )
}
