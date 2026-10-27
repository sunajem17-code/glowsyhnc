import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Dumbbell, ArrowRight, LoaderCircle, ChevronLeft, ChevronRight, TrendingUp, CalendarDays, ScanFace, Activity, Sun, Droplets, Flame } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import { getPhysiqueMetricScore } from '../utils/physiqueResults'
import { getRevealRatings } from '../utils/revealRatings'
import { parseCoachMessage } from '../utils/coachMessage'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { getValidatedFaceRecommendations } from '../utils/scanRoutineRecommendations'

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

function getScheduledWeekdays(count) {
  const schedules = { 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 3, 4, 6], 6: [0, 1, 2, 4, 5, 6] }
  return schedules[count] ?? []
}

function loadProgress(key, day, week) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    return {
      day,
      daily: saved.day === day && saved.daily && typeof saved.daily === 'object' ? saved.daily : saved.history?.[day] ?? {},
      history: saved.history && typeof saved.history === 'object' ? saved.history : {},
      week,
      sessions: saved.week === week && Number.isFinite(saved.sessions) ? Math.min(3, Math.max(0, saved.sessions)) : 0,
      workoutDate: saved.workoutDate === day ? day : null,
    }
  } catch {
    return { day, daily: {}, history: {}, week, sessions: 0, workoutDate: null }
  }
}

function getNextMidnightDelay() {
  const next = new Date()
  next.setHours(24, 0, 0, 50)
  return Math.max(1000, next.getTime() - Date.now())
}

function getFocus(faceScan, bodyScan) {
  const faceRatings = FACE_RATINGS
    .map(metric => ({ ...metric, score: faceScanScore(faceScan, metric.label) }))
    .filter(metric => metric.score != null)
  const bodyRatings = BODY_RATINGS
    .map(metric => ({ ...metric, score: getPhysiqueMetricScore(bodyScan, metric.key) }))
    .filter(metric => metric.score != null)
  const faceSorted = [...faceRatings].sort((a, b) => a.score - b.score)
  const bodySorted = [...bodyRatings].sort((a, b) => a.score - b.score)
  const faceFocus = faceSorted[0]
  const bodyFocus = bodySorted[0]

  const faceCopy = faceFocus?.key === 'skin'
    ? `Your lowest available face rating was ${faceFocus.label}. The plan starts with consistent, gentle skincare basics.`
    : 'The face scan helps set a steady skincare and grooming baseline; ratings are photo-based and do not diagnose skin or health.'
  const bodyCopy = bodyFocus?.key === 'muscle_mass'
    ? `Your lowest available body rating was ${bodyFocus.label}. The plan emphasizes balanced, progressive strength sessions.`
    : bodyFocus?.key === 'v_taper' || bodyFocus?.key === 'frame_width'
      ? `Your lowest available body rating was ${bodyFocus.label}. The strength sessions include balanced upper-body push and pull movements.`
      : 'The body scan informs a balanced strength routine, with rest and gradual progression built in.'

  return { faceFocus, bodyFocus, faceCopy, bodyCopy, faceRatings, bodyRatings, facePriorities: faceSorted.slice(0, 3), bodyPriorities: bodySorted.slice(0, 3), faceStrengths: [...faceSorted].reverse().slice(0, 2), bodyStrengths: [...bodySorted].reverse().slice(0, 2) }
}

const TRAINING_GOALS = ['Build muscle', 'Gain strength', 'Improve fitness', 'Lose fat']
const TRAINING_LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const EQUIPMENT_OPTIONS = ['Bodyweight', 'Dumbbells', 'Home gym', 'Full gym']
const TRAINING_FOCUS_OPTIONS = ['Auto from scan', 'Balanced', 'Shoulders', 'Chest', 'Back', 'Arms', 'Core', 'Legs', 'Hamstrings and glutes', 'Calves']
const ACTIVITY_LEVELS = ['Mostly seated', 'Lightly active', 'Active most days']
const PHASES = [
  { number: '01', name: 'Foundation', weeks: 'Weeks 1–4', note: 'Build the habit, learn the movements, and set a baseline.' },
  { number: '02', name: 'Development', weeks: 'Weeks 5–8', note: 'Progress reps or load gradually while protecting recovery.' },
  { number: '03', name: 'Refinement', weeks: 'Weeks 9–12', note: 'Keep what is working and review progress before changing priorities.' },
]

function getInitialTrainingPreferences(userProfile) {
  const goal = TRAINING_GOALS.find(value => value.toLowerCase() === String(userProfile?.goal ?? '').toLowerCase()) ?? ''
  const level = TRAINING_LEVELS.find(value => value.toLowerCase() === String(userProfile?.trainingLevel ?? userProfile?.experience ?? '').toLowerCase()) ?? ''
  const days = Number(userProfile?.trainingDaysPerWeek)
  const equipment = EQUIPMENT_OPTIONS.find(value => value.toLowerCase() === String(userProfile?.equipment ?? '').toLowerCase()) ?? ''
  return { goal: goal || 'Improve fitness', level: level || 'Beginner', daysPerWeek: days >= 2 && days <= 6 ? days : 3, equipment: equipment || 'Bodyweight', priorityFocus: 'Auto from scan' }
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
  const validatedFaceAdvice = area === 'Face' ? getValidatedFaceRecommendations(scan) : []
  const commonCandidates = [
    ...validatedFaceAdvice,
    ...(Array.isArray(presentation.recommendations) ? presentation.recommendations : []),
    ...(Array.isArray(assessment.recommendations) ? assessment.recommendations : []),
    ...(Array.isArray(ai.recommendations) ? ai.recommendations : []),
    ...(Array.isArray(ai.suggestions) ? ai.suggestions : []),
    ...(Array.isArray(scan?.suggestions) ? scan.suggestions : []),
    ...(Array.isArray(ai.insights) ? ai.insights : []),
    ...(Array.isArray(scan?.insights) ? scan.insights : []),
  ]
  const candidates = area === 'Body' ? [
    ...commonCandidates,
    ...(Array.isArray(physique.recommendations) ? physique.recommendations : []),
    ...(Array.isArray(physique.suggestions) ? physique.suggestions : []),
  ] : commonCandidates
  return candidates
    .map(candidate => {
      if (candidate?.source === 'Face scan' && candidate?.recommendation) {
        return { ...candidate, text: `${candidate.title} — ${candidate.recommendation}` }
      }
      return { text: recommendationText(candidate) }
    })
    .filter(item => item.text && !/demo mode/i.test(item.text))
    .map((item, index) => ({ id: item.id || `${area}-ai-${index}`, ...item, source: item.source || `${area} scan`, kind: item.kind || (/cerave|cleanser|moistur|serum|spf|sunscreen|product/i.test(item.text) ? 'Product or care' : 'Action') }))
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
  return firstLine
}

function getPlanProgress(key, day, legacyKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : null) || '{}')
    const completedDays = Array.isArray(saved.completedDays) ? saved.completedDays.filter(n => Number.isInteger(n) && n >= 1 && n <= 84) : []
    const lastCompletedDate = typeof saved.lastCompletedDate === 'string' ? saved.lastCompletedDate : null
    const nextDay = Math.min(84, completedDays.length + 1)
    return { completedDays, lastCompletedDate, activeDay: lastCompletedDate === day && completedDays.length ? completedDays.length : nextDay, today: day, checked: saved.checked && typeof saved.checked === 'object' ? saved.checked : {}, liftLogs: saved.liftLogs && typeof saved.liftLogs === 'object' ? saved.liftLogs : {} }
  } catch {
    return { completedDays: [], lastCompletedDate: null, activeDay: 1, today: day, checked: {}, liftLogs: {} }
  }
}

const SLIDES = [
  { title: 'Your Face Routine', eyebrow: '01 · FACE', icon: ScanFace },
  { title: 'Your Body Routine', eyebrow: '02 · BODY', icon: Dumbbell },
  { title: 'Your 12-Week Plan', eyebrow: '03 · PLAN', icon: CalendarDays },
  { title: 'Your Daily Checklist', eyebrow: '04 · TODAY', icon: Check },
  { title: 'Your Improvement Guide', eyebrow: '05 · GUIDE', icon: TrendingUp },
]

function scoreText(metric) {
  return metric ? `${metric.score.toFixed(1)} / 10` : 'Not scored'
}

function getTrainingScores(scan) {
  const keys = ['proportions', 'leanness', 'frame', 'posture', 'overall_presentation', 'potential', 'muscle_mass', 'body_fat_score', 'v_taper', 'frame_width']
  return Object.fromEntries(keys.flatMap(key => {
    const value = getPhysiqueMetricScore(scan, key)
    return value == null ? [] : [[key, value]]
  }))
}

