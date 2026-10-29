import useCoachScroll from '../hooks/useCoachScroll'
import CoachAccessGate from '../components/CoachAccessGate'
import CoachMessage from '../components/CoachMessage'
import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Lock, ChevronRight, RotateCcw } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import MotionPage from '../components/MotionPage'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { UPGRADE_WELCOME } from '../utils/coachWelcome'
import { prepareCoachPhoto } from '../utils/coachPhoto'
import { scaleCoachHeaderSize } from '../utils/coachHeaderSizing'

const STARTER_PROMPTS = [
  "What's my #1 area to improve?",
  'Give me a morning routine for my skin score',
  'How do I improve my jawline?',
  'What workout should I focus on?',
]

const DEMO_TEASER = [
  { role: 'assistant', content: "Adonis can explain your completed scan and help you choose practical next steps.", locked: false },
  { role: 'user', content: 'What should I do about it?', locked: false },
  { role: 'assistant', content: 'Unlock AI Coach to get your personalized jawline protocol and full improvement plan.', locked: true },
]

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(198,168,92,0.15)', border: '1px solid rgba(198,168,92,0.25)' }}
      >
        <img src="/adonis-coach-gold.png" alt="Adonis" className="w-full h-full object-contain p-0.5" />
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
          <img src="/adonis-coach-gold.png" alt="Adonis" className="w-full h-full object-contain p-0.5" />
        </div>
      )}
      <div
        className={`px-4 py-3 rounded-2xl max-w-[78%] min-w-0 relative ${msg.locked ? 'select-none' : ''}`}
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
          className="font-body text-[14px] leading-snug"
          style={{
            color: msg.locked ? 'rgba(255,255,255,0.15)' : isUser ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.82)',
            filter: msg.locked ? 'blur(3px)' : 'none',
          }}
        >
          {msg.image && (
            <img src={msg.image} alt="Scan photo attached to your message"
              className="mb-2 max-h-56 w-full rounded-xl object-cover" style={{ maxWidth: 240 }} />
          )}
          {isUser ? msg.content : <div className="adonis-pineapple-message"><CoachMessage content={msg.content} reveal={msg.reveal === true} /></div>}
        </div>
      </div>
    </motion.div>
  )
}


