import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Sparkles, Check, Loader2, ChevronRight, ChevronDown, Zap, Trophy, Eye, BarChart2, Lock } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { InAppReview } from '@capacitor-community/in-app-review'
import useStore from '../store/useStore'
import { purchasePro, isNative } from '../utils/iap'
import { api } from '../utils/api'
import logo from '../assets/ascendus-icon.png'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { EXTENDED_CATEGORIES, CategoryCard } from './CategoryCard'

const G = GOLD
const GOLD_GRAD = GOLD_GRADIENT
const BG = '#080808'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.5)'
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

// Same blur-lock treatment as ScanUnlockGate's Card1Score — kept as a local
// copy rather than a shared import since the two files already duplicate the
// growth-area/celeb-match helpers above for the same reason (no shared
// "onboarding result card" module exists yet).
function BlurLock({ children, size = 'md', style: extraStyle = {} }) {
  const blur = size === 'lg' ? 'blur(16px)' : size === 'sm' ? 'blur(11px)' : 'blur(13px)'
  return (
    <span style={{ position: 'relative', display: 'inline-block', userSelect: 'none', ...extraStyle }}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: -6,
          borderRadius: 10,
          background: 'radial-gradient(circle, rgba(198,168,92,0.08) 0%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative', display: 'inline-block', filter: blur }}>
        {children}
      </span>
    </span>
  )
}

