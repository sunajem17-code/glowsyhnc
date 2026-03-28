import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, CheckCircle2, Loader2, AlertCircle, X, RefreshCw } from 'lucide-react'
import useStore from '../store/useStore'
import { performFullScan } from '../utils/analysis'
import { generatePlanTasks } from '../utils/content'
import PageHeader from '../components/PageHeader'

const ANALYSIS_STEPS = [
  { label: 'Mapping facial landmarks', emoji: '🎯' },
  { label: 'Analyzing canthal tilt & eye area', emoji: '👁️' },
  { label: 'Measuring facial thirds & proportions', emoji: '📐' },
  { label: 'Evaluating jaw structure & gonial angle', emoji: '💎' },
  { label: 'Scanning skin texture & clarity', emoji: '✨' },
  { label: 'Analyzing body posture & V-taper', emoji: '💪' },
  { label: 'Calculating your Glow Score', emoji: '🌟' },
]

// ─── Step 0: Gender Selector ─────────────────────────────────────────────────

function GenderSelector({ selected, onSelect }) {
  return (
    <div className="flex flex-col h-full px-4">
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-secondary font-body text-sm text-center mb-8 max-w-xs mx-auto">
          Glow Score benchmarks and tier labels differ for men and women.
          Select to get accurate results.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {[
            {
              key: 'male', emoji: '♂️', label: 'Male',
              tiers: 'Normie → Chadlite → Chad → Gigachad',
              metrics: 'Jaw, V-taper, canthal tilt, brow ridge',
              color: '#0984E3', bg: 'rgba(9,132,227,0.08)',
            },
            {
              key: 'female', emoji: '♀️', label: 'Female',
              tiers: 'LTB → MTB → HTB → Stacylite → Stacy',
              metrics: 'Cheekbones, skin, lip harmony, eye area',
              color: '#E84393', bg: 'rgba(232,67,147,0.08)',
            },
          ].map(({ key, emoji, label, tiers, metrics, color, bg }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(key)}
              className={`flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all duration-200`}
              style={{
                borderColor: selected === key ? color : 'var(--border)',
                background: selected === key ? bg : 'var(--card)',
              }}
            >
              <span className="text-4xl">{emoji}</span>
              <p className="font-heading font-bold text-base text-primary">{label}</p>
              <div className="text-center">
                <p className="text-[10px] text-secondary font-body leading-relaxed">{tiers}</p>
              </div>
              {selected === key && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: color }}
                >
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

// ─── Photo Upload Step ────────────────────────────────────────────────────────

function CameraOverlay({ stepNum, onCapture, onClose }) {
  const videoRef = useRef()
  const canvasRef = useRef()
  const streamRef = useRef()
  const [ready, setReady] = useState(false)
  const [facingMode, setFacingMode] = useState('user')
  const [error, setError] = useState('')

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
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
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(url, blob)
    }, 'image/jpeg', 0.92)
  }

  function flipCamera() {
    setReady(false)
    setFacingMode(m => m === 'user' ? 'environment' : 'user')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Live viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4">
            <AlertCircle size={40} className="text-warning" />
            <p className="text-white text-sm font-body">{error}</p>
            <button onClick={onClose} className="px-6 py-3 bg-white/10 rounded-2xl text-white text-sm font-heading font-bold">
              Go Back
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            {/* Guide overlay */}
            {ready && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {stepNum === 1 ? (
                  <svg width="180" height="240" viewBox="0 0 180 240" className="opacity-60">
                    <ellipse cx="90" cy="120" rx="72" ry="100" fill="none" stroke="#1A6B5C" strokeWidth="2.5" strokeDasharray="10,6"/>
                    <line x1="90" y1="10" x2="90" y2="230" stroke="white" strokeWidth="0.5" opacity="0.3"/>
                    <line x1="10" y1="120" x2="170" y2="120" stroke="white" strokeWidth="0.5" opacity="0.3"/>
                  </svg>
                ) : (
                  <svg width="120" height="260" viewBox="0 0 120 260" className="opacity-60">
                    <ellipse cx="60" cy="35" rx="24" ry="30" fill="none" stroke="#1A6B5C" strokeWidth="2.5" strokeDasharray="8,5"/>
                    <rect x="32" y="62" width="56" height="85" rx="8" fill="none" stroke="#1A6B5C" strokeWidth="2.5" strokeDasharray="8,5"/>
                    <rect x="16" y="65" width="18" height="72" rx="6" fill="none" stroke="#1A6B5C" strokeWidth="1.5" strokeDasharray="6,5" opacity="0.7"/>
                    <rect x="86" y="65" width="18" height="72" rx="6" fill="none" stroke="#1A6B5C" strokeWidth="1.5" strokeDasharray="6,5" opacity="0.7"/>
                    <rect x="37" y="145" width="18" height="100" rx="6" fill="none" stroke="#1A6B5C" strokeWidth="1.5" strokeDasharray="6,5" opacity="0.7"/>
                    <rect x="65" y="145" width="18" height="100" rx="6" fill="none" stroke="#1A6B5C" strokeWidth="1.5" strokeDasharray="6,5" opacity="0.7"/>
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

        {/* Flip camera */}
        {!error && (
          <button
            onClick={flipCamera}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
          >
            <RefreshCw size={18} className="text-white" />
          </button>
        )}
      </div>

      {/* Capture button */}
      {!error && (
        <div className="flex items-center justify-center py-8 bg-black">
          <button
            onClick={capture}
            disabled={!ready}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
          >
            <div className="w-14 h-14 rounded-full bg-white" />
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

function PhotoUploadStep({ stepNum, guide, photo, onPhoto }) {
  const uploadRef = useRef()
  const [cameraOpen, setCameraOpen] = useState(false)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (file) onPhoto(URL.createObjectURL(file), file)
  }

  function handleCapture(url, blob) {
    setCameraOpen(false)
    onPhoto(url, blob)
  }

  return (
    <div className="flex flex-col h-full px-4">
      {cameraOpen && (
        <CameraOverlay stepNum={stepNum} onCapture={handleCapture} onClose={() => setCameraOpen(false)} />
      )}

      <div className="relative flex-1 max-h-80 rounded-3xl overflow-hidden bg-gray-900 flex items-center justify-center mt-2 mb-4">
        {photo ? (
          <>
            <img src={photo} alt="uploaded" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <div className="w-14 h-14 rounded-full bg-[#1A6B5C] flex items-center justify-center">
                <CheckCircle2 size={30} className="text-white" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8">
            {stepNum === 1 ? (
              <svg width="130" height="170" viewBox="0 0 130 170">
                <ellipse cx="65" cy="85" rx="52" ry="72" fill="none" stroke="#1A6B5C" strokeWidth="2" strokeDasharray="8,5" opacity="0.8"/>
                <line x1="65" y1="5" x2="65" y2="165" stroke="#1A6B5C" strokeWidth="1" opacity="0.25"/>
                <line x1="5" y1="85" x2="125" y2="85" stroke="#1A6B5C" strokeWidth="1" opacity="0.25"/>
                <line x1="5" y1="50" x2="125" y2="50" stroke="#F5A623" strokeWidth="1" strokeDasharray="4,4" opacity="0.5"/>
                <line x1="5" y1="85" x2="125" y2="85" stroke="#F5A623" strokeWidth="1" strokeDasharray="4,4" opacity="0.5"/>
                <line x1="5" y1="120" x2="125" y2="120" stroke="#F5A623" strokeWidth="1" strokeDasharray="4,4" opacity="0.5"/>
                <text x="110" y="38" fill="#F5A623" fontSize="8" opacity="0.7">⅓</text>
                <text x="110" y="73" fill="#F5A623" fontSize="8" opacity="0.7">⅓</text>
                <text x="110" y="108" fill="#F5A623" fontSize="8" opacity="0.7">⅓</text>
              </svg>
            ) : (
              <svg width="90" height="185" viewBox="0 0 90 185">
                <ellipse cx="45" cy="25" rx="18" ry="22" fill="none" stroke="#1A6B5C" strokeWidth="2" strokeDasharray="6,4" opacity="0.8"/>
                <rect x="24" y="44" width="42" height="62" rx="6" fill="none" stroke="#1A6B5C" strokeWidth="2" strokeDasharray="6,4" opacity="0.8"/>
                <rect x="10" y="47" width="15" height="54" rx="5" fill="none" stroke="#1A6B5C" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.6"/>
                <rect x="65" y="47" width="15" height="54" rx="5" fill="none" stroke="#1A6B5C" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.6"/>
                <rect x="28" y="104" width="13" height="68" rx="5" fill="none" stroke="#1A6B5C" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.6"/>
                <rect x="49" y="104" width="13" height="68" rx="5" fill="none" stroke="#1A6B5C" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.6"/>
                <line x1="10" y1="52" x2="80" y2="52" stroke="#F5A623" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"/>
                <line x1="24" y1="80" x2="66" y2="80" stroke="#F5A623" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"/>
              </svg>
            )}
            <p className="text-white/60 text-xs text-center font-body max-w-[180px]">{guide}</p>
          </div>
        )}
        {!photo && (
          <>
            {[['top-3 left-3', true, false, true, false],
              ['top-3 right-3', true, false, false, true],
              ['bottom-3 left-3', false, true, true, false],
              ['bottom-3 right-3', false, true, false, true]].map(([pos, t, b, l, r], i) => (
              <div key={i} className={`absolute ${pos} w-6 h-6`} style={{
                borderTopWidth: t ? 2 : 0, borderBottomWidth: b ? 2 : 0,
                borderLeftWidth: l ? 2 : 0, borderRightWidth: r ? 2 : 0,
                borderColor: '#1A6B5C', borderStyle: 'solid',
                borderRadius: `${t && l ? 4 : 0}px ${t && r ? 4 : 0}px ${b && r ? 4 : 0}px ${b && l ? 4 : 0}px`,
              }} />
            ))}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-1">
        <input ref={uploadRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <button
          onClick={() => setCameraOpen(true)}
          className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-card border-2 border-dashed border-[#1A6B5C] active:scale-95 transition-transform"
        >
          <Camera size={20} className="text-[#1A6B5C]" />
          <span className="text-xs font-heading font-bold text-[#1A6B5C]">Take Photo</span>
        </button>
        <button
          onClick={() => uploadRef.current?.click()}
          className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-card border-2 border-dashed border-default active:scale-95 transition-transform"
        >
          <Upload size={20} className="text-secondary" />
          <span className="text-xs font-heading font-bold text-secondary">Upload Photo</span>
        </button>
      </div>
    </div>
  )
}

// ─── Analyzing Screen ─────────────────────────────────────────────────────────

function AnalyzingScreen({ currentStep }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="relative w-28 h-28 mb-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1A6B5C] border-r-[#1A6B5C]/40"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-3 rounded-full border-3 border-transparent border-t-[#F5A623]/70"
          style={{ borderWidth: 3 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span key={currentStep} initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-2xl">
            {ANALYSIS_STEPS[currentStep]?.emoji ?? '✨'}
          </motion.span>
        </div>
      </div>

      <h2 className="font-heading font-bold text-xl text-primary mb-1">Analyzing…</h2>
      <p className="text-xs text-secondary font-body mb-6">Calculating your Glow Score</p>

      <div className="w-full space-y-2.5">
        {ANALYSIS_STEPS.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              i < currentStep ? 'bg-[#1A6B5C]' : i === currentStep ? 'bg-[#F5A623]' : 'bg-gray-200 dark:bg-gray-700'
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

const STEP_META = [
  { title: 'Select Gender', subtitle: 'For accurate Glow Score results' },
  { title: 'Face Photo', subtitle: 'Step 1 of 2 — Face' },
  { title: 'Body Photo', subtitle: 'Step 2 of 2 — Full Body' },
]

export default function Scan() {
  const navigate = useNavigate()
  const { setPendingFacePhoto, setPendingBodyPhoto, addScan, setCurrentScan, setCurrentPlan, gender: savedGender, setGender } = useStore()

  const [step, setStep] = useState(0)           // 0=gender, 1=face, 2=body, 3=analyzing
  const [gender, setLocalGender] = useState(savedGender ?? null)
  const [facePhoto, setFacePhoto] = useState(null)
  const [bodyPhoto, setBodyPhoto] = useState(null)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [error, setError] = useState('')

  function handleGenderSelect(g) { setLocalGender(g) }

  async function startAnalysis() {
    const g = gender ?? 'male'
    setGender(g)
    setStep(3)
    setError('')
    try {
      const result = await performFullScan(facePhoto, bodyPhoto, g, (stepIdx) => setAnalysisStep(stepIdx))
      const scanRecord = {
        id: `scan-${Date.now()}`,
        scanDate: new Date().toISOString(),
        facePhotoUrl: facePhoto,
        bodyPhotoUrl: bodyPhoto,
        ...result,
      }
      const tasks = generatePlanTasks(result.faceData, result.bodyData)
      setCurrentPlan({ id: `plan-${Date.now()}`, scanId: scanRecord.id, tasks, createdAt: new Date().toISOString(), weekNumber: 1 })
      setPendingFacePhoto(facePhoto)
      setPendingBodyPhoto(bodyPhoto)
      addScan(scanRecord)
      setCurrentScan(scanRecord)
      navigate('/results')
    } catch (err) {
      console.error(err)
      setError('Analysis failed. Please try with a clearer photo in good lighting.')
      setStep(2)
    }
  }

  const isAnalyzing = step === 3
  const totalPhotoSteps = 2
  const photoProgress = step - 1 // 0 or 1 once on photo steps

  return (
    <div className="flex flex-col h-full bg-page">
      {/* Header */}
      {!isAnalyzing && (
        <PageHeader
          title={STEP_META[step]?.title ?? ''}
          subtitle={STEP_META[step]?.subtitle ?? ''}
          back={step > 0}
        />
      )}

      {/* Progress bar (photo steps only) */}
      {step >= 1 && step <= 2 && (
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            {[1, 2].map(i => (
              <div key={i} className="flex-1 h-1 rounded-full transition-colors duration-300"
                style={{ background: i <= step ? '#1A6B5C' : 'var(--border)' }} />
            ))}
          </div>
          <p className="text-xs text-secondary font-body mt-1.5">
            {step === 1
              ? 'Neutral expression · Face centered · Good lighting · No harsh shadows'
              : 'Full silhouette visible · Arms slightly out · Front-facing · 6–8 ft from camera'}
          </p>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="gender" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <GenderSelector selected={gender} onSelect={handleGenderSelect} />
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="face" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <PhotoUploadStep
                stepNum={1}
                guide="Center your face in the oval. Neutral expression, eyes forward. Natural lighting — no harsh shadows."
                photo={facePhoto}
                onPhoto={(url) => setFacePhoto(url)}
              />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="body" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="h-full">
              <PhotoUploadStep
                stepNum={2}
                guide="Full silhouette visible. Straight posture, arms slightly out. Front-facing. 6–8 feet from camera."
                photo={bodyPhoto}
                onPhoto={(url) => setBodyPhoto(url)}
              />
            </motion.div>
          )}
          {isAnalyzing && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
              <AnalyzingScreen currentStep={analysisStep} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200">
            <AlertCircle size={15} className="text-warning flex-shrink-0" />
            <p className="text-sm text-warning font-body">{error}</p>
          </div>
        </div>
      )}

      {/* CTA */}
      {!isAnalyzing && (
        <div className="px-4 pb-8 pt-2">
          {step === 0 && (
            <button
              onClick={() => gender && setStep(1)}
              disabled={!gender}
              className={`btn-primary ${!gender ? 'opacity-50' : ''}`}
            >
              {gender ? `Continue as ${gender === 'male' ? '♂ Male' : '♀ Female'} →` : 'Select to continue'}
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => facePhoto && setStep(2)}
              disabled={!facePhoto}
              className={`btn-primary ${!facePhoto ? 'opacity-50' : ''}`}
            >
              {facePhoto ? 'Continue → Body Photo' : 'Take or upload face photo first'}
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => bodyPhoto && startAnalysis()}
              disabled={!bodyPhoto}
              className={`btn-amber ${!bodyPhoto ? 'opacity-50' : ''}`}
            >
              {bodyPhoto ? '🌟 Analyze & Get My Glow Score' : 'Take or upload body photo first'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
