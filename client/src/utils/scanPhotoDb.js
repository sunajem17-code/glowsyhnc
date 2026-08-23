// IndexedDB storage for scan photos, landmarks, and FaceMetricsExplorer metrics.
// localStorage is limited to ~5MB and strips photos from scans[] to avoid quota
// errors — this DB persists them across sessions without that constraint.

const DB_NAME    = 'ascendus-scan-media'
const DB_VERSION = 1
const STORE_NAME = 'scanMedia'

let _db = null

function openDb() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'scanId' })
      }
    }
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function saveScanMedia(scanId, { photo, landmarks2D, faceMetrics }) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx   = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ scanId, photo, landmarks2D: landmarks2D ?? null, faceMetrics: faceMetrics ?? null, savedAt: Date.now() })
      tx.oncomplete = resolve
      tx.onerror    = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.warn('[scanPhotoDb] saveScanMedia failed:', err.message)
  }
}

export async function loadScanMedia(scanId) {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req   = store.get(scanId)
      req.onsuccess = (e) => resolve(e.target.result ?? null)
      req.onerror   = (e) => reject(e.target.error)
    })
  } catch (err) {
    console.warn('[scanPhotoDb] loadScanMedia failed:', err.message)
    return null
  }
}

export async function clearAllScanMedia() {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req   = store.clear()
      req.onsuccess = resolve
      req.onerror   = resolve  // non-fatal
    })
  } catch (err) {
    console.warn('[scanPhotoDb] clearAllScanMedia failed:', err.message)
  }
}

// Prune media for scans no longer in the store (pass current scan ids to keep)
export async function pruneScanMedia(keepIds) {
  try {
    const db = await openDb()
    const keepSet = new Set(keepIds)
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req   = store.openCursor()
      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (!cursor) { resolve(); return }
        if (!keepSet.has(cursor.key)) cursor.delete()
        cursor.continue()
      }
      req.onerror = resolve  // non-fatal
    })
  } catch (err) {
    console.warn('[scanPhotoDb] pruneScanMedia failed:', err.message)
  }
}
