import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { checkTrialEligibility, isNative, purchasePro } from '../utils/iap'
import {
  UserPlus, Share2, Check, Loader2, Users, ChevronRight,
  Lock, Sparkles, Eye, Zap, BarChart2, Smile, Brain, Activity,
} from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import PromoModal from '../components/PromoModal'
import logo from '../assets/ascendus-icon.png'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { CardShell, BlurLock, EXTENDED_CATEGORIES, CategoryCard } from '../components/CategoryCard'
import { triggerHaptic } from '../utils/haptics'
import { FirebaseAnalytics } from '@capacitor-firebase/analytics'
import MotionPage from '../components/MotionPage'

// Native purchase path only — the web/Stripe checkout path doesn't actually
// complete here (see handleAscend), so this is deliberately not called for it.
async function logAnalyticsEvent(name, params) {
  if (!isNative()) return
  try {
    await FirebaseAnalytics.logEvent({ name, params })
  } catch {
    // analytics unavailable — not fatal, ignore
  }
}

const G    = GOLD
const GRAD = GOLD_GRADIENT
// BG/TEXT/DIM now pull from index.css's shared --bg/--text-primary/--text-secondary
// custom properties (root wrapper below applies the "dark" scope so they resolve
// correctly — .dark isn't otherwise activated anywhere in the app). --text-secondary
// itself is overridden locally on that same wrapper: its shared .dark value
// (#4A4642) is calibrated for light-card text, not for overlay text on this
// near-black background, and doesn't meet the 4.5:1 contrast floor here.
const BG   = 'var(--bg)'
const TEXT = 'var(--text-primary)'
const DIM  = 'var(--text-secondary)'
const SURF = 'rgba(255,255,255,0.04)'

// ── Helpers (copied from OnboardingFinalSteps) ────────────────────────────────

// Returns the user's single strongest feature — used for the one unblurred
// personalized observation shown before the paywall. Prefers AI-generated text
// (keyStrengths[0]) because it's specific; falls back to the highest sub-score.
function getStrongestFeature(scan) {
  if (!scan) return null
  const strengths = scan.aiScore?.keyStrengths
  if (Array.isArray(strengths) && strengths.length > 0) return strengths[0]
  const fd = scan.faceData
  if (!fd) return null
  const candidates = [
    { score: fd.facialHarmony,     text: 'Well-balanced facial proportions and strong feature harmony' },
    { score: fd.jawlineDefinition, text: 'Strong, defined jawline and angular bone structure' },
    { score: fd.skinClarity,       text: 'Clear, even skin tone and healthy skin texture' },
    { score: fd.eyeArea,           text: 'Well-defined periorbital area and expressive eye shape' },
    { score: fd.symmetry,          text: 'High facial symmetry across all key feature pairs' },
    { score: fd.facialProportions, text: 'Strong facial width-to-height proportions' },
  ].filter(c => c.score != null)
  if (!candidates.length) return null
  return candidates.reduce((hi, c) => c.score > hi.score ? c : hi).text
}

function getBiggestGrowthArea(scan) {
  if (!scan) return null
  const candidates = []
  const fd = scan.faceData
  if (fd) {
    if (fd.jawlineDefinition != null) candidates.push({ label: 'Jawline & Structure', score: fd.jawlineDefinition, detail: 'How much definition and angularity your jawline currently has versus its structural ceiling' })
    if (fd.skinClarity       != null) candidates.push({ label: 'Skin Clarity',         score: fd.skinClarity,       detail: 'Texture, tone evenness, and clarity — the single highest-ROI area to address first' })
    if (fd.eyeArea           != null) candidates.push({ label: 'Eye Area',             score: fd.eyeArea,           detail: 'Periorbital definition, under-eye quality, and how your eye shape reads on camera' })
    if (fd.facialHarmony     != null) candidates.push({ label: 'Facial Harmony',       score: fd.facialHarmony,     detail: 'How well your facial thirds and feature proportions balance against each other' })
    if (fd.facialProportions != null) candidates.push({ label: 'Facial Proportions',   score: fd.facialProportions, detail: 'Upper to lower face ratio and the width-to-length balance relative to ideal benchmarks' })
  }
  if (scan.physiqueScore?.overall != null) {
    candidates.push({ label: 'Body & Physique', score: scan.physiqueScore.overall, detail: 'Muscle-to-fat ratio, shoulder-to-waist taper, and the visual impact of your current physique' })
  }
  if (!candidates.length) return null
  return candidates.reduce((low, c) => c.score < low.score ? c : low)
}

