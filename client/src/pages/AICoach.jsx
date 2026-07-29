import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Lock, ChevronRight, RotateCcw, Check } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import MotionPage from '../components/MotionPage'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const STARTER_PROMPTS = [
  "What's my #1 area to improve?",
  'Give me a morning routine for my skin score',
  'How do I improve my jawline?',
  'What workout should I focus on?',
]

const DEMO_TEASER = [
  { role: 'assistant', content: "Your scan is loaded. Your biggest growth opportunity is jawline definition. Targeting this is your fastest path to 7+.", locked: false },
  { role: 'user', content: 'What should I do about it?', locked: false },
  { role: 'assistant', content: 'Unlock AI Coach to get your personalized jawline protocol and full improvement plan.', locked: true },
]

function buildScanContext(latestScan, userProfile) {
  if (!latestScan) return null
  return {
    glowScore: latestScan.glowScore,
    faceScore: latestScan.faceScore,
    presentationScore: latestScan.presentationScore,
    faceData: latestScan.faceData,
    presentationData: latestScan.presentationData,
    userProfile,
  }
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(198,168,92,0.15)', border: '1px solid rgba(198,168,92,0.25)' }}
      >
        <Sparkles size={13} style={{ color: GOLD }} />
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.35)' }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Renders coach responses with bold headers and line breaks
function formatMessage(content) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />
    // **bold** or __bold__
    const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
    const rendered = parts.map((part, j) => {
      if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
        const text = part.replace(/^\*\*|\*\*$|^__|__$/g, '')
        return <span key={j} className="font-heading font-bold" style={{ color: 'rgba(255,255,255,0.95)' }}>{text}</span>
      }
      return <span key={j}>{part}</span>
    })
    return <div key={i} className="leading-snug mb-1.5">{rendered}</div>
  })
}

function MessageBubble({ msg, isNew }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_STANDARD }}
      className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
          style={{ background: 'rgba(198,168,92,0.15)', border: '1px solid rgba(198,168,92,0.25)' }}
        >
          <Sparkles size={13} style={{ color: GOLD }} />
        </div>
      )}
      <div
        className={`px-4 py-3 rounded-2xl max-w-[78%] relative ${msg.locked ? 'select-none' : ''}`}
        style={isUser ? {
          background: `linear-gradient(135deg, ${GOLD}22 0%, ${GOLD}14 100%)`,
          border: `1px solid ${GOLD}30`,
          borderBottomRightRadius: 4,
        } : {
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottomLeftRadius: 4,
        }}
      >
        {msg.locked && (
          <div
            className="absolute inset-0 rounded-2xl flex items-center justify-center gap-1.5"
            style={{
              background: 'rgba(10,10,10,0.75)',
              backdropFilter: 'blur(4px)',
              borderRadius: 'inherit',
            }}
          >
            <Lock size={12} style={{ color: GOLD }} />
            <span className="font-body text-[11px]" style={{ color: GOLD }}>Pro only</span>
          </div>
        )}
        <div
          className="font-body text-[14px]"
          style={{
            color: msg.locked ? 'rgba(255,255,255,0.15)' : isUser ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.82)',
            filter: msg.locked ? 'blur(3px)' : 'none',
          }}
        >
          {isUser ? msg.content : formatMessage(msg.content)}
        </div>
      </div>
    </motion.div>
  )
}

const FREE_COACH_LIMIT = 7

