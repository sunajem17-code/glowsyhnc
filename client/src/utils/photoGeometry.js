import { registerPlugin } from '@capacitor/core'

// Lazily registered — registerPlugin is a no-op on web and defers resolution
// until the native layer is ready, so it's safe to call at module load time.
const PhotoGeometryPlugin = registerPlugin('PhotoGeometryPlugin')

/**
 * Runs Apple Vision's VNDetectHumanBodyPoseRequest against an already-taken
 * body photo (base64 data URL) and returns real measured joint geometry —
 * NOT an AI vision guess. Used to ground the physique scorer's
 * "proportions"/"posture" categories in an actual measurement instead of
 * pure visual estimation, and can be shown to the user directly as a real
 * number.
 *
 * Always resolves (never rejects) so callers don't need try/catch. Returns
 * { supported: false } on web / non-native, or { supported: true, detected:
 * false, reason } when a body genuinely wasn't detected with confidence —
 * never fabricates a plausible-looking number in that case.
 */
export async function analyzeBodyPhoto(imageDataUrl) {
  if (!imageDataUrl) return { supported: false }
  try {
    const result = await PhotoGeometryPlugin.analyzeBodyPhoto({ imageData: imageDataUrl })
    return result
  } catch (err) {
    console.warn('[PhotoGeometry] analyzeBodyPhoto native call failed (non-fatal):', err?.message ?? err)
    return { supported: false, nativeError: true, message: err?.message ?? String(err) }
  }
}

/**
 * Runs Apple Vision's VNDetectFaceLandmarksRequest against an already-taken
 * side profile photo and returns real measured landmark geometry (facial
 * convexity angle from brow → nose tip → chin), the same honesty upgrade
 * ARKit already gives the front-facing face scan. 2D-projection based (no
 * depth), so it's an estimate — just a measured one instead of a guessed one.
 *
 * Always resolves (never rejects). See analyzeBodyPhoto for the shape of a
 * "not detected" result.
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
