import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Clock, Lock, Camera, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import { PHASE_META } from '../utils/phase'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_PHASES = {
  1: 'Foundation', 2: 'Foundation',
  3: 'Acceleration', 4: 'Acceleration',
  5: 'Push', 6: 'Push',
  7: 'Refinement', 8: 'Refinement',
  9: 'Peak', 10: 'Peak',
  11: 'Lock In', 12: 'Lock In',
}

const PHASE_COLORS = {
  Foundation:   { color: '#74B9FF', bg: 'rgba(116,185,255,0.12)' },
  Acceleration: { color: '#FDCB6E', bg: 'rgba(253,203,110,0.12)' },
  Push:         { color: '#E07A5F', bg: 'rgba(224,122,95,0.12)'  },
  Refinement:   { color: '#A29BFE', bg: 'rgba(162,155,254,0.12)' },
  Peak:         { color: '#FFD700', bg: 'rgba(255,215,0,0.12)'   },
  'Lock In':    { color: '#34C759', bg: 'rgba(52,199,89,0.12)'   },
}

const CATEGORY_CONFIG = {
  face:      { emoji: '🎯', label: 'Face',      color: '#A29BFE' },
  body:      { emoji: '💪', label: 'Body',      color: '#1A6B5C' },
  skin:      { emoji: '✨', label: 'Skin',      color: '#F5A623' },
  training:  { emoji: '🏋️', label: 'Training',  color: '#E07A5F' },
  nutrition: { emoji: '🥗', label: 'Nutrition', color: '#34C759' },
  grooming:  { emoji: '💈', label: 'Appeal',    color: '#2D9CDB' },
  posture:   { emoji: '📐', label: 'Posture',   color: '#1A6B5C' },
  style:     { emoji: '👔', label: 'Style',     color: '#9B8EA0' },
}

