import { useState, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Zap, Activity, Droplets, Flame, ChevronRight, TrendingUp, Scissors, X, Gift, Clock, ArrowLeftRight, Sparkles } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import useStore from '../store/useStore'
import GlowScoreRing from '../components/GlowScoreRing'
import UMaxScoreBadge from '../components/UMaxScoreBadge'
import MotionPage from '../components/MotionPage'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

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
  transition: { delay, duration: 0.4, ease: EASE_STANDARD },
})

export default function Dashboard() {
  const navigate = useNavigate()
  const user          = useStore(s => s.user)
  const scans         = useStore(s => s.scans)
  const currentPlan   = useStore(s => s.currentPlan)
  const streak        = useStore(s => s.streak)
  const todayCheckin  = useStore(s => s.todayCheckin)
  const isPremium     = useStore(s => s.isPremium)
  const referralCount = useStore(s => s.referralCount)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const showReferralBanner = !isPremium && !bannerDismissed && (referralCount ?? 0) < 3

  const latestScan = scans[0]
  const rawGlowScore = latestScan?.glowScore ?? 0
  const glowScore = rawGlowScore > 10 ? Math.round(rawGlowScore) / 10 : rawGlowScore
  const skin = latestScan?.faceData?.skinClarity ?? 0
  const umaxScore = latestScan?.umaxScore ?? null
  const tier = latestScan?.tier ?? null

  // Normalize helper — scores stored as 0-100 get converted to 0-10
  const normalizeScore = (raw) => raw > 10 ? Math.round(raw) / 10 : raw

  const chartData = useMemo(() =>
    [...scans].reverse().slice(-8).map((s, i) => ({
      week: `W${i + 1}`,
      score: normalizeScore(s.glowScore),
    }))
  , [scans])

  // Rescan countdown — Pro users can always rescan
  const lastScanDate = latestScan ? new Date(latestScan.analyzedAt) : null
  const daysSinceScan = lastScanDate ? Math.floor((Date.now() - lastScanDate.getTime()) / 86400000) : null
  const daysUntilRescan = isPremium ? 0 : (daysSinceScan != null ? Math.max(0, RESCAN_DAYS - daysSinceScan) : null)
  const rescanReady = daysUntilRescan === 0

  const pendingTasks = currentPlan?.tasks?.filter(t => !t.completed).slice(0, 3) ?? []
  const completedToday = currentPlan?.tasks?.filter(t => t.completed).length ?? 0
  const totalTasks = currentPlan?.tasks?.length ?? 0
  const progressPct = totalTasks > 0 ? (completedToday / totalTasks) * 100 : 0

  return (
    <MotionPage className="px-4">
      {/* Header */}
      <div className="pb-5 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
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
          onClick={() => { triggerHaptic(); navigate('/profile') }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <span className="font-bold text-sm font-heading text-primary">
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
            transition={{ duration: 0.35, ease: EASE_STANDARD }}
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
                <Gift size={17} style={{ color: GOLD }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-[13px]" style={{ color: GOLD }}>
                  Get Ascendus Pro free
                </p>
                <p className="font-body text-[11px] text-secondary leading-snug">
                  Refer {3 - (referralCount ?? 0)} more friend{3 - (referralCount ?? 0) === 1 ? '' : 's'} to unlock
                </p>
              </div>
              <button
                onClick={() => { triggerHaptic(); navigate('/premium') }}
                className="font-heading font-bold text-xs px-3 py-1.5 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(198,168,92,0.18)', color: GOLD }}
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
                      {(() => {
                        const prev = normalizeScore(scans[1]?.glowScore ?? glowScore)
                        const delta = glowScore - prev
                        return `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)} pts since last scan`
                      })()}
                    </p>
                  )}
                  <button
                    onClick={() => { triggerHaptic(); navigate('/results') }}
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
                    onClick={() => { triggerHaptic(); navigate('/scan/capture') }}
                    className="px-4 py-2 rounded-xl font-heading font-bold text-xs"
                    style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
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
              onClick={() => { triggerHaptic(); navigate('/scan/capture') }}
              className="w-full rounded-2xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(135deg, rgba(198,168,92,0.12) 0%, rgba(168,137,58,0.06) 100%)', border: '1px solid rgba(198,168,92,0.35)' }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(198,168,92,0.15)' }}>
                <Camera size={17} style={{ color: GOLD }} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-heading font-bold text-[13px]" style={{ color: GOLD }}>New scan ready</p>
                <p className="font-body text-[11px] text-secondary">It's been {daysSinceScan} days, track your progress</p>
              </div>
              <ChevronRight size={14} style={{ color: GOLD }} />
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
                    style={{ width: `${((RESCAN_DAYS - daysUntilRescan) / RESCAN_DAYS) * 100}%`, background: `linear-gradient(90deg, #A8893A, ${GOLD})` }}
                  />
                </div>
              </div>
              <button
                onClick={() => { triggerHaptic(); navigate('/compare') }}
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
            label: 'Face',
            value: latestScan?.faceData?.aestheticScore != null ? latestScan.faceData.aestheticScore.toFixed(1) : 'N/A',
            icon: Activity,
            color: GOLD,
            bg: 'rgba(198,168,92,0.08)',
          },
          {
            label: 'Skin',
            value: skin ? skin.toFixed(1) : 'N/A',
            icon: Droplets,
            color: '#E8A000',
            bg: 'rgba(232,160,0,0.08)',
          },
          {
            label: 'Streak',
            value: streak.current ? `${streak.current}d` : 'N/A',
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
                onClick={() => { triggerHaptic(); navigate('/plan') }}
                className="text-[11px] font-heading font-bold"
                style={{ color: GOLD }}
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
                style={{ background: `linear-gradient(90deg, #A8893A, ${GOLD}, #D4B96A)` }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.2, delay: 0.5, ease: EASE_STANDARD }}
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
              onClick={() => { triggerHaptic(); navigate('/progress') }}
              className="inline-flex items-center gap-1 text-[11px] font-heading font-bold"
              style={{ color: GOLD }}
            >
              <TrendingUp size={12} /> Full view
            </button>
          </div>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <TrendingUp size={24} style={{ color: 'rgba(198,168,92,0.4)' }} />
              <p className="text-[12px] font-body text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Complete your first scan to track progress
              </p>
            </div>
          ) : (
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
                stroke={GOLD}
                strokeWidth={2.5}
                dot={{ r: 3, fill: GOLD, strokeWidth: 0 }}
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
          )}
        </div>
      </motion.div>

      {/* HairMaxx */}
      <motion.button
        {...fadeUp(0.24)}
        onClick={() => { triggerHaptic(); navigate('/hairmaxx') }}
        className="w-full mb-4 rounded-2xl flex items-center gap-4 px-4 py-4 active:scale-[0.98] transition-transform"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.25)' }}
        >
          <Scissors size={19} style={{ color: GOLD }} />
        </div>
        <div className="text-left flex-1">
          <p className="font-heading font-bold text-sm text-primary">
            HairMaxx
          </p>
          <p className="text-[11px] font-body mt-0.5 text-secondary">
            Face analysis · Barber scripts · Cut rankings
          </p>
        </div>
        <ChevronRight size={15} style={{ color: GOLD }} />
      </motion.button>

      {/* SwipeMaxx */}
      <motion.button
        {...fadeUp(0.26)}
        onClick={() => { triggerHaptic(); navigate('/swipemaxx') }}
        className="w-full mb-4 rounded-2xl flex items-center gap-4 px-4 py-4 active:scale-[0.98] transition-transform"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.25)' }}
        >
          <Sparkles size={19} style={{ color: GOLD }} />
        </div>
        <div className="text-left flex-1">
          <p className="font-heading font-bold text-sm text-primary">
            SwipeMaxx
          </p>
          <p className="text-[11px] font-body mt-0.5 text-secondary">
            AI picks your best dating photo
          </p>
        </div>
        <ChevronRight size={15} style={{ color: GOLD }} />
      </motion.button>

      {/* CTA Buttons */}
      <motion.div {...fadeUp(0.27)} className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => { triggerHaptic(); navigate('/checkin') }}
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
          onClick={() => { triggerHaptic(); navigate('/scan/capture') }}
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