const TRAINING_METRIC_LABELS = {
  v_taper: 'V-Taper', frame_width: 'Frame Width', muscle_mass: 'Muscle Mass',
  posture: 'Posture', proportions: 'Proportions', frame: 'Frame',
  leanness: 'Leanness', body_fat_score: 'Body Fat', overall_presentation: 'Presentation',
}

function getTrainingEmphasis(scores, goal, priorityFocus = 'Auto from scan') {
  if (priorityFocus && !['Auto from scan', 'Balanced'].includes(priorityFocus)) return { title: `${priorityFocus} emphasis`, reason: `You chose ${priorityFocus.toLowerCase()} as the area to emphasize. The plan keeps the rest of your training balanced.` }
  if (priorityFocus === 'Balanced') return { title: 'Balanced full-body training', reason: 'You chose balanced development, so the plan gives each major movement pattern regular training.' }
  const excluded = new Set(['potential', 'overall_presentation'])
  if (goal === 'Lose fat') return { title: 'Balanced full-body strength', reason: 'Your goal sets the emphasis. Photo ratings are not body-fat measurements, so the scan is not used to prescribe weight loss.' }

  const priorities = Object.entries(scores)
    .filter(([key, score]) => !excluded.has(key) && key !== 'leanness' && key !== 'body_fat_score' && Number.isFinite(Number(score)))
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .slice(0, 2)
  const areas = priorities.map(([key]) => key)
  if (areas.some(key => key === 'v_taper' || key === 'frame_width')) {
    return { title: 'Upper-back and shoulder development', reason: `Extra weekly pulling and shoulder work is prioritized because ${areas.filter(key => key === 'v_taper' || key === 'frame_width').map(key => TRAINING_METRIC_LABELS[key]).join(' and ')} were the lowest available physique ratings. The scan is a visual estimate, not a measurement.` }
  }
  if (areas.includes('muscle_mass')) return { title: 'Progressive full-body muscle building', reason: 'The plan emphasizes repeatable full-body resistance work because Muscle Mass was one of the lowest available ratings. Treat the photo score as context, not a measurement.' }
  if (areas.includes('posture')) return { title: 'Upper-back control and balanced strength', reason: 'The plan adds upper-back and trunk-control work because Posture was one of the lowest available photo ratings; a scan cannot assess everyday posture.' }
  if (areas.some(key => ['proportions', 'frame'].includes(key))) return { title: 'Balanced full-body development', reason: `The plan uses balanced training because ${areas.filter(key => ['proportions', 'frame'].includes(key)).map(key => TRAINING_METRIC_LABELS[key]).join(' and ')} were among the lowest visual ratings; these scores do not measure anatomy.` }
  return { title: goal === 'Gain strength' ? 'Balanced strength progression' : 'Balanced progressive training', reason: 'No specific trainable weak area stood out in the saved ratings, so the plan follows your goal and keeps upper body, lower body, and trunk work balanced.' }
}

function addExerciseGuidance(exercise, preferences) {
  const name = String(exercise.name || 'Exercise')
  const normalized = name.toLowerCase()
  let instructions = exercise.instructions
  if (!instructions) {
    if (/push.?up|press/.test(normalized)) instructions = 'Set your hands just outside shoulder width and brace your trunk. Lower under control with elbows angled comfortably, then press back up without letting your hips sag.'
    else if (/squat/.test(normalized)) instructions = 'Stand with feet about shoulder width and brace your trunk. Sit hips down between your feet, keep the whole foot grounded, then stand smoothly.'
    else if (/lunge|split squat|step.?up/.test(normalized)) instructions = 'Stand tall and brace your trunk. Step into a stable, comfortable stance, lower under control, then push through the front foot to return.'
    else if (/bridge|hip thrust/.test(normalized)) instructions = 'Lie on your back with knees bent and feet flat. Brace gently, squeeze your glutes to lift your hips, pause briefly, then lower slowly.'
    else if (/plank|dead bug|bird dog/.test(normalized)) instructions = 'Brace gently and keep your ribs stacked over your pelvis. Move slowly while keeping your lower back comfortable; shorten the hold or range if your form changes.'
    else if (/calf/.test(normalized)) instructions = 'Stand steadily with feet hip-width apart. Rise onto the balls of your feet, pause, then lower slowly through a comfortable range.'
    else if (/row|pull.?up|chin.?up/.test(normalized)) instructions = 'Use only the listed equipment and a stable setup. Keep your shoulders controlled, pull smoothly without swinging, pause briefly, then return slowly.'
    else instructions = `Set up with the listed ${preferences.equipment.toLowerCase()} and use a stable, comfortable range. Brace gently, move under control, and stop if you feel pain or cannot keep steady form.`
  }
  const fallbackProgression = preferences.equipment === 'Bodyweight'
    ? 'Keep the same variation until every set reaches the top of the rep range with steady, pain-free form; then add a rep or choose a slightly harder bodyweight variation.'
    : 'Keep the same load until every set reaches the top of the rep range with steady, pain-free form; then add one rep or a small amount of resistance.'
  const progressionInstructions = exercise.progressionInstructions || fallbackProgression
  return { ...exercise, name, why: exercise.why || `This movement supports your ${preferences.goal.toLowerCase()} goal and the weekly training emphasis.`, instructions, progressionInstructions, restSeconds: Number(exercise.restSeconds) || 90 }
}

function getLoggedProgression(exercise, loggedText, isComplete) {
  if (!isComplete || !loggedText || !exercise?.progressionInstructions) return ''
  const range = String(exercise.reps || '').match(/(\d+)\s*[-–]\s*(\d+)/)
  if (!range) return 'Log this session and use the progression guidance above to decide what to change next time.'
  const target = Number(range[2])
  const logged = String(loggedText).split(/[;,\s]+/).map(Number).filter(Number.isFinite)
  if (logged.length >= Number(exercise.sets) && logged.slice(0, Number(exercise.sets)).every(value => value >= target)) {
    return `You logged the top of the range for every set. If form stayed controlled and the effort target was met, next time: ${exercise.progressionInstructions}`
  }
  return `Logged performance is below the top of the range. Keep the same variation and build reps gradually; ${exercise.progressionInstructions}`
}

function getRoutineSummary(scan, area) {
  const ai = scan?.aiScore ?? {}
  const candidate = ai.summary ?? ai.overallAssessment ?? ai.overall_assessment ?? scan?.summary
  return typeof candidate === 'string' ? candidate.trim() : ''
}

function asWeekPlan(weeklyPlan, preferences, startDate, scores) {
  const emphasis = getTrainingEmphasis(scores, preferences.goal)
  const sessions = weeklyPlan.days.map(day => ({
    ...day,
    exercises: day.exercises.map(exercise => addExerciseGuidance(exercise ?? {}, preferences)),
  }))
  return {
    version: 3,
    split: weeklyPlan.split,
    trainingLevel: weeklyPlan.trainingLevel,
    trainingEmphasis: weeklyPlan.trainingEmphasis || emphasis.title,
    emphasisReason: weeklyPlan.emphasisReason || emphasis.reason,
    priorities: Array.isArray(weeklyPlan.priorities) ? weeklyPlan.priorities : [],
    maintenanceAreas: Array.isArray(weeklyPlan.maintenanceAreas) ? weeklyPlan.maintenanceAreas : [],
    fallbackUsed: Boolean(weeklyPlan.fallbackUsed),
    fallbackNotice: typeof weeklyPlan.fallbackNotice === 'string' ? weeklyPlan.fallbackNotice : '',
    priorityMetrics: Array.isArray(weeklyPlan.priorityMetrics) && weeklyPlan.priorityMetrics.length ? weeklyPlan.priorityMetrics : Object.entries(scores).filter(([key]) => !['potential', 'overall_presentation', 'leanness', 'body_fat_score'].includes(key)).sort((a, b) => Number(a[1]) - Number(b[1])).slice(0, 2).map(([key]) => TRAINING_METRIC_LABELS[key] || key),
    preferences,
    startDate,
    weeks: Array.from({ length: 12 }, (_, index) => {
      const week = index + 1
      const deload = [4, 8, 12].includes(week)
      const phase = week <= 4 ? 'Foundation' : week <= 8 ? 'Development' : 'Refinement'
      return {
        week, phase, deload,
        sessions: sessions.map(session => ({
          ...session,
          exercises: session.exercises.map(exercise => {
            return { ...exercise, sets: Math.max(1, Number(exercise.sets) - (deload ? 1 : 0)) }
          }),
        })),
        objective: deload ? 'Reduce each exercise by one set, keep effort comfortable, and note how recovery feels.' : week <= 3 ? 'Learn the movements and record a manageable starting load and reps.' : week <= 7 ? 'Keep the same schedule; add reps or a small amount of resistance only after every set reaches the top of its range with steady form.' : week <= 11 ? 'Continue gradual progression and review your log for stalled lifts before changing the plan.' : 'Use the lighter week to recover, then compare repeatable scan photos and your training log.',
      }
    }),
  }
}

