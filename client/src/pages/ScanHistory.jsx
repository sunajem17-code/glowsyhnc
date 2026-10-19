import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Camera, Lock, TrendingUp, ChevronRight, ChevronLeft } from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

import ScanHistoryRow from '../components/ScanHistoryRow'
import { mergeScanHistory } from '../utils/scanHistory'
import { getProgressScore } from '../utils/progressHistory'

function fmt(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Custom recharts tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid rgba(198,168,92,0.3)',
      borderRadius: 10, padding: '8px 12px', fontSize: 12,
    }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{d.label}</p>
      <p style={{ color: GOLD, fontWeight: 700, fontSize: 16 }}>{d.score.toFixed(1)}</p>
    </div>
  )
}

// ── Pro gate (full-page) ──────────────────────────────────────────────────────
function ProGate({ onUpgrade }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-6">
      <div style={{
        width: 72, height: 72, borderRadius: 24,
        background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Lock size={28} style={{ color: GOLD }} />
      </div>
      <div>
        <h2 className="font-heading font-bold text-[22px] text-primary mb-2" style={{ letterSpacing: '-0.02em' }}>
          Scan History is Pro
        </h2>
        <p className="font-body text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Upgrade to see every past scan, track your score over time, and spot exactly what's improving.
        </p>
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => { triggerHaptic(); onUpgrade() }}
        className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
        style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
      >
        Unlock Pro
      </motion.button>
    </div>
  )
}

// ── Trend chart ───────────────────────────────────────────────────────────────
function TrendChart({ scans, mode = 'face', metric = 'overall', label = 'Overall' }) {
  const data = [...scans]
    .reverse()
    .map(s => ({ label: fmt(s.analyzedAt || s.scan_date || s.created_at), score: getProgressScore(s, mode, metric) }))
    .filter(point => point.score != null)

  if (data.length < 2) return null

  const min = Math.max(0, Math.min(...data.map(d => d.score)) - 1)
  const max = Math.min(10, Math.max(...data.map(d => d.score)) + 1)

  return (
    <div style={{
      background: '#141414', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20, padding: '18px 12px 14px', marginBottom: 20,
    }}>
      <div className="flex items-center gap-2 mb-4 px-2">
        <TrendingUp size={15} style={{ color: GOLD }} />
        <p className="font-heading font-bold text-[11px] tracking-[0.14em]" style={{ color: GOLD }}>
          {label.toUpperCase()} OVER TIME
        </p>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[min, max]}
            tickFormatter={value => Number(value).toFixed(1)}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={22}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={GOLD}
            strokeWidth={2}
            dot={{ fill: GOLD, strokeWidth: 0, r: 3 }}
            activeDot={{ fill: GOLD, r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScanHistory() {
  const navigate = useNavigate()
  const isPremium = useStore(s => s.isPremium)
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
    if (!isPremium) { setLoading(false); return }
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
  }, [isPremium, token])

  function viewScan(scan) {
    setCurrentScan(scan)
    navigate('/unlock')
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

      <ScanHistoryContent scans={scans} loading={loading} error={error} isPremium={isPremium} onViewScan={viewScan} onUpgrade={() => navigate('/premium')} />
    </MotionPage>
  )
}

export function ScanHistoryContent({ scans, loading, error, isPremium, onViewScan, onUpgrade, embedded = false, chartMode = 'face', chartMetric = 'overall', chartLabel = 'Overall', emptyMessage = 'No scans yet. Complete your first scan to see your history here.' }) {
  return (<>
      {/* Body */}
      {!isPremium ? (
        <ProGate onUpgrade={onUpgrade} />
      ) : loading && scans.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-body text-[14px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading…</p>
        </div>
      ) : error && scans.length === 0 ? (
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
          <TrendChart scans={scans} mode={chartMode} metric={chartMetric} label={chartLabel} />
          <p className="font-heading font-bold text-[11px] tracking-[0.14em] mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {scans.length} SCAN{scans.length !== 1 ? 'S' : ''}
          </p>
          {scans.map((scan, i) => (
            <ScanHistoryRow key={scan.id} scan={scan} index={i} onTap={onViewScan} />
          ))}
        </div>
      )}
  </>)
}
