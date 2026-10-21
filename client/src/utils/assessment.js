import rubric from '../../../server/src/lib/assessmentRubric.json' with { type: 'json' }
import pslV2Rubric from './assessmentRubricV2.json' with { type: 'json' }
import previousRubric from './assessmentRubricV1.json' with { type: 'json' }
export const ASSESSMENT_VERSION = rubric.version
export function assessmentRubric(version = ASSESSMENT_VERSION) {
  if (version === rubric.version) return rubric
  if (version === pslV2Rubric.version) return pslV2Rubric
  if (version === previousRubric.version) return previousRubric
  throw new Error('Unsupported assessment rubric')
}
export function assessmentScale(version = ASSESSMENT_VERSION) {
  return assessmentRubric(version).scale || { min: 0, max: 10, unit: 'Appearance' }
}
// Recognize saved structured assessments as well as the latest rubric; never reinterpret their numbers.
export function isCurrentAssessment(scan) { return [rubric.version, pslV2Rubric.version, previousRubric.version].includes(scan?.aiScore?.assessment?.rubricVersion) }
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
// Display only: server-side validation remains authoritative for the source assessment.
export function assessmentPresentation(assessment, selectedProfile = assessment.assessmentProfile) {
  const { scoreRange, rubricVersion } = assessment
  if (scoreRange === null) return null
  const config = assessmentRubric(rubricVersion), scale = assessmentScale(rubricVersion)
  assessmentRange(scoreRange, selectedProfile, rubricVersion)
  if (!config.presentation) return { range: scoreRange, max: scale.max, unit: scale.unit,
    tiers: assessmentRange(scoreRange, selectedProfile, rubricVersion), secondary: null }
  const settings = config.presentation
  const converted = { min: scoreRange.min * settings.max / scale.max, max: scoreRange.max * settings.max / scale.max }
  const profile = ['male', 'female'].includes(selectedProfile) ? selectedProfile : 'unspecified'
  const classify = number => {
    const band = settings.bands.find(b => number >= b.min && (number < b.max || number === settings.max && b.max === settings.max))
    return { id: band.id, label: band.labels[profile] }
  }
  return { range: converted, max: settings.max, unit: settings.unit, version: settings.version,
    tiers: { min: classify(converted.min), max: classify(converted.max) },
    secondary: { range: scoreRange, max: scale.max, unit: scale.unit } }
}
export function formatAssessmentRange(value) {
  if (!value) return 'Withheld'
  const format = number => Number(number.toFixed(1)).toString()
  return `${format(value.min)}–${format(value.max)}`
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
