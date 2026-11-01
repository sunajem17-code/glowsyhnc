import { checkProStatus, isNative } from '../utils/iap'
import useCoachScroll from '../hooks/useCoachScroll'
import CoachMessage from '../components/CoachMessage'
import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Send } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { ADONIS_GREETING, getCoachChatSendState, getMessageEntryMotion, getScanRequiredMessages } from '../utils/coachChat'
import { scaleCoachHeaderSize } from '../utils/coachHeaderSizing'
import { prepareCoachPhoto } from '../utils/coachPhoto'
import { getCoachAccessMode, loadCoachAccess } from '../utils/coachAccess'

const STARTER_PROMPTS = [
  "What's holding my score back the most?",
  'Give me a daily routine to look better',
  'What should I fix first to attract more?',
]

function coachIntroKey(userId) {
  return `adonis-intro-seen:${userId}`
}

function persistCoachIntroSeen(userId) {
  if (!userId) return
  try {
    const key = coachIntroKey(userId)
    localStorage.setItem(key, 'true')
    sessionStorage.setItem(key, 'true')
  } catch {}
}

function getCoachIntroMode(userId) {
  if (!userId) return 'pending'

  const key = coachIntroKey(userId)
  try {
    const alreadySeen = localStorage.getItem(key) === 'true' || sessionStorage.getItem(key) === 'true'
    const savedConversation = JSON.parse(
      localStorage.getItem(`adonis-chat:${userId}`)
      || sessionStorage.getItem(`adonis-chat:${userId}`)
      || 'null',
    )
    const hasSavedMessages = Boolean(
      savedConversation?.conversationId
      && Array.isArray(savedConversation.messages)
      && savedConversation.messages.length,
    )

    // A saved thread is still being restored after the coach entitlement
    // check. Keep the welcome screen hidden during that gap so it cannot flash
    // over the returning conversation.
    if (hasSavedMessages) {
      return 'pending'
    }

    if (alreadySeen) {
      return 'seen'
    }

    return 'first'
  } catch {
    // If browser storage is unavailable, prefer a stable, non-replaying coach
    // over showing the intro again on every remount.
    return 'seen'
  }
}

function persistCoachMessages(userId, storageId, serverConversationId, accessMode, messages) {
  if (!userId || !storageId || !messages.length) return
  try {
    const savedMessages = messages.map(message => Object.fromEntries(
      Object.entries(message).filter(([key]) => key !== 'image'),
    ))
    const key = `adonis-chat:${userId}`
    const saved = JSON.stringify({
      storageId,
      conversationId: serverConversationId || storageId,
      serverConversationId: serverConversationId || null,
      accessMode,
      messages: savedMessages,
    })
    localStorage.setItem(key, saved)
    sessionStorage.setItem(key, saved)
  } catch {}
}

function photoForCoachMessage(message, scans) {
  if (message?.image) return message.image
  if (!message?.scanPhotoId) return null
  const scan = scans?.find(item => [item.id, item.serverScanId, item.aiScore?.scanId]
    .some(id => id != null && String(id) === String(message.scanPhotoId)))
  return scan?.facePhotoUrl || scan?.face_photo_url || scan?.face_image_url || null
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
        style={{ background: 'rgba(255,255,255,0.05)' }}>
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
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.95)', borderRadius: '18px 18px 18px 4px' }}>
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

