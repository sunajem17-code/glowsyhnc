import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Check, Circle, Sun, Moon, Dumbbell, Footprints, BedDouble, Sparkles, ArrowRight, LockKeyhole, LoaderCircle, Plus, Trash2, ChevronDown, X, Pencil } from 'lucide-react'
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
  { id: 'morning', group: 'Morning', icon: Sun, title: 'Morning routine', steps: ['Rinse or use a gentle cleanser.', 'Apply moisturizer.', 'Apply sunscreen SPF 30 or higher.'] },
  { id: 'walk', group: 'Daily', icon: Footprints, title: 'Get some movement', detail: 'Aim for a 20–30 minute walk or another comfortable activity. Break it into shorter walks if that fits your day better.' },
  { id: 'recovery', group: 'Daily', icon: BedDouble, title: 'Protect your recovery', detail: 'Keep a consistent wind-down and bedtime. Choose a sleep duration appropriate for your age and schedule.' },
  { id: 'evening', group: 'Evening', icon: Moon, title: 'Night routine', steps: ['Rinse or use a gentle cleanser.', 'Apply moisturizer.'] },
]

const PRODUCT_GUIDANCE = {
  cleanser: { time: 'Morning and night', frequency: 7, note: 'A gentle cleanser is commonly used daily; reduce use if your skin feels dry or irritated.' },
  moisturizer: { time: 'Morning and night', frequency: 7, note: 'Moisturizer is commonly used daily, after cleansing.' },
  sunscreen: { time: 'Morning', frequency: 7, note: 'Use in the morning and reapply as directed on the label when outdoors.' },
  vitamin_c: { time: 'Morning', frequency: 3, note: 'Start slowly and increase only if your skin tolerates it and the product label allows.' },
  retinoid: { time: 'Night', frequency: 2, note: 'Start slowly on dry skin; increase only if tolerated and the product label allows.' },
  exfoliant: { time: 'Night', frequency: 1, note: 'Start slowly and follow the product label; avoid pairing with a retinoid on the same night until tolerated.' },
  other: { time: 'Follow product label', frequency: 3, note: 'Check the product label for use instructions; adjust this suggested schedule to match it.' },
}

const PRODUCT_TYPES = [
  ['cleanser', 'Cleanser'], ['moisturizer', 'Moisturizer'], ['sunscreen', 'Sunscreen'],
  ['vitamin_c', 'Vitamin C serum'], ['retinoid', 'Retinoid / retinol'], ['exfoliant', 'Exfoliant (AHA/BHA)'], ['other', 'Other'],
]

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

function getFacePlanWeekNumber(currentWeek, startWeek) {
  const current = new Date(`${currentWeek}T12:00:00`)
  const start = new Date(`${startWeek}T12:00:00`)
  const elapsedWeeks = Math.floor(Math.round((current - start) / (24 * 60 * 60 * 1000)) / 7)
  return Math.min(12, Math.max(1, elapsedWeeks + 1))
}

function loadGymPreferences(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (typeof saved?.gymAccess !== 'boolean') return null
    const daysPerWeek = Number(saved.daysPerWeek)
    return { gymAccess: saved.gymAccess, daysPerWeek: saved.gymAccess && Number.isInteger(daysPerWeek) && daysPerWeek >= 1 && daysPerWeek <= 7 ? daysPerWeek : null }
  } catch {
    return null
  }
}

