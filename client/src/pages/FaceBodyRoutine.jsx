import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Check, Sun, Moon, Droplets, Dumbbell, Footprints, BedDouble, Sparkles, ArrowRight, LockKeyhole, Plus, Trash2, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import useStore from '../store/useStore'
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
const ROUTINE_WEEK_NAMES = ['Foundation', 'Consistency', 'Momentum', 'Strength', 'Control', 'Endurance', 'Progress', 'Discipline', 'Intensity', 'Refinement', 'Peak Form', 'Transformation']
const PLAN_TOTAL_WEEKS = 12
const PLAN_TOTAL_DAYS = PLAN_TOTAL_WEEKS * 7
const HOME_WEEKLY_PROGRESSIONS = [
  { week: 2, session: 'Push', name: 'Scapular push-ups', sets: 2, reps: '8–10' },
  { week: 3, session: 'Legs & Core', name: 'Glute bridge march', sets: 2, reps: '8 each side' },
  { week: 4, session: 'Upper Body', name: 'Prone W raises', sets: 2, reps: '8–10' },
  { week: 5, session: 'Push', name: 'Slow push-up negatives', sets: 2, reps: '5' },
  { week: 6, session: 'Legs & Core', name: 'Supported split squats', sets: 2, reps: '6 each side' },
  { week: 7, session: 'Mobility', name: 'Side plank from knees', sets: 2, reps: '15 seconds each side' },
  { week: 8, session: 'Upper Body', name: 'Reverse snow angels', sets: 2, reps: '8–10' },
  { week: 9, session: 'Push', name: 'Close-grip incline push-ups', sets: 2, reps: '6–8' },
  { week: 10, session: 'Legs & Core', name: 'Single-leg glute bridges', sets: 2, reps: '6 each side' },
  { week: 11, session: 'Upper Body', name: 'Wall slides with a pause', sets: 2, reps: '10' },
  { week: 12, session: 'Reset', name: 'Bear hold', sets: 2, reps: '15 seconds' },
  // Add one movement to each non-rest session every other week so the plan
  // builds volume gradually while preserving the original foundation work.
  { week: 2, session: 'Legs & Core', name: 'Standing calf raises', sets: 2, reps: '12–15' },
  { week: 2, session: 'Mobility', name: 'Ankle rocks', sets: 2, reps: '10 each side' },
  { week: 2, session: 'Upper Body', name: 'Scapular wall slides', sets: 2, reps: '10–12' },
  { week: 2, session: 'Reset', name: 'Dead bugs', sets: 2, reps: '8 each side' },
  { week: 4, session: 'Push', name: 'Wide-grip incline push-ups', sets: 2, reps: '6–8' },
  { week: 4, session: 'Legs & Core', name: 'Reverse lunge pauses', sets: 2, reps: '6 each side' },
  { week: 4, session: 'Mobility', name: 'Side-lying leg raises', sets: 2, reps: '10 each side' },
  { week: 4, session: 'Upper Body', name: 'Prone T raises', sets: 2, reps: '10–12' },
  { week: 4, session: 'Reset', name: 'Glute bridge march', sets: 2, reps: '8 each side' },
  { week: 6, session: 'Push', name: 'Incline shoulder taps', sets: 2, reps: '8 each side' },
  { week: 6, session: 'Legs & Core', name: 'Bodyweight good mornings', sets: 2, reps: '10–12' },
  { week: 6, session: 'Mobility', name: 'Dynamic hamstring sweeps', sets: 2, reps: '8 each side' },
  { week: 6, session: 'Upper Body', name: 'Prone arm raises', sets: 2, reps: '8–10' },
  { week: 6, session: 'Reset', name: 'Standing knee drives', sets: 2, reps: '10 each side' },
  { week: 8, session: 'Push', name: 'Incline push-up hold', sets: 2, reps: '15 seconds' },
  { week: 8, session: 'Legs & Core', name: 'Squat pauses', sets: 2, reps: '8–10' },
  { week: 8, session: 'Mobility', name: 'Standing side bends', sets: 2, reps: '10 each side' },
  { week: 8, session: 'Upper Body', name: 'Prone arm circles', sets: 2, reps: '8 each direction' },
  { week: 8, session: 'Reset', name: 'Dead bug holds', sets: 2, reps: '8 each side' },
  { week: 10, session: 'Push', name: 'Standard push-ups', sets: 2, reps: '6–10' },
  { week: 10, session: 'Legs & Core', name: 'Lateral lunges', sets: 2, reps: '6 each side' },
  { week: 10, session: 'Mobility', name: 'Standing calf raises', sets: 2, reps: '12–15' },
  { week: 10, session: 'Upper Body', name: 'Prone Y holds', sets: 2, reps: '10 seconds' },
  { week: 10, session: 'Reset', name: 'Standing hip hinges', sets: 2, reps: '10–12' },
  { week: 12, session: 'Push', name: 'Tempo incline push-ups', sets: 2, reps: '6–8' },
  { week: 12, session: 'Legs & Core', name: 'Skater squats to a chair', sets: 2, reps: '5–6 each side' },
  { week: 12, session: 'Mobility', name: 'Glute bridge holds', sets: 2, reps: '20 seconds' },
  { week: 12, session: 'Upper Body', name: 'Prone swimmers', sets: 2, reps: '8 each side' },
  { week: 12, session: 'Reset', name: 'Slow bird dogs', sets: 2, reps: '8 each side' },
  // Later phases add harder bodyweight variations rather than promising a
  // particular appearance or relying on gym equipment.
  { week: 8, session: 'Push', name: 'Knee push-ups', sets: 2, reps: '6–10' },
  { week: 12, session: 'Push', name: 'Tempo standard push-ups', sets: 2, reps: '5–8' },
  { week: 8, session: 'Legs & Core', name: 'Split squats', sets: 2, reps: '6 each side' },
  { week: 10, session: 'Legs & Core', name: 'Assisted single-leg squats to a chair', sets: 2, reps: '5 each side' },
  { week: 8, session: 'Upper Body', name: 'Close-grip knee push-ups', sets: 2, reps: '6–8' },
  { week: 10, session: 'Upper Body', name: 'Pike push-up negatives', sets: 2, reps: '4–6' },
  { week: 12, session: 'Upper Body', name: 'Pike push-ups', sets: 2, reps: '5–8' },
]
const FACE_WEEKLY_PROGRESSIONS = [
  { week: 3, weekday: 1, period: 'Night', name: 'Change your pillowcase' },
  { week: 4, weekday: 2, period: 'Night', name: 'Wash your face towel' },
  { week: 5, weekday: 3, period: 'Morning', name: 'Take a progress photo in consistent lighting' },
  { week: 6, weekday: 4, period: 'Night', name: 'Check for irritation before adding new products' },
  { week: 7, weekday: 5, period: 'Morning', name: 'Reapply sunscreen as directed when outdoors' },
  { week: 10, weekday: 1, period: 'Morning', name: 'Include your ears and neck when applying sunscreen' },
  { week: 11, weekday: 2, period: 'Night', name: 'Compare progress photos in similar lighting' },
  { week: 12, weekday: 3, period: 'Night', name: 'Review which routine basics feel sustainable' },
]
const CHECKED_ROW_GLOW = '0 0 24px rgba(198,168,92,0.32), 0 0 42px rgba(198,168,92,0.14), inset 0 0 18px rgba(198,168,92,0.1)'
const CHECKED_ICON_GLOW = 'drop-shadow(0 0 5px rgba(198,168,92,0.5))'
const CHECKED_TEXT_GLOW = '0 0 18px rgba(198,168,92,0.7), 0 0 40px rgba(198,168,92,0.35)'

