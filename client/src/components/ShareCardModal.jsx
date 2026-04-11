import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Share2, Download, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { PHASE_META } from '../utils/phase'

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

function goldGrad(ctx, x1, y1, x2, y2) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2)
  g.addColorStop(0,    '#FFE47A')
  g.addColorStop(0.45, '#C9A84C')
  g.addColorStop(1,    '#A8893A')
  return g
}

// ─── Celebrity fallbacks ───────────────────────────────────────────────────────
const CELEB_FALLBACKS = {
  male: {
    'strong':     [{ celebrity: 'Henry Cavill',    similarity: 74, shared_traits: 'Sharp jaw, high cheekbones, strong brow ridge' },     { celebrity: 'Brad Pitt',          similarity: 68, shared_traits: 'Defined cheekbones, square jaw, balanced thirds' }],
    'defined':    [{ celebrity: 'Zac Efron',        similarity: 71, shared_traits: 'Defined jaw, average cheekbones, balanced thirds' },  { celebrity: 'Tom Holland',        similarity: 65, shared_traits: 'Almond eyes, narrow jaw, oval face shape' }],
    'average':    [{ celebrity: 'Chris Evans',      similarity: 69, shared_traits: 'Balanced facial thirds, straight nose, average jaw' },{ celebrity: 'Jake Gyllenhaal',    similarity: 63, shared_traits: 'Deep set eyes, oval face, medium cheekbones' }],
    'soft/round': [{ celebrity: 'Jack Black',       similarity: 66, shared_traits: 'Round face shape, soft jaw, wide nose' },             { celebrity: 'Seth Rogen',         similarity: 60, shared_traits: 'Round cheeks, undefined jaw, close set eyes' }],
  },
  female: {
    'strong':     [{ celebrity: 'Angelina Jolie',   similarity: 75, shared_traits: 'High cheekbones, sharp jaw, deep set eyes' },         { celebrity: 'Megan Fox',          similarity: 68, shared_traits: 'Sharp jaw, almond eyes, high cheekbones' }],
    'defined':    [{ celebrity: 'Natalie Portman',  similarity: 73, shared_traits: 'Oval face, defined jaw, almond eyes' },                { celebrity: 'Zendaya',            similarity: 66, shared_traits: 'High cheekbones, oval face, almond eyes' }],
    'average':    [{ celebrity: 'Jennifer Aniston', similarity: 70, shared_traits: 'Oval face, balanced thirds, straight nose' },          { celebrity: 'Anne Hathaway',      similarity: 63, shared_traits: 'Oval face, wide eyes, average cheekbones' }],
    'soft/round': [{ celebrity: 'Adele',            similarity: 67, shared_traits: 'Round face shape, soft jaw, full cheeks' },            { celebrity: 'Rebel Wilson',       similarity: 61, shared_traits: 'Round face, soft jaw, wide cheeks' }],
  },
}

