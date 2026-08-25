import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, Eye, Smile, ScanFace, Scissors, Layers } from 'lucide-react'
import { GOLD, EASE_STANDARD } from '../utils/theme'

// Animates from 0 → pct once on mount via CSS transition.
// Immune to re-renders and prop changes — the effect has no deps so it fires
// exactly once per mount, and subsequent pct changes just transition smoothly
// from the current width rather than resetting to 0.
function ProgressBarFill({ pct }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = requestAnimationFrame(() => setW(pct))
    return () => cancelAnimationFrame(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      className="h-full rounded-full"
      style={{
        background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)',
        width: `${w}%`,
        transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    />
  )
}

// Extracted out of ScanUnlockGate.jsx so this can be statically imported by
// OnboardingFinalSteps.jsx (StepScoresWaiting's carousel) without pulling the
// whole ScanUnlockGate module — and its RevenueCat/purchase logic — out of
// its own lazy chunk and into the eager main bundle. CardShell and BlurLock
// moved too, since CategoryCard depends on both and duplicating them would
// either drift out of sync or just re-import ScanUnlockGate.jsx anyway,
// defeating the point. ScanUnlockGate.jsx now imports all four back from here.
const G    = GOLD
const TEXT = 'var(--text-primary)'
const DIM  = 'var(--text-secondary)'

// ── Card shell ────────────────────────────────────────────────────────────────

export function CardShell({ badge, icon: Icon, children, facePhotoUrl }) {
  return (
    <div className="h-full flex flex-col overflow-y-auto"
         style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 88px)' }}>
      <div className="flex flex-col px-6 pb-2">
        {/* Badge row — with optional face photo avatar */}
        <div className="flex items-center gap-2.5 mb-6 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.22)' }}
          >
            {facePhotoUrl
              ? <img src={facePhotoUrl} alt="Your scan" className="w-full h-full object-cover" />
              : <Icon size={16} style={{ color: G }} />
            }
          </div>
          <span
            className="font-heading font-bold text-[10px] tracking-[0.22em]"
            style={{ color: 'rgba(198,168,92,0.75)' }}
          >
            {badge}
          </span>
        </div>
        {/* Card content */}
        {children}
      </div>
    </div>
  )
}

