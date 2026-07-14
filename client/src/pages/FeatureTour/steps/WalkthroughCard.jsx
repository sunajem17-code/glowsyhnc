import { motion } from 'framer-motion'
import { GOLD } from '../../../utils/theme'

// Shared layout for the non-interactive tour steps: icon, badge, title,
// description, and a short stack of highlight chips. Staggered entrance
// (30-80ms per highlight) — decorative, doesn't block interaction, matches
// how the rest of the app introduces grouped content.
export default function WalkthroughCard({ icon: Icon, badge, title, description, highlights = [] }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center pb-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.25)' }}
      >
        <Icon size={28} style={{ color: GOLD }} />
      </motion.div>

      {badge && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="font-heading font-bold text-[10px] tracking-[0.16em] mb-2"
          style={{ color: GOLD }}
        >
          {badge}
        </motion.span>
      )}

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="font-heading font-bold text-[24px] leading-tight mb-3"
        style={{ color: '#F0EDE8', letterSpacing: '-0.01em' }}
      >
        {title}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="font-body text-[14px] leading-relaxed max-w-[300px] mb-6"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {description}
      </motion.p>

      {highlights.length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-[300px]">
          {highlights.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-left"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GOLD }} />
              <p className="font-body text-[12.5px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>{h}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
