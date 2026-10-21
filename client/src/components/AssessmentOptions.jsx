import useStore from '../store/useStore'
export default function AssessmentOptions() {
  const profile = useStore(s => s.gender)
  const setGender = useStore(s => s.setGender)
  const settings = useStore(s => s.userProfile)
  const setProfile = useStore(s => s.setUserProfile)
  return <fieldset className="mx-4 my-3 p-4 rounded-2xl border border-white/15 text-white" style={{ background: '#141414' }}>
    <legend className="px-2 text-sm">Appearance feedback preferences</legend>
    <label className="block text-sm">Assessment terminology
      <select aria-label="Assessment terminology" value={settings?.assessmentProfile ?? profile ?? 'unspecified'} onChange={e => { setGender(e.target.value === 'unspecified' ? null : e.target.value); setProfile({ ...settings, assessmentProfile: e.target.value }) }} className="block w-full mt-2 p-2 rounded bg-neutral-900">
        <option value="unspecified">Neutral / unspecified</option><option value="male">Male profile</option><option value="female">Female profile</option>
      </select>
    </label>
    <label className="flex gap-2 mt-3 text-sm"><input type="checkbox" checked={settings?.knownMinor === true} onChange={e => setProfile({ ...settings, knownMinor: e.target.checked })} />The person being assessed is under 18</label>
    <label className="block mt-3 text-sm">Optional presentation goals<input aria-label="Presentation goals" maxLength={300} value={settings?.presentationGoals || ''} onChange={e => setProfile({ ...settings, presentationGoals: e.target.value })} placeholder="For example: low-maintenance, androgynous styling" className="block mt-2 w-full p-2 rounded bg-neutral-900" /></label>
    <p className="mt-2 text-xs text-neutral-400">Profiles change labels, not scores. Under-18 feedback covers grooming and presentation without numerical rankings.</p>
    <p className="mt-2 text-xs text-neutral-400">Suggestions are optional: choose styles that suit your presentation goals. No masculine or feminine appearance is required.</p>
  </fieldset>
}
