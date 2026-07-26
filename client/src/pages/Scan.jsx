import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, CheckCircle2, Loader2, AlertCircle, X, RefreshCw, SkipForward, Lock, ArrowRight, Gift, Target, Star, Zap, Map, User, UserRound, ChevronLeft } from 'lucide-react'
import useStore from '../store/useStore'
import { getTier } from '../utils/analysis'
import { api } from '../utils/api'
import { generatePlanTasks } from '../utils/content'
import { assignPhase } from '../utils/phase'
import PageHeader from '../components/PageHeader'
import FaceScanOverlay from '../components/FaceScanOverlay'
import sideProfileGuide from '../assets/side-profile-guide.png'
import sideProfileGuideFemale from '../assets/side-profile-guide-female.png'
import bodyGuideMale from '../assets/body-guide-male.jpg'
import bodyGuideFemale from '../assets/body-guide-female.jpg'
import faceGuidePhoto from '../assets/face-metrics-demo.jpg'
import faceGuidePhotoFemale from '../assets/face-metrics-demo-female.jpg'
import AIConsentModal, { hasAIConsent } from '../components/AIConsentModal'
import { takePhoto, pickPhoto, isNative } from '../utils/camera'
import { startFaceScan } from '../utils/faceScan'
import { analyzeBodyPhoto, analyzeSideProfile } from '../utils/photoGeometry'
import { scheduleRescanNotification } from '../utils/notifications'
import { FirebaseAnalytics } from '@capacitor-firebase/analytics'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

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

function GenderSelector({ selected, onSelect }) {
  return (
    <div className="flex flex-col h-full px-4">
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-secondary font-body text-sm text-center mb-8 max-w-xs mx-auto">
          Overall Rating benchmarks and tier labels differ for men and women.
          Select to get accurate results.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'male',   GenderIcon: User,      label: 'Male',   color: '#0984E3', bg: 'rgba(9,132,227,0.08)' },
            { key: 'female', GenderIcon: UserRound,  label: 'Female', color: '#E84393', bg: 'rgba(232,67,147,0.08)' },
          ].map(({ key, GenderIcon, label, color, bg }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(key)}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200"
              style={{ borderColor: selected === key ? color : 'var(--border)', background: selected === key ? bg : 'var(--card)' }}
            >
              <GenderIcon size={40} style={{ color }} />
              <p className="font-heading font-bold text-base text-primary">{label}</p>
              {selected === key && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: color }}>
                  <CheckCircle2 size={14} className="text-white" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
        <p className="text-center text-[10px] text-secondary font-body mt-6">
          This only affects tier labels and benchmarks — all analysis is private and on-device.
        </p>
      </div>
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
  const videoRef   = useRef()
  const canvasRef  = useRef()
  const streamRef  = useRef()
  const [ready, setReady]           = useState(false)
  const [facingMode, setFacingMode] = useState('user')
  const [error, setError]           = useState('')

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
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
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(url, blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
            <AlertCircle size={40} className="text-warning" />
            <p className="text-white text-sm font-body">{error}</p>
            <button onClick={onClose} className="px-6 py-3 bg-white/10 rounded-2xl text-white text-sm font-heading font-bold">Go Back</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />

            {/* Guide overlay */}
            {ready && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {stepNum === 1 ? (
                  <svg width="180" height="240" viewBox="0 0 180 240" className="opacity-60">
                    <ellipse cx="90" cy="120" rx="72" ry="100" fill="none" stroke="#C6A85C" strokeWidth="2.5" strokeDasharray="10,6"/>
                    <line x1="90"  y1="10"  x2="90"  y2="230" stroke="white" strokeWidth="0.5" opacity="0.3"/>
                    <line x1="10"  y1="120" x2="170" y2="120" stroke="white" strokeWidth="0.5" opacity="0.3"/>
                  </svg>
                ) : (
                  /* Side-profile wireframe overlay */
                  <SideGuide size="overlay" gender={gender} />
                )}
              </div>
            )}
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={36} className="text-white animate-spin" />
              </div>
            )}
          </>
        )}

        {/* Close */}
        <button
          onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose() }}
          aria-label="Close camera"
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
        >
          <X size={20} className="text-white" />
        </button>

        {/* Flip */}
        {!error && (
          <button onClick={() => { setReady(false); setFacingMode(m => m === 'user' ? 'environment' : 'user') }}
            aria-label="Flip camera"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
            <RefreshCw size={18} className="text-white" />
          </button>
        )}
      </div>

      {/* Capture button */}
      {!error && (
        <div className="flex items-center justify-center py-8 bg-black">
          <button onClick={capture} disabled={!ready}
            aria-label="Take photo"
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40">
            <div className="w-14 h-14 rounded-full bg-white" />
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
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
        <button
          onClick={onClose}
          className="w-full rounded-2xl py-4 font-heading font-bold text-[16px] active:opacity-60 transition-opacity"
          style={{ background: '#1C1C1E', color: GOLD }}
        >
          Cancel
        </button>
      </motion.div>
    </>
  )
}

// ─── Photo Upload Step ────────────────────────────────────────────────────────

