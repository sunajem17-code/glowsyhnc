// Evidence-first 2D facial measurements. This module stores repeatable ratios,
// formulas, provenance and limitations. It never converts a selfie to physical
// units or turns an unvalidated ratio into an attractiveness score.

export const EVIDENCE_SCHEMA_VERSION = '1.0.0'

export const LANDMARKS = {
  forehead: 10,
  leftEyeOuter: 33, leftEyeInner: 133, leftEyeTop: 159, leftEyeBottom: 145,
  rightEyeInner: 362, rightEyeOuter: 263, rightEyeTop: 386, rightEyeBottom: 374,
  leftCheek: 234, rightCheek: 454, leftJaw: 172, rightJaw: 397, chin: 152,
  chinLeft: 176, chinRight: 400,
  noseTip: 1, noseBase: 2, noseLeft: 98, noseRight: 327,
  mouthLeft: 61, mouthRight: 291,
  upperLipOuter: 0, upperLipInner: 13, lowerLipInner: 14, lowerLipOuter: 17,
  leftBrow: 105, rightBrow: 334,
}

const SOURCE = 'mediapipe_face_mesh_468'
const round = value => Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null

function unavailable(reason, extra = {}) {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION, status: 'additional_image_required', reason,
    pose: {}, quality: {}, landmarks: [], measurements: [], findings: [], observations: [],
    recommendations: [], notAssessable: [],
    confidence: { overall: null, reason: 'No calibrated confidence model is available' },
    ...extra,
  }
}

function measurement({ id, value, formula, landmarkKeys, assessable, reason = null, limitations = [] }) {
  return {
    id, value: assessable ? round(value) : null, unit: 'ratio', source: SOURCE,
    landmarksUsed: landmarkKeys.map(key => ({ index: LANDMARKS[key], label: key })),
    formula, confidence: null,
    confidenceReason: 'MediaPipe Face Mesh does not expose calibrated per-landmark confidence',
    assessable, reason: assessable ? null : reason,
    limitations: ['Photographic 2D geometry; perspective, lens distortion and expression can change the ratio', ...limitations],
  }
}

function unsupported(id, reason = 'feature_cannot_be_inferred_from_uncalibrated_2d_photography') {
  return { id, value: null, unit: null, source: null, landmarksUsed: [], formula: null,
    confidence: null, assessable: false, reason }
}

