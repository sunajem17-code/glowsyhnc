import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

const GOLD = '#C6A85C'
const BG = '#080808'

// Shown once, right after a first-time user finishes onboarding (signup,
// consent, gender/goal, scan) and the Feature Tour — the last screen before
// they land in the app for real. Positioned here instead of pre-signup so
// it lands after the user already has skin in the game, not as a cold-open
// scare tactic. Gated in App.jsx alongside JUST_ONBOARDED_KEY the same way
// the Feature Tour is, so existing users never see it retroactively.
//
// Content note: no line implying the user invites bullying by not
// looksmaxxing (that's a threat, not a real cost, and cuts against
// Ascendus's "not toxic like the competition" positioning), and no line
// about "height potential" (adult height doesn't change, looksmaxxing or
// not, so that claim would just be false).
const WARNINGS = [
  'Your dating pool stays small. Looks are one of the first filters people swipe on, whether that’s fair or not.',
  'The halo effect keeps working against you. Every interview, every first meeting, people read your face before you say a word.',
  'Your bone structure keeps setting. Mewing and jaw work get harder to influence with every year that passes. The window doesn’t stay open forever.',
  'The confidence spiral keeps spinning. Get overlooked, feel it, act smaller, get overlooked again.',
  'People judge first and ask questions later. First impressions rarely get a second shot.',
  'That negative headspace sticks around too. It’s hard to feel good about yourself when you’re not even trying to fix what you can.',
  'Bad posture keeps costing you presence you could actually get back.',
  'You stay average while the guys actually mogging keep pulling further ahead.',
  'Five years from now, you’ll wish today was the day you started.',
]

export default function CostOfInactionScreen({ onDone }) {
  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: BG }}>
      {/* Header progress — gold gradient slider, full width. This is the
          last onboarding screen, so the bar reads as "done" rather than
          tracking a position within a multi-step sequence. */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 z-20"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <motion.div
          className="h-full"
          initial={{ width: '85%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: `linear-gradient(90deg, #A8893A, ${GOLD}, #D4B96A)` }}
        />
      </div>

      <div className="flex-1 flex flex-col pt-20 pb-4 overflow-hidden">
        <h1
          className="font-heading font-bold text-center mb-6 px-6 flex-shrink-0"
          style={{ fontSize: 26, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#F0EDE8' }}
        >
          What Happens If You<br />Never Looksmax
        </h1>
        <div className="flex-1 overflow-y-auto px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex flex-col gap-3 pb-2">
            {WARNINGS.map((text, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
                style={{ background: 'rgba(224,60,60,0.06)', border: '0.5px solid rgba(224,60,60,0.22)' }}
              >
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" style={{ color: '#E05555' }} />
                <p className="font-body text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.8)' }}>{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-12 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onDone}
          className="w-full py-4 font-heading font-bold text-[15px]"
          style={{
            background: `linear-gradient(135deg, #D4B96A 0%, ${GOLD} 50%, #A8893A 100%)`,
            color: '#000000',
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(198,168,92,0.3)',
            letterSpacing: '0.02em',
          }}
        >
          Continue
        </motion.button>
      </div>
    </div>
  )
}
