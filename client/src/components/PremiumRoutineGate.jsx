import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import usePremiumUiAccess from '../utils/usePremiumUiAccess'
import useStore from '../store/useStore'

export default function PremiumRoutineGate({ children, feature = 'your face routine' }) {
  const isPremium = usePremiumUiAccess()
  const token = useStore(state => state.token)
  const account = useStore(state => state.user?.id)
  const subscriptionStatus = useStore(state => state.subscriptionStatus)
  const refreshProStatus = useStore(state => state.refreshProStatus)
  const navigate = useNavigate()
  useEffect(() => {
    if (!token || !account) return
    refreshProStatus()
    const recheck = () => refreshProStatus({ force: true })
    window.addEventListener('premium:recheck', recheck)
    const timer = window.setInterval(recheck, 60000)
    return () => { window.removeEventListener('premium:recheck', recheck); window.clearInterval(timer) }
  }, [token, account, refreshProStatus])
  if (isPremium && token && account) return children
  const loading = subscriptionStatus === 'loading' || subscriptionStatus === 'restoring'
  const unavailable = subscriptionStatus === 'unavailable'
  if (loading || unavailable) return <div className="flex h-full flex-col items-center justify-center gap-5 bg-page px-7 text-center text-primary">
    <h1 className="font-heading text-2xl font-bold">{loading ? 'Checking membership…' : 'Couldn’t verify membership'}</h1>
    <p className="max-w-xs text-sm leading-relaxed text-secondary">{loading ? 'Please wait while we reconnect your membership.' : 'Check your connection and try again.'}</p>
    {unavailable && <button type="button" onClick={() => refreshProStatus({ force: true })} className="rounded-2xl bg-[#C6A85C] px-6 py-4 font-bold text-black">Try again</button>}
  </div>
  return <div className="flex h-full flex-col items-center justify-center gap-5 bg-page px-7 text-center text-primary">
    <LockKeyhole size={36} color="#C6A85C" aria-hidden="true" />
    <h1 className="font-heading text-2xl font-bold">Unlock {feature}</h1>
    <p className="max-w-xs text-sm leading-relaxed text-secondary">Get Ascendus Max to access {feature}.</p>
    <button type="button" onClick={() => navigate('/unlock?paywall=1')} className="w-full max-w-sm rounded-2xl bg-[#C6A85C] px-6 py-4 font-bold text-black">Get Ascendus Max</button>
  </div>
}
