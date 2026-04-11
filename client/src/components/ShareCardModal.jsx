import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Share2, Download, Loader2 } from 'lucide-react'
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
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load failed'))
    img.src = src
  })
}

function goldLinear(ctx, x1, y1, x2, y2) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2)
  g.addColorStop(0,    '#FFE066')
  g.addColorStop(0.45, '#FFD700')
  g.addColorStop(1,    '#B8922A')
  return g
}

// ─── Celebrity fallbacks ───────────────────────────────────────────────────────

const CELEB_FALLBACKS = {
  male: {
    'strong':     [{ celebrity: 'Henry Cavill',   similarity: 74, shared_traits: 'Sharp jaw, high cheekbones, strong brow ridge' }, { celebrity: 'Brad Pitt',      similarity: 68, shared_traits: 'Defined cheekbones, square jaw, balanced thirds' }],
    'defined':    [{ celebrity: 'Zac Efron',       similarity: 71, shared_traits: 'Defined jaw, average cheekbones, balanced thirds' }, { celebrity: 'Tom Holland',    similarity: 65, shared_traits: 'Almond eyes, narrow jaw, oval face shape' }],
    'average':    [{ celebrity: 'Chris Evans',     similarity: 69, shared_traits: 'Balanced facial thirds, straight nose, average jaw' }, { celebrity: 'Jake Gyllenhaal', similarity: 63, shared_traits: 'Deep set eyes, oval face, medium cheekbones' }],
    'soft/round': [{ celebrity: 'Jack Black',      similarity: 66, shared_traits: 'Round face shape, soft jaw, wide nose' }, { celebrity: 'Seth Rogen',     similarity: 60, shared_traits: 'Round cheeks, undefined jaw, close set eyes' }],
  },
  female: {
    'strong':     [{ celebrity: 'Angelina Jolie',  similarity: 75, shared_traits: 'High cheekbones, sharp jaw, deep set eyes' }, { celebrity: 'Megan Fox',      similarity: 68, shared_traits: 'Sharp jaw, almond eyes, high cheekbones' }],
    'defined':    [{ celebrity: 'Natalie Portman', similarity: 73, shared_traits: 'Oval face, defined jaw, almond eyes' }, { celebrity: 'Zendaya',        similarity: 66, shared_traits: 'High cheekbones, oval face, almond eyes' }],
    'average':    [{ celebrity: 'Jennifer Aniston',similarity: 70, shared_traits: 'Oval face, balanced thirds, straight nose' }, { celebrity: 'Anne Hathaway', similarity: 63, shared_traits: 'Oval face, wide eyes, average cheekbones' }],
    'soft/round': [{ celebrity: 'Adele',           similarity: 67, shared_traits: 'Round face shape, soft jaw, full cheeks' }, { celebrity: 'Rebel Wilson',   similarity: 61, shared_traits: 'Round face, soft jaw, wide cheeks' }],
  },
}

