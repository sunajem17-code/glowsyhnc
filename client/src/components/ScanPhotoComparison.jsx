import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import { getComparisonScans } from '../utils/scanHistory'
import { loadScanMedia } from '../utils/scanPhotoDb'
import { BACKEND_ORIGIN } from '../utils/backend'
import { GOLD } from '../utils/theme'

function photoUrl(value) {
  if (!value) return null
  return /^(https?:|data:|blob:)/.test(value) ? value : `${BACKEND_ORIGIN}${value}`
}

function scanDate(scan) {
  const date = scan?.analyzedAt || scan?.scanDate || scan?.scan_date
  return date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Saved scan'
}

function useScanPhoto(scan) {
  const source = photoUrl(scan?.facePhotoUrl || scan?.face_photo_url || scan?.photos?.face)
  const [media, setMedia] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setMedia(null)
    setFailed(false)
    setLoading(Boolean(scan?.id && !source))
    if (scan?.id && !source) {
      loadScanMedia(scan.id)
        .then(value => { if (active) setMedia(value?.photo || null) })
        .catch(() => { if (active) setFailed(true) })
        .finally(() => { if (active) setLoading(false) })
    }
    return () => { active = false }
  }, [scan?.id, source])

  return { image: source || media, loading, failed, setFailed }
}

function SliderPhoto({ scan, label, clip = 'inset(0)', fallback }) {
  const { image, loading, failed, setFailed } = useScanPhoto(scan)
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{ clipPath: clip }}
    >
      {image && !failed
        ? <img src={image} draggable={false} alt={`${label} scan`} onError={() => setFailed(true)} className="w-full h-full object-contain" />
        : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center" style={{ background: '#141414', color: 'rgba(255,255,255,0.55)' }}>
            <Camera size={24} />
            <span className="font-body text-xs">{loading ? 'Loading photo…' : fallback}</span>
          </div>}
    </div>
  )
}

export default function ScanPhotoComparison({ scan, savedScans }) {
  const candidates = getComparisonScans(scan, savedScans)
  const [selectedScanId, setSelectedScanId] = useState(candidates[0]?.id || '')
  const comparisonScan = candidates.find(candidate => candidate.id === selectedScanId) || candidates[0] || null
  const [position, setPosition] = useState(50)
  const [sliderFocused, setSliderFocused] = useState(false)
  const hasBothScans = Boolean(scan && comparisonScan)

  useEffect(() => {
    if (comparisonScan?.id && comparisonScan.id !== selectedScanId) setSelectedScanId(comparisonScan.id)
  }, [comparisonScan?.id, selectedScanId])
  useEffect(() => setPosition(50), [scan?.id, comparisonScan?.id])

  return (
    <section aria-label="Before and after scan comparison">
      <h2 className="font-heading font-bold text-xl text-white mb-1">Compare progress</h2>
      <p className="font-body text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Your current scan stays in place. Choose another scan, then drag to compare.
      </p>

      {comparisonScan ? (
        <p className="font-body text-[11px] text-center mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
          This scan · {scanDate(scan)}
        </p>
      ) : (
        <p role="status" className="font-body text-xs mb-3 text-center" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Complete another scan to compare your progress.
        </p>
      )}

      {candidates.length > 0 && (
        <label className="block font-heading font-bold text-xs mb-2" style={{ color: GOLD }}>
          Compare with
          <select
            aria-label="Choose a scan to compare with this scan"
            value={comparisonScan?.id || ''}
            onChange={event => setSelectedScanId(event.target.value)}
            onPointerDown={event => event.stopPropagation()}
            className="mt-2 block w-full rounded-xl px-3 py-3 font-body text-sm"
            style={{ color: '#fff', background: '#1b1b1b', border: '1px solid rgba(198,168,92,0.35)' }}
          >
            {candidates.map((candidate, index) => (
              <option key={candidate.id} value={candidate.id}>
                {scanDate(candidate)} · Scan {candidates.length - index}{candidate.glowScore != null ? ` · ${Number(candidate.glowScore).toFixed(1)}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <div
        className="relative w-full overflow-hidden rounded-2xl select-none"
        style={{ height: 'min(54vh, 520px)', minHeight: 260, background: '#141414', border: '1px solid rgba(255,255,255,0.1)', touchAction: 'pan-y' }}
      >
        {comparisonScan ? <>
          <SliderPhoto scan={comparisonScan} label="Previous" fallback="No photo saved for the previous scan" />
          <SliderPhoto scan={scan} label="Latest" clip={`inset(0 0 0 ${position}%)`} fallback="No photo saved for this scan" />
          <div aria-hidden="true" className="absolute top-0 bottom-0 w-0.5 pointer-events-none" style={{ left: `${position}%`, background: '#fff', boxShadow: '0 0 12px rgba(0,0,0,0.6)' }}>
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: GOLD, border: '2px solid white', color: '#101010', fontSize: 18, fontWeight: 700 }}>↔</span>
          </div>
          <span className="absolute bottom-3 left-3 rounded-lg px-2 py-1 text-[10px] font-bold" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>COMPARISON</span>
          <span className="absolute bottom-3 right-3 rounded-lg px-2 py-1 text-[10px] font-bold" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>THIS SCAN</span>
          {sliderFocused && <span aria-hidden="true" className="absolute inset-0 z-20 rounded-2xl pointer-events-none" style={{ outline: `2px solid ${GOLD}`, outlineOffset: -3 }} />}
          <input
            aria-label="Drag to compare selected scan with this scan"
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={event => setPosition(Number(event.target.value))}
            onFocus={() => setSliderFocused(true)}
            onBlur={() => setSliderFocused(false)}
            onPointerDown={event => event.stopPropagation()}
            onTouchStart={event => event.stopPropagation()}
            className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
            style={{ touchAction: 'pan-y' }}
          />
        </> : <SliderPhoto scan={scan} label="Latest" fallback="No photo saved for this scan" />}
      </div>
      {!hasBothScans && scan && (
        <p className="font-body text-[11px] mt-3 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Your current scan will appear here once a previous scan is available.
        </p>
      )}
    </section>
  )
}
