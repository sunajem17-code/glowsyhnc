import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, ChevronLeft, Lock } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'

// ─── Gold tokens ───────────────────────────────────────────────────────────────
const GOLD = '#C6A85C'
const GOLD_LIGHT = '#D4B96A'
const GOLD_DARK = '#A8893A'
const SURFACE = '#0D0D0D'
const SURFACE_2 = '#141414'
const SURFACE_3 = '#1C1C1C'
const BORDER = 'rgba(255,255,255,0.06)'
const GOLD_BORDER = 'rgba(198,168,92,0.25)'
const TEXT = '#F0EDE8'
const TEXT_DIM = '#4A4642'

const FEATURES = [
  { name: 'Face + Body Scan', free: '1/month', premium: 'Unlimited' },
  { name: 'Glow Score + Sub-Scores', free: true, premium: true },
  { name: 'Basic Recommendations', free: true, premium: true },
  { name: 'Full 12-Week Action Plan', free: 'First only', premium: true },
  { name: 'Progress Timeline', free: 'Last 4 scans', premium: 'Full history' },
  { name: 'Before & After Comparison', free: false, premium: true },
  { name: 'HairMaxx AI Simulator', free: false, premium: true },
  { name: 'Product Recommendations', free: 'Generic', premium: 'Personalized' },
  { name: 'Daily Check-In (full)', free: 'Posture only', premium: true },
  { name: 'Priority Support', free: false, premium: true },
]

const TESTIMONIALS = [
  { name: 'Marcus T.', handle: '@marcust', score: '+18 pts', quote: 'My posture went from D to B+ in 8 weeks. The plan actually works.', initial: 'M' },
  { name: 'Sarah K.', handle: '@sarahk', score: '+22 pts', quote: 'The skincare routine cleared my skin in 6 weeks. Unreal.', initial: 'S' },
  { name: 'Jordan L.', handle: '@jordanl', score: '+14 pts', quote: 'Best $7.99 I spend every month. The roadmap alone changed my whole approach.', initial: 'J' },
]