function MessageBubble({ msg, onGetMax, scans }) {
  const isAI = msg.role === 'assistant'
  const image = photoForCoachMessage(msg, scans)
  const entryMotion = msg.paywall
    ? {
        initial: { opacity: 0, x: -8, y: 16, scale: 0.84 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        transition: { type: 'spring', stiffness: 460, damping: 25, mass: 0.7 },
      }
    : getMessageEntryMotion(msg.role)
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
          ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.95)', borderRadius: '18px 18px 18px 4px' }
          : { background: GOLD_GRADIENT, color: '#0A0A0A', fontWeight: 600, borderRadius: '18px 18px 4px 18px' }}
      >
        {image && (
          <img
            src={image}
            alt="Scan photo attached to your message"
            className="mb-2 max-h-56 w-full rounded-xl object-cover"
            style={{ maxWidth: 240 }}
          />
        )}
        {msg.paywall ? (
          <div>
            <p className="mb-3">{msg.content}</p>
            <button onClick={onGetMax} className="rounded-xl px-3 py-2 font-heading font-bold text-[12px]" style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}>
              Get Ascendus Max
            </button>
          </div>
        ) : isAI ? <CoachMessage content={msg.content} reveal={msg.reveal === true} /> : msg.content}
      </div>
    </motion.div>
  )
}

