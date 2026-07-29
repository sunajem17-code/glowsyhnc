import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export function isNative() {
  return Capacitor.isNativePlatform()
}

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!isNative()) return false
  try {
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display === 'prompt') {
      perm = await LocalNotifications.requestPermissions()
    }
    return perm.display === 'granted'
  } catch {
    return false
  }
}

// ── Streak reminder — fires daily at 8pm ─────────────────────────────────────
// Call this once after login and after each successful check-in.
// We schedule one notification per day — if one already exists, cancel and reschedule.

const STREAK_NOTIF_ID = 1001
const RESCAN_NOTIF_ID = 1002

export async function scheduleStreakReminder() {
  if (!isNative()) return
  try {
    const granted = await requestNotificationPermission()
    if (!granted) return

    // Cancel existing streak reminder before rescheduling
    await LocalNotifications.cancel({ notifications: [{ id: STREAK_NOTIF_ID }] })

    // Next 8pm
    const at = new Date()
    at.setHours(20, 0, 0, 0)
    if (at <= new Date()) at.setDate(at.getDate() + 1)

    await LocalNotifications.schedule({
      notifications: [
        {
          id: STREAK_NOTIF_ID,
          title: "Don't break your streak 🔥",
          body: "Check in today to keep your progress alive. 30 seconds is all it takes.",
          schedule: { at, repeats: true, every: 'day' },
          sound: 'default',
          smallIcon: 'ic_stat_icon',
        },
      ],
    })
  } catch (err) {
    console.warn('[Notifications] streak reminder failed:', err?.message)
  }
}

// Cancel streak reminder (e.g. after user checks in for the day)
export async function cancelStreakReminder() {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: STREAK_NOTIF_ID }] })
  } catch {}
}

// ── Rescan ready — fires once after N days from scan ─────────────────────────
// daysUntilReady: 14 for free users, call with 0 to cancel only
export async function scheduleRescanNotification(daysUntilReady = 14) {
  if (!isNative()) return
  try {
    const granted = await requestNotificationPermission()
    if (!granted) return

    // Always cancel the old one first
    await LocalNotifications.cancel({ notifications: [{ id: RESCAN_NOTIF_ID }] })

    if (daysUntilReady <= 0) return // Pro users — no rescan gate, skip

    const at = new Date()
    at.setDate(at.getDate() + daysUntilReady)
    at.setHours(10, 0, 0, 0)

    await LocalNotifications.schedule({
      notifications: [
        {
          id: RESCAN_NOTIF_ID,
          title: 'Your rescan is ready ✦',
          body: "It's been 2 weeks. See how much you've improved. Rescan now.",
          schedule: { at },
          sound: 'default',
          smallIcon: 'ic_stat_icon',
        },
      ],
    })
  } catch (err) {
    console.warn('[Notifications] rescan notif failed:', err?.message)
  }
}
