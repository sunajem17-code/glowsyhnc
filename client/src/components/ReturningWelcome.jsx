import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import useStore from '../store/useStore'
import { hasCompletedScan } from '../utils/onboardingStartup'
import PremiumSplash from '../pages/PremiumSplash'

export default function ReturningWelcome() {
  const eligible = useStore(hasCompletedScan)
  // A first completed scan does not trigger a welcome halfway through results.
  const [open, setOpen] = useState(eligible)
  useEffect(() => {
    let backgroundedAt = null
    let disposed = false
    let listener
    const onActive = active => {
      if (!active) { backgroundedAt = Date.now(); return }
      const returning = backgroundedAt != null && Date.now() - backgroundedAt >= 30_000
      backgroundedAt = null
      if (returning && hasCompletedScan(useStore.getState()) && !['/scan/capture', '/physique-scan'].includes(window.location.pathname)) setOpen(true)
    }
    const onVisibility = () => onActive(document.visibilityState === 'visible')
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => onActive(isActive)).then(handle => {
        if (disposed) void handle.remove()
        else listener = handle
      }).catch(() => {})
    } else document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      void listener?.remove()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  const close = useCallback(() => setOpen(false), [])
  if (!eligible || !open) return null
  return <PremiumSplash onDone={close} />
}
