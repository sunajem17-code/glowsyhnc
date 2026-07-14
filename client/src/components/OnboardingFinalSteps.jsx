import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Sparkles, UserPlus, Check, Loader2, ChevronRight, Zap, Trophy, Eye, BarChart2, Lock } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { InAppReview } from '@capacitor-community/in-app-review'
import useStore from '../store/useStore'
import { purchasePro, isNative } from '../utils/iap'
import { api } from '../utils/api'
import logo from '../assets/ascendus-icon.png'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'

const G = GOLD
const GOLD_GRAD = GOLD_GRADIENT
const BG = '#080808'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.38)'
const SURFACE = 'rgba(255,255,255,0.04)'

async function openAppStoreReview() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await InAppReview.requestReview()
  } catch { /* best-effort — Apple throttles this to a few times/year */ }
}

// ── STEP: Rating ─────────────────────────────────────────────────────────────────
export function StepRating({ onNext }) {
  const [rated, setRated] = useState(false)
  const [hovered, setHovered] = useState(-1)

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>

      {/* Top glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(198,168,92,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="mb-8"
        >
          <img src={logo} alt="Ascendus" style={{ width: 72, height: 72, mixBlendMode: 'lighten' }} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="font-heading font-bold text-[32px] leading-tight mb-3"
          style={{ color: TEXT, letterSpacing: '-0.02em' }}
        >
          Enjoying<br />Ascendus?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="font-body text-[14px] leading-relaxed mb-10"
          style={{ color: DIM, maxWidth: 280 }}
        >
          A quick rating takes 5 seconds and helps thousands of guys discover their potential.
        </motion.p>

        {/* Interactive stars */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 mb-10"
        >
          {[0,1,2,3,4].map(i => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.85 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(-1)}
              onClick={async () => { setHovered(4); await openAppStoreReview(); setRated(true) }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <Star
                size={44}
                style={{
                  color: i <= (hovered >= 0 ? hovered : 4) ? G : 'rgba(255,255,255,0.12)',
                  fill: i <= (hovered >= 0 ? hovered : 4) ? G : 'transparent',
                  filter: i <= (hovered >= 0 ? hovered : 4) ? 'drop-shadow(0 0 10px rgba(198,168,92,0.6))' : 'none',
                  transition: 'all 0.15s',
                }}
              />
            </motion.button>
          ))}
        </motion.div>

      </div>

      <div className="px-6 pb-10 pt-2 flex flex-col gap-3">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          whileTap={{ scale: 0.97 }}
          onClick={async () => { await openAppStoreReview(); setRated(true) }}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
          style={{ background: GOLD_GRAD, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
        >
          Rate Ascendus on the App Store
        </motion.button>
        <button
          onClick={onNext}
          className="w-full py-2 font-body text-[13px] text-center transition-opacity hover:opacity-70"
          style={{ color: rated ? G : DIM }}
        >
          {rated ? 'Continue →' : 'Maybe later'}
        </button>
      </div>
    </div>
  )
}

// ── Derive biggest growth area from scan sub-scores ───────────────────────────
function getBiggestGrowthArea(scan) {
  if (!scan) return null

  const candidates = []

  const fd = scan.faceData
  if (fd) {
    if (fd.jawlineDefinition != null) candidates.push({ label: 'Jawline & Structure',  score: fd.jawlineDefinition, detail: 'How much definition and angularity your jawline currently has versus its structural ceiling' })
    if (fd.skinClarity       != null) candidates.push({ label: 'Skin Clarity',          score: fd.skinClarity,       detail: 'Texture, tone evenness, and clarity — the single highest-ROI area to address first' })
    if (fd.eyeArea           != null) candidates.push({ label: 'Eye Area',              score: fd.eyeArea,           detail: 'Periorbital definition, under-eye quality, and how your eye shape reads on camera' })
    if (fd.facialHarmony     != null) candidates.push({ label: 'Facial Harmony',        score: fd.facialHarmony,     detail: 'How well your facial thirds and feature proportions balance against each other' })
    if (fd.facialProportions != null) candidates.push({ label: 'Facial Proportions',    score: fd.facialProportions, detail: 'Upper to lower face ratio and the width-to-length balance relative to ideal benchmarks' })
  }

  if (scan.physiqueScore?.overall != null) {
    candidates.push({ label: 'Body & Physique', score: scan.physiqueScore.overall, detail: 'Muscle-to-fat ratio, shoulder-to-waist taper, and the visual impact of your current physique' })
  }

  if (!candidates.length) return null
  return candidates.reduce((low, c) => c.score < low.score ? c : low)
}

// ── Pick one celebrity match from scan data (deterministic by scan id) ───────────
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

// ── STEP: Scores Waiting ──────────────────────────────────────────────────────────
// Free-user gate shown after scan completes.
// VISIBLE:  Glow Score number + tier label — the hook that drives unlock curiosity.
// BLURRED:  PSL Tier, Top %, Potential, and all sub-score details.
// TEASER:   Biggest growth area category name visible; detail blurred — proves
//           there's real analysis behind the paywall.
export function StepScoresWaiting({ onAscend, onInvite, scan }) {
  const glowScore = scan?.glowScore ?? null
  const tier      = scan?.tier      ?? null

  const physiqueUpside = scan?.physiqueScore
    ? Math.max(0, (7.5 - (scan.physiqueScore.overall ?? 5)) * 0.30 * 0.3)
    : 0
  const potential = glowScore != null
    ? Math.min(10, glowScore + 1.4 + physiqueUpside).toFixed(1)
    : null

  function toTopPct(score) {
    if (score == null) return null
    if (score >= 9.0) return 'Top 1%'
    if (score >= 8.0) return 'Top 5%'
    if (score >= 7.0) return 'Top 15%'
    if (score >= 6.0) return 'Top 30%'
    if (score >= 5.0) return 'Top 50%'
    return 'Bot 40%'
  }

  const growthArea  = getBiggestGrowthArea(scan)
  const celebMatch  = getCelebMatch(scan)

  const topPct = toTopPct(glowScore)

  // Three locked cards — PSL Tier, Potential (Top % is now visible in hero)
  const lockedMetrics = [
    { icon: Eye,  label: 'PSL Tier',  value: tier ?? '8.1',  unit: '' },
    { icon: Zap,  label: 'Potential', value: potential ?? '8.4', unit: '/10' },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>

      {/* Ambient glow behind score */}
      <div style={{
        position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)',
        width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(198,168,92,0.10) 0%, transparent 68%)',
        pointerEvents: 'none',
      }} />

      <div className="flex-1 flex flex-col justify-center px-6 overflow-y-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-7"
        >
          <img src={logo} alt="" style={{ width: 26, height: 26, mixBlendMode: 'lighten', opacity: 0.85 }} />
          <span className="font-heading font-bold text-[11px] tracking-[0.2em]" style={{ color: G }}>
            ASCENDUS ANALYSIS
          </span>
        </motion.div>

        {/* ── Hero: visible Glow Score + tier ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-5"
        >
          <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-2" style={{ color: 'rgba(198,168,92,0.65)' }}>
            GLOW SCORE
          </p>

          {/* Big number — fully visible, no blur */}
          <div className="flex items-end gap-1.5 mb-3">
            <span
              className="font-heading font-bold leading-none"
              style={{ fontSize: 72, color: TEXT, letterSpacing: '-0.03em', lineHeight: 1 }}
            >
              {glowScore != null ? glowScore.toFixed(1) : '—'}
            </span>
            <span className="font-heading font-bold text-[22px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              /10
            </span>
          </div>

          {/* Tier badge + Top % — fully visible */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {tier && (
              <div
                className="inline-flex items-center px-3 py-1.5 rounded-xl"
                style={{
                  background: 'rgba(198,168,92,0.12)',
                  border: '1px solid rgba(198,168,92,0.30)',
                }}
              >
                <span
                  className="font-heading font-bold text-[11px] tracking-[0.14em]"
                  style={{ color: G }}
                >
                  {tier.toUpperCase()}
                </span>
              </div>
            )}
            {topPct && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <BarChart2 size={11} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <span
                  className="font-heading font-bold text-[11px] tracking-[0.10em]"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  {topPct}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Teaser: biggest growth area ──────────────────────────────────── */}
        {growthArea && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mb-5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <Lock size={13} style={{ color: G, marginTop: 2, flexShrink: 0 }} />
            <div className="min-w-0">
              <p className="font-body text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Biggest growth area
              </p>
              <p className="font-heading font-bold text-[13px] mb-1" style={{ color: TEXT }}>
                {growthArea.label}
              </p>
              {/* Detail is blurred — category name above is the visible hook */}
              <p
                className="font-body text-[12px] leading-snug select-none"
                style={{ color: 'rgba(255,255,255,0.55)', filter: 'blur(5px)', userSelect: 'none' }}
              >
                {growthArea.detail}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Celebrity match teaser ───────────────────────────────────────── */}
        {celebMatch && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {/* Avatar placeholder */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: 38, height: 38,
                background: 'rgba(198,168,92,0.10)',
                border: '1px solid rgba(198,168,92,0.22)',
              }}
            >
              <span style={{ fontSize: 17 }}>⭐</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Celebrity match · {celebMatch.sim}% similarity
              </p>
              {/* Name is blurred — the mystery drives the unlock */}
              <p
                className="font-heading font-bold text-[15px] select-none"
                style={{ color: 'rgba(255,255,255,0.90)', filter: 'blur(6px)', userSelect: 'none' }}
              >
                {celebMatch.name}
              </p>
            </div>
            <Lock size={13} style={{ color: G, flexShrink: 0 }} />
          </motion.div>
        )}

        {/* ── Three locked metric cards ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-2.5 mb-5"
        >
          {lockedMetrics.map(({ icon: Icon, label, value, unit }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.06 }}
              className="rounded-2xl p-3 flex flex-col"
              style={{
                background: 'rgba(198,168,92,0.04)',
                border: '1px solid rgba(198,168,92,0.12)',
              }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <Icon size={12} style={{ color: G }} />
                <Lock size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <span className="font-heading text-[9px] tracking-wide font-bold mb-1.5" style={{ color: 'rgba(198,168,92,0.6)' }}>
                {label}
              </span>
              <div className="flex items-end gap-0.5">
                <span
                  className="font-heading font-bold text-[22px] leading-none select-none"
                  style={{ color: TEXT, filter: 'blur(7px)', userSelect: 'none' }}
                >
                  {value}
                </span>
                {unit && (
                  <span className="font-heading font-bold text-[11px] mb-0.5 select-none" style={{ color: DIM, filter: 'blur(5px)' }}>
                    {unit}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>

      <div className="px-6 pb-10 pt-2 flex flex-col gap-3 flex-shrink-0">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          whileTap={{ scale: 0.97 }}
          onClick={onAscend}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
          style={{ background: GOLD_GRAD, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
        >
          <Sparkles size={16} style={{ color: '#0A0A0A' }} /> Unlock Full Results
        </motion.button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          whileTap={{ scale: 0.97 }}
          onClick={onInvite}
          className="w-full py-3.5 rounded-2xl font-heading font-semibold text-[14px] flex items-center justify-center gap-2"
          style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', color: TEXT }}
        >
          <UserPlus size={15} /> Invite 3 Friends — Get Free Access
        </motion.button>
      </div>
    </div>
  )
}

// ── STEP: Paywall ─────────────────────────────────────────────────────────────────
export function StepPaywall({ onUnlocked, onSkip }) {
  const [plan, setPlan] = useState('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setIsPremium = useStore(s => s.setIsPremium)
  const startProTrial = useStore(s => s.startProTrial)

  const benefits = [
    { icon: Trophy, text: 'Full AI Glow Score + face breakdown' },
    { icon: Eye, text: 'Celebrity lookalike matches' },
    { icon: Zap, text: 'Personalized 12-week glow-up plan' },
    { icon: BarChart2, text: 'AI improvement coach & weekly check-ins' },
  ]

  async function startTrial() {
    setLoading(true)
    setError('')
    try {
      if (isNative()) {
        const result = await purchasePro(plan)
        if (result?.success) { api.payments.syncRc().catch(() => {}); setIsPremium(true); onUnlocked() }
        else setLoading(false)
      } else {
        startProTrial()
        onUnlocked()
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (!msg.includes('cancel')) setError('Unable to start your trial. Please try again.')
      setLoading(false)
    }
  }

  async function buyNow() {
    setLoading(true)
    setError('')
    try {
      if (isNative()) {
        const result = await purchasePro(plan)
        if (result?.success) { api.payments.syncRc().catch(() => {}); setIsPremium(true); onUnlocked() }
        else setLoading(false)
      } else {
        startProTrial()
        onUnlocked()
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (!msg.includes('cancel')) setError('Unable to complete purchase. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>

      {/* Top gold glow */}
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(198,168,92,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="flex-1 overflow-y-auto px-6 pt-14 pb-4 flex flex-col">

        {/* Crown + badge */}
        <div className="flex flex-col items-center mb-8">
          <motion.img
            src={logo}
            alt="Ascendus"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            style={{ width: 64, height: 64, mixBlendMode: 'lighten', marginBottom: 14 }}
          />
          <div
            className="px-5 py-1.5 rounded-full font-heading font-bold text-[11px] tracking-widest"
            style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.3)', color: G }}
          >
            ASCENDUS PRO
          </div>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="font-heading font-bold text-[30px] leading-tight text-center mb-1"
          style={{ color: TEXT, letterSpacing: '-0.02em' }}
        >
          Start your glow-up<br />for free.
        </motion.h1>
        <p className="font-body text-[13px] text-center mb-7" style={{ color: DIM }}>
          3 days free · cancel anytime
        </p>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-3 mb-7"
        >
          {benefits.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.2)' }}
              >
                <Icon size={14} style={{ color: G }} />
              </div>
              <span className="font-body text-[13.5px]" style={{ color: 'rgba(255,255,255,0.8)' }}>{text}</span>
            </div>
          ))}
        </motion.div>

        {/* Plan toggle */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-2 mb-5"
        >
          {[
            { key: 'monthly', label: 'Monthly', price: '$1.84', per: '/wk', badge: null },
            { key: 'annual', label: 'Annual', price: '$0.96', per: '/wk', badge: 'SAVE 48%' },
          ].map(({ key, label, price, per, badge }) => (
            <button
              key={key}
              onClick={() => setPlan(key)}
              className="py-4 rounded-2xl text-center relative overflow-hidden transition-all"
              style={{
                background: plan === key ? 'rgba(198,168,92,0.12)' : SURFACE,
                border: `1.5px solid ${plan === key ? 'rgba(198,168,92,0.5)' : 'rgba(255,255,255,0.08)'}`,
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
                style={{ color: plan === key ? G : 'rgba(255,255,255,0.35)' }}>
                {label}
              </p>
              <p className="font-heading font-bold text-[22px] leading-none"
                style={{ color: plan === key ? TEXT : 'rgba(255,255,255,0.55)' }}>
                {price}
                <span className="text-[12px] font-normal">{per}</span>
              </p>
            </button>
          ))}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={buyNow}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: GOLD_GRAD, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.4)' }}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Processing…' : plan === 'annual' ? 'Get Ascendus Pro — $49.99/yr' : 'Get Ascendus Pro — $7.99/mo'}
        </motion.button>

        {error && <p className="text-center text-[11px] font-body mt-2" style={{ color: '#EF4444' }}>{error}</p>}
      </div>

      <div className="px-6 pb-10 pt-1 flex-shrink-0">
        <button
          onClick={onSkip}
          disabled={loading}
          className="w-full py-2 font-body text-[13px] text-center flex items-center justify-center gap-1 transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: DIM }}
        >
          Maybe later <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
