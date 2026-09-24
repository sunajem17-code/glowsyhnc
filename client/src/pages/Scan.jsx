import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { loadFaceMeshLibrary } from '../utils/faceLandmarks'
import { useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, Check, CheckCircle2, AlertCircle, X, RefreshCw, SkipForward, Lock, Gift, Star, ChevronLeft } from 'lucide-react'
import useStore from '../store/useStore'
import { getTier } from '../utils/analysis'
import { api, setScanInFlight } from '../utils/api'
import { generatePlanTasks } from '../utils/content'
import { assignPhase } from '../utils/phase'
import PageHeader from '../components/PageHeader'
import FaceScanOverlay from '../components/FaceScanOverlay'
import sideProfileGuide from '../assets/side-profile-guide.png'
import sideProfileGuideFemale from '../assets/side-profile-guide-female.png'
import faceGuidePhoto from '../assets/face-metrics-demo.jpg'
import faceGuidePhotoFemale from '../assets/face-metrics-demo-female.jpg'
import AIConsentModal, { hasAIConsent } from '../components/AIConsentModal'
import { takePhoto, pickPhoto, isNative } from '../utils/camera'
import { CameraPreview } from '@capacitor-community/camera-preview'
import { Camera as CapacitorCamera } from '@capacitor/camera'
import { analyzeSideProfile } from '../utils/photoGeometry'
import { scheduleRescanNotification } from '../utils/notifications'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import ProcessingOverlay from '../components/ProcessingOverlay'
import { createLiveFaceAlignment, getAlignment } from '../utils/liveFaceAlignment'
import { profilePointsFromMesh, profilePointsFromVision } from '../utils/scanFeatureAnchors'
import { buildProductionEvidence, requestProductionAnalysis } from '../utils/productionAnalysis'
import ScanPortrait from '../components/ScanPortrait'
import { scanFrame, presentationGate, SCAN_FEATURES } from '../utils/scanPresentation'


// ─── Step 0: Gender Selector ─────────────────────────────────────────────────

// Mars/Venus stroke icons — kept in sync with PremiumOnboarding.jsx's
// StepGender by design intent (same visual language for gender selection
// wherever it appears, onboarding or rescan).
function MarsIcon({ color, size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" fill="none" style={{ display: 'block' }}>
      <circle cx="55" cy="64" r="26" stroke={color} strokeWidth="7" />
      <line x1="73" y1="46" x2="101" y2="18" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <polyline points="77,18 101,18 101,42" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function VenusIcon({ color, size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 110 110" fill="none" style={{ display: 'block' }}>
      <circle cx="55" cy="38" r="26" stroke={color} strokeWidth="7" />
      <line x1="55" y1="64" x2="55" y2="98" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <line x1="39" y1="82" x2="71" y2="82" stroke={color} strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

// Ported from PremiumOnboarding.jsx's StepGender — same big cards, same
// Mars/Venus icons, same tap-to-advance behavior, so the rescan flow's
// gender step matches the one users already see on first onboarding instead
// of the smaller, more cluttered two-icon grid this used to be.
function GenderSelector({ selected, onSelect, onAdvance }) {
  const MALE_BLUE   = '#4A90E2'
  const FEMALE_PINK = '#E85D9E'

  function pick(gender) {
    onSelect(gender)
    setTimeout(onAdvance, 300)
  }

  const cardStyle = (gender) => ({
    width: '100%', maxWidth: 340, height: 280,
    borderRadius: 22,
    border: '1.5px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'background 0.2s',
    background: selected === gender
      ? (gender === 'male' ? 'rgba(74,144,226,0.12)' : 'rgba(232,93,158,0.12)')
      : 'var(--card)',
  })

  return (
    <div className="flex flex-col h-full px-6 items-center justify-center gap-5">
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => pick('male')}
        style={cardStyle('male')}
      >
        <div className="flex flex-col items-center">
          <MarsIcon color={MALE_BLUE} size={144} />
          <p className="font-heading font-bold text-2xl text-primary mt-3">Male</p>
        </div>
      </motion.div>

      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => pick('female')}
        style={cardStyle('female')}
      >
        <div className="flex flex-col items-center">
          <VenusIcon color={FEMALE_PINK} size={144} />
          <p className="font-heading font-bold text-2xl text-primary mt-3">Female</p>
        </div>
      </motion.div>

      <p className="text-center text-[10px] text-secondary font-body mt-2">
        This only affects tier labels and benchmarks. All analysis is private and on-device.
      </p>
    </div>
  )
}

// ─── Side-profile guide SVGs (reused in both camera overlay and upload card) ──

function SideGuide({ size = 'normal', gender }) {
  const maxW = size === 'small' ? 115 : size === 'overlay' ? 220 : 260
  // sideProfileGuide is now a full reference photo (not line art), so when this
  // is overlaid live on top of the camera feed it needs plain reduced opacity
  // instead of a screen blend — screen mode on a photo (vs. line art) would
  // just wash it out into a ghostly white blob rather than a visible reference.
  return (
    <img
      src={gender === 'female' ? sideProfileGuideFemale : sideProfileGuide}
      alt="Side profile alignment guide"
      style={{
        width: '85%',
        maxWidth: maxW,
        display: 'block',
        margin: '0 auto',
        opacity: 0.4,
        borderRadius: 16,
      }}
    />
  )
}

// Crops a captured data-URL photo down to exactly the region the user saw
// live inside the card window — see the capture handler in CameraOverlay
// below for why matching just the aspect ratio (an earlier version of this
// function) wasn't enough.
//
// The native preview fills the FULL SCREEN frame via
// AVLayerVideoGravity.resizeAspectFill (matches CameraPreview.start()'s own
// x:0,y:0,width:screen,height:screen call) — it scales the raw sensor image
// up until one axis exactly covers that frame, cropping the overflow on the
// other axis, centered. That's a real zoom, not just a reshape. The user
// then only ever sees the small card sub-region of that full-screen render.
// CameraPreview.capture() ignores all of this and returns the raw, un-zoomed
// sensor photo — so to reproduce what was actually on screen, this inverts
// the exact same scale-to-fill-screen transform and reads off the sub-region
// of the raw photo landing under the card's own on-screen rect.
function cropDataUrlToMatchLivePreview(dataUrl, cardRect) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const viewportW = window.screen.width
      const viewportH = window.screen.height
      const scale = Math.max(viewportW / img.width, viewportH / img.height)
      const renderedW = img.width * scale
      const renderedH = img.height * scale
      const originX = (viewportW - renderedW) / 2
      const originY = (viewportH - renderedH) / 2
      const cropX = (cardRect.left - originX) / scale
      const cropY = (cardRect.top - originY) / scale
      const cropW = cardRect.width / scale
      const cropH = cardRect.height / scale
      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      canvas.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => resolve(dataUrl) // fall back to the uncropped photo on any failure
    img.src = dataUrl
  })
}

