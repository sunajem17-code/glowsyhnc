// Keep saved progress inside the seven screens that are actually rendered.
export const ONBOARDING_STEP_COUNT = 7
export function normalizeOnboardingStep(value) {
  return Number.isInteger(value) && value >= 0 && value < ONBOARDING_STEP_COUNT ? value : 0
}
export function nextOnboardingStep(value, direction = 1) {
  return Math.max(0, Math.min(ONBOARDING_STEP_COUNT - 1, normalizeOnboardingStep(value) + direction))
}
