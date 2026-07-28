// Shared brand gold — was independently redeclared (sometimes with drifting
// hex values, e.g. #C9A84C vs #C6A85C) across PremiumOnboarding, Scan,
// ScanUnlockGate, Results, and AIConsentModal. One source of truth.
export const GOLD = '#C6A85C'
export const GOLD_GRADIENT = `linear-gradient(135deg, #D4B96A 0%, ${GOLD} 50%, #A8893A 100%)`

// Shared error/danger red — same value already hardcoded independently 66+
// times across the app (Premium, Results, ScanUnlockGate, Auth, score
// badges, etc.) and as .score-red/.score-bg-red in index.css. Promoted here
// the same way GOLD was, so new error text has a token to reach for instead
// of another one-off hex literal.
export const RED = '#EF4444'

// Shared motion presets — the dominant easing curve (64 uses) and spring
// config (2 uses) found across the app's framer-motion transitions, promoted
// here as the default reusable presets instead of each screen hand-tuning
// its own.
export const EASE_STANDARD = [0.22, 1, 0.36, 1]
export const SPRING_STANDARD = { type: 'spring', stiffness: 380, damping: 36 }
