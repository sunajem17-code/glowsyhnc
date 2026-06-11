import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Share2, Download, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    if (src && !src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('load failed'))
    img.src = src
  })
}

function barColor(val) {
  if (val >= 7)   return '#34C759'
  if (val >= 5)   return '#C9A84C'
  return '#E07A5F'
}

function drawBar(ctx, x, y, w, h, val, max = 10) {
  const r   = h / 2
  const pct = Math.max(0, Math.min(1, (val - 1) / (max - 1)))
  // track — thinner, elegant
  ctx.beginPath(); ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2)
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.fill()
  // fill
  if (pct > 0.01) {
    const fw  = Math.max(h, w * pct)
    const col = barColor(val)
    const g   = ctx.createLinearGradient(x, 0, x + fw, 0)
    g.addColorStop(0, col + 'AA')
    g.addColorStop(1, col)
    ctx.beginPath(); ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2)
    ctx.arc(x + fw - r, y + r, r, -Math.PI / 2, Math.PI / 2)
    ctx.closePath()
    ctx.fillStyle = g
    ctx.fill()
    // subtle glow on fill end
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.shadowColor = col
    ctx.shadowBlur  = 8
    ctx.beginPath(); ctx.arc(x + fw - r, y + r, r, 0, Math.PI * 2)
    ctx.fillStyle = col; ctx.fill()
    ctx.restore()
  }
}

