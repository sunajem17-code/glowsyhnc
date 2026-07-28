import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ChevronRight, Dumbbell, Sparkles } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import FaceScanOverlay from '../components/FaceScanOverlay'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

// Same slide/drag gesture pattern as ScanUnlockGate's SwipeableResultCards
// (direction-aware enter/exit, velocity-aware drag commit) — reused here for
// consistency, but with SPRING_STANDARD/EASE_STANDARD instead of that
// component's own hand-tuned spring, per the app's established motion tokens.
const SLIDE_VARIANTS = {
  enter: (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
}

// visualClassName lets a specific card opt out of the default flex-1
// fill (which stretches the box to eat all leftover vertical space in the
// h-full column) in favor of a fixed aspect ratio instead — only
// BeginScanCard's grid/camera visual currently does this; PastResultCard's
// photo and BodyCard's visual still want to fill the available height, so
// they're untouched by leaving this prop at its default. justify-center on
// the outer column is inert for those two (their flex-1 box already
// consumes all the space, leaving nothing to redistribute) but centers
// BeginScanCard's now-shorter box+text+button group in the freed-up space
// instead of leaving it pinned to the top with a dead gap at the bottom.
function CardShell({ eyebrow, title, body, cta, icon: Icon, onAction, visual, visualClassName = 'flex-1', footer }) {
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
      {/* footer lets a card swap out the default pitch-text + big CTA button
          for something else (e.g. BodyCard's compact returning-user row)
          without duplicating the visual/eyebrow/title markup above. */}
      {footer ?? (
        <>
          <p className="font-body text-[14px] text-secondary mb-6 leading-relaxed">
            {body}
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); onAction() }}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
          >
            <Icon size={17} /> {cta}
          </motion.button>
        </>
      )}
    </div>
  )
}

function BeginScanCard({ onBegin }) {
  return (
    <CardShell
      eyebrow="NEW SCAN"
      title="Begin Scan"
      body="Get your AI-powered Glow Score, tier, and personalized action plan in under 60 seconds."
      cta="Start Your Scan"
      icon={Sparkles}
      onAction={onBegin}
      visualClassName="aspect-[4/5] flex-shrink-0"
      visual={
        <>
          {/* Icon renders first so FaceScanOverlay (rendered after, below)
              paints on top of it, matching Scan.jsx's own stacking — there,
              FaceScanOverlay is always the last-rendered element in its
              branch, with nothing painted after/above it. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera size={48} style={{ color: `${GOLD}66` }} />
          </div>
          <FaceScanOverlay loop showDots={false} />
        </>
      }
    />
  )
}

function PastResultCard({ scan, onView }) {
  const photo = scan.facePhotoUrl ?? scan.photos?.face ?? null
  const dateLabel = scan.analyzedAt
    ? new Date(scan.analyzedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : null

  return (
    <CardShell
      eyebrow="LAST SCAN"
      title="Past Result"
      body={dateLabel ? `Your last scan — ${dateLabel}.` : 'Your most recent scan.'}
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

function BodyCard({ onBody, physiqueScore, trainingSplit, bodyPhotoUrl }) {
  // Once a physique score exists, a plan has been generated at least once —
  // swap the generic first-time pitch for a compact "you already have a
  // plan" row instead of repeating the same sales copy forever.
  const hasPlan = physiqueScore?.overall != null
  const planLabel = trainingSplit ?? 'Custom Plan'

  return (
    <CardShell
      eyebrow="PHYSIQUE"
      title="Body"
      body="Track your physique score and get a training plan built around your weak points."
      cta="View Training Plan"
      icon={Dumbbell}
      onAction={onBody}
      visual={
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0a0f22' }}>
          <Dumbbell size={56} style={{ color: `${GOLD}66` }} />
        </div>
      }
      footer={hasPlan ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { triggerHaptic(); onBody() }}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="w-[52px] h-[52px] rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#0a0f22' }}>
            {bodyPhotoUrl ? (
              <img src={bodyPhotoUrl} alt="Your body" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Dumbbell size={22} style={{ color: `${GOLD}88` }} />
              </div>
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="font-heading font-bold text-[15px] text-primary truncate">
              Physique · {physiqueScore.overall.toFixed(1)}
            </p>
            <p className="font-body text-[12px] text-secondary mt-0.5 truncate">
              Plan active · {planLabel}
            </p>
          </div>
          <ChevronRight size={18} className="text-secondary flex-shrink-0" />
        </motion.button>
      ) : undefined}
    />
  )
}

export default function ScanHome() {
  const navigate = useNavigate()
  const scans = useStore(s => s.scans)
  const currentScan = useStore(s => s.currentScan)
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const [cardIdx, setCardIdx] = useState(0)
  const [direction, setDirection] = useState(1)

  const latestScan = scans?.[0] ?? null

  // "Past Result" only appears once a scan actually exists — a first-time
  // user never sees a card built from placeholder/fake data.
  const cards = [
    { id: 'begin', el: <BeginScanCard onBegin={() => navigate('/scan/capture')} /> },
    ...(latestScan ? [{
      id: 'past',
      el: <PastResultCard scan={latestScan} onView={() => { setCurrentScan(latestScan); navigate('/results') }} />,
    }] : []),
    {
      id: 'body',
      el: (
        <BodyCard
          onBody={() => navigate('/workout-plan')}
          physiqueScore={currentScan?.physiqueScore ?? null}
          trainingSplit={currentScan?.trainingSplit ?? null}
          bodyPhotoUrl={currentScan?.bodyPhotoUrl ?? null}
        />
      ),
    },
  ]

  function goTo(idx) {
    if (idx === cardIdx) return
    setDirection(idx > cardIdx ? 1 : -1)
    setCardIdx(idx)
  }

  // Velocity-aware, not just distance-aware — matches SwipeableResultCards'
  // own drag-commit thresholds.
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

      {/* Page-dot indicator — same animated width/opacity pattern used for the
          intro-slides carousel elsewhere in the app. */}
      <div className="flex items-center justify-center gap-2 py-4 flex-shrink-0">
        {cards.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === cardIdx ? 20 : 6, opacity: i === cardIdx ? 1 : 0.35 }}
            transition={{ duration: 0.3, ease: EASE_STANDARD }}
            style={{ height: 6, borderRadius: 99, background: GOLD }}
          />
        ))}
      </div>
    </MotionPage>
  )
}
