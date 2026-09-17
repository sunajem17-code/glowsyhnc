import { useEffect, useRef, useState } from 'react'
import { getLandmarks } from '../utils/faceLandmarks'
import { analyzeLandmarkEvidence } from '../utils/evidenceAnalysis'
import { validateScanQuality } from '../utils/scanQuality'

const VIEWS = [
  ['front', 'Front photo'], ['left45', 'Left 45°'], ['right45', 'Right 45°'],
  ['profile', 'Profile'],
]

export default function AnalysisInspector() {
  const [photos, setPhotos] = useState({})
  const [analysis, setAnalysis] = useState(null)
  const [quality, setQuality] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [size, setSize] = useState(null)
  const photoUrls = useRef({})

  useEffect(() => () => Object.values(photoUrls.current).forEach(url => URL.revokeObjectURL(url)), [])

  function setPhoto(view, file) {
    if (!file) return
    if (photoUrls.current[view]) URL.revokeObjectURL(photoUrls.current[view])
    const url = URL.createObjectURL(file)
    photoUrls.current[view] = url
    setPhotos(current => ({ ...current, [view]: url }))
    setAnalysis(null)
    setQuality(null)
    setError('')
  }

  async function inspect() {
    if (!photos.front) return
    setBusy(true)
    setError('')
    setAnalysis(null)
    try {
      const img = new Image()
      img.src = photos.front
      await img.decode()
      setSize({ width: img.naturalWidth, height: img.naturalHeight })
      // Existing model, run on the same front photo shown in the overlay.
      const lm = await getLandmarks(photos.front)
      setAnalysis(analyzeLandmarkEvidence(lm, img.naturalWidth, img.naturalHeight))
    } catch (err) {
      setError(`Additional image required: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function checkQuality() {
    if (!photos.front) return
    setBusy(true)
    try { setQuality(await validateScanQuality(photos.front)) }
    catch (err) { setError(`Quality check unavailable: ${err.message}`) }
    finally { setBusy(false) }
  }

  const box = { padding: 16, border: '1px solid #777', borderRadius: 8, marginTop: 16 }
  return <main style={{ maxWidth: 1000, margin: 'auto', padding: 24, fontFamily: 'system-ui' }}>
    <h1>Internal Analysis Inspector</h1>
    <p>Development only. Ratios describe this photograph; they do not establish flaws, diagnoses, or physical dimensions.</p>
    <div style={box}>
      {VIEWS.map(([key, label]) => <label key={key} style={{ display: 'block', marginBottom: 10 }}>
        {label} <input type="file" accept="image/*" onChange={e => setPhoto(key, e.target.files?.[0])} />
        {photos[key] && ' loaded'}
      </label>)}
      <p>Only the front image is measured. Additional views are captured for future pose-specific analysis and are not used to claim depth.</p>
      <button disabled={!photos.front || busy} onClick={inspect}>Inspect landmarks and ratios</button>{' '}
      <button disabled={!photos.front || busy} onClick={checkQuality}>Run existing photo-quality check</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {photos.front && <section style={box}>
      <h2>Original image and all detected landmarks</h2>
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img src={photos.front} alt="Front photo under inspection" style={{ display: 'block', maxWidth: '100%', maxHeight: 650 }} />
        {analysis?.landmarks && <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="Detected landmark overlay"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {analysis.landmarks.map(p => <circle key={p.index} cx={p.x} cy={p.y} r="0.0025" fill="#00e5ff" />)}
        </svg>}
      </div>
      {size && <p>Source dimensions: {size.width} × {size.height}px</p>}
    </section>}
    {quality && <section style={box}><h2>Existing image-quality result</h2><pre>{JSON.stringify(quality, null, 2)}</pre></section>}
    {analysis && <>
      <section style={box}><h2>Local geometry quality</h2><pre>{JSON.stringify({ status: analysis.status, quality: analysis.quality, limitations: analysis.limitations }, null, 2)}</pre></section>
      <section style={box}><h2>Normalized measurements</h2><pre>{JSON.stringify(analysis.measurements, null, 2)}</pre></section>
      <section style={box}><h2>Findings and recommendation trace</h2><pre>{JSON.stringify({ findings: analysis.findings, recommendations: analysis.recommendations }, null, 2)}</pre><p>No personalized recommendations are emitted until supported finding rules are validated.</p></section>
      <details style={box}><summary>Raw landmark coordinates ({analysis.landmarks?.length ?? 0})</summary><pre style={{ overflow: 'auto', maxHeight: 400 }}>{JSON.stringify(analysis.landmarks, null, 2)}</pre></details>
    </>}
  </main>
}
