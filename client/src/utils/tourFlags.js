// Originally split out to avoid a circular import between App.jsx and
// PremiumOnboarding.jsx (each gated a post-onboarding screen on this flag).
// Both consumers — the Feature Tour gate and the Cost of Inaction gate —
// have since been removed, and nothing currently reads or writes this key.
// Left in place in case a future post-onboarding, first-run-only screen
// needs the same "just now" session signal.
export const JUST_ONBOARDED_KEY = 'asc_just_onboarded'
