import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Circle, Sun, Moon, Dumbbell, Footprints, BedDouble, Sparkles, ArrowRight, LockKeyhole, LoaderCircle } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import { getPhysiqueMetricScore } from '../utils/physiqueResults'
import { getRevealRatings } from '../utils/revealRatings'
import { parseCoachMessage } from '../utils/coachMessage'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const FACE_RATINGS = [
  { label: 'Skin Quality', key: 'skin' },
  { label: 'Symmetry', key: 'symmetry' },
  { label: 'Jawline', key: 'jawline' },
  { label: 'Cheekbones', key: 'cheekbones' },
]
const BODY_RATINGS = [
  { label: 'Muscle Mass', key: 'muscle_mass' },
  { label: 'V-Taper', key: 'v_taper' },
  { label: 'Frame Width', key: 'frame_width' },
  { label: 'Body Fat', key: 'body_fat_score' },
]

function scanTime(scan) {
  return Date.parse(scan?.analyzedAt ?? scan?.scanDate ?? scan?.created_at) || 0
}

function isScore(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10
}

function hasScore(value) {
  const score = typeof value === 'number' ? value : Number(value?.score)
  return value != null && Number.isFinite(score)
}

function faceScanScore(scan, label) {
  const revealMetric = getRevealRatings(scan).find(metric => metric.label === label)?.value
  if (isScore(revealMetric)) return revealMetric
  const ai = scan?.aiScore ?? {}
  const face = scan?.faceData ?? {}
  const metrics = ai.faceMetrics ?? face.faceMetrics ?? {}
  const subscores = ai.faceSubScores ?? face.faceSubScores ?? {}
  const aliases = {
    'Skin Quality': [metrics.skinQuality, metrics.skin_quality, subscores.skinClarity, subscores.skin_clarity, face.skinClarity],
    Symmetry: [metrics.symmetry, subscores.symmetry, face.symmetry],
    Jawline: [metrics.jawline, metrics.jawlineDefinition, subscores.jawlineDefinition, subscores.jawline_definition, face.jawlineDefinition],
    Cheekbones: [metrics.cheekbones, subscores.cheekbones, face.cheekbones],
  }[label] ?? []
  for (const raw of aliases) {
    const value = typeof raw === 'number' ? raw : Number(raw?.score)
    if (isScore(value)) return value
  }
  return null
}

function hasFaceScan(scan) {
  if (scan?.scanType === 'physique' && !scan?.facePhotoUrl && !scan?.face_photo_url) return false
  return hasScore(scan?.aiScore?.faceScore)
    || hasScore(scan?.faceData?.aestheticScore)
    || hasScore(scan?.faceData?.faceScore)
    || hasScore(scan?.glowScore)
    || hasScore(scan?.umaxScore)
}

function hasBodyScan(scan) {
  return scan?.scanType === 'physique' || getPhysiqueMetricScore(scan, 'overall') != null
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekKey(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return getLocalDateKey(monday)
}

function loadProgress(key, day, week) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    return {
      day,
      daily: saved.day === day && saved.daily && typeof saved.daily === 'object' ? saved.daily : {},
      week,
      sessions: saved.week === week && Number.isFinite(saved.sessions) ? Math.min(3, Math.max(0, saved.sessions)) : 0,
      workoutDate: saved.workoutDate === day ? day : null,
    }
  } catch {
    return { day, daily: {}, week, sessions: 0, workoutDate: null }
  }
}

const DAILY_STEPS = [
  { id: 'morning', group: 'Morning', icon: Sun, title: 'Simple morning skincare', detail: 'Rinse or use a gentle cleanser, moisturize, then apply broad-spectrum SPF 30 or higher.' },
  { id: 'walk', group: 'Daily', icon: Footprints, title: 'Get some movement', detail: 'Aim for a 20–30 minute walk or another comfortable activity. Break it into shorter walks if that fits your day better.' },
  { id: 'recovery', group: 'Daily', icon: BedDouble, title: 'Protect your recovery', detail: 'Keep a consistent wind-down and bedtime. Choose a sleep duration appropriate for your age and schedule.' },
  { id: 'evening', group: 'Evening', icon: Moon, title: 'Cleanse and moisturize', detail: 'Wash off sunscreen and the day with a gentle cleanser, then moisturize. Add products slowly if you choose to use them.' },
]

