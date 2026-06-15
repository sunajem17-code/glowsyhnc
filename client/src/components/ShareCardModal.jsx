import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Share2, Download, Loader2, ImageDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { MALE_TIERS, FEMALE_TIERS } from '../utils/analysis'
import html2canvas from 'html2canvas'
import logoSrc from '../assets/ascendus-icon.png'
import { isNative } from '../utils/camera'

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

// ── Fixed card dimensions (9:16 portrait) ────────────────────────────────────
const CARD_W = 370
const CARD_H = Math.round(CARD_W * 16 / 9) // 658

// ── Apple logo path (bitten apple — Apple's actual brand mark) ────────────────
const APPLE_PATH =
  'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79' +
  '-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39' +
  'c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91' +
  '.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04' +
  '-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35' +
  '-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z'

// Renders App Store icon + “Ascendus” on ONE canvas — perfect alignment guaranteed.
// The App Store icon: blue gradient rounded square + crossing-A with heart top + crossbar.
const ROW_H = 22
const ROW_W = 210
function AppStoreNameRow() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, ROW_W, ROW_H)

    // ── App Store icon (18×18 px, vertically centred in row) ──────────────────
    const S = 18
    const ix = 0
    const iy = (ROW_H - S) / 2
    const rc = S * 0.22  // corner radius

    // Blue gradient background
    const bg = ctx.createLinearGradient(ix, iy, ix, iy + S)
    bg.addColorStop(0, '#5AC8FA')
    bg.addColorStop(1, '#0070C9')
    ctx.beginPath()
    ctx.moveTo(ix + rc, iy)
    ctx.lineTo(ix + S - rc, iy)
    ctx.quadraticCurveTo(ix + S, iy, ix + S, iy + rc)
    ctx.lineTo(ix + S, iy + S - rc)
    ctx.quadraticCurveTo(ix + S, iy + S, ix + S - rc, iy + S)
    ctx.lineTo(ix + rc, iy + S)
    ctx.quadraticCurveTo(ix, iy + S, ix, iy + S - rc)
    ctx.lineTo(ix, iy + rc)
    ctx.quadraticCurveTo(ix, iy, ix + rc, iy)
    ctx.closePath()
    ctx.fillStyle = bg
    ctx.fill()

    // White crossing-A shape with round caps
    ctx.save()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = S * 0.135
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const cx = ix + S / 2
    const tLx = cx - S * 0.14  // top-left point
    const tRx = cx + S * 0.14  // top-right point
    const tY  = iy + S * 0.17
    const bLx = ix + S * 0.16  // bottom-left
    const bRx = ix + S * 0.84  // bottom-right
    const bY  = iy + S * 0.83
    const barY = iy + S * 0.6

    // Left diagonal: top-right → bottom-left (the crossing part)
    ctx.beginPath(); ctx.moveTo(tRx, tY); ctx.lineTo(bLx, bY); ctx.stroke()
    // Right diagonal: top-left → bottom-right
    ctx.beginPath(); ctx.moveTo(tLx, tY); ctx.lineTo(bRx, bY); ctx.stroke()
    // Heart top: arc connecting tLx→tRx curving upward
    ctx.beginPath()
    ctx.moveTo(tLx, tY)
    ctx.quadraticCurveTo(cx, iy + S * 0.02, tRx, tY)
    ctx.stroke()
    // Horizontal crossbar
    ctx.beginPath(); ctx.moveTo(ix + S * 0.19, barY); ctx.lineTo(ix + S * 0.81, barY); ctx.stroke()

    ctx.restore()

    // ── “Ascendus” text in gold, vertically centred ────────────────────────────
    ctx.fillStyle = '#d4af37'
    ctx.font = '800 14px Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('”Ascendus”', S + 8, ROW_H / 2)
  }, [])
  return <canvas ref={ref} width={ROW_W} height={ROW_H} style={{ display: 'block' }} />
}

// Plain Apple logo on canvas (used in footer App Store button)
function AppleLogoCanvas({ size = 20, color = '#ffffff' }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const scale = size / 24
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.scale(scale, scale)
    ctx.fillStyle = color
    ctx.fill(new Path2D(APPLE_PATH))
    ctx.restore()
  }, [size, color])
  return <canvas ref={ref} width={size} height={size} style={{ display: 'block', flexShrink: 0 }} />
}

