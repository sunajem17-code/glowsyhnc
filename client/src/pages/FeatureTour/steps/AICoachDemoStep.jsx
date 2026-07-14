import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot } from 'lucide-react'
import useStore from '../../../store/useStore'
import { GOLD } from '../../../utils/theme'
import { AI_COACH_DEMO_QUESTIONS, getAICoachDemoAnswer, PILLAR_LABELS } from '../../../utils/tourDemoData'

// Cached responses only — no api.coach.message call. Per the API-abuse
// guardrail decision, this avoids spending real Claude API cost and, more
// importantly, avoids burning one of the user's real limited free-tier
// AI Coach messages on a tutorial demo before they've used the real thing.
// Still feels personalized: the answer interpolates the user's own already-
// loaded name/score/weakest-pillar from local state, computed client-side.
export default function AICoachDemoStep() {
  const { user, currentScan } = useStore()
  const [questionId, setQuestionId] = useState(null)
  const [typing, setTyping] = useState(false)

  const pillars = currentScan?.pillars
  const worstKey = pillars ? Object.entries(pillars).reduce((a, b) => (a[1] < b[1] ? a : b))[0] : null

  function ask(id) {
    setQuestionId(id)
    setTyping(true)
    setTimeout(() => setTyping(false), 900)
  }

  const answer = questionId
    ? getAICoachDemoAnswer(questionId, {
        name: user?.name,
        score: currentScan?.glowScore ?? currentScan?.umaxScore,
        weakestPillarLabel: worstKey ? PILLAR_LABELS[worstKey] : null,
      })
    : null

  return (
    <div className="h-full flex flex-col justify-center pb-6">
      <div className="text-center mb-4">
        <span className="font-heading font-bold text-[10px] tracking-[0.16em]" style={{ color: GOLD }}>AI COACH</span>
        <h2 className="font-heading font-bold text-[22px] leading-tight mt-1.5" style={{ color: '#F0EDE8', letterSpacing: '-0.01em' }}>
          Ask it anything, seriously
        </h2>
        <p className="font-body text-[13px] mt-1.5 max-w-[280px] mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Pick a sample question below — this one's cached, but the real coach reads your actual scan.
        </p>
      </div>

      <div className="max-w-[300px] w-full mx-auto flex flex-col gap-2 mb-4">
        {AI_COACH_DEMO_QUESTIONS.map(q => (
          <button
            key={q.id}
            onClick={() => ask(q.id)}
            className="px-4 py-3 rounded-xl text-left font-body text-[13px]"
            style={{
              background: questionId === q.id ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${questionId === q.id ? 'rgba(198,168,92,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: questionId === q.id ? GOLD : 'rgba(255,255,255,0.7)',
            }}
          >
            {q.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {typing && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-[300px] w-full mx-auto flex items-center gap-2.5 px-4 py-3.5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Bot size={16} style={{ color: GOLD }} />
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.4)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                />
              ))}
            </div>
          </motion.div>
        )}
        {!typing && answer && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[300px] w-full mx-auto flex items-start gap-2.5 px-4 py-3.5 rounded-2xl"
            style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.18)' }}
          >
            <Bot size={16} style={{ color: GOLD, marginTop: 2, flexShrink: 0 }} />
            <p className="font-body text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