function getNextMidnightDelay() {
  const next = new Date()
  next.setHours(24, 0, 0, 50)
  return Math.max(1000, next.getTime() - Date.now())
}

function getFocus(faceScan, bodyScan) {
  const faceFocus = FACE_RATINGS
    .map(metric => ({ ...metric, score: faceScanScore(faceScan, metric.label) }))
    .filter(metric => metric.score != null)
    .sort((a, b) => a.score - b.score)[0]
  const bodyFocus = BODY_RATINGS
    .map(metric => ({ ...metric, score: getPhysiqueMetricScore(bodyScan, metric.key) }))
    .filter(metric => metric.score != null)
    .sort((a, b) => a.score - b.score)[0]

  const faceCopy = faceFocus?.key === 'skin'
    ? `Your lowest available face rating was ${faceFocus.label}. The plan starts with consistent, gentle skincare basics.`
    : 'The face scan helps set a steady skincare and grooming baseline; ratings are photo-based and do not diagnose skin or health.'
  const bodyCopy = bodyFocus?.key === 'muscle_mass'
    ? `Your lowest available body rating was ${bodyFocus.label}. The plan emphasizes balanced, progressive strength sessions.`
    : bodyFocus?.key === 'v_taper' || bodyFocus?.key === 'frame_width'
      ? `Your lowest available body rating was ${bodyFocus.label}. The strength sessions include balanced upper-body push and pull movements.`
      : 'The body scan informs a balanced strength routine, with rest and gradual progression built in.'

  return { faceFocus, bodyFocus, faceCopy, bodyCopy }
}

function recommendationText(value) {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const title = value.action ?? value.title ?? value.name ?? value.label ?? value.recommendation
  const detail = value.rationale ?? value.description ?? value.reason ?? value.observation
  if (typeof title === 'string' && typeof detail === 'string' && detail.trim()) return `${title.trim()} — ${detail.trim()}`
  return typeof title === 'string' ? title.trim() : ''
}

function getScanRecommendations(scan, area) {
  const ai = scan?.aiScore ?? {}
  const assessment = ai.assessment ?? {}
  const presentation = assessment.presentation ?? {}
  const physique = scan?.physiqueScore ?? {}
  const candidates = [
    ...(Array.isArray(presentation.recommendations) ? presentation.recommendations : []),
    ...(Array.isArray(assessment.recommendations) ? assessment.recommendations : []),
    ...(Array.isArray(ai.recommendations) ? ai.recommendations : []),
    ...(Array.isArray(ai.suggestions) ? ai.suggestions : []),
    ...(Array.isArray(scan?.suggestions) ? scan.suggestions : []),
    ...(Array.isArray(ai.insights) ? ai.insights : []),
    ...(Array.isArray(scan?.insights) ? scan.insights : []),
    ...(Array.isArray(physique.recommendations) ? physique.recommendations : []),
    ...(Array.isArray(physique.suggestions) ? physique.suggestions : []),
  ]
  return candidates
    .map(recommendationText)
    .filter(text => text && !/demo mode/i.test(text))
    .map((text, index) => ({ id: `${area}-ai-${index}`, text, source: `${area} scan`, kind: /cerave|cleanser|moistur|serum|spf|sunscreen|product/i.test(text) ? 'Product or care' : 'Action' }))
}

function getSavedCoachRecommendations(userId) {
  if (!userId || typeof sessionStorage === 'undefined') return []
  try {
    const saved = JSON.parse(sessionStorage.getItem(`adonis-chat:${userId}`) || 'null')
    if (!Array.isArray(saved?.messages)) return []
    const recommendations = []
    for (const [messageIndex, message] of saved.messages.entries()) {
      if (message?.role !== 'assistant' || typeof message.content !== 'string') continue
      for (const [blockIndex, block] of parseCoachMessage(message.content).entries()) {
        if (block.type === 'disclosure') continue
        if (block.type === 'product') {
          recommendations.push({
            id: `coach-${messageIndex}-${blockIndex}`,
            text: [block.name, block.reason].filter(Boolean).join(' — '),
            source: 'AI Coach',
            kind: 'Product',
            url: block.url,
          })
          continue
        }
        const text = block.text?.trim()
        if (!text || /^(what.s up|welcome to ascendus|i.m adonis|affiliate links:)/i.test(text) || /demo mode/i.test(text)) continue
        if (block.type === 'step' || /\b(recommend|try|use|start|apply|add|avoid|focus|routine|should|could|work on|prioriti[sz]|build|include)\b/i.test(text)) {
          recommendations.push({ id: `coach-${messageIndex}-${blockIndex}`, text, source: 'AI Coach', kind: /cerave|cleanser|moistur|serum|spf|sunscreen|product/i.test(text) ? 'Product or care' : 'Action' })
        }
      }
    }
    return recommendations
  } catch {
    return []
  }
}

