import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'

// ─── Slide graphics ───────────────────────────────────────────────────────────

function ScanGraphic() {
  return (
    <div className="relative w-56 h-72 mx-auto">
      {/* Person silhouette */}
      <svg viewBox="0 0 140 200" className="w-full h-full" fill="none">
        {/* Body */}
        <ellipse cx="70" cy="38" rx="22" ry="26" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
        <rect x="50" y="62" width="40" height="58" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
        <rect x="36" y="64" width="16" height="52" rx="5" fill="rgba(255,255,255,0.03)"/>
        <rect x="88" y="64" width="16" height="52" rx="5" fill="rgba(255,255,255,0.03)"/>
        <rect x="52" y="118" width="14" height="54" rx="5" fill="rgba(255,255,255,0.04)"/>
        <rect x="74" y="118" width="14" height="54" rx="5" fill="rgba(255,255,255,0.04)"/>
        {/* Scan lines */}
        <motion.line
          x1="16" y1="30" x2="124" y2="30"
          stroke="#1A6B5C" strokeWidth="1" strokeDasharray="5 4" opacity="0.5"
          animate={{ y: [0, 150] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }}
          style={{ translateY: 0 }}
        />
        {/* Corner brackets */}
        <path d="M20 16 L20 26 M20 16 L32 16" stroke="#1A6B5C" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
        <path d="M120 16 L120 26 M120 16 L108 16" stroke="#1A6B5C" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
        <path d="M20 184 L20 174 M20 184 L32 184" stroke="#C9920A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
        <path d="M120 184 L120 174 M120 184 L108 184" stroke="#C9920A" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
        {/* Score dots */}
        <circle cx="118" cy="38" r="4" fill="#22C55E" opacity="0.9"/>
        <circle cx="118" cy="90" r="4" fill="#E8A000" opacity="0.9"/>
        <circle cx="118" cy="148" r="4" fill="#22C55E" opacity="0.9"/>
      </svg>
      {/* Floating badge */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-2 -right-6 rounded-2xl px-3 py-2"
        style={{
          background: 'rgba(26,107,92,0.15)',
          border: '1px solid rgba(26,107,92,0.4)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#C6A85C' }}/>
          <span className="text-xs font-mono font-bold text-white">78 / 100</span>
        </div>
        <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Glow Score</p>
      </motion.div>
    </div>
  )
}

function ProgressGraphic() {
  return (
    <div className="relative w-64 mx-auto">
      <div
        className="rounded-3xl p-5"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <p className="text-[10px] font-body uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Glow Score — 12 Weeks
        </p>
        <svg viewBox="0 0 220 80" className="w-full h-16">
          <defs>
            <linearGradient id="prog" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A6B5C" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#1A6B5C" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d="M10 68 Q 50 60 80 52 T 130 36 T 210 14" stroke="#1A6B5C" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d="M10 68 Q 50 60 80 52 T 130 36 T 210 14 L 210 80 L 10 80 Z" fill="url(#prog)"/>
          {[[10,68],[80,52],[130,36],[210,14]].map(([x,y], i) => (
            <motion.circle
              key={i}
              cx={x} cy={y} r="4"
              fill="#1A6B5C" stroke="rgba(255,255,255,0.2)" strokeWidth="2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 * i + 0.3 }}
            />
          ))}
        </svg>
        <div className="flex justify-between mt-2">
          {['Start', 'Wk 4', 'Wk 8', 'Now'].map((w) => (
            <span key={w} className="text-[9px] font-body" style={{ color: 'rgba(255,255,255,0.25)' }}>{w}</span>
          ))}
        </div>
      </div>
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        className="absolute -bottom-3 right-0 px-3 py-2 rounded-2xl"
        style={{
          background: 'rgba(198, 168, 92, 0.12)',
          border: '1px solid rgba(198, 168, 92, 0.25)',
        }}
      >
        <p className="text-xs font-bold font-heading" style={{ color: '#C6A85C' }}>+14 pts</p>
        <p className="text-[9px] font-body" style={{ color: 'rgba(255,255,255,0.35)' }}>this month</p>
      </motion.div>
    </div>
  )
}

function PlanGraphic() {
  const tasks = [
    { cat: 'Posture', task: 'Chin Tucks — 3×10', done: true },
    { cat: 'Skin', task: 'AM Skincare Routine', done: true },
    { cat: 'Body', task: 'Lateral Raises — 4×15', done: false },
    { cat: 'Style', task: 'Beard trim grooming', done: false },
  ]
  return (
    <div className="w-64 mx-auto space-y-2">
      {tasks.map((item, i) => (
        <motion.div
          key={i}
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 * i + 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: item.done ? '#1A6B5C' : 'transparent',
              border: item.done ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
            }}
          >
            {item.done && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <div>
            <p className="text-[9px] font-body mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.cat}</p>
            <p className="text-xs font-heading font-semibold" style={{ color: item.done ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)' }}>
              {item.task}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Slides data ──────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 0,
    label: '01',
    headline: 'Your face is only\nhalf the story.',
    sub: 'GlowSync analyzes your entire appearance — face, body, posture — in one scan.',
    graphic: <ScanGraphic />,
  },
  {
    id: 1,
    label: '02',
    headline: 'Watch yourself\nimprove.',
    sub: 'Track your score week by week. See exactly where you are and how far you have come.',
    graphic: <ProgressGraphic />,
  },
  {
    id: 2,
    label: '03',
    headline: 'A plan built\naround you.',
    sub: 'Posture, skincare, and style tasks — tailored to your specific areas of improvement.',
    cta: 'Start My First Scan',
    graphic: <PlanGraphic />,
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()
  const setHasOnboarded = useStore(s => s.setHasOnboarded)

  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1

  function next() {
    if (isLast) {
      setHasOnboarded()
      navigate('/auth')
    } else {
      setCurrent(c => c + 1)
    }
  }

  return (
    <div
      className="page-scroll-full flex flex-col select-none"
      style={{ background: '#080808' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-14 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1E7B69, #1A6B5C)' }}
          >
            <span className="text-white font-mono font-bold text-xs">G</span>
          </div>
          <span className="font-heading font-bold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
            GlowSync
          </span>
        </div>
        <button
          onClick={() => { setHasOnboarded(); navigate('/auth') }}
          className="text-[11px] font-body px-3 py-1.5 rounded-full"
          style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Skip
        </button>
      </div>

      {/* Slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 flex flex-col px-6"
        >
          {/* Slide number */}
          <div className="pt-2 pb-6">
            <span
              className="text-[10px] font-mono tracking-[0.25em]"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              {slide.label} / 03
            </span>
          </div>

          {/* Graphic */}
          <div className="flex-1 flex items-center justify-center py-4 min-h-0">
            {slide.graphic}
          </div>

          {/* Text */}
          <div className="pt-6 pb-4">
            <h1
              className="font-heading font-bold text-[32px] leading-[1.15] mb-3 whitespace-pre-line"
              style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em' }}
            >
              {slide.headline}
            </h1>
            <p
              className="font-body text-[15px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {slide.sub}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom */}
      <div className="px-6 pb-12 space-y-4">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-1">
          {SLIDES.map((_, i) => (
            <motion.div
              key={i}
              animate={{ width: i === current ? 20 : 6, opacity: i === current ? 1 : 0.25 }}
              className="h-1 rounded-full"
              style={{ background: '#1A6B5C' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] text-white tracking-wide transition-all"
          style={{
            background: isLast
              ? 'linear-gradient(135deg, #E8A000, #C9920A)'
              : 'linear-gradient(135deg, #1E7B69, #1A6B5C)',
            boxShadow: isLast
              ? '0 4px 20px rgba(201,146,10,0.4)'
              : '0 4px 20px rgba(26,107,92,0.4)',
            color: isLast ? '#0A0A0A' : 'white',
          }}
        >
          {isLast ? 'Start My First Scan' : 'Continue'}
        </motion.button>
      </div>
    </div>
  )
}
