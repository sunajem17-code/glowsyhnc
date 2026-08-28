import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useAnimation, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { purchasePro, restorePurchases } from '../utils/iap'
import useStore from '../store/useStore'
import { triggerHaptic } from '../utils/haptics'
import { useNavigate } from 'react-router-dom'

const GOLD = '#C6A85C'
const BG = '#080808'
const SURFACE = 'rgba(255,255,255,0.04)'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.45)'

const CARD_TITLES = [
  'Get your ratings',
  'Learn about yourself',
  'Improvement coach',
  'Start improving',
]

const SEGMENT_DURATION = 3500

// ── Card 0: Metric Tiles ──────────────────────────────────────────────────────

const SCORE_COLORS = ['#F59E0B', '#10B981', '#F59E0B', '#10B981', '#F59E0B', '#84CC16']

function MetricTile({ label, value, colorIdx = 0 }) {
  const barColor = SCORE_COLORS[colorIdx % SCORE_COLORS.length]
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '14px 14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 10, color: DIM, textTransform: 'capitalize', fontFamily: 'var(--font-body, inherit)' }}>
        {label}
      </span>
      <span style={{ fontSize: 30, fontWeight: 800, color: TEXT, fontFamily: 'var(--font-heading, inherit)', lineHeight: 1 }}>
        {value}
      </span>
      <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: barColor, borderRadius: 99 }} />
      </div>
    </div>
  )
}

function Card0({ scan }) {
  const tiles = [
    { label: 'Overall', value: scan?.umaxScore ?? 68 },
    { label: 'Potential', value: 91 },
    { label: 'Jawline', value: scan?.pillars?.jawline ?? 56 },
    { label: 'Masculinity', value: scan?.pillars?.masculinity ?? 81 },
    { label: 'Skin quality', value: scan?.pillars?.skin ?? 65 },
    { label: 'Cheekbones', value: scan?.pillars?.cheekbones ?? 76 },
  ]

  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {tiles.map((t, i) => (
          <MetricTile key={t.label} {...t} colorIdx={i} />
        ))}
      </div>
    </div>
  )
}

// ── Card 1: Learn about yourself ──────────────────────────────────────────────

const INSIGHTS = [
  { label: 'Canthal Tilt', value: 'Positive' },
  { label: 'Face Shape', value: 'Diamond' },
  { label: 'Eye Shape', value: 'Almond' },
]

function Card1() {
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {INSIGHTS.map((row) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: '18px 20px',
          }}
        >
          <span style={{ fontSize: 15, color: TEXT, fontFamily: 'var(--font-body, inherit)' }}>
            {row.label}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, fontFamily: 'var(--font-heading, inherit)' }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Card 2: Coach Chat ────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 2px' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{ width: 6, height: 6, borderRadius: '50%', background: DIM }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

function ChatBubble({ text, isUser, isTyping }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: '78%',
          background: isUser ? 'rgba(198,168,92,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${isUser ? 'rgba(198,168,92,0.25)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: isTyping ? '10px 14px' : '11px 14px',
        }}
      >
        {isTyping ? (
          <TypingDots />
        ) : (
          <p
            style={{
              fontSize: 13,
              color: isUser ? GOLD : TEXT,
              lineHeight: 1.5,
              margin: 0,
              fontFamily: 'var(--font-body, inherit)',
            }}
          >
            {text}
          </p>
        )}
      </div>
    </div>
  )
}

function Card2() {
  return (
    <div style={{ padding: '0 20px' }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 24,
          padding: '20px 16px',
        }}
      >
        <ChatBubble text="What's up! I'm your personal self improvement coach. What are you looking to learn?" />
        <ChatBubble isUser text="How do I become more attractive?" />
        <ChatBubble text="Becoming more attractive includes a few different steps. You can start by..." />
      </div>
    </div>
  )
}

// ── Card 3: Start improving ───────────────────────────────────────────────────

const IMPROVE_ITEMS = [
  { emoji: '🧴', title: 'Start a skincare routine', subtitle: 'Skincare routines are crucial for a clear, healthy face. Tap to learn more.' },
  { emoji: '💎', title: 'Diamond face styling', subtitle: 'You have a diamond face shape... let\'s teach you how to style it!' },
]

