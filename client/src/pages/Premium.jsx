import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, ChevronLeft, Lock, Users, Share2, CheckCircle, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import PromoModal from '../components/PromoModal'
import { isNative, purchasePro, restorePurchases, initRevenueCat } from '../utils/iap'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, RED } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import MotionPage from '../components/MotionPage'

// ─── Gold tokens ───────────────────────────────────────────────────────────────
const GOLD_LIGHT = '#D4B96A'
const GOLD_DARK = '#A8893A'
const SURFACE = '#0D0D0D'
const SURFACE_2 = '#141414'
const BORDER = 'rgba(255,255,255,0.06)'
const GOLD_BORDER = 'rgba(198,168,92,0.25)'
const TEXT = '#F0EDE8'
const TEXT_DIM = '#4A4642'

const FEATURES = [
  { name: 'Face Scan', free: '1/month', premium: 'Unlimited' },
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
  { name: 'Marcus T.', handle: '@marcust', score: '+1.8 pts', quote: 'My posture went from D to B+ in 8 weeks. The plan actually works.', initial: 'M' },
  { name: 'Sarah K.', handle: '@sarahk', score: '+2.2 pts', quote: 'The skincare routine cleared my skin in 6 weeks. Unreal.', initial: 'S' },
  { name: 'Jordan L.', handle: '@jordanl', score: '+1.4 pts', quote: 'Best $9.99 I spend every month. The roadmap alone changed my whole approach.', initial: 'J' },
]

