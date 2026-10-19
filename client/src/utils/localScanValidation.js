import { validationFailure } from './validationFailure.js'

const FACE_COUNT_ISSUES = {
  0: {
    code: 'no_face',
    title: 'No face detected',
    advice: 'Make sure your face is clearly visible and fills most of the frame.',
    severity: 'critical',
  },
  multiple: {
    code: 'multiple_faces',
    title: 'Multiple faces detected',
    advice: 'Make sure only you are in the frame.',
    severity: 'critical',
  },
}

export function isLocalScanOrigin(hostname = globalThis.location?.hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

/** Validate on-device for localhost development, never sending the image to the API. */
export async function validateWithLocalFaceMesh(imageSource, detectFace) {
  try {
    const faceCount = await detectFace(imageSource)
    if (faceCount !== 1) {
      const issue = faceCount >= 2 ? FACE_COUNT_ISSUES.multiple : FACE_COUNT_ISSUES[0]
      return { passed: false, state: 'RESULT', issues: [issue] }
    }
    return { passed: true, state: 'SUCCESS', issues: [] }
  } catch (error) {
    if (/no face detected/i.test(error?.message || '')) {
      return { passed: false, state: 'RESULT', issues: [FACE_COUNT_ISSUES[0]] }
    }
    return validationFailure(error)
  }
}
