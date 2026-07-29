import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, Target, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { api } from '../utils/api'
import { fileToResizedBase64 } from '../pages/WorkoutPlan'
import BodyStatsFlow from './BodyStatsStep'
import logo from '../assets/ascendus-icon.png'
import bodyGuideMale from '../assets/body-guide-male.jpg'
import bodyGuideFemale from '../assets/body-guide-female.jpg'

// ── 4-step intro that runs the first time a user opens Training Plan ─────────
// Replaces the old bare "Add Your Physique Photo" gate screen in
// WorkoutPlan.jsx with a proper welcome → stats → photo → generating sequence.
// Steps 2 (BodyStatsFlow) and the photo-analysis call in step 3/4 reuse
// existing components/endpoints rather than rebuilding them — this file is
// just the chrome (progress bar, step counter, welcome copy) tying them
// together. Same forced-dark palette as onboarding's step screens
// (OnboardingFinalSteps.jsx) since this is a similar "event" moment, distinct
// from the rest of this page which follows the user's light/dark setting.
const BG = '#080808'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.5)'
const STEP_TOTAL = 4

function StepChrome({ step, showStepLabel = true, children }) {
  const pct = (step / STEP_TOTAL) * 100
  return (
    <div className="relative flex flex-col h-full" style={{ background: BG }}>
      <div className="absolute top-0 left-0 right-0 h-0.5 z-20" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full"
          style={{ background: `linear-gradient(90deg, #A8893A, ${GOLD}, #D4B96A)` }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <img src={logo} alt="Ascendus" style={{ width: 20, height: 20, mixBlendMode: 'lighten', opacity: 0.65 }} />
      </div>
      {showStepLabel && (
        <div className="absolute right-5 z-20" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Step {step} of {STEP_TOTAL}
          </span>
        </div>
      )}
      {children}
    </div>
  )
}

function WelcomeStep({ onNext }) {
  return (
    <div className="flex-1 flex flex-col px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 72px)' }}>
      <div className="flex-1 flex flex-col justify-center items-center text-center gap-5">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.2)' }}
        >
          <Dumbbell size={36} style={{ color: GOLD }} />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-heading font-bold text-[26px] leading-tight"
          style={{ color: TEXT, letterSpacing: '-0.02em' }}
        >
          Welcome to your<br />Training Plan.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="font-body text-[14px] leading-relaxed"
          style={{ color: DIM }}
        >
          We'll scan your body and build workouts targeting your weak areas so you can look jacked in no time.
        </motion.p>
      </div>
      <div className="pb-10 pt-4">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { triggerHaptic(); onNext() }}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
          style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
        >
          Next <ArrowRight size={16} />
        </motion.button>
      </div>
    </div>
  )
}

function PhotoStep({ gender, onPhotoSelected, error, loading }) {
  const fileInputRef = useRef(null)
  const frameStyle = { width: '60vw', maxWidth: 260 }
  return (
    <div className="flex-1 flex flex-col px-8 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 40px)' }}>
      {/* Top-anchored group — step label, photo, and copy sit close together
          instead of being centered as one lump with empty space above/below.
          The step label shares the frame's own width so its left edge lines
          up with the frame's left edge even though both are horizontally
          centered as a unit by the parent's items-center. */}
      <div className="flex flex-col items-center gap-3">
        <div style={frameStyle} className="text-left">
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Step 3 of {STEP_TOTAL}
          </span>
        </div>
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ ...frameStyle, aspectRatio: '4 / 5', border: `1px solid ${GOLD}`, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
        >
          <img
            src={gender === 'female' ? bodyGuideFemale : bodyGuideMale}
            alt="Example body photo"
            className="w-full h-full object-cover object-top"
          />
          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full font-heading font-bold uppercase tracking-wide"
            style={{ fontSize: 9, color: GOLD, background: 'rgba(10,10,10,0.65)', border: `1px solid ${GOLD}` }}
          >
            Example
          </span>
        </div>
        <div className="space-y-1.5">
          <p className="font-heading font-bold text-[20px] leading-tight" style={{ color: TEXT }}>
            Add a photo of your body
          </p>
          <p className="font-body text-[13px] leading-relaxed" style={{ color: DIM }}>
            That's the only thing needed: take or upload one body photo and your plan is built from it.
          </p>
        </div>
      </div>

      <div className="flex-1" />

      <div className="pb-10 pt-4">
        {error && (
          <div className="w-full flex items-center gap-2 px-4 py-3 mb-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle size={15} style={{ color: '#EF4444', flexShrink: 0 }} />
            <p className="text-xs font-body flex-1 text-left" style={{ color: '#EF4444' }}>{error}</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPhotoSelected}
        />

        <motion.button
          whileTap={{ scale: loading ? 1 : 0.97 }}
          disabled={loading}
          onClick={() => { triggerHaptic(); fileInputRef.current?.click() }}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
          style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)', opacity: loading ? 0.6 : 1 }}
        >
          <Target size={16} />
          Take or Upload Body Photo
        </motion.button>
      </div>
    </div>
  )
}

