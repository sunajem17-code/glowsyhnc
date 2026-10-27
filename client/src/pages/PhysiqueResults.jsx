import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Dumbbell, Lock, X, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import usePremiumUiAccess from '../utils/usePremiumUiAccess'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { purchasePro, isNative } from '../utils/iap'
import { api } from '../utils/api'
import { getRevealMetricTextStyles, getRevealRatingAnimation, getResultsNavigationDotButtonStyle, getUnlockedResultsHeadingStyle } from '../utils/revealAnimation'
import { getRatingColor } from '../utils/revealRatings'
import ScanPhotoComparison from '../components/ScanPhotoComparison'
import PhysiqueBreakdown from '../components/PhysiqueBreakdown'
import { getPhysiqueMetricScore } from '../utils/physiqueResults'
import { getProgressCardReturnTo } from '../utils/scanResultContext'

const RESULT_VIEWS = ['results', 'analysis', 'compare']
const PHYSIQUE_METRICS = [
  { key: 'overall', label: 'Overall' },
  { key: 'potential', label: 'Potential' },
  { key: 'muscle_mass', label: 'Muscle Mass' },
  { key: 'body_fat_score', label: 'Body Fat' },
  { key: 'v_taper', label: 'V-Taper' },
  { key: 'frame_width', label: 'Frame Width' },
]

