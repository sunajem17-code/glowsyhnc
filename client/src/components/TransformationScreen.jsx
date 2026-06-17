import { useRef, useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

const GOLD = '#d4af37'

import BEFORE_IMG from '../assets/transformations/before.jpg'
import AFTER_IMG  from '../assets/transformations/after.jpg'

const STATS = [
  { num: '12K+', label: 'Members' },
  { num: '4.9★', label: 'App Store' },
  { num: '8.2pts', label: 'Avg Glow Gain' },
]

function BeforeAfterSlider({ beforeSrc, afterSrc }) {
  const containerRef = useRef(null)
  const [pct, setPct] = useState(45)
  const dragging = useRef(false)

  const clamp = v => Math.max(0, Math.min(100, v))

  const getPct = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return pct
    return clamp(((clientX - rect.left) / rect.width) * 100)
  }, [pct])

  const onMouseDown = (e) => {
    dragging.current = true
    setPct(getPct(e.clientX))
  }

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return
    setPct(getPct(e.clientX))
  }, [getPct])

  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  const onTouchStart = (e) => {
    dragging.current = true
    setPct(getPct(e.touches[0].clientX))
  }

  const onTouchMove = useCallback((e) => {
    if (!dragging.current) return
    e.preventDefault()
    setPct(getPct(e.touches[0].clientX))
  }, [getPct])

  const onTouchEnd = useCallback(() => { dragging.current = false }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onMouseMove, onMouseUp, onTouchMove, onTouchEnd])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden select-none"
      style={{ borderRadius: 16, aspectRatio: '3/4', cursor: 'col-resize' }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* AFTER (full width, behind) */}
      <img
        src={afterSrc}
        alt="After"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* BEFORE (clipped left portion) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pct}%` }}
      >
        <img
          src={beforeSrc}
          alt="Before"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ width: `${10000 / pct}%`, maxWidth: 'none' }}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute inset-y-0 w-[2px] pointer-events-none"
        style={{ left: `${pct}%`, background: GOLD, transform: 'translateX(-50%)' }}
      />

      {/* Drag handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center"
        style={{
          left: `${pct}%`,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: GOLD,
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 4L2 8l3 4M11 4l3 4-3 4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Labels */}
      <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.65)' }}>
        <span className="font-heading font-bold text-[10px] text-white tracking-widest">BEFORE</span>
      </div>
      <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.65)' }}>
        <span className="font-heading font-bold text-[10px] text-white tracking-widest">AFTER</span>
      </div>
    </div>
  )
}

export default function TransformationScreen({ onNext }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0a0a0a' }}>
      <div className="flex flex-col flex-1 px-6 pt-16 pb-10 gap-5">

        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="font-heading font-bold text-[10px] tracking-[0.18em]"
          style={{ color: GOLD }}
        >
          REAL RESULTS
        </motion.p>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-heading font-bold text-[28px] leading-tight text-white"
        >
          See What's{' '}Possible
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="font-body text-[14px] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          Members who follow their Ascendus plan for 12 weeks see significant improvements in their Glow Score — posture, skin, grooming, and physique.
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-4"
        >
          {STATS.map(({ num, label }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="font-heading font-bold text-[18px] leading-none" style={{ color: GOLD }}>{num}</span>
              <span className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* Before/after slider */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 280, damping: 28 }}
          className="flex-1 min-h-[220px]"
        >
          <BeforeAfterSlider beforeSrc={BEFORE_IMG} afterSrc={AFTER_IMG} />
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          className="w-full py-4 font-heading font-bold text-[15px] tracking-wide"
          style={{
            background: `linear-gradient(135deg, #D4B96A 0%, ${GOLD} 50%, #A8893A 100%)`,
            color: '#000',
            borderRadius: 14,
            boxShadow: '0 4px 20px rgba(212,175,55,0.35)',
            letterSpacing: '0.03em',
          }}
        >
          Start My Transformation
        </motion.button>

      </div>
    </div>
  )
}
