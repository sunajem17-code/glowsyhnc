import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { ACHIEVEMENTS } from '../utils/achievements'

export default function AchievementToast() {
  const { pendingAchievement, clearPendingAchievement } = useStore()
  const ach = pendingAchievement ? ACHIEVEMENTS[pendingAchievement] : null

  useEffect(() => {
    if (!ach) return
    const t = setTimeout(clearPendingAchievement, 3500)
    return () => clearTimeout(t)
  }, [ach, clearPendingAchievement])

  return (
    <AnimatePresence>
      {ach && (
        <motion.div
          key={ach.key}
          initial={{ opacity: 0, y: -80, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 rounded-2xl flex items-center gap-3"
          style={{
            background: '#111',
            border: `1.5px solid ${ach.color}55`,
            boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 20px ${ach.color}22`,
            minWidth: 260,
            maxWidth: 320,
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
            style={{ background: `${ach.color}15`, border: `1px solid ${ach.color}30` }}
          >
            {ach.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-[13px]" style={{ color: ach.color }}>
              Achievement Unlocked!
            </p>
            <p className="font-heading font-bold text-[12px] text-white truncate">{ach.title}</p>
            <p className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{ach.desc}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
