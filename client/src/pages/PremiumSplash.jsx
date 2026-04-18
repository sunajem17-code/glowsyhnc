import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import icon from '../assets/ascendus-icon.png'

const GOLD = '#C6A85C'
const GOLD_DIM = 'rgba(198,168,92,0.55)'

// Deterministic particle positions so they're stable per render
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: ((i * 47 + 13) % 100),
  delay: (i * 0.19) % 3.2,
  duration: 3.8 + (i % 5) * 0.7,
  size: i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1.5,
  opacity: 0.18 + (i % 4) * 0.08,
}))

export default function PremiumSplash({ onDone }) {
  const user = useStore(s => s.user)
  const firstName = user?.name?.split(' ')[0] || 'there'
  const doneRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, 2600)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#000000', zIndex: 9999 }}
    >
      {/* Floating gold particles */}
      {PARTICLES.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            bottom: '-10px',
            background: GOLD,
            opacity: 0,
          }}
          animate={{
            y: [0, -window.innerHeight - 40],
            opacity: [0, p.opacity, p.opacity, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* Ambient gold glow behind logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute"
        style={{
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(198,168,92,0.18) 0%, transparent 70%)',
          filter: 'blur(32px)',
        }}
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.75, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        style={{
          filter: `drop-shadow(0 0 28px rgba(198,168,92,0.5)) drop-shadow(0 0 8px rgba(198,168,92,0.3))`,
          marginBottom: 32,
        }}
      >
        <img src={icon} alt="Ascendus" style={{ width: 90, height: 90, objectFit: 'contain', mixBlendMode: 'lighten', background: 'transparent' }} />
      </motion.div>

      {/* Welcome back, [name] */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 26,
          fontWeight: 700,
          color: '#F0EDE8',
          letterSpacing: '-0.02em',
          marginBottom: 14,
          textAlign: 'center',
        }}
      >
        Welcome back, {firstName}.
      </motion.p>

      {/* PRO MEMBER badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.65 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'rgba(198,168,92,0.1)',
          border: `1px solid rgba(198,168,92,0.35)`,
          borderRadius: 100,
          padding: '6px 18px',
          marginBottom: 36,
        }}
      >
        <span style={{ fontSize: 15 }}>👑</span>
        <span style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 12,
          fontWeight: 700,
          color: GOLD,
          letterSpacing: '0.14em',
        }}>
          PRO MEMBER
        </span>
      </motion.div>

      {/* Divider line */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.85 }}
        style={{
          width: 48,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${GOLD_DIM}, transparent)`,
          marginBottom: 20,
        }}
      />

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 0.7, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 1.0 }}
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 15,
          fontStyle: 'italic',
          color: GOLD,
          letterSpacing: '0.01em',
        }}
      >
        Looksmax. Ascend. Dominate.
      </motion.p>
    </motion.div>
  )
}
