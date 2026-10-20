import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { ADONIS_GREETING, getCoachChatSendState, getMessageEntryMotion, getScanRequiredMessages, waitForMinimumCoachThinking } from '../utils/coachChat'

const STARTER_PROMPTS = [
  "What's holding my score back the most?",
  'Give me a daily routine to look better',
  'What should I fix first to attract more?',
]

function buildScanContext(scan, userProfile) {
  if (!scan) return null
  return {
    glowScore: scan.glowScore,
    faceScore: scan.faceScore,
    presentationScore: scan.presentationScore,
    faceData: scan.faceData,
    userProfile,
  }
}

function TypingIndicator() {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 420, damping: 28 }}
      className="flex items-end mb-4 origin-bottom-left"
    >
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.4)' }}
            animate={reduceMotion ? { opacity: [0.5, 1, 0.5] } : { opacity: [0.45, 1, 0.45], y: [0, -5, 0] }}
            transition={{ duration: 0.72, ease: 'easeInOut', repeat: Infinity, delay: i * 0.14 }}
          />
        ))}
      </div>
    </motion.div>
  )
}

function formatMessage(content) {
  return content.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return (
      <p key={i} className={i > 0 && line.trim() ? 'mt-2' : ''}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} style={{ color: 'rgba(255,255,255,0.95)' }}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    )
  })
}

// Animated typing bubble — streams the text character by character
function TypewriterBubble({ text, onDone }) {
  const [displayed, setDisplayed] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const idx = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      if (idx.current < text.length) {
        setDisplayed(text.slice(0, idx.current + 1))
        idx.current++
      } else {
        clearInterval(interval)
        setShowCursor(false)
        onDone?.()
      }
    }, 22)
    return () => clearInterval(interval)
  }, [text])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-end mb-4"
    >
      <div className="max-w-[80%] px-4 py-3 text-[14px] font-body leading-relaxed"
        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', borderRadius: '18px 18px 18px 4px' }}>
        {displayed}
        {showCursor && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            style={{ color: GOLD, marginLeft: 1 }}
          >|</motion.span>
        )}
      </div>
    </motion.div>
  )
}

function MessageBubble({ msg }) {
  const isAI = msg.role === 'assistant'
  const entryMotion = getMessageEntryMotion(msg.role)
  return (
    <motion.div
      initial={entryMotion.initial}
      animate={entryMotion.animate}
      transition={entryMotion.transition}
      className={`flex mb-4 ${isAI ? 'items-end' : 'items-end flex-row-reverse'}`}
    >
      <div
        className="max-w-[80%] px-4 py-3 text-[14px] font-body leading-relaxed"
        style={isAI
          ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', borderRadius: '18px 18px 18px 4px' }
          : { background: GOLD, color: '#0A0A0A', fontWeight: 600, borderRadius: '18px 18px 4px 18px' }}
      >
        {isAI ? formatMessage(msg.content) : msg.content}
      </div>
    </motion.div>
  )
}

export default function Progress() {
  const { scans, userProfile } = useStore()
  const latestScan = scans?.[0] ?? null
  const scanContext = buildScanContext(latestScan, userProfile)

  const [messages, setMessages] = useState([])
  const [showTypewriter, setShowTypewriter] = useState(true)
  const [chipsVisible, setChipsVisible] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showTypewriter])

  async function send(text) {
    const txt = (text || input).trim()
    const sendState = getCoachChatSendState({ text: txt, hasScan: Boolean(latestScan), loading })
    if (sendState === 'ignore') return

    setInput('')
    setChipsVisible(false)

    if (sendState === 'needs-scan') {
      setShowTypewriter(false)
      const [userMessage, assistantMessage] = getScanRequiredMessages(txt)
      setMessages(prev => [...prev, userMessage])
      setLoading(true)
      const requestStartedAt = Date.now()
      await waitForMinimumCoachThinking(requestStartedAt)
      setMessages(prev => [...prev, assistantMessage])
      setLoading(false)
      inputRef.current?.focus()
      return
    }

    const next = [...messages, { role: 'user', content: txt }]
    setMessages(next)
    setLoading(true)
    const requestStartedAt = Date.now()
    try {
      const data = await api.coach.message({
        messages: next.map(m => ({ role: m.role, content: m.content })),
        scanContext,
      })
      await waitForMinimumCoachThinking(requestStartedAt)
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.message || 'Something went wrong. Try again.',
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const hasHistory = messages.length > 0

  return (
    <MotionPage baseClassName="" className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div
        className="relative flex items-center justify-center px-5 flex-shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          paddingBottom: 16,
          background: 'radial-gradient(ellipse at 50% 12%, rgba(209,183,109,0.07) 0%, rgba(209,183,109,0.025) 38%, transparent 76%)',
        }}
      >
        <div className="relative flex translate-y-[11px] flex-col items-center gap-[2px]">
          <div className="relative w-[72px] h-[64px] flex items-center justify-center">
            <div className="absolute w-[56px] h-[50px] blur-[8px]"
              style={{
                borderRadius: '46% 54% 52% 48% / 57% 45% 55% 43%',
                background: 'radial-gradient(ellipse at 48% 45%, rgba(226,197,119,0.32) 0%, rgba(209,183,109,0.16) 52%, transparent 78%)',
                boxShadow: '0 0 24px rgba(209,183,109,0.2)',
              }} />
            <img src="/adonis-coach-gold.png?v=transparent" alt="Adonis" className="relative w-full h-full object-contain"
              style={{ transform: 'scale(1.19)' }} />
          </div>
          <div className="translate-y-1">
            <h1 className="font-heading font-bold text-[17px] leading-tight text-primary">Adonis</h1>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-2">

        {/* Typewriter greeting on first load */}
        {showTypewriter && !hasHistory && (
          <TypewriterBubble
            text={ADONIS_GREETING}
            onDone={() => setChipsVisible(true)}
          />
        )}

        {/* Starter prompts sit directly beneath Adonis's opening message. */}
        <AnimatePresence>
          {chipsVisible && !loading && !hasHistory && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-wrap gap-2 mt-1 pb-4"
            >
              {STARTER_PROMPTS.map((chip, i) => (
                <motion.button
                  key={chip}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  onClick={() => { triggerHaptic(); send(chip) }}
                  className="text-[13px] font-body px-4 py-2 rounded-2xl"
                  style={{
                    background: 'rgba(198,168,92,0.08)',
                    color: 'rgba(255,255,255,0.85)',
                    border: `1px solid ${GOLD}66`,
                    boxShadow: '0 0 10px rgba(198,168,92,0.35), 0 0 20px rgba(198,168,92,0.18)',
                  }}
                >
                  {chip}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Composer stays available; a scan is required before a message can be sent. */}
      <div className="flex-shrink-0 px-4 pb-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        <div
          className="flex items-center gap-3 px-4 rounded-2xl"
          style={{
            paddingTop: 12,
            paddingBottom: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask anything…"
            className="flex-1 bg-transparent text-[14px] font-body text-primary outline-none"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          />
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => { triggerHaptic(); send() }}
            aria-label="Send message"
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: input.trim() && !loading ? GOLD : 'rgba(255,255,255,0.08)',
              transition: 'background 0.2s',
            }}
          >
            <Send size={14} style={{ color: input.trim() && !loading ? '#0A0A0A' : 'rgba(255,255,255,0.3)' }} />
          </motion.button>
        </div>

      </div>

    </MotionPage>
  )
}
