import { ONBOARDING_STEP_COUNT } from './onboardingProgress.js'

export const FINAL_ONBOARDING_STEP = ONBOARDING_STEP_COUNT - 1
export function onboardingOwner(user) {
  return user?.id != null && String(user.id).trim() ? `user:${String(user.id)}` : 'device:anonymous'
}
export function startingPointCompletionKey(user) {
  return onboardingOwner(user)
}
export function hasCompletedStartingPoint(state) {
  return state.startingPointCompletedByUser?.[startingPointCompletionKey(state.user)] === true
}
export function hasCompletedOnboarding(state) {
  return Object.hasOwn(state.onboardingCompletedByUser || {}, onboardingOwner(state.user)) &&
    state.onboardingCompletedByUser[onboardingOwner(state.user)] === true
}
export function onboardingStartup(state) {
  if (state.onboardingHydrated !== true) return 'checking'
  if (!hasCompletedOnboarding(state)) {
    // A signed-out device with a previously completed account should show the
    // sign-in flow. Without this, logout/401 clears `user`, startup checks the
    // anonymous key, and incorrectly sends the returning account to onboarding.
    const hasCompletedAccount = Object.entries(state.onboardingCompletedByUser || {})
      .some(([key, completed]) => key.startsWith('user:') && completed === true)
    if (state.user == null && state.isAuthenticated !== true && hasCompletedAccount) return 'signin'
    return 'onboarding'
  }
  return state.isAuthenticated === true && typeof state.token === 'string' && state.token.length > 0 ? 'app' : 'signin'
}
export function normalizeOnboardingCompletion(saved = {}) {
  const records = Object.fromEntries(Object.entries(saved.onboardingCompletedByUser || {})
    .filter(([key, value]) => key.startsWith('user:') || key === 'device:anonymous')
    .filter(([, value]) => value === true))
  // Migrate an explicit legacy boolean only for the identity it was saved with.
  // This also repairs stores where the new completion map exists but was empty
  // when an older, already-completed account was first loaded by this version.
  // Missing, string-valued or truthy flags never mean completed.
  if (saved.hasOnboarded === true && records[onboardingOwner(saved.user)] !== true) {
    records[onboardingOwner(saved.user)] = true
  }
  return { onboardingCompletedByUser: records, hasOnboarded: records[onboardingOwner(saved.user)] === true }
}