// Renders a set of landmark points as a smooth closed curve (a Catmull-Rom
// spline through every point, converted to cubic Bezier segments) instead of
// a straight-edged polygon — this is what actually produces the tapered,
// almond/leaf-shaped region highlights (cheekbone, cheek/ogee curve) seen in
// the reference: connecting the same landmark points with straight lines
// reads as a hard-edged triangle, the same points connected as a spline
// reads as an organic curved highlight. Coordinates are in the same 0-100
// viewBox-percent space as everything else this overlay draws.
function smoothClosedPath(points, tension = 0.55) {
  if (!points || points.length < 3) return ''
  const n = points.length
  // A 3-point "spline" is degenerate: with only 3 distinct points, the
  // Catmull-Rom formula's "next-next" neighbor (p3) collapses back onto p0,
  // so the tangent calc reuses the same point twice and the curve balloons
  // outward unpredictably — visible as the cheekbone triangle overshooting
  // up into the eyebrow instead of tracing the cheek. A straight-edged
  // triangle (softened by strokeLinejoin="round" + the glow filter) avoids
  // that entirely; smoothing only behaves once there are 4+ points.
  if (n === 3) {
    return `M ${points[0].x * 100} ${points[0].y * 100} L ${points[1].x * 100} ${points[1].y * 100} L ${points[2].x * 100} ${points[2].y * 100} Z`
  }
  const at = i => points[((i % n) + n) % n]
  let d = `M ${at(0).x * 100} ${at(0).y * 100}`
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
    const c1x = (p1.x + (p2.x - p0.x) * tension / 3) * 100
    const c1y = (p1.y + (p2.y - p0.y) * tension / 3) * 100
    const c2x = (p2.x - (p3.x - p1.x) * tension / 3) * 100
    const c2y = (p2.y - (p3.y - p1.y) * tension / 3) * 100
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x * 100} ${p2.y * 100}`
  }
  return d + ' Z'
}

// ─── Live Camera Overlay ──────────────────────────────────────────────────────

function CameraOverlay({ stepNum, onCapture, onClose, gender }) {
  const videoRef    = useRef()
  const cardRef     = useRef()
  const canvasRef   = useRef()
  const uploadRef   = useRef()
  const streamRef   = useRef()
  const previewActiveRef = useRef(false)
  const [ready, setReady]         = useState(false)
  const [facingMode, setFacingMode] = useState('user')
  const [error, setError]         = useState('')
  const [capturedUrl, setCapturedUrl] = useState(null) // null = live camera, string = captured photo
  const [alignmentFrame, setAlignmentFrame] = useState(null)
  const [trackingAvailable, setTrackingAvailable] = useState(false)
  const alignment = getAlignment(alignmentFrame, stepNum === 2)

  // ── Native: CameraPreview live viewfinder ─────────────────────────────────
  const startNativePreview = useCallback(async (position) => {
    try {
      if (previewActiveRef.current) {
        await CameraPreview.stop()
        previewActiveRef.current = false
      }
      // Fill the entire screen so we can overlay our UI on top via z-index
      await CameraPreview.start({
        position,
        toBack: true,        // render BEHIND the WebView; we make the WebView transparent over the camera area
        disableAudio: true,
        enableZoom: false,
        enableHighResolution: true, // plugin defaults this to false, capping captures at a reduced resolution
        x: 0,
        y: 0,
        width: window.screen.width,
        height: window.screen.height,
      })
      previewActiveRef.current = true
      setReady(true)
    } catch (err) {
      console.warn('[CameraOverlay] CameraPreview.start failed:', err?.message)
      setError('Could not start camera. Please close and reopen the app.')
    }
  }, [])

  const stopNativePreview = useCallback(async () => {
    document.body.style.backgroundColor = ''
    document.documentElement.style.backgroundColor = ''
    const rootEl = document.getElementById('root')
    if (rootEl) rootEl.style.visibility = ''
    if (!previewActiveRef.current) return
    try { await CameraPreview.stop() } catch {}
    previewActiveRef.current = false
  }, [])

  const startCamera = useCallback(async (mode) => {
    if (isNative()) {
      setReady(false)
      document.body.style.backgroundColor = 'transparent'
      document.documentElement.style.backgroundColor = 'transparent'
      // WKWebView's toBack transparency only reveals the native camera layer where
      // the ENTIRE webview render is un-painted — the routed page behind this portal
      // (#root, e.g. Layout's opaque bg-page) still paints through body/html's
      // transparent background otherwise, so it has to stop painting too.
      const rootEl = document.getElementById('root')
      if (rootEl) rootEl.style.visibility = 'hidden'
      await startNativePreview(mode === 'environment' ? 'rear' : 'front')
      return
    }
    // Web: use getUserMedia with high-res fallback
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    setReady(false)
    try {
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false })
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setReady(true)
      }
    } catch (err) {
      console.warn('[CameraOverlay] getUserMedia failed:', err?.message)
      setError('Camera access denied. Please allow camera permission and try again.')
    }
  }, [startNativePreview])

  // useLayoutEffect (not useEffect) — startCamera synchronously hides #root
  // and clears body's background before its own async native calls. Doing
  // that in useLayoutEffect applies it before the browser's next paint;
  // useEffect runs after paint, leaving a frame or two where the (possibly
  // light-themed) page underneath was still visible through the not-yet-
  // hidden #root — the brief white flash on opening the camera.
  useLayoutEffect(() => {
    startCamera(facingMode)
    return () => {
      if (isNative()) { stopNativePreview() }
      else { streamRef.current?.getTracks().forEach(t => t.stop()) }
    }
  }, [facingMode, startCamera, stopNativePreview])

  useEffect(() => {
    // Alignment tracking samples frames off the web <video> element, which
    // doesn't exist on native (CameraPreview is a native layer, not a DOM
    // video) — trackingAvailable would flip true on init regardless, but
    // .check() would never actually run, leaving alignment.aligned stuck
    // false forever and permanently dimming the capture button. Skip it
    // entirely on native rather than let it fake-disable a working camera.
    if (!ready || capturedUrl || isNative()) return
    let cancelled = false
    let timer
    let tracker
    const sample = document.createElement('canvas')
    sample.width = 320
    sample.height = 320
    createLiveFaceAlignment(frame => {
      if (!cancelled) setAlignmentFrame(frame)
    }).then(instance => {
      if (cancelled) { instance.close(); return }
      tracker = instance
      setTrackingAvailable(true)
      const tick = async () => {
        if (cancelled) return
        const video = videoRef.current
        if (video?.readyState >= 2 && !video.paused) {
          sample.getContext('2d').drawImage(video, 0, 0, 320, 320)
          try { await tracker.check(sample) } catch { setTrackingAvailable(false) }
        }
        if (!cancelled) timer = setTimeout(tick, 600)
      }
      tick()
    }).catch(() => { if (!cancelled) setTrackingAvailable(false) })
    return () => { cancelled = true; clearTimeout(timer); tracker?.close() }
  }, [ready, capturedUrl, facingMode])

  function capture() {
    if (trackingAvailable && !alignment.aligned) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    // Freeze: pause video so the frame stays visible in-place (no separate img needed)
    video.pause()
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    // Mirror horizontally for front cam so captured image matches what user saw on screen
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        setCapturedUrl(url) // store for onCapture; video stays paused showing the freeze
      }
    }, 'image/jpeg', 0.95)
  }

  function handleContinue() {
    if (!capturedUrl) return
    if (capturedUrl.startsWith('data:')) {
      // Native capture — base64 data URL; pass null blob (server accepts dataUrl)
      onCapture(capturedUrl, null)
    } else {
      // Web blob URL
      fetch(capturedUrl).then(r => r.blob()).then(blob => onCapture(capturedUrl, blob))
    }
  }

  function handleRetake() {
    if (capturedUrl && capturedUrl.startsWith('blob:')) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl(null)
    if (isNative()) {
      // Restart the live preview
      startCamera(facingMode)
    } else {
      // Resume the paused web video
      if (videoRef.current) videoRef.current.play().catch(() => {})
      if (!streamRef.current || streamRef.current.getTracks().every(t => t.readyState === 'ended')) {
        startCamera(facingMode)
      }
    }
  }

  async function handleUpload() {
    if (isNative()) {
      try {
        const dataUrl = await pickPhoto()
        if (dataUrl) { setCapturedUrl(dataUrl) }
      } catch {}
    } else {
      uploadRef.current?.click()
    }
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    streamRef.current?.getTracks().forEach(t => t.stop())
    setCapturedUrl(url)
  }

  const showLive = !capturedUrl

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: (isNative() && !capturedUrl) ? 'transparent' : '#000' }}>
      {/* Header — own solid background (not inherited from the outer wrapper,
          which stays transparent in live mode so the card's mask below can
          actually reveal the native camera instead of this wrapper's own
          black painting straight through it). */}
      <div style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, background: '#000',
      }}>
        <button
          onClick={async () => {
            if (capturedUrl) { handleRetake() }
            else {
              if (isNative()) await stopNativePreview()
              else streamRef.current?.getTracks().forEach(t => t.stop())
              onClose()
            }
          }}
          style={{ position: 'absolute', left: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ChevronLeft size={28} color="#fff" />
        </button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, fontFamily: 'inherit' }}>
          {stepNum === 1 ? 'Take your front photo' : 'Take your side photo'}
        </span>
        {showLive && !error && (
          <button onClick={() => { setFacingMode(m => m === 'user' ? 'environment' : 'user') }}
            style={{ position: 'absolute', right: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
            <RefreshCw size={20} color="rgba(255,255,255,0.6)" />
          </button>
        )}
      </div>

      {/* Camera / Photo area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {/* overflow:hidden here clips the card's huge box-shadow (below) to this
            row's own bounds. Without it, the shadow — a POSITIONED descendant's
            paint — renders above ALL non-positioned siblings regardless of DOM
            order, so it was blanketing the header and button row above/below
            this row and hiding them entirely. */}
        {/* Side gutters — separate, non-overlapping siblings of the card (not
            padding+background on this row) so the card's transparent live-camera
            interior isn't re-blocked by an ancestor background painted behind it. */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: '#000' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 16, background: '#000' }} />
        <div ref={cardRef} style={{ position: 'absolute', left: 16, right: 16, top: 0, bottom: 0, borderRadius: 20, overflow: 'hidden', boxShadow: '0 0 0 9999px #000', background: (isNative() && !capturedUrl) ? 'transparent' : '#111' }}>
          {error ? (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
              <AlertCircle size={40} className="text-warning" />
              <p className="text-white text-sm font-body">{error}</p>
              {isNative() && error.toLowerCase().includes('denied') ? (
                <>
                  <button
                    onClick={async () => { try { const { App } = await import('@capacitor/app'); await App.openUrl({ url: 'app-settings:' }) } catch { /* fallback */ } }}
                    className="px-6 py-3 rounded-2xl text-sm font-heading font-bold"
                    style={{ background: GOLD, color: '#000' }}>
                    Open Settings
                  </button>
                  <button onClick={onClose} className="px-6 py-3 bg-white/10 rounded-2xl text-white text-sm font-heading font-bold">Go Back</button>
                </>
              ) : (
                <>
                  <button onClick={onClose} className="px-6 py-3 bg-white/10 rounded-2xl text-white text-sm font-heading font-bold">Go Back</button>
                  {isNative() && <button onClick={async () => { try { const url = await takePhoto(); if (url) onCapture(url, null) } catch {} }} className="px-6 py-3 rounded-2xl text-sm font-heading font-bold" style={{ background: GOLD, color: '#000' }}>Use System Camera</button>}
                </>
              )}
            </div>
          ) : isNative() ? (
            /* Native iOS — CameraPreview renders behind the WebView (toBack:true).
               Body + this div are transparent so the camera layer shows through.
               After capture we show the frozen photo on top. */
            <div className="absolute inset-0" style={{ background: 'transparent' }}>
              {capturedUrl ? (
                /* Show captured image after photo is taken */
                <img src={capturedUrl} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  {ready && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      {stepNum !== 2 && (
                        <div style={{ width: '70%', height: '67%', border: `1.5px solid ${GOLD}`, borderRadius: '48% 48% 42% 42%', boxShadow: `0 0 16px ${GOLD}55` }} />
                      )}
                      <div style={{ position: 'absolute', bottom: 22, padding: '9px 16px', borderRadius: 99, background: 'rgba(0,0,0,0.72)', color: GOLD, fontSize: 13, fontWeight: 600, letterSpacing: '.02em' }}>
                        {stepNum === 2 ? 'Align your side profile' : 'Position your face in the oval'}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {/* Web: live getUserMedia preview */}
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
              {showLive && ready && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div style={{ width: '70%', height: '67%', border: `1.5px solid ${alignment.aligned ? GOLD : 'rgba(255,255,255,0.6)'}`, borderRadius: '48% 48% 42% 42%', boxShadow: alignment.aligned ? `0 0 16px ${GOLD}55` : 'none', transition: 'border-color .3s, box-shadow .3s' }} />
                  <div style={{ position: 'absolute', bottom: 22, padding: '9px 16px', borderRadius: 99, background: 'rgba(0,0,0,0.72)', color: alignment.aligned ? GOLD : '#fff', fontSize: 13, fontWeight: 600, letterSpacing: '.02em' }}>
                    {trackingAvailable ? alignment.label : (stepNum === 2 ? 'Align your side profile' : 'Position your face')}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Buttons — own solid background, same reasoning as the header above */}
      {!error && (
        <div style={{ padding: '12px 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, background: '#000' }}>
          <button
            onClick={async () => {
              triggerHaptic()
              if (capturedUrl) { handleContinue(); return }
              if (isNative()) {
                // Measured before the capture/stop calls, though layout doesn't
                // actually shift from those — just keeping it closest to what
                // was on screen when the shutter was pressed.
                const rect = cardRef.current?.getBoundingClientRect()
                try {
                  // Must be exactly 100 — the plugin's native iOS side does
                  // integer division (quality!/100) to build JPEG
                  // compressionQuality, so anything under 100 truncates to 0
                  // (worst possible quality) regardless of what's passed. 100
                  // is the only value that survives that division intact (1.0).
                  const result = await CameraPreview.capture({ quality: 100 })
                  // result.value is a base64 JPEG string (no data: prefix)
                  const dataUrl = `data:image/jpeg;base64,${result.value}`
                  await stopNativePreview()
                  const finalUrl = rect?.width > 0 && rect?.height > 0
                    ? await cropDataUrlToMatchLivePreview(dataUrl, rect)
                    : dataUrl
                  setCapturedUrl(finalUrl)
                } catch (err) {
                  console.warn('[CameraOverlay] capture failed:', err?.message)
                }
                return
              }
              capture()
            }}
            disabled={!capturedUrl && !ready}
            style={{
              width: '100%', padding: '18px 0', borderRadius: 50,
              background: GOLD_GRADIENT, border: 'none', cursor: 'pointer',
              color: '#000', fontWeight: 700, fontSize: 18, fontFamily: 'inherit',
              opacity: (!capturedUrl && (!ready || (trackingAvailable && !alignment.aligned))) ? 0.5 : 1,
              boxShadow: '0 4px 24px rgba(198,168,92,0.35)',
            }}
          >
            {capturedUrl ? 'Continue' : 'Take Photo'}
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      <input ref={uploadRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      {/* Full-screen processing cover while the camera spins up — hides the
          header/card/button while they're still settling into their "ready"
          layout (and, on native, the abrupt pop-in of the native camera layer
          starting) instead of letting that transition show through as a flash.
          A plain opaque backing sits behind ProcessingOverlay itself, since
          that component is only ~85% opaque + blurred — not enough on its own
          to hide the native camera's own blown-out white frame while its
          sensor is still calibrating exposure underneath. */}
      <AnimatePresence>
        {!error && !ready && !capturedUrl && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 998, background: '#000' }} />
            <ProcessingOverlay label="Processing" />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Photo Action Sheet (iOS-style) ──────────────────────────────────────────
// Custom JS sheet, not a native action-sheet plugin — @capacitor/action-sheet
// isn't a dependency here, and adding one is a bigger lift (new native
// dependency + cap sync) than this redesign calls for. This matches the same
// visual convention (grouped options card + separate Cancel button, sliding
// up from the bottom) without it.
function PhotoActionSheet({ options, onClose }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE_STANDARD }}
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={SPRING_STANDARD}
        className="fixed inset-x-0 bottom-0 z-50 px-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
      >
        <div className="rounded-2xl overflow-hidden mb-2" style={{ background: '#1C1C1E' }}>
          {options.map((opt, i) => (
            <button
              key={opt.label}
              onClick={opt.onSelect}
              className="w-full flex items-center justify-center gap-2 py-4 active:opacity-60 transition-opacity"
              style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.12)' : 'none', color: opt.highlight ? GOLD : 'white' }}
            >
              <opt.icon size={18} />
              <span className="font-heading font-semibold text-[16px]">{opt.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </>
  )
}

// ─── Photo Upload Step ────────────────────────────────────────────────────────

export function PhotoUploadStep({ stepNum, guide, photo, onPhoto, gender, heroLayout = false, photoType = 'face', autoOpen = false, triggerRef }) {
  const uploadRef = useRef()
  const cameraInFlight = useRef(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [error, setError] = useState('')
  const [showActionSheet, setShowActionSheet] = useState(autoOpen)

  useEffect(() => {
    if (triggerRef) triggerRef.current = () => setShowActionSheet(true)
  }, [triggerRef])

  async function handleCameraClick() {
    if (cameraInFlight.current) return
    setCameraOpen(true)
  }

  async function handleUploadClick() {
    if (cameraInFlight.current) return
    cameraInFlight.current = true
    try {
      if (isNative()) {
        const dataUrl = await pickPhoto()
        if (dataUrl) onPhoto(dataUrl, dataUrl)
      } else {
        uploadRef.current?.click()
      }
    } catch (err) {
      if (!err?.message?.includes('cancel') && !err?.message?.includes('Cancel')) {
        setError('Photo error: ' + (err?.message || 'Unknown error'))
      }
    } finally {
      cameraInFlight.current = false
    }
  }

  // ── Hero / full-bleed layout (step 1, PremiumOnboarding only) ───────────────
  if (heroLayout) {
    const guideImg = photoType === 'side'
      ? (gender === 'female' ? sideProfileGuideFemale : sideProfileGuide)
      : (gender === 'female' ? faceGuidePhotoFemale : faceGuidePhoto)

    return (
      <div className="flex flex-col h-full" style={{ paddingTop: 12 }}>
        {cameraOpen && createPortal(
          <CameraOverlay stepNum={stepNum} onCapture={(url, blob) => { setCameraOpen(false); onPhoto(url, blob) }} onClose={() => setCameraOpen(false)} gender={gender} />,
          document.body
        )}
        <input ref={uploadRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(URL.createObjectURL(f), f) }} className="hidden" />

        {/* Full-bleed card — subtle gold border, rounded corners */}
        <div
          className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden pointer-events-none"
          style={{ background: '#080808', border: '1px solid rgba(198,168,92,0.2)' }}
        >
          {photo ? (
            <>
              <img src={photo} alt="uploaded" className="absolute inset-0 w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/20" />
              <div
                className="absolute inset-x-0 bottom-0 flex flex-col items-center px-5 pb-6 pt-16 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.85) 60%)' }}
              >
                <button
                  onClick={() => setShowActionSheet(true)}
                  className="flex items-center gap-1.5 py-2 px-4 active:opacity-60 transition-opacity pointer-events-auto"
                >
                  <RefreshCw size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <span className="text-[12px] font-body font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Retake Photo</span>
                </button>
              </div>
            </>
          ) : (
            <img src={guideImg} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
          )}
        </div>

        {error && (
          <div className="mt-2 flex items-center gap-2 px-4 py-3 rounded-2xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
            <AlertCircle size={15} className="text-warning flex-shrink-0" />
            <p className="text-sm text-warning font-body flex-1">{error}</p>
            <button onClick={() => setError('')} aria-label="Dismiss error" className="ml-1 flex-shrink-0 opacity-50 hover:opacity-100">
              <X size={14} className="text-warning" />
            </button>
          </div>
        )}

        <AnimatePresence>
          {showActionSheet && (
            <PhotoActionSheet
              onClose={() => setShowActionSheet(false)}
              options={[
                { label: 'Take Photo', icon: Camera, onSelect: () => { setShowActionSheet(false); handleCameraClick() } },
                { label: 'Choose from Library', icon: Upload, onSelect: () => { setShowActionSheet(false); handleUploadClick() } },
              ]}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }
  // ── End hero layout ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-3 justify-center">
      {cameraOpen && createPortal(
        <CameraOverlay stepNum={stepNum} onCapture={(url, blob) => { setCameraOpen(false); onPhoto(url, blob) }} onClose={() => setCameraOpen(false)} gender={gender} />,
        document.body
      )}

      {/* Preview / placeholder — pointer-events-none so nothing inside can block the buttons below.
          Steps 1 and 2 share the same near-full-width frame shape/border/glow,
          but step 1's aspect ratio is intentionally 4/5 (not 3/4 like step 2)
          — see the object-fit: cover + object-position: bottom comment below
          for why this specific ratio matters there. */}
      <div
        className={`relative w-full ${stepNum === 1 ? 'aspect-[4/5]' : 'aspect-[3/4]'} rounded-2xl flex items-center justify-center mt-2 mb-4 pointer-events-none`}
        style={{
          background: 'transparent',
          overflow: stepNum === 1 && !photo ? 'visible' : 'hidden',
          zIndex: stepNum === 1 && !photo ? 10 : 'auto',
          ...(stepNum === 1 && {
            border: `1.5px solid ${GOLD}`,
            boxShadow: '0 0 16px rgba(198,168,92,0.25)',
          }),
        }}
      >
        {photo ? (
          <>
            {/* object-contain (not cover) on step 1 specifically — cover inside
                this aspect-[4/5] box was cropping real uploaded/captured
                photos (whatever aspect ratio the camera/library photo came
                in at) down to a smaller center region, cutting off the chin
                or forehead depending on the source photo's proportions.
                Matches the same fix already applied to this step's guide
                placeholder image below. Steps 2/3 keep cover — out of scope
                here, not reported as cropping. */}
            <img
              src={photo}
              alt="uploaded"
              className={stepNum === 1 ? 'absolute inset-0 w-full h-full object-contain' : 'absolute inset-0 w-full h-full object-cover'}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="w-14 h-14 rounded-full bg-[#C6A85C] flex items-center justify-center">
                <CheckCircle2 size={30} className="text-white" />
              </div>
            </div>
          </>
        ) : stepNum === 2 ? (
          <img
            src={gender === 'female' ? sideProfileGuideFemale : sideProfileGuide}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center top', transform: 'scale(1.2)', transformOrigin: 'center top' }}
          />
        ) : stepNum === 1 ? (
          // object-fit: cover + object-position: bottom (not contain) — this
          // is a deliberate, computed crop, not a guess. Container is
          // aspect-[4/5] (0.8); image is 1000x1400 (0.7143). Under cover,
          // that mismatch always scales by width (image is narrower than
          // the box), which overflows the box's height by a fixed amount
          // regardless of viewport size: 1400 - (1.25 / (1000/1000)) *
          // 1000 = 150 source px. object-position: bottom anchors the
          // image's bottom edge to the box's bottom edge, so those 150px
          // come off the TOP only — exactly enough to crop out the orange
          // dot (source rows 63-75) and the empty space around it, with
          // ~60px of margin before the hairline (~row 210), which never
          // gets touched. The chin (row ~1297) stays fully clear of the
          // bottom edge — this crop budget comes off the top exclusively,
          // it doesn't eat into the bottom margin at all (verified: chin
          // margin is ~44px at 428px width, slightly MORE than it was
          // under the old aspect-[3/4]+contain framing, not less).
          <img
            src={gender === 'female' ? faceGuidePhotoFemale : faceGuidePhoto}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center bottom', transform: 'scale(1.6)', transformOrigin: 'center bottom', position: 'relative', zIndex: 10 }}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 p-8">
            <p className="text-white/60 text-xs text-center font-body max-w-[200px]">{guide}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-3 rounded-2xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <AlertCircle size={15} className="text-warning flex-shrink-0" />
          <p className="text-sm text-warning font-body flex-1">{error}</p>
          <button onClick={() => setError('')} aria-label="Dismiss error" className="ml-1 flex-shrink-0 opacity-50 hover:opacity-100">
            <X size={14} className="text-warning" />
          </button>
        </div>
      )}

      <input ref={uploadRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(URL.createObjectURL(f), f) }} className="hidden" />

      {stepNum !== 2 && (
        <div className="mb-1">
          <button
            onClick={() => setShowActionSheet(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-full active:scale-95 transition-transform"
            style={{ background: GOLD_GRADIENT, boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
          >
            <Camera size={18} style={{ color: '#0A0A0A' }} />
            <span className="text-[15px] font-heading font-bold" style={{ color: '#0A0A0A' }}>
              {photo ? 'Retake Selfie' : 'Upload or Take a Selfie'}
            </span>
          </button>
        </div>
      )}
      <AnimatePresence>
        {showActionSheet && (
          <PhotoActionSheet
            onClose={() => setShowActionSheet(false)}
            options={[
              { label: 'Take Photo', icon: Camera, onSelect: () => { setShowActionSheet(false); handleCameraClick() } },
              { label: 'Choose from Library', icon: Upload, onSelect: () => { setShowActionSheet(false); handleUploadClick() } },
            ]}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Analyzing Screen ─────────────────────────────────────────────────────────

// Matches the 6 category names from the Ascendus Analysis results carousel
// (CategoryCard.jsx's EXTENDED_CATEGORIES + OnboardingFinalSteps.jsx's
// OverallCard), sequenced top-to-bottom anatomically — not the carousel's own
// display order — since these ride a sweep line that physically moves down
// the face and needs to stay in the region it's naming. Overall lands last as
// a summary beat rather than a specific position.
const SWEEP_FEATURE_ROWS = [16, 30, 45, 59, 74, 88]
const SCAN_ALL_METRICS = [
  'Norwood Stage', 'Forehead Proportion', 'Hairline Recession', 'Hair Thinning', 'Hairline Density', 'Forehead Slope',
  'Orbital Depth', 'Canthal Tilt', 'Brow Density', 'Lash Density', 'Eyelid Exposure', 'Under-Eye Health',
  'Cheekbones', 'Maxilla', 'Nose', 'IPD', 'FWHR', 'Compactness',
  'Lips', 'Mandible', 'Gonial Angle', 'Ramus', 'Hyoid Tightness', 'Jaw Width',
  'Skin', 'Harmony', 'Symmetry', 'Neck Width', 'Bloat', 'Bone Mass',
]
// One-way top-to-bottom pass; the line bounces (reverses), so a full cycle
// is 2x this. Was 2800ms — too slow to guarantee even one full pass through
// all 6 labels before a fast (~1-2s) backend response ends the analyzing
// screen, so on a quick response the label could land on whichever band the
// response happened to catch it on (usually the last one, "overall") rather
// than having cycled through all 6. 1200ms keeps every band on-screen long
// enough to read (168-276ms each) while guaranteeing a full one-way pass —
// hitting all 6 labels once, in order — completes within that ~1-2s window.
const SWEEP_ONE_WAY_MS = 1200

// Dot positions computed once at module scope, each tagged with its row
// index so it can reference that row's keyframe (below) by name.
const SWEEP_DOTS = SWEEP_FEATURE_ROWS.flatMap((cy, row) => [35, 50, 65].map(cx => ({ cx, cy, row })))
const SWEEP_FULL_CYCLE_S = (SWEEP_ONE_WAY_MS * 2) / 1000

// A dim landmark dot that briefly brightens as the sweep line's position
// crosses it — on both the downward AND the return upward pass, via its
// row's CSS keyframe. Extra feedback only — the sweep line is the main effect.
function SweepFeatureDot({ cx, cy, row }) {
  return (
    <circle
      cx={cx} cy={cy} r={0.6}
      fill={GOLD}
      style={{ animation: `ascendus-sweep-dot-${row} ${SWEEP_FULL_CYCLE_S}s ease-in-out infinite` }}
    />
  )
}

// ─── Facial Analysis Overlay ─────────────────────────────────────────────────
// Landmark-style vector overlay drawn directly over the captured photo,
// synced 1:1 with the analysis step (see startAnalysis's 1s-per-step ticker).
// viewBox is a plain 0–100 percent grid, so every coordinate below is a
// literal %-of-photo position. Colors are a slightly warmer gold than the
// shared GOLD token — kept local to this effect rather than promoted to
// theme.js since nothing else uses this exact shade.
const LANDMARK_GOLD  = '#E5C158'
const LANDMARK_GLOW  = 'rgba(229, 193, 88, 0.85)'
const LANDMARK_GUIDE = 'rgba(255, 255, 255, 0.25)'


// Thin, technical-readout look (was strokeWidth 2.5 — read as thick/bold).
const LANDMARK_STROKE = 1.1

// ─── Real landmark anchoring ──────────────────────────────────────────────────
// Every line/dot/bracket below is anchored to the ACTUAL detected face in
// this photo, not an assumed centered position. Scan()'s startAnalysis kicks
// off MediaPipe FaceMesh (client/src/utils/faceLandmarks.js — the same
// engine that powers FaceMetricsExplorer/computeStructuralMetrics) the
// moment the analyzing screen mounts, in parallel with the real AI scoring
// call, and passes the resolved points down as `points`. Index reference is
// the same canonical MediaPipe Face Mesh map documented in
// faceLandmarks.js's computeStructuralMetrics.
const OVERLAY_LM_INDICES = {
  forehead: 10, nose: 1, noseBase: 2, chin: 152,
  browL: 105, browR: 334, upperLip: 13, lowerLip: 14,
  cheekL: 234, cheekR: 454,
  jawL: 172, jawR: 397, jawMidL: 136, jawChinL: 148, jawMidR: 365, jawChinR: 378,
  eyeOuterL: 33, eyeOuterR: 263, eyeInnerL: 133, eyeInnerR: 362,
  eyeTopL: 159, eyeBottomL: 145, eyeTopR: 386, eyeBottomR: 374,
  templeL: 127, templeR: 356,
  mouthL: 61, mouthR: 291,
  // Alar base (nose wing lateral edges) — used for alar base width label
  noseTipL: 129, noseTipR: 358,
  // Brow midpoint — used for forehead proportion label
  browMidL: 66,
}

// Raw MediaPipe landmarks (468 points, {x,y,z} normalized 0–1 to the source
// image) → the named subset this overlay draws from, still normalized 0–1.
export function extractScanOverlayPoints(lm) {
  const out = {}
  for (const [key, i] of Object.entries(OVERLAY_LM_INDICES)) {
    const p = lm[i]
    if (!p) return null
    out[key] = { x: p.x, y: p.y }
  }
  // Ordered MediaPipe surface contours; omit an incomplete loop rather than
  // inventing a symmetric shape or using an unrelated landmark as a fallback.
  const loop = ids => ids.every(i => lm[i]) ? ids.map(i => ({ x: lm[i].x, y: lm[i].y })) : null
  out.jawContour = loop([234,93,132,58,172,136,150,149,176,148,152,377,400,378,379,365,397,288,361,323,454])
  out.mandibleL = loop([234,93,132,58,172,136,150,149,176,148,152])
  out.mandibleR = loop([454,323,361,288,397,365,379,378,400,377,152])
  out.chinContour = loop([149,176,148,152,377,400,378])
  out.malarL = loop([127,111,117,118,119,120,121,47,100,101,50,205,187,123,234])
  out.malarR = loop([356,340,346,347,348,349,350,277,329,330,280,425,411,352,454])
  out.buccalL = loop([123,117,118,50,101,205,206,207,192,147,93,234])
  out.buccalR = loop([352,346,347,280,330,425,426,427,416,376,323,454])
  out.eyeLoopL = loop([33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7])
  out.eyeLoopR = loop([263,466,388,387,386,385,384,398,362,382,381,380,374,373,390,249])
  out.browLoopL = loop([70,63,105,66,107,55,65,52,53,46])
  out.browLoopR = loop([300,293,334,296,336,285,295,282,283,276])
  return out
}

// Full dense wireframe mesh (the "scanning" beat, distinct from the gold
// step-by-step readouts above) — built from the SAME detected landmarks,
// so it tracks and stays locked to this exact face too. `edges` is
// MediaPipe's own standard face triangulation (FACEMESH_TESSELATION, ~2,556
// directed edges around 468 points — real anatomical topology, not
// invented) deduped to unique undirected pairs and flattened into ONE SVG
// path string, rather than one <line> per edge — a single path is one DOM
// node for the WebView to animate instead of well over a thousand.
export function buildMeshPathD(lm, edges) {
  const seen = new Set()
  let d = ''
  for (const [a, b] of edges) {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`
    if (seen.has(key)) continue
    seen.add(key)
    const pa = lm[a], pb = lm[b]
    if (!pa || !pb) continue
    d += `M ${(pa.x * 100).toFixed(2)} ${(pa.y * 100).toFixed(2)} L ${(pb.x * 100).toFixed(2)} ${(pb.y * 100).toFixed(2)} `
  }
  return d || null
}

