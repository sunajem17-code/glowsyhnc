import { useNavigate } from 'react-router-dom'

export default function CoachAccessGate({ context }) {
  const navigate = useNavigate()
  const checking = !context
  const unavailable = context?.status === 'unavailable'
  const needsScan = !context?.hasCompletedScan

  if (checking) return null

  return (
    <section className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <h1 className="text-3xl font-bold">{unavailable ? 'Couldn’t check coach access' : 'Scan required'}</h1>
      <p className="mt-3 text-sm opacity-70">{unavailable ? 'Check your connection and try again.' : 'Complete a scan first to get personalized coaching.'}</p>
      {unavailable && <button className="mt-6 rounded-2xl px-8 py-4 font-bold" style={{ background: '#C6A85C', color: '#000' }} onClick={() => window.location.reload()}>Try again</button>}
      {!unavailable && needsScan && <button className="mt-6 rounded-2xl px-8 py-4 font-bold" style={{ background: '#C6A85C', color: '#000' }} onClick={() => navigate('/scan')}>Take a scan</button>}
    </section>
  )
}
