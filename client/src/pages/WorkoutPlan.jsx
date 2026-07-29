import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, ChevronDown, ChevronUp, ArrowLeft, RefreshCw, AlertCircle, Zap, Target, Flame, Ruler, ChevronRight, Beef, Lock } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import PageHeader from '../components/PageHeader'
import MotionPage from '../components/MotionPage'
import BodyStatsFlow from '../components/BodyStatsStep'
import TrainingPlanIntro from '../components/TrainingPlanIntro'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

// Resize + JPEG-compress a raw File before sending to the server, same
// approach used in Scan.jsx's toBase64 — keeps payloads small and fast.
// Exported so TrainingPlanIntro's photo step can reuse it rather than
// duplicating the same canvas-resize logic.
export function fileToResizedBase64(file, maxPx = 1024) {
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

// ── Retry with backoff for genuinely transient failures ───────────────────────
// Only retries network blips / our-server 5xx — never 429 (rate limit) or 400
// (bad request), since an immediate retry can't fix either of those and would
// just waste the demo/free-tier's already-scarce Claude call budget.
async function callWorkoutPlanWithRetry(payload, maxAttempts = 3) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await api.ai.workoutPlan(payload)
    } catch (err) {
      lastErr = err
      const isRateLimited = err.status === 429 || err.errorCode === 'claude_rate_limited' || err.errorCode === 'rate_limited'
      const isBadRequest  = err.status === 400
      if (isRateLimited || isBadRequest || attempt === maxAttempts) throw err
      const delayMs = 800 * 2 ** (attempt - 1) // 800ms, then 1600ms
      console.warn(`[WorkoutPlan] AI plan attempt ${attempt}/${maxAttempts} failed (${err.message}) — retrying in ${delayMs}ms`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  throw lastErr
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
              ? [{ name: 'Dumbbell Lateral Raise', sets: 4, reps: '12-15', why: 'Side delts create shoulder width, the fastest way to raise your frame score.' }]
              : [{ name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', why: 'Upper chest fullness improves the silhouette from the front.' }]),
            { name: 'Dumbbell Row', sets: 3, reps: '10-12', why: 'Unilateral rows build lat thickness and correct left-right imbalances.' },
            { name: 'Cable Curl', sets: 3, reps: '10-12', why: 'Arm development fills out sleeves and improves overall aesthetic presentation.' },
            ...(needsLeanness ? [{ name: '10-min Cardio Finisher', sets: 1, reps: '10 min', why: 'Steady-state cardio accelerates leanness, the single biggest driver of visible definition.' }] : []),
          ],
        },
        {
          name: 'Full Body C',
          focus: 'Weak point focus + mobility',
          exercises: [
            { name: 'Leg Press', sets: 3, reps: '10-12', why: 'Lower body volume ensures proportional leg development vs upper body.' },
            { name: needsFrame ? 'Wide-Grip Pull-Up' : 'Cable Row', sets: 3, reps: '6-10', why: needsFrame ? 'Wide-grip pull-ups maximally recruit lat width, key for V-taper.' : 'Mid-back thickness anchors shoulder retraction and better posture.' },
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
          name: 'Upper A: Push',
          focus: 'Chest, shoulder, tricep strength',
          exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '5-6', why: 'Heavy pressing builds the raw strength base for chest and front delt mass.' },
            { name: 'Overhead Press', sets: 4, reps: '5-6', why: 'The overhead press is the most direct path to shoulder width improvement.' },
            { name: needsFrame ? 'Dumbbell Lateral Raise' : 'Incline Dumbbell Press', sets: 4, reps: needsFrame ? '12-15' : '10-12', why: needsFrame ? 'Lateral raises are the #1 exercise to widen shoulders and raise frame score.' : 'Incline press develops upper chest fullness visible in a shirt.' },
            { name: 'Tricep Dip', sets: 3, reps: '8-12', why: 'Triceps make up 2/3 of arm size, key for overall arm aesthetic presentation.' },
            { name: needsPosture ? 'Face Pull' : 'Lateral Raise Drop Set', sets: 3, reps: needsPosture ? '15-20' : '15→12→10', why: needsPosture ? 'Face pulls balance anterior/posterior shoulder strength, essential for fixing rounded shoulders.' : 'Drop sets push lateral head hypertrophy past what straight sets achieve.' },
          ],
        },
        {
          name: 'Lower A: Strength',
          focus: 'Quad, glute, hamstring power',
          exercises: [
            { name: 'Barbell Squat', sets: 4, reps: '5-6', why: 'Heavy squats build the leg mass that creates lower body proportional balance.' },
            { name: 'Romanian Deadlift', sets: 3, reps: '8-10', why: 'Hamstring + glute development corrects the leg/upper body proportion imbalance.' },
            { name: 'Leg Press', sets: 3, reps: '10-12', why: 'Adds quad volume without spinal loading, high reps build visible sweep.' },
            { name: 'Leg Curl', sets: 3, reps: '10-12', why: 'Isolated hamstring work balances quad dominance for better leg proportions.' },
            { name: needsLeanness ? '15-min HIIT Finisher' : 'Calf Raise', sets: needsLeanness ? 1 : 4, reps: needsLeanness ? '15 min' : '12-15', why: needsLeanness ? 'HIIT post-lift elevates EPOC, keeps you burning fat hours after the session ends.' : 'Calf development completes lower leg aesthetics and improves posture alignment.' },
          ],
        },
        {
          name: 'Upper B: Pull',
          focus: 'Back, bicep, rear delt width',
          exercises: [
            { name: needsFrame ? 'Wide-Grip Pull-Up' : 'Weighted Pull-Up', sets: 4, reps: '6-10', why: needsFrame ? 'Wide-grip lat recruitment is the fastest route to visible V-taper and frame improvement.' : 'Adding load to pull-ups compounds lat thickness into frame-altering width.' },
            { name: 'Barbell Row', sets: 4, reps: '6-8', why: 'Heavy rows build upper/mid back thickness that improves standing posture and frame.' },
            { name: 'Seated Cable Row', sets: 3, reps: '10-12', why: 'Mid-back density keeps shoulders retracted and supports structural posture score.' },
            { name: needsPosture ? 'Rear Delt Fly' : 'Barbell Curl', sets: 3, reps: needsPosture ? '15-20' : '10-12', why: needsPosture ? 'Rear delt hypertrophy pulls shoulders back, the most direct fix for forward posture.' : 'Bicep peak development is the most visible arm aesthetic marker.' },
            { name: 'Hammer Curl', sets: 3, reps: '10-12', why: 'Brachialis development adds arm thickness and improves arm-to-frame ratio.' },
          ],
        },
        {
          name: 'Lower B: Hypertrophy',
          focus: 'Glute, hamstring, conditioning',
          exercises: [
            { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12/side', why: 'Unilateral glute/quad work corrects left-right imbalances that hurt proportions score.' },
            { name: 'Hip Thrust', sets: 4, reps: '10-12', why: needsProportions ? 'Glute mass improves waist-to-hip ratio, a primary driver of your proportions score.' : 'Hip thrusts are the highest EMG glute exercise for posterior aesthetic development.' },
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
        name: 'Push A: Strength',
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
        name: 'Pull A: Strength',
        focus: 'Heavy back and bicep compound work',
        exercises: [
          { name: 'Weighted Pull-Up', sets: 5, reps: '4-6', why: 'Progressive overload on pull-ups directly increases lat width, the core of frame score.' },
          { name: 'Barbell Row', sets: 5, reps: '4-6', why: 'Heavy rowing builds the upper back density that locks in upright posture.' },
          { name: needsPosture ? 'Rear Delt Row' : 'Cable Row', sets: 4, reps: needsPosture ? '12-15' : '8-10', why: needsPosture ? 'Targeting rear delts directly counters the protraction pattern causing your posture score to drop.' : 'Mid-back isolation after compounds fills in the detail for full back development.' },
          { name: 'EZ-Bar Curl', sets: 4, reps: '8-10', why: 'Bicep strength work ensures arm development keeps pace with growing back width.' },
          { name: 'Hammer Curl', sets: 3, reps: '10-12', why: 'Brachialis thickness adds visible arm mass from every angle.' },
        ],
      },
      {
        name: 'Legs A: Strength',
        focus: 'Squat-pattern strength + posterior chain',
        exercises: [
          { name: 'Barbell Squat', sets: 5, reps: '3-5', why: 'Foundational quad + glute strength that enables high-volume hypertrophy later in the week.' },
          { name: 'Romanian Deadlift', sets: 4, reps: '6-8', why: 'Heavy RDLs build hamstring mass that balances the front-to-back proportion of the legs.' },
          { name: 'Leg Press', sets: 4, reps: '8-10', why: 'Additional quad volume without spinal fatigue, allowing higher total leg stimulus.' },
          { name: needsLeanness ? '15-min HIIT' : 'Leg Curl', sets: needsLeanness ? 1 : 4, reps: needsLeanness ? '15 min' : '10-12', why: needsLeanness ? 'Post-leg HIIT maximizes EPOC when glycogen is already depleted, peak fat-burning effect.' : 'Isolation curls balance quad/hamstring ratio for complete leg development.' },
          { name: 'Standing Calf Raise', sets: 5, reps: '10-12', why: 'Heavy-ish calf work drives the myofibrillar hypertrophy calves need to grow.' },
        ],
      },
      {
        name: 'Push B: Hypertrophy',
        focus: 'Volume and pump: chest, delt, tricep',
        exercises: [
          { name: 'Incline Dumbbell Press', sets: 4, reps: '10-12', why: 'Upper chest emphasis adds the fullness that reads well in shirts and from the side.' },
          { name: 'Cable Fly', sets: 4, reps: '12-15', why: 'Peak contraction cable flys create the chest detail visible at lower body fat.' },
          { name: needsFrame ? 'Dumbbell Lateral Raise' : 'Dumbbell Shoulder Press', sets: 5, reps: needsFrame ? '15-20' : '10-12', why: needsFrame ? 'High-rep laterals on the second push day ensures the delt volume your frame score needs.' : 'Additional pressing volume on B day keeps shoulder hypertrophy stimulus high.' },
          { name: 'Overhead Tricep Extension', sets: 4, reps: '12-15', why: 'Long-head tricep stretch creates the arm thickness visible in every angle.' },
          { name: 'Cable Lateral Raise', sets: 3, reps: '15-20', why: 'Constant-tension laterals at end of push B compounds the delt width adaptation.' },
        ],
      },
      {
        name: 'Pull B: Hypertrophy',
        focus: 'Volume and detail: back, rear delt, bicep',
        exercises: [
          { name: 'Lat Pulldown', sets: 4, reps: '10-12', why: 'Lat pulldowns allow higher rep ranges for hypertrophy after heavy pull-up day.' },
          { name: 'Seated Cable Row', sets: 4, reps: '12-15', why: 'High-rep rowing builds the mid-back density that maintains structural posture.' },
          { name: needsPosture ? 'Reverse Pec Deck' : 'Chest-Supported Row', sets: 4, reps: needsPosture ? '15-20' : '12-15', why: needsPosture ? 'Reverse pec deck isolates rear delts in full stretch, highest stimulus per rep for posture correction.' : 'Chest-supported rows eliminate lower back fatigue to maximize back stimulus.' },
          { name: 'Cable Curl', sets: 4, reps: '12-15', why: 'Constant-tension curls on the second pull day drives the bicep peak hypertrophy volume.' },
          { name: 'Incline Dumbbell Curl', sets: 3, reps: '12-15', why: 'Stretched-position curls recruit the long head bicep for fuller arm development.' },
        ],
      },
      {
        name: 'Legs B: Hypertrophy',
        focus: 'Volume and conditioning: quad, glute, conditioning',
        exercises: [
          { name: 'Bulgarian Split Squat', sets: 4, reps: '10-12/side', why: 'Unilateral leg work corrects side-to-side imbalances that drag down proportions score.' },
          { name: 'Hip Thrust', sets: 4, reps: '12-15', why: needsProportions ? 'Glute hypertrophy improves waist-to-hip ratio, a primary component of your proportions score.' : 'Glute activation peaks in hip thrust, highest EMG of any glute exercise.' },
          { name: 'Leg Extension', sets: 4, reps: '15-20', why: 'High-rep quad isolation at end of the week drives the pump and detail work.' },
          { name: needsLeanness ? '20-min Steady State Cardio' : 'Walking Lunge', sets: needsLeanness ? 1 : 3, reps: needsLeanness ? '20 min' : '15/side', why: needsLeanness ? 'Zone 2 cardio on legs B provides the weekly deficit needed for visible leanness improvement.' : 'Loaded lunges add unilateral quad and glute volume without spine compression.' },
          { name: 'Seated Calf Raise', sets: 5, reps: '15-20', why: 'Soleus training with bent knee, fills in the inner calf for complete lower leg development.' },
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
        onClick={() => { triggerHaptic(); setOpen(o => !o) }}
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
                    <span className="font-heading font-bold text-[10px]" style={{ color: GOLD }}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-heading font-bold text-[13px] text-primary">{ex.name}</p>
                      <span className="font-mono text-[11px] font-bold flex-shrink-0"
                        style={{ color: GOLD }}>
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

// ── Collapsible section (Pro-gated badge support) ───────────────────────────────
function Section({ title, icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card">
      <button className="w-full flex items-center gap-2 mb-1" onClick={() => setOpen(o => !o)}>
        <span className="flex-shrink-0">{icon}</span>
        <h2 className="font-heading font-bold text-sm text-primary flex-1 text-left">{title}</h2>
        {badge && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#C6A85C]/10 text-[#C6A85C]">{badge}</span>}
        {open ? <ChevronUp size={14} className="text-secondary" /> : <ChevronDown size={14} className="text-secondary" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
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
  const userProfile    = useStore(s => s.userProfile)
  const setUserProfile = useStore(s => s.setUserProfile)

  const physiqueScores = currentScan?.physiqueScore

  // ── Body stats (height/weight) — collected here instead of onboarding, so
  // they're gathered when actually needed (training-phase calculation) rather
  // than upfront for every user regardless of whether they ever open this
  // screen. For a first-time user (no physique score yet), this now happens
  // as step 2 of TrainingPlanIntro instead of an auto-popping modal racing
  // the old gate screen — this auto-open only still applies to a returning
  // user who somehow has a plan already but never set stats (edge case, not
  // the common path). Also reachable any time via the settings row below.
  const [showBodyStats, setShowBodyStats] = useState(false)
  const hasBodyStats = userProfile?.height != null && userProfile?.weight != null

  useEffect(() => {
    if (physiqueScores && !hasBodyStats) setShowBodyStats(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleBodyStatsSave(height, weight) {
    setUserProfile({ ...userProfile, height, weight })
    api.user.update({ height_cm: height, weight_kg: weight }).catch(() => {})
  }

  // ─── Nutrition Plan (TDEE) ──────────────────────────────────────────────────
  // Moved here from the main face-scan results screen — this flow is the only
  // place real height/weight (userProfile.height/weight, set above) actually
  // exists, so TDEE/macros now resolve instead of always showing "—".
  const nutHeightCm = userProfile?.height ?? null
  const nutWeightKg = userProfile?.weight ?? null
  const nutGoal     = userProfile?.goal ?? null

  const tdee = (() => {
    if (!nutHeightCm || !nutWeightKg) return null
    const age = 25 // default — age not collected in onboarding
    const bmr = gender === 'female'
      ? 10 * nutWeightKg + 6.25 * nutHeightCm - 5 * age - 161
      : 10 * nutWeightKg + 6.25 * nutHeightCm - 5 * age + 5
    return Math.round(bmr * 1.55)
  })()

  const nutritionPhase =
    nutGoal === 'Lose Fat' ? 'CUT' :
    nutGoal === 'Build Muscle' ? 'BULK' : 'RECOMP'

  const nutritionTarget = tdee == null ? null :
    nutritionPhase === 'CUT'  ? tdee - 500 :
    nutritionPhase === 'BULK' ? tdee + 300 : tdee

  const proteinTarget = nutWeightKg ? Math.round(nutWeightKg * 2.2 * 0.9) : null

  const nutritionPhaseLabel =
    nutritionPhase === 'CUT'  ? 'Cut Phase' :
    nutritionPhase === 'BULK' ? 'Lean Bulk' : 'Recomp'

  const nutritionProjection =
    nutritionPhase === 'CUT'  ? 'Lose ~1lb/week while preserving muscle' :
    nutritionPhase === 'BULK' ? 'Gain 0.5–1lb/week lean muscle' :
    'Simultaneous fat loss + muscle gain'

  const nutritionMacros = nutritionTarget ? {
    protein: proteinTarget ?? Math.round((nutritionTarget * 0.35) / 4),
    carbs:   Math.round((nutritionTarget * 0.40) / 4),
    fats:    Math.round((nutritionTarget * 0.25) / 9),
  } : null

  const nutritionFraming = {
    CUT:    { calNote: `${tdee != null ? tdee + ' TDEE' : 'TDEE'} − 500 cal deficit`, pillar: 'Lower body fat reveals more muscle definition and improves your V-taper.' },
    BULK:   { calNote: `${tdee != null ? tdee + ' TDEE' : 'TDEE'} + 300 cal surplus`,  pillar: 'Muscle mass gain widens your shoulder-to-waist ratio and increases overall structural size.' },
    RECOMP: { calNote: `${tdee != null ? tdee + ' TDEE' : 'TDEE'} maintenance calories`, pillar: 'Builds muscle while keeping body fat stable, the most balanced physique protocol.' },
  }[nutritionPhase]

  // ── Body-only quick scan (no face required) — the photo/analysis call
  // itself now lives in TrainingPlanIntro (step 3/4), reusing the same
  // api.ai.scorePhysique endpoint; this just receives the result and does
  // the same currentScan merge the old inline handler used to do directly.
  function handleIntroComplete(physiqueScore, bodyPhotoUrl) {
    // Merge into currentScan if one exists (keeps any face data around),
    // otherwise start a minimal scan record — Training Plan only ever
    // reads physiqueScore + gender off this object. bodyPhotoUrl is stored
    // purely for ScanHome's returning-user thumbnail (see effect below for
    // trainingSplit) — WorkoutPlan itself never reads it back.
    setCurrentScan({
      id: currentScan?.id ?? `scan-${Date.now()}`,
      scanDate: currentScan?.scanDate ?? new Date().toISOString(),
      ...currentScan,
      gender,
      physiqueScore,
      bodyPhotoUrl,
    })
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
      const result = await callWorkoutPlanWithRetry({ physiqueScores, gender, trainingLevel: inferredLevel })
      if (result?.fallback) throw new Error('server fallback')
      setPlan(result)
    } catch (err) {
      // Log the real error — status/errorCode/message/stack — instead of
      // silently swallowing it. This was the actual reason "why did it fail"
      // was unanswerable before: the catch block never looked at `err`.
      console.error('[WorkoutPlan] AI plan generation failed:', {
        status: err.status, errorCode: err.errorCode, message: err.message, stack: err.stack,
      })
      const isRateLimited = err.status === 429 || err.errorCode === 'claude_rate_limited'
      setError(
        isRateLimited
          ? "You've hit your hourly AI plan limit. Showing a template for now, try again in about an hour."
          : (err.message || 'Could not generate your personalized plan.')
      )
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

  // Mirror the resolved split label onto currentScan (AI-generated or
  // fallback, doesn't matter which) purely so ScanHome's Body card can show
  // "Plan active · <split>" without needing this page open.
  useEffect(() => {
    if (plan?.split && currentScan?.trainingSplit !== plan.split) {
      setCurrentScan({ ...currentScan, trainingSplit: plan.split })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])

  // ── Gate: no body photo uploaded yet — runs the 4-step welcome → stats →
  // photo → generating intro instead of a bare upload button. A returning
  // user who already has a physique score skips straight past this entirely.
  if (!physiqueScores) {
    return (
      <TrainingPlanIntro
        gender={gender}
        initialHeight={userProfile?.height}
        initialWeight={userProfile?.weight}
        goal={userProfile?.goal}
        onBodyStatsSave={handleBodyStatsSave}
        onComplete={handleIntroComplete}
        onClose={() => navigate(-1)}
      />
    )
  }

  const levelLabel = plan?.trainingLevel ?? inferredLevel
  const splitLabel = plan?.split ?? `${inferredLevel === 'beginner' ? '3-day Full Body' : inferredLevel === 'intermediate' ? '4-day Upper/Lower' : '6-day PPL'}`

  return (
    <>
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
              <p className="font-heading font-bold text-[10px] uppercase tracking-widest mb-1" style={{ color: GOLD }}>
                {isPremium ? 'AI-Generated Plan' : 'Sample Plan'}
              </p>
              <h1 className="font-heading font-bold text-[20px] text-primary leading-tight">{splitLabel}</h1>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full capitalize"
              style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.25)', color: GOLD }}>
              {SPLIT_ICONS[levelLabel]}
              <span className="font-heading font-bold text-[11px]">{levelLabel}</span>
            </div>
          </div>

          <p className="font-body text-[11px] text-secondary mb-2">Built around your weak areas:</p>
          <WeakAreaChips physiqueScores={physiqueScores} />
        </motion.div>

        {/* Body stats — settings-style row, reopens the same flow shown automatically above */}
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => { triggerHaptic(); setShowBodyStats(true) }}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <Ruler size={16} style={{ color: GOLD }} />
            <span className="font-body text-[13px] text-primary">
              {hasBodyStats ? `${userProfile.height} cm · ${userProfile.weight} kg` : 'Add your body stats'}
            </span>
          </div>
          <ChevronRight size={16} className="text-secondary" />
        </motion.button>

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
              {error || 'Showing a template plan based on your physique score. Personalized AI plan failed to load.'}
            </p>
            <button onClick={() => { triggerHaptic(); loadPlan() }} className="flex-shrink-0">
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
              <Dumbbell size={28} style={{ color: GOLD }} />
            </motion.div>
            <div className="text-center">
              <p className="font-heading font-bold text-[14px] text-primary">Building Your Plan</p>
              <p className="font-body text-[12px] text-secondary mt-1">Analyzing your physique scores…</p>
            </div>
          </div>
        )}

        {/* Plan days — Pro-gated, same Section badge + blurred-locked-preview
            pattern as the Nutrition Plan section below (and Results.jsx).
            Free users used to get this fully expanded and fully usable with
            no indication it wasn't the real Pro plan — that silent swap is
            exactly what's being fixed here. */}
        {!loading && plan?.days && (
          <Section title="Your Training Split" icon={<Dumbbell size={16} style={{ color: '#C6A85C' }} />} badge="PRO">
            {isPremium ? (
              <div className="space-y-3">
                {plan.days.map((day, i) => (
                  <DayCard key={i} day={day} index={i} />
                ))}
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden">
                <div className="blur-sm pointer-events-none select-none opacity-35 space-y-3">
                  {plan.days.map((day, i) => (
                    <DayCard key={i} day={day} index={i} />
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl">
                  <Lock size={18} className="text-[#C6A85C] mb-2" />
                  <p className="font-heading font-bold text-sm text-primary mb-0.5">Pro Feature</p>
                  <p className="text-[11px] text-secondary font-body mb-3 text-center px-4">Your full personalized training split, built around your weak areas, not a generic template</p>
                  <button onClick={() => navigate('/premium')} className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-black" style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)' }}>
                    Upgrade to Pro →
                  </button>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Nutrition Plan */}
        {!loading && (
          <Section title="Nutrition Plan" icon={<Beef size={16} style={{ color: '#C6A85C' }} />} defaultOpen={false} badge="PRO">
            {/* Free: calorie target + phase label */}
            <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)' }}>
              <div className="text-center flex-shrink-0">
                {nutritionTarget ? (
                  <>
                    <div className="text-2xl font-mono font-bold" style={{ color: '#F5A623' }}>{nutritionTarget.toLocaleString()}</div>
                    <div className="text-[9px] font-body text-secondary">cal/day</div>
                  </>
                ) : (
                  <div className="text-sm font-heading font-bold text-secondary">N/A</div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-heading font-bold text-primary">{nutritionPhaseLabel}</p>
                <p className="text-[10px] text-secondary font-body leading-snug mt-0.5">{nutritionProjection}</p>
                {!nutritionTarget && (
                  <p className="text-[10px] text-secondary font-body mt-1">Add your body stats above for exact targets.</p>
                )}
              </div>
            </div>

            {/* Pro: full breakdown */}
            {isPremium ? (
              <div className="space-y-3">
                {nutritionFraming && (
                  <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-secondary mb-1">How This Works</p>
                    <p className="text-[11px] font-body text-primary leading-relaxed">
                      <span className="font-bold">{nutritionFraming.calNote}</span>
                      {tdee && nutritionTarget && nutritionPhase !== 'RECOMP' && (
                        <>, a {Math.abs(nutritionTarget - tdee)} cal/day {nutritionPhase === 'CUT' ? 'deficit' : 'surplus'}.</>
                      )}
                    </p>
                    <p className="text-[10px] text-secondary font-body mt-1 leading-relaxed">{nutritionFraming.pillar}</p>
                  </div>
                )}

                {nutritionMacros && (
                  <div>
                    <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-secondary mb-2">Daily Macro Targets</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Protein', value: nutritionMacros.protein + 'g', color: '#E07A5F', note: '~1g/lb bodyweight' },
                        { label: 'Carbs',   value: nutritionMacros.carbs   + 'g', color: '#F5A623', note: 'fuel + performance' },
                        { label: 'Fats',    value: nutritionMacros.fats    + 'g', color: '#34C759', note: 'hormones + recovery' },
                      ].map(({ label, value, color, note }) => (
                        <div key={label} className="text-center p-2.5 rounded-xl" style={{ background: `${color}11`, border: `1px solid ${color}30` }}>
                          <div className="text-base font-mono font-bold" style={{ color }}>{value}</div>
                          <div className="text-[9px] font-heading font-bold text-secondary">{label}</div>
                          <div className="text-[8px] text-secondary font-body mt-0.5">{note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-secondary">Physique Framing</p>
                  {[
                    nutritionPhase === 'CUT'  && { label: 'V-Taper', text: 'As waist shrinks, your shoulder-to-waist ratio improves automatically, even without new muscle.' },
                    nutritionPhase === 'CUT'  && { label: 'Muscle Retention', text: 'A moderate deficit (not aggressive) protects the muscle you already have while you lose fat.' },
                    nutritionPhase === 'BULK' && { label: 'Structural Size', text: 'Muscle mass increases your overall frame size, the main driver of a strong V-taper.' },
                    nutritionPhase === 'BULK' && { label: 'V-Taper', text: 'Shoulder and lat growth in surplus widens your silhouette faster than in recomp.' },
                    { label: 'Protein (all phases)', text: `Hit ${proteinTarget ?? '~160'}g protein/day. Protein preserves muscle during cuts, builds it during bulks, and supports recovery between sessions.` },
                  ].filter(Boolean).map(({ label, text }, i) => (
                    <div key={i} className="flex gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(198,168,92,0.15)' }}>
                        <span className="text-[9px] font-bold" style={{ color: '#C6A85C' }}>→</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-heading font-bold text-primary mb-0.5">{label}</p>
                        <p className="text-[10px] text-secondary font-body leading-relaxed">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden">
                <div className="blur-sm pointer-events-none select-none opacity-35 space-y-2">
                  {['Protein: 165g/day · 1g per lb bodyweight for muscle retention', 'Carbs: 220g/day · Fuel training and recovery', 'Fats: 65g/day · Hormone production + recovery', 'Cut: −500 cal deficit · Lose 1lb/week while preserving muscle', 'V-Taper: Lower body fat reveals more shoulder-to-waist definition'].map((line, i) => (
                    <div key={i} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                      <p className="text-[10px] font-body text-primary">{line}</p>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl">
                  <Lock size={18} className="text-[#C6A85C] mb-2" />
                  <p className="font-heading font-bold text-sm text-primary mb-0.5">Pro Feature</p>
                  <p className="text-[11px] text-secondary font-body mb-3 text-center px-4">Full macro breakdown framed around your physique goals, not generic health advice</p>
                  <button onClick={() => navigate('/premium')} className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-black" style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)' }}>
                    Upgrade to Pro →
                  </button>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Disclaimer */}
        {!loading && plan && (
          <p className="text-center font-body text-[10px] text-secondary leading-relaxed opacity-60 px-4">
            General guidance only · not a substitute for professional training or medical advice · consult a physician before starting any new exercise program
          </p>
        )}
      </div>
    </MotionPage>
    <AnimatePresence>
      {showBodyStats && (
        <BodyStatsFlow
          initialHeight={userProfile?.height}
          initialWeight={userProfile?.weight}
          goal={userProfile?.goal}
          onSave={handleBodyStatsSave}
          onClose={() => setShowBodyStats(false)}
        />
      )}
    </AnimatePresence>
    </>
  )
}
