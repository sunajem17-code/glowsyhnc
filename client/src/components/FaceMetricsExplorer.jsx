import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import demoFaceImage from '../assets/face-metrics-demo.jpg'

// Fallback content shown before the user has ever run a Live Face Scan, so
// this section of Progress isn't just empty. Landmark positions were hand-
// placed by eye against demoFaceImage (normalized 0-1 x/y) — they are NOT
// computed from real geometry, since there's no real scan behind this photo.
// Metric values here are illustrative placeholders, not measurements of
// anyone real. Everything demo-related is labeled as an example in the UI
// so it's never mistaken for the user's own data.
const DEMO_LANDMARKS_2D = {
  browPoint:      [0.50, 0.178],
  noseTip:        [0.50, 0.454],
  chinTip:        [0.50, 0.629],
  templeLeft:     [0.13, 0.347],
  templeRight:    [0.87, 0.347],
  cheekboneLeft:  [0.19, 0.447],
  cheekboneRight: [0.81, 0.447],
  jawCornerLeft:  [0.18, 0.546],
  jawCornerRight: [0.82, 0.546],
}

const DEMO_METRICS = {
  jawWidthCM: 12.8,
  cheekboneWidthCM: 14.1,
  bitemporalWidthCM: 13.6,
  bigonialWidthPercent: 78.4,
  midfaceRatio: 1.05,
  facialAngleDegrees: 88.2,
  facialConvexityDegrees: 169.5,
  gonialAngleDegrees: 122.0,
  foreheadSlopeDegrees: 7.5,
  noseProjectionMM: 18.2,
  chinProjectionMM: 9.6,
  jawAsymmetryScore: 3.1,
  cheekboneAsymmetryScore: 2.4,
  templeAsymmetryScore: 1.8,
}

// Maps each metric to the landmark point(s) it's anchored to on the photo.
// Two landmark keys = draw a line between them (width-type measurements).
// One landmark key = single marker (angle/projection-type measurements).
const METRIC_DEFS = [
  { key: 'jawWidthCM',        label: 'Jaw Width',        unit: 'cm', landmarks: ['jawCornerLeft', 'jawCornerRight'] },
  { key: 'cheekboneWidthCM',  label: 'Cheekbone Width',  unit: 'cm', landmarks: ['cheekboneLeft', 'cheekboneRight'] },
  { key: 'bitemporalWidthCM', label: 'Bitemporal Width', unit: 'cm', landmarks: ['templeLeft', 'templeRight'] },
  { key: 'bigonialWidthPercent', label: 'Bigonial Width', unit: '%', landmarks: ['jawCornerLeft', 'jawCornerRight'] },
  { key: 'midfaceRatio',      label: 'Midface Ratio',    unit: 'x', landmarks: ['cheekboneLeft', 'cheekboneRight'] },
  { key: 'facialAngleDegrees', label: 'Facial Angle',      unit: '°', landmarks: ['browPoint'] },
  { key: 'facialConvexityDegrees', label: 'Facial Convexity', unit: '°', landmarks: ['noseTip'] },
  { key: 'gonialAngleDegrees', label: 'Gonial Angle',      unit: '°', landmarks: ['jawCornerRight'] },
  { key: 'foreheadSlopeDegrees', label: 'Forehead Slope',  unit: '°', landmarks: ['browPoint'] },
  { key: 'noseProjectionMM',  label: 'Nose Projection',  unit: 'mm', landmarks: ['noseTip'] },
  { key: 'chinProjectionMM',  label: 'Chin Projection',  unit: 'mm', landmarks: ['chinTip'] },
  { key: 'jawAsymmetryScore', label: 'Jaw Asymmetry',    unit: '%', landmarks: ['jawCornerLeft', 'jawCornerRight'] },
  { key: 'cheekboneAsymmetryScore', label: 'Cheekbone Asymmetry', unit: '%', landmarks: ['cheekboneLeft', 'cheekboneRight'] },
  { key: 'templeAsymmetryScore', label: 'Temple Asymmetry', unit: '%', landmarks: ['templeLeft', 'templeRight'] },
]

function formatValue(value, unit) {
  if (value == null) return '—'
  if (unit === '°') return `${value.toFixed(1)}°`
  if (unit === 'mm') return `${value.toFixed(1)} mm`
  if (unit === 'cm') return `${value.toFixed(1)} cm`
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'x') return `${value.toFixed(2)}x`
  return String(value)
}

/**
 * Interactive "tap a stat, see it pointed out on your face" view.
 * Reads the most recent Live Face Scan photo + 2D landmark positions from
 * session-only store state (see setLastFaceScanCapture in useStore.js —
 * this data is intentionally never persisted to localStorage since it's a
 * full-size photo). Before the user has ever run a real scan, falls back to
 * a labeled example (demoFaceImage + DEMO_LANDMARKS_2D/DEMO_METRICS) so this
 * section isn't just blank — the example is visually flagged throughout and
 * links to the real scan flow.
 */