// ── Card 1: Overall — the original StepScoresWaiting content, now the first
// card of the carousel below. Self-contained (computes everything off `scan`
// alone) to match Card1Score/CategoryCard's own pattern in ScanUnlockGate.jsx.
// BLURRED: PSL Tier, Potential, Symmetry, Jawline, Skin Clarity, Facial Proportions.
// No visible hero number/tier and no growth-area/celebrity-match teasers — this
// card goes straight from the ascend-date badge to the locked tile grid.
function OverallCard({ scan }) {
  const glowScore = scan?.glowScore ?? null
  const tier      = scan?.tier      ?? null

  const physiqueUpside = scan?.physiqueScore
    ? Math.max(0, (7.5 - (scan.physiqueScore.overall ?? 5)) * 0.30 * 0.3)
    : 0
  const potential = glowScore != null
    ? Math.min(10, glowScore + 1.4 + physiqueUpside).toFixed(1)
    : null

  const symmetry          = scan?.faceData?.symmetry          ?? null
  const jawlineDefinition = scan?.faceData?.jawlineDefinition ?? null
  const skinClarity       = scan?.faceData?.skinClarity       ?? null
  const facialProportions = scan?.faceData?.facialProportions ?? null

  function toScorePct(v) {
    return v != null ? Math.min(100, (v / 10) * 100) : 0
  }

  const ascendByLabel = new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Six real fields — same as Card1Score, not fabricated categories.
  const lockedMetrics = [
    { label: 'PSL Tier',           value: tier ?? '—',                                                    unit: '',                                    pct: glowScore != null ? Math.min(100, (glowScore / 10) * 100) : 0 },
    { label: 'Potential',          value: potential ?? '—',                                                unit: potential ? '/10' : '',                pct: potential != null ? Math.min(100, (parseFloat(potential) / 10) * 100) : 0 },
    { label: 'Symmetry',           value: symmetry != null ? symmetry.toFixed(1) : '—',                    unit: symmetry != null ? '/10' : '',          pct: toScorePct(symmetry) },
    { label: 'Jawline',            value: jawlineDefinition != null ? jawlineDefinition.toFixed(1) : '—',  unit: jawlineDefinition != null ? '/10' : '', pct: toScorePct(jawlineDefinition) },
    { label: 'Skin Clarity',       value: skinClarity != null ? skinClarity.toFixed(1) : '—',               unit: skinClarity != null ? '/10' : '',       pct: toScorePct(skinClarity) },
    { label: 'Facial Proportions', value: facialProportions != null ? facialProportions.toFixed(1) : '—',   unit: facialProportions != null ? '/10' : '', pct: toScorePct(facialProportions) },
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
          className="flex items-center gap-3 mb-5"
        >
          <img src={logo} alt="" style={{ width: 26, height: 26, mixBlendMode: 'lighten', opacity: 0.85 }} />
          <span className="font-heading font-bold text-[11px] tracking-[0.2em]" style={{ color: G }}>
            ASCENDUS ANALYSIS
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="font-heading font-bold text-[22px] leading-tight mb-3"
          style={{ color: TEXT, letterSpacing: '-0.01em' }}
        >
          You will ascend by
        </motion.h1>

        {/* ── Ascend-date pill ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-6"
        >
          <div
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full"
            style={{
              background: 'rgba(198,168,92,0.12)',
              border: '1px solid rgba(198,168,92,0.35)',
            }}
          >
            <span className="font-heading font-bold text-[19px]" style={{ color: G }}>
              {ascendByLabel}
            </span>
            <ChevronDown size={16} style={{ color: G }} />
          </div>
        </motion.div>

        {/* ── Overall label ─────────────────────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="font-heading font-bold text-[11px] tracking-[0.18em] mb-2 uppercase"
          style={{ color: G }}
        >
          Overall
        </motion.p>

        {/* ── Six locked metric cards — 2×3 grid, matching Card1Score ───────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-2.5 mb-5"
        >
          {lockedMetrics.map(({ label, value, unit, pct }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.05 }}
              className="rounded-2xl p-3.5 flex flex-col"
              style={{
                background: 'rgba(198,168,92,0.03)',
                border: '1px solid rgba(198,168,92,0.15)',
              }}
            >
              <span className="font-heading font-bold text-[17px] uppercase mb-2.5" style={{ color: G, letterSpacing: '-0.01em' }}>
                {label}
              </span>
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
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  )
}

// ── STEP: Scores Waiting ──────────────────────────────────────────────────────────
// Onboarding's own "here's your real score" moment — now a 6-card swipeable
// carousel: OverallCard (mirrors ScanUnlockGate's Card1Score) followed by the
// same 5 EXTENDED_CATEGORIES cards ScanUnlockGate shows post-purchase, so the
// paywall on /unlock isn't the first time the user sees any of this. Swipe/drag
// mechanics (index state, velocity-aware drag commit, spring transition, "X OF
// Y" counter) match ScanUnlockGate's SwipeableResultCards exactly — the
// "Unlock Results Now" CTA below is untouched, still a flat call to onAscend.
const CAROUSEL_SLIDE_VARIANTS = {
  enter: (d) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (d) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
}

export function StepScoresWaiting({ onAscend, scan, isPurchasing = false, error = '' }) {
  const [cardIdx, setCardIdx] = useState(0)
  const [direction, setDirection] = useState(1)

  const cards = [
    { id: 'overall', el: <OverallCard scan={scan} /> },
    ...EXTENDED_CATEGORIES.map(cat => ({
      id: cat.key,
      el: <CategoryCard scan={scan} categoryKey={cat.key} badge={cat.badge} icon={cat.icon} metrics={cat.metrics} />,
    })),
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
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={cardIdx}
            custom={direction}
            variants={CAROUSEL_SLIDE_VARIANTS}
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

      <div className="px-6 pb-10 pt-2 flex-shrink-0">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          whileTap={{ scale: isPurchasing ? 1 : 0.97 }}
          onClick={onAscend}
          disabled={isPurchasing}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: GOLD_GRAD, fontSize: 16, letterSpacing: '0.02em' }}
        >
          {/* isPurchasing/error were accepted as props but never rendered —
              handleAscend genuinely ran and genuinely failed (no Stripe keys
              configured in this env, or an early demo-token redirect), it
              just had nowhere to show it. Same spinner/disabled/error pattern
              as ScanUnlockGate's own button, so behavior doesn't drift between
              the two screens.

              Text color stays #0A0A0A from .btn-primary (shared by every gold
              CTA app-wide, not touched here) — checked WCAG contrast for
              white against this exact gradient (#D4AF6A/#C6A85C/#A8893A) and
              it fails badly at the lighter stop (~1.9:1, below even the 3:1
              floor for bold/large text), while black holds ~5.7–9.9:1 across
              the whole range. Confirmed with the user: bump size/weight
              instead of trading away contrast for a color that reads worse
              at one end of the gradient. */}
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
              {isPurchasing ? 'Processing…' : 'Unlock Results Now'}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        {error && (
          <p className="text-center text-[12px] font-body font-semibold mt-2" style={{ color: TEXT }}>{error}</p>
        )}
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
