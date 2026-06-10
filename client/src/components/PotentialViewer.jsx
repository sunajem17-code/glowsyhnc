import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2, Download, Loader2, Sparkles, AlertTriangle, Timer } from 'lucide-react'
import { api } from '../utils/api'

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    if (src && !src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('load failed'))
    img.src = src
  })
}

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

// Draw a face photo clipped to a circle, with optional ring color + glow
async function drawFaceCircle(ctx, photoUrl, cx, cy, r, ringColor, glowColor) {
  // Photo clipped to circle
  const D  = r * 2
  const oc = document.createElement('canvas')
  oc.width = D; oc.height = D
  const ox = oc.getContext('2d')
  ox.beginPath(); ox.arc(r, r, r, 0, Math.PI * 2); ox.clip()
  if (photoUrl) {
    try {
      const img = await loadImage(photoUrl)
      const iw = img.width, ih = img.height
      let sx, sy, cw, ch
      if (iw / ih >= 1) { cw = ch = ih; sx = (iw - cw) / 2; sy = 0 }
      else               { cw = ch = iw; sx = 0;              sy = Math.max(0, ih * 0.05) }
      ox.drawImage(img, sx, sy, cw, ch, 0, 0, D, D)
    } catch {
      ox.fillStyle = '#1E1E1E'; ox.fillRect(0, 0, D, D)
    }
  } else {
    ox.fillStyle = '#1E1E1E'; ox.fillRect(0, 0, D, D)
  }
  ctx.drawImage(oc, cx - r, cy - r)

  // Ring glow
  if (glowColor) {
    ctx.save()
    ctx.shadowColor = glowColor
    ctx.shadowBlur  = 40
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2)
    ctx.strokeStyle = ringColor
    ctx.lineWidth   = 7
    ctx.stroke()
    ctx.restore()
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2)
    ctx.strokeStyle = ringColor
    ctx.lineWidth   = 7
    ctx.stroke()
  }
}

// ─── Share card canvas (1080 × 1350) ─────────────────────────────────────────

