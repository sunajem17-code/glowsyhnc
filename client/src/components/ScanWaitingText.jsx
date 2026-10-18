import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  SCAN_WAITING_MESSAGES,
  SCAN_WAITING_READY_GATE_MS,
  SCAN_WAITING_TOTAL_MS,
  waitingFrame,
  waitingTextOpacity,
} from '../utils/scanWaiting'

const GOLD = '#C6A85C'
const GOLD_LIGHT = '#F2D889'
const CONFETTI = [
  { left: '12%', x: -92, y: -74, rotate: -220, color: '#C6A85C' },
  { left: '21%', x: -65, y: -122, rotate: 180, color: '#F2D889' },
  { left: '31%', x: -34, y: -94, rotate: 260, color: '#E2BD63' },
  { left: '40%', x: -16, y: -142, rotate: 210, color: '#FFF0B7' },
  { left: '48%', x: 0, y: -108, rotate: 260, color: '#C6A85C' },
  { left: '57%', x: 24, y: -136, rotate: 190, color: '#F2D889' },
  { left: '66%', x: 43, y: -95, rotate: 280, color: '#E2BD63' },
  { left: '76%', x: 69, y: -126, rotate: 220, color: '#FFF0B7' },
  { left: '87%', x: 94, y: -72, rotate: 170, color: '#C6A85C' },
  { left: '27%', x: -59, y: -46, rotate: 245, color: '#FFF0B7' },
  { left: '72%', x: 60, y: -51, rotate: 195, color: '#F2D889' },
]

function ConfettiBurst({ reducedMotion }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute top-1/2 h-2 w-1 rounded-sm"
          style={{ left: particle.left, background: particle.color, boxShadow: `0 0 8px ${particle.color}88` }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
          animate={{ x: particle.x, y: particle.y, rotate: particle.rotate, opacity: [0, 1, 0] }}
          transition={{ duration: reducedMotion ? 0.35 : 0.95, delay: index * 0.025, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

export default function ScanWaitingText({ ready, onComplete }) {
  const reducedMotion = useReducedMotion()
  const [elapsed, setElapsed] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const elapsedRef = useRef(0)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Use one clock for both typing and the progress bar so they cannot drift.
  // Pause at the last pre-results prompt until the real scan result is ready.
  useEffect(() => {
    if (completedRef.current) return undefined
    const cap = ready ? SCAN_WAITING_TOTAL_MS : SCAN_WAITING_READY_GATE_MS
    const start = performance.now() - elapsedRef.current
    let timer

    const tick = () => {
      const next = Math.min(performance.now() - start, cap)
      elapsedRef.current = next
      setElapsed(next)
      if (next < cap) timer = setTimeout(tick, 40)
    }

    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [ready])

  const frame = waitingFrame(elapsed, ready)

  useEffect(() => {
    if (!frame.done || completedRef.current) return undefined
    completedRef.current = true
    setShowConfetti(true)
    const timer = setTimeout(() => onCompleteRef.current?.(), 2200)
    return () => clearTimeout(timer)
  }, [frame.done])

  const line = SCAN_WAITING_MESSAGES[frame.index]
  const displayed = line.slice(0, frame.characters)
  const isFinalLine = frame.index === SCAN_WAITING_MESSAGES.length - 1

  return (
    <div
      role="status"
      aria-label={line}
      className="relative flex h-full items-center justify-center overflow-hidden px-8 text-white"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #1a1a1a 0%, #000000 70%)' }}
    >
      {showConfetti && <ConfettiBurst reducedMotion={reducedMotion} />}
      <div className="relative w-full max-w-[360px]">
        <div className="font-heading font-bold text-center" style={{ display: 'grid', width: '100%', placeItems: 'center', fontSize: 32, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            <span aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden', width: '100%' }}>{line}</span>
            <p
              className="col-start-1 row-start-1 m-0 w-full text-center font-heading font-bold"
              style={{ opacity: reducedMotion ? 1 : waitingTextOpacity(elapsed, ready), fontSize: 32, lineHeight: 1.25, letterSpacing: '-0.02em', ...(isFinalLine
                ? { color: GOLD_LIGHT, textShadow: '0 0 8px rgba(242,216,137,.8), 0 0 24px rgba(198,168,92,.5)' }
                : { color: '#fff', textShadow: '0 0 20px rgba(198,168,92,0.25)' }) }}
            >
              {displayed}
            </p>
        </div>

        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 28, width: '100%', maxWidth: 300 }}>
          <div
            role="progressbar"
            aria-label="Preparing your results"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={frame.progress}
            className="overflow-hidden rounded-full"
            style={{ height: 12, background: '#3A3A3A' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${frame.progress}%`,
                background: GOLD,
                transition: 'width 100ms linear',
              }}
            />
          </div>
          <p className="mt-3 text-center font-heading font-bold text-white" style={{ fontSize: 28, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {frame.progress}%
          </p>
        </div>
      </div>
    </div>
  )
}
