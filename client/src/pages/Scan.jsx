import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, CheckCircle2, Loader2, AlertCircle, X, RefreshCw, SkipForward } from 'lucide-react'
import useStore from '../store/useStore'
import { getTier } from '../utils/analysis'
import { api } from '../utils/api'
import { generatePlanTasks } from '../utils/content'
import { assignPhase } from '../utils/phase'
import PageHeader from '../components/PageHeader'

const ANALYSIS_STEPS = [
  { label: 'Scanning facial structure...', emoji: '🎯' },
  { label: 'Matching celebrity lookalikes...', emoji: '⭐' },
  { label: 'Calculating your score...', emoji: '⚡' },
  { label: 'Building your roadmap...', emoji: '🗺️' },
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
            { key: 'male',   emoji: '♂️', label: 'Male',   tiers: 'Normie → Chadlite → Chad → Gigachad', metrics: 'Jaw, V-taper, canthal tilt, brow ridge', color: '#0984E3', bg: 'rgba(9,132,227,0.08)' },
            { key: 'female', emoji: '♀️', label: 'Female', tiers: 'LTB → MTB → HTB → Stacylite → Stacy', metrics: 'Cheekbones, skin, lip harmony, eye area',   color: '#E84393', bg: 'rgba(232,67,147,0.08)' },
          ].map(({ key, emoji, label, tiers, color, bg }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(key)}
              className="flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all duration-200"
              style={{ borderColor: selected === key ? color : 'var(--border)', background: selected === key ? bg : 'var(--card)' }}
            >
              <span className="text-4xl">{emoji}</span>
              <p className="font-heading font-bold text-base text-primary">{label}</p>
              <p className="text-[10px] text-secondary font-body leading-relaxed text-center">{tiers}</p>
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


// Side-profile silhouette: anatomical head facing right (forehead, nose, chin clearly visible)
function SideGuide({ size = 'normal' }) {
  const scale = size === 'small' ? 0.72 : 1
  const W = Math.round(110 * scale)
  const H = Math.round(165 * scale)
  return (
    <svg width={W} height={H} viewBox="0 0 110 165">
      {/* Skull / back of head — solid gold, left side */}
      <path
        d="M 50 12
           C 38 8 18 18 13 36
           C 10 52 10 72 14 90
           C 16 100 22 110 30 118
           C 38 126 50 134 60 137
           C 68 138 76 134 82 126
           C 86 118 88 110 86 103
           C 84 96 83 90 83 85
           C 83 80 88 74 104 72
           C 108 66 106 56 96 50
           C 88 44 82 36 80 28
           C 78 20 70 14 60 12
           C 56 11 52 12 50 12 Z"
        fill="none"
        stroke="#C9A84C"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.92"
      />
      {/* Nose bridge annotation */}
      <line x1="93" y1="52" x2="108" y2="47" stroke="#F5A623" strokeWidth="1" strokeDasharray="3,3" opacity="0.55"/>
      {/* Chin projection annotation */}
      <line x1="65" y1="138" x2="65" y2="152" stroke="#F5A623" strokeWidth="1" strokeDasharray="3,3" opacity="0.55"/>
      {/* "Face right" direction indicator */}
      <text x="66" y="11" fill="#C9A84C" fontSize="12" opacity="0.85" fontWeight="bold">→</text>
    </svg>
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
                  /* Side-profile guide — anatomical head facing right */
                  <svg width="170" height="220" viewBox="0 0 170 220" className="opacity-72">
                    {/* Full side-profile silhouette — solid gold, no dashes */}
                    <path
                      d="M 76 18
                         C 58 12 28 28 20 54
                         C 15 78 15 108 22 134
                         C 26 150 34 164 46 176
                         C 58 186 76 196 92 198
                         C 104 198 116 192 124 180
                         C 132 170 134 158 130 148
                         C 128 138 126 128 126 120
                         C 126 112 132 106 150 100
                         C 154 94 148 82 134 72
                         C 124 62 116 50 112 38
                         C 108 26 100 16 88 14
                         C 84 13 78 18 76 18 Z"
                      fill="none"
                      stroke="#C9A84C"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity="0.9"
                    />
                    {/* Nose bridge annotation */}
                    <line x1="132" y1="74" x2="150" y2="68" stroke="#F5A623" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6"/>
                    {/* Chin annotation */}
                    <line x1="92" y1="198" x2="92" y2="214" stroke="#F5A623" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6"/>
                    {/* Subtle crosshairs */}
                    <line x1="85"  y1="10"  x2="85"  y2="210" stroke="white" strokeWidth="0.5" opacity="0.18"/>
                    <line x1="10"  y1="106" x2="160" y2="106" stroke="white" strokeWidth="0.5" opacity="0.18"/>
                    {/* "Face right" arrow */}
                    <text x="134" y="56" fill="#C9A84C" fontSize="22" opacity="0.9" fontWeight="bold">→</text>
                  </svg>
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
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
        >
          <X size={20} className="text-white" />
        </button>

        {/* Flip */}
        {!error && (
          <button onClick={() => { setReady(false); setFacingMode(m => m === 'user' ? 'environment' : 'user') }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
            <RefreshCw size={18} className="text-white" />
          </button>
        )}
      </div>

      {/* Capture button */}
      {!error && (
        <div className="flex items-center justify-center py-8 bg-black">
          <button onClick={capture} disabled={!ready}
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

function PhotoUploadStep({ stepNum, guide, photo, onPhoto }) {
  const uploadRef = useRef()
  const [cameraOpen, setCameraOpen] = useState(false)

  return (
    <div className="flex flex-col h-full px-4">
      {cameraOpen && (
        <CameraOverlay stepNum={stepNum} onCapture={(url, blob) => { setCameraOpen(false); onPhoto(url, blob) }} onClose={() => setCameraOpen(false)} />
      )}

      {/* Preview / placeholder */}
      <div className="relative flex-1 max-h-80 rounded-3xl overflow-hidden bg-gray-900 flex items-center justify-center mt-2 mb-4">
        {photo ? (
          <>
            <img src={photo} alt="uploaded" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="w-14 h-14 rounded-full bg-[#C6A85C] flex items-center justify-center">
                <CheckCircle2 size={30} className="text-white" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8">
            {stepNum === 1 ? <FaceGuide /> : <SideGuide />}
            <p className="text-white/60 text-xs text-center font-body max-w-[200px]">{guide}</p>
          </div>
        )}
        {/* Corner guides when empty */}
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

      <div className="grid grid-cols-2 gap-3 mb-1">
        <input ref={uploadRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onPhoto(URL.createObjectURL(f), f) }} className="hidden" />
        {/* Take Photo — solid gold border */}
        <button
          onClick={() => setCameraOpen(true)}
          className="flex flex-col items-center gap-2 py-4 active:scale-95 transition-transform"
          style={{
            background: 'rgba(201,168,76,0.06)',
            border: '2px solid #C9A84C',
            borderRadius: 12,
            boxShadow: '0 0 12px rgba(201,168,76,0.3)',
          }}
        >
          <Camera size={20} style={{ color: '#C9A84C' }} />
          <span className="text-xs font-heading font-bold text-white">Take Photo</span>
        </button>
        {/* Upload Photo — identical gold border, no greyed-out look */}
        <button
          onClick={() => uploadRef.current?.click()}
          className="flex flex-col items-center gap-2 py-4 active:scale-95 transition-transform"
          style={{
            background: 'rgba(201,168,76,0.06)',
            border: '2px solid #C9A84C',
            borderRadius: 12,
            boxShadow: '0 0 12px rgba(201,168,76,0.3)',
          }}
        >
          <Upload size={20} style={{ color: '#C9A84C' }} />
          <span className="text-xs font-heading font-bold text-white">Upload Photo</span>
        </button>
      </div>
    </div>
  )
}

// ─── Analyzing Screen ─────────────────────────────────────────────────────────

function AnalyzingScreen({ currentStep, slow }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="relative w-28 h-28 mb-8">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#C6A85C] border-r-[#C6A85C]/40" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-3 rounded-full border-transparent" style={{ borderWidth: 3, borderStyle: 'solid', borderTopColor: 'rgba(245,166,35,0.7)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span key={currentStep} initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-2xl">
            {ANALYSIS_STEPS[currentStep]?.emoji ?? '✨'}
          </motion.span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {slow ? (
          <motion.div key="slow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 text-center">
            <h2 className="font-heading font-bold text-xl text-primary mb-1">Still analyzing…</h2>
            <p className="text-xs font-body" style={{ color: '#C6A85C' }}>Almost there — high demand right now</p>
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
// Steps: 0=gender  1=face  2=side-profile  3=analyzing

const STEP_META = [
  { title: 'Select Gender',  subtitle: 'For accurate Overall Rating results' },
  { title: 'Face Photo',     subtitle: 'Take your photo' },
  { title: 'Side Profile',   subtitle: 'Optional · Unlocks profile analysis' },
]

export default function Scan() {
  const navigate = useNavigate()
  const {
    setPendingFacePhoto, addScan, setCurrentScan, setCurrentPlan,
    gender: savedGender, setGender, isPremium, scanCount, incrementScanCount,
    setAssignedPhase, userProfile, lastScanDate, setLastScanDate,
  } = useStore()

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
  const [analysisStep, setAnalysisStep]   = useState(0)
  const [slowAnalysis, setSlowAnalysis]   = useState(false)
  const [error, setError]                 = useState('')
  const [rateLimited, setRateLimited]     = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [scanCapReached, setScanCapReached] = useState(false)
  const [scanCapPlan, setScanCapPlan]     = useState('free')

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
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="font-heading font-bold text-xl text-primary mb-2">Scan Limit Reached</h2>
        <p className="text-secondary text-sm font-body mb-2">
          Free users get 1 scan per month. Your next free scan resets{' '}
          {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
        </p>
        <p className="text-secondary text-sm font-body mb-6">Upgrade to Pro for unlimited scans.</p>
        <button onClick={() => navigate('/premium')} className="btn-primary mb-3 max-w-xs">Unlock Unlimited Scans →</button>
        <button onClick={() => navigate('/referral')} className="text-sm font-heading font-bold" style={{ color: '#C6A85C' }}>
          🎁 Or share with 5 friends for 7 days free
        </button>
      </div>
    )
  }

  // Convert an image URL (blob: or data:) to a resized base64 string
  async function toBase64(url, maxPx = 1024) {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const w = Math.round(img.width  * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = URL.createObjectURL(blob)
    })
  }

  // skipSideOverride — set true when user taps "Skip Side Profile"
  async function startAnalysis(skipSideOverride = false) {
    if (isFreeScanBlocked) { navigate('/premium'); return }

    const skipSide = skipSideOverride
    const g        = gender ?? 'male'
    setGender(g)
    setStep(3)  // analyzing
    setError('')
    setAnalysisStep(0)

    try {
      const faceB64 = await toBase64(facePhoto)
      const sideB64 = (!skipSide && sidePhoto) ? await toBase64(sidePhoto) : null

      setAnalysisStep(1)
      setSlowAnalysis(false)
      const stageTimer = setInterval(() => setAnalysisStep(prev => prev < 3 ? prev + 1 : prev), 1800)
      const slowTimer  = setTimeout(() => setSlowAnalysis(true), 12000)

      let aiResult
      try {
        const scoreCall = api.ai.score({
          faceImage: faceB64,
          ...(sideB64 ? { sideImage: sideB64 } : {}),
          gender: g,
        })
        const timeoutCall = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Analysis timed out — please try again')), 120_000)
        )
        aiResult = await Promise.race([scoreCall, timeoutCall])
      } finally {
        clearInterval(stageTimer)
        clearTimeout(slowTimer)
        setSlowAnalysis(false)
      }

      setAnalysisStep(3)
      await new Promise(r => setTimeout(r, 350))
      setAnalysisStep(4)

      console.info('[Scan] AI score:', aiResult.overallScore, aiResult.tier, '| side:', aiResult.hasSideProfile)

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
      }

      const assignedPh = assignPhase(aiResult.faceScore, userProfile?.goal)
      const tasks = generatePlanTasks(scanRecord.faceData, scanRecord.pillars, assignedPh, g)
      setCurrentPlan({ id: `plan-${Date.now()}`, scanId: scanRecord.id, tasks, createdAt: new Date().toISOString(), weekNumber: 1 })
      setPendingFacePhoto(faceB64)
      addScan(scanRecord)
      setCurrentScan(scanRecord)
      setAssignedPhase(assignedPh)

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
        potentialScore:   Math.min(10, (aiResult.overallScore ?? 5) + 1.4),
        celebrityMatches: aiResult.celebrityMatches,
        hairTypeDetected: aiResult.hairType,
        faceShape:        aiResult.facialStructure,
        gender:           g,
        assignedPhase:    assignedPh?.toLowerCase(),
        tasks,
      }).catch(err => console.warn('[Supabase] Scan save failed (non-fatal):', err.message))

      setLastScanDate(new Date().toISOString())
      incrementScanCount()
      navigate('/results')
    } catch (err) {
      console.error('[Scan] AI scoring failed:', err)
      if (err.message === 'hourly_cap_reached') {
        setScanCapPlan(err.plan || 'free')
        setScanCapReached(true)
        setStep(2)
      } else if (err.message === 'rate_limited') {
        setRateLimited(true)
        setRetryCountdown(err.retryAfter || 60)
        setStep(2)
      } else {
        setError('Analysis unavailable right now. Please try again in a minute.')
        setStep(2)
      }
    }
  }

  startAnalysisRef.current = startAnalysis

  const isAnalyzing = step === 3

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

      {/* Progress bar (photo steps 1–2) */}
      {step >= 1 && step <= 2 && (
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            {[1, 2].map(i => (
              <div key={i} className="flex-1 h-1 rounded-full transition-colors duration-300"
                style={{ background: i <= step ? '#C6A85C' : 'var(--border)' }} />
            ))}
          </div>
          <p className="text-xs text-secondary font-body mt-1.5">
            {step === 1
              ? 'Neutral expression · Face centered · Good lighting · No harsh shadows'
              : 'Turn 90° right · Relax jaw · Natural light · 3–6 ft from camera'}
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
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
          {step === 2 && (
            <motion.div key="side" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              {/* Side-profile tips banner */}
              <div className="mx-4 mb-1 px-3 py-2 rounded-xl flex items-start gap-2.5"
                style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.2)' }}>
                <span className="text-base flex-shrink-0 mt-0.5">↗️</span>
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
              <PhotoUploadStep stepNum={2}
                guide="Turn 90° to the right. Keep your face relaxed and neutral. 3–6 feet from camera."
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
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #C6A85C, #F5A623)' }} />
            <div className="px-6 pt-6 pb-7 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ background: 'rgba(201,168,76,0.12)' }}>🔒</div>
              <div>
                <h3 className="font-heading font-bold text-lg text-primary leading-snug">
                  {scanCapPlan === 'demo' ? 'Demo scan limit reached' : 'Free scan limit reached'}
                </h3>
                <p className="text-sm text-secondary font-body mt-2 leading-relaxed">
                  {scanCapPlan === 'demo'
                    ? 'Create a free account to get more scans, or upgrade to Pro for unlimited access.'
                    : "You've hit your free scan limit for this period. Upgrade to Pro for unlimited scans."}
                </p>
              </div>
              <button onClick={() => { setScanCapReached(false); navigate('/premium') }} className="btn-amber w-full">Upgrade to Pro →</button>
              <button onClick={() => setScanCapReached(false)} className="text-sm font-heading font-bold text-secondary active:opacity-60 transition-opacity">Remind me later</button>
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
          </div>
        </div>
      )}

      {/* CTAs */}
      {!isAnalyzing && (
        <div className="px-4 pb-8 pt-2">

          {/* Step 0: gender */}
          {step === 0 && (
            <button onClick={() => gender && setStep(1)} disabled={!gender} className={`btn-primary ${!gender ? 'opacity-50' : ''}`}>
              {gender ? `Continue as ${gender === 'male' ? '♂ Male' : '♀ Female'} →` : 'Select to continue'}
            </button>
          )}

          {/* Step 1: face */}
          {step === 1 && (
            <button onClick={() => facePhoto && (setStep(2), setError(''))} disabled={!facePhoto}
              className={`btn-primary ${!facePhoto ? 'opacity-50' : ''}`}>
              {facePhoto ? 'Continue →' : 'Take or upload face photo first'}
            </button>
          )}

          {/* Step 2: side profile */}
          {step === 2 && (
            <>
              {/* Full Scan — solid gold border + glow */}
              <button
                onClick={() => startAnalysis(false)}
                className="btn-amber"
                disabled={!sidePhoto}
                style={!sidePhoto ? { opacity: 0.55 } : {}}
              >
                {sidePhoto ? '✦ Full Scan — Analyze Now' : 'Take or upload side profile first'}
              </button>
              {/* Skip Side Profile — thicker gold border, 16px vertical padding, glow */}
              <button
                onClick={() => startAnalysis(true)}
                className="w-full mt-3 flex items-center justify-center gap-3 active:opacity-70 transition-opacity"
                style={{
                  border: '3px solid #C9A84C',
                  background: 'rgba(201,168,76,0.04)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  boxShadow: '0 0 16px rgba(201,168,76,0.4)',
                }}
              >
                <SkipForward size={18} style={{ color: '#C9A84C', flexShrink: 0 }} />
                <div className="text-left">
                  <p className="font-heading text-[14px] leading-tight" style={{ color: '#ffffff', fontWeight: 600 }}>
                    Skip Side Profile
                  </p>
                  <p className="font-body text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Analyze face only (Basic Scan)
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
