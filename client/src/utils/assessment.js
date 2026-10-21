import rubric from '../../../server/src/lib/assessmentRubric.json' with { type: 'json' }
import previousRubric from './assessmentRubricV1.json' with { type: 'json' }
export const ASSESSMENT_VERSION = rubric.version
export function assessmentRubric(version = ASSESSMENT_VERSION) {
  if (version === rubric.version) return rubric
  if (version === previousRubric.version) return previousRubric
  throw new Error('Unsupported assessment rubric')
}
export function assessmentScale(version = ASSESSMENT_VERSION) {
  return assessmentRubric(version).scale || { min: 0, max: 10, unit: 'Appearance' }
}
// Recognize saved structured assessments as well as the latest rubric; never reinterpret their numbers.
export function isCurrentAssessment(scan) { return [rubric.version, previousRubric.version].includes(scan?.aiScore?.assessment?.rubricVersion) }
export function assessmentTier(value, selectedProfile, version = ASSESSMENT_VERSION) {
  const selectedRubric = assessmentRubric(version), max = assessmentScale(version).max
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new Error('Invalid assessment score')
  const band = selectedRubric.bands.find(b => value >= b.min && (value < b.max || b.max === max && value === max))
  const profile = ['male', 'female'].includes(selectedProfile) ? selectedProfile : 'unspecified'
  return { id: band.id, label: band.labels[profile], umbrella: version === previousRubric.version && value < 5 ? 'Sub-5' : null }
}
export function assessmentRange(value, profile, version = ASSESSMENT_VERSION) {
  if (value === null) return null
  if (!value || value.min > value.max) throw new Error('Invalid assessment range')
  return { min: assessmentTier(value.min, profile, version), max: assessmentTier(value.max, profile, version) }
}
// No conversion of withheld assessments to 0, a midpoint, or a legacy rubric.
export function assessmentScan(result, { id, scanDate, facePhotoUrl, sidePhotoUrl }) {
  if (result?.assessment?.rubricVersion !== ASSESSMENT_VERSION) throw new Error('Unsupported assessment rubric. Please update the app or try again.')
  assessmentRange(result.assessment.scoreRange, result.assessment.assessmentProfile)
  return { id, scanDate, analyzedAt: scanDate, facePhotoUrl, sidePhotoUrl,
    gender: result.assessment.assessmentProfile, rubricVersion: ASSESSMENT_VERSION,
    umaxScore: null, glowScore: null, tier: null, faceData: null, pillars: null,
    aiScore: result, analysisEvidence: result.analysisEvidence ?? null, hasSideProfile: result.assessment.imageSuitability.profileUsable,
    extendedMetricsStatus: 'unsupported_removed' }
}
