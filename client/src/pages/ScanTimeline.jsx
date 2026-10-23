import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { TrendingUp, Trophy, Camera, Flame, ChevronRight, ChevronDown, LockKeyhole } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { getProgressScore, isPhysiqueProgressScan, mergeProgressHistory } from '../utils/progressHistory'
import { ScanHistoryContent, TrendChart } from './ScanHistory'
import { normalizeHistoryScan } from '../utils/scanHistory'
import StreakFlame from '../components/StreakFlame'
import { loadScanMedia } from '../utils/scanPhotoDb'
import { getProgressStatPresentation, getProgressTrendPresentation, shouldShowProgressData } from '../utils/scanHistoryPresentation'
import { hasLocalPremiumUiAccess } from '../utils/developerUnlock'

export default function ScanTimeline() {
  const navigate = useNavigate()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const { scans, currentScan, streak, isPremium, token, refreshProStatus } = useStore()
  const canAccessProUi = hasLocalPremiumUiAccess(isPremium)
  const showProgressData = shouldShowProgressData()
  const progressTrend = getProgressTrendPresentation(canAccessProUi)
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const [historySnapshot, setHistory] = useState({ token, scans: [] })
  const remoteHistory = historySnapshot.token === token ? historySnapshot.scans : []
  const history = mergeProgressHistory(remoteHistory, scans, currentScan)
  const [progressMode, setProgressMode] = useState('face')
  const [progressMetric, setProgressMetric] = useState('overall')
  const [graphExpanded, setGraphExpanded] = useState(false)
  const faceHistory = history.filter(scan => !isPhysiqueProgressScan(scan) && getProgressScore(scan, 'face', 'overall') != null)
  const physiqueHistory = history.filter(scan => isPhysiqueProgressScan(scan) && getProgressScore(scan, 'physique', 'overall') != null)
  const activeHistory = progressMode === 'physique' ? physiqueHistory : faceHistory
  const metricOptions = progressMode === 'physique'
    ? [
        { key: 'overall', label: 'Overall' }, { key: 'proportions', label: 'Proportions' },
        { key: 'leanness', label: 'Leanness' }, { key: 'frame', label: 'Frame' },
        { key: 'posture', label: 'Posture' }, { key: 'presentation', label: 'Presentation' },
      ]
    : [
        { key: 'overall', label: 'Overall' }, { key: 'potential', label: 'Potential' },
        { key: 'symmetry', label: 'Symmetry' }, { key: 'skin', label: 'Skin' }, { key: 'jawline', label: 'Jawline' },
      ]
  const [loading, setLoading]     = useState(true)
  const [historyError, setHistoryError] = useState(false)
  const [flameFlight, setFlameFlight] = useState(null)
  const streakIconRef = useRef(null)
  const isDemo = !token || token === 'demo-token'
  const streakFlameFlight = location.state?.streakFlameFlight === true
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
    if (!streakFlameFlight) return undefined
    let finishTimer
    const startTimer = setTimeout(() => {
      const target = streakIconRef.current?.getBoundingClientRect()
      if (!flameOrigin || !target) {
        navigate('/timeline', { replace: true, state: null })
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
      finishTimer = setTimeout(() => {
        setFlameFlight(null)
        navigate('/timeline', { replace: true, state: null })
      }, 1500)
    }, 450)
    return () => {
      clearTimeout(startTimer)
      if (finishTimer) clearTimeout(finishTimer)
    }
  }, [flameOrigin, streakFlameFlight, navigate])

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

  const activeScores = activeHistory.map(scan => getProgressScore(scan, progressMode, 'overall')).filter(Number.isFinite)
  const bestScore      = activeScores.length ? Math.max(...activeScores) : null

  async function viewHistoryScan(entry) {
    const saved = currentScan?.id === entry.id ? currentScan
      : scans.find(scan => scan.id === entry.id || scan.serverScanId === entry.id)
    const selected = saved || normalizeHistoryScan(entry)
    const media = selected?.id ? await loadScanMedia(selected.id) : null
    setCurrentScan({ ...selected, facePhotoUrl: selected.facePhotoUrl || media?.photo || null })
    if (isPhysiqueProgressScan(entry)) {
      navigate('/physique-results', { state: { source: 'progress-card', returnTo: '/timeline' } })
      return
    }
    navigate('/unlock', { state: { source: 'progress-card', returnTo: '/timeline' } })
  }



  return (
    <MotionPage className="px-4 progress-timeline">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <h1 className="font-heading font-bold text-[22px] text-primary leading-tight" style={{ letterSpacing: '-0.02em' }}>
          Progress
        </h1>
        <motion.div layout className="relative flex rounded-full p-1 flex-shrink-0" style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)' }} role="tablist" aria-label="Progress type">
          {[
            { key: 'face', label: 'Face' },
            { key: 'physique', label: 'Physique' },
          ].map(({ key, label }) => {
            const selected = progressMode === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => { setProgressMode(key); setProgressMetric('overall'); triggerHaptic() }}
                className="relative px-3 py-1.5 rounded-full font-heading font-semibold text-[11px] transition-colors duration-200"
                style={{ color: selected ? '#fff' : 'rgba(255,255,255,0.58)' }}
              >
                {selected && <motion.span layoutId="progress-mode-indicator" className="absolute inset-0 rounded-full" style={{ background: '#242424', zIndex: 0 }} transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative z-[1]">{label}</span>
              </button>
            )
          })}
        </motion.div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: `${progressMode === 'face' ? 'Face' : 'Physique'} Scans`, value: activeHistory.length || 'N/A', icon: <Camera size={20} style={{ color: GOLD }} />, lockable: true },
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
        <button
          type="button"
          onClick={() => { triggerHaptic(); navigate(canAccessProUi ? '/streak' : '/premium') }}
          aria-label={canAccessProUi ? `Open current streak details, ${streak.current} days` : 'Current streak locked'}
          className="card relative text-center py-3 active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: GOLD }}
        >
          <ChevronRight size={14} className="absolute right-2 top-2 text-secondary" aria-hidden="true" />
          <div className="relative flex items-center justify-center mb-0.5 w-full h-6">
            <Flame
              ref={streakIconRef}
              size={20}
              className={streakCompletedToday && !streakFlameFlight ? 'fire-icon' : ''}
              style={canAccessProUi && streakCompletedToday && !streakFlameFlight
                ? { color: GOLD, fill: GOLD, filter: 'drop-shadow(0 0 4px rgba(198,168,92,0.42))' }
                : { color: canAccessProUi ? 'rgba(255,255,255,0.32)' : GOLD }}
            />
          </div>
          {canAccessProUi
            ? <p className="font-mono font-bold text-lg text-white">{streak.current > 0 ? `${streak.current}d` : 'N/A'}</p>
            : <LockKeyhole size={19} className="mx-auto my-[3px]" style={{ color: GOLD }} aria-hidden="true" />}
          <p className="text-[10px] text-white font-body">Current Streak</p>
        </button>
      </div>

      {/* History refresh never blocks saved results or page navigation. */}
      {loading && (
        <p role="status" className="text-xs text-secondary font-body mb-4">
          {history.length > 0 ? 'Refreshing scan history…' : 'Loading scan history…'}
        </p>
      )}
      {historyError && (
        <div role="status" className="flex items-center justify-between gap-3 mb-4 text-xs text-secondary font-body">
          <span>{history.length > 0 ? 'Couldn’t refresh scan history. Showing your saved results.' : 'Couldn’t load scan history.'}</span>
        </div>
      )}

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
                  ? <TrendChart scans={activeHistory} mode={progressMode} metric={progressMetric} label={metricOptions.find(metric => metric.key === progressMetric)?.label ?? 'Overall'} locked={progressTrend.locked} />
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
            error={historyError ? 'Couldn’t refresh scan history. Please try again.' : null}
            onViewScan={viewHistoryScan}
            emptyMessage={progressMode === 'face' ? 'No face scans saved to Progress yet.' : 'No physique scans yet. Complete a physique scan to start tracking these scores.'}
          />
        </section>
      )}

      <div className="pb-8" />
      {flameFlight && createPortal(
        <motion.div
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{ x: flameFlight.deltaX, y: flameFlight.deltaY, scale: flameFlight.scale }}
          transition={{ duration: 1.05, ease: [0.22, 0.8, 0.3, 1] }}
          onAnimationComplete={() => {
            setFlameFlight(null)
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
          <StreakFlame size={flameFlight.origin.width} />
        </motion.div>,
        document.body,
      )}
    </MotionPage>
  )
}