// ─── Card drawing — 1080 × 1920 px ───────────────────────────────────────────
//
//  Zone   Y-range      %     Contents
//  ─────  ──────────  ────   ─────────────────────────────
//  A      0 – 640     33%   bg glow + logo + face circle
//  B      640 – 870   12%   tier + score
//  C      870 – 900    1%   divider
//  D      900 – 1490  31%   4 pillars
//  E      1490 – 1730 13%   celeb pill + bottom row
//  F      1730 – 1920 10%   footer tagline
//
async function drawCard({ canvas, scan, facePhotoUrl, phase }) {
  await document.fonts.ready

  const ctx = canvas.getContext('2d')
  const W = 1080, H = 1920
  canvas.width = W
  canvas.height = H

  const { umaxScore, glowScore, tier, pillars: sp, aiScore, gender, celebrityMatches } = scan
  const displayScore = glowScore ?? (umaxScore != null ? umaxScore / 10 : null)
  const pillars   = sp ?? aiScore?.pillars ?? null
  const structure = aiScore?.facialStructure ?? 'average'
  const gKey      = gender === 'female' ? 'female' : 'male'
  const sKey      = ['strong','defined','average','soft/round'].includes(structure) ? structure : 'average'
  const matches   = (celebrityMatches ?? aiScore?.celebrityMatches) || CELEB_FALLBACKS[gKey][sKey]
  const topMatch  = matches?.[0] ?? null
  const phaseMeta = PHASE_META[phase ?? 'TRANSFORM']
  const potential = Math.min(10, (displayScore ?? 5) + 1.4).toFixed(1)

  // ── Zone A: Background ─────────────────────────────────────────────────────
  // Rich dark warm base
  ctx.fillStyle = '#0E0A04'
  ctx.fillRect(0, 0, W, H)

  // Warm radial glow centered on photo area
  const bg1 = ctx.createRadialGradient(W/2, 320, 0, W/2, 320, 700)
  bg1.addColorStop(0,   'rgba(198,150,40,0.32)')
  bg1.addColorStop(0.5, 'rgba(140,90,10,0.12)')
  bg1.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = bg1
  ctx.fillRect(0, 0, W, H)

  // Subtle diagonal grain
  ctx.save()
  ctx.globalAlpha = 0.025
  ctx.strokeStyle = '#D4A830'
  ctx.lineWidth = 1
  for (let i = -H; i < W + H; i += 14) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke()
  }
  ctx.restore()

  // ── Zone A: Logo top-right ─────────────────────────────────────────────────
  ctx.save()
  ctx.textAlign = 'right'
  ctx.font = 'bold 38px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText('Ascendus', W - 60, 72)
  // gold dot
  ctx.beginPath()
  ctx.arc(W - 50, 56, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#C6A85C'
  ctx.fill()
  ctx.restore()

  // ── Zone A: Face circle — center Y=330, R=240 ──────────────────────────────
  const cx = W / 2, cy = 340, R = 240

  // Multi-layer outer glow
  for (let i = 4; i >= 1; i--) {
    ctx.save()
    ctx.globalAlpha = 0.08 * i
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur  = 30 * i
    ctx.beginPath()
    ctx.arc(cx, cy, R + 24, 0, Math.PI * 2)
    ctx.strokeStyle = '#FFD700'
    ctx.lineWidth   = 2
    ctx.stroke()
    ctx.restore()
  }

  // Gold ring — thick, gradient
  const ringG = goldLinear(ctx, cx - R, cy - R, cx + R, cy + R)
  ctx.save()
  ctx.shadowColor = 'rgba(255,215,0,0.55)'
  ctx.shadowBlur  = 28
  ctx.beginPath()
  ctx.arc(cx, cy, R + 18, 0, Math.PI * 2)
  ctx.strokeStyle = ringG
  ctx.lineWidth   = 20
  ctx.stroke()
  ctx.restore()

  // Thin inner accent ring
  ctx.beginPath()
  ctx.arc(cx, cy, R + 3, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,215,0,0.18)'
  ctx.lineWidth   = 2
  ctx.stroke()

  // Dark bg fill inside circle (ensures crisp boundary even if photo has dark areas)
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = '#1A1008'
  ctx.fill()

  // Offscreen canvas = CSS: border-radius:50%, overflow:hidden, object-fit:cover, object-position:center top
  const D  = R * 2
  const oc = document.createElement('canvas')
  oc.width = D; oc.height = D
  const ox = oc.getContext('2d')

  // Clip offscreen canvas to perfect circle (100% isolated — no bleed onto main canvas)
  ox.beginPath()
  ox.arc(D / 2, D / 2, R, 0, Math.PI * 2)
  ox.clip()

  if (facePhotoUrl) {
    try {
      const img = await loadImage(facePhotoUrl)
      const iw = img.width, ih = img.height
      let sx, sy, cropW, cropH

      if (iw / ih >= 1) {
        // Landscape — center square crop (object-fit: cover, object-position: center)
        cropW = cropH = ih
        sx = (iw - cropW) / 2
        sy = 0
      } else {
        // Portrait — full-width square anchored to top (object-position: center top)
        cropW = cropH = iw
        sx = 0
        sy = Math.max(0, Math.min(ih * 0.05, ih - cropH))
      }

      // Draw into offscreen square — fills 100% width/height of the circle canvas
      ox.drawImage(img, sx, sy, cropW, cropH, 0, 0, D, D)
    } catch {
      ox.fillStyle = '#1E1208'
      ox.fillRect(0, 0, D, D)
    }
  } else {
    ox.fillStyle = '#1E1208'
    ox.fillRect(0, 0, D, D)
  }

  // Stamp the perfectly-clipped circle onto the main canvas
  ctx.drawImage(oc, cx - R, cy - R)

  // Crisp white inner rim — marks the circle boundary clearly
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 4
  ctx.stroke()

  // ── Zone B: Tier name ──────────────────────────────────────────────────────
  const tierY = cy + R + 78
  ctx.textAlign = 'center'
  ctx.font = 'bold 76px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = goldLinear(ctx, W * 0.15, tierY, W * 0.85, tierY)
  ctx.fillText(tier ?? 'Unknown', W / 2, tierY)

  // Score
  const scoreStr = displayScore != null ? displayScore.toFixed(1) : '—'
  const scoreY   = tierY + 168
  ctx.font = 'bold 160px "Space Grotesk", "Plus Jakarta Sans", Arial'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(scoreStr, W / 2, scoreY)

  // /10 superscript — right of score
  const scoreW = ctx.measureText(scoreStr).width
  ctx.font = '500 48px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.textAlign = 'left'
  ctx.fillText('/10', W / 2 + scoreW * 0.5 + 12, scoreY - 110)
  ctx.textAlign = 'center'

  // ── Zone C: Divider ────────────────────────────────────────────────────────
  const divY = scoreY + 50
  const divG  = ctx.createLinearGradient(W * 0.1, divY, W * 0.9, divY)
  divG.addColorStop(0,   'rgba(198,168,92,0)')
  divG.addColorStop(0.5, 'rgba(198,168,92,0.55)')
  divG.addColorStop(1,   'rgba(198,168,92,0)')
  ctx.strokeStyle = divG
  ctx.lineWidth   = 1.5
  ctx.beginPath(); ctx.moveTo(W * 0.1, divY); ctx.lineTo(W * 0.9, divY); ctx.stroke()

  // ── Zone D: 4 Pillars ─────────────────────────────────────────────────────
  const pTop     = divY + 44
  const pLeft    = 80
  const pRight   = W - 80
  const pW       = pRight - pLeft
  const rowH     = 128  // height per pillar row
  const trackH   = 8
  const labelSize = 36
  const scoreSize = 36

  // Section label
  ctx.font = `600 26px "Plus Jakarta Sans", Arial`
  ctx.fillStyle = 'rgba(198,168,92,0.55)'
  ctx.textAlign = 'center'
  ctx.fillText('4 PILLARS', W / 2, pTop - 10)

  const PILLARS = [
    { label: 'Harmony',    val: pillars?.harmony    ?? 5.0 },
    { label: 'Angularity', val: pillars?.angularity ?? 5.0 },
    { label: 'Features',   val: pillars?.features   ?? 5.0 },
    { label: 'Dimorphism', val: pillars?.dimorphism ?? 5.0 },
  ]

  PILLARS.forEach(({ label, val }, i) => {
    const baseY = pTop + i * rowH + 20
    const pct   = Math.max(0, Math.min(1, (val - 1) / 9))
    const col   = val >= 7 ? '#34C759' : val >= 4.5 ? '#FFD700' : '#E07A5F'

    // Row background pill
    rr(ctx, pLeft - 16, baseY - 10, pW + 32, rowH - 8, 16)
    ctx.fillStyle = 'rgba(255,255,255,0.025)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Pillar name
    ctx.textAlign = 'left'
    ctx.font = `600 ${labelSize}px "Plus Jakarta Sans", Arial`
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.fillText(label, pLeft, baseY + 36)

    // Score
    ctx.textAlign = 'right'
    ctx.font = `bold ${scoreSize}px "Space Grotesk", Arial`
    ctx.fillStyle = col
    ctx.fillText(val.toFixed(1), pRight, baseY + 36)

    // Track
    const trackY = baseY + 52
    rr(ctx, pLeft, trackY, pW, trackH, trackH / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.fill()

    // Fill bar
    if (pct > 0.02) {
      const fillW = pW * pct
      const barG  = ctx.createLinearGradient(pLeft, trackY, pLeft + fillW, trackY)
      barG.addColorStop(0, col + '88')
      barG.addColorStop(1, col)
      rr(ctx, pLeft, trackY, fillW, trackH, trackH / 2)
      ctx.fillStyle = barG
      ctx.fill()
    }
  })

  // ── Zone E: Celebrity lookalike ────────────────────────────────────────────
  const eTop   = pTop + 4 * rowH + 28
  const pillW  = 820
  const pillH  = 110
  const pillX  = (W - pillW) / 2
  const pillY  = eTop

  // Pill bg
  rr(ctx, pillX, pillY, pillW, pillH, 28)
  const pillBg = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH)
  pillBg.addColorStop(0, 'rgba(40,28,4,0.85)')
  pillBg.addColorStop(1, 'rgba(28,18,2,0.85)')
  ctx.fillStyle = pillBg
  ctx.fill()
  ctx.strokeStyle = 'rgba(198,168,92,0.35)'
  ctx.lineWidth   = 1.5
  rr(ctx, pillX, pillY, pillW, pillH, 28)
  ctx.stroke()

  // "Resembles" label
  ctx.textAlign  = 'center'
  ctx.font       = '500 26px "Plus Jakarta Sans", Arial'
  ctx.fillStyle  = 'rgba(255,255,255,0.38)'
  ctx.fillText('Resembles', W / 2, pillY + 38)

  // Celebrity name + match %
  const celebText = topMatch
    ? `${topMatch.celebrity}  ·  ${topMatch.similarity}% match`
    : 'No match available'
  ctx.font      = 'bold 44px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = goldLinear(ctx, pillX + 60, pillY + 70, pillX + pillW - 60, pillY + 70)
  ctx.fillText(celebText, W / 2, pillY + 84)

  // ── Zone E: Phase badge (left) + Potential (right) ─────────────────────────
  const rowY    = pillY + pillH + 48
  const phColor = phaseMeta?.color ?? '#C6A85C'
  const phLabel = phaseMeta?.label ?? 'Transform'
  const phEmoji = phaseMeta?.emoji ?? '⚡'

  // Phase pill
  const bW = 360, bH = 80
  rr(ctx, pLeft, rowY, bW, bH, 20)
  ctx.fillStyle   = phColor + '1A'
  ctx.fill()
  ctx.strokeStyle = phColor + '50'
  ctx.lineWidth   = 1.5
  rr(ctx, pLeft, rowY, bW, bH, 20)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.font      = 'bold 34px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = phColor
  ctx.fillText(`${phEmoji}  ${phLabel}`, pLeft + 24, rowY + 53)

  // Potential score
  ctx.textAlign = 'right'
  ctx.font      = '500 26px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.40)'
  ctx.fillText('Potential', pRight, rowY + 30)

  ctx.font      = 'bold 78px "Space Grotesk", Arial'
  ctx.fillStyle = '#34C759'
  ctx.fillText(potential, pRight, rowY + 96)

  // ── Zone F: Footer ─────────────────────────────────────────────────────────
  // Subtle bottom fade
  const fadeG = ctx.createLinearGradient(0, H - 200, 0, H)
  fadeG.addColorStop(0, 'rgba(0,0,0,0)')
  fadeG.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = fadeG
  ctx.fillRect(0, H - 200, W, 200)

  // Logo image in footer top-right corner
  try {
    const logoImg = await loadImage('/src/assets/ascendus-icon.png')
    const logoW = 52
    const logoH = 52
    ctx.save()
    ctx.globalAlpha = 0.7
    ctx.drawImage(logoImg, W - logoW - 40, H - logoH - 36, logoW, logoH)
    ctx.restore()
  } catch {
    // fallback text if logo fails to load
    ctx.textAlign  = 'center'
    ctx.font       = '500 28px "Plus Jakarta Sans", Arial'
    ctx.fillStyle  = 'rgba(255,255,255,0.22)'
    ctx.fillText('Ascendus', W / 2, H - 52)
  }
}