function uniqueRecommendations(recommendations) {
  const seen = new Set()
  return recommendations.filter(item => {
    const key = `${item.text.toLowerCase()}|${item.url ?? ''}`
    if (!item.text || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)
}

function adviceTitle(text) {
  const firstLine = text.split(/\n|(?<=[.!?])\s+/)[0]?.replace(/^[-•\d.)\s]+/, '').trim() ?? text
  return firstLine.length > 72 ? `${firstLine.slice(0, 69).trimEnd()}…` : firstLine
}

function isTrainingSplitRecommendation(item) {
  return /\b(push[ /-]?pull|upper[ /-]?lower|full[ -]?body|workout split|training split|session\s*[ab]|day\s*[1-7]|monday|tuesday|wednesday|thursday|friday|saturday|sunday|3[ -]?day|4[ -]?day|5[ -]?day)\b/i.test(item.text)
}

function getPlanProgress(key, day) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    const completedDays = Array.isArray(saved.completedDays) ? saved.completedDays.filter(n => Number.isInteger(n) && n >= 1 && n <= 84) : []
    const lastCompletedDate = typeof saved.lastCompletedDate === 'string' ? saved.lastCompletedDate : null
    const nextDay = Math.min(84, completedDays.length + 1)
    return { completedDays, lastCompletedDate, activeDay: lastCompletedDate === day && completedDays.length ? completedDays.length : nextDay, today: day, checked: saved.today === day ? (saved.checked || {}) : {} }
  } catch {
    return { completedDays: [], lastCompletedDate: null, activeDay: 1, today: day, checked: {} }
  }
}

function ScanRequirement({ title, complete }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: complete ? 'rgba(198,168,92,0.16)' : 'rgba(255,255,255,0.06)', color: complete ? GOLD : 'rgba(255,255,255,0.5)' }}>
      {complete ? <Check size={18} /> : <Circle size={18} />}
    </span>
    <div className="min-w-0 flex-1">
      <p className="font-heading text-sm font-semibold text-primary">{title}</p>
      <p className="font-body text-xs text-white/65">{complete ? 'Scan complete' : 'Needed to personalize your routine'}</p>
    </div>
  </div>
}

