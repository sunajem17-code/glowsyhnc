import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Dumbbell, Moon } from 'lucide-react'
import useStore from '../store/useStore'
const setScanLaunchingSelector = s => s.setScanLaunching
import MotionPage from '../components/MotionPage'
import FaceScanOverlay from '../components/FaceScanOverlay'
import { GOLD, GOLD_GRADIENT, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const DAILY_SCAN_LIMIT = 3

const SLIDE_VARIANTS = {
  enter: (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
}

function CardShell({ eyebrow, title, body, cta, icon: Icon = null, onAction, visual, visualClassName = 'flex-1', footer }) {
  return (
    <div
      className="flex flex-col justify-center h-full px-6 pb-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
    >
      <div className={`relative rounded-2xl overflow-hidden mb-5 ${visualClassName}`} style={{ background: '#000' }}>
        {visual}
      </div>
      <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1.5" style={{ color: GOLD }}>
        {eyebrow}
      </p>
      <h2 className="font-heading font-bold text-[24px] text-primary mb-2" style={{ letterSpacing: '-0.02em' }}>
        {title}
      </h2>
      {footer ?? (
        <>
          {body && (
            <p className="font-body text-[14px] text-secondary mb-6 leading-relaxed">
              {body}
            </p>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); onAction() }}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
          >
            {Icon && <Icon size={17} />}{cta}
          </motion.button>
        </>
      )}
    </div>
  )
}

function FaceScanCard({ onBegin, limitMessage }) {
  const navigate = useNavigate()
  if (limitMessage) {
    return (
      <CardShell
        eyebrow="DAILY LIMIT REACHED"
        title="3 Scans Done"
        body={limitMessage}
        cta="View History"
        onAction={() => navigate('/history')}
        visualClassName="aspect-[4/5] flex-shrink-0"
        visual={
          <>
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
              <Moon size={56} style={{ color: `${GOLD}55` }} />
            </div>
            <FaceScanOverlay loop showDots={false} />
          </>
        }
      />
    )
  }

  return (
    <CardShell
      eyebrow="NEW FACE SCAN"
      title="Begin Scan"
      body="Get your personalized analysis"
      cta="Start Your Scan"
      onAction={onBegin}
      visualClassName="aspect-[4/5] flex-shrink-0"
      visual={
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera size={48} style={{ color: `${GOLD}66` }} />
          </div>
          <FaceScanOverlay loop showDots={false} />
        </>
      }
    />
  )
}

function PhysiqueScanCard({ onBegin }) {
  return (
    <CardShell
      eyebrow="NEW PHYSIQUE SCAN"
      title="Begin Scan"
      body="Get your personalized analysis"
      cta="Start Your Scan"
      onAction={onBegin}
      visualClassName="aspect-[4/5] flex-shrink-0"
      visual={
        <>
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#000' }}>
            <Dumbbell size={48} style={{ color: `${GOLD}66` }} />
          </div>
          <FaceScanOverlay loop showDots={false} />
        </>
      }
    />
  )
}

export default function ScanHome() {
  const navigate = useNavigate()
  const scans = useStore(s => s.scans)
  const streak = useStore(s => s.streak)
  const proScanCount = useStore(s => s.proScanCount)
  const proScanFirstAt = useStore(s => s.proScanFirstAt)
  const setScanLaunching = useStore(setScanLaunchingSelector)
  const [cardIdx, setCardIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [showHint, setShowHint] = useState(() => {
    try { return !sessionStorage.getItem('asc_scan_hint_shown') } catch { return false }
  })

  function dismissHint() {
    try { sessionStorage.setItem('asc_scan_hint_shown', '1') } catch {}
    setShowHint(false)
  }

  // Hide permanently once the user has completed their first scan
  useEffect(() => {
    if (scans?.length > 0) dismissHint()
  }, [scans?.length])

  useEffect(() => { setScanLaunching(false) }, [])

  function beginScan(path) {
    triggerHaptic()
    setScanLaunching(true)
    navigate(path)
  }

  const windowStart = proScanFirstAt ? new Date(proScanFirstAt).getTime() : null
  const inWindow = windowStart && (Date.now() - windowStart) < 24 * 60 * 60 * 1000
  const atLimit = inWindow && proScanCount >= DAILY_SCAN_LIMIT

  const limitMessage = atLimit
    ? (streak.current > 0
        ? `Come back tomorrow to continue your ${streak.current} day streak!`
        : 'Come back tomorrow to start a streak!')
    : null

  const hasScans = scans?.length > 0

  // Keep scan selection focused on the face and physique scan flows.
  const cards = [
    { id: 'face',    el: <FaceScanCard onBegin={() => beginScan('/scan/capture')} limitMessage={limitMessage} /> },
    { id: 'physique', el: <PhysiqueScanCard onBegin={() => beginScan('/physique-scan')} /> },
  ]

  function goTo(idx) {
    if (idx === cardIdx) return
    setDirection(idx > cardIdx ? 1 : -1)
    setCardIdx(idx)
  }

  function handleDragEnd(_, info) {
    const DISTANCE = 60
    const VELOCITY = 400
    const maxIdx = hasScans ? cards.length - 1 : 0
    if ((info.offset.x < -DISTANCE || info.velocity.x < -VELOCITY) && cardIdx < maxIdx) {
      goTo(cardIdx + 1)
    } else if ((info.offset.x > DISTANCE || info.velocity.x > VELOCITY) && cardIdx > 0) {
      goTo(cardIdx - 1)
    }
  }

  return (
    <MotionPage baseClassName="" className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={cardIdx}
            custom={direction}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SPRING_STANDARD}
            className="absolute inset-0"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
          >
            {cards[cardIdx].el}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* First-time hint overlay */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={dismissHint}
            style={{
              position: 'absolute', inset: 0, zIndex: 40,
              pointerEvents: 'none',
            }}
          >
            {/* Tooltip + arrow — far right, bounce together */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: [0, 7, 0] }}
              transition={{
                opacity: { delay: 0.2, duration: 0.3 },
                y: { delay: 0.5, duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
              }}
              style={{
                position: 'absolute',
                bottom: 140,
                right: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              {/* Box */}
              <div style={{
                border: '1.5px solid #C6A85C',
                borderRadius: 9,
                paddingTop: 6, paddingBottom: 6,
                paddingLeft: 10, paddingRight: 10,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                  fontWeight: 700, fontSize: 11,
                  color: '#C6A85C', whiteSpace: 'nowrap',
                }}>
                  Find your starting point
                </span>
              </div>

              {/* Arrow — chunky outlined shape */}
              <svg width="22" height="30" viewBox="0 0 22 30" fill="none">
                <path
                  d="M7 2 L15 2 L15 20 L20 20 L11 30 L2 20 L7 20 Z"
                  fill="none"
                  stroke="#C6A85C"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dot indicator — fixed size circles, just color change */}
      <div className="flex items-center justify-center gap-2 py-4 flex-shrink-0">
        {cards.map((_, i) => (
          <div
            key={i}
            onClick={() => (hasScans || i === 0) && goTo(i)}
            style={{
              width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
              background: i === cardIdx ? GOLD : 'rgba(255,255,255,0.25)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
    </MotionPage>
  )
}
