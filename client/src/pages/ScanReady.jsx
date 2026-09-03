import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'

const MESSAGES = [
  'You didn\'t choose your genetics…',
  'But you chose to show up and check.',
  'Now let's see what you're working with.',
]

// Bar completes in 2600ms (faster overall progress feel).
const BAR_MS = 2600

// Message appearance times in absolute ms from start.
// Intentionally decoupled from the bar so the post-genetics
// messages dwell longer than bar progress alone would suggest.
//   0ms  → msg 0 ("genetics" — quick setup line, 700ms)
//   700ms → msg 1 ("chose to show up" — 1100ms, pacing slows here)
//   1800ms → msg 2 ("now let's see" — stays ~1600ms until navigate)
const MSG_BREAKS = [0, 700, 1800]

export default function ScanReady() {
  const navigate    = useNavigate()
  const isPremium   = useStore(s => s.isPremium)
  const currentScan = useStore(s => s.currentScan)
  const destination = isPremium ? '/results' : '/unlock'

  const [progress, setProgress] = useState(0)
  const [msgIndex, setMsgIndex] = useState(0)
  const [exiting,  setExiting]  = useState(false)
  const startRef = useRef(null)
  const rafRef   = useRef(null)
  const doneRef  = useRef(false)

  // Edge case: no scan in store yet — skip straight through.
  useEffect(() => {
    if (!currentScan) navigate(destination, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentScan) return

    startRef.current = performance.now()

    function tick(now) {
      const elapsed = now - startRef.current

      // ── Bar ──────────────────────────────────────────────────────────
      const raw   = Math.min(elapsed / BAR_MS, 1)
      const eased = 1 - Math.pow(1 - raw, 4) // ease-out-quart
      setProgress(Math.round(eased * 100))

      // ── Messages (own schedule, independent of bar) ───────────────────
      let mi = 0
      for (let i = 0; i < MSG_BREAKS.length; i++) {
        if (elapsed >= MSG_BREAKS[i]) mi = i
      }
      setMsgIndex(mi)

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        if (doneRef.current) return
        doneRef.current = true
        // Hold at 100% briefly, then fade and navigate.
        setTimeout(() => {
          setExiting(true)
          setTimeout(() => navigate(destination, { replace: true }), 480)
        }, 320)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [currentScan]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.46, ease: 'easeInOut' }}
      style={{
        position:       'fixed',
        inset:          0,
        background:     '#080604',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         9999,
        paddingInline:  32,
      }}
    >
      {/* Message */}
      <div style={{ minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 48 }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.36, ease: 'easeOut' }}
            style={{
              fontFamily:    'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
              fontSize:      20,
              fontWeight:    600,
              lineHeight:    1.35,
              textAlign:     'center',
              color:         '#F5F0E8',
              letterSpacing: '-0.01em',
              maxWidth:      300,
            }}
          >
            {MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress track */}
      <div style={{ width: '100%', maxWidth: 280 }}>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <motion.div
            style={{
              height:     '100%',
              borderRadius: 2,
              background: 'linear-gradient(90deg, #A8894A 0%, #C6A85C 60%, #E2C97E 100%)',
              width:      `${progress}%`,
              boxShadow:  '0 0 8px rgba(198,168,92,0.5)',
            }}
            transition={{ duration: 0.05, ease: 'linear' }}
          />
        </div>
        <p style={{
          marginTop:     10,
          textAlign:     'center',
          fontFamily:    'var(--font-mono, "Space Grotesk", monospace)',
          fontSize:      12,
          fontWeight:    600,
          color:         'rgba(198,168,92,0.7)',
          letterSpacing: '0.08em',
        }}>
          {progress}%
        </p>
      </div>
    </motion.div>
  )
}
