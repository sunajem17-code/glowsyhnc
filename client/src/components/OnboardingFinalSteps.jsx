import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Lock, Sparkles, UserPlus, Check, Loader2, ChevronRight } from 'lucide-react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import useStore from '../store/useStore'
import { purchasePro, isNative } from '../utils/iap'

// ── Design tokens (Ascendus) ───────────────────────────────────────────────────
const G = '#C6A85C'
const GOLD_GRAD = 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 50%, #A8893A 100%)'
const BG = '#080808'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.08)'

const APP_STORE_ID = '6744042195'
const REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`

async function openAppStoreReview() {
  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: REVIEW_URL })
    } else {
      window.open(REVIEW_URL, '_blank', 'noopener')
    }
  } catch {
    /* opening the store is best-effort */
  }
}

// ── STEP: Leave a Rating ────────────────────────────────────────────────────────
export function StepRating({ onNext }) {
  const [rated, setRated] = useState(false)

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <div className="flex-1 flex flex-col justify-center px-6">
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="font-heading font-bold text-[11px] text-center tracking-[0.22em] mb-8"
          style={{ color: DIM }}
        >
          LEAVE A RATING
        </motion.p>

        {/* Stars */}
        <div className="flex justify-center gap-2 mb-10">
          {[0, 1, 2, 3, 4].map(i => (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 300, damping: 18 }}
            >
              <Star size={42} style={{ color: G, fill: G, filter: 'drop-shadow(0 0 12px rgba(198,168,92,0.55))' }} />
            </motion.div>
          ))}
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="font-heading font-bold text-center text-[30px] leading-tight mb-5"
          style={{ color: TEXT, letterSpacing: '-0.01em' }}
        >
          <span style={{ fontStyle: 'italic' }}>Ascendus</span> is the #1 App to Glow Up &amp; Looksmax.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="font-body text-[14px] text-center leading-relaxed px-2"
          style={{ color: DIM }}
        >
          Your rating helps us serve you better and helps others discover their potential.
        </motion.p>
      </div>

      <div className="px-6 pb-10 pt-4 flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={async () => { await openAppStoreReview(); setRated(true) }}
          className="w-full py-4 rounded-full font-heading font-bold text-[16px] flex items-center justify-center gap-2.5"
          style={{ background: '#FFFFFF', color: '#0A0A0A', boxShadow: '0 4px 24px rgba(255,255,255,0.2)' }}
        >
          <Star size={18} style={{ fill: '#0A0A0A' }} /> Rate Ascendus
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

// ── STEP: Your Scores Are Waiting ───────────────────────────────────────────────
export function StepScoresWaiting({ onAscend, onInvite }) {
  const cards = [
    { label: 'RATING' },
    { label: 'POTENTIAL' },
    { label: 'PSL SCORE' },
    { label: 'TOP % LOOKS' },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <div className="flex-1 flex flex-col justify-center px-5">
        <p className="font-mono text-[11px] tracking-[0.18em] mb-6" style={{ color: DIM }}>
          YOUR ASCENDUS GUIDE
        </p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-6"
          style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-start justify-between mb-4">
            <span className="font-mono text-[13px]" style={{ color: 'rgba(255,255,255,0.3)' }}>01</span>
            <Lock size={18} style={{ color: 'rgba(255,255,255,0.35)' }} />
          </div>

          <h1 className="font-heading font-bold text-[34px] leading-[1.05] mb-7" style={{ color: TEXT }}>
            YOUR SCORES<br />ARE WAITING.
          </h1>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {cards.map(({ label }) => (
              <div
                key={label}
                className="rounded-2xl p-4 flex flex-col justify-between"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, minHeight: 92 }}
              >
                <span className="font-mono text-[10px] tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                <div className="flex justify-start mt-3">
                  <Lock size={18} style={{ color: 'rgba(255,255,255,0.25)' }} />
                </div>
              </div>
            ))}
          </div>

          <p className="font-body text-[14px]" style={{ color: DIM }}>
            See where you rank. Know exactly what to fix.
          </p>
        </motion.div>
      </div>

      <div className="px-5 pb-10 pt-4 flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onAscend}
          className="w-full py-4 rounded-full font-heading font-bold text-[16px] flex items-center justify-center gap-2"
          style={{ background: '#FFFFFF', color: '#0A0A0A', boxShadow: '0 4px 24px rgba(255,255,255,0.18)' }}
        >
          <Sparkles size={17} style={{ color: '#0A0A0A' }} /> Glow Up Now
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onInvite}
          className="w-full py-4 rounded-full font-heading font-semibold text-[15px] flex items-center justify-center gap-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.14)`, color: TEXT }}
        >
          <UserPlus size={16} /> Invite 3 Friends
        </motion.button>
      </div>
    </div>
  )
}