export default function AICoach() {
  const navigate = useNavigate()
  const { scans, isPremium, userProfile, freeCoachMessages, incrementFreeCoachMessages } = useStore()
  const latestScan = scans[0]
  const scanContext = buildScanContext(latestScan, userProfile)

  const freeMessagesLeft = isPremium ? Infinity : Math.max(0, FREE_COACH_LIMIT - (freeCoachMessages ?? 0))
  const freeCoachLocked  = !isPremium && freeMessagesLeft <= 0

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newMsgIdx, setNewMsgIdx] = useState(-1)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Initial greeting on mount
  useEffect(() => {
    if (messages.length > 0) return
    if (latestScan) {
      const greeting = isPremium
        ? `Scan loaded. You're a ${latestScan.glowScore?.toFixed(1)}/10 overall. Ask me anything. I'll tell you exactly what to work on.`
        : `Scan loaded. You have ${freeMessagesLeft} free question${freeMessagesLeft !== 1 ? 's' : ''}. Make them count. Ask me anything.`
      setMessages([{ role: 'assistant', content: greeting }])
    } else if (isPremium) {
      setMessages([{ role: 'assistant', content: 'No scan data yet. Run a scan first, then I can give you personalized advice.' }])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, latestScan])

  async function sendMessage(text) {
    const msgText = (text || input).trim()
    if (!msgText || loading || freeCoachLocked) return
    setInput('')
    setError('')

    // Increment free usage counter before sending
    if (!isPremium) incrementFreeCoachMessages()

    const userMsg = { role: 'user', content: msgText }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setNewMsgIdx(nextMessages.length - 1)
    setLoading(true)

    try {
      const data = await api.coach.message({
        messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        scanContext,
      })
      const aiMsg = { role: 'assistant', content: data.message }
      setMessages(prev => {
        const updated = [...prev, aiMsg]
        setNewMsgIdx(updated.length - 1)
        return updated
      })
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Chat UI (both free and pro) ────────────────────────────────────────────
  return (
    <MotionPage baseClassName="" className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 pb-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}
          >
            <Sparkles size={18} style={{ color: GOLD }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-bold text-[18px] text-primary">AI Coach</h1>
              <span
                className="text-[9px] font-bold font-body px-1.5 py-0.5 rounded"
                style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}30` }}
              >
                {isPremium ? 'PRO' : 'FREE'}
              </span>
            </div>
            <p className="font-body text-[11px] text-secondary">
              {isPremium
                ? (latestScan ? `Score ${latestScan.glowScore?.toFixed(1)}/10 loaded` : 'No scan yet')
                : freeCoachLocked
                  ? 'Free limit reached: upgrade for unlimited'
                  : `${freeMessagesLeft} free question${freeMessagesLeft !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        </div>
        {messages.length > 1 && !freeCoachLocked && (
          <button
            onClick={() => {
              triggerHaptic()
              if (latestScan) {
                const greeting = isPremium
                  ? `Scan loaded. You're a ${latestScan.glowScore?.toFixed(1)}/10 overall. Ask me anything. I'll tell you exactly what to work on.`
                  : `Scan loaded. You have ${freeMessagesLeft} free question${freeMessagesLeft !== 1 ? 's' : ''}. Make them count. Ask me anything.`
                setMessages([{ role: 'assistant', content: greeting }])
              } else {
                setMessages([])
              }
            }}
            className="p-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <RotateCcw size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        )}
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {/* Citations / Medical Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4"
          style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.22)' }}
        >
          <span className="text-[12px] flex-shrink-0 mt-0.5" style={{ color: GOLD }}>ℹ</span>
          <p className="font-body text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            For informational purposes only, not medical advice. Sources:{' '}
            <a href="https://www.healthline.com/nutrition/12-ways-to-look-younger" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: 'underline' }}>Healthline</a>
            ,{' '}
            <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3583892/" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: 'underline' }}>NIH</a>
            ,{' '}
            <a href="https://www.aad.org/public/everyday-care/skin-care-basics" target="_blank" rel="noopener noreferrer" style={{ color: GOLD, textDecoration: 'underline' }}>AAD</a>
            . Consult a qualified professional before making any health decisions.
          </p>
        </motion.div>

        {/* Free usage counter banner */}
        {!isPremium && !freeCoachLocked && freeMessagesLeft <= FREE_COACH_LIMIT && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}25` }}
          >
            <div className="flex gap-1">
              {Array.from({ length: FREE_COACH_LIMIT }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: i < freeMessagesLeft ? GOLD : 'rgba(255,255,255,0.15)' }}
                />
              ))}
            </div>
            <p className="font-body text-[11px] flex-1" style={{ color: `${GOLD}CC` }}>
              {freeMessagesLeft} of {FREE_COACH_LIMIT} free questions left
            </p>
            <button
              onClick={() => { triggerHaptic(); navigate('/premium') }}
              className="text-[10px] font-heading font-bold px-2 py-1 rounded-lg"
              style={{ background: GOLD, color: '#0A0A0A' }}
            >
              Go Pro
            </button>
          </motion.div>
        )}

        {messages.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="pt-4"
          >
            <p className="font-body text-[13px] text-secondary text-center mb-5">
              Ask me anything about your appearance & routine
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STARTER_PROMPTS.map((prompt, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  onClick={() => { triggerHaptic(); sendMessage(prompt) }}
                  className="text-left px-3 py-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <p className="font-body text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {prompt}
                  </p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} isNew={i === newMsgIdx} />
        ))}

        {loading && <TypingIndicator />}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center font-body text-[12px] mb-3"
              style={{ color: '#EF4444' }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar — or paywall when free limit reached */}
      {freeCoachLocked ? (
        <div className="px-4 pb-8 pt-3 flex-shrink-0">
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'linear-gradient(135deg, rgba(198,168,92,0.1) 0%, rgba(198,168,92,0.04) 100%)',
              border: '1px solid rgba(198,168,92,0.22)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <Lock size={15} style={{ color: GOLD }} />
              <p className="font-heading font-bold text-[14px]" style={{ color: GOLD }}>
                Upgrade for unlimited answers
              </p>
            </div>
            <ul className="space-y-1 mb-3">
              {[
                'Unlimited chat: no tokens, no limits',
                'Personalized protocols from your scan',
                'Updated with every new scan',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check size={11} style={{ color: GOLD, marginTop: 2, flexShrink: 0 }} />
                  <span className="font-body text-[12px] text-secondary">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => { triggerHaptic(); navigate('/premium') }}
              className="w-full py-3 rounded-xl font-heading font-bold text-[13px] flex items-center justify-center gap-2"
              style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
            >
              Upgrade to Pro
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="px-4 py-3 flex-shrink-0"
          style={{
            background: 'var(--card)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          }}
        >
          <div
            className="flex items-end gap-2 px-4 py-2.5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your coach…"
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none font-body text-[14px]"
              style={{
                color: 'rgba(255,255,255,0.9)',
                maxHeight: 100,
                lineHeight: '1.5',
              }}
            />
            <button
              onClick={() => { if (input.trim() && !loading) triggerHaptic(); sendMessage() }}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: input.trim() && !loading
                  ? `linear-gradient(135deg, ${GOLD} 0%, #A8893A 100%)`
                  : 'rgba(255,255,255,0.06)',
              }}
            >
              <Send size={14} style={{ color: input.trim() && !loading ? '#0A0A0A' : 'rgba(255,255,255,0.25)' }} />
            </button>
          </div>
        </div>
      )}
    </MotionPage>
  )
}
