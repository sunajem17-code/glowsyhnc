import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { api } from '../utils/api'
import { triggerHaptic } from '../utils/haptics'
import useStore from '../store/useStore'
import { conciseFinding } from '../utils/conciseFinding'
import './AppearanceBreakdown.css'

const pending = new Map()

function saveAnalysis(scan, analysis) {
  const update = item => item?.id === scan.id ? { ...item, aiScore: { ...item.aiScore, appearanceAnalysis: analysis } } : item
  useStore.setState(state => ({ currentScan: update(state.currentScan), scans: state.scans.map(update) }))
}

function uniquePoints(...groups) {
  const seen = new Set()
  return groups.flatMap(group => Array.isArray(group) ? group : []).filter(item => {
    const title = typeof item?.title === 'string' ? item.title.trim() : ''
    const observation = typeof item?.observation === 'string' ? item.observation.trim() : ''
    const key = `${title.toLowerCase()}|${observation.toLowerCase()}`
    if ((!title && !observation) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function asFindings(items) {
  return Array.isArray(items) ? items.map(item => typeof item === 'string' ? { title: item.trim(), observation: '' } : item)
    .filter(item => item && (typeof item.title === 'string' || typeof item.observation === 'string')) : []
}

function savedAnalysisFor(scan, scanId) {
  const cached = scan?.aiScore?.appearanceAnalysis || scan?.appearanceAnalysis
  if (cached?.scanId === scanId && Array.isArray(cached.strengths)) {
    return { ...cached, strengths: asFindings(cached.strengths), improvementOpportunities: asFindings(cached.improvementOpportunities), positiveObservations: asFindings(cached.positiveObservations) }
  }

  // Older progress scans already saved these observations during scoring.
  // Reuse those values directly and never call the AI just to display them.
  const strengths = asFindings(scan?.aiScore?.keyStrengths || scan?.keyStrengths)
  const improvements = asFindings(scan?.aiScore?.keyWeaknesses || scan?.keyWeaknesses)
  if (!strengths.length && !improvements.length) return null
  return { scanId, strengths, improvementOpportunities: improvements, positiveObservations: [], version: 0, source: 'saved_scan_findings' }
}

export default function AppearanceBreakdown({ scan, coachPhotoUrl }) {
  const navigate = useNavigate()
  const owner = useStore(state => state.user?.id)
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId
  const cached = savedAnalysisFor(scan, scanId)
  const [analysis, setAnalysis] = useState(cached)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState('pros')

  useEffect(() => {
    let active = true
    const saved = savedAnalysisFor(scan, scanId)
    setAnalysis(saved)
    setError('')
    if (saved) return
    if (!scanId) {
      setError('This older scan has no saved analysis reference. Take a new scan to get your personalized breakdown.')
      return
    }
    setLoading(true)
    const key = `${owner}:${scanId}`
    if (!pending.has(key)) pending.set(key, api.coach.appearance(scanId).finally(() => pending.delete(key)))
    pending.get(key).then(({ analysis: result }) => {
      if (!active) return
      if (result?.scanId !== scanId || !Array.isArray(result.strengths)) throw new Error('The analysis did not match this scan. Please retry.')
      saveAnalysis(scan, result)
      setAnalysis(result)
    }).catch(err => { if (active) setError(err.message || 'Your analysis could not load. Please retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [owner, scanId, retry]) // eslint-disable-line react-hooks/exhaustive-deps

  const pros = uniquePoints(analysis?.strengths, analysis?.positiveObservations)
  const focusAreas = uniquePoints(analysis?.improvementOpportunities)
  const points = (page === 'pros' ? pros : focusAreas).slice(0, 4)
  const pageTitle = page === 'pros' ? 'Pros' : 'Cons'
  return <div className="appearance-dashboard">
    <div role="tablist" aria-label="Appearance points" className="appearance-page-switch">
      <button type="button" role="tab" aria-selected={page === 'pros'} aria-controls="appearance-points-panel" onClick={() => setPage('pros')}>Pros</button>
      <button type="button" role="tab" aria-selected={page === 'cons'} aria-controls="appearance-points-panel" onClick={() => setPage('cons')}>Cons</button>
    </div>
    <section id="appearance-points-panel" role="tabpanel" aria-label={pageTitle} className="appearance-points">
      <h2>{pageTitle}</h2>
      {loading && <div className="appearance-state" role="status"><span className="appearance-loading-line" /><p>Finding your points…</p></div>}
      {error && <div className="appearance-state appearance-error" role="alert"><p>{error}</p>{scanId ? <button type="button" onClick={() => setRetry(value => value + 1)}>Try Again</button> : <button type="button" onClick={() => navigate('/scan')}>Take a New Scan<ChevronRight size={15} /></button>}</div>}
      {analysis && <ul className="appearance-points-list" tabIndex={0} aria-label={`${pageTitle} details`}>{points.length ? points.map((item, index) => {
        const fullTitle = item.title?.trim() || item.observation?.trim()
        const pointTitle = conciseFinding(fullTitle)
        const explanation = item.observation?.trim() || item.significance?.trim()
        return <li key={`${pointTitle}-${index}`}>
          <span className="appearance-point-title">{pointTitle}</span>
          {(explanation || fullTitle !== pointTitle) && <details><summary>Details</summary><p>{explanation && explanation !== fullTitle ? explanation : fullTitle}</p></details>}
        </li>
      }) : <li className="appearance-points-empty">{page === 'pros' ? 'No clear pros were identified in this scan.' : 'No specific cons were identified in this scan.'}</li>}</ul>}
    </section>
    <button type="button" className="appearance-coach-button" onClick={() => {
      triggerHaptic()
      navigate('/coach', { state: {
        scanId,
        coachPhotoUrl: coachPhotoUrl || scan?.facePhotoUrl || scan?.face_photo_url || scan?.face_image_url || null,
        coachPrompt: 'Please help me understand this scan and suggest practical next steps.',
      } })
    }}>Ask AI Coach</button>
  </div>
}