const SEARCH_ICON_URI =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">' +
    '<circle cx="11" cy="11" r="7" stroke="#d4af37" stroke-width="2"/>' +
    '<path d="M16.5 16.5L21 21" stroke="#d4af37" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>'
  )

// ── ScoreBox ──────────────────────────────────────────────────────────────────
// Fix 1: fixed height (88px) + CSS grid ensure all 6 cards are perfectly equal.
// Fix 2: /10 uses verticalAlign baseline so it sits flush with the score number.
// Fix 3: progress bar pushed to bottom via marginTop:auto.
// Fix 4: tier label always #d4af37 gold, font-variant small-caps, fixed 10px size.
// Fix 5: uniform padding 10px 12px on every card — no variation.
function ScoreBox({ label, value, tierLabel }) {
  const v = value ?? 0
  const pct = Math.max(0, Math.min(100, (v / 10) * 100))
  const { from, to } = barColor(v)
  return (
    <div style={{
      background: '#141414',
      borderRadius: 12,
      padding: '10px 12px',           // Fix 5 & 7: identical padding on all cards
      border: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      height: 88,                      // Fix 1: fixed height — all cards identical
      boxSizing: 'border-box',
    }}>
      {/* Label */}
      <div style={{
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: '0.16em',
        color: '#3a3a3a',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        {label}
      </div>

      {/* Score number — Fix 2: baseline alignment for /10 */}
      <div style={{
        marginTop: 4,
        lineHeight: 1,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 30,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-0.03em',
          verticalAlign: 'baseline',
        }}>
          {v.toFixed(1)}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: '#2e2e2e',
          verticalAlign: 'baseline',  // Fix 2: sits on same baseline as score
          marginLeft: 1,
        }}>
          /10
        </span>
      </div>

      {/* Fix 4: tier label — always #d4af37 gold, small-caps, fixed 10px */}
      {tierLabel && (
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#d4af37',
          fontVariant: 'small-caps',
          letterSpacing: '0.06em',
          marginTop: 3,
          flexShrink: 0,
        }}>
          {tierLabel}
        </div>
      )}

      {/* Fix 3: marginTop:auto pushes bar to bottom regardless of content height */}
      <div style={{
        height: 3,
        background: '#1e1e1e',
        borderRadius: 3,
        marginTop: 'auto',            // Fix 3: always flush at bottom
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          height: '100%',
          borderRadius: 3,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${from}, ${to})`,
        }} />
      </div>
    </div>
  )
}

// ── ShareCard — rendered off-screen, captured by html2canvas ──────────────────
function ShareCard({ scan, facePhotoUrl, cardRef }) {
  const score     = scan?.glowScore ?? (scan?.umaxScore != null ? scan.umaxScore / 10 : null) ?? 0
  const potential = Math.min(10, score + 1.4)
  const pillars   = scan?.pillars ?? scan?.aiScore?.pillars ?? {}
  const tier      = scan?.tier ?? ''
  const { color: tierColor } = tierMeta(tier)

  const AVATAR = 158

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: -9999,
        top: 0,
        width: CARD_W,
        height: CARD_H,
        overflow: 'hidden',
        background: '#0a0a0a',
        fontFamily: 'Inter, -apple-system, sans-serif',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 24,
      }}
    >
      {/* Gold radial glow behind avatar */}
      <div style={{
        position: 'absolute',
        top: 30,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.06) 45%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Topbar */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px 0',
        flexShrink: 0,
      }}>
        <img
          src={logoSrc}
          alt="Ascendus"
          crossOrigin="anonymous"
          style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', display: 'block' }}
        />
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.26em', color: '#d4af37' }}>
          ASCENDUS
        </div>
      </div>

      {/* Avatar */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', justifyContent: 'center',
        marginTop: 14,
        flexShrink: 0,
      }}>
        <div style={{
          width: AVATAR,
          height: AVATAR,
          borderRadius: '50%',
          border: '3px solid #d4af37',
          boxShadow: '0 0 44px rgba(212,175,55,0.45), 0 0 80px rgba(212,175,55,0.13)',
          overflow: 'hidden',
          background: '#1e1e1e',
          flexShrink: 0,
        }}>
          {facePhotoUrl && (
            <img
              src={facePhotoUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>
      </div>

      {/* Tier label */}
      <div style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center',
        marginTop: 12,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: tierColor, letterSpacing: '0.14em' }}>
          {tier.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: '#484848', marginTop: 3, letterSpacing: '0.06em' }}>
          Your Results
        </div>
      </div>

      {/* Score grid — 2 × 3 */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 7,
        padding: '11px 14px 0',
        flexShrink: 0,
      }}>
        <ScoreBox label="Overall"    value={score} />
        <ScoreBox label="Potential"  value={potential} />
        <ScoreBox label="Harmony"    value={pillars.harmony} />
        <ScoreBox label="Angularity" value={pillars.angularity} />
        <ScoreBox label="Features"   value={pillars.features} />
        <ScoreBox label="Dimorphism" value={pillars.dimorphism} />
      </div>

      {/* Search prompt — Fix 6: App Store icon left of "Ascendus" text */}
      <div style={{
        position: 'relative', zIndex: 1,
        margin: '11px 14px 0',
        background: '#0f0f0f',
        border: '1px solid #1e1e1e',
        borderRadius: 12,
        padding: '9px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <img src={SEARCH_ICON_URI} width={16} height={16} alt="" style={{ flexShrink: 0, opacity: 0.5 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>
            Search on the App Store
          </div>
          {/* Apple logo + "Ascendus" drawn on single canvas — perfect alignment */}
          <AppStoreNameRow />
          <div style={{ fontSize: 8, color: '#2e2e2e', marginTop: 3 }}>
            Find out your rating &amp; unlock your potential
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center',
        marginTop: 10,
        padding: '0 14px 16px',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: '#2a2a2a', marginBottom: 8, letterSpacing: '0.05em' }}>
          ascendus.store
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          background: '#111',
          border: '1.5px solid #252525',
          borderRadius: 12,
          padding: '8px 18px 8px 13px',
        }}>
          <AppleLogoCanvas size={20} color="#ffffff" />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span style={{ fontSize: 8, fontWeight: 400, color: '#777', letterSpacing: '0.04em' }}>Download on the</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>App Store</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
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
      // Wait for DOM paint, then wait for all <img> elements inside the card to finish loading
      await new Promise(r => setTimeout(r, 200))
      const imgs = Array.from(cardRef.current.querySelectorAll('img'))
      await Promise.all(imgs.map(img =>
        img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res })
      ))
      // One more frame so the browser composites the loaded images
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0a0a',
        scale: 2,
        logging: false,
        imageTimeout: 8000,
        width: CARD_W,
        height: CARD_H,
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

  async function handleSave() {
    if (!preview) return
    if (isNative()) {
      // On iOS WKWebView, <a download> doesn't work — use Web Share API instead.
      // The native share sheet lets the user pick "Save Image" to camera roll.
      try {
        const blob = await (await fetch(preview)).blob()
        const file = new File([blob], 'ascendus-card.jpg', { type: 'image/jpeg' })
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My Ascendus Card' })
          return
        }
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    // Web fallback
    const a = document.createElement('a')
    a.href = preview; a.download = 'ascendus-card.jpg'; a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(4,3,1,0.97)', backdropFilter: 'blur(24px)' }}
    >
      {/* Off-screen card for html2canvas capture */}
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
          {isNative() ? 'Save to Photos' : 'Save'}
        </button>
        <button
          onClick={handleShare}
          disabled={!preview || generating || sharing}
          className="flex items-center justify-center gap-2 h-14 rounded-2xl font-bold text-[15px]"
          style={{ flex: 2, background: 'linear-gradient(135deg, #C9A84C, #d4af37)', color: '#000' }}
        >
          {sharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
          {sharing ? 'Sharing…' : 'Share'}
        </button>
      </div>
    </div>
  )
}
