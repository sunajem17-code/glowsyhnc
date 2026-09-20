import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// Light tap feedback for primary actions. No-op on web (no native bridge) and
// swallows any native error so a haptics failure never blocks the tap itself.
export async function triggerHaptic() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy })
  } catch {
    // haptics unavailable — not fatal, ignore
  }
}

// Soft haptic for when content/text animates onto screen (page transitions).
export async function triggerPageHaptic() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // haptics unavailable — not fatal, ignore
  }
}
