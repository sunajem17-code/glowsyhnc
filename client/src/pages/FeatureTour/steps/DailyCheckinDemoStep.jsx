import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Droplet, Check, Smile } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '../../../utils/theme'

const MOODS = ['😩', '😕', '😐', '🙂', '😄']

export default function DailyCheckinDemoStep() {
  const [water, setWater] = useState(3)
  const [amDone, setAmDone] = useState(false)
  const [pmDone, setPmDone] = useState(false)
  const [mood, setMood] = useState(3)
  const [logged, setLogged] = useState(false)

  return (
    <div className="h-full flex flex-col justify-center pb-6">
      <div className="text-center mb-5">
        <span className="font-heading font-bold text-[10px] tracking-[0.16em]" style={{ color: GOLD }}>DAILY CHECK-IN</span>
        <h2 className="font-heading font-bold text-[22px] leading-tight mt-1.5" style={{ color: '#F0EDE8', letterSpacing: '-0.01em' }}>
          Takes 15 seconds
        </h2>
        <p className="font-body text-[13px] mt-1.5 max-w-[280px] mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Water, skincare, mood — that's it. Do it daily and your streak (and your plan) adjusts to you.
        </p>
      </div>

      <div className="max-w-[280px] w-full mx-auto flex flex-col gap-3">
        {/* Water */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-heading font-bold text-[11px] tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>WATER</span>
            <span className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{water}/8 glasses</span>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 8 }, (_, i) => (
              <button key={i} onClick={() => setWater(i + 1)} aria-label={`${i + 1} glasses`}>
                <Droplet
                  size={18}
                  fill={i < water ? GOLD : 'transparent'}
                  style={{ color: i < water ? GOLD : 'rgba(255,255,255,0.2)' }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Skincare */}
        <div className="flex gap-2.5">
          {[{ label: 'AM Skincare', done: amDone, toggle: () => setAmDone(v => !v) },
            { label: 'PM Skincare', done: pmDone, toggle: () => setPmDone(v => !v) }].map(({ label, done, toggle }) => (
            <button
              key={label}
              onClick={toggle}
              className="flex-1 flex items-center gap-2 px-3.5 py-3 rounded-xl text-left"
              style={{
                background: done ? 'rgba(198,168,92,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${done ? 'rgba(198,168,92,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div
                className="w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: done ? GOLD : 'transparent', border: done ? 'none' : '1.5px solid rgba(255,255,255,0.25)' }}
              >
                {done && <Check size={11} style={{ color: '#0A0A0A' }} strokeWidth={3} />}
              </div>
              <span className="font-body text-[11.5px]" style={{ color: done ? GOLD : 'rgba(255,255,255,0.55)' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Mood */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Smile size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="font-heading font-bold text-[11px] tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>HOW ARE YOU FEELING</span>
          </div>
          <div className="flex items-center justify-between">
            {MOODS.map((emoji, i) => (
              <button
                key={i}
                onClick={() => setMood(i)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[18px]"
                style={{
                  background: mood === i ? 'rgba(198,168,92,0.18)' : 'transparent',
                  border: mood === i ? `1px solid ${GOLD}` : '1px solid transparent',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Local-only "log it" — no submission, no store write */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setLogged(true)}
          disabled={logged}
          className="w-full py-3 rounded-xl font-heading font-bold text-[13px] flex items-center justify-center gap-2"
          style={{ background: logged ? 'rgba(52,199,89,0.15)' : GOLD_GRADIENT, color: logged ? '#34C759' : '#0A0A0A' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={logged ? 'done' : 'log'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              {logged ? <Check size={14} /> : null}
              {logged ? 'Nice — that\'s a check-in' : 'Log it'}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  )
}