function createHomeWorkoutPlan(startDate) {
  const sessions = [
    { name: 'Push', focus: 'Upper-body push', exercises: [{ name: 'Incline push-ups', sets: 3, reps: '8–12' }, { name: 'Pike push-ups', sets: 3, reps: '6–10' }, { name: 'Chair dips', sets: 2, reps: '8–12' }, { name: 'Wall push-ups', sets: 2, reps: '10–12' }] },
    { name: 'Recovery', focus: 'Easy at-home mobility', exercises: [{ name: 'Cat-cow stretches', sets: 2, reps: '8–10' }, { name: 'Child’s pose', sets: 2, reps: '30 seconds' }] },
    { name: 'Legs & Core', focus: 'Lower body and core', exercises: [{ name: 'Bodyweight squats', sets: 3, reps: '10–15' }, { name: 'Reverse lunges', sets: 3, reps: '8 each side' }, { name: 'Dead bugs', sets: 3, reps: '8 each side' }, { name: 'Glute bridges', sets: 2, reps: '12–15' }] },
    { name: 'Mobility', focus: 'Gentle recovery at home', exercises: [{ name: 'Hip bridges', sets: 2, reps: '12' }, { name: 'Knee-to-chest stretch', sets: 2, reps: '30 seconds each side' }, { name: 'Bird dogs', sets: 2, reps: '8 each side' }, { name: 'Standing hip hinges', sets: 2, reps: '10–12' }] },
    { name: 'Upper Body', focus: 'Balanced upper body', exercises: [{ name: 'Knee push-ups', sets: 3, reps: '8–12' }, { name: 'Prone Y raises', sets: 3, reps: '10–12' }, { name: 'Wall slides', sets: 2, reps: '10–12' }, { name: 'Prone T raises', sets: 2, reps: '10–12' }] },
    { name: 'Recovery', focus: 'Relaxed mobility at home', exercises: [{ name: 'Standing side bends', sets: 2, reps: '8 each side' }, { name: 'Gentle hamstring stretch', sets: 2, reps: '30 seconds each side' }] },
    { name: 'Reset', focus: 'Light full-body recovery', exercises: [{ name: 'Bird dogs', sets: 2, reps: '8 each side' }, { name: 'Shoulder rolls', sets: 2, reps: '10 each direction' }, { name: 'Sit-to-stands', sets: 2, reps: '10–12' }, { name: 'Standing marches', sets: 2, reps: '10 each side' }] },
  ]
  return {
    version: 1,
    split: 'At-home weekly plan',
    trainingLevel: 'beginner',
    startDate,
    weeks: Array.from({ length: PLAN_TOTAL_WEEKS }, (_, index) => ({ week: index + 1, phase: ROUTINE_WEEK_NAMES[index], sessions })),
    gymAccess: false,
    daysPerWeek: 7,
  }
}

function getSessionForPlanDay(plan, challengeDay) {
  const weekNumber = Math.ceil(challengeDay / 7)
  const weekday = (challengeDay - 1) % 7
  const week = plan?.weeks?.[weekNumber - 1]
  const sessions = week?.sessions ?? []
  const sessionIndex = sessions.length === 7
    ? weekday
    : sessions.length
      ? Math.round(weekday * (sessions.length - 1) / 6)
      : -1
  return { weekNumber, session: sessionIndex >= 0 ? sessions[sessionIndex] : null }
}

function getBodyTasksForDay(plan, challengeDay) {
  const { weekNumber, session } = getSessionForPlanDay(plan, challengeDay)
  if (!session?.exercises?.length) return [{ title: 'Easy at-home movement' }, { title: 'Gentle stretching and mobility' }]
  const addedSetsByPhase = Math.min(3, Math.floor((weekNumber - 1) / 3))
  const baseTasks = session.exercises.map((exercise, index) => {
    const sets = Math.max(1, Number(exercise.sets) + addedSetsByPhase)
    const isHomeCardioDay = plan?.gymAccess === false && /cardio day/i.test(session.name || '') && /heavy cardio/i.test(exercise.name || '')
    return { title: exercise.name, reps: `${sets === 1 ? '' : `${sets} × `}${exercise.reps}`, details: isHomeCardioDay ? HEAVY_CARDIO_EXAMPLES : null }
  })
  const addedTasks = HOME_WEEKLY_PROGRESSIONS
    .filter(item => item.week <= weekNumber && item.session === session.name)
    .map(item => ({ title: item.name, reps: `${Math.min(5, item.sets + Math.floor((weekNumber - item.week) / 3))} × ${item.reps}` }))
  return [...baseTasks, ...addedTasks]
}

function getFaceTasksForDate(date, products, challengeDay) {
  const dayDate = new Date(`${date}T12:00:00`)
  const weekday = (dayDate.getDay() + 6) % 7
  const challengeWeek = Math.ceil(challengeDay / 7)
  const challengeWeekday = (challengeDay - 1) % 7
  const weekKey = getWeekKey(dayDate)
  const morningKeys = ['morning-0', 'face-ice', 'morning-1', 'morning-2', 'morning-face-neck-towel-method', 'morning-face-neck-chin-tucks', 'morning-face-neck-curls']
  const nightKeys = ['evening-0', 'evening-1', 'evening-face-neck-towel-method', 'evening-face-neck-chin-tucks', 'evening-face-neck-curls']
  const scheduled = products.filter(product => getProductDays(product, weekKey).includes(weekday))
  const morningProducts = scheduled.filter(product => product.time === 'Morning' || product.time === 'Morning and night' || product.time === 'Follow product label')
  const nightProducts = scheduled.filter(product => product.time === 'Night' || product.time === 'Morning and night')
  return [
    ...morningKeys.map(key => ({ key, group: 'morning' })),
    ...FACE_WEEKLY_PROGRESSIONS.filter(item => item.period === 'Morning' && item.week <= challengeWeek && item.weekday === challengeWeekday).map(item => ({ key: `face-weekly-${item.week}`, group: 'morning' })),
    ...morningProducts.map(product => ({ key: `product-${product.id}`, group: 'product' })),
    ...nightKeys.map(key => ({ key, group: 'evening' })),
    ...FACE_WEEKLY_PROGRESSIONS.filter(item => item.period === 'Night' && item.week <= challengeWeek && item.weekday === challengeWeekday).map(item => ({ key: `face-weekly-${item.week}`, group: 'evening' })),
    ...nightProducts.map(product => ({ key: `product-${product.id}`, group: 'product' })),
  ]
}

function formatUnlockCountdown(unlockAt, now) {
  if (!unlockAt || unlockAt <= now) return null
  const remaining = unlockAt - now
  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

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

function getRoutineWeekStart(date = new Date()) {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  sunday.setDate(sunday.getDate() - sunday.getDay())
  return getLocalDateKey(sunday)
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
  { id: 'morning', group: 'Morning', icon: Sun, title: 'Morning routine', steps: ['Rinse or use a gentle cleanser', 'Ice face', 'Apply moisturizer', 'Apply sunscreen SPF 30 or higher'], stepKeys: ['morning-0', 'face-ice', 'morning-1', 'morning-2'] },
  { id: 'walk', group: 'Daily', icon: Footprints, title: 'Get some movement', detail: 'Aim for a 20–30 minute walk or another comfortable activity, and break it into shorter walks if that fits your day better' },
  { id: 'recovery', group: 'Daily', icon: BedDouble, title: 'Protect your recovery', detail: 'Keep a consistent wind-down and bedtime, and choose a sleep duration appropriate for your age and schedule' },
  { id: 'evening', group: 'Evening', icon: Moon, title: 'Night routine', steps: ['Rinse or use a gentle cleanser', 'Apply moisturizer'] },
]

const PRODUCT_GUIDANCE = {
  cleanser: { time: 'Morning and night', frequency: 7, note: 'A gentle cleanser is commonly used daily; reduce use if your skin feels dry or irritated' },
  moisturizer: { time: 'Morning and night', frequency: 7, note: 'Moisturizer is commonly used daily, after cleansing' },
  sunscreen: { time: 'Morning', frequency: 7, note: 'Use in the morning and reapply as directed on the label when outdoors' },
  vitamin_c: { time: 'Morning', frequency: 3, note: 'Start slowly and increase only if your skin tolerates it and the product label allows' },
  retinoid: { time: 'Night', frequency: 2, note: 'Start slowly on dry skin; increase only if tolerated and the product label allows' },
  exfoliant: { time: 'Night', frequency: 1, note: 'Start slowly and follow the product label; avoid pairing with a retinoid on the same night until tolerated' },
  other: { time: 'Follow product label', frequency: 3, note: 'Check the product label for use instructions; adjust this suggested schedule to match it' },
}

const PRODUCT_TYPES = [
  ['cleanser', 'Cleanser'], ['moisturizer', 'Moisturizer'], ['sunscreen', 'Sunscreen'],
  ['vitamin_c', 'Vitamin C serum'], ['retinoid', 'Retinoid / retinol'], ['exfoliant', 'Exfoliant (AHA/BHA)'], ['other', 'Other'],
]

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HEAVY_CARDIO_EXAMPLES = [
  'High knees — 8–10 rounds of 20–30-second intervals',
  'Burpees — short, challenging intervals with full recovery',
  'Mountain climbers — fast intervals at a controlled pace',
  'Jumping jacks — brisk rounds with short breaks',
  'Jump rope — fast skipping intervals for 15–20 minutes',
  'Stair intervals — brisk climbs using a home staircase',
  'Shadow boxing — fast combinations with active footwork',
]

function getProductDays(product, weekKey) {
  const weekIndex = Math.floor(Date.parse(`${weekKey}T12:00:00`) / (7 * 24 * 60 * 60 * 1000))
  const frequency = product.frequency === '2-3'
    ? (weekIndex % 2 === 0 ? 2 : 3)
    : Math.min(7, Math.max(1, Number(product.frequency) || 1))
  let hash = 0
  for (const character of product.id) hash = (hash * 31 + character.charCodeAt(0)) % 7
  const days = new Set(Array.from({ length: frequency }, (_, index) => (hash + Math.floor(index * 7 / frequency)) % 7))
  if (product.addedWeek === weekKey && Number.isInteger(product.addedWeekday)) {
    const preferredDays = [...days]
    days.clear()
    days.add(product.addedWeekday)
    for (const weekday of preferredDays) {
      if (days.size >= frequency) break
      days.add(weekday)
    }
    for (let weekday = 0; days.size < frequency && weekday < 7; weekday += 1) days.add(weekday)
  }
  return [...days].sort((a, b) => a - b)
}

function productFrequencyLabel(frequency) {
  if (frequency === '2-3') return '2–3 days a week'
  const days = Number(frequency) || 1
  return days === 7 ? 'Every day' : `${days} ${days === 1 ? 'day' : 'days'} a week`
}

function loadFacePlan(key, currentWeek) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (typeof saved?.startWeek === 'string') {
      // Older versions anchored the routine calendar on Monday. If that
      // Monday is this same calendar week, rebase it to the real Sunday start.
      const oldMondayStart = getWeekKey(new Date(`${currentWeek}T12:00:00`))
      if (saved.startWeek === oldMondayStart && oldMondayStart !== currentWeek) {
        const migrated = { ...saved, startWeek: currentWeek }
        localStorage.setItem(key, JSON.stringify(migrated))
        return migrated
      }
      return saved
    }
    const plan = { startWeek: currentWeek }
    localStorage.setItem(key, JSON.stringify(plan))
    return plan
  } catch { return { startWeek: currentWeek } }
}

