import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { TrendingUp, Calendar, ArrowLeftRight, Share2, Download, Trophy, Camera, Star, Flame, Sprout, Target, TrendingDown, ArrowLeft } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import ProLock from '../components/ProLock'
import { api } from '../utils/api'
import { GOLD, EASE_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const METRIC_TABS = [
  { key: 'glowScore',     label: 'Overall',  color: GOLD },
  { key: 'faceScore',     label: 'Face',     color: '#F5A623' },
  { key: 'groomingScore', label: 'Grooming', color: '#E07A5F' },
]

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawShareCard(canvas, firstScan, latestScan) {
  const W = 600, H = 300
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const diff    = latestScan.overall_score - firstScan.overall_score
  const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })

  ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = GOLD; ctx.fillRect(0, 0, W, 5)

  ctx.fillStyle = '#1E1E1E'; roundRect(ctx, 18, 18, 220, 222, 14); ctx.fill()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#888'; ctx.font = '600 11px Inter, system-ui'; ctx.fillText('FIRST SCAN', 128, 52)
  ctx.fillStyle = GOLD; ctx.font = 'bold 54px Inter, system-ui'; ctx.fillText(firstScan.overall_score.toFixed(1), 128, 118)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter, system-ui'; ctx.fillText(firstScan.tier || '', 128, 146)
  ctx.fillStyle = '#666'; ctx.font = '11px Inter, system-ui'; ctx.fillText(fmtDate(firstScan.created_at), 128, 168)

  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(300, 100, 30, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = GOLD; ctx.font = 'bold 28px Inter, system-ui'; ctx.fillText('↑', 300, 112)
  ctx.fillStyle = diff >= 0 ? GOLD : '#E07A5F'; ctx.font = 'bold 20px Inter, system-ui'; ctx.fillText(diffStr, 300, 156)
  ctx.fillStyle = '#888'; ctx.font = '11px Inter, system-ui'; ctx.fillText('points', 300, 174)

  ctx.fillStyle = '#1E1E1E'; roundRect(ctx, 362, 18, 220, 222, 14); ctx.fill()
  ctx.fillStyle = GOLD; ctx.font = '600 11px Inter, system-ui'; ctx.fillText('NOW', 472, 52)
  ctx.font = 'bold 54px Inter, system-ui'; ctx.fillText(latestScan.overall_score.toFixed(1), 472, 118)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Inter, system-ui'; ctx.fillText(latestScan.tier || '', 472, 146)
  ctx.fillStyle = '#666'; ctx.font = '11px Inter, system-ui'; ctx.fillText(fmtDate(latestScan.created_at), 472, 168)

  ctx.fillStyle = GOLD; ctx.fillRect(0, H - 34, W, 34)
  ctx.fillStyle = '#121212'; ctx.font = 'bold 12px Inter, system-ui'
  ctx.textAlign = 'left'; ctx.fillText('ascendus.store', 18, H - 11)
  ctx.textAlign = 'right'; ctx.fillText('Track your glow up ✨', W - 18, H - 11)
}

function ComparisonSlider({ before, after }) {
  const [sliderPos, setSliderPos] = useState(50)
  const containerRef = useRef()

  function handleMove(e) {
    const rect = containerRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const pos = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100))
    setSliderPos(pos)
  }

  return (
    <div ref={containerRef} className="relative w-full aspect-square rounded-2xl overflow-hidden cursor-col-resize select-none"
      onMouseMove={handleMove} onTouchMove={handleMove}>
      <img src={before} alt="before" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
        <img src={after} alt="after" className="absolute inset-0 h-full object-cover" style={{ width: `${100 / (sliderPos / 100)}%` }} />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center">
          <ArrowLeftRight size={14} style={{ color: GOLD }} />
        </div>
      </div>
      <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded-lg"><p className="text-white text-xs font-body">Before</p></div>
      <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 rounded-lg"><p className="text-white text-xs font-body">After</p></div>
    </div>
  )
}

