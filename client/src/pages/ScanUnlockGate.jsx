import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Share2, Check, Loader2, Users, ChevronRight,
  Lock, Sparkles, Star, Eye, Zap, BarChart2, Smile, Dumbbell, Brain,
  TrendingUp, Activity,
} from 'lucide-react'
import useStore from '../store/useStore'
import { purchasePro, isNative } from '../utils/iap'
import { api } from '../utils/api'
import PromoModal from '../components/PromoModal'
import logo from '../assets/ascendus-icon.png'

const G    = '#C6A85C'
const GRAD = 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 50%, #A8893A 100%)'
const BG   = '#080808'
const TEXT = '#F0EDE8'
const DIM  = 'rgba(255,255,255,0.38)'
const SURF = 'rgba(255,255,255,0.04)'

// ── Helpers (copied from OnboardingFinalSteps) ────────────────────────────────

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

const CELEB_QUICK = {
  strong:  [{ name: 'Henry Cavill', sim: 79 }, { name: 'Chris Hemsworth', sim: 76 }, { name: 'Jacob Elordi', sim: 75 }, { name: 'Cristiano Ronaldo', sim: 73 }],
  defined: [{ name: 'Zac Efron',    sim: 73 }, { name: 'Austin Butler',   sim: 71 }, { name: 'Tom Holland',  sim: 68 }, { name: 'Timothée Chalamet', sim: 70 }],
  average: [{ name: 'Pedro Pascal', sim: 67 }, { name: 'Ryan Reynolds',   sim: 65 }, { name: 'Paul Mescal',  sim: 66 }, { name: 'Andrew Garfield',  sim: 64 }],
  soft:    [{ name: 'Harry Styles', sim: 64 }, { name: 'Justin Bieber',   sim: 62 }, { name: 'Niall Horan',  sim: 61 }, { name: 'Jack Harlow',      sim: 63 }],
}

