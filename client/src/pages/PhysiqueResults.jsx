import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Dumbbell, Zap, Target, Activity, Lock, X, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { purchasePro, isNative } from '../utils/iap'
import { api } from '../utils/api'

const TIER_COLORS = {
  'Elite':        '#FFD700',
  'Advanced':     '#34C759',
  'Intermediate': '#C6A85C',
  'Beginner':     '#E07A5F',
}

const BODY_PILLARS = [
  { key: 'frame',               label: 'Frame',         detail: 'Bone structure · Shoulder width · Natural build' },
  { key: 'leanness',            label: 'Leanness',      detail: 'Muscle separation · Body fat · Definition' },
  { key: 'proportions',         label: 'Proportions',   detail: 'Shoulder-to-waist ratio · Limb balance' },
  { key: 'posture',             label: 'Posture',        detail: 'Alignment · Shoulder carriage · Spine' },
  { key: 'overall_presentation',label: 'Presentation',  detail: 'Overall visual impact · Stage readiness' },
]

function ScoreReveal({ score, tier, onDone }) {
  const [phase, setPhase] = useState('count')
  const [display, setDisplay] = useState(0)
  const tierColor = TIER_COLORS[tier] ?? GOLD

  useState(() => {
    let cur = 0
    const steps = 30
    const inc = score / steps
    const id = setInterval(() => {
      cur += inc
      if (cur >= score) { setDisplay(score); clearInterval(id); setTimeout(() => setPhase('tier'), 300) }
      else setDisplay(Math.round(cur * 10) / 10)
    }, 1200 / steps)
    return () => clearInterval(id)
  })

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: '#000' }}
      onClick={phase === 'tier' ? onDone : undefined}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 45%, ${tierColor}22 0%, transparent 65%)` }}
      />
      <motion.p
        className="font-heading font-bold"
        style={{ fontSize: 96, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff', textShadow: `0 0 60px ${tierColor}88` }}
        animate={{ scale: phase === 'tier' ? [1, 1.04, 1] : 1 }}
        transition={{ duration: 0.4 }}
      >
        {typeof display === 'number' ? display.toFixed(1) : display}
      </motion.p>
      <p className="font-body text-[13px] mt-3" style={{ color: 'rgba(255,255,255,0.45)' }}>PHYSIQUE SCORE</p>
      <AnimatePresence>
        {phase === 'tier' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-6 flex flex-col items-center gap-2"
          >
            <span
              className="font-heading font-bold text-[15px] px-5 py-2 rounded-full"
              style={{ background: `${tierColor}18`, border: `1.5px solid ${tierColor}55`, color: tierColor, boxShadow: `0 0 30px ${tierColor}33` }}
            >
              {tier}
            </span>
            <p className="mt-2 font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Tap to see full breakdown</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ScoreBar({ score }) {
  const pct = Math.max(0, ((score - 1) / 9) * 100)
  const color = score >= 7 ? '#34C759' : score >= 5 ? '#C6A85C' : '#E07A5F'
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <motion.div className="h-full rounded-full" style={{ background: color }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: 'easeOut' }} />
    </div>
  )
}

const PHYSIQUE_METRICS = [
  { label: 'Overall',     pct: 61 },
  { label: 'Potential',   pct: 88 },
  { label: 'Frame',       pct: 63 },
  { label: 'Leanness',    pct: 68 },
  { label: 'Proportions', pct: 57 },
  { label: 'Posture',     pct: 51 },
]

const REQUIRED = 3

// Exact copy of LockedRevealScreen from ScanUnlockGate, adapted for physique
function PhysiquePaywall({ photo, onClose, onAscend, onInvite, isPurchasing, error }) {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto" style={{ background: '#0A0A0A' }}>
      <div className="flex flex-col items-center px-5 pb-10"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>

        {/* Close button */}
        <div className="w-full flex justify-end mb-3">
          <button onClick={() => { triggerHaptic(); onClose() }} className="flex items-center justify-center"
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <X size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>

        {/* Header */}
        <h1 className="font-heading font-bold text-[26px] text-center leading-tight mb-1" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
          Reveal your ratings
        </h1>
        <p className="font-body text-[13px] text-center mb-5 leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Invite 3 friends or get Ascendus Max to view your physique results
        </p>

        {/* Photo circle overlapping card */}
        <div className="relative w-full">
          <div className="flex justify-center" style={{ marginBottom: -48, position: 'relative', zIndex: 2 }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', border: '3px solid #fff', background: '#111', overflow: 'hidden' }}>
              {photo
                ? <img src={photo} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.3)' }} />
                : null}
            </div>
          </div>

          {/* Metrics card */}
          <div className="w-full rounded-3xl pt-16 pb-5 px-5" style={{ background: '#141414', position: 'relative', zIndex: 1 }}>
            <div className="grid grid-cols-2 gap-x-5" style={{ rowGap: 0 }}>
              {PHYSIQUE_METRICS.map(({ label }, idx) => (
                <div key={label} style={{ paddingBottom: idx < 4 ? 20 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Lock size={11} style={{ color: GOLD, flexShrink: 0 }} />
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '-0.01em' }}>{label}</p>
                  </div>
                  <div style={{ width: 60, height: 22, borderRadius: 99, background: '#ffffff', filter: 'blur(8px)', marginBottom: 8, opacity: 0.9 }} />
                  <div style={{ height: 5, borderRadius: 99, background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)' }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="w-full mt-8 flex flex-col gap-3.5">
          <motion.button
            whileTap={{ scale: isPurchasing ? 1 : 0.97 }}
            onClick={() => { triggerHaptic(); onAscend() }}
            disabled={isPurchasing}
            className="w-full py-5 rounded-2xl font-heading font-bold text-[17px] flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
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

        {error && <p className="text-center text-[11px] font-body mt-3" style={{ color: '#FF453A' }}>{error}</p>}
      </div>
    </div>
  )
}

// Invite sheet for referral unlock (mirrors InviteSheet in ScanUnlockGate)
function PhysiqueInviteSheet({ referralCode, referralCount, onClose, onUnlocked }) {
  const [count, setCount] = useState(referralCount)
  const [sharing, setSharing] = useState(false)
  const { setIsPremium } = useStore()
  const navigate = useNavigate()

  const link = referralCode ? `https://ascendus.store/r/${referralCode}` : 'https://ascendus.store'
  const shareText = `I'm using Ascendus to track my glow-up. It gives you an AI Glow Score and a custom plan. Try it free 👇 ${link}`

  async function pollCount() {
    try { const { count: fresh } = await api.referral.count(); setCount(fresh ?? 0); return fresh ?? 0 } catch { return count }
  }

  async function handleShare() {
    setSharing(true)
    try {
      if (navigator.share) await navigator.share({ title: 'Ascendus', text: shareText, url: link })
      else await navigator.clipboard?.writeText(shareText)
      setTimeout(async () => {
        const fresh = await pollCount()
        if (fresh >= REQUIRED) {
          try {
            const { ok, isPremium: granted } = await api.referral.unlockPro()
            if (ok && granted) {
              try { sessionStorage.setItem('asc_pro_splash_shown', '1') } catch {}
              setIsPremium(true)
              onUnlocked?.()
            }
          } catch {}
        }
      }, 1500)
    } catch {}
    finally { setSharing(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        className="w-full rounded-t-3xl px-6 pt-7 flex flex-col items-center"
        style={{ background: '#141414', paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="font-heading font-bold text-[20px] text-center mb-1" style={{ color: '#fff' }}>Invite 3 Friends</p>
        <p className="font-body text-[13px] text-center mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {count}/{REQUIRED} friends signed up · Share your link to unlock results free
        </p>
        <button onClick={handleShare} disabled={sharing}
          className="w-full py-5 rounded-2xl font-heading font-bold text-[17px] disabled:opacity-60"
          style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}>
          {sharing ? 'Sharing…' : 'Share My Link'}
        </button>
        <button onClick={onClose} className="mt-4 font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Cancel</button>
      </motion.div>
    </motion.div>
  )
}

export default function PhysiqueResults() {
  const navigate = useNavigate()
  const currentScan = useStore(s => s.currentScan)
  const isPremium = useStore(s => s.isPremium)
  const setIsPremium = useStore(s => s.setIsPremium)
  const updateUser = useStore(s => s.updateUser)
  const setShowUnlockSlideshow = useStore(s => s.setShowUnlockSlideshow)
  const [revealDone, setRevealDone] = useState(false)
  const [tab, setTab] = useState('overview')
  const [showInvite, setShowInvite] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const [referralCode, setReferralCode] = useState(null)
  const [referralCount, setReferralCount] = useState(0)
  const purchaseLockRef = useRef(false)

  if (!currentScan) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
        <Dumbbell size={48} style={{ color: `${GOLD}55` }} />
        <p className="text-primary font-heading font-bold text-xl">No scan yet</p>
        <button onClick={() => navigate('/physique-scan')}
          className="w-full max-w-xs py-4 rounded-2xl font-heading font-bold text-[15px]"
          style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}>
          Start Physique Scan
        </button>
      </div>
    )
  }

  const aiScore = currentScan.aiScore ?? {}
  const physique = aiScore.physiqueResult ?? aiScore  // fallback: top-level fields
  const score = currentScan.glowScore ?? physique.overall ?? 5.0
  const tier  = currentScan.tier ?? (score >= 8 ? 'Elite' : score >= 6.5 ? 'Advanced' : score >= 5 ? 'Intermediate' : 'Beginner')
  const tierColor = TIER_COLORS[tier] ?? GOLD
  const photo = currentScan.facePhotoUrl ?? null

  const strengths    = physique.physique_strengths    ?? aiScore.physique_strengths    ?? []
  const improvements = physique.physique_improvements ?? aiScore.physique_improvements ?? []
  const notes        = physique.physique_notes        ?? aiScore.physique_notes        ?? null

  const TABS = ['overview', 'breakdown', 'improve']

  // Fetch referral info upfront so invite sheet is ready instantly
  useEffect(() => {
    if (isPremium) return
    api.referral.count()
      .then(({ count, code }) => { setReferralCount(count || 0); setReferralCode(code || null) })
      .catch(() => {})
  }, [])

  function handleUnlockSuccess() {
    purchaseLockRef.current = false
    try { sessionStorage.setItem('asc_pro_splash_shown', '1') } catch {}
    setIsPremium(true)
    updateUser?.({ is_pro: true, subscriptionTier: 'premium', subscription_tier: 'premium' })
    setShowUnlockSlideshow?.(true)
  }

  async function handleAscend() {
    if (purchaseLockRef.current) return
    purchaseLockRef.current = true
    setIsPurchasing(true); setPurchaseError('')
    try {
      if (isNative()) {
        const result = await purchasePro('monthly')
        if (result?.success) {
          api.payments.syncRc(result.customerInfo?.originalAppUserId).catch(() => {})
          handleUnlockSuccess()
          setIsPurchasing(false)
          return
        }
        if (result?.reason !== 'cancelled') setPurchaseError('Unable to complete purchase. Please try again.')
        setIsPurchasing(false)
        purchaseLockRef.current = false
        return
      }
      // Web: Stripe checkout
      const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
      const token = stored?.state?.token
      if (!token || token === 'demo-token') { setIsPurchasing(false); purchaseLockRef.current = false; navigate('/auth'); return }
      const { url } = await api.payments.createCheckout('monthly')
      window.location.href = url
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (!msg.includes('cancel')) setPurchaseError(err?.message || 'Unable to complete purchase. Please try again.')
      setIsPurchasing(false)
      purchaseLockRef.current = false
    }
  }

  function handleInvite() {
    triggerHaptic()
    setShowInvite(true)
  }

  // Free users: skip score animation entirely, go straight to paywall
  if (!isPremium && !revealDone) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0A0A0A' }}>
        <PhysiquePaywall
          photo={photo}
          onClose={() => navigate('/scan')}
          onAscend={handleAscend}
          onInvite={handleInvite}
          isPurchasing={isPurchasing}
          error={purchaseError}
        />
        <AnimatePresence>
          {showInvite && (
            <PhysiqueInviteSheet
              referralCode={referralCode}
              referralCount={referralCount}
              onClose={() => setShowInvite(false)}
              onUnlocked={() => setShowInvite(false)}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (!revealDone) {
    return <ScoreReveal score={score} tier={tier} onDone={() => { triggerHaptic(); setRevealDone(true) }} />
  }

  return (
    <div className="relative flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="relative flex-shrink-0 px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)', paddingBottom: 12 }}>
        <button
          onClick={() => { triggerHaptic(); navigate('/scan') }}
          aria-label="Go back"
          className="absolute left-4 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        >
          <ChevronLeft size={18} className="text-primary" />
        </button>
        <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: GOLD }}>PHYSIQUE SCAN</p>
        <h1 className="font-heading font-bold text-[26px] leading-tight text-primary" style={{ letterSpacing: '-0.02em' }}>Your Results</h1>
      </div>

      {/* Score hero */}
      <div className="flex-shrink-0 mx-5 mb-3 rounded-3xl overflow-hidden relative"
        style={{ background: '#0a0a0a', border: `1px solid ${tierColor}33` }}>
        {photo && (
          <img src={photo} alt="" className="w-full object-cover" style={{ maxHeight: 220, objectPosition: 'center top', filter: 'brightness(0.45) saturate(0.8)' }} />
        )}
        {!photo && <div style={{ height: 120 }} />}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-heading font-bold" style={{ fontSize: 72, lineHeight: 1, color: '#fff', textShadow: `0 0 40px ${tierColor}88`, letterSpacing: '-0.04em' }}>{score.toFixed(1)}</p>
          <span className="font-heading font-bold text-[13px] px-4 py-1.5 rounded-full mt-2"
            style={{ background: `${tierColor}22`, border: `1px solid ${tierColor}55`, color: tierColor }}>
            {tier}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 mx-5 mb-3 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => { triggerHaptic(); setTab(t) }}
            className="flex-1 py-2 rounded-xl font-heading font-bold text-[13px] capitalize transition-all"
            style={{
              background: tab === t ? 'rgba(198,168,92,0.15)' : 'transparent',
              color: tab === t ? GOLD : 'rgba(255,255,255,0.35)',
              border: tab === t ? `1px solid ${GOLD}44` : '1px solid transparent',
            }}>
            {t}
          </button>
        ))}
      </div>


      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <AnimatePresence mode="wait">
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Notes */}
              {notes && (
                <div className="mb-4 px-4 py-3 rounded-2xl" style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.2)' }}>
                  <p className="font-body text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{notes}</p>
                </div>
              )}

              {/* 5 pillars grid */}
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>5 Body Pillars</p>
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {BODY_PILLARS.map(({ key, label, detail }) => {
                  const val = physique[key] ?? aiScore[key] ?? 5.0
                  const color = val >= 7 ? '#34C759' : val >= 5 ? '#C6A85C' : '#E07A5F'
                  return (
                    <div key={key} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[12px] font-heading font-bold text-primary">{label}</p>
                        <span className="text-sm font-mono font-bold" style={{ color }}>{val.toFixed(1)}</span>
                      </div>
                      <p className="text-[9px] text-secondary font-body mb-2 leading-tight">{detail}</p>
                      <ScoreBar score={val} />
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {tab === 'breakdown' && (
            <motion.div key="breakdown" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Detailed Scores</p>
              {BODY_PILLARS.map(({ key, label, detail }) => {
                const val = physique[key] ?? aiScore[key] ?? 5.0
                const color = val >= 7 ? '#34C759' : val >= 5 ? '#C6A85C' : '#E07A5F'
                const pct = Math.max(0, ((val - 1) / 9) * 100)
                return (
                  <div key={key} className="mb-3 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-heading font-bold text-[14px] text-primary">{label}</p>
                        <p className="text-[10px] text-secondary font-body">{detail}</p>
                      </div>
                      <span className="font-heading font-bold text-[22px]" style={{ color }}>{val.toFixed(1)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <motion.div className="h-full rounded-full" style={{ background: color }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }} />
                    </div>
                  </div>
                )
              })}
            </motion.div>
          )}

          {tab === 'improve' && (
            <motion.div key="improve" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {strengths.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: '#34C759' }}>
                    <Zap size={10} /> Strengths
                  </p>
                  {strengths.map((s, i) => (
                    <div key={i} className="mb-2 flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.15)' }}>
                      <span style={{ color: '#34C759', fontSize: 14, flexShrink: 0 }}>✓</span>
                      <p className="font-body text-[12px] text-primary leading-snug">{s}</p>
                    </div>
                  ))}
                </div>
              )}

              {improvements.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: GOLD }}>
                    <Target size={10} /> Areas to Improve
                  </p>
                  {improvements.map((imp, i) => (
                    <div key={i} className="mb-2 flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.2)' }}>
                      <span style={{ color: GOLD, fontSize: 14, flexShrink: 0 }}>→</span>
                      <p className="font-body text-[12px] text-primary leading-snug">{imp}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2">
                <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <Activity size={10} /> Next Step
                </p>
                <button
                  onClick={() => { triggerHaptic(); navigate('/workout-plan') }}
                  className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
                  style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
                >
                  View Workout Plan
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