// ─── Modal component ──────────────────────────────────────────────────────────

export default function ShareCardModal({ scan, isPremium, facePhotoUrl, phase, onClose }) {
  const canvasRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [sharing, setSharing] = useState(false)

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
      const res = await fetch(preview)
      const blob = await res.blob()
      const file = new File([blob], 'ascendus-results.jpg', { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `My Ascendus Score — ${scan.tier} · ${displayScore?.toFixed(1)}/10`,
          text: 'Scanned by Ascendus 🌟',
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
      style={{ background: 'rgba(6,4,1,0.94)', backdropFilter: 'blur(20px)' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pt-10 pb-2 flex-shrink-0">
        <div>
          <p className="font-heading font-bold text-base text-white leading-tight">Share Your Card</p>
          <p className="text-[11px] text-white/40 font-body mt-0.5">9:16 · Instagram Stories</p>
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

      {/* Card preview — fills available vertical space */}
      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
        {generating ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="text-[#C6A85C] animate-spin" />
            <p className="text-white/55 text-sm font-body">Building your card...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-white/55 text-sm mb-3">{error}</p>
            <button onClick={generate} className="px-4 py-2 rounded-xl text-white text-sm bg-white/10">Retry</button>
          </div>
        ) : preview ? (
          <div
            style={{
              height: 'min(calc(100vh - 230px), calc(95vw * 16 / 9))',
              aspectRatio: '9 / 16',
              width: 'auto',
              flexShrink: 0,
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(198,168,92,0.20), 0 24px 60px rgba(0,0,0,0.8)',
            }}
          >
            <img src={preview} alt="Share card" style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
        ) : null}
      </div>

      {/* Buttons */}
      <div className="px-4 pb-10 pt-2 flex flex-col gap-2.5 flex-shrink-0">
        <button
          onClick={handleShare}
          disabled={!preview || generating || sharing}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] text-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #FFE066 0%, #FFD700 45%, #B8922A 100%)' }}
        >
          {sharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
          {sharing ? 'Sharing...' : 'Share to Stories'}
        </button>
        <button
          onClick={handleSave}
          disabled={!preview || generating}
          className="w-full py-3.5 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <Download size={15} />
          Save to Camera Roll
        </button>
      </div>
    </div>
  )
}
