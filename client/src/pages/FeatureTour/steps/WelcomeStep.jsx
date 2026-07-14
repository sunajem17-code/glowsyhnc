import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import logo from '../../../assets/ascendus-icon.png'
import { GOLD } from '../../../utils/theme'

export default function WelcomeStep() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center pb-10">
      <motion.img
        src={logo}
        alt=""
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: 56, height: 56, mixBlendMode: 'lighten', marginBottom: 24 }}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
        style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.25)' }}
      >
        <Sparkles size={12} style={{ color: GOLD }} />
        <span className="font-heading font-bold text-[11px] tracking-[0.14em]" style={{ color: GOLD }}>
          QUICK TOUR
        </span>
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="font-heading font-bold text-[28px] leading-tight mb-3"
        style={{ color: '#F0EDE8', letterSpacing: '-0.02em' }}
      >
        You just scanned.<br />Here's everything else.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="font-body text-[14px] leading-relaxed max-w-[280px]"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        Ascendus is more than a score. Give us 90 seconds and we'll show you the stuff people actually use every day — no boring feature list, promise.
      </motion.p>
    </div>
  )
}
