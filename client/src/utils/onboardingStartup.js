import { ONBOARDING_STEP_COUNT } from './onboardingProgress.js'

export const FINAL_ONBOARDING_STEP = ONBOARDING_STEP_COUNT - 1
export function onboardingOwner(user) {
  return user?.id != null && String(user.id).trim() ? `user:${String(user.id)}` : 'device:anonymous'
}
export function hasCompletedOnboarding(state) {
  return Object.hasOwn(state.onboardingCompletedByUser || {}, onboardingOwner(state.user)) &&
    state.onboardingCompletedByUser[onboardingOwner(state.user)] === true
}
export function onboardingStartup(state) {
  if (state.onboardingHydrated !== true) return 'checking'
  if (!hasCompletedOnboarding(state)) return 'onboarding'
  return state.isAuthenticated === true && typeof state.token === 'string' && state.token.length > 0 ? 'app' : 'signin'
}
export function normalizeOnboardingCompletion(saved = {}) {
  const records = Object.fromEntries(Object.entries(saved.onboardingCompletedByUser || {})
    .filter(([key, value]) => key.startsWith('user:') || key === 'device:anonymous')
    .filter(([, value]) => value === true))
  // Migrate an explicit legacy boolean only for the identity it was saved with.
  // Missing, string-valued or truthy flags never mean completed.
  if (!Object.hasOwn(saved, 'onboardingCompletedByUser') && saved.hasOnboarded === true) records[onboardingOwner(saved.user)] = true
  return { onboardingCompletedByUser: records, hasOnboarded: records[onboardingOwner(saved.user)] === true }
}
