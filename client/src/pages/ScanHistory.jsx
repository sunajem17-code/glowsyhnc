import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CartesianGrid, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Camera, TrendingUp, ChevronRight, ChevronLeft, LockKeyhole } from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

import ScanHistoryRow from '../components/ScanHistoryRow'
import { mergeScanHistory } from '../utils/scanHistory'
import { hasLocalPremiumUiAccess } from '../utils/developerUnlock'
import { formatProgressTrendLabels, getProgressTrendAxisTicks, getProgressTrendChartSeries, isPhysiqueProgressScan } from '../utils/progressHistory'
import { loadScanMedia } from '../utils/scanPhotoDb'
import { getScanHistoryViewState } from '../utils/scanHistoryPresentation'

// ── Custom recharts tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid rgba(198,168,92,0.3)',
      borderRadius: 10, padding: '8px 12px', fontSize: 12,
    }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{d.shortLabel} · {d.fullLabel}</p>
      <p style={{ color: GOLD, fontWeight: 700, fontSize: 16 }}>{d.score.toFixed(1)}</p>
    </div>
  )
}

// ── Trend chart ───────────────────────────────────────────────────────────────
export function TrendChart({ scans, mode = 'face', metric = 'overall', label = 'Overall', locked = false }) {
  const series = getProgressTrendChartSeries(scans, mode, metric, locked)
  const dateLabels = formatProgressTrendLabels(series)
  const data = series.map((point, index) => ({ ...dateLabels[index], score: point.score }))
  const showLine = !locked

  if (data.length < 2) return null

  // The locked preview shows the chart frame, not score-derived axis bounds.
  // This avoids leaking hidden Potential values through the scale or labels.
  const scores = data.map(point => point.score).filter(Number.isFinite)
  const min = locked || scores.length === 0 ? 0 : Math.max(0, Math.min(...scores) - 1)
  const max = locked || scores.length === 0 ? 10 : Math.min(10, Math.max(...scores) + 1)

  return (
    <div style={{
      background: '#141414', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20, padding: '18px 14px 14px', marginBottom: 20,
    }}>
      <div className="flex items-center justify-center gap-2 mb-4 px-2">
        <TrendingUp size={15} style={{ color: GOLD }} />
        <p className="font-heading font-bold text-[11px] tracking-[0.14em]" style={{ color: GOLD }}>
          {label.toUpperCase()} OVER TIME
        </p>
      </div>
      <div className="w-full flex justify-center relative">
      <ResponsiveContainer width="100%" height={188}>
        <LineChart data={data} margin={{ left: 8, right: 14, top: 8, bottom: 2 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" />
          <XAxis
            dataKey="shortLabel"
            tick={{ fill: 'rgba(255,255,255,0.68)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            tickMargin={8}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            domain={[min, max]}
            ticks={getProgressTrendAxisTicks(locked)}
            tickFormatter={value => Number(value).toFixed(1)}
            tick={{ fill: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          {showLine && <Tooltip content={<ChartTooltip />} />}
          {showLine && <Line
            type="monotone"
            dataKey="score"
            stroke={GOLD}
            strokeWidth={2.5}
            dot={{ fill: GOLD, stroke: '#141414', strokeWidth: 2, r: 4 }}
            activeDot={{ fill: GOLD, r: 6, strokeWidth: 0 }}
          />}
        </LineChart>
      </ResponsiveContainer>
      {!showLine && (
        <div aria-label="Trend line locked with Ascendus Max" style={{ position: 'absolute', left: '52%', top: '48%', transform: 'translate(-50%, -50%)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <LockKeyhole size={24} strokeWidth={1.8} style={{ color: GOLD, filter: 'drop-shadow(0 0 8px rgba(198,168,92,0.32))' }} />
        </div>
      )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScanHistory() {
  const navigate = useNavigate()
  const isPremium = useStore(s => s.isPremium)
  const canAccessProUi = hasLocalPremiumUiAccess(isPremium)
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const localScans = useStore(s => s.scans)
  const currentScan = useStore(s => s.currentScan)
  const token = useStore(s => s.token)
  const refreshProStatus = useStore(s => s.refreshProStatus)
  const [historySnapshot, setScans] = useState({ token, scans: [] })
  const scans = mergeScanHistory(historySnapshot.token === token ? historySnapshot.scans : [], localScans, currentScan)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The app-wide premium flag may still be stale when returning from checkout.
  // Refresh the authoritative entitlement as soon as this gated page is opened.
  useEffect(() => {
    refreshProStatus({ force: true })
  }, [refreshProStatus, token])

  useEffect(() => {
    if (!canAccessProUi) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    api.scan.history()
      .then(data => {
        if (!cancelled) setScans({ token, scans: data?.scans ?? [] })
      })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load history') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [canAccessProUi, token])

  async function viewScan(scan) {
    const media = scan?.id ? await loadScanMedia(scan.id) : null
    setCurrentScan({ ...scan, facePhotoUrl: scan.facePhotoUrl || media?.photo || null })
    navigate(isPhysiqueProgressScan(scan) ? '/physique-results' : '/unlock')
  }

  return (
    <MotionPage className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 14 }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { triggerHaptic(); navigate(-1) }}
          aria-label="Go back"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ChevronLeft size={18} className="text-primary" />
        </motion.button>
        <h1 className="font-heading font-bold text-[20px] text-primary" style={{ letterSpacing: '-0.02em' }}>
          Scan History
        </h1>
      </div>

      <ScanHistoryContent scans={scans} loading={loading} error={error} onViewScan={viewScan} />
    </MotionPage>
  )
}

export function ScanHistoryContent({ scans, loading, error, onViewScan, embedded = false, canAccessProUi = true, emptyMessage = 'No scans yet. Complete your first scan to see your history here.' }) {
  const viewState = getScanHistoryViewState({ scanCount: scans.length, loading, error })
  return (<>
      {/* Body */}
      {viewState === 'loading' ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-body text-[14px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading…</p>
        </div>
      ) : viewState === 'error' ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="font-body text-[14px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{error}</p>
        </div>
      ) : scans.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <Camera size={44} style={{ color: 'rgba(255,255,255,0.12)' }} />
          <p className="font-body text-[14px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className={embedded ? "pb-4" : "flex-1 overflow-y-auto px-5 pb-8"}>
          {!embedded && loading && <p role="status" className="text-xs text-secondary mb-3">Refreshing history…</p>}
          {!embedded && error && <p role="status" className="text-xs text-secondary mb-3">Showing scans saved on this device. Server history couldn’t refresh.</p>}
          {!embedded && <TrendChart scans={scans} />}
          {!embedded && <p className="font-heading font-bold text-[11px] tracking-[0.14em] mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {scans.length} SCAN{scans.length !== 1 ? 'S' : ''}
          </p>}
          {scans.map((scan, i) => (
            <ScanHistoryRow key={scan.id} scan={scan} index={i} onTap={onViewScan} canAccessProUi={canAccessProUi} />
          ))}
        </div>
      )}
  </>)
}
