import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Flame, Droplets, Dumbbell, Moon, Sun, Heart } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'

const WATER_GOAL = 8

function ToggleButton({ checked, onToggle, label, icon: Icon, color }) {
  return (
    <button
      onClick={onToggle}
      className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all duration-200 ${
        checked ? 'border-[#C6A85C] bg-[#C6A85C]/8' : 'border-gray-200 dark:border-gray-700 bg-card'
      }`}
    >
      <Icon size={22} className={checked ? 'text-[#C6A85C]' : 'text-secondary'} />
      <span className={`text-xs font-heading font-bold ${checked ? 'text-[#C6A85C]' : 'text-secondary'}`}>{label}</span>
      {checked && <CheckCircle2 size={14} className="text-[#C6A85C]" />}
    </button>
  )
}

export default function DailyCheckin() {
  const navigate = useNavigate()
  const { addCheckin, todayCheckin, streak, updateStreak } = useStore()

  const today = new Date().toDateString()
  const alreadyDone = todayCheckin?.date === today

  const [water, setWater] = useState(todayCheckin?.waterGlasses ?? 0)
  const [skincareAm, setSkincareAm] = useState(todayCheckin?.skincareAm ?? false)
  const [skincarePm, setSkincarePm] = useState(todayCheckin?.skincarePm ?? false)
  const [exerciseDone, setExerciseDone] = useState(todayCheckin?.exercisesDone ?? false)
  const [mood, setMood] = useState(todayCheckin?.moodScore ?? 0)
  const [submitted, setSubmitted] = useState(alreadyDone)

  const completionScore = [
    water >= WATER_GOAL,
    skincareAm,
    skincarePm,
    exerciseDone,
    mood > 0,
  ].filter(Boolean).length

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

    // Update streak
    const lastDate = streak.lastDate
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const isConsecutive = lastDate === yesterday.toDateString()
    updateStreak({
      current: isConsecutive ? streak.current + 1 : 1,
      longest: Math.max(streak.longest, isConsecutive ? streak.current + 1 : 1),
      lastDate: today,
    })

    setSubmitted(true)
  }

  return (
    <MotionPage className="px-4">
      <PageHeader title="Daily Check-In" subtitle="30 seconds to stay on track" back />

      {submitted ? (
        // Success state
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6"
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-6xl mb-6"
          >
            {completionScore >= 4 ? '🔥' : completionScore >= 3 ? '💪' : '✅'}
          </motion.div>
          <h2 className="font-heading font-bold text-2xl text-primary mb-2">
            {completionScore >= 4 ? 'On fire!' : completionScore >= 3 ? 'Solid day!' : 'Check-in logged!'}
          </h2>
          <p className="text-secondary font-body text-base mb-2">
            {completionScore}/5 habits completed today.
          </p>
          <div className="flex items-center gap-2 mb-8">
            <Flame size={18} className="text-warning" />
            <p className="font-heading font-bold text-lg text-primary">{streak.current}-day streak!</p>
          </div>
          {/* Mini habit summary */}
          <div className="w-full card mb-6">
            {[
              { label: 'Hydration', value: `${water}/${WATER_GOAL} glasses`, done: water >= WATER_GOAL },
              { label: 'AM Skincare', value: skincareAm ? 'Done' : 'Skipped', done: skincareAm },
              { label: 'PM Skincare', value: skincarePm ? 'Done' : 'Skipped', done: skincarePm },
              { label: 'Exercise', value: exerciseDone ? 'Done' : 'Skipped', done: exerciseDone },
              { label: 'Mood', value: mood > 0 ? `${mood}/5` : 'Not rated', done: mood > 0 },
            ].map(({ label, value, done }) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-default last:border-0">
                <span className="text-sm font-body text-secondary">{label}</span>
                <span className={`text-sm font-heading font-bold ${done ? 'text-[#C6A85C]' : 'text-secondary'}`}>{value}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/')} className="btn-primary max-w-xs">Back to Dashboard</button>
        </motion.div>
      ) : (
        <div>
          {/* Streak banner */}
          {streak.current > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl mb-4 border border-orange-200 dark:border-orange-800">
              <span className="fire-icon">🔥</span>
              <p className="text-sm font-heading font-bold text-orange-600 dark:text-orange-400">
                {streak.current}-day streak! Keep it going.
              </p>
            </div>
          )}

          {/* Water tracker */}
          <div className="card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Droplets size={18} className="text-blue-400" />
              <h3 className="font-heading font-bold text-sm text-primary">Hydration</h3>
              <span className="ml-auto font-mono font-bold text-[#C6A85C]">{water}/{WATER_GOAL}</span>
            </div>
            <div className="grid grid-cols-8 gap-1.5 mb-2">
              {Array.from({ length: WATER_GOAL }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setWater(i < water ? i : i + 1)}
                  className="flex flex-col items-center"
                >
                  <motion.div
                    animate={{ scale: i < water ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Droplets
                      size={24}
                      className={i < water ? 'text-blue-400' : 'text-gray-200 dark:text-gray-700'}
                      fill={i < water ? '#60a5fa' : 'none'}
                    />
                  </motion.div>
                </button>
              ))}
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-400 rounded-full"
                animate={{ width: `${(water / WATER_GOAL) * 100}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </div>
          </div>

          {/* Skincare */}
          <div className="card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">✨</span>
              <h3 className="font-heading font-bold text-sm text-primary">Skincare</h3>
            </div>
            <div className="flex gap-3">
              <ToggleButton
                checked={skincareAm}
                onToggle={() => setSkincareAm(v => !v)}
                label="AM Routine"
                icon={Sun}
                color="amber"
              />
              <ToggleButton
                checked={skincarePm}
                onToggle={() => setSkincarePm(v => !v)}
                label="PM Routine"
                icon={Moon}
                color="teal"
              />
            </div>
          </div>

          {/* Exercise */}
          <div className="card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell size={18} className="text-[#C6A85C]" />
              <h3 className="font-heading font-bold text-sm text-primary">Exercise</h3>
            </div>
            <button
              onClick={() => setExerciseDone(v => !v)}
              className={`w-full flex items-center gap-3 py-3.5 px-4 rounded-xl border-2 transition-all ${
                exerciseDone ? 'border-[#C6A85C] bg-[#C6A85C]/8' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {exerciseDone ? (
                <CheckCircle2 size={20} className="text-[#C6A85C]" />
              ) : (
                <Circle size={20} className="text-gray-300" />
              )}
              <span className={`font-heading font-semibold text-sm ${exerciseDone ? 'text-[#C6A85C]' : 'text-secondary'}`}>
                {exerciseDone ? "Today's exercises done! 💪" : "Mark today's exercises complete"}
              </span>
            </button>
          </div>

          {/* Mood */}
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={18} className="text-warning" />
              <h3 className="font-heading font-bold text-sm text-primary">Confidence Level</h3>
            </div>
            <div className="flex gap-3 justify-center">
              {[
                { val: 1, emoji: '😞', label: 'Low' },
                { val: 2, emoji: '😕', label: 'Meh' },
                { val: 3, emoji: '😐', label: 'OK' },
                { val: 4, emoji: '🙂', label: 'Good' },
                { val: 5, emoji: '😄', label: 'Great' },
              ].map(({ val, emoji, label }) => (
                <button
                  key={val}
                  onClick={() => setMood(val)}
                  className="flex flex-col items-center gap-1"
                >
                  <motion.div
                    animate={{ scale: mood === val ? 1.3 : 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    className={`text-2xl ${mood === val ? '' : 'opacity-40'}`}
                  >
                    {emoji}
                  </motion.div>
                  <span className={`text-[9px] font-body ${mood === val ? 'text-primary font-semibold' : 'text-secondary'}`}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Completion indicator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < completionScore ? 'bg-[#C6A85C]' : 'bg-gray-200 dark:bg-gray-700'}`} />
              ))}
            </div>
            <p className="text-xs text-secondary font-body">{completionScore}/5 habits logged</p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={completionScore === 0}
            className={`btn-primary mb-8 ${completionScore === 0 ? 'opacity-50' : ''}`}
          >
            {completionScore === 5 ? '🔥 Perfect Day — Log Check-In!' : '✅ Log Today\'s Check-In'}
          </button>
        </div>
      )}
    </MotionPage>
  )
}
