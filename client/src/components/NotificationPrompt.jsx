import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative, requestNotificationPermission } from '../utils/notifications'

export default function NotificationPrompt({ enabled, userId }) {
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const key = `ascendus-notification-prompt:${userId}`
  useEffect(() => {
    let cancelled = false
    setVisible(false)
    if (!enabled || !isNative() || !['/', '/home', '/dashboard'].includes(pathname)) return
    try { if (localStorage.getItem(key)) return } catch {}
    LocalNotifications.checkPermissions().then(permission => {
      if (!cancelled && ['prompt', 'prompt-with-rationale'].includes(permission.display)) setVisible(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [enabled, key, pathname])
  function dismiss() {
    try { localStorage.setItem(key, 'seen') } catch {}
    setVisible(false)
  }
  async function enable() {
    setBusy(true)
    setError('')
    try {
      if (await requestNotificationPermission()) dismiss()
      else setError('Notifications are off. You can enable them in your phone’s Settings for Ascendus.')
    } catch {
      setError('Could not set up your reminders. Please try again.')
    } finally { setBusy(false) }
  }
  if (!visible) return null
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-6">
    <section role="dialog" aria-modal="true" aria-labelledby="notification-title" className="w-full max-w-sm rounded-3xl border border-[#C6A85C]/40 bg-[#111] p-6 text-white shadow-2xl">
      <h2 id="notification-title" className="text-2xl font-bold">Keep your progress going</h2>
      <p className="mt-3 text-sm text-white/70">Get a daily reminder at 8 PM to check in, plus a reminder when your next scan is ready.</p>
      {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
      <button autoFocus disabled={busy} onClick={enable} className="mt-6 w-full rounded-2xl bg-[#C6A85C] py-4 font-bold text-black disabled:opacity-60">{busy ? 'Enabling…' : 'Enable notifications'}</button>
      <button disabled={busy} onClick={dismiss} className="mt-2 w-full py-3 text-sm text-white/60">Not now</button>
    </section>
  </div>
}