export default function FaceMetricsExplorer() {
  const navigate = useNavigate()
  const realImage       = useStore(s => s.lastFaceScanImage)
  const realLandmarks2D = useStore(s => s.lastFaceScanLandmarks2D)
  const currentScan     = useStore(s => s.currentScan)
  const realFaceMetrics = currentScan?.faceMetrics

  const [activeKey, setActiveKey] = useState(null)

  const hasRealScan = Boolean(realImage && realLandmarks2D && realFaceMetrics)
  const isDemo       = !hasRealScan
  const image        = hasRealScan ? realImage : demoFaceImage
  const landmarks2D  = hasRealScan ? realLandmarks2D : DEMO_LANDMARKS_2D
  const faceMetrics  = hasRealScan ? realFaceMetrics : DEMO_METRICS

  const availableMetrics = METRIC_DEFS.filter(def =>
    faceMetrics[def.key] != null && def.landmarks.every(lm => landmarks2D[lm])
  )
  if (availableMetrics.length === 0) return null

  const active = availableMetrics.find(m => m.key === activeKey) ?? null

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="font-heading font-bold text-[15px] text-primary">Face Metrics</p>
        <p className="text-[11px] text-secondary font-body">
          {isDemo ? 'Example — tap a stat' : 'Tap a stat to see it on your face'}
        </p>
      </div>

      {isDemo && (
        <button
          onClick={() => navigate('/scan')}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 mb-3 rounded-xl active:scale-95 transition-transform text-left"
          style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.3)' }}
        >
          <span className="text-[11px] font-body text-secondary leading-tight">
            This is a sample face, not you. Run a Live Face Scan to see your own numbers here.
          </span>
          <span className="text-[11px] font-heading font-bold flex-shrink-0" style={{ color: '#C6A85C' }}>
            Scan →
          </span>
        </button>
      )}

      <div
        className="relative w-full rounded-2xl overflow-hidden mb-3"
        style={{ aspectRatio: '3 / 4', background: '#0a0a0a', border: `1px solid ${isDemo ? 'rgba(198,168,92,0.35)' : 'rgba(0,255,255,0.2)'}` }}
      >
        <img src={image} alt={isDemo ? 'Example face scan' : 'Your face scan'} className="absolute inset-0 w-full h-full object-cover" />

        {isDemo && (
          <div
            className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-heading font-bold tracking-wide"
            style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(198,168,92,0.5)', color: '#C6A85C' }}
          >
            EXAMPLE
          </div>
        )}

        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          <AnimatePresence>
            {active && active.landmarks.length === 2 && (
              <motion.line
                key={`line-${active.key}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                x1={landmarks2D[active.landmarks[0]][0] * 100}
                y1={landmarks2D[active.landmarks[0]][1] * 100}
                x2={landmarks2D[active.landmarks[1]][0] * 100}
                y2={landmarks2D[active.landmarks[1]][1] * 100}
                stroke="cyan" strokeWidth="0.4" strokeDasharray="1.5 1"
              />
            )}
          </AnimatePresence>
        </svg>

        {active && active.landmarks.map(lm => (
          <motion.div
            key={lm}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${landmarks2D[lm][0] * 100}%`,
              top: `${landmarks2D[lm][1] * 100}%`,
              background: 'cyan',
              boxShadow: '0 0 10px cyan, 0 0 4px white',
            }}
          />
        ))}

        {active && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.75)', border: `1px solid ${isDemo ? '#C6A85C' : 'cyan'}` }}
          >
            <span className="text-xs font-heading font-semibold text-white">{active.label}</span>
            <span className="text-sm font-heading font-bold" style={{ color: isDemo ? '#C6A85C' : 'cyan' }}>
              {formatValue(faceMetrics[active.key], active.unit)}
            </span>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {availableMetrics.map(def => (
          <button
            key={def.key}
            onClick={() => setActiveKey(prev => prev === def.key ? null : def.key)}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl active:scale-95 transition-transform"
            style={{
              background: activeKey === def.key ? (isDemo ? 'rgba(198,168,92,0.12)' : 'rgba(0,255,255,0.12)') : 'rgba(255,255,255,0.04)',
              border: `1px solid ${activeKey === def.key ? (isDemo ? '#C6A85C' : 'cyan') : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            <span className="text-[11px] font-body text-secondary text-left leading-tight">{def.label}</span>
            <span className="text-xs font-heading font-bold text-primary ml-1.5 flex-shrink-0">
              {formatValue(faceMetrics[def.key], def.unit)}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-secondary font-body mt-2 text-center opacity-70">
        {isDemo
          ? 'Example numbers on a sample face · Run a Live Face Scan to see your own'
          : 'From your most recent Live Face Scan this session · Estimates, not medical measurements'}
      </p>
    </div>
  )
}
