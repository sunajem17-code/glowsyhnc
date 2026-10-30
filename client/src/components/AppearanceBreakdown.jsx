import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { withDeadline } from '../utils/requestTimeout'
import useStore from '../store/useStore'
import { getDisplayableAppearanceAnalysis, isCurrentAppearanceAnalysis, prepareAppearancePhoto } from '../utils/appearanceAnalysis'
import './AppearanceBreakdown.css'

const pending = new Map()
function saveAnalysis(scan, analysis, owner) {
  if (useStore.getState().user?.id !== owner) return
  const update = item => item?.id === scan.id ? { ...item, aiScore: { ...item.aiScore, appearanceAnalysis: analysis } } : item
  useStore.setState(state => ({ currentScan: update(state.currentScan), scans: state.scans.map(update) }))
}
const sourceHosts = new Set(['dermnetnz.org', 'www.mayoclinic.org', 'www.aad.org', 'aaoinfo.org', 'www.highgate-cuts.co.uk'])
function sourceLink(source) {
  try { const url = new URL(source.url); return url.protocol === 'https:' && sourceHosts.has(url.hostname) ? url.href : null } catch { return null }
}
function PracticalSteps({ plan }) {
  return <div className="appearance-action">
    {plan.title && <h4>{plan.title}</h4>}
    {plan.reason && <p>{plan.reason}</p>}
    <ol>{(plan.steps || []).map((step, index) => <li key={index}>{step}</li>)}</ol>
    {plan.frequency && <p><strong>How often:</strong> {plan.frequency}</p>}
    {plan.timeframe && <p><strong>What to expect:</strong> {plan.timeframe}</p>}
    {plan.limits && <p className="appearance-limit"><strong>Keep in mind:</strong> {plan.limits}</p>}
    {!!plan.sources?.length && <div className="appearance-sources">{plan.sources.map(source => {
      const href = sourceLink(source)
      return href ? <a key={href} href={href} target="_blank" rel="noopener noreferrer">{source.title} ↗</a> : null
    })}</div>}
  </div>
}
// Separate from the loader so saved, partial and retake states are testable.
export function AppearanceFeedback({ analysis, page = 'plan', onRetake }) {
  const quality = analysis.photoQuality
  if (quality?.status === 'retake') return <div className="appearance-retake">
    <h3>A clearer photo comes first</h3><p>{quality.reason}</p>
    <ol>{quality.retakeSteps.map((step, index) => <li key={index}>{step}</li>)}</ol>
    <p>This is a photo limitation, not a judgment about your face. We won’t guess at features we can’t see.</p>
    <button type="button" onClick={onRetake}>Retake in better light</button>
  </div>
  const findings = page === 'pros' ? analysis.strengths || [] : analysis.improvementOpportunities || []
  return <>
    {quality?.status === 'limited' && <aside className="appearance-quality"><strong>Some details are unclear</strong><p>{quality.reason}</p><button type="button" onClick={onRetake}>Take a clearer photo</button></aside>}
    {findings.map((item, index) => <article className="appearance-finding" key={`${item.title}-${index}`}>
      <h3>{item.title}</h3><p>{item.observation}</p>
      {item.significance && item.significance !== item.observation && <p>{item.significance}</p>}
      {page === 'plan' && item.recommendation && <p className="appearance-first-step"><strong>Start here:</strong> {item.recommendation}</p>}
      {page === 'plan' && item.guide && <details><summary>How to do it · timing · sources</summary><PracticalSteps plan={item.guide} /></details>}
    </article>)}
    {!findings.length && <p className="appearance-empty">{page === 'pros' ? 'There isn’t enough clear detail to call out specific strengths in this photo.' : 'No clear changeable concern was identified. You don’t need to invent something to fix.'}</p>}
    {page === 'plan' && (analysis.recommendedActions || []).map((plan, index) => <details className="appearance-finding" key={`action-${index}`} open={index === 0}><summary>{plan.title}</summary><PracticalSteps plan={{ ...plan, title: '' }} /></details>)}
    {!!analysis.limitations?.length && <details className="appearance-limitations"><summary>What this photo can’t tell us</summary><ul>{analysis.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
  </>
}
export default function AppearanceBreakdown({ scan }) {
  const navigate = useNavigate()
  const owner = useStore(state => state.user?.id)
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId || scan?.id
  const [analysis, setAnalysis] = useState(() => getDisplayableAppearanceAnalysis(scan, scanId))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState('plan')
  useEffect(() => {
    let active = true
    const saved = getDisplayableAppearanceAnalysis(scan, scanId)
    setAnalysis(saved); setError(null); setLoading(false)
    if (isCurrentAppearanceAnalysis(saved, scanId)) return
    if (!scanId) { setError({ message: 'This older scan has no saved photo reference. Take a new scan for specific feedback.', status: 404 }); return }
    setLoading(true)
    const key = `${owner}:${scanId}`
    if (!pending.has(key)) {
      const task = (async () => {
        const scanPhotoData = await prepareAppearancePhoto(scan)
        return api.coach.appearance(scanId, scanPhotoData ? { scanPhotoData } : {})
      })()
      pending.set(key, withDeadline(task, 120_000, 'The detailed feedback took too long. Your scan is safe; try again in a moment.').finally(() => pending.delete(key)))
    }
    pending.get(key).then(({ analysis: result }) => {
      if (useStore.getState().user?.id !== owner) return
      if (!isCurrentAppearanceAnalysis(result, scanId)) throw new Error('Your feedback service needs an update. Your saved scan is safe; try again later.')
      saveAnalysis(scan, result, owner)
      if (active) setAnalysis(result)
    }).catch(err => { if (active) setError({ message: err.message || 'The feedback could not load. Try again.', status: err.status, code: err.errorCode }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [owner, scanId, retry]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = isCurrentAppearanceAnalysis(analysis, scanId)
  const needsPhoto = error?.status === 404 || error?.status === 422
  const title = page === 'pros' ? 'What’s working' : 'Your next steps'
  return <div className="appearance-dashboard">
    <div role="tablist" aria-label="Appearance feedback" className="appearance-page-switch">
      <button type="button" role="tab" aria-selected={page === 'pros'} aria-controls="appearance-points-panel" onClick={() => setPage('pros')}>Strengths</button>
      <button type="button" role="tab" aria-selected={page === 'plan'} aria-controls="appearance-points-panel" onClick={() => setPage('plan')}>Your plan</button>
    </div>
    <section id="appearance-points-panel" role="tabpanel" aria-label={title} className="appearance-points">
      <h2>{title}</h2>
      <div className="appearance-feedback-scroll" tabIndex={0} aria-label={`${title} details`}>
        {loading && <div className="appearance-state" role="status"><span className="appearance-loading-line" /><p>Checking your photo and building practical next steps…</p><p>This can take up to a minute. You can leave this screen and come back.</p></div>}
        {error && <div className="appearance-state appearance-error" role="alert"><p>{error.message}</p>
          {!needsPhoto && <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)}>Try again</button>}
          <button type="button" onClick={() => navigate('/scan')}>{needsPhoto ? 'Take a new photo' : 'Retake photo instead'}</button>
        </div>}
        {current && <AppearanceFeedback analysis={analysis} page={page} onRetake={() => navigate('/scan')} />}
        {!current && analysis && <details className="appearance-previous"><summary>Previous scan notes · not refreshed</summary><p>These older observations are not the new detailed analysis and may be affected by the photo conditions.</p><ul>{[...(analysis.strengths || []), ...(analysis.improvementOpportunities || [])].map((item, index) => <li key={index}>{item.observation || item.title}</li>)}</ul></details>}
      </div>
    </section>
  </div>
}