function ToggleTask({ checked, title, detail, onClick }) {
  return <div className="border-b border-white/[.07] py-2 last:border-0">
    <button type="button" aria-pressed={checked} onClick={onClick} className="flex w-full items-center gap-3 py-2 text-left">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: checked ? GOLD : 'rgba(255,255,255,.25)', background: checked ? GOLD : 'transparent', color: '#090909' }}>{checked && <Check size={13} />}</span>
      <span className="min-w-0 flex-1 font-heading text-sm font-semibold text-primary">{title}</span>
    </button>
    {detail && <details className="ml-8 pb-1 font-body text-xs leading-relaxed text-white/60"><summary className="w-max cursor-pointer text-[11px] font-semibold" style={{ color: GOLD }}>Instructions</summary><p className="mt-1">{detail}</p></details>}
  </div>
}

function PreferenceChoice({ label, value, options, onChange }) {
  return <fieldset className="space-y-2"><legend className="font-body text-xs font-semibold text-white/65">{label}</legend><div className="flex flex-wrap gap-2">{options.map(option => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className="rounded-full border px-3 py-2 font-body text-xs font-medium transition-colors" style={{ borderColor: value === option ? GOLD : 'rgba(255,255,255,.12)', background: value === option ? 'rgba(198,168,92,.13)' : 'rgba(255,255,255,.03)', color: value === option ? GOLD : 'rgba(255,255,255,.72)' }}>{option}</button>)}</div></fieldset>
}

