// The native plugin outlives React screens and can survive a web reload.
// Serialize ownership across overlays, including late cleanup from old screens.
export function createNativeCameraSession(camera) {
  let queue = Promise.resolve()
  let owner = null
  const enqueue = operation => {
    const result = queue.then(operation)
    queue = result.catch(() => {})
    return result
  }
  const stop = async () => {
    try { await camera.stop() }
    catch (error) {
      if (!/already stopped/i.test(error?.message || '')) throw error
    }
  }
  return {
    open(token, options) {
      return enqueue(async () => {
        // Always reconcile the plugin, even when JS has no remembered owner.
        await stop()
        owner = token
        try { await camera.start(options) }
        catch (error) {
          await stop().catch(() => {})
          owner = null
          throw error
        }
      })
    },
    close(token) {
      return enqueue(async () => {
        if (owner !== token) return
        await stop()
        owner = null
      })
    },
  }
}
