import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { assessmentRange, assessmentScale } from '../utils/assessment'
const TITLES = { facialHarmony: 'Facial harmony', eyeArea: 'Eye area', lowerFace: 'Lower face', midfaceCheeks: 'Midface / cheeks', noseLips: 'Nose / lips', skinPresentation: 'Visible skin appearance', facialBalance: 'Facial balance', visibleSymmetry: 'Visible symmetry', distinctiveQualities: 'Distinctive qualities' }
const STATUS = { relative_strength: 'Relative strength', broadly_average: 'Broadly average', relative_limitation: 'Relative limitation', unassessable: 'Unassessable' }
function Items({ title, values }) {
  if (!values?.length) return null
  return <section className="mt-6"><h2 className="font-bold text-lg">{title}</h2><ul className="list-disc pl-5 mt-2 space-y-2 text-neutral-300">{values.map((value, i) => <li key={i}>{value}</li>)}</ul></section>
}
export default function AppearanceAssessmentResults({ scan }) {
  const navigate = useNavigate()
  const premium = useStore(s => s.isPremium)
  const a = scan.aiScore.assessment
  const [profile, setProfile] = useState(a.assessmentProfile)
  const derived = assessmentRange(a.scoreRange, profile, a.rubricVersion)
  const scale = assessmentScale(a.rubricVersion)
  const withheld = a.scoreRange === null
  const visible = premium || withheld
  return <main className="min-h-dvh bg-neutral-950 text-white px-5 py-8 pb-28 overflow-y-auto" style={{ paddingTop: 'max(32px, env(safe-area-inset-top))' }}>
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/')} className="text-sm text-neutral-400 mb-6">Back to home</button>
      <h1 className="text-3xl font-bold" style={{ color: '#C6A85C' }}>Your appearance feedback</h1>
      <p className="mt-3 text-sm text-neutral-400">Subjective feedback from photographs, not scientific measurements or a measure of personal worth.</p>
      <p className="mt-3 text-xs text-neutral-500">Rubric: {a.rubricVersion} · Not empirically calibrated</p>
      <section className="mt-6 rounded-2xl border border-white/10 p-5 bg-neutral-900">
        {withheld ? <><h2 className="text-xl font-semibold">Score withheld</h2><p className="mt-2 text-neutral-300">{a.withheldReason === 'minor' ? 'For people under 18, feedback focuses on grooming and presentation without attractiveness rankings.' : 'These photographs do not support a reliable numerical range. Follow the photo guidance below or retake your photos.'}</p></> : visible ? <>
          <p className="text-sm text-neutral-400">{scale.unit} range · out of {scale.max}</p>
          <p className="text-4xl font-bold mt-2">{String(a.scoreRange.min)}–{String(a.scoreRange.max)}</p>
          <p className="mt-3 font-semibold">{derived.min.label}{derived.min.id !== derived.max.id ? ` → ${derived.max.label}` : ''}</p>
          {derived.min.umbrella && <p className="text-sm mt-2 text-neutral-400">Additional description: Sub-5{derived.max.umbrella ? '' : ' applies to the lower endpoint only'}.</p>}
        </> : <><h2 className="text-xl font-semibold">Your assessment is ready</h2><p className="mt-2 text-neutral-300">View the range, supporting observations and limitations with Ascendus Max.</p><button className="mt-4 px-5 py-3 rounded-xl bg-amber-300 text-black font-bold" onClick={() => navigate('/unlock?paywall=1')}>View subscription options</button></>}
        <p className="mt-4 text-sm">Confidence: {a.confidence} · Image suitability: {a.imageSuitability.status}</p>
      </section>
      <label className="block mt-6 text-sm">Tier terminology (does not change your score)
        <select aria-label="Tier terminology" className="block w-full mt-2 rounded-lg p-3 bg-neutral-900 border border-white/10" value={profile} onChange={e => setProfile(e.target.value)}>
          <option value="unspecified">Neutral / unspecified</option><option value="male">Male profile</option><option value="female">Female profile</option>
        </select>
      </label>
      {scale.unit === 'PSL' && <p className="mt-4 text-sm text-neutral-400">PSL scale: 4 average · 5 attractive · 6 model tier · 7 elite model tier. Eight is a theoretical reference endpoint. These are subjective rubric anchors, not population percentiles or dating predictions.</p>}
      {visible && !withheld && a.scoreExplanation && <section className="mt-6"><h2 className="text-lg font-bold">Why this range</h2><p className="mt-2 text-neutral-300">{a.scoreExplanation}</p></section>}
      <Items title="Image limitations" values={a.imageSuitability.limitations} />
      <Items title="Photo guidance" values={a.imageSuitability.guidance} />
      <section className="mt-6"><h2 className="font-bold text-lg">Photo suitability checks</h2>{Object.entries(a.imageSuitability.checks).map(([key, item]) => <p key={key} className="mt-2 text-sm text-neutral-300"><strong>{key.replace(/([A-Z])/g, ' $1')}: {item.status}</strong> — {item.observation}</p>)}</section>
      {visible && <>
        {!withheld && <section className="mt-6"><h2 className="text-xl font-bold">Facial assessment</h2><div className="grid gap-3 mt-3">{Object.entries(a.dimensions).map(([key, value]) => <article key={key} className="rounded-xl border border-white/10 p-4"><h3 className="font-bold">{TITLES[key]}</h3><p className="text-xs mt-1 text-amber-200">{STATUS[value.status]}</p><p className="text-sm text-neutral-300 mt-2">{value.observation}</p></article>)}</div></section>}
        {!withheld && <><Items title="Relative strengths" values={a.strengths} /><Items title="Relative limitations" values={a.limitations} /></>}
        {a.presentation ? <section className="mt-6"><h2 className="text-xl font-bold">Presentation feedback</h2>
          {a.presentation.unavailable && <p className="mt-2 text-neutral-400">Presentation feedback is unavailable. Your facial assessment is unchanged.</p>}
          {Object.entries(a.presentation.observations).map(([key, item]) => <article key={key} className="mt-3 rounded-xl border border-white/10 p-4"><h3 className="font-bold capitalize">{key.replace(/([A-Z])/g, ' $1')}</h3><p className="text-xs text-amber-200 mt-1">{item.status === 'observed' ? 'Visible observation' : 'Unassessable'}</p><p className="mt-2 text-sm text-neutral-300">{item.observation}</p></article>)}
          {a.presentation.recommendations.length > 0 && <h3 className="font-bold mt-5">Practical next steps</h3>}
          {a.presentation.recommendations.map((item, i) => <article key={i} className="mt-3 rounded-xl border border-white/10 p-4"><h4 className="font-bold">{item.action}</h4><p className="mt-2 text-sm text-neutral-300">{item.observation}</p><p className="mt-2 text-sm">{item.rationale}</p><p className="mt-2 text-xs text-amber-200">Priority: {item.priority} · Effort: {item.effort} · Cost: {item.cost}</p><p className="mt-2 text-xs text-neutral-400">Basis: {item.basis.replaceAll('_', ' ')} · {item.limitations}</p></article>)}
        </section> : <Items title="Optional grooming and presentation suggestions" values={a.suggestions} />}
        <Items title="What could not be assessed" values={a.unassessableDetails} />
      </>}
      <button onClick={() => navigate('/scan')} className="mt-8 px-5 py-3 border border-amber-200/50 rounded-xl text-amber-200">Take new photographs</button>
    </div>
  </main>
}
