import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, FlaskConical, Download, Loader2, RotateCcw } from 'lucide-react'
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
function barColor(val) {
  if (val >= 7) return { from: '#1a7a3a', to: '#2ecc71' }
  if (val >= 5) return { from: '#7a5a1a', to: '#C9A84C' }
  return { from: '#7a2a1a', to: '#E07A5F' }
}

function clampScore(n) {
  const v = parseFloat(n)
  if (isNaN(v)) return 0
  return Math.max(0, Math.min(10, v))
}

// Big editable number — tap in, type, done. Styled to look like a stat, not a form field.
function BigStatInput({ label, value, onChange, color }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100))
  const { from, to } = barColor(value)
  return (
    <div
      className="flex-1 rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="text-[10px] font-heading font-bold tracking-[0.16em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <input
          type="number"
          min="0"
          max="10"
          step="0.1"
          value={value}
          onChange={e => onChange(clampScore(e.target.value))}
          className="bg-transparent font-heading font-black outline-none"
          style={{ color: color ?? '#fff', fontSize: 34, width: 74, letterSpacing: '-0.03em' }}
        />
        <span className="text-xs font-body" style={{ color: 'rgba(255,255,255,0.25)' }}>/10</span>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
      </div>
    </div>
  )
}

export default function DevRankCard({ scan, onClose }) {
  const cardRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  const gender = scan?.gender === 'female' ? 'female' : 'male'
  const tiers = getTiersForGender(gender)

  const realOverall   = scan?.glowScore ?? (scan?.umaxScore != null ? scan.umaxScore / 10 : null) ?? 0
  const realPotential = Math.min(10, realOverall + 1.4)
  const realTier       = tiers.find(t => t.label === scan?.tier) ?? tiers[Math.floor(tiers.length / 2)]

  const [overall,   setOverall]   = useState(Number(realOverall.toFixed(1)))
  const [potential, setPotential] = useState(Number(realPotential.toFixed(1)))
  const [tierLabel, setTierLabel] = useState(realTier.label)

  const activeTier = tiers.find(t => t.label === tierLabel) ?? realTier

  function resetToReal() {
    setOverall(Number(realOverall.toFixed(1)))
    setPotential(Number(realPotential.toFixed(1)))
    setTierLabel(realTier.label)
    setPreview(null)
  }

  async function generateImage() {
    if (!cardRef.current) return
    setGenerating(true); setError(null)
    try {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#050505',
        scale: 2,
        logging: false,
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
        Not visible to real users, not connected to any real scan. Edit freely below — nothing here ever touches your Progress or Results data.
      </p>

      {/* ── Editable card preview ── */}
      <div className="px-5">
        <div
          ref={cardRef}
          className="rounded-[28px] overflow-hidden mx-auto"
          style={{
            width: '100%',
            maxWidth: 360,
            background: 'radial-gradient(ellipse at 50% 0%, rgba(198,168,92,0.10) 0%, #050505 60%)',
            border: `1px solid ${activeTier.color}33`,
          }}
        >
          {/* Topbar */}
          <div className="flex items-center justify-between px-5 pt-5">
            <img src={logoSrc} alt="Ascendus" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
            <div className="text-[10px] font-heading font-bold tracking-[0.26em]" style={{ color: GOLD }}>
              ASCENDUS
            </div>
          </div>

          {/* Ranking */}
          <div className="text-center pt-6 pb-2">
            <div className="text-[10px] font-heading font-bold tracking-[0.3em] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Ranking
            </div>
            <div
              className="font-heading font-black leading-none"
              style={{
                fontSize: 42,
                color: activeTier.color,
                textShadow: `0 0 30px ${activeTier.color}55`,
                letterSpacing: '-0.02em',
              }}
            >
              {activeTier.label}
            </div>
            {/* Tier picker — same visual weight as the label above it so
                editing feels native, not like a bolted-on form control. */}
            <select
              value={tierLabel}
              onChange={e => setTierLabel(e.target.value)}
              className="mt-2 bg-transparent text-center text-[11px] font-heading font-semibold outline-none"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {tiers.map(t => (
                <option key={t.label} value={t.label} style={{ background: '#111' }}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Stat cards */}
          <div className="flex gap-3 px-5 pt-4 pb-6">
            <BigStatInput label="Overall"   value={overall}   onChange={setOverall}   color="#fff" />
            <BigStatInput label="Potential" value={potential} onChange={setPotential} color={GOLD} />
          </div>
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