export default function AICoach() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedScanId = location.state?.scanId
  const { scans, userProfile, user } = useStore()
  const latestScan = scans[0]
  const [serverScan, setServerScan] = useState(null)
  const isPremium = serverScan?.isPro === true
  const hasScan = !!latestScan || !!serverScan?.hasCompletedScan
  const conversationRef = useRef(null)
  const requestGenerationRef = useRef(0)
  const [messagesOwner, setMessagesOwner] = useState(null)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState(location.state?.coachPrompt || '')
  const [coachPhoto, setCoachPhoto] = useState(location.state?.coachPhotoUrl || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newMsgIdx, setNewMsgIdx] = useState(-1)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (location.state?.coachPrompt) setInput(location.state.coachPrompt)
    setCoachPhoto(location.state?.coachPhotoUrl || null)
  }, [location.key])

  // Server decides which completed scan belongs to this user. Local scan state
  // is used only for availability/navigation, never as trusted model context.
  useEffect(() => {
    let active = true
    requestGenerationRef.current += 1
    setLoading(false)
    setError('')
    setMessagesOwner(user?.id ?? null)
    setServerScan(null)
    setMessages([])
    conversationRef.current = null
    try {
      const saved = JSON.parse(sessionStorage.getItem(`adonis-chat:${user?.id}`) || 'null')
      if (saved?.conversationId && Array.isArray(saved.messages)) {
        conversationRef.current = saved.conversationId
        setMessages(saved.messages.slice(-12).map(message => ({ ...message, reveal: false })))
      }
    } catch { /* private browsing/storage unavailable */ }
    api.coach.context().then(data => { if (active) setServerScan(data) }).catch(() => { if (active) setServerScan({ status: 'unavailable' }) })
    return () => { active = false; requestGenerationRef.current += 1 }
  }, [user?.id, latestScan?.id])

  useEffect(() => {
    if (!user?.id || messagesOwner !== user.id || !conversationRef.current || !messages.length) return
    try {
      const savedMessages = messages.slice(-12).map(message => Object.fromEntries(
        Object.entries(message).filter(([key]) => key !== 'image'),
      ))
      sessionStorage.setItem(`adonis-chat:${user.id}`, JSON.stringify({ conversationId: conversationRef.current, messages: savedMessages }))
    } catch {}
  }, [messages, user?.id, messagesOwner])

  // Scroll to bottom on new message
  const followLatest = useCoachScroll(messagesEndRef, serverScan?.isPro === true, messages)


  // Initial greeting on mount
  useEffect(() => {
    if (messages.length > 0 || !hasScan || !isPremium) return
    const pending = useStore.getState().upgradeWelcomePending
    setMessages([{ role: 'assistant', content: pending ? UPGRADE_WELCOME : `What’s up bro!!! Welcome to Ascendus. I’m Adonis, your AI coach. What would you like to work on today?` }])
    if (pending) useStore.getState().setUpgradeWelcomePending(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, hasScan])

  async function sendMessage(text) {
    const msgText = (text || input).trim()
    if (!msgText || loading) return

    const includeScanPhoto = Boolean(coachPhoto || selectedScanId || /photo|image|look at|visually|what do you see/i.test(msgText))
    // No scan → redirect to scan
    if (!hasScan) { navigate('/scan'); return }

    // Not premium → open paywall immediately
    if (!serverScan?.isPro) { navigate('/unlock?paywall=1'); return }

    followLatest()
    setInput('')
    setError('')

    const generation = requestGenerationRef.current

    const userMsg = { role: 'user', content: msgText, ...(coachPhoto ? { image: coachPhoto } : {}) }
    const scanPhotoSource = coachPhoto
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setCoachPhoto(null)
    setNewMsgIdx(nextMessages.length - 1)
    setLoading(true)


    try {
      const scanPhotoData = await prepareCoachPhoto(scanPhotoSource).catch(() => null)
      const data = await api.coach.message({
        messages: [{ role: 'user', content: msgText }],
        conversationId: conversationRef.current,
        ...(selectedScanId ? { scanId: selectedScanId } : {}),
        includeScanPhoto,
        ...(scanPhotoData ? { scanPhotoData } : {}),
        preferences: { goal: userProfile?.goal, goal_type: userProfile?.goal_type, improvement_focus: userProfile?.improvement_focus },
      })
      if (generation !== requestGenerationRef.current) return
      conversationRef.current = data.conversationId
      const aiMsg = { role: 'assistant', content: data.message, reveal: true }
      setMessages(prev => {
        const updated = [...prev, aiMsg]
        setNewMsgIdx(updated.length - 1)
        return updated
      })
    } catch (err) {
      if (generation !== requestGenerationRef.current) return
      setError(err.message || "Couldn’t connect just now. Please try again.")
    } finally {
      if (generation !== requestGenerationRef.current) return
      setLoading(false)

    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!serverScan?.hasCompletedScan || serverScan?.isPro !== true) return <CoachAccessGate context={serverScan} />

  // ── Chat UI (both free and pro) ────────────────────────────────────────────
  return (
    <MotionPage baseClassName="" className="flex min-h-0 flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex items-center justify-center px-5 flex-shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          paddingBottom: 16,
          background: 'radial-gradient(ellipse at 50% 12%, rgba(209,183,109,0.07) 0%, rgba(209,183,109,0.025) 38%, transparent 76%)',
        }}
      >
        <div className="relative flex translate-y-[11px] flex-col items-center gap-[2px]">
          <div className="relative w-[72px] h-[64px] flex items-center justify-center">
            <div className="absolute w-[56px] h-[50px] blur-[8px]" style={{
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
        {messages.length > 1 && (
          <button
            onClick={() => {
              triggerHaptic()
              requestGenerationRef.current += 1
              setLoading(false)
              setError('')
              conversationRef.current = null
              try { sessionStorage.removeItem(`adonis-chat:${user?.id}`) } catch {}
              if (hasScan) {
                const greeting = isPremium
                  ? 'Your completed scan is available. Ask me what it found or what to work on.'
                  : 'Get Ascendus Max to unlock AI Coach.'
                setMessages([{ role: 'assistant', content: greeting }])
              } else {
                setMessages([])
              }
            }}
            className="absolute right-4 top-2 p-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)' }}
            aria-label="Restart chat"
          >
            <RotateCcw size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        )}
      </motion.div>

      {/* Messages */}
      <div data-coach-scroll className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 pt-4 pb-2">
        {messages.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="pt-4"
          >
            <p className="font-body text-[13px] text-secondary text-center mb-5">
              {latestScan && !isPremium ? 'Ask a question — Pro unlocks the answer' : 'Ask me anything about your appearance & routine'}
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

      {/* Input bar — disabled state if no scan */}
      {!hasScan ? (
        <div className="px-4 pb-8 pt-3 flex-shrink-0">
          <button
            onClick={() => { triggerHaptic(); navigate('/scan') }}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
          >
            Scan Your Face To Unlock
            <ChevronRight size={16} />
          </button>
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
            {coachPhoto && (
              <img src={coachPhoto} alt="Selected scan attached" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={coachPhoto ? 'Selected scan attached' : 'Ask Adonis anything…'} aria-label="Message Adonis"
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
