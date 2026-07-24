import { motion } from 'framer-motion'
import { EASE_STANDARD } from '../utils/theme'

const variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

// baseClassName defaults to the standard scrollable-page sizing ('page-scroll',
// which reserves room for the bottom nav). Screens with their own layout shape
// (fixed-position overlays, full-height flows with no bottom nav) should pass
// baseClassName="" and provide their full layout via className instead.
export default function MotionPage({ children, className = '', style, baseClassName = 'page-scroll' }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: EASE_STANDARD }}
      className={`${baseClassName} ${className}`.trim()}
      style={style}
    >
      {children}
    </motion.div>
  )
}