/** Build deterministic evidence from one front-facing MediaPipe result. */
export function analyzeLandmarkEvidence(landmarks, width, height) {
  if (!Array.isArray(landmarks) || landmarks.length < 468 || width < 1 || height < 1) {
    return unavailable('landmarks_or_image_dimensions_unavailable')
  }
  const point = key => {
    const raw = landmarks[LANDMARKS[key]]
    return raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)
      ? { x: raw.x * width, y: raw.y * height, z: Number.isFinite(raw.z) ? raw.z : null }
      : null
  }
  const points = Object.fromEntries(Object.keys(LANDMARKS).map(key => [key, point(key)]))
  const missing = Object.entries(points).filter(([, value]) => !value).map(([key]) => key)
  if (missing.length) return unavailable('required_landmark_unavailable', { missingLandmarks: missing })

  const d = (a, b) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y)
  const mid = (a, b) => ({ x: (points[a].x + points[b].x) / 2, y: (points[a].y + points[b].y) / 2 })
  const eyeMid = mid('leftEyeOuter', 'rightEyeOuter')
  const browMid = mid('leftBrow', 'rightBrow')
  const mouthMid = mid('upperLipInner', 'lowerLipInner')
  const cheekWidth = d('leftCheek', 'rightCheek')
  const faceHeight = d('forehead', 'chin')
  const eyeSpan = d('leftEyeOuter', 'rightEyeOuter')
  if (cheekWidth < 10 || faceHeight < 10 || eyeSpan < 10) return unavailable('face_geometry_too_small_or_degenerate')

  const rollDegrees = Math.atan2(points.rightEyeOuter.y - points.leftEyeOuter.y, points.rightEyeOuter.x - points.leftEyeOuter.x) * 180 / Math.PI
  const yawProxy = Math.abs(d('noseTip', 'leftCheek') - d('noseTip', 'rightCheek')) / cheekWidth
  const eyeToChin = points.chin.y - eyeMid.y
  const pitchProxy = eyeToChin > 0 ? (points.noseTip.y - eyeMid.y) / eyeToChin : null
  const faceWidthFraction = cheekWidth / width
  const landmarkMargin = Math.min(...Object.values(points).flatMap(p => [p.x / width, p.y / height, 1 - p.x / width, 1 - p.y / height]))
  const checks = {
    faceSize: faceWidthFraction >= 0.25,
    roll: Math.abs(rollDegrees) <= 8,
    yaw: yawProxy <= 0.22, // loosened from 0.12 — real mobile selfies routinely hit 0.13–0.18
    pitch: pitchProxy != null && pitchProxy >= 0.15 && pitchProxy <= 0.55,
    landmarksInFrame: landmarkMargin >= 0,
  }
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
  const failureReason = failedChecks.includes('roll') ? 'excessive_roll'
    : failedChecks.includes('yaw') ? 'excessive_yaw'
      : failedChecks.includes('pitch') ? 'excessive_pitch'
        : failedChecks.includes('faceSize') ? 'insufficient_face_resolution'
          : failedChecks.includes('landmarksInFrame') ? 'facial_landmark_out_of_frame' : null
  const assessable = failedChecks.length === 0
  const quality = {
    source: SOURCE, faceWidthFraction: round(faceWidthFraction), landmarkMarginFraction: round(landmarkMargin),
    checks, failedChecks,
    limitations: ['Blur, lighting, occlusion, expression and face count are validated separately by the photo-quality gate'],
  }
  const pose = {
    orientation: 'front', mirroredInput: 'unknown', rollDegrees: round(rollDegrees),
    yawProxy: round(yawProxy), pitchProxy: round(pitchProxy),
    acceptable: failedChecks.filter(name => ['roll', 'yaw', 'pitch'].includes(name)).length === 0,
    limitations: ['Yaw and pitch are photographic pose proxies, not calibrated head-pose angles'],
  }

  const rows = []
  const add = (id, numerator, denominator, formula, landmarkKeys, limitations = []) => rows.push(measurement({
    id, value: denominator > 0 ? numerator / denominator : null, formula, landmarkKeys,
    assessable: assessable && denominator > 0,
    reason: assessable ? 'degenerate_denominator' : failureReason, limitations,
  }))
  add('face_width_to_height_ratio', cheekWidth, faceHeight, 'distance(cheek_234, cheek_454) / distance(forehead_10, chin_152)', ['leftCheek', 'rightCheek', 'forehead', 'chin'])
  add('upper_visible_third_ratio', Math.hypot(points.forehead.x - browMid.x, points.forehead.y - browMid.y), faceHeight, 'distance(forehead_10, brow_midpoint) / visible_face_height', ['forehead', 'leftBrow', 'rightBrow', 'chin'])
  add('middle_visible_third_ratio', Math.hypot(points.noseBase.x - browMid.x, points.noseBase.y - browMid.y), faceHeight, 'distance(brow_midpoint, nose_base_2) / visible_face_height', ['leftBrow', 'rightBrow', 'noseBase', 'forehead', 'chin'])
  add('lower_visible_third_ratio', d('noseBase', 'chin'), faceHeight, 'distance(nose_base_2, chin_152) / visible_face_height', ['noseBase', 'chin', 'forehead'])
  add('chin_to_lower_face_ratio', Math.hypot(points.chin.x - mouthMid.x, points.chin.y - mouthMid.y), d('noseBase', 'chin'), 'distance(mouth_midpoint, chin_152) / distance(nose_base_2, chin_152)', ['upperLipInner', 'lowerLipInner', 'chin', 'noseBase'])
  add('jaw_to_cheek_width_ratio', d('leftJaw', 'rightJaw'), cheekWidth, 'distance(jaw_172, jaw_397) / cheek_width', ['leftJaw', 'rightJaw', 'leftCheek', 'rightCheek'])
  add('chin_to_cheek_width_ratio', d('chinLeft', 'chinRight'), cheekWidth, 'distance(chin_176, chin_400) / cheek_width', ['chinLeft', 'chinRight', 'leftCheek', 'rightCheek'])
  add('inter_eye_spacing_to_face_width_ratio', d('leftEyeInner', 'rightEyeInner'), cheekWidth, 'distance(eye_133, eye_362) / cheek_width', ['leftEyeInner', 'rightEyeInner', 'leftCheek', 'rightCheek'])
  add('left_eye_width_to_face_width_ratio', d('leftEyeOuter', 'leftEyeInner'), cheekWidth, 'distance(eye_33, eye_133) / cheek_width', ['leftEyeOuter', 'leftEyeInner', 'leftCheek', 'rightCheek'])
  add('right_eye_width_to_face_width_ratio', d('rightEyeInner', 'rightEyeOuter'), cheekWidth, 'distance(eye_362, eye_263) / cheek_width', ['rightEyeInner', 'rightEyeOuter', 'leftCheek', 'rightCheek'])
  add('left_eye_opening_ratio', d('leftEyeTop', 'leftEyeBottom'), d('leftEyeOuter', 'leftEyeInner'), 'distance(eye_159, eye_145) / left_eye_width', ['leftEyeTop', 'leftEyeBottom', 'leftEyeOuter', 'leftEyeInner'], ['Visible eyelid opening varies with expression and blinking'])
  add('right_eye_opening_ratio', d('rightEyeTop', 'rightEyeBottom'), d('rightEyeInner', 'rightEyeOuter'), 'distance(eye_386, eye_374) / right_eye_width', ['rightEyeTop', 'rightEyeBottom', 'rightEyeInner', 'rightEyeOuter'], ['Visible eyelid opening varies with expression and blinking'])
  add('left_brow_to_eye_ratio', d('leftBrow', 'leftEyeTop'), d('leftEyeOuter', 'leftEyeInner'), 'distance(brow_105, eye_159) / left_eye_width', ['leftBrow', 'leftEyeTop', 'leftEyeOuter', 'leftEyeInner'], ['Brow grooming and expression affect this relationship'])
  add('right_brow_to_eye_ratio', d('rightBrow', 'rightEyeTop'), d('rightEyeInner', 'rightEyeOuter'), 'distance(brow_334, eye_386) / right_eye_width', ['rightBrow', 'rightEyeTop', 'rightEyeInner', 'rightEyeOuter'], ['Brow grooming and expression affect this relationship'])
  add('nose_width_to_face_width_ratio', d('noseLeft', 'noseRight'), cheekWidth, 'distance(nose_98, nose_327) / cheek_width', ['noseLeft', 'noseRight', 'leftCheek', 'rightCheek'])
  add('nose_length_to_face_height_ratio', d('noseTip', 'noseBase'), faceHeight, 'distance(nose_tip_1, nose_base_2) / visible_face_height', ['noseTip', 'noseBase', 'forehead', 'chin'], ['Strongly affected by pitch and 2D projection'])
  add('mouth_width_to_face_width_ratio', d('mouthLeft', 'mouthRight'), cheekWidth, 'distance(mouth_61, mouth_291) / cheek_width', ['mouthLeft', 'mouthRight', 'leftCheek', 'rightCheek'])
  add('visible_lip_height_to_mouth_width_ratio', d('upperLipOuter', 'lowerLipOuter'), d('mouthLeft', 'mouthRight'), 'distance(lip_0, lip_17) / mouth_width', ['upperLipOuter', 'lowerLipOuter', 'mouthLeft', 'mouthRight'], ['Measures visible lip height, not tissue volume'])

  const leftEyeWidth = d('leftEyeOuter', 'leftEyeInner')
  const rightEyeWidth = d('rightEyeInner', 'rightEyeOuter')
  const jawMid = mid('leftJaw', 'rightJaw')
  const cheekMid = mid('leftCheek', 'rightCheek')
  const midlineX = (points.forehead.x + points.noseBase.x + points.chin.x) / 3
  add('eye_width_asymmetry_ratio', Math.abs(leftEyeWidth - rightEyeWidth), (leftEyeWidth + rightEyeWidth) / 2, 'abs(left_eye_width - right_eye_width) / mean_eye_width', ['leftEyeOuter', 'leftEyeInner', 'rightEyeInner', 'rightEyeOuter'])
  add('jaw_midline_deviation_ratio', Math.abs(jawMid.x - midlineX), cheekWidth, 'abs(jaw_midpoint_x - facial_midline_x) / cheek_width', ['leftJaw', 'rightJaw', 'forehead', 'noseBase', 'chin', 'leftCheek', 'rightCheek'])
  add('cheek_midline_deviation_ratio', Math.abs(cheekMid.x - midlineX), cheekWidth, 'abs(cheek_midpoint_x - facial_midline_x) / cheek_width', ['leftCheek', 'rightCheek', 'forehead', 'noseBase', 'chin'])

  const findings = assessable ? [{
    id: 'front_bilateral_geometry_recorded', category: 'measured_geometry',
    statement: 'Bilateral photographic geometry was measured without applying an attractiveness threshold.',
    evidence: ['eye_width_asymmetry_ratio', 'jaw_midline_deviation_ratio', 'cheek_midline_deviation_ratio'],
    confidence: null, assessable: true, limitations: ['No validated flaw threshold is applied'],
  }] : []
  const notAssessable = [
    unsupported('maxilla_development'), unsupported('ramus_length'), unsupported('orbital_depth'),
    unsupported('skeletal_projection'), unsupported('physical_face_width_cm'), unsupported('physical_jaw_width_cm'),
  ]
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION, status: assessable ? 'measured' : 'additional_image_required',
    reason: assessable ? null : failureReason, pose, quality,
    landmarks: landmarks.map((value, index) => ({ index, x: round(value.x), y: round(value.y), z: round(value.z ?? 0) })),
    measurements: rows, findings, observations: [], recommendations: [], notAssessable,
    confidence: { overall: null, reason: 'No calibrated confidence model is available' },
    limitations: ['No objective flaw threshold has been validated', 'No recommendation is personalized without supported evidence references', 'Values are dimensionless photographic ratios; no physical dimensions are claimed'],
  }
}

