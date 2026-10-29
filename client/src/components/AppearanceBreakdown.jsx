import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { api } from '../utils/api'
import { withDeadline } from '../utils/requestTimeout'
import useStore from '../store/useStore'
import { appearanceScoresForScan, getDisplayableAppearanceAnalysis, isCurrentAppearanceAnalysis, prepareAppearancePhoto } from '../utils/appearanceAnalysis'
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

function savedAnalysisFor(scan, scanId) {
  return getDisplayableAppearanceAnalysis(scan, scanId)
}

export default function AppearanceBreakdown({ scan }) {
  const navigate = useNavigate()
  const owner = useStore(state => state.user?.id)
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId || scan?.id
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
    setLoading(false)
    setPage('pros')
    const source = scan?.aiScore?.appearanceAnalysis || scan?.appearanceAnalysis
    if (isCurrentAppearanceAnalysis(source, scanId)) return
    if (!scanId) {
      setError('This older scan has no saved analysis reference. Take a new scan to get your personalized breakdown.')
      return
    }
    setLoading(true)
    const key = `${owner}:${scanId}`
    if (!pending.has(key)) pending.set(key, withDeadline((async () => {
      const scanPhotoData = await prepareAppearancePhoto(scan)
      return api.coach.appearance(scanId, scanPhotoData ? { scanPhotoData, scanScores: appearanceScoresForScan(scan) } : {})
    })(), 75_000, 'Your analysis took too long. Please try again.').finally(() => pending.delete(key)))
    pending.get(key).then(({ analysis: result }) => {
      if (!active) return
      if (!isCurrentAppearanceAnalysis(result, scanId)) throw new Error('The saved analysis could not be refreshed yet. Please retry.')
      saveAnalysis(scan, result)
      setAnalysis(result)
    }).catch(err => { if (active) setError(err.message || 'Your analysis could not load. Please retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [owner, scanId, retry]) // eslint-disable-line react-hooks/exhaustive-deps

  const pros = uniquePoints(analysis?.strengths, analysis?.positiveObservations)
  const focusAreas = uniquePoints(analysis?.improvementOpportunities)
  const points = page === 'pros' ? pros : focusAreas
  const pageTitle = page === 'pros' ? 'Pros' : 'Cons'
  useEffect(() => {
    if (import.meta.env.DEV && analysis) console.info('[appearance-analysis]', { stage: 'findings_rendered', pros: pros.length, cons: focusAreas.length })
  }, [analysis, pros.length, focusAreas.length])
  return <div className="appearance-dashboard">
    <div role="tablist" aria-label="Appearance points" className="appearance-page-switch">
      <button type="button" role="tab" aria-selected={page === 'pros'} aria-controls="appearance-points-panel" onClick={() => setPage('pros')}>Pros</button>
      <button type="button" role="tab" aria-selected={page === 'cons'} aria-controls="appearance-points-panel" onClick={() => setPage('cons')}>Cons</button>
    </div>
    <section id="appearance-points-panel" role="tabpanel" aria-label={pageTitle} className="appearance-points">
      <h2>{pageTitle}</h2>
      {loading && !analysis && <div className="appearance-state" role="status"><span className="appearance-loading-line" /><p>Finding your points…</p></div>}
      {error && <div className="appearance-state appearance-error" role="alert"><p>{error}</p>{scanId ? <button type="button" onClick={() => setRetry(value => value + 1)}>Try Again</button> : <button type="button" onClick={() => navigate('/scan')}>Take a New Scan<ChevronRight size={15} /></button>}</div>}
      {analysis && <ul className="appearance-points-list" tabIndex={0} aria-label={`${pageTitle} details`}>{points.length ? points.map((item, index) => {
        const pointTitle = item.title?.trim() || item.observation?.trim()
        const explanation = item.observation?.trim() || item.significance?.trim()
        const action = page === 'cons' ? item.recommendation?.trim() : ''
        return <li key={`${pointTitle}-${index}`}>
          <span className="appearance-point-title">{pointTitle}</span>
          {explanation && explanation !== pointTitle && <p>{explanation}</p>}
          {action && action !== explanation && <p>{action}</p>}
        </li>
      }) : <li className="appearance-points-empty">{page === 'pros' ? 'No clear pros were identified in this scan.' : 'No specific cons were identified in this scan.'}</li>}</ul>}
    </section>
  </div>
}