// ─── Canvas card draw — 1080 × 1920 (9:16) ───────────────────────────────────
//
//  Zone   Y-range        Contents
//  ─────  ───────────── ──────────────────────────────────────────────
//  BG     0–1920        Black + radial gold glow + fine grid
//  TOP    0–80          ASCENDUS wordmark top-right
//  FACE   80–616        Face circle (R=268, cy=348)
//  TIER   681           Tier name bold gold
//  DIV1   731           Thin gold divider
//  SCORE  866           Massive white score + /10 gold
//  DIV2   914           Thin gold divider
//  PIL    970–1448      4 pillars (label + 4×112px rows)
//  CELEB  1474–1602     Celebrity pill
//  ROW    1638–1738     Phase badge + Potential
//  FOOT   1780–1900     Icon + tagline + domain
//
async function drawCard({ canvas, scan, facePhotoUrl, phase }) {
  await document.fonts.ready
  const ctx = canvas.getContext('2d')
  const W = 1080, H = 1920
  canvas.width  = W
  canvas.height = H

  const { umaxScore, glowScore, tier, pillars: sp, aiScore, gender, celebrityMatches } = scan
  const displayScore = glowScore ?? (umaxScore != null ? umaxScore / 10 : null)
  const pillars      = sp ?? aiScore?.pillars ?? null
  const structure    = aiScore?.facialStructure ?? 'average'
  const gKey         = gender === 'female' ? 'female' : 'male'
  const sKey         = ['strong','defined','average','soft/round'].includes(structure) ? structure : 'average'
  const matches      = (celebrityMatches ?? aiScore?.celebrityMatches) || CELEB_FALLBACKS[gKey][sKey]
  const topMatch     = matches?.[0] ?? null
  const phaseMeta    = PHASE_META[phase ?? 'TRANSFORM']
  const potential    = Math.min(10, (displayScore ?? 5) + 1.4).toFixed(1)

  // ── Background ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0A0A0A'
  ctx.fillRect(0, 0, W, H)

  // Radial gold glow centered on photo area
  const radial = ctx.createRadialGradient(W / 2, H * 0.28, 0, W / 2, H * 0.28, W * 0.78)
  radial.addColorStop(0,    'rgba(201,168,76,0.15)')
  radial.addColorStop(0.5,  'rgba(201,168,76,0.05)')
  radial.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, W, H)

  // Fine gold grid
  ctx.save()
  ctx.globalAlpha = 0.028
  ctx.strokeStyle = '#C9A84C'
  ctx.lineWidth   = 0.8
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0);  ctx.lineTo(x, H);  ctx.stroke() }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y);  ctx.lineTo(W, y);  ctx.stroke() }
  ctx.restore()

  // ── ASCENDUS wordmark top-right ────────────────────────────────────────────
  ctx.save()
  ctx.textAlign     = 'right'
  ctx.font          = '600 28px "Plus Jakarta Sans", Arial'
  ctx.letterSpacing = '4px'
  ctx.fillStyle     = '#C9A84C'
  ctx.fillText('ASCENDUS', W - 56, 72)
  ctx.restore()

  // ── Face circle (cy=348, R=268) ────────────────────────────────────────────
  const R  = 268
  const cx = W / 2
  const cy = 80 + R   // 348

  // Soft outer glow rings
  for (let i = 3; i >= 1; i--) {
    ctx.save()
    ctx.globalAlpha = 0.06 * i
    ctx.beginPath()
    ctx.arc(cx, cy, R + 28 + i * 10, 0, Math.PI * 2)
    ctx.strokeStyle = '#C9A84C'
    ctx.lineWidth   = 1
    ctx.stroke()
    ctx.restore()
  }

  // Gold ring with glow
  ctx.save()
  ctx.shadowColor = 'rgba(201,168,76,0.55)'
  ctx.shadowBlur  = 24
  ctx.beginPath()
  ctx.arc(cx, cy, R + 12, 0, Math.PI * 2)
  ctx.strokeStyle = goldGrad(ctx, cx - R, cy - R, cx + R, cy + R)
  ctx.lineWidth   = 5
  ctx.stroke()
  ctx.restore()

  // Photo — offscreen canvas clip
  const D  = R * 2
  const oc = document.createElement('canvas')
  oc.width = D; oc.height = D
  const ox = oc.getContext('2d')
  ox.beginPath(); ox.arc(D / 2, D / 2, R, 0, Math.PI * 2); ox.clip()
  if (facePhotoUrl) {
    try {
      const img = await loadImage(facePhotoUrl)
      const iw = img.width, ih = img.height
      let sx, sy, cropW, cropH
      if (iw / ih >= 1) { cropW = cropH = ih; sx = (iw - cropW) / 2; sy = 0 }
      else               { cropW = cropH = iw; sx = 0; sy = Math.max(0, Math.min(ih * 0.05, ih - cropH)) }
      ox.drawImage(img, sx, sy, cropW, cropH, 0, 0, D, D)
    } catch { ox.fillStyle = '#1A1A1A'; ox.fillRect(0, 0, D, D) }
  } else { ox.fillStyle = '#1A1A1A'; ox.fillRect(0, 0, D, D) }
  ctx.drawImage(oc, cx - R, cy - R)

  // Thin inner rim
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 3; ctx.stroke()

  // ── Tier name ──────────────────────────────────────────────────────────────
  const tierY = cy + R + 65                          // 681
  ctx.textAlign = 'center'
  ctx.font      = 'bold 72px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = goldGrad(ctx, W * 0.15, tierY, W * 0.85, tierY)
  ctx.fillText((tier ?? 'NORMIE').toUpperCase(), W / 2, tierY)

  // Thin gold divider
  const div1Y = tierY + 50                           // 731
  const dg1 = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0)
  dg1.addColorStop(0, 'rgba(201,168,76,0)'); dg1.addColorStop(0.3, 'rgba(201,168,76,0.65)'); dg1.addColorStop(0.7, 'rgba(201,168,76,0.65)'); dg1.addColorStop(1, 'rgba(201,168,76,0)')
  ctx.strokeStyle = dg1; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W * 0.15, div1Y); ctx.lineTo(W * 0.85, div1Y); ctx.stroke()

  // ── Score ──────────────────────────────────────────────────────────────────
  const scoreStr = displayScore != null ? displayScore.toFixed(1) : '—'
  const scoreY   = div1Y + 135                       // 866
  ctx.textAlign  = 'center'
  ctx.font       = 'bold 192px "Space Grotesk", "Plus Jakarta Sans", Arial'
  ctx.fillStyle  = '#FFFFFF'
  ctx.fillText(scoreStr, W / 2, scoreY)

  const sW = ctx.measureText(scoreStr).width
  ctx.save()
  ctx.font      = '500 52px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = '#C9A84C'
  ctx.textAlign = 'left'
  ctx.fillText('/10', W / 2 + sW * 0.48 + 8, scoreY - 126)
  ctx.restore()

  // Second divider
  const div2Y = scoreY + 48                          // 914
  const dg2 = ctx.createLinearGradient(W * 0.1, 0, W * 0.9, 0)
  dg2.addColorStop(0, 'rgba(201,168,76,0)'); dg2.addColorStop(0.5, 'rgba(201,168,76,0.35)'); dg2.addColorStop(1, 'rgba(201,168,76,0)')
  ctx.strokeStyle = dg2; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(W * 0.1, div2Y); ctx.lineTo(W * 0.9, div2Y); ctx.stroke()

  // ── 4 Pillars ──────────────────────────────────────────────────────────────
  const pLeft = 80, pRight = W - 80, pW = pRight - pLeft
  const labelY = div2Y + 56                          // 970

  ctx.textAlign     = 'center'
  ctx.font          = '600 26px "Plus Jakarta Sans", Arial'
  ctx.letterSpacing = '3px'
  ctx.fillStyle     = 'rgba(201,168,76,0.65)'
  ctx.fillText('4 PILLARS', W / 2, labelY)
  ctx.letterSpacing = '0px'

  ctx.strokeStyle = 'rgba(201,168,76,0.28)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pLeft,      labelY - 8); ctx.lineTo(W / 2 - 112, labelY - 8); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W / 2 + 112, labelY - 8); ctx.lineTo(pRight,     labelY - 8); ctx.stroke()

  const PILLARS = [
    { label: 'Harmony',    val: pillars?.harmony    ?? 5.0 },
    { label: 'Angularity', val: pillars?.angularity ?? 5.0 },
    { label: 'Features',   val: pillars?.features   ?? 5.0 },
    { label: 'Dimorphism', val: pillars?.dimorphism ?? 5.0 },
  ]
  const rowH = 112, pTop = labelY + 30              // 1000

  PILLARS.forEach(({ label, val }, i) => {
    const baseY = pTop + i * rowH
    const pct   = Math.max(0, Math.min(1, (val - 1) / 9))
    const col   = val >= 7 ? '#34C759' : val >= 4.5 ? '#C9A84C' : '#E07A5F'

    ctx.textAlign = 'left'
    ctx.font      = '500 38px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(label, pLeft, baseY + 38)

    ctx.textAlign = 'right'
    ctx.font      = 'bold 38px "Space Grotesk", Arial'
    ctx.fillStyle = col
    ctx.fillText(val.toFixed(1), pRight, baseY + 38)

    const trackY = baseY + 54, trackH = 8
    rr(ctx, pLeft, trackY, pW, trackH, trackH / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill()

    if (pct > 0.01) {
      const fillW = pW * pct
      const bg = ctx.createLinearGradient(pLeft, 0, pLeft + fillW, 0)
      bg.addColorStop(0, col + '88'); bg.addColorStop(1, col)
      rr(ctx, pLeft, trackY, fillW, trackH, trackH / 2)
      ctx.fillStyle = bg; ctx.fill()
    }

    if (i < 3) {
      const sepY = baseY + rowH - 6
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(pLeft, sepY); ctx.lineTo(pRight, sepY); ctx.stroke()
    }
  })

  // ── Celebrity pill ─────────────────────────────────────────────────────────
  const pillTop = pTop + 4 * rowH + 26               // 1474
  const pillW = 920, pillH = 128, pillX = (W - pillW) / 2

  rr(ctx, pillX, pillTop, pillW, pillH, 32)
  ctx.fillStyle = 'rgba(8,6,3,0.92)'; ctx.fill()
  ctx.strokeStyle = 'rgba(201,168,76,0.28)'; ctx.lineWidth = 1
  rr(ctx, pillX, pillTop, pillW, pillH, 32); ctx.stroke()

  ctx.textAlign     = 'center'
  ctx.font          = '500 24px "Plus Jakarta Sans", Arial'
  ctx.letterSpacing = '2px'
  ctx.fillStyle     = 'rgba(255,255,255,0.32)'
  ctx.fillText('RESEMBLES', W / 2, pillTop + 38)
  ctx.letterSpacing = '0px'

  const celebText = topMatch
    ? `${topMatch.celebrity}  ·  ${topMatch.similarity}% match`
    : 'No match available'
  ctx.font      = 'bold 44px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = goldGrad(ctx, pillX + 80, pillTop, pillX + pillW - 80, pillTop + pillH)
  ctx.fillText(celebText, W / 2, pillTop + 88)

  if (topMatch?.shared_traits) {
    ctx.font      = '400 24px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fillText(topMatch.shared_traits.split(',').slice(0, 2).join(', '), W / 2, pillTop + 116)
  }

  // ── Phase badge + Potential ────────────────────────────────────────────────
  const rowY2   = pillTop + pillH + 36               // 1638
  const phColor = phaseMeta?.color ?? '#C9A84C'
  const phLabel = phaseMeta?.label ?? 'Transform'
  const phEmoji = phaseMeta?.emoji ?? '⚡'

  const bW = 380, bH = 82
  rr(ctx, pLeft, rowY2, bW, bH, 22)
  ctx.fillStyle = phColor + '1A'; ctx.fill()
  ctx.strokeStyle = phColor + '50'; ctx.lineWidth = 1
  rr(ctx, pLeft, rowY2, bW, bH, 22); ctx.stroke()
  ctx.textAlign = 'left'
  ctx.font      = 'bold 34px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = phColor
  ctx.fillText(`${phEmoji}  ${phLabel.toUpperCase()}`, pLeft + 24, rowY2 + 54)

  ctx.textAlign     = 'right'
  ctx.font          = '500 24px "Plus Jakarta Sans", Arial'
  ctx.letterSpacing = '2px'
  ctx.fillStyle     = 'rgba(255,255,255,0.38)'
  ctx.fillText('POTENTIAL', pRight, rowY2 + 28)
  ctx.letterSpacing = '0px'

  ctx.font      = 'bold 82px "Space Grotesk", Arial'
  ctx.fillStyle = '#34C759'
  ctx.fillText(potential, pRight, rowY2 + 102)

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = 1790

  try {
    const icon = await loadImage('/src/assets/ascendus-icon.png')
    ctx.save()
    ctx.globalAlpha = 0.72
    ctx.drawImage(icon, W / 2 - 22, footerY, 44, 44)
    ctx.restore()
  } catch { /* no icon — text fallback below covers it */ }

  ctx.textAlign = 'center'
  ctx.font      = '400 28px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.30)'
  ctx.fillText('Scanned by Ascendus', W / 2, footerY + 68)

  ctx.font          = '600 26px "Plus Jakarta Sans", Arial'
  ctx.letterSpacing = '1px'
  ctx.fillStyle     = '#C9A84C'
  ctx.fillText('ascendus.app', W / 2, footerY + 100)
  ctx.letterSpacing = '0px'
}

