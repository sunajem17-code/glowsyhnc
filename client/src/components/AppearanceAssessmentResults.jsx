import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { triggerHaptic } from '../utils/haptics'
import { assessmentPresentation, formatAssessmentRange } from '../utils/assessment'
import AppearanceBreakdown from './AppearanceBreakdown'
import './AppearanceAssessmentResults.css'

function PageSwitch({ page, onChange }) {
  return <div className="assessment-results-switch" role="tablist" aria-label="Scan feedback">
    {['pros', 'cons'].map(value => <button
      key={value}
      type="button"
      role="tab"
      aria-selected={page === value}
      onClick={() => onChange(value)}
    >{value === 'pros' ? 'Pros' : 'Cons'}</button>)}
  </div>
}

export default function AppearanceAssessmentResults({ scan }) {
  const navigate = useNavigate()
  const isPremium = useStore(state => state.isPremium)
  const [page, setPage] = useState('pros')
  useEffect(() => {
    if (!scan?.id) return
    const hapticKey = `asc_scan_results_haptic:${scan.id}`
    try {
      if (sessionStorage.getItem(hapticKey)) return
      sessionStorage.setItem(hapticKey, '1')
    } catch {}
    triggerHaptic()
  }, [scan?.id])
  const assessment = scan?.aiScore?.assessment ?? {}
  const withheld = assessment.scoreRange === null
  const scoreVisible = isPremium || withheld
  const locked = !isPremium && !withheld

  let score = null
  if (assessment.scoreRange && scoreVisible) {
    try {
      score = assessmentPresentation(assessment)
    } catch {
      // Keep valid saved feature observations visible if a score presentation is unavailable.
      score = null
    }
  }

  return <main className="assessment-results-page">
    <div className="assessment-results-content">
      <button type="button" className="assessment-results-back" onClick={() => navigate('/scan')} aria-label="Back to scan">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>

      <h1>Your Results</h1>

      <section className="assessment-results-score" aria-label="Scan score">
        {withheld ? <>
          <span className="assessment-results-eyebrow">SCORE WITHHELD</span>
          <p>{assessment.withheldReason === 'minor'
            ? 'This scan provides presentation feedback without an attractiveness score.'
            : 'These photos did not support a reliable numerical range.'}</p>
        </> : scoreVisible && score ? <>
          <span className="assessment-results-eyebrow">{score.unit === 'UMAX' ? 'UMAX SCORE' : 'APPEARANCE RANGE'}</span>
          <strong>{formatAssessmentRange(score.range)}<small> / {score.max}</small></strong>
        </> : <>
          <span className="assessment-results-eyebrow">YOUR SCORE IS READY</span>
          <p>Unlock your scan to see the score and its supporting details.</p>
        </>}
      </section>

      <PageSwitch page={page} onChange={setPage} />

      <section className="assessment-results-points" aria-labelledby="assessment-results-points-title">
        <h2 id="assessment-results-points-title">{page === 'pros' ? 'Pros' : 'Cons'}</h2>
        <div className={locked ? 'assessment-results-breakdown assessment-results-breakdown--locked' : 'assessment-results-breakdown'}>
          <AppearanceBreakdown
            scan={scan}
            isPremium={isPremium}
            embedded
            page={page}
            onPageChange={setPage}
          />
          {locked && <div className="assessment-results-lock-message">
            <p>Unlock your scan to view your Pros and Cons.</p>
            <button type="button" onClick={() => navigate('/unlock?paywall=1')}>Get Ascendus Max</button>
          </div>}
        </div>
      </section>

      <p className="assessment-results-note">Photo-based observations can be affected by lighting, angle, and image quality.</p>
    </div>
  </main>
}
