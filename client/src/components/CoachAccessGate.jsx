import { useNavigate } from 'react-router-dom'

export default function CoachAccessGate({ context }) {
  const navigate = useNavigate()
  const unavailable = !context || context.status === 'unavailable'
  const needsScan = !context?.hasCompletedScan
  return (
    <section className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <h1 className="text-3xl font-bold">{unavailable ? 'Checking coach access' : needsScan ? 'Scan required' : 'Pro required'}</h1>
      <p className="mt-3 text-sm opacity-70">{unavailable ? 'Please wait. If this continues, reload to try again.' : needsScan ? 'Complete a scan first to get personalized coaching.' : 'Get Ascendus Max to unlock AI Coach and your full scan results.'}</p>
      {!unavailable && <button className="mt-6 rounded-2xl px-8 py-4 font-bold" style={{ background: '#C6A85C', color: '#000' }} onClick={() => navigate(needsScan ? '/scan' : '/unlock?paywall=1')}>{needsScan ? 'Take a scan' : 'Get Ascendus Max'}</button>}
    </section>
  )
}