export default function Progress() {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedScanId = location.state?.scanId

  const { scans, userProfile, user, isLocalProPreview, isPremium: accountPremium } = useStore()
  const latestScan = scans?.[0] ?? null
  const selectedScan = selectedScanId
    ? scans?.find(scan => [scan.id, scan.serverScanId, scan.aiScore?.scanId].some(id => id != null && String(id) === String(selectedScanId)))
    : null
  const coachScan = selectedScan || latestScan
  const [introMode, setIntroMode] = useState(() => getCoachIntroMode(user?.id))
  const introOwnerRef = useRef(user?.id ?? null)
  const [serverScan, setServerScan] = useState(null)
  const conversationRef = useRef(null)
  const storageConversationRef = useRef(null)
  const requestGenerationRef = useRef(0)
  const [messagesOwner, setMessagesOwner] = useState(null)

  const [messages, setMessages] = useState([])
  const [showTypewriter, setShowTypewriter] = useState(() => introMode === 'first')
  const [chipsVisible, setChipsVisible] = useState(false)
  const [input, setInput] = useState(location.state?.coachPrompt || '')
  const [coachPhoto, setCoachPhoto] = useState(location.state?.coachPhotoUrl || null)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const coachAccessMode = getCoachAccessMode({
    isPremium: serverScan?.isPro === true,
    localPreviewEnabled: false,
  })

  useEffect(() => {
    if (!user?.id) return
    if (introOwnerRef.current === user.id) {
      // Keep render initializers pure; React Strict Mode may call them twice.
      // Persist the first visit after mount so remounts do not replay it.
      persistCoachIntroSeen(user.id)
      return
    }
    introOwnerRef.current = user.id
    const nextIntroMode = getCoachIntroMode(user.id)
    persistCoachIntroSeen(user.id)
    setIntroMode(nextIntroMode)
    setShowTypewriter(nextIntroMode === 'first')
    setChipsVisible(false)
  }, [user?.id])

  useEffect(() => {
    if (location.state?.coachPrompt) setInput(location.state.coachPrompt)
    setCoachPhoto(location.state?.coachPhotoUrl || null)
  }, [location.key])

  useEffect(() => {
    let active = true
    const restoreConversation = (verifiedPremium = false) => {
      if (!user?.id) return false
      try {
        const key = `adonis-chat:${user.id}`
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key) || 'null'
        const saved = JSON.parse(raw)
        if (saved?.conversationId && Array.isArray(saved.messages)) {
          storageConversationRef.current = saved.storageId || saved.conversationId
          conversationRef.current = saved.serverConversationId || (/^(?:local-preview:|adonis:)/.test(String(saved.conversationId)) ? null : saved.conversationId)
          setMessages(saved.messages.filter(message => !verifiedPremium || (!message.paywall && !/^Pro required — get Ascendus Max to unlock AI Coach\.$/.test(message.content || ''))).map(message => ({ ...message, reveal: false })))
          return true
        }
      } catch {}
      return false
    }
    requestGenerationRef.current += 1
    setLoading(false)
    setMessagesOwner(user?.id ?? null)
    setMessages([])
    setServerScan(null)
    conversationRef.current = null
    storageConversationRef.current = null
    loadCoachAccess({native:isNative(),userId:user?.id,claimedPremium:accountPremium,
      checkPurchase:checkProStatus,syncPurchase:id=>api.payments.syncRc(id),loadContext:()=>api.coach.context(),
    }).then(data => {
      if (!active) return
      setServerScan(data)
      // Server-backed replies require server entitlement. Local Pro Preview is
      // device-only and may restore its own locally generated conversation.
      if (data?.isPro === true) {
        const restored = restoreConversation(data?.isPro === true)
        if (!restored) setIntroMode(mode => mode === 'pending' ? 'seen' : mode)
      } else {
        setIntroMode(mode => mode === 'pending' ? 'seen' : mode)
      }
    }).catch(error => {
      if (active) {
        setServerScan({ status: 'unavailable', accessError: error?.message || 'Could not verify your subscription. Please retry.' })
        setMessages([{role:'assistant',content:error?.message || 'Could not verify your subscription. Please retry.'}])
        setIntroMode(mode => mode === 'pending' ? 'seen' : mode)
      }
    })
    return () => { active = false; requestGenerationRef.current += 1 }
  }, [user?.id, latestScan?.id, isLocalProPreview, accountPremium])

  useEffect(() => {
    if (messagesOwner !== user?.id) return
    persistCoachMessages(user?.id, storageConversationRef.current, conversationRef.current, coachAccessMode, messages)
  }, [messages, user?.id, messagesOwner, coachAccessMode])

  const followLatest = useCoachScroll(bottomRef, serverScan?.isPro === true, messages)


  async function send(text) {
    const txt = (text || input).trim()
    if (serverScan === null) return
    if (serverScan.status === 'unavailable') {
      setMessages(previous => [...previous, {role:'assistant',content:serverScan.accessError || 'Could not verify coach access. Reopen this tab to retry.'}])
      return
    }
    const sendState = getCoachChatSendState({ text: txt, hasScan: Boolean(latestScan || serverScan?.hasCompletedScan || serverScan?.status !== 'no_scan'), loading })
    if (sendState === 'ignore') return
    if (user?.id && !storageConversationRef.current) {
      storageConversationRef.current = `adonis:${user.id}:${Date.now()}`
    }

    const includeScanPhoto = Boolean(coachPhoto || selectedScanId || /photo|image|look at|visually|what do you see/i.test(txt))
    const selectedScanPhotoId = selectedScanId || coachScan?.serverScanId || coachScan?.aiScore?.scanId || coachScan?.id || null
    followLatest()
    setInput('')
    setChipsVisible(false)
    const generation = requestGenerationRef.current

    if (sendState === 'needs-scan') {
      setShowTypewriter(false)
      const [userMessage, assistantMessage] = getScanRequiredMessages(txt)
      setMessages(prev => [...prev, userMessage])
      persistCoachMessages(user?.id, storageConversationRef.current, conversationRef.current, coachAccessMode, [...messages, userMessage])
      setLoading(true)
        if (generation !== requestGenerationRef.current) return
      setMessages(prev => [...prev, assistantMessage])
      setLoading(false)

      return
    }

    // Server-backed replies remain protected by the server's entitlement check.
    if (coachAccessMode === 'paywall') {
      setShowTypewriter(false)
      const userMessage = { role: 'user', content: txt, ...(coachPhoto ? { image: coachPhoto, ...(selectedScanPhotoId ? { scanPhotoId: selectedScanPhotoId } : {}) } : {}) }
      setMessages(prev => [...prev, userMessage])
      persistCoachMessages(user?.id, storageConversationRef.current, null, coachAccessMode, [...messages, userMessage])
      setCoachPhoto(null)
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 1800))
      if (generation !== requestGenerationRef.current) return
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Your answer is ready. Get Ascendus Max to unlock Adonis’s personalized reply.',
        paywall: true,
      }])
      setLoading(false)
      return
    }

    const userMessage = { role: 'user', content: txt, ...(coachPhoto ? { image: coachPhoto, ...(selectedScanPhotoId ? { scanPhotoId: selectedScanPhotoId } : {}) } : {}) }
    const next = [...messages, userMessage]
    const scanPhotoSource = coachPhoto
    setMessages(next)
    persistCoachMessages(user?.id, storageConversationRef.current, conversationRef.current, coachAccessMode, next)
    setCoachPhoto(null)
    setLoading(true)
    try {
      const scanPhotoData = await prepareCoachPhoto(scanPhotoSource).catch(() => null)
      const data = await api.coach.message({
        messages: [{ role: 'user', content: txt }],
        conversationId: conversationRef.current,
        ...((selectedScanId || coachScan?.serverScanId || coachScan?.aiScore?.scanId)
          ? { scanId: selectedScanId || coachScan.serverScanId || coachScan.aiScore.scanId }
          : {}),
        includeScanPhoto,
        ...(scanPhotoData ? { scanPhotoData } : {}),
        preferences: { goal: userProfile?.goal, goal_type: userProfile?.goal_type, improvement_focus: userProfile?.improvement_focus },
      })
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

    }
  }

  const hasHistory = messages.length > 0

  return (
    <MotionPage baseClassName="" className="flex min-h-0 flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

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
      <div data-coach-scroll className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 pt-5 pb-2">

        {/* Animate the greeting only on the first visit. Returning to an empty
            chat keeps the same welcome content without replaying the intro. */}
        {!hasHistory && introMode === 'first' && showTypewriter && (
          <TypewriterBubble text={ADONIS_GREETING} onDone={() => setChipsVisible(true)} />
        )}
        {!hasHistory && introMode === 'seen' && (
          <div className="flex items-end mb-4">
            <div
              className="max-w-[80%] px-4 py-3 text-[14px] font-body leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.95)', borderRadius: '18px 18px 18px 4px' }}
            >
              {ADONIS_GREETING}
            </div>
          </div>
        )}

        {/* Starter prompts sit directly beneath Adonis's opening message. */}
        <AnimatePresence>
          {(introMode === 'first' && chipsVisible || introMode === 'seen') && !loading && !hasHistory && (
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
                  disabled={serverScan === null}
                  className="text-[13px] font-body px-4 py-2 rounded-2xl"
                  style={{
                    background: 'rgba(198,168,92,0.08)',
                    color: 'rgba(255,255,255,0.85)',
                    border: `1px solid ${GOLD}66`,
                    boxShadow: '0 0 10px rgba(198,168,92,0.35), 0 0 20px rgba(198,168,92,0.18)',
                    opacity: serverScan === null ? 0.55 : 1,
                  }}
                >
                  {chip}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} scans={scans} onGetMax={() => navigate('/unlock?paywall=1')} />)}
        {loading && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Keep the composer visible after the upgrade prompt so users can ask another question. */}
      <div className="flex-shrink-0 px-4 pb-3" style={{ paddingBottom: 'calc(var(--coach-bottom-inset, env(safe-area-inset-bottom, 0px)) + 12px)' }}>
        <div
          className="flex items-center gap-3 px-4 rounded-2xl"
          style={{
            paddingTop: 12,
            paddingBottom: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {coachPhoto && (
              <img src={coachPhoto} alt="Scan photo attached" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={serverScan === null ? 'Adonis is ready…' : coachPhoto ? 'Scan photo attached' : 'Ask anything…'}
              className="min-w-0 flex-1 bg-transparent text-[16px] font-body text-primary placeholder:text-white/50 outline-none focus:outline-none focus:ring-0"
              style={{ color: 'rgba(255,255,255,0.9)' }}
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => { triggerHaptic(); send() }}
            aria-label={loading ? "Sending message" : "Send message"}
            onPointerDown={event => event.preventDefault()}
            disabled={!input.trim() || loading || serverScan === null}
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
