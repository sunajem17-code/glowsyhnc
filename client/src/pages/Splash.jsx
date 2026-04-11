import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../assets/ascendus-icon.png'

const EASE = [0.16, 1, 0.3, 1]

export default function Splash({ onDone }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Start fade-out at 3.5s, navigate at 4.1s
    const fadeOut = setTimeout(() => setVisible(false), 3500)
    const nav     = setTimeout(onDone, 4100)
    return () => { clearTimeout(fadeOut); clearTimeout(nav) }
  }, [onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeIn' } }}
          className="fixed inset-0 flex flex-col items-center justify-center z-50"
          style={{ background: '#000000' }}
        >
          {/* Gold glow — pulses in at 1.5s */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 1.5, duration: 0.8, ease: EASE }}
            style={{
              position: 'absolute',
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(198,168,92,0.45) 0%, rgba(198,168,92,0.12) 45%, transparent 70%)',
              filter: 'blur(32px)',
              pointerEvents: 'none',
            }}
          />

          {/* Logo — fades in + scales from 0.92 starting at 0.3s */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 1.2, ease: EASE }}
            style={{ position: 'relative', zIndex: 1, marginBottom: 28, mixBlendMode: 'lighten' }}
          >
            <img
              src={logo}
              alt="Ascendus"
              style={{ width: 140, display: 'block' }}
            />
          </motion.div>

          {/* "Welcome to Ascendus" — slides up at 2.0s */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0, duration: 0.6, ease: EASE }}
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '-0.02em',
              color: '#F0EDE8',
              marginBottom: 10,
            }}
          >
            Welcome to Ascendus
          </motion.h1>

          {/* Tagline — fades in at 2.5s */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 0.4, ease: EASE }}
            style={{
              position: 'relative',
              zIndex: 1,
              fontFamily: 'var(--font-body, "Inter", sans-serif)',
              fontSize: 14,
              color: 'rgba(255,255,255,0.38)',
              letterSpacing: '0.01em',
            }}
          >
            Your journey starts here
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
