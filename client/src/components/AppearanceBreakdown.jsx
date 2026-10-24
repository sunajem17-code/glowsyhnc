import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronRight, RefreshCw, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import './AppearanceBreakdown.css'

const pending = new Map()
const STARTERS = ["What's the fastest way to improve my appearance?", 'Build my personalized skincare routine.', 'What are my strongest facial features?', 'Which improvements should I prioritize?']
function saveAnalysis(scan, analysis) {
  const update = item => item?.id === scan.id ? { ...item, aiScore: { ...item.aiScore, appearanceAnalysis: analysis } } : item
  useStore.setState(state => ({ currentScan: update(state.currentScan), scans: state.scans.map(update) }))
}
function FindingSection({ title, icon: Icon, items, empty, delay }) {
  return <section className="appearance-section appearance-enter" style={{ '--appearance-delay': `${delay}ms` }}>
    <h2><Icon size={18} aria-hidden="true" />{title}</h2>
    {items.length ? <div className="appearance-findings">{items.map((item, index) => <article key={`${item.title}-${index}`}>
      <h3>{item.title}</h3><p>{item.observation}</p><p className="appearance-significance">{item.significance}</p>
      {item.recommendation && <p className="appearance-advice"><Check size={14} aria-hidden="true" />{item.recommendation}</p>}
      {item.confidence === 'medium' && <span className="appearance-confidence">Some uncertainty in this photo</span>}
    </article>)}</div> : <p className="appearance-empty">{empty}</p>}
  </section>
}
export default function AppearanceBreakdown({ scan }) {
  const navigate = useNavigate()
  const owner = useStore(state => state.user?.id)
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId
  const cached = scan?.aiScore?.appearanceAnalysis
  const [analysis, setAnalysis] = useState(cached?.scanId === scanId ? cached : null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setAnalysis(cached?.scanId === scanId ? cached : null)
    setError('')
    if (cached?.scanId === scanId) return
    if (!scanId) { setError('This older scan has no saved analysis reference. Take a new scan to get your personalized breakdown.'); return }
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
  const openCoach = prompt => navigate('/progress', { state: { scanId, coachPrompt: prompt || 'Help me understand my appearance breakdown and prioritize my next steps.' } })
  return <div className="appearance-dashboard">
    <div className="appearance-preview">
      {scan?.facePhotoUrl && <img src={scan.facePhotoUrl} alt="Your completed scan" width="88" height="112" />}
      <div><h2>Your Appearance Breakdown</h2><p>A closer look at what’s working and where to focus next.</p><span><ShieldCheck size={13} aria-hidden="true" />Based on your completed scan</span></div>
    </div>
    {loading && <div className="appearance-loading" role="status"><span className="appearance-loading-line" /><h3>Looking closer at your scan</h3><p>Connecting visible findings with practical next steps…</p></div>}
    {error && <div className="appearance-error" role="alert"><h3>Your scan is safe</h3><p>{error}</p>{scanId ? <button onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} />Retry Analysis</button> : <button onClick={() => navigate('/scan')}>Take a New Scan<ChevronRight size={15} /></button>}</div>}
    {analysis && <>
      <FindingSection title="Your Strongest Features" icon={Sparkles} items={analysis.strengths} delay={0} empty="There isn’t enough clear evidence to identify specific strengths from this photo." />
      <FindingSection title="What’s Holding You Back" icon={Target} items={analysis.improvementOpportunities} delay={60} empty="No clear, actionable concerns were identified. There’s no need to invent something to fix." />
      <FindingSection title="What’s Already Going Well" icon={Check} items={analysis.positiveObservations} delay={120} empty="More consistent lighting and a clear photo will help identify what to maintain." />
      <section className="appearance-section appearance-enter" style={{ '--appearance-delay': '180ms' }}>
        <h2><ArrowUpRight size={19} aria-hidden="true" />Your Glow-Up Opportunities</h2>
        <div className="appearance-actions">{analysis.recommendedActions.map((action, index) => <article key={`${action.title}-${index}`}>
          <span className="appearance-rank" aria-label={`Priority ${index + 1}`}>{index + 1}</span><div><h3>{action.title}</h3><p>{action.reason}</p><ul>{action.steps.map(step => <li key={step}>{step}</li>)}</ul>
          {(action.frequency || action.timeframe) && <div className="appearance-routine">{action.frequency && <p><strong>Routine</strong>{action.frequency}</p>}{action.timeframe && <p><strong>Timeframe</strong>{action.timeframe}</p>}</div>}</div>
        </article>)}</div>
        {!analysis.recommendedActions.length && <p className="appearance-empty">This scan doesn’t support specific changes yet. Ask your coach about taking a clearer comparison photo.</p>}
      </section>
      {analysis.products.length > 0 && <section className="appearance-section"><h2>Recommended For You</h2><p className="appearance-section-note">Only what fits your findings. Products are optional.</p><div className="appearance-products">{analysis.products.map(product => <article key={product.id}>
        <img src={product.imageUrl} alt={product.name} width="82" height="108" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />
        <div><h3>{product.name}</h3><p className="appearance-benefit">{product.benefit}</p><p>{product.reason}</p><a href={product.amazonUrl} target="_blank" rel="noopener noreferrer sponsored">View Product<ArrowUpRight size={14} /></a><a className="appearance-product-details" href={product.sourceUrl} target="_blank" rel="noopener noreferrer">Manufacturer details</a></div>
      </article>)}</div><p className="appearance-affiliate">Amazon affiliate links. Ascendus may earn a commission. Check current price and availability on Amazon.</p></section>}
      {analysis.limitations.length > 0 && <details className="appearance-limitations"><summary>About this photo’s limitations</summary><ul>{analysis.limitations.map(item => <li key={item}>{item}</li>)}</ul><p>Visible observations guide these suggestions; they are not medical diagnoses or objective appearance measurements.</p></details>}
    </>}
    <section className="appearance-coach"><Sparkles size={23} aria-hidden="true" /><h2>Want to unlock your full potential?</h2><p>Your scan is just the beginning. Your AI Coach can help you understand your results, build a personalized routine, and track your improvement.</p>
      <button onClick={() => openCoach()} disabled={!scanId}>Ask My AI Coach<ArrowUpRight size={18} /></button>
      <div className="appearance-starters">{STARTERS.map(prompt => <button key={prompt} onClick={() => openCoach(prompt)} disabled={!scanId}>{prompt}<ChevronRight size={14} /></button>)}</div>
    </section>
  </div>
}
