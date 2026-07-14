import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, ArrowLeftRight } from 'lucide-react'
import { GOLD } from '../../../utils/theme'
import { PHOTO_RANKER_DEMO_CARDS, PHOTO_RANKER_WINNER_ID } from '../../../utils/tourDemoData'

// Swipe through 3 sample "shooting condition" cards, then reveal which one
// wins. No real photo upload or ranking call — see tourDemoData.js for why.
export default function PhotoRankerDemoStep() {
  const [cardIdx, setCardIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const card = PHOTO_RANKER_DEMO_CARDS[cardIdx]
  const isLast = cardIdx === PHOTO_RANKER_DEMO_CARDS.length - 1

  function advance() {
    if (isLast) { setRevealed(true); return }
    setCardIdx(i => i + 1)
  }

  const winner = PHOTO_RANKER_DEMO_CARDS.find(c => c.id === PHOTO_RANKER_WINNER_ID)

  return (
    <div className="h-full flex flex-col justify-center pb-6">
      <div className="text-center mb-5">
        <span className="font-heading font-bold text-[10px] tracking-[0.16em]" style={{ color: GOLD }}>PHOTO RANKER</span>
        <h2 className="font-heading font-bold text-[22px] leading-tight mt-1.5" style={{ color: '#F0EDE8', letterSpacing: '-0.01em' }}>
          {revealed ? 'Here\'s the winner' : 'Swipe through 3 photos'}
        </h2>
        <p className="font-body text-[13px] mt-1.5 max-w-[280px] mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {revealed
            ? 'SwipeMaxx and TinderMaxx do this with your own dating photos, ranked and explained.'
            : 'Swipe left to see the next one.'}
        </p>
      </div>

      <div className="relative max-w-[260px] w-full mx-auto" style={{ aspectRatio: '3 / 4' }}>
        <AnimatePresence mode="wait" initial={false}>
          {!revealed ? (
            <motion.div
              key={card.id}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60 || info.velocity.x < -400) advance()
              }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ x: -260, opacity: 0, rotate: -8 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center px-6 cursor-grab active:cursor-grabbing"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span style={{ fontSize: 56 }}>{card.emoji}</span>
              <p className="font-heading font-bold text-[16px] mt-4" style={{ color: '#F0EDE8' }}>{card.label}</p>
              <p className="font-body text-[12px] mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{card.detail}</p>
              <div className="flex items-center gap-1.5 mt-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <ArrowLeftRight size={11} />
                <span className="font-body text-[10px]">{isLast ? 'Swipe to see the winner' : 'Swipe for next'}</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="winner"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center px-6"
              style={{ background: 'rgba(198,168,92,0.08)', border: `1px solid rgba(198,168,92,0.35)` }}
            >
              <Trophy size={28} style={{ color: GOLD }} />
              <span style={{ fontSize: 40, marginTop: 12 }}>{winner.emoji}</span>
              <p className="font-heading font-bold text-[16px] mt-3" style={{ color: GOLD }}>{winner.label}</p>
              <p className="font-body text-[12px] mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{winner.detail}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!revealed && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {PHOTO_RANKER_DEMO_CARDS.map((c, i) => (
            <div
              key={c.id}
              className="rounded-full"
              style={{ width: 6, height: 6, background: i <= cardIdx ? GOLD : 'rgba(255,255,255,0.15)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
