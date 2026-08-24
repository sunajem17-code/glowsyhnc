import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { checkTrialEligibility, isNative, purchasePro } from '../utils/iap'
import {
  UserPlus, Share2, Check, Loader2, Users, ChevronRight,
  Lock, Sparkles, Eye, Zap, BarChart2, Smile, Brain, Activity,
} from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import PromoModal from '../components/PromoModal'
import UnlockRevealSlideshow from '../components/UnlockRevealSlideshow'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, RED } from '../utils/theme'
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
    { label: 'PSL Tier',           value: tier ?? 'N/A',                                            unit: '',                                    pct: glowScore != null ? Math.min(100, (glowScore / 10) * 100) : 0 },
    { label: 'Potential',          value: potential ?? 'N/A',                                       unit: potential ? '/10' : '',                pct: potential != null ? Math.min(100, (parseFloat(potential) / 10) * 100) : 0 },
    { label: 'Symmetry',           value: symmetry != null ? symmetry.toFixed(1) : 'N/A',                   unit: symmetry != null ? '/10' : '',          pct: toScorePct(symmetry) },
    { label: 'Jawline',            value: jawlineDefinition != null ? jawlineDefinition.toFixed(1) : 'N/A', unit: jawlineDefinition != null ? '/10' : '', pct: toScorePct(jawlineDefinition) },
    { label: 'Skin Clarity',       value: skinClarity != null ? skinClarity.toFixed(1) : 'N/A',             unit: skinClarity != null ? '/10' : '',       pct: toScorePct(skinClarity) },
    { label: 'Facial Proportions', value: facialProportions != null ? facialProportions.toFixed(1) : 'N/A', unit: facialProportions != null ? '/10' : '', pct: toScorePct(facialProportions) },
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

        {/* Hero score */}
        <div className="mb-5">
          <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-2" style={{ color: 'rgba(198,168,92,0.65)' }}>
            GLOW SCORE
          </p>
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

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {lockedMetrics.map(({ label, value, unit, pct }) => (
            <div key={label} className="rounded-2xl p-3.5 flex flex-col" style={{ background: 'rgba(198,168,92,0.03)', border: '1px solid rgba(198,168,92,0.15)' }}>
              <span className="font-heading font-bold text-[17px] uppercase mb-2.5" style={{ color: G, letterSpacing: '-0.01em' }}>{label}</span>
              <div className="flex items-center justify-between mb-2">
                <MaybeBlur isPremium={isPremium} size="sm">
                  <div className="flex items-end gap-0.5">
                    <span className="font-heading font-bold text-[22px] leading-none" style={{ color: TEXT }}>{value}</span>
                    {unit && <span className="font-heading font-bold text-[11px] mb-0.5" style={{ color: DIM }}>{unit}</span>}
                  </div>
                </MaybeBlur>
                {!isPremium && (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'rgba(198,168,92,0.18)', flexShrink: 0 }}>
                    <Lock size={12} style={{ color: 'rgba(198,168,92,0.9)' }} />
                  </span>
                )}
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
        <div className="grid grid-cols-2 gap-3 mb-3">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl p-4 flex flex-col"
              style={{ background: 'rgba(198,168,92,0.04)', border: '1px solid rgba(198,168,92,0.12)' }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <Icon size={12} style={{ color: G }} />
                {!isPremium && (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'rgba(198,168,92,0.18)', flexShrink: 0 }}>
                    <Lock size={12} style={{ color: 'rgba(198,168,92,0.9)' }} />
                  </span>
                )}
              </div>
              <p
                className="font-heading font-bold text-[9px] tracking-[0.12em] mb-3"
                style={{ color: 'rgba(198,168,92,0.6)' }}
              >
                {label}
              </p>
              <MaybeBlur isPremium={isPremium}>
                <div className="flex items-end gap-0.5">
                  <span className="font-heading font-bold text-[24px] leading-none" style={{ color: TEXT }}>
                    {value.toFixed(1)}
                  </span>
                  <span className="font-heading font-bold text-[11px] mb-0.5" style={{ color: DIM }}>/10</span>
                </div>
              </MaybeBlur>
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
          <p className="font-body text-[10px] tracking-[0.14em] mb-0.5" style={{ color: 'rgba(139,92,246,0.7)' }}>UMAX SCORE</p>
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