export default function Premium() {
  const navigate = useNavigate()
  const { setIsPremium, isPremium, logout } = useStore()
  const [plan] = useState('monthly')
  const [subscribingTrial, setSubscribingTrial] = useState(false)
  const [subscribingNow, setSubscribingNow] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      api.payments.status()
        .then(({ isPremium: active }) => { if (active) setIsPremium(true) })
        .catch(() => {})
    }
  }, [searchParams, setIsPremium])

  async function handleSubscribe(noTrial = false) {
    // Demo users must create a real account first
    const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
    const token = stored?.state?.token
    if (!token || token === 'demo-token') {
      setCheckoutError('Create a free account first to subscribe.')
      return
    }
    if (noTrial) setSubscribingNow(true)
    else setSubscribingTrial(true)
    setCheckoutError('')
    try {
      const { url } = await api.payments.createCheckout(plan, noTrial)
      window.location.href = url
    } catch (err) {
      const msg = err.message || ''
      if (msg.toLowerCase().includes('session expired') || msg.toLowerCase().includes('user not found')) {
        setSessionExpired(true)
        setCheckoutError('')
      } else {
        setCheckoutError(msg || 'Could not start checkout — please try again.')
      }
      setSubscribingNow(false)
      setSubscribingTrial(false)
    }
  }

  function handleRelogin() {
    if (typeof logout === 'function') logout()
    localStorage.removeItem('ascendus-storage')
    navigate('/auth')
  }

  if (isPremium) {
    return (
      <div
        className="page-scroll-full flex flex-col items-center justify-center px-8 text-center"
        style={{ background: SURFACE }}
      >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: `${GOLD}18`, border: `1px solid ${GOLD_BORDER}` }}
          >
            <span className="text-2xl font-mono font-bold" style={{ color: GOLD }}>✦</span>
          </div>
          <h1
            className="font-heading font-bold text-2xl mb-2"
            style={{ color: TEXT, letterSpacing: '-0.02em' }}
          >
            Premium Access
          </h1>
          <p className="font-body text-sm mb-8" style={{ color: TEXT_DIM }}>
            All features unlocked. Go make it happen.
          </p>
          <button onClick={() => navigate(-1)} className="btn-primary max-w-xs">
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="page-scroll-full" style={{ background: SURFACE }}>

      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="relative px-6 pt-14 pb-10 text-center overflow-hidden">
        {/* Subtle gold radial bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% -20%, ${GOLD}12 0%, transparent 70%)` }}
        />
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-14 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}` }}
        >
          <ChevronLeft size={18} style={{ color: TEXT }} />
        </button>

        <div className="relative z-10">
          {/* Gold badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{ background: `${GOLD}12`, border: `1px solid ${GOLD_BORDER}` }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            <span className="text-[11px] font-heading font-bold uppercase tracking-widest" style={{ color: GOLD }}>
              Ascendus Premium
            </span>
          </div>

          <h1
            className="font-heading font-bold text-[32px] leading-[1.1] mb-3"
            style={{ color: TEXT, letterSpacing: '-0.025em' }}
          >
            Unlock Your<br />Full Potential
          </h1>
          <p className="font-body text-[14px]" style={{ color: TEXT_DIM }}>
            Everything you need to maximize your glow-up.
          </p>
        </div>
      </div>

      <div className="px-4">

        {/* ── Two-option CTA ──────────────────────────────────────────── */}

        {/* Option 1: 2-day free trial (primary) */}
        <motion.button
          whileTap={{ scale: subscribingTrial ? 1 : 0.97 }}
          onClick={() => handleSubscribe(false)}
          disabled={subscribingTrial || subscribingNow}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mb-1 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60"
          style={{
            background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 45%, ${GOLD_DARK} 100%)`,
            color: '#0A0A0A',
            boxShadow: `0 4px 24px rgba(198,168,92,0.3), 0 1px 4px rgba(198,168,92,0.15)`,
            letterSpacing: '0.01em',
          }}
        >
          {subscribingTrial ? 'Opening checkout…' : '✦ Start 2-Day Free Trial'}
        </motion.button>
        <p className="text-center text-[10px] font-body mb-4" style={{ color: TEXT_DIM }}>
          Then $7.99/mo · Cancel anytime before trial ends
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: BORDER }} />
          <span className="text-[10px] font-body uppercase tracking-widest" style={{ color: TEXT_DIM }}>or</span>
          <div className="flex-1 h-px" style={{ background: BORDER }} />
        </div>

        {/* Option 2: Pay now (no trial) */}
        <motion.button
          whileTap={{ scale: subscribingNow ? 1 : 0.97 }}
          onClick={() => handleSubscribe(true)}
          disabled={subscribingNow || subscribingTrial}
          className="w-full py-3.5 rounded-2xl font-heading font-bold text-[14px] mb-1 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40"
          style={{
            background: `rgba(198,168,92,0.10)`,
            border: `1px solid ${GOLD_BORDER}`,
            color: GOLD,
          }}
        >
          {subscribingNow ? 'Opening checkout…' : 'Pay $7.99/mo Now'}
        </motion.button>
        <p className="text-center text-[10px] font-body mb-6" style={{ color: TEXT_DIM }}>
          Start immediately · No trial · Cancel anytime
        </p>

        {checkoutError && (
          <p className="text-center text-[11px] font-body mb-2" style={{ color: '#EF4444' }}>{checkoutError}</p>
        )}

        {sessionExpired && (
          <div className="mb-3 rounded-xl p-4 text-center" style={{ background: '#1A1A1A', border: '1px solid rgba(198,168,92,0.2)' }}>
            <p className="text-[12px] font-body mb-3" style={{ color: '#F0EDE8' }}>
              Your session is from before our upgrade. Please log out and log back in to subscribe.
            </p>
            <button
              onClick={handleRelogin}
              className="px-5 py-2 rounded-full text-[12px] font-semibold"
              style={{ background: GOLD, color: '#000' }}
            >
              Log out &amp; back in
            </button>
          </div>
        )}

        {/* ── Feature Comparison ──────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ border: `1px solid ${GOLD_BORDER}` }}
        >
          {/* Header */}
          <div
            className="grid grid-cols-3 text-center py-3 px-3"
            style={{ background: SURFACE_2, borderBottom: `1px solid ${BORDER}` }}
          >
            <span className="text-[10px] font-heading font-bold text-left uppercase tracking-wide" style={{ color: TEXT_DIM }}>
              Feature
            </span>
            <span className="text-[10px] font-heading font-bold uppercase tracking-wide" style={{ color: TEXT_DIM }}>
              Free
            </span>
            <div className="flex items-center justify-center gap-1">
              <div className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
              <span className="text-[10px] font-heading font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                Premium
              </span>
            </div>
          </div>

          {FEATURES.map(({ name, free, premium }, i) => (
            <div
              key={name}
              className="grid grid-cols-3 text-center py-3 px-3 items-center"
              style={{
                background: i % 2 === 0 ? SURFACE : SURFACE_2,
                borderTop: `1px solid ${BORDER}`,
              }}
            >
              <p className="text-[11px] font-body text-left" style={{ color: TEXT }}>{name}</p>
              <div className="flex justify-center">
                {free === true ? (
                  <Check size={13} style={{ color: '#4A4642' }} />
                ) : free === false ? (
                  <Lock size={11} style={{ color: '#2A2A2A' }} />
                ) : (
                  <span className="text-[9px] font-body" style={{ color: TEXT_DIM }}>{free}</span>
                )}
              </div>
              <div className="flex justify-center">
                {premium === true ? (
                  <Check size={13} style={{ color: GOLD }} />
                ) : (
                  <span className="text-[9px] font-body font-semibold" style={{ color: GOLD }}>{premium}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Testimonials ────────────────────────────────────────────── */}
        <p
          className="font-heading font-bold text-[13px] uppercase tracking-widest mb-4"
          style={{ color: TEXT_DIM }}
        >
          Real Results
        </p>

        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.handle}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl p-4 mb-3"
            style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${GOLD}15`, border: `1px solid ${GOLD_BORDER}` }}
              >
                <span className="text-sm font-bold font-heading" style={{ color: GOLD }}>
                  {t.initial}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-heading font-bold" style={{ color: TEXT }}>{t.name}</p>
                <p className="text-[10px] font-body" style={{ color: TEXT_DIM }}>{t.handle}</p>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}
              >
                {t.score}
              </span>
            </div>
            <p className="text-[13px] font-body leading-relaxed" style={{ color: TEXT_DIM }}>
              "{t.quote}"
            </p>
          </motion.div>
        ))}

        {/* ── Final CTA ───────────────────────────────────────────────── */}
        <motion.button
          whileTap={{ scale: subscribingTrial ? 1 : 0.97 }}
          onClick={() => handleSubscribe(false)}
          disabled={subscribingTrial || subscribingNow}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mt-2 mb-1 transition-all duration-200 disabled:opacity-60"
          style={{
            background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 45%, ${GOLD_DARK} 100%)`,
            color: '#0A0A0A',
            boxShadow: `0 4px 24px rgba(198,168,92,0.3)`,
          }}
        >
          {subscribingTrial ? 'Opening checkout…' : '✦ Start 2-Day Free Trial →'}
        </motion.button>
        <p className="text-center text-[10px] font-body pb-4" style={{ color: TEXT_DIM }}>
          $7.99/month after 2-day trial. Cancel anytime in Settings.
        </p>
        <p className="text-center text-[10px] font-body pb-10" style={{ color: TEXT_DIM }}>
          By subscribing you agree to our{' '}
          <button onClick={() => window.location.href = '/terms'} className="underline" style={{ color: 'rgba(198,168,92,0.7)' }}>Terms</button>
          {' '}and{' '}
          <button onClick={() => window.location.href = '/privacy'} className="underline" style={{ color: 'rgba(198,168,92,0.7)' }}>Privacy Policy</button>
        </p>
      </div>
    </div>
  )
}
