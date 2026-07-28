import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Dumbbell, Zap, Flame, Target } from 'lucide-react'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

// Moved out of PremiumOnboarding.jsx along with StepHeightWeight/StepPhaseResult
// — body stats are now collected in WorkoutPlan.jsx instead of during
// onboarding. This BMI-based CUT/BULK/RECOMP/MAINTENANCE result is distinct
// from utils/phase.js's assignPhase(faceScore, goal) (LEAN/SCULPT/TRANSFORM/
// REFINE), which is the vocabulary the rest of the app (ActionPlan.jsx,
// generatePlanTasks) actually reads off the store's assignedPhase field. This
// one only ever drives the result card shown right here, right after a user
// enters their stats — it's never written to assignedPhase.
export function calculatePhase(goal, heightCm, weightKg) {
  const bmi = weightKg / Math.pow(heightCm / 100, 2)
  if (goal === 'Maintain') return 'MAINTENANCE'
  if (goal === 'Lose Fat' || bmi > 27) return 'CUT'
  if (goal === 'Build Muscle' && bmi < 22) return 'BULK'
  return 'RECOMP'
}

const PHASE_INFO = {
  CUT: {
    PhaseIcon: Flame,
    label: 'CUT',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    headline: 'Your Phase: Cut',
    why: 'Based on your goal and body stats, losing body fat is your highest-leverage move. Reducing body fat will reveal your jawline, V-taper, and muscle definition — directly boosting your score.',
    actions: ['500 cal/day deficit', '0.8–1g protein per lb', 'Cardio 3× per week', 'Strength training 4× per week'],
  },
  BULK: {
    PhaseIcon: Dumbbell,
    label: 'BULK',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    headline: 'Your Phase: Bulk',
    why: 'Your stats show you have room to build mass. Adding muscle to your frame will improve your V-taper, broaden your shoulders, and elevate your overall physique score significantly.',
    actions: ['250–300 cal/day surplus', '0.8–1g protein per lb', 'Compound lifts 4–5× per week', 'Focus on progressive overload'],
  },
  RECOMP: {
    PhaseIcon: Zap,
    label: 'RECOMP',
    color: GOLD,
    bg: 'rgba(198,168,92,0.08)',
    border: 'rgba(198,168,92,0.25)',
    headline: 'Your Phase: Recomp',
    why: "You're in the ideal zone to recompose — lose fat and build muscle simultaneously. This is the most effective phase for improving your overall appearance rating.",
    actions: ['Maintenance calories (±100)', '1g protein per lb bodyweight', 'Strength training 4× per week', 'Track weekly photos for progress'],
  },
  MAINTENANCE: {
    PhaseIcon: Target,
    label: 'MAINTENANCE',
    color: '#34C759',
    bg: 'rgba(52,199,89,0.08)',
    border: 'rgba(52,199,89,0.25)',
    headline: 'Your Phase: Maintenance',
    why: "You're happy with your current physique. Your plan focuses on consistency, optimizing grooming, skincare, and posture — the highest ROI improvements at your level.",
    actions: ['Maintenance calories', 'Strength training 3–4× per week', 'Focus on grooming & skincare', 'Posture correction protocol'],
  },
}

