// A separate, low-resolution tracker for the camera preview. The analysis
// FaceMesh singleton uses its own onResults callback and must not be shared.
export async function createLiveFaceAlignment(onFrame) {
  const mod = await import('@mediapipe/face_mesh')
  const FaceMesh = typeof mod.FaceMesh === 'function'
    ? mod.FaceMesh
    : typeof mod.default?.FaceMesh === 'function'
      ? mod.default.FaceMesh
      : globalThis.FaceMesh
  if (typeof FaceMesh !== 'function') throw new Error('FaceMesh constructor unavailable')
  const mesh = new FaceMesh({ locateFile: file => `/mediapipe/${file}` })
  mesh.setOptions({ maxNumFaces: 2, refineLandmarks: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })
  mesh.onResults(({ multiFaceLandmarks = [] }) => {
    if (multiFaceLandmarks.length !== 1) {
      onFrame({ status: multiFaceLandmarks.length > 1 ? 'multiple' : 'missing', aligned: false })
      return
    }
    const p = multiFaceLandmarks[0]
    const left = p[234], right = p[454], top = p[10], chin = p[152]
    const eyeLeft = p[33], eyeRight = p[263], nose = p[1]
    const width = Math.abs(right.x - left.x)
    const height = Math.abs(chin.y - top.y)
    const centerX = (left.x + right.x) / 2
    const centerY = (top.y + chin.y) / 2
    const eyeWidth = Math.abs(eyeRight.x - eyeLeft.x)
    const yaw = eyeWidth > 0.01 ? Math.abs((nose.x - (eyeLeft.x + eyeRight.x) / 2) / eyeWidth) : 0
    onFrame({ status: 'face', centerX, centerY, width, height, yaw, roll: Math.abs(eyeLeft.y - eyeRight.y) })
  })
  let closed = false
  return {
    async check(image) { if (!closed) await mesh.send({ image }) },
    close() { closed = true; mesh.close?.() },
  }
}

export function getAlignment(frame, profile) {
  if (!frame || frame.status === 'missing') return { label: profile ? 'Turn to the side' : 'Position your face', aligned: false }
  if (frame.status === 'multiple') return { label: 'Only one face in frame', aligned: false }
  if (frame.height < 0.3 || frame.width < 0.19) return { label: 'Move closer', aligned: false }
  if (frame.height > 0.86 || frame.width > 0.85) return { label: 'Move back', aligned: false }
  if (Math.abs(frame.centerX - 0.5) > 0.17 || Math.abs(frame.centerY - 0.5) > 0.2) return { label: profile ? 'Align your profile' : 'Center your face', aligned: false }
  if (frame.roll > 0.07) return { label: 'Keep your head level', aligned: false }
  if (profile && frame.yaw < 0.22) return { label: 'Turn to the side', aligned: false }
  if (!profile && frame.yaw > 0.18) return { label: 'Look straight ahead', aligned: false }
  return { label: 'Hold still', aligned: true }
}
