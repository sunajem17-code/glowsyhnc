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
  // track
  rr(ctx, x, y, w, h, r)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fill()
  // fill
  if (pct > 0.01) {
    const fw  = w * pct
    const col = barColor(val)
    const g   = ctx.createLinearGradient(x, 0, x + fw, 0)
    g.addColorStop(0, col + '99')
    g.addColorStop(1, col)
    rr(ctx, x, y, fw, h, r)
    ctx.fillStyle = g
    ctx.fill()
  }
}

// ─── Card draw — 1080 × 1920 ─────────────────────────────────────────────────
async function drawCard({ canvas, scan, facePhotoUrl }) {
  await document.fonts.ready
  const ctx = canvas.getContext('2d')
  const W = 1080, H = 1920
  canvas.width  = W
  canvas.height = H

  const { umaxScore, glowScore, pillars: sp, aiScore, gender } = scan
  const score    = glowScore ?? (umaxScore != null ? umaxScore / 10 : null)
  const pillars  = sp ?? aiScore?.pillars ?? null
  const potential = Math.min(10, (score ?? 5) + 1.4)

  const GOLD   = '#C9A84C'
  const GOLD2  = '#FFE47A'
  const L      = 60   // left pad
  const R_PAD  = W - 60  // right pad
  const COL_W  = (W - L * 2 - 40) / 2  // two-col width

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0A0A0A'
  ctx.fillRect(0, 0, W, H)

  // Radial gold glow behind photo
  const rad = ctx.createRadialGradient(W / 2, 460, 0, W / 2, 460, 500)
  rad.addColorStop(0,   'rgba(201,168,76,0.18)')
  rad.addColorStop(0.6, 'rgba(201,168,76,0.05)')
  rad.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = rad
  ctx.fillRect(0, 0, W, H)

  // Fine grid
  ctx.save()
  ctx.globalAlpha = 0.025
  ctx.strokeStyle = GOLD
  ctx.lineWidth   = 0.8
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  ctx.restore()

  // ── ASCENDUS wordmark ────────────────────────────────────────────────────────
  ctx.save()
  ctx.textAlign  = 'right'
  ctx.font       = '600 28px "Plus Jakarta Sans", Arial'
  ctx.fillStyle  = GOLD
  ctx.letterSpacing = '4px'
  ctx.fillText('ASCENDUS', W - 52, 68)
  ctx.letterSpacing = '0px'
  ctx.restore()

  // ── Face circle — R=324, center y=460 (35% of card height = 672px dia) ──────
  const CR  = 324
  const CX  = W / 2
  const CY  = 78 + CR   // 402

  // Outer glow rings
  for (let i = 3; i >= 1; i--) {
    ctx.save()
    ctx.globalAlpha = 0.05 * i
    ctx.beginPath(); ctx.arc(CX, CY, CR + 28 + i * 8, 0, Math.PI * 2)
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.stroke()
    ctx.restore()
  }

  // Gold ring
  ctx.save()
  ctx.shadowColor = 'rgba(201,168,76,0.5)'
  ctx.shadowBlur  = 28
  const ringG = ctx.createLinearGradient(CX - CR, CY - CR, CX + CR, CY + CR)
  ringG.addColorStop(0,  GOLD2)
  ringG.addColorStop(0.5, GOLD)
  ringG.addColorStop(1,  '#A8893A')
  ctx.beginPath(); ctx.arc(CX, CY, CR + 12, 0, Math.PI * 2)
  ctx.strokeStyle = ringG; ctx.lineWidth = 5; ctx.stroke()
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
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3; ctx.stroke()

  // ── Subtitle below photo ─────────────────────────────────────────────────────
  const subY = CY + CR + 52
  ctx.textAlign = 'center'
  ctx.font      = '400 30px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText('Your Results', W / 2, subY)

  // ── Divider ──────────────────────────────────────────────────────────────────
  const divY = subY + 48
  const dg   = ctx.createLinearGradient(L, 0, R_PAD, 0)
  dg.addColorStop(0,   'rgba(201,168,76,0)')
  dg.addColorStop(0.3, 'rgba(201,168,76,0.5)')
  dg.addColorStop(0.7, 'rgba(201,168,76,0.5)')
  dg.addColorStop(1,   'rgba(201,168,76,0)')
  ctx.strokeStyle = dg; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(L, divY); ctx.lineTo(R_PAD, divY); ctx.stroke()

  // ── Scores grid ──────────────────────────────────────────────────────────────
  // Row 1: OVERALL (left) | POTENTIAL (right)  — large cards
  const gridTop = divY + 44
  const bigH    = 240
  const gap     = 40

  function drawBigStat(label, value, x, y, w) {
    // Cell bg
    rr(ctx, x, y, w, bigH, 20)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1
    rr(ctx, x, y, w, bigH, 20); ctx.stroke()

    // Label
    ctx.textAlign = 'left'
    ctx.font      = '500 26px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.40)'
    ctx.fillText(label, x + 28, y + 44)

    // Number
    const numStr = value != null ? value.toFixed(1) : '—'
    ctx.font      = 'bold 100px "Space Grotesk", "Plus Jakarta Sans", Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(numStr, x + 28, y + 156)

    // /10
    const nw = ctx.measureText(numStr).width
    ctx.font      = '500 38px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = GOLD
    ctx.fillText('/10', x + 28 + nw + 8, y + 130)

    // Bar
    drawBar(ctx, x + 28, y + bigH - 28, w - 56, 10, value ?? 1)
  }

  const colL = L
  const colR = L + COL_W + gap
  drawBigStat('OVERALL',   score,     colL, gridTop, COL_W)
  drawBigStat('POTENTIAL', potential, colR, gridTop, COL_W)

  // Row 2–3: 4 pillars in 2×2
  const pilTop = gridTop + bigH + 28
  const pilH   = 160

  const PILLARS = [
    { label: 'HARMONY',    val: pillars?.harmony    ?? 5.0 },
    { label: 'ANGULARITY', val: pillars?.angularity ?? 5.0 },
    { label: 'FEATURES',   val: pillars?.features   ?? 5.0 },
    { label: 'DIMORPHISM', val: pillars?.dimorphism ?? 5.0 },
  ]

  function drawPillarCell(label, val, x, y, w) {
    rr(ctx, x, y, w, pilH, 16)
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1
    rr(ctx, x, y, w, pilH, 16); ctx.stroke()

    ctx.textAlign = 'left'
    ctx.font      = '500 22px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    ctx.fillText(label, x + 24, y + 36)

    const valStr = val.toFixed(1)
    ctx.font      = 'bold 68px "Space Grotesk", Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(valStr, x + 24, y + 112)

    const vw = ctx.measureText(valStr).width
    ctx.font      = '500 28px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = GOLD
    ctx.fillText('/10', x + 24 + vw + 6, y + 92)

    drawBar(ctx, x + 24, y + pilH - 22, w - 48, 8, val)
  }

  PILLARS.forEach(({ label, val }, i) => {
    const col = i % 2 === 0 ? colL : colR
    const row = Math.floor(i / 2)
    drawPillarCell(label, val, col, pilTop + row * (pilH + 24), COL_W)
  })

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footY = pilTop + 2 * (pilH + 24) + 60

  // Thin divider
  ctx.strokeStyle = 'rgba(201,168,76,0.20)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(L, footY); ctx.lineTo(R_PAD, footY); ctx.stroke()

  try {
    const icon = await loadImage('/src/assets/ascendus-icon.png')
    ctx.save(); ctx.globalAlpha = 0.65
    ctx.drawImage(icon, W / 2 - 20, footY + 28, 40, 40)
    ctx.restore()
  } catch {}

  ctx.textAlign = 'center'
  ctx.font      = '400 26px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fillText('ascendus.app', W / 2, footY + 90)
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
              height: 'min(calc(100vh - 200px), calc(82vw * 16 / 9))',
              aspectRatio: '9 / 16',
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
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.80)',
            border: '1px solid rgba(201,168,76,0.45)',
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
          style={{ background: '#C9A84C' }}
        >
          {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
          {sharing ? 'Sharing…' : 'Share'}
        </motion.button>
      </div>
    </div>
  )
}
