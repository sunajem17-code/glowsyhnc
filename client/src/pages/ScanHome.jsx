import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ChevronRight, Dumbbell, Moon } from 'lucide-react'
import useStore from '../store/useStore'
const isPremiumSelector = s => s.isPremium
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
  if (limitMessage) {
    return (
      <CardShell
        eyebrow="DAILY LIMIT REACHED"
        title="3 Scans Done"
        body={limitMessage}
        cta="Got It"
        icon={Moon}
        onAction={() => triggerHaptic()}
        visualClassName="aspect-[4/5] flex-shrink-0"
        visual={
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
            <Moon size={56} style={{ color: `${GOLD}55` }} />
          </div>
        }
      />
    )
  }

  return (
    <CardShell
      eyebrow="NEW FACE SCAN"
      title="Begin Scan"
      body="Start your scan"
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
      body="Start your scan"
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

function PastResultCard({ scan, onView }) {
  const photo = scan?.facePhotoUrl ?? scan?.photos?.face ?? null
  const dateLabel = scan?.analyzedAt
    ? new Date(scan.analyzedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null

  if (!scan) {
    return (
      <CardShell
        eyebrow="PAST SCANS"
        title="No Scans Yet"
        body="Past scans will appear here once you complete your first scan."
        cta="Start a Scan"
        icon={Camera}
        onAction={() => {}}
        visualClassName="aspect-[4/5] flex-shrink-0"
        visual={
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: '#0a0a0a' }}>
            <Camera size={48} style={{ color: 'rgba(255,255,255,0.1)' }} />
            <p className="font-body text-[13px] text-center px-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Past scans will appear here
            </p>
          </div>
        }
      />
    )
  }

  return (
    <CardShell
      eyebrow="LAST SCAN"
      title="Past Result"
      body={dateLabel ? `Your last scan: ${dateLabel}.` : 'Your most recent scan.'}
      cta="Results"
      icon={ChevronRight}
      onAction={onView}
      visual={
        <>
          {photo ? (
            <img src={photo} alt="Last scan" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera size={48} style={{ color: 'rgba(255,255,255,0.15)' }} />
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 45%)' }}
          />
          {scan.glowScore != null && (
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div>
                <p className="font-body text-[11px] text-white/60 uppercase tracking-wide mb-0.5">Glow Score</p>
                <p className="font-heading font-bold text-[28px] text-white leading-none">{scan.glowScore.toFixed(1)}</p>
              </div>
              {scan.tier && (
                <span
                  className="font-heading font-bold text-[11px] px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(198,168,92,0.2)', color: GOLD, border: `1px solid ${GOLD}55` }}
                >
                  {scan.tier.toUpperCase()}
                </span>
              )}
            </div>
          )}
        </>
      }
    />
  )
}

export default function ScanHome() {
  const navigate = useNavigate()
  const scans = useStore(s => s.scans)
  const currentScan = useStore(s => s.currentScan)
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const isPremium = useStore(isPremiumSelector)
  const streak = useStore(s => s.streak)
  const proScanCount = useStore(s => s.proScanCount)
  const proScanDate = useStore(s => s.proScanDate)
  const setScanLaunching = useStore(setScanLaunchingSelector)
  const [cardIdx, setCardIdx] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => { setScanLaunching(false) }, [])

  function beginScan(path) {
    triggerHaptic()
    setScanLaunching(true)
    navigate(path)
  }

  const latestScan = scans?.[0] ?? null

  const today = new Date().toDateString()
  const atLimit = proScanDate === today && proScanCount >= DAILY_SCAN_LIMIT

  const limitMessage = atLimit
    ? (streak.current > 0
        ? `Come back tomorrow to continue your ${streak.current} day streak!`
        : 'Come back tomorrow to start a streak!')
    : null

  // Cards: Face Scan → Physique Scan
  const cards = [
    { id: 'face',    el: <FaceScanCard onBegin={() => beginScan('/scan/capture')} limitMessage={limitMessage} /> },
    { id: 'physique', el: <PhysiqueScanCard onBegin={() => beginScan('/workout-plan')} /> },
  ]

  function goTo(idx) {
    if (idx === cardIdx) return
    setDirection(idx > cardIdx ? 1 : -1)
    setCardIdx(idx)
  }

  function handleDragEnd(_, info) {
    const DISTANCE = 60
    const VELOCITY = 400
    if ((info.offset.x < -DISTANCE || info.velocity.x < -VELOCITY) && cardIdx < cards.length - 1) {
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

      {/* Dot indicator — fixed size circles, just color change */}
      <div className="flex items-center justify-center gap-2 py-4 flex-shrink-0">
        {cards.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
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
