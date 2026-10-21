import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import html2canvas from 'html2canvas'
import { isNative } from '../utils/camera'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { getRatingColor } from '../utils/revealRatings'
import { getShareCardCaptureSize, getShareCardMetrics, SHARE_CARD_BRAND_LAYOUT, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from '../utils/shareCardDimensions'
import { cropPhotoToSquare } from '../utils/shareCardPhoto'
import { getRevealMetricTextStyles } from '../utils/revealAnimation'
import { SHARE_RATINGS_LAYOUT } from '../utils/revealRatingsLayout'

const METRIC_TEXT = getRevealMetricTextStyles()

function ScoreMetric({ label, value, index }) {
  const validScore = Number.isFinite(value) && value >= 0 && value <= 10
  const percentage = validScore ? Math.max(0, Math.min(100, value * 10)) : 0
  const color = validScore ? getRatingColor(value) : '#454545'

  return (
    <div style={{ minWidth: 0, paddingBottom: index < 4 ? SHARE_RATINGS_LAYOUT.metricRowPaddingBottom : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: SHARE_RATINGS_LAYOUT.labelHeight, marginBottom: SHARE_RATINGS_LAYOUT.labelMarginBottom }}>
        <p style={{ ...METRIC_TEXT.label, fontSize: 'clamp(13px, 4vw, 18px)', letterSpacing: '0.02em', whiteSpace: 'nowrap', margin: 0 }}>
        {label}
        </p>
      </div>
      <div style={{ height: SHARE_RATINGS_LAYOUT.valueHeight, display: 'flex', alignItems: 'center', marginBottom: SHARE_RATINGS_LAYOUT.valueMarginBottom }}>
        <span style={{ ...METRIC_TEXT.value, fontSize: validScore ? 30 : 20, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
          {validScore ? value.toFixed(1) : 'N/A'}
        </span>
      </div>
      <div style={{ height: SHARE_RATINGS_LAYOUT.barHeight, borderRadius: 999, background: '#2A2A2A', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percentage}%`, borderRadius: 999, color, background: 'currentColor' }} />
      </div>
    </div>
  )
}

// Matches the current Results screen: title, portrait, and the six actual
// facial ratings. Keep it 9:16 so the 4K export is ready for TikTok.
export function ShareCard({ scan, facePhotoUrl, cardRef }) {
  const metrics = getShareCardMetrics(scan)

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed', left: -9999, top: 0,
        width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT,
        overflow: 'hidden', background: '#080808',
        fontFamily: 'Inter, -apple-system, sans-serif', zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flexShrink: 0 }}>
        <h1 style={{ color: '#fff', textAlign: 'center', fontSize: 32, lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.045em', margin: '4px 12px 0', flexShrink: 0 }}>
          Your Results
        </h1>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18, position: 'relative', zIndex: 2, flexShrink: 0 }}>
          <div style={{ width: 128, height: 128, borderRadius: '50%', border: '4px solid #fff', overflow: 'hidden', background: '#1b1b1b' }}>
            {facePhotoUrl && (
              <img
                src={facePhotoUrl}
                alt=""
                crossOrigin={facePhotoUrl.startsWith('data:') ? undefined : 'anonymous'}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            )}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, margin: '-35px 14px 0', padding: `${SHARE_RATINGS_LAYOUT.panelPaddingTop}px ${SHARE_RATINGS_LAYOUT.panelPaddingHorizontal}px ${SHARE_RATINGS_LAYOUT.panelPaddingBottom}px`, borderRadius: 26, background: '#141414', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: SHARE_RATINGS_LAYOUT.columnGap, rowGap: 0 }}>
            {metrics.map(({ label, value }, index) => <ScoreMetric key={label} label={label} value={value} index={index} />)}
          </div>
        </div>

        <p style={{ margin: `${SHARE_CARD_BRAND_LAYOUT.marginTop}px 0 0`, color: GOLD, textAlign: 'center', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: SHARE_CARD_BRAND_LAYOUT.fontSize, fontWeight: 600, letterSpacing: SHARE_CARD_BRAND_LAYOUT.letterSpacing, lineHeight: 1.2, flexShrink: 0 }}>
          ASCENDUS
        </p>
      </div>
    </div>
  )
}

export async function createShareCardImage(cardElement) {
  if (!cardElement) throw new Error('Share card is not ready')
  await new Promise(resolve => setTimeout(resolve, 200))
  const images = Array.from(cardElement.querySelectorAll('img'))
  await Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve()
    return new Promise(resolve => {
      const timeout = setTimeout(resolve, 3000)
      img.onload = () => { clearTimeout(timeout); resolve() }
      img.onerror = () => { clearTimeout(timeout); resolve() }
    })
  }))
  if (document.fonts?.ready) await document.fonts.ready
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  const captureSize = getShareCardCaptureSize()
  const canvas = await html2canvas(cardElement, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#080808',
    scale: captureSize.scale,
    logging: false,
    imageTimeout: 3000,
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
  })
  return canvas.toDataURL('image/jpeg', 0.93)
}

export async function saveShareCardImage(downloadImage) {
  if (!downloadImage) return
  if (isNative()) {
    try {
      const blob = await (await fetch(downloadImage)).blob()
      const file = new File([blob], 'ascendus-results.jpg', { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Ascendus Results' })
        return
      }
    } catch (saveError) {
      if (saveError.name === 'AbortError') return
    }
  }
  const anchor = document.createElement('a')
  anchor.href = downloadImage
  anchor.download = 'ascendus-results.jpg'
  anchor.click()
}

export default function ShareCardModal({ scan, facePhotoUrl, onClose }) {
  const cardRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [downloadImage, setDownloadImage] = useState(null)
  const [generating, setGenerating] = useState(true)
  const [error, setError] = useState(null)
  const [photoState, setPhotoState] = useState(null)
  const photoStatus = !facePhotoUrl
    ? 'ready'
    : photoState?.source === facePhotoUrl
      ? photoState.status
      : 'processing'
  const croppedPhotoUrl = photoState?.source === facePhotoUrl && photoState.status === 'ready'
    ? photoState.url
    : null

  useEffect(() => {
    if (!facePhotoUrl) {
      setPhotoState(null)
      return
    }
    let active = true
    setPhotoState({ source: facePhotoUrl, status: 'processing', url: null })
    cropPhotoToSquare(facePhotoUrl)
      .then(url => { if (active) setPhotoState({ source: facePhotoUrl, status: 'ready', url }) })
      .catch(() => { if (active) setPhotoState({ source: facePhotoUrl, status: 'failed', url: null }) })
    return () => { active = false }
  }, [facePhotoUrl])

  const generate = useCallback(async () => {
    if (!cardRef.current) return
    if (photoStatus === 'processing') return
    if (photoStatus === 'failed') {
      setError('Could not prepare the photo. Please try again.')
      setGenerating(false)
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const cardImage = await createShareCardImage(cardRef.current)
      setDownloadImage(cardImage)
      setPreview(cardImage)
    } catch (captureError) {
      console.error('[ShareCard]', captureError)
      setError('Could not generate card.')
    } finally {
      setGenerating(false)
    }
  }, [scan, facePhotoUrl, photoStatus, croppedPhotoUrl])

  useEffect(() => { generate() }, [generate])

  async function handleSave() {
    if (!downloadImage) return
    await saveShareCardImage(downloadImage)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(4,3,1,0.97)', backdropFilter: 'blur(24px)' }}>
      <ShareCard scan={scan} facePhotoUrl={croppedPhotoUrl} cardRef={cardRef} />

      <div className="flex items-center justify-end px-5 pb-3 flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 44px)' }}>
        <button onClick={onClose} aria-label="Close share preview" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <X size={17} className="text-white" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 px-4">
        {generating ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: GOLD }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Generating card…</p>
          </motion.div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={generate} className="text-sm underline" style={{ color: GOLD }}>Retry</button>
          </div>
        ) : preview ? (
          <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} src={preview} alt="Your Ascendus results card" className="rounded-2xl shadow-2xl" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
        ) : null}
      </div>

      <div className="px-5 pt-4 flex flex-shrink-0" style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={handleSave} disabled={!preview || generating} className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl font-bold text-[15px]" style={{ background: GOLD_GRADIENT, color: '#000' }}>
          <Download size={17} />
          Save
        </button>
      </div>
    </div>
  )
}