function loadFacePlan(key, currentWeek) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (typeof saved?.startWeek === 'string') return saved
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
      <span className="truncate">{selected?.label ?? value}</span><ChevronDown size={18} className={`shrink-0 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && menuPosition && createPortal(<div ref={listRef} role="listbox" aria-label={label} className="fixed z-[120] overflow-y-auto rounded-xl border border-white/10 bg-[#171717] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)]" style={menuPosition}>
      {options.map(option => <button key={String(option.value)} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false) }} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left font-body text-base font-medium transition-colors hover:bg-white/[0.06]" style={{ color: option.value === value ? GOLD : 'rgba(255,255,255,0.78)', background: option.value === value ? 'rgba(198,168,92,0.1)' : 'transparent' }}>
        <span>{option.label}</span>{option.value === value && <Check size={17} />}
      </button>)}
    </div>, document.body)}
  </div>
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
  const [routineSection, setRoutineSection] = useState('face')
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
  const todayWeekday = (new Date(`${day}T12:00:00`).getDay() + 6) % 7
  const progressKey = bothScansReady ? `ascendus-glow-routine-${faceScan.id}-${bodyScan.id}` : 'ascendus-glow-routine-pending'
  const gymPreferencesKey = userId ? `ascendus-body-routine-preferences-${userId}` : `${progressKey}-body-routine-preferences-v1`
  const [gymPreferences, setGymPreferences] = useState(() => loadGymPreferences(gymPreferencesKey))
  const [showGymQuestionnaire, setShowGymQuestionnaire] = useState(false)
  const [gymAccess, setGymAccess] = useState(null)
  const [gymDaysPerWeek, setGymDaysPerWeek] = useState(3)
  const [progress, setProgress] = useState(() => loadProgress(progressKey, day, week))
  const productsKey = userId ? `ascendus-glow-face-products-${userId}` : `${progressKey}-face-products-v1`
  const legacyProductsKey = `${progressKey}-face-products-v1`
  const facePlanKey = `${productsKey}-12-week-plan-v1`
  const faceRoutineChecksKey = `${productsKey}-daily-checks-v1`
  const [faceRoutineChecks, setFaceRoutineChecks] = useState(() => loadFaceRoutineChecks(faceRoutineChecksKey, day, progress.daily))
  const [facePlan, setFacePlan] = useState(() => loadFacePlan(facePlanKey, week))
  const activeFaceWeek = getFacePlanWeekNumber(week, facePlan.startWeek)
  const selectedFaceWeekday = todayWeekday
  const selectedFaceWeekKey = week
  const selectedFaceDate = getDateForWeekday(selectedFaceWeekKey, selectedFaceWeekday)
  const [products, setProducts] = useState(() => loadProducts(productsKey, legacyProductsKey))
  const [productName, setProductName] = useState('')
  const [showProducts, setShowProducts] = useState(false)
  const [productType, setProductType] = useState('cleanser')
  const [productTime, setProductTime] = useState(PRODUCT_GUIDANCE.cleanser.time)
  const [productFrequency, setProductFrequency] = useState(PRODUCT_GUIDANCE.cleanser.frequency)
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
    setGymPreferences(loadGymPreferences(gymPreferencesKey))
    setShowGymQuestionnaire(false)
  }, [gymPreferencesKey])

  useEffect(() => {
    setProducts(loadProducts(productsKey, legacyProductsKey))
    setFacePlan(loadFacePlan(facePlanKey, week))
    setFaceRoutineChecks(loadFaceRoutineChecks(faceRoutineChecksKey, day, progress.daily))
  }, [productsKey, legacyProductsKey, facePlanKey, faceRoutineChecksKey, week, day, progress.daily])

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
    if (!showGymQuestionnaire) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [showGymQuestionnaire])

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
  const sectionSteps = DAILY_STEPS
    .filter(step => routineSection === 'face' ? ['morning', 'evening'].includes(step.id) : ['walk', 'recovery'].includes(step.id))
    .map(step => {
      if (!['morning', 'evening'].includes(step.id)) return step
      const period = step.id === 'morning' ? 'Morning' : 'Night'
      const scheduledProducts = products.filter(product => {
        const timeMatches = product.time === period || product.time === 'Morning and night' || (product.time === 'Follow product label' && step.id === 'morning')
        return timeMatches && getProductDays(product, selectedFaceWeekKey).includes(selectedFaceWeekday)
      })
      if (!scheduledProducts.length) return step
      const steps = [...step.steps, ...scheduledProducts.map(product => product.time === 'Follow product label' ? `Check the label for when to use ${product.name}.` : `Apply ${product.name}.`)]
      const stepKeys = [...step.steps.map((_, index) => `${step.id}-${index}`), ...scheduledProducts.map(product => `product-${product.id}`)]
      return { ...step, steps, stepKeys }
    })
  const completedToday = sectionSteps.filter(step => step.steps ? step.steps.every((_, index) => isRoutineStepChecked(step, index)) : progress.daily[step.id]).length
  const activeWeekNumber = Math.ceil(planProgress.activeDay / 7)
  const [selectedPlanDay, setSelectedPlanDay] = useState(planProgress.activeDay)
  useEffect(() => {
    setSelectedPlanWeek(activeWeekNumber)
    setSelectedPlanDay(planProgress.activeDay)
  }, [planKey, activeWeekNumber, planProgress.activeDay])
  const activeWeek = plan?.weeks?.[activeWeekNumber - 1]
  const viewedWeek = plan?.weeks?.[selectedPlanWeek - 1]
  const viewingCurrentDay = selectedPlanDay === planProgress.activeDay
  const viewedWeekday = (selectedPlanDay - 1) % 7
  const currentPhase = activeWeekNumber <= 4 ? 'Foundation' : activeWeekNumber <= 8 ? 'Build' : activeWeekNumber <= 11 ? 'Progress' : 'Deload & review'
  const scheduledWorkoutIndexes = viewedWeek?.sessions?.length
    ? viewedWeek.sessions.map((_, index) => Math.round(index * 6 / viewedWeek.sessions.length))
    : []
  const todaysSessionIndex = scheduledWorkoutIndexes.indexOf(viewedWeekday)
  const todaysSession = todaysSessionIndex >= 0 ? viewedWeek.sessions[todaysSessionIndex] : null
  const faceActionRecommendations = recommendations.filter(item => /skin|cleanser|moistur|spf|sunscreen|groom|hair|photo|presentation/i.test(item.text))
  const todayFaceAction = faceActionRecommendations.length ? faceActionRecommendations[(planProgress.activeDay - 1) % faceActionRecommendations.length] : null
  const showCoachAdvicePreview = new URLSearchParams(window.location.search).get('coachAdvicePreview') === '1'
  const activeMissionSteps = [
    ...(todaysSession?.exercises?.map((exercise, index) => {
      const deload = activeWeekNumber === 4 || activeWeekNumber === 8 || activeWeekNumber === 12
      const progressionSet = (activeWeekNumber >= 5 && activeWeekNumber <= 7 && index < 2) || (activeWeekNumber >= 9 && activeWeekNumber <= 11 && index < 3)
      const sets = Math.max(1, Number(exercise.sets) - (deload ? 1 : 0) + (progressionSet ? 1 : 0))
      return { title: `${exercise.name} · ${sets} × ${exercise.reps}` }
    }) ?? [{ title: viewedWeekday === 6 ? 'Rest and recover' : 'Easy walk or gentle mobility' }]),
  ]
  const planDayDone = viewingCurrentDay && planProgress.completedDays.includes(planProgress.activeDay)
  const checkedPlanSteps = activeMissionSteps.filter((_, index) => planProgress.checked[`${planProgress.activeDay}-${index}`]).length

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

  async function saveGymRoutinePreferences() {
    if (gymAccess === null) return
    const preferences = { gymAccess, daysPerWeek: gymAccess ? gymDaysPerWeek : null }
    try { localStorage.setItem(gymPreferencesKey, JSON.stringify(preferences)) } catch { /* keep the routine usable for this session */ }
    setGymPreferences(preferences)
    if (plan) await generatePlan(preferences, { preserveProgress: true })
    setShowGymQuestionnaire(false)
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

  function toggleRoutineStep(step, index) {
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

  async function generatePlan(preferences = gymPreferences, { preserveProgress = false } = {}) {
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
      const weeklyPlan = await api.ai.workoutPlan({ physiqueScores, gender: userGender === 'female' ? 'female' : 'male', trainingLevel: 'beginner', gymAccess: preferences?.gymAccess, daysPerWeek: preferences?.daysPerWeek })
      const expectedSessions = preferences ? (preferences.gymAccess ? preferences.daysPerWeek : 3) : 2
      if (!Array.isArray(weeklyPlan?.days) || (preferences ? weeklyPlan.days.length !== expectedSessions : weeklyPlan.days.length < expectedSessions)) throw new Error('The AI workout plan was incomplete. Try again.')
      const savedPlan = {
        version: 1,
        split: weeklyPlan.split,
        trainingLevel: weeklyPlan.trainingLevel || 'beginner',
        startDate: day,
        weeks: Array.from({ length: 12 }, (_, index) => ({ week: index + 1, phase: index < 4 ? 'Foundation' : index < 8 ? 'Build' : index < 11 ? 'Progress' : 'Deload & review', sessions: weeklyPlan.days })),
        gymAccess: preferences?.gymAccess ?? null,
        daysPerWeek: preferences?.daysPerWeek ?? null,
        faceFocus: focus.faceFocus?.label ?? 'Daily basics',
        bodyFocus: focus.bodyFocus?.label ?? 'Balanced strength',
        recommendations: recommendations.map(({ text, kind, url }) => ({ text, kind, url })),
      }
      setPlan(savedPlan)
      const newProgress = preserveProgress
        ? { ...planProgress, today: day, checked: {} }
        : { completedDays: [], lastCompletedDate: null, activeDay: 1, today: day, checked: {} }
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
    if (!viewingCurrentDay || !activeWeek || planDayDone) return
    triggerHaptic()
    const checked = { ...planProgress.checked, [`${planProgress.activeDay}-${index}`]: !planProgress.checked[`${planProgress.activeDay}-${index}`] }
    const next = { ...planProgress, today: day, checked }
    setPlanProgress(next)
    try { localStorage.setItem(`${planKey}-progress`, JSON.stringify(next)) } catch { /* keep the session usable */ }
  }

  function completePlanDay() {
    if (!viewingCurrentDay || !activeWeek || planDayDone || checkedPlanSteps !== activeMissionSteps.length) return
    triggerHaptic()
    const next = { ...planProgress, completedDays: [...new Set([...planProgress.completedDays, planProgress.activeDay])], lastCompletedDate: day, today: day, checked: planProgress.checked }
    setPlanProgress(next)
    try { localStorage.setItem(`${planKey}-progress`, JSON.stringify(next)) } catch { /* keep the session usable */ }
  }

  return <MotionPage>
    <PageHeader title="Face and Body Routine" onBack={() => navigate('/extras')} />
    <main className="space-y-3 px-4 pb-28 pt-3">
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
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#111] p-1.5" role="tablist" aria-label="Routine sections">
          {['face', 'body'].map(section => <button key={section} type="button" role="tab" id={`routine-tab-${section}`} aria-selected={routineSection === section} aria-controls={`routine-panel-${section}`} onClick={() => { triggerHaptic(); setRoutineSection(section); if (section === 'body' && !gymPreferences) { setGymAccess(null); setGymDaysPerWeek(3); setShowGymQuestionnaire(true) } }} className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-2xl font-heading text-lg font-semibold" style={{ background: routineSection === section ? 'rgba(198,168,92,0.14)' : 'transparent', color: routineSection === section ? GOLD : 'rgba(255,255,255,0.55)' }}>{section === 'face' ? <Sparkles size={20} /> : <Dumbbell size={20} />}{section === 'face' ? 'Face Routine' : 'Body Routine'}</button>)}
        </div>
        {showGymQuestionnaire && createPortal(<div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-black/70 p-3">
          <section role="dialog" aria-modal="true" aria-labelledby="gym-setup-title" className="my-auto max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#111] p-5 shadow-2xl">
            <div className="mb-5 flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color: GOLD, background: 'rgba(198,168,92,0.12)' }}><Dumbbell size={20} /></span><div><h2 id="gym-setup-title" className="font-heading text-lg font-bold text-primary">Set up your body routine</h2><p className="mt-1 font-body text-sm leading-relaxed text-white/55">A couple quick answers will help shape your training plan.</p></div></div>
            <p className="font-heading text-sm font-semibold text-primary">Do you have access to a gym?</p>
            <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Gym access">
              {[{ value: true, label: 'Yes' }, { value: false, label: 'No' }].map(option => <button key={String(option.value)} type="button" aria-pressed={gymAccess === option.value} onClick={() => setGymAccess(option.value)} className="min-h-12 rounded-xl border font-heading text-sm font-semibold transition-colors" style={{ borderColor: gymAccess === option.value ? GOLD : 'rgba(255,255,255,0.1)', color: gymAccess === option.value ? GOLD : 'rgba(255,255,255,0.7)', background: gymAccess === option.value ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.025)' }}>{option.label}</button>)}
            </div>
            {gymAccess === true && <div className="mt-5">
              <p className="font-heading text-sm font-semibold text-primary">How many days a week can you go to the gym?</p>
              <div className="mt-2 grid grid-cols-7 gap-1.5" role="group" aria-label="Gym days per week">
                {Array.from({ length: 7 }, (_, index) => index + 1).map(days => <button key={days} type="button" aria-pressed={gymDaysPerWeek === days} onClick={() => setGymDaysPerWeek(days)} className="min-h-11 rounded-lg border font-heading text-sm font-semibold" style={{ borderColor: gymDaysPerWeek === days ? GOLD : 'rgba(255,255,255,0.1)', color: gymDaysPerWeek === days ? GOLD : 'rgba(255,255,255,0.65)', background: gymDaysPerWeek === days ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.025)' }}>{days}</button>)}
              </div>
              <p className="mt-1.5 font-body text-xs text-white/45">Days per week</p>
            </div>}
            {gymAccess === false && <p className="mt-4 rounded-xl bg-white/[0.035] p-3 font-body text-sm leading-relaxed text-white/60">We’ll shape your plan for home workouts with little or no equipment.</p>}
            <button type="button" disabled={gymAccess === null || planLoading} onClick={saveGymRoutinePreferences} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-heading text-sm font-bold text-black transition-opacity disabled:opacity-40" style={{ background: GOLD }}>{planLoading && <LoaderCircle size={16} className="animate-spin" />}{planLoading ? 'Updating your plan…' : plan ? 'Save and update plan' : 'Save and continue'}</button>
          </section>
        </div>, document.body)}
        <div role="tabpanel" id={`routine-panel-${routineSection}`} aria-labelledby={`routine-tab-${routineSection}`} className="space-y-3">
        {routineSection === 'face' && <section className="rounded-2xl border border-white/10 bg-[#111] p-5">
          <div className="mb-4">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>12-week face plan</p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1"><h2 className="font-heading text-lg font-bold text-primary">Week {activeFaceWeek} of 12 - {WEEKDAY_NAMES[todayWeekday]}</h2><span className="font-body text-sm text-white/55">{activeFaceWeek <= 2 ? 'Foundation' : activeFaceWeek <= 4 ? 'Build habits' : activeFaceWeek <= 8 ? 'Stay consistent' : 'Maintain'}</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${activeFaceWeek / 12 * 100}%`, background: GOLD }} /></div>
            <p className="mt-3 font-body text-sm leading-relaxed text-white/55">Keep your daily basics steady. Your added products appear on their scheduled days.</p>
          </div>
        </section>}
        {routineSection === 'face' && <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div className="">
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-3 gap-y-0.5">
            <h2 className="col-start-1 row-start-1 font-heading text-lg font-bold text-primary">Face Routine</h2>
            <button type="button" onClick={() => { triggerHaptic(); setShowProducts(true) }} className="col-start-2 row-start-1 min-h-9 rounded-lg border border-white/10 px-3 font-heading text-sm font-semibold leading-5 transition-colors hover:border-[#C6A85C]/50" style={{ color: GOLD }}>Edit</button>
            <p className="col-start-1 row-start-2 font-body text-sm text-white/65">{completedToday} of {sectionSteps.length} routines checked off today</p>
            <span className="col-start-2 row-start-2 text-right font-heading text-sm font-bold leading-5" style={{ color: GOLD }}>{Math.round(completedToday / sectionSteps.length * 100)}%</span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${completedToday / sectionSteps.length * 100}%`, background: GOLD }} /></div>
          <div className="space-y-3">
            {sectionSteps.map(step => {
              const Icon = step.icon
              const checked = step.steps ? step.steps.every((_, index) => isRoutineStepChecked(step, index)) : Boolean(progress.daily[step.id])
              if (step.steps) {
                const completedSteps = step.steps.filter((_, index) => isRoutineStepChecked(step, index)).length
                return <section key={step.id} aria-label={step.title} className="rounded-2xl border p-4" style={{ borderColor: checked ? 'rgba(198,168,92,0.35)' : 'rgba(255,255,255,0.07)', background: checked ? 'rgba(198,168,92,0.07)' : 'rgba(255,255,255,0.025)' }}>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon size={20} style={{ color: GOLD }} />
                    <h3 className="flex-1 font-heading text-base font-semibold text-primary">{step.title}</h3>
                    <span aria-live="polite" className="font-body text-sm" style={{ color: checked ? GOLD : 'rgba(255,255,255,0.5)' }}>{checked ? 'Done' : `${completedSteps}/${step.steps.length}`}</span>
                  </div>
                  <div className="space-y-2">{step.steps.map((instruction, index) => {
                    const itemChecked = isRoutineStepChecked(step, index)
                    return <button key={step.stepKeys?.[index] ?? instruction} type="button" aria-pressed={itemChecked} onClick={() => toggleRoutineStep(step, index)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors" style={{ background: itemChecked ? 'rgba(198,168,92,0.1)' : 'rgba(255,255,255,0.035)' }}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: itemChecked ? GOLD : 'rgba(255,255,255,0.25)', background: itemChecked ? GOLD : 'transparent', color: '#090909' }}>{itemChecked && <Check size={13} />}</span>
                      <span className={`font-body text-sm leading-relaxed ${itemChecked ? 'text-white/45 line-through' : 'text-white/80'}`}>{instruction}</span>
                    </button>
                  })}</div>
                </section>
              }
              return <button key={step.id} type="button" onClick={() => toggleStep(step.id)} aria-pressed={checked} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors" style={{ borderColor: checked ? 'rgba(198,168,92,0.35)' : 'rgba(255,255,255,0.07)', background: checked ? 'rgba(198,168,92,0.07)' : 'rgba(255,255,255,0.025)' }}>
                <span className="mt-0.5" style={{ color: checked ? GOLD : 'rgba(255,255,255,0.42)' }}>{checked ? <Check size={18} /> : <Icon size={18} />}</span>
                <span className="min-w-0 flex-1"><span className="block font-heading text-sm font-semibold text-primary">{step.title}</span><span className="mt-2 block font-body text-xs leading-relaxed text-white/65">{step.steps ? <span role="list" className="block space-y-1.5">{step.steps.map((instruction, index) => <span role="listitem" key={instruction} className="flex gap-2"><span aria-hidden="true" className="shrink-0" style={{ color: GOLD }}>{index + 1}.</span><span>{instruction}</span></span>)}</span> : step.detail}</span></span>
              </button>
            })}
          </div>
          </div>
        </section>}
        {routineSection === 'face' && showCoachAdvicePreview && <section className="rounded-2xl border p-4" style={{ borderColor: 'rgba(198,168,92,0.2)', background: 'linear-gradient(145deg, rgba(198,168,92,0.08), rgba(255,255,255,0.025))' }}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: GOLD, background: 'rgba(198,168,92,0.13)' }}><Sparkles size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-sm font-bold text-primary">Coach tip · Tonight</h3><span className="rounded-full px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide" style={{ color: GOLD, background: 'rgba(198,168,92,0.12)' }}>Example</span></div>
              <p className="mt-2 font-body text-sm leading-relaxed text-white/70">Keep tonight’s routine simple: cleanse gently, then moisturize. Use added products according to the schedule in My Products.</p>
              <button type="button" onClick={() => { triggerHaptic(); navigate('/coach', { state: { coachPrompt: 'Can you explain this routine suggestion and help me adapt it to my products?' } }) }} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 font-heading text-xs font-semibold" style={{ color: GOLD }}>Ask a follow-up <ArrowRight size={14} /></button>
            </div>
          </div>
        </section>}
        {routineSection === 'face' && showProducts && createPortal(<div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/70 p-3" onClick={event => { if (event.target === event.currentTarget) setShowProducts(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="my-products-title" className="max-h-[85dvh] w-[min(82vw,24rem)] max-w-full overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#111] p-4 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="my-products-title" className="font-heading text-lg font-bold text-primary">My products</h2><p className="mt-1 font-body text-sm leading-relaxed text-white/55">Add what you already use to see a suggested time and weekly schedule.</p></div><button type="button" aria-label="Close my products" onClick={() => setShowProducts(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/65"><X size={20} /></button></div>
          {products.length > 0 && <div className="mb-4 space-y-3">{products.map(product => {
            const label = PRODUCT_TYPES.find(([value]) => value === product.type)?.[1] || 'Product'
            const guidance = PRODUCT_GUIDANCE[product.type] || PRODUCT_GUIDANCE.other
            return <article key={product.id} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
              <span className="mt-0.5 rounded-xl p-2.5" style={{ color: GOLD, background: 'rgba(198,168,92,0.1)' }}>{product.time.toLowerCase().includes('morning') ? <Sun size={16} /> : <Moon size={16} />}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-heading text-base font-semibold text-primary">{product.name}</p><p className="mt-1 font-body text-xs text-white/45">{label}</p><p className="mt-2 font-body text-sm text-white/75">{product.time} · {productFrequencyLabel(product.frequency)}</p><p className="mt-1 font-body text-xs leading-relaxed text-white/45">{guidance.note}</p><p className="mt-1 font-body text-xs text-white/45">This week: {getProductDays(product, week).map(weekday => WEEKDAY_NAMES[weekday]).join(' · ')}</p></div>
              <button type="button" aria-label={`Remove ${product.name}`} onClick={() => removeProduct(product.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/45 transition-colors hover:text-white"><Trash2 size={18} /></button>
            </article>
          })}</div>}
          <form onSubmit={addProduct} className="space-y-4">
            <label className="block font-body text-sm text-white/65">Product name<input value={productName} onChange={event => setProductName(event.target.value)} maxLength={80} placeholder="e.g. Daily moisturizer" required className="product-name-input mt-1.5 min-h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 font-body text-base text-primary outline-none placeholder:text-white/30 focus:border-[#C6A85C]/55 focus-visible:outline-none focus-visible:ring-0" /></label>
            <RoutineSelect label="Product type" value={productType} onChange={handleProductTypeChange} options={PRODUCT_TYPES.map(([value, label]) => ({ value, label }))} />
            <div className="grid grid-cols-2 gap-2">
              <RoutineSelect label="Best time" value={productTime} onChange={setProductTime} options={['Morning', 'Night', 'Morning and night', 'Follow product label'].map(value => ({ value, label: value }))} />
              <RoutineSelect label="How often" value={productFrequency} onChange={setProductFrequency} options={[{ value: 1, label: '1 day / week' }, { value: 2, label: '2 days / week' }, ...[3, 4, 5, 6, 7].map(days => ({ value: days, label: days === 7 ? 'Every day' : `${days} days / week` }))]} />
            </div>
            <p className="rounded-xl bg-white/[0.035] p-3.5 font-body text-xs leading-relaxed text-white/55">{PRODUCT_GUIDANCE[productType].note} Suggestions are general; follow the product label and stop if it causes irritation.</p>
            <button type="submit" disabled={!productName.trim()} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-heading text-base font-bold text-black transition-opacity disabled:opacity-45" style={{ background: GOLD }}><Plus size={16} /> Add to my routine</button>
          </form>
          </section>
        </div>, document.body)}
        {routineSection === 'face' && todayFaceAction && <section className="rounded-2xl border border-white/10 bg-[#111] p-4"><h3 className="font-heading text-sm font-semibold" style={{ color: GOLD }}>From your scan</h3><p className="mt-2 font-body text-sm leading-relaxed text-white/65">{todayFaceAction.text}</p></section>}
        {routineSection === 'body' && <>
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className="rounded-xl p-2.5" style={{ color: GOLD, background: 'rgba(198,168,92,0.1)' }}><Dumbbell size={18} /></span><div className="min-w-0"><h2 className="font-heading text-base font-bold text-primary">Body Routine</h2><p className="font-body text-xs text-white/50">Your 12-week training plan</p></div></div><div className="flex shrink-0 items-center gap-2">{gymPreferences && <button type="button" onClick={() => { setGymAccess(gymPreferences.gymAccess); setGymDaysPerWeek(gymPreferences.daysPerWeek ?? 3); setShowGymQuestionnaire(true) }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 font-heading text-xs font-semibold text-white/65 transition-colors hover:border-[#C6A85C]/50 hover:text-[#C6A85C]" aria-label="Edit gym access and weekly schedule"><Pencil size={13} /> Edit schedule</button>}{plan && <span className="font-body text-xs font-semibold" style={{ color: GOLD }}>{planProgress.completedDays.length}/84</span>}</div></div>
            {!plan && <div className="rounded-xl bg-white/[0.035] p-3"><p className="font-body text-sm leading-relaxed text-white/65">A simple plan shaped around your scan results.</p>
              <button type="button" disabled={planLoading} onClick={generatePlan} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-heading text-sm font-bold text-black transition-transform active:scale-[0.98] disabled:opacity-65" style={{ background: GOLD }}>{planLoading ? <><LoaderCircle size={17} className="animate-spin" /> Building your plan…</> : <><Sparkles size={16} /> Create my routine <ArrowRight size={15} /></>}</button>
              {planError && <p role="alert" className="mt-3 font-body text-xs text-red-300">{planError}</p>}
            </div>}
            {plan && <>
              <div className="mb-2 flex items-center justify-between gap-3"><p className="truncate font-heading text-sm font-semibold text-primary">{plan.split || 'Your personal split'}</p><p className="shrink-0 font-body text-[11px] text-white/50">{planProgress.completedDays.length}/84 days</p></div>
              <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-all" style={{ width: `${planProgress.completedDays.length / 84 * 100}%`, background: GOLD }} /></div>
              <details className="group mb-3 rounded-xl border border-white/[0.07] bg-white/[0.025]">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2"><span className="font-body text-xs text-white/65">Week {selectedPlanWeek} <span className="text-white/35">·</span> {viewedWeek?.phase || currentPhase}</span><span className="font-heading text-[11px] font-semibold" style={{ color: GOLD }}>Choose week <ArrowRight size={12} className="ml-1 inline rotate-90" /></span></summary>
                <div className="flex gap-1.5 overflow-x-auto px-3 pb-3" aria-label="Choose a plan week">
                {plan.weeks.map((item, index) => {
                  const number = index + 1
                  const complete = planProgress.completedDays.length >= number * 7
                  const current = number === selectedPlanWeek
                  return <button key={`path-${number}`} type="button" aria-pressed={current} onClick={() => { setSelectedPlanWeek(number); setSelectedPlanDay((number - 1) * 7 + 1) }} className="flex h-9 min-w-10 items-center justify-center gap-1 rounded-full border px-3 font-heading text-xs font-bold transition-colors" style={{ borderColor: current ? GOLD : 'rgba(255,255,255,0.1)', color: complete && !current ? '#090909' : current ? GOLD : 'rgba(255,255,255,0.65)', background: complete && !current ? GOLD : current ? 'rgba(198,168,92,0.12)' : '#171717' }} aria-label={`Week ${number}`}>{complete && <Check size={12} />}<span>{number}</span></button>
                })}
                </div>
              </details>
              <div className="mb-3">
                <p className="mb-2 font-body text-xs font-medium text-white/55">Choose a day in Week {selectedPlanWeek}</p>
                <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={`Choose a day in week ${selectedPlanWeek}`}>
                  {Array.from({ length: 7 }, (_, index) => {
                    const planDay = (selectedPlanWeek - 1) * 7 + index + 1
                    const selected = planDay === selectedPlanDay
                    const isCurrent = planDay === planProgress.activeDay
                    return <button key={`plan-day-${planDay}`} type="button" aria-pressed={selected} aria-label={`Week ${selectedPlanWeek}, day ${index + 1}${isCurrent ? ', current day' : ''}`} onClick={() => setSelectedPlanDay(planDay)} className="min-h-10 rounded-lg border font-heading text-xs font-semibold transition-colors" style={{ borderColor: selected ? GOLD : 'rgba(255,255,255,0.08)', color: selected ? GOLD : 'rgba(255,255,255,0.65)', background: selected ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.025)' }}>{index + 1}</button>
                  })}
                </div>
              </div>
              <div className="rounded-xl bg-white/[0.035] p-3">
                <div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-body text-[10px] font-semibold uppercase tracking-wider" style={{ color: GOLD }}>{viewingCurrentDay ? `TODAY · DAY ${planProgress.activeDay}` : `WEEK ${selectedPlanWeek} · DAY ${viewedWeekday + 1} · ${viewedWeek?.phase || currentPhase}`}</p><h3 className="mt-1 font-heading text-base font-bold text-primary">{todaysSession?.name || (viewedWeekday === 6 ? 'Rest & recover' : 'Recovery day')}</h3></div><span className="shrink-0 rounded-full bg-white/[0.07] px-2.5 py-1 font-body text-[10px] text-white/60">{viewingCurrentDay ? (planDayDone ? activeMissionSteps.length : checkedPlanSteps) : 'Preview'}</span></div>
                {!planDayDone && activeMissionSteps.length > 0 && <div className="space-y-1.5">{activeMissionSteps.map((step, index) => {
                  const checked = viewingCurrentDay && Boolean(planProgress.checked[`${planProgress.activeDay}-${index}`])
                  return <button key={`step-${index}`} type="button" disabled={!viewingCurrentDay || planDayDone} onClick={() => togglePlanStep(index)} aria-pressed={checked} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors disabled:cursor-default disabled:opacity-75" style={{ background: checked ? 'rgba(198,168,92,0.08)' : 'rgba(255,255,255,0.025)' }}><span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border" style={{ borderColor: checked ? GOLD : 'rgba(255,255,255,0.22)', background: checked ? GOLD : 'transparent', color: '#090909' }}>{checked && <Check size={12} />}</span><span className="min-w-0 font-body text-[13px] text-primary">{step.title}</span></button>
                })}</div>}
                {planDayDone ? <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[rgba(198,168,92,0.08)] p-3 font-heading text-sm font-semibold text-primary"><Check size={16} style={{ color: GOLD }} /> {planProgress.completedDays.length >= 84 ? '12 weeks complete!' : 'Today complete · next day opens tomorrow'}</div> : viewingCurrentDay && <button type="button" onClick={completePlanDay} disabled={!activeWeek || checkedPlanSteps !== activeMissionSteps.length} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-heading text-sm font-bold transition-colors disabled:cursor-not-allowed" style={{ background: checkedPlanSteps === activeMissionSteps.length ? GOLD : '#292929', color: checkedPlanSteps === activeMissionSteps.length ? '#090909' : 'rgba(255,255,255,0.48)' }}>Complete today <ArrowRight size={16} /></button>}
              </div>
              {planError && <p role="alert" className="mt-3 font-body text-xs text-red-300">{planError}</p>}
            </>}
          </div>
        </section>

        </>}
        </div>

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


      </>}
    </main>
  </MotionPage>
}
