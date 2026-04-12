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

// ─── Card draw — 1080 × 1920 ─────────────────────────────────────────────────
async function drawCard({ canvas, scan, facePhotoUrl }) {
  await document.fonts.ready
  const ctx = canvas.getContext('2d')
  const W = 1080, H = 1920
  canvas.width  = W
  canvas.height = H

  const { umaxScore, glowScore, pillars: sp, aiScore, gender, previousScore } = scan
  const score    = glowScore ?? (umaxScore != null ? umaxScore / 10 : null)
  const pillars  = sp ?? aiScore?.pillars ?? null
  const potential = Math.min(10, (score ?? 5) + 1.4)
  const scoreDelta = (previousScore != null && score != null) ? +(score - previousScore).toFixed(1) : null

  const GOLD   = '#C9A84C'
  const GOLD2  = '#FFE47A'
  const L      = 60
  const R_PAD  = W - 60
  const COL_W  = (W - L * 2 - 40) / 2
  const CR     = 324          // face circle radius (declared early for bg glow)
  const CX     = W / 2
  const CY     = 78 + CR      // 402

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0A0A0A'
  ctx.fillRect(0, 0, W, H)

  // Radial gold glow — tighter, behind photo only
  const rad = ctx.createRadialGradient(W / 2, CY, 0, W / 2, CY, CR + 120)
  rad.addColorStop(0,   'rgba(201,168,76,0.22)')
  rad.addColorStop(0.55,'rgba(201,168,76,0.06)')
  rad.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = rad
  ctx.fillRect(0, 0, W, H)

  // Subtle gold border around entire card
  ctx.save()
  ctx.strokeStyle = 'rgba(201,168,76,0.30)'
  ctx.lineWidth   = 1
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
  ctx.restore()

  // Fine grid
  ctx.save()
  ctx.globalAlpha = 0.025
  ctx.strokeStyle = GOLD
  ctx.lineWidth   = 0.8
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  ctx.restore()

  // ── Logo + ASCENDUS wordmark (top-right) ─────────────────────────────────────
  try {
    const icon = await loadImage('/src/assets/ascendus-icon.png')
    ctx.save()
    ctx.globalAlpha = 0.92
    ctx.drawImage(icon, W - 52 - 48, 20, 48, 48)
    ctx.restore()
  } catch {}
  ctx.save()
  ctx.textAlign     = 'right'
  ctx.font          = '600 28px "Plus Jakarta Sans", Arial'
  ctx.fillStyle     = GOLD
  ctx.letterSpacing = '4px'
  ctx.fillText('ASCENDUS', W - 52 - 56, 54)
  ctx.letterSpacing = '0px'
  ctx.restore()

  // ── Face circle — R=324 (35% card height), cy=402 ───────────────────────────

  // Pulse glow rings
  for (let i = 4; i >= 1; i--) {
    ctx.save()
    ctx.globalAlpha = 0.04 * i
    ctx.beginPath(); ctx.arc(CX, CY, CR + 16 + i * 14, 0, Math.PI * 2)
    ctx.strokeStyle = GOLD; ctx.lineWidth = i === 1 ? 2 : 1; ctx.stroke()
    ctx.restore()
  }

  // Gold ring — thicker with strong glow
  ctx.save()
  ctx.shadowColor = 'rgba(201,168,76,0.65)'
  ctx.shadowBlur  = 36
  const ringG = ctx.createLinearGradient(CX - CR, CY - CR, CX + CR, CY + CR)
  ringG.addColorStop(0,   GOLD2)
  ringG.addColorStop(0.5, GOLD)
  ringG.addColorStop(1,   '#A8893A')
  ctx.beginPath(); ctx.arc(CX, CY, CR + 14, 0, Math.PI * 2)
  ctx.strokeStyle = ringG; ctx.lineWidth = 8; ctx.stroke()
  ctx.restore()

  // Inner accent ring
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.beginPath(); ctx.arc(CX, CY, CR + 24, 0, Math.PI * 2)
  ctx.strokeStyle = GOLD2; ctx.lineWidth = 1; ctx.stroke()
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

  // ── Tier badge + subtitle below photo ───────────────────────────────────────
  const tierName = (scan.tier ?? 'NORMIE').toUpperCase()
  const tierY    = CY + CR + 72
  ctx.textAlign = 'center'
  ctx.font      = 'bold 72px "Plus Jakarta Sans", Arial'
  const tierG   = ctx.createLinearGradient(W * 0.15, tierY, W * 0.85, tierY)
  tierG.addColorStop(0,    '#FFE47A')
  tierG.addColorStop(0.45, GOLD)
  tierG.addColorStop(1,    '#A8893A')
  ctx.fillStyle = tierG
  ctx.fillText(tierName, W / 2, tierY)

  const subY = tierY + 44
  ctx.font      = '400 28px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.30)'
  ctx.fillText('Your Results', W / 2, subY)

  // ── Divider ──────────────────────────────────────────────────────────────────
  const divY = subY + 44
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

  function drawBigStat(label, value, x, y, w, opts = {}) {
    // Cell bg
    rr(ctx, x, y, w, bigH, 20)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
    rr(ctx, x, y, w, bigH, 20); ctx.stroke()

    // Label
    ctx.textAlign = 'left'
    ctx.font      = '600 24px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    ctx.fillText(label, x + 28, y + 42)

    // Number — larger
    const numStr = value != null ? value.toFixed(1) : '—'
    ctx.font      = 'bold 112px "Space Grotesk", "Plus Jakarta Sans", Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(numStr, x + 28, y + 164)

    // /10
    const nw = ctx.measureText(numStr).width
    ctx.font      = '500 36px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = GOLD
    ctx.fillText('/10', x + 28 + nw + 8, y + 136)

    // Score delta (rescan improvement)
    if (opts.delta != null && opts.delta > 0) {
      ctx.font      = 'bold 32px "Plus Jakarta Sans", Arial'
      ctx.fillStyle = '#34C759'
      ctx.fillText(`+${opts.delta.toFixed(1)}`, x + 28 + nw + 12, y + 172)
    }

    // Sub-label (tier name under OVERALL)
    if (opts.subLabel) {
      ctx.font          = '600 20px "Plus Jakarta Sans", Arial'
      ctx.fillStyle     = GOLD
      ctx.letterSpacing = '1px'
      ctx.fillText(opts.subLabel, x + 28, y + 192)
      ctx.letterSpacing = '0px'
    }

    // Bar — thinner
    drawBar(ctx, x + 28, y + bigH - 22, w - 56, 7, value ?? 1)
  }

  const colL = L
  const colR = L + COL_W + gap
  drawBigStat('OVERALL',   score,     colL, gridTop, COL_W, {
    delta: scoreDelta,
    subLabel: (scan.tier ?? '').toUpperCase(),
  })
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
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1
    rr(ctx, x, y, w, pilH, 16); ctx.stroke()

    ctx.textAlign = 'left'
    ctx.font      = '600 20px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.36)'
    ctx.fillText(label, x + 24, y + 34)

    const valStr = val.toFixed(1)
    ctx.font      = 'bold 76px "Space Grotesk", Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(valStr, x + 24, y + 118)

    const vw = ctx.measureText(valStr).width
    ctx.font      = '500 26px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = GOLD
    ctx.fillText('/10', x + 24 + vw + 6, y + 96)

    drawBar(ctx, x + 24, y + pilH - 18, w - 48, 6, val)
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

  // Footer: icon + "Scanned by Ascendus" + domain
  const iconSize = 38
  let iconDrawn = false
  try {
    const icon = await loadImage('/src/assets/ascendus-icon.png')
    ctx.save(); ctx.globalAlpha = 0.70
    ctx.drawImage(icon, W / 2 - 120, footY + 22, iconSize, iconSize)
    ctx.restore()
    iconDrawn = true
  } catch {}

  ctx.textAlign = 'left'
  ctx.font      = '500 26px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText('Scanned by Ascendus', W / 2 - 120 + (iconDrawn ? iconSize + 12 : 0), footY + 48)

  ctx.textAlign     = 'center'
  ctx.font          = '600 24px "Plus Jakarta Sans", Arial'
  ctx.fillStyle     = GOLD
  ctx.letterSpacing = '1px'
  ctx.fillText('ascendus.app', W / 2, footY + 86)
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
