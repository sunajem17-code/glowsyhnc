import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import { CardShell, BlurLock, EXTENDED_CATEGORIES, CategoryCard } from './CategoryCard'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import useStore from '../store/useStore'

// ── Internal: Progress graph slide (mirrors CardProgress in ScanUnlockGate) ──

const G    = GOLD
const GRAD = GOLD_GRADIENT
const TEXT = 'var(--text-primary)'
const DIM  = 'var(--text-secondary)'

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
  const MIN_S   = 0, MAX_S = 10
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

// ── Slide definitions ─────────────────────────────────────────────────────────

function buildSlides(scan) {
  const photo = scan?.facePhotoUrl ?? null
  return [
    // Overall — reuses Card1Score layout but simplified for the reveal context:
    // just shows the hero score unlocked, no metric grid (that's in the carousel).
    {
      id: 'overall',
      label: 'Overall',
      render: () => (
        <div
          className="h-full flex flex-col overflow-y-auto"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 88px)' }}
        >
          <div className="flex flex-col px-6 pb-2">
            <div className="flex items-center gap-2.5 mb-6">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.22)' }}
              >
                {photo
                  ? <img src={photo} alt="" className="w-full h-full object-cover" />
                  : <span style={{ color: G, fontSize: 13, fontWeight: 700 }}>✦</span>
                }
              </div>
              <span className="font-heading font-bold text-[10px] tracking-[0.22em]" style={{ color: 'rgba(198,168,92,0.75)' }}>
                OVERALL
              </span>
            </div>
            <p className="font-body font-bold text-[11px] tracking-[0.18em] mb-2" style={{ color: 'rgba(198,168,92,0.65)' }}>
              GLOW SCORE
            </p>
            <div className="flex items-end gap-1.5 mb-3">
              <span className="font-heading font-bold leading-none" style={{ fontSize: 72, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {scan?.glowScore != null ? scan.glowScore.toFixed(1) : '—'}
              </span>
              <span className="font-heading font-bold text-[22px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>/10</span>
            </div>
            {scan?.tier && (
              <div className="inline-flex items-center px-3 py-1.5 rounded-xl self-start mb-4"
                style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.30)' }}>
                <span className="font-heading font-bold text-[11px] tracking-[0.14em]" style={{ color: G }}>
                  {scan.tier.toUpperCase()}
                </span>
              </div>
            )}
            <p className="font-body text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Your full breakdown is unlocked. Swipe through each category below to explore every metric.
            </p>
          </div>
        </div>
      ),
    },
    // Extended category pages
    ...EXTENDED_CATEGORIES.map(cat => ({
      id: cat.key,
      label: cat.badge,
      render: () => (
        <CategoryCard
          scan={scan}
          categoryKey={cat.key}
          badge={cat.badge}
          icon={cat.icon}
          metrics={cat.metrics}
          isPremium={true}
          facePhotoUrl={photo}
        />
      ),
    })),
    // Progress graph — last, the "wow" closer
    {
      id: 'progress',
      label: 'PROGRESS',
      render: () => <ProgressSlide scan={scan} />,
    },
  ]
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * UnlockRevealSlideshow
 *
 * Full-screen step-through played immediately after any successful unlock
 * (real purchase or promo code). Shows each category fully unlocked, one at
 * a time, with a Continue button that advances to the next slide. The final
 * Continue press calls onFinish(), which the parent uses to navigate to the
 * normal results view.
 *
 * Props:
 *   scan      – the currentScan object (same one SwipeableResultCards uses)
 *   onFinish  – called when the user taps Continue on the last slide
 */
export default function UnlockRevealSlideshow({ scan, onFinish }) {
  const slides = buildSlides(scan)
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1) // 1 = forward

  function advance() {
    triggerHaptic()
    if (idx < slides.length - 1) {
      setDir(1)
      setIdx(i => i + 1)
    } else {
      onFinish?.()
    }
  }

  const isLast = idx === slides.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col dark"
      style={{ background: 'var(--bg)', '--text-secondary': 'rgba(255,255,255,0.5)' }}
    >
      {/* Top progress dots */}
      <div
        className="flex items-center justify-center gap-1.5 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)', paddingBottom: 6 }}
      >
        {slides.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === idx ? 18 : 6, background: i === idx ? G : 'rgba(255,255,255,0.22)' }}
            transition={SPRING_STANDARD}
            style={{ height: 6, borderRadius: 3 }}
          />
        ))}
      </div>

      {/* Slide content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={slides[idx].id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -32 }}
            transition={{ duration: 0.28, ease: EASE_STANDARD }}
            className="absolute inset-0"
          >
            {slides[idx].render()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* CTA */}
      <div
        className="flex-shrink-0 px-6"
        style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))', paddingTop: 12 }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={advance}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] text-[#0A0A0A]"
          style={{ background: GRAD, boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
        >
          {isLast ? 'View My Results' : 'Continue'}
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
