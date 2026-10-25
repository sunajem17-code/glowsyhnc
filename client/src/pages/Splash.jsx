import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/ascendus-icon.png'
import useTypewriter from '../utils/useTypewriter'
import { getSplashCopy } from '../utils/splashFlow'

const SPLASH_COPY = getSplashCopy()
const EASE = [0.16, 1, 0.3, 1]

// ── Cloned from StepCinematic / useTypewriter in PremiumOnboarding ───────────
const CINEMATIC_LINES = SPLASH_COPY.cinematicLines

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
  const displayed = useTypewriter(ready ? CINEMATIC_LINES[lineIdx] : null, 55)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const line = CINEMATIC_LINES[lineIdx]
    const dur = line.length * 55 + 1600
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
          {displayed}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  )
}

export default function Splash({ onDone }) {
  const [visible, setVisible] = useState(true)
  const subtitle = useTypewriter(visible ? SPLASH_COPY.welcomeSubtitle : null, 55, SPLASH_COPY.welcomeSubtitleDelay)

  useEffect(() => {
    const fadeOut = setTimeout(() => setVisible(false), 4500)
    const navigate = setTimeout(onDone, 5100)
    return () => {
      clearTimeout(fadeOut)
      clearTimeout(navigate)
    }
  }, [onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="welcome-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.6, ease: 'easeIn' } }}
          className="fixed inset-0 flex flex-col items-center justify-center z-50"
          style={{ background: '#000000' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.5, duration: 0.8, ease: EASE }}
            style={{
              position: 'absolute',
              width: 340,
              height: 340,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(198,168,92,0.52) 0%, rgba(198,168,92,0.18) 45%, rgba(198,168,92,0.04) 65%, transparent 74%)',
              filter: 'blur(34px)',
              pointerEvents: 'none',
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 1.2, ease: EASE }}
            style={{ position: 'relative', zIndex: 1, mixBlendMode: 'lighten' }}
          >
            <img src={logo} alt="Ascendus" style={{ width: 154, display: 'block', filter: 'brightness(1.15) contrast(1.1)' }} />
          </motion.div>
          <div style={{ position: 'relative', zIndex: 1, marginTop: -24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6, ease: EASE }}
              className="splash-wordmark-gold"
              style={{
                fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                fontWeight: 800,
                fontSize: 25.3,
                letterSpacing: '0.26em',
                marginBottom: 4,
              }}
            >
              {SPLASH_COPY.welcomeTitle}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.35, ease: EASE }}
              style={{
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                fontSize: 15.4,
                color: '#FFFFFF',
                letterSpacing: '0.01em',
              }}
            >
              {subtitle}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { CinematicIntro }