// Fallback geometry — used only until real landmarks resolve (or if
// detection fails outright, e.g. a face MediaPipe can't confidently read).
// Assumes a face roughly centered per the capture guide ("Center your face
// in the oval"); startAnalysis fires landmark detection the instant the
// analyzing screen mounts, so in practice this only ever shows for the
// first fraction of a second.
// FALLBACK_STEP_GEOMETRY removed — SVG step geometry no longer rendered.
// Readouts intentionally carry no text — position-only anchors.
// Raw numbers were removed: they were hardcoded and identical for every user.
const FALLBACK_STEP_READOUTS = [null, null, null, null, null]
// Secondary measurements that cycle continuously for as long as this overlay
// is mounted, independent of `step`. The 5 main steps above only span ~4s
// (1s each); the real AI call typically runs another 10+ seconds parked on
// step 4's pulsing brackets, which used to just sit there doing nothing for
// most of the wait. This keeps fresh geometry + numbers appearing the whole
// time so the screen reads as "busy" for the full analysis, not just the
// first few seconds of it.
// buildLiveStepGeometry, FALLBACK_TICKER_MEASUREMENTS, and buildLiveTicker
// removed — SVG step geometry and ticker lines no longer rendered.


// ── Anatomy label chips ───────────────────────────────────────────────────────
// ONE chip visible at a time, cycling every LABEL_CYCLE_MS.
// anchorFn(pts) → {x, y} in 0-1 space derived from REAL MediaPipe landmarks.
// valueFn(pts, scanResult) → formatted string from REAL computed / API data.
// When pts is null (landmarks not yet resolved) the fallback position is used
// and value shows '—'. Values are NEVER hardcoded example numbers.
//
// Anatomical substitutions (where exact landmark doesn't exist in our set):
//   Rhinion (mid-dorsum) → nose tip #1 — closest available
//   True gonion           → jawL #172 / jawR #397 (lateral jaw, gonion area)
//   Orbital vector depth  → no 2D proxy; value derived from API eyeArea sub-score
//   Brow ridge            → forehead #10 (upper mesh boundary, not true supraorbital)

