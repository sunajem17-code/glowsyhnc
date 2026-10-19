import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Trophy, Camera, Star, Flame, Sprout, TrendingDown, ChevronLeft } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { getProgressScore, isPhysiqueProgressScan, mergeProgressHistory } from '../utils/progressHistory'
import { ScanHistoryContent } from './ScanHistory'
import { normalizeHistoryScan } from '../utils/scanHistory'

export default function ScanTimeline() {
  const navigate = useNavigate()
  const { scans, currentScan, streak, isPremium, token } = useStore()
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const [historySnapshot, setHistory] = useState({ token, scans: [] })
  const remoteHistory = historySnapshot.token === token ? historySnapshot.scans : []
  const history = mergeProgressHistory(remoteHistory, scans, currentScan)
  const [progressMode, setProgressMode] = useState('face')
  const [progressMetric, setProgressMetric] = useState('overall')
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
  }, [token, isDemo])

  const firstScan      = activeHistory.length > 0 ? activeHistory[activeHistory.length - 1] : null
  const latestScan     = activeHistory.length > 0 ? activeHistory[0] : null
  const activeScores = activeHistory.map(scan => getProgressScore(scan, progressMode, 'overall')).filter(Number.isFinite)
  const bestScore      = activeScores.length ? Math.max(...activeScores) : null
  const improvement    = firstScan && latestScan
    ? (getProgressScore(latestScan, progressMode, 'overall') - getProgressScore(firstScan, progressMode, 'overall')).toFixed(1) : null
  const improvementNum = improvement !== null ? parseFloat(improvement) : null

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
      </div>

      {/* Overview stats */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }} role="tablist" aria-label="Progress type">
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
                className="py-2.5 rounded-xl font-heading font-semibold text-sm transition-colors"
                style={{ color: selected ? '#0A0A0A' : 'rgba(255,255,255,0.58)', background: selected ? GOLD : 'transparent' }}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1" role="group" aria-label="Score graph metric">
          {metricOptions.map(({ key, label }) => {
            const selected = progressMetric === key
            return (
              <button key={key} type="button" onClick={() => setProgressMetric(key)}
                aria-pressed={selected}
                className="flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-body transition-colors"
                style={{ color: selected ? GOLD : 'rgba(255,255,255,0.55)', border: `1px solid ${selected ? 'rgba(198,168,92,0.55)' : 'rgba(255,255,255,0.12)'}`, background: selected ? 'rgba(198,168,92,0.1)' : 'transparent' }}>
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: `${progressMode === 'face' ? 'Face' : 'Physique'} Scans`, value: activeHistory.length || 'N/A', icon: <Camera size={20} style={{ color: GOLD }} /> },
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
          <span>{history.length > 0 ? 'Couldn’t refresh scan history. Showing your saved results.' : 'Couldn’t load scan history.'}</span>
        </div>
      )}

      {activeHistory.length >= 2 && isPremium && (
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
          embedded scans={activeHistory.map(normalizeHistoryScan)} loading={loading}
          error={historyError ? 'Couldn’t refresh scan history. Please try again.' : null}
          isPremium={isPremium} onViewScan={viewHistoryScan} onUpgrade={() => navigate('/premium')}
          chartMode={progressMode} chartMetric={progressMetric}
          chartLabel={metricOptions.find(metric => metric.key === progressMetric)?.label ?? 'Overall'}
          emptyMessage={progressMode === 'face' ? 'No face scans saved to Progress yet.' : 'No physique scans yet. Complete a physique scan to start tracking these scores.'}
        />
      </section>

      <div className="pb-8" />
    </MotionPage>
  )
}
