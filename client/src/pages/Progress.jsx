import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, RotateCcw } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

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
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}>
        <Sparkles size={14} style={{ color: GOLD }} />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.4)' }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
    </div>
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
      className="flex items-end gap-3 mb-4"
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}>
        <Sparkles size={14} style={{ color: GOLD }} />
      </div>
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`flex gap-3 mb-4 ${isAI ? 'items-end' : 'items-end flex-row-reverse'}`}
    >
      {isAI && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}>
          <Sparkles size={14} style={{ color: GOLD }} />
        </div>
      )}
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
  const navigate = useNavigate()
  const { scans, isPremium, userProfile } = useStore()
  const latestScan = scans?.[0] ?? null
  const scanContext = buildScanContext(latestScan, userProfile)

  const [messages, setMessages] = useState([])
  const [showTypewriter, setShowTypewriter] = useState(true)
  const [chipsVisible, setChipsVisible] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const isFirst = useRef(true)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showTypewriter])

  function reset() {
    triggerHaptic()
    setMessages([])
    setShowTypewriter(true)
    setChipsVisible(false)
    setInput('')
    isFirst.current = true
  }

  async function send(text) {
    const txt = (text || input).trim()
    if (!txt || loading) return
    if (!latestScan) { navigate('/scan'); return }
    if (!isPremium) { navigate('/unlock?paywall=1'); return }

    setInput('')
    setChipsVisible(false)
    isFirst.current = false

    const next = [...messages, { role: 'user', content: txt }]
    setMessages(next)
    setLoading(true)
    try {
      const data = await api.coach.message({
        messages: next.map(m => ({ role: m.role, content: m.content })),
        scanContext,
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
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
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: 14,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}>
            <Sparkles size={18} style={{ color: GOLD }} />
          </div>
          <h1 className="font-heading font-bold text-[18px] text-primary">AI Coach</h1>
        </div>
        {hasHistory && (
          <button
            onClick={reset}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <RotateCcw size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-2">

        {/* Typewriter greeting on first load */}
        {showTypewriter && !hasHistory && (
          <TypewriterBubble
            text="What do you need help with today?"
            onDone={() => setChipsVisible(true)}
          />
        )}

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && <TypingIndicator />}

        {/* Starter chips */}
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
                    boxShadow: `0 0 10px rgba(198,168,92,0.2), 0 0 20px rgba(198,168,92,0.08)`,
                  }}
                >
                  {chip}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Bottom — scan gate or input */}
      {!latestScan ? (
        <div className="flex-shrink-0 px-5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', paddingTop: 12 }}>
          <button
            onClick={() => { triggerHaptic(); navigate('/scan') }}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
          >
            Take a Scan to Unlock
          </button>
        </div>
      ) : (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 mx-4 mb-4 rounded-2xl"
          style={{
            marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
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
      )}

    </MotionPage>
  )
}
