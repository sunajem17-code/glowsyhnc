import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Flame, LockKeyhole } from 'lucide-react'
import MotionPage from '../components/MotionPage'
import StreakFlame from '../components/StreakFlame'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const MILESTONES = [5, 10, 30, 90, 180, 360]
const PAGE_BG = '#0A0A0A'
const TEXT = 'rgba(255,255,255,0.92)'
const TEXT_DIM = 'rgba(255,255,255,0.5)'

function dateKey(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Calendar({ checkinDates, monthDate }) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const todayKey = dateKey(new Date())
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <section className="rounded-3xl p-4" aria-labelledby="streak-calendar-title" style={{ background: '#101010', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 id="streak-calendar-title" className="font-heading font-bold text-lg" style={{ color: TEXT }}>Your calendar</h2>
          <p className="text-xs font-body mt-0.5" style={{ color: TEXT_DIM }}>Days you checked in this month</p>
        </div>
        <div className="rounded-full px-3 py-1.5 text-xs font-body font-bold" style={{ color: GOLD, background: 'rgba(198,168,92,0.12)' }}>
          {checkinDates.size} {checkinDates.size === 1 ? 'day' : 'days'}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={`${day}-${index}`} className="h-7 flex items-center justify-center text-[10px] font-body font-bold" style={{ color: TEXT_DIM }}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={monthLabel}>
        {Array.from({ length: firstWeekday }, (_, index) => <div key={`blank-${index}`} aria-hidden="true" />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const checkedIn = checkinDates.has(key)
          const isToday = key === todayKey
          const isFuture = key > todayKey
          const spokenDate = new Date(year, month, day).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })

          return (
            <div
              key={key}
              role="gridcell"
              aria-label={`${spokenDate}${checkedIn ? ', checked in' : ''}${isToday ? ', today' : ''}`}
              className="aspect-square min-h-8 rounded-xl flex flex-col items-center justify-center gap-0.5"
              style={{
                background: checkedIn ? 'rgba(198,168,92,0.16)' : 'transparent',
                border: checkedIn ? '1px solid rgba(232,208,138,0.65)' : isToday ? '1px solid rgba(232,208,138,0.4)' : '1px solid transparent',
                color: checkedIn ? '#F4D989' : isFuture ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.72)',
              }}
            >
              <span className="font-mono text-xs leading-none">{day}</span>
              {checkedIn && <span className="w-1 h-1 rounded-full" style={{ background: GOLD }} />}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 mt-4 text-[11px] font-body" style={{ color: TEXT_DIM }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: GOLD, boxShadow: '0 0 8px rgba(198,168,92,0.5)' }} />
        Check-in completed
      </div>
    </section>
  )
}

function GoalTimeline({ current }) {
  const nextGoal = MILESTONES.find(goal => current < goal) ?? null
  const progress = nextGoal ? Math.min(100, (current / nextGoal) * 100) : 100
  const daysLeft = nextGoal ? Math.max(0, nextGoal - current) : 0

  return (
    <section className="rounded-3xl p-4" aria-labelledby="streak-goals-title" style={{ background: '#101010', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Flame size={18} style={{ color: GOLD }} />
        <h2 id="streak-goals-title" className="font-heading font-bold text-lg" style={{ color: TEXT }}>Streak goals</h2>
      </div>
      <p className="text-xs font-body mb-4" style={{ color: TEXT_DIM }}>
        {nextGoal
          ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} until your ${nextGoal}-day milestone`
          : 'You reached every milestone. Keep your streak alive!'}
      </p>

      <div className="rounded-2xl p-3.5 mb-4" style={{ background: 'rgba(198,168,92,0.09)', border: '1px solid rgba(198,168,92,0.24)' }}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="font-body font-bold text-sm" style={{ color: '#F4D989' }}>
            {nextGoal ? `Next goal · ${nextGoal} days` : 'All milestones reached'}
          </span>
          <span className="font-mono text-xs" style={{ color: TEXT_DIM }}>{current}/{nextGoal ?? 360} days</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #A8893A, #F4D989)', boxShadow: '0 0 12px rgba(198,168,92,0.45)' }} />
        </div>
      </div>

      <ol className="relative space-y-0" aria-label="Streak milestone timeline">
        {MILESTONES.map((goal, index) => {
          const reached = current >= goal
          const isNext = goal === nextGoal
          const last = index === MILESTONES.length - 1
          return (
            <li key={goal} className="relative flex gap-3 min-h-[54px]">
              {!last && <span className="absolute left-[13px] top-7 bottom-0 w-px" style={{ background: reached ? 'rgba(198,168,92,0.55)' : 'rgba(255,255,255,0.1)' }} />}
              <span className="relative z-10 w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center" style={{ background: reached ? 'rgba(198,168,92,0.18)' : '#171717', border: `1px solid ${reached || isNext ? 'rgba(232,208,138,0.55)' : 'rgba(255,255,255,0.12)'}`, color: reached || isNext ? '#F4D989' : 'rgba(255,255,255,0.38)' }}>
                {reached ? <Check size={14} /> : isNext ? <Flame size={13} /> : <LockKeyhole size={12} />}
              </span>
              <div className="flex-1 flex items-center justify-between gap-3 pb-3">
                <div>
                  <p className="font-body font-bold text-sm" style={{ color: reached || isNext ? TEXT : 'rgba(255,255,255,0.58)' }}>{goal}-day streak</p>
                  <p className="font-body text-[11px]" style={{ color: TEXT_DIM }}>{reached ? 'Milestone reached' : isNext ? 'Your next milestone' : `${goal - current} days to go`}</p>
                </div>
                {isNext && <ChevronRight size={16} style={{ color: GOLD }} />}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default function Streak() {
  const navigate = useNavigate()
  const streak = useStore(state => state.streak)
  const checkins = useStore(state => state.checkins)
  const token = useStore(state => state.token)
  const [serverCheckins, setServerCheckins] = useState([])
  const now = new Date()
  const monthDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthPrefix = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-`
  const isDemo = !token || token === 'demo-token'

  useEffect(() => {
    let cancelled = false
    if (isDemo) return undefined
    api.checkin.history()
      .then(({ checkins: remote = [] }) => { if (!cancelled) setServerCheckins(remote) })
      .catch(() => { if (!cancelled) setServerCheckins([]) })
    return () => { cancelled = true }
  }, [token, isDemo])

  const checkinDates = useMemo(() => {
    const dates = new Set()
    for (const item of [...checkins, ...serverCheckins]) {
      const key = dateKey(item.date ?? item.checkin_date)
      if (key?.startsWith(monthPrefix)) dates.add(key)
    }
    const lastDate = dateKey(streak.lastDate)
    if (lastDate?.startsWith(monthPrefix)) dates.add(lastDate)
    return dates
  }, [checkins, serverCheckins, streak.lastDate, monthPrefix])

  const current = Math.max(0, Number(streak.current) || 0)

  return (
    <MotionPage className="px-4 pb-8" style={{ background: PAGE_BG, color: TEXT }}>
      <div className="flex items-center gap-3 mb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button
          type="button"
          onClick={() => { triggerHaptic(); navigate('/timeline') }}
          aria-label="Go back"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <ChevronLeft size={18} style={{ color: TEXT }} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-[22px] leading-tight" style={{ color: TEXT }}>Your streak</h1>
          <p className="font-body text-[13px]" style={{ color: TEXT_DIM }}>One day at a time</p>
        </div>
      </div>

      <section className="flex flex-col items-center text-center pt-2 pb-5" aria-label="Current streak">
        <StreakFlame size={184} />
        <p className="font-mono font-bold leading-none mt-1" style={{ fontSize: 54, color: '#F4D989', textShadow: '0 0 20px rgba(198,168,92,0.45)' }}>{current}</p>
        <p className="font-heading font-bold text-lg mt-1" style={{ color: TEXT }}>{current === 1 ? 'day in a row' : 'days in a row'}</p>
        <p className="font-body text-sm mt-2 max-w-[260px]" style={{ color: TEXT_DIM }}>
          {current > 0 ? 'You’re building a habit. Keep showing up tomorrow.' : 'Complete your daily check-in to start your streak.'}
        </p>
      </section>

      <div className="space-y-4">
        <Calendar checkinDates={checkinDates} monthDate={monthDate} />
        <GoalTimeline current={current} />
      </div>
      <div className="pb-4" />
    </MotionPage>
  )
}