export default function FaceBodyRoutine() {
  const navigate = useNavigate()
  const scans = useStore(state => state.scans)
  const currentScan = useStore(state => state.currentScan)
  const userId = useStore(state => state.user?.id)
  const userGender = useStore(state => state.user?.gender ?? state.user?.profile?.gender)
  const allScans = useMemo(() => {
    const unique = new Map()
    for (const scan of [currentScan, ...scans]) {
      if (scan?.id && !unique.has(scan.id)) unique.set(scan.id, scan)
    }
    return [...unique.values()]
  }, [currentScan, scans])

  const faceScan = useMemo(() => allScans.filter(hasFaceScan).sort((a, b) => scanTime(b) - scanTime(a))[0] ?? null, [allScans])
  const bodyScan = useMemo(() => allScans.filter(hasBodyScan).sort((a, b) => scanTime(b) - scanTime(a))[0] ?? null, [allScans])
  const bothScansReady = Boolean(faceScan && bodyScan)
  const missingScan = !faceScan ? 'face' : !bodyScan ? 'body' : null
  const [todayKey, setTodayKey] = useState(getLocalDateKey)
  const day = todayKey
  const week = getWeekKey(new Date(`${day}T12:00:00`))
  const progressKey = bothScansReady ? `ascendus-glow-routine-${faceScan.id}-${bodyScan.id}` : 'ascendus-glow-routine-pending'
  const [progress, setProgress] = useState(() => loadProgress(progressKey, day, week))
  const planKey = `${progressKey}-ai-12-week-v1`
  const [plan, setPlan] = useState(() => {
    try { return JSON.parse(localStorage.getItem(planKey) || 'null') } catch { return null }
  })
  const [planProgress, setPlanProgress] = useState(() => getPlanProgress(`${planKey}-progress`, day))
  const [selectedPlanWeek, setSelectedPlanWeek] = useState(1)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [expandedAdvice, setExpandedAdvice] = useState(null)
  const [showAllAdvice, setShowAllAdvice] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setTodayKey(getLocalDateKey()), getNextMidnightDelay())
    return () => window.clearTimeout(timer)
  }, [todayKey])

  useEffect(() => {
    setProgress(loadProgress(progressKey, day, week))
  }, [progressKey, day, week])

  useEffect(() => {
    try { setPlan(JSON.parse(localStorage.getItem(planKey) || 'null')) } catch { setPlan(null) }
    setPlanProgress(getPlanProgress(`${planKey}-progress`, day))
  }, [planKey, day])


  const focus = useMemo(() => bothScansReady ? getFocus(faceScan, bodyScan) : null, [bothScansReady, faceScan, bodyScan])
  const recommendations = useMemo(() => bothScansReady ? uniqueRecommendations([
    ...getScanRecommendations(faceScan, 'Face'),
    ...getScanRecommendations(bodyScan, 'Body'),
    ...getSavedCoachRecommendations(userId),
  ]) : [], [bothScansReady, faceScan, bodyScan, userId])
  const coachSplit = useMemo(() => recommendations.filter(isTrainingSplitRecommendation), [recommendations])
  const otherRecommendations = useMemo(() => recommendations.filter(item => !isTrainingSplitRecommendation(item)), [recommendations])
  const completedToday = DAILY_STEPS.filter(step => progress.daily[step.id]).length
  const activeWeekNumber = Math.ceil(planProgress.activeDay / 7)
  useEffect(() => {
    setSelectedPlanWeek(activeWeekNumber)
  }, [planKey, activeWeekNumber])
  const activeWeek = plan?.weeks?.[activeWeekNumber - 1]
  const activeWeekday = (planProgress.activeDay - 1) % 7
  const viewedWeek = plan?.weeks?.[selectedPlanWeek - 1]
  const viewingCurrentWeek = selectedPlanWeek === activeWeekNumber
  const viewedWeekday = viewingCurrentWeek ? activeWeekday : 0
  const currentPhase = activeWeekNumber <= 4 ? 'Foundation' : activeWeekNumber <= 8 ? 'Build' : activeWeekNumber <= 11 ? 'Progress' : 'Deload & review'
  const scheduledWorkoutIndexes = viewedWeek?.sessions?.length
    ? viewedWeek.sessions.map((_, index) => Math.round(index * 6 / viewedWeek.sessions.length))
    : []
  const todaysSessionIndex = scheduledWorkoutIndexes.indexOf(viewedWeekday)
  const todaysSession = todaysSessionIndex >= 0 ? viewedWeek.sessions[todaysSessionIndex] : null
  const faceActionRecommendations = recommendations.filter(item => /skin|cleanser|moistur|spf|sunscreen|groom|hair|photo|presentation/i.test(item.text))
  const todayFaceAction = faceActionRecommendations.length ? faceActionRecommendations[(planProgress.activeDay - 1) % faceActionRecommendations.length] : null
  const activeMissionSteps = [
    ...(todaysSession?.exercises?.map((exercise, index) => {
      const deload = activeWeekNumber === 4 || activeWeekNumber === 8 || activeWeekNumber === 12
      const progressionSet = (activeWeekNumber >= 5 && activeWeekNumber <= 7 && index < 2) || (activeWeekNumber >= 9 && activeWeekNumber <= 11 && index < 3)
      const sets = Math.max(1, Number(exercise.sets) - (deload ? 1 : 0) + (progressionSet ? 1 : 0))
      return { title: `${exercise.name} · ${sets} × ${exercise.reps}` }
    }) ?? [{ title: viewedWeekday === 6 ? 'Rest and recover' : 'Easy walk or gentle mobility' }]),
    { title: todayFaceAction ? todayFaceAction.text.slice(0, 110) : 'Cleanse, moisturize + SPF' },
  ]
  const planDayDone = viewingCurrentWeek && planProgress.completedDays.includes(planProgress.activeDay)
  const checkedPlanSteps = activeMissionSteps.filter((_, index) => planProgress.checked[`${planProgress.activeDay}-${index}`]).length

  function saveProgress(next) {
    setProgress(next)
    try { localStorage.setItem(progressKey, JSON.stringify(next)) } catch { /* routine still works for this visit */ }
  }

  function toggleStep(id) {
    triggerHaptic()
    saveProgress({ ...progress, day, daily: { ...progress.daily, [id]: !progress.daily[id] }, week, sessions: progress.sessions })
  }

  async function generatePlan() {
    if (!bothScansReady || planLoading) return
    triggerHaptic()
    setPlanLoading(true)
    setPlanError('')
    try {
      const physiqueScores = {
        proportions: getPhysiqueMetricScore(bodyScan, 'proportions') ?? 5,
        leanness: getPhysiqueMetricScore(bodyScan, 'leanness') ?? getPhysiqueMetricScore(bodyScan, 'body_fat_score') ?? 5,
        frame: getPhysiqueMetricScore(bodyScan, 'frame') ?? getPhysiqueMetricScore(bodyScan, 'frame_width') ?? 5,
        posture: getPhysiqueMetricScore(bodyScan, 'posture') ?? 5,
        overall_presentation: getPhysiqueMetricScore(bodyScan, 'overall_presentation') ?? getPhysiqueMetricScore(bodyScan, 'overall') ?? 5,
        potential: getPhysiqueMetricScore(bodyScan, 'potential') ?? 5,
        muscle_mass: getPhysiqueMetricScore(bodyScan, 'muscle_mass') ?? 5,
        body_fat_score: getPhysiqueMetricScore(bodyScan, 'body_fat_score') ?? 5,
        v_taper: getPhysiqueMetricScore(bodyScan, 'v_taper') ?? 5,
        frame_width: getPhysiqueMetricScore(bodyScan, 'frame_width') ?? 5,
      }
      const weeklyPlan = await api.ai.workoutPlan({ physiqueScores, gender: userGender === 'female' ? 'female' : 'male', trainingLevel: 'beginner' })
      if (!Array.isArray(weeklyPlan?.days) || weeklyPlan.days.length < 2) throw new Error('The AI workout plan was incomplete. Try again.')
      const savedPlan = {
        version: 1,
        split: weeklyPlan.split,
        trainingLevel: weeklyPlan.trainingLevel || 'beginner',
        startDate: day,
        weeks: Array.from({ length: 12 }, (_, index) => ({ week: index + 1, phase: index < 4 ? 'Foundation' : index < 8 ? 'Build' : index < 11 ? 'Progress' : 'Deload & review', sessions: weeklyPlan.days })),
        faceFocus: focus.faceFocus?.label ?? 'Daily basics',
        bodyFocus: focus.bodyFocus?.label ?? 'Balanced strength',
        recommendations: recommendations.map(({ text, kind, url }) => ({ text, kind, url })),
      }
      setPlan(savedPlan)
      const newProgress = { completedDays: [], lastCompletedDate: null, activeDay: 1, today: day, checked: {} }
      setPlanProgress(newProgress)
      localStorage.setItem(planKey, JSON.stringify(savedPlan))
      localStorage.setItem(`${planKey}-progress`, JSON.stringify(newProgress))
    } catch (error) {
      setPlanError(error?.message || 'Could not create the routine right now. Try again.')
    } finally {
      setPlanLoading(false)
    }
  }

  function togglePlanStep(index) {
    if (!activeWeek || planDayDone) return
    triggerHaptic()
    const checked = { ...planProgress.checked, [`${planProgress.activeDay}-${index}`]: !planProgress.checked[`${planProgress.activeDay}-${index}`] }
    const next = { ...planProgress, today: day, checked }
    setPlanProgress(next)
    try { localStorage.setItem(`${planKey}-progress`, JSON.stringify(next)) } catch { /* keep the session usable */ }
  }

  function completePlanDay() {
    if (!activeWeek || planDayDone || checkedPlanSteps !== activeMissionSteps.length) return
    triggerHaptic()
    const next = { ...planProgress, completedDays: [...new Set([...planProgress.completedDays, planProgress.activeDay])], lastCompletedDate: day, today: day, checked: planProgress.checked }
    setPlanProgress(next)
    try { localStorage.setItem(`${planKey}-progress`, JSON.stringify(next)) } catch { /* keep the session usable */ }
  }

  return <MotionPage>
    <PageHeader title="Face and Body Routine" onBack={() => navigate('/extras')} />
    <main className="space-y-4 px-4 pb-28 pt-3">
      {bothScansReady ? <section className="flex items-center justify-between rounded-2xl border border-[rgba(198,168,92,0.2)] bg-white/[0.025] px-4 py-3">
        <div><p className="font-heading text-lg font-bold text-primary">Your routine</p><p className="font-body text-xs text-white/55">Personalized from both scans</p></div>
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-body text-[10px] font-semibold" style={{ color: GOLD, background: 'rgba(198,168,92,0.1)' }}><Check size={13} /> Face + body</span>
      </section> : null}

      {!bothScansReady ? <section className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'rgba(198,168,92,0.24)', background: 'linear-gradient(145deg, rgba(198,168,92,0.08), rgba(255,255,255,0.025))' }}>
        <div className="flex items-start gap-3">
          <span className="rounded-xl p-2.5" style={{ color: GOLD, background: 'rgba(198,168,92,0.12)' }}><LockKeyhole size={19} /></span>
          <div><p className="font-heading text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>Routine locked</p><h1 className="mt-1 font-heading text-lg font-bold text-primary">Complete both scans to unlock</h1></div>
        </div>
        <p className="font-body text-sm leading-relaxed text-white/65">{faceScan && !bodyScan
          ? 'Your face scan is complete. Finish your body scan to unlock a routine personalized with both results.'
          : bodyScan && !faceScan
            ? 'Your body scan is complete. Finish your face scan to unlock a routine personalized with both results.'
            : 'Complete your face and body scans to unlock a routine personalized with both results.'}</p>
        <div className="space-y-2">
          <ScanRequirement title="Face scan" complete={Boolean(faceScan)} />
          <ScanRequirement title="Body scan" complete={Boolean(bodyScan)} />
        </div>
        <button type="button" onClick={() => { triggerHaptic(); navigate(missingScan === 'body' ? '/physique-scan' : '/scan/capture') }} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-heading text-sm font-bold text-black" style={{ background: GOLD }}>
          Continue with {missingScan === 'body' ? 'body' : 'face'} scan <ArrowRight size={16} />
        </button>
        {!faceScan && !bodyScan && <button type="button" onClick={() => { triggerHaptic(); navigate('/physique-scan') }} className="w-full rounded-xl border border-white/10 px-4 py-2.5 font-body text-sm font-medium text-white/65">Start with body scan instead</button>}
      </section> : <>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><p className="font-body text-[10px] uppercase tracking-wider text-white/45">Face focus</p><p className="mt-1 font-heading text-sm font-semibold text-primary">{focus.faceFocus?.label ?? 'Daily basics'}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3"><p className="font-body text-[10px] uppercase tracking-wider text-white/45">Body focus</p><p className="mt-1 font-heading text-sm font-semibold text-primary">{focus.bodyFocus?.label ?? 'Balanced strength'}</p></div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[rgba(198,168,92,0.3)] bg-[#121212] shadow-[0_14px_40px_rgba(198,168,92,0.06)]">
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-2xl p-3" style={{ color: GOLD, background: 'rgba(198,168,92,0.13)' }}><Dumbbell size={20} /></span><div className="min-w-0"><h2 className="font-heading text-lg font-bold text-primary">12-week glow-up</h2><p className="font-body text-xs text-white/55">Your scan-based plan</p></div></div>{plan && <span className="shrink-0 font-body text-xs font-semibold" style={{ color: GOLD }}>{planProgress.completedDays.length}/84</span>}</div>
            {!plan && <div className="rounded-2xl bg-white/[0.035] p-4"><p className="font-heading text-sm font-semibold text-primary">A real 12-week training plan</p><p className="mt-1 font-body text-xs leading-relaxed text-white/60">The AI uses your body-scan metrics to choose your split and exercises, then builds a steady 3-phase progression.</p>
              <button type="button" disabled={planLoading} onClick={generatePlan} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-heading text-sm font-bold text-black transition-transform active:scale-[0.98] disabled:opacity-65" style={{ background: GOLD }}>{planLoading ? <><LoaderCircle size={17} className="animate-spin" /> Building your 12-week plan…</> : <><Sparkles size={17} /> Build my 12-week plan <ArrowRight size={16} /></>}</button>
              {planError && <p role="alert" className="mt-3 font-body text-xs text-red-300">{planError}</p>}
            </div>}
            {plan && <>
              <div className="mb-2 flex items-center justify-between gap-3"><p className="truncate font-heading text-sm font-bold text-primary">{plan.split || 'Your personal split'}</p><p className="shrink-0 font-body text-[11px] text-white/50">{planProgress.completedDays.length}/84 days</p></div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${planProgress.completedDays.length / 84 * 100}%`, background: GOLD }} /></div>
              <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Choose a plan week">
                {plan.weeks.map((item, index) => {
                  const number = index + 1
                  const complete = planProgress.completedDays.length >= number * 7
                  const current = number === selectedPlanWeek
                  const locked = number > activeWeekNumber
                  return <button key={`path-${number}`} type="button" disabled={locked} aria-pressed={current} onClick={() => setSelectedPlanWeek(number)} className="flex h-9 min-w-10 items-center justify-center gap-1 rounded-full border px-3 font-heading text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-35" style={{ borderColor: current ? GOLD : 'rgba(255,255,255,0.1)', color: complete && !current ? '#090909' : current ? GOLD : 'rgba(255,255,255,0.65)', background: complete && !current ? GOLD : current ? 'rgba(198,168,92,0.12)' : '#171717' }} aria-label={`Week ${number}${locked ? ', locked' : ''}`}>{complete && <Check size={12} />}<span>{number}</span></button>
                })}
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="mb-3 flex items-start justify-between gap-3"><div><p className="font-body text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: GOLD }}>WEEK {selectedPlanWeek} · {viewedWeek?.phase || currentPhase}{viewingCurrentWeek ? ` · DAY ${activeWeekday + 1}` : ''}</p><h3 className="mt-1 font-heading text-base font-bold text-primary">{todaysSession?.name || (viewedWeekday === 6 ? 'Rest & recover' : 'Recovery day')}</h3><p className="mt-0.5 font-body text-[11px] text-white/50">{viewingCurrentWeek ? (planDayDone ? 'Done for today' : `${checkedPlanSteps} of ${activeMissionSteps.length} complete`) : 'Preview · tap a week to explore'}</p></div>{viewingCurrentWeek && <span className="shrink-0 rounded-full bg-white/[0.07] px-2.5 py-1 font-body text-[10px] text-white/60">{planDayDone ? activeMissionSteps.length : checkedPlanSteps}/{activeMissionSteps.length}</span>}</div>
                {!planDayDone && activeMissionSteps.length > 0 && <div className="space-y-2">{activeMissionSteps.map((step, index) => {
                  const checked = Boolean(planProgress.checked[`${planProgress.activeDay}-${index}`])
                  return <button key={`step-${index}`} type="button" disabled={!viewingCurrentWeek || planDayDone} onClick={() => togglePlanStep(index)} aria-pressed={checked} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:scale-[0.99] disabled:cursor-default" style={{ borderColor: checked ? 'rgba(198,168,92,0.38)' : 'rgba(255,255,255,0.07)', background: checked ? 'rgba(198,168,92,0.09)' : 'rgba(0,0,0,0.12)' }}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: checked ? GOLD : 'rgba(255,255,255,0.22)', background: checked ? GOLD : 'transparent', color: '#090909' }}>{checked && <Check size={13} />}</span><span className="min-w-0 font-heading text-sm font-semibold text-primary">{step.title}</span></button>
                })}</div>}
                {planDayDone ? <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[rgba(198,168,92,0.08)] p-3 font-heading text-sm font-semibold text-primary"><Check size={16} style={{ color: GOLD }} /> {planProgress.completedDays.length >= 84 ? '12 weeks complete!' : 'Today complete · next day opens tomorrow'}</div> : viewingCurrentWeek && <button type="button" onClick={completePlanDay} disabled={!activeWeek || checkedPlanSteps !== activeMissionSteps.length} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-heading text-sm font-bold transition-colors disabled:cursor-not-allowed" style={{ background: checkedPlanSteps === activeMissionSteps.length ? GOLD : '#292929', color: checkedPlanSteps === activeMissionSteps.length ? '#090909' : 'rgba(255,255,255,0.48)' }}>Complete today <ArrowRight size={16} /></button>}
              </div>
              {planError && <p role="alert" className="mt-3 font-body text-xs text-red-300">{planError}</p>}
            </>}
          </div>
        </section>

        <details className="group rounded-2xl border border-white/10 bg-[#111] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#C6A85C]"><span><span className="block font-heading text-sm font-bold text-primary">Scan &amp; Coach advice</span><span className="mt-0.5 block font-body text-[11px] text-white/50">{otherRecommendations.length ? `${otherRecommendations.length} saved · tap an item to read` : 'No saved advice yet'}</span></span><ArrowRight size={16} className="rotate-90 text-white/45 transition-transform group-open:rotate-[270deg]" /></summary>
          <div className="mt-3 space-y-2">
          {otherRecommendations.length > 0 ? <div className="space-y-2">
            {otherRecommendations.slice(0, showAllAdvice ? 12 : 3).map(item => {
              const expanded = expandedAdvice === item.id
              const title = adviceTitle(item.text)
              const body = item.text.slice(title.replace(/…$/, '').length).replace(/^\s*[-–—:.]?\s*/, '').trim()
              return <article key={item.id} className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5">
                <button type="button" aria-expanded={expanded} onClick={() => setExpandedAdvice(expanded ? null : item.id)} className="flex w-full items-start justify-between gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#C6A85C]">
                  <span className="min-w-0"><span className="mb-1 block font-body text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>{item.kind} <span className="px-1 text-white/25">·</span> <span className="normal-case tracking-normal text-white/45">{item.source}</span></span><span className="block font-heading text-sm font-semibold leading-snug text-primary">{title}</span>{(body || expanded) && <span className={`mt-1 block font-body text-xs leading-relaxed text-white/60 ${expanded ? '' : 'line-clamp-2'}`}>{body || item.text}</span>}</span>
                  <ArrowRight size={15} className={`mt-1 shrink-0 text-white/40 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>
                {expanded && item.url && <a href={item.url} target="_blank" rel="noopener noreferrer sponsored" className="mt-2 inline-flex items-center gap-1 font-heading text-xs font-semibold" style={{ color: GOLD }}>View recommended product <ArrowRight size={13} /> </a>}
              </article>
            })}
            {otherRecommendations.length > 3 && <button type="button" onClick={() => setShowAllAdvice(value => !value)} className="w-full rounded-xl border border-white/[0.08] px-3 py-2.5 text-center font-heading text-xs font-semibold text-white/65 transition-colors hover:bg-white/[0.04]">{showAllAdvice ? 'Show less' : `Show all ${otherRecommendations.length} recommendations`}</button>}
          </div> : <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <p className="font-body text-xs leading-relaxed text-white/65">No saved scan or coach recommendations yet. Ask the AI Coach and the advice will appear here.</p>
            <button type="button" onClick={() => { triggerHaptic(); navigate('/coach', { state: { coachPrompt: 'Using my completed face and body scans, give me practical recommendations to add to my Face and Body Routine. Include any specific products you recommend and how to use them.' } }) }} className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 font-heading text-xs font-bold text-black" style={{ background: GOLD }}>Ask AI Coach <ArrowRight size={14} /></button>
          </div>}
          </div>
        </details>

        <details className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span><span className="block font-heading text-sm font-bold text-primary">Everyday basics</span><span className="mt-0.5 block font-body text-[11px] text-white/50">{completedToday} of {DAILY_STEPS.length} checked today</span></span><ArrowRight size={16} className="rotate-90 text-white/45" /></summary>
          <div className="mt-4">
          <div className="mb-3 flex items-end justify-between"><div><h2 className="font-heading text-base font-bold text-primary">Daily routine</h2><p className="font-body text-xs text-white/65">{completedToday} of {DAILY_STEPS.length} habits checked off today</p></div><span className="font-heading text-sm font-bold" style={{ color: GOLD }}>{Math.round(completedToday / DAILY_STEPS.length * 100)}%</span></div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${completedToday / DAILY_STEPS.length * 100}%`, background: GOLD }} /></div>
          <div className="space-y-2">
            {DAILY_STEPS.map(step => {
              const Icon = step.icon
              const checked = Boolean(progress.daily[step.id])
              return <button key={step.id} type="button" onClick={() => toggleStep(step.id)} aria-pressed={checked} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors" style={{ borderColor: checked ? 'rgba(198,168,92,0.35)' : 'rgba(255,255,255,0.07)', background: checked ? 'rgba(198,168,92,0.07)' : 'rgba(255,255,255,0.025)' }}>
                <span className="mt-0.5" style={{ color: checked ? GOLD : 'rgba(255,255,255,0.42)' }}>{checked ? <Check size={18} /> : <Icon size={18} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-heading text-sm font-semibold text-primary">{step.title}</span><span className="mt-1 block font-body text-xs leading-relaxed text-white/65">{step.detail}</span></span>
              </button>
            })}
          </div>
          </div>
        </details>
      </>}
    </main>
  </MotionPage>
}
