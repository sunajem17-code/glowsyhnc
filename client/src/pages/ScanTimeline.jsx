import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { TrendingUp, Trophy, Camera, Star, Flame, Sprout, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { mergeProgressHistory } from '../utils/progressHistory'
import { ScanHistoryContent } from './ScanHistory'
import { normalizeHistoryScan } from '../utils/scanHistory'
import StreakFlame from '../components/StreakFlame'

export default function ScanTimeline() {
  const navigate = useNavigate()
  const location = useLocation()
  const { scans, currentScan, streak, isPremium, token } = useStore()
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const [historySnapshot, setHistory] = useState({ token, scans: [] })
  const remoteHistory = historySnapshot.token === token ? historySnapshot.scans : []
  const history = mergeProgressHistory(remoteHistory, scans, currentScan)
  const [loading, setLoading]     = useState(true)
  const [historyError, setHistoryError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [flameFlight, setFlameFlight] = useState(null)
  const streakIconRef = useRef(null)
  const isDemo = !token || token === 'demo-token'
  const streakFlameFlight = location.state?.streakFlameFlight === true
  const flameOrigin = location.state?.flameOrigin ?? null
  const streakCompletedToday = streak.current > 0
    && Boolean(streak.lastDate)
    && new Date(streak.lastDate).toDateString() === new Date().toDateString()

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
    if (isDemo) { setLoading(false); return }
    setLoading(true)
    api.supabase.getScans()
      .then(({ scans: h }) => { if (!cancelled) setHistory({ token, scans: h || [] }) })
      .catch(() => { if (!cancelled) setHistoryError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, isDemo, refreshKey])

  const firstScan      = history.length > 0 ? history[history.length - 1] : null
  const latestScan     = history.length > 0 ? history[0] : null
  const bestScore      = history.length > 0 ? Math.max(...history.map(h => Number(h.overall_score))) : null
  const improvement    = firstScan && latestScan
    ? (Number(latestScan.overall_score) - Number(firstScan.overall_score)).toFixed(1) : null
  const improvementNum = improvement !== null ? parseFloat(improvement) : null
  const hasEnoughData  = history.length >= 2

  function viewHistoryScan(entry) {
    const saved = currentScan?.id === entry.id ? currentScan
      : scans.find(scan => scan.id === entry.id || scan.serverScanId === entry.id)
    setCurrentScan(saved || normalizeHistoryScan(entry))
    navigate('/unlock')
  }



  return (
    <MotionPage className="px-4">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button
          onClick={() => { triggerHaptic(); navigate(-1) }}
          aria-label="Go back"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
        >
          <ChevronLeft size={18} className="text-primary" />
        </button>
        <div className="flex-1">
          <h1 className="font-heading font-bold text-[22px] text-primary leading-tight" style={{ letterSpacing: '-0.02em' }}>
            Progress
          </h1>
          <p className="font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Track your glow-up journey</p>
        </div>
        {!isDemo && <button
          type="button"
          onClick={() => { triggerHaptic(); setRefreshKey(key => key + 1) }}
          disabled={loading}
          className="text-xs font-body font-bold disabled:opacity-50"
          style={{ color: GOLD }}
        >{loading ? 'Refreshing…' : 'Refresh'}</button>}
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card text-center py-3">
          <div className="flex justify-center mb-0.5"><Camera size={20} style={{ color: GOLD }} /></div>
          <p className="font-mono font-bold text-lg text-primary">{history.length || scans.length || 'N/A'}</p>
          <p className="text-[10px] text-secondary font-body">Total Scans</p>
        </div>
        <div className="card text-center py-3">
          <div className="flex justify-center mb-0.5"><Trophy size={20} style={{ color: GOLD }} /></div>
          <p className="font-mono font-bold text-lg text-primary">{bestScore != null ? bestScore.toFixed(1) : 'N/A'}</p>
          <p className="text-[10px] text-secondary font-body">Best Score</p>
        </div>
        <button
          type="button"
          onClick={() => { triggerHaptic(); navigate('/streak') }}
          aria-label={`Open current streak details, ${streak.current} days`}
          className="card relative text-center py-3 active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: GOLD }}
        >
          <ChevronRight size={14} className="absolute right-2 top-2 text-secondary" aria-hidden="true" />
          <div ref={streakIconRef} className="flex justify-center mb-0.5 w-6 h-6">
            <Flame
              size={20}
              className={streakCompletedToday && !streakFlameFlight ? 'fire-icon' : ''}
              style={streakCompletedToday && !streakFlameFlight
                ? { color: GOLD, fill: GOLD, filter: 'drop-shadow(0 0 8px rgba(198,168,92,0.8))' }
                : { color: 'rgba(255,255,255,0.32)' }}
            />
          </div>
          <p className="font-mono font-bold text-lg text-primary">{streak.current > 0 ? `${streak.current}d` : 'N/A'}</p>
          <p className="text-[10px] text-secondary font-body">Current Streak</p>
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
          <span>{history.length > 0 ? 'Couldn’t refresh scan history. Showing your saved results.' : 'Couldn’t load scan history. Please try again.'}</span>
          <button onClick={() => setRefreshKey(key => key + 1)} className="flex-shrink-0 font-bold" style={{ color: GOLD }}>Retry</button>
        </div>
      )}

      {hasEnoughData && isPremium && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'First Score',   value: Number(firstScan.overall_score).toFixed(1), icon: <Sprout size={20} style={{ color: '#34C759' }} /> },
                  { label: 'Current Score', value: Number(latestScan.overall_score).toFixed(1), icon: <Star size={20} style={{ color: GOLD, fill: GOLD }} /> },
                  {
                    label: 'Improvement',
                    value: `${improvementNum >= 0 ? '+' : ''}${improvement}`,
                    icon:  improvementNum >= 0 ? <TrendingUp size={20} style={{ color: GOLD }} /> : <TrendingDown size={20} style={{ color: '#E07A5F' }} />,
                    colorStyle: improvementNum >= 0 ? { color: GOLD } : { color: '#E07A5F' },
                  },
                ].map(({ label, value, icon, colorStyle }) => (
                  <div key={label} className="card text-center py-3">
                    <div className="flex justify-center mb-0.5">{icon}</div>
                    <p className="font-mono font-bold text-lg text-primary" style={colorStyle}>{value}</p>
                    <p className="text-[10px] text-secondary font-body">{label}</p>
                  </div>
                ))}
              </div>

      )}

      <section aria-label="Scan History" className="mt-2">
        <h2 className="font-heading font-bold text-[20px] text-primary mb-4">Scan History</h2>
        <ScanHistoryContent
          embedded scans={history.map(normalizeHistoryScan)} loading={loading}
          error={historyError ? 'Couldn’t refresh scan history. Please try again.' : null}
          isPremium={isPremium} onViewScan={viewHistoryScan} onUpgrade={() => navigate('/premium')}
        />
      </section>

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