export function PhotoUploadStep({ stepNum, guide, photo, onPhoto, gender, arScanDone = false, onLiveScan = null, arScanSkipped = false, onSkipScan = null, onScanningChange = null }) {
  const uploadRef = useRef()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [error, setError] = useState('')
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [showScanOverlay, setShowScanOverlay] = useState(false)
  const prevPhotoRef = useRef(photo)
  const skipRequestedRef = useRef(false)

  // TrueDepth-capable devices chain straight into the live scan after capture
  // instead of requiring a separate manual "Live Face Scan" tap. Web and
  // non-TrueDepth devices are untouched — onLiveScan is only ever passed
  // truthy where the native scan can actually run, and isNative() gates out
  // the web build regardless.
  const canAutoLiveScan = stepNum === 1 && isNative() && !!onLiveScan

  // Decorative-only on non-auto-scan devices — plays once every time a new
  // face photo (step 1) lands, including retakes. No real face detection
  // involved. On TrueDepth-capable devices, this same overlay/state now also
  // carries the "Now scanning…" transition into the actual live scan below.
  useEffect(() => {
    const justCaptured = stepNum === 1 && photo && photo !== prevPhotoRef.current
    prevPhotoRef.current = photo
    if (!justCaptured) return

    setShowScanOverlay(true)

    if (!canAutoLiveScan) {
      const t = setTimeout(() => setShowScanOverlay(false), 1800)
      return () => clearTimeout(t)
    }

    // Short lead-in so "Now scanning your facial structure…" is actually
    // readable before the native fullscreen modal takes over — the modal
    // itself covers the whole screen, so nothing web-rendered needs to keep
    // pace with it once it's open. onScanningChange tells the parent a scan
    // is genuinely in flight — arScanDone alone can't be used for this,
    // since a retake leaves the *previous* scan's arScanDone=true stale
    // until this new one resolves (retaking a photo intentionally doesn't
    // clear an already-completed scan).
    skipRequestedRef.current = false
    onScanningChange?.(true)
    ;(async () => {
      await new Promise(r => setTimeout(r, 700))
      if (skipRequestedRef.current) return
      await onLiveScan()
      setShowScanOverlay(false)
      onScanningChange?.(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, stepNum])

  function handleSkipDuringScan() {
    skipRequestedRef.current = true
    setShowScanOverlay(false)
    onScanningChange?.(false)
    onSkipScan?.()
  }

  async function handleCameraClick() {
    if (isNative()) {
      try {
        const dataUrl = await takePhoto()
        if (dataUrl) onPhoto(dataUrl, dataUrl)
      } catch (err) {
        if (!err?.message?.includes('cancel') && !err?.message?.includes('Cancel')) {
          setError('Camera error: ' + (err?.message || 'Unknown error'))
        }
      }
    } else {
      setCameraOpen(true)
    }
  }

  async function handleUploadClick() {
    if (isNative()) {
      try {
        const dataUrl = await pickPhoto()
        if (dataUrl) onPhoto(dataUrl, dataUrl)
      } catch (err) {
        if (!err?.message?.includes('cancel') && !err?.message?.includes('Cancel')) {
          setError('Photo error: ' + (err?.message || 'Unknown error'))
        }
      }
    } else {
      uploadRef.current?.click()
    }
  }

  return (
    <div className={stepNum === 1 ? 'flex flex-col h-full px-3' : 'flex flex-col h-full px-4'}>
      {cameraOpen && (
        <CameraOverlay stepNum={stepNum} onCapture={(url, blob) => { setCameraOpen(false); onPhoto(url, blob) }} onClose={() => setCameraOpen(false)} gender={gender} />
      )}

      {/* Preview / placeholder — pointer-events-none so nothing inside can block the buttons below.
          Step 1 (face photo) uses a near-full-width, aspect-ratio-driven frame instead of the
          shared flex-1/max-h-80 box, so it dominates the screen instead of sitting in a smaller
          centered box. */}
      <div
        className={stepNum === 1
          ? 'relative w-full aspect-[4/5] rounded-2xl overflow-hidden flex items-center justify-center mt-2 mb-4 pointer-events-none'
          : 'relative flex-1 max-h-80 rounded-2xl overflow-hidden flex items-center justify-center mt-2 mb-4 pointer-events-none'}
        style={{
          background: stepNum === 3 ? '#0a0f22' : (stepNum === 1 || stepNum === 2) ? '#000000' : '#111827',
          // Gold frame — step 1 only, same weight/opacity idiom as the rest of
          // the app's gold accents (solid GOLD for the border itself, the
          // equivalent rgba(198,168,92,X) for the soft outer glow, since
          // there's no alpha-variant helper for the hex token elsewhere in
          // this codebase either — see Premium.jsx's GOLD_BORDER/${GOLD}NN
          // pattern, ScanUnlockGate's badge borders).
          ...(stepNum === 1 ? { border: `1.5px solid ${GOLD}`, boxShadow: '0 0 16px rgba(198,168,92,0.25)' } : {}),
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
            {stepNum === 1 && (
              <AnimatePresence>
                {showScanOverlay && (
                  <>
                    <FaceScanOverlay />
                    {canAutoLiveScan && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE_STANDARD }}
                        className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-2 px-6 pointer-events-auto"
                      >
                        <p
                          className="font-heading font-bold text-[13px] text-center"
                          style={{ color: 'white', textShadow: '0 1px 6px rgba(0,0,0,0.85)' }}
                        >
                          Now scanning your facial structure…
                        </p>
                        <button
                          onClick={handleSkipDuringScan}
                          className="text-[11px] font-body underline active:opacity-60 transition-opacity"
                          style={{ color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 4px rgba(0,0,0,0.85)' }}
                        >
                          Skip — use photo only
                        </button>
                      </motion.div>
                    )}
                  </>
                )}
              </AnimatePresence>
            )}
          </>
        ) : (stepNum === 1 || stepNum === 2) && arScanDone ? (
          <div className="flex flex-col items-center gap-3 p-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,255,255,0.12)', border: '2px solid cyan' }}>
              <CheckCircle2 size={32} style={{ color: 'cyan' }} />
            </div>
            <p className="text-cyan-400 text-sm font-heading font-bold text-center">
              {stepNum === 1 ? 'Live Face Scan Complete' : 'Carried Over From Face Photo Step'}
            </p>
            <p className="text-white/50 text-[11px] font-body text-center">
              {stepNum === 1
                ? 'Geometry captured · Take a photo too — both are required'
                : "This is your scan from the Face Photo step, not a new one — ARKit can't track a real 90° turn, so one scan covers both. Just add a photo below."}
            </p>
          </div>
        ) : stepNum === 2 ? (
          // object-contain (not cover) so the full reference photo shows —
          // cover was cropping it to fill the box. Inline style too, not just
          // the Tailwind class — belt-and-suspenders against any build/purge
          // weirdness silently dropping the utility class.
          <img
            src={gender === 'female' ? sideProfileGuideFemale : sideProfileGuide}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain' }}
          />
        ) : stepNum === 3 ? (
          <img
            src={gender === 'female' ? bodyGuideFemale : bodyGuideMale}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : stepNum === 1 ? (
          // object-contain (not cover/top) so the whole face shows — cover+top
          // was cropping this tall portrait down to just forehead/eyes. Also
          // re-cropped the source asset itself tighter to the face (was
          // 1000x2167 with a lot of dead neck/torso/black space below the
          // chin, now 1000x1400) so contain doesn't shrink it down to a tiny
          // letterboxed strip. Inline style, not just the Tailwind class —
          // belt-and-suspenders against any build/purge weirdness.
          <img
            src={gender === 'female' ? faceGuidePhotoFemale : faceGuidePhoto}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 p-8">
            <p className="text-white/60 text-xs text-center font-body max-w-[200px]">{guide}</p>
          </div>
        )}
        {/* Corner guides — decorative only. Dropped for step 1's redesigned
            frame, which is meant to be just the photo/reference image with
            nothing else cluttering it. */}
        {!photo && stepNum !== 1 && (
          <>
            {[['top-3 left-3', true, false, true, false], ['top-3 right-3', true, false, false, true],
              ['bottom-3 left-3', false, true, true, false], ['bottom-3 right-3', false, true, false, true]].map(([pos, t, b, l, r], i) => (
              <div key={i} className={`absolute ${pos} w-6 h-6`} style={{
                borderTopWidth: t ? 2 : 0, borderBottomWidth: b ? 2 : 0,
                borderLeftWidth: l ? 2 : 0, borderRightWidth: r ? 2 : 0,
                borderColor: '#C6A85C', borderStyle: 'solid',
                borderRadius: `${t && l ? 4 : 0}px ${t && r ? 4 : 0}px ${b && r ? 4 : 0}px ${b && l ? 4 : 0}px`,
              }} />
            ))}
          </>
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

      {/* Live Face Scan is the standard/primary capture method on the face
          step (1) only — a TrueDepth capture there already covers profile
          geometry too (ARKit can't reliably track a real 90° head turn, so
          facial angle/gonial angle/etc. are derived from this same
          front-facing capture). Offering the button again on the Side
          Profile step just invited people to turn 90° before tapping it,
          which broke tracking — so step 2 only ever needs a photo now, no
          separate scan action. */}
      {stepNum === 1 ? (
        canAutoLiveScan ? (
          <div className="mb-1">
            {/* Hidden entirely while the "Now scanning…" transition/overlay is up —
                that state has its own inline skip link, so nothing duplicates it here. */}
            {!showScanOverlay && (
              !photo && !arScanDone ? (
                <button
                  onClick={() => setShowActionSheet(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-full active:scale-95 transition-transform"
                  style={{ background: GOLD_GRADIENT, boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
                >
                  <Camera size={18} style={{ color: '#0A0A0A' }} />
                  <span className="text-[15px] font-heading font-bold" style={{ color: '#0A0A0A' }}>
                    Upload or Take a Selfie
                  </span>
                </button>
              ) : (
                // Settled (scan succeeded, was skipped, or the native modal was
                // cancelled) — a lightweight retake control, not a full pill.
                // Reopening the action sheet still offers "Live Face Scan" as a
                // manual option, so this doubles as the recovery path if the
                // native modal was dismissed without using the skip link above.
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => setShowActionSheet(true)}
                    className="flex items-center gap-1.5 py-2 px-4 active:opacity-60 transition-opacity"
                  >
                    <RefreshCw size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    <span className="text-[12px] font-body font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Retake Photo
                    </span>
                  </button>
                  {!arScanDone && !arScanSkipped && onSkipScan && (
                    <button
                      onClick={onSkipScan}
                      className="text-[11px] font-body underline active:opacity-60 transition-opacity"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      Skip Live Face Scan — use photo only
                    </button>
                  )}
                </div>
              )
            )}

            <AnimatePresence>
              {showActionSheet && (
                <PhotoActionSheet
                  onClose={() => setShowActionSheet(false)}
                  options={[
                    ...(isNative() && onLiveScan ? [{
                      label: arScanDone ? '✓ Rescan (Live Face Scan)' : 'Live Face Scan',
                      icon: Star,
                      highlight: true,
                      onSelect: () => { setShowActionSheet(false); onLiveScan() },
                    }] : []),
                    { label: 'Take Photo', icon: Camera, onSelect: () => { setShowActionSheet(false); handleCameraClick() } },
                    { label: 'Choose from Library', icon: Upload, onSelect: () => { setShowActionSheet(false); handleUploadClick() } },
                  ]}
                />
              )}
            </AnimatePresence>
          </div>
        ) : (
        <div className="mb-1">
          <button
            onClick={() => setShowActionSheet(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-full active:scale-95 transition-transform"
            style={{ background: GOLD_GRADIENT, boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
          >
            <Camera size={18} style={{ color: '#0A0A0A' }} />
            <span className="text-[15px] font-heading font-bold" style={{ color: '#0A0A0A' }}>
              {photo || arScanDone ? 'Retake Selfie' : 'Upload or Take a Selfie'}
            </span>
          </button>

          {photo && !arScanDone && !arScanSkipped && onSkipScan && (
            <button
              onClick={onSkipScan}
              className="w-full mt-2.5 flex items-center justify-center gap-2 active:opacity-70 transition-opacity"
              style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', borderRadius: 10, padding: '10px 14px' }}
            >
              <SkipForward size={14} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <span className="font-heading text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Skip Live Face Scan — use photo only
              </span>
            </button>
          )}

          <AnimatePresence>
            {showActionSheet && (
              <PhotoActionSheet
                onClose={() => setShowActionSheet(false)}
                options={[
                  ...(isNative() && onLiveScan ? [{
                    label: arScanDone ? '✓ Rescan (Live Face Scan)' : 'Live Face Scan',
                    icon: Star,
                    highlight: true,
                    onSelect: () => { setShowActionSheet(false); onLiveScan() },
                  }] : []),
                  { label: 'Take Photo', icon: Camera, onSelect: () => { setShowActionSheet(false); handleCameraClick() } },
                  { label: 'Choose from Library', icon: Upload, onSelect: () => { setShowActionSheet(false); handleUploadClick() } },
                ]}
              />
            )}
          </AnimatePresence>
        </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-1">
          {/* Take Photo — solid gold border */}
          <button
            onClick={handleCameraClick}
            className="flex flex-col items-center gap-2 py-4 active:scale-95 transition-transform"
            style={{
              background: 'rgba(201,168,76,0.06)',
              border: '2px solid #C6A85C',
              borderRadius: 12,
              boxShadow: '0 0 12px rgba(201,168,76,0.3)',
            }}
          >
            <Camera size={20} style={{ color: '#C6A85C' }} />
            <span className="text-xs font-heading font-bold text-white">Take Photo</span>
          </button>
          {/* Upload Photo — identical gold border, no greyed-out look */}
          <button
            onClick={handleUploadClick}
            className="flex flex-col items-center gap-2 py-4 active:scale-95 transition-transform"
            style={{
              background: 'rgba(201,168,76,0.06)',
              border: '2px solid #C6A85C',
              borderRadius: 12,
              boxShadow: '0 0 12px rgba(201,168,76,0.3)',
            }}
          >
            <Upload size={20} style={{ color: '#C6A85C' }} />
            <span className="text-xs font-heading font-bold text-white">Upload Photo</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Analyzing Screen ─────────────────────────────────────────────────────────

// Rotates through a few distinct-sounding status lines instead of one frozen
// line. Purely presentational — timer-driven, NOT tied to real backend
// progress (the core-score call gives no granular progress events, so this
// deliberately never claims a percentage). Loops continuously so it still
// feels alive if the real result takes longer than one full cycle.
const ANALYZING_MESSAGES = [
  'Analyzing facial features...',
  'Measuring symmetry...',
  'Reading skin texture...',
  'Mapping bone structure...',
  'Evaluating proportions...',
  'Cross-referencing your profile...',
]

function useRotatingIndex(length, intervalMs) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % length), intervalMs)
    return () => clearInterval(id)
  }, [length, intervalMs])
  return index
}

// Same 5 real facial regions/vertical positions established in the prior
// label work (cy% top to bottom on the photo) — now used as lookup bands for
// a horizontal sweep line's position instead of driving a separate timer.
const SWEEP_FEATURE_ROWS = [22, 38, 54, 70, 86]
const SWEEP_FEATURE_LABELS = ['Scanning forehead', 'Scanning eye symmetry', 'Scanning nose bridge', 'Scanning jawline', 'Scanning chin']
// Midpoints between adjacent rows above — the band boundaries the sweep
// line's live percentage position is tested against.
const SWEEP_BAND_THRESHOLDS = [30, 46, 62, 78]
// One-way top-to-bottom pass; the line bounces (reverses), so a full cycle
// is 2x this. ~3 bounce cycles fit inside the real ~17s core-score wait.
const SWEEP_ONE_WAY_MS = 2800

function bandForSweepPct(pct) {
  for (let i = 0; i < SWEEP_BAND_THRESHOLDS.length; i++) {
    if (pct < SWEEP_BAND_THRESHOLDS[i]) return i
  }
  return SWEEP_FEATURE_ROWS.length - 1
}

// Derives which feature band the sweep line currently occupies from the same
// elapsed-time/duration math driving the line's own animation below (not an
// independent guess at timing) — polled at a coarse interval since the label
// only needs to update on a band change, not every frame.
function useSweepBand() {
  const [band, setBand] = useState(0)
  const bandRef = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const id = setInterval(() => {
      const elapsed = performance.now() - start
      const cycle = SWEEP_ONE_WAY_MS * 2
      const t = elapsed % cycle
      const pct = t < SWEEP_ONE_WAY_MS
        ? (t / SWEEP_ONE_WAY_MS) * 100
        : 100 - ((t - SWEEP_ONE_WAY_MS) / SWEEP_ONE_WAY_MS) * 100
      const next = bandForSweepPct(pct)
      if (next !== bandRef.current) {
        bandRef.current = next
        setBand(next)
      }
    }, 120)
    return () => clearInterval(id)
  }, [])
  return band
}

// Dot positions computed once at module scope, each tagged with its row
// index so it can reference that row's keyframe (below) by name.
const SWEEP_DOTS = SWEEP_FEATURE_ROWS.flatMap((cy, row) => [35, 50, 65].map(cx => ({ cx, cy, row })))
const SWEEP_FULL_CYCLE_S = (SWEEP_ONE_WAY_MS * 2) / 1000

// Plain CSS @keyframes for the line + one per dot row, injected once via a
// <style> tag — deliberately NOT driven by Framer Motion's `animate` prop.
// Framer Motion's JS-level animation engine defers to the OS
// prefers-reduced-motion setting (same as this app's existing FaceScanOverlay,
// which freezes identically under it despite its own reducedMotion="never"
// override), which would leave this whole effect static for anyone with
// Reduce Motion on. A plain CSS animation isn't gated by that check unless a
// `@media (prefers-reduced-motion: reduce)` rule explicitly disables it here
// — which this deliberately does not do, since the effect is purely
// decorative and conveys no information the label text doesn't already say.
const SWEEP_KEYFRAMES_CSS = `
@keyframes ascendus-sweep-line {
  0% { top: 0%; }
  50% { top: 100%; }
  100% { top: 0%; }
}
${SWEEP_FEATURE_ROWS.map((cy, row) => {
  const downPct = (cy / 200) * 100
  const upPct = (1 - cy / 200) * 100
  const eps = 2.5
  const d0 = Math.max(0, downPct - eps).toFixed(2)
  const d1 = downPct.toFixed(2)
  const d2 = Math.min(100, downPct + eps).toFixed(2)
  const u0 = Math.max(0, upPct - eps).toFixed(2)
  const u1 = upPct.toFixed(2)
  const u2 = Math.min(100, upPct + eps).toFixed(2)
  return `
@keyframes ascendus-sweep-dot-${row} {
  0% { opacity: 0.2; }
  ${d0}% { opacity: 0.2; }
  ${d1}% { opacity: 1; }
  ${d2}% { opacity: 0.2; }
  ${u0}% { opacity: 0.2; }
  ${u1}% { opacity: 1; }
  ${u2}% { opacity: 0.2; }
  100% { opacity: 0.2; }
}`
}).join('\n')}
`

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

function SweepLine() {
  return (
    <div
      className="absolute left-0 right-0"
      style={{
        height: 2,
        background: GOLD,
        boxShadow: `0 0 16px 3px ${GOLD}, 0 0 4px 1px ${GOLD}`,
        animation: `ascendus-sweep-line ${SWEEP_FULL_CYCLE_S}s ease-in-out infinite`,
      }}
    />
  )
}

// The user's real captured photo with a glowing horizontal line sweeping
// top<->bottom (document-scanner style) — replaces the dot-mesh/on-photo-
// label and checklist-thumbnail versions entirely. Purely timer/animation
// driven, not tied to real backend progress; the label crossfades in a fixed
// spot at the bottom of the photo as the line's position crosses each
// feature's band, derived from the same duration as the line itself.
function AnalyzingSweepOverlay({ photo }) {
  const band = useSweepBand()

  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-6" style={{ aspectRatio: '4/5', background: '#0a0a0a' }}>
      <style>{SWEEP_KEYFRAMES_CSS}</style>
      {photo && (
        <img
          src={photo}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.5) saturate(0.85)' }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.65) 100%)' }}
      />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {SWEEP_DOTS.map((d, i) => <SweepFeatureDot key={i} cx={d.cx} cy={d.cy} row={d.row} />)}
      </svg>
      <SweepLine />
      <div className="absolute left-0 right-0 bottom-3 flex justify-center px-3">
        <AnimatePresence mode="wait">
          <motion.span
            key={band}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="font-heading font-bold text-[11px] tracking-wide px-2.5 py-1 rounded-md"
            style={{ background: 'rgba(0,0,0,0.55)', border: `1px solid ${GOLD}55`, color: GOLD }}
          >
            {SWEEP_FEATURE_LABELS[band]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

export function AnalyzingScreen({ currentStep, slow, photo }) {
  const msgIndex = useRotatingIndex(ANALYZING_MESSAGES.length, 2800)

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <AnalyzingSweepOverlay photo={photo} />

      <AnimatePresence mode="wait">
        {slow ? (
          <motion.h2 key="slow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="font-heading font-bold text-xl text-primary mb-1">
            Almost there…
          </motion.h2>
        ) : (
          <motion.h2 key="normal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="font-heading font-bold text-xl text-primary mb-1">
            Analyzing…
          </motion.h2>
        )}
      </AnimatePresence>

      <div className="h-5 mb-6 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p key={msgIndex} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-xs font-body"
            style={{ color: slow ? GOLD : 'var(--text-secondary)' }}
          >
            {ANALYZING_MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="w-full space-y-2.5">
        {ANALYSIS_STEPS.map((s, i) => (
          <ChecklistRow key={i} step={s} i={i} currentStep={currentStep} />
        ))}
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
// Steps: 0=gender  1=face  2=side-profile  3=body  4=analyzing

const STEP_META = [
  { title: 'Select Gender',  subtitle: 'For accurate Overall Rating results' },
  { title: 'Face Photo',     subtitle: 'Take your photo' },
  { title: 'Side Profile',   subtitle: 'Optional · Unlocks profile analysis' },
  { title: 'Body Photo',     subtitle: 'Optional · Unlocks physique score' },
]

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
  const addScan           = useStore(s => s.addScan)
  const setCurrentScan    = useStore(s => s.setCurrentScan)
  const patchScanExtendedMetrics = useStore(s => s.patchScanExtendedMetrics)
  const setCurrentPlan    = useStore(s => s.setCurrentPlan)
  const setGender         = useStore(s => s.setGender)
  const incrementScanCount = useStore(s => s.incrementScanCount)
  const setAssignedPhase  = useStore(s => s.setAssignedPhase)
  const setLastScanDate   = useStore(s => s.setLastScanDate)
  const setLastFaceScanCapture = useStore(s => s.setLastFaceScanCapture)
  const lastFaceScanImage = useStore(s => s.lastFaceScanImage)
  const logout            = useStore(s => s.logout)

  // Monthly scan gate for free users
  const isFreeScanBlocked = (() => {
    if (isPremium) return false
    if (!lastScanDate) return false
    const last = new Date(lastScanDate)
    const now  = new Date()
    return last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear()
  })()

  const [step, setStep]                   = useState(0)
  const [gender, setLocalGender]          = useState(savedGender ?? null)
  const [facePhoto, setFacePhoto]         = useState(null)
  const [sidePhoto, setSidePhoto]         = useState(null)
  const [bodyPhoto, setBodyPhoto]         = useState(null)
  const [faceMetrics, setFaceMetrics]     = useState(null)   // ARKit geometry results
  const [arScanDone, setArScanDone]       = useState(false)  // true when ARKit replaced photo
  const [arScanSkipped, setArScanSkipped] = useState(false)  // user opted out of Live Face Scan after uploading/taking a static photo
  const [faceScanBusy, setFaceScanBusy]   = useState(false)  // PhotoUploadStep's auto-live-scan chain is genuinely in flight
  const geometrySatisfied = arScanDone || arScanSkipped
  const [analysisStep, setAnalysisStep]   = useState(0)
  const [slowAnalysis, setSlowAnalysis]   = useState(false)
  const [error, setError]                 = useState('')
  const [rateLimited, setRateLimited]     = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [claudeRateLimited, setClaudeRateLimited] = useState(false)
  const [scanCapReached, setScanCapReached] = useState(false)
  const [scanCapPlan, setScanCapPlan]     = useState('free')
  const [showConsent, setShowConsent]     = useState(() => !hasAIConsent())

  const startAnalysisRef  = useRef(null)
  const rateLimitInitial  = useRef(30)

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
        <button onClick={() => navigate('/premium')} className="btn-primary mb-3 max-w-xs">Unlock Unlimited Scans →</button>
        <button onClick={() => navigate('/referral')} className="text-sm font-heading font-bold" style={{ color: '#C6A85C' }}>
          <span className="flex items-center gap-1.5"><Gift size={14} /> Or share with 5 friends for 3 days free</span>
        </button>
      </div>
    )
  }

  // Convert an image URL (blob: or data:) to a resized base64 string.
  // 15s timeout guards against WKWebView blob URL expiry silently hanging.
  async function toBase64(url, maxPx = 1024) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Photo processing timed out — please retake your photo')), 15_000)
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

  async function handleLiveScan() {
    const result = await startFaceScan()
    if (!result.supported) {
      if (result.nativeError) {
        // The native plugin call itself failed — this is a build/wiring issue,
        // not a hardware limitation. Don't tell the user their phone is unsupported.
        console.error('[Scan] FaceScanPlugin call failed (not a hardware issue):', result.message)
        setError('Live face scan couldn’t start due to an app error. Try closing and reopening the app, or reinstalling it.')
      } else {
        setError('Live face scan requires a device with a TrueDepth camera (iPhone X or later).')
      }
      return
    }
    if (result.cancelled) return

    // IMPORTANT: strip the large capturedImage/landmarks2D fields out before
    // this goes anywhere near faceMetrics state — faceMetrics ends up on
    // scanRecord.faceMetrics, which ends up in currentScan, which IS
    // persisted to localStorage (see useStore.js partialize). Embedding the
    // photo there would reintroduce the exact quota bug we already fixed
    // once this session, just through a different path. Numbers only here.
    const { capturedImage, landmarks2D, ...metricsOnly } = result
    setFaceMetrics(metricsOnly)
    setArScanDone(true)
    setArScanSkipped(false) // a real scan just happened, any earlier skip no longer applies
    setError('')

    // Photo + 2D landmark positions go to session-only store state instead
    // (NOT persisted — see setLastFaceScanCapture's comment in useStore.js)
    // so the interactive "tap a stat, see it on your face" UI in Progress
    // can use them without touching localStorage at all.
    if (capturedImage && landmarks2D) {
      setLastFaceScanCapture(capturedImage, landmarks2D)
    }
  }

  // Step 1 has no separate "Continue" button anymore — PhotoUploadStep's own
  // capture + auto-live-scan chain already gets facePhoto/geometrySatisfied
  // to true on its own, so this just advances once both are set. Gated on
  // !faceScanBusy specifically because arScanDone is deliberately NOT reset
  // on a retake (an already-completed scan stays valid until a fresh one
  // actually resolves) — so geometrySatisfied can read stale-true for the
  // whole span of a retake's own auto-triggered rescan. Without this gate,
  // that staleness would auto-advance to step 2 mid-rescan.
  useEffect(() => {
    if (step !== 1 || !facePhoto || !geometrySatisfied || faceScanBusy) return
    const t = setTimeout(() => { setStep(2); setError('') }, 900)
    return () => clearTimeout(t)
  }, [step, facePhoto, geometrySatisfied, faceScanBusy])

  // skipSideOverride — set true when user taps "Skip Side Profile"
  async function startAnalysis(skipSideOverride = false, skipBodyOverride = false) {
    if (isFreeScanBlocked) { navigate('/premium'); return }

    const skipSide = skipSideOverride
    const skipBody = skipBodyOverride
    const g        = gender ?? 'male'
    setGender(g)
    setStep(4)  // analyzing
    setError('')
    setAnalysisStep(0)

    try {
      const usingARKit = arScanDone && !facePhoto
      const faceB64    = usingARKit ? null : await toBase64(facePhoto)
      if (faceB64) setFacePhoto(faceB64) // upgrade blob URL → stable data URL so retries don't expire
      const sideB64 = (!skipSide && sidePhoto) ? await toBase64(sidePhoto) : null
      if (sideB64) setSidePhoto(sideB64)
      const bodyB64 = (!skipBody && bodyPhoto) ? await toBase64(bodyPhoto) : null
      if (bodyB64) setBodyPhoto(bodyB64)

      // Real, on-device geometry — Apple's Vision framework measuring actual
      // detected joints/landmarks in the photos already taken above, not an
      // AI vision guess. Native-only (no-op on web, where these plugins
      // resolve { supported: false } immediately). Non-fatal by design: if
      // detection fails or confidence is too low, these stay null and the
      // AI scorer below just falls back to its own visual read — we never
      // invent a plausible-looking measurement to fill the gap.
      const bodyGeometryResult = (isNative() && bodyB64) ? await analyzeBodyPhoto(bodyB64) : null
      const bodyGeometry = bodyGeometryResult?.detected
        ? { shoulderHipRatio: bodyGeometryResult.shoulderHipRatio ?? null, spineLeanDegrees: bodyGeometryResult.spineLeanDegrees ?? null }
        : null
      const sideProfileGeometryResult = (isNative() && sideB64) ? await analyzeSideProfile(sideB64) : null
      const sideProfileGeometry = sideProfileGeometryResult?.detected
        ? { facialConvexityDegrees: sideProfileGeometryResult.facialConvexityDegrees ?? null }
        : null

      setAnalysisStep(1)
      setSlowAnalysis(false)
      const stageTimer = setInterval(() => setAnalysisStep(prev => prev < 2 ? prev + 1 : prev), 1800)
      const slowTimer  = setTimeout(() => setSlowAnalysis(true), 12000)

      let aiResult
      if (usingARKit) {
        // ARKit-only path: derive score from live symmetry geometry (0-100 → 0-10)
        clearInterval(stageTimer)
        clearTimeout(slowTimer)
        setSlowAnalysis(false)
        const sym   = (faceMetrics?.symmetryScore ?? 50) / 10
        const score = Math.round(Math.min(9.5, Math.max(1.0, sym)) * 10) / 10
        const tier  = getTier(score, g)
        aiResult = {
          overallScore:    score,
          faceScore:       score,
          faceOnlyScore:   score,
          groomingScore:   null,
          tier:            tier.label,
          hasSideProfile:  false,
          faceSubScores:   { symmetry: score, jawlineDefinition: null, skinClarity: null, facialProportions: null, eyeArea: null, facialHarmony: null },
          pillars:         null,
          physiqueScore:   null,
          bodyFatLevel:    null,
          insights:        ['Score derived from live TrueDepth face geometry. Take a photo scan for full AI analysis.'],
        }
      } else if (token === 'demo-token') {
        // Demo users: return mock results instead of hitting the backend
        await new Promise(r => setTimeout(r, 2500))
        clearInterval(stageTimer)
        clearTimeout(slowTimer)
        setSlowAnalysis(false)
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
          physiqueScore: bodyB64 ? {
            overall:        Math.round((6.5 + Math.random()) * 10) / 10,
            body_fat_level: 'Athletic',
            muscularity:    Math.round((6.5 + Math.random()) * 10) / 10,
            proportions:    Math.round((7.0 + Math.random() * 0.5) * 10) / 10,
            posture:        Math.round((6.8 + Math.random() * 0.6) * 10) / 10,
          } : null,
          bodyFatLevel: bodyB64 ? 'Athletic' : null,
          insights: ['Demo mode — sign up for a real account to get AI-powered analysis'],
        }
      } else {
        try {
          const lastGlowScore = scans?.[0]?.glowScore ?? null
          const scoreCall = api.ai.score({
            faceImage: faceB64,
            ...(sideB64 ? { sideImage: sideB64 } : {}),
            ...(bodyB64 ? { bodyImage: bodyB64 } : {}),
            ...(bodyGeometry ? { bodyGeometry } : {}),
            ...(sideProfileGeometry ? { sideProfileGeometry } : {}),
            gender: g,
            ...(lastGlowScore != null ? { previousScore: lastGlowScore } : {}),
          })
          const timeoutCall = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Analysis timed out — please try again')), 120_000)
          )
          aiResult = await Promise.race([scoreCall, timeoutCall])
          // TEMP TRACE — remove after tier-consistency verification is done.
          console.log('[TIER-TRACE] scan result from server:', {
            previousScore: lastGlowScore,
            overallScore:  aiResult?.overallScore,
            tier:          aiResult?.tier,
          })
        } finally {
          clearInterval(stageTimer)
          clearTimeout(slowTimer)
          setSlowAnalysis(false)
        }
      }

      setAnalysisStep(2)
      await new Promise(r => setTimeout(r, 350))
      setAnalysisStep(3)

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
        physiqueScore:    aiResult.physiqueScore    ?? null,
        bodyFatLevel:     aiResult.bodyFatLevel     ?? null,
        // ARKit live scan geometry — present when user used TrueDepth face scan
        faceMetrics:      faceMetrics ?? undefined,
        // Real, on-device Vision-framework geometry (body pose joints /
        // side-profile landmarks) — present only when detection actually
        // succeeded with adequate confidence. Same "measure, don't guess"
        // principle as faceMetrics above, for the body and side profile.
        bodyGeometry:         bodyGeometry ?? undefined,
        sideProfileGeometry:  sideProfileGeometry ?? undefined,
      }

      const assignedPh = assignPhase(aiResult.faceScore, userProfile?.goal)
      const tasks = generatePlanTasks(scanRecord.faceData, scanRecord.pillars, assignedPh, g)
      setCurrentPlan({ id: `plan-${Date.now()}`, scanId: scanRecord.id, tasks, createdAt: new Date().toISOString(), weekNumber: 1 })
      if (faceB64) setPendingFacePhoto(faceB64)
      addScan(scanRecord)
      setCurrentScan(scanRecord)
      setAssignedPhase(assignedPh)

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
        const photoForUpload = faceB64 || (usingARKit ? lastFaceScanImage : null)
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
          potentialScore:   (() => {
            const physiqueUpside = aiResult.physiqueScore
              ? Math.max(0, (7.5 - (aiResult.physiqueScore.overall ?? 5)) * 0.30 * 0.3)
              : 0
            return Math.min(10, (aiResult.overallScore ?? 5) + 1.4 + physiqueUpside)
          })(),
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
      // Premium users see full results immediately; free users hit the unlock gate
      navigate(isPremium ? '/results' : '/unlock')
    } catch (err) {
      console.error('[Scan] startAnalysis error:', err?.message, err?.stack)
      if (err.message === 'hourly_cap_reached' || err.errorCode === 'hourly_cap_reached') {
        setScanCapPlan(err.plan || 'free')
        setScanCapReached(true)
        setStep(3)
      } else if (err.errorCode === 'claude_rate_limited') {
        // User hit their own hourly Claude limit — retrying in 30s won't help.
        // Show a static "limit reached" card instead of an auto-retry countdown.
        setClaudeRateLimited(true)
        setStep(3)
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
        setStep(3)
      }
    }
  }

  startAnalysisRef.current = startAnalysis

  const isAnalyzing = step === 4

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
        <title>AI Face Rating &amp; Looksmax Scan — Ascendus</title>
        <meta name="description" content="Upload your photo for an instant AI face rating, celebrity lookalike match, and personalized improvement plan. Get your free looksmax scan in under 60 seconds." />
        <meta name="keywords" content="face rating, AI face scan, looksmax scanner, appearance score, celebrity lookalike, face analyzer, glow up scan" />
      </Helmet>

      {/* Header — step 1 (Face Photo) gets a plain back-arrow + title header,
          no subtitle/progress-bar, so the photo frame below can dominate the
          screen instead of competing with a caption row. Other steps keep
          the existing PageHeader + progress-bar treatment. */}
      {!isAnalyzing && (
        step === 1 ? (
          <div
            className="flex items-center gap-3 px-4 pb-4 flex-shrink-0"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
          >
            <button
              onClick={() => { triggerHaptic(); navigate(-1) }}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
            >
              <ChevronLeft size={20} className="text-primary" />
            </button>
            <h1 className="font-heading font-bold text-[18px] text-primary">Take Your Front Photo</h1>
          </div>
        ) : (
          <PageHeader
            title={STEP_META[step]?.title ?? ''}
            subtitle={STEP_META[step]?.subtitle ?? ''}
            back
            // Body Photo (step 3) is a close (X), not a back-arrow — tapping
            // it exits the scan flow entirely (same convention as X buttons
            // elsewhere in onboarding, e.g. TrainingPlanIntro's BodyStatsFlow
            // close), rather than relying on navigate(-1)'s browser-history
            // default, which can land somewhere unrelated to this flow.
            icon={step === 3 ? X : undefined}
            onBack={step === 0 || step === 3 ? () => navigate('/scan') : undefined}
          />
        )
      )}

      {/* Progress bar (photo steps 2–3 only — step 1 uses its own plain header above) */}
      {step >= 2 && step <= 3 && (
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 h-1 rounded-full transition-colors duration-300"
                style={{ background: i <= step ? '#C6A85C' : 'var(--border)' }} />
            ))}
          </div>
          <p className="text-xs text-secondary font-body mt-1.5">
            {step === 2
              ? 'Turn 90° right · Relax jaw · Natural light · 3–6 ft from camera'
              : 'Full body visible · Stand straight · Good lighting · Fitted clothing'}
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="gender" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <GenderSelector selected={gender} onSelect={setLocalGender} />
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="face" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              {/* Photo and Live Face Scan are now both required, so taking a
                  photo must NOT clear an already-completed scan (or vice
                  versa) — they need to accumulate, not replace each other. */}
              <PhotoUploadStep stepNum={1} guide="Center your face in the oval. Neutral expression, eyes forward. Natural lighting — no harsh shadows." photo={facePhoto} onPhoto={url => { setFacePhoto(url); setError('') }} arScanDone={arScanDone} onLiveScan={handleLiveScan} gender={gender} arScanSkipped={arScanSkipped} onSkipScan={() => setArScanSkipped(true)} onScanningChange={setFaceScanBusy} />
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="body" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <PhotoUploadStep stepNum={3}
                guide="Stand facing the camera. Full body visible from head to feet. Good lighting, fitted clothing for accurate physique scoring."
                photo={bodyPhoto}
                gender={gender}
                onPhoto={url => { setBodyPhoto(url); setError('') }} />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="side" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <PhotoUploadStep stepNum={2}
                guide="Turn 90° to the right. Stand straight — arms relaxed at sides. 3–6 feet from camera. Natural lighting."
                photo={sidePhoto}
                arScanDone={arScanDone}
                onLiveScan={handleLiveScan}
                gender={gender}
                onPhoto={url => { setSidePhoto(url); setError('') }} />
            </motion.div>
          )}
          {isAnalyzing && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <AnalyzingScreen currentStep={analysisStep} slow={slowAnalysis} photo={facePhoto || lastFaceScanImage} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              <button onClick={() => { setScanCapReached(false); navigate('/premium') }} className="btn-amber w-full">Upgrade to Pro →</button>
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

          {/* Step 0: gender */}
          {step === 0 && (
            <button onClick={() => gender && setStep(1)} disabled={!gender} className={`btn-primary flex items-center justify-center gap-2 ${!gender ? 'opacity-50' : ''}`}>
              {gender ? <>Continue as {gender === 'male' ? 'Male' : 'Female'} <ArrowRight size={16} /></> : 'Select to continue'}
            </button>
          )}

          {/* Step 1 (face) has no CTA here anymore — PhotoUploadStep's own
              button handles capture/scan, and the useEffect above advances
              to step 2 automatically once facePhoto + geometrySatisfied are
              both true. See that effect for why it isn't just this button
              turned into an auto-fire — retakes need the faceScanBusy gate
              too. */}

          {/* Step 2: side profile → advance to body step. geometrySatisfied
              is already guaranteed true by the time anyone reaches this step
              (step 1's gate requires it), and there's no Live Face Scan
              action offered here anymore — so the only real requirement left
              is a photo. Skip Side Profile remains the escape hatch since
              this whole step is optional. */}
          {step === 2 && (
            <>
              {sidePhoto ? (
                <button
                  onClick={() => { setStep(3); setError('') }}
                  className="btn-amber"
                >
                  Continue →
                </button>
              ) : (
                <p className="text-center text-[11px] font-body mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Add a photo to continue
                </p>
              )}
              <button
                onClick={() => { setStep(3); setError('') }}
                className="w-full mt-2.5 flex items-center justify-center gap-2 active:opacity-70 transition-opacity"
                style={{
                  border: '1px solid rgba(201,168,76,0.4)',
                  background: 'transparent',
                  borderRadius: 10,
                  padding: '10px 14px',
                }}
              >
                <SkipForward size={14} style={{ color: '#C6A85C', flexShrink: 0 }} />
                <span className="font-heading text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Skip Side Profile
                </span>
              </button>
            </>
          )}

          {/* Step 3: body photo */}
          {step === 3 && (
            <>
              <button
                onClick={() => startAnalysis(!sidePhoto, false)}
                className="btn-amber"
                disabled={!bodyPhoto}
                style={!bodyPhoto ? { opacity: 0.55 } : {}}
              >
                {bodyPhoto ? '✦ Full Scan — Analyze Now' : 'Take or upload body photo first'}
              </button>
              <button
                onClick={() => startAnalysis(!sidePhoto, true)}
                className="w-full mt-3 flex items-center justify-center gap-3 active:opacity-70 transition-opacity"
                style={{
                  border: '3px solid #C6A85C',
                  background: 'rgba(201,168,76,0.04)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  boxShadow: '0 0 16px rgba(201,168,76,0.4)',
                }}
              >
                <SkipForward size={18} style={{ color: '#C6A85C', flexShrink: 0 }} />
                <div className="text-left">
                  <p className="font-heading text-[14px] leading-tight" style={{ color: '#ffffff', fontWeight: 600 }}>
                    Skip Body Photo
                  </p>
                  <p className="font-body text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Analyze face only
                  </p>
                </div>
              </button>
            </>
          )}

        </div>
      )}
    </div>
  )
}
