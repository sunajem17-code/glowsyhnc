import { coachGateState } from '../utils/coachAccess'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { api } from '../utils/api'

// Children never mount before server confirmation, including direct/deep links.
export default function VerifiedCoachGate({ children }) {
  const navigate = useNavigate()
  const token = useStore(s => s.token)
  const account = useStore(s => s.user?.id)
  const subscriptionStatus = useStore(s => s.subscriptionStatus)
  const [attempt, setAttempt] = useState(0)
  const [access, setAccess] = useState(null)
  useEffect(() => {
    let active = true
    setAccess(null)
    if (!token || !account) { setAccess({ token, account, subscriptionStatus, state: 'inactive' }); return }
    api.payments.status().then(result => {
      if (active) setAccess({ token, account, subscriptionStatus, state: result.isPremium === true ? 'active' : 'inactive' })
    }).catch(error => {
      if (active) setAccess({ token, account, subscriptionStatus, state: error.status === 401 ? 'inactive' : 'unavailable' })
    })
    const checkAgain = () => { if (document.visibilityState === 'visible') setAttempt(value => value + 1) }
    const recheck = () => { setAccess(null); setAttempt(value => value + 1) }
    const timer = setInterval(recheck, 60000)
    window.addEventListener('premium:recheck', recheck)
    document.addEventListener('visibilitychange', checkAgain)
    return () => { active = false; clearInterval(timer); window.removeEventListener('premium:recheck', recheck); document.removeEventListener('visibilitychange', checkAgain) }
  }, [token, account, attempt, subscriptionStatus])
  const state = coachGateState({ token, account, subscriptionStatus, access })
  if (state === 'active') return children
  const loading = !state || state === 'loading'
  const unavailable = state === 'unavailable'
  return <section className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
    <h1 className="text-2xl font-bold">{loading ? 'Checking membership…' : unavailable ? 'Couldn’t verify membership' : 'Adonis requires Premium'}</h1>
    <p className="mt-3 text-sm opacity-70">{loading ? 'Please wait while we verify your subscription.' : unavailable ? 'Check your connection and try again.' : 'Get personalized AI coaching with Premium or an eligible 7-day free trial.'}</p>
    {!loading && <button className="mt-6 rounded-2xl px-8 py-4 font-bold" style={{ background: '#C6A85C', color: '#000' }} onClick={() => unavailable ? setAttempt(value => value + 1) : navigate('/unlock?paywall=1')}>{unavailable ? 'Try again' : 'View Premium options'}</button>}
  </section>
}
