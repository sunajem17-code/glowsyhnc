import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, CheckCircle2, Loader2, AlertCircle, X, RefreshCw, SkipForward, Lock, Gift, Target, Star, Zap, Map, ChevronLeft } from 'lucide-react'
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
import { analyzeSideProfile } from '../utils/photoGeometry'
import { scheduleRescanNotification } from '../utils/notifications'
import { FirebaseAnalytics } from '@capacitor-firebase/analytics'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import ProcessingOverlay from '../components/ProcessingOverlay'

// No-op on web — no native bridge, and no web Firebase app configured yet either.
async function logAnalyticsEvent(name, params) {
  if (!isNative()) return
  try {
    await FirebaseAnalytics.logEvent({ name, params })
  } catch {
    // analytics unavailable — not fatal, ignore
  }
}

export const ANALYSIS_STEPS = [
  { label: 'Finding your strengths...', Icon: Target },
  { label: 'Calculating your score...', Icon: Zap },
  { label: 'Building your roadmap...', Icon: Map },
]

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

// ─── Live Camera Overlay ──────────────────────────────────────────────────────

function CameraOverlay({ stepNum, onCapture, onClose, gender }) {
  const videoRef    = useRef()
  const canvasRef   = useRef()
  const uploadRef   = useRef()
  const streamRef   = useRef()
  const [ready, setReady]         = useState(false)
  const [facingMode, setFacingMode] = useState('user')
  const [error, setError]         = useState('')
  const [capturedUrl, setCapturedUrl] = useState(null) // null = live camera, string = captured photo

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    setReady(false)
    try {
      // Request highest available resolution — mobile cameras will cap naturally
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setReady(true)
      }
    } catch {
      setError('Camera access denied. Please allow camera permission and try again.')
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [facingMode, startCamera])

  function capture() {
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
    // Re-fetch blob from the object URL for the onCapture callback
    fetch(capturedUrl).then(r => r.blob()).then(blob => onCapture(capturedUrl, blob))
  }

  function handleRetake() {
    if (capturedUrl) { URL.revokeObjectURL(capturedUrl); setCapturedUrl(null) }
    // Resume the paused video so live preview continues
    if (videoRef.current) videoRef.current.play().catch(() => {})
    // If stream was stopped (e.g. Continue was pressed then back), restart
    if (!streamRef.current || streamRef.current.getTracks().every(t => t.readyState === 'ended')) {
      startCamera(facingMode)
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
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      {/* Header */}
      <div style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <button
          onClick={() => {
            if (capturedUrl) { handleRetake() }
            else { streamRef.current?.getTracks().forEach(t => t.stop()); onClose() }
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
      <div style={{ flex: 1, padding: '0 16px', minHeight: 0 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 20, overflow: 'hidden', position: 'relative', background: '#111' }}>
          {error ? (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
              <AlertCircle size={40} className="text-warning" />
              <p className="text-white text-sm font-body">{error}</p>
              <button onClick={onClose} className="px-6 py-3 bg-white/10 rounded-2xl text-white text-sm font-heading font-bold">Go Back</button>
            </div>
          ) : (
            <>
              {/* Video always renders — paused after capture to show freeze-frame.
                  Keep scaleX(-1) even when paused so the frozen frame matches what
                  the user saw live. Canvas capture applies the same flip so the
                  saved image is correctly oriented. */}
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
              {!ready && !capturedUrl && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={36} className="text-white animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Buttons */}
      {!error && (
        <div style={{ padding: '12px 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => { triggerHaptic(); capturedUrl ? handleContinue() : capture() }}
            disabled={!capturedUrl && !ready}
            style={{
              width: '100%', padding: '18px 0', borderRadius: 50,
              background: GOLD_GRADIENT, border: 'none', cursor: 'pointer',
              color: '#000', fontWeight: 700, fontSize: 18, fontFamily: 'inherit',
              opacity: (!capturedUrl && !ready) ? 0.5 : 1,
              boxShadow: '0 4px 24px rgba(198,168,92,0.35)',
            }}
          >
            {capturedUrl ? 'Continue' : 'Take Photo'}
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      <input ref={uploadRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
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
    cameraInFlight.current = true
    try {
      if (isNative()) {
        const dataUrl = await takePhoto()
        if (dataUrl) onPhoto(dataUrl, dataUrl)
      } else {
        setCameraOpen(true)
      }
    } catch (err) {
      if (!err?.message?.includes('cancel') && !err?.message?.includes('Cancel')) {
        setError('Camera error: ' + (err?.message || 'Unknown error'))
      }
    } finally {
      cameraInFlight.current = false
    }
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
        {cameraOpen && (
          <CameraOverlay stepNum={stepNum} onCapture={(url, blob) => { setCameraOpen(false); onPhoto(url, blob) }} onClose={() => setCameraOpen(false)} gender={gender} />
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
      {cameraOpen && (
        <CameraOverlay stepNum={stepNum} onCapture={(url, blob) => { setCameraOpen(false); onPhoto(url, blob) }} onClose={() => setCameraOpen(false)} gender={gender} />
      )}

      {/* Preview / placeholder — pointer-events-none so nothing inside can block the buttons below.
          Steps 1 and 2 share the same near-full-width frame shape/border/glow,
          but step 1's aspect ratio is intentionally 4/5 (not 3/4 like step 2)
          — see the object-fit: cover + object-position: bottom comment below
          for why this specific ratio matters there. */}
      <div
        className={`relative w-full ${stepNum === 1 ? 'aspect-[4/5]' : 'aspect-[3/4]'} rounded-2xl overflow-hidden flex items-center justify-center mt-2 mb-4 pointer-events-none`}
        style={{
          background: '#000000',
          // Step 1 (face photo) keeps the gold frame; step 2 (side profile) is borderless.
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
            style={{ objectFit: 'cover', objectPosition: 'center top' }}
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
            style={{ objectFit: 'cover', objectPosition: 'center bottom' }}
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

export const ANALYSIS_STEP_LABELS = [
  'Detecting facial symmetry...',
  'Measuring jawline angle & ramus height...',
  'Evaluating canthal tilt & eye canopy...',
  'Analyzing lower third proportions...',
  'Finalizing facial matrix...',
]

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
  cheekL: 234, cheekR: 454,
  jawL: 172, jawR: 397, jawMidL: 136, jawChinL: 148, jawMidR: 365, jawChinR: 378,
  eyeOuterL: 33, eyeOuterR: 263, eyeInnerL: 133, eyeInnerR: 362,
  templeL: 127, templeR: 356,
  mouthL: 61, mouthR: 291,
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

// Seven metrics with real backing data, positioned in fixed facial zones.
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
    pos: { top: '32%', left: '70%' },
    // Geometry: outer corner angle relative to inner corner, averaged L+R
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const deg = _canthalTiltDeg(pts)
      return deg >= 3 ? 'Strong' : deg >= 1 ? 'Moderate' : deg >= 0 ? 'Neutral' : 'Negative Tilt'
    },
  },
  {
    id: 'orbital',
    title: 'ORBITAL VECTOR',
    pos: { top: '32%', left: '30%' },
    // API: eye area sub-score (shape, spacing, periorbital hollowing)
    valueFn: (_pts, scan) => {
      const s = scan?.faceSubScores?.eyeArea
      if (s == null) return '—'
      return s >= 7.5 ? 'Favorable' : s >= 5.5 ? 'Neutral' : 'Suboptimal'
    },
  },
  {
    id: 'nasal',
    title: 'NASAL BRIDGE',
    pos: { top: '45%', left: '50%' },
    // Geometry: intercanthal / bizygomatic ratio
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
    id: 'zygomatic',
    title: 'ZYGOMATIC ARCH',
    pos: { top: '48%', left: '75%' },
    // Geometry: bizygomatic / bigonial ratio
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
    id: 'bigonial',
    title: 'BIGONIAL BREADTH',
    pos: { top: '62%', left: '72%' },
    // Geometry: jaw width (bigon) relative to cheekbone width (bizygo)
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const bigon  = Math.abs(pts.jawR.x   - pts.jawL.x)
      const bizygo = Math.abs(pts.cheekR.x - pts.cheekL.x)
      if (bizygo < 0.01) return '—'
      const ratio = bigon / bizygo
      return ratio > 0.90 ? 'Wide' : ratio > 0.80 ? 'Balanced' : ratio > 0.70 ? 'Tapered' : 'Narrow'
    },
  },
  {
    id: 'mandible',
    title: 'MANDIBULAR ANGLE',
    pos: { top: '68%', left: '30%' },
    // Geometry: gonial angle from jaw/temple/chin landmark triangle
    valueFn: (pts, _scan) => {
      if (!pts) return '—'
      const deg = _gonialAngleDeg(pts)
      return deg < 115 ? 'Very Sharp' : deg < 122 ? 'Sharp' : deg < 130 ? 'Balanced' : 'Rounded'
    },
  },
]

const LABEL_CYCLE_MS = 850

// Chip for a single anatomy metric. Rendered by FacialAnalysisOverlay's
// AnimatePresence — this component itself has no animation wrapper.
// Horizontal clamp uses 115px (> half of maxWidth 220px) so the chip body
// never clips the frame edge. Vertical uses 60px top / 100px bottom.
function AnatomyLabel({ title, value, pos }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.8 }}
      className="absolute pointer-events-none"
      style={{
        left: `clamp(115px, ${pos.left}, calc(100% - 115px))`,
        top: `clamp(60px, ${pos.top}, calc(100% - 100px))`,
        transform: 'translate(-50%, -50%)',
        minWidth: 172,
        maxWidth: 220,
      }}
    >
      <div style={{
        background: 'rgba(0,0,0,0.88)',
        border: `1px solid ${LANDMARK_GOLD}55`,
        borderRadius: 10,
        padding: '8px 16px',
        textAlign: 'center',
        backdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.13em',
          color: LANDMARK_GOLD, fontFamily: 'monospace', textTransform: 'uppercase',
          lineHeight: 1.3,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.04em',
          color: 'rgba(255,255,255,0.68)', fontFamily: 'monospace',
          lineHeight: 1.4, marginTop: 3,
        }}>
          {value}
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

function FacialAnalysisOverlay({ step, points, scanResult }) {
  const [labelIdx, setLabelIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setLabelIdx(i => (i + 1) % ANATOMY_LABELS.length), LABEL_CYCLE_MS)
    return () => clearInterval(id)
  }, [])

  const label = ANATOMY_LABELS[labelIdx]
  const value = points ? label.valueFn(points, scanResult) : '—'

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
          value={value}
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
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {photo && (
        <>
          <motion.img
            src={photo} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ mixBlendMode: 'screen', filter: 'sepia(1) saturate(4) hue-rotate(-25deg)' }}
            initial={{ x: 0, opacity: 0 }}
            animate={{ x: [0, -3, 2, 0], opacity: [0, 0.5, 0.5, 0] }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
          <motion.img
            src={photo} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ mixBlendMode: 'screen', filter: 'saturate(4) hue-rotate(180deg)' }}
            initial={{ x: 0, opacity: 0 }}
            animate={{ x: [0, 3, -2, 0], opacity: [0, 0.5, 0.5, 0] }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
          <motion.img
            src={photo} alt="" className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1, filter: 'blur(0px) brightness(0.5)' }}
            animate={{ scale: [1, 1.06, 0.99, 1], filter: ['blur(0px) brightness(0.5)', 'blur(6px) brightness(1.1)', 'blur(2px) brightness(0.8)', 'blur(0px) brightness(0.9)'] }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
        </>
      )}
      <motion.div
        className="absolute inset-0"
        style={{ background: LANDMARK_GOLD, mixBlendMode: 'overlay' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 0.9, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

const MESH_CYAN = '#4DE8E0'
const MESH_GLOW = 'rgba(77, 232, 224, 0.85)'

// One-time ~3.4s "mesh lock-on" beat that plays as soon as real landmarks
// resolve (see startAnalysis) — a dense wireframe (buildMeshPathD, above)
// fades in over the real detected face, a bright line sweeps top-to-bottom
// across it once, then it fades out and the normal gold step-by-step
// overlay (already running underneath the whole time) is what's left.
// Cyan rather than gold specifically so this reads as its own distinct
// "tracking locked" moment instead of blending into that later sequence.
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

// The user's real captured photo with the step-synced landmark overlay above
// (FacialAnalysisOverlay) — replaces the earlier generic sweep-line/dot-mesh
// versions entirely. Purely visual; onScanComplete-equivalent completion in
// startAnalysis is still gated on the real API result, never on this timer
// (see the minDisplayPromise wiring there). `morphing` plays MorphWarpOverlay
// once, right before Scan.jsx navigates away to results/unlock.
// No forced aspectRatio/object-cover on the base photo — same fix as
// FaceMetricsExplorer.jsx (see its comment): the overlay's landmark dots
// are positioned as a straight % of this box's width/height, which only
// lines up with the real face if this box IS the photo's actual aspect
// ratio. A fixed 2:3 crop was silently shifting every point off the face
// for any photo shaped differently than that (which is most of them) —
// exactly the "not on the person's face" bug this fixes. `aspectRatio`
// only kicks in as a fallback for the (normally unreachable) case where
// there's no photo yet, so the box doesn't collapse to zero height.
function AnalyzingSweepOverlay({ photo, step, morphing, points, meshPathD, scanResult }) {
  return (
    <div
      className="relative w-full rounded-3xl overflow-hidden mb-5"
      style={{ background: '#0a0a0a', ...(photo ? {} : { aspectRatio: '2/3' }) }}
    >
      {photo && (
        <img
          src={photo}
          alt=""
          className="block w-full h-auto"
          style={{ filter: 'brightness(0.5) saturate(0.85)' }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.65) 100%)' }}
      />
      {/* Subtle background grid — h/v lines at low opacity, per SwiftUI ref */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(198,168,92,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(198,168,92,0.05) 1px, transparent 1px)`,
          backgroundSize: '20% 12.5%',
        }}
      />
      <AnimatePresence>
        {morphing ? <MorphWarpOverlay key="morph" photo={photo} /> : <FacialAnalysisOverlay key="overlay" step={step} points={points} scanResult={scanResult} />}
      </AnimatePresence>
      {/* Plays once, on top of whichever step is currently showing, the
          moment the real mesh is ready — see FaceMeshScanOverlay. Suppressed
          during the final morph flourish since by then it's long finished
          its one 3.4s pass anyway; this just guards against any overlap. */}
      {!morphing && <FaceMeshScanOverlay pathD={meshPathD} />}
      {/* Continuous ping-pong scan laser — runs independently of step system */}
      {!morphing && (
        <motion.div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${LANDMARK_GOLD}cc 30%, ${LANDMARK_GOLD} 50%, ${LANDMARK_GOLD}cc 70%, transparent)`,
            boxShadow: `0 0 8px 2px ${LANDMARK_GOLD}55`,
          }}
          animate={{ top: ['2%', '98%'] }}
          transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
        />
      )}
    </div>
  )
}

// Maps currentStep (0–4) to a fill percentage for the progress bar.
// Steps 1–3 are timer-driven (setInterval every 1800ms) — simulated progress.
// Step 3 is set when the API call actually completes — the only real signal.
const STEP_PROGRESS_PCT = [5, 20, 50, 80, 95]

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

export function AnalyzingScreen({ currentStep, slow, photo, morphing = false, points = null, meshPathD = null, scanResult = null }) {
  const stepIndex = Math.min(currentStep, 4)
  const progressPct = STEP_PROGRESS_PCT[stepIndex]

  // Diagnostic feed — cycles through sub-score lines once real result arrives
  const diagLines = useMemo(() => buildDiagnosticLines(scanResult), [scanResult])
  const [feedIdx, setFeedIdx] = useState(0)
  useEffect(() => {
    if (!diagLines.length) return
    setFeedIdx(0)
    const id = setInterval(() => setFeedIdx(i => (i + 1) % diagLines.length), 1300)
    return () => clearInterval(id)
  }, [diagLines])

  // Score ticker — rapidly cycles from 0 to real score over ~1.2s then settles
  const targetScore = scanResult?.overallScore ?? null
  const [displayScore, setDisplayScore] = useState(null)
  useEffect(() => {
    if (targetScore == null) return
    let current = 0
    const steps = 28
    const increment = targetScore / steps
    const intervalMs = 1200 / steps
    setDisplayScore(0)
    let count = 0
    const id = setInterval(() => {
      count++
      if (count >= steps) {
        setDisplayScore(targetScore)
        clearInterval(id)
      } else {
        current += increment
        setDisplayScore(Math.round(current * 10) / 10)
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [targetScore])

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <AnalyzingSweepOverlay photo={photo} step={currentStep} morphing={morphing} points={points} meshPathD={meshPathD} scanResult={scanResult} />

      {/* Status text — two-tier hierarchy per SwiftUI reference:
          small all-caps label (static) + cycling step text beneath */}
      <p
        className="font-mono text-center mb-1"
        style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: `${GOLD}99`, textTransform: 'uppercase' }}
      >
        MAPPING FACIAL MATRIX
      </p>
      <div className="h-5 mb-2 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p key={stepIndex} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-xs font-body"
            style={{ color: slow ? GOLD : 'var(--text-secondary)' }}
          >
            {ANALYSIS_STEP_LABELS[stepIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Real-time diagnostic feed — appears once sub-scores arrive */}
      <div className="h-4 mb-3 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          {diagLines.length > 0 && (
            <motion.p
              key={feedIdx}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.25 }}
              className="font-mono text-center"
              style={{ fontSize: 9, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)' }}
            >
              {'> '}{diagLines[feedIdx]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar — pill outline with inset gold fill.
          Fill amount is simulated (timer-driven steps); step 3 fill is tied
          to the actual API call completing. No percentage shown. */}
      <div className="w-full" style={{
        height: 36,
        borderRadius: 999,
        border: `2px solid ${GOLD}`,
        padding: 4,
        background: 'transparent',
        boxSizing: 'border-box',
      }}>
        <motion.div
          style={{
            height: '100%',
            borderRadius: 999,
            background: GOLD,
            originX: 0,
          }}
          initial={{ width: '5%' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>

      {/* Score ticker reveal — appears once result arrives, number cycles to real score */}
      <div className="h-8 mt-3 flex items-center justify-center">
        <AnimatePresence>
          {displayScore != null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-baseline gap-1.5"
            >
              <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: `${GOLD}77`, textTransform: 'uppercase' }}>SCORE</span>
              <span
                className="font-heading font-bold tabular-nums"
                style={{ fontSize: 22, color: GOLD, letterSpacing: '-0.02em', lineHeight: 1 }}
              >
                {displayScore.toFixed(1)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
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
  const navigate = useNavigate()
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

  const [step, setStep]                   = useState(1) // skip gender step — already collected in onboarding
  const [cameraOpen, setCameraOpen]        = useState(false) // false = show guide screen, true = camera live
  const [showPhotoChoice, setShowPhotoChoice] = useState(false) // bottom sheet: take vs upload
  const [previewPhoto, setPreviewPhoto]    = useState(null)  // {url, blob, forStep} — shown after capture for confirm/retake
  const [gender, setLocalGender]          = useState(savedGender ?? null)
  const [facePhoto, setFacePhoto]         = useState(null)
  const [sidePhoto, setSidePhoto]         = useState(null)
  const [analysisStep, setAnalysisStep]   = useState(0)
  const [slowAnalysis, setSlowAnalysis]   = useState(false)
  // Drives the ~900ms morph-warp flourish (MorphWarpOverlay, in
  // AnalyzingSweepOverlay) that plays over the finished photo right before
  // handing off to results/unlock — see startAnalysis, just above its
  // navigate() call.
  const [morphing, setMorphing]           = useState(false)
  const [transitioning, setTransitioning] = useState(false) // brief overlay between preview→analyze
  // Real MediaPipe face-landmark points for THIS scan's photo, used to
  // position FacialAnalysisOverlay's lines/dots/readouts on the actual
  // detected face — see startAnalysis, which kicks off detection the
  // instant the analyzing screen mounts. Stays null (fallback, generic
  // centered geometry) until detection resolves, or if it fails outright.
  const [analysisPoints, setAnalysisPoints] = useState(null)
  // Deduped SVG path string for the ~3.4s mesh-scan beat (FaceMeshScanOverlay)
  // — built from the same detection call as analysisPoints above, see
  // startAnalysis. null until that resolves (the beat simply doesn't play).
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
  const rateLimitInitial  = useRef(30)
  const sideTriggerRef    = useRef(null)

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

  // Auto-advance from face photo step to side profile once facePhoto is set
  useEffect(() => {
    if (step !== 1 || !facePhoto) return
    const t = setTimeout(() => { setStep(2); setError('') }, 600)
    return () => clearTimeout(t)
  }, [step, facePhoto])

  // skipSideOverride — set true when user taps "Skip Side Profile"
  async function startAnalysis(skipSideOverride = false) {
    if (isFreeScanBlocked) { navigate('/premium'); return }

    const skipSide = skipSideOverride
    const g        = gender ?? 'male'
    setGender(g)
    setStep(3)  // analyzing
    setError('')
    setAnalysisStep(0)
    setAnalysisPoints(null) // clear any previous scan's points before detecting this one's
    setMeshPathD(null)      // same for the mesh-scan beat — don't replay the last scan's mesh

    // Kick off real face-landmark detection the instant the analyzing screen
    // mounts, in parallel with the actual AI scoring call below — this is
    // what lets FacialAnalysisOverlay trace the real detected face instead
    // of an assumed centered position, and what the mesh-scan beat
    // (FaceMeshScanOverlay) draws from too. Non-blocking and non-fatal: the
    // real scan flow never depends on either succeeding, so a slow/failed
    // detection (e.g. MediaPipe can't confidently read this photo) just
    // leaves the overlay on its generic fallback geometry and skips the
    // mesh beat entirely — never blocks or breaks the actual scan. The
    // 16-18s typical API wait gives this ample time even accounting for
    // MediaPipe's cold-start model load on the very first scan of a session.
    if (facePhoto) {
      import('../utils/faceLandmarks.js')
        .then(({ getLandmarks }) => getLandmarks(facePhoto))
        .then(lm => {
          const pts = extractScanOverlayPoints(lm)
          if (pts) setAnalysisPoints(pts)
          import('@mediapipe/face_mesh')
            .then(({ FACEMESH_TESSELATION }) => {
              const d = buildMeshPathD(lm, FACEMESH_TESSELATION)
              if (d) setMeshPathD(d)
            })
            .catch(err => console.warn('[Scan] Face mesh tessellation unavailable (non-fatal, mesh-scan beat skipped):', err?.message))
        })
        .catch(err => console.warn('[Scan] Analyzing-screen landmark detection failed (non-fatal, overlay falls back to generic positions):', err?.message))
    }

    // 5-step, 1s-per-step choreography for FacialAnalysisOverlay — ticks
    // forward on a fixed cadence regardless of API speed and parks at step 4
    // (pulsing) once it gets there. minDisplayPromise is the real completion
    // gate: below, we always await BOTH the real API result AND this timer,
    // so a fast response still plays the full animation, and a slow one just
    // holds on the step-4 visual until the real result actually exists —
    // there is no path where we proceed on the timer alone.
    const stageTimer = setInterval(() => {
      setAnalysisStep(prev => {
        if (prev >= 4) return prev
        triggerHaptic()
        return prev + 1
      })
    }, 1000)
    const slowTimer = setTimeout(() => setSlowAnalysis(true), 12000)
    const minDisplayPromise = new Promise(resolve => setTimeout(resolve, 5000))

    try {
      const faceB64    = await toBase64(facePhoto)
      if (faceB64) setFacePhoto(faceB64) // upgrade blob URL → stable data URL so retries don't expire
      const sideB64 = (!skipSide && sidePhoto) ? await toBase64(sidePhoto) : null
      if (sideB64) setSidePhoto(sideB64)

      // Real, on-device geometry — Apple's Vision framework measuring actual
      // detected joints/landmarks in the photos already taken above, not an
      // AI vision guess. Native-only (no-op on web, where these plugins
      // resolve { supported: false } immediately). Non-fatal by design: if
      // detection fails or confidence is too low, these stay null and the
      // AI scorer below just falls back to its own visual read — we never
      // invent a plausible-looking measurement to fill the gap.
      const sideProfileGeometryResult = (isNative() && sideB64) ? await analyzeSideProfile(sideB64) : null
      const sideProfileGeometry = sideProfileGeometryResult?.detected
        ? { facialConvexityDegrees: sideProfileGeometryResult.facialConvexityDegrees ?? null }
        : null

      let aiResult
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
          const scoreCall = api.ai.score({
            faceImage: faceB64,
            ...(sideB64 ? { sideImage: sideB64 } : {}),
            ...(sideProfileGeometry ? { sideProfileGeometry } : {}),
            gender: g,
            ...(lastGlowScore != null ? { previousScore: lastGlowScore } : {}),
          })
          const timeoutCall = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Analysis timed out. Please try again')), 120_000)
          )
          aiResult = await Promise.race([scoreCall, timeoutCall])
          setAnalysisResult(aiResult)

        } finally {
          setScanInFlight(false)
        }
      }

      // Real result is in hand — but never finish before the minimum 5-step
      // choreography has fully played out (a fast response just waits here;
      // a slow one already has the ticker parked, pulsing, at step 4).
      await minDisplayPromise
      setAnalysisStep(4)

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
      logAnalyticsEvent('scan_completed', { tier: aiResult.tier, score: aiResult.overallScore, source: 'rescan' })
      // Schedule rescan notification (14 days for free, 0 = cancelled for Pro)
      scheduleRescanNotification(isPremium ? 0 : 14).catch(() => {})

      // Play the morph-warp flourish over the finished photo before handing
      // off — MorphWarpOverlay's own keyframes run ~900ms; 950ms gives it a
      // hair of buffer so navigate() never cuts it off mid-play.
      setMorphing(true)
      await new Promise(r => setTimeout(r, 950))

      // Premium users see full results immediately; free users hit the unlock gate
      navigate(isPremium ? '/results' : '/unlock')
    } catch (err) {
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
        } else {
          setError(err.message || 'Analysis failed. Please try again.')
        }
        setStep(2)
      }
    } finally {
      clearInterval(stageTimer)
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
                if (cameraOpen) { setCameraOpen(false) }
                else if (previewPhoto) { setPreviewPhoto(null); setCameraOpen(true) }
                else if (step === 2) { setStep(1) }
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
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="gender" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <GenderSelector selected={gender} onSelect={setLocalGender} onAdvance={() => setStep(1)} />
            </motion.div>
          )}
          {(step === 1 || step === 2) && !cameraOpen && !previewPhoto && (
            <motion.div key={`guide-${step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full flex flex-col items-center justify-center px-6 gap-5">
              <div className="w-full rounded-2xl overflow-hidden" style={{ aspectRatio: step === 1 ? '4/5' : '3/4', border: '1px solid rgba(198,168,92,0.35)' }}>
                <img
                  src={step === 1
                    ? (gender === 'female' ? faceGuidePhotoFemale : faceGuidePhoto)
                    : (gender === 'female' ? sideProfileGuideFemale : sideProfileGuide)
                  }
                  alt="Guide"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Single Begin Scan button — tap opens the take/upload choice sheet */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { triggerHaptic(); setShowPhotoChoice(true) }}
                className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
                style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
              >
                Begin Scan
              </motion.button>

              {/* iOS-style action sheet — appears over the guide content */}
              <AnimatePresence>
                {showPhotoChoice && (
                  <>
                    <motion.div
                      key="backdrop"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[60]"
                      style={{ background: 'rgba(0,0,0,0.45)' }}
                      onClick={() => setShowPhotoChoice(false)}
                    />
                    <motion.div
                      key="sheet"
                      initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
                      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                      className="fixed left-4 right-4 z-[61] rounded-2xl overflow-hidden"
                      style={{ bottom: 'max(28px, env(safe-area-inset-bottom, 28px))' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Take Photo row */}
                      <button
                        onClick={() => { triggerHaptic(); setShowPhotoChoice(false); setCameraOpen(true) }}
                        className="w-full flex items-center justify-center gap-2 py-4 font-heading font-semibold text-[17px] active:opacity-70"
                        style={{ background: 'rgba(30,30,32,0.96)', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <Camera size={18} style={{ color: 'rgba(255,255,255,0.7)' }} /> Take Photo
                      </button>
                      {/* Choose from Library row */}
                      <button
                        onClick={async () => {
                          triggerHaptic(); setShowPhotoChoice(false)
                          try {
                            let url = null
                            if (isNative()) { url = await pickPhoto() }
                            else {
                              url = await new Promise(resolve => {
                                const inp = document.createElement('input')
                                inp.type = 'file'; inp.accept = 'image/*'
                                inp.onchange = e => resolve(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : null)
                                inp.click()
                              })
                            }
                            if (url) {
                              if (step === 1) { setFacePhoto(url); setError(''); setStep(2) }
                              else { setTransitioning(true); setSidePhoto(url); setError(''); setTimeout(() => { setStep(3); setTransitioning(false); setTimeout(() => startAnalysisRef.current?.(), 50) }, 300) }
                            }
                          } catch {}
                        }}
                        className="w-full flex items-center justify-center gap-2 py-4 font-heading font-semibold text-[17px] active:opacity-70"
                        style={{ background: 'rgba(30,30,32,0.96)', color: '#fff' }}
                      >
                        <Upload size={18} style={{ color: 'rgba(255,255,255,0.7)' }} /> Choose from Library
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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
                  onClick={() => { triggerHaptic(); setPreviewPhoto(null); setCameraOpen(true) }}
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
                      setPreviewPhoto(null)
                      setFacePhoto(url); setError(''); setCameraOpen(false); setStep(2)
                    } else {
                      setTransitioning(true)
                      setSidePhoto(url); setError(''); setCameraOpen(false)
                      setTimeout(() => {
                        setPreviewPhoto(null)
                        setStep(3)
                        setTransitioning(false)
                        setTimeout(() => startAnalysisRef.current?.(), 50)
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
          {(step === 1 || step === 2) && cameraOpen && (
            <motion.div key={`cam-${step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <CameraOverlay
                stepNum={step}
                gender={gender}
                onCapture={(url, blob) => {
                  triggerHaptic()
                  if (step === 1) {
                    setFacePhoto(url); setError(''); setCameraOpen(false); setStep(2)
                  } else {
                    setTransitioning(true)
                    setSidePhoto(url); setError(''); setCameraOpen(false)
                    setTimeout(() => {
                      setStep(3)
                      setTransitioning(false)
                      setTimeout(() => startAnalysisRef.current?.(), 50)
                    }, 300)
                  }
                }}
                onClose={() => setCameraOpen(false)}
              />
            </motion.div>
          )}
          {isAnalyzing && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <AnalyzingScreen currentStep={analysisStep} slow={slowAnalysis} photo={facePhoto} morphing={morphing} points={analysisPoints} meshPathD={meshPathD} scanResult={analysisResult} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Processing overlay — brief gap between preview Continue and analyzing screen */}
      <AnimatePresence>
        {transitioning && <ProcessingOverlay key="scan-transition" />}
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

      {/* CTAs */}
      {!isAnalyzing && (
        <div className="px-4 pb-8 pt-2">

          {/* Step 0 (gender) has no CTA here — GenderSelector auto-advances
              300ms after a tap, matching PremiumOnboarding.jsx's StepGender. */}

          {/* Step 1 (face) has no CTA here anymore — PhotoUploadStep's own
              button handles capture/scan, and the useEffect above advances
              to step 2 automatically once facePhoto + geometrySatisfied are
              both true. See that effect for why it isn't just this button
              turned into an auto-fire — retakes need the faceScanBusy gate
              too. */}

          {/* Step 2: side profile → this is now the last capture step, so its
              "Continue" fires the actual analysis directly instead of
              advancing to a body step. geometrySatisfied is already
              guaranteed true by the time anyone reaches here (step 1's gate
              requires it), and there's no Live Face Scan action offered here
              anymore — so the only real requirement left is a photo. Skip
              Side Profile remains the escape hatch since this step is
              optional; it also fires analysis directly, just without the
              side image. */}
          {step === 2 && cameraOpen && sidePhoto && (
            <button
              onClick={() => startAnalysis(false)}
              className="btn-amber"
            >
              ✦ Full Scan: Analyze Now
            </button>
          )}

        </div>
      )}
    </div>
  )
}
