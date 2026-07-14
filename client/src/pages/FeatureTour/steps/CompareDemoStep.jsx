import { motion } from 'framer-motion'
import { ArrowLeftRight } from 'lucide-react'
import { CompareSlider } from '../../Compare'
import { GOLD } from '../../../utils/theme'
import BEFORE_IMG from '../../../assets/transformations/before.jpg'
import AFTER_IMG from '../../../assets/transformations/after.jpg'

export default function CompareDemoStep() {
  return (
    <div className="h-full flex flex-col justify-center pb-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-center mb-4"
      >
        <span className="font-heading font-bold text-[10px] tracking-[0.16em]" style={{ color: GOLD }}>COMPARE</span>
        <h2 className="font-heading font-bold text-[22px] leading-tight mt-1.5" style={{ color: '#F0EDE8', letterSpacing: '-0.01em' }}>
          Drag it yourself
        </h2>
        <p className="font-body text-[13px] mt-1.5 max-w-[280px] mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Every real Compare uses your own two scans. This one's a sample — try the slider.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[260px] w-full mx-auto"
      >
        <CompareSlider before={BEFORE_IMG} after={AFTER_IMG} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="flex items-center justify-center gap-1.5 mt-4"
      >
        <ArrowLeftRight size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
        <span className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Drag left or right</span>
      </motion.div>
    </div>
  )
}
