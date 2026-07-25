import { motion } from 'framer-motion'
import { Lock, Eye, Smile, ScanFace, Scissors, Layers } from 'lucide-react'
import logo from '../assets/ascendus-icon.png'
import { GOLD, EASE_STANDARD } from '../utils/theme'

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

export function CardShell({ badge, icon: Icon, children }) {
  return (
    // Outer: full height, clips overflow for scroll, applies safe-area at top
    <div className="h-full flex flex-col overflow-y-auto"
         style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0px)' }}>
      {/* Single centered block — branding + badge + content all centered together */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-2">
        {/* Branding — in the middle of the card, not pinned to top */}
        <div className="flex items-center justify-center gap-2 mb-5 flex-shrink-0">
          <img src={logo} alt="" style={{ width: 18, height: 18, mixBlendMode: 'lighten', opacity: 0.65 }} />
          <span className="font-heading font-bold text-[9px] tracking-[0.24em]" style={{ color: 'rgba(198,168,92,0.45)' }}>
            ASCENDUS
          </span>
        </div>
        {/* Badge row */}
        <div className="flex items-center gap-2.5 mb-6 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.22)' }}
          >
            <Icon size={16} style={{ color: G }} />
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

export function CategoryCard({ scan, categoryKey, badge, icon, metrics }) {
  const data = scan?.extendedMetrics?.[categoryKey] ?? {}

  const tiles = metrics.map(({ key, label }) => {
    const score = data[key]?.score ?? null
    return {
      label,
      value: score != null ? score.toFixed(1) : '—',
      unit:  score != null ? '/10' : '',
      pct:   score != null ? Math.min(100, (score / 10) * 100) : 0,
    }
  })

  return (
    <CardShell badge={badge} icon={icon}>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {tiles.map(({ label, value, unit, pct }) => (
          <div
            key={label}
            className="rounded-2xl p-3.5 flex flex-col"
            style={{ background: 'rgba(198,168,92,0.03)', border: '1px solid rgba(198,168,92,0.15)' }}
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
          </div>
        ))}
      </div>
    </CardShell>
  )
}
