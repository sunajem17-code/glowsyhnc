import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '../../../utils/theme'

export default function CompletionStep() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center pb-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ background: GOLD_GRADIENT }}
      >
        <Check size={28} style={{ color: '#0A0A0A' }} strokeWidth={3} />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="font-heading font-bold text-[26px] leading-tight mb-3"
        style={{ color: '#F0EDE8', letterSpacing: '-0.02em' }}
      >
        That's the tour.<br />Go build something.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="font-body text-[14px] leading-relaxed max-w-[280px]"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        Everything you just saw is one tap away from your dashboard, anytime. Come back to this whenever — it's not going anywhere.
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="font-body text-[11px] mt-8"
        style={{ color: GOLD }}
      >
        Let's go.
      </motion.p>
    </div>
  )
}
