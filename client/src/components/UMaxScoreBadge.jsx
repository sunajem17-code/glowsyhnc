import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { PSL_TIERS, getTier } from '../utils/analysis'

// ─── Full PSL Scale reference ─────────────────────────────────────────────────

function ScaleReference({ gender }) {
  return (
    <div className="mt-3 space-y-1">
      {[...PSL_TIERS].reverse().map(tier => {
        const label = gender === 'female'
          ? (tier.femaleShort ?? tier.female)
          : (tier.maleShort ?? tier.male)
        return (
          <div key={tier.min} className="flex items-center gap-2.5 py-1">
            <div className="w-10 flex-shrink-0">
              <span className="text-[10px] font-mono font-bold" style={{ color: tier.color }}>
                {tier.min}–{tier.max === 10 ? '10' : tier.max}
              </span>
            </div>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: tier.color }}
            />
            <span className="text-xs font-heading font-semibold text-primary">{label}</span>
            <span className="text-[9px] text-secondary font-body ml-auto">{tier.percentile}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Score Number Animator ────────────────────────────────────────────────────

function AnimatedNumber({ target }) {
  const [display, setDisplay] = useState(0)
  useState(() => {
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 1400, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(ease * target * 10) / 10)
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  return <span>{display.toFixed(1)}</span>
}

// ─── Main Badge ───────────────────────────────────────────────────────────────

export default function UMaxScoreBadge({ umaxScore, gender = 'male', showScale = false, size = 'large' }) {
  const [scaleOpen, setScaleOpen] = useState(false)
  const tier = getTier(umaxScore, gender)
  const isFemale = gender === 'female'

  // Which tier index for progress bar fill
  const tiersSorted = [...PSL_TIERS].reverse()
  const tierIndex = tiersSorted.findIndex(t => umaxScore >= t.min && umaxScore < t.max)
  const pct = (umaxScore / 10) * 100

  if (size === 'small') {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border"
        style={{ background: tier.bg, borderColor: tier.border }}
      >
        <span className="text-base">{tier.emoji}</span>
        <div>
          <p className="font-mono font-bold text-sm leading-none" style={{ color: tier.color }}>
            {umaxScore.toFixed(1)}
          </p>
          <p className="text-[9px] font-heading font-bold mt-0.5" style={{ color: tier.color }}>
            {tier.shortLabel}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Main tier card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 overflow-hidden"
        style={{ background: tier.bg, borderColor: tier.border }}
      >
        {/* Top row */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            {/* Tier label + score */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{tier.emoji}</span>
                <div>
                  <p className="text-[10px] font-body text-secondary uppercase tracking-widest">
                    Glow Score
                  </p>
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="font-heading font-bold text-xl leading-tight"
                    style={{ color: tier.color }}
                  >
                    {tier.label}
                  </motion.p>
                </div>
              </div>
              <p className="text-xs font-body text-secondary leading-relaxed mt-1">
                {tier.desc}
              </p>
              <p className="text-[10px] font-heading font-semibold mt-1.5" style={{ color: tier.color }}>
                {tier.percentile}
              </p>
            </div>

            {/* Score number */}
            <div className="text-right flex-shrink-0">
              <motion.p
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="font-mono font-bold leading-none"
                style={{ color: tier.color, fontSize: 48 }}
              >
                <AnimatedNumber target={umaxScore} />
              </motion.p>
              <p className="text-[10px] font-body text-secondary">/ 10</p>
            </div>
          </div>

          {/* PSL progress bar */}
          <div className="mt-3">
            <div className="h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})` }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
            {/* Tier tick marks */}
            <div className="relative h-3 mt-0.5">
              {[2, 3, 4, 5, 6, 6.5, 7.5, 8.5, 9.5].map(mark => (
                <div
                  key={mark}
                  className="absolute top-0 w-px h-2 bg-black/15 dark:bg-white/15"
                  style={{ left: `${(mark / 10) * 100}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tier scale toggle */}
        {showScale && (
          <>
            <button
              onClick={() => setScaleOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 border-t"
              style={{ borderColor: tier.border + '50' }}
            >
              <span className="text-xs font-heading font-semibold" style={{ color: tier.color }}>
                Full Score Scale
              </span>
              {scaleOpen
                ? <ChevronUp size={14} style={{ color: tier.color }} />
                : <ChevronDown size={14} style={{ color: tier.color }} />
              }
            </button>
            <AnimatePresence>
              {scaleOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden px-4 pb-3"
                >
                  <ScaleReference gender={gender} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  )
}