function PhysiqueScorecard({ photo, scan, unlocked, revealRun = 0 }) {
  const reduceMotion = useReducedMotion()
  const metricTextStyles = getRevealMetricTextStyles()
  return (
    <div className="relative w-full">
      <div style={{ position: 'absolute', top: -90, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
        <div style={{ width: 131, height: 131, borderRadius: '50%', border: '3px solid #fff', background: '#0A0A0A', overflow: 'hidden' }}>
          {photo ? <img src={photo} alt="" loading="eager" decoding="async" className="w-full h-full object-cover" /> : null}
        </div>
      </div>
      <div className="w-full rounded-3xl pt-14 pb-10 px-4" style={{ background: '#141414', position: 'relative', zIndex: 1 }}>
        <div className="grid grid-cols-2 gap-x-6" style={{ rowGap: 0 }}>
          {PHYSIQUE_METRICS.map(({ key, label }, idx) => {
            const validValue = getPhysiqueMetricScore(scan, key)
            const animation = getRevealRatingAnimation(validValue, { unlocked, reduceMotion, metricKey: label, revealRun })
            return (
              <div key={key} style={{ paddingBottom: idx < PHYSIQUE_METRICS.length - 2 ? 28 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, height: 21 }}>
                  <p style={{ ...metricTextStyles.label, letterSpacing: '0.02em', textAlign: 'left', whiteSpace: 'nowrap' }}>{label}</p>
                  <motion.span aria-hidden="true" initial={animation.lock.initial} animate={animation.lock.animate} transition={animation.lock.transition}
                    style={{ display: 'inline-flex', width: 13, height: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Lock size={13} style={{ ...metricTextStyles.lock, flexShrink: 0 }} />
                  </motion.span>
                </div>
                {unlocked ? (
                  <motion.div aria-label={`${label}: ${validValue == null ? 'Unavailable' : `${validValue.toFixed(1)} out of 10`}`}
                    initial={animation.number.initial} animate={animation.number.animate} transition={animation.number.transition}
                    style={{ ...metricTextStyles.value, fontSize: validValue == null ? 20 : metricTextStyles.value.fontSize, marginBottom: 12, fontVariantNumeric: 'tabular-nums', height: 36, display: 'flex', alignItems: 'center', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    {validValue == null ? '—' : validValue.toFixed(1)}
                  </motion.div>
                ) : (
                  <div aria-label={`${label}: Locked`} style={{ height: 36, display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ width: 72, height: 26, borderRadius: 99, background: '#fff', filter: 'blur(8px)', opacity: 0.9 }} />
                  </div>
                )}
                <div role={unlocked && validValue != null ? 'progressbar' : undefined} aria-label={`${label} score`}
                  aria-valuemin={unlocked && validValue != null ? 0 : undefined} aria-valuemax={unlocked && validValue != null ? 10 : undefined}
                  aria-valuenow={unlocked && validValue != null ? validValue : undefined} style={{ height: 7, borderRadius: 99, background: '#2A2A2A' }}>
                  <motion.div key={unlocked ? 'revealed' : 'locked'} initial={animation.bar.initial} animate={animation.bar.animate} transition={animation.bar.transition}
                    style={{ height: '100%', borderRadius: 99, color: unlocked && validValue != null ? getRatingColor(validValue) : '#444', background: 'currentColor' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const REQUIRED = 3

// Clone of LockedRevealScreen from ScanUnlockGate — physique text only
function PhysiquePaywall({ photo, scan, onClose, onAscend, onInvite, isPurchasing, error }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0A0A0A' }}>
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
        <h1 className="font-heading font-bold text-[32px] text-center leading-tight mb-2" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
          Reveal your physique
        </h1>
        <p className="font-body text-[14px] text-center mb-0" style={{ color: 'rgba(255,255,255,0.5)' }}>
          See your full physique ratings with Ascendus Max
        </p>

        <div style={{ marginTop: 120, width: '100%' }}>
          <PhysiqueScorecard photo={photo} scan={scan} unlocked={false} />
        </div>

        {/* CTAs */}
        <div className="w-full flex flex-col gap-3.5" style={{ marginTop: 26 }}>
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
  const location = useLocation()
  const progressReturnTo = getProgressCardReturnTo(location.state)
  const reduceMotion = useReducedMotion()
  const currentScan = useStore(s => s.currentScan)
  const savedScans = useStore(s => s.scans)
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const setScans = useStore(s => s.setScans)
  const isPremium = usePremiumUiAccess()
  const setIsPremium = useStore(s => s.setIsPremium)
  const updateUser = useStore(s => s.updateUser)
  const setShowUnlockSlideshow = useStore(s => s.setShowUnlockSlideshow)
  const [storedPhoto, setStoredPhoto] = useState(null)
  const [activeView, setActiveView] = useState('results')
  const [viewDirection, setViewDirection] = useState(1)
  const [showInvite, setShowInvite] = useState(false)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const [referralCode, setReferralCode] = useState(null)
  const [referralCount, setReferralCount] = useState(0)
  const [shareStatus, setShareStatus] = useState('')
  const [sharingResults, setSharingResults] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const [rescoreError, setRescoreError] = useState('')
  const purchaseLockRef = useRef(false)

  const aiScore = currentScan?.aiScore ?? {}
  const photo = currentScan?.facePhotoUrl ?? storedPhoto ?? null

  // Fetch referral info upfront so invite sheet is ready instantly
  useEffect(() => {
    if (isPremium) return
    api.referral.count()
      .then(({ count, code }) => { setReferralCount(count || 0); setReferralCode(code || null) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    if (!currentScan?.facePhotoUrl && currentScan?.id) {
      import('../utils/scanPhotoDb.js').then(({ loadScanMedia }) =>
        loadScanMedia(currentScan.id).then(media => { if (active) setStoredPhoto(media?.photo ?? null) })
      ).catch(() => {})
    }
    return () => { active = false }
  }, [currentScan?.id, currentScan?.facePhotoUrl])

  useEffect(() => {
    setActiveView('results')
  }, [currentScan?.id])

  function showView(view) {
    if (view === activeView) return
    setViewDirection(RESULT_VIEWS.indexOf(view) > RESULT_VIEWS.indexOf(activeView) ? 1 : -1)
    setActiveView(view)
  }

  async function handleShareResults() {
    const scores = PHYSIQUE_METRICS
      .map(({ key, label }) => {
        const value = getPhysiqueMetricScore(currentScan, key)
        return `${label}: ${value == null ? 'Unavailable' : `${value.toFixed(1)}/10`}`
      })
      .join('\n')
    const shareData = { title: 'My Physique Results', text: `My Ascendus physique results:\n${scores}` }
    setSharingResults(true)
    setShareStatus('')
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.text)
        setShareStatus('Results copied')
      } else {
        setShareStatus('Sharing is unavailable on this device')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setShareStatus('Could not share results')
    } finally {
      setSharingResults(false)
    }
  }

  const missingMetrics = PHYSIQUE_METRICS.filter(({ key }) => getPhysiqueMetricScore(currentScan, key) == null)

  async function handleRescoreMissingMetrics() {
    const bodyImage = currentScan?.bodyPhotoUrl || currentScan?.facePhotoUrl || storedPhoto
    if (!bodyImage) {
      setRescoreError('The saved scan photo is unavailable. Start a new physique scan to get these ratings.')
      return
    }
    setRescoring(true)
    setRescoreError('')
    try {
      const result = await api.ai.scorePhysique({ bodyImage, gender: currentScan?.gender || 'male' })
      const physiqueScore = result?.physiqueScore ?? result?.physiqueResult ?? result
      const updated = {
        ...currentScan,
        physiqueScore,
        aiScore: { ...(currentScan.aiScore || {}), ...physiqueScore, physiqueScore },
      }
      const stillMissing = PHYSIQUE_METRICS.filter(({ key }) => getPhysiqueMetricScore(updated, key) == null)
      if (stillMissing.length) {
        const returnedFields = Object.keys(physiqueScore || {}).join(', ')
        console.error('[PhysiqueResults] Rescore response is missing display ratings', {
          missing: stillMissing.map(({ key }) => key),
          returnedFields,
        })
        throw new Error(`The scorer response is incomplete. Missing: ${stillMissing.map(({ label }) => label).join(', ')}. Returned fields: ${returnedFields || 'none'}.`)
      }
      setCurrentScan(updated)
      setScans([updated, ...savedScans.filter(scan => scan.id !== updated.id)])
    } catch (error) {
      setRescoreError(error?.message || 'Could not calculate the missing ratings. Please try again.')
    } finally {
      setRescoring(false)
    }
  }

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
          useStore.getState().setUpgradeWelcomePending(true)
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

  if (!isPremium) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0A0A0A' }}>
        <PhysiquePaywall
          photo={photo}
          scan={currentScan}
          onClose={() => navigate(progressReturnTo || '/scan')}
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

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#0A0A0A' }}>
      <div className="relative flex-shrink-0 w-full px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button
          onClick={() => { triggerHaptic(); navigate(progressReturnTo || '/scan') }}
          aria-label="Go back"
          className="absolute left-4 top-3 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform z-10"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
        >
          <ChevronLeft size={18} className="text-primary" />
        </button>
        <div className="relative w-full">
          <h1 className="font-heading font-bold text-[32px] text-center leading-tight mb-2" style={{ color: '#fff', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, letterSpacing: '-0.02em', ...getUnlockedResultsHeadingStyle('Your Results') }}>
            Your Results
          </h1>
        </div>
        <div className="h-5 flex items-start justify-center"><span aria-hidden="true" /></div>
      </div>

      <motion.div
        className="relative w-full px-2"
        style={{
          marginTop: activeView === 'results' ? 150 : 0,
          flex: activeView === 'analysis' ? '1 1 auto' : '0 0 auto',
          display: activeView === 'analysis' ? 'flex' : undefined,
          alignItems: activeView === 'analysis' ? 'stretch' : undefined,
          transformOrigin: '50% 50%',
          touchAction: 'pan-y',
        }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          const index = RESULT_VIEWS.indexOf(activeView)
          if (info.offset.x < -60 || info.velocity.x < -400) showView(RESULT_VIEWS[Math.min(index + 1, RESULT_VIEWS.length - 1)])
          else if (info.offset.x > 60 || info.velocity.x > 400) showView(RESULT_VIEWS[Math.max(index - 1, 0)])
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {activeView === 'results' && (
            <motion.div key="results" initial={{ x: reduceMotion ? 0 : viewDirection * 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: reduceMotion ? 0 : -viewDirection * 24, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
              <PhysiqueScorecard photo={photo} scan={currentScan} unlocked />
              {missingMetrics.length > 0 && (
                <div className="mt-3 rounded-2xl p-4 text-center" style={{ background: '#141414', border: '1px solid rgba(198,168,92,0.18)' }}>
                  <p className="font-body text-[13px] mb-3" style={{ color: 'rgba(255,255,255,0.62)' }}>
                    {missingMetrics.length} rating{missingMetrics.length === 1 ? '' : 's'} missing from this saved scan. Re-score its photo to fill them in.
                  </p>
                  <button type="button" onClick={handleRescoreMissingMetrics} disabled={rescoring}
                    className="rounded-xl px-5 py-3 font-heading font-bold text-[14px] disabled:opacity-60"
                    style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}>
                    {rescoring ? 'Re-scoring…' : 'Rescore Missing Metrics'}
                  </button>
                  {rescoreError && <p role="alert" className="mt-3 text-[12px]" style={{ color: '#FF6B57' }}>{rescoreError}</p>}
                </div>
              )}
            </motion.div>
          )}
          {activeView === 'analysis' && (
            <motion.div key="analysis" className="flex flex-1 min-h-0 flex-col" initial={{ x: reduceMotion ? 0 : viewDirection * 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: reduceMotion ? 0 : -viewDirection * 24, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
              <PhysiqueBreakdown scan={currentScan} coachPhotoUrl={photo} />
            </motion.div>
          )}
          {activeView === 'compare' && (
            <motion.div key="compare" initial={{ x: reduceMotion ? 0 : viewDirection * 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: reduceMotion ? 0 : -viewDirection * 24, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
              <ScanPhotoComparison scan={currentScan} savedScans={savedScans} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {activeView === 'results' && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleShareResults}
          disabled={sharingResults}
          className="w-[calc(100%-1rem)] mx-auto mt-4 py-5 rounded-2xl font-heading font-bold text-[17px] flex-shrink-0 disabled:opacity-70"
          style={{ background: GOLD_GRADIENT, color: '#0A0A0A', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
        >
          {sharingResults ? 'Sharing…' : shareStatus || 'Share Results'}
        </motion.button>
      )}

      <div role="tablist" aria-label="Results view" className="flex justify-center mt-2 mb-6 flex-shrink-0">
        {[
          ['results', 'Show results'],
          ['analysis', 'Show physique pros and cons'],
          ['compare', 'Show photo comparison'],
        ].map(([view, label]) => (
          <button key={view} role="tab" id={`physique-${view}-tab`} aria-label={label} aria-selected={activeView === view}
            onClick={() => { triggerHaptic(); showView(view) }} onKeyDown={event => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault()
                const direction = event.key === 'ArrowRight' ? 1 : -1
                const index = (RESULT_VIEWS.indexOf(activeView) + direction + RESULT_VIEWS.length) % RESULT_VIEWS.length
                showView(RESULT_VIEWS[index])
              }
            }} className="flex items-center justify-center" style={getResultsNavigationDotButtonStyle()}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeView === view ? GOLD : 'rgba(255,255,255,0.25)', transition: 'background 0.2s' }} />
          </button>
        ))}
      </div>
    </div>
  )
}