// ── Geometry helpers ─────────────────────────────────────────────────────────
function _vecAngleDeg(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2)
  return mag < 1e-10 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI)
}
// Average tilt of inner→outer canthus line vs. horizontal, both eyes.
// Positive = outer corner higher than inner (favorable / hunter eyes).
function _canthalTiltDeg(pts) {
  const eyeTilt = (inner, outer) => {
    const dx = Math.abs(outer.x - inner.x)
    const dy = inner.y - outer.y   // positive when outer is above inner (y↓)
    return Math.atan2(dy, dx) * (180 / Math.PI)
  }
  return (eyeTilt(pts.eyeInnerL, pts.eyeOuterL) + eyeTilt(pts.eyeInnerR, pts.eyeOuterR)) / 2
}
// Approximate gonial angle at both jaw corners: angle between ramus (jaw→temple)
// and body (jaw→chin) directions, averaged L+R.
function _gonialAngleDeg(pts) {
  const angle = (jaw, temple, chin) => _vecAngleDeg(
    { x: temple.x - jaw.x, y: temple.y - jaw.y },
    { x: chin.x   - jaw.x, y: chin.y   - jaw.y },
  )
  return (angle(pts.jawL, pts.templeL, pts.chin) + angle(pts.jawR, pts.templeR, pts.chin)) / 2
}

// 14 metrics with real backing data, positioned in fixed facial zones.
// Not live-tracked; purely a static positional layout.
//
// Data sources (in order of when they become available during analysis):
//   pts      — MediaPipe geometry, resolves ~2-5s after analyzing screen mounts
//   scan     — core API faceSubScores, resolves after AI call (~8-15s)
//   extended — extendedMetrics, loaded async post-scan (not available during overlay)
//
// '—' shows for any metric whose data source hasn't resolved yet.
const ANATOMY_LABELS = [
  {
    id: 'canthal',
    title: 'CANTHAL TILT',
    pos: { top: '30%', left: '68%' },
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const deg = _canthalTiltDeg(pts)
      return deg >= 3 ? 'Strong' : deg >= 1 ? 'Moderate' : deg >= 0 ? 'Neutral' : 'Negative Tilt'
    },
  },
  {
    id: 'orbital',
    title: 'ORBITAL VECTOR',
    pos: { top: '30%', left: '32%' },
    valueFn: (_pts, scan) => {
      const s = scan?.faceSubScores?.eyeArea
      if (s == null) return '—'
      return s >= 7.5 ? 'Favorable' : s >= 5.5 ? 'Neutral' : 'Suboptimal'
    },
  },
  {
    id: 'hairline',
    title: 'HAIRLINE RECESSION',
    pos: { top: '10%', left: '50%' },
    valueFn: (_pts, _scan) => '—',
  },
  {
    id: 'forehead',
    title: 'FOREHEAD PROPORTION',
    pos: { top: '19%', left: '65%' },
    // Geometry: forehead height (tip → brow) / face height (tip → chin)
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const fhH   = Math.abs(pts.forehead.y - pts.browMidL.y)
      const faceH = Math.abs(pts.forehead.y - pts.chin.y)
      if (faceH < 0.01) return '—'
      const ratio = fhH / faceH
      return ratio < 0.28 ? 'Compact' : ratio < 0.36 ? 'Proportionate' : 'High'
    },
  },
  {
    id: 'ipd',
    title: 'INTERPUPILLARY DIST',
    pos: { top: '36%', left: '50%' },
    // Geometry: interpupillary width / bizygomatic width
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const ipd    = Math.abs(pts.eyeInnerR.x - pts.eyeInnerL.x)
      const bizygo = Math.abs(pts.cheekR.x    - pts.cheekL.x)
      if (bizygo < 0.01) return '—'
      const ratio = ipd / bizygo
      return ratio < 0.27 ? 'Close-set' : ratio < 0.35 ? 'Ideal' : 'Wide-set'
    },
  },
  {
    id: 'nasal',
    title: 'NASAL BRIDGE',
    pos: { top: '44%', left: '50%' },
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const ic     = Math.abs(pts.eyeInnerR.x - pts.eyeInnerL.x)
      const bizygo = Math.abs(pts.cheekR.x    - pts.cheekL.x)
      if (bizygo < 0.01) return '—'
      const ratio = ic / bizygo
      return ratio < 0.28 ? 'Narrow' : ratio < 0.34 ? 'Proportionate' : 'Wide'
    },
  },
  {
    id: 'nose_proj',
    title: 'NOSE PROJECTION',
    pos: { top: '52%', left: '68%' },
    valueFn: (_pts, scan) => {
      const s = scan?.faceSubScores?.facialProportions
      if (s == null) return '—'
      return s >= 7.5 ? 'Well-projected' : s >= 5.5 ? 'Moderate' : 'Low Projection'
    },
  },
  {
    id: 'alar',
    title: 'ALAR BASE WIDTH',
    pos: { top: '57%', left: '32%' },
    // Geometry: alar width relative to intercanthal distance
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const alar = Math.abs(pts.noseTipR.x - pts.noseTipL.x)
      const ic   = Math.abs(pts.eyeInnerR.x - pts.eyeInnerL.x)
      if (ic < 0.01) return '—'
      const ratio = alar / ic
      return ratio < 0.88 ? 'Narrow' : ratio < 1.12 ? 'Ideal' : 'Wide'
    },
  },
  {
    id: 'zygomatic',
    title: 'ZYGOMATIC ARCH',
    pos: { top: '48%', left: '72%' },
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const bizygo = Math.abs(pts.cheekR.x - pts.cheekL.x)
      const bigon  = Math.abs(pts.jawR.x   - pts.jawL.x)
      if (bigon < 0.01) return '—'
      const ratio = bizygo / bigon
      return ratio > 1.30 ? 'High Projection' : ratio > 1.20 ? 'Prominent' : ratio > 1.10 ? 'Moderate' : 'Low Relief'
    },
  },
  {
    id: 'lip',
    title: 'LIP FULLNESS',
    pos: { top: '67%', left: '60%' },
    valueFn: (_pts, scan) => {
      const s = scan?.faceSubScores?.facialHarmony
      if (s == null) return '—'
      return s >= 7.5 ? 'Full' : s >= 5.5 ? 'Moderate' : 'Thin'
    },
  },
  {
    id: 'mandible',
    title: 'MANDIBULAR ANGLE',
    pos: { top: '67%', left: '30%' },
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const deg = _gonialAngleDeg(pts)
      return deg < 115 ? 'Very Sharp' : deg < 122 ? 'Sharp' : deg < 130 ? 'Balanced' : 'Rounded'
    },
  },
  {
    id: 'gonial',
    title: 'GONIAL ANGLE',
    pos: { top: '74%', left: '70%' },
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const deg = _gonialAngleDeg(pts)
      return deg < 118 ? 'Angular' : deg < 128 ? 'Defined' : 'Soft'
    },
  },
  {
    id: 'chin',
    title: 'CHIN–PHILTRUM RATIO',
    pos: { top: '78%', left: '50%' },
    valueFn: (_pts, scan) => {
      const s = scan?.faceSubScores?.jawlineDefinition
      if (s == null) return '—'
      return s >= 7.5 ? 'Ideal' : s >= 5.5 ? 'Acceptable' : 'Off-ratio'
    },
  },
  {
    id: 'ramus',
    title: 'RAMUS HEIGHT',
    pos: { top: '60%', left: '28%' },
    // Geometry: vertical distance from jaw corner to temple, relative to face height
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const ramusH = Math.abs(pts.jawL.y - pts.templeL.y)
      const faceH  = Math.abs(pts.forehead.y - pts.chin.y)
      if (faceH < 0.01) return '—'
      const ratio = ramusH / faceH
      return ratio > 0.50 ? 'Tall' : ratio > 0.38 ? 'Average' : 'Short'
    },
  },
]

// 1.4s per label — paced to feel like real biometric computation across the
// full scan duration (14 labels × 1.4s = ~19.6s total coverage).
const LABEL_CYCLE_MS = 1400

// Fixed chip width — critical for the bounds calculation below. By fixing
// this we know exactly how far each edge extends and can guarantee no clipping
// without depending on the runtime element width (which CSS clamp can't see).
const CHIP_W = 188
const CHIP_HALF = CHIP_W / 2   // = 94px
const CHIP_MARGIN = 10          // minimum px from container edge

// Chip for a single anatomy metric. title + qualifier are always coupled
// inside one object so they can never be indexed independently and desync.
//
// Positioning strategy: instead of `left: X% + translateX(-50%)` (where CSS
// clamp can't account for the runtime chip width), we fix the chip width at
// CHIP_W px and compute the LEFT EDGE position directly:
//
//   chip_left = pos.left_px - CHIP_HALF
//   clamped   = clamp(CHIP_MARGIN, chip_left, containerWidth - CHIP_W - CHIP_MARGIN)
//
// Written as CSS: clamp(10px, calc(pos.left - 94px), calc(100% - 198px))
//   • min 10px → chip left edge ≥ 10px from left wall
//   • max calc(100% - 198px) → chip right edge ≤ 10px from right wall
// No transform needed, no interaction between transform and clamp.
function AnatomyLabel({ title, qualifier, pos }) {
  // Derive the LEFT EDGE anchor from the conceptual center position
  const leftEdge = `calc(${pos.left} - ${CHIP_HALF}px)`
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28, mass: 0.75 }}
      className="absolute pointer-events-none"
      style={{
        left: `clamp(${CHIP_MARGIN}px, ${leftEdge}, calc(100% - ${CHIP_W + CHIP_MARGIN}px))`,
        top: `clamp(60px, ${pos.top}, calc(100% - 76px))`,
        width: CHIP_W,
        // translateY only — no X shift needed since left edge is pre-computed
        transform: 'translateY(-50%)',
      }}
    >
      <div style={{
        background: 'rgba(0,0,0,0.90)',
        border: `1px solid ${LANDMARK_GOLD}55`,
        borderRadius: 10,
        padding: '7px 14px',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
          color: LANDMARK_GOLD, fontFamily: 'monospace', textTransform: 'uppercase',
          lineHeight: 1.3,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.04em',
          color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace',
          lineHeight: 1.4, marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {qualifier}
        </div>
      </div>
    </motion.div>
  )
}

