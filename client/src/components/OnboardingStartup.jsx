import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import useStore from '../store/useStore'

export function StartupCheck() {
  return <div className="flex h-full items-center justify-center bg-[#0a0a0a] text-white" role="status" aria-live="polite">Checking your saved progress…</div>
}
export function DevelopmentOnboardingReset() {
  const [reset, setReset] = useState(false)
  if (!import.meta.env.DEV) return <Navigate to="/" replace />
  if (reset) return <Navigate to="/onboarding" replace />
  return <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#0a0a0a] px-6 text-center text-white">
    <h1 className="text-2xl font-bold">Test onboarding from the beginning</h1>
    <p>Reset only this account’s onboarding completion and draft. Your account, scans, and purchases stay saved.</p>
    <button className="rounded-2xl bg-[#C6A85C] px-6 py-4 font-bold text-black" onClick={() => { useStore.getState().resetOnboarding(); setReset(true) }}>Reset onboarding</button>
  </div>
}
