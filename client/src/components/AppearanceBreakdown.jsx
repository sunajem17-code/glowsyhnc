import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import { conciseFinding } from '../utils/conciseFinding'
import { appearanceScoresForScan, getDisplayableAppearanceAnalysis, isCurrentAppearanceAnalysis, prepareAppearancePhoto, semanticDeduplicate, PHOTO_PROCESS_ADVICE } from '../utils/appearanceAnalysis'
import './AppearanceBreakdown.css'

const pending = new Map()

function saveAnalysis(scan, analysis) {
  const update = item => item?.id === scan.id ? { ...item, aiScore: { ...item.aiScore, appearanceAnalysis: analysis } } : item
  useStore.setState(state => ({ currentScan: update(state.currentScan), scans: state.scans.map(update) }))
}

function userFacingText(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\b(?:in\s+)?photo\s*:\s*(?:front|profile|side)\b\s*,?\s*/gi, '')
    .replace(/\b(?:photo|image)\s*:\s*(?:front|profile|side)\b/gi, '')
    .replace(/\s+/g, ' ').trim()
}

function cleanRecommendation(value) {
  const recommendation = userFacingText(value)
  return PHOTO_PROCESS_ADVICE.test(recommendation) ? '' : recommendation
}

function savedAnalysisFor(scan, scanId) {
  return getDisplayableAppearanceAnalysis(scan, scanId)
}

function isRetryableRefreshError(error) {
  if (error?.retryable === false || error?.isSessionExpired) return false
  if (['monthly_ai_budget_reached', 'monthly_ai_budget_unavailable'].includes(error?.errorCode)) return false
  if ([401, 403, 404, 422].includes(error?.status)) return false
  return !error?.status || [408, 429, 500, 502, 503, 504].includes(error.status)
}

export default function AppearanceBreakdown({ scan, initialPage = 'pros' }) {
  const navigate = useNavigate()
  const owner = useStore(state => state.user?.id)
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId || scan?.id
  const cached = savedAnalysisFor(scan, scanId)
  const [analysis, setAnalysis] = useState(cached)
  const [error, setError] = useState('')
  const [retryableError, setRetryableError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [expandedFinding, setExpandedFinding] = useState(null)

  useEffect(() => {
    let active = true
    const saved = savedAnalysisFor(scan, scanId)
    setAnalysis(saved)
    setError('')
    setRetryableError(false)
    const source = scan?.aiScore?.appearanceAnalysis || scan?.appearanceAnalysis
    if (isCurrentAppearanceAnalysis(source, scanId)) return
    if (!scanId) {
      if (!saved) setError('This scan has no saved results to refresh.')
      return
    }
    if (!owner) {
      if (!saved) setError('Sign in to refresh this saved scan.')
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
      if (!isCurrentAppearanceAnalysis(result, scanId)) {
        throw Object.assign(new Error('The analysis service has not received the results update yet.'), { retryable: false })
      }
      // A successful reanalysis is authoritative. Keeping the old findings here
      // can append stale points to the fresh result and make the analysis look unchanged.
      const updated = result
      saveAnalysis(scan, updated)
      setAnalysis(updated)
    }).catch(err => {
      if (!active) return
      setError(saved
        ? err.retryable === false ? '' : 'Showing your saved findings. They could not be refreshed right now.'
        : err.message || 'Your analysis could not load.')
      setRetryableError(isRetryableRefreshError(err))
    })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [owner, scanId, retry]) // eslint-disable-line react-hooks/exhaustive-deps

  const pros = semanticDeduplicate([...(analysis?.strengths || []), ...(analysis?.positiveObservations || [])])
  const focusAreas = semanticDeduplicate(analysis?.improvementOpportunities || [])
  const points = page === 'pros' ? pros : focusAreas
  const pageTitle = page === 'pros' ? 'Pros' : 'Cons'
  useEffect(() => {
    if (import.meta.env.DEV && analysis) console.info('[appearance-analysis]', { stage: 'findings_rendered', pros: pros.length, cons: focusAreas.length })
  }, [analysis, pros.length, focusAreas.length])
  return <div className="appearance-dashboard">
    <div role="tablist" aria-label="Appearance points" className="appearance-page-switch">
      <button type="button" role="tab" aria-selected={page === 'pros'} aria-controls="appearance-points-panel" onClick={() => { setPage('pros'); setExpandedFinding(null) }}>Pros</button>
      <button type="button" role="tab" aria-selected={page === 'cons'} aria-controls="appearance-points-panel" onClick={() => { setPage('cons'); setExpandedFinding(null) }}>Cons</button>
    </div>
    <section id="appearance-points-panel" role="tabpanel" aria-label={pageTitle} className="appearance-points">
      <h2>{pageTitle}</h2>
      {loading && !analysis && <div className="appearance-state" role="status"><span className="appearance-loading-line" /><p>Finding your points…</p></div>}
      {error && <div className="appearance-state appearance-error" role="alert"><p>{error}</p>{retryableError && scanId && <button type="button" onClick={() => setRetry(value => value + 1)}>Try Again</button>}{!scanId && !analysis && <button type="button" onClick={() => navigate('/scan')}>Take a New Scan<ChevronRight size={15} /></button>}</div>}
      {analysis && <ul className="appearance-points-list" aria-label={`${pageTitle} findings`}>{points.length ? points.map((item, index) => {
        const fullTitle = item.title?.trim() || item.observation?.trim()
        const pointTitle = conciseFinding(fullTitle)
        const observation = userFacingText(item.observation) || userFacingText(item.significance)
        const significance = userFacingText(item.significance)
        const recommendation = cleanRecommendation(item.recommendation)
        const detailParts = page === 'pros'
          ? [observation, significance && significance !== observation ? significance : '']
          : [observation, significance && significance !== observation ? significance : '', recommendation && recommendation !== observation ? recommendation : '']
        const explanation = detailParts.filter(Boolean).join(' ')
        const detailText = explanation && explanation !== fullTitle ? explanation : fullTitle !== pointTitle ? fullTitle : ''
        const detailKey = `${page}-${index}`
        const isExpanded = expandedFinding === detailKey
        const detailId = `appearance-detail-${page}-${index}`
        return <li key={item.id || `${pointTitle}-${index}`}>
          <span className="appearance-point-title">{pointTitle}</span>
          {detailText && <>
            <button type="button" className="appearance-details-toggle" aria-expanded={isExpanded} aria-controls={detailId} onClick={() => setExpandedFinding(current => current === detailKey ? null : detailKey)}>
              <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span> Details
            </button>
            <div id={detailId} className={`appearance-detail-panel${isExpanded ? ' is-open' : ''}`} aria-hidden={!isExpanded}>
              <div className="appearance-detail-inner"><p>{detailText}</p></div>
            </div>
          </>}
        </li>
      }) : <li className="appearance-points-empty">{page === 'pros' ? 'Pros are unavailable for this scan.' : 'Cons are unavailable for this scan.'}</li>}</ul>}
    </section>
  </div>
}
