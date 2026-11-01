// Bound stalled network/module requests so navigation can recover visibly.
export async function loadScreen(loader, timeoutMs = 20000) {
  let timer
  try {
    return await Promise.race([Promise.resolve().then(loader), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('This screen could not finish loading. Reload the app to reconnect.')), timeoutMs)
    })])
  } finally { clearTimeout(timer) }
}
