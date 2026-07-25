import { motion, MotionConfig, PresenceContext } from 'framer-motion'
import { GOLD, EASE_STANDARD } from '../utils/theme'

// Extracted from Scan.jsx so ScanHome can reuse it without statically pulling
// in Scan.jsx's whole (lazy-loaded) module graph.
const FACE_SCAN_DOT_ROWS = [22, 38, 54, 70, 86]
const FACE_SCAN_DOTS = FACE_SCAN_DOT_ROWS.flatMap((cy, row) => {
  const edge = row === 0 || row === FACE_SCAN_DOT_ROWS.length - 1
  const count = edge ? 3 : 5
  const spread = edge ? 20 : 32
  return Array.from({ length: count }, (_, i) => ({
    cx: 50 + (i - (count - 1) / 2) * (spread / (count - 1 || 1)),
    cy,
  }))
})

// Purely visual — no real face detection. Echoes the grid + sweep "scanning"
// motif also used in the share-card Remotion video.
//
// loop=false (default): plays once, briefly — Scan.jsx's use, right after a
// face photo is captured/uploaded.
// loop=true: repeats continuously — for ambient decoration on a static
// screen (ScanHome's "Begin Scan" card) rather than a one-shot confirmation.
//
// showDots=true (default): keeps Scan.jsx's capture-flow usage unaffected.
// ScanHome passes showDots={false} to drop the dot mesh from its card while
// keeping the grid and sweep line untouched.
//
// MotionConfig reducedMotion="never" (scoped to just this component, not
// global): purely decorative (no functional information conveyed), so it
// opts out of the OS-level reduced-motion override locally rather than
// disabling it for the rest of the app, which still has its own manual
// useReducedMotion() treatments elsewhere (Results.jsx, ScanUnlockGate.jsx).
//
// PresenceContext.Provider value={null}: the real reason the loop never
// played on ScanHome's carousel card. AnimatePresence initial={false}
// (ScanHome's slide wrapper) sets presenceContext.initial = false, which
// every descendant motion component inherits — including this one, three
// levels down. Framer Motion reads that as "already present on first
// render, don't play the mount transition" and sets blockInitialAnimation,
// which skips the animate call entirely and jumps straight to the last
// keyframe (top: 100%, opacity: 0) — repeat: Infinity never gets a chance
// to start because the animation itself never starts. Resetting presence
// context to null here insulates this subtree so it always animates in as
// if freshly mounted, regardless of what AnimatePresence wraps it.
// (Confirmed live: presenceContext.initial was false and blockInitialAnimation
// was true on the mounted VisualElement before this fix.)
export default function FaceScanOverlay({ loop = false, showDots = true }) {
  const repeat = loop ? Infinity : 0
  const repeatDelay = loop ? 0.6 : 0

  return (
    <MotionConfig reducedMotion="never">
      <PresenceContext.Provider value={null}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE_STANDARD }}
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          {/* Grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(${GOLD}33 1px, transparent 1px), linear-gradient(90deg, ${GOLD}33 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />
          {/* Dot mesh — loose face-outline arrangement, not real landmarks */}
          {showDots && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {FACE_SCAN_DOTS.map((d, i) => (
                <motion.circle
                  key={i}
                  cx={d.cx} cy={d.cy} r={0.7}
                  fill={GOLD}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.7, ease: EASE_STANDARD, delay: i * 0.025, repeat, repeatDelay }}
                />
              ))}
            </svg>
          )}
          {/* Sweep line */}
          <motion.div
            className="absolute left-0 right-0"
            style={{ height: 2, background: GOLD, boxShadow: `0 0 14px 3px ${GOLD}` }}
            initial={{ top: '0%', opacity: 0 }}
            animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.5, ease: EASE_STANDARD, repeat, repeatDelay }}
          />
        </motion.div>
      </PresenceContext.Provider>
    </MotionConfig>
  )
}