export function BlurLock({ children, size = 'md', style: extraStyle = {} }) {
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

// ── Extended Metrics — 5 category cards ───────────────────────────────────────
// One shared CategoryCard component parameterized per category, rather than
// 5 near-identical components — same 2×3 tile grid as ScanUnlockGate's
// Card1Score locked metrics section (BlurLock value, lock icon, gold progress
// bar), just reading from scan.extendedMetrics.<categoryKey> instead of
// scan.pillars/faceData. Shared by ScanUnlockGate.jsx's SwipeableResultCards
// and StepScoresWaiting's onboarding carousel (components/OnboardingFinalSteps.jsx),
// so the metric config and card rendering never drift between the two screens.
export const EXTENDED_CATEGORIES = [
  {
    key: 'eyes', badge: 'EYES', icon: Eye,
    metrics: [
      { key: 'orbitalDepth',   label: 'Orbital Depth' },
      { key: 'canthalTilt',    label: 'Canthal Tilt' },
      { key: 'eyebrowDensity', label: 'Brow Density' },
      { key: 'eyelashDensity', label: 'Lash Density' },
      { key: 'eyelidExposure', label: 'Eyelid Exposure' },
      { key: 'underEyeHealth', label: 'Under-Eye Health' },
    ],
  },
  {
    key: 'lowerThird', badge: 'LOWER THIRD', icon: Smile,
    metrics: [
      { key: 'lips',               label: 'Lips' },
      { key: 'mandible',           label: 'Mandible' },
      { key: 'gonialAngle',        label: 'Gonial Angle' },
      { key: 'ramus',              label: 'Ramus' },
      { key: 'hyoidSkinTightness', label: 'Hyoid Tightness' },
      { key: 'jawWidth',           label: 'Jaw Width' },
    ],
  },
  {
    key: 'midface', badge: 'MIDFACE', icon: ScanFace,
    metrics: [
      { key: 'cheekbones',  label: 'Cheekbones' },
      { key: 'maxilla',     label: 'Maxilla' },
      { key: 'nose',        label: 'Nose' },
      { key: 'ipd',         label: 'IPD' },
      { key: 'fwhr',        label: 'FWHR' },
      { key: 'compactness', label: 'Compactness' },
    ],
  },
  {
    key: 'upperThird', badge: 'UPPER THIRD', icon: Scissors,
    metrics: [
      { key: 'norwoodStage',       label: 'Norwood Stage' },
      { key: 'foreheadProportion', label: 'Forehead Proportion' },
      { key: 'hairlineRecession',  label: 'Hairline Recession' },
      { key: 'hairThinning',       label: 'Hair Thinning' },
      { key: 'hairlineDensity',    label: 'Hairline Density' },
      { key: 'foreheadSlope',      label: 'Forehead Slope' },
    ],
  },
  {
    key: 'miscellaneous', badge: 'MISCELLANEOUS', icon: Layers,
    metrics: [
      { key: 'skin',      label: 'Skin' },
      { key: 'harmony',   label: 'Harmony' },
      { key: 'symmetry',  label: 'Symmetry' },
      { key: 'neckWidth', label: 'Neck Width' },
      { key: 'bloat',     label: 'Bloat' },
      { key: 'boneMass',  label: 'Bone Mass' },
    ],
  },
]

export function CategoryCard({ scan, categoryKey, badge, icon, metrics, isPremium = false, facePhotoUrl }) {
  const data = scan?.extendedMetrics?.[categoryKey] ?? {}
  // Extended metrics now arrive a few seconds after the core score via a
  // separate follow-up call (see Scan.jsx/PremiumOnboarding.jsx) — while it's
  // in flight, tiles show a pulsing placeholder instead of a bare "—", so
  // this reads as "still loading" rather than "no data available".
  const isPending = scan?.extendedMetricsStatus === 'pending'

  const tiles = metrics.map(({ key, label }) => {
    const score = data[key]?.score ?? null
    return {
      label,
      value: score != null ? score.toFixed(1) : 'N/A',
      unit:  score != null ? '/10' : '',
      pct:   score != null ? Math.min(100, (score / 10) * 100) : 0,
    }
  })

  return (
    <CardShell badge={badge} icon={icon} facePhotoUrl={facePhotoUrl}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {tiles.map(({ label, value, unit, pct }) => (
          <div
            key={label}
            className="rounded-2xl p-4 flex flex-col"
            style={{ background: 'rgba(198,168,92,0.03)', border: '1px solid rgba(198,168,92,0.15)' }}
          >
            <span className="font-heading font-bold text-[18px] uppercase mb-3" style={{ color: G, letterSpacing: '-0.01em' }}>
              {label}
            </span>
            <div className="flex items-center justify-between mb-2">
              {isPending && value === 'N/A' ? (
                <motion.div
                  className="h-[22px] w-12 rounded-md"
                  style={{ background: 'rgba(198,168,92,0.15)' }}
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : isPremium ? (
                <div className="flex items-end gap-0.5">
                  <span className="font-heading font-bold text-[23px] leading-none" style={{ color: TEXT }}>{value}</span>
                  {unit && <span className="font-heading font-bold text-[11px] mb-0.5" style={{ color: DIM }}>{unit}</span>}
                </div>
              ) : (
                <BlurLock size="sm">
                  <div className="flex items-end gap-0.5">
                    <span className="font-heading font-bold text-[23px] leading-none" style={{ color: TEXT }}>{value}</span>
                    {unit && <span className="font-heading font-bold text-[11px] mb-0.5" style={{ color: DIM }}>{unit}</span>}
                  </div>
                </BlurLock>
              )}
              {!isPremium && (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'rgba(198,168,92,0.18)', flexShrink: 0 }}>
                  <Lock size={12} style={{ color: 'rgba(198,168,92,0.9)' }} />
                </span>
              )}
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              {isPending && pct === 0 ? (
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)' }}
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                // Locked users never see the real fill — the bar visually
                // encodes the score even with the digit blurred above.
                <ProgressBarFill pct={isPremium ? pct : 0} />
              )}
            </div>
          </div>
        ))}
      </div>
      {isPremium && (
        <p className="text-center font-body text-[11px] mt-1 mb-3" style={{ color: 'rgba(198,168,92,0.45)' }}>
          Continue for more insight
        </p>
      )}
    </CardShell>
  )
}
