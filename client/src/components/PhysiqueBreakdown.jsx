import { balancedPhysiqueAreas } from '../utils/physiqueBalance'
import { withoutRatings } from '../utils/prosConsText'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { triggerHaptic } from '../utils/haptics'
import { getPhysiqueMetricScore } from '../utils/physiqueResults'
import './AppearanceBreakdown.css'

function getPhysiqueAnalysis(scan) {
  return { ...scan?.aiScore, ...scan?.aiScore?.physiqueResult, ...scan?.aiScore?.physiqueScore, ...scan?.physiqueScore }
}

const ACTIONABLE_METRICS = [
  { key: 'muscle_mass', label: 'Muscle Mass' },
  { key: 'body_fat_score', label: 'Body Fat' },
  { key: 'v_taper', label: 'V-Taper' },
  { key: 'frame_width', label: 'Frame Width' },
]

const OUT_OF_SCOPE_LANGUAGE = /\b(?:lighting|light(?:ing)?|camera|crop(?:ped)?|pose|angle|clothing|shirt|outfit|framing|shot|facial?|face|presentation)\b/i
const PHYSIQUE_FOCUS_LANGUAGE = /\b(?:muscle|chest|shoulders?|back|arms?|legs?|abs?|abdomen|waist|taper|lean(?:ness)?|body fat|frame|width|clavicles?|torso|posture|proportions?)\b/i
const POSITIVE_LANGUAGE = /\b(?:strong|well[- ]developed|balanced|good|clear|proportionate|broad|wide|lean|muscular|above average|stands out)\b/i
const NEGATIVE_LANGUAGE = /\b(?:weak|soft|limited|needs? work|can improve|room to improve|low|poor|below(?: average)?|underdeveloped|less|lacks?|narrow|uneven|not enough|not strongly|little|mild|can be improved)\b/i

function scoreBasedFinding(metric, score, page) {
  if (page === 'cons') {
    const findings = {
      muscle_mass: {
        title: `Opportunity to develop muscle`,
        explanation: 'Building your chest, shoulders, back, and arms can make your upper body look more muscular and balanced.',
        advice: 'Try three full-body strength workouts each week. Include a press, a row, and a leg exercise; when you can do the reps easily, add a little weight or a few reps.',
      },
      body_fat_score: {
        title: `Visible leanness can improve`,
        explanation: 'There is room to build more visible muscle definition. A photo does not measure body-fat percentage or health.',
        advice: 'If losing fat is appropriate for you, use small, steady changes: keep strength training, walk regularly, and eat balanced meals. Avoid crash diets.',
      },
      v_taper: {
        title: `Shoulder-to-waist shape can improve`,
        explanation: 'Building shoulder and back muscle can further develop your shoulder-to-waist contrast.',
        advice: 'Train your back and shoulders twice a week. Use rows or pulldowns for your back and lateral raises for your shoulders, adding reps slowly.',
      },
      frame_width: {
        title: `Upper-body width can improve`,
        explanation: 'Upper-body width is an area to build. You cannot change bone width with exercise, but stronger shoulders and back can add visible width.',
        advice: 'Add rows or pulldowns and lateral raises to strength workouts twice a week. Start with a weight you can lift with steady control.',
      },
    }
    return { ...findings[metric.key], metric, source: 'score' }
  }

  const findings = {
    muscle_mass: {
      title: `Muscle development is a relative strength`,
      explanation: 'Muscle development is one of the stronger areas in your current physique. It gives you a foundation to build on across your chest, shoulders, back, and arms.',
      advice: 'Keep a consistent strength routine with pressing and rowing movements. Build gradually by adding a few reps or a little weight when your technique stays controlled.',
    },
    body_fat_score: {
      title: `Visible definition is a relative strength`,
      explanation: 'Visible muscle definition is one of your relative strengths. Maintaining it while building muscle can help your existing shape look more developed; a photo does not measure your body-fat percentage.',
      advice: 'Keep strength training, regular meals, and a sustainable activity routine consistent. Build on the definition you have rather than chasing extreme leanness or rapid weight changes.',
    },
    v_taper: {
      title: `Shoulder-to-waist shape is a relative strength`,
      explanation: 'Shoulder-to-waist balance is one of the stronger parts of your current physique. That contrast provides a foundation for a more defined V-shaped upper body.',
      advice: 'Keep rows or pulldowns and lateral raises in your weekly routine. Develop your back and shoulders gradually while keeping your core training balanced.',
    },
    frame_width: {
      title: `Upper-body frame is a relative strength`,
      explanation: 'Upper-body frame proportions are one of your relative strengths. Developing the muscle around your shoulders and back can build on those proportions without trying to change your bone structure.',
      advice: 'Train your shoulders and upper back consistently with controlled lateral raises and rows. Track progress over time instead of making large changes to your routine after one scan.',
    },
  }
  return { ...findings[metric.key], metric, source: 'score' }
}

function parseFinding(text) {
  const adviceMatch = text.match(/\s+Try:\s*/i)
  const findingText = adviceMatch ? text.slice(0, adviceMatch.index).trim() : text.trim()
  const advice = adviceMatch ? text.slice(adviceMatch.index + adviceMatch[0].length).trim() : ''
  const match = findingText.match(/^(.+?)\s+[—–:]\s+(.+)$/)
  return match
    ? { title: match[1].trim(), explanation: match[2].trim(), advice }
    : { title: findingText, explanation: '', advice }
}

