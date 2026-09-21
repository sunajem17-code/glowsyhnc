import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, ChevronLeft, Flame, Droplets, Dumbbell, Moon, Sun, Heart, Sparkles, Frown, Meh, SmilePlus, Smile, Laugh } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { scheduleStreakReminder } from '../utils/notifications'
import { GOLD, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const WATER_GOAL = 8

// This whole screen is a fixed-dark surface — same deliberate exception
// PremiumOnboarding.jsx and HairMaxx.jsx make — so every color below is a
// literal, not a text-primary/text-secondary/var(--card) theme token. Those
// tokens flip to their LIGHT-mode values whenever the app's theme setting
// is light, which would put near-black text on this black background and
// make it disappear. That mismatch is what was reading as "gray."
const PAGE_BG  = '#0A0A0A'
const TEXT     = 'rgba(255,255,255,0.92)'
const TEXT_DIM = 'rgba(255,255,255,0.5)'
// Same glow recipe as PremiumOnboarding's stat-number text; GOLD_ICON_GLOW
// is the same idea but subtler, applied via `filter: drop-shadow(...)`
// since a text-shadow doesn't do anything on an SVG icon glyph.
const GOLD_GLOW = '0 0 18px rgba(198,168,92,0.7), 0 0 40px rgba(198,168,92,0.35)'
const GOLD_ICON_GLOW = 'drop-shadow(0 0 5px rgba(198,168,92,0.5))'

// Flat black card, no gradient/shine/box-glow — ported verbatim from
// PremiumOnboarding.jsx's StepWhyAppearance stat cards.
function GlossyCard({ children, className = '' }) {
  return (
    <div className={`rounded-2xl p-4 ${className}`} style={{ background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.07)' }}>
      {children}
    </div>
  )
}

// Fires once when the last of the 5 habits gets checked off — a gold flame
// scales in with a particle burst radiating from it (same radiating-dots
// technique as UnlockRevealSlideshow's ParticleBurst), then the caller
// auto-submits into the existing success screen a beat later so completing
// the day feels like an event, not just another checkbox.
function FlameBurst() {
  const PARTICLES = 14
  const angles = Array.from({ length: PARTICLES }, (_, i) => (i / PARTICLES) * 360)
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 80 }}>
      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const dist = 70 + Math.random() * 50
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: Math.cos(rad) * dist, y: Math.sin(rad) * dist, scale: 0.2 }}
            transition={{ duration: 0.7 + Math.random() * 0.3, ease: [0.2, 0, 0.8, 1] }}
            style={{ position: 'absolute', width: 5, height: 5, borderRadius: 3, background: GOLD, filter: GOLD_ICON_GLOW }}
          />
        )
      })}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: [0.4, 1.3, 1] }}
        transition={{ duration: 0.5, ease: EASE_STANDARD }}
      >
        <Flame size={72} style={{ color: GOLD, filter: 'drop-shadow(0 0 24px rgba(198,168,92,0.8))' }} fill={GOLD} />
      </motion.div>
    </div>
  )
}

function ToggleButton({ checked, onToggle, label, icon: Icon }) {
  return (
    <button
      onClick={() => { triggerHaptic(); onToggle() }}
      className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all duration-200"
      style={checked ? { borderColor: GOLD, background: `${GOLD}14` } : { borderColor: 'rgba(255,255,255,0.08)', background: '#161616' }}
    >
      <Icon size={22} style={{ color: checked ? GOLD : 'rgba(255,255,255,0.8)', filter: checked ? GOLD_ICON_GLOW : 'none' }} />
      <span className="text-xs font-heading font-bold" style={{ color: checked ? GOLD : TEXT, textShadow: checked ? GOLD_GLOW : 'none' }}>{label}</span>
    </button>
  )
}