function toTopPct(score) {
  if (score == null) return null
  if (score >= 9.0) return 'Top 1%'
  if (score >= 8.0) return 'Top 5%'
  if (score >= 7.0) return 'Top 15%'
  if (score >= 6.0) return 'Top 30%'
  if (score >= 5.0) return 'Top 50%'
  return 'Bot 40%'
}

// ── Card 1: Original StepScoresWaiting layout ────────────────────────────────

function Card1Score({ scan }) {
  const glowScore      = scan?.glowScore ?? scan?.umaxScore ?? null
  const tier           = scan?.tier ?? null
  const topPct         = toTopPct(glowScore)
  const growthArea     = getBiggestGrowthArea(scan)
  const topStrength    = getStrongestFeature(scan)

  const physiqueUpside = scan?.physiqueScore
    ? Math.max(0, (7.5 - (scan.physiqueScore.overall ?? 5)) * 0.09)
    : 0
  const potential = glowScore != null
    ? Math.min(10, glowScore + 1.4 + physiqueUpside).toFixed(1)
    : null

  // pct drives each tile's progress bar. Tier itself is a string label, so it
  // borrows the same overall glowScore already shown as the hero number above;
  // potential reuses the value already computed for the tile itself.
  const symmetry          = scan?.faceData?.symmetry          ?? null
  const jawlineDefinition = scan?.faceData?.jawlineDefinition ?? null
  const skinClarity       = scan?.faceData?.skinClarity       ?? null
  const facialProportions = scan?.faceData?.facialProportions ?? null
  const toScorePct = v => v != null ? Math.min(100, (v / 10) * 100) : 0

  const lockedMetrics = [
    { label: 'PSL Tier',           value: tier ?? '—',                                              unit: '',                                    pct: glowScore != null ? Math.min(100, (glowScore / 10) * 100) : 0 },
    { label: 'Potential',          value: potential ?? '—',                                         unit: potential ? '/10' : '',                pct: potential != null ? Math.min(100, (parseFloat(potential) / 10) * 100) : 0 },
    { label: 'Symmetry',           value: symmetry != null ? symmetry.toFixed(1) : '—',                     unit: symmetry != null ? '/10' : '',          pct: toScorePct(symmetry) },
    { label: 'Jawline',            value: jawlineDefinition != null ? jawlineDefinition.toFixed(1) : '—',   unit: jawlineDefinition != null ? '/10' : '', pct: toScorePct(jawlineDefinition) },
    { label: 'Skin Clarity',       value: skinClarity != null ? skinClarity.toFixed(1) : '—',               unit: skinClarity != null ? '/10' : '',       pct: toScorePct(skinClarity) },
    { label: 'Facial Proportions', value: facialProportions != null ? facialProportions.toFixed(1) : '—',   unit: facialProportions != null ? '/10' : '', pct: toScorePct(facialProportions) },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)',
        width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(198,168,92,0.10) 0%, transparent 68%)',
        pointerEvents: 'none',
      }} />

      <div className="flex-1 flex flex-col justify-center px-6 overflow-y-auto">

        {/* Header — centered logo + wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <img src={logo} alt="" style={{ width: 18, height: 18, mixBlendMode: 'lighten', opacity: 0.65 }} />
          <span className="font-heading font-bold text-[9px] tracking-[0.24em]" style={{ color: 'rgba(198,168,92,0.45)' }}>
            ASCENDUS
          </span>
        </div>

        {/* Hero score */}
        <div className="mb-5">
          <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-2" style={{ color: 'rgba(198,168,92,0.65)' }}>
            GLOW SCORE
          </p>
          <BlurLock size="lg">
            <div className="flex items-end gap-1.5 mb-3">
              <span className="font-heading font-bold leading-none" style={{ fontSize: 62, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {glowScore != null ? glowScore.toFixed(1) : '—'}
              </span>
              <span className="font-heading font-bold text-[19px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>/10</span>
            </div>
          </BlurLock>
          <div className="flex items-center gap-2.5 flex-wrap">
            {tier && (
              <div className="inline-flex items-center px-3 py-1.5 rounded-xl" style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.30)' }}>
                <BlurLock size="sm">
                  <span className="font-heading font-bold text-[11px] tracking-[0.14em]" style={{ color: G }}>{tier.toUpperCase()}</span>
                </BlurLock>
              </div>
            )}
            {topPct && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <BarChart2 size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <BlurLock size="sm">
                  <span className="font-heading font-bold text-[11px] tracking-[0.10em]" style={{ color: 'rgba(255,255,255,0.75)' }}>{topPct}</span>
                </BlurLock>
              </div>
            )}
          </div>
        </div>

        {/* Top strength — label stays visible, the actual observation is locked */}
        {topStrength && (
          <div className="flex items-start gap-3 rounded-2xl px-3.5 py-3 mb-5" style={{ background: 'rgba(198,168,92,0.05)', border: '1px solid rgba(198,168,92,0.18)' }}>
            <div className="flex-shrink-0 mt-0.5" style={{ color: G, fontSize: 13 }}>✦</div>
            <div className="min-w-0">
              <p className="font-body text-[10px] tracking-[0.14em] mb-1" style={{ color: 'rgba(198,168,92,0.6)' }}>YOUR TOP STRENGTH</p>
              <BlurLock size="sm">
                <p className="font-heading font-semibold text-[13px] leading-snug" style={{ color: TEXT }}>{topStrength}</p>
              </BlurLock>
            </div>
          </div>
        )}

        {/* Biggest growth area teaser */}
        {growthArea && (
          <div className="flex items-start gap-3 rounded-2xl px-3.5 py-3 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Lock size={13} style={{ color: G, marginTop: 2, flexShrink: 0 }} />
            <div className="min-w-0">
              <p className="font-body text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Biggest growth area</p>
              <BlurLock size="sm">
                <p className="font-heading font-bold text-[13px] mb-1" style={{ color: TEXT }}>{growthArea.label}</p>
              </BlurLock>
              <BlurLock size="sm">
                <p className="font-body text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {growthArea.detail}
                </p>
              </BlurLock>
            </div>
          </div>
        )}

        {/* Locked metric cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {lockedMetrics.map(({ label, value, unit, pct }) => (
            <div key={label} className="rounded-2xl p-3.5 flex flex-col" style={{ background: 'rgba(198,168,92,0.03)', border: '1px solid rgba(198,168,92,0.15)' }}>
              <span className="font-heading font-bold text-[17px] uppercase mb-2.5" style={{ color: G, letterSpacing: '-0.01em' }}>{label}</span>
              <div className="flex items-center justify-between mb-2">
                <BlurLock size="sm">
                  <div className="flex items-end gap-0.5">
                    <span className="font-heading font-bold text-[22px] leading-none" style={{ color: TEXT }}>{value}</span>
                    {unit && <span className="font-heading font-bold text-[11px] mb-0.5" style={{ color: DIM }}>{unit}</span>}
                  </div>
                </BlurLock>
                <Lock size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, ease: EASE_STANDARD }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Swipe hint */}
        <p className="font-body text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
          Swipe → for full breakdown
        </p>
      </div>
    </div>
  )
}