// ── STEP: Paywall (payment plan + 3-day free trial) ─────────────────────────────
export function StepPaywall({ onUnlocked, onSkip }) {
  const [plan, setPlan] = useState('annual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setIsPremium = useStore(s => s.setIsPremium)
  const startProTrial = useStore(s => s.startProTrial)

  const benefits = [
    'Your AI Glow Score + full face metrics',
    'Celebrity lookalike matches',
    'Personalized 12-week glow-up plan',
    'AI improvement coach',
  ]

  async function startTrial() {
    setLoading(true)
    setError('')
    try {
      if (isNative()) {
        const result = await purchasePro(plan)
        if (result?.success) {
          setIsPremium(true)
          onUnlocked()
        } else {
          setLoading(false) // cancelled — stay on paywall
        }
      } else {
        // Web / preview: grant the local Pro trial so the flow is testable
        startProTrial()
        onUnlocked()
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (!msg.includes('cancel')) setError('Unable to start your trial. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      <div className="flex-1 overflow-y-auto px-6 pt-16 pb-4 flex flex-col">
        <div className="flex justify-center mb-5">
          <div
            className="px-4 py-1.5 rounded-full font-heading font-bold text-[11px] tracking-widest"
            style={{ background: 'rgba(198,168,92,0.12)', border: `1px solid rgba(198,168,92,0.3)`, color: G }}
          >
            ASCENDUS PRO
          </div>
        </div>

        <h1 className="font-heading font-bold text-center text-[27px] leading-tight mb-2" style={{ color: TEXT }}>
          Unlock your full potential.
        </h1>
        <p className="font-body text-[13px] text-center mb-6" style={{ color: DIM }}>
          Start free. Cancel anytime before it ends.
        </p>

        {/* Benefits */}
        <div className="flex flex-col gap-2.5 mb-7">
          {benefits.map(b => (
            <div key={b} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(198,168,92,0.15)' }}>
                <Check size={12} style={{ color: G }} />
              </div>
              <span className="font-body text-[13.5px]" style={{ color: 'rgba(255,255,255,0.78)' }}>{b}</span>
            </div>
          ))}
        </div>

        {/* Plan toggle */}
        <div className="rounded-2xl p-1 mb-4" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-2 gap-1">
            {[
              { key: 'monthly', label: 'Monthly', price: '$7.99/mo' },
              { key: 'annual', label: 'Annual', price: '$4.17/mo', badge: 'SAVE 48%' },
            ].map(({ key, label, price, badge }) => (
              <button
                key={key}
                onClick={() => setPlan(key)}
                className="py-3 rounded-xl text-center transition-all"
                style={{
                  background: plan === key ? 'rgba(198,168,92,0.18)' : 'transparent',
                  border: `1px solid ${plan === key ? 'rgba(198,168,92,0.4)' : 'transparent'}`,
                }}
              >
                <p className="text-[11px] font-heading font-bold leading-none mb-1"
                  style={{ color: plan === key ? G : 'rgba(255,255,255,0.35)' }}>
                  {label}{badge && plan === key ? ` · ${badge}` : ''}
                </p>
                <p className="text-[14px] font-mono font-bold"
                  style={{ color: plan === key ? TEXT : 'rgba(255,255,255,0.3)' }}>
                  {price}
                </p>
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={startTrial}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ background: GOLD_GRAD, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.35)' }}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Starting…' : 'Start 3-Day Free Trial'}
        </motion.button>

        <p className="text-center text-[10.5px] font-body mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {isNative()
            ? '$0 today · then billed to your Apple ID after 3 days · cancel anytime'
            : `$0 today · then ${plan === 'annual' ? '$49.99/yr ($4.17/mo)' : '$7.99/mo'} · cancel anytime`}
        </p>

        {error && <p className="text-center text-[11px] font-body mt-2" style={{ color: '#EF4444' }}>{error}</p>}
      </div>

      <div className="px-6 pb-10 pt-2 flex-shrink-0">
        <button
          onClick={onSkip}
          disabled={loading}
          className="w-full py-2 font-body text-[13px] text-center flex items-center justify-center gap-1 transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: DIM }}
        >
          Maybe later <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