export default function ScanTimeline() {
  const navigate = useNavigate()
  const { scans, streak, isPremium, token } = useStore()
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [metricTab, setMetricTab] = useState(0)
  const [sharing, setSharing]     = useState(false)
  const canvasRef = useRef()
  const isDemo = !token || token === 'demo-token'

  useEffect(() => {
    if (isDemo) { setLoading(false); return }
    api.supabase.getScans()
      .then(({ scans: h }) => setHistory(h || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [isDemo])

  const chartData = [...history].reverse().map((s, i) => ({
    label:         `Scan ${i + 1}`,
    date:          new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    glowScore:     Number(s.overall_score),
    faceScore:     s.face_score      != null ? Number(s.face_score)     : null,
    groomingScore: s.grooming_score  != null ? Number(s.grooming_score) : null,
  }))

  const firstScan      = history.length > 0 ? history[history.length - 1] : null
  const latestScan     = history.length > 0 ? history[0] : null
  const bestScore      = history.length > 0 ? Math.max(...history.map(h => Number(h.overall_score))) : null
  const improvement    = firstScan && latestScan
    ? (Number(latestScan.overall_score) - Number(firstScan.overall_score)).toFixed(1) : null
  const improvementNum = improvement !== null ? parseFloat(improvement) : null
  const hasEnoughData  = history.length >= 2
  const activeMetric   = METRIC_TABS[metricTab]

  const handleShare = useCallback(async () => {
    if (!firstScan || !latestScan || sharing) return
    setSharing(true)
    try {
      await document.fonts.ready
      const canvas = canvasRef.current
      drawShareCard(canvas, firstScan, latestScan)
      const diff    = Number(latestScan.overall_score) - Number(firstScan.overall_score)
      const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'glow-up.png', { type: 'image/png' })
        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'My Glow Up', text: `I improved ${diffStr} points on Ascendus! 🔥 ascendus.store` })
          } else {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = 'glow-up.png'
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') console.warn('Share failed:', shareErr)
        }
        setSharing(false)
      }, 'image/png')
    } catch (err) {
      console.error('Share card failed:', err)
      setSharing(false)
    }
  }, [firstScan, latestScan, sharing])

  return (
    <MotionPage className="px-4">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <button
          onClick={() => { triggerHaptic(); navigate(-1) }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-[22px] text-primary leading-tight" style={{ letterSpacing: '-0.02em' }}>
            Progress
          </h1>
          <p className="font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Track your glow-up journey</p>
        </div>
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

      {/* Chart / empty state */}
      {loading ? (
        <div className="card mb-4 flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: GOLD, borderTopColor: 'transparent' }} />
        </div>
      ) : !hasEnoughData ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE_STANDARD }}
          className="card mb-4 flex flex-col items-center gap-3 py-10 text-center">
          <TrendingUp size={40} style={{ color: GOLD }} />
          <p className="font-heading font-bold text-base text-primary">
            {history.length === 0 ? 'Complete your first scan to start tracking your glow up' : 'Take one more scan to unlock your progress chart'}
          </p>
          <p className="text-xs text-secondary font-body max-w-[220px]">Your score history will appear here after two scans</p>
          <button onClick={() => { triggerHaptic(); navigate('/scan/capture') }}
            className="mt-1 px-5 py-2 rounded-xl text-sm font-heading font-bold text-white" style={{ background: GOLD }}>
            Start a Scan
          </button>
        </motion.div>
      ) : (
        <>
          {isPremium ? (
            <>
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

              <div className="card mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading font-bold text-base text-primary">Score Timeline</h2>
                  <span className="text-xs font-heading font-bold px-2 py-1 rounded-lg"
                    style={{ background: improvementNum >= 0 ? `${GOLD}1A` : 'rgba(224,122,95,0.12)', color: improvementNum >= 0 ? GOLD : '#E07A5F' }}>
                    {improvementNum >= 0 ? '+' : ''}{improvement} pts
                  </span>
                </div>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {METRIC_TABS.map((m, i) => (
                    <button key={m.key} onClick={() => { triggerHaptic(); setMetricTab(i) }}
                      className="text-[10px] font-heading font-bold px-2.5 py-1 rounded-full transition-all"
                      style={metricTab === i ? { background: m.color, color: '#fff' } : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={activeMetric.color} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={activeMetric.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-secondary)', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-secondary)', fontFamily: 'Inter' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 11 }}
                      formatter={(v) => [v != null ? Number(v).toFixed(1) : 'N/A', activeMetric.label]} />
                    <Area type="monotone" dataKey={activeMetric.key} stroke={activeMetric.color} strokeWidth={2.5} fill="url(#areaGrad)"
                      connectNulls dot={{ r: 4, fill: activeMetric.color, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6, fill: activeMetric.color }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE_STANDARD }} className="card mb-4 overflow-hidden">
                <div className="h-1 -mx-4 -mt-4 mb-4" style={{ background: `linear-gradient(90deg, ${GOLD}, #F5D98E)` }} />
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${GOLD}1A` }}>
                    <Share2 size={20} style={{ color: GOLD }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-sm text-primary">Share My Glow Up</p>
                    <p className="text-xs text-secondary font-body truncate">
                      {Number(firstScan.overall_score).toFixed(1)} → {Number(latestScan.overall_score).toFixed(1)} · {improvementNum >= 0 ? '+' : ''}{improvement} pts
                    </p>
                  </div>
                  <button onClick={() => { triggerHaptic(); handleShare() }} disabled={sharing}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-heading font-bold text-white disabled:opacity-60 flex-shrink-0"
                    style={{ background: GOLD }}>
                    {sharing ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Download size={13} />Share</>}
                  </button>
                </div>
              </motion.div>
            </>
          ) : (
            <ProLock solid onUpgrade={() => { triggerHaptic(); navigate('/premium') }}
              label="Progress Graph & Share Card" description="Track your score over time and share your glow-up with Pro." className="mb-4" />
          )}
        </>
      )}

      {/* Scan photo timeline */}
      {history.length > 0 && (
        <div className="mb-4">
          <h2 className="font-heading font-bold text-base text-primary mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-secondary" /> Scan History
          </h2>
          {isPremium ? (
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-2">
              {history.map((scan, i) => (
                <div key={scan.id ?? i} className="flex-shrink-0 w-24 rounded-2xl overflow-hidden" style={{ border: '2px solid transparent' }}>
                  <div className="relative">
                    <img src={scan.face_image_url || 'https://placehold.co/96x96/C6A85C/white?text=Scan'}
                      alt={`Scan ${i + 1}`} className="w-24 h-24 object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/70">
                      <p className="text-white text-[9px] font-mono font-bold">
                        {scan.overall_score != null ? Number(scan.overall_score).toFixed(1) : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-card px-1.5 py-1">
                    <p className="text-[9px] text-secondary font-body text-center">
                      {new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ProLock solid onUpgrade={() => { triggerHaptic(); navigate('/premium') }}
              label="Scan History" description="All your scan photos and score history, in one place." />
          )}
        </div>
      )}

      {/* Before & After */}
      {history.length >= 2 && (
        <div className="mb-4">
          <h2 className="font-heading font-bold text-base text-primary mb-3 flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-secondary" /> Before &amp; After
          </h2>
          {isPremium ? (
            <ComparisonSlider
              before={history[history.length - 1]?.face_image_url || 'https://placehold.co/400x400/gray/white?text=Before'}
              after={history[0]?.face_image_url || 'https://placehold.co/400x400/C6A85C/white?text=After'}
            />
          ) : (
            <ProLock solid onUpgrade={() => { triggerHaptic(); navigate('/premium') }}
              label="Before & After Comparison" description="Drag-slider photo comparison of your first scan vs. your latest." />
          )}
        </div>
      )}

      {/* Milestones */}
      {hasEnoughData && (
        <div className="mb-6">
          <h2 className="font-heading font-bold text-base text-primary mb-3 flex items-center gap-2">
            <Trophy size={16} style={{ color: GOLD }} /> Milestones
          </h2>
          {[
            { icon: <Target size={20} style={{ color: GOLD }} />, text: 'First scan completed', date: new Date(firstScan.created_at).toLocaleDateString() },
            improvementNum > 0 && { icon: <TrendingUp size={20} style={{ color: '#34C759' }} />, text: `Score improved by ${improvement} points` },
            bestScore >= 7.5 && { icon: <Star size={20} style={{ color: GOLD, fill: GOLD }} />, text: `Reached ${bestScore.toFixed(1)}, ${latestScan.tier || 'elite tier'}` },
          ].filter(Boolean).map((m, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-default last:border-0">
              <span className="flex-shrink-0">{m.icon}</span>
              <div>
                <p className="text-sm font-body text-primary">{m.text}</p>
                {m.date && <p className="text-[10px] text-secondary font-body">{m.date}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pb-8" />
    </MotionPage>
  )
}
