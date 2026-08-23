import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import demoFaceImage from '../assets/face-metrics-demo.jpg'
import demoFaceImageFemale from '../assets/face-metrics-demo-female.jpg'

// Fallback content shown before the user has ever run a Live Face Scan, so
// this section of Progress isn't just empty. Landmark positions were hand-
// placed by eye against demoFaceImage (normalized 0-1 x/y) — they are NOT
// computed from real geometry, since there's no real scan behind this photo.
// Metric values here are illustrative placeholders, not measurements of
// anyone real. Everything demo-related is labeled as an example in the UI
// so it's never mistaken for the user's own data.
// Real MediaPipe Face Mesh coordinates extracted from demoFaceImage at dev time.
// These are the actual normalized [x, y] positions of each landmark index on
// the demo photo — not hand-placed. Derived by running FaceMesh on
// face-metrics-demo.jpg and rounding to 5 decimal places.
const DEMO_LANDMARKS_2D = {
  browPoint:      [0.50484, 0.26654],  // lm 10
  noseTip:        [0.50111, 0.62128],  // lm 1
  chinTip:        [0.50021, 0.90634],  // lm 152
  templeLeft:     [0.15754, 0.48205],  // lm 127
  templeRight:    [0.84792, 0.48325],  // lm 356
  cheekboneLeft:  [0.16063, 0.5364],   // lm 234
  cheekboneRight: [0.84272, 0.53732],  // lm 454
  jawBodyLeft:    [0.19558, 0.71412],  // lm 58  — pre-gonion ramus (Jaw Width cm)
  jawBodyRight:   [0.80327, 0.71433],  // lm 288
  jawCornerLeft:  [0.22602, 0.76523],  // lm 172 — gonion (Bigonial Width %)
  jawCornerRight: [0.77185, 0.76528],  // lm 397
}

// Values computed by running computeExplorerMetrics against the real MediaPipe
// coordinates above (male scale reference: cheekboneWidthCM = 13.5 cm anchor).
const DEMO_METRICS = {
  jawWidthCM: 12.0,
  cheekboneWidthCM: 13.5,
  bitemporalWidthCM: 13.7,
  bigonialWidthPercent: 80.0,
  midfaceRatio: 0.12,
  facialAngleDegrees: 88.2,
  facialConvexityDegrees: 169.5,
  foreheadSlopeDegrees: 7.5,
  noseProjectionMM: 18.2,
  chinProjectionMM: 9.6,
  jawAsymmetryScore: 0.3,
  cheekboneAsymmetryScore: 0.1,
  templeAsymmetryScore: 0.2,
}

// Maps each metric to the landmark point(s) it's anchored to on the photo.
// Two landmark keys = draw a line between them (width-type measurements).
// One landmark key = single marker (angle/projection-type measurements).
const METRIC_DEFS = [
  // jawWidthCM uses pre-gonion ramus points (lm 58/288) — one level above bigonial.
  // bigonialWidthPercent uses gonion points (lm 172/397) — the true bigonial.
  // These are distinct anatomical points; the cm vs % is NOT the only difference.
  { key: 'jawWidthCM',        label: 'Jaw Width',        unit: 'cm', landmarks: ['jawBodyLeft',  'jawBodyRight']  },
  { key: 'cheekboneWidthCM',  label: 'Cheekbone Width',  unit: 'cm', landmarks: ['cheekboneLeft', 'cheekboneRight'] },
  { key: 'bitemporalWidthCM', label: 'Bitemporal Width', unit: 'cm', landmarks: ['templeLeft', 'templeRight'] },
  { key: 'bigonialWidthPercent', label: 'Bigonial Width', unit: '%', landmarks: ['jawCornerLeft', 'jawCornerRight'] },
  { key: 'midfaceRatio',      label: 'Midface Ratio',    unit: 'x', landmarks: ['cheekboneLeft', 'cheekboneRight'] },
  { key: 'facialAngleDegrees', label: 'Facial Angle',      unit: '°', landmarks: ['browPoint'] },
  { key: 'facialConvexityDegrees', label: 'Facial Convexity', unit: '°', landmarks: ['noseTip'] },
  { key: 'foreheadSlopeDegrees', label: 'Forehead Slope',  unit: '°', landmarks: ['browPoint'] },
  { key: 'noseProjectionMM',  label: 'Nose Projection',  unit: 'mm', landmarks: ['noseTip'] },
  { key: 'chinProjectionMM',  label: 'Chin Projection',  unit: 'mm', landmarks: ['chinTip'] },
  { key: 'jawAsymmetryScore', label: 'Jaw Asymmetry',    unit: '%', landmarks: ['jawCornerLeft', 'jawCornerRight'] },
  { key: 'cheekboneAsymmetryScore', label: 'Cheekbone Asymmetry', unit: '%', landmarks: ['cheekboneLeft', 'cheekboneRight'] },
  { key: 'templeAsymmetryScore', label: 'Temple Asymmetry', unit: '%', landmarks: ['templeLeft', 'templeRight'] },
]

