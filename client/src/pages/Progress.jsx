import CoachMessage from '../components/CoachMessage'
import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { ADONIS_GREETING, getCoachChatSendState, getMessageEntryMotion, getScanRequiredMessages, waitForMinimumCoachThinking } from '../utils/coachChat'
import { scaleCoachHeaderSize } from '../utils/coachHeaderSizing'

const STARTER_PROMPTS = [
  "What's holding my score back the most?",
  'Give me a daily routine to look better',
  'What should I fix first to attract more?',
]

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
        className={`${isAI ? 'max-w-[92%] sm:max-w-[85%]' : 'max-w-[80%]'} min-w-0 px-4 py-3 text-[14px] font-body leading-relaxed`}
        style={isAI
          ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)', borderRadius: '18px 18px 18px 4px' }
          : { background: GOLD, color: '#0A0A0A', fontWeight: 600, borderRadius: '18px 18px 4px 18px' }}
      >
        {isAI ? <CoachMessage content={msg.content} reveal={msg.reveal === true} /> : msg.content}
      </div>
    </motion.div>
  )
}

export default function Progress() {
  const location = useLocation()
  const selectedScanId = location.state?.scanId

  const { scans, userProfile, user } = useStore()
  const latestScan = scans?.[0] ?? null
  const [serverScan, setServerScan] = useState(null)
  const conversationRef = useRef(null)
  const requestGenerationRef = useRef(0)
  const [messagesOwner, setMessagesOwner] = useState(null)

  const [messages, setMessages] = useState([])
  const [showTypewriter, setShowTypewriter] = useState(true)
  const [chipsVisible, setChipsVisible] = useState(false)
  const [input, setInput] = useState(location.state?.coachPrompt || '')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    let active = true
    requestGenerationRef.current += 1
    setLoading(false)
    setMessagesOwner(user?.id ?? null)
    setMessages([])
    setServerScan(null)
    conversationRef.current = null
    try {
      const saved = JSON.parse(sessionStorage.getItem(`adonis-chat:${user?.id}`) || 'null')
      if (saved?.conversationId && Array.isArray(saved.messages)) {
        conversationRef.current = saved.conversationId
        setMessages(saved.messages.slice(-12).map(message => ({ ...message, reveal: false })))
      }
    } catch {}
    api.coach.context().then(data => { if (active) setServerScan(data) }).catch(() => {
      if (active) setServerScan({ status: 'unavailable' })
    })
    return () => { active = false; requestGenerationRef.current += 1 }
  }, [user?.id, latestScan?.id])

  useEffect(() => {
    if (!user?.id || messagesOwner !== user.id || !conversationRef.current || !messages.length) return
    try { sessionStorage.setItem(`adonis-chat:${user.id}`, JSON.stringify({ conversationId: conversationRef.current, messages: messages.slice(-12) })) } catch {}
  }, [messages, user?.id, messagesOwner])

  useEffect(() => {
    const container = bottomRef.current?.closest('[data-coach-scroll]')
    if (container) {
      container.scrollTop = container.scrollHeight
      // Hidden app-shell ancestors must never scroll with a chat reply.
      const shell = container.closest('main')
      if (shell) shell.scrollTop = 0
    }
  }, [messages, loading, showTypewriter])

  async function send(text) {
    const txt = (text || input).trim()
    const sendState = getCoachChatSendState({ text: txt, hasScan: Boolean(latestScan || serverScan?.hasCompletedScan || serverScan?.status !== 'no_scan'), loading })
    if (sendState === 'ignore') return

    setInput('')
    setChipsVisible(false)
    const generation = requestGenerationRef.current

    if (sendState === 'needs-scan') {
      setShowTypewriter(false)
      const [userMessage, assistantMessage] = getScanRequiredMessages(txt)
      setMessages(prev => [...prev, userMessage])
      setLoading(true)
      const requestStartedAt = Date.now()
      await waitForMinimumCoachThinking(requestStartedAt)
      if (generation !== requestGenerationRef.current) return
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
        messages: [{ role: 'user', content: txt }],
        conversationId: conversationRef.current,
        ...(selectedScanId ? { scanId: selectedScanId } : {}),
        preferences: { goal: userProfile?.goal, goal_type: userProfile?.goal_type, improvement_focus: userProfile?.improvement_focus },
      })
      await waitForMinimumCoachThinking(requestStartedAt)
      if (generation !== requestGenerationRef.current) return
      conversationRef.current = data.conversationId
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, reveal: true }])
    } catch (err) {
      if (generation !== requestGenerationRef.current) return
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err.message || 'Something went wrong. Try again.',
      }])
    } finally {
      if (generation !== requestGenerationRef.current) return
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
              style={{ transform: `scale(${scaleCoachHeaderSize(1.19)})` }} />
          </div>
          <div className="translate-y-1">
            <h1 className="font-heading font-bold leading-tight text-primary" style={{ fontSize: `${scaleCoachHeaderSize(17)}px` }}>Adonis</h1>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div data-coach-scroll className="flex-1 overflow-y-auto px-4 pt-5 pb-2">

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
