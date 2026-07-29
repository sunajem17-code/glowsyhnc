import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, FlaskConical, Download, Loader2, RotateCcw, ChevronDown } from 'lucide-react'
import html2canvas from 'html2canvas'
import { getTiersForGender } from '../utils/analysis'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { isNative } from '../utils/camera'
import logoSrc from '../assets/ascendus-icon.png'

// ── Secret, dev-only "fake the numbers" card ───────────────────────────────────
// Rendered ONLY when the signed-in account redeemed the SOHAIL promo code
// (checked server-side, see user.promoRedeemed — not spoofable from the
// client). Deliberately a completely separate component from ShareCardModal /
// ShareCard: this never reads or writes the real scan record, never shares
// the same JSX tree as the card real users see, and has zero risk of leaking
// into or altering the actual share-card flow. Purely a standalone scratchpad
// for previewing "what would a 9.2 Chad card look like."

// 0.0 – 10.0 in 0.1 steps. Using a real <select> instead of a number input
// sidesteps the native-input formatting quirks (padded "04", refusing single
// digits) — a select just shows exactly the option text you picked, always.
const SCORE_OPTIONS = Array.from({ length: 101 }, (_, i) => (i / 10).toFixed(1))

// Solid fill color for the stat progress bars — was a 2-stop gradient, user
// asked for a flat solid color instead. Only two buckets now: green at 7+,
// red below — the old amber middle tier read as "gold", user wants that red.
function barColor(val) {
  if (val >= 7) return '#2ecc71'
  return '#E74C3C'
}

// Tier-rank text color. Independent of each tier's own palette color in
// analysis.js — this is a simplified 3-bucket rule: strictly better than
// "High Tier Normie/Becky" reads green, strictly worse than "Mid Tier
// Normie/Becky" reads red, and the two middle tiers themselves stay gold.
function rankColor(tiers, label) {
  const idx = tiers.findIndex(t => t.label === label)
  const highIdx = tiers.findIndex(t => t.label.startsWith('High Tier'))
  const midIdx = tiers.findIndex(t => t.label.startsWith('Mid Tier'))
  if (idx === -1 || highIdx === -1 || midIdx === -1) return GOLD
  if (idx < highIdx) return '#2ecc71'   // better than High Tier — green
  if (idx > midIdx) return '#FF4757'    // worse than Mid Tier — red
  return GOLD                           // High Tier / Mid Tier themselves
}