// ─── Score count-up hook ──────────────────────────────────────────────────────
function useCountUp(target, duration = 1300, active = true) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (!active || target == null) return
    const start = Date.now()
    const tick  = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setCurrent(parseFloat((eased * target).toFixed(1)))
      if (progress < 1) requestAnimationFrame(tick)
      else setCurrent(target)
    }
    const id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [target, duration, active])
  return current
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export default function ShareCardModal({ scan, isPremium, facePhotoUrl, phase, onClose }) {
  const canvasRef    = useRef(null)
  const [generating, setGenerating] = useState(true)
  const [preview,    setPreview]    = useState(null)
  const [error,      setError]      = useState(null)
  const [sharing,    setSharing]    = useState(false)

  const displayScore = scan
    ? (scan.glowScore ?? (scan.umaxScore != null ? scan.umaxScore / 10 : null))
    : null

  const countedScore = useCountUp(displayScore, 1300, generating && displayScore != null)

  const generate = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !scan) return
    setGenerating(true)
    setError(null)
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
      const res  = await fetch(preview)
      const blob = await res.blob()
      const file = new File([blob], 'ascendus-results.jpg', { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `My Ascendus Score — ${scan.tier} · ${displayScore?.toFixed(1)}/10`,
          text:  'Scanned by Ascendus 🌟',
          files: [file],
        })
      } else {
        const a = document.createElement('a')
        a.href = preview; a.download = 'ascendus-results.jpg'; a.click()
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError('Share failed. Try saving instead.')
    } finally {
      setSharing(false)
    }
  }

  function handleSave() {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview; a.download = 'ascendus-story.jpg'; a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(4,3,1,0.96)', backdropFilter: 'blur(24px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-10 pb-2 flex-shrink-0">
        <div>
          <p className="font-heading font-bold text-base text-white leading-tight">Share Your Card</p>
          <p className="text-[11px] font-body mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            9:16  ·  Instagram Stories  ·  TikTok
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

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-4">
        {generating ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-5"
          >
            {displayScore != null && (
              <div className="text-center">
                <p
                  className="font-heading font-bold"
                  style={{ fontSize: 88, lineHeight: 1, color: '#FFFFFF', letterSpacing: '-0.02em' }}
                >
                  {countedScore.toFixed(1)}
                </p>
                <p className="font-body text-[14px] mt-1" style={{ color: '#C9A84C' }}>/10</p>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <Loader2 size={15} className="animate-spin" style={{ color: '#C9A84C' }} />
              <p className="text-[13px] font-body" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Building your card…
              </p>
            </div>
          </motion.div>
        ) : error ? (
          <div className="text-center">
            <p className="text-sm font-body mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{error}</p>
            <button
              onClick={generate}
              className="px-4 py-2 rounded-xl text-white text-sm font-body"
              style={{ background: 'rgba(255,255,255,0.10)' }}
            >
              Retry
            </button>
          </div>
        ) : preview ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              height:      'min(calc(100vh - 232px), calc(86vw * 16 / 9))',
              aspectRatio: '9 / 16',
              width:       'auto',
              flexShrink:  0,
              borderRadius: '16px',
              overflow:    'hidden',
              boxShadow:   '0 0 0 1px rgba(201,168,76,0.22), 0 24px 64px rgba(0,0,0,0.9), 0 0 48px rgba(201,168,76,0.07)',
            }}
          >
            <img src={preview} alt="Share card" style={{ width: '100%', height: '100%', display: 'block' }} />
          </motion.div>
        ) : null}
      </div>

      {/* Buttons */}
      <div className="px-4 pb-10 pt-3 flex flex-col gap-2.5 flex-shrink-0">
        <motion.button
          onClick={handleShare}
          disabled={!preview || generating || sharing}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] text-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{
            background:     'linear-gradient(135deg, #FFE47A 0%, #C9A84C 50%, #A8893A 100%)',
            letterSpacing:  '0.01em',
          }}
        >
          {sharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
          {sharing ? 'Sharing…' : 'Share to Stories'}
        </motion.button>
        <motion.button
          onClick={handleSave}
          disabled={!preview || generating}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3.5 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color:      'rgba(255,255,255,0.70)',
            border:     '1px solid rgba(255,255,255,0.09)',
          }}
        >
          <Download size={15} />
          Save to Camera Roll
        </motion.button>
      </div>
    </div>
  )
}
