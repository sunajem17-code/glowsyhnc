import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { isNative, purchasePro } from '../utils/iap'
import {
  UserPlus, Share2, Check, Loader2, Users, ChevronRight, X,
  Lock, Sparkles, Eye, Zap, BarChart2, Smile, Brain, Activity,
} from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import PromoModal from '../components/PromoModal'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, RED } from '../utils/theme'
import { CardShell, BlurLock, EXTENDED_CATEGORIES, CategoryCard, MetricTile, TEASER_KEYS } from '../components/CategoryCard'
import ProcessingOverlay from '../components/ProcessingOverlay'
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
// Fixed fill for every locked tile's progress bar (Card1Score, Card3FaceMetrics),
// identical regardless of the real score — a real (but non-computed) percentage
// so the bar reads as "there's a score here, unlock to see it" instead of
// looking broken/empty, without the fill length leaking anything about the
// actual value.
const LOCKED_FILL_PCT = 62
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
    if (fd.skinClarity       != null) candidates.push({ label: 'Skin Clarity',         score: fd.skinClarity,       detail: 'Texture, tone evenness, and clarity. The single highest-ROI area to address first' })
    if (fd.eyeArea           != null) candidates.push({ label: 'Eye Area',             score: fd.eyeArea,           detail: 'Periorbital definition, under-eye quality, and how your eye shape reads on camera' })
    if (fd.facialHarmony     != null) candidates.push({ label: 'Facial Harmony',       score: fd.facialHarmony,     detail: 'How well your facial thirds and feature proportions balance against each other' })
    if (fd.facialProportions != null) candidates.push({ label: 'Facial Proportions',   score: fd.facialProportions, detail: 'Upper to lower face ratio and the width-to-length balance relative to ideal benchmarks' })
  }
  // Physique is intentionally not a candidate here — physique scoring no
  // longer happens as part of the main scan (see Training Plan flow).
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

// ── Shared unlock helper ──────────────────────────────────────────────────────
// When isPremium is true, renders children directly; otherwise wraps in BlurLock.
function MaybeBlur({ children, isPremium, size = 'sm' }) {
  return isPremium ? children : <BlurLock size={size}>{children}</BlurLock>
}

// ── Card 1: Original StepScoresWaiting layout ────────────────────────────────

