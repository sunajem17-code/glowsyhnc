import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Sparkles, UserPlus, Check, Loader2, ChevronRight, Zap, Trophy, Eye, BarChart2 } from 'lucide-react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import useStore from '../store/useStore'
import { purchasePro, isNative } from '../utils/iap'
import logo from '../assets/ascendus-icon.png'

const G = '#C6A85C'
const GOLD_GRAD = 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 50%, #A8893A 100%)'
const BG = '#080808'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.38)'
const SURFACE = 'rgba(255,255,255,0.04)'

const APP_STORE_ID = '6744042195'
const REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`

async function openAppStoreReview() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: REVIEW_URL })
    } else {
      window.open(REVIEW_URL, '_blank', 'noopener')
    }
  } catch { /* best-effort */ }
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

// ── STEP: Scores Waiting ──────────────────────────────────────────────────────────
export function StepScoresWaiting({ onAscend, onInvite }) {
  const metrics = [
    { icon: Trophy, label: 'Glow Score', value: '??', unit: '/10' },
    { icon: Eye, label: 'PSL Rating', value: '??', unit: '' },
    { icon: BarChart2, label: 'Top %', value: '??', unit: '' },
    { icon: Zap, label: 'Potential', value: '??', unit: '' },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', bottom: '30%', left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(198,168,92,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="flex-1 flex flex-col justify-center px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8"
        >
          <img src={logo} alt="" style={{ width: 28, height: 28, mixBlendMode: 'lighten', opacity: 0.85 }} />
          <span className="font-heading font-bold text-[11px] tracking-[0.2em]" style={{ color: G }}>
            ASCENDUS ANALYSIS
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-heading font-bold text-[38px] leading-[1.0] mb-3"
          style={{ color: TEXT, letterSpacing: '-0.025em' }}
        >
          Your results<br />are ready.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-body text-[14px] mb-8"
          style={{ color: DIM }}
        >
          Unlock to see exactly where you rank and what to improve first.
        </motion.p>

        {/* Metric cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          {metrics.map(({ icon: Icon, label, value, unit }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.07 }}
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(198,168,92,0.05)',
                border: '1px solid rgba(198,168,92,0.15)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon size={14} style={{ color: G }} />
                <span className="font-heading text-[10px] tracking-wide font-bold" style={{ color: 'rgba(198,168,92,0.7)' }}>
                  {label}
                </span>
              </div>
              {/* Blurred value */}
              <div className="flex items-end gap-0.5">
                <span
                  className="font-heading font-bold text-[28px] leading-none select-none"
                  style={{ color: TEXT, filter: 'blur(8px)', userSelect: 'none' }}
                >
                  {value}
                </span>
                <span className="font-heading font-bold text-[14px] mb-0.5" style={{ color: DIM, filter: 'blur(6px)' }}>
                  {unit}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>

      <div className="px-6 pb-10 pt-2 flex flex-col gap-3">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.97 }}
          onClick={onAscend}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
          style={{ background: GOLD_GRAD, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
        >
          <Sparkles size={16} style={{ color: '#0A0A0A' }} /> Unlock My Results
        </motion.button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
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
        if (result?.success) { setIsPremium(true); onUnlocked() }
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
        if (result?.success) { setIsPremium(true); onUnlocked() }
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
            { key: 'monthly', label: 'Monthly', price: '$7.99', per: '/mo', badge: null },
            { key: 'annual', label: 'Annual', price: '$4.17', per: '/mo', badge: 'SAVE 48%' },
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
          onClick={startTrial}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: GOLD_GRAD, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.4)' }}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Starting…' : 'Start 3-Day Free Trial'}
        </motion.button>

        <p className="text-center text-[10.5px] font-body mt-2" style={{ color: 'rgba(255,255,255,0.22)' }}>
          $0 today · cancel anytime
        </p>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={buyNow}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-70 mt-3"
          style={{ background: 'transparent', border: `1.5px solid rgba(198,168,92,0.4)`, color: G }}
        >
          {loading ? 'Processing…' : `Buy Now · ${plan === 'annual' ? '$49.99/yr' : '$7.99/mo'}`}
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