// One L-shaped corner bracket of the final "target lock" bounding box —
// two short arms meeting at (x, y), pointing inward per (dx, dy).
function LandmarkBracket({ x, y, dx, dy }) {
  const arm = 8
  return <path d={`M ${x} ${y + dy * arm} L ${x} ${y} L ${x + dx * arm} ${y}`} />
}

// Small HTML readout label, positioned to match an SVG anchor point 1:1
// (0–100 viewBox units map directly onto 0%–100% here).
function Readout({ x, y, text, align = 'center' }) {
  const translateX = align === 'center' ? '-50%' : align === 'left' ? '0%' : '-100%'
  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute font-mono"
      style={{
        left: `${x}%`, top: `${y}%`,
        transform: `translate(${translateX}, -50%)`,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
        color: LANDMARK_GOLD, textShadow: `0 0 6px ${LANDMARK_GLOW}`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </motion.div>
  )
}

function FacialAnalysisOverlay({ step: _step, points, scanResult }) {
  // Internal monotonic timer: advances labelIdx forward by 1 every LABEL_CYCLE_MS,
  // clamps at the last label and stops — never loops. This gives continuous,
  // non-repeating coverage across the full scan duration regardless of how
  // long the API takes. The `step` prop controls the progress bar externally
  // and is no longer used to drive the label index.
  const [labelIdx, setLabelIdx] = useState(0)
  useEffect(() => {
    let idx = 0
    const id = setInterval(() => {
      idx += 1
      if (idx >= ANATOMY_LABELS.length) { clearInterval(id); return }
      setLabelIdx(idx)
    }, LABEL_CYCLE_MS)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const label = ANATOMY_LABELS[labelIdx]
  const qualifier = points ? label.valueFn(points, scanResult) : '—'

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Single AnimatePresence here so mode="wait" actually coordinates the
          exit of the outgoing chip with the entry of the incoming one — having
          one AnimatePresence per chip (previously) made them independent and
          caused overlap that looked like repeating labels. */}
      <AnimatePresence mode="wait">
        <AnatomyLabel
          key={label.id}
          title={label.title}
          qualifier={qualifier}
          pos={label.pos}
        />
      </AnimatePresence>
    </div>
  )
}

// A quick, punchy "morph" flourish played once the real result is in hand,
// right before handing off to the results/unlock screen — scale pulse +
// blur pulse + a thin RGB-channel split (duplicated, offset, screen-blended
// copies of the photo) + a gold flash. Deliberately NOT a true pixel-warp
// (feDisplacementMap/feTurbulence) — that's unreliable inside WKWebView on
// iOS, so this fakes the "morphing" feel with filters/transforms that render
// consistently everywhere. ~900ms total; Scan.jsx's startAnalysis awaits
// roughly that long before navigating so the flourish is never cut off mid-play.
function MorphWarpOverlay({ photo }) {
  return (
    <motion.div className="absolute inset-0 pointer-events-none" style={{ background: GOLD, mixBlendMode: 'soft-light' }}
      initial={{ opacity: 0 }} animate={{ opacity: [0, .34, 0] }} transition={{ duration: .9, ease: 'easeInOut' }} />
  )
}

const MESH_CYAN = GOLD
const MESH_GLOW = 'rgba(198, 168, 92, 0.85)'

// One-time ~3.4s "mesh lock-on" beat that plays as soon as real landmarks
// resolve (see startAnalysis) — a dense wireframe (buildMeshPathD, above)
// fades in over the real detected face, a bright line sweeps top-to-bottom
// across it once, then it fades out and the normal gold step-by-step
// overlay (already running underneath the whole time) is what's left.
// Gold matches the rest of the Ascendus scanner.
// Renders nothing until `pathD` exists — see AnalyzingSweepOverlay, which
// mounts this once per scan, so the animation timing below starts exactly
// when the real mesh is ready to show, not from an arbitrary earlier time.
function FaceMeshScanOverlay({ pathD }) {
  if (!pathD) return null
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 3.4, times: [0, 0.1, 0.88, 1], ease: 'easeInOut' }}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ filter: `drop-shadow(0 0 2px ${MESH_GLOW})` }}
      >
        <path d={pathD} fill="none" stroke={MESH_CYAN} strokeWidth={0.35} strokeLinecap="round" opacity={0.8} vectorEffect="non-scaling-stroke" />
        <motion.line
          x1="0" x2="100"
          initial={{ y1: 0, y2: 0 }}
          animate={{ y1: 100, y2: 100 }}
          transition={{ duration: 3, ease: 'linear' }}
          stroke={MESH_CYAN}
          strokeWidth={0.6}
          opacity={0.9}
        />
      </svg>
    </motion.div>
  )
}

