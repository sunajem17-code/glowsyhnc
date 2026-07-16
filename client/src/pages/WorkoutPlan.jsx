import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, ChevronDown, ChevronUp, ArrowLeft, RefreshCw, AlertCircle, Zap, Target, Flame } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import PageHeader from '../components/PageHeader'
import MotionPage from '../components/MotionPage'

// Resize + JPEG-compress a raw File before sending to the server, same
// approach used in Scan.jsx's toBase64 — keeps payloads small and fast.
function fileToResizedBase64(file, maxPx = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read photo'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('Could not load photo'))
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// ── Fallback plan (used if AI call fails) ─────────────────────────────────────
function buildFallback(physiqueScores, gender) {
  const avg = physiqueScores?.overall ?? 5
  const level = avg >= 7 ? 'advanced' : avg >= 5.5 ? 'intermediate' : 'beginner'

  const scores = {
    proportions: physiqueScores?.proportions ?? 5,
    leanness:    physiqueScores?.leanness    ?? 5,
    frame:       physiqueScores?.frame       ?? 5,
    posture:     physiqueScores?.posture     ?? 5,
  }

  const needsFrame      = scores.frame < 6
  const needsLeanness   = scores.leanness < 6
  const needsPosture    = scores.posture < 6
  const needsProportions = scores.proportions < 6

  if (level === 'beginner') {
    return {
      split: '3-day Full Body',
      trainingLevel: 'beginner',
      days: [
        {
          name: 'Full Body A',
          focus: 'Strength foundation',
          exercises: [
            { name: 'Barbell Squat', sets: 3, reps: '5', why: 'Builds total body strength and lower body mass for balanced proportions.' },
            { name: 'Bench Press', sets: 3, reps: '5', why: 'Chest and front delt development contributes to upper body width.' },
            { name: needsFrame ? 'Lat Pulldown' : 'Bent-Over Row', sets: 3, reps: '8-10', why: needsFrame ? 'Lat width is the single biggest driver of V-taper and frame score.' : 'Back thickness improves posture and overall frame presence.' },
            { name: 'Overhead Press', sets: 3, reps: '5', why: 'Shoulder width is the #1 visual signal of a strong frame.' },
            { name: needsPosture ? 'Face Pulls' : 'Plank', sets: 3, reps: needsPosture ? '15-20' : '30-45s', why: needsPosture ? 'Rear delts and external rotators correct forward-head and rounded shoulder posture.' : 'Core stability anchors good posture throughout all lifts.' },
          ],
        },
        {
          name: 'Full Body B',
          focus: 'Hypertrophy + conditioning',
          exercises: [
            { name: 'Romanian Deadlift', sets: 3, reps: '8-10', why: 'Hamstring and glute development balances the front/back ratio for proportions.' },
            ...(needsFrame
              ? [{ name: 'Dumbbell Lateral Raise', sets: 4, reps: '12-15', why: 'Side delts create shoulder width — the fastest way to raise your frame score.' }]
              : [{ name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', why: 'Upper chest fullness improves the silhouette from the front.' }]),
            { name: 'Dumbbell Row', sets: 3, reps: '10-12', why: 'Unilateral rows build lat thickness and correct left-right imbalances.' },
            { name: 'Cable Curl', sets: 3, reps: '10-12', why: 'Arm development fills out sleeves and improves overall aesthetic presentation.' },
            ...(needsLeanness ? [{ name: '10-min Cardio Finisher', sets: 1, reps: '10 min', why: 'Steady-state cardio accelerates leanness — the single biggest driver of visible definition.' }] : []),
          ],
        },
        {
          name: 'Full Body C',
          focus: 'Weak point focus + mobility',
          exercises: [
            { name: 'Leg Press', sets: 3, reps: '10-12', why: 'Lower body volume ensures proportional leg development vs upper body.' },
            { name: needsFrame ? 'Wide-Grip Pull-Up' : 'Cable Row', sets: 3, reps: '6-10', why: needsFrame ? 'Wide-grip pull-ups maximally recruit lat width — key for V-taper.' : 'Mid-back thickness anchors shoulder retraction and better posture.' },
            { name: 'Arnold Press', sets: 3, reps: '10-12', why: 'Full shoulder head recruitment builds 3D shoulder roundness for frame improvement.' },
            { name: needsPosture ? 'Band Pull-Apart' : 'Tricep Pushdown', sets: 3, reps: '15-20', why: needsPosture ? 'External rotation strength is the foundation of healthy, upright posture.' : 'Tricep development completes arm aesthetics alongside biceps.' },
            { name: 'Dead Bug', sets: 3, reps: '10/side', why: 'Core anti-extension strength supports neutral spine alignment and posture score.' },
          ],
        },
      ],
    }
  }

  if (level === 'intermediate') {
    return {
      split: '4-day Upper/Lower',
      trainingLevel: 'intermediate',
      days: [
        {
          name: 'Upper A — Push',
          focus: 'Chest, shoulder, tricep strength',
          exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '5-6', why: 'Heavy pressing builds the raw strength base for chest and front delt mass.' },
            { name: 'Overhead Press', sets: 4, reps: '5-6', why: 'The overhead press is the most direct path to shoulder width improvement.' },
            { name: needsFrame ? 'Dumbbell Lateral Raise' : 'Incline Dumbbell Press', sets: 4, reps: needsFrame ? '12-15' : '10-12', why: needsFrame ? 'Lateral raises are the #1 exercise to widen shoulders and raise frame score.' : 'Incline press develops upper chest fullness visible in a shirt.' },
            { name: 'Tricep Dip', sets: 3, reps: '8-12', why: 'Triceps make up 2/3 of arm size — key for overall arm aesthetic presentation.' },
            { name: needsPosture ? 'Face Pull' : 'Lateral Raise Drop Set', sets: 3, reps: needsPosture ? '15-20' : '15→12→10', why: needsPosture ? 'Face pulls balance anterior/posterior shoulder strength — essential for fixing rounded shoulders.' : 'Drop sets push lateral head hypertrophy past what straight sets achieve.' },
          ],
        },
        {
          name: 'Lower A — Strength',
          focus: 'Quad, glute, hamstring power',
          exercises: [
            { name: 'Barbell Squat', sets: 4, reps: '5-6', why: 'Heavy squats build the leg mass that creates lower body proportional balance.' },
            { name: 'Romanian Deadlift', sets: 3, reps: '8-10', why: 'Hamstring + glute development corrects the leg/upper body proportion imbalance.' },
            { name: 'Leg Press', sets: 3, reps: '10-12', why: 'Adds quad volume without spinal loading — high reps build visible sweep.' },
            { name: 'Leg Curl', sets: 3, reps: '10-12', why: 'Isolated hamstring work balances quad dominance for better leg proportions.' },
            { name: needsLeanness ? '15-min HIIT Finisher' : 'Calf Raise', sets: needsLeanness ? 1 : 4, reps: needsLeanness ? '15 min' : '12-15', why: needsLeanness ? 'HIIT post-lift elevates EPOC — keeps you burning fat hours after the session ends.' : 'Calf development completes lower leg aesthetics and improves posture alignment.' },
          ],
        },
        {
          name: 'Upper B — Pull',
          focus: 'Back, bicep, rear delt width',
          exercises: [
            { name: needsFrame ? 'Wide-Grip Pull-Up' : 'Weighted Pull-Up', sets: 4, reps: '6-10', why: needsFrame ? 'Wide-grip lat recruitment is the fastest route to visible V-taper and frame improvement.' : 'Adding load to pull-ups compounds lat thickness into frame-altering width.' },
            { name: 'Barbell Row', sets: 4, reps: '6-8', why: 'Heavy rows build upper/mid back thickness that improves standing posture and frame.' },
            { name: 'Seated Cable Row', sets: 3, reps: '10-12', why: 'Mid-back density keeps shoulders retracted and supports structural posture score.' },
            { name: needsPosture ? 'Rear Delt Fly' : 'Barbell Curl', sets: 3, reps: needsPosture ? '15-20' : '10-12', why: needsPosture ? 'Rear delt hypertrophy pulls shoulders back — the most direct fix for forward posture.' : 'Bicep peak development is the most visible arm aesthetic marker.' },
            { name: 'Hammer Curl', sets: 3, reps: '10-12', why: 'Brachialis development adds arm thickness and improves arm-to-frame ratio.' },
          ],
        },
        {
          name: 'Lower B — Hypertrophy',
          focus: 'Glute, hamstring, conditioning',
          exercises: [
            { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12/side', why: 'Unilateral glute/quad work corrects left-right imbalances that hurt proportions score.' },
            { name: 'Hip Thrust', sets: 4, reps: '10-12', why: needsProportions ? 'Glute mass improves waist-to-hip ratio — a primary driver of your proportions score.' : 'Hip thrusts are the highest EMG glute exercise for posterior aesthetic development.' },
            { name: 'Walking Lunge', sets: 3, reps: '12/side', why: 'Lunges build functional leg strength and visible quad sweep from the front.' },
            { name: needsLeanness ? '20-min Steady State Cardio' : 'Leg Extension', sets: needsLeanness ? 1 : 3, reps: needsLeanness ? '20 min' : '12-15', why: needsLeanness ? 'Zone 2 cardio is the most sustainable way to create the caloric deficit needed for your leanness score.' : 'Terminal quad isolation builds the teardrop and sweep visible in shorts.' },
            { name: 'Standing Calf Raise', sets: 4, reps: '15-20', why: 'Calf development completes proportional lower leg aesthetics.' },
          ],
        },
      ],
    }
  }

  // Advanced PPL
  return {
    split: '6-day Push/Pull/Legs',
    trainingLevel: 'advanced',
    days: [
      {
        name: 'Push A — Strength',
        focus: 'Heavy chest and shoulder pressing',
        exercises: [
          { name: 'Barbell Bench Press', sets: 5, reps: '3-5', why: 'Max strength in pressing translates to greater hypertrophy capacity later in the week.' },
          { name: 'Overhead Press', sets: 5, reps: '3-5', why: 'Heavy OHP builds the strength base for shoulder width that lifts frame score.' },
          { name: needsFrame ? 'Dumbbell Lateral Raise' : 'Incline Dumbbell Press', sets: 4, reps: needsFrame ? '12-15' : '8-10', why: needsFrame ? 'At advanced level, lateral raises are still the most direct frame-width movement.' : 'Incline work maintains upper chest fullness lost if only flat pressing.' },
          { name: 'Tricep Rope Pushdown', sets: 4, reps: '10-12', why: 'Isolating the lateral head of the tricep adds the arm thickness visible from the front.' },
          { name: needsPosture ? 'Face Pull' : 'Cable Lateral Raise', sets: 3, reps: needsPosture ? '20-25' : '15-20', why: needsPosture ? 'High-rep face pulls keep rotator cuff balanced against the heavy pressing volume.' : 'Cable constant-tension laterals sustain delt stimulus beyond barbell range.' },
        ],
      },
      {
        name: 'Pull A — Strength',
        focus: 'Heavy back and bicep compound work',
        exercises: [
          { name: 'Weighted Pull-Up', sets: 5, reps: '4-6', why: 'Progressive overload on pull-ups directly increases lat width — the core of frame score.' },
          { name: 'Barbell Row', sets: 5, reps: '4-6', why: 'Heavy rowing builds the upper back density that locks in upright posture.' },
          { name: needsPosture ? 'Rear Delt Row' : 'Cable Row', sets: 4, reps: needsPosture ? '12-15' : '8-10', why: needsPosture ? 'Targeting rear delts directly counters the protraction pattern causing your posture score to drop.' : 'Mid-back isolation after compounds fills in the detail for full back development.' },
          { name: 'EZ-Bar Curl', sets: 4, reps: '8-10', why: 'Bicep strength work ensures arm development keeps pace with growing back width.' },
          { name: 'Hammer Curl', sets: 3, reps: '10-12', why: 'Brachialis thickness adds visible arm mass from every angle.' },
        ],
      },
      {
        name: 'Legs A — Strength',
        focus: 'Squat-pattern strength + posterior chain',
        exercises: [
          { name: 'Barbell Squat', sets: 5, reps: '3-5', why: 'Foundational quad + glute strength that enables high-volume hypertrophy later in the week.' },
          { name: 'Romanian Deadlift', sets: 4, reps: '6-8', why: 'Heavy RDLs build hamstring mass that balances the front-to-back proportion of the legs.' },
          { name: 'Leg Press', sets: 4, reps: '8-10', why: 'Additional quad volume without spinal fatigue, allowing higher total leg stimulus.' },
          { name: needsLeanness ? '15-min HIIT' : 'Leg Curl', sets: needsLeanness ? 1 : 4, reps: needsLeanness ? '15 min' : '10-12', why: needsLeanness ? 'Post-leg HIIT maximizes EPOC when glycogen is already depleted — peak fat-burning effect.' : 'Isolation curls balance quad/hamstring ratio for complete leg development.' },
          { name: 'Standing Calf Raise', sets: 5, reps: '10-12', why: 'Heavy-ish calf work drives the myofibrillar hypertrophy calves need to grow.' },
        ],
      },
      {
        name: 'Push B — Hypertrophy',
        focus: 'Volume and pump — chest, delt, tricep',
        exercises: [
          { name: 'Incline Dumbbell Press', sets: 4, reps: '10-12', why: 'Upper chest emphasis adds the fullness that reads well in shirts and from the side.' },
          { name: 'Cable Fly', sets: 4, reps: '12-15', why: 'Peak contraction cable flys create the chest detail visible at lower body fat.' },
          { name: needsFrame ? 'Dumbbell Lateral Raise' : 'Dumbbell Shoulder Press', sets: 5, reps: needsFrame ? '15-20' : '10-12', why: needsFrame ? 'High-rep laterals on the second push day ensures the delt volume your frame score needs.' : 'Additional pressing volume on B day keeps shoulder hypertrophy stimulus high.' },
          { name: 'Overhead Tricep Extension', sets: 4, reps: '12-15', why: 'Long-head tricep stretch creates the arm thickness visible in every angle.' },
          { name: 'Cable Lateral Raise', sets: 3, reps: '15-20', why: 'Constant-tension laterals at end of push B compounds the delt width adaptation.' },
        ],
      },
      {
        name: 'Pull B — Hypertrophy',
        focus: 'Volume and detail — back, rear delt, bicep',
        exercises: [
          { name: 'Lat Pulldown', sets: 4, reps: '10-12', why: 'Lat pulldowns allow higher rep ranges for hypertrophy after heavy pull-up day.' },
          { name: 'Seated Cable Row', sets: 4, reps: '12-15', why: 'High-rep rowing builds the mid-back density that maintains structural posture.' },
          { name: needsPosture ? 'Reverse Pec Deck' : 'Chest-Supported Row', sets: 4, reps: needsPosture ? '15-20' : '12-15', why: needsPosture ? 'Reverse pec deck isolates rear delts in full stretch — highest stimulus per rep for posture correction.' : 'Chest-supported rows eliminate lower back fatigue to maximize back stimulus.' },
          { name: 'Cable Curl', sets: 4, reps: '12-15', why: 'Constant-tension curls on the second pull day drives the bicep peak hypertrophy volume.' },
          { name: 'Incline Dumbbell Curl', sets: 3, reps: '12-15', why: 'Stretched-position curls recruit the long head bicep for fuller arm development.' },
        ],
      },
      {
        name: 'Legs B — Hypertrophy',
        focus: 'Volume and conditioning — quad, glute, conditioning',
        exercises: [
          { name: 'Bulgarian Split Squat', sets: 4, reps: '10-12/side', why: 'Unilateral leg work corrects side-to-side imbalances that drag down proportions score.' },
          { name: 'Hip Thrust', sets: 4, reps: '12-15', why: needsProportions ? 'Glute hypertrophy improves waist-to-hip ratio — a primary component of your proportions score.' : 'Glute activation peaks in hip thrust — highest EMG of any glute exercise.' },
          { name: 'Leg Extension', sets: 4, reps: '15-20', why: 'High-rep quad isolation at end of the week drives the pump and detail work.' },
          { name: needsLeanness ? '20-min Steady State Cardio' : 'Walking Lunge', sets: needsLeanness ? 1 : 3, reps: needsLeanness ? '20 min' : '15/side', why: needsLeanness ? 'Zone 2 cardio on legs B provides the weekly deficit needed for visible leanness improvement.' : 'Loaded lunges add unilateral quad and glute volume without spine compression.' },
          { name: 'Seated Calf Raise', sets: 5, reps: '15-20', why: 'Soleus training with bent knee — fills in the inner calf for complete lower leg development.' },
        ],
      },
    ],
  }
}

// ── Day card component ─────────────────────────────────────────────────────────
function DayCard({ day, index }) {
  const [open, setOpen] = useState(index === 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <p className="font-heading font-bold text-[14px] text-primary">{day.name}</p>
          <p className="font-body text-[11px] text-secondary mt-0.5">{day.focus}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-heading font-bold text-secondary">{day.exercises.length} exercises</span>
          {open ? <ChevronUp size={16} className="text-secondary" /> : <ChevronDown size={16} className="text-secondary" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 space-y-3 border-t border-default pt-4">
              {day.exercises.map((ex, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.25)' }}>
                    <span className="font-heading font-bold text-[10px]" style={{ color: '#C6A85C' }}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-heading font-bold text-[13px] text-primary">{ex.name}</p>
                      <span className="font-mono text-[11px] font-bold flex-shrink-0"
                        style={{ color: '#C6A85C' }}>
                        {ex.sets}×{ex.reps}
                      </span>
                    </div>
                    <p className="font-body text-[11px] text-secondary leading-relaxed">{ex.why}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Weak area chips ────────────────────────────────────────────────────────────
function WeakAreaChips({ physiqueScores }) {
  if (!physiqueScores) return null

  const areas = [
    { key: 'frame',       label: 'Frame',        score: physiqueScores.frame       ?? 5 },
    { key: 'proportions', label: 'Proportions',   score: physiqueScores.proportions ?? 5 },
    { key: 'leanness',    label: 'Leanness',      score: physiqueScores.leanness    ?? 5 },
    { key: 'posture',     label: 'Posture',       score: physiqueScores.posture     ?? 5 },
    { key: 'presentation', label: 'Presentation', score: physiqueScores.overall_presentation ?? 5 },
  ].sort((a, b) => a.score - b.score)

  return (
    <div className="flex flex-wrap gap-2">
      {areas.map(({ key, label, score }) => {
        const color = score >= 7 ? '#34C759' : score >= 5 ? '#F5A623' : '#E07A5F'
        const isPriority = score < 6
        return (
          <span key={key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-heading font-bold uppercase tracking-wide"
            style={{ background: `${color}14`, border: `1px solid ${color}33`, color }}>
            {isPriority && <Target size={8} />}
            {label} {score.toFixed(1)}
          </span>
        )
      })}
    </div>
  )
}

// ── Split badge ────────────────────────────────────────────────────────────────
const SPLIT_ICONS = {
  beginner:     <Zap size={14} />,
  intermediate: <Flame size={14} />,
  advanced:     <Dumbbell size={14} />,
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkoutPlan() {
  const navigate       = useNavigate()
  const currentScan    = useStore(s => s.currentScan)
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const gender         = useStore(s => s.gender) ?? currentScan?.gender ?? 'male'
  const isPremium      = useStore(s => s.isPremium)

  const physiqueScores = currentScan?.physiqueScore

  // ── Body-only quick scan (no face required) ──────────────────────────────────
  const bodyFileInputRef = useRef(null)
  const [bodyScanLoading, setBodyScanLoading] = useState(false)
  const [bodyScanError, setBodyScanError]     = useState('')

  async function handleBodyPhotoSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setBodyScanLoading(true)
    setBodyScanError('')
    try {
      const bodyImage = await fileToResizedBase64(file)
      const { physiqueScore } = await api.ai.scorePhysique({ bodyImage, gender })
      // Merge into currentScan if one exists (keeps any face data around),
      // otherwise start a minimal scan record — Training Plan only ever
      // reads physiqueScore + gender off this object.
      setCurrentScan({
        id: currentScan?.id ?? `scan-${Date.now()}`,
        scanDate: currentScan?.scanDate ?? new Date().toISOString(),
        ...currentScan,
        gender,
        physiqueScore,
      })
    } catch (err) {
      console.error('[WorkoutPlan] body-only scan failed:', err.message)
      setBodyScanError(
        err.errorCode === 'rate_limited' || err.status === 429
          ? 'High demand right now — please try again in a moment.'
          : err.message || 'Could not analyze your photo. Please try again.'
      )
    } finally {
      setBodyScanLoading(false)
    }
  }

  // Infer training level from physique overall score
  const overall = physiqueScores?.overall ?? 5
  const inferredLevel = overall >= 7 ? 'advanced' : overall >= 5.5 ? 'intermediate' : 'beginner'

  const [plan, setPlan]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [isFallback, setIsFallback] = useState(false)

  const loadPlan = useCallback(async () => {
    if (!physiqueScores) return   // gate — don't generate anything without a body photo

    setLoading(true)
    setError(null)
    setIsFallback(false)

    // Non-premium users get the fallback plan instantly
    if (!isPremium) {
      setPlan(buildFallback(physiqueScores, gender))
      setIsFallback(false)
      setLoading(false)
      return
    }

    try {
      const result = await api.ai.workoutPlan({ physiqueScores, gender, trainingLevel: inferredLevel })
      if (result?.fallback) throw new Error('server fallback')
      setPlan(result)
    } catch {
      const fallback = buildFallback(physiqueScores, gender)
      setPlan(fallback)
      setIsFallback(true)
    } finally {
      setLoading(false)
    }
  }, [physiqueScores, gender, isPremium, inferredLevel])

  useEffect(() => {
    loadPlan()
  }, [loadPlan])

  // ── Gate: no body photo uploaded yet ─────────────────────────────────────────
  if (!physiqueScores) {
    return (
      <MotionPage>
        <PageHeader title="Training Plan" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-24 text-center gap-5">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.2)' }}
          >
            <Dumbbell size={36} style={{ color: '#C6A85C' }} />
          </div>
          <div className="space-y-2">
            <p className="font-heading font-bold text-[20px] text-primary leading-tight">
              Add Your Physique Photo
            </p>
            <p className="font-body text-[13px] text-secondary leading-relaxed">
              That's the only thing needed — take or upload one body photo and your plan is built from it. No face scan required here.
            </p>
          </div>

          {bodyScanError && (
            <div className="w-full flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={15} className="text-warning flex-shrink-0" />
              <p className="text-xs text-warning font-body flex-1 text-left">{bodyScanError}</p>
            </div>
          )}

          <input
            ref={bodyFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleBodyPhotoSelected}
          />

          <motion.button
            whileTap={{ scale: bodyScanLoading ? 1 : 0.97 }}
            disabled={bodyScanLoading}
            onClick={() => bodyFileInputRef.current?.click()}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)',
              color: '#0A0A0A',
              boxShadow: '0 4px 20px rgba(198,168,92,0.3)',
              opacity: bodyScanLoading ? 0.6 : 1,
            }}
          >
            {bodyScanLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Analyzing your photo…
              </>
            ) : (
              <>
                <Target size={16} />
                Take or Upload Body Photo
              </>
            )}
          </motion.button>
        </div>
      </MotionPage>
    )
  }

  const levelLabel = plan?.trainingLevel ?? inferredLevel
  const splitLabel = plan?.split ?? `${inferredLevel === 'beginner' ? '3-day Full Body' : inferredLevel === 'intermediate' ? '4-day Upper/Lower' : '6-day PPL'}`

  return (
    <MotionPage>
      <PageHeader title="Training Plan" onBack={() => navigate(-1)} />

      <div className="px-4 pb-24 space-y-4 pt-2">

        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-heading font-bold text-[10px] uppercase tracking-widest mb-1" style={{ color: '#C6A85C' }}>
                AI-Generated Plan
              </p>
              <h1 className="font-heading font-bold text-[20px] text-primary leading-tight">{splitLabel}</h1>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full capitalize"
              style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.25)', color: '#C6A85C' }}>
              {SPLIT_ICONS[levelLabel]}
              <span className="font-heading font-bold text-[11px]">{levelLabel}</span>
            </div>
          </div>

          <p className="font-body text-[11px] text-secondary mb-2">Built around your weak areas:</p>
          <WeakAreaChips physiqueScores={physiqueScores} />
        </motion.div>

        {/* Fallback notice */}
        {isFallback && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)' }}
          >
            <AlertCircle size={14} style={{ color: '#F5A623', flexShrink: 0, marginTop: 1 }} />
            <p className="font-body text-[11px] leading-relaxed" style={{ color: '#F5A623' }}>
              Showing a template plan based on your physique score. Personalized AI plan failed to load.
            </p>
            <button onClick={loadPlan} className="flex-shrink-0">
              <RefreshCw size={13} style={{ color: '#F5A623' }} />
            </button>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-16 flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Dumbbell size={28} style={{ color: '#C6A85C' }} />
            </motion.div>
            <div className="text-center">
              <p className="font-heading font-bold text-[14px] text-primary">Building Your Plan</p>
              <p className="font-body text-[12px] text-secondary mt-1">Analyzing your physique scores…</p>
            </div>
          </div>
        )}

        {/* Plan days */}
        {!loading && plan?.days && (
          <div className="space-y-3">
            {plan.days.map((day, i) => (
              <DayCard key={i} day={day} index={i} />
            ))}
          </div>
        )}

        {/* Disclaimer */}
        {!loading && plan && (
          <p className="text-center font-body text-[10px] text-secondary leading-relaxed opacity-60 px-4">
            General guidance only · not a substitute for professional training or medical advice · consult a physician before starting any new exercise program
          </p>
        )}
      </div>
    </MotionPage>
  )
}