// Same pointer-drag + keyboard slider mechanics as PremiumOnboarding.jsx's
// Slider — reskinned to the app's live-app theme tokens (GOLD, text-primary/
// text-secondary) instead of onboarding's forced-dark palette, since this
// renders inside WorkoutPlan.jsx which supports light/dark mode.
function BodyStatsSlider({ label, unit, value, displayValue, min, max, step = 1, onChange }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const pct = ((value - min) / (max - min)) * 100

  function calcValue(clientX) {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + ratio * (max - min)
    return Math.max(min, Math.min(max, Math.round(raw / step) * step))
  }

  function onPointerDown(e) {
    dragging.current = true
    trackRef.current.setPointerCapture(e.pointerId)
    onChange(calcValue(e.clientX))
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    onChange(calcValue(e.clientX))
  }

  function onPointerUp() {
    dragging.current = false
  }

  function onKeyDown(e) {
    const big = (max - min) / 20 || step
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(max, Math.round((value + step) / step) * step))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(min, Math.round((value - step) / step) * step))
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      onChange(Math.min(max, Math.round((value + big) / step) * step))
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      onChange(Math.max(min, Math.round((value - big) / step) * step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(min)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(max)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-[11px] font-heading font-bold uppercase tracking-widest text-secondary">
          {label}
        </span>
        <span className="font-heading font-bold text-[30px]" style={{ color: GOLD, letterSpacing: '-0.02em' }}>
          {displayValue ?? value}<span className="text-[14px] ml-1" style={{ color: `${GOLD}8C` }}>{unit}</span>
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${displayValue ?? value}${unit || ''}`}
        className="relative flex items-center select-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A85C] focus-visible:ring-offset-2"
        style={{ height: 48, touchAction: 'none', cursor: 'pointer' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div className="absolute inset-x-0 rounded-full" style={{ height: 4, background: 'var(--border)' }} />
        <div
          className="absolute left-0 rounded-full"
          style={{ height: 4, width: `${pct}%`, background: `linear-gradient(90deg, #A8893A, ${GOLD})` }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 28,
            height: 28,
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            background: GOLD,
            border: '2.5px solid var(--card)',
            boxShadow: '0 0 0 4px rgba(198,168,92,0.18), 0 0 14px rgba(198,168,92,0.45)',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-body text-secondary" style={{ opacity: 0.6 }}>{min}</span>
        <span className="text-[10px] font-body text-secondary" style={{ opacity: 0.6 }}>{max}</span>
      </div>
    </div>
  )
}

// ── Full-screen overlay: body-stats input → phase result ─────────────────────
// Handles both sub-steps itself so WorkoutPlan.jsx only needs to mount/unmount
// one component. onSave(height, weight) is called once, right when the user
// taps "Save" on the input screen (not on the result screen's "Done") — the
// result screen is purely a read of what was just saved.
export default function BodyStatsFlow({ initialHeight, initialWeight, goal, onSave, onClose, onDone, stepLabel, progressPct }) {
  const [phase, setPhase] = useState('form') // 'form' | 'result'
  const [height, setHeight] = useState(initialHeight || 175)
  const [weight, setWeight] = useState(initialWeight || 75)
  const [units, setUnits] = useState('metric')

  let feet = Math.floor(height / 30.48)
  let inches = Math.round((height / 30.48 - feet) * 12)
  if (inches === 12) { feet += 1; inches = 0 }
  const lbs = Math.round(weight * 2.205)

  function handleSave() {
    triggerHaptic()
    onSave(height, weight)
    setPhase('result')
  }

  const resultPhase = phase === 'result' ? calculatePhase(goal, height, weight) : null
  const info = resultPhase ? PHASE_INFO[resultPhase] : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Optional top progress bar + step label — only rendered when a parent
          wizard (e.g. TrainingPlanIntro) passes these; the standalone
          settings-row reopen from WorkoutPlan.jsx never passes them, so that
          usage renders identically to before this was added. */}
      {progressPct != null && (
        <div className="absolute top-0 left-0 right-0 h-0.5 z-20" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, #A8893A, ${GOLD}, #D4B96A)` }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}

      <div className="flex items-center justify-between px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        {stepLabel ? (
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>{stepLabel}</span>
        ) : <span />}
        <button
          onClick={() => { triggerHaptic(); onClose() }}
          aria-label="Close"
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <X size={17} className="text-primary" />
        </button>
      </div>

      {phase === 'form' ? (
        <div className="flex-1 flex flex-col px-6">
          <div className="flex-1 flex flex-col justify-center gap-8">
            <div>
              <h1 className="font-heading font-bold text-[26px] text-primary mb-2" style={{ letterSpacing: '-0.02em' }}>
                Your body stats
              </h1>
              <p className="font-body text-[13px] text-secondary">
                Used to calculate your BMI and training phase.
              </p>
            </div>

            <div>
              <BodyStatsSlider
                label="Height"
                unit={units === 'imperial' ? `${feet}'${inches}"` : 'cm'}
                value={height}
                displayValue={units === 'imperial' ? '' : undefined}
                min={140}
                max={220}
                onChange={setHeight}
              />
              <BodyStatsSlider
                label="Weight"
                unit={units === 'imperial' ? 'lbs' : 'kg'}
                value={weight}
                displayValue={units === 'imperial' ? lbs : weight}
                min={40}
                max={180}
                onChange={setWeight}
              />
            </div>

            <div className="flex gap-2">
              {['metric', 'imperial'].map(u => (
                <button
                  key={u}
                  onClick={() => setUnits(u)}
                  className="flex-1 py-2.5 rounded-xl font-heading font-bold text-[12px] capitalize"
                  style={{
                    background: units === u ? 'rgba(198,168,92,0.10)' : 'var(--card)',
                    border: `1px solid ${units === u ? 'rgba(198,168,92,0.28)' : 'var(--border)'}`,
                    color: units === u ? GOLD : 'var(--text-secondary)',
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="pb-10 pt-4">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
              style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
            >
              Save
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-6">
          <div className="flex-1 flex flex-col justify-center overflow-y-auto">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: EASE_STANDARD }}
              className="text-center mb-6"
            >
              <div className="mb-4 flex justify-center"><info.PhaseIcon size={52} style={{ color: info.color }} /></div>
              <div
                className="inline-block px-6 py-2.5 rounded-full font-heading font-bold text-[13px] uppercase tracking-widest mb-5"
                style={{ background: info.bg, border: `1.5px solid ${info.border}`, color: info.color }}
              >
                {info.label}
              </div>
              <h1 className="font-heading font-bold text-[26px] text-primary mb-3" style={{ letterSpacing: '-0.02em' }}>
                Your personalized<br />Ascension plan is ready.
              </h1>
              <p className="font-body text-[14px] text-secondary leading-relaxed">
                {info.why}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl p-4"
              style={{ background: info.bg, border: `1px solid ${info.border}` }}
            >
              <p className="font-heading font-bold text-[11px] uppercase tracking-widest mb-3" style={{ color: info.color }}>
                Your Protocol
              </p>
              <div className="space-y-2">
                {info.actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: info.color }} />
                    <p className="font-body text-[13px] text-primary">{a}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="pb-10 pt-4">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { triggerHaptic(); (onDone || onClose)() }}
              className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
              style={{ background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.3)' }}
            >
              Done
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