function Card1Score({ scan, isPremium = false }) {
  const glowScore      = scan?.glowScore ?? scan?.umaxScore ?? null
  const tier           = scan?.tier ?? null
  const topPct         = toTopPct(glowScore)
  const growthArea     = getBiggestGrowthArea(scan)
  const topStrength    = getStrongestFeature(scan)

  const potential = glowScore != null
    ? Math.min(10, glowScore + 1.4).toFixed(1)
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
    { key: 'pslTier',           label: 'PSL Tier',           value: tier ?? 'N/A',                                            unit: '',                                    pct: glowScore != null ? Math.min(100, (glowScore / 10) * 100) : 0 },
    { key: 'potential',         label: 'Potential',          value: potential ?? 'N/A',                                       unit: potential ? '/10' : '',                pct: potential != null ? Math.min(100, (parseFloat(potential) / 10) * 100) : 0 },
    { key: 'symmetry',          label: 'Symmetry',           value: symmetry != null ? symmetry.toFixed(1) : 'N/A',                   unit: symmetry != null ? '/10' : '',          pct: toScorePct(symmetry) },
    { key: 'jawline',           label: 'Jawline',            value: jawlineDefinition != null ? jawlineDefinition.toFixed(1) : 'N/A', unit: jawlineDefinition != null ? '/10' : '', pct: toScorePct(jawlineDefinition) },
    { key: 'skinClarity',       label: 'Skin Clarity',       value: skinClarity != null ? skinClarity.toFixed(1) : 'N/A',             unit: skinClarity != null ? '/10' : '',       pct: toScorePct(skinClarity) },
    { key: 'facialProportions', label: 'Facial Proportions', value: facialProportions != null ? facialProportions.toFixed(1) : 'N/A', unit: facialProportions != null ? '/10' : '', pct: toScorePct(facialProportions) },
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

      <div className="flex-1 flex flex-col px-6 overflow-y-auto"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 88px)' }}>

        {/* Badge row — same icon+label pattern CardShell gives every other
            card in this carousel. This card used to hand-roll its own plain
            text label with no icon and vertically-centered content instead
            of the shared top-anchored layout, which is why it looked like
            the odd one out swiping between it and the rest. */}
        <div className="flex items-center gap-2.5 mb-6 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.22)' }}
          >
            <Sparkles size={16} style={{ color: G }} />
          </div>
          <span
            className="font-heading font-bold text-[10px] tracking-[0.22em]"
            style={{ color: 'rgba(198,168,92,0.75)' }}
          >
            GLOW SCORE
          </span>
        </div>

        {/* Hero score */}
        <div className="mb-5">
          <MaybeBlur isPremium={isPremium} size="lg">
            <div className="flex items-end gap-1.5 mb-3">
              <span className="font-heading font-bold leading-none" style={{ fontSize: 62, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {glowScore != null ? glowScore.toFixed(1) : 'N/A'}
              </span>
              <span className="font-heading font-bold text-[19px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>/10</span>
            </div>
          </MaybeBlur>
          <div className="flex items-center gap-2.5 flex-wrap">
            {tier && (
              <div className="inline-flex items-center px-3 py-1.5 rounded-xl" style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.30)' }}>
                <MaybeBlur isPremium={isPremium} size="sm">
                  <span className="font-heading font-bold text-[11px] tracking-[0.14em]" style={{ color: G }}>{tier.toUpperCase()}</span>
                </MaybeBlur>
              </div>
            )}
            {topPct && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <BarChart2 size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <MaybeBlur isPremium={isPremium} size="sm">
                  <span className="font-heading font-bold text-[11px] tracking-[0.10em]" style={{ color: 'rgba(255,255,255,0.75)' }}>{topPct}</span>
                </MaybeBlur>
              </div>
            )}
          </div>
        </div>

        {/* Top strength */}
        {topStrength && (
          <div className="flex items-start gap-3 rounded-2xl px-3.5 py-3 mb-5" style={{ background: 'rgba(198,168,92,0.05)', border: '1px solid rgba(198,168,92,0.18)' }}>
            <div className="flex-shrink-0 mt-0.5" style={{ color: G, fontSize: 13 }}>✦</div>
            <div className="min-w-0">
              <p className="font-body text-[10px] tracking-[0.14em] mb-1" style={{ color: 'rgba(198,168,92,0.6)' }}>YOUR TOP STRENGTH</p>
              <MaybeBlur isPremium={isPremium} size="sm">
                <p className="font-heading font-semibold text-[13px] leading-snug" style={{ color: TEXT }}>{topStrength}</p>
              </MaybeBlur>
            </div>
          </div>
        )}

        {/* Biggest growth area */}
        {growthArea && (
          <div className="flex items-start gap-3 rounded-2xl px-3.5 py-3 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {!isPremium && <Lock size={13} style={{ color: G, marginTop: 2, flexShrink: 0 }} />}
            <div className="min-w-0">
              <p className="font-body text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Biggest growth area</p>
              <MaybeBlur isPremium={isPremium} size="sm">
                <p className="font-heading font-bold text-[13px] mb-1" style={{ color: TEXT }}>{growthArea.label}</p>
              </MaybeBlur>
              <MaybeBlur isPremium={isPremium} size="sm">
                <p className="font-body text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {growthArea.detail}
                </p>
              </MaybeBlur>
            </div>
          </div>
        )}

        {/* Metric cards — same MetricTile as CategoryCard's extended-metric
            categories, so boxes are byte-identical. Locked state reveals only
            TEASER_KEYS.overall ('potential') even pre-purchase; once
            isPremium is true every tile unlocks as normal. */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {lockedMetrics.map(({ key, label, value, unit, pct }) => (
            <MetricTile key={label} label={label} value={value} unit={unit} pct={pct} locked={!isPremium && key !== TEASER_KEYS.overall} />
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

function Card3FaceMetrics({ scan, isPremium = false }) {
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
        // Same tile treatment as CategoryCard's extended-metric cards (label
        // style, value+lock row, progress bar) — this card used to have its
        // own smaller per-tile icon + tiny label style instead, which made it
        // look like a different design swiped in from the rest of the carousel.
        <div className="grid grid-cols-2 gap-3 mb-3">
          {metrics.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex flex-col"
              style={{ background: 'rgba(198,168,92,0.03)', border: '1px solid rgba(198,168,92,0.15)' }}
            >
              <span className="font-heading font-bold text-[18px] uppercase mb-3" style={{ color: G, letterSpacing: '-0.01em' }}>
                {label}
              </span>
              <div className="flex items-center justify-between mb-2">
                <MaybeBlur isPremium={isPremium} size="sm">
                  <div className="flex items-end gap-0.5">
                    <span className="font-heading font-bold text-[23px] leading-none" style={{ color: TEXT }}>
                      {value.toFixed(1)}
                    </span>
                    <span className="font-heading font-bold text-[11px] mb-0.5" style={{ color: DIM }}>/10</span>
                  </div>
                </MaybeBlur>
                {!isPremium && (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'rgba(198,168,92,0.18)', flexShrink: 0 }}>
                    <Lock size={12} style={{ color: 'rgba(198,168,92,0.9)' }} />
                  </span>
                )}
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                {isPremium ? (
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
                    transition={{ duration: 0.9, ease: EASE_STANDARD }}
                  />
                ) : (
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)',
                      width: `${LOCKED_FILL_PCT}%`,
                    }}
                  />
                )}
              </div>
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
                <MaybeBlur isPremium={isPremium} size="sm">
                  <span className="font-heading font-bold text-[13px]" style={{ color: TEXT }}>{value.toFixed(1)}</span>
                </MaybeBlur>
                {!isPremium && (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'rgba(198,168,92,0.18)', flexShrink: 0 }}>
                    <Lock size={12} style={{ color: 'rgba(198,168,92,0.9)' }} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

// ── Card 6: AI Analysis Preview ───────────────────────────────────────────────

function Card6AIAnalysis({ scan, isPremium = false }) {
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
              {!isPremium && <Lock size={10} style={{ color: G }} />}
            </div>
            <MaybeBlur isPremium={isPremium} size="sm">
              <p className="font-body text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {line}
              </p>
            </MaybeBlur>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

// ── Card: Percentile Distribution ────────────────────────────────────────────
// Shown only after unlock. Percentile is derived from score thresholds
// calibrated to a normal distribution — no real per-user distribution is
// tracked server-side yet, so this is an estimate, not a live data point.
function CardPercentile({ scan }) {
  const glowScore = scan?.glowScore ?? scan?.umaxScore ?? null
  const photo     = scan?.facePhotoUrl ?? null

  function scoreToBetterThan(s) {
    if (s >= 9.0) return 99
    if (s >= 8.5) return 97
    if (s >= 8.0) return 94
    if (s >= 7.5) return 88
    if (s >= 7.0) return 82
    if (s >= 6.5) return 72
    if (s >= 6.0) return 62
    if (s >= 5.5) return 50
    if (s >= 5.0) return 40
    if (s >= 4.5) return 30
    if (s >= 4.0) return 22
    return 10
  }

  const betterThan = glowScore != null ? scoreToBetterThan(glowScore) : null

  // Bell curve SVG — Gaussian with mean=5.5, sigma=1.8
  const MEAN = 5.5, SD = 1.8
  const pdf = (x) => Math.exp(-0.5 * ((x - MEAN) / SD) ** 2) / (SD * Math.sqrt(2 * Math.PI))
  const SVG_W = 300, SVG_H = 108, PAD = 10
  const USABLE = SVG_W - PAD * 2
  const toX = (score) => PAD + (Math.min(10, Math.max(0, score)) / 10) * USABLE
  const maxP = pdf(MEAN)
  const toY = (p) => (SVG_H - 12) - (p / maxP) * (SVG_H - 28)

  const N = 120
  const pts = Array.from({ length: N + 1 }, (_, i) => ({ score: (i / N) * 10, p: pdf((i / N) * 10) }))

  const curvePath = 'M ' + pts.map(pt => `${toX(pt.score).toFixed(1)},${toY(pt.p).toFixed(1)}`).join(' L ')

  const userX  = glowScore != null ? toX(glowScore) : null
  const userY  = glowScore != null ? toY(pdf(Math.min(10, Math.max(0, glowScore)))) : null
  const fillPts = pts.filter(pt => toX(pt.score) <= (userX ?? 0) + 0.5)
  const fillPath = fillPts.length > 1
    ? `M ${toX(0).toFixed(1)},${(SVG_H - 12).toFixed(1)} ` +
      fillPts.map(pt => `L ${toX(pt.score).toFixed(1)},${toY(pt.p).toFixed(1)}`).join(' ') +
      ` L ${(userX ?? 0).toFixed(1)},${(SVG_H - 12).toFixed(1)} Z`
    : ''

  const PURPLE = '#8B5CF6'
  const PURPLE_MID = '#A78BFA'

  return (
    <CardShell badge="YOUR RANKING" icon={BarChart2}>
      {/* Photo + score row */}
      <div className="flex items-center gap-4 mb-5">
        <div
          className="w-[60px] h-[60px] rounded-full overflow-hidden flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          {photo
            ? <img src={photo} alt="Your scan" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><BarChart2 size={22} style={{ color: 'rgba(255,255,255,0.25)' }} /></div>
          }
        </div>
        <div>
          <p className="font-body text-[10px] tracking-[0.14em] mb-0.5" style={{ color: 'rgba(139,92,246,0.7)' }}>GLOW SCORE</p>
          <div className="flex items-end gap-1">
            <span className="font-heading font-bold leading-none" style={{ fontSize: 46, color: TEXT, letterSpacing: '-0.03em' }}>
              {glowScore != null ? glowScore.toFixed(1) : '—'}
            </span>
            <span className="font-heading font-bold text-[16px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>/10</span>
          </div>
        </div>
      </div>

      {/* Bell curve */}
      <div
        className="rounded-2xl overflow-hidden mb-3"
        style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}
      >
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="pctFill" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={PURPLE} stopOpacity="0.1" />
              <stop offset="100%" stopColor={PURPLE} stopOpacity="0.5" />
            </linearGradient>
          </defs>
          {fillPath && <path d={fillPath} fill="url(#pctFill)" />}
          <path d={curvePath} fill="none" stroke={PURPLE_MID} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {userX != null && userY != null && (
            <>
              <line x1={userX} y1={userY + 4} x2={userX} y2={SVG_H - 12} stroke={PURPLE} strokeWidth="1.5" strokeDasharray="3,3" />
              <circle cx={userX} cy={userY} r="4.5" fill={PURPLE} />
              <circle cx={userX} cy={userY} r="7" fill="none" stroke={PURPLE} strokeWidth="1" strokeOpacity="0.4" />
              <text
                x={Math.min(Math.max(userX - 28, 4), SVG_W - 64)}
                y={userY - 10}
                fill={PURPLE_MID}
                fontSize="9"
                fontFamily="Inter, sans-serif"
                fontWeight="700"
                letterSpacing="0.02em"
              >
                You&apos;re here
              </text>
            </>
          )}
          <line x1={PAD} y1={SVG_H - 12} x2={SVG_W - PAD} y2={SVG_H - 12} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        </svg>
      </div>

      {/* Percentile copy */}
      {betterThan != null && (
        <p className="font-body text-[14px] text-center mb-1" style={{ color: TEXT }}>
          Your score is better than{' '}
          <span className="font-heading font-bold" style={{ color: PURPLE_MID }}>{betterThan}%</span>
          {' '}of people
        </p>
      )}
      <p className="font-body text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
        Estimate based on score benchmarks · updates as more users join
      </p>
    </CardShell>
  )
}