function getCelebMatch(scan) {
  if (!scan) return null
  const jaw  = scan.faceData?.jawlineDefinition ?? 5
  const harm = scan.faceData?.facialHarmony     ?? 5
  const avg  = (jaw + harm) / 2
  const key  = avg >= 7 ? 'strong' : avg >= 6 ? 'defined' : avg >= 4.5 ? 'average' : 'soft'
  const pool = CELEB_QUICK[key]
  const seed = (scan.id ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return pool[Math.abs(seed) % pool.length]
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

// ── Card shell ────────────────────────────────────────────────────────────────

function CardShell({ badge, icon: Icon, children }) {
  return (
    <div className="h-full flex flex-col pt-5 pb-2 px-6 overflow-y-auto">
      {/* Centered logo — visible inside card content, below safe area */}
      <div className="flex items-center justify-center gap-2 mb-5 flex-shrink-0">
        <img src={logo} alt="" style={{ width: 18, height: 18, mixBlendMode: 'lighten', opacity: 0.65 }} />
        <span className="font-heading font-bold text-[9px] tracking-[0.24em]" style={{ color: 'rgba(198,168,92,0.45)' }}>
          ASCENDUS
        </span>
      </div>
      {/* Badge row */}
      <div className="flex items-center gap-2.5 mb-6 flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.22)' }}
        >
          <Icon size={16} style={{ color: G }} />
        </div>
        <span
          className="font-heading font-bold text-[10px] tracking-[0.22em]"
          style={{ color: 'rgba(198,168,92,0.75)' }}
        >
          {badge}
        </span>
      </div>
      {/* Content — vertically centered in remaining space */}
      <div className="flex-1 flex flex-col justify-center">
        {children}
      </div>
    </div>
  )
}

function BlurLock({ children, size = 'md', style: extraStyle = {} }) {
  const blur = size === 'lg' ? 'blur(10px)' : size === 'sm' ? 'blur(4px)' : 'blur(7px)'
  return (
    <span style={{ filter: blur, userSelect: 'none', ...extraStyle }}>
      {children}
    </span>
  )
}

// ── Card 1: Original StepScoresWaiting layout ────────────────────────────────

function Card1Score({ scan }) {
  const glowScore = scan?.glowScore ?? scan?.umaxScore ?? null
  const tier      = scan?.tier ?? null
  const topPct    = toTopPct(glowScore)
  const growthArea = getBiggestGrowthArea(scan)
  const celebMatch = getCelebMatch(scan)

  const physiqueUpside = scan?.physiqueScore
    ? Math.max(0, (7.5 - (scan.physiqueScore.overall ?? 5)) * 0.09)
    : 0
  const potential = glowScore != null
    ? Math.min(10, glowScore + 1.4 + physiqueUpside).toFixed(1)
    : null

  const lockedMetrics = [
    { icon: Eye,  label: 'PSL Tier',  value: tier ?? '—',       unit: '' },
    { icon: Zap,  label: 'Potential', value: potential ?? '—',  unit: potential ? '/10' : '' },
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
          <div className="flex items-end gap-1.5 mb-3">
            <span className="font-heading font-bold leading-none" style={{ fontSize: 72, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {glowScore != null ? glowScore.toFixed(1) : '—'}
            </span>
            <span className="font-heading font-bold text-[22px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>/10</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {tier && (
              <div className="inline-flex items-center px-3 py-1.5 rounded-xl" style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.30)' }}>
                <span className="font-heading font-bold text-[11px] tracking-[0.14em]" style={{ color: G }}>{tier.toUpperCase()}</span>
              </div>
            )}
            {topPct && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <BarChart2 size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <span className="font-heading font-bold text-[11px] tracking-[0.10em]" style={{ color: 'rgba(255,255,255,0.75)' }}>{topPct}</span>
              </div>
            )}
          </div>
        </div>

        {/* Biggest growth area teaser */}
        {growthArea && (
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Lock size={13} style={{ color: G, marginTop: 2, flexShrink: 0 }} />
            <div className="min-w-0">
              <p className="font-body text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Biggest growth area</p>
              <p className="font-heading font-bold text-[13px] mb-1" style={{ color: TEXT }}>{growthArea.label}</p>
              <p className="font-body text-[12px] leading-snug select-none" style={{ color: 'rgba(255,255,255,0.55)', filter: 'blur(5px)', userSelect: 'none' }}>
                {growthArea.detail}
              </p>
            </div>
          </div>
        )}

        {/* Celebrity match teaser */}
        {celebMatch && (
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.22)' }}>
              <span style={{ fontSize: 17 }}>⭐</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Celebrity match · {celebMatch.sim}% similarity</p>
              <p className="font-heading font-bold text-[15px] select-none" style={{ color: 'rgba(255,255,255,0.90)', filter: 'blur(6px)', userSelect: 'none' }}>
                {celebMatch.name}
              </p>
            </div>
            <Lock size={13} style={{ color: G, flexShrink: 0 }} />
          </div>
        )}

        {/* Locked metric cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {lockedMetrics.map(({ icon: Icon, label, value, unit }, i) => (
            <div key={label} className="rounded-2xl p-3 flex flex-col" style={{ background: 'rgba(198,168,92,0.04)', border: '1px solid rgba(198,168,92,0.12)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <Icon size={12} style={{ color: G }} />
                <Lock size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <span className="font-heading text-[9px] tracking-wide font-bold mb-1.5" style={{ color: 'rgba(198,168,92,0.6)' }}>{label}</span>
              <div className="flex items-end gap-0.5">
                <span className="font-heading font-bold text-[22px] leading-none select-none" style={{ color: TEXT, filter: 'blur(7px)', userSelect: 'none' }}>{value}</span>
                {unit && <span className="font-heading font-bold text-[11px] mb-0.5 select-none" style={{ color: DIM, filter: 'blur(5px)' }}>{unit}</span>}
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

// ── Card 2: Biggest Growth Area ───────────────────────────────────────────────

function Card2Growth({ scan }) {
  const area = getBiggestGrowthArea(scan)
  if (!area) return (
    <CardShell badge="GROWTH AREA" icon={TrendingUp}>
      <p className="font-body text-[13px]" style={{ color: DIM }}>Not enough data to determine growth area.</p>
    </CardShell>
  )

  return (
    <CardShell badge="BIGGEST GROWTH AREA" icon={TrendingUp}>
      <p
        className="font-heading font-bold text-[26px] leading-tight mb-5"
        style={{ color: TEXT, letterSpacing: '-0.01em' }}
      >
        {area.label}
      </p>

      {/* Score card */}
      <div
        className="flex items-center justify-between rounded-2xl px-4 py-4 mb-4"
        style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.14)' }}
      >
        <div>
          <p className="font-body text-[10px] mb-1" style={{ color: 'rgba(198,168,92,0.6)', letterSpacing: '0.1em' }}>
            CURRENT SCORE
          </p>
          <div className="flex items-end gap-1">
            <BlurLock size="lg">
              <span className="font-heading font-bold text-[34px] leading-none" style={{ color: TEXT }}>
                {area.score.toFixed(1)}
              </span>
            </BlurLock>
            <span className="font-heading font-bold text-[16px] mb-1" style={{ color: DIM }}>/10</span>
          </div>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.18)' }}
        >
          <Lock size={16} style={{ color: G }} />
        </div>
      </div>

      {/* Detail blurred */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Lock size={11} style={{ color: G }} />
          <p className="font-body text-[10px]" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>AI ANALYSIS</p>
        </div>
        <BlurLock size="sm">
          <p className="font-body text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {area.detail}
          </p>
        </BlurLock>
      </div>
    </CardShell>
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
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl p-3.5 flex flex-col"
              style={{ background: 'rgba(198,168,92,0.04)', border: '1px solid rgba(198,168,92,0.12)' }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <Icon size={12} style={{ color: G }} />
                <Lock size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <p
                className="font-heading font-bold text-[9px] tracking-[0.12em] mb-2"
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
        <div className="flex flex-col gap-2">
          {extras.map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl px-3.5 py-3"
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

// ── Card 4: Celebrity Match ───────────────────────────────────────────────────

function Card4Celebrity({ scan }) {
  // Prefer Rekognition data (array of { Name, MatchConfidence }) if present
  const rcMatches = (scan?.celebrityMatches ?? [])
    .filter(m => m?.Name && m?.MatchConfidence > 0)
    .slice(0, 3)
    .map(m => ({ name: m.Name, sim: Math.round(m.MatchConfidence) }))

  const fallback = getCelebMatch(scan)
  const matches  = rcMatches.length > 0 ? rcMatches : (fallback ? [fallback] : [])

  if (!matches.length) return (
    <CardShell badge="CELEBRITY MATCH" icon={Star}>
      <p className="font-body text-[13px]" style={{ color: DIM }}>Celebrity matching requires a clear face scan.</p>
    </CardShell>
  )

  return (
    <CardShell badge="CELEBRITY MATCH" icon={Star}>
      <p className="font-heading font-bold text-[13px] mb-5" style={{ color: DIM }}>
        Your face most resembles…
      </p>

      <div className="flex flex-col gap-3">
        {matches.map((match, i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
            style={{
              background: i === 0 ? 'rgba(198,168,92,0.06)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${i === 0 ? 'rgba(198,168,92,0.20)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: 44, height: 44,
                background: 'rgba(198,168,92,0.10)',
                border: `1px solid ${i === 0 ? 'rgba(198,168,92,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <span style={{ fontSize: 20 }}>{i === 0 ? '⭐' : '🌟'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[10px] mb-1" style={{ color: DIM }}>
                {match.sim}% facial similarity
              </p>
              <BlurLock>
                <p className="font-heading font-bold text-[17px]" style={{ color: TEXT }}>
                  {match.name}
                </p>
              </BlurLock>
            </div>
            <Lock size={13} style={{ color: G, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(198,168,92,0.05)', border: '1px solid rgba(198,168,92,0.12)' }}>
        <p className="font-body text-[11px] text-center" style={{ color: 'rgba(198,168,92,0.6)' }}>
          Unlock to see full celebrity analysis
        </p>
      </div>
    </CardShell>
  )
}

// ── Card 5: PSL Tier + Potential ──────────────────────────────────────────────

function Card5Potential({ scan }) {
  const glowScore = scan?.glowScore ?? scan?.umaxScore ?? null
  const tier      = scan?.tier ?? null

  const physiqueUpside = scan?.physiqueScore
    ? Math.max(0, (7.5 - (scan.physiqueScore.overall ?? 5)) * 0.09)
    : 0
  const potential = glowScore != null
    ? Math.min(10, glowScore + 1.4 + physiqueUpside).toFixed(1)
    : null

  const pslNumber = scan?.aiScore?.pslScore ?? scan?.aiScore?.pslRating
    ?? (glowScore != null ? (glowScore * 1.0).toFixed(1) : null)

  return (
    <CardShell badge="PSL TIER & POTENTIAL" icon={Zap}>
      <div className="flex flex-col gap-4">
        {/* PSL Tier */}
        <div
          className="rounded-2xl px-5 py-5 flex flex-col"
          style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.18)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="font-heading font-bold text-[10px] tracking-[0.2em]" style={{ color: 'rgba(198,168,92,0.7)' }}>
              PSL TIER
            </p>
            <Lock size={13} style={{ color: G }} />
          </div>
          <BlurLock size="lg">
            <div className="flex items-end gap-1.5">
              <span className="font-heading font-bold leading-none" style={{ fontSize: 56, color: TEXT, letterSpacing: '-0.03em' }}>
                {pslNumber ?? tier ?? '—'}
              </span>
              {pslNumber && <span className="font-heading font-bold text-[20px] mb-2" style={{ color: DIM }}>/10</span>}
            </div>
          </BlurLock>
          <p className="font-body text-[11px] mt-2" style={{ color: DIM }}>
            Rated against global male attractiveness benchmarks
          </p>
        </div>

        {/* Potential */}
        <div
          className="rounded-2xl px-5 py-5 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="font-heading font-bold text-[10px] tracking-[0.2em]" style={{ color: DIM }}>
              YOUR POTENTIAL
            </p>
            <Lock size={13} style={{ color: G }} />
          </div>
          <BlurLock size="lg">
            <div className="flex items-end gap-1.5">
              <span className="font-heading font-bold leading-none" style={{ fontSize: 56, color: TEXT, letterSpacing: '-0.03em' }}>
                {potential ?? '—'}
              </span>
              {potential && <span className="font-heading font-bold text-[20px] mb-2" style={{ color: DIM }}>/10</span>}
            </div>
          </BlurLock>
          <p className="font-body text-[11px] mt-2" style={{ color: DIM }}>
            Achievable score after completing your 12-week plan
          </p>
        </div>
      </div>
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

// ── Card 7: Physique (conditional) ────────────────────────────────────────────

function Card7Physique({ scan }) {
  const phy = scan?.physiqueScore ?? {}

  const metrics = [
    { label: 'OVERALL',      value: phy.overall      ?? null },
    { label: 'MUSCLE TONE',  value: phy.muscleTone   ?? phy.muscle    ?? null },
    { label: 'BODY FAT',     value: phy.bodyFat      ?? scan?.bodyFatLevel ?? null },
    { label: 'FRAME',        value: phy.frame        ?? phy.structure ?? null },
  ].filter(m => m.value != null)

  return (
    <CardShell badge="PHYSIQUE SCORE" icon={Dumbbell}>
      {phy.overall != null && (
        <div
          className="rounded-2xl px-5 py-5 mb-4 flex items-center justify-between"
          style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.18)' }}
        >
          <div>
            <p className="font-heading font-bold text-[10px] tracking-[0.18em] mb-2" style={{ color: 'rgba(198,168,92,0.7)' }}>
              PHYSIQUE OVERALL
            </p>
            <BlurLock size="lg">
              <div className="flex items-end gap-1">
                <span className="font-heading font-bold leading-none" style={{ fontSize: 52, color: TEXT, letterSpacing: '-0.03em' }}>
                  {phy.overall.toFixed(1)}
                </span>
                <span className="font-heading font-bold text-[18px] mb-1.5" style={{ color: DIM }}>/10</span>
              </div>
            </BlurLock>
          </div>
          <Lock size={18} style={{ color: G }} />
        </div>
      )}

      {metrics.filter(m => m.label !== 'OVERALL').length > 0 && (
        <div className="flex flex-col gap-2">
          {metrics.filter(m => m.label !== 'OVERALL').map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="font-body text-[11px] tracking-wide" style={{ color: DIM }}>{label}</p>
              <div className="flex items-center gap-1.5">
                <BlurLock size="sm">
                  <span className="font-heading font-bold text-[14px]" style={{ color: TEXT }}>
                    {typeof value === 'number' ? value.toFixed(1) : value}
                  </span>
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

// ── Plan Picker Sheet ─────────────────────────────────────────────────────────
// Shown when user taps "Unlock Full Results" on native iOS.
// purchasePro() is only reachable after the user explicitly taps a plan pill —
// selectedPlan starts null and the CTA stays disabled until it's set.

const PLANS = [
  { key: 'monthly', label: 'Monthly',  price: '$1.84', per: '/wk', sub: '$7.99 billed monthly',  badge: null },
  { key: 'annual',  label: 'Annual',   price: '$0.96', per: '/wk', sub: '$49.99 billed yearly',  badge: 'SAVE 48%' },
]

function PlanPickerSheet({ isPurchasing, onSelect, onClose }) {
  const [selectedPlan, setSelectedPlan] = useState(null)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-end"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isPurchasing) onClose() }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        className="w-full rounded-t-3xl flex flex-col"
        style={{ background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div className="px-5 pt-3" style={{ paddingBottom: 'max(36px, calc(env(safe-area-inset-bottom, 0px) + 20px))' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-heading font-bold text-[18px] text-white">Choose Your Plan</p>
              <p className="font-body text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                Select a plan to unlock your full results
              </p>
            </div>
            {!isPurchasing && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <X size={15} className="text-white" />
              </button>
            )}
          </div>

          {/* Plan pills */}
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {PLANS.map(({ key, label, price, per, sub, badge }) => (
              <button
                key={key}
                onClick={() => !isPurchasing && setSelectedPlan(key)}
                className="py-4 px-3 rounded-2xl text-center relative flex flex-col items-center transition-all"
                style={{
                  background: selectedPlan === key ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${selectedPlan === key ? 'rgba(198,168,92,0.5)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {badge && (
                  <div
                    className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-heading font-bold"
                    style={{ background: G, color: '#000' }}
                  >
                    {badge}
                  </div>
                )}
                <p className="font-heading font-bold text-[11px] mb-1"
                  style={{ color: selectedPlan === key ? G : 'rgba(255,255,255,0.35)' }}>
                  {label}
                </p>
                <p className="font-heading font-bold text-[22px] leading-none"
                  style={{ color: selectedPlan === key ? TEXT : 'rgba(255,255,255,0.55)' }}>
                  {price}<span className="text-[12px] font-normal">{per}</span>
                </p>
                <p className="font-body text-[10px] mt-1"
                  style={{ color: 'rgba(255,255,255,0.30)' }}>
                  {sub}
                </p>
              </button>
            ))}
          </div>

          {/* CTA — disabled until plan explicitly selected */}
          <motion.button
            whileTap={{ scale: (!selectedPlan || isPurchasing) ? 1 : 0.97 }}
            onClick={() => selectedPlan && !isPurchasing && onSelect(selectedPlan)}
            disabled={!selectedPlan || isPurchasing}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
            style={{
              background: selectedPlan ? GRAD : 'rgba(255,255,255,0.08)',
              color: selectedPlan ? '#0A0A0A' : 'rgba(255,255,255,0.25)',
              boxShadow: selectedPlan ? '0 4px 24px rgba(198,168,92,0.35)' : 'none',
              transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
            }}
          >
            {isPurchasing
              ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
              : <><Sparkles size={16} style={{ color: selectedPlan ? '#0A0A0A' : 'rgba(255,255,255,0.25)' }} />
                  {selectedPlan ? `Get Ascendus Pro — ${selectedPlan === 'annual' ? '$49.99/yr' : '$7.99/mo'}` : 'Select a plan above'}
                </>
            }
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Swipeable Result Cards ────────────────────────────────────────────────────

const SLIDE_VARIANTS = {
  enter: (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (d) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
}

function SwipeableResultCards({ scan, onAscend, onInvite, isPurchasing }) {
  const [cardIdx, setCardIdx]   = useState(0)
  const [direction, setDirection] = useState(1)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  // Build card list — card 7 only if physique data present
  const cards = [
    { id: 'score',     el: <Card1Score scan={scan} /> },
    { id: 'growth',    el: <Card2Growth scan={scan} /> },
    { id: 'face',      el: <Card3FaceMetrics scan={scan} /> },
    { id: 'celebrity', el: <Card4Celebrity scan={scan} /> },
    { id: 'potential', el: <Card5Potential scan={scan} /> },
    { id: 'ai',        el: <Card6AIAnalysis scan={scan} /> },
    ...(scan?.physiqueScore ? [{ id: 'physique', el: <Card7Physique scan={scan} /> }] : []),
  ]

  function goTo(idx) {
    if (idx === cardIdx) return
    setDirection(idx > cardIdx ? 1 : -1)
    setCardIdx(idx)
  }

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    // Only handle horizontal swipes (dx dominant)
    if (Math.abs(dx) > 48 && Math.abs(dx) > dy * 1.5) {
      if (dx > 0 && cardIdx < cards.length - 1) goTo(cardIdx + 1)
      else if (dx < 0 && cardIdx > 0) goTo(cardIdx - 1)
    }
    touchStartX.current = null
    touchStartY.current = null
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
      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
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
          >
            {cards[cardIdx].el}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot pagination */}
      <div className="flex items-center justify-center gap-2 py-3 flex-shrink-0">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <motion.div
              animate={{ width: i === cardIdx ? 22 : 6, background: i === cardIdx ? G : 'rgba(255,255,255,0.18)' }}
              transition={{ duration: 0.2 }}
              style={{ height: 6, borderRadius: 3 }}
            />
          </button>
        ))}
      </div>

      {/* Fixed CTA */}
      <div
        className="flex flex-col gap-2.5 px-6 flex-shrink-0"
        style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))', paddingTop: 8 }}
      >
        <motion.button
          whileTap={{ scale: isPurchasing ? 1 : 0.97 }}
          onClick={onAscend}
          disabled={isPurchasing}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: GRAD, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
        >
          {isPurchasing
            ? <Loader2 size={16} className="animate-spin" />
            : <Sparkles size={16} style={{ color: '#0A0A0A' }} />
          }
          {isPurchasing ? 'Processing…' : 'Unlock Full Results'}
        </motion.button>

        <button
          onClick={onInvite}
          disabled={isPurchasing}
          className="w-full py-3.5 rounded-2xl font-heading font-semibold text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: SURF, border: '1px solid rgba(255,255,255,0.1)', color: TEXT }}
        >
          <UserPlus size={14} /> Invite 3 Friends — Get Free Access
        </button>
      </div>
    </div>
  )
}

// ── Unlock Reveal Animation ───────────────────────────────────────────────────

function UnlockReveal({ score, onContinue }) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1400)
    return () => clearTimeout(t)
  }, [])

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
      <motion.div
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: revealed ? 3.5 : 0.2, opacity: revealed ? 0 : 0.9 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', border: `2px solid ${G}`, pointerEvents: 'none' }}
      />
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
          animate={revealed ? { x: Math.cos((p.angle * Math.PI) / 180) * p.radius, y: Math.sin((p.angle * Math.PI) / 180) * p.radius, opacity: 0, scale: 0 } : {}}
          transition={{ duration: 0.85, delay: p.delay, ease: 'easeOut' }}
          style={{ position: 'absolute', width: p.size, height: p.size, borderRadius: '50%', background: G, pointerEvents: 'none' }}
        />
      ))}
      <motion.div
        animate={{ opacity: revealed ? 0.25 : 0 }}
        transition={{ duration: 1.0, delay: 0.4 }}
        style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(198,168,92,0.5) 0%, transparent 65%)', filter: 'blur(20px)', pointerEvents: 'none' }}
      />
      <div className="relative z-10 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-heading font-bold text-[11px] tracking-[0.22em] mb-6"
          style={{ color: 'rgba(198,168,92,0.65)' }}
        >
          YOUR ASCENDUS SCORE
        </motion.p>
        <motion.div
          initial={{ filter: 'blur(28px)', scale: 0.8, opacity: 0 }}
          animate={{ filter: revealed ? 'blur(0px)' : 'blur(28px)', scale: revealed ? 1 : 0.8, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
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
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
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
  const shareText = `I'm using Ascendus to track my glow-up — it gives you an AI Glow Score, custom plan & celebrity lookalike matches. Try it free 👇 ${link}`

  async function pollCount() {
    try { const { count: fresh } = await api.referral.count(); setCount(fresh ?? 0); return fresh ?? 0 }
    catch { return count }
  }

  async function handleShare() {
    setSharing(true)
    try {
      if (navigator.share) await navigator.share({ title: 'Ascendus', text: shareText, url: link })
      else await navigator.clipboard?.writeText(shareText)
      setShareCount(n => n + 1)
      setTimeout(async () => { const fresh = await pollCount(); if (fresh >= REQUIRED) handleUnlock(fresh) }, 1500)
    } catch { /* cancelled */ } finally { setSharing(false) }
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
      className="absolute inset-x-0 bottom-0 rounded-t-3xl z-10 flex flex-col"
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

  const [showInvite, setShowInvite]         = useState(false)
  const [showPromo, setShowPromo]           = useState(false)
  const [showReveal, setShowReveal]         = useState(false)
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const [referralCode, setReferralCode]     = useState(null)
  const [referralCount, setReferralCount]   = useState(0)
  const [isPurchasing, setIsPurchasing]     = useState(false)

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
  }, [])

  if (isPremium || !currentScan) return null

  const revealScore = currentScan?.glowScore ?? currentScan?.umaxScore ?? 7.0

  if (showReveal) {
    return <UnlockReveal score={revealScore} onContinue={() => navigate('/results', { replace: true })} />
  }

  // Opens plan picker on native; goes straight to /premium on web
  function handleAscend() {
    if (isNative()) {
      setShowPlanPicker(true)
    } else {
      navigate('/premium')
    }
  }

  // Called only after user has explicitly tapped a plan pill in the sheet
  async function handlePurchase(plan) {
    if (isPurchasing || !plan) return
    setIsPurchasing(true)
    try {
      const result = await purchasePro(plan)
      if (result?.success) {
        const rcUserId = result.customerInfo?.originalAppUserId
        api.payments.syncRc(rcUserId).catch(() => {})
        sessionStorage.setItem('asc_pro_splash_shown', '1')
        setIsPremium(true)
        setShowPlanPicker(false)
        setShowReveal(true)
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      setShowPlanPicker(false)
      if (!msg.includes('cancel')) navigate('/premium')
    } finally {
      setIsPurchasing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: BG }}>
      <SwipeableResultCards
        scan={currentScan}
        onAscend={handleAscend}
        onInvite={() => setShowInvite(true)}
        isPurchasing={isPurchasing}
      />

      {/* Promo code link */}
      <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: 'max(8px, env(safe-area-inset-bottom, 8px))', zIndex: 10 }}>
        <button
          onClick={() => setShowPromo(true)}
          className="font-body text-[11px] text-center transition-opacity hover:opacity-70 px-4 py-1.5"
          style={{ color: 'rgba(198,168,92,0.35)' }}
        >
          Have a promo code?
        </button>
      </div>

      {/* Plan picker sheet — only fires purchasePro after explicit plan tap */}
      <AnimatePresence>
        {showPlanPicker && (
          <PlanPickerSheet
            isPurchasing={isPurchasing}
            onSelect={handlePurchase}
            onClose={() => setShowPlanPicker(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPromo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30">
            <PromoModal onClose={() => setShowPromo(false)} onSuccess={() => { setShowPromo(false); setShowReveal(true) }} />
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
    </div>
  )
}