// Labeled dropdown + progress bar for Overall/Potential.
function StatDropdown({ label, value, onChange, color, barOverride }) {
  const v = Number(value)
  const pct = Math.max(0, Math.min(100, (v / 10) * 100))
  return (
    <div
      className="flex-1 rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="text-[10px] font-heading font-bold tracking-[0.16em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </div>
      <div className="relative mb-3">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent font-heading font-black outline-none appearance-none"
          style={{ color: color ?? '#fff', fontSize: 28, letterSpacing: '-0.02em', paddingRight: 18 }}
        >
          {SCORE_OPTIONS.map(opt => (
            <option key={opt} value={opt} style={{ background: '#111', color: '#fff' }}>
              {opt} /10
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barOverride ?? barColor(v) }} />
      </div>
    </div>
  )
}

// ── Off-screen, non-interactive capture target ──────────────────────────────
// html2canvas rendering the SAME tree as the live editable card (full of
// <select> elements, vw-relative clamp() font sizes, appearance:none
// dropdowns) came out squished/deformed — cloned form controls and viewport
// units don't reliably survive html2canvas's DOM clone step. Fix: a totally
// separate, plain-div/plain-text render at a fixed pixel width, kept off
// screen (not display:none — html2canvas needs an actual layout box), built
// purely from the same overall/potential/tierLabel values. This mirrors the
// pattern already used in ShareCardModal.jsx (its ShareCard is a distinct
// off-screen component from the interactive editor).
const CARD_W = 360

function StatBlock({ label, value, color, barOverride }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / 10) * 100))
  return (
    <div style={{ flex: 1, borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8, color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', color, marginBottom: 12, lineHeight: 1 }}>
        {value} /10
      </div>
      <div style={{ height: 3, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: barOverride ?? barColor(Number(value)) }} />
      </div>
    </div>
  )
}

function CaptureCard({ overall, potential, tierLabel, tierColor }) {
  return (
    <div style={{ width: CARD_W, background: '#000000', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 28, overflow: 'hidden', fontFamily: 'inherit', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 0 20px' }}>
        <img src={logoSrc} alt="Ascendus" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.26em', color: GOLD }}>ASCENDUS</div>
      </div>
      <div style={{ textAlign: 'center', padding: '6px 16px 12px 16px' }}>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', color: tierColor, textShadow: `0 0 24px ${tierColor}55`, lineHeight: 1.15 }}>
          {tierLabel}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '4px 20px 24px 20px' }}>
        <StatBlock label="Overall" value={overall} color="#ffffff" />
        <StatBlock label="Potential" value={potential} color="#ffffff" barOverride="#2ecc71" />
      </div>
    </div>
  )
}

export default function DevRankCard({ scan, onClose }) {
  const captureRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  const gender = scan?.gender === 'female' ? 'female' : 'male'
  const tiers = getTiersForGender(gender)

  const realOverall   = scan?.glowScore ?? (scan?.umaxScore != null ? scan.umaxScore / 10 : null) ?? 0
  const realPotential = Math.min(10, realOverall + 1.4)
  const realTier       = tiers.find(t => t.label === scan?.tier) ?? tiers[Math.floor(tiers.length / 2)]

  const [overall,   setOverall]   = useState(realOverall.toFixed(1))
  const [potential, setPotential] = useState(realPotential.toFixed(1))
  const [tierLabel, setTierLabel] = useState(realTier.label)

  const activeColor = rankColor(tiers, tierLabel)

  function resetToReal() {
    setOverall(realOverall.toFixed(1))
    setPotential(realPotential.toFixed(1))
    setTierLabel(realTier.label)
    setPreview(null)
  }

  async function generateImage() {
    if (!captureRef.current) return
    setGenerating(true); setError(null)
    try {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const canvas = await html2canvas(captureRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#000000',
        scale: 2,
        logging: false,
        width: CARD_W,
        windowWidth: CARD_W,
      })
      setPreview(canvas.toDataURL('image/jpeg', 0.93))
    } catch (e) {
      console.error('[DevRankCard]', e)
      setError('Could not render preview.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!preview) return
    if (isNative()) {
      try {
        const blob = await (await fetch(preview)).blob()
        const file = new File([blob], 'dev-rank-card.jpg', { type: 'image/jpeg' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Dev Rank Card' })
          return
        }
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    const a = document.createElement('a')
    a.href = preview; a.download = 'dev-rank-card.jpg'; a.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ background: 'rgba(2,2,2,0.98)', backdropFilter: 'blur(24px)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pb-3 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={16} style={{ color: GOLD }} />
          <p className="font-heading font-bold text-[13px] tracking-wide" style={{ color: GOLD }}>
            DEV OVERRIDE · SOHAIL ONLY
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <X size={17} className="text-white" />
        </button>
      </div>

      <p className="px-5 text-[11px] font-body leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Not visible to real users, not connected to any real scan. Edit freely below. Nothing here ever touches your Progress or Results data.
      </p>

      {/* ── Editable card preview — flat black, no gradient/glow background ── */}
      <div className="px-5">
        <div
          className="rounded-[28px] overflow-hidden mx-auto"
          style={{
            width: '100%',
            maxWidth: 360,
            background: '#000000',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Topbar */}
          <div className="flex items-center justify-between px-5 pt-3">
            <img src={logoSrc} alt="Ascendus" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
            <div className="text-[10px] font-heading font-bold tracking-[0.26em]" style={{ color: GOLD }}>
              ASCENDUS
            </div>
          </div>

          {/* Ranking — a single dropdown styled as the headline. Color now
              follows the simplified 3-bucket rule (rankColor) instead of each
              tier's individual analysis.js palette color: green above High
              Tier, red below Mid Tier, gold for the two middle tiers. */}
          <div className="text-center pt-1 pb-3 px-4">
            <div className="relative inline-block max-w-full">
              <select
                value={tierLabel}
                onChange={e => setTierLabel(e.target.value)}
                className="bg-transparent font-heading font-black outline-none appearance-none text-center"
                style={{
                  fontSize: 'clamp(22px, 7.5vw, 34px)',
                  color: activeColor,
                  textShadow: `0 0 24px ${activeColor}55`,
                  letterSpacing: '-0.02em',
                  paddingRight: 22,
                  maxWidth: '100%',
                }}
              >
                {tiers.map(t => (
                  <option key={t.label} value={t.label} style={{ background: '#111', color: '#fff' }}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: activeColor }} />
            </div>
          </div>

          {/* Stat dropdowns */}
          <div className="flex gap-3 px-5 pt-1 pb-6">
            <StatDropdown label="Overall"   value={overall}   onChange={setOverall}   color="#fff" />
            <StatDropdown label="Potential" value={potential} onChange={setPotential} color="#fff" barOverride="#2ecc71" />
          </div>
        </div>
      </div>

      {/* Hidden capture target — plain divs, fixed pixel width, no <select>s.
          This is what actually gets rendered to an image, kept in sync with
          the live values above but never shown to the user. */}
      <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }}>
        <div ref={captureRef}>
          <CaptureCard overall={overall} potential={potential} tierLabel={tierLabel} tierColor={activeColor} />
        </div>
      </div>

      {/* ── Preview (post-render) ── */}
      {preview && (
        <div className="px-5 pt-5 flex justify-center">
          <img src={preview} alt="Rendered dev card" className="rounded-2xl" style={{ maxWidth: 260, border: '1px solid rgba(255,255,255,0.1)' }} />
        </div>
      )}
      {error && <p className="px-5 pt-3 text-center text-xs text-red-400">{error}</p>}

      {/* ── Actions ── */}
      <div className="px-5 pt-6 flex flex-col gap-3 flex-shrink-0" style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex gap-3">
          <button
            onClick={resetToReal}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl font-semibold text-[13px]"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <RotateCcw size={14} />
            Reset to Real
          </button>
          <button
            onClick={generateImage}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl font-bold text-[13px]"
            style={{ background: GOLD_GRADIENT, color: '#000' }}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            {generating ? 'Rendering…' : 'Render Preview'}
          </button>
        </div>

        {preview && (
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl font-semibold text-[13px]"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Download size={14} />
            {isNative() ? 'Save to Photos' : 'Save Image'}
          </button>
        )}
      </div>
    </motion.div>
  )
}
