import { registerPlugin } from '@capacitor/core'

// Lazily registered — registerPlugin is a no-op on web and defers resolution
// until the native layer is ready, so it's safe to call at module load time.
const FaceScanPlugin = registerPlugin('FaceScanPlugin')

/**
 * Opens the native ARKit face scan modal and returns geometry metrics.
 *
 * Resolves with one of:
 *   { supported: false }                          — device genuinely has no TrueDepth camera
 *                                                     (this came back from native code, not a thrown error)
 *   { supported: false, nativeError: true,
 *     message }                                    — the native call itself failed (plugin not found,
 *                                                     bridge not ready, threw an exception, etc.) —
 *                                                     this is NOT a hardware limitation, don't tell the
 *                                                     user their device is unsupported when this fires
 *   { supported: true, cancelled: true }          — user dismissed without scanning
 *   { supported: true, cancelled: false,
 *     jawWidthCM, faceHeightCM, faceWidthCM,
 *     faceRatio, symmetryScore, cheekboneWidthCM } — successful scan
 *
 * Always resolves (never rejects) so callers don't need try/catch.
 */
export async function startFaceScan() {
  try {
    const result = await FaceScanPlugin.startFaceScan()
    console.log('[FaceScan] native result:', JSON.stringify(result))
    return result
  } catch (err) {
    // IMPORTANT: reaching here means the native plugin call itself blew up —
    // it does NOT mean the device lacks a TrueDepth camera. Common real causes:
    // plugin class not present in the compiled binary (stale/incomplete build),
    // the JS plugin name not matching the native @objc identifier, or the
    // bridge not being ready yet. Surface this distinctly so the UI doesn't
    // lie to the user about their hardware.
    console.error('[FaceScan] native call threw — this is a plugin/build issue, not a hardware issue:', err)
    return { supported: false, nativeError: true, message: err?.message ?? String(err) }
  }
}
