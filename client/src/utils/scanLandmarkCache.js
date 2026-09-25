// Keep successful mappings, but allow a fresh attempt after detection fails.
export function cacheLandmarkResult(ref, url, pending) {
  const entry = { url, promise: null }
  entry.promise = pending.then(result => {
    if (!result?.points && ref.current === entry) ref.current = null
    return result
  }, error => {
    if (ref.current === entry) ref.current = null
    throw error
  })
  ref.current = entry
  return entry.promise
}

export function frontLandmarkError(result) {
  const missing = /No face detected/i.test(result?.error?.message || '')
  return Object.assign(new Error(missing
    ? 'No face was detected in your front photo. Retake it looking straight at the camera with your whole face visible.'
    : 'The face detector could not process your front photo. Please try again.'), { code: 'front_landmarks_failed' })
}