export default function FaceBodyRoutineExperience() {
  const navigate = useNavigate()
  const scans = useStore(state => state.scans)
  const currentScan = useStore(state => state.currentScan)
  const streak = useStore(state => state.streak)
  const updateStreak = useStore(state => state.updateStreak)
  const userId = useStore(state => state.user?.id)
  const userProfile = useStore(state => state.userProfile)
  const allScans = useMemo(() => {
    const unique = new Map()
    for (const scan of [currentScan, ...scans]) if (scan?.id && !unique.has(scan.id)) unique.set(scan.id, scan)
    return [...unique.values()]
  }, [currentScan, scans])
  const faceScan = useMemo(() => allScans.filter(hasFaceScan).sort((a, b) => scanTime(b) - scanTime(a))[0] ?? null, [allScans])
  const bodyScan = useMemo(() => allScans.filter(hasBodyScan).sort((a, b) => scanTime(b) - scanTime(a))[0] ?? null, [allScans])
  const bothScansReady = Boolean(faceScan && bodyScan)
  const focus = useMemo(() => getFocus(faceScan, bodyScan), [faceScan, bodyScan])
  const recommendations = useMemo(() => uniqueRecommendations([
    ...(faceScan ? getScanRecommendations(faceScan, 'Face') : []),
    ...(bodyScan ? getScanRecommendations(bodyScan, 'Body') : []),
    ...getSavedCoachRecommendations(userId),
  ]), [faceScan, bodyScan, userId])
  const faceRecommendations = recommendations.filter(item => item.source === 'Face scan' && /skin|cleanser|moistur|spf|sunscreen|groom|hair|photo|presentation|jaw|symmetr|face|puffiness|eye|under-eye|cheek|chin|midface|texture/i.test(item.text)).slice(0, 5)
  const [intro, setIntro] = useState(true)
  const [routineFocus, setRoutineFocus] = useState('both')
  const [slide, setSlide] = useState(0)
  const [direction, setDirection] = useState(1)
  const [weekChoice, setWeekChoice] = useState(1)
  const [weekDayChoice, setWeekDayChoice] = useState(0)
  const [todayKey, setTodayKey] = useState(getLocalDateKey)
  const [progress, setProgress] = useState(() => loadProgress('ascendus-routine-progress-pending', getLocalDateKey(), getWeekKey()))
  const [plan, setPlan] = useState(null)
  const [isEditingPlan, setIsEditingPlan] = useState(false)
  const [planProgress, setPlanProgress] = useState(() => getPlanProgress('ascendus-routine-plan-progress-pending', getLocalDateKey()))
  const [preferences, setPreferences] = useState(() => getInitialTrainingPreferences(userProfile))
  const [bodyWeight, setBodyWeight] = useState('')
  const [activityLevel, setActivityLevel] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const autoPlanStarted = useRef(new Set())
  const accountSaveTimer = useRef(null)
  const swipeStart = useRef(null)
  const day = todayKey
  const activeSlideIndices = routineFocus === 'face' ? [0, 3] : routineFocus === 'body' ? [1, 2, 3, 4] : [0, 1, 2, 3, 4]
  const activeSlidePosition = Math.max(0, activeSlideIndices.indexOf(slide))
  const previousSlide = activeSlideIndices[activeSlidePosition - 1]
  const nextSlide = activeSlideIndices[activeSlidePosition + 1]
  const progressKey = `ascendus-glow-routine-${faceScan?.id ?? 'no-face'}-${bodyScan?.id ?? 'no-body'}`
  // Keep any earlier saved plan untouched while the actionable format is regenerated.
  const legacyPlanKey = `${progressKey}-ai-12-week-v2`
  const planKey = `${progressKey}-ai-12-week-v3`
  const planProgressKey = `${planKey}-progress`
  const legacyPlanProgressKey = `${legacyPlanKey}-progress`
  const nutritionPrefsKey = `${progressKey}-nutrition-preferences`
  const trainingPrefsKey = `${progressKey}-training-preferences`

  useEffect(() => {
    const timer = window.setTimeout(() => setTodayKey(getLocalDateKey()), getNextMidnightDelay())
    return () => window.clearTimeout(timer)
  }, [todayKey])
  useEffect(() => setProgress(loadProgress(progressKey, day, getWeekKey(new Date(`${day}T12:00:00`)))), [progressKey, day])
  useEffect(() => {
    try {
      const savedPlan = JSON.parse(localStorage.getItem(planKey) || localStorage.getItem(legacyPlanKey) || 'null')
      setPlan(savedPlan)
      setIsEditingPlan(Boolean(savedPlan && (savedPlan.version < 3 || !savedPlan.trainingEmphasis)))
    } catch { setPlan(null); setIsEditingPlan(false) }
    setPlanProgress(getPlanProgress(planProgressKey, day, legacyPlanProgressKey))
    try { setPreferences({ ...getInitialTrainingPreferences(userProfile), ...(JSON.parse(localStorage.getItem(trainingPrefsKey) || 'null') || {}) }) } catch { setPreferences(getInitialTrainingPreferences(userProfile)) }
    try { const saved = JSON.parse(localStorage.getItem(nutritionPrefsKey) || '{}'); setBodyWeight(saved.weight || ''); setActivityLevel(saved.activity || '') } catch { setBodyWeight(''); setActivityLevel('') }
    setWeekChoice(1)
    setWeekDayChoice(0)
  }, [planKey, legacyPlanKey, planProgressKey, legacyPlanProgressKey, day, userProfile, nutritionPrefsKey, trainingPrefsKey])
  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    api.supabase.getRoutine().then(saved => {
      if (cancelled || saved?.faceScanId !== (faceScan?.id ?? null) || saved?.bodyScanId !== (bodyScan?.id ?? null) || !saved?.routine) return
      if (saved.routine.plan) {
        setPlan(saved.routine.plan)
        setIsEditingPlan(false)
        try { localStorage.setItem(planKey, JSON.stringify(saved.routine.plan)) } catch { /* cloud remains the source */ }
      }
      if (saved.routine.planProgress && typeof saved.routine.planProgress === 'object') {
        setPlanProgress(saved.routine.planProgress)
        try { localStorage.setItem(planProgressKey, JSON.stringify(saved.routine.planProgress)) } catch { /* cloud remains the source */ }
      }
      if (saved.routine.trainingPreferences && typeof saved.routine.trainingPreferences === 'object') {
        setPreferences(current => ({ ...current, ...saved.routine.trainingPreferences }))
      }
      if (saved.routine.nutritionPreferences && typeof saved.routine.nutritionPreferences === 'object') {
        setBodyWeight(saved.routine.nutritionPreferences.weight || '')
        setActivityLevel(saved.routine.nutritionPreferences.activity || '')
      }
      if (saved.routine.dailyProgress && typeof saved.routine.dailyProgress === 'object') {
        const remote = saved.routine.dailyProgress
        const local = loadProgress(progressKey, day, getWeekKey(new Date(`${day}T12:00:00`)))
        const remoteToday = remote.day === day ? remote.daily : remote.history?.[day] ?? {}
        const merged = { ...remote, day, daily: { ...remoteToday, ...local.daily }, history: { ...(remote.history ?? {}), ...local.history }, week: getWeekKey(new Date(`${day}T12:00:00`)) }
        setProgress(merged)
        try { localStorage.setItem(progressKey, JSON.stringify(merged)) } catch { /* cloud remains the source */ }
      }
    }).catch(() => { /* Local storage remains available when the account endpoint is offline. */ })
    return () => { cancelled = true }
  }, [userId, faceScan?.id, bodyScan?.id, planKey, planProgressKey, progressKey, day])
  useEffect(() => () => window.clearTimeout(accountSaveTimer.current), [])
  const faceSummary = getRoutineSummary(faceScan, 'face')
  const bodySummary = getRoutineSummary(bodyScan, 'body')
  const bodyGoalLine = preferences.goal === 'Build muscle' ? 'Build muscle with progressive strength work'
    : preferences.goal === 'Gain strength' ? 'Build strength with progressive training'
      : preferences.goal === 'Improve fitness' ? 'Improve fitness with consistent training'
        : preferences.goal === 'Lose fat' ? 'Build a consistent strength and fitness routine' : ''
  const activeDay = planProgress.activeDay
  const activeWeekNumber = Math.min(12, Math.ceil(activeDay / 7))
  const viewingWeek = plan?.weeks?.[weekChoice - 1]
  const viewedPhase = Math.min(2, Math.floor((weekChoice - 1) / 4))
  const weekday = (activeDay - 1) % 7
  const sessionDays = viewingWeek?.sessions?.length ? getScheduledWeekdays(viewingWeek.sessions.length) : []
  const selectedWeekSessionIndex = sessionDays.indexOf(weekDayChoice)
  const selectedWeekSession = selectedWeekSessionIndex >= 0 ? viewingWeek?.sessions?.[selectedWeekSessionIndex] : null
  const sessionIndex = sessionDays.indexOf(weekday)
  const todaysSession = sessionIndex >= 0 ? viewingWeek.sessions[sessionIndex] : null
  const workoutSteps = todaysSession?.exercises?.map(exercise => {
    const conditioning = /\b(walk|bike|cycling|jog|cardio|conditioning|run|elliptical)\b/i.test(exercise.name) || /\bmin(?:ute)?s?\b/i.test(exercise.reps)
    return {
      conditioning,
      title: conditioning ? `${exercise.name} · ${exercise.reps}` : `${exercise.name} · ${exercise.sets} × ${exercise.reps}`,
      targetMuscles: exercise.targetMuscles ?? [],
      progressionInstructions: exercise.progressionInstructions,
      reps: exercise.reps,
      sets: exercise.sets,
      detail: `${exercise.targetMuscles?.length ? `Targets ${exercise.targetMuscles.join(', ')}. ` : ''}${conditioning ? '' : `Rest ${exercise.restSeconds || 90}s between sets. `}${exercise.why || ''} ${exercise.instructions || ''}${exercise.effortTarget ? ` Effort: ${exercise.effortTarget}` : ''}${exercise.alternatives?.length ? ` Alternative: ${exercise.alternatives.join(' or ')}.` : ''}`,
    }
  }) ?? []
  const faceTasks = [
    { id: 'face-am-cleanse', title: 'Morning · Cleanse or rinse', detail: 'Use lukewarm water and a gentle cleanser. If your skin feels dry or sensitive, a water rinse may be enough.' },
    { id: 'face-am-moisturize', title: 'Morning · Moisturize', detail: 'Apply a simple moisturizer suited to your reported skin type while skin is slightly damp.' },
    { id: 'face-am-spf', title: 'Morning · SPF 30+', detail: 'Use broad-spectrum SPF 30+ on exposed face and neck. Reapply about every two hours outdoors and after swimming or heavy sweating.' },
    { id: 'face-pm-cleanse', title: 'Evening · Cleanse', detail: 'Gently remove sunscreen and the day; pat dry rather than rubbing.' },
    { id: 'face-pm-moisturize', title: 'Evening · Moisturize', detail: 'Finish with a plain moisturizer. Dry or sensitive skin can skip optional actives and focus on the basics.' },
  ]
  const faceDoneCount = faceTasks.filter(item => progress.daily[item.id]).length
  const bodyDoneCount = todaysSession ? workoutSteps.filter((_, index) => planProgress.checked[`${activeDay}-${index}`]).length : (progress.daily.bodyRest ? 1 : 0)
  const planDayDone = planProgress.completedDays.includes(activeDay)
  const checkedBodyCount = workoutSteps.filter((_, index) => planProgress.checked[`${activeDay}-${index}`]).length
  const dailyConfirmed = progress.daily.streakConfirmed === true
  const dailyChecklistComplete = routineFocus === 'face'
    ? faceDoneCount === faceTasks.length
    : routineFocus === 'body'
      ? Boolean(plan && planDayDone)
      : faceDoneCount === faceTasks.length && Boolean(plan && planDayDone)
  const loggedTaskCount = Object.values(progress.history ?? {}).reduce((total, tasks) => total + Object.values(tasks ?? {}).filter(Boolean).length, 0)
  const loggedDays = Object.values(progress.history ?? {}).filter(tasks => Object.values(tasks ?? {}).some(Boolean)).length

  function saveRoutineToAccount(overrides = {}) {
    if (!userId) return
    const routine = {
      plan: plan ?? null,
      planProgress,
      dailyProgress: progress,
      trainingPreferences: preferences,
      nutritionPreferences: { weight: bodyWeight, activity: activityLevel },
      ...overrides,
    }
    window.clearTimeout(accountSaveTimer.current)
    accountSaveTimer.current = window.setTimeout(() => {
      api.supabase.saveRoutine({ faceScanId: faceScan?.id ?? null, bodyScanId: bodyScan?.id ?? null, routine }).catch(() => { /* Local storage remains available if account sync is unavailable. */ })
    }, 350)
  }

  function saveDailyProgress(nextDaily, syncAccount = true) {
    const history = { ...(progress.history ?? {}), [day]: nextDaily }
    const next = { ...progress, day, daily: nextDaily, history, week: getWeekKey(new Date(`${day}T12:00:00`)) }
    setProgress(next)
    try { localStorage.setItem(progressKey, JSON.stringify(next)) } catch { /* keep in-memory progress */ }
    if (syncAccount) saveRoutineToAccount({ dailyProgress: next })
  }
  function toggleDaily(id) {
    triggerHaptic()
    saveDailyProgress({ ...progress.daily, [id]: !progress.daily[id] })
  }
  function confirmDailyChecklist() {
    if (!dailyChecklistComplete || dailyConfirmed) return
    triggerHaptic()
    const today = new Date(`${day}T12:00:00`)
    const todayLabel = today.toDateString()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const completedToday = streak.lastDate === todayLabel
    const consecutive = streak.lastDate === yesterday.toDateString()
    const current = completedToday ? streak.current : consecutive ? streak.current + 1 : 1
    updateStreak({ current, longest: Math.max(streak.longest, current), lastDate: todayLabel })
    saveDailyProgress({ ...progress.daily, streakConfirmed: true })
  }
  function toggleExercise(index) {
    if (planDayDone) return
    triggerHaptic()
    const checked = { ...planProgress.checked, [`${activeDay}-${index}`]: !planProgress.checked[`${activeDay}-${index}`] }
    const next = { ...planProgress, checked, today: day }
    setPlanProgress(next)
    try { localStorage.setItem(planProgressKey, JSON.stringify(next)) } catch { /* keep in-memory progress */ }
    saveRoutineToAccount({ planProgress: next })
  }
  function saveLiftLog(index, field, value) {
    const key = `${activeDay}-${index}`
    const liftLogs = { ...(planProgress.liftLogs ?? {}), [key]: { ...(planProgress.liftLogs?.[key] ?? {}), [field]: value } }
    const next = { ...planProgress, liftLogs, today: day }
    setPlanProgress(next)
    try { localStorage.setItem(planProgressKey, JSON.stringify(next)) } catch { /* keep in-memory progress */ }
    saveRoutineToAccount({ planProgress: next })
  }
  function saveNutrition(weight, activity) {
    try { localStorage.setItem(nutritionPrefsKey, JSON.stringify({ weight, activity })) } catch { /* optional local preference */ }
    saveRoutineToAccount({ nutritionPreferences: { weight, activity } })
  }
  function updateTrainingPreference(key, value) {
    setPreferences(current => {
      const next = { ...current, [key]: value }
      try { localStorage.setItem(trainingPrefsKey, JSON.stringify(next)) } catch { /* optional local preference */ }
      return next
    })
  }
  function completeRestDay() {
    if (planDayDone) return
    triggerHaptic()
    const daily = { ...progress.daily, bodyRest: true }
    saveDailyProgress(daily, false)
    const next = { ...planProgress, completedDays: [...new Set([...planProgress.completedDays, activeDay])], lastCompletedDate: day, today: day }
    setPlanProgress(next)
    try { localStorage.setItem(planProgressKey, JSON.stringify(next)) } catch { /* keep in-memory progress */ }
    saveRoutineToAccount({ planProgress: next, dailyProgress: { ...progress, day, daily, history: { ...(progress.history ?? {}), [day]: daily } } })
  }
  function completeWorkoutDay() {
    if (!todaysSession || planDayDone || checkedBodyCount !== workoutSteps.length) return
    triggerHaptic()
    const next = { ...planProgress, completedDays: [...new Set([...planProgress.completedDays, activeDay])], lastCompletedDate: day, today: day }
    setPlanProgress(next)
    try { localStorage.setItem(planProgressKey, JSON.stringify(next)) } catch { /* keep in-memory progress */ }
    saveRoutineToAccount({ planProgress: next })
  }

  async function generatePlan() {
    if (!bodyScan || planLoading) return
    const scores = getTrainingScores(bodyScan)
    if (!preferences.goal || !preferences.level || !preferences.daysPerWeek || !preferences.equipment) {
      setPlanError('Choose your goal, experience, weekly training days, and available equipment first.')
      return
    }
    triggerHaptic()
    setPlanLoading(true)
    setPlanError('')
    try {
      const daysPerWeek = Number(preferences.daysPerWeek)
      const weeklyPlan = await api.ai.workoutPlan({
        scanId: bodyScan.id,
        trainingLevel: preferences.level.toLowerCase(),
        trainingGoal: preferences.goal.toLowerCase(),
        daysPerWeek,
        equipment: preferences.equipment.toLowerCase(),
        priorityFocus: preferences.priorityFocus || 'Auto from scan',
      })
      if (!Array.isArray(weeklyPlan?.days) || weeklyPlan.days.length !== daysPerWeek || weeklyPlan.days.some(session => !Array.isArray(session.exercises) || session.exercises.length < 3)) throw new Error('The workout generator returned an incomplete schedule. Try again in a moment.')
      const savedPlan = asWeekPlan(weeklyPlan, { ...preferences, daysPerWeek }, day, scores)
      let hasSavedTrainingContext = false
      try { hasSavedTrainingContext = Boolean(localStorage.getItem(trainingPrefsKey)) } catch { /* optional preference lookup */ }
      const hasProfileTrainingContext = Boolean(userProfile?.goal || userProfile?.trainingLevel || userProfile?.experience || userProfile?.equipment || userProfile?.trainingDaysPerWeek)
      savedPlan.beginnerBaseline = !hasSavedTrainingContext && !hasProfileTrainingContext
      setPlan(savedPlan)
      const reset = plan
        ? { ...planProgress, today: day, checked: {} }
        : { completedDays: [], lastCompletedDate: null, activeDay: 1, today: day, checked: {}, liftLogs: {} }
      setPlanProgress(reset)
      localStorage.setItem(planKey, JSON.stringify(savedPlan))
      localStorage.setItem(planProgressKey, JSON.stringify(reset))
      saveRoutineToAccount({ plan: savedPlan, planProgress: reset, trainingPreferences: preferences })
      setWeekChoice(1)
      setIsEditingPlan(false)
    } catch (error) {
      setPlanError(error?.message || 'Could not create the plan right now. Try again.')
    } finally {
      setPlanLoading(false)
    }
  }

  function moveTo(next) {
    const target = activeSlideIndices.includes(next)
      ? next
      : activeSlideIndices.reduce((closest, candidate) => Math.abs(candidate - next) < Math.abs(closest - next) ? candidate : closest, activeSlideIndices[0])
    if (target === slide) return
    triggerHaptic()
    setDirection(target > slide ? 1 : -1)
    setSlide(target)
  }
  async function openIntroSlide(target, focusMode) {
    triggerHaptic()
    const missingScanPath = focusMode === 'face' && !faceScan ? '/scan/capture'
      : focusMode === 'body' && !bodyScan ? '/physique-scan'
        : focusMode === 'both' && !faceScan ? '/scan/capture'
          : focusMode === 'both' && !bodyScan ? '/physique-scan' : null
    if (missingScanPath) {
      navigate(missingScanPath)
      return
    }
    setRoutineFocus(focusMode)
    setDirection(target >= slide ? 1 : -1)
    setSlide(target)
    setIntro(false)
    if (focusMode !== 'face' && bodyScan && (!plan || isEditingPlan)) {
      const requestKey = `${bodyScan.id}:${planKey}`
      if (!autoPlanStarted.current.has(requestKey)) {
        autoPlanStarted.current.add(requestKey)
        await generatePlan()
      }
    }
  }
  function openCoach(prompt) {
    triggerHaptic()
    navigate('/coach', { state: { coachPrompt: prompt } })
  }
  const changeSummary = allScans.length > 1
    ? 'More than one scan is saved. Re-scan in consistent lighting and compare only metrics present in both results.'
    : 'Save a future scan in similar lighting and framing to review changes in the metrics it actually returns.'

  const goldButton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 font-heading text-sm font-bold text-black transition-transform active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60'
  const surface = 'rounded-3xl border border-white/[.08] bg-[#141414] p-4'
  const faceRoutineItems = faceRecommendations.slice(0, 4).map(item => {
    const title = item.title || adviceTitle(item.text)
    const detail = item.recommendation || item.text.slice(title.length).replace(/^[\s—–:.-]+/, '').trim()
    return { id: `face-routine-${item.id}`, title, detail }
  })
  if (!faceRoutineItems.length && focus?.faceFocus?.key === 'skin') {
    faceRoutineItems.push(
      { id: 'face-routine-cleanse', title: 'Gentle cleanse · morning and night', detail: 'Use a mild cleanser and lukewarm water. Skip scrubbing; stop if a product causes irritation.' },
      { id: 'face-routine-spf', title: 'Broad-spectrum SPF 30+ · morning', detail: 'Apply to exposed face and neck; follow the label for reapplication.' },
    )
  } else if (!faceRoutineItems.length && focus?.faceFocus) {
    faceRoutineItems.push({ id: 'face-routine-photo', title: 'Use even, front-facing light for photos', detail: 'Keep the camera at eye level and your expression relaxed when comparing scans. Photo-based ratings cannot determine facial structure or diagnose a concern.' })
  }
  const renderFace = () => <div className="space-y-4">
    <section className={`${surface} space-y-2`}><div className="mb-2"><p className="font-body text-[10px] font-bold tracking-[.15em]" style={{ color: GOLD }}>YOUR FOCUS</p><h3 className="mt-1 font-heading text-base font-semibold text-primary">{focus?.faceFocus?.label || 'Face routine'}</h3></div>{faceRoutineItems.length ? faceRoutineItems.map(task => <ToggleTask key={task.id} checked={Boolean(progress.daily[task.id])} title={task.title} detail={task.detail} onClick={() => toggleDaily(task.id)} />) : <p className="font-body text-sm leading-relaxed text-white/60">This scan did not return a specific face priority. Your skin basics are in today’s check-in.</p>}</section>
  </div>
  const renderBody = () => <div className="space-y-4">
    {isEditingPlan ? <section className={`${surface} space-y-4`}><div><p className="font-heading text-base font-semibold text-primary">Adjust your training plan</p></div><PreferenceChoice label="Goal" value={preferences.goal} options={TRAINING_GOALS} onChange={value => updateTrainingPreference('goal', value)} /><PreferenceChoice label="Experience" value={preferences.level} options={TRAINING_LEVELS} onChange={value => updateTrainingPreference('level', value)} /><PreferenceChoice label="Equipment" value={preferences.equipment} options={EQUIPMENT_OPTIONS} onChange={value => updateTrainingPreference('equipment', value)} /><PreferenceChoice label="Days per week" value={String(preferences.daysPerWeek)} options={['2', '3', '4', '5', '6']} onChange={value => updateTrainingPreference('daysPerWeek', Number(value))} /><PreferenceChoice label="Focus area" value={preferences.priorityFocus || 'Auto from scan'} options={TRAINING_FOCUS_OPTIONS} onChange={value => updateTrainingPreference('priorityFocus', value)} /><button type="button" onClick={() => { setIsEditingPlan(false); setPlanError('') }} className="w-full rounded-2xl border border-white/10 py-3 font-heading text-sm font-semibold text-white/70">Keep current plan</button><button type="button" disabled={planLoading} onClick={generatePlan} className={`${goldButton} w-full`} style={{ background: GOLD }}>{planLoading ? <><LoaderCircle size={16} className="animate-spin" /> Building your plan</> : <>Update plan <ArrowRight size={16} /></>}</button>{planError && <p role="alert" className="font-body text-xs leading-relaxed text-red-300">{planError}</p>}</section> : !plan ? <section className={`${surface} space-y-3`}><p className="font-heading text-base font-semibold text-primary">{planLoading ? 'Building your plan…' : 'Your workout plan is not ready yet'}</p>{planLoading && <LoaderCircle size={20} className="animate-spin" style={{ color: GOLD }} />}{planError && <p role="alert" className="font-body text-xs leading-relaxed text-red-300">{planError}</p>}<p className="font-body text-xs leading-relaxed text-white/50">Using your saved scan and training details when available. Missing training preferences use a beginner bodyweight starting point.</p>{!planLoading && <button type="button" onClick={generatePlan} className={`${goldButton} w-full`} style={{ background: GOLD }}>Build my workout <ArrowRight size={16} /></button>}</section> : <section className={surface}><div className="flex items-start justify-between gap-3"><div><p className="font-body text-[10px] font-bold tracking-[.16em]" style={{ color: GOLD }}>12-WEEK PLAN</p><h3 className="mt-1 font-heading text-base font-semibold text-primary">{plan.split}</h3><p className="mt-1 font-body text-xs text-white/55">{plan.preferences?.goal} · {plan.preferences?.level} · {plan.preferences?.daysPerWeek} days/week</p></div><Dumbbell size={20} style={{ color: GOLD }} /></div>{plan.beginnerBaseline && <p className="mt-2 font-body text-[11px] text-white/50">Beginner-friendly bodyweight baseline · adjust anytime</p>}<div className="mt-3 rounded-2xl border border-[#c6a85c]/20 bg-[#c6a85c]/[.06] p-3"><p className="font-heading text-xs font-semibold text-primary">Focus · {plan.trainingEmphasis}</p><details className="mt-2"><summary className="cursor-pointer font-heading text-[11px] font-semibold" style={{ color: GOLD }}>Why this focus</summary><p className="mt-1 font-body text-[11px] leading-relaxed text-white/60">{plan.emphasisReason}</p></details>{plan.priorities?.length > 0 && <div className="mt-3 space-y-2">{plan.priorities.map(priority => <div key={`${priority.role}-${priority.area}`} className="border-t border-white/[.08] pt-2"><p className="font-heading text-xs font-semibold text-primary">{priority.role} · {priority.area}</p><details className="mt-1"><summary className="cursor-pointer font-heading text-[11px] font-semibold" style={{ color: GOLD }}>Why this area</summary><p className="mt-1 font-body text-[11px] leading-relaxed text-white/55">{priority.reason}</p></details></div>)}</div>}{plan.maintenanceAreas?.length > 0 && <p className="mt-2 font-body text-[10px] leading-relaxed text-white/45">Maintain: {plan.maintenanceAreas.join(' · ')}</p>}</div>{plan.fallbackUsed && <p role="status" className="mt-3 rounded-xl border border-white/10 bg-white/[.035] p-3 font-body text-[11px] leading-relaxed text-white/60">{plan.fallbackNotice}</p>}<details className="mt-3"><summary className="cursor-pointer font-heading text-xs font-semibold text-white/70">Training guidance</summary><p className="mt-2 font-body text-xs leading-relaxed text-white/65">Leave 2–3 reps in reserve. Log reps and load; progress only with controlled form.</p></details><button type="button" onClick={() => setIsEditingPlan(true)} className="mt-3 inline-flex items-center gap-1 font-heading text-xs font-bold" style={{ color: GOLD }}>Adjust plan <ArrowRight size={14} /></button><button type="button" onClick={() => moveTo(2)} className="ml-4 mt-3 inline-flex items-center gap-1 font-heading text-xs font-bold" style={{ color: GOLD }}>View schedule <ArrowRight size={14} /></button></section>}
    <section className={`${surface} space-y-3`}><div className="flex items-center gap-2"><Droplets size={16} style={{ color: GOLD }} /><h3 className="font-heading text-sm font-semibold text-primary">Food and recovery</h3></div><details><summary className="cursor-pointer font-heading text-xs font-semibold text-primary">Simple nutrition basics</summary><p className="mt-2 font-body text-xs leading-relaxed text-white/60">Include protein, produce, fibre-rich carbohydrates, and consistent sleep. Avoid crash diets; no scan can set a calorie target.</p></details><div className="grid grid-cols-2 gap-3"><label className="font-body text-xs text-white/60">Weight (kg, optional)<input type="number" min="30" max="250" step="0.1" value={bodyWeight} onChange={event => { setBodyWeight(event.target.value); saveNutrition(event.target.value, activityLevel) }} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-primary" placeholder="e.g. 72" /></label><div><PreferenceChoice label="Activity (optional)" value={activityLevel} options={ACTIVITY_LEVELS} onChange={value => { setActivityLevel(value); saveNutrition(bodyWeight, value) }} /></div></div>{['Build muscle', 'Gain strength'].includes(plan?.preferences?.goal || preferences.goal) && Number(bodyWeight) >= 30 && Number(bodyWeight) <= 250 && activityLevel && <details className="rounded-xl bg-white/[.035] p-3 font-body text-xs text-white/70"><summary className="cursor-pointer font-semibold">Protein guideline</summary><p className="mt-2">About {(Number(bodyWeight) * 1.4).toFixed(0)}–{(Number(bodyWeight) * 2).toFixed(0)} g/day is a broad range for exercising adults, not a personal medical target. <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/28642676/" target="_blank" rel="noopener noreferrer">Source</a>.</p></details>}</section>
  </div>
  const renderBlueprint = () => <div className="space-y-4">
    {!plan ? <section className={surface}><p className="font-heading text-base font-semibold text-primary">Start by setting up Your Body Routine</p><p className="mt-2 font-body text-sm text-white/55">Choose your training goal and available equipment first. The full 12-week calendar appears here once your plan is built.</p><button type="button" onClick={() => moveTo(1)} className="mt-3 inline-flex items-center gap-1 font-heading text-xs font-bold" style={{ color: GOLD }}>Set up training <ArrowRight size={14} /></button></section> : <>
      <div className="flex items-center justify-between rounded-2xl border border-white/[.08] bg-white/[.025] p-3"><span className="font-heading text-sm font-semibold text-primary">{plan.split}</span><span className="font-body text-xs" style={{ color: GOLD }}>{planProgress.completedDays.length}/84 days</span></div>
      <section className={surface}><div className="mb-2 flex items-center justify-between"><div><p className="font-body text-[10px] font-bold tracking-wider" style={{ color: GOLD }}>CHOOSE A WEEK</p><p className="mt-1 font-heading text-sm font-semibold text-primary">Week {weekChoice} · {viewingWeek?.phase}</p></div><span className="font-body text-[10px] text-white/45">Every week is open</span></div><div className="grid grid-cols-6 gap-2">{Array.from({ length: 12 }, (_, i) => i + 1).map(number => <button key={number} type="button" onClick={() => { setWeekChoice(number); setWeekDayChoice(0) }} aria-pressed={weekChoice === number} className="h-10 rounded-xl border font-heading text-xs font-semibold" style={{ borderColor: weekChoice === number ? GOLD : 'rgba(255,255,255,.12)', background: weekChoice === number ? GOLD : 'rgba(255,255,255,.025)', color: weekChoice === number ? '#090909' : 'rgba(255,255,255,.72)' }}>{number}</button>)}</div></section>
      {viewingWeek && <section className={surface}><div className="mb-3"><p className="font-body text-[10px] font-bold tracking-wider" style={{ color: GOLD }}>WEEK {weekChoice}{viewingWeek.deload ? ' · LIGHTER RECOVERY' : ''}</p><p className="mt-1 font-body text-xs leading-relaxed text-white/65">{viewingWeek.objective || PHASES[viewedPhase].note}</p></div><div className="grid grid-cols-4 gap-1.5">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name, index) => { const scheduled = sessionDays.indexOf(index); const isSelected = weekDayChoice === index; return <button key={name} type="button" aria-pressed={isSelected} onClick={() => setWeekDayChoice(index)} className="rounded-xl border px-1 py-2 text-center" style={{ borderColor: isSelected ? GOLD : 'rgba(255,255,255,.08)', background: isSelected ? 'rgba(198,168,92,.1)' : 'rgba(255,255,255,.025)' }}><span className="block font-body text-[9px] text-white/45">{name}</span><span className="mt-0.5 block font-heading text-[10px] font-semibold" style={{ color: scheduled >= 0 ? GOLD : 'rgba(255,255,255,.48)' }}>{scheduled >= 0 ? `Train ${scheduled + 1}` : 'Rest'}</span></button> })}</div>{selectedWeekSession ? <div className="mt-3 rounded-2xl bg-white/[.035] p-3"><p className="font-heading text-sm font-semibold text-primary">{selectedWeekSession.name}</p><p className="mt-1 font-body text-xs text-white/50">{selectedWeekSession.focus}</p>{selectedWeekSession.targetMuscles?.length > 0 && <p className="mt-1 font-body text-[10px] text-white/45">Targets: {selectedWeekSession.targetMuscles.join(' · ')}</p>}<div className="mt-3 space-y-3">{selectedWeekSession.exercises.map((exercise, index) => { const conditioning = /\b(walk|bike|cycling|jog|cardio|conditioning|run|elliptical)\b/i.test(exercise.name) || /\bmin(?:ute)?s?\b/i.test(exercise.reps); return <details key={`${exercise.name}-${index}`} className="border-t border-white/[.07] pt-2"><summary className="cursor-pointer font-heading text-xs font-semibold text-primary">{conditioning ? `${exercise.name} · ${exercise.reps}` : `${exercise.name} · ${exercise.sets} × ${exercise.reps}`}</summary><p className="mt-1 font-body text-[10px] text-white/45">{exercise.targetMuscles?.join(' · ') || 'Full-body movement'}{exercise.effortTarget ? ` · ${exercise.effortTarget}` : ''}</p><p className="mt-1 font-body text-[11px] leading-relaxed text-white/55">{conditioning ? exercise.instructions || exercise.why : `Rest ${exercise.restSeconds || 90}s. ${exercise.instructions || exercise.why}`}</p><p className="mt-1 font-body text-[10px] leading-relaxed text-white/45">Progression: {exercise.progressionInstructions || 'Reach the top of the rep range with good form, then progress gradually.'}</p>{exercise.alternatives?.length > 0 && <p className="mt-1 font-body text-[10px] leading-relaxed text-white/45">Alternative: {exercise.alternatives.join(' or ')}</p>}</details> })}</div></div> : <div className="mt-3 rounded-xl bg-white/[.035] p-3"><p className="font-heading text-sm font-semibold text-primary">Recovery day</p><p className="mt-1 font-body text-xs leading-relaxed text-white/55">Take a rest day or do comfortable easy movement; no make-up session is required.</p></div>}</section>}
    </>}
  </div>
  const renderDaily = () => <div className="space-y-4">
    {routineFocus !== 'body' && <section className={surface}><div className="mb-3 flex items-center justify-between"><div><p className="font-body text-[10px] font-bold tracking-[.17em]" style={{ color: GOLD }}>MORNING + EVENING</p><p className="mt-1 font-heading text-sm font-semibold text-primary">Face care · {faceDoneCount}/{faceTasks.length} checked</p></div><Sun size={18} style={{ color: GOLD }} /></div><div className="space-y-2">{faceTasks.map(task => <ToggleTask key={task.id} checked={Boolean(progress.daily[task.id])} title={task.title} detail={task.detail} onClick={() => toggleDaily(task.id)} />)}</div></section>}
    {routineFocus !== 'face' && <section className={surface}><div className="mb-3 flex items-center justify-between"><div><p className="font-body text-[10px] font-bold tracking-[.17em]" style={{ color: GOLD }}>TODAY · WEEK {activeWeekNumber}</p><p className="mt-1 font-heading text-sm font-semibold text-primary">{todaysSession?.name ?? (plan ? 'Recovery day' : 'Workout not set up')}</p></div><span className="font-body text-xs text-white/50">{plan ? `${bodyDoneCount}/${todaysSession ? workoutSteps.length : 1}` : '—'}</span></div>
      {!plan ? planLoading ? <div role="status" className="flex items-center gap-2 font-body text-sm text-white/60"><LoaderCircle size={16} className="animate-spin" style={{ color: GOLD }} /> Building your workout from the saved scan…</div> : <div className="space-y-2">{planError && <p role="alert" className="font-body text-xs text-red-300">{planError}</p>}<button type="button" onClick={generatePlan} className="inline-flex items-center gap-2 font-heading text-xs font-bold" style={{ color: GOLD }}>Build workout <ArrowRight size={14} /></button></div> : todaysSession ? <><p className="mb-3 font-body text-xs text-white/50">{todaysSession.focus} · record your reps, duration, and load as you go.</p><div className="space-y-3">{workoutSteps.map((step, index) => { const log = planProgress.liftLogs?.[`${activeDay}-${index}`] ?? {}; const completed = Boolean(planProgress.checked[`${activeDay}-${index}`]); const progression = getLoggedProgression(step, log.reps, completed); return <div key={`${activeDay}-${index}`} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-3"><ToggleTask checked={completed} title={step.title} detail={step.detail} onClick={() => toggleExercise(index)} /><div className="mt-2 grid grid-cols-2 gap-2"><label className="font-body text-[10px] text-white/45">{step.conditioning ? 'Duration completed' : 'Reps completed'}<input aria-label={`${step.title} ${step.conditioning ? 'duration' : 'reps'} completed`} value={log.reps ?? ''} onChange={event => saveLiftLog(index, 'reps', event.target.value)} placeholder={step.conditioning ? 'e.g. 25 minutes' : 'e.g. 10, 10, 8'} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-primary" /></label><label className="font-body text-[10px] text-white/45">{step.conditioning ? 'Effort / notes' : 'Load used'}<input aria-label={`${step.title} ${step.conditioning ? 'effort or notes' : 'load used'}`} value={log.load ?? ''} onChange={event => saveLiftLog(index, 'load', event.target.value)} placeholder={step.conditioning ? 'e.g. easy, conversational' : 'e.g. 12 kg or bodyweight'} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-primary" /></label></div>{progression && <p role="status" className="mt-2 font-body text-[10px] leading-relaxed text-white/55">{progression}</p>}</div> })}</div><button type="button" onClick={completeWorkoutDay} disabled={planDayDone || checkedBodyCount !== workoutSteps.length} className={`${goldButton} mt-3 w-full`} style={{ background: checkedBodyCount === workoutSteps.length && !planDayDone ? GOLD : '#292929', color: checkedBodyCount === workoutSteps.length && !planDayDone ? '#090909' : 'rgba(255,255,255,.45)' }}>{planDayDone ? 'Workout completed today' : 'Complete workout'} <Check size={16} /></button></> : <><p className="font-body text-sm leading-relaxed text-white/55">Keep movement comfortable today and let hard-working muscles recover.</p><button type="button" onClick={completeRestDay} disabled={planDayDone} className={`${goldButton} mt-3 w-full`} style={{ background: planDayDone ? '#292929' : GOLD, color: planDayDone ? 'rgba(255,255,255,.45)' : '#090909' }}>{planDayDone ? 'Recovery day completed' : 'Complete recovery day'} <Check size={16} /></button></>}
    </section>}{routineFocus !== 'face' && <p className="px-1 font-body text-[10px] leading-relaxed text-white/40">Your workout log is saved on this device. You can leave a load blank for bodyweight movements.</p>}
    <section className={`${surface} flex flex-col items-center gap-3 text-center`} aria-live="polite">
      {dailyConfirmed ? <>
        <Flame size={28} aria-hidden="true" style={{ color: GOLD, fill: GOLD, filter: 'drop-shadow(0 0 8px rgba(198,168,92,.35))' }} />
        <p className="font-heading text-base font-semibold text-primary">Come back to keep your streak</p>
      </> : <>
        <p className="font-body text-sm text-white/55">{dailyChecklistComplete ? 'All done for today?' : 'Finish today’s checklist to unlock your streak.'}</p>
        <button type="button" onClick={confirmDailyChecklist} disabled={!dailyChecklistComplete} className={`${goldButton} w-full`} style={{ background: dailyChecklistComplete ? GOLD : '#292929', color: dailyChecklistComplete ? '#090909' : 'rgba(255,255,255,.45)' }}>
          Confirm <Check size={16} />
        </button>
      </>}
    </section>
  </div>
  const renderProgress = () => <div className="space-y-4">
    <section className={surface}><div className="flex items-center gap-3"><span className="rounded-2xl p-3" style={{ background: 'rgba(198,168,92,.12)', color: GOLD }}><Activity size={20} /></span><div><p className="font-heading text-base font-semibold text-primary">{plan ? `${planProgress.completedDays.length} of 84 days` : 'Your routine history'}</p><p className="font-body text-xs text-white/50">{plan ? `Week ${activeWeekNumber} of 12 · ${plan.split}` : 'Daily check-ins are saved on this device'}</p></div></div>{plan && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${planProgress.completedDays.length / 84 * 100}%`, background: GOLD }} /></div>}</section>
    <section className={surface}><p className="font-body text-[10px] font-bold tracking-[.17em]" style={{ color: GOLD }}>CURRENT PRIORITIES</p><div className="mt-3 space-y-2">{(routineFocus === 'face' ? [focus?.faceFocus] : routineFocus === 'body' ? [focus?.bodyFocus] : [focus?.faceFocus, focus?.bodyFocus]).filter(Boolean).map(item => <div key={item.key} className="flex items-center justify-between gap-3"><span className="font-heading text-sm text-primary">{item.label}</span><span className="font-body text-xs text-white/50">{scoreText(item)}</span></div>)}{(routineFocus === 'face' ? !focus?.faceFocus : routineFocus === 'body' ? !focus?.bodyFocus : !focus?.faceFocus && !focus?.bodyFocus) && <p className="font-body text-sm text-white/55">No feature ratings are available to compare.</p>}</div></section>
    <section className={surface}><h3 className="font-heading text-sm font-semibold text-primary">Scan context</h3><p className="mt-1 font-body text-xs text-white/50">Photo estimates · not diagnoses or measurements</p>{routineFocus !== 'body' && faceSummary && <details className="mt-3 border-t border-white/[.08] pt-3"><summary className="cursor-pointer font-heading text-xs font-semibold text-white/70">Face scan</summary><p className="mt-2 font-body text-xs leading-relaxed text-white/55">{faceSummary}</p></details>}{routineFocus !== 'face' && bodySummary && <details className="mt-2"><summary className="cursor-pointer font-heading text-xs font-semibold text-white/70">Physique scan</summary><p className="mt-2 font-body text-xs leading-relaxed text-white/55">{bodySummary}</p></details>}</section>
    {routineFocus !== 'body' && faceRecommendations.length > 0 && <section className={surface}><p className="font-body text-[10px] font-bold tracking-[.17em]" style={{ color: GOLD }}>SAVED PERSONAL RECOMMENDATIONS</p><div className="mt-3 space-y-2">{faceRecommendations.slice(0, 4).map(item => <details key={item.id} className="rounded-xl bg-white/[.035] p-3"><summary className="cursor-pointer font-heading text-xs font-semibold text-primary">{adviceTitle(item.text)}</summary><p className="mt-2 font-body text-xs leading-relaxed text-white/60">{item.text}</p></details>)}</div></section>}
    <section className={surface}><p className="font-body text-[10px] font-bold tracking-[.17em]" style={{ color: GOLD }}>ROUTINE ACTIVITY</p><div className="mt-3 flex items-center justify-between gap-3"><div><p className="font-heading text-sm font-semibold text-primary">{loggedTaskCount} tasks checked</p><p className="mt-1 font-body text-xs text-white/50">Across {loggedDays} logged days on this device</p></div><span className="rounded-xl p-2.5" style={{ color: GOLD, background: 'rgba(198,168,92,.1)' }}><Check size={17} /></span></div></section>
    <section className={surface}><p className="font-body text-[10px] font-bold tracking-[.17em]" style={{ color: GOLD }}>REVIEW YOUR SCANS</p><p className="mt-2 font-body text-sm leading-relaxed text-white/60">{changeSummary}</p><p className="mt-2 font-body text-xs leading-relaxed text-white/45">A photo score can move with lighting, pose, and framing. Compare scans cautiously and adjust your routine based on repeatable results and how you feel.</p></section>
    <button type="button" onClick={() => openCoach(`Use my saved scan findings and routine to help me review progress. Face priority: ${focus?.faceFocus ? `${focus.faceFocus.label} ${focus.faceFocus.score}/10` : 'no feature rating available'}. Physique priority: ${focus?.bodyFocus ? `${focus.bodyFocus.label} ${focus.bodyFocus.score}/10` : 'no feature rating available'}. Training plan: ${plan ? `${plan.split}, ${plan.preferences?.goal || 'goal not recorded'}, ${plan.preferences?.daysPerWeek || 'unknown'} days/week` : 'not generated yet'}. Explain what to monitor and suggest a practical adjustment without diagnosing or promising results.`)} className={`${goldButton} w-full`} style={{ background: GOLD }}>Get Deeper Insight With AI Coach <ArrowRight size={16} /></button>
  </div>

  const renderSlide = () => {
    switch (slide) {
      case 0: return renderFace()
      case 1: return renderBody()
      case 2: return renderBlueprint()
      case 3: return renderDaily()
      default: return renderProgress()
    }
  }

  return <MotionPage>
    <PageHeader title={intro ? 'Your Routine' : SLIDES[slide].title} subtitle={intro ? 'Choose your routine' : `${routineFocus === 'face' && slide === 3 ? '02 · SKIN CHECK-IN' : SLIDES[slide].eyebrow} · ${activeSlidePosition + 1} OF ${activeSlideIndices.length}`} back onBack={() => intro ? navigate('/extras') : (activeSlidePosition === 0 ? setIntro(true) : moveTo(previousSlide))} />
    <main className="px-4 pb-28 pt-1">
      {intro ? <section className="mx-auto w-full max-w-lg pb-8 pt-1">
        <div>
          <div className="mt-2 space-y-4">
            <button type="button" onClick={() => openIntroSlide(0, 'face')} aria-label={faceScan ? 'Open face routine' : 'Complete face scan'} className="flex min-h-[88px] w-full items-center gap-5 rounded-2xl border border-white/[.09] bg-white/[.025] px-5 text-left transition-colors hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6a85c]">
              <span className="min-w-0 flex-1"><span className="block font-heading text-xl font-semibold text-primary">Face</span><span className="mt-1 block font-body text-base text-white/60">{faceScan ? 'Optimize face improvement' : 'Complete face scan'}</span></span>
              <ArrowRight size={22} className="shrink-0 text-white/40" />
            </button>
            <button type="button" onClick={() => openIntroSlide(3, 'body')} aria-label={bodyScan ? 'Open physique routine' : 'Complete body scan'} className="flex min-h-[88px] w-full items-center gap-5 rounded-2xl border border-white/[.09] bg-white/[.025] px-5 text-left transition-colors hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6a85c]">
              <span className="min-w-0 flex-1"><span className="block font-heading text-xl font-semibold text-primary">Physique</span><span className="mt-1 block font-body text-base text-white/60">{bodyScan ? 'Optimize physique improvement' : 'Complete body scan'}</span></span>
              <ArrowRight size={22} className="shrink-0 text-white/40" />
            </button>
            <button type="button" onClick={() => openIntroSlide(0, 'both')} aria-label={bothScansReady ? 'Open face and physique routines' : 'Complete missing scan'} className="flex min-h-[88px] w-full items-center gap-5 rounded-2xl border border-white/[.09] bg-white/[.025] px-5 text-left transition-colors hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6a85c]">
              <span className="min-w-0 flex-1"><span className="block font-heading text-xl font-semibold text-primary">Both</span><span className="mt-1 block font-body text-base text-white/60">{bothScansReady ? 'Optimize face and physique' : `Complete ${!faceScan ? 'face' : 'body'} scan`}</span></span>
              <ArrowRight size={22} className="shrink-0 text-white/40" />
            </button>
          </div>
        </div>
      </section> : <div className="mx-auto max-w-xl">
        <div className="mb-4 flex gap-1.5" aria-label={`Slide ${activeSlidePosition + 1} of ${activeSlideIndices.length}`}>{activeSlideIndices.map((index, position) => { const item = SLIDES[index]; return <button key={item.eyebrow} type="button" aria-label={`Go to ${item.title}`} aria-current={index === slide ? 'step' : undefined} onClick={() => moveTo(index)} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: index === slide ? GOLD : position < activeSlidePosition ? 'rgba(198,168,92,.42)' : 'rgba(255,255,255,.12)' }} /> })}</div>
        <AnimatePresence mode="wait" custom={direction}><motion.section key={slide} custom={direction} initial={{ opacity: 0, x: direction * 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -24 }} transition={{ duration: .22 }} onTouchStart={event => { swipeStart.current = event.touches[0]?.clientX }} onTouchEnd={event => { const delta = (swipeStart.current ?? 0) - (event.changedTouches[0]?.clientX ?? 0); if (Math.abs(delta) > 60) moveTo(slide + (delta > 0 ? 1 : -1)); swipeStart.current = null }}>
          <div className="mb-4 flex items-center gap-3"><span className="rounded-xl p-2.5" style={{ color: GOLD, background: 'rgba(198,168,92,.11)' }}>{(() => { const Icon = SLIDES[slide].icon; return <Icon size={18} /> })()}</span><div><p className="font-body text-[9px] font-bold tracking-[.16em]" style={{ color: GOLD }}>{SLIDES[slide].eyebrow}</p><h2 className="font-heading text-xl font-bold text-primary">{SLIDES[slide].title}</h2></div></div>
          {renderSlide()}
        </motion.section></AnimatePresence>
        <div className="mt-5 flex gap-3"><button type="button" onClick={() => activeSlidePosition === 0 ? setIntro(true) : moveTo(previousSlide)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[.12] font-heading text-sm font-semibold text-white/75"><ChevronLeft size={16} /> Back</button><button type="button" onClick={() => moveTo(nextSlide)} disabled={nextSlide == null} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-heading text-sm font-bold text-black disabled:opacity-45" style={{ background: GOLD }}>Next <ChevronRight size={16} /></button></div>
      </div>}
    </main>
  </MotionPage>
}