const TABS = ['All', 'Face', 'Body', 'Skin', 'Training', 'Nutrition', 'Appeal', 'Posture']

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onToggle, detailLocked, onUpgrade }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = CATEGORY_CONFIG[task.category] ?? CATEGORY_CONFIG.face
  const diffDots = [1, 2, 3].map(i => i <= task.difficulty)

  return (
    <motion.div layout className={`card mb-2.5 transition-all duration-300 ${task.completed ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => onToggle(task.id)} className="mt-0.5 flex-shrink-0">
          {task.completed
            ? <CheckCircle2 size={22} className="text-[#1A6B5C]" />
            : <Circle size={22} className="text-gray-300 dark:text-gray-600" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="text-xs">{cfg.emoji}</span>
                <span className="text-[10px] font-heading font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
                {task.isRescan && (
                  <span className="text-[9px] font-heading font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-accent/15 text-amber-accent">
                    Action Required
                  </span>
                )}
              </div>
              <p className={`text-sm font-heading font-semibold text-primary leading-tight ${task.completed ? 'line-through' : ''}`}>
                {task.title}
              </p>
            </div>
            <button onClick={() => setExpanded(e => !e)} className="flex-shrink-0 mt-1">
              {expanded
                ? <ChevronUp size={14} className="text-secondary" />
                : <ChevronDown size={14} className="text-secondary" />}
            </button>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {task.duration > 0 && (
              <div className="flex items-center gap-1">
                <Clock size={11} className="text-secondary" />
                <span className="text-[10px] text-secondary font-body">{task.duration} min</span>
              </div>
            )}
            {task.frequency && (
              <span className="text-[10px] text-secondary font-body capitalize">{task.frequency}</span>
            )}
            <div className="flex gap-0.5 ml-auto">
              {diffDots.map((filled, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${filled ? 'bg-[#1A6B5C]' : 'bg-gray-200 dark:bg-gray-700'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-default">
              {detailLocked ? (
                <div className="relative rounded-xl overflow-hidden">
                  {/* blurred text preview */}
                  <p className="text-sm text-secondary font-body leading-relaxed blur-[5px] select-none pointer-events-none">
                    {task.description}
                  </p>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/70 backdrop-blur-[2px] rounded-xl gap-2 p-3">
                    <Lock size={14} className="text-amber-accent" />
                    <p className="text-[11px] font-heading font-bold text-primary text-center">Pro Protocol</p>
                    <button
                      onClick={onUpgrade}
                      className="px-3 py-1 rounded-lg text-[10px] font-heading font-bold text-black"
                      style={{ background: 'linear-gradient(135deg, #F5A623, #C6A85C)' }}
                    >
                      Unlock Details
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-secondary font-body leading-relaxed">{task.description}</p>
                  {task.isRescan && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-accent/20">
                      <p className="text-xs font-heading font-bold text-amber-accent mb-1">Why rescan now?</p>
                      <p className="text-xs text-secondary font-body">12 weeks of compounding habits will show clear score improvements. Use the same lighting, angle, and distance as your first scan.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── WeekSelector ─────────────────────────────────────────────────────────────

function WeekSelector({ selectedWeek, onSelect, tasksByWeek, isPremium }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-4 px-4 scrollbar-hide">
      {Array.from({ length: 12 }, (_, i) => i + 1).map(w => {
        const wTasks = tasksByWeek[w] ?? []
        const completedCount = wTasks.filter(t => t.completed).length
        const pct = wTasks.length > 0 ? completedCount / wTasks.length : 0
        const phase = WEEK_PHASES[w]
        const phaseColor = PHASE_COLORS[phase]?.color ?? '#1A6B5C'
        const locked = !isPremium && w > 2
        const isSelected = selectedWeek === w

        return (
          <button
            key={w}
            onClick={() => onSelect(w)}
            className={`flex-shrink-0 flex flex-col items-center gap-0.5 w-10 py-2 rounded-xl border transition-all duration-200 relative ${
              isSelected
                ? 'border-transparent text-white'
                : 'border-default bg-card text-secondary'
            }`}
            style={isSelected ? { background: phaseColor, borderColor: phaseColor } : {}}
          >
            {locked && !isSelected && (
              <Lock size={8} className="absolute top-1 right-1 text-secondary opacity-50" />
            )}
            <span className={`text-[10px] font-heading font-bold ${isSelected ? 'text-white' : 'text-secondary'}`}>
              W{w}
            </span>
            {/* mini progress arc */}
            {wTasks.length > 0 && pct > 0 && (
              <div className="w-3 h-3 rounded-full border-2 flex-shrink-0"
                style={{
                  borderColor: isSelected ? 'rgba(255,255,255,0.6)' : phaseColor,
                  background: pct === 1 ? (isSelected ? 'rgba(255,255,255,0.4)' : phaseColor) : 'transparent',
                }}
              />
            )}
            {(wTasks.length === 0 || pct === 0) && (
              <div className="w-3 h-3 rounded-full border-2 flex-shrink-0"
                style={{ borderColor: isSelected ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.1)' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ActionPlan() {
  const navigate = useNavigate()
  const { currentPlan, toggleTask, isPremium, assignedPhase } = useStore()
  const [selectedWeek, setSelectedWeek] = useState(currentPlan?.weekNumber ?? 1)
  const [activeTab, setActiveTab] = useState('All')

  if (!currentPlan) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <p className="text-4xl mb-4">📋</p>
        <h2 className="font-heading font-bold text-xl text-primary mb-2">No plan yet</h2>
        <p className="text-secondary text-sm font-body mb-6">Complete a full scan to generate your personalized 12-week plan.</p>
        <button onClick={() => navigate('/scan')} className="btn-primary max-w-xs">Start Your First Scan</button>
      </div>
    )
  }

  const allTasks = currentPlan.tasks ?? []

  // Group tasks by week
  const tasksByWeek = useMemo(() => {
    const map = {}
    for (let w = 1; w <= 12; w++) map[w] = []
    allTasks.forEach(t => {
      const w = t.week ?? 1
      if (map[w]) map[w].push(t)
    })
    return map
  }, [allTasks])

  const weekTasks = tasksByWeek[selectedWeek] ?? []
  const weekDetailLocked = !isPremium && selectedWeek > 2
  const phase = WEEK_PHASES[selectedWeek]
  const phaseStyle = PHASE_COLORS[phase] ?? { color: '#1A6B5C', bg: 'rgba(26,107,92,0.1)' }
  const phaseMeta = PHASE_META[assignedPhase ?? 'TRANSFORM']

  // Filter tasks for current tab
  const filteredTasks = useMemo(() => {
    if (activeTab === 'All') return weekTasks
    // 'Appeal' tab maps to 'grooming' category key
    const catKey = activeTab.toLowerCase() === 'appeal' ? 'grooming' : activeTab.toLowerCase()
    return weekTasks.filter(t => t.category?.toLowerCase() === catKey)
  }, [weekTasks, activeTab])

  const completedThisWeek = weekTasks.filter(t => t.completed).length
  const totalThisWeek = weekTasks.length
  const weekPct = totalThisWeek > 0 ? Math.round((completedThisWeek / totalThisWeek) * 100) : 0

  const activeTasks = filteredTasks.filter(t => !t.completed)
  const doneTasks = filteredTasks.filter(t => t.completed)

  const prevWeek = () => setSelectedWeek(w => Math.max(1, w - 1))
  const nextWeek = () => setSelectedWeek(w => Math.min(12, w + 1))

  return (
    <MotionPage className="px-4">
      <PageHeader title="12-Week Plan" subtitle={`${phaseMeta?.label ?? 'Your Program'} · ${allTasks.filter(t => t.completed).length} tasks done`} />

      {/* Phase + week header */}
      <div className="card mb-3 p-4" style={{ background: phaseStyle.bg, borderColor: phaseStyle.color + '30' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-heading font-bold uppercase tracking-widest" style={{ color: phaseStyle.color }}>
                {phase}
              </span>
            </div>
            <p className="font-heading font-bold text-xl text-primary">Week {selectedWeek}</p>
            <p className="text-xs text-secondary font-body mt-0.5">
              {completedThisWeek}/{totalThisWeek} tasks · {weekPct}% complete
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevWeek}
              disabled={selectedWeek === 1}
              className="w-8 h-8 rounded-full bg-white/10 dark:bg-black/10 flex items-center justify-center disabled:opacity-30"
            >
              <ChevronLeft size={16} className="text-primary" />
            </button>
            <button
              onClick={nextWeek}
              disabled={selectedWeek === 12}
              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30"
              style={{ background: phaseStyle.color }}
            >
              <ChevronRight size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: phaseStyle.color }}
            initial={{ width: 0 }}
            animate={{ width: `${weekPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {weekPct === 100 && totalThisWeek > 0 && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="text-xs font-heading font-bold mt-2" style={{ color: phaseStyle.color }}>
            ✓ Week {selectedWeek} complete
            {selectedWeek < 12 ? ' — advance to next week' : ' — time to rescan!'}
          </motion.p>
        )}
      </div>

      {/* Week pills */}
      <WeekSelector
        selectedWeek={selectedWeek}
        onSelect={w => setSelectedWeek(w)}
        tasksByWeek={tasksByWeek}
        isPremium={isPremium}
      />

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-heading font-bold transition-all duration-200 ${
              activeTab === tab
                ? 'text-black border border-[#C6A85C]'
                : 'bg-card border border-default text-secondary'
            }`}
            style={activeTab === tab ? { background: 'linear-gradient(135deg, #FFD700, #C6A85C)' } : {}}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Pro detail banner for weeks 3+ */}
      {weekDetailLocked && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-3 border border-amber-accent/25 bg-amber-50/50 dark:bg-amber-900/10">
          <Lock size={13} className="text-amber-accent flex-shrink-0" />
          <p className="text-[11px] text-secondary font-body flex-1">
            Task protocols visible with <span className="font-bold text-amber-accent">Pro</span>. Tap any task to see the full instructions.
          </p>
          <button onClick={() => navigate('/premium')} className="px-2.5 py-1 rounded-lg text-[10px] font-heading font-bold text-black flex-shrink-0" style={{ background: '#F5A623' }}>
            Upgrade
          </button>
        </div>
      )}

      <div>
        {filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-2xl mb-2">
              {activeTab === 'All' ? '🎉' : CATEGORY_CONFIG[activeTab.toLowerCase() === 'appeal' ? 'grooming' : activeTab.toLowerCase()]?.emoji ?? '📋'}
            </p>
            <p className="text-secondary text-sm font-body">
              {activeTab === 'All'
                ? 'No tasks assigned this week.'
                : `No ${activeTab.toLowerCase()} tasks this week.`}
            </p>
          </div>
        )}

        {/* Active tasks */}
        <AnimatePresence>
          {activeTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={toggleTask}
              detailLocked={weekDetailLocked}
              onUpgrade={() => navigate('/premium')}
            />
          ))}
        </AnimatePresence>

        {/* Completed tasks */}
        {doneTasks.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-heading font-bold text-secondary uppercase tracking-wide mb-2">
              Done ({doneTasks.length})
            </p>
            <AnimatePresence>
              {doneTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  detailLocked={weekDetailLocked}
                  onUpgrade={() => navigate('/premium')}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Week 12 rescan CTA */}
        {selectedWeek === 12 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 card border-2 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800"
            style={{ borderColor: '#FFD700' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,215,0,0.15)' }}>
                <Camera size={22} style={{ color: '#FFD700' }} />
              </div>
              <div>
                <p className="font-heading font-bold text-sm text-primary">12 weeks complete.</p>
                <p className="text-xs text-secondary font-body">Time to measure your progress.</p>
              </div>
            </div>
            <p className="text-xs text-secondary font-body mb-3 leading-relaxed">
              Take your rescan in the same conditions as week 1 — same lighting, same distance, same pose.
              12 weeks of compounding habits will show a measurably higher score.
            </p>
            <button
              onClick={() => navigate('/scan')}
              className="w-full py-3 rounded-2xl font-heading font-bold text-sm text-charcoal"
              style={{ background: 'linear-gradient(135deg, #FFD700, #F5A623)' }}
            >
              Start Your Rescan
            </button>
          </motion.div>
        )}

        {/* Free tier bottom upsell */}
        {!isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mt-3 border-dashed border-2 border-amber-accent/40 bg-amber-50/50 dark:bg-amber-900/10"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-accent/20 flex items-center justify-center flex-shrink-0">
                <Zap size={16} className="text-amber-accent" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-sm text-primary">Unlock full protocols</p>
                <p className="text-xs text-secondary font-body">Step-by-step instructions for every task, all 12 weeks.</p>
              </div>
              <button onClick={() => navigate('/premium')} className="px-3 py-1.5 rounded-xl text-xs font-heading font-bold text-charcoal flex-shrink-0" style={{ background: '#F5A623' }}>
                Pro
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <div className="pb-8" />
    </MotionPage>
  )
}
