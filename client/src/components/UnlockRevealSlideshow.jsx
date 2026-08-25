import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import { CardShell, EXTENDED_CATEGORIES, CategoryCard } from './CategoryCard'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import useStore from '../store/useStore'

const G    = GOLD
const GRAD = GOLD_GRADIENT
const TEXT = 'var(--text-primary)'
const DIM  = 'var(--text-secondary)'

// ── Particle burst — gold dots radiate from center on reveal ─────────────────

function ParticleBurst({ trigger }) {
  const PARTICLES = 16
  const angles = Array.from({ length: PARTICLES }, (_, i) => (i / PARTICLES) * 360)

  return (
    <AnimatePresence>
      {trigger && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 60 }}>
          {angles.map((angle, i) => {
            const rad = (angle * Math.PI) / 180
            const dist = 80 + Math.random() * 60
            const tx = Math.cos(rad) * dist
            const ty = Math.sin(rad) * dist
            const size = 4 + Math.random() * 5
            return (
              <motion.div
                key={i}
                initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                animate={{ opacity: 0, x: tx, y: ty, scale: 0.2 }}
                transition={{ duration: 0.65 + Math.random() * 0.3, ease: [0.2, 0, 0.8, 1] }}
                style={{
                  position: 'absolute',
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  background: i % 3 === 0 ? G : i % 3 === 1 ? '#C6A85C' : '#fff',
                  boxShadow: `0 0 ${size * 2}px ${G}88`,
                }}
              />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}

// ── Reveal overlay — blur shimmer that plays then vanishes ───────────────────

function RevealOverlay({ playing, onDone }) {
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(onDone, 700)
    return () => clearTimeout(t)
  }, [playing])

  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          key="overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.65, delay: 0.2, ease: 'easeOut' }}
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: 50, backdropFilter: 'blur(16px)', background: 'rgba(0,0,0,0.55)' }}
        >
          {/* Pulsing ring */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.4, 1.0], opacity: [0, 1, 0] }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            style={{
              width: 80, height: 80, borderRadius: 40,
              border: `2px solid ${G}`,
              boxShadow: `0 0 32px ${G}66`,
            }}
          />
          {/* Lock breaking icon */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 0.9], opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute font-heading font-bold text-[28px]"
            style={{ color: G }}
          >
            ✦
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Progress slide ────────────────────────────────────────────────────────────

function ProgressSlide({ scan }) {
  const scans = useStore(s => s.scans)
  const pts = [...scans]
    .reverse()
    .filter(s => s.glowScore != null)
    .map((s, i) => ({
      idx: i,
      score: s.glowScore,
      label: s.scanDate
        ? new Date(s.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `#${i + 1}`,
    }))

  const CHART_H = 110
  const PT_W    = 72
  const CHART_W = Math.max(280, pts.length * PT_W)
  const PAD_V   = 14
  const MIN_S = 0, MAX_S = 10
  const toY = (score) => PAD_V + ((MAX_S - score) / (MAX_S - MIN_S)) * (CHART_H - PAD_V * 2)
  const toX = (i) => pts.length === 1 ? CHART_W / 2 : (i / (pts.length - 1)) * (CHART_W - 24) + 12

  const linePath = pts.length > 1
    ? 'M ' + pts.map(p => `${toX(p.idx).toFixed(1)},${toY(p.score).toFixed(1)}`).join(' L ')
    : ''
  const areaPath = pts.length > 1
    ? `M ${toX(0).toFixed(1)},${CHART_H} ` +
      pts.map(p => `L ${toX(p.idx).toFixed(1)},${toY(p.score).toFixed(1)}`).join(' ') +
      ` L ${toX(pts.length - 1).toFixed(1)},${CHART_H} Z`
    : ''

  return (
    <CardShell badge="PROGRESS" icon={Activity} facePhotoUrl={scan?.facePhotoUrl ?? null}>
      {pts.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Activity size={28} style={{ color: 'rgba(198,168,92,0.3)' }} />
          <p className="font-body text-[13px] text-center" style={{ color: DIM }}>
            Scan again to start tracking your progress
          </p>
          <p className="font-body text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {pts.length === 0 ? 'No scans yet' : 'You need at least 2 scans to see a trend'}
          </p>
        </div>
      ) : (
        <>
          <p className="font-body text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Glow Score across {pts.length} scan{pts.length !== 1 ? 's' : ''}
          </p>
          <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid rgba(198,168,92,0.12)', background: 'rgba(198,168,92,0.03)' }}>
            <svg width={CHART_W} height={CHART_H + 24} style={{ display: 'block', minWidth: CHART_W }}>
              <defs>
                <linearGradient id="slidProgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={G} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={G} stopOpacity="0.03" />
                </linearGradient>
              </defs>
              {[2.5, 5, 7.5].map(v => (
                <line key={v} x1={0} y1={toY(v).toFixed(1)} x2={CHART_W} y2={toY(v).toFixed(1)}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              ))}
              {areaPath && <path d={areaPath} fill="url(#slidProgFill)" />}
              {linePath && <path d={linePath} fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
              {pts.map(p => (
                <g key={p.idx}>
                  <circle cx={toX(p.idx)} cy={toY(p.score)} r="4" fill={G} />
                  <text x={toX(p.idx)} y={CHART_H + 16} fill="rgba(255,255,255,0.38)" fontSize="8" textAnchor="middle" fontFamily="Inter, sans-serif">{p.label}</text>
                  <text x={toX(p.idx)} y={Math.max(toY(p.score) - 8, PAD_V + 2)} fill={G} fontSize="8.5" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700">{p.score.toFixed(1)}</text>
                </g>
              ))}
            </svg>
          </div>
        </>
      )}
    </CardShell>
  )
}

// ── Animated score number ─────────────────────────────────────────────────────

function AnimatedScore({ target, revealed }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!revealed) return
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 1200, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(ease * target * 10) / 10)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [revealed, target])

  return <span>{display.toFixed(1)}</span>
}

