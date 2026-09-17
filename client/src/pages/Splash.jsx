import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/ascendus-icon.png'
import { triggerHaptic } from '../utils/haptics'

const EASE = [0.16, 1, 0.3, 1]

// ── Cloned from StepCinematic / useTypewriter in PremiumOnboarding ───────────
const CINEMATIC_LINES = [
  { text: 'You know you can improve', gold: false },
  { text: 'But where should you start?', gold: false },
  { text: 'Find your starting point with...', gold: false },
  { text: 'ASCENDUS', gold: true, pop: true, hold: 1500 },
]

function useTypewriter(text, speed = 38, startDelay = 0) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    if (!text) return
    let iv
    const t = setTimeout(() => {
      let i = 0
      iv = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        triggerHaptic()
        if (i >= text.length) clearInterval(iv)
      }, speed)
    }, startDelay)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [text, speed, startDelay])
  return displayed
}

function DelayedTypewriter({ text, delay = 0 }) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setActive(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  const displayed = useTypewriter(active ? text : null, 55)
  return (
    <p className="font-heading font-bold text-center" style={{
      fontSize: 28,
      whiteSpace: 'normal',
      lineHeight: 1.25,
      letterSpacing: '-0.02em',
      color: '#ffffff',
      textShadow: '0 0 20px rgba(198,168,92,0.25)',
      margin: 0,
      width: '100%',
    }}>
      {displayed}
    </p>
  )
}

function SubtitleTypewriter({ text }) {
  const displayed = useTypewriter(text, 55)
  return (
    <div style={{
      marginTop: 16,
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.25,
      color: '#ffffff',
      textShadow: '0 0 20px rgba(198,168,92,0.25)',
      fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
    }}>
      {displayed}
    </div>
  )
}

function CinematicIntro({ onDone }) {
  const [lineIdx, setLineIdx] = useState(0)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Wait for the app to fully load before starting the animation.
  // 800ms minimum lets the JS bundle finish initialising so the
  // interval fires at the correct cadence from character 1.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1450)
    return () => clearTimeout(t)
  }, [])

  // Only pass text to typewriter once ready — keeps displayed='' until then
  const displayed = useTypewriter(ready && !CINEMATIC_LINES[lineIdx]?.pop ? CINEMATIC_LINES[lineIdx]?.text : null, 55, CINEMATIC_LINES[lineIdx]?.startDelay ?? 0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const line = CINEMATIC_LINES[lineIdx]
    const dur = line?.hold ?? (line?.text.length * 55 + 1600)
    const t = setTimeout(() => {
      if (cancelled) return
      if (lineIdx < CINEMATIC_LINES.length - 1) {
        setLineIdx(i => i + 1)
      } else {
        setLeaving(true)
        setTimeout(() => { if (!cancelled) onDone() }, 700)
      }
    }, dur)
    return () => { cancelled = true; clearTimeout(t) }
  }, [lineIdx, ready, onDone])

  const currentLine = CINEMATIC_LINES[lineIdx]
  const isGold = currentLine?.gold
  const isPop = currentLine?.pop
  const goldWord = currentLine?.goldWord

  // Render displayed text with optional goldWord coloured gold
  function renderText() {
    if (goldWord && displayed.startsWith(goldWord)) {
      const rest = displayed.slice(goldWord.length)
      return (
        <>
          <span style={{ color: '#C6A85C', textShadow: '0 0 20px rgba(198,168,92,0.7)' }}>{goldWord}</span>
          {rest}
        </>
      )
    }
    if (goldWord && goldWord.startsWith(displayed)) {
      // Still typing the gold word itself
      return <span style={{ color: '#C6A85C', textShadow: '0 0 20px rgba(198,168,92,0.7)' }}>{displayed}</span>
    }
    return displayed
  }

  function handleTap() {
    if (lineIdx < CINEMATIC_LINES.length - 1) {
      setLineIdx(i => i + 1)
    } else {
      onDone()
    }
  }

  return (
    <motion.div
      onClick={handleTap}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.6, ease: 'easeIn' }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'radial-gradient(ellipse at 50% 40%, #1a1a1a 0%, #000000 70%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 36px', cursor: 'pointer',
      }}
    >
      <AnimatePresence mode="wait">
        {isPop ? (
          /* ── ASCENDUS fades out, then subtitle types in ── */
          <motion.div
            key="ascendus"
            initial={{ opacity: 0, filter: 'blur(14px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(6px)', transition: { duration: 0.55, ease: 'easeIn' } }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {/* ASCENDUS pops in, holds, then fades out */}
            <motion.div
              animate={{ opacity: [1, 1, 0] }}
              transition={{ duration: 2.0, times: [0, 0.45, 1], ease: 'easeIn' }}
              style={{ position: 'relative', display: 'inline-block' }}
            >
              <span className="font-heading font-bold" style={{
                fontSize: 50,
                letterSpacing: '0.04em',
                color: '#C6A85C',
                textShadow: '0 0 30px rgba(198,168,92,0.7), 0 0 60px rgba(198,168,92,0.3)',
                display: 'block',
                background: 'transparent',
              }}>
                ASCENDUS
              </span>
              {/* Glow pulse — fades with ASCENDUS */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 0.10, 0], scale: [0.7, 1.05, 0.95] }}
                transition={{ delay: 0.2, duration: 2.6, ease: 'easeOut', times: [0, 0.25, 1] }}
                style={{
                  position: 'absolute', inset: '-50px -60px',
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(198,168,92,0.8) 0%, rgba(198,168,92,0.25) 45%, transparent 72%)',
                  filter: 'blur(22px)',
                  pointerEvents: 'none',
                }}
              />
            </motion.div>

          </motion.div>
        ) : (
          /* ── Regular typed lines ── */
          <motion.p
            key={lineIdx}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            className="font-heading font-bold text-center"
            style={{
              fontSize: 32,
              whiteSpace: 'normal',
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              textShadow: '0 0 20px rgba(198,168,92,0.25)',
            }}
          >
            {renderText()}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Original logo splash (shown after cinematic for authenticated users) ──────
export default function Splash({ onDone }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const fadeOut = setTimeout(() => setVisible(false), 3500)
    const nav = setTimeout(() => onDone(), 4100)
    return () => {
      clearTimeout(fadeOut)
      clearTimeout(nav)
    }
  }, [onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.6, ease: 'easeIn' } }}
          className="fixed inset-0 flex flex-col items-center justify-center z-50"
          style={{ background: '#000000' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 1.5, duration: 0.8, ease: EASE }}
            style={{
              position: 'absolute',
              width: 320, height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 45%, transparent 70%)',
              filter: 'blur(32px)',
              pointerEvents: 'none',
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 1.2, ease: EASE }}
            style={{ position: 'relative', zIndex: 1, marginBottom: 0, mixBlendMode: 'lighten' }}
          >
            <img src={logo} alt="Ascendus" style={{ width: 140, display: 'block', filter: 'brightness(1.15) contrast(1.1)' }} />
          </motion.div>

          {/* Text group — pulled up close under logo */}
          <div style={{ position: 'relative', zIndex: 1, marginTop: -20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0, duration: 0.6, ease: EASE }}
              style={{
                fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                fontWeight: 800, fontSize: 23,
                letterSpacing: '-0.02em',
                color: '#FFFFFF', marginBottom: 4,
              }}
            >
              Welcome to Ascendus
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5, duration: 0.4, ease: EASE }}
              style={{
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                fontSize: 14,
                color: 'rgba(255,255,255,0.38)',
                letterSpacing: '0.01em',
              }}
            >
              Your journey starts now.
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { CinematicIntro }