function formatValue(value, unit, units = 'metric') {
  if (value == null) return 'N/A'
  if (unit === '°') return `${value.toFixed(1)}°`
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'x') return `${value.toFixed(2)}x`
  if (units === 'imperial') {
    if (unit === 'cm') return `${(value * 0.3937).toFixed(1)} in`
    if (unit === 'mm') return `${(value * 0.03937).toFixed(2)} in`
  }
  if (unit === 'mm') return `${value.toFixed(1)} mm`
  if (unit === 'cm') return `${value.toFixed(1)} cm`
  return String(value)
}

/**
 * Interactive "tap a stat, see it pointed out on your face" view.
 *
 * Data sources (in priority order):
 * 1. In-memory Zustand state (lastFaceScan*) — populated by the scan flow
 *    calling setLastFaceScanCapture right after MediaPipe runs. Lives only
 *    for the current session.
 * 2. IndexedDB (loadScanMedia) — photo + landmarks persisted across restarts
 *    by the same scan flow. Loaded async on mount if store is empty.
 * 3. Demo fallback — only shown if scans[] is truly empty (user has never
 *    completed a scan). Visually labeled so it's never confused for real data.
 */
export default function FaceMetricsExplorer() {
  const navigate = useNavigate()

  // Session-memory data (set immediately after each scan)
  const storeImage       = useStore(s => s.lastFaceScanImage)
  const storeLandmarks2D = useStore(s => s.lastFaceScanLandmarks2D)
  const storeFaceMetrics = useStore(s => s.lastFaceScanFaceMetrics)
  const setCapture       = useStore(s => s.setLastFaceScanCapture)

  // Scan history (lightweight metadata only — photos stripped from localStorage)
  const scans        = useStore(s => s.scans)
  const currentScan  = useStore(s => s.currentScan)
  const storeGender  = useStore(s => s.gender)
  const units        = useStore(s => s.units)
  const demoGender   = currentScan?.gender ?? storeGender

  // IndexedDB-loaded data (filled async on mount when store is empty)
  const [dbImage,       setDbImage]       = useState(null)
  const [dbLandmarks2D, setDbLandmarks2D] = useState(null)
  const [dbFaceMetrics, setDbFaceMetrics] = useState(null)
  const [dbLoading,     setDbLoading]     = useState(false)

  const mostRecentScanId = scans[0]?.id ?? null

  // When the store is empty but we have a scan on record, try to load from IndexedDB.
  useEffect(() => {
    if (storeImage || !mostRecentScanId) return
    setDbLoading(true)
    import('../utils/scanPhotoDb.js')
      .then(({ loadScanMedia }) => loadScanMedia(mostRecentScanId))
      .then(row => {
        if (!row) return
        setDbImage(row.photo ?? null)
        setDbLandmarks2D(row.landmarks2D ?? null)
        setDbFaceMetrics(row.faceMetrics ?? null)
        // Populate the store so subsequent renders are instant
        if (row.photo) {
          setCapture(row.photo, row.landmarks2D ?? null, row.faceMetrics ?? null)
        }
      })
      .catch(err => console.warn('[FaceExplorer] IndexedDB load:', err.message))
      .finally(() => setDbLoading(false))
  }, [mostRecentScanId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [activeKey, setActiveKey] = useState(null)

  // Resolve which data to use (store wins over DB)
  const image        = storeImage       ?? dbImage
  const landmarks2D  = storeLandmarks2D ?? dbLandmarks2D
  const faceMetrics  = storeFaceMetrics ?? dbFaceMetrics

  // True "no scan ever" — not just "photo missing from current session"
  const neverScanned = scans.length === 0
  const hasRealData  = Boolean(image && landmarks2D && faceMetrics)
  const isDemo       = neverScanned || (!hasRealData && !dbLoading)

  const activeImage      = isDemo ? (demoGender === 'female' ? demoFaceImageFemale : demoFaceImage) : image
  const activeLandmarks  = isDemo ? DEMO_LANDMARKS_2D : (landmarks2D ?? DEMO_LANDMARKS_2D)
  const activeFaceMetrics = isDemo ? DEMO_METRICS : (faceMetrics ?? DEMO_METRICS)

  const availableMetrics = METRIC_DEFS.filter(def =>
    activeFaceMetrics[def.key] != null && def.landmarks.every(lm => activeLandmarks[lm])
  )
  if (availableMetrics.length === 0 && !dbLoading) return null

  const active = availableMetrics.find(m => m.key === activeKey) ?? null

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="font-heading font-bold text-[15px] text-primary">Face Metrics</p>
        <p className="text-[11px] text-secondary font-body">
          {isDemo ? 'Example: tap a stat' : 'Tap a stat to see it on your face'}
        </p>
      </div>

      {isDemo && (
        <button
          onClick={() => navigate('/scan/capture')}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 mb-3 rounded-xl active:scale-95 transition-transform text-left"
          style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.3)' }}
        >
          <span className="text-[11px] font-body text-secondary leading-tight">
            This is a sample face, not you. Run a Live Face Scan to see your own numbers here.
          </span>
          <span className="text-[11px] font-heading font-bold flex-shrink-0" style={{ color: '#C6A85C' }}>
            Scan
          </span>
        </button>
      )}

      {/* No forced aspectRatio/object-cover here on purpose — the landmark
          dots below are positioned as % of this box's width/height, which
          only lines up with where they actually are on the photo if this
          box IS the photo's real aspect ratio. Forcing a fixed 3:4 box with
          object-cover was cropping differently-shaped captures and silently
          shifting every dot off the face. */}
      <div
        className="relative w-full rounded-2xl overflow-hidden mb-3"
        style={{ background: '#0a0a0a', border: `1px solid ${isDemo ? 'rgba(198,168,92,0.35)' : 'rgba(0,255,255,0.2)'}` }}
      >
        {dbLoading && !activeImage ? (
          <div className="flex items-center justify-center h-48">
            <span className="text-[12px] font-body" style={{ color: 'rgba(198,168,92,0.5)' }}>Loading your scan…</span>
          </div>
        ) : (
          <img src={activeImage} alt={isDemo ? 'Example face scan' : 'Your face scan'} className="block w-full h-auto" />
        )}

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
                x1={activeLandmarks[active.landmarks[0]][0] * 100}
                y1={activeLandmarks[active.landmarks[0]][1] * 100}
                x2={activeLandmarks[active.landmarks[1]][0] * 100}
                y2={activeLandmarks[active.landmarks[1]][1] * 100}
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
              left: `${activeLandmarks[lm][0] * 100}%`,
              top:  `${activeLandmarks[lm][1] * 100}%`,
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
              {formatValue(activeFaceMetrics[active.key], active.unit, units)}
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
              {formatValue(activeFaceMetrics[def.key], def.unit, units)}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-secondary font-body mt-2 text-center opacity-70">
        {isDemo
          ? 'Example numbers on a sample face · Run a Live Face Scan to see your own'
          : 'From your most recent Live Face Scan · Width estimates use population-average face scale'}
      </p>
    </div>
  )
}
