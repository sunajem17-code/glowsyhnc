import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export const isNative = () => Capacitor.isNativePlatform()

const CAMERA_OPTS = {
  quality: 90,
  allowEditing: false,
  resultType: CameraResultType.DataUrl,
  correctOrientation: true,
}

async function getPhotoWithRetry(opts, attempt = 0) {
  try {
    const photo = await Camera.getPhoto(opts)
    console.log('[CAMERA] got image, dataUrl length:', photo.dataUrl?.length)
    return photo.dataUrl
  } catch (err) {
    const msg = (err?.message ?? '').toLowerCase()
    // Propagate cancel immediately — no retry
    if (msg.includes('cancel') || msg.includes('user denied') || msg.includes('denied')) throw err
    // First-attempt hardware-not-ready failure: wait 600ms then retry once
    if (attempt === 0) {
      console.warn('[CAMERA] first attempt failed, retrying in 600ms:', err.message)
      await new Promise(r => setTimeout(r, 600))
      return getPhotoWithRetry(opts, 1)
    }
    throw err
  }
}

export async function takePhoto() {
  if (!isNative()) return null
  try {
    const perm = await Camera.requestPermissions({ permissions: ['camera', 'photos'] })
    console.log('[CAMERA] takePhoto permissions:', JSON.stringify(perm))
    // Give the camera subsystem a moment to initialise after first-time grant
    if (perm?.camera === 'granted' || perm?.photos === 'granted') {
      await new Promise(r => setTimeout(r, 300))
    }
  } catch (e) {
    console.warn('[CAMERA] requestPermissions error (non-fatal):', e)
  }
  return getPhotoWithRetry({ ...CAMERA_OPTS, source: CameraSource.Camera })
}

export async function pickPhoto() {
  if (!isNative()) return null
  try {
    const perm = await Camera.requestPermissions({ permissions: ['photos'] })
    console.log('[CAMERA] pickPhoto permissions:', JSON.stringify(perm))
    if (perm?.photos === 'granted') {
      await new Promise(r => setTimeout(r, 300))
    }
  } catch (e) {
    console.warn('[CAMERA] requestPermissions error (non-fatal):', e)
  }
  return getPhotoWithRetry({ ...CAMERA_OPTS, source: CameraSource.Photos })
}
