import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './api'
import { clearAllScanMedia } from './scanPhotoDb'
import useStore from '../store/useStore'

/**
 * Shared delete-account logic consumed by both Settings.jsx and Profile.jsx.
 *
 * Steps exposed to callers:
 *   'idle'         – nothing open
 *   'sub-gate'     – user has active subscription or trial; must self-attest
 *                    they've cancelled before proceeding
 *   'confirm'      – type DELETE confirmation
 *   'loading'      – API call in-flight
 *   'error'        – API call failed; error message in `deleteError`
 *
 * Usage:
 *   const del = useDeleteAccount()
 *   del.start()                 // opens flow from beginning
 *   del.attestedAndContinue()   // moves sub-gate → confirm
 *   del.confirm()               // executes deletion (must be in 'confirm' or 'error')
 *   del.cancel()                // resets to 'idle'
 *   del.step                    // current step string
 *   del.deleteError             // error message string
 */
export function useDeleteAccount() {
  const navigate = useNavigate()
  const { isPremium, proTrialActive, logout } = useStore(s => ({
    isPremium:      s.isPremium,
    proTrialActive: s.proTrialActive,
    logout:         s.logout,
  }))

  const [step, setStep] = useState('idle')
  const [deleteError, setDeleteError] = useState('')

  const hasActiveSubscription = isPremium || proTrialActive

  function start() {
    setDeleteError('')
    if (hasActiveSubscription) {
      setStep('sub-gate')
    } else {
      setStep('confirm')
    }
  }

  function attestedAndContinue() {
    setStep('confirm')
  }

  async function confirm() {
    setStep('loading')
    setDeleteError('')

    // Suppress the global 401→/auth redirect while deletion is in-flight
    // so the user sees the real error instead of being bounced silently.
    const suppressRedirect = (e) => e.stopImmediatePropagation()
    window.addEventListener('auth:session-expired', suppressRedirect, true)

    try {
      const result = await api.user.deleteAccount()
      if (result?.error) {
        setDeleteError(result.error)
        setStep('error')
        return
      }
      // Wipe IndexedDB scan photos (logout() handles Zustand + sessionStorage)
      await clearAllScanMedia().catch(err =>
        console.warn('[deleteAccount] clearAllScanMedia failed:', err)
      )
      logout()
      // navigate to '/' — App.jsx renders PremiumOnboarding because
      // hasOnboarded is now false, exactly like a fresh install.
      navigate('/', { replace: true })
    } catch (err) {
      console.error('[deleteAccount] error:', err?.message)
      const msg = err?.message || ''
      const isExpired = msg.toLowerCase().includes('session') || msg.toLowerCase().includes('expired')
      setDeleteError(
        isExpired
          ? 'Your session expired. Sign out, sign back in, then try again.'
          : msg || 'Deletion failed. Email support@ascendus.com.'
      )
      setStep('error')
    } finally {
      window.removeEventListener('auth:session-expired', suppressRedirect, true)
    }
  }

  function cancel() {
    setStep('idle')
    setDeleteError('')
  }

  return { step, deleteError, hasActiveSubscription, start, attestedAndContinue, confirm, cancel }
}