export function buildProfileEvidence(sideProfileGeometry) {
  const detected = sideProfileGeometry?.detected === true || Number.isFinite(sideProfileGeometry?.facialConvexityDegrees)
  const convexity = sideProfileGeometry?.facialConvexityDegrees
  const measurements = Number.isFinite(convexity) ? [{
    id: 'photographic_facial_convexity_angle', value: round(convexity), unit: 'degrees',
    source: 'apple_vision_profile_landmarks', landmarksUsed: sideProfileGeometry?.landmarksUsed ?? [],
    formula: 'angle(glabella, subnasale, pogonion) from the captured profile photograph',
    confidence: null, assessable: true, reason: null,
    limitations: ['Photographic angle; not a skeletal measurement', 'Sensitive to profile pose and landmark placement'],
  }] : []
  return {
    orientation: 'profile', status: detected && measurements.length ? 'measured' : 'not_assessable',
    reason: detected ? (measurements.length ? null : 'supported_profile_metric_unavailable') : 'insufficient_profile_visibility',
    measurements, findings: [], notAssessable: [
      unsupported('true_skeletal_projection', 'feature_cannot_be_inferred_from_2d_profile_photography'),
      unsupported('physical_nose_projection_mm', 'uncalibrated_photo_has_no_physical_scale'),
      unsupported('physical_chin_projection_mm', 'uncalibrated_photo_has_no_physical_scale'),
    ],
  }
}

export function validateRecommendationTrace(recommendation, findings = []) {
  if (!recommendation || !Array.isArray(recommendation.basedOn) || recommendation.basedOn.length === 0) return false
  const ids = new Set(findings.map(finding => finding.id))
  return recommendation.basedOn.every(id => ids.has(id))
}
