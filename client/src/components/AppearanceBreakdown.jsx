import { withoutRatings } from '../utils/prosConsText'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import { appearanceScoresForScan, getCurrentAppearanceAnalysis, isCurrentAppearanceAnalysis, prepareAppearancePhoto } from '../utils/appearanceAnalysis'
import './AppearanceBreakdown.css'

const pending = new Map()

function saveAnalysis(scan, analysis) {
  const update = item => item?.id === scan.id ? { ...item, aiScore: { ...item.aiScore, appearanceAnalysis: analysis } } : item
  useStore.setState(state => ({ currentScan: update(state.currentScan), scans: state.scans.map(update) }))
}

function uniquePoints(...groups) {
  const seen = new Set()
  return groups.flatMap(group => Array.isArray(group) ? group : []).filter(item => {
    const catalogId = typeof item?.catalogId === 'string' ? item.catalogId : typeof item?.catalog_id === 'string' ? item.catalog_id : ''
    const title = typeof item?.title === 'string' ? item.title.trim() : ''
    const observation = typeof item?.observation === 'string' ? item.observation.trim() : ''
    const key = catalogId || `${title.toLowerCase()}|${observation.toLowerCase()}`
    if ((!title && !observation) || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function savedAnalysisFor(scan, scanId) {
  // Only reuse a complete breakdown linked to this exact scan. Legacy score
  // summaries are not personalized Pros/Cons and must not suppress generation.
  return getCurrentAppearanceAnalysis(scan, scanId)
}

export default function AppearanceBreakdown({
  scan,
  isPremium = false,
  embedded = false,
  page: controlledPage,
  onPageChange,
}) {
  const navigate = useNavigate()
  const owner = useStore(state => state.user?.id)
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId || scan?.id
  const cached = savedAnalysisFor(scan, scanId)
  const [analysis, setAnalysis] = useState(cached)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [internalPage, setInternalPage] = useState('pros')
  const page = controlledPage ?? internalPage
  const changePage = onPageChange ?? setInternalPage

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
    if (!pending.has(key)) pending.set(key, (async () => {
      const scanPhotoData = await prepareAppearancePhoto(scan)
      return api.coach.appearance(scanId, scanPhotoData ? { scanPhotoData, scanScores: appearanceScoresForScan(scan) } : {})
    })().finally(() => pending.delete(key)))
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
  return <div className={`appearance-dashboard${embedded ? ' appearance-dashboard--embedded' : ''}`}>
    {!embedded && <div role="tablist" aria-label="Appearance points" className="appearance-page-switch">
      <button type="button" role="tab" aria-selected={page === 'pros'} aria-controls="appearance-points-panel" onClick={() => changePage('pros')}>Pros</button>
      <button type="button" role="tab" aria-selected={page === 'cons'} aria-controls="appearance-points-panel" onClick={() => changePage('cons')}>Cons</button>
    </div>}
    <section id={embedded ? undefined : 'appearance-points-panel'} role="tabpanel" aria-label={pageTitle} className={`appearance-points${embedded ? ' appearance-points--embedded' : ''}`}>
      {!embedded && <h2>{pageTitle}</h2>}
      {loading && !analysis && <div className="appearance-state" role="status"><span className="appearance-loading-line" /><p>Finding your points…</p></div>}
      {error && <div className="appearance-state appearance-error" role="alert"><p>{error}</p>{scanId ? <button type="button" onClick={() => setRetry(value => value + 1)}>Try Again</button> : <button type="button" onClick={() => navigate('/scan')}>Take a New Scan<ChevronRight size={15} /></button>}</div>}
      {analysis && <ul
        className="appearance-points-list"
        tabIndex={isPremium ? 0 : -1}
        aria-label={`${pageTitle} details`}
        aria-hidden={!isPremium}
        style={!isPremium ? { filter: 'blur(7px)', userSelect: 'none' } : undefined}
      >{points.length ? points.map((item, index) => {
        const pointTitle = item.title?.trim() || item.observation?.trim()
        const explanationParts = [item.observation?.trim(), item.significance?.trim()]
          .filter((text, partIndex, all) => text && text !== pointTitle && all.indexOf(text) === partIndex)
        return <li key={`${pointTitle}-${index}`}>
          <span className="appearance-point-title">{withoutRatings(pointTitle)}</span>
          {explanationParts.length > 0 && <p>{withoutRatings(explanationParts.join(' '))}</p>}
          {item.recommendation?.trim() && <p className="appearance-point-advice"><span>Try</span> {withoutRatings(item.recommendation)}</p>}
        </li>
      }) : <li className="appearance-points-empty">{page === 'pros' ? 'No clear pros were identified in this scan.' : 'No specific cons were identified in this scan.'}</li>}</ul>}
    </section>
  </div>
}
