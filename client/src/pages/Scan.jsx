import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, CheckCircle2, Loader2, AlertCircle, X, RefreshCw, SkipForward, Lock, ArrowUpRight, ArrowRight, Gift, Target, Star, Zap, Map, User, UserRound } from 'lucide-react'
import useStore from '../store/useStore'
import { getTier } from '../utils/analysis'
import { api } from '../utils/api'
import { generatePlanTasks } from '../utils/content'
import { assignPhase } from '../utils/phase'
import PageHeader from '../components/PageHeader'
import sideProfileGuide from '../assets/side-profile-guide.png'
import bodyGuideMale from '../assets/body-guide-male.jpg'
import bodyGuideFemale from '../assets/body-guide-female.jpg'
import AIConsentModal, { hasAIConsent } from '../components/AIConsentModal'
import { takePhoto, pickPhoto, isNative } from '../utils/camera'
import { scheduleRescanNotification } from '../utils/notifications'

export const ANALYSIS_STEPS = [
  { label: 'Finding your strengths...', Icon: Target },
  { label: 'Matching celebrity lookalikes...', Icon: Star },
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

function FaceGuide() {
  return (
    <svg width="130" height="170" viewBox="0 0 130 170">
      <ellipse cx="65" cy="85" rx="52" ry="72" fill="none" stroke="#C6A85C" strokeWidth="2" strokeDasharray="8,5" opacity="0.8"/>
      <line x1="65" y1="5"   x2="65"  y2="165" stroke="#C6A85C" strokeWidth="1" opacity="0.25"/>
      <line x1="5"  y1="85"  x2="125" y2="85"  stroke="#C6A85C" strokeWidth="1" opacity="0.25"/>
      {/* Golden-ratio thirds */}
      <line x1="5" y1="50"  x2="125" y2="50"  stroke="#F5A623" strokeWidth="1" strokeDasharray="4,4" opacity="0.5"/>
      <line x1="5" y1="85"  x2="125" y2="85"  stroke="#F5A623" strokeWidth="1" strokeDasharray="4,4" opacity="0.5"/>
      <line x1="5" y1="120" x2="125" y2="120" stroke="#F5A623" strokeWidth="1" strokeDasharray="4,4" opacity="0.5"/>
      <text x="110" y="38"  fill="#F5A623" fontSize="8" opacity="0.7">⅓</text>
      <text x="110" y="73"  fill="#F5A623" fontSize="8" opacity="0.7">⅓</text>
      <text x="110" y="108" fill="#F5A623" fontSize="8" opacity="0.7">⅓</text>
    </svg>
  )
}


function SideGuide({ size = 'normal' }) {
  const maxW = size === 'small' ? 115 : size === 'overlay' ? 220 : 260
  return (
    <img
      src={sideProfileGuide}
      alt="Side profile alignment guide"
      style={{
        width: '85%',
        maxWidth: maxW,
        display: 'block',
        margin: '0 auto',
        mixBlendMode: 'screen',
        filter: 'contrast(1.4) brightness(1.1)',
      }}
    />
  )
}

// ─── Live Camera Overlay ──────────────────────────────────────────────────────

function CameraOverlay({ stepNum, onCapture, onClose }) {
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
                  <SideGuide size="overlay" />
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

// ─── Photo Upload Step ────────────────────────────────────────────────────────

export function PhotoUploadStep({ stepNum, guide, photo, onPhoto, gender }) {
  const uploadRef = useRef()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [error, setError] = useState('')

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
    <div className="flex flex-col h-full px-4">
      {cameraOpen && (
        <CameraOverlay stepNum={stepNum} onCapture={(url, blob) => { setCameraOpen(false); onPhoto(url, blob) }} onClose={() => setCameraOpen(false)} />
      )}

      {/* Preview / placeholder — pointer-events-none so nothing inside can block the buttons below */}
      <div className="relative flex-1 max-h-80 rounded-2xl overflow-hidden flex items-center justify-center mt-2 mb-4 pointer-events-none" style={{ background: stepNum === 3 ? '#0a0f22' : '#111827' }}>
        {photo ? (
          <>
            <img src={photo} alt="uploaded" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="w-14 h-14 rounded-full bg-[#C6A85C] flex items-center justify-center">
                <CheckCircle2 size={30} className="text-white" />
              </div>
            </div>
          </>
        ) : stepNum === 2 ? (
          <img
            src={sideProfileGuide}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ mixBlendMode: 'screen', filter: 'contrast(1.4) brightness(1.1)' }}
          />
        ) : stepNum === 3 ? (
          <img
            src={gender === 'female' ? bodyGuideFemale : bodyGuideMale}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 p-8">
            {stepNum === 1 && <FaceGuide />}
            <p className="text-white/60 text-xs text-center font-body max-w-[200px]">{guide}</p>
          </div>
        )}
        {/* Corner guides — decorative only */}
        {!photo && (
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

      <div className="grid grid-cols-2 gap-3 mb-1">
        <input ref={uploadRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(URL.createObjectURL(f), f) }} className="hidden" />
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
    </div>
  )
}

