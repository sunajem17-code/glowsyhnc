import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Clock, Zap, Lock, Camera } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'

const CATEGORY_CONFIG = {
  posture: { emoji: '📐', label: 'Posture', color: '#1A6B5C', bg: 'bg-green-50 dark:bg-green-900/20' },
  skin: { emoji: '✨', label: 'Skin', color: '#F5A623', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  body: { emoji: '💪', label: 'Body', color: '#1A6B5C', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  style: { emoji: '💈', label: 'Style', color: '#2D2D2D', bg: 'bg-gray-50 dark:bg-gray-800' },
  health: { emoji: '🫀', label: 'Health', color: '#E07A5F', bg: 'bg-red-50 dark:bg-red-900/20' },
}

const TABS = ['All', 'Posture', 'Skin', 'Body', 'Style', 'Health']

function TaskCard({ task, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = CATEGORY_CONFIG[task.category] ?? CATEGORY_CONFIG.health
  const difficultyDots = Array.from({ length: 3 }, (_, i) => i < task.difficulty)

  return (
    <motion.div
      layout
      className={`card mb-2.5 transition-all duration-300 ${task.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task.id)}
          className="mt-0.5 flex-shrink-0"
        >
          {task.completed ? (
            <CheckCircle2 size={22} className="text-[#1A6B5C]" />
          ) : (
            <Circle size={22} className="text-gray-300 dark:text-gray-600" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs">{cfg.emoji}</span>
                <span className={`text-[10px] font-heading font-bold uppercase tracking-wide`} style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
              </div>
              <p className={`text-sm font-heading font-semibold text-primary leading-tight ${task.completed ? 'line-through' : ''}`}>
                {task.title}
              </p>
            </div>
            <button onClick={() => setExpanded(e => !e)} className="flex-shrink-0 mt-1">
              {expanded ? <ChevronUp size={14} className="text-secondary" /> : <ChevronDown size={14} className="text-secondary" />}
            </button>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1.5">
            {task.duration > 0 && (
              <div className="flex items-center gap-1">
                <Clock size={11} className="text-secondary" />
                <span className="text-[10px] text-secondary font-body">{task.duration} min</span>
              </div>
            )}
            {task.sets && (
              <span className="text-[10px] text-secondary font-body">{task.sets}×{task.reps}</span>
            )}
            <span className="text-[10px] text-secondary font-body capitalize">{task.frequency}</span>
            <div className="flex gap-0.5 ml-auto">
              {difficultyDots.map((filled, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${filled ? 'bg-[#1A6B5C]' : 'bg-gray-200 dark:bg-gray-700'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-default">
              <p className="text-sm text-secondary font-body leading-relaxed">{task.description}</p>
              {task.steps && (
                <div className="mt-3 space-y-2">
                  {task.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#1A6B5C]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-[#1A6B5C]">{i + 1}</span>
                      </div>
                      <p className="text-xs text-secondary font-body">{step}</p>
                    </div>
                  ))}
                </div>
              )}
              {task.tip && (
                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <p className="text-xs text-amber-accent font-medium">💡 {task.tip}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function ActionPlan() {
  const navigate = useNavigate()
  const { currentPlan, toggleTask, isPremium } = useStore()
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

  const tasks = currentPlan.tasks ?? []
  const filtered = activeTab === 'All' ? tasks : tasks.filter(t => t.category.toLowerCase() === activeTab.toLowerCase())
  const completed = tasks.filter(t => t.completed).length
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0

  const activeTasks = filtered.filter(t => !t.completed)
  const doneTasks = filtered.filter(t => t.completed)

  return (
    <MotionPage className="px-4">
      <PageHeader
        title="Your 12-Week Plan"
        subtitle={`Week 1 · ${completed}/${tasks.length} tasks completed`}
      />

      {/* Progress Summary Card */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-heading font-bold text-base text-primary">This Week</p>
            <p className="text-xs text-secondary font-body">{pct}% complete · {tasks.length - completed} remaining</p>
          </div>
          <div className="text-right">
            <p className="font-mono font-bold text-2xl text-[#1A6B5C]">{pct}%</p>
          </div>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#1A6B5C] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        {pct === 100 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-center">
            <p className="text-sm font-heading font-bold text-success">🎉 Perfect week! Every task completed.</p>
          </motion.div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-heading font-bold transition-all duration-200 ${
              activeTab === tab
                ? 'bg-[#1A6B5C] text-white'
                : 'bg-card border border-default text-secondary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tasks */}
      <div>
        {activeTasks.length === 0 && doneTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-secondary text-sm font-body">No tasks in this category.</p>
          </div>
        )}

        {/* Active tasks */}
        <AnimatePresence>
          {activeTasks.map(task => (
            <TaskCard key={task.id} task={task} onToggle={toggleTask} />
          ))}
        </AnimatePresence>

        {/* Premium teaser */}
        {!isPremium && tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mb-3 border-2 border-dashed border-amber-accent/40 bg-amber-50/50 dark:bg-amber-900/10"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-accent/20 flex items-center justify-center flex-shrink-0">
                <Lock size={18} className="text-amber-accent" />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-sm text-primary">Unlock weeks 2–12</p>
                <p className="text-xs text-secondary font-body">Full 12-week progression plan with premium.</p>
              </div>
              <button
                onClick={() => navigate('/premium')}
                className="px-3 py-1.5 bg-amber-accent rounded-xl text-xs font-heading font-bold text-charcoal"
              >
                Upgrade
              </button>
            </div>
          </motion.div>
        )}

        {/* Completed tasks */}
        {doneTasks.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-heading font-bold text-secondary uppercase tracking-wide mb-2">
              Completed ({doneTasks.length})
            </p>
            <AnimatePresence>
              {doneTasks.map(task => (
                <TaskCard key={task.id} task={task} onToggle={toggleTask} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="pb-8" />
    </MotionPage>
  )
}
