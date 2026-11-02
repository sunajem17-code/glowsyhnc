import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { TrendingUp, Trophy, Camera, Flame, ChevronDown, LockKeyhole } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { getProgressScore, isPhysiqueProgressScan, mergeProgressHistory, mergeScanAiScore } from '../utils/progressHistory'
import { ScanHistoryContent, TrendChart } from './ScanHistory'
import { normalizeHistoryScan } from '../utils/scanHistory'
import { loadScanMedia } from '../utils/scanPhotoDb'
import { getProgressStatPresentation, getProgressTrendPresentation, shouldShowProgressData } from '../utils/scanHistoryPresentation'

export default function ScanTimeline() {
  const navigate = useNavigate()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const { scans, currentScan, streak, isPremium, token, refreshProStatus } = useStore()
  const canAccessProUi = Boolean(isPremium)
  const showProgressData = shouldShowProgressData()
  const progressTrend = getProgressTrendPresentation(canAccessProUi)
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const [historySnapshot, setHistory] = useState({ token, scans: [] })
  const remoteHistory = historySnapshot.token === token ? historySnapshot.scans : []
  const history = mergeProgressHistory(remoteHistory, scans, currentScan)
  const [progressMetric, setProgressMetric] = useState('overall')
  const [graphExpanded, setGraphExpanded] = useState(false)
  const activeHistory = history.filter(scan => !isPhysiqueProgressScan(scan) && getProgressScore(scan, 'face', 'overall') != null)
  const metricOptions = [
    { key: 'overall', label: 'Overall' }, { key: 'potential', label: 'Potential' },
    { key: 'symmetry', label: 'Symmetry' }, { key: 'skin', label: 'Skin' }, { key: 'jawline', label: 'Jawline' },
  ]
  const [loading, setLoading]     = useState(true)
  const [historyError, setHistoryError] = useState(false)
  const [flameFlight, setFlameFlight] = useState(null)
  const [streakCelebration, setStreakCelebration] = useState(false)
  const [entryScanId] = useState(() => location.state?.savedScanId ?? null)
  const streakIconRef = useRef(null)
  const isDemo = !token || token === 'demo-token'
  const streakFlameFlight = location.state?.streakFlameFlight === true
  const streakCelebrationRequested = location.state?.streakCelebration === true
  const flameOrigin = location.state?.flameOrigin ?? null
  const streakCompletedToday = streak.current > 0
    && Boolean(streak.lastDate)
    && new Date(streak.lastDate).toDateString() === new Date().toDateString()

  // Progress embeds the same gated Scan History content as /history. Refresh
  // the authoritative entitlement here too, so a recently completed purchase
  // cannot leave this screen showing its stale locked state.
  useEffect(() => {
    refreshProStatus({ force: true })
  }, [refreshProStatus, token])

  useEffect(() => {
    if (streakCelebrationRequested && (reduceMotion || !streakFlameFlight)) {
      setStreakCelebration(true)
      navigate('/timeline', { replace: true, state: null })
      return undefined
    }
    if (!streakFlameFlight) return undefined
    let finishTimer
    const finishFlight = () => {
      setFlameFlight(null)
      setStreakCelebration(true)
      navigate('/timeline', { replace: true, state: null })
    }
    const startTimer = setTimeout(() => {
      const target = streakIconRef.current?.getBoundingClientRect()
      if (!flameOrigin || !target) {
        finishFlight()
        return
      }

      const fromCenterX = flameOrigin.left + flameOrigin.width / 2
      const fromCenterY = flameOrigin.top + flameOrigin.height / 2
      const toCenterX = target.left + target.width / 2
      const toCenterY = target.top + target.height / 2
      setFlameFlight({
        origin: flameOrigin,
        deltaX: toCenterX - fromCenterX,
        deltaY: toCenterY - fromCenterY,
        scale: Math.min(target.width / flameOrigin.width, target.height / flameOrigin.height),
      })
      // Keep a cleanup fallback in case the motion completion event is
      // interrupted by a resize or the page being backgrounded mid-flight.
      finishTimer = setTimeout(finishFlight, 1500)
    }, 450)
    return () => {
      clearTimeout(startTimer)
      if (finishTimer) clearTimeout(finishTimer)
    }
  }, [flameOrigin, streakFlameFlight, streakCelebrationRequested, reduceMotion, navigate])

  useEffect(() => {
    if (!streakCelebration) return undefined
    const timer = setTimeout(() => setStreakCelebration(false), 1000)
    return () => clearTimeout(timer)
  }, [streakCelebration])

  useEffect(() => {
    let cancelled = false
    setHistoryError(false)
    if (!showProgressData) {
      setHistory({ token, scans: [] })
      setLoading(false)
      return () => { cancelled = true }
    }
    if (isDemo) { setLoading(false); return }
    setLoading(true)
    api.supabase.getScans()
      .then(({ scans: h }) => { if (!cancelled) setHistory({ token, scans: h || [] }) })
      .catch(() => { if (!cancelled) setHistoryError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, isDemo, showProgressData])

  const activeScores = activeHistory.map(scan => getProgressScore(scan, 'face', 'overall')).filter(Number.isFinite)
  const bestScore      = activeScores.length ? Math.max(...activeScores) : null

  async function viewHistoryScan(entry) {
    const scanMatchesEntry = scan => scan && (
      scan.id === entry.id
      || scan.serverScanId === entry.id
      || scan.id === entry.serverScanId
      || scan.serverScanId === entry.serverScanId
    )
    const localMediaScanId = entry.localMediaScanId
    const saved = (localMediaScanId && scans.find(scan => scan.id === localMediaScanId))
      || (scanMatchesEntry(currentScan) ? currentScan : null)
      || scans.find(scanMatchesEntry)
    const selected = normalizeHistoryScan({
      ...entry,
      ...(saved || {}),
      id: saved?.id || entry.id,
      serverScanId: entry.serverScanId || entry.aiScore?.scanId || saved?.serverScanId || saved?.aiScore?.scanId || null,
      aiScore: mergeScanAiScore(saved?.aiScore, entry.aiScore),
      appearanceAnalysis: saved?.appearanceAnalysis || entry.appearanceAnalysis || saved?.aiScore?.appearanceAnalysis || entry.aiScore?.appearanceAnalysis,
      keyStrengths: saved?.keyStrengths || entry.keyStrengths || saved?.aiScore?.keyStrengths || entry.aiScore?.keyStrengths,
      keyWeaknesses: saved?.keyWeaknesses || entry.keyWeaknesses || saved?.aiScore?.keyWeaknesses || entry.aiScore?.keyWeaknesses,
      facePhotoUrl: saved?.facePhotoUrl || entry.facePhotoUrl || entry.face_photo_url || entry.face_image_url || null,
    })
    const mediaId = localMediaScanId || saved?.id || selected?.id
    const media = mediaId ? await loadScanMedia(mediaId) : null
    setCurrentScan({
      ...selected,
      localMediaScanId: mediaId,
      facePhotoUrl: selected.facePhotoUrl || media?.photo || null,
    })
    navigate('/unlock', { state: { source: 'progress-card', returnTo: '/timeline' } })
  }



  return (
    <MotionPage className="px-4 progress-timeline">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <h1 className="font-heading font-bold text-[22px] text-primary leading-tight" style={{ letterSpacing: '-0.02em' }}>
          Progress
        </h1>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Face Scans', value: activeHistory.length || 'N/A', icon: <Camera size={20} style={{ color: GOLD }} />, lockable: true },
          { label: 'Best Score',     value: bestScore != null ? bestScore.toFixed(1) : 'N/A', icon: <Trophy size={20} style={{ color: GOLD }} />, lockable: true },
        ].map(({ label, value, icon, lockable }) => {
          const stat = lockable ? getProgressStatPresentation(value, canAccessProUi) : { locked: false, value }
          return (
            <div key={label} className="card text-center py-3">
              <div className="flex justify-center mb-0.5">{icon}</div>
              {stat.locked
                ? <LockKeyhole size={19} className="mx-auto my-[3px]" style={{ color: GOLD }} aria-label="Locked" />
                : <p className="font-mono font-bold text-lg text-white">{stat.value}</p>}
              <p className="text-[10px] text-white font-body">{label}</p>
            </div>
          )
        })}
        <motion.div
          className="card relative text-center py-3"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {streakCelebration && !reduceMotion && (
            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.16, 0] }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{ background: 'radial-gradient(ellipse at center, rgba(244,217,137,0.45), transparent 72%)' }}
            />
          )}
          <div className="relative flex items-center justify-center mb-0.5 w-full h-6">
            <motion.span
              animate={streakCelebration && !reduceMotion ? { scale: [1, 1.35, 1], rotate: [0, -7, 5, 0] } : undefined}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'inline-flex' }}
            >
              <Flame
              ref={streakIconRef}
              size={20}
              className={streakCompletedToday && !streakFlameFlight && !streakCelebration ? 'fire-icon' : ''}
              style={canAccessProUi && streakCompletedToday && !streakFlameFlight
                ? { color: GOLD, fill: GOLD }
                : { color: canAccessProUi ? 'rgba(255,255,255,0.32)' : GOLD }}
              />
            </motion.span>
          </div>
          {canAccessProUi
            ? <motion.p
                className="font-mono font-bold text-lg text-white"
                animate={streakCelebration && !reduceMotion ? { scale: [1, 1.2, 1] } : undefined}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              >{streak.current > 0 ? `${streak.current}d` : 'N/A'}</motion.p>
            : <LockKeyhole size={19} className="mx-auto my-[3px]" style={{ color: GOLD }} aria-hidden="true" />}
          <p className="text-[10px] text-white font-body">Current Streak</p>
        </motion.div>
      </div>

      {showProgressData && <div className="card mb-4 overflow-hidden">
        <button
          type="button"
          aria-label={`Score trends, ${metricOptions.find(metric => metric.key === progressMetric)?.label ?? 'Overall'} metric selected`}
          aria-expanded={graphExpanded}
          onClick={() => { setGraphExpanded(value => !value); triggerHaptic() }}
          className="relative w-full flex items-center justify-center gap-3 px-4 py-3 text-center"
        >
          <span className="flex items-center justify-center gap-2 font-heading font-semibold text-sm text-primary">
            <TrendingUp size={16} style={{ color: GOLD }} />
            Score trends
          </span>
          <span className="absolute right-4 flex items-center gap-2 text-secondary" aria-hidden="true">
            <ChevronDown size={15} className={`transition-transform duration-200 ${graphExpanded ? 'rotate-180' : ''}`} />
          </span>
        </button>
        <AnimatePresence initial={false}>
          {graphExpanded && (
            <motion.div initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={reduceMotion ? undefined : { height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3">
                <div className="flex gap-2 overflow-x-auto pb-3" role="group" aria-label="Score graph metric">
                  {metricOptions.map(({ key, label }) => {
                    const selected = progressMetric === key
                    return (
                      <button key={key} type="button" onClick={() => setProgressMetric(key)} aria-pressed={selected}
                        className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-body transition-colors"
                        style={{ color: selected ? GOLD : 'rgba(255,255,255,0.55)', border: `1px solid ${selected ? 'rgba(198,168,92,0.55)' : 'rgba(255,255,255,0.12)'}`, background: selected ? 'rgba(198,168,92,0.1)' : 'transparent' }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
                {activeHistory.length >= 2
                  ? <TrendChart scans={activeHistory} mode="face" metric={progressMetric} label={metricOptions.find(metric => metric.key === progressMetric)?.label ?? 'Overall'} locked={progressTrend.locked} />
                  : <p className="font-body text-xs text-secondary text-center py-5">Save another scan to see your trend.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>}

      {showProgressData && (
        <section aria-label="Scan History" className="mt-2">
          <h2 className="font-heading font-bold text-[20px] text-primary mb-4">Scan History</h2>
          <ScanHistoryContent
            embedded scans={activeHistory.map(normalizeHistoryScan)} loading={loading} canAccessProUi={canAccessProUi}
            entryScanId={entryScanId}
            error={null}
            onViewScan={viewHistoryScan}
            emptyMessage="No face scans saved to Progress yet."
          />
        </section>
      )}

      <div className="pb-8" />
      {flameFlight && createPortal(
        <motion.div
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{ x: flameFlight.deltaX, y: flameFlight.deltaY, scale: flameFlight.scale }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => {
            setFlameFlight(null)
            setStreakCelebration(true)
            navigate('/timeline', { replace: true, state: null })
          }}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: flameFlight.origin.left,
            top: flameFlight.origin.top,
            width: flameFlight.origin.width,
            height: flameFlight.origin.height,
            transformOrigin: 'center center',
            zIndex: 9999,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        >
          <Flame size={24} strokeWidth={2.5} fill="#D4B96A" color="#F4D989" />
        </motion.div>,
        document.body,
      )}
    </MotionPage>
  )
}