// ─── Analyzing Screen ─────────────────────────────────────────────────────────

export function AnalyzingScreen({ currentStep, slow }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="relative w-28 h-28 mb-8">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#C6A85C] border-r-[#C6A85C]/40" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-3 rounded-full border-transparent" style={{ borderWidth: 3, borderStyle: 'solid', borderTopColor: 'rgba(245,166,35,0.7)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span key={currentStep} initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center justify-center">
            {(() => { const S = ANALYSIS_STEPS[currentStep]?.Icon ?? Zap; return <S size={24} style={{ color: '#C6A85C' }} />; })()}
          </motion.span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {slow ? (
          <motion.div key="slow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 text-center">
            <h2 className="font-heading font-bold text-xl text-primary mb-1">Almost there…</h2>
            <p className="text-xs font-body" style={{ color: '#C6A85C' }}>Finalizing your full analysis</p>
          </motion.div>
        ) : (
          <motion.div key="normal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 text-center">
            <h2 className="font-heading font-bold text-xl text-primary mb-1">Analyzing…</h2>
            <p className="text-xs text-secondary font-body">Calculating your Overall Rating</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full space-y-2.5">
        {ANALYSIS_STEPS.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              i < currentStep ? 'bg-[#C6A85C]' : i === currentStep ? 'bg-[#F5A623]' : 'bg-gray-200 dark:bg-gray-700'
            }`}>
              {i < currentStep ? <CheckCircle2 size={11} className="text-white" /> :
               i === currentStep ? <Loader2 size={10} className="text-white animate-spin" /> :
               <div className="w-1.5 h-1.5 rounded-full bg-white/40" />}
            </div>
            <span className={`text-sm font-body ${i <= currentStep ? 'text-primary' : 'text-secondary'}`}>
              {s.label}{i < currentStep ? ' ✓' : ''}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
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
  const patchScanEnrichment = useStore(s => s.patchScanEnrichment)
  const setCurrentPlan    = useStore(s => s.setCurrentPlan)
  const setGender         = useStore(s => s.setGender)
  const incrementScanCount = useStore(s => s.incrementScanCount)
  const setAssignedPhase  = useStore(s => s.setAssignedPhase)
  const setLastScanDate   = useStore(s => s.setLastScanDate)
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
  const [analysisStep, setAnalysisStep]   = useState(0)
  const [slowAnalysis, setSlowAnalysis]   = useState(false)
  const [error, setError]                 = useState('')
  const [rateLimited, setRateLimited]     = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [scanCapReached, setScanCapReached] = useState(false)
  const [scanCapPlan, setScanCapPlan]     = useState('free')
  const [showConsent, setShowConsent]     = useState(() => !hasAIConsent())

  const startAnalysisRef = useRef(null)

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
      const faceB64 = await toBase64(facePhoto)
      setFacePhoto(faceB64) // upgrade blob URL → stable data URL so retries don't expire
      const sideB64 = (!skipSide && sidePhoto) ? await toBase64(sidePhoto) : null
      if (sideB64) setSidePhoto(sideB64)
      const bodyB64 = (!skipBody && bodyPhoto) ? await toBase64(bodyPhoto) : null
      if (bodyB64) setBodyPhoto(bodyB64)

      setAnalysisStep(1)
      setSlowAnalysis(false)
      const stageTimer = setInterval(() => setAnalysisStep(prev => prev < 3 ? prev + 1 : prev), 1800)
      const slowTimer  = setTimeout(() => setSlowAnalysis(true), 12000)

      let aiResult
      if (token === 'demo-token') {
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
          celebrityMatches: [{ name: 'Demo Match', score: 72, similarity: 0.72 }],
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

      setAnalysisStep(3)
      await new Promise(r => setTimeout(r, 350))
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
        celebrityMatches: aiResult.celebrityMatches ?? null,
        // Demo scans set celebrityMatches directly with no status field — treat
        // those as already resolved. Real scans come back 'pending' from /score
        // and get patched in place once /score/enrich resolves, below.
        celebrityStatus:  aiResult.celebrityStatus ?? 'resolved',
        physiqueScore:    aiResult.physiqueScore    ?? null,
        bodyFatLevel:     aiResult.bodyFatLevel     ?? null,
      }

      const assignedPh = assignPhase(aiResult.faceScore, userProfile?.goal)
      const tasks = generatePlanTasks(scanRecord.faceData, scanRecord.pillars, assignedPh, g)
      setCurrentPlan({ id: `plan-${Date.now()}`, scanId: scanRecord.id, tasks, createdAt: new Date().toISOString(), weekNumber: 1 })
      setPendingFacePhoto(faceB64)
      addScan(scanRecord)
      setCurrentScan(scanRecord)
      setAssignedPhase(assignedPh)

      // Celebrity match — resolved separately, off the critical path. Fired
      // here (not awaited) so it never delays navigation to results; when it
      // resolves it patches the scan record in place, wherever the user is.
      if (scanRecord.celebrityStatus === 'pending') {
        api.ai.scoreEnrich({ faceImage: faceB64, gender: g })
          .then(enrichResult => {
            patchScanEnrichment(scanRecord.id, {
              celebrityMatches: enrichResult.celebrityMatches,
              celebrityStatus:  enrichResult.celebrityStatus,
              aiScore: {
                ...scanRecord.aiScore,
                celebrityMatches: enrichResult.celebrityMatches,
                faceTraits:       enrichResult.faceTraits,
                celebrityStatus:  enrichResult.celebrityStatus,
              },
            })
          })
          .catch(() => {
            patchScanEnrichment(scanRecord.id, { celebrityStatus: 'failed' })
          })
      }

      // Persist to Supabase (non-blocking)
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
        celebrityMatches: aiResult.celebrityMatches,
        hairTypeDetected: aiResult.hairType,
        faceShape:        aiResult.facialStructure,
        gender:           g,
        assignedPhase:    assignedPh?.toLowerCase(),
        tasks,
      }).catch(() => {})

      setLastScanDate(new Date().toISOString())
      incrementScanCount()
      // Schedule rescan notification (14 days for free, 0 = cancelled for Pro)
      scheduleRescanNotification(isPremium ? 0 : 14).catch(() => {})
      // Premium users see full results immediately; free users hit the unlock gate
      navigate(isPremium ? '/results' : '/unlock')
    } catch (err) {
      console.error('[Scan] startAnalysis error:', err?.message, err?.stack)
      if (err.message === 'hourly_cap_reached') {
        setScanCapPlan(err.plan || 'free')
        setScanCapReached(true)
        setStep(3)
      } else {
        const m = (err.message || '').toLowerCase()
        const isRateLimit = err.message === 'rate_limited' || err.status === 429
          || m.includes('quota') || m.includes('exceeded') || m.includes('rate limit')
          || m.includes('rate_limit') || m.includes('too many') || m.includes('overloaded')
          || m.includes('capacity') || m.includes('credit') || m.includes('high demand')
          || m.includes('server_error')
        if (isRateLimit) {
          setRateLimited(true)
          setRetryCountdown(err.retryAfter || 30)
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

      {/* Header */}
      {!isAnalyzing && (
        <PageHeader title={STEP_META[step]?.title ?? ''} subtitle={STEP_META[step]?.subtitle ?? ''} back={step > 0} />
      )}

      {/* Progress bar (photo steps 1–3) */}
      {step >= 1 && step <= 3 && (
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 h-1 rounded-full transition-colors duration-300"
                style={{ background: i <= step ? '#C6A85C' : 'var(--border)' }} />
            ))}
          </div>
          <p className="text-xs text-secondary font-body mt-1.5">
            {step === 1
              ? 'Neutral expression · Face centered · Good lighting · No harsh shadows'
              : step === 2
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
              <PhotoUploadStep stepNum={1} guide="Center your face in the oval. Neutral expression, eyes forward. Natural lighting — no harsh shadows." photo={facePhoto} onPhoto={url => setFacePhoto(url)} />
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="body" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <div className="mx-4 mb-1 px-3 py-2 rounded-xl flex items-start gap-2.5"
                style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.2)' }}>
                <Zap size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#C6A85C' }} />
                <div>
                  <p className="text-[11px] font-heading font-bold text-primary leading-snug">Unlocks Physique Score</p>
                  <p className="text-[10px] text-secondary font-body leading-snug mt-0.5">
                    Proportions · Leanness · Frame · Posture · Presentation
                  </p>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(198,168,92,0.15)', color: '#C6A85C' }}>
                  OPTIONAL
                </span>
              </div>
              <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
                {[
                  { icon: '🧍', text: 'Full body visible' },
                  { icon: '📏', text: 'Stand straight' },
                  { icon: '👕', text: 'Fitted clothing' },
                  { icon: '☀️', text: 'Natural lighting' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span className="text-sm">{icon}</span>
                    <span className="text-[11px] font-body text-primary">{text}</span>
                  </div>
                ))}
              </div>
              <PhotoUploadStep stepNum={3}
                guide="Stand facing the camera. Full body visible from head to feet. Good lighting, fitted clothing for accurate physique scoring."
                photo={bodyPhoto}
                gender={gender}
                onPhoto={url => { setBodyPhoto(url); setError('') }} />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="side" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              {/* Side-profile tips banner */}
              <div className="mx-4 mb-1 px-3 py-2 rounded-xl flex items-start gap-2.5"
                style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.2)' }}>
                <ArrowUpRight size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-heading font-bold text-primary leading-snug">Unlocks Profile Analysis</p>
                  <p className="text-[10px] text-secondary font-body leading-snug mt-0.5">
                    Nose bridge · Jawline projection · Chin projection · Profile score
                  </p>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(198,168,92,0.15)', color: '#C6A85C' }}>
                  OPTIONAL
                </span>
              </div>
              {/* Pose guide chips */}
              <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
                {[
                  { icon: '→', text: 'Face right 90°' },
                  { icon: '🧍', text: 'Stand straight up' },
                  { icon: '💪', text: 'Arms at your sides' },
                  { icon: '☀️', text: 'Natural lighting' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span className="text-sm">{icon}</span>
                    <span className="text-[11px] font-body text-primary">{text}</span>
                  </div>
                ))}
              </div>
              <PhotoUploadStep stepNum={2}
                guide="Turn 90° to the right. Stand straight — arms relaxed at sides. 3–6 feet from camera. Natural lighting."
                photo={sidePhoto}
                onPhoto={url => { setSidePhoto(url); setError('') }} />
            </motion.div>
          )}
          {isAnalyzing && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
              <AnalyzingScreen currentStep={analysisStep} slow={slowAnalysis} />
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
                  strokeDashoffset={`${2 * Math.PI * 28 * (retryCountdown / 30)}`}
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

          {/* Step 1: face */}
          {step === 1 && (
            <button onClick={() => facePhoto && (setStep(2), setError(''))} disabled={!facePhoto}
              className={`btn-primary ${!facePhoto ? 'opacity-50' : ''}`}>
              {facePhoto ? 'Continue →' : 'Take or upload face photo first'}
            </button>
          )}

          {/* Step 2: side profile → advance to body step */}
          {step === 2 && (
            <>
              {sidePhoto && (
                <button
                  onClick={() => { setStep(3); setError('') }}
                  className="btn-amber"
                >
                  Continue →
                </button>
              )}
              <button
                onClick={() => { setStep(3); setError('') }}
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
                    Skip Side Profile
                  </p>
                  <p className="font-body text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Continue without side profile
                  </p>
                </div>
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
