import { analyzeLandmarkEvidence, buildProfileEvidence } from './evidenceAnalysis.js'
import { ASSESSMENT_VERSION } from './assessment.js'

function imageDimensions(source) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Could not read image dimensions for evidence analysis'))
    image.src = source
  })
}

// Raw landmarks stay on-device. The API receives formulas, ratios and landmark
// IDs, not hundreds of coordinate values.
export function portableEvidence(evidence) {
  if (!evidence) return null
  return {
    schemaVersion: evidence.schemaVersion,
    status: evidence.status,
    reason: evidence.reason,
    pose: evidence.pose,
    quality: evidence.quality,
    measurements: evidence.measurements,
    findings: evidence.findings,
    notAssessable: evidence.notAssessable,
    profile: evidence.profile,
    limitations: evidence.limitations,
  }
}

export async function buildProductionEvidence({ frontImage, frontLandmarks, qualityGate = null, sideProfileGeometry = null }) {
  if (!frontImage || !Array.isArray(frontLandmarks)) throw new Error('Front image and landmarks are required')
  const { width, height } = await imageDimensions(frontImage)
  const front = analyzeLandmarkEvidence(frontLandmarks, width, height)
  const profile = buildProfileEvidence(sideProfileGeometry)
  return {
    ...front,
    qualityGate,
    profile,
    categories: {
      measured: front.measurements,
      observed: [],
      inferred: [],
      notAssessable: [...front.notAssessable, ...profile.notAssessable],
    },
  }
}

export async function requestProductionAnalysis({
  apiClient, faceImage, sideImage = null, gender = 'male',
  sideProfileGeometry = null, evidence, knownMinor = false, presentationGoals = '', timeoutMs = 120_000,
}) {
  if (evidence?.status !== 'measured') {
    const error = new Error(`Photo geometry could not be measured reliably: ${evidence?.reason ?? 'unknown_reason'}`)
    error.errorCode = 'analysis_quality_failed'
    error.analysisEvidence = evidence
    throw error
  }
  const payload = {
    faceImage,
    ...(sideImage ? { sideImage } : {}),
    ...(sideProfileGeometry ? { sideProfileGeometry } : {}),
    analysisEvidence: portableEvidence(evidence),
    gender,
    assessmentProfile: gender ?? null,
    knownMinor,
    ...(presentationGoals ? { presentationGoals } : {}),
  }
  const scoreCall = apiClient.ai.score(payload)
  let timeoutId
  const timeoutCall = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Analysis timed out. Please try again')), timeoutMs)
  })
  let result
  try {
    result = await Promise.race([scoreCall, timeoutCall])
  } finally {
    clearTimeout(timeoutId)
  }
  if (result.assessment?.rubricVersion !== ASSESSMENT_VERSION) {
    throw new Error('The scoring server returned an older rubric. Please update the server and try again.')
  }
  const presentationPromise = result.assessment?.presentationStatus === 'pending' && typeof apiClient.ai.scorePresentation === 'function'
    ? apiClient.ai.scorePresentation({
      faceImage,
      ...(sideImage && result.assessment?.imageSuitability?.profileUsable ? { sideImage } : {}),
      gender,
      knownMinor,
      ...(presentationGoals ? { presentationGoals } : {}),
    }).catch(() => ({
      presentation: { observations: {}, recommendations: [], unavailable: true },
      suggestions: [],
      unavailableDetail: 'Presentation feedback is unavailable; the assessment range is unchanged.',
    }))
    : null
  return {
    ...result,
    ...(presentationPromise ? { presentationPromise } : {}),
    analysisEvidence: {
      ...evidence,
      observations: result.visualObservations ?? [],
      categories: { ...evidence.categories, observed: result.visualObservations ?? [] },
    },
    scoreClassification: result.scoreClassification ?? {
      overall: 'legacy_subjective_visual_assessment',
      objectiveReplacementStatus: 'not_validated',
    },
  }
}
