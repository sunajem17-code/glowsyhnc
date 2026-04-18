import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowLeftRight, Share2, Download, TrendingUp, Loader2, X, ChevronRight } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeDiff(dateA, dateB) {
  const msA = new Date(dateA).getTime()
  const msB = new Date(dateB).getTime()
  const days = Math.round(Math.abs(msB - msA) / 86400000)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''}`
  if (days < 30) return `${Math.round(days / 7)} week${Math.round(days / 7) !== 1 ? 's' : ''}`
  const months = Math.round(days / 30)
  return `${months} month${months !== 1 ? 's' : ''}`
}

function scoreDiff(a, b) {
  const d = (b - a)
  const sign = d >= 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}`
}

function diffColor(d) {
  if (d > 0.1) return '#34C759'
  if (d < -0.1) return '#EF4444'
  return '#9CA3AF'
}

// ─── Comparison Slider ────────────────────────────────────────────────────────

function CompareSlider({ before, after }) {
  const [pos, setPos] = useState(50)
  const containerRef = useRef()
  const dragging = useRef(false)

  function updatePos(clientX) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const p = Math.max(3, Math.min(97, ((clientX - rect.left) / rect.width) * 100))
    setPos(p)
  }

  function onMouseDown(e) { dragging.current = true; updatePos(e.clientX) }
  function onMouseMove(e) { if (dragging.current) updatePos(e.clientX) }
  function onMouseUp()    { dragging.current = false }
  function onTouchStart(e) { updatePos(e.touches[0].clientX) }
  function onTouchMove(e)  { updatePos(e.touches[0].clientX) }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden cursor-col-resize select-none"
      style={{ aspectRatio: '3 / 4' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      {/* Before — full */}
      {before ? (
        <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover object-top" />
      ) : (
        <div className="absolute inset-0 bg-[#1A1A1A] flex items-center justify-center">
          <p className="text-white/20 text-sm font-body">No photo</p>
        </div>
      )}

      {/* After — clipped left side */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pos}%` }}
      >
        {after ? (
          <img
            src={after}
            alt="After"
            className="absolute inset-0 h-full object-cover object-top"
            style={{ width: `${100 / (pos / 100)}%` }}
          />
        ) : (
          <div className="absolute inset-0 bg-[#1A1A1A]" />
        )}
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.8)]"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center"
        >
          <ArrowLeftRight size={14} className="text-[#C6A85C]" />
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <p className="text-white text-xs font-body font-semibold">BEFORE</p>
      </div>
      <div
        className="absolute bottom-3 left-3 px-2 py-1 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.55)', display: pos > 20 ? 'block' : 'none' }}
      >
        <p className="text-white text-xs font-body font-semibold">AFTER</p>
      </div>
    </div>
  )
}

// ─── Pillar row ───────────────────────────────────────────────────────────────

function PillarRow({ label, before, after }) {
  const diff = (after ?? 0) - (before ?? 0)
  const color = diffColor(diff)
  const sign = diff >= 0 ? '+' : ''

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <p className="flex-1 font-body text-sm text-white/70">{label}</p>
      <div className="flex items-center gap-2">
        <span className="font-body text-sm text-white/40">{(before ?? 0).toFixed(1)}</span>
        <ChevronRight size={12} className="text-white/25" />
        <span className="font-body text-sm text-white">{(after ?? 0).toFixed(1)}</span>
        <span
          className="text-xs font-heading font-bold w-12 text-right"
          style={{ color }}
        >
          {sign}{diff.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

// ─── Canvas share card (9:16) ─────────────────────────────────────────────────

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

function loadImg(src) {
  return new Promise((resolve, reject) => {
    if (!src) { reject(new Error('no src')); return }
    const img = new window.Image()
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load failed'))
    img.src = src
  })
}

function goldGrad(ctx, x1, y1, x2, y2) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2)
  g.addColorStop(0, '#FFE066')
  g.addColorStop(0.45, '#FFD700')
  g.addColorStop(1, '#B8922A')
  return g
}

async function drawCompareCard({ canvas, beforeScan, afterScan, beforePhoto, afterPhoto }) {
  await document.fonts.ready
  const ctx = canvas.getContext('2d')
  const W = 1080, H = 1920
  canvas.width = W; canvas.height = H

  const bScore = beforeScan?.glowScore ?? 5
  const aScore = afterScan?.glowScore ?? 5
  const diff   = aScore - bScore
  const sign   = diff >= 0 ? '+' : ''
  const elapsed = (beforeScan?.analyzedAt && afterScan?.analyzedAt)
    ? timeDiff(beforeScan.analyzedAt, afterScan.analyzedAt)
    : null

  // Background
  ctx.fillStyle = '#0A0806'
  ctx.fillRect(0, 0, W, H)

  // Subtle warm radial
  const bgG = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.7)
  bgG.addColorStop(0,   'rgba(120,80,20,0.18)')
  bgG.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = bgG
  ctx.fillRect(0, 0, W, H)

  // ── Logo ──────────────────────────────────────────────────────────────────
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = 'bold 40px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.80)'
  ctx.fillText('Ascendus', W / 2, 72)
  ctx.beginPath()
  ctx.arc(W / 2 + 116, 57, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#C6A85C'
  ctx.fill()
  ctx.restore()

  // ── Photos — side by side ─────────────────────────────────────────────────
  const photoTop  = 110
  const photoH    = 700
  const photoW    = (W - 3 * 32) / 2   // 2 columns with margins
  const photoL    = 32
  const photoR    = W - 32 - photoW

  async function drawPhoto(src, x, label, labelRight) {
    const oc = document.createElement('canvas')
    oc.width = photoW; oc.height = photoH
    const ox = oc.getContext('2d')

    // Rounded rect clip
    rr(ox, 0, 0, photoW, photoH, 24)
    ox.clip()

    if (src) {
      try {
        const img = await loadImg(src)
        const iw = img.width, ih = img.height
        const scale = Math.max(photoW / iw, photoH / ih)
        const dw = iw * scale, dh = ih * scale
        const dx = (photoW - dw) / 2
        const dy = 0  // anchor top
        ox.drawImage(img, dx, dy, dw, dh)
      } catch {
        ox.fillStyle = '#1A1208'
        ox.fillRect(0, 0, photoW, photoH)
      }
    } else {
      ox.fillStyle = '#1A1208'
      ox.fillRect(0, 0, photoW, photoH)
    }

    ctx.drawImage(oc, x, photoTop)

    // Label chip
    const chipW = 130, chipH = 44, chipX = labelRight ? x + photoW - chipW - 12 : x + 12
    rr(ctx, chipX, photoTop + photoH - 54, chipW, chipH, 12)
    ctx.fillStyle = 'rgba(0,0,0,0.60)'
    ctx.fill()
    ctx.font = 'bold 22px "Plus Jakarta Sans", Arial'
    ctx.textAlign = labelRight ? 'right' : 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.fillText(label, labelRight ? chipX + chipW - 12 : chipX + 12, photoTop + photoH - 24)
  }

  await Promise.all([
    drawPhoto(beforePhoto, photoL, 'BEFORE', false),
    drawPhoto(afterPhoto,  photoR, 'AFTER',  true),
  ])

  // Border on photos
  ctx.strokeStyle = 'rgba(198,168,92,0.25)'
  ctx.lineWidth = 2
  rr(ctx, photoL, photoTop, photoW, photoH, 24); ctx.stroke()
  rr(ctx, photoR, photoTop, photoW, photoH, 24); ctx.stroke()

  // ── Central delta badge ───────────────────────────────────────────────────
  const midX = W / 2
  const midY = photoTop + photoH / 2

  ctx.save()
  ctx.shadowColor = diff >= 0 ? 'rgba(52,199,89,0.6)' : 'rgba(239,68,68,0.6)'
  ctx.shadowBlur  = 28

  const badgeR = 68
  rr(ctx, midX - badgeR, midY - badgeR, badgeR * 2, badgeR * 2, badgeR * 0.4)
  ctx.fillStyle = '#0A0806'
  ctx.fill()
  ctx.strokeStyle = diff >= 0 ? '#34C759' : '#EF4444'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.font = 'bold 52px "Space Grotesk", Arial'
  ctx.fillStyle = diff >= 0 ? '#34C759' : '#EF4444'
  ctx.fillText(`${sign}${diff.toFixed(1)}`, midX, midY + 18)

  // ── Score line ────────────────────────────────────────────────────────────
  const scoreY = photoTop + photoH + 80
  ctx.textAlign = 'center'
  ctx.font = 'bold 110px "Space Grotesk", Arial'
  ctx.fillStyle = '#FFFFFF'
  const beforeStr = bScore.toFixed(1)
  const afterStr  = aScore.toFixed(1)
  const totalW = ctx.measureText(`${beforeStr}  →  ${afterStr}`).width
  const arrowX = W / 2

  // Before score
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.fillText(beforeStr, arrowX - 52, scoreY)

  // Arrow
  ctx.textAlign = 'center'
  ctx.font = '400 72px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = diff >= 0 ? '#34C759' : '#EF4444'
  ctx.fillText('→', arrowX, scoreY - 14)

  // After score (gold)
  ctx.textAlign = 'left'
  ctx.font = 'bold 110px "Space Grotesk", Arial'
  ctx.fillStyle = goldGrad(ctx, arrowX + 52, scoreY - 100, arrowX + 52 + 200, scoreY)
  ctx.fillText(afterStr, arrowX + 52, scoreY)

  // /10 labels
  ctx.font = '400 36px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.textAlign = 'center'
  ctx.fillText('/10', arrowX - 52 - 60, scoreY - 62)
  ctx.fillText('/10', arrowX + 52 + ctx.measureText(afterStr).width + 16, scoreY - 62)

  // ── Tier change ───────────────────────────────────────────────────────────
  const tierY = scoreY + 56
  const bTier = beforeScan?.tier ?? '—'
  const aTier = afterScan?.tier ?? '—'

  ctx.textAlign = 'center'
  ctx.font = '500 32px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.32)'
  ctx.fillText(`${bTier}  →  ${aTier}`, W / 2, tierY)

  // ── Elapsed badge ─────────────────────────────────────────────────────────
  if (elapsed) {
    const eY = tierY + 56
    const bW = 360, bH = 68
    rr(ctx, (W - bW) / 2, eY, bW, bH, 20)
    ctx.fillStyle = 'rgba(198,168,92,0.10)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(198,168,92,0.32)'
    ctx.lineWidth = 1.5
    rr(ctx, (W - bW) / 2, eY, bW, bH, 20)
    ctx.stroke()

    ctx.textAlign  = 'center'
    ctx.font       = '600 30px "Plus Jakarta Sans", Arial'
    ctx.fillStyle  = '#C6A85C'
    ctx.fillText(`⏱  ${elapsed} of looksmaxxing`, W / 2, eY + 44)
  }

  // ── Pillars delta ─────────────────────────────────────────────────────────
  const pillarsY = (elapsed ? tierY + 56 + 68 : tierY + 56) + 64
  const pLeft = 80, pRight = W - 80, pW = pRight - pLeft

  ctx.font = '600 26px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(198,168,92,0.50)'
  ctx.textAlign = 'center'
  ctx.fillText('PILLAR IMPROVEMENTS', W / 2, pillarsY)

  const bPillars = beforeScan?.pillars ?? {}
  const aPillars = afterScan?.pillars  ?? {}
  const PILLARS = ['harmony','angularity','features','dimorphism']
  const LABELS  = ['Harmony','Angularity','Features','Dimorphism']

  PILLARS.forEach((key, i) => {
    const rowY = pillarsY + 24 + i * 82
    const bV   = bPillars[key] ?? 5.0
    const aV   = aPillars[key] ?? 5.0
    const d    = aV - bV
    const col  = d > 0.05 ? '#34C759' : d < -0.05 ? '#EF4444' : '#9CA3AF'
    const sg   = d >= 0 ? '+' : ''

    // Row bg
    rr(ctx, pLeft - 12, rowY, pW + 24, 70, 14)
    ctx.fillStyle = 'rgba(255,255,255,0.025)'
    ctx.fill()

    // Label
    ctx.textAlign = 'left'
    ctx.font = '500 30px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(LABELS[i], pLeft + 4, rowY + 44)

    // Before → After
    ctx.textAlign = 'right'
    ctx.font = '500 28px "Plus Jakarta Sans", Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText(`${bV.toFixed(1)}  →  ${aV.toFixed(1)}`, pRight - 90, rowY + 44)

    // Delta
    ctx.font = 'bold 30px "Space Grotesk", Arial'
    ctx.fillStyle = col
    ctx.fillText(`${sg}${d.toFixed(1)}`, pRight, rowY + 44)
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerFade = ctx.createLinearGradient(0, H - 180, 0, H)
  footerFade.addColorStop(0, 'rgba(0,0,0,0)')
  footerFade.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = footerFade
  ctx.fillRect(0, H - 180, W, 180)

  ctx.textAlign = 'center'
  ctx.font = '500 28px "Plus Jakarta Sans", Arial'
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fillText('ascendus.store', W / 2, H - 48)
  ctx.beginPath()
  ctx.arc(W / 2 + 216, H - 63, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#C6A85C'
  ctx.fill()
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({ beforeScan, afterScan, beforePhoto, afterPhoto, onClose }) {
  const canvasRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [sharing, setSharing] = useState(false)

  const generate = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setGenerating(true)
    setError(null)
    try {
      await drawCompareCard({ canvas, beforeScan, afterScan, beforePhoto, afterPhoto })
      setPreview(canvas.toDataURL('image/jpeg', 0.93))
    } catch (e) {
      console.error('[CompareCard]', e)
      setError('Could not generate card.')
    } finally {
      setGenerating(false)
    }
  }, [beforeScan, afterScan, beforePhoto, afterPhoto])

  useEffect(() => { generate() }, [generate])

  async function handleShare() {
    if (!preview) return
    setSharing(true)
    try {
      const res = await fetch(preview)
      const blob = await res.blob()
      const file = new File([blob], 'ascendus-glow-up.jpg', { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'My Glow Up — Ascendus', files: [file] })
      } else {
        const a = document.createElement('a')
        a.href = preview; a.download = 'ascendus-glow-up.jpg'; a.click()
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
    a.href = preview; a.download = 'ascendus-glow-up.jpg'; a.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(6,4,1,0.95)', backdropFilter: 'blur(20px)' }}
    >
      <div className="flex items-center justify-between px-4 pt-10 pb-2 flex-shrink-0">
        <div>
          <p className="font-heading font-bold text-base text-white">Share Your Glow Up</p>
          <p className="text-[11px] text-white/40 font-body mt-0.5">9:16 · Instagram / TikTok Stories</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <X size={17} className="text-white" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-4">
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
          <div style={{
            height: 'min(calc(100vh - 230px), calc(95vw * 16 / 9))',
            aspectRatio: '9 / 16',
            width: 'auto',
            flexShrink: 0,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 0 0 1px rgba(198,168,92,0.20), 0 24px 60px rgba(0,0,0,0.8)',
          }}>
            <img src={preview} alt="Share card" style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
        ) : null}
      </div>

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
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Compare() {
  const navigate = useNavigate()
  const { scans } = useStore()
  const [showShare, setShowShare] = useState(false)

  // Need at least 2 scans
  const sorted = [...(scans ?? [])].sort(
    (a, b) => new Date(a.analyzedAt ?? 0) - new Date(b.analyzedAt ?? 0)
  )
  const firstScan  = sorted[0]
  const latestScan = sorted[sorted.length - 1]

  // Not enough data
  if (!firstScan || !latestScan || firstScan === latestScan) {
    return (
      <MotionPage>
        <div className="flex flex-col h-full bg-page">
          <PageHeader title="Before & After" onBack={() => navigate(-1)} />
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
              style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.20)' }}
            >
              <TrendingUp size={28} className="text-[#C6A85C]" />
            </div>
            <p className="font-heading font-bold text-lg text-white">You need 2+ scans</p>
            <p className="font-body text-sm text-white/50 leading-relaxed">
              Complete your first scan, then rescan after a few weeks to unlock before/after comparison.
            </p>
            <button
              onClick={() => navigate('/scan')}
              className="mt-2 px-6 py-3 rounded-2xl font-heading font-bold text-sm text-black"
              style={{ background: 'linear-gradient(135deg, #FFE066 0%, #FFD700 45%, #B8922A 100%)' }}
            >
              Start First Scan
            </button>
          </div>
        </div>
      </MotionPage>
    )
  }

  const scoreDelta = (latestScan.glowScore ?? 0) - (firstScan.glowScore ?? 0)
  const diffSign   = scoreDelta >= 0 ? '+' : ''
  const elapsed    = (firstScan.analyzedAt && latestScan.analyzedAt)
    ? timeDiff(firstScan.analyzedAt, latestScan.analyzedAt)
    : null

  const bPillars   = firstScan.pillars  ?? {}
  const aPillars   = latestScan.pillars ?? {}
  const PILLAR_KEYS   = ['harmony','angularity','features','dimorphism']
  const PILLAR_LABELS = ['Harmony','Angularity','Features','Dimorphism']

  const beforePhoto = firstScan.facePhotoUrl  ?? firstScan.photos?.face ?? null
  const afterPhoto  = latestScan.facePhotoUrl ?? latestScan.photos?.face ?? null

  return (
    <MotionPage>
      <div className="flex flex-col h-full bg-page overflow-y-auto">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 pt-safe-top pt-4 pb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h1 className="font-heading font-bold text-[17px] text-white">Before &amp; After</h1>
          <button
            onClick={() => setShowShare(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.25)' }}
          >
            <Share2 size={16} className="text-[#C6A85C]" />
          </button>
        </div>

        <div className="px-4 pb-28 flex flex-col gap-5">
          {/* Photo Comparison */}
          <CompareSlider before={afterPhoto} after={beforePhoto} />

          {/* Score Hero */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Before */}
            <div className="flex-1 text-center">
              <p className="font-body text-[11px] text-white/40 uppercase tracking-wide mb-1">Before</p>
              <p className="font-heading font-bold text-3xl text-white/50">
                {(firstScan.glowScore ?? 0).toFixed(1)}
              </p>
              <p className="font-body text-[11px] text-white/30 mt-0.5">{firstScan.tier ?? '—'}</p>
            </div>

            {/* Delta */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: scoreDelta >= 0 ? 'rgba(52,199,89,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1.5px solid ${scoreDelta >= 0 ? 'rgba(52,199,89,0.35)' : 'rgba(239,68,68,0.35)'}`,
                }}
              >
                <p
                  className="font-heading font-bold text-xl"
                  style={{ color: scoreDelta >= 0 ? '#34C759' : '#EF4444' }}
                >
                  {diffSign}{scoreDelta.toFixed(1)}
                </p>
              </div>
              {elapsed && (
                <p className="font-body text-[10px] text-white/30 text-center">{elapsed}</p>
              )}
            </div>

            {/* After */}
            <div className="flex-1 text-center">
              <p className="font-body text-[11px] text-white/40 uppercase tracking-wide mb-1">After</p>
              <p
                className="font-heading font-bold text-3xl"
                style={{ color: '#C6A85C' }}
              >
                {(latestScan.glowScore ?? 0).toFixed(1)}
              </p>
              <p className="font-body text-[11px] text-white/30 mt-0.5">{latestScan.tier ?? '—'}</p>
            </div>
          </motion.div>

          {/* Tier change banner */}
          {firstScan.tier !== latestScan.tier && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
              style={{
                background: 'rgba(198,168,92,0.07)',
                border: '1px solid rgba(198,168,92,0.20)',
              }}
            >
              <TrendingUp size={18} className="text-[#C6A85C] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-body text-[12px] text-white/50">Tier Change</p>
                <p className="font-heading font-bold text-sm text-white truncate">
                  {firstScan.tier} → {latestScan.tier}
                </p>
              </div>
            </motion.div>
          )}

          {/* Pillar improvements */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="font-heading font-bold text-sm text-white mb-3">Pillar Improvements</p>
            {PILLAR_KEYS.map((key, i) => (
              <PillarRow
                key={key}
                label={PILLAR_LABELS[i]}
                before={bPillars[key] ?? 5.0}
                after={aPillars[key]  ?? 5.0}
              />
            ))}
          </motion.div>

          {/* Scan count */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="font-body text-sm text-white/60">Total Scans</p>
            <p className="font-heading font-bold text-sm text-white">{scans?.length ?? 0}</p>
          </motion.div>

          {/* Share CTA */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => setShowShare(true)}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] text-black flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #FFE066 0%, #FFD700 45%, #B8922A 100%)' }}
          >
            <Share2 size={17} />
            Share My Glow Up
          </motion.button>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
          <ShareModal
            beforeScan={firstScan}
            afterScan={latestScan}
            beforePhoto={beforePhoto}
            afterPhoto={afterPhoto}
            onClose={() => setShowShare(false)}
          />
        )}
      </AnimatePresence>
    </MotionPage>
  )
}
