import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { Star, Check, Loader2, X, Tag } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { InAppReview } from '@capacitor-community/in-app-review'
import useStore from '../store/useStore'
import { isNative, purchaseDiscountedAnnual } from '../utils/iap'
import { api } from '../utils/api'
import { triggerHaptic } from '../utils/haptics'
import logo from '../assets/ascendus-icon.png'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { EXTENDED_CATEGORIES, CategoryCard, MetricTile, TEASER_KEYS } from './CategoryCard'
import PromoModal from './PromoModal'

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
          {rated ? 'Continue' : 'Maybe later'}
        </button>
      </div>
    </div>
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

  const potential = glowScore != null
    ? Math.min(10, glowScore + 1.4).toFixed(1)
    : null

  const symmetry          = scan?.faceData?.symmetry          ?? null
  const jawlineDefinition = scan?.faceData?.jawlineDefinition ?? null
  const skinClarity       = scan?.faceData?.skinClarity       ?? null
  const facialProportions = scan?.faceData?.facialProportions ?? null

  function toScorePct(v) {
    return v != null ? Math.min(100, (v / 10) * 100) : 0
  }


  // Six real fields — same as Card1Score, not fabricated categories. Only
  // TEASER_KEYS.overall ('potential') is ever shown for real here — this
  // card has no isPremium prop at all (pre-purchase only), so every other
  // tile locks unconditionally.
  const lockedMetrics = [
    { key: 'pslTier',           label: 'PSL Tier',           value: tier ?? 'N/A',                                                  unit: '',                                    pct: glowScore != null ? Math.min(100, (glowScore / 10) * 100) : 0 },
    { key: 'potential',         label: 'Potential',          value: potential ?? 'N/A',                                              unit: potential ? '/10' : '',                pct: potential != null ? Math.min(100, (parseFloat(potential) / 10) * 100) : 0 },
    { key: 'symmetry',          label: 'Symmetry',           value: symmetry != null ? symmetry.toFixed(1) : 'N/A',                  unit: symmetry != null ? '/10' : '',          pct: toScorePct(symmetry) },
    { key: 'jawline',           label: 'Jawline',            value: jawlineDefinition != null ? jawlineDefinition.toFixed(1) : 'N/A', unit: jawlineDefinition != null ? '/10' : '', pct: toScorePct(jawlineDefinition) },
    { key: 'skinClarity',       label: 'Skin Clarity',       value: skinClarity != null ? skinClarity.toFixed(1) : 'N/A',             unit: skinClarity != null ? '/10' : '',       pct: toScorePct(skinClarity) },
    { key: 'facialProportions', label: 'Facial Proportions', value: facialProportions != null ? facialProportions.toFixed(1) : 'N/A', unit: facialProportions != null ? '/10' : '', pct: toScorePct(facialProportions) },
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

      <div className="flex flex-col px-6 overflow-y-auto"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 88px)' }}>

        {/* ── Overall badge row — matches CardShell's icon+label pattern ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="flex items-center gap-2.5 mb-6 flex-shrink-0"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.22)' }}
          >
            <Star size={16} style={{ color: G }} />
          </div>
          <span
            className="font-heading font-bold text-[10px] tracking-[0.22em]"
            style={{ color: 'rgba(198,168,92,0.75)' }}
          >
            OVERALL
          </span>
        </motion.div>

        {/* ── Six metric cards — 2×3 grid, same MetricTile as every other
            category card (UPPER THIRD etc.) so boxes are byte-identical.
            Only TEASER_KEYS.overall ('potential') reveals for real. ────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-3 mb-3"
        >
          {lockedMetrics.map(({ key, label, value, unit, pct }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 + i * 0.05 }}
            >
              <MetricTile label={label} value={value} unit={unit} pct={pct} locked={key !== TEASER_KEYS.overall} />
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
// "Ready to Transform" CTA below is untouched, still a flat call to onAscend.

// ── Exit-intent: annual-discount offer ──────────────────────────────────────
// Shown every time the user taps the close (X) on StepScoresWaiting — there
// is deliberately no "only show once, skip straight through afterward" path.
// An earlier version gated this behind a persisted flag so only the first-
// ever tap saw the offer and every tap after that skipped straight to a
// free/limited-access exit; that was a real bypass and has been removed.
// Same modal-shell pattern as PromoModal.jsx (backdrop + centered
// gold-bordered card) for visual consistency with the other overlay already
// used on this exact screen.
//
// Wired to the real com.ascendus.app.yearly.discount product via
// purchaseDiscountedAnnual() (utils/iap.js), which searches every RevenueCat
// offering for a package whose underlying store product matches that ID —
// purchasePro() alone can't reach it since that only resolves the standard
// monthly/annual slots. If RevenueCat doesn't have the product attached to
// any offering yet, purchaseDiscountedAnnual() resolves reason:'not_configured'
// and handleClaimOffer below shows that as a real, honest "not available yet"
// message instead of pretending the purchase happened.
function AnnualDiscountOfferModal({ onClaim, onDecline, loading = false, error = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[80] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onDecline() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.22, ease: EASE_STANDARD }}
        className="w-full max-w-[320px] rounded-2xl p-6 text-center"
        style={{
          background: '#111111',
          border: '1px solid rgba(198,168,92,0.22)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(198,168,92,0.08)',
        }}
      >
        <div className="flex justify-end mb-1">
          <button
            onClick={onDecline}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.07)' }}
            aria-label="Close"
          >
            <X size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.25)' }}
        >
          <Tag size={26} style={{ color: G }} />
        </div>

        <p className="font-heading font-bold text-[20px] text-white leading-tight mb-2">
          Wait, before you go.
        </p>
        <p className="font-body text-[13px] leading-relaxed mb-5" style={{ color: DIM }}>
          Take 50% off your first year, just for today.
        </p>

        <div className="flex items-center justify-center gap-2 mb-5">
          <span className="font-body text-[15px] line-through" style={{ color: 'rgba(255,255,255,0.35)' }}>$49.99/yr</span>
          <span className="font-heading font-bold text-[26px]" style={{ color: G }}>$24.99/yr</span>
        </div>

        {error && (
          <p className="font-body text-[11px] mb-3" style={{ color: '#EF4444' }}>{error}</p>
        )}

        <button
          onClick={onClaim}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl font-heading font-bold text-[14px] text-black transition-all duration-200 active:scale-[0.97] mb-2.5 disabled:opacity-70 flex items-center justify-center gap-2"
          style={{ background: GOLD_GRAD, boxShadow: '0 4px 16px rgba(198,168,92,0.3)' }}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Processing…' : 'Claim Discount ($24.99/yr)'}
        </button>
        <button
          onClick={onDecline}
          disabled={loading}
          className="w-full py-2 font-body text-[12px] transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          No thanks, I'll pay full price later
        </button>
      </motion.div>
    </motion.div>
  )
}

export function StepScoresWaiting({ onAscend, onPromoSuccess, scan, isPurchasing = false, error = '' }) {
  const [cardIdx, setCardIdx] = useState(0)
  const containerRef = useRef(null)
  const [containerW, setContainerW] = useState(0)
  // Driven imperatively (see snapTo below) instead of via the `animate` prop.
  // `animate={{x:...}}` only re-fires when its target value actually changes
  // between renders, so a swipe that didn't cross the page threshold (same
  // cardIdx before and after) never re-triggered it — the rail was left
  // wherever the raw drag gesture let go instead of snapping back ("stuck in
  // the middle"). Same fix as ScanUnlockGate.jsx's SwipeableResultCards.
  const x = useMotionValue(0)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([e]) => setContainerW(e.contentRect.width))
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  function snapTo(idx) {
    animate(x, -idx * containerW, { type: 'tween', duration: 0.32, ease: [0.25, 0.1, 0.25, 1] })
  }

  useEffect(() => {
    if (!containerW) return
    snapTo(cardIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIdx, containerW])
  const [showPromo, setShowPromo] = useState(false)
  const [showDiscountOffer, setShowDiscountOffer] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimError, setClaimError] = useState('')
  const setIsPremium = useStore(s => s.setIsPremium)
  const updateUser   = useStore(s => s.updateUser)

  // Every tap of the X shows the discount offer — no persisted "already seen
  // it, skip straight through" state. There is intentionally no way to exit
  // this screen into any free/limited-access view; the only forward paths
  // are purchase, referral, or a promo code.
  function handleCloseAttempt() {
    triggerHaptic()
    setClaimError('')
    setShowDiscountOffer(true)
  }

  // Decline just dismisses the popup — the user lands back on this same
  // Ascendus Analysis screen, no navigation, no free/limited-access exit.
  function handleDeclineOffer() {
    triggerHaptic()
    setShowDiscountOffer(false)
  }

  async function handleClaimOffer() {
    triggerHaptic()
    if (!isNative()) {
      // Web has no equivalent Stripe price for this offer yet — flag rather
      // than silently doing nothing or granting anything unpurchased.
      setClaimError('This offer is only available in the app right now.')
      return
    }
    setClaimLoading(true)
    setClaimError('')
    try {
      const result = await purchaseDiscountedAnnual()
      if (result?.success) {
        const rcUserId = result.customerInfo?.originalAppUserId
        api.payments.syncRc(rcUserId).catch(() => {})
        setIsPremium(true)
        setShowDiscountOffer(false)
        onPromoSuccess?.()
        return
      }
      if (result?.reason === 'not_configured') {
        setClaimError("This offer isn't set up yet. Please try again shortly.")
      } else if (result?.reason !== 'cancelled') {
        setClaimError('Unable to complete purchase. Please try again.')
      }
    } catch {
      setClaimError('Unable to complete purchase. Please try again.')
    } finally {
      setClaimLoading(false)
    }
  }

  const cards = [
    { id: 'overall', el: <OverallCard scan={scan} /> },
    ...EXTENDED_CATEGORIES.map(cat => ({
      id: cat.key,
      // isPremium is hardcoded false — this screen is pre-purchase only, it
      // must never trust the global store's live isPremium (which is how
      // every category tile ended up fully unlocked here: a device/account
      // reaching onboarding with stale isPremium=true left over from an
      // earlier session made these tiles show real values while OverallCard
      // right next to it — never wired to isPremium at all — stayed locked).
      el: <CategoryCard scan={scan} categoryKey={cat.key} badge={cat.badge} icon={cat.icon} metrics={cat.metrics} isPremium={false} />,
    })),
  ]

  function goTo(idx) {
    if (idx === cardIdx) return
    setCardIdx(idx)
  }

  function handleDragEnd(_, info) {
    const DISTANCE = 60
    const VELOCITY = 400
    let nextIdx = cardIdx
    if ((info.offset.x < -DISTANCE || info.velocity.x < -VELOCITY) && cardIdx < cards.length - 1) {
      nextIdx = cardIdx + 1
    } else if ((info.offset.x > DISTANCE || info.velocity.x > VELOCITY) && cardIdx > 0) {
      nextIdx = cardIdx - 1
    }
    if (nextIdx !== cardIdx) {
      goTo(nextIdx)
    } else {
      // Swipe didn't cross the page threshold — snap back to the current
      // card explicitly instead of leaving the rail stranded mid-drag.
      snapTo(cardIdx)
    }
  }

  return (
    <div className="flex flex-col h-full relative" style={{ background: BG }}>
      {/* Close — top-right corner, same size/shape/token convention as
          BodyStatsStep.jsx's close button, adapted to this screen's own
          forced-dark palette (SURFACE/TEXT) instead of the light/dark-
          adaptive CSS vars that button uses, since this screen never
          follows system theme. */}
      <button
        onClick={handleCloseAttempt}
        aria-label="Close"
        className="absolute right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 44px)', background: SURFACE, border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <X size={17} style={{ color: TEXT }} />
      </button>

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 flex"
          style={{ width: containerW * cards.length, x }}
          drag="x"
          dragConstraints={{ left: -(cards.length - 1) * containerW, right: 0 }}
          dragElastic={0}
          onDragEnd={handleDragEnd}
        >
          {cards.map((card) => (
            <div key={card.id} className="h-full flex-shrink-0" style={{ width: containerW || '100vw' }}>
              {card.el}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Dot pagination */}
      <div className="flex items-center justify-center gap-1.5 py-3 flex-shrink-0">
        {cards.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === cardIdx ? 'rgba(198,168,92,1)' : 'rgba(255,255,255,0.25)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <div className="px-6 pb-10 pt-2 flex-shrink-0">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          whileTap={{ scale: isPurchasing ? 1 : 0.97 }}
          onClick={onAscend}
          disabled={isPurchasing}
          className="btn-primary flex items-center justify-center gap-2.5 disabled:opacity-70"
          style={{ background: GOLD_GRAD, fontSize: 19, letterSpacing: '0.02em', color: 'white', paddingTop: 19, paddingBottom: 19 }}
        >
          {/* isPurchasing/error were accepted as props but never rendered —
              handleAscend genuinely ran and genuinely failed (no Stripe keys
              configured in this env, or an early demo-token redirect), it
              just had nowhere to show it. Same spinner/disabled/error pattern
              as ScanUnlockGate's own button, so behavior doesn't drift between
              the two screens.

              color: 'white' here overrides .btn-primary's own color: #0A0A0A
              (inline style beats a class selector, so this only affects this
              one button, not the other gold CTAs sharing that class). Per the
              user's explicit call despite the earlier contrast finding (white
              against this exact gradient measures ~1.9:1 at the lighter stop,
              below the 3:1 floor for bold/large text — worse than the black
              it replaces). Sparkles below gets the same explicit white so it
              doesn't end up mismatched against the now-white label.

              paddingTop/Bottom + fontSize here bump this one CTA above the
              app-wide py-4/text-[15px] convention baked into .btn-primary
              itself (index.css) — there's no separate "large button" variant
              anywhere else to reuse; this is the app's one CTA size, made
              deliberately bigger just for this button per explicit request. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isPurchasing ? 'processing' : 'ready'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: EASE_STANDARD }}
              className="flex items-center justify-center gap-2.5"
            >
              {isPurchasing && <Loader2 size={20} className="animate-spin" />}
              {isPurchasing ? 'Processing…' : 'Ready to Transform'}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        {error && (
          <p className="text-center text-[12px] font-body font-semibold mt-2" style={{ color: TEXT }}>{error}</p>
        )}

        <p className="text-center font-body mt-2" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, lineHeight: 1.5 }}>
          Pro: $9.99/month or $49.99/year · Auto-renews unless cancelled 24h before renewal · Cancel anytime in Settings
          {' · '}
          <a href="https://ascendus.store/privacy" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Privacy Policy</a>
          {' · '}
          <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Terms of Use</a>
        </p>

        {/* Promo code entry — web only, same as Premium.jsx/ScanUnlockGate.jsx/
            Results.jsx (Apple IAP doesn't support external promo codes, so this
            must never appear in a native build). Reuses the existing
            PromoModal/redeem endpoint rather than a new one-off input. */}
        {!isNative() && (
          <button
            onClick={() => setShowPromo(true)}
            disabled={isPurchasing}
            className="w-full mt-2 py-2 font-body text-[12px] text-center transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ color: 'rgba(198,168,92,0.5)' }}
          >
            Have a promo code?
          </button>
        )}
      </div>

      <AnimatePresence>
        {showPromo && (
          <PromoModal
            onClose={() => setShowPromo(false)}
            onSuccess={() => {
              // PromoModal stopped mutating the store itself a while back —
              // every caller owns its own setIsPremium now (see Results.jsx's
              // PaywallSheet for the same fix). This one was still missing
              // it, so redeeming here showed the success animation and then
              // just navigated on with isPremium still false.
              setIsPremium(true)
              updateUser({ is_pro: true, subscriptionTier: 'premium', subscription_tier: 'premium' })
              setShowPromo(false)
              onPromoSuccess?.()
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDiscountOffer && (
          <AnnualDiscountOfferModal
            onClaim={handleClaimOffer}
            onDecline={handleDeclineOffer}
            loading={claimLoading}
            error={claimError}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
