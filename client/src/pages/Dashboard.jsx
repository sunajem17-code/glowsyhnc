import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Zap, Activity, Droplets, Flame, ChevronRight, TrendingUp, Scissors, X, Gift, Clock, ArrowLeftRight } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import useStore from '../store/useStore'
import GlowScoreRing from '../components/GlowScoreRing'
import UMaxScoreBadge from '../components/UMaxScoreBadge'
import MotionPage from '../components/MotionPage'
import { postureGrade } from '../utils/analysis'

const RESCAN_DAYS = 14

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
})

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, scans, currentPlan, streak, todayCheckin, isPremium, referralCount } = useStore()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const showReferralBanner = !isPremium && !bannerDismissed && (referralCount ?? 0) < 5

  const latestScan = scans[0]
  const rawGlowScore = latestScan?.glowScore ?? 0
  const glowScore = rawGlowScore > 10 ? Math.round(rawGlowScore) / 10 : rawGlowScore
  const posture = latestScan?.bodyData?.posture ?? 0
  const skin = latestScan?.faceData?.skinClarity ?? 0
  const umaxScore = latestScan?.umaxScore ?? null
  const tier = latestScan?.tier ?? null

  const chartData = [...scans].reverse().slice(-8).map((s, i) => ({
    week: `W${i + 1}`,
    score: s.glowScore,
  }))
  if (chartData.length === 0) {
    chartData.push(...[62, 65, 67, 70, 68, 72, 74, 78].map((s, i) => ({ week: `W${i + 1}`, score: s })))
  }

  // Rescan countdown
  const lastScanDate = latestScan ? new Date(latestScan.analyzedAt) : null
  const daysSinceScan = lastScanDate ? Math.floor((Date.now() - lastScanDate.getTime()) / 86400000) : null
  const daysUntilRescan = daysSinceScan != null ? Math.max(0, RESCAN_DAYS - daysSinceScan) : null
  const rescanReady = daysUntilRescan === 0

  const pendingTasks = currentPlan?.tasks?.filter(t => !t.completed).slice(0, 3) ?? []
  const completedToday = currentPlan?.tasks?.filter(t => t.completed).length ?? 0
  const totalTasks = currentPlan?.tasks?.length ?? 0
  const progressPct = totalTasks > 0 ? (completedToday / totalTasks) * 100 : 0

  return (
    <MotionPage className="px-4">
      {/* Header */}
      <div className="pt-14 pb-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-secondary font-body uppercase tracking-widest mb-0.5">
            {greeting()}
          </p>
          <h1
            className="font-heading font-bold text-[26px] text-primary"
            style={{ letterSpacing: '-0.02em' }}
          >
            {user?.name ?? 'Friend'}
          </h1>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="font-bold text-sm font-heading" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {(user?.name?.[0] ?? 'G').toUpperCase()}
          </span>
        </button>
      </div>

      {/* Referral Banner */}
      <AnimatePresence>
        {showReferralBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mb-4 overflow-hidden"
          >
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(198,168,92,0.1) 0%, rgba(168,137,58,0.06) 100%)',
                border: '1px solid rgba(198,168,92,0.22)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.12)' }}
              >
                <Gift size={17} style={{ color: '#C6A85C' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-[13px]" style={{ color: '#C6A85C' }}>
                  Get 7 days Pro free
                </p>
                <p className="font-body text-[11px] text-secondary leading-snug">
                  Refer {5 - (referralCount ?? 0)} more friend{5 - (referralCount ?? 0) === 1 ? '' : 's'} to unlock
                </p>
              </div>
              <button
                onClick={() => navigate('/referral')}
                className="font-heading font-bold text-xs px-3 py-1.5 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.18)', color: '#C6A85C' }}
              >
                Share
              </button>
              <button
                onClick={() => setBannerDismissed(true)}
                className="p-1 flex-shrink-0"
              >
                <X size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glow Score Card */}
      <motion.div {...fadeUp(0.05)} className="mb-4 overflow-hidden rounded-2xl relative">
        <div
          className="p-5"
          style={{
            background: 'linear-gradient(135deg, #1A1A1A 0%, #141414 100%)',
            border: '1px solid rgba(198,168,92,0.18)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {/* Subtle shine overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 90% 10%, rgba(255,255,255,0.12) 0%, transparent 60%)',
            }}
          />
          <div className="flex items-center gap-5 relative z-10">
            <GlowScoreRing score={glowScore} size="large" animated />
            <div className="flex-1">
              {latestScan ? (
                <>
                  <p
                    className="font-body text-[11px] mb-1.5"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                  >
                    Last scan · {new Date(latestScan.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="font-heading font-semibold text-sm text-white">
                    {glowScore >= 7 ? 'You\'re on fire.' : glowScore >= 5 ? 'Progress is real.' : 'Every journey starts here.'}
                  </p>
                  {scans.length >= 2 && (
                    <p className="text-[12px] mt-1 font-body" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {glowScore - (scans[1]?.glowScore ?? glowScore) >= 0 ? '↑' : '↓'} {Math.abs(glowScore - (scans[1]?.glowScore ?? glowScore))} pts since last scan
                    </p>
                  )}
                  <button
                    onClick={() => navigate('/results')}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-heading font-bold rounded-xl px-3 py-1.5"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)' }}
                  >
                    View results <ChevronRight size={11} />
                  </button>
                </>
              ) : (
                <>
                  <p className="font-heading font-semibold text-white text-sm mb-1">No scan yet</p>
                  <p className="font-body text-[12px] mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Take your first scan to unlock your Glow Score
                  </p>
                  <button
                    onClick={() => navigate('/scan')}
                    className="px-4 py-2 rounded-xl font-heading font-bold text-xs"
                    style={{ background: 'linear-gradient(135deg, #D4B96A, #C6A85C)', color: '#0A0A0A' }}
                  >
                    Start Scan
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Rescan countdown / ready */}
      {latestScan && daysUntilRescan != null && (
        <motion.div {...fadeUp(0.08)} className="mb-4">
          {rescanReady ? (
            <button
              onClick={() => navigate('/scan')}
              className="w-full rounded-2xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(135deg, rgba(198,168,92,0.12) 0%, rgba(168,137,58,0.06) 100%)', border: '1px solid rgba(198,168,92,0.35)' }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(198,168,92,0.15)' }}>
                <Camera size={17} style={{ color: '#C6A85C' }} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-heading font-bold text-[13px]" style={{ color: '#C6A85C' }}>New scan ready</p>
                <p className="font-body text-[11px] text-secondary">It's been {daysSinceScan} days — track your progress</p>
              </div>
              <ChevronRight size={14} style={{ color: '#C6A85C' }} />
            </button>
          ) : (
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Clock size={16} style={{ color: 'rgba(255,255,255,0.35)' }} />
              </div>
              <div className="flex-1">
                <p className="font-heading font-bold text-[13px] text-primary">Next scan in {daysUntilRescan}d</p>
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${((RESCAN_DAYS - daysUntilRescan) / RESCAN_DAYS) * 100}%`, background: 'linear-gradient(90deg, #A8893A, #C6A85C)' }}
                  />
                </div>
              </div>
              <button
                onClick={() => navigate('/compare')}
                className="flex items-center gap-1 text-[10px] font-heading font-bold px-2.5 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
              >
                <ArrowLeftRight size={11} /> Compare
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Glow tier badge */}
      {umaxScore && tier && (
        <motion.div {...fadeUp(0.1)} className="mb-4">
          <UMaxScoreBadge umaxScore={umaxScore} gender={latestScan?.gender ?? 'male'} size="large" showScale={false} />
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div {...fadeUp(0.12)} className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          {
            label: 'Posture',
            value: posture ? postureGrade(posture) : '—',
            icon: Activity,
            color: '#C6A85C',
            bg: 'rgba(198,168,92,0.08)',
          },
          {
            label: 'Skin',
            value: skin ? skin.toFixed(1) : '—',
            icon: Droplets,
            color: '#E8A000',
            bg: 'rgba(232,160,0,0.08)',
          },
          {
            label: 'Streak',
            value: streak.current ? `${streak.current}d` : '—',
            icon: Flame,
            color: '#EF4444',
            bg: 'rgba(239,68,68,0.08)',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl p-3.5 text-center"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2"
              style={{ background: bg }}
            >
              <Icon size={17} style={{ color }} />
            </div>
            <p
              className="font-mono font-bold text-lg leading-none"
              style={{ color, letterSpacing: '-0.02em' }}
            >
              {value}
            </p>
            <p className="text-[10px] text-secondary font-body mt-1">{label}</p>
          </div>
        ))}
      </motion.div>

      {/* Today's Tasks */}
      {currentPlan && (
        <motion.div
          {...fadeUp(0.16)}
          className="mb-4 rounded-2xl overflow-hidden"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2
                  className="font-heading font-bold text-base text-primary"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  Today's Tasks
                </h2>
                <p className="text-[11px] text-secondary font-body">
                  {completedToday} of {totalTasks} complete
                </p>
              </div>
              <button
                onClick={() => navigate('/plan')}
                className="text-[11px] font-heading font-bold"
                style={{ color: '#C6A85C' }}
              >
                See all
              </button>
            </div>
            {/* Progress bar */}
            <div
              className="h-1 rounded-full mt-3 mb-4 overflow-hidden"
              style={{ background: 'var(--border)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #A8893A, #C6A85C, #D4B96A)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="space-y-1.5">
              {pendingTasks.length === 0 ? (
                <div className="text-center py-3">
                  <p className="font-heading font-semibold text-sm text-primary">All done for today.</p>
                  <p className="text-xs text-secondary font-body mt-0.5">Come back tomorrow.</p>
                </div>
              ) : pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-2 px-1"
                >
                  <div
                    className="w-4 h-4 rounded-md border flex-shrink-0"
                    style={{ borderColor: 'var(--border-strong)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-body text-primary truncate">{task.title}</p>
                    <p className="text-[10px] text-secondary font-body capitalize">
                      {task.category} · {task.duration}min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Progress Chart */}
      <motion.div
        {...fadeUp(0.2)}
        className="mb-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="font-heading font-bold text-base text-primary"
                style={{ letterSpacing: '-0.01em' }}
              >
                Progress
              </h2>
              <p className="text-[11px] text-secondary font-body">Glow Score over time</p>
            </div>
            <button
              onClick={() => navigate('/progress')}
              className="inline-flex items-center gap-1 text-[11px] font-heading font-bold"
              style={{ color: '#C6A85C' }}
            >
              <TrendingUp size={12} /> Full view
            </button>
          </div>
          <ResponsiveContainer width="100%" height={88}>
            <LineChart data={chartData}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <Line
                type="monotone"
                dataKey="score"
                stroke="#C6A85C"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#C6A85C', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#E8A000', strokeWidth: 0 }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 11,
                  boxShadow: 'var(--shadow-elevated)',
                }}
                labelStyle={{ color: 'var(--text-secondary)', fontFamily: 'Inter' }}
                itemStyle={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk' }}
                formatter={(v) => [v, 'Score']}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* HairMaxx */}
      <motion.button
        {...fadeUp(0.24)}
        onClick={() => navigate('/hairmaxx')}
        className="w-full mb-4 rounded-2xl flex items-center gap-4 px-4 py-4 active:scale-[0.98] transition-transform"
        style={{
          background: '#0D0D0D',
          border: '1px solid #1E1E1E',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(201,146,10,0.12)', border: '1px solid rgba(201,146,10,0.25)' }}
        >
          <Scissors size={19} style={{ color: '#C9A84C' }} />
        </div>
        <div className="text-left flex-1">
          <p className="font-heading font-bold text-sm" style={{ color: '#F0EDE8' }}>
            HairMaxx
          </p>
          <p className="text-[11px] font-body mt-0.5" style={{ color: '#4A4642' }}>
            Face analysis · Barber scripts · Cut rankings
          </p>
        </div>
        <ChevronRight size={15} style={{ color: '#C9A84C' }} />
      </motion.button>

      {/* CTA Buttons */}
      <motion.div {...fadeUp(0.27)} className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => navigate('/checkin')}
          className="py-3.5 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Zap size={15} style={{ color: '#E8A000' }} />
          Check-In
        </button>
        <button
          onClick={() => navigate('/scan')}
          className="btn-primary py-3.5 flex items-center justify-center gap-2"
          style={{ color: '#0A0A0A' }}
        >
          <Camera size={15} />
          Full Scan
        </button>
      </motion.div>
    </MotionPage>
  )
}
