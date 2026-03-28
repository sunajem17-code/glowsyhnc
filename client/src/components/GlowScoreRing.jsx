import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// Gold as the signature score color — with score-based intensity
const GOLD = '#C6A85C'
const GOLD_LIGHT = '#D4B96A'
const GOLD_DARK = '#A8893A'

function getLabel(score) {
  if (score >= 90) return 'Elite'
  if (score >= 80) return 'Excellent'
  if (score >= 70) return 'Great'
  if (score >= 60) return 'Good'
  if (score >= 50) return 'Average'
  if (score >= 40) return 'Below Avg'
  return 'Rising'
}

export default function GlowScoreRing({ score = 0, size = 'large', animated = true }) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const isLarge = size === 'large'
  const dim = isLarge ? 144 : 92
  const r = isLarge ? 56 : 36
  const strokeWidth = isLarge ? 8 : 6
  const circ = 2 * Math.PI * r
  const offset = circ - (displayScore / 100) * circ

  useEffect(() => {
    if (!animated) { setDisplayScore(score); return }
    let start = null
    const duration = 1600
    const step = (timestamp) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(ease * score))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [score, animated])

  return (
    <div className="relative flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg
        width={dim} height={dim}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={dim / 2} cy={dim / 2} r={r}
          fill="none"
          stroke={GOLD}
          strokeWidth={strokeWidth}
          opacity={0.10}
        />
        {/* Outer glow layer */}
        <motion.circle
          cx={dim / 2} cy={dim / 2} r={r}
          fill="none"
          stroke={GOLD_LIGHT}
          strokeWidth={strokeWidth + 5}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          opacity={0.08}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
        />
        {/* Main gold ring */}
        <motion.circle
          cx={dim / 2} cy={dim / 2} r={r}
          fill="none"
          stroke={`url(#goldGrad-${dim})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`goldGrad-${dim}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={GOLD_DARK} />
            <stop offset="50%" stopColor={GOLD} />
            <stop offset="100%" stopColor={GOLD_LIGHT} />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex flex-col items-center justify-center z-10">
        <span
          className="font-mono font-bold leading-none"
          style={{
            fontSize: isLarge ? 38 : 22,
            color: GOLD,
            letterSpacing: '-0.03em',
          }}
        >
          {displayScore}
        </span>
        {isLarge && (
          <>
            <span
              className="font-body mt-0.5 uppercase tracking-widest"
              style={{ fontSize: 9, color: 'var(--text-secondary)' }}
            >
              GLOW SCORE
            </span>
            <span
              className="font-heading font-semibold mt-0.5"
              style={{ fontSize: 11, color: GOLD }}
            >
              {getLabel(score)}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
