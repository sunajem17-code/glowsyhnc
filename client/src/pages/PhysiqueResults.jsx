import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Dumbbell, Lock, X, Loader2, Check } from 'lucide-react'
import useStore from '../store/useStore'
import usePremiumUiAccess from '../utils/usePremiumUiAccess'
import { EASE_STANDARD, GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { purchasePro, isNative } from '../utils/iap'
import { api } from '../utils/api'
import { getRevealMetricTextStyles, getRevealRatingAnimation, getResultsNavigationDotButtonStyle, getUnlockedResultsHeadingStyle } from '../utils/revealAnimation'
import { getRatingColor } from '../utils/revealRatings'
import ScanPhotoComparison from '../components/ScanPhotoComparison'
import PhysiqueBreakdown from '../components/PhysiqueBreakdown'
import { ShareCard, createShareCardImage, saveShareCardImage } from '../components/ShareCardModal'
import { getPhysiqueMetricScore } from '../utils/physiqueResults'
import { REVEAL_RATINGS_LAYOUT } from '../utils/revealRatingsLayout'
import { cropPhotoToSquare } from '../utils/shareCardPhoto'

const RESULT_VIEWS = ['results', 'analysis', 'compare']
const PHYSIQUE_METRICS = [
  { key: 'overall', label: 'Overall' },
  { key: 'potential', label: 'Potential' },
  { key: 'muscle_mass', label: 'Muscle Mass' },
  { key: 'body_fat_score', label: 'Body Fat' },
  { key: 'v_taper', label: 'V-Taper' },
  { key: 'frame_width', label: 'Frame Width' },
]

function PhysiqueResultsNavigation({ activeView, showView }) {
  return (
    <div role="tablist" aria-label="Results view" className="mt-2 flex shrink-0 justify-center">
      {[
        ['results', 'Show results'],
        ['analysis', 'Show physique pros and cons'],
        ['compare', 'Show photo comparison'],
      ].map(([view, label]) => (
        <button key={view} type="button" role="tab" id={`physique-${view}-tab`} aria-label={label} aria-selected={activeView === view}
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
  )
}

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
      <div className="w-full rounded-3xl" style={{ background: '#141414', position: 'relative', zIndex: 1, padding: `${REVEAL_RATINGS_LAYOUT.panelPaddingTop}px ${REVEAL_RATINGS_LAYOUT.panelPaddingHorizontal}px ${REVEAL_RATINGS_LAYOUT.panelPaddingBottom}px` }}>
        <div className="grid grid-cols-2" style={{ columnGap: REVEAL_RATINGS_LAYOUT.columnGap, rowGap: 0 }}>
          {PHYSIQUE_METRICS.map(({ key, label }, idx) => {
            const validValue = getPhysiqueMetricScore(scan, key)
            const animation = getRevealRatingAnimation(validValue, { unlocked, reduceMotion, metricKey: label, revealRun })
            return (
              <div key={key} style={{ paddingBottom: idx < PHYSIQUE_METRICS.length - 2 ? REVEAL_RATINGS_LAYOUT.metricRowPaddingBottom : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: REVEAL_RATINGS_LAYOUT.labelMarginBottom, height: REVEAL_RATINGS_LAYOUT.labelHeight }}>
                  <p style={{ ...metricTextStyles.label, letterSpacing: '0.02em', textAlign: 'left', whiteSpace: 'nowrap' }}>{label}</p>
                  {!unlocked && (
                    <motion.span aria-hidden="true" initial={animation.lock.initial} animate={animation.lock.animate} transition={animation.lock.transition}
                      style={{ display: 'inline-flex', width: 13, height: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Lock size={13} style={{ ...metricTextStyles.lock, flexShrink: 0 }} />
                    </motion.span>
                  )}
                </div>
                {unlocked ? (
                  <motion.div aria-label={`${label}: ${validValue == null ? 'Unavailable' : `${validValue.toFixed(1)} out of 10`}`}
                    initial={animation.number.initial} animate={animation.number.animate} transition={animation.number.transition}
                    style={{ ...metricTextStyles.value, fontSize: validValue == null ? 20 : metricTextStyles.value.fontSize, marginBottom: REVEAL_RATINGS_LAYOUT.valueMarginBottom, fontVariantNumeric: 'tabular-nums', height: REVEAL_RATINGS_LAYOUT.valueHeight, display: 'flex', alignItems: 'center', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    {validValue == null ? '—' : validValue.toFixed(1)}
                  </motion.div>
                ) : (
                  <div aria-label={`${label}: Locked`} style={{ height: REVEAL_RATINGS_LAYOUT.valueHeight, display: 'flex', alignItems: 'center', marginBottom: REVEAL_RATINGS_LAYOUT.valueMarginBottom }}>
                    <div style={{ width: 72, height: 26, borderRadius: 99, background: '#fff', filter: 'blur(8px)', opacity: 0.9 }} />
                  </div>
                )}
                <div role={unlocked && validValue != null ? 'progressbar' : undefined} aria-label={`${label} score`}
                  aria-valuemin={unlocked && validValue != null ? 0 : undefined} aria-valuemax={unlocked && validValue != null ? 10 : undefined}
                  aria-valuenow={unlocked && validValue != null ? validValue : undefined} style={{ height: REVEAL_RATINGS_LAYOUT.barHeight, borderRadius: 99, background: '#2A2A2A' }}>
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
           style={{ paddingTop: `calc(max(env(safe-area-inset-top, 0px), ${isNative() ? '48px' : '0px'}) + 56px)` }}>

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
  const [isDownloadingCard, setIsDownloadingCard] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [downloadPhoto, setDownloadPhoto] = useState({ source: null, status: 'ready', url: null })
  const [rescoring, setRescoring] = useState(false)
  const [rescoreError, setRescoreError] = useState('')
  const [progressAdded, setProgressAdded] = useState(false)
  const purchaseLockRef = useRef(false)
  const downloadCardRef = useRef(null)
  const saveProgressButtonRef = useRef(null)

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
    if (!photo) {
      setDownloadPhoto({ source: photo, status: 'ready', url: null })
      return undefined
    }
    let active = true
    setDownloadPhoto({ source: photo, status: 'processing', url: null })
    cropPhotoToSquare(photo)
      .then(url => { if (active) setDownloadPhoto({ source: photo, status: 'ready', url }) })
      .catch(() => { if (active) setDownloadPhoto({ source: photo, status: 'failed', url: null }) })
    return () => { active = false }
  }, [photo])

  useEffect(() => {
    setActiveView('results')
  }, [currentScan?.id])

  function showView(view) {
    if (view === activeView) return
    setViewDirection(RESULT_VIEWS.indexOf(view) > RESULT_VIEWS.indexOf(activeView) ? 1 : -1)
    setActiveView(view)
  }

  async function handleDownloadCard() {
    if (isDownloadingCard || downloadPhoto.status === 'processing') return
    if (downloadPhoto.status === 'failed') {
      setDownloadError('Could not prepare the photo. Please try again.')
      return
    }
    setIsDownloadingCard(true)
    setDownloadError('')
    try {
      const image = await createShareCardImage(downloadCardRef.current)
      await saveShareCardImage(image)
    } catch (error) {
      console.error('[Physique results card download]', error)
      setDownloadError('Could not create the results card. Please try again.')
    } finally {
      setIsDownloadingCard(false)
    }
  }

  function handleAddToProgress() {
    if (!currentScan?.id || progressAdded) return
    try {
      useStore.setState(state => {
        const latest = state.currentScan?.id === currentScan.id ? state.currentScan : currentScan
        const saved = { ...latest, progressSavedAt: latest.progressSavedAt || new Date().toISOString() }
        const exists = state.scans.some(scan => scan.id === currentScan.id)
        return {
          currentScan: state.currentScan?.id === currentScan.id ? saved : state.currentScan,
          scans: exists
            ? state.scans.map(scan => scan.id === currentScan.id ? saved : scan)
            : [saved, ...state.scans].slice(0, 100),
        }
      })
      triggerHaptic()
      setProgressAdded(true)
      const rect = saveProgressButtonRef.current?.getBoundingClientRect()
      const flameOrigin = rect ? {
        left: rect.left + rect.width / 2 - 14,
        top: rect.top + rect.height / 2 - 14,
        width: 28,
        height: 28,
      } : null
      window.setTimeout(() => {
        navigate('/timeline', {
          replace: true,
          state: {
            savedScanId: currentScan.id,
            streakCelebration: true,
            ...(flameOrigin && !reduceMotion ? { streakFlameFlight: true, flameOrigin } : {}),
          },
        })
      }, reduceMotion ? 0 : 360)
    } catch (error) {
      console.error('[PhysiqueResults] Could not save scan to Progress:', error)
      setDownloadError('Could not save this scan. Please try again.')
    }
  }

  const missingMetrics = PHYSIQUE_METRICS.filter(({ key }) => getPhysiqueMetricScore(currentScan, key) == null)
  const savedProgressCard = Boolean(currentScan?.progressSavedAt || location.state?.source === 'progress-card')
  const isPreparingDownloadPhoto = downloadPhoto.source !== photo || downloadPhoto.status === 'processing'
  const physiqueCardMetrics = PHYSIQUE_METRICS.map(({ key, label }) => ({ label, value: getPhysiqueMetricScore(currentScan, key) }))

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
          onClose={() => navigate(location.state?.returnTo || '/scan')}
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
    <div className="flex flex-col h-full overflow-y-auto px-5" style={{ background: '#0A0A0A' }}>
      {savedProgressCard && <ShareCard scan={currentScan} facePhotoUrl={downloadPhoto.source === photo && downloadPhoto.status === 'ready' ? downloadPhoto.url : null} cardRef={downloadCardRef} metrics={physiqueCardMetrics} />}
      <div className="relative flex-shrink-0 w-full" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button
          onClick={() => { triggerHaptic(); navigate(location.state?.returnTo || '/scan') }}
          aria-label="Go back"
          className="fixed left-4 z-10 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)', background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
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
        className="relative w-full"
        style={{
          marginTop: activeView === 'results' ? 102 : activeView === 'analysis' ? 0 : 20,
          transformOrigin: '50% 50%',
          touchAction: 'pan-y',
        }}
        drag={activeView !== 'compare' && activeView !== 'analysis' ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          const index = RESULT_VIEWS.indexOf(activeView)
          if (info.offset.x < -60 || info.velocity.x < -400) showView(RESULT_VIEWS[Math.min(index + 1, RESULT_VIEWS.length - 1)])
          else if (info.offset.x > 60 || info.velocity.x > 400) showView(RESULT_VIEWS[Math.max(index - 1, 0)])
        }}
      >
        <motion.div key={activeView} initial={{ x: reduceMotion ? 0 : viewDirection * 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.25, ease: EASE_STANDARD }}>
          {activeView === 'results' && (
            <div>
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
            </div>
          )}
          {activeView === 'analysis' && (
            <div>
              <PhysiqueBreakdown
                scan={currentScan}
              />
            </div>
          )}
          {activeView === 'compare' && (
            <div>
              <ScanPhotoComparison scan={currentScan} savedScans={savedScans} />
            </div>
          )}
        </motion.div>
      </motion.div>

      <div className="w-full" style={{paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))'}}>
        {activeView === 'analysis' && savedProgressCard && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              triggerHaptic()
              navigate('/coach', { state: {
                scanId: currentScan?.serverScanId || currentScan?.aiScore?.scanId || null,
                coachPhotoUrl: photo || currentScan?.bodyPhotoUrl || currentScan?.facePhotoUrl || null,
                coachPrompt: 'Please help me understand my physique scan and suggest practical next steps based on the visible results.',
              } })
            }}
            className="scan-results-coach-button font-heading font-bold text-[17px]"
          >
            Ask AI Coach
          </motion.button>
        )}
        {!savedProgressCard && (
          <motion.button
            ref={saveProgressButtonRef}
            whileTap={{ scale: 0.97 }}
            onClick={handleAddToProgress}
            disabled={progressAdded}
            animate={progressAdded && !reduceMotion ? { scale: [1, 1.025, 1] } : undefined}
            transition={{ duration: 0.34, ease: 'easeOut' }}
            className="w-full mt-4 py-5 rounded-2xl font-heading font-bold text-[17px] flex-shrink-0 flex items-center justify-center gap-2"
            style={{ background: progressAdded ? 'linear-gradient(135deg,#f4d989 0%,#c6a85c 100%)' : GOLD_GRADIENT, color: '#0A0A0A', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
          >
            {progressAdded ? <><motion.span initial={reduceMotion ? false : { scale: 0.4, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}><Check size={19} /></motion.span> Added to Progress</> : <><Check size={19} /> Add to Progress</>}
          </motion.button>
        )}
        {activeView === 'results' && savedProgressCard && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); handleDownloadCard() }}
            disabled={isDownloadingCard || isPreparingDownloadPhoto}
            className="w-full mt-4 py-5 rounded-2xl font-heading font-bold text-[17px] flex-shrink-0 flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
          >
            {isDownloadingCard || isPreparingDownloadPhoto ? <Loader2 size={19} className="animate-spin" /> : null}
            {isDownloadingCard || isPreparingDownloadPhoto ? 'Preparing scorecard…' : 'Download Scorecard'}
          </motion.button>
        )}
        {activeView === 'results' && downloadError && <p role="alert" className="mt-3 text-center text-[12px]" style={{ color: '#FF453A' }}>{downloadError}</p>}

        <PhysiqueResultsNavigation activeView={activeView} showView={showView} />
      </div>
    </div>
  )
}
