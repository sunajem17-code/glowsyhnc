import { registerPlugin } from '@capacitor/core'

// Lazily registered — registerPlugin is a no-op on web and defers resolution
// until the native layer is ready, so it's safe to call at module load time.
const PhotoGeometryPlugin = registerPlugin('PhotoGeometryPlugin')

// analyzeBodyPhoto (Vision body-pose geometry) was removed from here — its
// only caller was the main scan flow's body-photo step, which no longer
// exists (physique scoring now only happens in the Training Plan flow, which
// doesn't use on-device geometry detection). The native PhotoGeometryPlugin
// method itself is untouched/dormant on the native side, just unused from JS.

/**
 * Runs Apple Vision's VNDetectFaceLandmarksRequest against an already-taken
 * side profile photo and returns real measured landmark geometry (facial
 * convexity angle from brow → nose tip → chin), the same honesty upgrade
 * ARKit already gives the front-facing face scan. 2D-projection based (no
 * depth), so it's an estimate — just a measured one instead of a guessed one.
 *
 * Always resolves (never rejects). Returns { supported: false } on web /
 * non-native, or { supported: true, detected: false, reason } when a face
 * genuinely wasn't detected with confidence.
 */
export async function analyzeSideProfile(imageDataUrl) {
  if (!imageDataUrl) return { supported: false }
  try {
    const result = await PhotoGeometryPlugin.analyzeSideProfile({ imageData: imageDataUrl })
    return result
  } catch (err) {
    console.warn('[PhotoGeometry] analyzeSideProfile native call failed (non-fatal):', err?.message ?? err)
    return { supported: false, nativeError: true, message: err?.message ?? String(err) }
  }
}