// The presentation clock starts once landmarks are ready. Image URL upgrades
// and late mesh updates never reset it; real-result completion waits on its gate.
// ScanPortrait applies the same source-to-cover transform to photo and geometry.
function AnalyzingSweepOverlay({ photo, points, meshPathD, onPresentationComplete, previewElapsed }) {
  const [elapsed, setElapsed] = useState(0)
  const finishRef = useRef(onPresentationComplete)
  finishRef.current = onPresentationComplete
  const ready = Boolean(points)
  useEffect(() => {
    if (!ready || previewElapsed != null) return
    const start = performance.now()
    let id
    const tick = now => {
      const next = now - start
      setElapsed(next)
      if (scanFrame(next).complete) finishRef.current?.()
      else id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [ready, previewElapsed])
  const time = previewElapsed ?? elapsed
  const frame = scanFrame(time)
  const label = frame.compiling ? 'COMPILING RESULTS' : frame.active < 0 ? 'DETECTING STRUCTURE' : `ANALYZING · ${frame.active + 1}/${SCAN_FEATURES.length}`
  return <div className="reference-scan">
    <div className="reference-status" role="status" aria-live="polite">{label}</div>
    <div className="reference-segments" aria-hidden="true">{Array.from({ length: SCAN_FEATURES.length }, (_, i) => <i key={i} className={frame.active >= i ? 'is-active' : ''} />)}</div>
    <ScanPortrait photo={photo} points={points} meshPathD={meshPathD} elapsed={time} frame={frame} />
    {!ready && <p className="reference-wait">Locating facial landmarks…</p>}
  </div>
}

const REAL_SCAN_STAGES = ['Preparing images', 'Detecting facial landmarks', 'Analyzing front and side', 'Building results', 'Results ready']

function buildDiagnosticLines(scanResult) {
  const subs = scanResult?.faceSubScores
  if (!subs) return []
  const add = (v, pos, neg) => (v ?? 0) >= 7 ? pos : neg
  return [
    add(subs.symmetry,          'Strong bilateral symmetry detected',     'Symmetry variance analysis complete'),
    add(subs.jawlineDefinition, 'Angular jawline geometry confirmed',      'Jawline definition path identified'),
    add(subs.skinClarity,       'High skin texture clarity measured',      'Skin clarity optimization detected'),
    add(subs.facialProportions, 'Golden ratio alignment confirmed',        'Proportion calibration opportunity found'),
    add(subs.eyeArea,           'Eye area geometry favorable',             'Eye area potential identified'),
    add(subs.facialHarmony,     'High facial harmony index confirmed',     'Harmony calibration in progress'),
  ]
}

export function AnalyzingScreen({ photo, points = null, meshPathD = null, onPresentationComplete, previewElapsed }) {
  return <AnalyzingSweepOverlay photo={photo} points={points} meshPathD={meshPathD} onPresentationComplete={onPresentationComplete} previewElapsed={previewElapsed} />
}

function ChecklistRow({ step: s, i, currentStep }) {
  const isDone = i < currentStep
  const isActive = i === currentStep
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
      transition={{ delay: i * 0.08 }}
      className="flex items-center gap-3"
    >
      <motion.div
        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        animate={isDone ? { rotate: [0, 360], scale: [0.6, 1] } : {}}
        transition={{ duration: 0.5, ease: 'backOut' }}
        style={{ background: isDone ? GOLD : isActive ? '#F5A623' : 'rgba(255,255,255,0.08)' }}
      >
        {isDone ? <CheckCircle2 size={11} className="text-white" /> :
         isActive ? <div className="w-1.5 h-1.5 rounded-full bg-white/70" /> :
         <div className="w-1.5 h-1.5 rounded-full bg-white/25" />}
      </motion.div>
      {isActive ? (
        <span className="text-sm font-body relative overflow-hidden text-primary">
          {s.label}
          <motion.span
            className="absolute inset-0"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            style={{ background: 'linear-gradient(90deg, transparent, rgba(198,168,92,0.9), transparent)', mixBlendMode: 'overlay', width: '50%' }}
          />
        </span>
      ) : (
        <span className={`text-sm font-body ${isDone ? 'text-primary' : 'text-secondary'}`}>
          {s.label}
        </span>
      )}
    </motion.div>
  )
}

// ─── Main Scan Page ───────────────────────────────────────────────────────────
// Steps: 0=gender  1=face  2=side-profile  3=analyzing
// Body Photo / physique scoring is intentionally NOT part of this flow —
// physique scoring only happens in the separate Training Plan flow
// (TrainingPlanIntro.jsx's own body-photo step, via /score/physique).

// Only step 0 (gender select) still uses PageHeader's title/subtitle —
// steps 1 and 2 render their own matching custom header instead (below).

export default function Scan() {
  const [showScanSource, setShowScanSource] = useState(false)
  const libraryInputRef = useRef(null)
  const libraryBusyRef = useRef(false)
  async function addPhoto() {
    if (libraryBusyRef.current) return
    triggerHaptic()
    if (!isNative()) { libraryInputRef.current?.click(); return }
    libraryBusyRef.current = true
    try {
      const url = await pickPhoto()
      if (url) setPreviewPhoto({ url, forStep: step, source: 'library' })
    } catch (err) {
      if (!/cancel/i.test(err?.message || '')) setError('Could not open your photo. Please try again.')
    } finally { libraryBusyRef.current = false }
  }

  const presentationRef = useRef(null)
  const scanMountedRef = useRef(true)
  useEffect(() => {
    scanMountedRef.current = true
    return () => { scanMountedRef.current = false; presentationRef.current?.finish(false); presentationRef.current = null }
  }, [])
  const navigate = useNavigate()
  const { state: routeState } = useLocation()
  const recoveredFrontPhoto = routeState?.recoveredFrontPhoto ?? null
  const savedGender       = useStore(s => s.gender)
  const scans             = useStore(s => s.scans)
  const isPremium         = useStore(s => s.isPremium)
  const scanCount         = useStore(s => s.scanCount)
  const userProfile       = useStore(s => s.userProfile)
  const lastScanDate      = useStore(s => s.lastScanDate)
  const token             = useStore(s => s.token)
  const setPendingFacePhoto = useStore(s => s.setPendingFacePhoto)
  const addScan                = useStore(s => s.addScan)
  const setCurrentScan         = useStore(s => s.setCurrentScan)
  const setLastFaceScanCapture = useStore(s => s.setLastFaceScanCapture)
  const patchScanExtendedMetrics = useStore(s => s.patchScanExtendedMetrics)
  const setCurrentPlan    = useStore(s => s.setCurrentPlan)
  const setGender         = useStore(s => s.setGender)
  const incrementScanCount = useStore(s => s.incrementScanCount)
  const recordProScan     = useStore(s => s.recordProScan)
  const setAssignedPhase  = useStore(s => s.setAssignedPhase)
  const setLastScanDate   = useStore(s => s.setLastScanDate)
  const logout            = useStore(s => s.logout)
  const setScanLaunching  = useStore(s => s.setScanLaunching)

  // Clear the global scan-launch overlay the instant this page mounts
  useEffect(() => { setScanLaunching(false) }, [])

  // Monthly scan gate disabled — server-side Redis limit handles scan caps
  const isFreeScanBlocked = false

  const [step, setStep]                   = useState(recoveredFrontPhoto ? 2 : 1) // skip gender step — already collected in onboarding
  const [cameraOpen, setCameraOpen]        = useState(false) // false = show guide screen, true = camera live
  const [previewPhoto, setPreviewPhoto]    = useState(null)  // {url, blob, forStep} — shown after capture for confirm/retake
  const [gender, setLocalGender]          = useState(savedGender ?? null)
  const [facePhoto, setFacePhoto]         = useState(recoveredFrontPhoto)
  const [sidePhoto, setSidePhoto]         = useState(null)
  const [analysisStep, setAnalysisStep]   = useState(0)
  const [slowAnalysis, setSlowAnalysis]   = useState(false)
  // Drives the ~900ms morph-warp flourish (MorphWarpOverlay, in
  // AnalyzingSweepOverlay) that plays over the finished photo right before
  // handing off to results/unlock — see startAnalysis, just above its
  // navigate() call.
  const [morphing, setMorphing]           = useState(false)
  const [transitioning, setTransitioning] = useState(false) // brief overlay between preview→analyze
  // Measured landmarks for this scan's photos. Mapping starts after the
  // front photo passes validation so the processing overlay can use it.
  const [analysisPoints, setAnalysisPoints] = useState(null)
  const [analysisLandmarks, setAnalysisLandmarks] = useState(null)
  const [sideAnalysisPoints, setSideAnalysisPoints] = useState(null)
  const [sideAnalysisLandmarks, setSideAnalysisLandmarks] = useState(null)
  const [sideDetectionPending, setSideDetectionPending] = useState(false)
  // SVG mesh path from the same front landmark detection.
  const [meshPathD, setMeshPathD]         = useState(null)
  const [error, setError]                 = useState('')
  const [rateLimited, setRateLimited]     = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [claudeRateLimited, setClaudeRateLimited] = useState(false)
  const [scanCapReached, setScanCapReached] = useState(false)
  const [scanCapPlan, setScanCapPlan]     = useState('free')
  const [showConsent, setShowConsent]     = useState(false) // consent modal removed
  const [analysisResult, setAnalysisResult] = useState(null) // real API result once resolved, drives diagnostic feed + score ticker

  const startAnalysisRef  = useRef(null)
  const frontLandmarksRef = useRef(null)
  const validatedFrontRef = useRef(recoveredFrontPhoto)
  const rateLimitInitial  = useRef(30)
  const sideTriggerRef    = useRef(null)


  function ensureFrontLandmarks(url) {
    if (!url) return Promise.resolve(null)
    if (frontLandmarksRef.current?.url === url) return frontLandmarksRef.current.promise
    setAnalysisPoints(null)
    setMeshPathD(null)
    const promise = import('../utils/faceLandmarks.js')
      .then(({ getLandmarks }) => getLandmarks(url))
      .then(lm => {
        setAnalysisLandmarks(lm)
        const points = extractScanOverlayPoints(lm)
        if (points) setAnalysisPoints(points)
        loadFaceMeshLibrary().then(mod => {
          const FACEMESH_TESSELATION = mod.FACEMESH_TESSELATION || mod.default?.FACEMESH_TESSELATION || globalThis.FACEMESH_TESSELATION
          const path = buildMeshPathD(lm, FACEMESH_TESSELATION)
          if (path) setMeshPathD(path)
        }).catch(() => {})
        return { points, landmarks: lm }
      })
      .catch(err => {
        console.warn('[Scan] Front landmark mapping unavailable:', err?.message)
        return null
      })
    frontLandmarksRef.current = { url, promise }
    return promise
  }

  // Countdown → auto-retry
  useEffect(() => {
    if (!rateLimited) return
    if (retryCountdown <= 0) { setRateLimited(false); startAnalysisRef.current?.(); return }
    const t = setTimeout(() => setRetryCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [rateLimited, retryCountdown])

  if (isFreeScanBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <div className="mb-4"><Lock size={48} style={{ color: '#C6A85C' }} /></div>
        <h2 className="font-heading font-bold text-xl text-primary mb-2">Scan Limit Reached</h2>
        <p className="text-secondary text-sm font-body mb-2">
          Free users get 1 scan per month. Your next free scan resets{' '}
          {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
        </p>
        <p className="text-secondary text-sm font-body mb-6">Upgrade to Pro for unlimited scans.</p>
        <button onClick={() => navigate('/premium')} className="btn-primary mb-3 max-w-xs">Unlock Unlimited Scans</button>
        <button onClick={() => navigate('/premium')} className="text-sm font-heading font-bold" style={{ color: '#C6A85C' }}>
          <span className="flex items-center gap-1.5"><Gift size={14} /> Or share with 3 friends to unlock</span>
        </button>
      </div>
    )
  }

  // Convert an image URL (blob: or data:) to a resized base64 string.
  // 15s timeout guards against WKWebView blob URL expiry silently hanging.
  async function toBase64(url, maxPx = 1024) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Photo processing timed out. Please retake your photo')), 15_000)
    )
    const convert = (async () => {
      const res = await fetch(url)
      const blob = await res.blob()
      return new Promise((resolve, reject) => {
        const img = new Image()
        const blobUrl = URL.createObjectURL(blob)
        img.onload = () => {
          URL.revokeObjectURL(blobUrl)
          const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
          const w = Math.round(img.width  * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Image load failed')) }
        img.src = blobUrl
      })
    })()
    return Promise.race([convert, timeout])
  }

  // Transition from front face → side profile.
  // Runs quality validation during the ProcessingOverlay loading state so the
  // check works for BOTH camera captures and library uploads (both call this).
  // FAIL-CLOSED: any error during validation blocks the scan, never silently passes.
  async function transitionToSide(url) {
    if (import.meta.env.DEV) console.log('[ASCENDUS SCAN] Front captured')
    console.log('[ASCENDUS SCAN] 1. Scan started')
    console.log('[ASCENDUS SCAN] 2. Image captured/selected — type:', url ? url.slice(0, 40) : 'null')

    setFacePhoto(url)
    setError('')
    setCameraOpen(false)
    setPreviewPhoto(null)
    setTransitioning(true)  // show loading overlay immediately

    console.log('[ASCENDUS SCAN] 3. Image converted successfully')

    let passed = false
    let issues = []
    try {
      const { validateScanQuality } = await import('../utils/scanQuality.js')
      const result = await validateScanQuality(url)
      passed = result.passed
      issues = result.issues
    } catch (err) {
      // Fail-CLOSED: if the validator itself throws, block the scan
      console.error('[Scan] Quality check error (fail-closed):', err?.message)
      passed = false
      issues = [{ code: 'validation_error', title: 'Could not validate photo — please try again', advice: 'Please try again.', severity: 'critical' }]
    }

    if (!passed) {
      setTransitioning(false)
      navigate('/scan/quality-fail', { state: { issues, photoUrl: url } })
      return
    }

    validatedFrontRef.current = url
    ensureFrontLandmarks(url) // start mapping during side capture, before processing mounts
    console.log('[ASCENDUS SCAN] 9. Starting facial analysis')
    setStep(2)
    setTransitioning(false)
  }

  // skipSideOverride — set true when user taps "Skip Side Profile"
  async function startAnalysis(skipSideOverride = false) {
    if (isFreeScanBlocked) { navigate('/premium'); return }

    let qualityGate = { passed: true, state: 'SUCCESS', source: 'prior_capture_gate' }

    // Validate only if this photo did not already pass the front capture gate.
    // Network validation is not cached and can delay the processing screen.
    if (facePhoto && validatedFrontRef.current !== facePhoto) {
      let qPassed = false
      let qIssues = []
      try {
        const { validateScanQuality } = await import('../utils/scanQuality.js')
        const qResult = await validateScanQuality(facePhoto)
        qualityGate = qResult
        qPassed = qResult.passed
        qIssues = qResult.issues
      } catch (err) {
        console.error('[Scan] startAnalysis quality gate error (fail-closed):', err?.message)
        qPassed = false
        qIssues = [{ code: 'validation_error', title: 'Could not validate photo', advice: 'Please try again.', severity: 'critical' }]
      }
      if (!scanMountedRef.current) return
      if (!qPassed) {
        navigate('/scan/quality-fail', { state: { issues: qIssues, photoUrl: facePhoto } })
        return
      }
      validatedFrontRef.current = facePhoto
    }

    presentationRef.current?.finish(false)
    const presentation = presentationGate()
    presentationRef.current = presentation
    const skipSide = skipSideOverride
    const g        = gender ?? 'male'
    setGender(g)
    if (import.meta.env.DEV) {
      console.log('[ASCENDUS SCAN] Profile captured')
      console.log('[ASCENDUS SCAN] Entering processing')
    }
    setStep(3)  // analyzing
    setError('')
    setAnalysisStep(0)
    setAnalysisResult(null)
    setSideAnalysisPoints(null)
    setSideAnalysisLandmarks(null)
    setSideDetectionPending(!!sidePhoto && !skipSide)

    // Reuse front landmarks already mapping during side capture. The overlay
    // waits for measured anchors rather than drawing generic positions.
    const frontLandmarksPromise = ensureFrontLandmarks(facePhoto)
    if (facePhoto) setAnalysisStep(1)

    const slowTimer = setTimeout(() => setSlowAnalysis(true), 12000)

    try {
      const landmarks = await frontLandmarksPromise
      if (presentationRef.current !== presentation) return
      if (!landmarks?.points) throw new Error('We could not locate your face. Please use a clear front-facing photo and retry.')
      const faceB64    = await toBase64(facePhoto)
      if (faceB64) setFacePhoto(faceB64) // upgrade blob URL → stable data URL so retries don't expire
      const sideB64 = (!skipSide && sidePhoto) ? await toBase64(sidePhoto) : null
      if (sideB64) setSidePhoto(sideB64)
      let sideLandmarksPromise = Promise.resolve(null)
      if (sideB64 && !isNative()) {
        // FaceMesh uses one shared instance: wait for the front photo before
        // asking it to inspect the side photo for visual callout anchors.
        sideLandmarksPromise = frontLandmarksPromise.then(() => import('../utils/faceLandmarks.js'))
          .then(({ getLandmarks }) => getLandmarks(sideB64))
          .then(lm => {
            setSideAnalysisLandmarks(lm)
            const profilePoints = profilePointsFromMesh(lm)
            setSideAnalysisPoints(profilePoints)
            return profilePoints
          })
          .catch(err => {
            console.warn('[Scan] Profile landmark mapping unavailable:', err?.message)
            return null
          })
          .finally(() => setSideDetectionPending(false))
      }

      // Real, on-device geometry — Apple's Vision framework measuring actual
      // detected joints/landmarks in the photos already taken above, not an
      // AI vision guess. Native-only (no-op on web, where these plugins
      // resolve { supported: false } immediately). Non-fatal by design: if
      // detection fails or confidence is too low, these stay null and the
      // AI scorer below just falls back to its own visual read — we never
      // invent a plausible-looking measurement to fill the gap.
      const sideProfileGeometryResult = (isNative() && sideB64) ? await analyzeSideProfile(sideB64) : null
      const nativeSidePoints = sideProfileGeometryResult?.detected ? profilePointsFromVision(sideProfileGeometryResult.landmarks) : null
      if (nativeSidePoints) setSideAnalysisPoints(nativeSidePoints)
      if (isNative() || !sideB64) setSideDetectionPending(false)
      const sideProfileGeometry = sideProfileGeometryResult?.detected
        ? { facialConvexityDegrees: sideProfileGeometryResult.facialConvexityDegrees ?? null }
        : null
      const frontDetection = await frontLandmarksPromise
      if (!frontDetection?.points || !frontDetection?.landmarks) throw new Error('LANDMARK DETECTION FAILED — retake a clear front photo and try again.')
      const detectedSidePoints = sideB64 ? (isNative() ? nativeSidePoints : await sideLandmarksPromise) : null
      if (sideB64 && !detectedSidePoints) throw new Error('PROFILE LANDMARK DETECTION FAILED — retake a clear side photo and try again.')
      const analysisEvidence = await buildProductionEvidence({
        frontImage: faceB64,
        frontLandmarks: frontDetection.landmarks,
        qualityGate,
        sideProfileGeometry: sideProfileGeometryResult,
      })
      setAnalysisStep(2)

      let aiResult
      if (import.meta.env.DEV) console.log('[ASCENDUS SCAN] Analysis request started')
      if (token === 'demo-token') {
        // Demo users: return mock results instead of hitting the backend
        await new Promise(r => setTimeout(r, 2500))
        // Round first, then derive tier from the SAME rounded value used for
        // overallScore — computing tier from the unrounded score can land it
        // on the wrong side of a threshold vs. the rounded score shown elsewhere.
        const demoScore = Math.round((6.8 + (Math.random() - 0.5) * 0.6) * 10) / 10
        const demoTier  = getTier(demoScore, g)
        aiResult = {
          overallScore:    demoScore,
          faceScore:       Math.round((demoScore + (Math.random() - 0.5) * 0.4) * 10) / 10,
          faceOnlyScore:   Math.round((demoScore + (Math.random() - 0.5) * 0.4) * 10) / 10,
          groomingScore:   Math.round((6.5 + Math.random()) * 10) / 10,
          tier:            demoTier.label,
          hasSideProfile:  !!sideB64,
          faceSubScores: {
            symmetry:          Math.round((6.5 + Math.random()) * 10) / 10,
            jawlineDefinition: Math.round((6.2 + Math.random()) * 10) / 10,
            skinClarity:       Math.round((7.0 + Math.random() * 0.8) * 10) / 10,
            facialProportions: Math.round((6.8 + Math.random() * 0.6) * 10) / 10,
            eyeArea:           Math.round((6.5 + Math.random()) * 10) / 10,
            facialHarmony:     Math.round((7.0 + Math.random() * 0.5) * 10) / 10,
          },
          pillars: {
            harmony:    Math.round((6.8 + Math.random()) * 10) / 10,
            angularity: Math.round((6.5 + Math.random()) * 10) / 10,
            features:   Math.round((7.0 + Math.random() * 0.8) * 10) / 10,
            dimorphism: Math.round((6.3 + Math.random()) * 10) / 10,
          },
          facialStructure:  'Oval',
          hairType:         null,
          insights: ['Demo mode. Sign up for a real account to get AI-powered analysis'],
        }
      } else {
        try {
          setScanInFlight(true)
          const lastGlowScore = scans?.[0]?.glowScore ?? null
          aiResult = await requestProductionAnalysis({
            apiClient: api,
            faceImage: faceB64,
            sideImage: sideB64,
            sideProfileGeometry,
            evidence: analysisEvidence,
            gender: g,
            previousScore: lastGlowScore,
          })
          if (presentationRef.current !== presentation) return
          setAnalysisResult(aiResult)

        } finally {
          setScanInFlight(false)
        }
      }

      if (!aiResult.analysisEvidence) aiResult.analysisEvidence = analysisEvidence
      if (!aiResult.scoreClassification) aiResult.scoreClassification = {
        overall: 'legacy_subjective_visual_assessment',
        objectiveReplacementStatus: 'not_validated',
      }

      if (!await presentation.promise || presentationRef.current !== presentation) return
      setAnalysisStep(3)
      if (import.meta.env.DEV) console.log('[ASCENDUS SCAN] Analysis response received')

      const scanRecord = {
        id:             `scan-${Date.now()}`,
        scanDate:       new Date().toISOString(),
        analyzedAt:     new Date().toISOString(),
        facePhotoUrl:   faceB64,
        sidePhotoUrl:   sideB64 ?? null,
        hasSideProfile: aiResult.hasSideProfile ?? false,
        gender:         g,
        umaxScore:      aiResult.overallScore,
        glowScore:      Math.round(aiResult.overallScore * 10) / 10,
        tier:           aiResult.tier,
        aiScore:        aiResult,
        analysisEvidence: aiResult.analysisEvidence,
        faceData: {
          aestheticScore:    aiResult.faceScore,
          pillars:           null,
          symmetry:          aiResult.faceSubScores?.symmetry          ?? null,
          jawlineDefinition: aiResult.faceSubScores?.jawlineDefinition ?? null,
          skinClarity:       aiResult.faceSubScores?.skinClarity       ?? null,
          facialProportions: aiResult.faceSubScores?.facialProportions ?? null,
          eyeArea:           aiResult.faceSubScores?.eyeArea           ?? null,
          facialHarmony:     aiResult.faceSubScores?.facialHarmony     ?? null,
        },
        pillars:          aiResult.pillars         ?? null,
        extendedMetrics:  aiResult.extendedMetrics ?? null,
        // 'pending' when the core call split extended metrics into their own
        // follow-up request (see below); absent/undefined for demo/ARKit
        // scans, which never produce extended metrics at all.
        extendedMetricsStatus: aiResult.extendedMetricsStatus ?? null,
        // Real, on-device Vision-framework geometry (side-profile landmarks)
        // — present only when detection actually succeeded with adequate
        // confidence. Same "measure, don't guess" principle as faceMetrics
        // above. (Body geometry/physique scoring intentionally no longer
        // happens here — see the Training Plan flow's own body-photo step.)
        sideProfileGeometry:  sideProfileGeometry ?? undefined,
      }

      const assignedPh = assignPhase(aiResult.faceScore, userProfile?.goal)
      const tasks = generatePlanTasks(scanRecord.faceData, scanRecord.pillars, assignedPh, g)
      setCurrentPlan({ id: `plan-${Date.now()}`, scanId: scanRecord.id, tasks, createdAt: new Date().toISOString(), weekNumber: 1 })
      if (faceB64) setPendingFacePhoto(faceB64)
      addScan(scanRecord)
      setCurrentScan(scanRecord)
      setAssignedPhase(assignedPh)
      recordProScan()

      // Mark calibration complete after first successful scan — subsequent
      // scans will use the fast local MediaPipe path instead of the AI API.
      // Also release the original capture blob URL (privacy: no longer needed).
      import('../utils/scanQuality.js').then(({ markCalibrated, releaseValidationImage }) => {
        markCalibrated()
        releaseValidationImage(facePhoto) // facePhoto may be blob: URL from camera/upload
      }).catch(() => {})

      // Fire-and-forget: run MediaPipe client-side to extract named landmarks
      // and explorer metrics for FaceMetricsExplorer on the Progress screen.
      // Non-blocking — scan completion is not gated on this.
      if (faceB64) {
        import('../utils/faceLandmarks.js')
          .then(({ getLandmarks, toExplorerLandmarks2D, computeExplorerMetrics }) =>
            getLandmarks(faceB64).then(lm => {
              const named2D   = toExplorerLandmarks2D(lm)
              const explorerM = computeExplorerMetrics(lm, g)
              if (explorerM) {
                setLastFaceScanCapture(faceB64, named2D, explorerM)
                import('../utils/scanPhotoDb.js').then(({ saveScanMedia }) =>
                  saveScanMedia(scanRecord.id, { photo: faceB64, landmarks2D: named2D, faceMetrics: explorerM })
                ).catch(() => {})
              }
            })
          )
          .catch(err => console.warn('[FaceExplorer] Landmark detection:', err.message))
      }

      // Extended metrics (30-metric breakdown) fill in a few seconds after
      // the core result — split out server-side purely for latency (core
      // call ~18s vs ~35s combined). Fire the follow-up now, non-blocking;
      // CategoryCard reads scan.extendedMetrics/.extendedMetricsStatus
      // directly from the store, so this patch alone is enough to update it
      // wherever it's rendered (ScanUnlockGate, StepScoresWaiting) once it lands.
      if (faceB64 && scanRecord.extendedMetricsStatus === 'pending') {
        api.ai.scoreExtendedMetrics({ faceImage: faceB64, gender: g })
          .then(({ extendedMetrics }) => {
            patchScanExtendedMetrics(scanRecord.id, extendedMetrics, 'ready')
          })
          .catch(err => {
            console.warn('[Scan] Extended metrics follow-up failed (non-fatal):', err?.message)
            patchScanExtendedMetrics(scanRecord.id, null, 'failed')
          })
      }

      // Persist to Supabase (non-blocking). Upload the real scan photo to
      // Supabase Storage first (private 'scan-images' bucket, already wired
      // up server-side but never actually called until now) so the scan
      // row's face_image_url is a real storage path, not empty — this is
      // what powers Scan History thumbnails / Before-After on the Progress
      // page across app restarts, instead of relying on localStorage (which
      // deliberately strips photo data URLs to avoid a quota crash).
      // For a Live-Face-Scan-only capture (no separate static photo taken),
      // faceB64 is null but the AR capture's own photo is still available
      // via lastFaceScanImage — fall back to that so ARKit-only scans still
      // get a real thumbnail.
      ;(async () => {
        let faceImageUrl = null
        const photoForUpload = faceB64
        if (photoForUpload) {
          try {
            const commaIdx = photoForUpload.indexOf(',')
            const header = commaIdx >= 0 ? photoForUpload.slice(0, commaIdx) : ''
            const base64Data = commaIdx >= 0 ? photoForUpload.slice(commaIdx + 1) : photoForUpload
            const mediaType = /image\/(jpeg|png|webp)/.exec(header)?.[0] || 'image/jpeg'
            const uploadResult = await api.supabase.uploadImage({ imageData: base64Data, mediaType, folder: 'face' })
            faceImageUrl = uploadResult?.path || null
          } catch (err) {
            console.warn('[Scan] Photo upload to Supabase Storage failed (non-fatal):', err?.message)
          }
        }

        api.supabase.saveScan({
          overallScore:     aiResult.overallScore,
          tier:             aiResult.tier,
          faceScore:        aiResult.faceScore,
          groomingScore:    aiResult.groomingScore,
          harmony:          aiResult.pillars?.harmony,
          angularity:       aiResult.pillars?.angularity,
          features:         aiResult.pillars?.features,
          dimorphism:       aiResult.pillars?.dimorphism,
          potentialScore:   Math.min(10, (aiResult.overallScore ?? 5) + 1.4),
          hairTypeDetected: aiResult.hairType,
          faceShape:        aiResult.facialStructure,
          faceImageUrl,
          gender:           g,
          assignedPhase:    assignedPh?.toLowerCase(),
          tasks,
        }).catch(() => {})
      })()

      setLastScanDate(new Date().toISOString())
      incrementScanCount()
      // The real score may arrive before the user's measured landmarks and
      // visual callouts have appeared. Wait for that sequence, bounded in
      // case a device cannot run the landmark model.
      setAnalysisStep(4)
      // Schedule rescan notification (14 days for free, 0 = cancelled for Pro)
      scheduleRescanNotification(isPremium ? 0 : 14).catch(() => {})

      navigate(isPremium ? '/results' : '/unlock', { replace: true, state: { scanCelebration: true } })
    } catch (err) {
      if (presentationRef.current !== presentation) return
      presentation.finish(false)
      console.error('[Scan] startAnalysis error:', err?.message, err?.stack)
      if (err.message === 'hourly_cap_reached' || err.errorCode === 'hourly_cap_reached') {
        setScanCapPlan(err.plan || 'free')
        setScanCapReached(true)
        setStep(2)
      } else if (err.errorCode === 'claude_rate_limited') {
        // User hit their own hourly Claude limit — retrying in 30s won't help.
        // Show a static "limit reached" card instead of an auto-retry countdown.
        setClaudeRateLimited(true)
        setStep(2)
      } else {
        // IMPORTANT: only trust err.status/err.errorCode here, both of which are
        // exclusively set by api.js's request() helper when parsing a REAL HTTP
        // response from our backend (see utils/api.js). Do NOT substring-match
        // err.message against words like "exceeded"/"capacity"/"quota" — that
        // used to catch unrelated client-side errors too (e.g. a browser
        // QuotaExceededError from localStorage being full contains the word
        // "exceeded" and was getting shown as "Claude is rate limited", which
        // was flat-out wrong and sent debugging down the wrong path for hours).
        const isRateLimit = err.errorCode === 'rate_limited' || err.status === 429
        const isStorageQuotaError = err.name === 'QuotaExceededError'
          || (err.message || '').toLowerCase().includes('quota') && err.status === undefined

        if (isRateLimit) {
          const cd = err.retryAfter || 30
          rateLimitInitial.current = cd
          setRateLimited(true)
          setRetryCountdown(cd)
        } else if (isStorageQuotaError) {
          // The analysis itself may have already succeeded server-side — this
          // fires when saving the result locally fails, not when scoring fails.
          console.error('[Scan] Local storage full while saving scan result:', err.message)
          setError('Your device storage for this app is full. Try clearing some scan history, or reinstalling the app.')
        } else if (err.errorCode === 'analysis_quality_failed') {
          // Geometry/pose check failed — route to quality-fail screen with the specific reason
          const reason = err.analysisEvidence?.reason ?? 'excessive_yaw'
          navigate('/scan/quality-fail', { state: { issues: [{ code: reason, severity: 'high' }], photoUrl: facePhoto } })
        } else {
          setError(err.message || 'Analysis failed. Please try again.')
        }
        setStep(2)
      }
    } finally {
      clearTimeout(slowTimer)
      setSlowAnalysis(false)
      setMorphing(false)
    }
  }

  startAnalysisRef.current = startAnalysis

  const isAnalyzing = step === 3

  if (showConsent) {
    return (
      <AIConsentModal
        onAgree={() => setShowConsent(false)}
        onDecline={() => window.history.back()}
      />
    )
  }

  return (
    <div className="flex flex-col h-full bg-page">
      <Helmet>
        <title>AI Face Rating &amp; Looksmax Scan | Ascendus</title>
        <meta name="description" content="Upload your photo for an instant AI face rating and personalized improvement plan. Get your free looksmax scan in under 60 seconds." />
        <meta name="keywords" content="face rating, AI face scan, looksmax scanner, appearance score, face analyzer, glow up scan" />
      </Helmet>

      {/* Header — steps 1 and 2 (Face Photo, Side Profile) render the exact
          same markup (only the title text differs), so the two screens are
          guaranteed pixel-identical rather than two separately hand-tuned
          copies that can drift apart. Step 0 (gender select) is the only
          one still using PageHeader. */}
      {!isAnalyzing && (
        (step === 1 || step === 2) ? (
          // Ported from PremiumOnboarding.jsx's PhotoStepScreen (its BackBtn +
          // "STEP X OF 3" tag + big headline treatment) instead of this
          // screen's old smaller inline chevron+title row, using this file's
          // own theme-aware tokens (var(--card)/var(--border)/text-primary)
          // rather than onboarding's hardcoded always-dark colors, since this
          // screen (unlike onboarding) supports light mode too.
          <div className="relative flex-shrink-0 px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)', paddingBottom: 16 }}>
            <button
              onClick={() => {
                triggerHaptic()
                if (transitioning) { setTransitioning(false); setFacePhoto(null); setStep(1) }
                else if (cameraOpen) { setCameraOpen(false) }
                else if (previewPhoto) { setPreviewPhoto(null); setCameraOpen(true) }
                else if (step === 2) { setFacePhoto(null); setStep(1) }
                else { setScanLaunching(true); navigate(-1) }
              }}
              aria-label="Go back"
              className="absolute left-4 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
            >
              <ChevronLeft size={18} className="text-primary" />
            </button>
            <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: GOLD }}>
              STEP {step === 1 ? '1' : '2'} OF 2
            </p>
            <h1 className="font-heading font-bold text-[26px] leading-tight text-primary" style={{ letterSpacing: '-0.02em' }}>
              {step === 1 ? 'Take your front photo' : 'Now, your side profile'}
            </h1>
          </div>
        ) : (
          <PageHeader
            title="Select Gender"
            subtitle="For accurate Overall Rating results"
            back
            onBack={() => navigate('/scan')}
          />
        )
      )}

      {/* Content */}
      <div className={`flex-1 ${isAnalyzing ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="gender" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <GenderSelector selected={gender} onSelect={setLocalGender} onAdvance={() => setStep(1)} />
            </motion.div>
          )}
          {(step === 1 || step === 2) && !cameraOpen && !previewPhoto && (
            <motion.div key={`guide-${step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col items-center justify-center px-6" style={{ overflow: 'visible' }}>
              {step === 1 ? (
                <div className="w-full rounded-2xl" style={{ aspectRatio: '4/5', overflow: 'visible', position: 'relative', zIndex: 5, marginTop: '-24px', paddingTop: '24px' }}>
                  <img
                    src={gender === 'female' ? faceGuidePhotoFemale : faceGuidePhoto}
                    alt="Guide"
                    className="w-full h-full object-cover rounded-2xl"
                    style={{
                      transform: 'scale(1.05) translateY(16px)',
                      transformOrigin: 'center bottom',
                      objectPosition: 'center bottom',
                      position: 'relative',
                      zIndex: 5,
                      mixBlendMode: 'lighten',
                    }}
                  />
                </div>
              ) : (
                <div className="w-full rounded-2xl" style={{ aspectRatio: '4/5', overflow: 'visible', position: 'relative', zIndex: 5, marginTop: '-24px', paddingTop: '24px' }}>
                  <img
                    src={gender === 'female' ? sideProfileGuideFemale : sideProfileGuide}
                    alt="Guide"
                    className="w-full h-full object-cover rounded-2xl"
                    style={{
                      transform: 'scale(1.1) translateY(34px)',
                      transformOrigin: 'center bottom',
                      objectPosition: 'center bottom',
                      position: 'relative',
                      zIndex: 5,
                      mixBlendMode: 'lighten',
                    }}
                  />
                </div>
              )}
            </motion.div>
          )}
          {(step === 1 || step === 2) && previewPhoto && (
            <motion.div
              key={`preview-${step}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex flex-col"
              style={{ background: '#000' }}
            >
              {/* Photo fills all space above the buttons */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <img src={previewPhoto.url} alt="Your photo" className="w-full h-full object-cover" />
              </div>
              {/* Both buttons pinned at the bottom */}
              <div
                className="flex-shrink-0 flex flex-col gap-3 px-5"
                style={{ paddingTop: 14, paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))' }}
              >
                <button
                  onClick={() => { triggerHaptic(); setPreviewPhoto(null); if (previewPhoto.source !== 'library') setCameraOpen(true) }}
                  className="w-full py-4 rounded-2xl font-heading font-bold text-[16px]"
                  style={{ background: 'transparent', border: `1.5px solid ${GOLD}`, color: GOLD }}
                >
                  Use Another
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    triggerHaptic()
                    const { url, forStep } = previewPhoto
                    if (forStep === 1) {
                      transitionToSide(url)
                    } else {
                      setTransitioning(true)
                      setSidePhoto(url); setError(''); setCameraOpen(false)
                      setTimeout(() => {
                        setPreviewPhoto(null)
                        setStep(3)
                        // Kept on through startAnalysisRef firing (not hidden
                        // right after setStep(3)) — AnalyzingScreen's own scan
                        // animation needs real data (photo, points, etc.) to
                        // look right; dropping the processing cover before
                        // that data exists showed its bare/incomplete initial
                        // render for a beat, which read as a choppy stutter.
                        setTimeout(() => {
                          startAnalysisRef.current?.()
                          setTransitioning(false)
                        }, 50)
                      }, 300)
                    }
                  }}
                  className="w-full py-4 rounded-2xl font-heading font-bold text-[16px]"
                  style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
                >
                  Continue
                </motion.button>
              </div>
            </motion.div>
          )}
          {isAnalyzing && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <AnalyzingScreen currentStep={analysisStep} slow={slowAnalysis} photo={facePhoto} sidePhoto={sidePhoto} morphing={morphing} points={analysisPoints} sidePoints={sideAnalysisPoints} rawLandmarks={analysisLandmarks} sideRawLandmarks={sideAnalysisLandmarks} meshPathD={meshPathD} scanResult={analysisResult} sideDetectionPending={sideDetectionPending} onPresentationComplete={() => presentationRef.current?.finish()} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Camera overlay — own independent AnimatePresence + portal, escapes Layout's
          swipe-back transform (see CameraOverlay/portal comment history). Kept OUT of
          the step-switching AnimatePresence above: a bare createPortal() as one of
          several keyed children there confused its mode="wait" child-key tracking and
          silently kept CameraOverlay from ever mounting. */}
      {createPortal(
        <AnimatePresence>
          {/* No entrance fade — CameraOverlay is fully opaque from its very
              first frame (header/gutters/processing-backing all solid), so
              fading it in only risked exposing a transitional glimpse of
              whatever's behind before #root finished hiding. Exit still
              fades, for a smooth close. */}
          {(step === 1 || step === 2) && cameraOpen && (
            <motion.div key={`cam-${step}`} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <CameraOverlay
                stepNum={step}
                gender={gender}
                onCapture={(url, blob) => {
                  triggerHaptic()
                  if (step === 1) {
                    transitionToSide(url)
                  } else {
                    setTransitioning(true)
                    setSidePhoto(url); setError(''); setCameraOpen(false)
                    setTimeout(() => {
                      setStep(3)
                      // Kept on through startAnalysisRef firing — see the
                      // matching comment on the other setSidePhoto call site.
                      setTimeout(() => {
                        startAnalysisRef.current?.()
                        setTransitioning(false)
                      }, 50)
                    }, 300)
                  }
                }}
                onClose={() => setCameraOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Processing overlay — shown between front face confirm → side profile, and side confirm → analyzing */}
      <AnimatePresence>
        {transitioning && (
          <ProcessingOverlay
            key="scan-transition"
            label="Processing"
          />
        )}
      </AnimatePresence>

      {/* Scan-cap upgrade modal */}
      {scanCapReached && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setScanCapReached(false)}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #C6A85C, #F5A623)' }} />
            <div className="px-6 pt-6 pb-7 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(201,168,76,0.12)' }}><Lock size={28} style={{ color: '#C6A85C' }} /></div>
              <div>
                <h3 className="font-heading font-bold text-lg text-primary leading-snug">
                  {scanCapPlan === 'demo' ? 'Demo scan limit reached' : 'Free scan limit reached'}
                </h3>
                <p className="text-sm text-secondary font-body mt-2 leading-relaxed">
                  {scanCapPlan === 'demo'
                    ? 'Create a free account to get more scans, or upgrade to Pro for unlimited access.'
                    : "You've used your free scan for this month. Upgrade to Pro for unlimited scans."}
                </p>
              </div>
              <button onClick={() => { setScanCapReached(false); navigate('/premium') }} className="btn-amber w-full">Upgrade to Pro</button>
              <button
                onClick={() => setScanCapReached(false)}
                className="w-full py-3 text-sm font-heading font-bold text-secondary active:opacity-60 transition-opacity"
              >
                No thanks
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Claude hourly limit — static message, no countdown loop */}
      {claudeRateLimited && (
        <div className="px-4 pb-2">
          <div className="flex flex-col items-center gap-3 px-4 py-4 rounded-2xl border text-center"
            style={{ background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.3)' }}>
            <p className="text-sm font-heading font-bold text-primary">Analysis limit reached</p>
            <p className="text-xs text-secondary font-body">You've used all your AI scans for this hour. Try again in a few minutes, or upgrade to Pro for higher limits.</p>
            <div className="flex gap-2 w-full">
              <button onClick={() => { setClaudeRateLimited(false); setStep(1) }}
                className="flex-1 text-xs font-heading font-bold px-4 py-2 rounded-xl active:opacity-70 transition-opacity"
                style={{ background: 'rgba(201,168,76,0.18)', color: '#C6A85C' }}>
                Try Again
              </button>
              <button onClick={() => navigate('/premium')}
                className="flex-1 text-xs font-heading font-bold px-4 py-2 rounded-xl active:opacity-70 transition-opacity"
                style={{ background: 'rgba(201,168,76,0.35)', color: '#C6A85C' }}>
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate-limit countdown ring */}
      {rateLimited && (
        <div className="px-4 pb-2">
          <div className="flex flex-col items-center gap-3 px-4 py-4 rounded-2xl border"
            style={{ background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.3)' }}>
            <div className="relative w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="#C6A85C" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (retryCountdown / rateLimitInitial.current)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-heading font-bold text-lg" style={{ color: '#C6A85C' }}>{retryCountdown}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-heading font-bold text-primary">High demand right now</p>
              <p className="text-xs text-secondary font-body mt-0.5">Auto-retrying in {retryCountdown}s…</p>
            </div>
            <button onClick={() => { setRateLimited(false); startAnalysisRef.current?.() }}
              className="text-xs font-heading font-bold px-5 py-2 rounded-xl active:opacity-70 transition-opacity"
              style={{ background: 'rgba(201,168,76,0.18)', color: '#C6A85C' }}>
              Retry Now
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !rateLimited && (
        <div className="px-4 pb-2">
          <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-warning flex-shrink-0" />
              <p className="text-sm text-warning font-body flex-1">{error}</p>
              <button onClick={() => setError('')} className="ml-1 flex-shrink-0 opacity-50 hover:opacity-100"><X size={14} className="text-warning" /></button>
            </div>
            <button
              onClick={() => { setError(''); startAnalysisRef.current?.() }}
              className="w-full text-sm font-heading font-bold py-2 rounded-xl active:opacity-70 transition-opacity"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
              Try Again
            </button>
            {(error.includes('Session expired') || error.includes('Invalid or expired')) && (
              <button
                onClick={() => { logout?.(); navigate('/auth') }}
                className="w-full text-xs font-heading font-semibold py-1.5 rounded-xl opacity-70 active:opacity-50"
                style={{ color: '#EF4444' }}>
                Sign out &amp; sign in again
              </button>
            )}
          </div>
        </div>
      )}

      <input ref={libraryInputRef} type="file" accept="image/*" className="hidden" aria-label="Choose a scan photo" onChange={e => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) { setError(''); setPreviewPhoto({ url: URL.createObjectURL(file), forStep: step, source: 'library' }) }
      }} />
      <AnimatePresence>
        {showScanSource && <PhotoActionSheet onClose={() => setShowScanSource(false)} options={[
          { label: 'Take Photo', icon: Camera, onSelect: async () => {
            setShowScanSource(false)
            if (isNative()) {
              try { await CapacitorCamera.requestPermissions({ permissions: ['camera'] }) } catch {}
            }
            setCameraOpen(true)
          } },
          { label: 'Add Photo', icon: Upload, onSelect: () => { setShowScanSource(false); addPhoto() } },
        ]} />}
      </AnimatePresence>
      {/* CTAs — pinned at bottom, same position/size on every step */}
      {!isAnalyzing && !cameraOpen && !previewPhoto && (
        <div className="flex-shrink-0 px-6" style={{ paddingTop: 8, paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))' }}>
          {(step === 1 || step === 2) && (
            <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { triggerHaptic(); setShowScanSource(true) }}
              className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
              style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
            >
              Begin Scan
            </motion.button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
