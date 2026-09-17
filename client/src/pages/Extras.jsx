import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Scissors, CheckSquare, CalendarCheck, Settings, TrendingUp, ChevronRight } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const CARDS = [
  {
    to: '/timeline',
    icon: TrendingUp,
    title: 'Progress',
    subtitle: 'Timeline of your recent scans and ratings',
  },
  {
    to: '/hairmaxx',
    icon: Scissors,
    title: 'HairMaxx',
    subtitle: 'Find your best hairstyle',
  },
  {
    to: '/checkin',
    icon: CheckSquare,
    title: 'Daily To-Do',
    subtitle: 'Track habits and tasks',
  },
  {
    to: '/workout-plan',
    icon: CalendarCheck,
    title: 'Routine Tracker',
    subtitle: 'Build your glow-up plan',
  },
]

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } },
}

const headerVariants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

const containerVariants = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
}

const cardVariants = {
  initial: { opacity: 0, y: 32, scale: 0.96 },
  animate: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function Extras() {
  const navigate = useNavigate()

  return (
    <motion.div
      className="flex flex-col min-h-full"
      style={{ background: 'var(--bg)' }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div
        className="flex flex-col px-5 pb-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)' }}
      >
        {/* Header */}
        <motion.div
          className="flex items-start justify-between mb-8"
          variants={headerVariants}
          initial="initial"
          animate="animate"
        >
          <div>
            <h1
              className="font-heading font-bold text-[30px] leading-tight"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Extras
            </h1>
            <p className="font-body text-[14px] mt-1" style={{ color: 'var(--text-secondary)' }}>
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
        </motion.div>

        {/* Cards */}
        <motion.div
          className="flex flex-col gap-4"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          {CARDS.map(({ to, icon: Icon, title, subtitle }, i) => (
            <motion.button
              key={to}
              variants={cardVariants}
              onClick={() => { triggerHaptic(); navigate(to) }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-4 w-full rounded-2xl px-5 py-5 text-left"
              style={{
                background: 'var(--card)',
                border: '1px solid rgba(198,168,92,0.15)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
              }}
            >
              {/* Icon badge */}
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(198,168,92,0.10)',
                  border: '1px solid rgba(198,168,92,0.18)',
                }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.18 + i * 0.08, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <Icon size={22} style={{ color: GOLD }} />
              </motion.div>

              {/* Text */}
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className="font-heading font-bold text-[18px] leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {title}
                </span>
                <span
                  className="font-body text-[13px] mt-0.5 leading-snug"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {subtitle}
                </span>
              </div>

              {/* Chevron */}
              <ChevronRight size={18} style={{ color: `${GOLD}66`, flexShrink: 0 }} />
            </motion.button>
          ))}
        </motion.div>
      </div>
    </motion.div>
  )
}
