import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Lock, RotateCcw } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const FREE_LIMIT = 3

const STARTER_PROMPTS = [
  "What's my #1 area to improve?",
  'How do I improve my jawline?',
  'Give me a morning skincare routine',
  'What does my score mean?',
  'How do I get to a 7+?',
  'What should I focus on first?',
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
    <div className="flex items-end gap-2 mb-4">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}>
        <Sparkles size={14} style={{ color: GOLD }} />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
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
      <p key={i} className={i > 0 ? 'mt-2' : ''}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    )
  })
}

function MessageBubble({ msg }) {
  const isAI = msg.role === 'assistant'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2 mb-4 ${isAI ? 'items-start' : 'items-end flex-row-reverse'}`}
    >
      {isAI && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}>
          <Sparkles size={14} style={{ color: GOLD }} />
        </div>
      )}
      <div
        className="max-w-[80%] px-4 py-3 text-[14px] font-body leading-relaxed"
        style={isAI
          ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)', borderRadius: '18px 18px 18px 4px' }
          : { background: GOLD, color: '#0A0A0A', fontWeight: 600, borderRadius: '18px 18px 4px 18px' }}
      >
        {isAI ? formatMessage(msg.content) : msg.content}
      </div>
    </motion.div>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const { scans, isPremium, userProfile, freeCoachMessages, incrementFreeCoachMessages } = useStore()
  const latestScan = scans?.[0] ?? null
  const scanContext = buildScanContext(latestScan, userProfile)

  const freeLeft = isPremium ? Infinity : Math.max(0, FREE_LIMIT - (freeCoachMessages ?? 0))
  const locked = !isPremium && freeLeft <= 0

  const greeting = latestScan
    ? `Score loaded: **${latestScan.glowScore?.toFixed(1) ?? '—'}/10**. Ask me anything — I'll tell you exactly what to work on.`
    : `No scan yet. Run a scan first and I can give you personalised advice based on your actual results.`

  const [messages, setMessages] = useState([{ role: 'assistant', content: greeting }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chipsVisible, setChipsVisible] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const txt = (text || input).trim()
    if (!txt || loading || locked) return
    setInput('')
    setChipsVisible(false)
    if (!isPremium) incrementFreeCoachMessages?.()

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

  function reset() {
    triggerHaptic()
    setMessages([{ role: 'assistant', content: greeting }])
    setChipsVisible(true)
  }

  return (
    <MotionPage baseClassName="" className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          paddingBottom: 12,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}>
            <Sparkles size={18} style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="font-heading font-bold text-[18px] text-primary leading-tight">AI Coach</h1>
            {!isPremium && freeLeft < Infinity && (
              <p className="text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {freeLeft > 0 ? `${freeLeft} free message${freeLeft !== 1 ? 's' : ''} left` : 'Upgrade to keep chatting'}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={reset}
          className="w-8 h-8 flex items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <RotateCcw size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {loading && <TypingIndicator />}

        {/* Starter chips */}
        <AnimatePresence>
          {chipsVisible && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 pb-4"
            >
              {STARTER_PROMPTS.map(chip => (
                <button
                  key={chip}
                  onClick={() => { triggerHaptic(); send(chip) }}
                  disabled={locked}
                  className="text-[12px] font-body px-3 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {chip}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input / paywall */}
      {locked ? (
        <div className="flex-shrink-0 px-4 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
          <button
            onClick={() => { triggerHaptic(); navigate('/premium') }}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
          >
            <Lock size={15} /> Unlock Unlimited Coaching
          </button>
        </div>
      ) : (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4"
          style={{
            paddingTop: 10,
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask your coach…"
            className="flex-1 bg-transparent text-[14px] font-body text-primary outline-none placeholder:text-white/30"
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => { triggerHaptic(); send() }}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: input.trim() && !loading ? GOLD : 'rgba(255,255,255,0.08)',
              transition: 'background 0.2s',
            }}
          >
            <Send size={15} style={{ color: input.trim() && !loading ? '#0A0A0A' : 'rgba(255,255,255,0.3)' }} />
          </motion.button>
        </div>
      )}
    </MotionPage>
  )
}
