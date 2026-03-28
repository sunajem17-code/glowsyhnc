import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Area, AreaChart,
} from 'recharts'
import { TrendingUp, Calendar, ArrowLeftRight, Video, Lock } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import GlowScoreRing from '../components/GlowScoreRing'
import { postureGrade } from '../utils/analysis'

const METRIC_TABS = [
  { key: 'glowScore', label: 'Overall', color: '#1A6B5C' },
  { key: 'faceScore', label: 'Face', color: '#F5A623' },
  { key: 'bodyScore', label: 'Body', color: '#34C759' },
  { key: 'posture', label: 'Posture', color: '#E07A5F' },
]

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
    <div
      ref={containerRef}
      className="relative w-full aspect-square rounded-2xl overflow-hidden cursor-col-resize select-none"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* Before (full width) */}
      <img src={before} alt="before" className="absolute inset-0 w-full h-full object-cover" />
      {/* After (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
        <img src={after} alt="after" className="absolute inset-0 h-full object-cover" style={{ width: `${100 / (sliderPos / 100)}%` }} />
      </div>
      {/* Divider */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center">
          <ArrowLeftRight size={14} className="text-[#1A6B5C]" />
        </div>
      </div>
      {/* Labels */}
      <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded-lg">
        <p className="text-white text-xs font-body">Before</p>
      </div>
      <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 rounded-lg">
        <p className="text-white text-xs font-body">After</p>
      </div>
    </div>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const { scans, streak, isPremium } = useStore()
  const [metricTab, setMetricTab] = useState(0)
  const [selectedScan, setSelectedScan] = useState(null)

  // Build chart data
  const chartData = [...scans].reverse().map((s, i) => ({
    label: `Scan ${i + 1}`,
    date: new Date(s.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    glowScore: s.glowScore,
    faceScore: s.faceTotalScore,
    bodyScore: s.bodyTotalScore,
    posture: s.bodyData?.posture ?? 0,
  }))

  // Demo data if no scans
  const hasData = chartData.length > 0
  const demoData = [
    { label: 'Wk 1', date: 'Jan 1', glowScore: 52, faceScore: 5.8, bodyScore: 5.2, posture: 5.5 },
    { label: 'Wk 2', date: 'Jan 8', glowScore: 56, faceScore: 6.1, bodyScore: 5.5, posture: 5.8 },
    { label: 'Wk 4', date: 'Jan 22', glowScore: 62, faceScore: 6.5, bodyScore: 6.0, posture: 6.2 },
    { label: 'Wk 6', date: 'Feb 5', glowScore: 67, faceScore: 6.8, bodyScore: 6.4, posture: 6.8 },
    { label: 'Wk 8', date: 'Feb 19', glowScore: 72, faceScore: 7.2, bodyScore: 6.9, posture: 7.1 },
    { label: 'Now', date: 'Mar 5', glowScore: 78, faceScore: 7.6, bodyScore: 7.3, posture: 7.5 },
  ]
  const displayData = hasData ? chartData : demoData
  const activeMetric = METRIC_TABS[metricTab]

  const latestScan = scans[0]
  const previousScan = scans[1]
  const delta = latestScan && previousScan ? latestScan.glowScore - previousScan.glowScore : null

  return (
    <MotionPage className="px-4">
      <PageHeader title="Your Progress" subtitle="Track your glow-up journey" />

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Total Scans', value: scans.length || '—', icon: '📸' },
          { label: 'Best Score', value: scans.length > 0 ? Math.max(...scans.map(s => s.glowScore)) : '—', icon: '🏆' },
          { label: 'Current Streak', value: streak.current > 0 ? `${streak.current}d` : '—', icon: '🔥' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="card text-center py-3">
            <p className="text-xl mb-0.5">{icon}</p>
            <p className="font-mono font-bold text-lg text-primary">{value}</p>
            <p className="text-[10px] text-secondary font-body">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-base text-primary">Score Timeline</h2>
          {delta !== null && (
            <span className={`text-xs font-heading font-bold px-2 py-1 rounded-lg ${delta >= 0 ? 'bg-green-50 text-success dark:bg-green-900/20' : 'bg-red-50 text-warning dark:bg-red-900/20'}`}>
              {delta >= 0 ? '+' : ''}{delta} pts
            </span>
          )}
        </div>

        {/* Metric tabs */}
        <div className="flex gap-2 mb-3">
          {METRIC_TABS.map((m, i) => (
            <button
              key={m.key}
              onClick={() => setMetricTab(i)}
              className={`text-[10px] font-heading font-bold px-2.5 py-1 rounded-full transition-all ${
                metricTab === i ? 'text-white' : 'bg-gray-100 dark:bg-gray-700 text-secondary'
              }`}
              style={metricTab === i ? { background: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={displayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeMetric.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={activeMetric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-secondary)', fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--text-secondary)', fontFamily: 'Inter' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 11 }}
              formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : v, activeMetric.label]}
            />
            <Area
              type="monotone"
              dataKey={activeMetric.key}
              stroke={activeMetric.color}
              strokeWidth={2.5}
              fill="url(#areaGrad)"
              dot={{ r: 4, fill: activeMetric.color, strokeWidth: 2, stroke: 'white' }}
              activeDot={{ r: 6, fill: activeMetric.color }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {!hasData && (
          <p className="text-center text-[10px] text-secondary font-body mt-1">
            Showing sample data — take your first scan to track real progress
          </p>
        )}
      </div>

      {/* Photo Timeline */}
      {scans.length > 0 && (
        <div className="mb-4">
          <h2 className="font-heading font-bold text-base text-primary mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-secondary" />
            Scan History
          </h2>
          <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-2">
            {scans.slice(0, isPremium ? undefined : 4).map((scan, i) => (
              <motion.button
                key={scan.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedScan(selectedScan?.id === scan.id ? null : scan)}
                className={`flex-shrink-0 w-24 rounded-2xl overflow-hidden border-2 transition-colors ${
                  selectedScan?.id === scan.id ? 'border-[#1A6B5C]' : 'border-transparent'
                }`}
              >
                <div className="relative">
                  <img
                    src={scan.facePhotoUrl || 'https://placehold.co/96x96/1A6B5C/white?text=Scan'}
                    alt={`Scan ${i + 1}`}
                    className="w-24 h-24 object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/70">
                    <p className="text-white text-[9px] font-mono font-bold">{scan.glowScore}</p>
                  </div>
                </div>
                <div className="bg-card px-1.5 py-1">
                  <p className="text-[9px] text-secondary font-body text-center">
                    {new Date(scan.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </motion.button>
            ))}

            {!isPremium && scans.length > 4 && (
              <button
                onClick={() => navigate('/premium')}
                className="flex-shrink-0 w-24 h-28 rounded-2xl border-2 border-dashed border-amber-accent/40 flex flex-col items-center justify-center gap-1"
              >
                <Lock size={16} className="text-amber-accent" />
                <p className="text-[9px] font-heading font-bold text-amber-accent">See all</p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Side-by-side comparison (premium) */}
      {scans.length >= 2 && (
        <div className="mb-4">
          <h2 className="font-heading font-bold text-base text-primary mb-3 flex items-center gap-2">
            <ArrowLeftRight size={16} className="text-secondary" />
            Before & After
          </h2>
          {isPremium ? (
            <ComparisonSlider
              before={scans[scans.length - 1]?.facePhotoUrl || 'https://placehold.co/400x400/gray/white?text=Before'}
              after={scans[0]?.facePhotoUrl || 'https://placehold.co/400x400/1A6B5C/white?text=After'}
            />
          ) : (
            <div
              onClick={() => navigate('/premium')}
              className="card border-2 border-dashed border-amber-accent/40 bg-amber-50/50 dark:bg-amber-900/10 flex flex-col items-center gap-3 py-8 cursor-pointer"
            >
              <Lock size={24} className="text-amber-accent" />
              <p className="font-heading font-bold text-sm text-primary">Before & After Comparison</p>
              <p className="text-xs text-secondary font-body text-center">Drag-slider photo comparison is a Premium feature.</p>
              <span className="px-4 py-2 bg-amber-accent rounded-xl text-xs font-heading font-bold text-charcoal">
                Unlock Premium
              </span>
            </div>
          )}
        </div>
      )}

      {/* Transformation Reel */}
      <div
        onClick={() => !isPremium ? navigate('/premium') : null}
        className={`card mb-4 flex items-center gap-3 ${!isPremium ? 'cursor-pointer' : ''}`}
      >
        <div className="w-12 h-12 rounded-xl bg-[#1A6B5C]/10 flex items-center justify-center flex-shrink-0">
          <Video size={22} className="text-[#1A6B5C]" />
        </div>
        <div className="flex-1">
          <p className="font-heading font-bold text-sm text-primary">Transformation Reel</p>
          <p className="text-xs text-secondary font-body">Auto-generate a shareable glow-up video</p>
        </div>
        {!isPremium ? (
          <span className="px-2.5 py-1 bg-amber-accent rounded-lg text-[10px] font-heading font-bold text-charcoal">
            Premium
          </span>
        ) : (
          <button className="px-3 py-1.5 bg-[#1A6B5C] rounded-xl text-xs font-heading font-bold text-white">
            Generate
          </button>
        )}
      </div>

      {/* Milestone highlights */}
      {scans.length >= 2 && (
        <div className="mb-6">
          <h2 className="font-heading font-bold text-base text-primary mb-3">🏆 Milestones</h2>
          {[
            { icon: '🎯', text: `First scan completed`, date: scans[scans.length - 1] ? new Date(scans[scans.length - 1].scanDate).toLocaleDateString() : '' },
            scans.length >= 2 && { icon: '📈', text: `Score improved by ${scans[0].glowScore - scans[scans.length - 1].glowScore} points` },
          ].filter(Boolean).map((m, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-default last:border-0">
              <span className="text-xl">{m.icon}</span>
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