function Card3() {
  return (
    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {IMPROVE_ITEMS.map((item, i) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 18,
            padding: '16px 18px',
          }}
        >
          <span style={{ fontSize: 28, flexShrink: 0 }}>{item.emoji}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT, fontFamily: 'var(--font-heading, inherit)' }}>
              {item.title}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: DIM, fontFamily: 'var(--font-body, inherit)', lineHeight: 1.4 }}>
              {item.subtitle}
            </p>
          </div>
          <span style={{ color: DIM, fontSize: 18, flexShrink: 0 }}>›</span>
        </motion.div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PaywallModal({ onClose, scan, gender = 'male', onPurchaseSuccess }) {
  const navigate = useNavigate()
  const setIsPremium = useStore((s) => s.setIsPremium)

  const [cardIndex, setCardIndex] = useState(0)
  const [segmentProgress, setSegmentProgress] = useState(0) // 0..1
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const dragX = useMotionValue(0)
  const carouselControls = useAnimation()
  const timerRef = useRef(null)
  const progressRef = useRef(null)
  const segmentStartRef = useRef(Date.now())

  const TOTAL_CARDS = 4

  // Segment auto-advance
  useEffect(() => {
    if (isDragging) return

    segmentStartRef.current = Date.now()
    setSegmentProgress(0)

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - segmentStartRef.current
      setSegmentProgress(Math.min(elapsed / SEGMENT_DURATION, 1))
    }, 50)

    timerRef.current = setTimeout(() => {
      setCardIndex((prev) => (prev < TOTAL_CARDS - 1 ? prev + 1 : prev))
    }, SEGMENT_DURATION)

    return () => {
      clearInterval(progressRef.current)
      clearTimeout(timerRef.current)
    }
  }, [cardIndex, isDragging])

  // Animate carousel on card change
  useEffect(() => {
    carouselControls.start({ x: `-${cardIndex * 100}%`, transition: { type: 'spring', stiffness: 300, damping: 35 } })
  }, [cardIndex, carouselControls])

  const goToCard = (index) => {
    const clamped = Math.max(0, Math.min(TOTAL_CARDS - 1, index))
    setCardIndex(clamped)
  }

  const handleDragEnd = (_, info) => {
    setIsDragging(false)
    const offset = info.offset.x
    if (offset < -60) goToCard(cardIndex + 1)
    else if (offset > 60) goToCard(cardIndex - 1)
  }

  const handlePurchase = async () => {
    triggerHaptic()
    setLoading(true)
    try {
      const result = await purchasePro('weekly')
      if (result?.success) {
        setIsPremium(true)
        onPurchaseSuccess?.()
      }
    } catch (err) {
      console.error('[PaywallModal] purchase error', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    triggerHaptic()
    try {
      await restorePurchases()
    } catch (err) {
      console.error('[PaywallModal] restore error', err)
    }
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 280, damping: 36 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: BG,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 12,
          flexShrink: 0,
        }}
      >
        {/* Progress segments */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: TOTAL_CARDS }).map((_, i) => {
            const isCompleted = i < cardIndex
            const isCurrent = i === cardIndex
            return (
              <div
                key={i}
                onClick={() => goToCard(i)}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 99,
                  background: isCompleted ? GOLD : 'rgba(255,255,255,0.15)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                {isCurrent && (
                  <div
                    style={{
                      height: '100%',
                      background: GOLD,
                      width: `${segmentProgress * 100}%`,
                      transition: 'width 50ms linear',
                      borderRadius: 99,
                    }}
                  />
                )}
              </div>
            )
          })}

          {onClose && (
            <button
              onClick={() => { triggerHaptic(); onClose() }}
              style={{
                marginLeft: 8,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <X size={16} color={TEXT} />
            </button>
          )}
        </div>

        {/* Header — Umax-style big italic */}
        <div style={{ marginTop: 16, paddingLeft: 4, textAlign: 'center' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 38,
              fontWeight: 900,
              color: TEXT,
              fontStyle: 'italic',
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-heading, inherit)',
            }}
          >
            LEVEL UP
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: DIM, fontFamily: 'var(--font-body, inherit)' }}>
            Proven to help you max your looks.
          </p>
          <motion.p
            key={cardIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ margin: '12px 0 0', fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: 'var(--font-heading, inherit)' }}
          >
            {CARD_TITLES[cardIndex]}
          </motion.p>
        </div>
      </div>

      {/* Carousel */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <motion.div
          animate={carouselControls}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          style={{
            display: 'flex',
            width: `${TOTAL_CARDS * 100}%`,
            height: '100%',
          }}
        >
          {[
            <Card0 scan={scan} />,
            <Card1 />,
            <Card2 />,
            <Card3 />,
          ].map((card, i) => (
            <div
              key={i}
              style={{
                width: `${100 / TOTAL_CARDS}%`,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {card}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Page dots */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          paddingTop: 12,
          paddingBottom: 8,
          flexShrink: 0,
        }}
      >
        {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
          <motion.div
            key={i}
            layout
            onClick={() => goToCard(i)}
            style={{
              height: 6,
              borderRadius: 99,
              background: i === cardIndex ? GOLD : 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
            animate={{ width: i === cardIndex ? 20 : 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        ))}
      </div>

      {/* Bottom section */}
      <div
        style={{
          flexShrink: 0,
          padding: '8px 20px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          borderTop: `1px solid ${BORDER}`,
          background: BG,
        }}
      >
        {/* Social proof */}
        <p style={{ textAlign: 'center', fontSize: 13, color: DIM, fontFamily: 'var(--font-body, inherit)', marginBottom: 14 }}>
          1,000,000 scans completed
        </p>

        {/* CTA button — blue like Umax */}
        <button
          onClick={handlePurchase}
          disabled={loading}
          style={{
            width: '100%',
            height: 58,
            borderRadius: 50,
            border: 'none',
            background: loading ? 'rgba(67,130,225,0.5)' : '#4382E1',
            cursor: loading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 18,
            fontWeight: 700,
            color: '#ffffff',
            fontFamily: 'var(--font-heading, inherit)',
            marginBottom: 10,
            transition: 'opacity 0.2s',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <Loader2 size={22} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            'Unlock now 🙌'
          )}
        </button>

        {/* Price below button */}
        <p style={{ textAlign: 'center', fontSize: 13, color: DIM, fontFamily: 'var(--font-body, inherit)', marginBottom: 12 }}>
          $4.99 per week
        </p>

        {/* Legal links */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'Terms of Use', action: () => navigate('/terms') },
            { label: '·', action: null },
            { label: 'Restore Purchase', action: handleRestore },
            { label: '·', action: null },
            { label: 'Privacy Policy', action: () => navigate('/privacy') },
          ].map((item, i) =>
            item.action ? (
              <button
                key={i}
                onClick={item.action}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 10,
                  color: DIM,
                  padding: 0,
                  fontFamily: 'var(--font-body, inherit)',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(255,255,255,0.2)',
                }}
              >
                {item.label}
              </button>
            ) : (
              <span
                key={i}
                style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-body, inherit)' }}
              >
                {item.label}
              </span>
            )
          )}
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  )
}
