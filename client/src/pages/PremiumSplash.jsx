import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'

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
        {/* Inline SVG — no img tag, no black background, emblem floats on splash */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="58 18 154 150"
          width="90"
          height="90"
          style={{ background: 'transparent', display: 'block' }}
        >
          {/* Left laurel */}
          <g fill="none" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round">
            <path d="M88,100 Q78,88 82,74"/>
            <path d="M86,105 Q72,97 72,83"/>
            <path d="M87,110 Q70,106 68,92"/>
            <path d="M89,116 Q72,116 72,102"/>
            <path d="M92,121 Q76,124 78,110"/>
            <path d="M96,125 Q82,132 86,118"/>
            <path d="M88,100 Q76,90 78,76"/>
            <path d="M90,95 Q80,81 84,69"/>
            <path d="M93,91 Q86,76 92,65"/>
          </g>
          {/* Right laurel */}
          <g fill="none" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round">
            <path d="M182,100 Q192,88 188,74"/>
            <path d="M184,105 Q198,97 198,83"/>
            <path d="M183,110 Q200,106 202,92"/>
            <path d="M181,116 Q198,116 198,102"/>
            <path d="M178,121 Q194,124 192,110"/>
            <path d="M174,125 Q188,132 184,118"/>
            <path d="M182,100 Q194,90 192,76"/>
            <path d="M180,95 Q190,81 186,69"/>
            <path d="M177,91 Q184,76 178,65"/>
          </g>
          {/* Bottom tie */}
          <path d="M122,140 Q135,148 148,140" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="135" cy="144" r="3.5" fill="#C9A84C"/>
          {/* Shield — transparent fill so splash bg shows through */}
          <polygon points="135,32 165,48 165,142 135,158 105,142 105,48" fill="none" stroke="#C9A84C" strokeWidth="1.5"/>
          {/* Letter A */}
          <text x="135" y="132" textAnchor="middle" fontFamily="Georgia, serif" fontSize="80" fontWeight="900" fill="#C9A84C">A</text>
          {/* Top star */}
          <polygon points="135,28 138,37 147,37 140,43 143,52 135,46 127,52 130,43 123,37 132,37" fill="#C9A84C"/>
        </svg>
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