export default function Premium() {
  const navigate = useNavigate()
  const { setIsPremium, isPremium, logout, updateUser } = useStore()
  const [subscribingNow, setSubscribingNow] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [showPromo, setShowPromo] = useState(false)
  const [referralCount, setReferralCount] = useState(0)
  const [referralCode, setReferralCode]   = useState(null)
  const [unlocking, setUnlocking]         = useState(false)
  const [unlockMsg, setUnlockMsg]         = useState('')
  const [copied, setCopied]               = useState(false)
  const [copyFailed, setCopyFailed]       = useState(false)
  // Synchronous re-entrancy lock — see PremiumOnboarding.jsx's handleAscend
  // for why subscribingNow alone can't prevent a true double-tap.
  const purchaseLockRef = useRef(false)

  const [searchParams] = useSearchParams()

  useEffect(() => {
    initRevenueCat().catch(() => {})
  }, [])

  useEffect(() => {
    api.referral.count()
      .then(({ count, code }) => { setReferralCount(count || 0); setReferralCode(code) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      api.payments.status()
        .then(({ isPremium: active }) => { if (active) setIsPremium(true) })
        .catch(() => {})
    }
  }, [searchParams, setIsPremium])

  async function handleSubscribe() {
    if (purchaseLockRef.current) return
    purchaseLockRef.current = true

    setSubscribingNow(true)
    setCheckoutError('')
    try {
      if (isNative()) {
        const result = await purchasePro('monthly')
        if (result?.success) {
          const rcUserId = result.customerInfo?.originalAppUserId
          sessionStorage.setItem('asc_pro_splash_shown', '1')
          setIsPremium(true)
          api.payments.syncRc(rcUserId).catch(() => {})
        }
      } else {
        const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
        const token = stored?.state?.token
        if (!token || token === 'demo-token') {
          setCheckoutError('Create a free account first to subscribe.')
          setSubscribingNow(false)
          return
        }
        const { url } = await api.payments.createCheckout('monthly')
        window.location.href = url
      }
    } catch (err) {
      const msg = err?.message || ''
      const lower = msg.toLowerCase()
      if (lower.includes('session expired') || lower.includes('user not found')) {
        setSessionExpired(true)
      } else if (!lower.includes('cancel')) {
        // Always show a generic message — never expose raw RC/StoreKit errors
        setCheckoutError('Unable to complete purchase. Please try again.')
      }
    } finally {
      setSubscribingNow(false)
      purchaseLockRef.current = false
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setCheckoutError('')
    try {
      const info = await restorePurchases()
      const isPro = !!info?.entitlements?.active?.['Ascendus Pro']
      if (isPro) {
        const rcUserId = info?.originalAppUserId
        api.payments.syncRc(rcUserId).catch(() => {})
        sessionStorage.setItem('asc_pro_splash_shown', '1')
        setIsPremium(true)
        navigate('/dashboard')
      } else {
        setCheckoutError('No previous purchase found.')
      }
    } catch (err) {
      setCheckoutError('Restore failed. Please try again.')
    } finally {
      setRestoring(false)
    }
  }

  function handleRelogin() {
    if (typeof logout === 'function') logout()
    localStorage.removeItem('ascendus-storage')
    navigate('/auth')
  }

  async function handleUnlockPro() {
    setUnlocking(true)
    setUnlockMsg('')
    try {
      const { ok, isPremium: granted } = await api.referral.unlockPro()
      if (ok && granted) {
        sessionStorage.setItem('asc_pro_splash_shown', '1')
        setIsPremium(true)
        navigate('/dashboard')
      }
    } catch (err) {
      setUnlockMsg(err.message || 'Not enough referrals yet.')
    } finally {
      setUnlocking(false)
    }
  }

  async function handleCopyReferral() {
    const link = referralCode
      ? `https://ascendus.store/r/${referralCode}`
      : 'https://ascendus.store'
    const text = `I use Ascendus to track my glow-up, check it out 🔥 ${link}`
    if (navigator.share) {
      try { await navigator.share({ text, url: link }) } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setCopyFailed(false)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Clipboard API unavailable or denied — try legacy execCommand
        const el = document.createElement('input')
        el.value = text
        el.style.cssText = 'position:fixed;top:-9999px;opacity:0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(el)
        if (ok) {
          setCopyFailed(false)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          // Both methods failed — show the link so the user can copy manually
          setCopyFailed(true)
        }
      }
    }
  }

  if (isPremium) {
    return (
      <MotionPage
        baseClassName="page-scroll-full"
        className="flex flex-col items-center justify-center px-8 text-center"
        style={{ background: SURFACE }}
      >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE_STANDARD }}>
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
          <button onClick={() => { triggerHaptic(); navigate(-1) }} className="btn-primary max-w-xs">
            Back to Dashboard
          </button>
        </motion.div>
      </MotionPage>
    )
  }

  return (
    <MotionPage baseClassName="page-scroll-full" style={{ background: SURFACE }}>
      <Helmet>
        <title>Ascendus Pro | Unlimited Looksmax Scans &amp; Glow Up Tracker</title>
        <meta name="description" content="Upgrade to Ascendus Max for unlimited AI face ratings, body composition scores, and a personalized looksmax plan. Start your glow up today." />
        <meta name="keywords" content="looksmax pro, face rating app, glow up tracker, AI appearance score, looksmaxxing app, unlimited scans" />
      </Helmet>

      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="relative px-6 pb-10 text-center overflow-hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        {/* Subtle gold radial bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% -20%, ${GOLD}12 0%, transparent 70%)` }}
        />
        <button
          onClick={() => { triggerHaptic(); navigate(-1) }}
          className="absolute left-4 top-14 w-9 h-9 rounded-xl flex items-center justify-center z-20"
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

        {/* ── Subscribe CTA ─────────────────────────────────────────────── */}
        <motion.button
          whileTap={{ scale: subscribingNow ? 1 : 0.97 }}
          onClick={() => { triggerHaptic(); handleSubscribe() }}
          disabled={subscribingNow}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mb-1 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60"
          style={{
            background: GOLD_GRADIENT,
            color: '#0A0A0A',
            boxShadow: `0 4px 24px rgba(198,168,92,0.3), 0 1px 4px rgba(198,168,92,0.15)`,
          }}
        >
          {subscribingNow ? 'Opening checkout…' : 'Get Ascendus Max ($9.99/mo)'}
        </motion.button>
        <p className="text-center text-[10px] font-body mb-3" style={{ color: TEXT_DIM }}>
          Billed monthly · Cancel anytime
        </p>

        {checkoutError && (
          <p className="text-center text-[11px] font-body mb-2" style={{ color: RED }}>{checkoutError}</p>
        )}

        {/* Promo code link — web only (Apple IAP does not support external promo codes) */}
        {!isNative() && (
          <button
            onClick={() => setShowPromo(true)}
            className="w-full mb-4 font-body text-[12px] text-center transition-opacity hover:opacity-70"
            style={{ color: 'rgba(198,168,92,0.5)' }}
          >
            Have a promo code?
          </button>
        )}

        {/* ── Referral unlock section ──────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 mb-5"
          style={{ background: 'rgba(198,168,92,0.05)', border: '1px solid rgba(198,168,92,0.2)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users size={15} style={{ color: GOLD }} />
            <p className="font-heading font-bold text-[13px]" style={{ color: GOLD }}>
              Share with 3 Friends: Get Pro Free
            </p>
          </div>
          <p className="font-body text-[11px] mb-3" style={{ color: TEXT_DIM }}>
            No credit card. Just share your referral link and unlock Pro when 3 friends join.
          </p>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-3">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: referralCount >= n ? '100%' : '0%' }}
                  transition={{ duration: 0.6, delay: n * 0.1, ease: EASE_STANDARD }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, #A8893A, ${GOLD})` }}
                />
              </div>
            ))}
            <span className="font-mono font-bold text-[12px]" style={{ color: GOLD }}>
              {referralCount}/3
            </span>
          </div>

          {/* Share button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); handleCopyReferral() }}
            className="w-full py-2.5 rounded-xl font-heading font-bold text-[12px] flex items-center justify-center gap-1.5 mb-2.5"
            style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.25)', color: GOLD }}
          >
            <Share2 size={13} />
            {copied ? 'Link copied!' : 'Share My Referral Link'}
          </motion.button>

          {copyFailed && (
            <div className="mb-2.5 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="font-body text-[11px] mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Couldn't copy automatically. Press and hold to copy manually:
              </p>
              <p
                className="font-mono text-[11px] break-all select-all"
                style={{ color: GOLD, userSelect: 'all', WebkitUserSelect: 'all' }}
              >
                {referralCode ? `https://ascendus.store/r/${referralCode}` : 'https://ascendus.store'}
              </p>
            </div>
          )}

          {/* Claim button */}
          <motion.button
            whileTap={{ scale: referralCount >= 3 ? 0.97 : 1 }}
            onClick={() => { triggerHaptic(); handleUnlockPro() }}
            disabled={unlocking || referralCount < 3}
            className="w-full py-2.5 rounded-xl font-heading font-bold text-[12px] flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{
              background: referralCount >= 3
                ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`
                : '#1C1C1C',
              color: referralCount >= 3 ? '#0A0A0A' : TEXT_DIM,
              border: referralCount >= 3 ? 'none' : `1px solid ${BORDER}`,
            }}
          >
            {unlocking
              ? <><Loader2 size={13} className="animate-spin" /> Claiming…</>
              : referralCount >= 3
                ? <><CheckCircle size={13} /> Claim Free Pro</>
                : `Claim Free Pro (${3 - referralCount} more friend${3 - referralCount !== 1 ? 's' : ''} needed)`}
          </motion.button>

          {unlockMsg && (
            <p className="text-center text-[11px] font-body mt-2" style={{ color: unlockMsg.startsWith('🎉') ? '#34D399' : '#EF4444' }}>
              {unlockMsg}
            </p>
          )}
        </div>

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
            transition={{ delay: i * 0.08, ease: EASE_STANDARD }}
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
          whileTap={{ scale: subscribingNow ? 1 : 0.97 }}
          onClick={() => { triggerHaptic(); handleSubscribe() }}
          disabled={subscribingNow || restoring}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mt-2 mb-1 transition-all duration-200 disabled:opacity-60"
          style={{
            background: GOLD_GRADIENT,
            color: '#0A0A0A',
            boxShadow: `0 4px 24px rgba(198,168,92,0.3)`,
          }}
        >
          {subscribingNow ? 'Opening checkout…' : 'Get Ascendus Max ($9.99/mo)'}
        </motion.button>
        <p className="text-center text-[10px] font-body mb-1" style={{ color: TEXT_DIM }}>
          Billed monthly · Cancel anytime
        </p>

        {/* Apple IAP required disclosure */}
        <div className="mt-2 mb-4 px-1 space-y-1">
          <p className="text-center text-[10px] font-body leading-relaxed" style={{ color: TEXT_DIM }}>
            Ascendus Max is $9.99 USD/month or $49.99 USD/year.
            {isNative() ? ' Payment will be charged to your Apple ID account.' : ''}
          </p>
          <p className="text-center text-[10px] font-body leading-relaxed" style={{ color: TEXT_DIM }}>
            Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
            {isNative() ? ' Manage or cancel in your Apple ID Account Settings.' : ' Cancel anytime in Settings.'}
          </p>
        </div>

        {/* Restore Purchases — required by Apple */}
        {isNative() && (
          <button
            onClick={() => { triggerHaptic(); handleRestore() }}
            disabled={restoring || subscribingNow}
            className="w-full mb-3 font-body text-[12px] text-center transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'rgba(198,168,92,0.6)' }}
          >
            {restoring ? 'Restoring…' : 'Restore Purchases'}
          </button>
        )}

        <p className="text-center text-[10px] font-body pb-10" style={{ color: TEXT_DIM }}>
          By subscribing you agree to our{' '}
          <button onClick={() => window.location.href = isNative() ? 'https://ascendus.store/terms' : '/terms'} className="underline" style={{ color: 'rgba(198,168,92,0.7)' }}>Terms of Use</button>
          {' '}and{' '}
          <button onClick={() => window.location.href = isNative() ? 'https://ascendus.store/privacy' : '/privacy'} className="underline" style={{ color: 'rgba(198,168,92,0.7)' }}>Privacy Policy</button>
        </p>
      </div>

      {/* Promo modal */}
      <AnimatePresence>
        {showPromo && (
          <PromoModal
            onClose={() => setShowPromo(false)}
            onSuccess={() => {
              // Same fix as Results.jsx's PaywallSheet and OnboardingFinalSteps —
              // PromoModal doesn't touch the store itself, the caller has to.
              setIsPremium(true)
              updateUser({ is_pro: true, subscriptionTier: 'premium', subscription_tier: 'premium' })
              setShowPromo(false)
              navigate(-1)
            }}
          />
        )}
      </AnimatePresence>
    </MotionPage>
  )
}
