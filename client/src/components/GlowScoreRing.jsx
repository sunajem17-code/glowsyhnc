import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// ─── Score color logic ─────────────────────────────────────────────────────────
function getMarkerColor(score) {
  if (score >= 7) return '#C6A85C'                  // gold — above average
  if (score >= 4) return 'rgba(200,196,190,0.75)'   // neutral — mid range
  return '#EF4444'                                   // red — below average
}

function getLabel(score) {
  if (score >= 9)   return 'Elite'
  if (score >= 8)   return 'Excellent'
  if (score >= 7)   return 'Great'
  if (score >= 6)   return 'Good'
  if (score >= 5)   return 'Average'
  if (score >= 4)   return 'Below Avg'
  return 'Rising'
}

// ─── Horizontal scale bar ──────────────────────────────────────────────────────
export default function GlowScoreRing({ score = 0, size = 'large', animated = true }) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)

  useEffect(() => {
    if (!animated) { setDisplayScore(score); return }
    let start = null
    const duration = 1500
    const step = (timestamp) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(ease * score * 10) / 10)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [score, animated])

  const pct = Math.min(Math.max(displayScore / 10, 0), 1) * 100
  const markerColor = getMarkerColor(score)

  // ── Small variant (used in Profile, Progress lists) ────────────────────────
  if (size === 'small') {
    return (
      <div style={{ width: 88 }}>
        {/* Score number */}
        <div className="flex items-baseline gap-0.5 mb-1.5">
          <span
            className="font-mono font-bold"
            style={{ fontSize: 22, color: markerColor, letterSpacing: '-0.03em', lineHeight: 1 }}
          >
            {typeof displayScore === 'number' ? displayScore.toFixed(1) : displayScore}
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>/10</span>
        </div>

        {/* Bar */}
        <div
          className="relative rounded-full"
          style={{
            height: 3,
            background: 'linear-gradient(to right, #EF4444 0%, #EF444460 28%, rgba(200,196,190,0.35) 40%, rgba(200,196,190,0.35) 62%, #C6A85C60 75%, #C6A85C 100%)',
          }}
        >
          {/* Marker */}
          <motion.div
            className="absolute top-1/2 rounded-full"
            style={{
              width: 7,
              height: 7,
              marginTop: -3.5,
              marginLeft: -3.5,
              background: markerColor,
              boxShadow: `0 0 6px ${markerColor}80`,
            }}
            initial={{ left: '0%' }}
            animate={{ left: `${pct}%` }}
            transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </div>
    )
  }

  // ── Large variant (used in Dashboard, Results hero) ────────────────────────
  return (
    <div className="w-full">
      {/* Score number + label row */}
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-baseline gap-1.5">
          <motion.span
            className="font-mono font-bold"
            style={{ fontSize: 52, color: markerColor, letterSpacing: '-0.04em', lineHeight: 1 }}
          >
            {typeof displayScore === 'number' ? displayScore.toFixed(1) : displayScore}
          </motion.span>
          <span className="font-mono text-[16px] mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
            /10
          </span>
        </div>
        <div className="text-right mb-1">
          <p
            className="font-heading font-bold text-[13px]"
            style={{ color: markerColor }}
          >
            {getLabel(score)}
          </p>
          <p
            className="font-body text-[9px] uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            OVERALL RATING
          </p>
        </div>
      </div>

      {/* Scale bar */}
      <div
        className="relative rounded-full"
        style={{
          height: 4,
          background: 'linear-gradient(to right, #EF4444 0%, #EF444450 25%, rgba(200,196,190,0.25) 40%, rgba(200,196,190,0.25) 62%, #C6A85C50 76%, #C6A85C 100%)',
        }}
      >
        {/* Glow pulse behind marker */}
        <motion.div
          className="absolute top-1/2 rounded-full"
          style={{
            width: 16,
            height: 16,
            marginTop: -8,
            marginLeft: -8,
            background: `${markerColor}25`,
            borderRadius: '50%',
          }}
          initial={{ left: '0%' }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
        />
        {/* Marker dot */}
        <motion.div
          className="absolute top-1/2 rounded-full"
          style={{
            width: 10,
            height: 10,
            marginTop: -5,
            marginLeft: -5,
            background: markerColor,
            boxShadow: `0 0 10px ${markerColor}90, 0 0 3px ${markerColor}`,
            border: '1.5px solid rgba(255,255,255,0.15)',
          }}
          initial={{ left: '0%' }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      {/* Scale ticks */}
      <div
        className="flex justify-between mt-1.5"
        style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, fontFamily: 'monospace' }}
      >
        <span>0</span>
        <span style={{ color: '#EF444440' }}>4</span>
        <span style={{ color: 'rgba(200,196,190,0.3)' }}>7</span>
        <span>10</span>
      </div>
    </div>
  )
}
