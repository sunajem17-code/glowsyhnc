// Mirrors client/src/utils/theme.js (the main Ascendus app's source of truth
// for brand tokens). Kept as a plain copy since this is a separate Vite app
// with its own node_modules/build — update both files together if either
// token changes.
export const GOLD = '#C6A85C'
export const GOLD_GRADIENT = `linear-gradient(135deg, #D4B96A 0%, ${GOLD} 50%, #A8893A 100%)`
export const RED = '#EF4444'
export const EASE_STANDARD = [0.22, 1, 0.36, 1]
export const SPRING_STANDARD = { type: 'spring', stiffness: 380, damping: 36 }
