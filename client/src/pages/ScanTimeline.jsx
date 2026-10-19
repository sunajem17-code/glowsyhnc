import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Trophy, Camera, Star, Flame, Sprout, TrendingDown, ChevronLeft } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { mergeProgressHistory } from '../utils/progressHistory'
import { ScanHistoryContent } from './ScanHistory'
import { normalizeHistoryScan } from '../utils/scanHistory'

export default function ScanTimeline() {
  const navigate = useNavigate()
  const { scans, currentScan, streak, isPremium, token } = useStore()
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const [historySnapshot, setHistory] = useState({ token, scans: [] })
  const remoteHistory = historySnapshot.token === token ? historySnapshot.scans : []
  const history = mergeProgressHistory(remoteHistory, scans, currentScan)
  const [loading, setLoading]     = useState(true)
  const [historyError, setHistoryError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const isDemo = !token || token === 'demo-token'

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
        {[
          { label: 'Total Scans',    value: history.length || scans.length || 'N/A', icon: <Camera size={20} style={{ color: GOLD }} /> },
          { label: 'Best Score',     value: bestScore != null ? bestScore.toFixed(1) : 'N/A', icon: <Trophy size={20} style={{ color: GOLD }} /> },
          { label: 'Current Streak', value: streak.current > 0 ? `${streak.current}d` : 'N/A', icon: <Flame size={20} style={{ color: '#FF6B35' }} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="card text-center py-3">
            <div className="flex justify-center mb-0.5">{icon}</div>
            <p className="font-mono font-bold text-lg text-primary">{value}</p>
            <p className="text-[10px] text-secondary font-body">{label}</p>
          </div>
        ))}
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
    </MotionPage>
  )
}