function GeneratingStep({ error, onRetry }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
      {error ? (
        <>
          <AlertCircle size={36} style={{ color: '#EF4444' }} />
          <div className="space-y-1">
            <p className="font-heading font-bold text-[16px]" style={{ color: TEXT }}>Couldn't analyze your photo</p>
            <p className="font-body text-[13px]" style={{ color: DIM }}>{error}</p>
          </div>
          <button
            onClick={() => { triggerHaptic(); onRetry() }}
            className="mt-2 px-6 py-3 rounded-2xl font-heading font-bold text-[13px]"
            style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.3)', color: GOLD }}
          >
            Try Again
          </button>
        </>
      ) : (
        <>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <RefreshCw size={32} style={{ color: GOLD }} />
          </motion.div>
          <div>
            <p className="font-heading font-bold text-[16px]" style={{ color: TEXT }}>Analyzing your photo…</p>
            <p className="font-body text-[13px] mt-1" style={{ color: DIM }}>Building your personalized plan</p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TrainingPlanIntro({ gender, initialHeight, initialWeight, goal, onBodyStatsSave, onComplete, onClose }) {
  const [step, setStep] = useState(1)
  const [analysisError, setAnalysisError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setStep(4)
    setAnalyzing(true)
    setAnalysisError('')
    try {
      const bodyImage = await fileToResizedBase64(file)
      const { physiqueScore } = await api.ai.scorePhysique({ bodyImage, gender })
      onComplete(physiqueScore, bodyImage)
    } catch (err) {
      console.error('[TrainingPlanIntro] body scan failed:', err.message)
      setAnalysisError(
        err.errorCode === 'rate_limited' || err.status === 429
          ? 'High demand right now — please try again in a moment.'
          : err.message || 'Could not analyze your photo. Please try again.'
      )
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 dark"
    >
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE_STANDARD }} className="h-full">
            <StepChrome step={1}>
              <WelcomeStep onNext={() => setStep(2)} />
            </StepChrome>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE_STANDARD }} className="h-full">
            <StepChrome step={3} showStepLabel={false}>
              <PhotoStep gender={gender} onPhotoSelected={handlePhotoSelected} error={analysisError} loading={analyzing} />
            </StepChrome>
          </motion.div>
        )}
        {step === 4 && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE_STANDARD }} className="h-full">
            <StepChrome step={4}>
              <GeneratingStep error={analysisError} onRetry={() => setStep(3)} />
            </StepChrome>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 2 is the existing BodyStatsFlow component itself (full-screen,
          z-50 — above this wizard's own z-40 chrome) rather than a screen we
          render inside StepChrome; stepLabel/progressPct give it the same
          top bar/counter without touching its layout. onDone (Done button,
          after Save) advances the wizard; onClose (X, before saving) aborts
          the whole intro, same as X does everywhere else in the app. */}
      <AnimatePresence>
        {step === 2 && (
          <BodyStatsFlow
            initialHeight={initialHeight}
            initialWeight={initialWeight}
            goal={goal}
            onSave={onBodyStatsSave}
            onClose={onClose}
            onDone={() => setStep(3)}
            stepLabel={`STEP 2 OF ${STEP_TOTAL}`}
            progressPct={(2 / STEP_TOTAL) * 100}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
