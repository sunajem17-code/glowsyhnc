import { useEffect, useRef, useState } from 'react'
import { Camera, MoveHorizontal, X } from 'lucide-react'
import { getComparisonScans, getComparisonSliderPosition, resolveComparisonScan } from '../utils/scanHistory'
import { loadScanMedia } from '../utils/scanPhotoDb'
import { BACKEND_ORIGIN } from '../utils/backend'
import { GOLD } from '../utils/theme'
import ScanHistoryRow from './ScanHistoryRow'

function photoUrl(value) {
  if (!value) return null
  return /^(https?:|data:|blob:)/.test(value) ? value : `${BACKEND_ORIGIN}${value}`
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
  const [selectedScanId, setSelectedScanId] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const comparisonScan = resolveComparisonScan(candidates, selectedScanId)
  const [position, setPosition] = useState(50)
  const comparisonRef = useRef(null)
  const draggingRef = useRef(false)

  function updateSliderPosition(clientX) {
    const bounds = comparisonRef.current?.getBoundingClientRect()
    if (!bounds?.width) return
    setPosition(getComparisonSliderPosition(clientX, bounds.left, bounds.width))
  }

  function startSliderDrag(event) {
    event.preventDefault()
    event.stopPropagation()
    draggingRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateSliderPosition(event.clientX)
  }

  function moveSlider(event) {
    if (!draggingRef.current) return
    event.preventDefault()
    event.stopPropagation()
    updateSliderPosition(event.clientX)
  }

  function stopSliderDrag(event) {
    draggingRef.current = false
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  useEffect(() => {
    setSelectedScanId('')
    setPickerOpen(false)
  }, [scan?.id])
  useEffect(() => setPosition(50), [scan?.id, comparisonScan?.id])

  return (
    <section aria-label="Before and after scan comparison" className="relative">
      <div
        ref={comparisonRef}
        className="relative w-full overflow-hidden rounded-2xl select-none"
        style={{ height: 'min(68vh, 720px)', minHeight: 300, background: '#080808', border: '1px solid rgba(255,255,255,0.1)', touchAction: 'pan-y' }}
      >
        <SliderPhoto scan={scan} label="Photo A" fallback="No photo saved for this scan" />
        {comparisonScan ? (
          <>
            <SliderPhoto scan={comparisonScan} label="Photo B" clip={`inset(0 0 0 ${position}%)`} fallback="No photo saved for Photo B" />
            <button type="button" aria-label="Change Photo B from saved Progress scans" onClick={() => setPickerOpen(true)} onPointerDown={event => event.stopPropagation()} className="absolute inset-0 z-10" style={{ clipPath: `inset(0 0 0 ${position}%)`, background: 'transparent' }} />
          </>
        ) : (
          <button type="button" aria-label="Select Photo B from saved Progress scans" aria-expanded={pickerOpen} onClick={() => setPickerOpen(true)} onPointerDown={event => event.stopPropagation()} className="absolute inset-0 z-10" style={{ clipPath: `inset(0 0 0 ${position}%)`, background: '#000' }}>
            <span className="absolute inset-y-0 right-0 flex w-1/2 flex-col items-center justify-center gap-3 px-4 text-center" style={{ color: '#fff' }}>
              <Camera size={30} style={{ color: GOLD, filter: 'drop-shadow(0 0 8px rgba(198,168,92,0.38))' }} />
              <span className="font-heading text-lg font-bold">PHOTO B</span>
              <span className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Tap to choose a saved scan</span>
            </span>
          </button>
        )}
        <div aria-hidden="true" className="absolute top-0 bottom-0 z-20 w-0.5 pointer-events-none" style={{ left: `${position}%`, background: '#fff', boxShadow: '0 0 12px rgba(0,0,0,0.6)' }} />
        <button
          type="button"
          aria-label="Drag the comparison slider"
          onPointerDown={startSliderDrag}
          onPointerMove={moveSlider}
          onPointerUp={stopSliderDrag}
          onPointerCancel={stopSliderDrag}
          className="absolute top-1/2 z-30 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full"
          style={{ left: `${position}%`, background: GOLD, border: '2px solid white', color: '#fff', cursor: 'ew-resize' }}
        >
          <MoveHorizontal size={20} strokeWidth={2.5} />
        </button>
      </div>
      {!candidates.length && scan && <p role="status" className="mt-3 text-center font-body text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>No other saved scans in Progress yet.</p>}
      {pickerOpen && <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-labelledby="scan-picker-title">
        <header className="flex shrink-0 items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top,0px)+20px)]" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
            <div>
              <h2 id="scan-picker-title" className="font-heading text-xl font-bold text-white">Choose Photo B</h2>
              <p className="mt-1 font-body text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Select a saved scan from Progress</p>
            </div>
            <button type="button" aria-label="Close scan picker" onClick={() => setPickerOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: '#222', color: '#fff' }}><X size={18} /></button>
        </header>
        <div aria-label="Saved Progress scans" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ touchAction: 'pan-y' }}>
          {candidates.map((candidate, index) => <ScanHistoryRow key={candidate.id} scan={candidate} index={index} showChevron={false} onTap={() => { setSelectedScanId(candidate.id); setPickerOpen(false); setPosition(50) }} />)}
        </div>
      </div>}
    </section>
  )
}
