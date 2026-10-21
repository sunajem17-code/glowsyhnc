import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { isCurrentAssessment, assessmentRange, assessmentScale } from '../utils/assessment'
export default function AppearanceComparison({ scans }) {
  const navigate = useNavigate()
  const setCurrentScan = useStore(s => s.setCurrentScan)
  const selected = scans.length > 1 ? [scans[scans.length - 1], scans[0]] : scans
  const sameRubric = selected.length === 2 && selected.every(isCurrentAssessment) && selected[0].aiScore.assessment.rubricVersion === selected[1].aiScore.assessment.rubricVersion
  return <main className="min-h-dvh bg-neutral-950 text-white p-6 pb-28"><div className="max-w-2xl mx-auto">
    <button onClick={() => navigate(-1)} className="mb-6 text-neutral-400">Back</button>
    <h1 className="text-3xl font-bold text-amber-200">Compare appearance feedback</h1>
    <p className="mt-4 text-neutral-300">{sameRubric ? 'These are subjective photographic ranges. Lighting, pose and uncertainty can change the result; a change does not establish a physical improvement.' : 'Results from different rubrics are not directly comparable. Each assessment retains its original rubric.'}</p>
    <p className="mt-3 text-sm text-neutral-400">Use matching camera distance, eye-level head position, neutral expression, framing and even lighting without filters. Capture differences can change the result; these photographs have not been verified as matched.</p>
    <div className="grid gap-4 mt-6">{selected.map(scan => {
      const a = isCurrentAssessment(scan) ? scan.aiScore.assessment : null
      const t = a ? assessmentRange(a.scoreRange, a.assessmentProfile, a.rubricVersion) : null
      return <article key={scan.id} className="p-5 rounded-2xl border border-white/10 bg-neutral-900">
        <h2>{new Date(scan.analyzedAt || scan.scanDate).toLocaleDateString()}</h2>
        <p className="mt-2 text-xs text-neutral-400">{a ? a.rubricVersion : 'Original legacy rubric'}</p>
        <p className="mt-3 text-2xl font-bold">{a ? a.scoreRange ? `${a.scoreRange.min}–${a.scoreRange.max} / ${assessmentScale(a.rubricVersion).max} ${assessmentScale(a.rubricVersion).unit}` : 'Score withheld' : scan.glowScore == null ? 'Score unavailable' : `${scan.glowScore} / 10`}</p>
        <p className="mt-2">{t ? t.min.label + (t.min.id === t.max.id ? '' : ` → ${t.max.label}`) : a ? '' : scan.tier}</p>
        {a && <p className="mt-2 text-sm text-neutral-400">Confidence: {a.confidence} · Image: {a.imageSuitability.status}</p>}
        <button onClick={() => { setCurrentScan(scan); navigate('/results') }} className="mt-4 underline text-amber-200">View original assessment</button>
      </article>
    })}</div>
  </div></main>
}