// ── Card 3: Face Metrics ──────────────────────────────────────────────────────

function Card3FaceMetrics({ scan }) {
  const p  = scan?.pillars   ?? {}
  const fd = scan?.faceData  ?? {}

  const metrics = [
    { label: 'HARMONY',     value: p.harmony     ?? fd.facialHarmony    ?? null, icon: Activity },
    { label: 'ANGULARITY',  value: p.angularity  ?? fd.jawlineDefinition ?? null, icon: Zap },
    { label: 'FEATURES',    value: p.features    ?? fd.facialProportions ?? null, icon: Eye },
    { label: 'DIMORPHISM',  value: p.dimorphism  ?? null,                         icon: Smile },
  ].filter(m => m.value != null)

  const extras = [
    { label: 'SYMMETRY',    value: fd.symmetry     ?? null },
    { label: 'SKIN CLARITY',value: fd.skinClarity  ?? null },
    { label: 'EYE AREA',    value: fd.eyeArea      ?? null },
  ].filter(m => m.value != null)

  if (!metrics.length && !extras.length) return (
    <CardShell badge="FACE METRICS" icon={Smile}>
      <p className="font-body text-[13px]" style={{ color: DIM }}>Scan more data to unlock face metrics.</p>
    </CardShell>
  )

  return (
    <CardShell badge="FACE METRICS" icon={Smile}>
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex flex-col"
              style={{ background: 'rgba(198,168,92,0.04)', border: '1px solid rgba(198,168,92,0.12)' }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <Icon size={12} style={{ color: G }} />
                <Lock size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <p
                className="font-heading font-bold text-[9px] tracking-[0.12em] mb-3"
                style={{ color: 'rgba(198,168,92,0.6)' }}
              >
                {label}
              </p>
              <BlurLock>
                <div className="flex items-end gap-0.5">
                  <span className="font-heading font-bold text-[24px] leading-none" style={{ color: TEXT }}>
                    {value.toFixed(1)}
                  </span>
                  <span className="font-heading font-bold text-[11px] mb-0.5" style={{ color: DIM }}>/10</span>
                </div>
              </BlurLock>
            </div>
          ))}
        </div>
      )}

      {extras.length > 0 && (
        <div className="flex flex-col gap-3">
          {extras.map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="font-body text-[11px] tracking-wide" style={{ color: DIM }}>{label}</p>
              <div className="flex items-center gap-1.5">
                <BlurLock size="sm">
                  <span className="font-heading font-bold text-[13px]" style={{ color: TEXT }}>{value.toFixed(1)}</span>
                </BlurLock>
                <Lock size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

// ── Card 6: AI Analysis Preview ───────────────────────────────────────────────

function Card6AIAnalysis({ scan }) {
  const insights = scan?.aiScore?.insights
    ?? scan?.aiScore?.recommendations
    ?? []

  const growthArea = getBiggestGrowthArea(scan)

  const teaserLines = insights.length > 0
    ? insights.slice(0, 3)
    : [
        growthArea ? `Your ${growthArea.label.toLowerCase()} is your highest-leverage improvement area based on your scan metrics and facial geometry analysis.` : 'Your personalized improvement roadmap has been generated based on your unique scan data.',
        'Targeted interventions have been identified for your specific facial structure and aesthetic profile that yield the highest visual ROI.',
        'Your 12-week transformation protocol is ready with week-by-week milestones calibrated to your current tier.',
      ]

  return (
    <CardShell badge="AI ANALYSIS" icon={Brain}>
      <p
        className="font-heading font-bold text-[15px] mb-5"
        style={{ color: TEXT, letterSpacing: '-0.01em' }}
      >
        Personalized insights from your scan
      </p>

      <div className="flex flex-col gap-3">
        {teaserLines.map((line, i) => (
          <div
            key={i}
            className="rounded-2xl px-4 py-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.22)' }}
              >
                <span className="font-heading font-bold text-[9px]" style={{ color: G }}>{i + 1}</span>
              </div>
              <Lock size={10} style={{ color: G }} />
            </div>
            <BlurLock size="sm">
              <p className="font-body text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {line}
              </p>
            </BlurLock>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

// ── Swipeable Result Cards ────────────────────────────────────────────────────

const SLIDE_VARIANTS = {
  enter: (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (d) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
}

function SwipeableResultCards({ scan, onAscend, onInvite, onPromo, isPurchasing, error, trialEligibility = {} }) {
  const [cardIdx, setCardIdx]   = useState(0)
  const [direction, setDirection] = useState(1)

  // Three high-value cards, not seven. Growth area and PSL tier/potential
  // are already teased inside Card1Score itself — repeating them as
  // separate near-identical locked cards was pure padding.
  const cards = [
    { id: 'score', el: <Card1Score scan={scan} /> },
    ...EXTENDED_CATEGORIES.map(cat => ({
      id: cat.key,
      el: <CategoryCard scan={scan} categoryKey={cat.key} badge={cat.badge} icon={cat.icon} metrics={cat.metrics} />,
    })),
    { id: 'face', el: <Card3FaceMetrics scan={scan} /> },
    { id: 'ai',   el: <Card6AIAnalysis scan={scan} /> },
  ]

  function goTo(idx) {
    if (idx === cardIdx) return
    setDirection(idx > cardIdx ? 1 : -1)
    setCardIdx(idx)
  }

  // Velocity-aware, not just distance-aware — a fast flick commits even on a
  // short drag, matching how the rest of the app's card gestures behave
  // (PremiumOnboarding's slide cards, the Feature Tour's Photo Ranker).
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
    <div className="flex flex-col h-full" style={{ background: BG }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(198,168,92,0.09) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Swipeable area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={cardIdx}
            custom={direction}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.9 }}
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

      {/* Step counter */}
      <div className="flex items-center justify-center py-3 flex-shrink-0">
        <span className="font-heading font-bold text-[11px] tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {cardIdx + 1} OF {cards.length}
        </span>
      </div>

      {/* Fixed CTA */}
      <div
        className="flex flex-col gap-2.5 px-6 flex-shrink-0"
        style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))', paddingTop: 8 }}
      >
        {(() => {
          const trialReady = trialEligibility.monthly === 'eligible' || trialEligibility.yearly === 'eligible'
          return (
            <>
              <motion.button
                whileTap={{ scale: isPurchasing ? 1 : 0.97 }}
                onClick={() => { triggerHaptic(); onAscend() }}
                disabled={isPurchasing}
                className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: GRAD, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isPurchasing ? 'processing' : 'ready'}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: EASE_STANDARD }}
                    className="flex items-center justify-center gap-2"
                  >
                    {isPurchasing
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Sparkles size={16} style={{ color: '#0A0A0A' }} />
                    }
                    {isPurchasing ? 'Processing…' : trialReady ? 'Start 3-Day Free Trial' : 'Unlock Full Results'}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              {trialReady && !isPurchasing && (
                <p className="text-center text-[10px] font-body" style={{ color: 'rgba(198,168,92,0.5)', marginTop: -6 }}>
                  3 days free, then $7.99/mo or $49.99/yr · Cancel anytime
                </p>
              )}
              {error && (
                <p className="text-center text-[11px] font-body" style={{ color: '#EF4444' }}>{error}</p>
              )}
            </>
          )
        })()}

        {/* Invite is a secondary path, surfaced only once the user has seen every
            card — not stacked as a competing ask on the very first reveal. */}
        {cardIdx === cards.length - 1 && (
          <button
            onClick={onInvite}
            disabled={isPurchasing}
            className="w-full py-3.5 rounded-2xl font-heading font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: SURF, border: '1px solid rgba(255,255,255,0.1)', color: TEXT }}
          >
            <UserPlus size={14} /> Invite 3 Friends — Get Free Access
          </button>
        )}

        <button
          onClick={onPromo}
          disabled={isPurchasing}
          className="w-full py-2 font-body text-[11px] text-center transition-opacity hover:opacity-70 disabled:opacity-30"
          style={{ color: 'rgba(198,168,92,0.35)' }}
        >
          Have a promo code?
        </button>
      </div>
    </div>
  )
}

// ── Unlock Reveal Animation ───────────────────────────────────────────────────

function UnlockReveal({ score, onContinue }) {
  const reducedMotion = useReducedMotion()
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), reducedMotion ? 300 : 1400)
    return () => clearTimeout(t)
  }, [reducedMotion])

  const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
    angle: (i / 22) * 360,
    radius: 90 + (i % 3) * 55,
    size: 3 + (i % 4),
    delay: (i % 7) * 0.06,
  }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex flex-col items-center justify-center z-50"
      style={{ background: '#000' }}
    >
      {!reducedMotion && (
        <>
          <motion.div
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: revealed ? 3.5 : 0.2, opacity: revealed ? 0 : 0.9 }}
            transition={{ duration: 1.2, ease: EASE_STANDARD }}
            style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', border: `2px solid ${G}`, pointerEvents: 'none' }}
          />
          {PARTICLES.map((p, i) => (
            <motion.div
              key={i}
              initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
              animate={revealed ? { x: Math.cos((p.angle * Math.PI) / 180) * p.radius, y: Math.sin((p.angle * Math.PI) / 180) * p.radius, opacity: 0, scale: 0 } : {}}
              transition={{ duration: 0.85, delay: p.delay, ease: EASE_STANDARD }}
              style={{ position: 'absolute', width: p.size, height: p.size, borderRadius: '50%', background: G, pointerEvents: 'none' }}
            />
          ))}
        </>
      )}
      <motion.div
        animate={{ opacity: revealed ? 0.25 : 0 }}
        transition={{ duration: 1.0, delay: reducedMotion ? 0 : 0.4 }}
        style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(198,168,92,0.5) 0%, transparent 65%)', filter: 'blur(20px)', pointerEvents: 'none' }}
      />
      <div className="relative z-10 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reducedMotion ? 0 : 0.2 }}
          className="font-heading font-bold text-[11px] tracking-[0.22em] mb-6"
          style={{ color: 'rgba(198,168,92,0.65)' }}
        >
          YOUR ASCENDUS SCORE
        </motion.p>
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { filter: 'blur(28px)', scale: 0.8, opacity: 0 }}
          animate={reducedMotion
            ? { opacity: 1 }
            : { filter: revealed ? 'blur(0px)' : 'blur(28px)', scale: revealed ? 1 : 0.8, opacity: 1 }}
          transition={reducedMotion
            ? { duration: 0.2, ease: 'easeOut' }
            : { duration: 1.1, ease: EASE_STANDARD, delay: 0.15 }}
        >
          <span className="font-heading font-bold" style={{ fontSize: 100, color: TEXT, letterSpacing: '-0.04em', lineHeight: 1, display: 'block' }}>
            {score.toFixed(1)}
          </span>
          <span className="font-heading font-bold text-[26px]" style={{ color: 'rgba(255,255,255,0.35)' }}>/10</span>
        </motion.div>
      </div>
      <AnimatePresence>
        {revealed && (
          <motion.button
            initial={{ opacity: 0, y: reducedMotion ? 0 : 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reducedMotion ? 0 : 0.55 }}
            whileTap={{ scale: 0.97 }}
            onClick={onContinue}
            className="relative z-10 mt-14 px-12 py-4 rounded-2xl font-heading font-bold text-[16px]"
            style={{ background: GRAD, color: '#0A0A0A', boxShadow: '0 4px 28px rgba(198,168,92,0.45)' }}
          >
            See My Full Results
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Invite Sheet ──────────────────────────────────────────────────────────────

const REQUIRED = 3

function InviteSheet({ referralCode, referralCount, onClose, onUnlocked }) {
  const [count, setCount]           = useState(referralCount)
  const [sharing, setSharing]       = useState(false)
  const [unlocking, setUnlocking]   = useState(false)
  const [unlockErr, setUnlockErr]   = useState('')
  const [shareCount, setShareCount] = useState(0)
  const { setIsPremium }            = useStore()
  const navigate                    = useNavigate()

  const link      = referralCode ? `https://ascendus.store/r/${referralCode}` : 'https://ascendus.store'
  const shareText = `I'm using Ascendus to track my glow-up — it gives you an AI Glow Score and a custom plan. Try it free 👇 ${link}`

  async function pollCount() {
    try { const { count: fresh } = await api.referral.count(); setCount(fresh ?? 0); return fresh ?? 0 }
    catch (err) { console.warn('[ScanUnlockGate] pollCount failed:', err.message); return count }
  }

  async function handleShare() {
    setSharing(true)
    try {
      if (navigator.share) await navigator.share({ title: 'Ascendus', text: shareText, url: link })
      else await navigator.clipboard?.writeText(shareText)
      setShareCount(n => n + 1)
      setTimeout(async () => { const fresh = await pollCount(); if (fresh >= REQUIRED) handleUnlock(fresh) }, 1500)
    } catch (err) {
      // navigator.share throws on user cancel — expected, not an error
      if (!err?.message?.toLowerCase().includes('cancel') && err?.name !== 'AbortError') {
        console.warn('[ScanUnlockGate] handleShare failed:', err.message)
      }
    } finally { setSharing(false) }
  }

  async function handleUnlock(freshCount) {
    const c = freshCount ?? count
    if (c < REQUIRED) { setUnlockErr(`Need ${REQUIRED - c} more friend${REQUIRED - c !== 1 ? 's' : ''} to sign up first.`); return }
    setUnlocking(true); setUnlockErr('')
    try {
      const { ok, isPremium: granted } = await api.referral.unlockPro()
      if (ok && granted) { sessionStorage.setItem('asc_pro_splash_shown', '1'); setIsPremium(true); navigate('/results', { replace: true }) }
    } catch (err) {
      const msg = err?.message || ''
      if (msg.toLowerCase().includes('need')) { const fresh = await pollCount(); setUnlockErr(`${fresh}/${REQUIRED} friends signed up so far.`) }
      else setUnlockErr(msg || 'Something went wrong. Try again.')
    } finally { setUnlocking(false) }
  }

  const done = count >= REQUIRED

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="absolute inset-x-0 bottom-0 rounded-t-2xl z-10 flex flex-col"
      style={{ background: '#111', border: '1px solid rgba(198,168,92,0.15)', borderBottom: 0, maxHeight: '85vh' }}
    >
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
      </div>
      <div className="px-6 pb-10 pt-3 overflow-y-auto">
        <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: G }}>INVITE & UNLOCK</p>
        <h2 className="font-heading font-bold text-[24px] leading-tight mb-1" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          Get Pro free.<br />Invite {REQUIRED} friends.
        </h2>
        <p className="font-body text-[13px] mb-6" style={{ color: DIM }}>
          Each friend must sign up using your link. Once {REQUIRED} join, your full results unlock permanently.
        </p>
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-heading font-bold text-[11px] tracking-wide uppercase" style={{ color: DIM }}>Friends joined</span>
            <span className="font-mono font-bold text-[13px]" style={{ color: done ? '#34C759' : G }}>{count}/{REQUIRED}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div className="h-full rounded-full" style={{ background: done ? '#34C759' : GRAD }}
              initial={false} animate={{ width: `${Math.min(100, (count / REQUIRED) * 100)}%` }} transition={{ duration: 0.5 }} />
          </div>
          <div className="flex justify-between mt-2">
            {[...Array(REQUIRED)].map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: i < count ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${i < count ? '#34C759' : 'rgba(255,255,255,0.1)'}` }}>
                  {i < count ? <Check size={12} style={{ color: '#34C759' }} /> : <span className="text-[9px] font-bold" style={{ color: DIM }}>{i + 1}</span>}
                </div>
              </div>
            ))}
            <div />
          </div>
        </div>
        <div className="mb-5 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.18)' }}>
          <p className="text-[10.5px] font-body leading-relaxed" style={{ color: 'rgba(198,168,92,0.75)' }}>
            <span className="font-bold">How it counts:</span> a friend registers with your link — only real sign-ups count.
          </p>
        </div>
        {!done && (
          <motion.button whileTap={{ scale: sharing ? 1 : 0.97 }} onClick={handleShare} disabled={sharing}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2 mb-3 disabled:opacity-60"
            style={{ background: GRAD, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.35)' }}>
            {sharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            {sharing ? 'Opening share…' : shareCount > 0 ? 'Share Again' : 'Share Your Link'}
          </motion.button>
        )}
        <motion.button whileTap={{ scale: (done && !unlocking) ? 0.97 : 1 }} onClick={() => handleUnlock()} disabled={!done || unlocking}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2 mb-2 disabled:opacity-40"
          style={{ background: done ? GRAD : SURF, border: done ? 'none' : '1px solid rgba(255,255,255,0.1)', color: done ? '#0A0A0A' : DIM, boxShadow: done ? '0 4px 20px rgba(198,168,92,0.35)' : 'none' }}>
          {unlocking ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
          {unlocking ? 'Unlocking…' : done ? 'Unlock My Results Now' : `${REQUIRED - count} more friend${REQUIRED - count !== 1 ? 's' : ''} needed`}
        </motion.button>
        {unlockErr && <p className="text-center text-[11px] font-body mt-1" style={{ color: '#EF4444' }}>{unlockErr}</p>}
        {shareCount > 0 && !done && (
          <button onClick={async () => { const fresh = await pollCount(); if (fresh >= REQUIRED) handleUnlock(fresh) }}
            className="w-full mt-2 py-2 font-body text-[12px] text-center flex items-center justify-center gap-1" style={{ color: DIM }}>
            Check if friends joined <ChevronRight size={12} />
          </button>
        )}
        <button onClick={onClose} className="w-full mt-3 py-2 font-body text-[12px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
          Maybe later
        </button>
      </div>
    </motion.div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ScanUnlockGate() {
  const navigate = useNavigate()
  const { currentScan, isPremium, setIsPremium } = useStore()

  const [showInvite, setShowInvite]     = useState(false)
  const [showPromo, setShowPromo]       = useState(false)
  const [showReveal, setShowReveal]     = useState(false)
  const [referralCode, setReferralCode] = useState(null)
  const [referralCount, setReferralCount] = useState(0)
  const [trialEligibility, setTrialEligibility] = useState({ monthly: 'unknown', yearly: 'unknown' })
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')

  useEffect(() => {
    if (isPremium) navigate('/results', { replace: true })
  }, [isPremium])

  useEffect(() => {
    if (!currentScan) navigate('/scan', { replace: true })
  }, [currentScan])

  useEffect(() => {
    if (!currentScan || isPremium) return
    api.referral.count()
      .then(({ count, code }) => { setReferralCount(count || 0); setReferralCode(code || null) })
      .catch(() => {})
    checkTrialEligibility()
      .then(result => setTrialEligibility(result))
      .catch(() => {})
  }, [])

  if (isPremium || !currentScan) return null

  const revealScore = currentScan?.glowScore ?? currentScan?.umaxScore ?? 7.0

  if (showReveal) {
    return <UnlockReveal score={revealScore} onContinue={() => navigate('/results', { replace: true })} />
  }

  async function handleAscend() {
    setIsPurchasing(true)
    setPurchaseError('')
    try {
      if (isNative()) {
        // Prefer whichever plan the "3-Day Free Trial" copy is actually
        // promising — monthly by default, but fall back to yearly if only
        // that one is trial-eligible.
        const plan = trialEligibility.monthly === 'eligible' ? 'monthly'
          : trialEligibility.yearly === 'eligible' ? 'yearly' : 'monthly'
        const result = await purchasePro(plan)
        if (result?.success) {
          const rcUserId = result.customerInfo?.originalAppUserId
          api.payments.syncRc(rcUserId).catch(() => {})
          sessionStorage.setItem('asc_pro_splash_shown', '1')
          setIsPremium(true)
          logAnalyticsEvent('purchase_completed', { plan, platform: 'native' })
          navigate('/results', { replace: true })
          return
        }
        // Resolved without granting the entitlement — either the user
        // cancelled or something else went wrong without throwing. Reset so
        // the button never gets stuck spinning either way.
        if (result?.reason !== 'cancelled') {
          setPurchaseError('Unable to complete purchase. Please try again.')
        }
        setIsPurchasing(false)
        return
      }
      // Web: Stripe checkout — same flow as PaywallSheet's handleCheckout.
      const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
      const token  = stored?.state?.token
      if (!token || token === 'demo-token') { setIsPurchasing(false); navigate('/auth'); return }
      const { url } = await api.payments.createCheckout('monthly', false)
      window.location.href = url
      // Leave isPurchasing=true — the page is about to navigate away.
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (!msg.includes('cancel')) {
        setPurchaseError(err?.message || 'Unable to complete purchase. Please try again.')
      }
      setIsPurchasing(false)
    }
  }

  return (
    <MotionPage
      baseClassName=""
      className="fixed inset-0 z-50 overflow-hidden dark"
      style={{ background: BG, '--text-secondary': 'rgba(255,255,255,0.5)' }}
    >
      <SwipeableResultCards
        scan={currentScan}
        onAscend={handleAscend}
        onInvite={() => setShowInvite(true)}
        onPromo={() => setShowPromo(true)}
        isPurchasing={isPurchasing}
        error={purchaseError}
        trialEligibility={trialEligibility}
      />

      <AnimatePresence>
        {showPromo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30">
            <PromoModal onClose={() => setShowPromo(false)} onSuccess={() => {
              setShowPromo(false)
              // Flag this scan's reveal as shown so Results.jsx's own ScoreReveal
              // doesn't replay the same score count-up seconds later.
              try { sessionStorage.setItem('asc_reveal_shown', currentScan?.id ?? '') } catch {}
              setShowReveal(true)
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => setShowInvite(false)}
          >
            <div onClick={e => e.stopPropagation()} className="absolute inset-0">
              <InviteSheet
                referralCode={referralCode}
                referralCount={referralCount}
                onClose={() => setShowInvite(false)}
                onUnlocked={() => navigate('/results', { replace: true })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionPage>
  )
}
