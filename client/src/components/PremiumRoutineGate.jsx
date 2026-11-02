import { useNavigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import usePremiumUiAccess from '../utils/usePremiumUiAccess'

export default function PremiumRoutineGate({ children }) {
  const isPremium = usePremiumUiAccess()
  const navigate = useNavigate()
  if (isPremium) return children
  return <div className="flex h-full flex-col items-center justify-center gap-5 bg-page px-7 text-center text-primary">
    <LockKeyhole size={36} color="#C6A85C" aria-hidden="true" />
    <h1 className="font-heading text-2xl font-bold">Unlock your face routine</h1>
    <p className="max-w-xs text-sm leading-relaxed text-secondary">Get Ascendus Max to access your personalized face routine.</p>
    <button type="button" onClick={() => navigate('/unlock?paywall=1')} className="w-full max-w-sm rounded-2xl bg-[#C6A85C] px-6 py-4 font-bold text-black">Get Ascendus Max</button>
  </div>
}