// ── Card: Score Progress Graph ────────────────────────────────────────────────
// Pro-gated. Reads scan history from Zustand (already persisted).
// Uses a simple SVG area+line chart — no external charting dep.
function CardProgress({ isPremium = false }) {
  const scans = useStore(s => s.scans)

  // Build data points: most-recent scan first in store, so reverse for chart
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
  const PT_W    = 72  // px per data point — makes it scrollable with many scans
  const CHART_W = Math.max(280, pts.length * PT_W)
  const PAD_V   = 14
  const MIN_S   = 0, MAX_S = 10

  const toY = (score) =>
    PAD_V + ((MAX_S - score) / (MAX_S - MIN_S)) * (CHART_H - PAD_V * 2)
  const toX = (i) =>
    pts.length === 1 ? CHART_W / 2 : (i / (pts.length - 1)) * (CHART_W - 24) + 12

  const linePath = pts.length > 1
    ? 'M ' + pts.map(p => `${toX(p.idx).toFixed(1)},${toY(p.score).toFixed(1)}`).join(' L ')
    : ''

  const areaPath = pts.length > 1
    ? `M ${toX(0).toFixed(1)},${CHART_H} ` +
      pts.map(p => `L ${toX(p.idx).toFixed(1)},${toY(p.score).toFixed(1)}`).join(' ') +
      ` L ${toX(pts.length - 1).toFixed(1)},${CHART_H} Z`
    : ''

  const content = (
    <CardShell badge="PROGRESS" icon={Activity}>
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
            <svg
              width={CHART_W}
              height={CHART_H + 24}
              style={{ display: 'block', minWidth: CHART_W }}
            >
              <defs>
                <linearGradient id="progFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={G} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={G} stopOpacity="0.03" />
                </linearGradient>
              </defs>
              {/* Horizontal grid lines at 2.5, 5, 7.5 */}
              {[2.5, 5, 7.5].map(v => (
                <line
                  key={v}
                  x1={0} y1={toY(v).toFixed(1)}
                  x2={CHART_W} y2={toY(v).toFixed(1)}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1"
                />
              ))}
              {/* Area fill */}
              {areaPath && <path d={areaPath} fill="url(#progFill)" />}
              {/* Line */}
              {linePath && (
                <path d={linePath} fill="none" stroke={G} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* Dots + labels */}
              {pts.map(p => (
                <g key={p.idx}>
                  <circle cx={toX(p.idx)} cy={toY(p.score)} r="4" fill={G} />
                  <text
                    x={toX(p.idx)} y={CHART_H + 16}
                    fill="rgba(255,255,255,0.38)"
                    fontSize="8" textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                  >
                    {p.label}
                  </text>
                  <text
                    x={toX(p.idx)}
                    y={Math.max(toY(p.score) - 8, PAD_V + 2)}
                    fill={G} fontSize="8.5" textAnchor="middle"
                    fontFamily="Inter, sans-serif" fontWeight="700"
                  >
                    {p.score.toFixed(1)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </>
      )}
    </CardShell>
  )

  if (!isPremium) {
    return (
      <CardShell badge="PROGRESS" icon={Activity}>
        <BlurLock size="lg">
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Activity size={28} style={{ color: 'rgba(198,168,92,0.3)' }} />
            <p className="font-body text-[13px] text-center" style={{ color: DIM }}>
              Track your Glow Score over time
            </p>
          </div>
        </BlurLock>
      </CardShell>
    )
  }

  return content
}

// ── Swipeable Result Cards ────────────────────────────────────────────────────


function SwipeableResultCards({ scan, onAscend, onInvite, onPromo, onContinue, isPurchasing, error, isPremium = false }) {
  const [cardIdx, setCardIdx] = useState(0)
  const containerRef = useRef(null)
  const [containerW, setContainerW] = useState(0)
  // Driven imperatively (see snapTo below) instead of via the `animate` prop.
  // `animate={{x:...}}` only re-fires when its target value actually changes
  // between renders — so a swipe that didn't cross the page threshold (same
  // cardIdx before and after) never re-triggered it, leaving the rail
  // wherever the raw drag gesture let go instead of snapping back. That's
  // the "stuck in the middle" bug. useMotionValue + an explicit animate()
  // call on every drag end (not just index changes) guarantees the snap
  // always happens.
  const x = useMotionValue(0)

  // Measure the viewport width so we can set real pixel-based dragConstraints.
  // This gives true 1:1 finger tracking with dragElastic={0}.
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => setContainerW(e.contentRect.width))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  function snapTo(idx) {
    animate(x, -idx * containerW, { type: 'tween', duration: 0.32, ease: [0.25, 0.1, 0.25, 1] })
  }

  // Keep the rail in sync whenever the target page or the measured width
  // changes (mount, rotation, the post-unlock jump-to-first-card below, or a
  // dot tap) — same imperative path as the drag-end snap, so there's only
  // one place that ever moves `x`.
  useEffect(() => {
    if (!containerW) return
    snapTo(cardIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIdx, containerW])

  // The instant a user unlocks, jump back to the first card — that's now the
  // new percentile card (see `cards` below, it only exists when isPremium),
  // so this is what actually shows them the "you're unlocked" moment instead
  // of leaving them stranded wherever they happened to be swiped to.
  const prevIsPremium = useRef(isPremium)
  useEffect(() => {
    if (isPremium && !prevIsPremium.current) setCardIdx(0)
    prevIsPremium.current = isPremium
  }, [isPremium])

  const facePhoto = scan?.facePhotoUrl ?? null
  const cards = [
    ...(isPremium ? [{ id: 'percentile', el: <CardPercentile scan={scan} /> }] : []),
    { id: 'score', el: <Card1Score scan={scan} isPremium={isPremium} /> },
    ...EXTENDED_CATEGORIES.map(cat => ({
      id: cat.key,
      el: <CategoryCard scan={scan} categoryKey={cat.key} badge={cat.badge} icon={cat.icon} metrics={cat.metrics} isPremium={isPremium} facePhotoUrl={facePhoto} />,
    })),
    { id: 'face', el: <Card3FaceMetrics scan={scan} isPremium={isPremium} /> },
    { id: 'ai',   el: <Card6AIAnalysis scan={scan} isPremium={isPremium} /> },
    { id: 'progress', el: <CardProgress isPremium={isPremium} /> },
  ]

  function goTo(idx) {
    if (idx === cardIdx) return
    setCardIdx(idx)
  }

  function handleDragEnd(_, info) {
    const DISTANCE = 60
    const VELOCITY = 400
    let nextIdx = cardIdx
    if ((info.offset.x < -DISTANCE || info.velocity.x < -VELOCITY) && cardIdx < cards.length - 1) {
      nextIdx = cardIdx + 1
    } else if ((info.offset.x > DISTANCE || info.velocity.x > VELOCITY) && cardIdx > 0) {
      nextIdx = cardIdx - 1
    }
    if (nextIdx !== cardIdx) {
      goTo(nextIdx)
    } else {
      // Swipe didn't cross the page threshold — snap back to the current
      // card explicitly. Without this the rail was left stranded at
      // whatever raw pixel offset the finger released at.
      snapTo(cardIdx)
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

      {/* Sliding rail — all cards stay mounted (progress bars never reset).
          Pixel-based constraints + dragElastic=0 → true 1:1 finger tracking.
          Tween settle (no spring) → symmetric, predictable snap in both directions. */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 flex"
          style={{ width: containerW * cards.length, x }}
          drag="x"
          dragConstraints={{ left: -(cards.length - 1) * containerW, right: 0 }}
          dragElastic={0}
          onDragEnd={handleDragEnd}
        >
          {cards.map((card) => (
            <div key={card.id} className="h-full flex-shrink-0" style={{ width: containerW || '100vw' }}>
              {card.el}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Dot pagination */}
      <div className="flex items-center justify-center gap-1.5 py-3 flex-shrink-0">
        {cards.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === cardIdx ? 'rgba(198,168,92,1)' : 'rgba(255,255,255,0.25)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {/* Fixed CTA */}
      <div
        className="flex flex-col gap-2.5 px-6 flex-shrink-0"
        style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))', paddingTop: 8 }}
      >
        {isPremium ? (
          // Already unlocked — the whole point of this screen right now is
          // letting the user see every card go from locked to real, so the
          // only thing left to do is move on once they're ready. No more
          // purchase CTA, no more "have a promo code" (both would be dead UI
          // for someone who just unlocked seconds ago).
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); onContinue?.() }}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
            style={{ background: GRAD, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
          >
            <Sparkles size={16} style={{ color: '#0A0A0A' }} />
            Continue
          </motion.button>
        ) : (
          <>
            {(() => {
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
                        {isPurchasing ? 'Processing…' : 'Ready to Transform'}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>

                  {/* Promo code — web only, same as Premium.jsx/Results.jsx/
                      OnboardingFinalSteps.jsx (Apple's App Store guidelines
                      don't allow a native app to offer an alternative unlock
                      path that bypasses IAP). This screen was missing the
                      gate the other three already have. Directly under the
                      main button so it's never pushed off screen. */}
                  {!isNative() && (
                    <button
                      onClick={onPromo}
                      disabled={isPurchasing}
                      className="w-full py-2 font-body text-[13px] text-center active:opacity-60 disabled:opacity-30"
                      style={{ color: 'rgba(198,168,92,0.85)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                      Have a promo code?
                    </button>
                  )}

                  {error && (
                    <p className="text-center text-[11px] font-body" style={{ color: RED }}>{error}</p>
                  )}
                </>
              )
            })()}

            {cardIdx === cards.length - 1 && (
              <button
                onClick={onInvite}
                disabled={isPurchasing}
                className="w-full py-3.5 rounded-2xl font-heading font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: SURF, border: '1px solid rgba(255,255,255,0.1)', color: TEXT }}
              >
                <UserPlus size={14} /> Invite 3 Friends: Get Free Access
              </button>
            )}
          </>
        )}
      </div>
    </div>
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
  const shareText = `I'm using Ascendus to track my glow-up. It gives you an AI Glow Score and a custom plan. Try it free 👇 ${link}`

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
            <span className="font-bold">How it counts:</span> a friend registers with your link. Only real sign-ups count.
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

// ── Pro Paywall (full-screen modal, opens when "Get Ascendus Pro" is tapped) ──
function PaywallRatingsCard() {
  // Red→green bar color based on score percentage
  const barColor = pct => {
    const r = Math.round(255 * (1 - pct / 100))
    const g = Math.round(200 * (pct / 100))
    return `rgb(${Math.min(255, r + 40)},${g},30)`
  }
  const items = [
    { label: 'Overall',      pct: 61 },
    { label: 'Potential',    pct: 88 },
    { label: 'Jawline',      pct: 57 },
    { label: 'Symmetry',     pct: 63 },
    { label: 'Skin Quality', pct: 68 },
    { label: 'Cheekbones',   pct: 51 },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ label, pct }) => (
        <div key={label} className="rounded-2xl p-2.5" style={{ background: '#1a1a1a' }}>
          <p className="font-body text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
          <p className="font-heading font-bold text-[26px] leading-none mb-2.5" style={{ color: '#fff' }}>
            {pct}
          </p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor(pct) }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Physique ratings — parallel to face ratings but body metrics
function PaywallPhysiqueCard() {
  const barColor = pct => {
    const r = Math.round(255 * (1 - pct / 100))
    const g = Math.round(200 * (pct / 100))
    return `rgb(${Math.min(255, r + 40)},${g},30)`
  }
  const items = [
    { label: 'Overall',       pct: 66 },
    { label: 'Potential',     pct: 91 },
    { label: 'Muscle Mass',   pct: 58 },
    { label: 'Body Fat',      pct: 54 },
    { label: 'V-Taper',       pct: 62 },
    { label: 'Frame Width',   pct: 71 },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ label, pct }) => (
        <div key={label} className="rounded-2xl p-2.5" style={{ background: '#1a1a1a' }}>
          <p className="font-body text-[11px] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
          <p className="font-heading font-bold text-[26px] leading-none mb-2.5" style={{ color: '#fff' }}>{pct}</p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor(pct) }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Daily To-Do preview — checklist style matching the Daily Check-In screenshot
function PaywallDailyTodoCard() {
  const sections = [
    {
      icon: '💧', label: 'Hydration',
      items: ['Glass of water on wake', 'Hit 8 glasses today', 'Electrolytes after workout'],
      done: [true, false, false],
    },
    {
      icon: '✨', label: 'Skincare',
      items: ['AM Routine', 'PM Routine'],
      done: [false, false],
    },
    {
      icon: '💪', label: 'Exercise',
      items: ['Mark today\'s exercises complete'],
      done: [false],
    },
  ]
  return (
    <div className="flex flex-col gap-2">
      {sections.map(({ icon, label, items, done }) => (
        <div key={label} className="rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 14 }}>{icon}</span>
            <p className="font-heading font-bold text-[13px]" style={{ color: '#fff' }}>{label}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${done[i] ? G : 'rgba(255,255,255,0.25)'}`, background: done[i] ? G : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {done[i] && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <p className="font-body text-[11px]" style={{ color: done[i] ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)' }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// AI Coach chat preview card
function PaywallCoachCard() {
  return (
    <div className="flex flex-col gap-2">
      <div className="self-start max-w-[85%] px-3 py-2.5 rounded-2xl rounded-tl-sm" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <p className="font-body text-[12px] leading-snug" style={{ color: '#fff' }}>Your scan is loaded. Your #1 growth area is jawline definition.</p>
      </div>
      <div className="self-end max-w-[80%] px-3 py-2.5 rounded-2xl rounded-tr-sm" style={{ background: GRAD }}>
        <p className="font-heading font-semibold text-[12px]" style={{ color: '#0A0A0A' }}>How do I get a sharper jawline?</p>
      </div>
      <div className="self-start max-w-[85%] px-3 py-2.5 rounded-2xl rounded-tl-sm" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <p className="font-body text-[12px] leading-snug" style={{ color: '#fff' }}>Mew 24/7, chew mastic gum 20 min daily, drop body fat below 15%. Results in 3-6 months.</p>
      </div>
    </div>
  )
}

const PAYWALL_CARDS = [
  { title: 'Get your face ratings',    content: () => <PaywallRatingsCard /> },
  { title: 'Get your physique ratings', content: () => <PaywallPhysiqueCard /> },
  { title: 'AI Coach',                 content: () => <PaywallCoachCard /> },
  { title: 'Daily To-Do',              content: () => <PaywallDailyTodoCard /> },
]

function ProPaywall({ scan, onClose, onPurchase, isPurchasing }) {
  const [cardIdx, setCardIdx] = useState(0)
  const x = useMotionValue(0)
  const containerRef = useRef(null)
  const [containerW, setContainerW] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => setContainerW(e.contentRect.width))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!containerW) return
    animate(x, -cardIdx * containerW, { type: 'tween', duration: 0.32, ease: [0.25, 0.1, 0.25, 1] })
  }, [cardIdx, containerW])

  function handleDragEnd(_, info) {
    const D = 60, V = 400
    if ((info.offset.x < -D || info.velocity.x < -V) && cardIdx < PAYWALL_CARDS.length - 1) setCardIdx(c => c + 1)
    else if ((info.offset.x > D || info.velocity.x > V) && cardIdx > 0) setCardIdx(c => c - 1)
    else animate(x, -cardIdx * containerW, { type: 'tween', duration: 0.25, ease: [0.25, 0.1, 0.25, 1] })
  }

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      className="absolute inset-0 z-40 flex flex-col"
      style={{ background: '#0A0A0A' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: 4 }}>
        <button onClick={() => { triggerHaptic(); onClose() }} className="w-8 h-8 flex items-center justify-center" aria-label="Close">
          <X size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
        </button>
        <h1 className="font-heading font-bold text-[28px] leading-tight mt-2 mb-0.5" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
          Start Your Transformation
        </h1>
        <p className="font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Unlock your full potential
        </p>
      </div>

      {/* Swipeable feature cards — fixed height so all cards are equal, no excess space */}
      <div ref={containerRef} className="flex-shrink-0 relative overflow-hidden mx-4 my-2 rounded-3xl" style={{ background: '#141414', height: 280 }}>
        <motion.div
          className="flex"
          style={{ x, width: `${PAYWALL_CARDS.length * 100}%` }}
          drag="x"
          dragConstraints={{ left: -(PAYWALL_CARDS.length - 1) * containerW, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
        >
          {PAYWALL_CARDS.map((card, i) => (
            <div key={i} className="flex flex-col p-4 overflow-y-auto" style={{ width: containerW || '100%', flexShrink: 0, height: 280 }}>
              <h2 className="font-heading font-bold text-[18px] mb-3" style={{ color: '#fff', letterSpacing: '-0.01em' }}>
                {card.title}
              </h2>
              {card.content(scan)}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Dots — fixed size, just color change */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {PAYWALL_CARDS.map((_, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === cardIdx ? G : 'rgba(255,255,255,0.25)', transition: 'background 0.2s' }} />
        ))}
      </div>

      {/* CTA — sits directly under dots, no gap */}
      <div className="px-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))', paddingTop: 6 }}>
        <motion.button
          whileTap={{ scale: isPurchasing ? 1 : 0.97 }}
          onClick={() => { triggerHaptic(); onPurchase() }}
          disabled={isPurchasing}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[16px] flex items-center justify-center gap-2 mb-1.5 disabled:opacity-70"
          style={{ background: GRAD, color: '#0A0A0A', boxShadow: '0 4px 28px rgba(198,168,92,0.4)' }}
        >
          {isPurchasing ? <Loader2 size={17} className="animate-spin" /> : null}
          {isPurchasing ? 'Processing…' : 'Unlock Now'}
        </motion.button>
        <p className="text-center font-body text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          $4.99 for 1 week · then billed monthly
        </p>
        <div className="flex items-center justify-center gap-5">
          {['Terms of Use', 'Restore Purchase', 'Privacy Policy'].map(label => (
            <button key={label} className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Invite popup (simple code share, shown when "Invite 3 Friends" is tapped) ─
function InvitePopup({ referralCode, referralCount, onClose }) {
  const [copied, setCopied] = useState(false)
  const link = referralCode ? `https://ascendus.store/r/${referralCode}` : 'https://ascendus.store'
  const shareText = `I'm using Ascendus to track my glow-up. Try it free 👇 ${link}`
  const done = referralCount >= REQUIRED

  async function handleCopy() {
    try { await navigator.clipboard.writeText(referralCode ?? link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  async function handleShare() {
    try {
      if (navigator.share) await navigator.share({ title: 'Ascendus', text: shareText, url: link })
      else { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    } catch {}
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-t-3xl flex flex-col"
        style={{ background: '#141414', border: '1px solid rgba(198,168,92,0.2)', borderBottom: 0, paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
      >
        {/* Drag handle + close */}
        <div className="flex items-center justify-between px-6 pt-4 pb-1">
          <div className="w-10 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-3" style={{ background: 'rgba(255,255,255,0.12)' }} />
          <div />
          <button onClick={() => { triggerHaptic(); onClose() }} className="w-8 h-8 flex items-center justify-center ml-auto">
            <X size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        </div>

        <div className="px-6 pt-2 pb-4">
          <h2 className="font-heading font-bold text-[24px] mb-1" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
            Share your invite code
          </h2>
          <p className="font-body text-[13px] mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Invite {REQUIRED} friends to unlock results
          </p>

          {/* Code box — tap to copy */}
          <button
            onClick={() => { triggerHaptic(); handleCopy() }}
            className="w-full flex items-center gap-3 px-5 py-5 rounded-2xl mb-5 active:opacity-80"
            style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.3)' }}
          >
            <span className="font-heading font-bold text-[32px] flex-1 text-left tracking-[0.22em]" style={{ color: G }}>
              {referralCode ?? '—'}
            </span>
            <div
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-heading font-bold text-[13px] flex-shrink-0"
              style={{ background: copied ? 'rgba(52,199,89,0.15)' : 'rgba(198,168,92,0.18)', color: copied ? '#34C759' : G }}
            >
              {copied ? <><Check size={14} /> Copied</> : 'Copy'}
            </div>
          </button>

          {/* Friends progress */}
          <div className="flex items-center justify-between">
            <p className="font-body text-[14px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {referralCount}/{REQUIRED} friends joined{done ? ' — ready to unlock!' : ''}
            </p>
            {done && <Check size={16} style={{ color: '#34C759' }} />}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Locked reveal screen (shown to free users before purchase) ────────────────
function LockedRevealScreen({ scan, onAscend, onInvite, onClose, isPurchasing, error }) {
  const navigate = useNavigate()
  const facePhoto = scan?.facePhotoUrl ?? null
  const glowScore = scan?.glowScore ?? scan?.umaxScore ?? null
  const fd = scan?.faceData ?? {}
  const toBar = v => v != null ? Math.min(100, (v / 10) * 100) : 68

  // Fixed locked display values — these are shown blurred, so they
  // function as teaser numbers, not real scores.
  const metrics = [
    { label: 'Overall',      pct: 61 },
    { label: 'Potential',    pct: 88 },
    { label: 'Symmetry',     pct: 63 },
    { label: 'Skin Quality', pct: 68 },
    { label: 'Jawline',      pct: 57 },
    { label: 'Cheekbones',   pct: 51 },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0A0A0A' }}>
      <div className="flex flex-col items-center px-5 pb-10"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>

        {/* Close button */}
        <div className="w-full flex justify-end mb-3">
          <button onClick={() => { triggerHaptic(); navigate('/scan') }} className="w-8 h-8 flex items-center justify-center">
            <X size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        </div>

        {/* Header */}
        <h1 className="font-heading font-bold text-[26px] text-center leading-tight mb-1" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
          Reveal your ratings
        </h1>
        <p className="font-body text-[13px] text-center mb-5 leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Invite 3 friends or get Ascendus Max to view your results
        </p>

        {/* Face circle overlapping card — Umax layout */}
        <div className="relative w-full">
          {/* Circle sits above card, centered */}
          <div className="flex justify-center" style={{ marginBottom: -48, position: 'relative', zIndex: 2 }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', border: '3px solid #fff', background: '#111', overflow: 'hidden' }}>
              {facePhoto
                ? <img src={facePhoto} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.3)' }} />
                : null}
            </div>
          </div>

          {/* Metrics card — same dark as gender selection cards */}
          <div className="w-full rounded-3xl pt-16 pb-5 px-5" style={{ background: '#141414', position: 'relative', zIndex: 1 }}>
            <div className="grid grid-cols-2 gap-x-5" style={{ rowGap: 0 }}>
              {metrics.map(({ label, pct }, idx) => (
                <div key={label} style={{ paddingBottom: idx < 4 ? 20 : 0 }}>
                  {/* Label with individual lock icon */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Lock size={11} style={{ color: G, flexShrink: 0 }} />
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '-0.01em' }}>{label}</p>
                  </div>
                  {/* Bright white blurred number */}
                  <div style={{ width: 60, height: 22, borderRadius: 99, background: '#ffffff', filter: 'blur(8px)', marginBottom: 8, opacity: 0.9 }} />
                  {/* Gold bar — blurred content, unlock to see real values */}
                  <div style={{ height: 5, borderRadius: 99, background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTAs — more space, bigger buttons */}
        <div className="w-full mt-8 flex flex-col gap-3.5">
          <motion.button
            whileTap={{ scale: isPurchasing ? 1 : 0.97 }}
            onClick={() => { triggerHaptic(); onAscend() }}
            disabled={isPurchasing}
            className="w-full py-5 rounded-2xl font-heading font-bold text-[17px] flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: GRAD, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
          >
            {isPurchasing ? <Loader2 size={17} className="animate-spin" /> : null}
            {isPurchasing ? 'Processing…' : 'Get Ascendus Max'}
          </motion.button>

          <button
            onClick={() => { triggerHaptic(); onInvite() }}
            className="w-full py-5 rounded-2xl font-heading font-bold text-[17px]"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
          >
            Invite 3 Friends
          </button>
        </div>

        {error && <p className="text-center text-[11px] font-body mt-3" style={{ color: RED }}>{error}</p>}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ScanUnlockGate() {
  const navigate = useNavigate()
  const { currentScan, isPremium, setIsPremium, updateUser, setShowUnlockSlideshow } = useStore()

  const [showInvite, setShowInvite]         = useState(false)
  const [showPaywall, setShowPaywall]       = useState(false)
  const [showPromo, setShowPromo]           = useState(false)
  const [justUnlocked, setJustUnlocked]     = useState(false)
  const justUnlockedRef = useRef(false)
  const [referralCode, setReferralCode] = useState(null)
  const [referralCount, setReferralCount] = useState(0)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  // Synchronous re-entrancy lock — see PremiumOnboarding.jsx's handleAscend
  // for why isPurchasing alone can't prevent a true double-tap.
  const purchaseLockRef = useRef(false)

  useEffect(() => {
    if (isPremium && !justUnlockedRef.current) navigate('/results', { replace: true })
  }, [isPremium])

  useEffect(() => {
    if (!currentScan) navigate('/scan', { replace: true })
  }, [currentScan])

  useEffect(() => {
    if (!currentScan || isPremium) return
    api.referral.count()
      .then(({ count, code }) => { setReferralCount(count || 0); setReferralCode(code || null) })
      .catch(() => {})
  }, [])

  if (!currentScan) return null

  if (isPremium && !justUnlocked) return null

  function handleUnlockSuccess() {
    justUnlockedRef.current = true
    try { sessionStorage.setItem('asc_pro_splash_shown', '1') } catch {}
    try { sessionStorage.setItem('asc_reveal_shown', currentScan?.id ?? '') } catch {}
    setJustUnlocked(true)
    setShowUnlockSlideshow(true)
    setIsPremium(true)
    updateUser({ is_pro: true, subscriptionTier: 'premium', subscription_tier: 'premium' })
  }

  async function handleAscend() {
    if (purchaseLockRef.current) return
    purchaseLockRef.current = true

    setIsPurchasing(true)
    setPurchaseError('')
    try {
      if (isNative()) {
        const plan = 'monthly'
        const result = await purchasePro(plan)
        if (result?.success) {
          const rcUserId = result.customerInfo?.originalAppUserId
          api.payments.syncRc(rcUserId).catch(() => {})
          logAnalyticsEvent('purchase_completed', { plan, platform: 'native' })
          handleUnlockSuccess()
          setIsPurchasing(false)
          purchaseLockRef.current = false
          return
        }
        // Resolved without granting the entitlement — either the user
        // cancelled or something else went wrong without throwing. Reset so
        // the button never gets stuck spinning either way.
        if (result?.reason !== 'cancelled') {
          setPurchaseError('Unable to complete purchase. Please try again.')
        }
        setIsPurchasing(false)
        purchaseLockRef.current = false
        return
      }
      // Web: Stripe checkout — same flow as PaywallSheet's handleCheckout.
      const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
      const token  = stored?.state?.token
      if (!token || token === 'demo-token') { setIsPurchasing(false); purchaseLockRef.current = false; navigate('/auth'); return }
      const { url } = await api.payments.createCheckout('monthly')
      window.location.href = url
      // Leave isPurchasing=true — the page is about to navigate away.
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (!msg.includes('cancel')) {
        setPurchaseError(err?.message || 'Unable to complete purchase. Please try again.')
      }
      setIsPurchasing(false)
      purchaseLockRef.current = false
    }
  }

  return (
    <MotionPage
      baseClassName=""
      className="fixed inset-0 z-50 overflow-hidden dark"
      style={{ background: BG, '--text-secondary': 'rgba(255,255,255,0.5)' }}
    >
      {(isPremium || justUnlocked) ? (
        <SwipeableResultCards
          scan={currentScan}
          onAscend={handleAscend}
          onInvite={() => setShowInvite(true)}
          onPromo={() => setShowPromo(true)}
          isPurchasing={isPurchasing}
          error={purchaseError}
          isPremium={isPremium}
        />
      ) : (
        <LockedRevealScreen
          scan={currentScan}
          onAscend={() => { triggerHaptic(); setShowPaywall(true) }}
          onInvite={() => { triggerHaptic(); setShowInvite(true) }}
          isPurchasing={isPurchasing}
          error={purchaseError}
        />
      )}

      <AnimatePresence>
        {isPurchasing && <ProcessingOverlay key="purchasing" />}
      </AnimatePresence>

      <AnimatePresence>
        {showPaywall && !isPremium && (
          <ProPaywall
            scan={currentScan}
            onClose={() => setShowPaywall(false)}
            onPurchase={handleAscend}
            isPurchasing={isPurchasing}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPromo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30">
            <PromoModal onClose={() => setShowPromo(false)} onSuccess={() => {
              setShowPromo(false)
              handleUnlockSuccess()
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInvite && (
          <InvitePopup
            referralCode={referralCode}
            referralCount={referralCount}
            onClose={() => setShowInvite(false)}
          />
        )}
      </AnimatePresence>
    </MotionPage>
  )
}
