import { motion, AnimatePresence } from 'framer-motion'
import { GOLD } from '../utils/theme'

/**
 * Full-screen animated overlay shown during any loading state.
 * Wrap usage in <AnimatePresence> for smooth fade in/out.
 *
 * Usage:
 *   <AnimatePresence>
 *     {isLoading && <ProcessingOverlay />}
 *   </AnimatePresence>
 */
export default function ProcessingOverlay({ label = 'Processing' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}
    >
      <p style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 20, color: '#fff', letterSpacing: '-0.01em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 36 }}>
        {[0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            style={{ width: 7, borderRadius: 4, background: GOLD }}
            animate={{ height: ['12px', '32px', '12px'] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </motion.div>
  )
}