async function drawPotentialCard({ canvas, photoUrl, glowScore, tier, result, gender }) {
  await document.fonts.ready
  const ctx  = canvas.getContext('2d')
  const W    = 1080
  const H    = 1350
  canvas.width  = W
  canvas.height = H

  const GOLD   = '#C9A84C'
  const GREEN  = '#34C759'
  const PAD    = 64

  // ── Background ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#080604'
  ctx.fillRect(0, 0, W, H)

  // Subtle grid
  ctx.save()
  ctx.globalAlpha  = 0.022
  ctx.strokeStyle  = GOLD
  ctx.lineWidth    = 0.8
  for (let x = 0; x <= W; x += 54) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
  for (let y = 0; y <= H; y += 54) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }
  ctx.restore()

  // Gold border
  ctx.save()
  ctx.strokeStyle = 'rgba(201,168,76,0.28)'
  ctx.lineWidth   = 1
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
  ctx.restore()

  // ── Header: ASCENDUS + tagline ──────────────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.font      = '700 38px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = GOLD
  ctx.fillText('ASCENDUS', W / 2, 72)

  ctx.font      = '500 26px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fillText('Your Potential Analysis', W / 2, 112)

  // Thin divider under header
  const dg = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  dg.addColorStop(0,   'rgba(201,168,76,0)')
  dg.addColorStop(0.4, 'rgba(201,168,76,0.45)')
  dg.addColorStop(0.6, 'rgba(201,168,76,0.45)')
  dg.addColorStop(1,   'rgba(201,168,76,0)')
  ctx.strokeStyle = dg; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, 136); ctx.lineTo(W - PAD, 136); ctx.stroke()

  // ── Two face circles ────────────────────────────────────────────────────────
  const CR  = 230        // circle radius
  const CY  = 136 + 60 + CR   // circle center Y
  const LCX = W / 2 - CR - 48 // left center X
  const RCX = W / 2 + CR + 48 // right center X

  await drawFaceCircle(ctx, photoUrl, LCX, CY, CR, GOLD,  null)
  await drawFaceCircle(ctx, photoUrl, RCX, CY, CR, GREEN, 'rgba(52,199,89,0.7)')

  // Right circle green glow layer (extra)
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.beginPath(); ctx.arc(RCX, CY, CR + 40, 0, Math.PI * 2)
  const gg = ctx.createRadialGradient(RCX, CY, CR, RCX, CY, CR + 40)
  gg.addColorStop(0, GREEN); gg.addColorStop(1, 'transparent')
  ctx.fillStyle = gg; ctx.fill()
  ctx.restore()

  // ── Labels below each circle ────────────────────────────────────────────────
  const lblY = CY + CR + 48

  // Left: CURRENT + score
  ctx.textAlign = 'center'
  ctx.font      = '600 24px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillText('CURRENT', LCX, lblY)

  ctx.font      = 'bold 64px "Space Grotesk", Arial'
  ctx.fillStyle = '#FFFFFF'
  const scoreStr = glowScore != null ? glowScore.toFixed(1) : '—'
  ctx.fillText(scoreStr, LCX, lblY + 68)
  ctx.font      = '500 26px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = GOLD
  ctx.fillText('/10', LCX + 46, lblY + 44)

  // Right: POTENTIAL + tier
  ctx.font      = '600 24px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(52,199,89,0.6)'
  ctx.fillText('POTENTIAL', RCX, lblY)

  ctx.font      = 'bold 52px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = GREEN
  ctx.fillText((result.potential_tier ?? tier ?? '').toUpperCase(), RCX, lblY + 70)

  // ── Divider ─────────────────────────────────────────────────────────────────
  const d2Y = lblY + 110
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, d2Y); ctx.lineTo(W - PAD, d2Y); ctx.stroke()

  // ── Headline ────────────────────────────────────────────────────────────────
  const hlY = d2Y + 64
  ctx.textAlign = 'center'
  ctx.font      = 'bold 52px "Plus Jakarta Sans", Arial'
  // Gold gradient on headline
  const hg = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  hg.addColorStop(0,   '#FFE47A')
  hg.addColorStop(0.5, GOLD)
  hg.addColorStop(1,   '#A8893A')
  ctx.fillStyle = hg

  // Word-wrap headline to 2 lines max
  const headline = result.headline ?? ''
  const words    = headline.split(' ')
  let line1 = '', line2 = ''
  let built  = ''
  for (const w of words) {
    const test = built ? built + ' ' + w : w
    if (ctx.measureText(test).width > W - PAD * 2 - 40) { line1 = built; built = w }
    else built = test
  }
  line2 = built
  if (!line1) { line1 = line2; line2 = '' }
  ctx.fillText(line1, W / 2, hlY)
  if (line2) ctx.fillText(line2, W / 2, hlY + 62)

  // ── Timeline pill ───────────────────────────────────────────────────────────
  const tlY  = hlY + (line2 ? 62 : 0) + 52
  const tlTx = `⏱ ${result.timeline ?? ''}`
  ctx.font    = '600 26px "Plus Jakarta Sans", Arial'
  const tlW   = ctx.measureText(tlTx).width + 56
  const tlX   = (W - tlW) / 2
  rr(ctx, tlX, tlY - 24, tlW, 48, 24)
  ctx.fillStyle = 'rgba(52,199,89,0.12)'; ctx.fill()
  rr(ctx, tlX, tlY - 24, tlW, 48, 24)
  ctx.strokeStyle = 'rgba(52,199,89,0.45)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle   = GREEN
  ctx.fillText(tlTx, W / 2, tlY + 8)

  // ── Improvement chips ───────────────────────────────────────────────────────
  const chipTop = tlY + 48 + 28
  const chipH   = 52
  const chipGap = 16
  ;(result.improvements ?? []).slice(0, 3).forEach((imp, i) => {
    const y      = chipTop + i * (chipH + chipGap)
    const chipTx = `${i + 1}. ${imp}`
    ctx.font      = '500 24px "Plus Jakarta Sans", Arial'
    const chipW   = Math.min(W - PAD * 2, ctx.measureText(chipTx).width + 56)
    const chipX   = (W - chipW) / 2
    rr(ctx, chipX, y, chipW, chipH, chipH / 2)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill()
    ctx.strokeStyle = 'rgba(201,168,76,0.22)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle   = 'rgba(255,255,255,0.75)'
    ctx.fillText(chipTx, W / 2, y + 34)
  })

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footY = H - 60
  ctx.strokeStyle = 'rgba(201,168,76,0.18)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, footY - 24); ctx.lineTo(W - PAD, footY - 24); ctx.stroke()
  ctx.textAlign   = 'center'
  ctx.font        = '600 24px "Plus Jakarta Sans", Arial'
  ctx.fillStyle   = GOLD
  ctx.fillText('ascendus.store', W / 2, footY + 8)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PotentialViewer({ scan, facePhotoUrl, gender, onClose }) {
  const [phase,      setPhase]      = useState('loading') // loading | done | error
  const [result,     setResult]     = useState(null)
  const [errMsg,     setErrMsg]     = useState('')
  const [preview,    setPreview]    = useState(null)
  const [sharing,    setSharing]    = useState(false)
  const [genCard,    setGenCard]    = useState(false)
  const [glowImage,  setGlowImage]  = useState(null)  // AI-enhanced face
  const [glowLoading,setGlowLoading]= useState(false)
  const canvasRef = useRef(null)

  const glowScore = scan?.glowScore != null
    ? (scan.glowScore > 10 ? Math.round(scan.glowScore) / 10 : scan.glowScore)
    : null
  const pillars   = scan?.pillars ?? scan?.aiScore?.pillars ?? null

  // ── Fetch Claude analysis on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.potential.analyze({
          pillars,
          faceScore:     scan?.aiScore?.faceScore,
          groomingScore: scan?.aiScore?.groomingScore,
          gender:        gender ?? scan?.gender ?? 'male',
          glowScore,
          currentTier:   scan?.tier ?? scan?.aiScore?.tier ?? null,
        })
        if (!cancelled) {
          setResult(data)
          setPhase('done')
          // Kick off glow-up image generation after analysis loads
          if (facePhotoUrl) {
            setGlowLoading(true)
            api.potential.glowUp({
              faceImage:    facePhotoUrl,
              improvements: data.improvements,
              gender:       gender ?? scan?.gender ?? 'male',
              scanData: {
                overallScore:  scan?.glowScore ?? scan?.umaxScore,
                groomingScore: scan?.aiScore?.groomingScore,
                faceSubScores: scan?.aiScore?.faceSubScores,
                keyWeaknesses: scan?.aiScore?.keyWeaknesses,
                pillars:       scan?.pillars ?? scan?.aiScore?.pillars,
              },
            }).then(r => {
              if (!cancelled && r?.image) setGlowImage(r.image)
            }).catch(() => {}).finally(() => { if (!cancelled) setGlowLoading(false) })
          }
        }
      } catch (err) {
        console.error('POTENTIAL ERROR:', err.message)
        if (!cancelled) {
          setErrMsg(err.message || 'Analysis failed — please try again')
          setPhase('error')
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Generate share card once result is ready ──────────────────────────────
  const generateCard = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !result) return
    setGenCard(true)
    try {
      await drawPotentialCard({
        canvas, photoUrl: facePhotoUrl,
        glowScore, tier: scan?.tier,
        result, gender: gender ?? scan?.gender ?? 'male',
      })
      setPreview(canvas.toDataURL('image/jpeg', 0.93))
    } catch (e) {
      console.error('[PotentialCard]', e)
    } finally {
      setGenCard(false)
    }
  }, [result, facePhotoUrl, glowScore, scan, gender])

  async function handleShare() {
    if (!preview) { await generateCard(); return }
    setSharing(true)
    try {
      const blob = await (await fetch(preview)).blob()
      const file = new File([blob], 'ascendus-potential.jpg', { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'My Ascendus Potential', text: result.headline ?? '', files: [file] })
      } else {
        const a = document.createElement('a')
        a.href = preview; a.download = 'ascendus-potential.jpg'; a.click()
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[Share]', e)
    } finally {
      setSharing(false)
    }
  }

  // ── Styling constants ─────────────────────────────────────────────────────
  const GOLD  = '#C6A85C'
  const GREEN = '#34C759'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(4,3,1,0.97)', backdropFilter: 'blur(20px)' }}
    >
      {/* Hidden canvas for share card */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-11 pb-4 flex-shrink-0">
        <div>
          <p className="font-heading font-bold text-[16px] text-white leading-tight">Your Potential</p>
          <p className="font-body text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            AI-powered improvement analysis
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

      {/* Thin gold accent */}
      <div className="h-px flex-shrink-0 mx-5"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(198,168,92,0.45), transparent)' }} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <AnimatePresence mode="wait">

          {/* ── Loading ────────────────────────────────────────────── */}
          {phase === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-64 gap-4"
            >
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-[#C6A85C]/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-[#C6A85C] animate-spin" />
                <Sparkles size={20} className="absolute inset-0 m-auto" style={{ color: GOLD }} />
              </div>
              <p className="font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Analyzing your potential…
              </p>
            </motion.div>
          )}

          {/* ── Error ─────────────────────────────────────────────── */}
          {phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6"
            >
              <AlertTriangle size={32} style={{ color: '#EF4444' }} />
              <p className="font-heading font-bold text-[15px] text-white">Analysis failed</p>
              <p className="font-body text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{errMsg}</p>
              <button
                onClick={() => { setPhase('loading'); setErrMsg('') }}
                className="mt-2 px-5 py-2.5 rounded-2xl font-heading font-bold text-[13px] text-black"
                style={{ background: `linear-gradient(135deg, #D4B96A 0%, ${GOLD} 100%)` }}
              >
                Try Again
              </button>
            </motion.div>
          )}

          {/* ── Result ────────────────────────────────────────────── */}
          {phase === 'done' && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0  }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Side-by-side photos */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {/* Left — Current */}
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '1', background: '#111' }}>
                  {facePhotoUrl
                    ? <img src={facePhotoUrl} alt="Current" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-[#1A1A1A]" />
                  }
                  {/* Dark overlay */}
                  <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.30)' }} />
                  {/* Current badge */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(198,168,92,0.35)' }}>
                    <p className="font-heading font-bold text-[9px] tracking-widest uppercase" style={{ color: GOLD }}>Current</p>
                  </div>
                  {/* Score badge */}
                  {glowScore != null && (
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-xl"
                      style={{ background: 'rgba(0,0,0,0.80)', border: '1px solid rgba(198,168,92,0.3)' }}>
                      <p className="font-mono font-bold text-[18px] leading-none" style={{ color: GOLD }}>
                        {glowScore.toFixed(1)}
                      </p>
                      <p className="font-body text-[8px]" style={{ color: 'rgba(255,255,255,0.4)' }}>/ 10</p>
                    </div>
                  )}
                  {/* Gold ring overlay */}
                  <div className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ border: `2px solid rgba(198,168,92,0.45)` }} />
                </div>

                {/* Right — Potential */}
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '1', background: '#111' }}>
                  {glowLoading && !glowImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: '#111' }}>
                      <Loader2 size={28} className="animate-spin mb-2" style={{ color: GREEN }} />
                      <p className="text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.4)' }}>Generating glow-up...</p>
                    </div>
                  )}
                  {glowImage
                    ? <img src={glowImage} alt="Potential" className="w-full h-full object-cover" />
                    : facePhotoUrl && !glowLoading
                      ? <img src={facePhotoUrl} alt="Potential" className="w-full h-full object-cover"
                          style={{ filter: 'brightness(1.12) contrast(1.08) saturate(1.15)' }} />
                      : !glowLoading && <div className="w-full h-full bg-[#1A1A1A]" />
                  }
                  {/* Green tint overlay */}
                  <div className="absolute inset-0" style={{ background: 'rgba(52,199,89,0.10)' }} />
                  {/* Potential badge */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(52,199,89,0.45)' }}>
                    <p className="font-heading font-bold text-[9px] tracking-widest uppercase" style={{ color: GREEN }}>Potential</p>
                  </div>
                  {/* Tier badge */}
                  <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.80)', border: '1px solid rgba(52,199,89,0.35)' }}>
                    <p className="font-heading font-bold text-[11px] leading-tight" style={{ color: GREEN }}>
                      {result.potential_tier}
                    </p>
                    <p className="font-body text-[8px]" style={{ color: 'rgba(255,255,255,0.4)' }}>tier</p>
                  </div>
                  {/* Green glow border */}
                  <div className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      border: '2px solid rgba(52,199,89,0.6)',
                      boxShadow: '0 0 20px rgba(52,199,89,0.25), inset 0 0 20px rgba(52,199,89,0.08)',
                    }} />
                </div>
              </div>

              {/* Headline */}
              <div className="mb-4 px-1">
                <p className="font-heading font-bold text-[18px] leading-snug text-center" style={{ color: GOLD }}>
                  {result.headline}
                </p>
              </div>

              {/* Timeline pill */}
              <div className="flex justify-center mb-5">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
                  style={{ background: 'rgba(52,199,89,0.10)', border: '1px solid rgba(52,199,89,0.35)' }}>
                  <Timer size={12} />
                  <span className="font-body text-[11px] font-semibold" style={{ color: GREEN }}>
                    {result.timeline}
                  </span>
                </div>
              </div>

              {/* 3 improvement chips */}
              <div className="space-y-2 mb-6">
                {result.improvements.map((imp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * i, duration: 0.28 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(198,168,92,0.15)' }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-heading font-bold text-[11px]"
                      style={{ background: 'rgba(198,168,92,0.15)', color: GOLD }}
                    >
                      {i + 1}
                    </div>
                    <p className="font-body text-[13px] text-white leading-snug">{imp}</p>
                  </motion.div>
                ))}
              </div>

              {/* Share button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleShare}
                disabled={sharing || genCard}
                className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] text-black flex items-center justify-center gap-2 mb-3 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)',
                  boxShadow: '0 4px 20px rgba(198,168,92,0.35)',
                }}
              >
                {sharing || genCard
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Share2 size={16} />
                }
                {genCard ? 'Building card…' : sharing ? 'Sharing…' : 'Share My Potential'}
              </motion.button>

              {/* Disclaimer */}
              <p className="text-center font-body text-[10px] pb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
                AI-generated estimate · results vary based on consistency
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  )
}
