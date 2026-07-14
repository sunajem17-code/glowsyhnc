// Shared between App.jsx and PremiumOnboarding.jsx — split out to avoid a
// circular import (PremiumOnboarding importing a constant from App.jsx, which
// itself imports PremiumOnboarding). Set by PremiumOnboarding at the moment
// it completes; read by App.jsx's Feature Tour gate. Session-scoped so it
// only ever means "just now," never "at some point in the past."
export const JUST_ONBOARDED_KEY = 'asc_just_onboarded'