function getDateForWeekday(weekKey, weekday) {
  const date = new Date(`${weekKey}T12:00:00`)
  date.setDate(date.getDate() + weekday)
  return getLocalDateKey(date)
}

function loadFaceRoutineChecks(key, today, legacyDaily = {}) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    if (!saved[today] && Object.keys(legacyDaily).length) saved[today] = legacyDaily
    return saved
  } catch { return Object.keys(legacyDaily).length ? { [today]: legacyDaily } : {} }
}

function loadFaceDayUnlocks(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    const unlockedDay = Number(saved?.unlockedDay)
    const nextUnlockAt = Number(saved?.nextUnlockAt)
    return {
      unlockedDay: Number.isInteger(unlockedDay) ? Math.min(PLAN_TOTAL_DAYS, Math.max(1, unlockedDay)) : 1,
      nextUnlockAt: Number.isFinite(nextUnlockAt) && nextUnlockAt > 0 ? nextUnlockAt : null,
    }
  } catch {
    return { unlockedDay: 1, nextUnlockAt: null }
  }
}

function loadProducts(key, legacyKey) {
  try {
    let raw = localStorage.getItem(key)
    if (raw == null && legacyKey) {
      raw = localStorage.getItem(legacyKey)
      if (raw != null) localStorage.setItem(key, raw)
    }
    const saved = JSON.parse(raw || '[]')
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string') : []
  } catch { return [] }
}

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
    ? `Your lowest available face rating was ${faceFocus.label}; the plan starts with consistent, gentle skincare basics`
    : 'The face scan helps set a steady skincare and grooming baseline; ratings are photo-based and do not diagnose skin or health'
  const bodyCopy = bodyFocus?.key === 'muscle_mass'
    ? `Your lowest available body rating was ${bodyFocus.label}; the plan emphasizes balanced, progressive strength sessions`
    : bodyFocus?.key === 'v_taper' || bodyFocus?.key === 'frame_width'
      ? `Your lowest available body rating was ${bodyFocus.label}; the strength sessions include balanced upper-body push and pull movements`
      : 'The body scan informs a balanced strength routine, with rest and gradual progression built in'

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
    const completedDays = Array.isArray(saved.completedDays) ? saved.completedDays.filter(n => Number.isInteger(n) && n >= 1 && n <= PLAN_TOTAL_DAYS) : []
    const lastCompletedDate = typeof saved.lastCompletedDate === 'string' ? saved.lastCompletedDate : null
    const nextDay = Math.min(PLAN_TOTAL_DAYS, completedDays.length + 1)
    const nextUnlockAt = Number.isFinite(saved.nextUnlockAt) ? saved.nextUnlockAt : null
    const nextDayUnlocked = saved.nextDayUnlocked === true
    const activeDay = nextUnlockAt && nextUnlockAt > Date.now()
      ? Math.max(1, completedDays.length)
      : nextUnlockAt && nextUnlockAt <= Date.now()
        ? nextDay
        : nextDayUnlocked
          ? nextDay
        : lastCompletedDate === day && completedDays.length ? completedDays.length : nextDay
    const preserveCompletedChecks = nextUnlockAt > Date.now() && completedDays.includes(activeDay)
    return { completedDays, lastCompletedDate, nextUnlockAt, nextDayUnlocked, activeDay, today: day, checked: saved.today === day || preserveCompletedChecks ? (saved.checked || {}) : {}, checkedHistory: saved.checkedHistory && typeof saved.checkedHistory === 'object' ? saved.checkedHistory : {} }
  } catch {
    return { completedDays: [], lastCompletedDate: null, nextUnlockAt: null, nextDayUnlocked: false, activeDay: 1, today: day, checked: {}, checkedHistory: {} }
  }
}

function RoutineSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState(null)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const selected = options.find(option => option.value === value)

  function toggleOpen() {
    if (open) {
      setOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const desiredHeight = Math.min(options.length * 56 + 12, 224)
    const spaceBelow = window.innerHeight - rect.bottom - 16
    const spaceAbove = rect.top - 16
    const openUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow
    const availableHeight = openUp ? spaceAbove : spaceBelow
    setMenuPosition({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      maxHeight: Math.max(80, Math.min(desiredHeight, availableHeight)),
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return <div ref={rootRef} className="relative min-w-0">
    <span className="block font-body text-sm font-medium text-white/65">{label}</span>
    <button ref={triggerRef} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={toggleOpen} className="mt-1.5 flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-left font-body text-base font-medium text-primary transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A85C]" style={{ borderColor: open ? 'rgba(198,168,92,0.55)' : undefined }}>
      <span className="truncate">{selected?.label ?? value}</span><ChevronDown size={18} className={`shrink-0 text-white/65 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && menuPosition && createPortal(<div ref={listRef} role="listbox" aria-label={label} className="fixed z-[120] overflow-y-auto rounded-xl border border-white/10 bg-[#171717] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)]" style={menuPosition}>
      {options.map(option => <button key={String(option.value)} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false) }} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left font-body text-base font-medium transition-colors hover:bg-white/[0.06]" style={{ color: option.value === value ? GOLD : 'rgba(255,255,255,0.78)', background: option.value === value ? 'rgba(198,168,92,0.1)' : 'transparent' }}>
        <span>{option.label}</span>{option.value === value && <Check size={17} />}
      </button>)}
    </div>, document.body)}
  </div>
}

export default function FaceBodyRoutine() {
  const navigate = useNavigate()
  const [routineSection, setRoutineSection] = useState('face')
  const scans = useStore(state => state.scans)
  const currentScan = useStore(state => state.currentScan)
  const userId = useStore(state => state.user?.id)
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
  const [todayKey, setTodayKey] = useState(getLocalDateKey)
  const day = todayKey
  const week = getWeekKey(new Date(`${day}T12:00:00`))
  const routineWeekStart = getRoutineWeekStart(new Date(`${day}T12:00:00`))
  const todayWeekday = (new Date(`${day}T12:00:00`).getDay() + 6) % 7
  const progressKey = bothScansReady ? `ascendus-glow-routine-${faceScan.id}-${bodyScan.id}` : 'ascendus-glow-routine-pending'
  const [progress, setProgress] = useState(() => loadProgress(progressKey, day, week))
  const productsKey = userId ? `ascendus-glow-face-products-${userId}` : `${progressKey}-face-products-v1`
  const legacyProductsKey = `${progressKey}-face-products-v1`
  const faceDayUnlocksKey = `${productsKey}-day-unlocks-v1`
  const [faceDayUnlocks, setFaceDayUnlocks] = useState(() => loadFaceDayUnlocks(faceDayUnlocksKey))
  const [countdownNow, setCountdownNow] = useState(Date.now())
  const [faceDayUnlocksOwnerKey, setFaceDayUnlocksOwnerKey] = useState(faceDayUnlocksKey)
  const facePlanKey = `${productsKey}-12-week-plan-v1`
  const facePlanSelectionRef = useRef({ key: facePlanKey, unlockedDay: faceDayUnlocks.unlockedDay })
  const faceRoutineChecksKey = `${productsKey}-daily-checks-v1`
  const [faceRoutineChecks, setFaceRoutineChecks] = useState(() => loadFaceRoutineChecks(faceRoutineChecksKey, day, progress.daily))
  const [facePlan, setFacePlan] = useState(() => loadFacePlan(facePlanKey, routineWeekStart))
  const [selectedFacePlanDay, setSelectedFacePlanDay] = useState(() => loadFaceDayUnlocks(faceDayUnlocksKey).unlockedDay)
  const displayedFacePlanDay = Math.min(PLAN_TOTAL_DAYS, Math.max(1, selectedFacePlanDay))
  const selectedFaceWeek = Math.ceil(displayedFacePlanDay / 7)
  const selectedFaceWeekday = (displayedFacePlanDay - 1) % 7
  const selectedFaceDayLocked = displayedFacePlanDay > faceDayUnlocks.unlockedDay
  const faceUnlockCountdown = formatUnlockCountdown(faceDayUnlocks.nextUnlockAt, countdownNow)
  const selectedFaceDate = getDateForWeekday(facePlan.startWeek, displayedFacePlanDay - 1)
  const selectedFaceWeekKey = getWeekKey(new Date(`${selectedFaceDate}T12:00:00`))
  const [products, setProducts] = useState(() => loadProducts(productsKey, legacyProductsKey))
  const [productName, setProductName] = useState('')
  const [showProducts, setShowProducts] = useState(false)
  const [productType, setProductType] = useState('cleanser')
  const [productTime, setProductTime] = useState(PRODUCT_GUIDANCE.cleanser.time)
  const [productFrequency, setProductFrequency] = useState(PRODUCT_GUIDANCE.cleanser.frequency)
  const planKey = `${progressKey}-ai-12-week-home-v2`
  const [plan, setPlan] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(planKey) || 'null')
      if (saved?.gymAccess !== false) return createHomeWorkoutPlan(day)
      const fallback = createHomeWorkoutPlan(day)
      const weeks = Array.from({ length: PLAN_TOTAL_WEEKS }, (_, index) => {
        const fallbackWeek = fallback.weeks[index]
        const savedWeek = saved.weeks?.[index]
        if (!savedWeek) return fallbackWeek
        const sessions = fallbackWeek.sessions.map(defaultSession => {
          const savedSession = savedWeek.sessions?.find(item => item.name === defaultSession.name)
          if (!savedSession) return defaultSession
          const existingExercises = savedSession.exercises || []
          const existingNames = new Set(existingExercises.map(exercise => exercise.name))
          return {
            ...savedSession,
            exercises: [...existingExercises, ...defaultSession.exercises.filter(exercise => !existingNames.has(exercise.name))],
          }
        })
        return { ...fallbackWeek, ...savedWeek, sessions }
      })
      return { ...saved, weeks }
    } catch { return createHomeWorkoutPlan(day) }
  })
  const [planProgress, setPlanProgress] = useState(() => getPlanProgress(`${planKey}-progress`, day))
  const bodyUnlockCountdown = faceUnlockCountdown
  const [selectedPlanWeek, setSelectedPlanWeek] = useState(() => Math.ceil(planProgress.activeDay / 7))
  const [showWeekCalendar, setShowWeekCalendar] = useState(false)
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
    setProducts(loadProducts(productsKey, legacyProductsKey))
    setFacePlan(loadFacePlan(facePlanKey, routineWeekStart))
    setFaceRoutineChecks(loadFaceRoutineChecks(faceRoutineChecksKey, day, progress.daily))
  }, [productsKey, legacyProductsKey, facePlanKey, faceRoutineChecksKey, routineWeekStart, day, progress.daily])

  useEffect(() => {
    setFaceDayUnlocks(loadFaceDayUnlocks(faceDayUnlocksKey))
    setFaceDayUnlocksOwnerKey(faceDayUnlocksKey)
  }, [faceDayUnlocksKey])

  useEffect(() => {
    const previous = facePlanSelectionRef.current
    setSelectedFacePlanDay(current => previous.key !== facePlanKey || current === previous.unlockedDay
      ? faceDayUnlocks.unlockedDay
      : current)
    facePlanSelectionRef.current = { key: facePlanKey, unlockedDay: faceDayUnlocks.unlockedDay }
  }, [facePlanKey, faceDayUnlocks.unlockedDay])

  useEffect(() => {
    if (faceDayUnlocksOwnerKey !== faceDayUnlocksKey) return
    try { localStorage.setItem(faceDayUnlocksKey, JSON.stringify(faceDayUnlocks)) } catch { /* keep unlocks available for this visit */ }
  }, [faceDayUnlocksKey, faceDayUnlocks, faceDayUnlocksOwnerKey])

  useEffect(() => {
    if (!faceDayUnlocks.nextUnlockAt) return undefined
    const delay = faceDayUnlocks.nextUnlockAt - Date.now()
    if (delay <= 0) {
      setFaceDayUnlocks(current => current.nextUnlockAt && current.nextUnlockAt <= Date.now()
        ? { unlockedDay: Math.min(PLAN_TOTAL_DAYS, current.unlockedDay + 1), nextUnlockAt: null }
        : current)
      return undefined
    }
    const timer = window.setTimeout(() => {
      setFaceDayUnlocks(current => current.nextUnlockAt && current.nextUnlockAt <= Date.now()
        ? { unlockedDay: Math.min(PLAN_TOTAL_DAYS, current.unlockedDay + 1), nextUnlockAt: null }
        : current)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [faceDayUnlocks.nextUnlockAt])

  useEffect(() => {
    if (!faceDayUnlocks.nextUnlockAt && !planProgress.nextUnlockAt) return undefined
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [faceDayUnlocks.nextUnlockAt, planProgress.nextUnlockAt])

  useEffect(() => {
    if (progress.day !== day || faceRoutineChecks[day]) return
    const next = { ...faceRoutineChecks, [day]: progress.daily }
    setFaceRoutineChecks(next)
    try { localStorage.setItem(faceRoutineChecksKey, JSON.stringify(next)) } catch { /* keep today's routine usable */ }
  }, [faceRoutineChecksKey, day, progress.day, progress.daily, faceRoutineChecks])

  useEffect(() => {
    if (!showProducts) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event) {
      if (event.key === 'Escape') setShowProducts(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [showProducts])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(planKey) || 'null')
      if (saved?.gymAccess === false) {
        const fallback = createHomeWorkoutPlan(day)
        setPlan({ ...saved, weeks: Array.from({ length: PLAN_TOTAL_WEEKS }, (_, index) => saved.weeks?.[index] || fallback.weeks[index]) })
      } else setPlan(createHomeWorkoutPlan(day))
    } catch { setPlan(createHomeWorkoutPlan(day)) }
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
  const sectionSteps = DAILY_STEPS
    .filter(step => routineSection === 'face' ? ['morning', 'evening'].includes(step.id) : ['walk', 'recovery'].includes(step.id))
    .map(step => {
      if (!['morning', 'evening'].includes(step.id)) return step
      const period = step.id === 'morning' ? 'Morning' : 'Night'
      const scheduledProducts = products.filter(product => {
        const timeMatches = product.time === period || product.time === 'Morning and night' || (product.time === 'Follow product label' && step.id === 'morning')
        return timeMatches && getProductDays(product, selectedFaceWeekKey).includes(selectedFaceWeekday)
      })
      const routineExercises = [
        { key: `${step.id}-face-neck-towel-method`, title: 'Towel method', reps: '3 × 15' },
        { key: `${step.id}-face-neck-chin-tucks`, title: 'Chin tucks', reps: '3 × 10' },
        { key: `${step.id}-face-neck-curls`, title: 'Neck curls', reps: '2 × 8' },
      ]
      const routineProgressions = FACE_WEEKLY_PROGRESSIONS
        .filter(item => item.period === period && item.week <= selectedFaceWeek && item.weekday === selectedFaceWeekday)
        .map(item => ({ key: `face-weekly-${item.week}`, title: item.name, reps: 'Weekly' }))
      if (!scheduledProducts.length && !routineExercises.length && !routineProgressions.length) return step
      const steps = [...step.steps, ...scheduledProducts.map(product => product.time === 'Follow product label' ? `Check the label for when to use ${product.name}` : `Apply ${product.name}`), ...routineExercises.map(exercise => exercise.title), ...routineProgressions.map(item => item.title)]
      const stepKeys = [...step.steps.map((_, index) => step.stepKeys?.[index] ?? `${step.id}-${index}`), ...scheduledProducts.map(product => `product-${product.id}`), ...routineExercises.map(exercise => exercise.key), ...routineProgressions.map(item => item.key)]
      const stepDetails = Object.fromEntries([...routineExercises, ...routineProgressions].map(item => [item.key, item.reps]))
      return { ...step, steps, stepKeys, stepDetails }
    })

  const faceDayStarted = sectionSteps.some(step => step.steps?.some((_, index) => isRoutineStepChecked(step, index)))
    || ['Morning', 'Night'].some(period => Array.from({ length: 4 }, (_, index) => isHydrationGlassChecked(period, index)).some(Boolean))

  useEffect(() => {
    if (routineSection !== 'face' || selectedFaceDayLocked || displayedFacePlanDay !== faceDayUnlocks.unlockedDay || faceDayUnlocks.nextUnlockAt || faceDayUnlocks.unlockedDay >= PLAN_TOTAL_DAYS) return
    if (faceDayStarted) setFaceDayUnlocks(current => current.nextUnlockAt || current.unlockedDay !== displayedFacePlanDay
      ? current
      : { ...current, nextUnlockAt: Date.now() + 12 * 60 * 60 * 1000 })
  }, [routineSection, selectedFaceDayLocked, displayedFacePlanDay, faceDayUnlocks, faceDayStarted])
  const activeWeekNumber = Math.ceil(planProgress.activeDay / 7)
  const [selectedPlanDay, setSelectedPlanDay] = useState(planProgress.activeDay)
  const bodyPlanSelectionRef = useRef({ key: planKey, activeDay: planProgress.activeDay })
  useEffect(() => {
    const previous = bodyPlanSelectionRef.current
    if (previous.key !== planKey) {
      setSelectedPlanWeek(activeWeekNumber)
      setSelectedPlanDay(planProgress.activeDay)
    } else {
      setSelectedPlanWeek(current => current === Math.ceil(previous.activeDay / 7) ? activeWeekNumber : current)
      setSelectedPlanDay(current => current === previous.activeDay ? planProgress.activeDay : current)
    }
    bodyPlanSelectionRef.current = { key: planKey, activeDay: planProgress.activeDay }
  }, [planKey, activeWeekNumber, planProgress.activeDay])
  const activeWeek = plan?.weeks?.[activeWeekNumber - 1]
  const viewedWeek = plan?.weeks?.[selectedPlanWeek - 1]
  const viewingCurrentDay = selectedPlanDay === planProgress.activeDay
  const viewedWeekday = (selectedPlanDay - 1) % 7
  const scheduledWorkoutIndexes = viewedWeek?.sessions?.length === 7
    ? viewedWeek.sessions.map((_, index) => index)
    : viewedWeek?.sessions?.length
      ? viewedWeek.sessions.map((_, index) => Math.round(index * 6 / viewedWeek.sessions.length))
    : []
  const todaysSessionIndex = scheduledWorkoutIndexes.indexOf(viewedWeekday)
  const todaysSession = todaysSessionIndex >= 0 ? viewedWeek.sessions[todaysSessionIndex] : null
  const faceActionRecommendations = recommendations.filter(item => /skin|cleanser|moistur|spf|sunscreen|groom|hair|photo|presentation/i.test(item.text))
  const todayFaceAction = faceActionRecommendations.length ? faceActionRecommendations[(planProgress.activeDay - 1) % faceActionRecommendations.length] : null
  const showCoachAdvicePreview = new URLSearchParams(window.location.search).get('coachAdvicePreview') === '1'
  const activeMissionSteps = getBodyTasksForDay(plan, selectedPlanDay)
  const selectedRoutineWeek = routineSection === 'face' ? selectedFaceWeek : selectedPlanWeek
  const selectedBodyWeekLocked = selectedPlanWeek > activeWeekNumber
  const routineProgressWeek = selectedRoutineWeek
  const selectedRoutineWeekLocked = routineSection === 'face'
    ? selectedFaceWeek > Math.ceil(faceDayUnlocks.unlockedDay / 7)
    : selectedBodyWeekLocked
  const selectedRoutineDay = routineSection === 'face' ? displayedFacePlanDay : selectedPlanDay
  const routineDayUnlockLimit = routineSection === 'face' ? faceDayUnlocks.unlockedDay : planProgress.activeDay
  const routineDayIsPast = selectedRoutineDay < routineDayUnlockLimit
  const routineDayIsLocked = selectedRoutineDay > routineDayUnlockLimit
  const routineStartDate = routineSection === 'face' ? facePlan.startWeek : (plan?.startDate || facePlan.startWeek)
  const selectedRoutineDate = getDateForWeekday(routineStartDate, selectedRoutineDay - 1)
  const selectedRoutineDateLabel = new Date(`${selectedRoutineDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const weekCalendarDays = Array.from({ length: Math.min(7, PLAN_TOTAL_DAYS - (selectedRoutineWeek - 1) * 7) }, (_, index) => (selectedRoutineWeek - 1) * 7 + index + 1)
  const routineProgressDay = (routineProgressWeek - 1) * 7 + 1
  const weeklyTaskProgress = useMemo(() => {
    let total = 0
    let completed = 0
    const dayEnd = Math.min(PLAN_TOTAL_DAYS, routineProgressDay + 6)
    for (let challengeDay = routineProgressDay; challengeDay <= dayEnd; challengeDay += 1) {
      const faceDate = getDateForWeekday(facePlan.startWeek, challengeDay - 1)
      const faceTasks = getFaceTasksForDate(faceDate, products, challengeDay)
      const faceChecks = faceRoutineChecks[faceDate] ?? {}
      for (const task of faceTasks) {
        total += 1
        if (faceChecks[task.key] ?? (task.group !== 'product' && faceChecks[task.group])) completed += 1
      }

      const bodyTasks = getBodyTasksForDay(plan, challengeDay)
      total += bodyTasks.length
      const bodyChecks = planProgress.checkedHistory?.[challengeDay]
        ?? (challengeDay === planProgress.activeDay ? planProgress.checked : {})
      completed += bodyTasks.filter((_, index) => Boolean(bodyChecks[`${challengeDay}-${index}`])).length
    }
    return { total, completed, percent: total ? Math.round(completed / total * 100) : 0 }
  }, [routineProgressDay, facePlan.startWeek, products, faceRoutineChecks, plan, planProgress])
  const planDayDone = viewingCurrentDay && planProgress.completedDays.includes(planProgress.activeDay)
  const selectedPlanDayDone = planProgress.completedDays.includes(selectedPlanDay)
  const selectedPlanDayChecks = selectedPlanDay === planProgress.activeDay
    ? planProgress.checked
    : planProgress.checkedHistory?.[selectedPlanDay] ?? {}
  const checkedPlanSteps = activeMissionSteps.filter((_, index) => planProgress.checked[`${planProgress.activeDay}-${index}`]).length

  function selectRoutineWeek(weekNumber) {
    const nextWeek = Math.min(PLAN_TOTAL_WEEKS, Math.max(1, weekNumber))
    triggerHaptic()
    if (routineSection === 'face') {
      const unlockedWeek = Math.ceil(faceDayUnlocks.unlockedDay / 7)
      setSelectedFacePlanDay(nextWeek === unlockedWeek ? faceDayUnlocks.unlockedDay : (nextWeek - 1) * 7 + 1)
      return
    }
    setSelectedPlanWeek(nextWeek)
    setSelectedPlanDay(nextWeek === activeWeekNumber ? planProgress.activeDay : (nextWeek - 1) * 7 + 1)
  }

  function selectRoutineDay(challengeDay) {
    triggerHaptic()
    if (routineSection === 'face') {
      setSelectedFacePlanDay(challengeDay)
      return
    }
    setSelectedPlanWeek(Math.ceil(challengeDay / 7))
    setSelectedPlanDay(challengeDay)
  }

  useEffect(() => {
    if (!viewingCurrentDay || planDayDone || activeMissionSteps.length === 0 || checkedPlanSteps !== activeMissionSteps.length) return
    const sharedUnlockAt = [planProgress.nextUnlockAt, faceDayUnlocks.nextUnlockAt].find(target => target && target > countdownNow)
      ?? (planProgress.activeDay < PLAN_TOTAL_DAYS ? countdownNow + 12 * 60 * 60 * 1000 : null)
    const next = { ...planProgress, completedDays: [...new Set([...planProgress.completedDays, planProgress.activeDay])], lastCompletedDate: day, nextUnlockAt: sharedUnlockAt, nextDayUnlocked: false, today: day }
    setPlanProgress(next)
    try { localStorage.setItem(`${planKey}-progress`, JSON.stringify(next)) } catch { /* keep the routine available for this visit */ }
  }, [viewingCurrentDay, planDayDone, checkedPlanSteps, activeMissionSteps.length, planProgress, day, planKey, countdownNow, faceDayUnlocks.nextUnlockAt])

  useEffect(() => {
    if (!planProgress.nextUnlockAt || planProgress.nextUnlockAt > countdownNow || planProgress.activeDay >= PLAN_TOTAL_DAYS) return
    const nextDay = Math.min(PLAN_TOTAL_DAYS, planProgress.completedDays.length + 1)
    if (planProgress.activeDay === nextDay) return
    const next = { ...planProgress, activeDay: nextDay, nextUnlockAt: null, nextDayUnlocked: true, checked: {}, today: day }
    setPlanProgress(next)
    try { localStorage.setItem(`${planKey}-progress`, JSON.stringify(next)) } catch { /* keep the unlocked day available for this visit */ }
  }, [planProgress, countdownNow, day, planKey])

  function saveProgress(next) {
    setProgress(next)
    try { localStorage.setItem(progressKey, JSON.stringify(next)) } catch { /* routine still works for this visit */ }
  }

  function saveProducts(next) {
    setProducts(next)
    try { localStorage.setItem(productsKey, JSON.stringify(next)) } catch { /* keep the list available for this visit */ }
  }

  function handleProductTypeChange(type) {
    const guidance = PRODUCT_GUIDANCE[type]
    setProductType(type)
    setProductTime(guidance.time)
    setProductFrequency(guidance.frequency)
  }

  function addProduct(event) {
    event.preventDefault()
    const name = productName.trim()
    if (!name) return
    triggerHaptic()
    saveProducts([...products, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, type: productType, time: productTime, frequency: productFrequency, addedWeek: week, addedWeekday: todayWeekday }])
    setProductName('')
  }

  function removeProduct(id) {
    triggerHaptic()
    saveProducts(products.filter(product => product.id !== id))
  }

  function toggleStep(id) {
    triggerHaptic()
    saveProgress({ ...progress, day, daily: { ...progress.daily, [id]: !progress.daily[id] }, week, sessions: progress.sessions })
  }

  function routineStepKey(step, index) {
    return step.stepKeys?.[index] ?? `${step.id}-${index}`
  }

  function isRoutineStepChecked(step, index) {
    const key = routineStepKey(step, index)
    const daily = faceRoutineChecks[selectedFaceDate] ?? (selectedFaceDate === day ? progress.daily : {})
    return Boolean(daily[key] ?? (key.startsWith('product-') ? false : daily[step.id]))
  }

  function hydrationCount(period) {
    return Array.from({ length: 4 }, (_, index) => isHydrationGlassChecked(period, index)).filter(Boolean).length
  }

  function isHydrationGlassChecked(period, index) {
    const key = `hydration-${period.toLowerCase()}-${index}`
    const daily = faceRoutineChecks[selectedFaceDate] ?? (selectedFaceDate === day ? progress.daily : {})
    return Boolean(daily[key])
  }

  function toggleHydrationGlass(period, index) {
    if (selectedFaceDayLocked) return
    triggerHaptic()
    const currentCount = hydrationCount(period)
    const nextCount = index < currentCount ? index : index + 1
    const daily = { ...(faceRoutineChecks[selectedFaceDate] ?? (selectedFaceDate === day ? progress.daily : {})) }
    for (let glass = 0; glass < 4; glass += 1) daily[`hydration-${period.toLowerCase()}-${glass}`] = glass < nextCount
    const nextChecks = { ...faceRoutineChecks, [selectedFaceDate]: daily }
    setFaceRoutineChecks(nextChecks)
    try { localStorage.setItem(faceRoutineChecksKey, JSON.stringify(nextChecks)) } catch { /* keep hydration available for this visit */ }
    if (selectedFaceDate === day) saveProgress({ ...progress, day, daily: { ...progress.daily, ...daily } })
  }

  function toggleRoutineStep(step, index) {
    if (selectedFaceDayLocked) return
    triggerHaptic()
    const daily = { ...(faceRoutineChecks[selectedFaceDate] ?? (selectedFaceDate === day ? progress.daily : {})) }
    // Expand a previously completed whole routine before changing one step.
    step.steps.forEach((_, itemIndex) => {
      daily[routineStepKey(step, itemIndex)] = isRoutineStepChecked(step, itemIndex)
    })
    const key = routineStepKey(step, index)
    daily[key] = !daily[key]
    daily[step.id] = step.steps.every((_, itemIndex) => daily[routineStepKey(step, itemIndex)])
    const nextChecks = { ...faceRoutineChecks, [selectedFaceDate]: daily }
    setFaceRoutineChecks(nextChecks)
    try { localStorage.setItem(faceRoutineChecksKey, JSON.stringify(nextChecks)) } catch { /* keep the selected day's routine usable */ }
    if (selectedFaceDate === day) saveProgress({ ...progress, day, daily: { ...progress.daily, ...daily } })
  }

  function togglePlanStep(index) {
    if (!viewingCurrentDay || !activeWeek || planDayDone) return
    triggerHaptic()
    const checked = { ...planProgress.checked, [`${planProgress.activeDay}-${index}`]: !planProgress.checked[`${planProgress.activeDay}-${index}`] }
    const now = Date.now()
    const sharedUnlockAt = [faceDayUnlocks.nextUnlockAt, planProgress.nextUnlockAt].find(target => target && target > now)
      ?? (planProgress.activeDay < PLAN_TOTAL_DAYS ? now + 12 * 60 * 60 * 1000 : null)
    if (sharedUnlockAt && faceDayUnlocks.nextUnlockAt !== sharedUnlockAt) {
      setFaceDayUnlocks(current => current.nextUnlockAt && current.nextUnlockAt > now
        ? current
        : { ...current, nextUnlockAt: sharedUnlockAt })
    }
    const checkedHistory = { ...(planProgress.checkedHistory ?? {}), [planProgress.activeDay]: checked }
    const next = { ...planProgress, today: day, checked, checkedHistory, nextUnlockAt: sharedUnlockAt }
    setPlanProgress(next)
    try { localStorage.setItem(`${planKey}-progress`, JSON.stringify(next)) } catch { /* keep the session usable */ }
  }

  return <MotionPage>
    <PageHeader title="" onBack={() => navigate('/extras')} />
    <main className="space-y-3 px-4 pb-28 pt-3">
        <div className="flex justify-end">
          <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-black p-1" role="tablist" aria-label="Routine sections">
            {['face', 'body'].map(section => <button key={section} type="button" role="tab" id={`routine-tab-${section}`} aria-selected={routineSection === section} aria-controls={`routine-panel-${section}`} onClick={() => { triggerHaptic(); setRoutineSection(section) }} className="min-h-9 rounded-full px-3 font-heading text-xs font-medium transition-colors" style={{ background: routineSection === section ? '#242424' : 'transparent', color: routineSection === section ? '#F5F5F5' : 'rgba(255,255,255,0.58)' }}>{section === 'face' ? 'Face' : 'Body'}</button>)}
          </div>
        </div>
        <section aria-label={`${ROUTINE_WEEK_NAMES[selectedRoutineWeek - 1]} week ${selectedRoutineWeek} progress`} className="rounded-2xl border p-3.5" style={{ borderColor: 'rgba(198,168,92,0.24)', background: 'linear-gradient(135deg, rgba(198,168,92,0.08), rgba(255,255,255,0.025))' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>{ROUTINE_WEEK_NAMES[selectedRoutineWeek - 1]}</p>
              <div className="mt-0.5 flex items-center gap-1.5"><h2 className="font-heading text-lg font-semibold text-primary">Week {selectedRoutineWeek}{selectedRoutineWeekLocked && <LockKeyhole className="ml-2 inline h-4 w-4 align-[0.1em]" style={{ color: GOLD }} aria-label="Locked" title="Locked" />}</h2><button type="button" aria-label={showWeekCalendar ? 'Close week calendar' : 'Open week calendar'} aria-expanded={showWeekCalendar} onClick={() => setShowWeekCalendar(value => !value)} className="flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.07] hover:text-primary"><ChevronDown size={17} className={`transition-transform ${showWeekCalendar ? 'rotate-180' : ''}`} /></button></div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous week" disabled={selectedRoutineWeek <= 1} onClick={() => selectRoutineWeek(selectedRoutineWeek - 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-primary transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={19} /></button>
                <button type="button" aria-label="Next week" disabled={selectedRoutineWeek >= PLAN_TOTAL_WEEKS} onClick={() => selectRoutineWeek(selectedRoutineWeek + 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-primary transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight size={19} /></button>
              </div>
            </div>
          </div>
          <div role="progressbar" aria-label={`Week ${selectedRoutineWeek} progress`} aria-valuemin={0} aria-valuemax={weeklyTaskProgress.total} aria-valuenow={weeklyTaskProgress.completed} className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${weeklyTaskProgress.percent}%`, background: GOLD, boxShadow: weeklyTaskProgress.percent ? '0 0 10px rgba(198,168,92,0.42)' : 'none' }} />
          </div>
          {showWeekCalendar && <div className="mt-3 border-t border-white/[0.08] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-body text-xs">
              <span className="font-semibold text-primary">{selectedRoutineDateLabel}</span>
              {!routineDayIsLocked && !routineDayIsPast && <span style={{ color: 'rgba(255,255,255,0.58)' }}>{(routineSection === 'face' ? faceUnlockCountdown : bodyUnlockCountdown) ? `Next day unlocks in ${routineSection === 'face' ? faceUnlockCountdown : bodyUnlockCountdown}` : 'Check off a task to start the 12-hour unlock'}</span>}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5" role="group" aria-label={`Days in week ${selectedRoutineWeek}`}>
              {weekCalendarDays.map(challengeDay => {
                const date = getDateForWeekday(routineStartDate, challengeDay - 1)
                const dateNumber = new Date(`${date}T12:00:00`).getDate()
                const locked = challengeDay > routineDayUnlockLimit
                const selected = challengeDay === selectedRoutineDay
                return <button key={challengeDay} type="button" aria-label={`${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${locked ? ', locked preview' : ''}`} aria-disabled={locked} aria-current={selected ? 'date' : undefined} onClick={() => selectRoutineDay(challengeDay)} className="flex aspect-square min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs transition-colors" style={{ color: selected ? '#111' : locked ? GOLD : 'rgba(255,255,255,0.78)', background: selected ? GOLD : locked ? 'rgba(198,168,92,0.06)' : 'rgba(255,255,255,0.035)', borderColor: selected ? GOLD : 'rgba(255,255,255,0.08)', opacity: locked && !selected ? 0.7 : 1 }}><span className="text-[9px] uppercase">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span><span className="font-semibold">{locked ? <LockKeyhole size={12} /> : dateNumber}</span></button>
              })}
            </div>
          </div>}
        </section>
        <div role="tabpanel" id={`routine-panel-${routineSection}`} aria-labelledby={`routine-tab-${routineSection}`} className="space-y-3">
        {routineSection === 'face' && <div className="space-y-3">
            {sectionSteps.map(step => {
              const Icon = step.icon
              const checked = step.steps ? step.steps.every((_, index) => isRoutineStepChecked(step, index)) : Boolean(progress.daily[step.id])
              if (step.steps) {
                const completedSteps = step.steps.filter((_, index) => isRoutineStepChecked(step, index)).length
                const hydrationPeriod = step.id === 'morning' ? 'Morning' : 'Night'
                return <section key={step.id} aria-label={step.title} className="rounded-2xl border p-4" style={{ borderColor: checked ? 'rgba(198,168,92,0.35)' : 'rgba(255,255,255,0.07)', background: checked ? 'rgba(198,168,92,0.07)' : 'rgba(255,255,255,0.025)' }}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(198,168,92,0.12)', color: GOLD }}><Icon size={19} /></span>
                    <h3 className="flex-1 font-heading text-base font-semibold text-primary">{step.title}</h3>
                    {!selectedFaceDayLocked && <span aria-live="polite" className="font-body text-sm" style={{ color: checked ? GOLD : 'rgba(255,255,255,0.5)' }}>{checked ? 'Done' : `${completedSteps}/${step.steps.length}`}</span>}
                  </div>
                  {(step.id === 'morning' || step.id === 'evening') && <div className="mb-3">
                    <div className="grid w-[172px] grid-cols-4 gap-2">
                      {Array.from({ length: 4 }, (_, index) => {
                        const filled = isHydrationGlassChecked(hydrationPeriod, index)
                        return <button key={`water-${step.id}-${index}`} type="button" disabled={selectedFaceDayLocked || routineDayIsPast} aria-label={`${hydrationPeriod} water glass ${index + 1} of 4`} aria-pressed={filled} onClick={() => toggleHydrationGlass(hydrationPeriod, index)} className="flex min-h-9 items-center justify-center rounded-lg transition-all duration-200 active:scale-110 disabled:cursor-not-allowed disabled:opacity-100"><Droplets size={20} strokeWidth={3.5} style={{ color: filled ? GOLD : 'rgba(255,255,255,0.12)', filter: filled ? CHECKED_ICON_GLOW : 'none' }} /></button>
                      })}
                    </div>
                    <div role="progressbar" aria-label={`${hydrationPeriod} water progress`} aria-valuemin={0} aria-valuemax={4} aria-valuenow={hydrationCount(hydrationPeriod)} className="mt-1.5 h-1 w-[172px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${hydrationCount(hydrationPeriod) / 4 * 100}%`, background: GOLD, boxShadow: hydrationCount(hydrationPeriod) ? CHECKED_ICON_GLOW : 'none' }} />
                    </div>
                  </div>}
                  <div className="space-y-2">{step.steps.map((instruction, index) => {
                    const itemChecked = isRoutineStepChecked(step, index)
                    const stepKey = routineStepKey(step, index)
                    const detail = step.stepDetails?.[stepKey]
                    return <button key={step.stepKeys?.[index] ?? instruction} type="button" disabled={selectedFaceDayLocked || routineDayIsPast} aria-pressed={itemChecked} aria-disabled={selectedFaceDayLocked || routineDayIsPast} onClick={() => toggleRoutineStep(step, index)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all duration-200 active:scale-[0.99] disabled:cursor-default disabled:opacity-75" style={{ borderColor: itemChecked ? GOLD : 'rgba(255,255,255,0.08)', background: itemChecked ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.035)', boxShadow: itemChecked ? CHECKED_ROW_GLOW : 'none' }}>
                      {selectedFaceDayLocked ? <LockKeyhole className="h-4 w-4 shrink-0" style={{ color: GOLD }} aria-label="Locked until this day unlocks" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: itemChecked ? GOLD : 'rgba(255,255,255,0.25)', background: itemChecked ? 'rgba(198,168,92,0.12)' : 'transparent', color: GOLD, filter: itemChecked ? CHECKED_ICON_GLOW : 'none' }}>{itemChecked && <Check size={12} strokeWidth={3} />}</span>}
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3"><span className={`${detail ? 'font-heading font-semibold' : 'font-body'} min-w-0 text-sm leading-relaxed ${itemChecked ? 'line-through' : ''}`} style={{ color: itemChecked ? GOLD : 'rgba(255,255,255,0.8)', textShadow: itemChecked ? CHECKED_TEXT_GLOW : 'none' }}>{instruction}</span>{detail && <span className="shrink-0 rounded-full px-2.5 py-1.5 font-heading text-xs font-bold whitespace-nowrap" style={{ background: 'rgba(198,168,92,0.15)', color: GOLD }}>{detail}</span>}</span>
                    </button>
                  })}</div>
                </section>
              }
              return <button key={step.id} type="button" onClick={() => toggleStep(step.id)} aria-pressed={checked} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors" style={{ borderColor: checked ? 'rgba(198,168,92,0.35)' : 'rgba(255,255,255,0.07)', background: checked ? 'rgba(198,168,92,0.07)' : 'rgba(255,255,255,0.025)' }}>
                <span className="mt-0.5" style={{ color: checked ? GOLD : 'rgba(255,255,255,0.42)' }}>{checked ? <Check size={18} /> : <Icon size={18} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-heading text-sm font-semibold text-primary">{step.title}</span><span className="mt-2 block font-body text-xs leading-relaxed text-white/65">{step.steps ? <span role="list" className="block space-y-1.5">{step.steps.map((instruction, index) => <span role="listitem" key={instruction} className="flex gap-2"><span aria-hidden="true" className="shrink-0" style={{ color: GOLD }}>{index + 1}.</span><span>{instruction}</span></span>)}</span> : step.detail}</span></span>
              </button>
            })}
        </div>}
        {routineSection === 'face' && showCoachAdvicePreview && <section className="rounded-2xl border p-4" style={{ borderColor: 'rgba(198,168,92,0.2)', background: 'linear-gradient(145deg, rgba(198,168,92,0.08), rgba(255,255,255,0.025))' }}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: GOLD, background: 'rgba(198,168,92,0.13)' }}><Sparkles size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-sm font-bold text-primary">Coach tip · Tonight</h3><span className="rounded-full px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD, background: 'rgba(198,168,92,0.12)' }}>Example</span></div>
              <p className="mt-2 font-body text-sm leading-relaxed text-white/70">Keep tonight’s routine simple: cleanse gently, then moisturize; use added products according to the schedule in My Products</p>
              <button type="button" onClick={() => { triggerHaptic(); navigate('/progress', { state: { coachPrompt: 'Can you explain this routine suggestion and help me adapt it to my products? Please help me follow the Face & Body Routine.' } }) }} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 font-heading text-xs font-semibold" style={{ color: GOLD }}>Ask a follow-up <ArrowRight size={14} /></button>
            </div>
          </div>
        </section>}
        {routineSection === 'face' && showProducts && createPortal(<div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/70 p-3" onClick={event => { if (event.target === event.currentTarget) setShowProducts(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="my-products-title" className="max-h-[85dvh] w-[min(82vw,24rem)] max-w-full overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#111] p-4 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="my-products-title" className="font-heading text-lg font-bold text-primary">My products</h2><p className="mt-1 font-body text-sm leading-relaxed text-white/65">Add what you already use to see a suggested time and weekly schedule</p></div><button type="button" aria-label="Close my products" onClick={() => setShowProducts(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/65"><X size={20} /></button></div>
          {products.length > 0 && <div className="mb-4 space-y-3">{products.map(product => {
            const label = PRODUCT_TYPES.find(([value]) => value === product.type)?.[1] || 'Product'
            const guidance = PRODUCT_GUIDANCE[product.type] || PRODUCT_GUIDANCE.other
            return <article key={product.id} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
              <span className="mt-0.5 rounded-xl p-2.5" style={{ color: GOLD, background: 'rgba(198,168,92,0.1)' }}>{product.time.toLowerCase().includes('morning') ? <Sun size={16} /> : <Moon size={16} />}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-heading text-base font-semibold text-primary">{product.name}</p><p className="mt-1 font-body text-xs text-white/65">{label}</p><p className="mt-2 font-body text-sm text-white/75">{product.time} · {productFrequencyLabel(product.frequency)}</p><p className="mt-1 font-body text-xs leading-relaxed text-white/65">{guidance.note}</p><p className="mt-1 font-body text-xs text-white/65">This week: {getProductDays(product, week).map(weekday => WEEKDAY_NAMES[weekday]).join(' · ')}</p></div>
              <button type="button" aria-label={`Remove ${product.name}`} onClick={() => removeProduct(product.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/65 transition-colors hover:text-white"><Trash2 size={18} /></button>
            </article>
          })}</div>}
          <form onSubmit={addProduct} className="space-y-4">
            <label className="block font-body text-sm text-white/65">Product name<input value={productName} onChange={event => setProductName(event.target.value)} maxLength={80} placeholder="Daily moisturizer" required className="product-name-input mt-1.5 min-h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 font-body text-base text-primary outline-none placeholder:text-white/65 focus:border-[#C6A85C]/55 focus-visible:outline-none focus-visible:ring-0" /></label>
            <RoutineSelect label="Product type" value={productType} onChange={handleProductTypeChange} options={PRODUCT_TYPES.map(([value, label]) => ({ value, label }))} />
            <div className="grid grid-cols-2 gap-2">
              <RoutineSelect label="Best time" value={productTime} onChange={setProductTime} options={['Morning', 'Night', 'Morning and night', 'Follow product label'].map(value => ({ value, label: value }))} />
              <RoutineSelect label="How often" value={productFrequency} onChange={setProductFrequency} options={[{ value: 1, label: '1 day / week' }, { value: 2, label: '2 days / week' }, ...[3, 4, 5, 6, 7].map(days => ({ value: days, label: days === 7 ? 'Every day' : `${days} days / week` }))]} />
            </div>
            <p className="rounded-xl bg-white/[0.035] p-3.5 font-body text-xs leading-relaxed text-white/65">{PRODUCT_GUIDANCE[productType].note} Suggestions are general; follow the product label and stop if it causes irritation</p>
            <button type="submit" disabled={!productName.trim()} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-heading text-base font-bold text-black transition-opacity disabled:opacity-45" style={{ background: GOLD }}><Plus size={16} /> Add to my routine</button>
          </form>
          </section>
        </div>, document.body)}
        {routineSection === 'body' && <section className="rounded-2xl border p-4 transition-shadow duration-300" style={{ borderColor: selectedPlanDayDone ? 'rgba(198,168,92,0.5)' : 'rgba(255,255,255,0.07)', background: selectedPlanDayDone ? 'rgba(198,168,92,0.08)' : 'rgba(255,255,255,0.025)', boxShadow: selectedPlanDayDone ? CHECKED_ROW_GLOW : 'none' }}>
                <div className="mb-3 flex items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'rgba(198,168,92,0.12)', color: GOLD }}><Dumbbell size={19} /></span><h3 className="flex-1 font-heading text-base font-semibold text-primary">{(todaysSession?.name || 'Recovery day').replace(/^Day\s*\d+\s*[·:—-]\s*/i, '')}</h3>{!selectedBodyWeekLocked && <span className="font-body text-sm" style={{ color: selectedPlanDayDone ? GOLD : 'rgba(255,255,255,0.5)' }}>{viewingCurrentDay ? (planDayDone ? activeMissionSteps.length : `${checkedPlanSteps}/${activeMissionSteps.length}`) : routineDayIsPast ? 'Past day' : null}</span>}</div>
                {activeMissionSteps.length > 0 && <div className="space-y-1.5">{activeMissionSteps.map((step, index) => {
                  const checked = Boolean(selectedPlanDayChecks[`${selectedPlanDay}-${index}`])
                  return <div key={`step-${index}`}><button type="button" disabled={selectedBodyWeekLocked || !viewingCurrentDay || planDayDone} onClick={() => togglePlanStep(index)} aria-pressed={checked} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all duration-200 active:scale-[0.99] disabled:cursor-default" style={{ borderColor: checked ? GOLD : 'rgba(255,255,255,0.08)', background: checked ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.035)', boxShadow: checked ? CHECKED_ROW_GLOW : 'none' }}>{selectedBodyWeekLocked || routineDayIsLocked ? <LockKeyhole className="h-4 w-4 shrink-0" style={{ color: GOLD }} aria-label="Locked" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: checked ? GOLD : 'rgba(255,255,255,0.25)', background: checked ? 'rgba(198,168,92,0.12)' : 'transparent', color: GOLD, filter: checked ? CHECKED_ICON_GLOW : 'none' }}>{checked && <Check size={12} strokeWidth={3} />}</span>}<span className="min-w-0 flex-1 font-body text-sm" style={{ color: checked ? GOLD : 'rgba(255,255,255,0.92)', textShadow: checked ? CHECKED_TEXT_GLOW : 'none' }}>{step.title}</span>{step.reps && <span className="shrink-0 rounded-full px-2.5 py-1.5 font-heading text-xs font-bold whitespace-nowrap" style={{ background: 'rgba(198,168,92,0.15)', color: GOLD }}>{step.reps}</span>}</button>{step.details && <ul aria-label="Home cardio examples" className="space-y-1 px-3 py-2.5 font-body text-xs leading-relaxed text-white/65">{step.details.map(example => <li key={example} className="flex gap-2"><span aria-hidden="true" style={{ color: GOLD }}>•</span><span>{example}</span></li>)}</ul>}</div>
                })}</div>}
        </section>}
        </div>
    </main>
  </MotionPage>
}
