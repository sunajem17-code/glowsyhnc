import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import useStore from '../store/useStore'
import { endAnalyticsSession, resumeAnalyticsSession, setAnalyticsCollectionEnabled, trackScreenView } from '../utils/analytics'

export default function AnalyticsTracker() {
  const { pathname } = useLocation()
  const analyticsEnabled = useStore(state => state.privacySettings?.analytics !== false)

  useEffect(() => {
    setAnalyticsCollectionEnabled(analyticsEnabled)
  }, [analyticsEnabled])

  useEffect(() => {
    trackScreenView(pathname)
  }, [analyticsEnabled, pathname])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    let listener
    let disposed = false
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) resumeAnalyticsSession()
      else endAnalyticsSession()
    }).then(handle => {
      if (disposed) handle.remove()
      else listener = handle
    }).catch(() => {})

    return () => {
      disposed = true
      listener?.remove()
    }
  }, [])

  return null
}