export default function DailyCheckin() {
  const navigate = useNavigate()
  const todayCheckin  = useStore(s => s.todayCheckin)
  const streak        = useStore(s => s.streak)
  const token         = useStore(s => s.token)
  const addCheckin    = useStore(s => s.addCheckin)
  const updateStreak  = useStore(s => s.updateStreak)

  const today = new Date().toDateString()
  const alreadyDone = todayCheckin?.date === today

  const [water, setWater] = useState(todayCheckin?.waterGlasses ?? 0)
  const [skincareAm, setSkincareAm] = useState(todayCheckin?.skincareAm ?? false)
  const [skincarePm, setSkincarePm] = useState(todayCheckin?.skincarePm ?? false)
  const [exerciseDone, setExerciseDone] = useState(todayCheckin?.exercisesDone ?? false)
  const [mood, setMood] = useState(todayCheckin?.moodScore ?? 0)
  const [submitted, setSubmitted] = useState(alreadyDone)
  const [celebrating, setCelebrating] = useState(false)

  const completionScore = [
    water >= WATER_GOAL,
    skincareAm,
    skincarePm,
    exerciseDone,
    mood > 0,
  ].filter(Boolean).length

  // The moment all 5 habits are checked off, play the flame burst and then
  // auto-submit into the streak success screen a beat later — completing
  // the day should feel like it just happened, not wait on a extra tap.
  useEffect(() => {
    if (completionScore < 5 || submitted || celebrating) return
    triggerHaptic()
    setCelebrating(true)
    const timer = setTimeout(() => { handleSubmit() }, 1100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionScore, submitted, celebrating])

  function handleSubmit() {
    const checkin = {
      id: `checkin-${Date.now()}`,
      date: today,
      waterGlasses: water,
      skincareAm,
      skincarePm,
      exercisesDone: exerciseDone,
      moodScore: mood,
      completedAt: new Date().toISOString(),
    }
    addCheckin(checkin)

    // Update streak locally
    const lastDate = streak.lastDate
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const isConsecutive = lastDate === yesterday.toDateString()
    updateStreak({
      current: isConsecutive ? streak.current + 1 : 1,
      longest: Math.max(streak.longest, isConsecutive ? streak.current + 1 : 1),
      lastDate: today,
    })

    // Sync checkin to server (fire-and-forget — local state is source of truth for UI)
    if (token && token !== 'demo-token') {
      const API = (import.meta?.env?.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app')
      const base = `https://${API.replace(/^https?:\/\//, '')}/api`
      fetch(`${base}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          waterGlasses: water,
          skincareAm,
          skincarePm,
          exercisesDone: exerciseDone,
          moodScore: mood,
        }),
      }).catch(() => { /* offline — streak syncs on next login */ })
    }

    // Reschedule tomorrow's streak reminder (fire-and-forget)
    scheduleStreakReminder().catch(() => {})

    setSubmitted(true)
  }

  // Success is a self-contained celebration, not a data recap — no header,
  // no exit button, it just holds on the streak reveal and hands off to the
  // dashboard on its own once it's done playing.
  useEffect(() => {
    if (!submitted) return
    const timer = setTimeout(() => navigate('/'), 3200)
    return () => clearTimeout(timer)
  }, [submitted]) // eslint-disable-line react-hooks/exhaustive-deps

  if (submitted) {
    return (
      <MotionPage style={{ background: PAGE_BG }} className="flex flex-col items-center justify-center h-full text-center px-6 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.55, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE_STANDARD }}
          className="absolute pointer-events-none"
          style={{ width: 440, height: 440, borderRadius: '50%', background: 'radial-gradient(circle, rgba(198,168,92,0.3) 0%, transparent 70%)' }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.3, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 15, delay: 0.05 }}
          className="mb-6 relative"
        >
          <motion.div
            animate={{ scale: [1, 1.07, 1] }}
            transition={{ duration: 1.7, repeat: Infinity, ease: EASE_STANDARD, delay: 0.6 }}
          >
            <Flame size={128} style={{ color: GOLD, filter: 'drop-shadow(0 0 40px rgba(198,168,92,0.75))' }} fill={GOLD} />
          </motion.div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          className="font-heading font-bold text-[13px] tracking-[0.28em] uppercase mb-2 relative"
          style={{ color: GOLD, textShadow: GOLD_GLOW }}
        >
          Streak
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4, ease: EASE_STANDARD }}
          className="font-heading font-bold relative"
          style={{ fontSize: 84, lineHeight: 1, color: GOLD, textShadow: GOLD_GLOW, letterSpacing: '-0.03em' }}
        >
          Day {streak.current}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.35 }}
          className="font-body text-base mt-4 relative"
          style={{ color: TEXT_DIM }}
        >
          {completionScore === 5 ? 'Perfect day — every habit logged.' : `${completionScore}/5 habits logged today.`}
        </motion.p>
      </MotionPage>
    )
  }

  // Header ported from Scan.jsx's step header / HairMaxx's intro header:
  // same circular back button + gold eyebrow + big heading, instead of the
  // old generic PageHeader, so this screen reads as the same template.
  return (
    <MotionPage style={{ background: PAGE_BG }}>
      <div className="relative flex-shrink-0 px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)', paddingBottom: 16 }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="absolute left-4 w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.1)', top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        >
          <ChevronLeft size={18} style={{ color: 'rgba(255,255,255,0.8)' }} />
        </button>
        <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1 uppercase" style={{ color: GOLD, textShadow: GOLD_GLOW }}>Daily Check-In</p>
        <h1 className="font-heading font-bold text-[26px] leading-tight" style={{ letterSpacing: '-0.02em', color: TEXT }}>Small habits, real results</h1>
      </div>

      <div className="px-5">
          {/* Streak banner */}
          {streak.current > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4" style={{ background: 'rgba(198,168,92,.1)', border: '1px solid rgba(198,168,92,.3)' }}>
              <Flame size={20} style={{ color: GOLD, filter: GOLD_ICON_GLOW }} />
              <p className="text-sm font-heading font-bold" style={{ color: GOLD, textShadow: GOLD_GLOW }}>
                {streak.current}-day streak! Keep it going.
              </p>
            </div>
          )}

          {/* Water tracker */}
          <GlossyCard className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Droplets size={18} style={{ color: GOLD, filter: GOLD_ICON_GLOW }} />
              <h3 className="font-heading font-bold text-sm" style={{ color: TEXT }}>Hydration</h3>
              <span className="ml-auto font-mono font-bold" style={{ color: GOLD, textShadow: GOLD_GLOW }}>{water}/{WATER_GOAL}</span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              {Array.from({ length: WATER_GOAL }, (_, i) => (
                <button
                  key={i}
                  onClick={() => { triggerHaptic(); setWater(i < water ? i : i + 1) }}
                  className="flex flex-col items-center"
                >
                  <motion.div
                    animate={{ scale: i < water ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Droplets
                      size={24}
                      style={{ color: i < water ? GOLD : 'rgba(255,255,255,0.8)', filter: i < water ? GOLD_ICON_GLOW : 'none' }}
                      fill="none"
                    />
                  </motion.div>
                </button>
              ))}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: GOLD }}
                animate={{ width: `${(water / WATER_GOAL) * 100}%` }}
                transition={SPRING_STANDARD}
              />
            </div>
          </GlossyCard>

          {/* Skincare */}
          <GlossyCard className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} style={{ color: GOLD, filter: GOLD_ICON_GLOW }} />
              <h3 className="font-heading font-bold text-sm" style={{ color: TEXT }}>Skincare</h3>
            </div>
            <div className="flex gap-3">
              <ToggleButton
                checked={skincareAm}
                onToggle={() => setSkincareAm(v => !v)}
                label="AM Routine"
                icon={Sun}
              />
              <ToggleButton
                checked={skincarePm}
                onToggle={() => setSkincarePm(v => !v)}
                label="PM Routine"
                icon={Moon}
              />
            </div>
          </GlossyCard>

          {/* Exercise */}
          <GlossyCard className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell size={18} style={{ color: GOLD, filter: GOLD_ICON_GLOW }} />
              <h3 className="font-heading font-bold text-sm" style={{ color: TEXT }}>Exercise</h3>
            </div>
            <button
              onClick={() => { triggerHaptic(); setExerciseDone(v => !v) }}
              className="w-full flex items-center gap-3 py-3.5 px-4 rounded-xl border-2 transition-all"
              style={exerciseDone ? { borderColor: GOLD, background: `${GOLD}14` } : { borderColor: 'rgba(255,255,255,0.08)', background: '#161616' }}
            >
              {exerciseDone ? (
                <CheckCircle2 size={20} style={{ color: GOLD, filter: GOLD_ICON_GLOW }} />
              ) : (
                <Circle size={20} style={{ color: 'rgba(255,255,255,0.8)' }} />
              )}
              <span className="font-heading font-semibold text-sm" style={{ color: exerciseDone ? GOLD : TEXT, textShadow: exerciseDone ? GOLD_GLOW : 'none' }}>
                {exerciseDone ? <span className="flex items-center gap-1">Today's routine done! <Dumbbell size={14} style={{ color: GOLD, filter: GOLD_ICON_GLOW }} /></span> : "Mark today's routine complete"}
              </span>
            </button>
          </GlossyCard>

          {/* Mood — keeps its red-to-green scale (it's the one place color
              carries actual meaning: how you're feeling), everything else
              on this screen is gold. */}
          <GlossyCard className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={18} style={{ color: GOLD, filter: GOLD_ICON_GLOW }} />
              <h3 className="font-heading font-bold text-sm" style={{ color: TEXT }}>Confidence Level</h3>
            </div>
            <div className="flex gap-3 justify-center">
              {/* No box/border here — selection reads through the same
                  gold-vs-white language as the rest of the page (hydration,
                  toggles): the picked mood turns gold with a glow and scales
                  up, everything else stays plain white. */}
              {[
                { val: 1, Icon: Frown,    label: 'Low' },
                { val: 2, Icon: Meh,      label: 'Meh' },
                { val: 3, Icon: SmilePlus, label: 'OK' },
                { val: 4, Icon: Smile,    label: 'Good' },
                { val: 5, Icon: Laugh,    label: 'Great' },
              ].map(({ val, Icon, label }) => (
                <button
                  key={val}
                  onClick={() => { triggerHaptic(); setMood(val) }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <motion.div
                    animate={{ scale: mood === val ? 1.25 : 1 }}
                    transition={SPRING_STANDARD}
                  >
                    <Icon size={30} style={{ color: mood === val ? GOLD : '#FFFFFF', filter: mood === val ? GOLD_ICON_GLOW : 'none' }} />
                  </motion.div>
                  <span className="text-[10px] font-body" style={{ color: mood === val ? GOLD : 'rgba(255,255,255,0.75)', fontWeight: mood === val ? 600 : 400, textShadow: mood === val ? GOLD_GLOW : 'none' }}>{label}</span>
                </button>
              ))}
            </div>
          </GlossyCard>

          {/* Once all 5 are checked, the FlameBurst effect above takes over
              and auto-submits — no manual button needed at that point. */}
          {completionScore < 5 && (
            <button
              onClick={() => { triggerHaptic(); handleSubmit() }}
              disabled={completionScore === 0}
              className={`w-full py-4 rounded-2xl font-heading font-bold text-[15px] transition-opacity ${completionScore === 0 ? 'opacity-50' : ''}`}
              style={{ background: GOLD, color: '#080808' }}
            >
              Log Today's Check-In
            </button>
          )}
          <div style={{ height: 'max(48px, calc(env(safe-area-inset-bottom, 0px) + 32px))' }} />
      </div>

      <AnimatePresence>{celebrating && <FlameBurst key="flame-burst" />}</AnimatePresence>
    </MotionPage>
  )
}
