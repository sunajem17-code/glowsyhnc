import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { waitingFrame } from '../utils/scanWaiting'

const MESSAGES = [
  'Your scan is just the beginning.',
  'Small steps. Lasting change.',
  'Your next chapter starts with you.',
  'Now it’s time for you to invest in yourself',
]

export default function ScanWaitingText({ ready, onComplete }) {
  const [index, setIndex] = useState(0)
  const started = useRef(performance.now())
  const readyAt = useRef(null)
  const completed = useRef(false)
  const callback = useRef(onComplete)
  callback.current = onComplete
  useEffect(() => {
    if (ready && readyAt.current == null) readyAt.current = performance.now() - started.current
    const tick = () => {
      const frame = waitingFrame(performance.now() - started.current, readyAt.current)
      setIndex(frame.index)
      if (frame.done && !completed.current) {
        completed.current = true
        callback.current()
      }
    }
    tick()
    const timer = setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [ready])
  return (
    <div role="status" aria-live="polite" className="h-full flex items-center justify-center px-8" style={{ background: '#080604' }}>
      <AnimatePresence mode="wait">
        <motion.p key={index}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: .36, ease: 'easeOut' }}
          style={{ fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)', fontSize: 20, fontWeight: 600, lineHeight: 1.35, textAlign: 'center', color: '#F5F0E8', letterSpacing: '-0.01em', maxWidth: 300 }}>
          {MESSAGES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