function SwipeableResultCards({ scan, onAscend, onInvite, onPromo, onContinue, isPurchasing, error, trialEligibility = {}, isPremium = false }) {
  const [cardIdx, setCardIdx] = useState(0)
  const containerRef = useRef(null)
  const [containerW, setContainerW] = useState(0)

  // Measure the viewport width so we can set real pixel-based dragConstraints.
  // This gives true 1:1 finger tracking with dragElastic={0}.
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => setContainerW(e.contentRect.width))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

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

      {/* Sliding rail — all cards stay mounted (progress bars never reset).
          Pixel-based constraints + dragElastic=0 → true 1:1 finger tracking.
          Tween settle (no spring) → symmetric, predictable snap in both directions. */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 flex"
          style={{ width: containerW * cards.length }}
          animate={{ x: -cardIdx * containerW }}
          transition={{ type: 'tween', duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
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
                    <p className="text-center text-[11px] font-body" style={{ color: RED }}>{error}</p>
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
                <UserPlus size={14} /> Invite 3 Friends: Get Free Access
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

// ── Main export ───────────────────────────────────────────────────────────────

export default function ScanUnlockGate() {
  const navigate = useNavigate()
  const { currentScan, isPremium, setIsPremium, updateUser } = useStore()

  const [showInvite, setShowInvite]         = useState(false)
  const [showPromo, setShowPromo]           = useState(false)
  const [showSlideshow, setShowSlideshow]   = useState(false)
  const [justUnlocked, setJustUnlocked]     = useState(false)
  const [referralCode, setReferralCode] = useState(null)
  const [referralCount, setReferralCount] = useState(0)
  const [trialEligibility, setTrialEligibility] = useState({ monthly: 'unknown', yearly: 'unknown' })
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')

  useEffect(() => {
    if (isPremium && !justUnlocked && !showSlideshow) navigate('/results', { replace: true })
  }, [isPremium, showSlideshow]) // justUnlocked intentionally omitted — set simultaneously

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

  if (!currentScan) return null

  // showSlideshow must be checked before the isPremium gate: PromoModal sets
  // isPremium=true inside itself before onSuccess fires, so without this
  // ordering the null-return fires and the slideshow never renders.
  if (showSlideshow) {
    return (
      <UnlockRevealSlideshow
        scan={currentScan}
        onFinish={() => navigate('/results', { replace: true })}
      />
    )
  }

  if (isPremium && !justUnlocked) return null

  // Shared handler — called by both the native purchase path and the promo
  // path so both transitions are identical going forward.
  //
  // This used to call setShowSlideshow(true) synchronously in the same batch
  // as setIsPremium(true) — since React batches both updates together, the
  // very next render hit the `if (showSlideshow) return <UnlockRevealSlideshow/>`
  // check below before SwipeableResultCards ever got a chance to re-render
  // with isPremium=true. The result: the user never actually SAW the locked/
  // blurred carousel switch to its unlocked state — purchasing or redeeming a
  // promo code hard-cut straight to a completely different slideshow screen
  // instead. Now this just flips isPremium/justUnlocked and stays on this
  // same screen, so SwipeableResultCards re-renders with every card unlocked
  // in place (including the percentile card, which only exists in the `cards`
  // array when isPremium is true). The slideshow now only plays once the user
  // taps "Continue" after actually seeing their unlocked results — see
  // handleContinueAfterUnlock() below and SwipeableResultCards' onContinue.
  function handleUnlockSuccess() {
    setJustUnlocked(true)
    setIsPremium(true)
    updateUser({ is_pro: true, subscriptionTier: 'premium', subscription_tier: 'premium' })
    // Set this key BEFORE React commits the batch — App.jsx reads it in the same
    // render and skips GATE 2 (PremiumSplash), which would otherwise unmount
    // this screen before the user gets to see the unlocked carousel.
    try { sessionStorage.setItem('asc_pro_splash_shown', '1') } catch {}
    try { sessionStorage.setItem('asc_reveal_shown', currentScan?.id ?? '') } catch {}
  }

  // Fires when the user taps "Continue" on the now-unlocked carousel — this
  // is when the celebration slideshow actually plays, followed by /results.
  function handleContinueAfterUnlock() {
    setShowSlideshow(true)
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
          logAnalyticsEvent('purchase_completed', { plan, platform: 'native' })
          handleUnlockSuccess()
          setIsPurchasing(false)
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
        onContinue={handleContinueAfterUnlock}
        isPurchasing={isPurchasing}
        error={purchaseError}
        trialEligibility={trialEligibility}
        isPremium={isPremium}
      />

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
