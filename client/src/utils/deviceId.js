import { Device } from '@capacitor/device'

export async function getDeviceId() {
  try {
    const info = await Device.getId()
    return info.identifier
  } catch {
    return null
  }
}
