import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Share2, Download, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { MALE_TIERS, FEMALE_TIERS } from '../utils/analysis'
import html2canvas from 'html2canvas'
import logoSrc from '../assets/ascendus-icon.png'

// ── Tier helpers ──────────────────────────────────────────────────────────────
const ALL_TIERS = [...MALE_TIERS, ...FEMALE_TIERS]
function tierMeta(label) {
  const t = ALL_TIERS.find(t => t.label === label)
  if (!t) return { color: '#d4af37' }
  return { color: t.color }
}

function barColor(val) {
  if (val >= 7) return { from: '#1a7a3a', to: '#2ecc71' }
  if (val >= 5) return { from: '#7a5a1a', to: '#C9A84C' }
  return { from: '#7a2a1a', to: '#E07A5F' }
}

function ScoreBox({ label, value, badge }) {
  const v = value ?? 0
  const pct = Math.max(0, Math.min(100, (v / 10) * 100))
  const { from, to } = barColor(v)
  return (
    <div style={{
      background: '#141414',
      borderRadius: 13,
      padding: '12px 14px 13px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: '#4a4a4a', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {v.toFixed(1)}<span style={{ fontSize: 13, fontWeight: 500, color: '#444' }}>/10</span>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#2ecc71', letterSpacing: '0.1em', marginTop: 3, height: 13 }}>
        {badge || ' '}
      </div>
      <div style={{ height: 3, background: '#1e1e1e', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
      </div>
    </div>
  )
}

// ── The card HTML — rendered off-screen, captured with html2canvas ─────────────
function ShareCard({ scan, facePhotoUrl, cardRef }) {
  const score     = scan?.glowScore ?? (scan?.umaxScore != null ? scan.umaxScore / 10 : null) ?? 0
  const potential = scan?.potentialScore ?? Math.min(10, score + 1.4)
  const pillars   = scan?.pillars ?? scan?.aiScore?.pillars ?? {}
  const tier      = scan?.tier ?? ''
  const { color: tierColor } = tierMeta(tier)

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: -9999,
        top: 0,
        width: 370,
        background: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        fontFamily: 'Inter, -apple-system, sans-serif',
        zIndex: -1,
      }}
    >
      <div style={{
        background: '#0a0a0a',
        width: '100%',
        maxWidth: 370,
        borderRadius: 30,
        overflow: 'hidden',
        paddingBottom: 26,
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        {/* Gold glow top */}
        <div style={{
          position: 'absolute',
          top: -60, left: '50%',
          transform: 'translateX(-50%)',
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Topbar */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 0',
        }}>
          <img
            src={logoSrc}
            alt="Ascendus"
            style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover', display: 'block' }}
            crossOrigin="anonymous"
          />
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.22em', color: '#d4af37' }}>
            ASCENDUS
          </div>
        </div>

        {/* Avatar */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', margin: '14px 0 0' }}>
          <div style={{
            width: 195, height: 195,
            borderRadius: '50%',
            padding: 3.5,
            background: 'conic-gradient(#d4af37 0%, #f5e17a 35%, #c9922a 65%, #d4af37 100%)',
            boxShadow: '0 0 40px rgba(212,175,55,0.32), 0 0 80px rgba(212,175,55,0.1)',
          }}>
            <div style={{
              width: '100%', height: '100%',
              borderRadius: '50%',
              background: facePhotoUrl
                ? `#333 url(${facePhotoUrl}) center/cover no-repeat`
                : '#333',
              overflow: 'hidden',
            }}>
              {facePhotoUrl && (
                <img
                  src={facePhotoUrl}
                  alt=""
                  crossOrigin="anonymous"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Tier name */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginTop: 14 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: tierColor, letterSpacing: '0.12em' }}>
            {tier.toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Your Results</div>
        </div>

        {/* Score grid */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 9, padding: '18px 16px 0',
        }}>
          <ScoreBox label="Overall"    value={score}               badge={tier} />
          <ScoreBox label="Potential"  value={potential} />
          <ScoreBox label="Harmony"    value={pillars.harmony} />
          <ScoreBox label="Angularity" value={pillars.angularity} />
          <ScoreBox label="Features"   value={pillars.features} />
          <ScoreBox label="Dimorphism" value={pillars.dimorphism} />
        </div>

        {/* Divider */}
        <div style={{ position: 'relative', zIndex: 1, height: 1, background: '#1a1a1a', margin: '20px 16px 0' }} />

        {/* Search prompt */}
        <div style={{
          position: 'relative', zIndex: 1,
          margin: '14px 16px 0',
          background: '#111',
          border: '1px solid #222',
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
            <circle cx="11" cy="11" r="7" stroke="#d4af37" strokeWidth="2"/>
            <path d="M16.5 16.5L21 21" stroke="#d4af37" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
              Search on the App Store
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#d4af37', letterSpacing: '0.04em' }}>
              "Ascendus"
            </div>
            <div style={{ fontSize: 10, color: '#3a3a3a', marginTop: 2 }}>
              Find out your rating &amp; unlock your potential
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginTop: 16, padding: '0 16px' }}>
          <div style={{ fontSize: 12, color: '#333', marginBottom: 12 }}>ascendus.store</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            background: '#0a0a0a',
            border: '1.5px solid #282828',
            borderRadius: 11,
            padding: '8px 18px 8px 13px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: 8, fontWeight: 400, color: '#aaa', letterSpacing: '0.04em' }}>Download on the</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>App Store</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export default function ShareCardModal({ scan, facePhotoUrl, phase, onClose }) {
  const cardRef    = useRef(null)
  const [preview,    setPreview]    = useState(null)
  const [generating, setGenerating] = useState(true)
  const [error,      setError]      = useState(null)
  const [sharing,    setSharing]    = useState(false)

  const generate = useCallback(async () => {
    if (!cardRef.current) return
    setGenerating(true); setError(null)
    try {
      // Give DOM time to paint
      await new Promise(r => setTimeout(r, 300))
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#111111',
        scale: 2,
        logging: false,
        imageTimeout: 8000,
      })
      setPreview(canvas.toDataURL('image/jpeg', 0.93))
    } catch (e) {
      console.error('[ShareCard]', e)
      setError('Could not generate card.')
    } finally {
      setGenerating(false)
    }
  }, [scan, facePhotoUrl])

  useEffect(() => { generate() }, [generate])

  async function handleShare() {
    if (!preview) return
    setSharing(true)
    try {
      const blob = await (await fetch(preview)).blob()
      const file = new File([blob], 'ascendus-results.jpg', { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'My Ascendus Score', text: 'Scanned by Ascendus 🌟', files: [file] })
      } else {
        const a = document.createElement('a')
        a.href = preview; a.download = 'ascendus-results.jpg'; a.click()
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError('Share failed. Try saving instead.')
    } finally { setSharing(false) }
  }

  function handleSave() {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview; a.download = 'ascendus-card.jpg'; a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(4,3,1,0.97)', backdropFilter: 'blur(24px)' }}
    >
      {/* Off-screen card for html2canvas */}
      <ShareCard scan={scan} facePhotoUrl={facePhotoUrl} cardRef={cardRef} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-3 flex-shrink-0">
        <p className="font-heading font-bold text-[15px] text-white">Share Your Card</p>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <X size={17} className="text-white" />
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-4">
        {generating ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: '#C9A84C' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Generating card…</p>
          </motion.div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={generate} className="text-sm underline" style={{ color: '#C9A84C' }}>Retry</button>
          </div>
        ) : preview ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            src={preview}
            alt="Your Ascendus Card"
            className="rounded-2xl shadow-2xl"
            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
          />
        ) : null}
      </div>

      {/* Actions */}
      <div className="px-5 pb-10 pt-4 flex gap-3 flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={!preview || generating}
          className="flex-1 flex items-center justify-center gap-2 h-14 rounded-2xl font-semibold text-[15px]"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <Download size={17} />
          Save
        </button>
        <button
          onClick={handleShare}
          disabled={!preview || generating || sharing}
          className="flex-2 flex items-center justify-center gap-2 h-14 rounded-2xl font-bold text-[15px]"
          style={{ flex: 2, background: 'linear-gradient(135deg, #C9A84C, #d4af37)', color: '#000' }}
        >
          {sharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
          {sharing ? 'Sharing…' : 'Share'}
        </button>
      </div>
    </div>
  )
}
