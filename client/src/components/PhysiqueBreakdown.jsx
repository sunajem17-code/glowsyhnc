import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { triggerHaptic } from '../utils/haptics'
import { getPhysiqueMetricScore } from '../utils/physiqueResults'
import './AppearanceBreakdown.css'

function getPhysiqueAnalysis(scan) {
  return scan?.physiqueScore ?? scan?.aiScore?.physiqueScore ?? scan?.aiScore?.physiqueResult ?? scan?.aiScore ?? {}
}

const RELATED_METRICS = [
  { key: 'body_fat_score', label: 'Body Fat' },
  { key: 'v_taper', label: 'V-Taper' },
  { key: 'frame_width', label: 'Frame Width' },
  { key: 'muscle_mass', label: 'Muscle Mass' },
  { key: 'potential', label: 'Potential' },
  { key: 'overall', label: 'Overall' },
]
const SCORE_METRICS = [
  { key: 'overall', label: 'Overall' },
  { key: 'potential', label: 'Potential' },
  { key: 'muscle_mass', label: 'Muscle Mass' },
  { key: 'body_fat_score', label: 'Body Fat' },
  { key: 'v_taper', label: 'V-Taper' },
  { key: 'frame_width', label: 'Frame Width' },
]

const METRIC_EXPLANATIONS = {
  overall: 'At this level, the combined visible physique ratings sit above the rubric midpoint; the score describes this photo, not health or fitness.',
  potential: 'Your potential rating is higher than your overall rating, so the assessment sees more room for refinement than your current score alone suggests.',
  muscle_mass: 'Visible development across the muscle groups shown supports this rating; areas covered by clothing are not estimated.',
  body_fat_score: 'The scan notes clear abdominal definition, which supports the visible leanness rating; this is not a body-fat measurement.',
  v_taper: 'The scan calls out a strong shoulder-to-waist taper, consistent with the visible proportions in this pose.',
  frame_width: 'This reflects apparent shoulder and torso width in the image; it does not measure skeletal width.',
}

function explainPoint(text, metric, page, scan) {
  const match = text.match(/^(.+?)\s+[—–:]\s+(.+)$/)
  if (match) return { title: match[1].trim(), explanation: match[2].trim() }

  if (page === 'pros' && metric) {
    const metricScore = getPhysiqueMetricScore(scan, metric.key)
    if (metric.key === 'potential') {
      const overall = getPhysiqueMetricScore(scan, 'overall')
      return { title: text, explanation: `At ${metricScore.toFixed(1)}, this score is above your ${overall?.toFixed(1) ?? 'current'} overall rating, so the assessment sees room for refinement—not a guaranteed outcome.` }
    }
    if (metric.key === 'muscle_mass') {
      return { title: text, explanation: `The scan rated visible muscle development ${metricScore.toFixed(1)}. It considers only the muscle groups shown in this photo, not areas covered by clothing.` }
    }
    return { title: text, explanation: METRIC_EXPLANATIONS[metric.key] }
  }

  const normalizedText = text.toLowerCase()
  if (page === 'cons' && normalizedText.includes('posture')) {
    return { title: text, explanation: 'A relaxed, upright stance would make your shoulder and torso proportions easier to read in the photo. This is a suggestion for presenting the scan, not a judgment about your everyday posture.' }
  }
  if (page === 'cons' && normalizedText.includes('chest')) {
    return { title: text, explanation: 'The upper chest appears less developed than the shoulders and arms in this pose, making it a focused area to build. The rest of the visible torso still reads as muscular.' }
  }
  if (page === 'cons' && metric) {
    return { title: text, explanation: `In this photo, ${metric.label.toLowerCase()} appears to be an area with room to refine compared with the other visible features. Pose, lighting, and camera angle can affect how it reads.` }
  }

  const explanation = page === 'pros'
    ? 'This is a specific positive observation from the scan; lighting, pose, and camera angle can affect how it appears.'
    : 'This is a specific area the scan suggests refining, based on how your physique appears in this photo.'
  return { title: text, explanation }
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
  return RELATED_METRICS.find(metric => metric.key === key && getPhysiqueMetricScore(scan, key) != null)
}

export default function PhysiqueBreakdown({ scan, coachPhotoUrl }) {
  const navigate = useNavigate()
  const [page, setPage] = useState('pros')
  const analysis = getPhysiqueAnalysis(scan)
  const allPoints = page === 'pros' ? analysis.physique_strengths : analysis.physique_improvements
  const savedPoints = Array.isArray(allPoints)
    ? allPoints.filter(point => typeof point === 'string' && point.trim()).slice(0, 4).map(text => ({ text: text.trim(), source: 'analysis' }))
    : []
  const representedMetrics = new Set(savedPoints.map(({ text }) => relatedMetric(text, scan)?.key).filter(Boolean))
  const metricPoints = SCORE_METRICS
    .map(metric => ({ ...metric, score: getPhysiqueMetricScore(scan, metric.key) }))
    .filter(metric => metric.score != null && !representedMetrics.has(metric.key)
      && (page === 'pros' ? metric.score >= 7.5 : metric.score <= 6.5))
    .sort((a, b) => page === 'pros' ? b.score - a.score : a.score - b.score)
    .slice(0, Math.max(0, 5 - savedPoints.length))
    .map(metric => ({
      text: metric.label,
      metric,
      source: 'score',
    }))
  const points = [...savedPoints, ...metricPoints]
  const title = page === 'pros' ? 'Pros' : 'Cons'
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId

  return <div className="appearance-dashboard">
    <div role="tablist" aria-label="Physique points" className="appearance-page-switch">
      <button type="button" role="tab" aria-selected={page === 'pros'} aria-controls="physique-points-panel" onClick={() => setPage('pros')}>Pros</button>
      <button type="button" role="tab" aria-selected={page === 'cons'} aria-controls="physique-points-panel" onClick={() => setPage('cons')}>Cons</button>
    </div>
    <section id="physique-points-panel" role="tabpanel" aria-label={title} className="appearance-points">
      <h2>{title}</h2>
      <ul className="physique-analysis-list" tabIndex={0} aria-label={`${title} details`}>
        {points.length
          ? points.map(({ text, metric: scoredMetric }, index) => {
            const metric = scoredMetric || relatedMetric(text, scan)
            const { title: pointTitle, explanation } = explainPoint(text, metric, page, scan)
            return <li className="physique-analysis-item" key={`${text}-${index}`}>
              <span className="physique-analysis-bullet" aria-hidden="true">•</span>
              <div className="physique-analysis-copy">
                <span className="appearance-point-title">{pointTitle}</span>
                <p>{explanation}</p>
              </div>
            </li>
          })
          : <li className="physique-analysis-item appearance-points-empty">No saved {page === 'pros' ? 'strengths' : 'improvement areas'} are available for this scan.</li>}
      </ul>
    </section>
    <button type="button" className="appearance-coach-button" onClick={() => {
      triggerHaptic()
      navigate('/coach', { state: {
        scanId,
        coachPhotoUrl: coachPhotoUrl || scan?.bodyPhotoUrl || scan?.facePhotoUrl || null,
        coachPrompt: 'Please help me understand my physique scan and suggest practical next steps based on the visible results.',
      } })
    }}>Ask AI Coach</button>
  </div>
}
