// Pure, auditable 2D measurements. Values are ratios, never physical lengths.
// MediaPipe Face Mesh does not expose per-landmark confidence. Leave confidence
// null until a calibrated confidence model exists.
const POINTS = { leftEyeOuter: 33, leftEyeInner: 133, rightEyeInner: 362,
  rightEyeOuter: 263, leftCheek: 234, rightCheek: 454,
  leftJaw: 172, rightJaw: 397, chin: 152, nose: 1,
  noseLeft: 98, noseRight: 327, mouthLeft: 61, mouthRight: 291,
  upperLip: 13, lowerLip: 14, browLeft: 105, browRight: 334 }

const round = value => Math.round(value * 1000) / 1000

export function analyzeLandmarkEvidence(landmarks, width, height) {
  if (!Array.isArray(landmarks) || landmarks.length < 468 || width < 1 || height < 1) {
    return { status: 'additional_image_required', reason: 'Landmarks or image dimensions unavailable', measurements: [], findings: [], recommendations: [] }
  }
  const point = key => {
    const p = landmarks[POINTS[key]]
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x * width, y: p.y * height } : null
  }
  const p = Object.fromEntries(Object.keys(POINTS).map(key => [key, point(key)]))
  if (Object.values(p).some(value => !value)) {
    return { status: 'additional_image_required', reason: 'Required landmark unavailable', measurements: [], findings: [], recommendations: [] }
  }
  const distance = (a, b) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y)
  const cheekWidth = distance('leftCheek', 'rightCheek')
  const eyeSpan = distance('leftEyeOuter', 'rightEyeOuter')
  if (cheekWidth < 10 || eyeSpan < 10) {
    return { status: 'additional_image_required', reason: 'Face geometry too small or degenerate', measurements: [], findings: [], recommendations: [] }
  }
  const eyeMidY = (p.leftEyeOuter.y + p.rightEyeOuter.y) / 2
  const rollDegrees = Math.atan2(p.rightEyeOuter.y - p.leftEyeOuter.y, p.rightEyeOuter.x - p.leftEyeOuter.x) * 180 / Math.PI
  const faceWidthFraction = cheekWidth / width
  const poseProxy = Math.abs(distance('nose', 'leftCheek') - distance('nose', 'rightCheek')) / cheekWidth
  const limitations = ['2D projection; perspective and expression can change ratios', 'No per-landmark confidence or calibrated confidence score is available from this model']
  const quality = {
    faceWidthFraction: round(faceWidthFraction), rollDegrees: round(rollDegrees), poseProxy: round(poseProxy),
    checks: {
      faceSize: faceWidthFraction >= 0.25,
      roll: Math.abs(rollDegrees) <= 8,
      frontalPose: poseProxy <= 0.12,
      landmarksInFrame: Object.values(p).every(v => v.x >= 0 && v.x <= width && v.y >= 0 && v.y <= height),
    },
    limitations: ['Blur, lighting, filters, expression, and multiple faces require separate validation'],
  }
  const passed = Object.values(quality.checks).every(Boolean)
  const measurements = []
  const add = (feature, numerator, denominator, evidence, extra = []) => {
    const value = denominator > 0 ? round(numerator / denominator) : null
    measurements.push({ feature, measurement: value, normalized_value: value, confidence: null,
      evidence: evidence.map(key => ({ index: POINTS[key], label: key })), limitations: [...limitations, ...extra] })
  }
  add('jaw_to_cheek_width', distance('leftJaw', 'rightJaw'), cheekWidth, ['leftJaw', 'rightJaw', 'leftCheek', 'rightCheek'])
  add('eye_spacing_to_face_width', distance('leftEyeInner', 'rightEyeInner'), cheekWidth, ['leftEyeInner', 'rightEyeInner', 'leftCheek', 'rightCheek'])
  add('left_eye_width_to_face_width', distance('leftEyeInner', 'leftEyeOuter'), cheekWidth, ['leftEyeInner', 'leftEyeOuter', 'leftCheek', 'rightCheek'])
  add('right_eye_width_to_face_width', distance('rightEyeInner', 'rightEyeOuter'), cheekWidth, ['rightEyeInner', 'rightEyeOuter', 'leftCheek', 'rightCheek'])
  add('nose_width_to_face_width', distance('noseLeft', 'noseRight'), cheekWidth, ['noseLeft', 'noseRight', 'leftCheek', 'rightCheek'])
  add('mouth_width_to_face_width', distance('mouthLeft', 'mouthRight'), cheekWidth, ['mouthLeft', 'mouthRight', 'leftCheek', 'rightCheek'])
  add('lip_opening_to_face_width', distance('upperLip', 'lowerLip'), cheekWidth, ['upperLip', 'lowerLip', 'leftCheek', 'rightCheek'], ['This measures visible lip separation, not lip fullness'])
  add('chin_to_eye_span', Math.abs(p.chin.y - eyeMidY), eyeSpan, ['chin', 'leftEyeOuter', 'rightEyeOuter'])
  const findings = []
  const recommendations = []
  // No normative flaw or treatment rules until thresholds are clinically and
  // photographically validated. A ratio alone does not establish a defect.
  return { status: passed ? 'measured' : 'additional_image_required', quality,
    landmarks: landmarks.map((v, index) => ({ index, x: round(v.x), y: round(v.y), z: round(v.z ?? 0) })),
    measurements,
    findings, recommendations,
    limitations: ['No objective flaw threshold has been validated', 'No recommendation is personalized without a supported finding'] }
}