// ── Slide definitions ─────────────────────────────────────────────────────────

function buildSlides(scan) {
  const photo = scan?.facePhotoUrl ?? null
  return [
    {
      id: 'overall',
      label: 'Overall',
      render: ({ revealed }) => (
        <div
          className="h-full flex flex-col overflow-y-auto"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 88px)' }}
        >
          <div className="flex flex-col px-6 pb-2">
            <div className="flex items-center gap-2.5 mb-6">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={revealed ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_STANDARD }}
                className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.22)' }}
              >
                {photo
                  ? <img src={photo} alt="" className="w-full h-full object-cover" />
                  : <span style={{ color: G, fontSize: 13, fontWeight: 700 }}>✦</span>
                }
              </motion.div>
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={revealed ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="font-heading font-bold text-[10px] tracking-[0.22em]"
                style={{ color: 'rgba(198,168,92,0.75)' }}
              >
                OVERALL
              </motion.span>
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={revealed ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="font-body font-bold text-[11px] tracking-[0.18em] mb-2"
              style={{ color: 'rgba(198,168,92,0.65)' }}
            >
              GLOW SCORE
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={revealed ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 12, filter: 'blur(8px)' }}
              transition={{ duration: 0.5, delay: 0.15, ease: EASE_STANDARD }}
              className="flex items-end gap-1.5 mb-3"
            >
              <span className="font-heading font-bold leading-none" style={{ fontSize: 72, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1 }}>
                <AnimatedScore target={scan?.glowScore ?? 0} revealed={revealed} />
              </span>
              <span className="font-heading font-bold text-[22px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>/10</span>
            </motion.div>
            {scan?.tier && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={revealed ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.35, delay: 0.25, type: 'spring', stiffness: 260, damping: 20 }}
                className="inline-flex items-center px-3 py-1.5 rounded-xl self-start mb-4"
                style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.30)' }}
              >
                <span className="font-heading font-bold text-[11px] tracking-[0.14em]" style={{ color: G }}>
                  {scan.tier.toUpperCase()}
                </span>
              </motion.div>
            )}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="font-body text-[13px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Your full breakdown is unlocked. Swipe through each category to explore every metric.
            </motion.p>
          </div>
        </div>
      ),
    },
    ...EXTENDED_CATEGORIES.map(cat => ({
      id: cat.key,
      label: cat.badge,
      render: ({ revealed }) => (
        <motion.div
          className="h-full"
          initial={{ filter: 'blur(12px)', opacity: 0.4 }}
          animate={revealed ? { filter: 'blur(0px)', opacity: 1 } : { filter: 'blur(12px)', opacity: 0.4 }}
          transition={{ duration: 0.55, ease: EASE_STANDARD }}
        >
          <CategoryCard
            scan={scan}
            categoryKey={cat.key}
            badge={cat.badge}
            icon={cat.icon}
            metrics={cat.metrics}
            isPremium={true}
            facePhotoUrl={photo}
          />
        </motion.div>
      ),
    })),
    {
      id: 'progress',
      label: 'PROGRESS',
      render: ({ revealed }) => (
        <motion.div
          className="h-full"
          initial={{ filter: 'blur(12px)', opacity: 0.4 }}
          animate={revealed ? { filter: 'blur(0px)', opacity: 1 } : { filter: 'blur(12px)', opacity: 0.4 }}
          transition={{ duration: 0.55, ease: EASE_STANDARD }}
        >
          <ProgressSlide scan={scan} />
        </motion.div>
      ),
    },
  ]
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function UnlockRevealSlideshow({ scan, onFinish }) {
  const slides = buildSlides(scan)
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const [revealedSet, setRevealedSet] = useState(new Set())
  const [overlayPlaying, setOverlayPlaying] = useState(false)
  const [particleTrigger, setParticleTrigger] = useState(0) // increment to re-trigger

  // On every slide change, trigger reveal sequence
  useEffect(() => {
    if (revealedSet.has(idx)) return // already revealed this slide, skip

    // Haptic + overlay on entry
    triggerHaptic()
    setOverlayPlaying(true)
    setParticleTrigger(n => n + 1)

    // After overlay clears, mark as revealed + heavy haptic
    const t = setTimeout(() => {
      setOverlayPlaying(false)
      setRevealedSet(prev => new Set([...prev, idx]))
      triggerHaptic()
    }, 500)

    return () => clearTimeout(t)
  }, [idx])

  function advance() {
    if (idx < slides.length - 1) {
      triggerHaptic()
      setDir(1)
      setIdx(i => i + 1)
    } else {
      triggerHaptic()
      onFinish?.()
    }
  }

  const isLast = idx === slides.length - 1
  const isRevealed = revealedSet.has(idx)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col dark"
      style={{ background: 'var(--bg)', '--text-secondary': 'rgba(255,255,255,0.5)' }}
    >
      {/* Progress dots */}
      <div
        className="flex items-center justify-center gap-1.5 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)', paddingBottom: 6 }}
      >
        {slides.map((_, i) => (
          <motion.div
            key={i}
            animate={{
              width: i === idx ? 18 : 6,
              background: i < idx ? G : i === idx ? G : 'rgba(255,255,255,0.18)',
              opacity: i < idx ? 0.45 : 1,
            }}
            transition={SPRING_STANDARD}
            style={{ height: 6, borderRadius: 3 }}
          />
        ))}
      </div>

      {/* Category label */}
      <motion.div
        key={`label-${idx}`}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="text-center pt-1 pb-0.5 flex-shrink-0"
      >
        <span className="font-heading font-bold text-[10px] tracking-[0.2em]" style={{ color: 'rgba(198,168,92,0.5)' }}>
          {slides[idx].label}
        </span>
      </motion.div>

      {/* Slide content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={slides[idx].id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.3, ease: EASE_STANDARD }}
            className="absolute inset-0"
          >
            {slides[idx].render({ revealed: isRevealed })}
          </motion.div>
        </AnimatePresence>

        {/* Particle burst — positioned over slide */}
        <ParticleBurst trigger={particleTrigger > 0} key={particleTrigger} />

        {/* Blur reveal overlay */}
        <RevealOverlay
          playing={overlayPlaying}
          onDone={() => setOverlayPlaying(false)}
        />
      </div>

      {/* CTA */}
      <div
        className="flex-shrink-0 px-6"
        style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))', paddingTop: 12 }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={advance}
          disabled={!isRevealed}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] text-[#0A0A0A] transition-opacity"
          style={{
            background: GRAD,
            boxShadow: isRevealed ? '0 4px 24px rgba(198,168,92,0.35)' : 'none',
            opacity: isRevealed ? 1 : 0.35,
          }}
        >
          {isLast ? 'Continue to other metrics' : 'Continue'}
        </motion.button>
        {!isLast && (
          <p className="text-center font-body text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {slides.length - 1 - idx} more section{slides.length - 1 - idx !== 1 ? 's' : ''} to go
          </p>
        )}
      </div>
    </div>
  )
}
