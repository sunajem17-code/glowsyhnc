import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Camera, Lock, TrendingUp, ChevronRight, ArrowLeft } from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const API_BASE = (import.meta.env.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app').replace(/\/$/, '')

function thumbnail(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${API_BASE}${url}`
}

function fmt(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreColor(s) {
  if (s == null) return 'rgba(255,255,255,0.4)'
  if (s >= 8) return '#C6A85C'
  if (s >= 6) return '#6EE7B7'
  if (s >= 4) return '#FCD34D'
  return '#F87171'
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
function TrendChart({ scans }) {
  const data = [...scans]
    .filter(s => s.glowScore != null)
    .reverse()
    .map(s => ({
      label: fmt(s.analyzedAt || s.scan_date),
      score: typeof s.glowScore === 'number' ? s.glowScore : parseFloat(s.glowScore),
    }))

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
          SCORE OVER TIME
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

// ── Single scan row ───────────────────────────────────────────────────────────
function ScanRow({ scan, onTap, index }) {
  const thumb = thumbnail(scan.facePhotoUrl || scan.face_photo_url)
  const date = fmt(scan.analyzedAt || scan.scan_date)
  const score = scan.glowScore != null
    ? (typeof scan.glowScore === 'number' ? scan.glowScore : parseFloat(scan.glowScore))
    : null

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { triggerHaptic(); onTap(scan) }}
      className="w-full text-left flex items-center gap-4"
      style={{
        background: '#141414', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18, padding: '14px 14px 14px 14px',
        marginBottom: 10,
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 58, height: 58, borderRadius: 14, overflow: 'hidden',
        background: '#222', flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {thumb ? (
          <img src={thumb} alt="Scan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-[15px] text-primary leading-tight">{date}</p>
        {scan.tier && (
          <span
            className="font-heading font-bold text-[10px] tracking-wide mt-0.5 inline-block"
            style={{ color: GOLD }}
          >
            {scan.tier.toUpperCase()}
          </span>
        )}
      </div>

      {/* Score */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {score != null && (
          <p
            className="font-heading font-bold text-[22px]"
            style={{ color: scoreColor(score), letterSpacing: '-0.02em' }}
          >
            {score.toFixed(1)}
          </p>
        )}
        <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
      </div>
    </motion.button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScanHistory() {
  const navigate = useNavigate()
  const isPremium = useStore(s => s.isPremium)
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isPremium) { setLoading(false); return }
    api.scan.history()
      .then(data => {
        const list = (data?.scans ?? []).map(s => ({
          id:            s.id,
          glowScore:     s.glow_score,
          faceTotalScore: s.face_total_score,
          bodyTotalScore: s.body_total_score,
          presentationScore: s.presentation_score,
          faceData:      s.faceData ?? (s.face_data ? JSON.parse(s.face_data) : null),
          bodyData:      s.bodyData ?? (s.body_data ? JSON.parse(s.body_data) : null),
          insights:      s.insights ?? [],
          facePhotoUrl:  s.face_photo_url,
          analyzedAt:    s.analyzed_at,
          scan_date:     s.scan_date,
          tier:          s.faceData?.tier ?? null,
        }))
        setScans(list)
      })
      .catch(err => setError(err.message || 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [isPremium])

  function viewScan(scan) {
    setCurrentScan(scan)
    navigate('/results')
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
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </motion.button>
        <h1 className="font-heading font-bold text-[20px] text-primary" style={{ letterSpacing: '-0.02em' }}>
          Scan History
        </h1>
      </div>

      {/* Body */}
      {!isPremium ? (
        <ProGate onUpgrade={() => navigate('/premium')} />
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-body text-[14px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Loading…</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="font-body text-[14px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{error}</p>
        </div>
      ) : scans.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <Camera size={44} style={{ color: 'rgba(255,255,255,0.12)' }} />
          <p className="font-body text-[14px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No scans yet. Complete your first scan to see your history here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          <TrendChart scans={scans} />
          <p className="font-heading font-bold text-[11px] tracking-[0.14em] mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {scans.length} SCAN{scans.length !== 1 ? 'S' : ''}
          </p>
          {scans.map((scan, i) => (
            <ScanRow key={scan.id} scan={scan} index={i} onTap={viewScan} />
          ))}
        </div>
      )}
    </MotionPage>
  )
}