function relatedMetric(point, scan) {
  const text = point.toLowerCase()
  const key = text.includes('abdom') || text.includes('definition') || text.includes('lean') || text.includes('body fat')
    ? 'body_fat_score'
    : text.includes('taper') || text.includes('shoulder-to-waist')
      ? 'v_taper'
      : text.includes('frame') || text.includes('width') || text.includes('shoulder')
        ? 'frame_width'
        : text.includes('muscle') || text.includes('chest') || text.includes('arm') || text.includes('back') || text.includes('leg')
          ? 'muscle_mass'
          : null
  return ACTIONABLE_METRICS.find(metric => metric.key === key && getPhysiqueMetricScore(scan, key) != null)
}

function getSavedFindings(points, page, scan, usedMetrics) {
  if (!Array.isArray(points)) return []
  return points
    .filter(point => typeof point === 'string' && point.trim() && !OUT_OF_SCOPE_LANGUAGE.test(point) && PHYSIQUE_FOCUS_LANGUAGE.test(point))
    .map(text => ({ text: text.trim(), ...parseFinding(text.trim()) }))
    .filter(finding => {
      const content = `${finding.title} ${finding.explanation}`
      const isPositive = POSITIVE_LANGUAGE.test(content)
      const isNegative = NEGATIVE_LANGUAGE.test(content)

      // Enforce category polarity before matching a score. A metric match must
      // never allow a weakness into Pros or praise into Cons.
      if (page === 'pros' && (!isPositive || isNegative)) return false
      if (page === 'cons' && (!isNegative || isPositive)) return false

      const metric = relatedMetric(content, scan)
      if (metric) {
        return !usedMetrics.has(metric.key)
      }
      return true
    })
    .map(finding => {
      const metric = relatedMetric(`${finding.title} ${finding.explanation}`, scan)
      return { ...finding, metric, source: 'analysis' }
    })
}

export default function PhysiqueBreakdown({ scan, coachPhotoUrl, showCoach = true, navigation = null }) {
  const navigate = useNavigate()
  const [page, setPage] = useState('pros')
  const analysis = getPhysiqueAnalysis(scan)
  const allPoints = page === 'pros' ? (analysis.physique_strengths ?? analysis.strengths ?? analysis.keyStrengths) : (analysis.physique_improvements ?? analysis.improvements ?? analysis.keyWeaknesses)
  const metricPoints = balancedPhysiqueAreas(scan)[page]
  const savedFindings = getSavedFindings(allPoints, page, scan, new Set())
  const pointsByMetric = new Map()
  const additionalFindings = []
  for (const finding of savedFindings) {
    if (!finding.metric) {
      additionalFindings.push(finding)
      continue
    }
    if (!pointsByMetric.has(finding.metric.key)) pointsByMetric.set(finding.metric.key, finding)
  }
  const points = metricPoints.length ? metricPoints.map(metric => {
    const fallback = scoreBasedFinding(metric, metric.score, page)
    const saved = pointsByMetric.get(metric.key)
    if (!saved) return fallback
    if (page !== 'pros') return saved
    return { ...fallback, ...saved, explanation: saved.explanation || fallback.explanation, advice: saved.advice || fallback.advice }
  }) : [...pointsByMetric.values(), ...additionalFindings].slice(0, 2)
  const title = page === 'pros' ? 'Pros' : 'Cons'
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId

  return <div className="appearance-dashboard physique-dashboard">
    <div role="tablist" aria-label="Physique points" className="appearance-page-switch">
      <button type="button" role="tab" aria-selected={page === 'pros'} aria-controls="physique-points-panel" onClick={() => setPage('pros')}>Pros</button>
      <button type="button" role="tab" aria-selected={page === 'cons'} aria-controls="physique-points-panel" onClick={() => setPage('cons')}>Cons</button>
    </div>
    <section id="physique-points-panel" role="tabpanel" aria-label={title} className="appearance-points">
      <h2>{title}</h2>
      <ul className="appearance-points-list" tabIndex={0} aria-label={`${title} details`}>
        {points.length
          ? points.map(({ title: pointTitle, explanation, advice }, index) => {
            return <li className="physique-analysis-item" key={`${pointTitle}-${index}`}>
              <span className="physique-analysis-bullet" aria-hidden="true">•</span>
              <div className="physique-analysis-copy">
                <span className="appearance-point-title">{withoutRatings(pointTitle)}</span>
                <p>{withoutRatings(explanation)}</p>
                {advice && <p className="appearance-point-advice"><span>Try</span> {withoutRatings(advice)}</p>}
              </div>
            </li>
          })
          : <li className="physique-analysis-item appearance-points-empty">{page === 'pros' ? 'The saved scan is missing the details needed to show your strengths. Take a new scan to refresh this breakdown.' : 'This scan did not identify a specific area to improve.'}</li>}
      </ul>
    </section>
    {navigation}
    {showCoach && <button type="button" className="appearance-coach-button" onClick={() => {
      triggerHaptic()
      navigate('/coach', { state: {
        scanId,
        coachPhotoUrl: coachPhotoUrl || scan?.bodyPhotoUrl || scan?.facePhotoUrl || null,
        coachPrompt: 'Please help me understand my physique scan and suggest practical next steps based on the visible results.',
      } })
    }}>Ask AI Coach</button>}
  </div>
}
