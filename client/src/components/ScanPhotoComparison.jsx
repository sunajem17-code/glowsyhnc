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

function ComparisonPhoto({ scan, label, emptyMessage }) {
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
        .finally(() => { if (active) setLoading(false) })
    }
    return () => { active = false }
  }, [scan?.id, source])
  const image = source || media
  return (
    <figure className="min-w-0">
      <figcaption className="text-center mb-2">
        <p className="font-heading font-bold text-[12px]" style={{ color: GOLD }}>{label}</p>
        <p className="font-body text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{scan ? scanDate(scan) : 'Choose a scan'}</p>
      </figcaption>
      <div className="rounded-2xl overflow-hidden flex items-center justify-center" style={{ height: 'min(42vh, 380px)', background: '#141414', border: '1px solid rgba(255,255,255,0.1)' }}>
        {image && !failed
          ? <img src={image} draggable={false} alt={`${label} scan photo`} onError={() => setFailed(true)} className="w-full h-full object-contain" />
          : <div role="status" className="flex flex-col items-center gap-3 p-3 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Camera size={24} />
              <p className="font-body text-[11px]">{loading ? 'Loading photo…' : scan ? 'Photo not saved for this scan' : emptyMessage}</p>
            </div>}
      </div>
    </figure>
  )
}

export default function ScanPhotoComparison({ scan, savedScans, selectedId, onSelectScan }) {
  const candidates = getComparisonScans(scan, savedScans)
  const selectedScan = candidates.find(candidate => candidate.id === selectedId)
  return (
    <div>
      <h2 className="font-heading font-bold text-xl text-white mb-2">Compare scans</h2>
      <p className="font-body text-sm mb-5" style={{ color: 'rgba(255,255,255,0.5)' }}>Choose another saved scan to compare your photos side by side.</p>
      <label htmlFor="comparison-scan" className="block font-heading font-bold text-xs mb-2" style={{ color: GOLD }}>Compare with</label>
      <select id="comparison-scan" value={selectedId} onChange={event => onSelectScan(event.target.value)}
        onPointerDown={event => event.stopPropagation()} disabled={!candidates.length}
        className="w-full rounded-xl px-3 py-3 mb-5 font-body text-sm disabled:opacity-50"
        style={{ color: '#fff', background: '#1b1b1b', border: '1px solid rgba(198,168,92,0.35)' }}>
        <option value="">Choose another scan</option>
        {candidates.map((candidate, index) => <option key={candidate.id} value={candidate.id}>
          {scanDate(candidate)} · Scan {candidates.length - index}{candidate.glowScore != null ? ` · ${Number(candidate.glowScore).toFixed(1)}` : ''}
        </option>)}
      </select>
      {!candidates.length && <p role="status" className="font-body text-xs mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Complete another scan to compare it here.</p>}
      <div className="grid grid-cols-2 gap-3">
        <ComparisonPhoto key={`current-${scan?.id}`} scan={scan} label="This scan" emptyMessage="No photo available" />
        <ComparisonPhoto key={selectedId || 'unselected'} scan={selectedScan} label="Comparison scan" emptyMessage="Choose a saved scan above" />
      </div>
    </div>
  )
}