// ─── Card draw — 1080 × 1620 (matches HTML card proportions) ─────────────────
async function drawCard({ canvas, scan, facePhotoUrl }) {
  await document.fonts.ready
  const ctx = canvas.getContext('2d')
  const W = 1080, H = 1620
  canvas.width  = W
  canvas.height = H

  const { umaxScore, glowScore, pillars: sp, aiScore, previousScore } = scan
  const score     = glowScore ?? (umaxScore != null ? umaxScore / 10 : null)
  const pillars   = sp ?? aiScore?.pillars ?? null
  const potential = Math.min(10, (score ?? 5) + 1.4)

  const GOLD  = '#d4af37'
  const GOLD2 = '#f5e17a'
  const GOLD3 = '#c9922a'
  const PAD   = 48            // card outer padding
  const CR    = 195           // avatar radius (scaled from HTML 97.5px × ~2)
  const CX    = W / 2
  const CY    = 120 + CR

  // ── Outer background ────────────────────────────────────────────────────────
  ctx.fillStyle = '#111111'
  ctx.fillRect(0, 0, W, H)

  // ── Card ────────────────────────────────────────────────────────────────────
  const CARD_PAD = 36
  const cardX = CARD_PAD, cardY = CARD_PAD
  const cardW = W - CARD_PAD * 2, cardH = H - CARD_PAD * 2
  const cardR = 60

  // card shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur  = 80
  ctx.shadowOffsetY = 24
  rr(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.fillStyle = '#0a0a0a'
  ctx.fill()
  ctx.restore()

  // card bg + border
  rr(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.fillStyle = '#0a0a0a'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 2
  rr(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.stroke()

  // radial gold glow top-center behind avatar
  const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, CR + 180)
  glow.addColorStop(0,   'rgba(212,175,55,0.18)')
  glow.addColorStop(0.6, 'rgba(212,175,55,0.05)')
  glow.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.save()
  rr(ctx, cardX, cardY, cardW, cardH, cardR)
  ctx.clip()
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // ── Topbar — logo left, ASCENDUS right ────────────────────────────────────
  const topY = cardY + PAD
  try {
    const icon = await loadImage('/src/assets/ascendus-icon.png')
    ctx.save(); ctx.globalAlpha = 0.90
    ctx.drawImage(icon, cardX + PAD, topY - 8, 76, 76)
    ctx.restore()
  } catch {}

  ctx.textAlign     = 'right'
  ctx.font          = '800 44px "Plus Jakarta Sans", Inter, Arial'
  ctx.fillStyle     = GOLD
  ctx.letterSpacing = '8px'
  ctx.fillText('ASCENDUS', cardX + cardW - PAD, topY + 50)
  ctx.letterSpacing = '0px'

  // ── Avatar ──────────────────────────────────────────────────────────────────
  // Pulse rings
  for (let i = 3; i >= 1; i--) {
    ctx.save()
    ctx.globalAlpha = 0.03 * i
    ctx.beginPath(); ctx.arc(CX, CY, CR + 20 + i * 16, 0, Math.PI * 2)
    ctx.strokeStyle = GOLD; ctx.lineWidth = i === 1 ? 2 : 1; ctx.stroke()
    ctx.restore()
  }

  // Conic gold ring
  ctx.save()
  ctx.shadowColor = 'rgba(212,175,55,0.55)'
  ctx.shadowBlur  = 40
  const ringG = ctx.createLinearGradient(CX - CR, CY - CR, CX + CR, CY + CR)
  ringG.addColorStop(0,    GOLD2)
  ringG.addColorStop(0.35, GOLD)
  ringG.addColorStop(0.65, GOLD3)
  ringG.addColorStop(1,    GOLD)
  ctx.beginPath(); ctx.arc(CX, CY, CR + 10, 0, Math.PI * 2)
  ctx.strokeStyle = ringG; ctx.lineWidth = 10; ctx.stroke()
  ctx.restore()

  // Photo
  const D  = CR * 2
  const oc = document.createElement('canvas')
  oc.width = D; oc.height = D
  const ox = oc.getContext('2d')
  ox.beginPath(); ox.arc(D / 2, D / 2, CR, 0, Math.PI * 2); ox.clip()
  if (facePhotoUrl) {
    try {
      const img = await loadImage(facePhotoUrl)
      const iw = img.width, ih = img.height
      let sx, sy, cw, ch
      if (iw / ih >= 1) { cw = ch = ih; sx = (iw - cw) / 2; sy = 0 }
      else               { cw = ch = iw; sx = 0; sy = Math.max(0, ih * 0.05) }
      ox.drawImage(img, sx, sy, cw, ch, 0, 0, D, D)
    } catch { ox.fillStyle = '#1A1A1A'; ox.fillRect(0, 0, D, D) }
  } else { ox.fillStyle = '#1A1A1A'; ox.fillRect(0, 0, D, D) }
  ctx.drawImage(oc, CX - CR, CY - CR)

  // Inner rim
  ctx.beginPath(); ctx.arc(CX, CY, CR, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 4; ctx.stroke()

  // ── Tier + subtitle ──────────────────────────────────────────────────────────
  const tierRaw  = (scan.tier ?? '').toUpperCase()
  const tierName = tierRaw || (score >= 8.5 ? 'CHAD' : score >= 7 ? 'HANDSOME' : score >= 5.5 ? 'AVERAGE' : 'NORMIE')
  const tierY    = CY + CR + 70

  // Tier colour — gold for top tiers, silver-white for mid, muted for lower
  const TOP_TIERS = ['GIGACHAD','CHAD','TOP MODEL','MALE MODEL']
  const MID_TIERS = ['HANDSOME','ABOVE AVERAGE','PRETTY BOY','HIGH TIER']
  const tierAccent = TOP_TIERS.some(t => tierName.includes(t)) ? GOLD
    : MID_TIERS.some(t => tierName.includes(t))              ? '#c8c8c8'
    : 'rgba(255,255,255,0.45)'

  ctx.textAlign = 'center'
  ctx.font      = '900 88px "Plus Jakarta Sans", Inter, Arial'
  const tierG   = ctx.createLinearGradient(W * 0.2, tierY, W * 0.8, tierY)
  tierG.addColorStop(0,    TOP_TIERS.some(t => tierName.includes(t)) ? GOLD2 : tierAccent)
  tierG.addColorStop(0.45, tierAccent)
  tierG.addColorStop(1,    TOP_TIERS.some(t => tierName.includes(t)) ? GOLD3 : tierAccent)
  ctx.fillStyle = tierG
  ctx.fillText(tierName, CX, tierY)

  ctx.font      = '400 34px "Plus Jakarta Sans", Inter, Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.30)'
  ctx.fillText('Your Results', CX, tierY + 50)

  // ── Score grid — 2 × 3 ───────────────────────────────────────────────────────
  const gridTop  = tierY + 100
  const COLS     = 2
  const gap      = 18
  const colW     = (cardW - PAD * 2 - gap * (COLS - 1)) / COLS
  const boxH     = 200
  const boxR     = 26

  const SCORES = [
    { label: 'Overall',    val: score,              badge: (scan.tier ?? '').toUpperCase() },
    { label: 'Potential',  val: potential,           badge: null },
    { label: 'Harmony',    val: pillars?.harmony    ?? null, badge: null },
    { label: 'Angularity', val: pillars?.angularity ?? null, badge: null },
    { label: 'Features',   val: pillars?.features   ?? null, badge: null },
    { label: 'Dimorphism', val: pillars?.dimorphism ?? null, badge: null },
  ]

  SCORES.forEach(({ label, val, badge }, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const bx  = cardX + PAD + col * (colW + gap)
    const by  = gridTop + row * (boxH + gap)

    // Box bg — Overall box gets a subtle accent border
    const isOverall = i === 0
    rr(ctx, bx, by, colW, boxH, boxR)
    ctx.fillStyle = isOverall ? '#141208' : '#141414'; ctx.fill()
    ctx.strokeStyle = isOverall ? 'rgba(212,175,55,0.22)' : 'rgba(255,255,255,0.06)'
    ctx.lineWidth = isOverall ? 1.5 : 1
    rr(ctx, bx, by, colW, boxH, boxR); ctx.stroke()

    // Label
    ctx.textAlign = 'left'
    ctx.font      = '600 22px "Plus Jakarta Sans", Inter, Arial'
    ctx.fillStyle = '#4a4a4a'
    ctx.fillText(label.toUpperCase(), bx + 28, by + 42)

    // Value
    const numStr = val != null ? val.toFixed(1) : '—'
    ctx.font      = '900 86px "Plus Jakarta Sans", Inter, Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(numStr, bx + 28, by + 140)

    // /10
    const nw = ctx.measureText(numStr).width
    ctx.font      = '500 30px "Plus Jakarta Sans", Inter, Arial'
    ctx.fillStyle = '#444444'
    ctx.fillText('/10', bx + 28 + nw + 6, by + 116)

    // Badge (tier name for overall)
    if (badge) {
      ctx.font      = '700 22px "Plus Jakarta Sans", Inter, Arial'
      ctx.fillStyle = tierAccent
      ctx.fillText(badge, bx + 28, by + 165)
    }

    // Bar — colour reflects actual score value
    const barY  = by + boxH - 22
    const barW  = colW - 56
    const barH  = 6
    const pct   = val != null ? Math.max(0, Math.min(1, (val - 1) / 9)) : 0
    // track
    rr(ctx, bx + 28, barY, barW, barH, barH / 2)
    ctx.fillStyle = '#1e1e1e'; ctx.fill()
    // fill
    if (pct > 0.02 && val != null) {
      const fw  = Math.max(barH, barW * pct)
      const col = barColor(val)
      // darken version for gradient start
      const dark = val >= 7 ? '#1a7a3a' : val >= 5 ? '#7a6a2a' : '#7a3020'
      const bg = ctx.createLinearGradient(bx + 28, 0, bx + 28 + fw, 0)
      bg.addColorStop(0, dark)
      bg.addColorStop(1, col)
      rr(ctx, bx + 28, barY, fw, barH, barH / 2)
      ctx.fillStyle = bg; ctx.fill()
    }
  })

  // ── Divider ──────────────────────────────────────────────────────────────────
  const divY = gridTop + 3 * (boxH + gap) + 20
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(cardX + PAD, divY); ctx.lineTo(cardX + cardW - PAD, divY); ctx.stroke()

  // ── Search CTA ───────────────────────────────────────────────────────────────
  const ctaY = divY + 30
  const ctaH = 130
  const ctaX = cardX + PAD

  // CTA box bg
  rr(ctx, ctaX, ctaY, cardW - PAD * 2, ctaH, 24)
  ctx.fillStyle = '#111111'; ctx.fill()
  ctx.strokeStyle = '#222222'; ctx.lineWidth = 2
  rr(ctx, ctaX, ctaY, cardW - PAD * 2, ctaH, 24); ctx.stroke()

  // Search icon (magnifying glass, drawn manually)
  const sx = ctaX + 40, sy = ctaY + ctaH / 2
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6
  ctx.beginPath(); ctx.arc(sx, sy - 2, 22, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(sx + 16, sy + 14); ctx.lineTo(sx + 30, sy + 28); ctx.stroke()
  ctx.restore()

  // CTA text
  ctx.textAlign = 'left'
  ctx.font      = '700 30px "Plus Jakarta Sans", Inter, Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.70)'
  ctx.fillText('Search on the App Store', ctaX + 90, ctaY + 46)

  ctx.font      = '800 38px "Plus Jakarta Sans", Inter, Arial'
  ctx.fillStyle = GOLD
  ctx.fillText('"Ascendus"', ctaX + 90, ctaY + 88)

  ctx.font      = '400 24px "Plus Jakarta Sans", Inter, Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fillText('Find out your rating & unlock your potential', ctaX + 90, ctaY + 118)

  // ── Footer domain ────────────────────────────────────────────────────────────
  const footY = ctaY + ctaH + 36
  ctx.textAlign     = 'center'
  ctx.font          = '600 30px "Plus Jakarta Sans", Inter, Arial'
  ctx.fillStyle     = GOLD
  ctx.letterSpacing = '2px'
  ctx.fillText('ascendus.store', CX, footY)
  ctx.letterSpacing = '0px'
}

// ─── Score count-up ───────────────────────────────────────────────────────────
function useCountUp(target, duration = 1200, active = true) {
  const [cur, setCur] = useState(0)
  useEffect(() => {
    if (!active || target == null) return
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setCur(parseFloat((e * target).toFixed(1)))
      if (p < 1) requestAnimationFrame(tick)
      else setCur(target)
    }
    requestAnimationFrame(tick)
  }, [target, duration, active])
  return cur
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export default function ShareCardModal({ scan, facePhotoUrl, phase, onClose }) {
  const canvasRef = useRef(null)
  const [generating, setGenerating] = useState(true)
  const [preview,    setPreview]    = useState(null)
  const [error,      setError]      = useState(null)
  const [sharing,    setSharing]    = useState(false)

  const displayScore = scan
    ? (scan.glowScore ?? (scan.umaxScore != null ? scan.umaxScore / 10 : null))
    : null

  const counted = useCountUp(displayScore, 1200, generating && displayScore != null)

  const generate = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !scan) return
    setGenerating(true); setError(null)
    try {
      await drawCard({ canvas, scan, facePhotoUrl, phase })
      setPreview(canvas.toDataURL('image/jpeg', 0.93))
    } catch (e) {
      console.error('[ShareCard]', e)
      setError('Could not generate card.')
    } finally {
      setGenerating(false)
    }
  }, [scan, facePhotoUrl, phase])

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
    a.href = preview; a.download = 'ascendus-story.jpg'; a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(4,3,1,0.97)', backdropFilter: 'blur(24px)' }}
    >
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

      <canvas ref={canvasRef} className="hidden" />

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-4">
        {generating ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-5"
          >
            {displayScore != null && (
              <p className="font-heading font-bold" style={{ fontSize: 96, lineHeight: 1, color: '#fff', letterSpacing: '-0.03em' }}>
                {counted.toFixed(1)}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" style={{ color: '#C9A84C' }} />
              <p className="text-[13px] font-body" style={{ color: 'rgba(255,255,255,0.4)' }}>Building your card…</p>
            </div>
          </motion.div>
        ) : error ? (
          <div className="text-center">
            <p className="text-sm font-body mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{error}</p>
            <button onClick={generate} className="px-4 py-2 rounded-xl text-white text-sm font-body bg-white/10">Retry</button>
          </div>
        ) : preview ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              height: 'min(calc(100vh - 200px), calc(67vw * 3 / 2))',
              aspectRatio: '2 / 3',
              width: 'auto',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(201,168,76,0.20), 0 20px 60px rgba(0,0,0,0.9)',
            }}
          >
            <img src={preview} alt="Share card" style={{ width: '100%', height: '100%', display: 'block' }} />
          </motion.div>
        ) : null}
      </div>

      {/* Buttons — pill style side by side */}
      <div className="px-5 pb-10 pt-4 flex gap-3 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={!preview || generating}
          className="flex-1 py-4 rounded-full font-heading font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40"
          style={{
            background: 'rgba(10,10,10,0.9)',
            color: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(201,168,76,0.50)',
          }}
        >
          <Download size={15} />
          Save
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleShare}
          disabled={!preview || generating || sharing}
          className="flex-1 py-4 rounded-full font-heading font-bold text-[14px] text-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #FFE47A 0%, #C9A84C 60%, #A8893A 100%)', boxShadow: '0 4px 20px rgba(201,168,76,0.35)' }}
        >
          {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
          {sharing ? 'Sharing…' : 'Share'}
        </motion.button>
      </div>
    </div>
  )
}
