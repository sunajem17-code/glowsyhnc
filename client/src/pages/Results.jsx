import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { Share2, ArrowRight, ChevronDown, ChevronUp, Lock, ShoppingBag, ExternalLink, Sparkles } from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import logo from '../assets/ascendus-icon.png'
import GlowScoreRing from '../components/GlowScoreRing'
import UMaxScoreBadge from '../components/UMaxScoreBadge'
import MotionPage from '../components/MotionPage'
import ShareCardModal from '../components/ShareCardModal'
import ProLock from '../components/ProLock'
import { scoreColor } from '../utils/analysis'

const TIER_COLORS = {
  'Rising':         '#9CA3AF',
  'Normie':         '#60A5FA',
  'High Tier Normie': '#34D399',
  'Chadlite':       '#F59E0B',
  'Chad':           '#EF4444',
  'Gigachad':       '#C6A85C',
}

function ScoreReveal({ score, tier, onDone }) {
  const [phase, setPhase] = useState('dark')   // dark → counting → tier → done
  const [display, setDisplay] = useState(0)
  const tierColor = TIER_COLORS[tier] ?? '#C6A85C'

  useEffect(() => {
    // Phase 1: black screen for 600ms
    const t1 = setTimeout(() => setPhase('counting'), 600)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (phase !== 'counting') return
    const target = score ?? 0
    const duration = 1800
    const steps = 60
    const interval = duration / steps
    let current = 0
    const inc = target / steps
    const timer = setInterval(() => {
      current = Math.min(current + inc, target)
      setDisplay(parseFloat(current.toFixed(1)))
      if (current >= target) {
        clearInterval(timer)
        setTimeout(() => setPhase('tier'), 300)
      }
    }, interval)
    return () => clearInterval(timer)
  }, [phase, score])

  useEffect(() => {
    if (phase !== 'tier') return
    const t = setTimeout(() => setPhase('done'), 1600)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'done') onDone()
  }, [phase, onDone])

  const getScoreEmoji = (s) => s >= 8.5 ? '🔥' : s >= 7 ? '⚡' : s >= 5 ? '📈' : '💪'

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="reveal"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: '#000' }}
        >
          {/* Score number */}
          <AnimatePresence>
            {phase !== 'dark' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
              >
                <p
                  className="font-heading font-bold"
                  style={{
                    fontSize: 96,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    color: '#fff',
                    textShadow: `0 0 60px ${tierColor}88`,
                  }}
                >
                  {display.toFixed(1)}
                </p>
                <p className="font-heading text-[18px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  out of 10
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tier badge */}
          <AnimatePresence>
            {phase === 'tier' && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 text-center"
              >
                <p className="text-[40px] mb-2">{getScoreEmoji(score ?? 0)}</p>
                <div
                  className="inline-block px-6 py-2.5 rounded-full font-heading font-bold text-[15px] uppercase tracking-widest"
                  style={{
                    background: `${tierColor}18`,
                    border: `1.5px solid ${tierColor}55`,
                    color: tierColor,
                    boxShadow: `0 0 30px ${tierColor}33`,
                  }}
                >
                  {tier}
                </div>
                <p className="mt-3 font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Tap to see full breakdown
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Radial glow */}
          {phase !== 'dark' && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 45%, ${tierColor}22 0%, transparent 65%)`,
              }}
            />
          )}

          {/* Tap to skip */}
          {phase !== 'dark' && (
            <button
              onClick={onDone}
              className="absolute bottom-14 font-body text-[12px]"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              tap to skip
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Hairstyle recs: [hairType][faceShape] ───────────────────────────────────

const HAIRSTYLE_RECS = {

  // ── Straight / Wavy (Type 1 & 2) ─────────────────────────────────────────
  straight: {
    'soft/round': {
      label: 'Round Face · Straight Hair',
      advice: 'Add height on top to elongate. Avoid width-adding styles.',
      cuts: [
        { name: 'Textured Crop', why: 'Adds height, creates illusion of length' },
        { name: 'French Crop with Fringe', why: 'Structured top reduces roundness' },
        { name: 'Quiff', why: 'Volume on top draws the eye upward' },
      ],
      avoid: 'Buzz cuts, bowl cuts, or anything that emphasizes width',
    },
    average: {
      label: 'Average Face · Straight Hair',
      advice: 'Versatile face shape — most styles work. Aim for clean execution.',
      cuts: [
        { name: 'Undercut', why: 'Clean contrast, always sharp' },
        { name: 'Ivy League / Side Part', why: 'Classic and timeless' },
        { name: 'Textured Quiff', why: 'Adds dimension without altering face shape' },
      ],
      avoid: 'Overly complex styles that distract rather than enhance',
    },
    defined: {
      label: 'Defined Face · Straight Hair',
      advice: 'Strong structure supports clean, minimal cuts beautifully.',
      cuts: [
        { name: 'Buzz Cut', why: 'Showcases bone structure unobstructed' },
        { name: 'Slick Back', why: 'Exposes the hairline, emphasizes jaw' },
        { name: 'Mid Fade Crew Cut', why: 'Sharp edges complement your jawline' },
      ],
      avoid: 'Heavy volume styles that compete with your natural structure',
    },
    strong: {
      label: 'Strong Structure · Straight Hair',
      advice: 'Elite bone structure — almost any style works.',
      cuts: [
        { name: 'Caesar Cut', why: 'Timeless for strong jaw and brow ridge' },
        { name: 'Modern Pompadour', why: 'Commands attention, pairs with structure' },
        { name: 'French Crop / Buzz', why: 'Both showcase structure without fighting it' },
      ],
      avoid: 'Messy, unkempt styles — the only thing that can pull you down',
    },
  },

  // ── Wavy (Type 2) — inherits straight recs, slightly adjusted ────────────
  wavy: {
    'soft/round': {
      label: 'Round Face · Wavy Hair',
      advice: 'Use the natural wave to add height. Keep sides tight.',
      cuts: [
        { name: 'Wavy Textured Crop', why: 'Wave adds natural height and structure' },
        { name: 'Quiff with Fade', why: 'Directs volume upward, not outward' },
        { name: 'Fringe with Taper', why: 'Softens roundness, adds forward length' },
      ],
      avoid: 'Letting waves grow out wide on the sides — widens the face',
    },
    average: {
      label: 'Average Face · Wavy Hair',
      advice: 'Wavy texture is versatile — lean into natural movement.',
      cuts: [
        { name: 'Messy Textured Cut', why: 'Natural movement enhances features' },
        { name: 'Curtain Fringe', why: 'Trending and flattering on most face shapes' },
        { name: 'Mid Fade with Waves', why: 'Clean sides with natural top texture' },
      ],
      avoid: 'Overly straight blowouts that eliminate natural texture',
    },
    defined: {
      label: 'Defined Face · Wavy Hair',
      advice: 'Sharp structure pairs well with controlled wave texture.',
      cuts: [
        { name: 'Slick Back with Waves', why: 'Controlled and sharp' },
        { name: 'Textured Crop Fade', why: 'Wave texture adds personality to structure' },
        { name: 'Short Back and Sides', why: 'Clean contrast, showcases bone structure' },
      ],
      avoid: 'Uncontrolled volume that obscures the jaw and cheekbones',
    },
    strong: {
      label: 'Strong Structure · Wavy Hair',
      advice: 'Strong bones + wavy texture = effortless style.',
      cuts: [
        { name: 'Textured Caesar', why: 'Wave adds dimension to a powerful cut' },
        { name: 'Slick Back', why: 'Shows off structure completely' },
        { name: 'Curtain Fringe', why: 'Softens without hiding your strong structure' },
      ],
      avoid: 'Over-product and helmet hair — your natural texture is the asset',
    },
  },

  // ── Curly (Type 3 — 3a/3b/3c) ────────────────────────────────────────────
  curly: {
    'soft/round': {
      label: 'Round Face · Curly Hair',
      advice: 'Height is your best friend. Keep the sides tapered and stack volume upward.',
      cuts: [
        { name: 'Curly Top Fade', why: 'Volume stays on top, sides stay tight — elongates face' },
        { name: 'Defined Curl with Taper', why: 'Structure and definition prevent width-spreading' },
        { name: 'Curly Fringe Forward', why: 'Brings the eye forward and down, reducing roundness' },
      ],
      avoid: 'Wide curly afro shapes or letting sides grow out — adds width to an already wide face',
    },
    average: {
      label: 'Average Face · Curly Hair',
      advice: 'Lucky — curly hair works well here. Focus on definition and moisture.',
      cuts: [
        { name: 'Curly Top Fade', why: 'Clean and modern, suits the balanced shape' },
        { name: 'Defined Curl Afro', why: 'Natural texture shines with balanced proportions' },
        { name: 'Curtain Curls', why: 'Soft and flattering, works with curl pattern' },
      ],
      avoid: 'Letting curls dry out and frizz — definition is everything',
    },
    defined: {
      label: 'Defined Face · Curly Hair',
      advice: 'Sharp structure + curly texture = unique and striking.',
      cuts: [
        { name: 'Curly Mid Fade', why: 'Sharp line-up with natural top texture pops' },
        { name: 'Short Curl Crop', why: 'Controlled length shows off cheekbones and jaw' },
        { name: 'Curly Fringe', why: 'Adds a soft contrast to the angular structure' },
      ],
      avoid: 'Perm-straight styles that erase your natural curl pattern advantage',
    },
    strong: {
      label: 'Strong Structure · Curly Hair',
      advice: 'Elite structure + curls is a rare combo — own it.',
      cuts: [
        { name: 'High Fade with Curly Top', why: 'Maximizes the contrast with strong bone structure' },
        { name: 'Defined Full Curl', why: 'Volume complements without overpowering the face' },
        { name: 'Curly Caesar', why: 'Classic cut adapted for curls — sharp and confident' },
      ],
      avoid: 'Messy, undefined frizz — define those curls with product',
    },
  },

  // ── Coily / Afro (Type 4 — 4a/4b/4c) ────────────────────────────────────
  coily: {
    'soft/round': {
      label: 'Round Face · Coily/Afro Hair',
      advice: 'Stack all height upward. Taper the sides tight to elongate and define.',
      cuts: [
        { name: 'High Top Fade', why: 'Adds dramatic height — elongates the face significantly' },
        { name: 'Afro with Tapered Sides', why: 'Volume on top, tight sides — the ideal round-face afro' },
        { name: 'Twist Out with Fade', why: 'Structured definition adds length and reduces width perception' },
      ],
      avoid: 'Full rounded afro with no tapering — it mirrors the round face and doubles the width',
    },
    average: {
      label: 'Average Face · Coily/Afro Hair',
      advice: 'Almost anything works. Shadow fade with afro or locs is a signature look.',
      cuts: [
        { name: 'Shadow Fade with Afro', why: 'Clean gradient keeps the look sharp and balanced' },
        { name: 'Tapered Afro', why: 'Natural volume with clean edges — timeless' },
        { name: 'Twist Out', why: 'Definition and texture, suits the balanced proportions' },
      ],
      avoid: 'Neglected edges — line-ups make or break the afro look',
    },
    defined: {
      label: 'Defined Face · Coily/Afro Hair',
      advice: 'Sharp angles + coily texture is a powerful combination.',
      cuts: [
        { name: 'Soft Afro with Rounded Top', why: 'The softness contrasts and complements sharp angles' },
        { name: 'Mid Fade with Afro Top', why: 'Structure on the sides highlights the jawline' },
        { name: 'Twist Out Natural', why: 'Texture adds softness without hiding structure' },
      ],
      avoid: 'Flat tops or extremely angular cuts — competes with the face, not complements it',
    },
    strong: {
      label: 'Strong Structure · Coily/Afro Hair',
      advice: 'Elite bones + afro texture = powerful and distinctive.',
      cuts: [
        { name: 'Full Afro', why: 'Volume frames the strong structure with authority' },
        { name: 'High Top Fade', why: 'Dramatic height amplifies the bone structure' },
        { name: 'Tapered Sides with Volume Top', why: 'Maximizes contrast and showcases structure' },
      ],
      avoid: 'Unkempt or neglected texture — moisture and definition are non-negotiable',
    },
  },

  // ── Locs / Dreads ─────────────────────────────────────────────────────────
  locs: {
    'soft/round': {
      label: 'Round Face · Locs',
      advice: 'Wear locs upward or on top to add height. Keep the sides clean.',
      cuts: [
        { name: 'Short Locs with Fade', why: 'Clean sides + structured top elongates the face' },
        { name: 'Mid-Length Locs Worn Up', why: 'Height adds length to a round face' },
        { name: 'Loc Mohawk', why: 'Volume in the center creates angularity and height' },
      ],
      avoid: 'Locs worn fully down and loose — adds width at jaw level',
    },
    average: {
      label: 'Average Face · Locs',
      advice: 'Locs suit balanced faces at any length. Maintain them well.',
      cuts: [
        { name: 'Mid-Length Locs Any Style', why: 'Balanced face handles any loc length or style' },
        { name: 'Long Locs Worn Back', why: 'Elongates face and looks polished' },
        { name: 'Short Locs with Line-Up', why: 'Clean and structured — sharp presentation' },
      ],
      avoid: 'Neglected, frizzy locs without moisture or retwisting — upkeep is everything',
    },
    defined: {
      label: 'Defined Face · Locs',
      advice: 'Sharp structure + locs is an iconic combination.',
      cuts: [
        { name: 'Loc Mohawk', why: 'Adds angularity that complements sharp features' },
        { name: 'Short Locs Fade', why: 'Precision edges match the precision of the face' },
        { name: 'Mid-Length Locs Worn Up', why: 'Height enhances vertical length of a defined face' },
      ],
      avoid: 'Flat, fully down locs that cover the jawline — show it off',
    },
    strong: {
      label: 'Strong Structure · Locs',
      advice: 'Strong bone structure wears every loc style with authority.',
      cuts: [
        { name: 'Long Locs Worn Down', why: 'Elongates and frames elite structure' },
        { name: 'Long Locs Worn Back', why: 'Full exposure of the structure — nothing to hide' },
        { name: 'Mid-Length Locs Any Style', why: 'Structure carries any length effortlessly' },
      ],
      avoid: 'Over-accessorizing locs — the face and locs speak for themselves',
    },
  },

  // ── Bald / Shaved ─────────────────────────────────────────────────────────
  bald: {
    'soft/round': {
      label: 'Round Face · Bald/Shaved',
      advice: 'Grow a beard to add angularity and length to the chin.',
      cuts: [
        { name: 'Full Beard', why: 'Adds definition and elongates the face shape' },
        { name: 'Goatee / Chin Beard', why: 'Lengthens the chin, reduces apparent roundness' },
        { name: 'Stubble', why: 'Even light stubble adds jaw definition' },
      ],
      avoid: 'Clean-shaven bald — removes all structure from the face at once',
    },
    average: {
      label: 'Average Face · Bald/Shaved',
      advice: 'Bald works on a balanced face. Maintain skin and beard sharp.',
      cuts: [
        { name: 'Clean Bald with Beard', why: 'Classic combination — confident and sharp' },
        { name: 'Stubble Bald', why: 'Low maintenance, always looks intentional' },
        { name: 'Shadow Fade to Bald', why: 'Gradual transition looks deliberate not receding' },
      ],
      avoid: 'Patchy or ungroomed beard — if you go bald, the beard must be sharp',
    },
    defined: {
      label: 'Defined Face · Bald/Shaved',
      advice: 'Strong structure is amplified bald. This is the power move.',
      cuts: [
        { name: 'Clean Shaved Bald', why: 'Maximum structure exposure — the Vin Diesel effect' },
        { name: 'Bald with Sharp Beard', why: 'Defines the jaw even further' },
        { name: 'Shadow Fade to Skin', why: 'Polished look that highlights structure' },
      ],
      avoid: 'Anything that looks accidental — commit fully to the look',
    },
    strong: {
      label: 'Strong Structure · Bald/Shaved',
      advice: 'Elite structure bald is the highest tier aesthetic — no hair needed.',
      cuts: [
        { name: 'Clean Bald', why: 'Nothing can compete with elite bald structure' },
        { name: 'Bald with Full Beard', why: 'The full power look — dominant and intentional' },
        { name: 'Polished Bald', why: 'Moisturized, shining scalp signals discipline' },
      ],
      avoid: 'Neglected scalp — moisturize daily and keep the look deliberate',
    },
  },
}

// Normalize hair type key: map AI output / unknown / null to a valid key
function resolveHairType(aiHairType, storedHairType) {
  const valid = ['straight', 'wavy', 'curly', 'coily', 'locs', 'bald']
  // Prefer stored manual selection over AI detection
  if (storedHairType && valid.includes(storedHairType)) return storedHairType
  if (aiHairType && valid.includes(aiHairType)) return aiHairType
  return null // null = needs manual selection
}

function getHairRec(hairType, faceShape) {
  const shape = ['soft/round', 'average', 'defined', 'strong'].includes(faceShape) ? faceShape : 'average'
  const typeMap = HAIRSTYLE_RECS[hairType]
  if (!typeMap) return null
  return typeMap[shape] ?? typeMap['average']
}

const HAIR_TYPE_OPTIONS = [
  { value: 'straight', label: 'Straight',   emoji: '〰️' },
  { value: 'wavy',     label: 'Wavy',        emoji: '〜' },
  { value: 'curly',    label: 'Curly',       emoji: '🌀' },
  { value: 'coily',    label: 'Coily/Afro',  emoji: '✨' },
  { value: 'locs',     label: 'Locs',        emoji: '🔱' },
  { value: 'bald',     label: 'Bald/Shaved', emoji: '⚡' },
]

// ─── Score bar row ────────────────────────────────────────────────────────────

const COLOR_MAP = {
  green: { bar: 'bg-success', text: 'text-success', badge: 'bg-green-50 dark:bg-green-900/20 text-success' },
  amber: { bar: 'bg-[#F5A623]', text: 'text-[#F5A623]', badge: 'bg-amber-50 dark:bg-amber-900/20 text-[#F5A623]' },
  red:   { bar: 'bg-warning',  text: 'text-warning',  badge: 'bg-red-50 dark:bg-red-900/20 text-warning'   },
}

function ScoreRow({ label, score, note, detail, tip, isPremium, onUpgrade }) {
  const [open, setOpen] = useState(false)
  const c = COLOR_MAP[scoreColor(score)]
  const pct = ((score - 1) / 9) * 100

  // Inline tip color based on score
  const tipColor = score >= 7 ? '#34C759' : score >= 5 ? '#F5A623' : '#E07A5F'
  const tipText  = score >= 7 ? '✓ Strong' : tip ?? null

  return (
    <div className="border-b border-default last:border-0">
      <button className="w-full flex items-center gap-3 py-3" onClick={() => note && setOpen(o => !o)}>
        <div className={`w-11 text-center py-1 rounded-lg text-xs font-mono font-bold flex-shrink-0 ${c.badge}`}>
          {score.toFixed(1)}
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-heading font-semibold text-primary leading-tight">{label}</p>
          {detail && <p className="text-[10px] text-secondary font-body mt-0.5">{detail}</p>}
          <div className="mt-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${c.bar}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          {tipText && (
            <p className="text-[10px] font-body mt-1 leading-tight" style={{ color: tipColor }}>
              {tipText}
            </p>
          )}
        </div>
        {note && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isPremium && <Lock size={10} className="text-[#C6A85C]" />}
            {open ? <ChevronUp size={13} className="text-secondary" /> : <ChevronDown size={13} className="text-secondary" />}
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && note && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-3">
              {isPremium ? (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-secondary font-body leading-relaxed">{note}</p>
                </div>
              ) : (
                <ProText text={note} onUpgrade={onUpgrade} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


// ─── Personalized Product Stack ───────────────────────────────────────────────

function ProductStack({ isPremium, weaknesses, skinIssues, groomingScore, pillars, gender, onUpgrade }) {
  const [open, setOpen]         = useState(false)
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(false)
  const [fetched, setFetched]   = useState(false)

  async function handleOpen() {
    const next = !open
    setOpen(next)
    if (next && !fetched) {
      setLoading(true)
      try {
        const { products: recs } = await api.products.recommendations({
          weaknesses,
          skinIssues,
          groomingScore,
          pillars,
          gender,
        })
        setProducts(recs || [])
      } catch {
        setProducts([])
      } finally {
        setLoading(false)
        setFetched(true)
      }
    }
  }

  // Free users see no products — the entire stack is locked behind Pro

  function amazonUrl(searchQuery) {
    return `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}`
  }

  return (
    <div className="card mb-3">
      {/* Header / toggle */}
      <button className="w-full flex items-center gap-2 mb-1" onClick={handleOpen}>
        <span className="text-base">🛍️</span>
        <h2 className="font-heading font-bold text-sm text-primary flex-1 text-left">Your Personalized Product Stack</h2>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(198,168,92,0.12)', color: '#C6A85C' }}>
          {isPremium ? 'AI PICKS' : 'AI PICKS'}
        </span>
        <div
          className="flex items-center justify-center w-6 h-6 rounded-full transition-colors"
          style={{ background: 'rgba(198,168,92,0.15)' }}
        >
          {open
            ? <ChevronUp  size={13} style={{ color: '#C6A85C' }} />
            : <ChevronDown size={13} style={{ color: '#C6A85C' }} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {/* Free users: fully locked — no product preview */}
            {!isPremium ? (
              <ProLock
                solid
                onUpgrade={onUpgrade}
                label="Your Personalized Product Stack"
                description="AI-matched products based on your scan weaknesses and skin issues."
                className="mt-1"
              />
            ) : (
              <>
                {/* Intro blurb — Pro */}
                <p className="text-[10px] text-secondary font-body mb-3 leading-snug">
                  Products matched to your scan — selected based on your detected weak areas and skin issues.
                </p>

                {/* Loading skeleton */}
                {loading && (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'rgba(198,168,92,0.1)' }} />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 rounded w-3/4" style={{ background: 'rgba(198,168,92,0.15)' }} />
                          <div className="h-2 rounded w-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
                          <div className="h-2 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.04)' }} />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-center gap-1.5 py-1">
                      <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C6A85C', borderTopColor: 'transparent' }} />
                      <span className="text-[10px] text-secondary font-body">Personalizing your stack…</span>
                    </div>
                  </div>
                )}

                {/* No results */}
                {!loading && fetched && products.length === 0 && (
                  <p className="text-[11px] text-secondary font-body text-center py-4">
                    No recommendations available right now — try again after your next scan.
                  </p>
                )}

                {/* Product cards */}
                {!loading && products.map((product, i) => (
                  <motion.a
                    key={i}
                    href={amazonUrl(product.searchQuery || product.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-xl mb-2 no-underline active:opacity-70 transition-opacity group"
                    style={{ background: 'rgba(198,168,92,0.05)', border: '1px solid rgba(198,168,92,0.14)' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(198,168,92,0.12)' }}>
                      <ShoppingBag size={16} style={{ color: '#C6A85C' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-[12px] text-primary leading-snug mb-0.5 flex items-center gap-1">
                        {product.name}
                        <ExternalLink size={9} className="text-secondary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-[10px] text-secondary font-body leading-snug">{product.description}</p>
                    </div>
                    <span className="flex-shrink-0 text-[9px] font-heading font-bold px-2 py-1 rounded-lg self-center" style={{ background: '#FF9900', color: '#000' }}>
                      Amazon
                    </span>
                  </motion.a>
                ))}

                {/* Affiliate disclaimer */}
                {!loading && fetched && products.length > 0 && (
                  <p className="text-[9px] text-secondary font-body text-center mt-2 opacity-50">
                    Links open Amazon search · Ascendus may earn from qualifying purchases
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Face metric bar ──────────────────────────────────────────────────────────

function FaceMetricBar({ label, score, descriptor, locked = false, onUpgrade }) {
  const pct        = score != null ? Math.round((score / 10) * 100) : 0
  const scoreColor = score >= 7 ? '#34C759' : score >= 5 ? '#F5A623' : '#E07A5F'

  if (locked) {
    return (
      <div className="relative overflow-hidden py-3 border-b border-default last:border-0">
        {/* blurred ghost */}
        <div className="blur-sm select-none pointer-events-none opacity-40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-heading font-bold text-primary">{label}</span>
            <span className="text-sm font-mono font-bold" style={{ color: '#C6A85C' }}>
              7.5<span className="text-[9px] font-normal text-secondary">/10</span>
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full" style={{ width: '75%', background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)' }} />
          </div>
          <p className="text-[10px] text-secondary font-body">Placeholder descriptor for this metric</p>
        </div>
        {/* lock overlay */}
        <div className="absolute inset-0 flex items-center justify-between px-2.5 rounded-lg"
          style={{ background: 'rgba(18,18,18,0.72)', backdropFilter: 'blur(2px)' }}>
          <div className="flex items-center gap-1.5">
            <Lock size={10} style={{ color: '#C6A85C' }} />
            <span className="text-[10px] font-heading font-bold" style={{ color: '#C6A85C' }}>Pro metric</span>
          </div>
          <button
            onClick={onUpgrade}
            className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-md text-black"
            style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 100%)' }}
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-3 border-b border-default last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-heading font-bold text-primary">{label}</span>
        <span className="font-mono font-bold text-sm" style={{ color: scoreColor }}>
          {score?.toFixed(1)}<span className="text-[9px] font-normal text-secondary">/10</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #B8973E 0%, #C6A85C 50%, #D4B96A 100%)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {descriptor && (
        <p className="text-[10px] text-secondary font-body leading-snug">{descriptor}</p>
      )}
    </div>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({ title, emoji, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card mb-3">
      <button className="w-full flex items-center gap-2 mb-1" onClick={() => setOpen(o => !o)}>
        <span className="text-base">{emoji}</span>
        <h2 className="font-heading font-bold text-sm text-primary flex-1 text-left">{title}</h2>
        {badge && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#C6A85C]/10 text-[#C6A85C]">{badge}</span>}
        {open ? <ChevronUp size={14} className="text-secondary" /> : <ChevronDown size={14} className="text-secondary" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Inline pro text gate ─────────────────────────────────────────────────────

function ProText({ text, onUpgrade }) {
  return (
    <div className="relative rounded-xl overflow-hidden mt-1">
      <p className="text-[10px] text-secondary font-body blur-[4px] select-none pointer-events-none leading-relaxed">
        {text}
      </p>
      <div className="absolute inset-0 flex items-center justify-between px-2.5 bg-card/60 backdrop-blur-[1px] rounded-xl">
        <div className="flex items-center gap-1.5">
          <Lock size={10} className="text-[#C6A85C]" />
          <span className="text-[10px] font-heading font-bold text-[#C6A85C]">Pro detail</span>
        </div>
        <button
          onClick={onUpgrade}
          className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-md text-black"
          style={{ background: '#F5A623' }}
        >
          Unlock
        </button>
      </div>
    </div>
  )
}

// ─── Pro gate overlay ─────────────────────────────────────────────────────────

function ProGate({ onUpgrade }) {
  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Blurred preview */}
      <div className="blur-sm pointer-events-none select-none opacity-40 px-1 pb-2">
        {[85, 78, 71].map((sim, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-default last:border-0">
            <div className="w-9 h-9 rounded-full bg-[#C6A85C]/20 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1" />
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#C6A85C] rounded-full" style={{ width: `${sim}%` }} />
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-secondary">{sim}%</span>
          </div>
        ))}
      </div>
      {/* Unlock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl">
        <Lock size={18} className="text-[#C6A85C] mb-2" />
        <p className="font-heading font-bold text-sm text-primary mb-0.5">Pro Feature</p>
        <p className="text-[11px] text-secondary font-body mb-3">Unlock celebrity matches with Pro</p>
        <button
          onClick={onUpgrade}
          className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-black"
          style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)' }}
        >
          Upgrade to Pro →
        </button>
      </div>
    </div>
  )
}

// ─── Paywall Full-Screen ──────────────────────────────────────────────────────

function PaywallSheet({ glowScore, pillars, gender, onClose }) {
  const navigate = useNavigate()
  const [plan, setPlan]     = useState('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // ── Personalisation — find worst pillar ──────────────────────────────────
  const PILLAR_LABELS = {
    harmony:    'Harmony',
    angularity: 'Angularity',
    features:   'Features',
    dimorphism: gender === 'female' ? 'Femininity' : 'Dimorphism',
  }
  const worstEntry = pillars
    ? Object.entries(pillars).reduce((a, b) => (a[1] < b[1] ? a : b))
    : null
  const worstKey   = worstEntry?.[0] ?? null
  const worstScore = worstEntry?.[1] ?? null
  const worstLabel = worstKey ? (PILLAR_LABELS[worstKey] ?? worstKey) : null
  const scoreDrag  = worstScore != null ? Math.min(1.8, (7.5 - worstScore) * 0.18).toFixed(1) : null

  const potential = Math.min(10, (glowScore ?? 5) + 1.8).toFixed(1)
  const gap       = ((Number(potential) - (glowScore ?? 5)).toFixed(1))

  const hookHeadline = worstLabel && worstScore != null && worstScore < 6.5
    ? `Your ${worstLabel} scored ${worstScore.toFixed(1)} — it's pulling your score down.`
    : `You're ${gap} points below your potential.`

  const hookSub = worstLabel && worstScore != null && worstScore < 6.5
    ? `This single pillar is costing you ~${scoreDrag} points. Pro unlocks the exact protocol to fix it.`
    : `Your full breakdown and 12-week protocol are waiting.`

  // ── Direct checkout ───────────────────────────────────────────────────────
  async function handleCheckout(noTrial = false) {
    const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
    const token  = stored?.state?.token
    if (!token || token === 'demo-token') {
      navigate('/auth')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { url } = await api.payments.createCheckout(plan, noTrial)
      window.location.href = url
    } catch (err) {
      setError(err.message || 'Could not open checkout — please try again.')
      setLoading(false)
    }
  }

  const locked = [
    worstLabel && worstScore != null && worstScore < 6.5
      ? { icon: '🎯', label: `Fix Your ${worstLabel}`, sub: `Exact protocol to raise ${worstScore.toFixed(1)} → 8.0+` }
      : { icon: '📈', label: 'Score Projection', sub: `Your potential: ${potential}/10 · roadmap included` },
    { icon: '⭐', label: 'Celebrity Lookalikes', sub: '3 AI matches with % similarity' },
    { icon: '📐', label: 'Full Face Metrics', sub: '6 detailed scores + AI descriptors' },
    { icon: '✂️', label: 'Hairstyle Recommendations', sub: 'Face-shape matched styles + protocols' },
    { icon: '🗺️', label: '12-Week Personalized Plan', sub: 'Built from your exact scan results' },
    { icon: '🤖', label: 'AI Improvement Coach', sub: 'Unlimited questions about your results' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ background: '#080604' }}
    >
      {/* Gold top accent */}
      <div className="h-px w-full flex-shrink-0"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(198,168,92,0.55), transparent)' }} />

      <div className="flex-1 px-5 pt-9 pb-10 flex flex-col">

        {/* Logo + badge */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <img src={logo} alt="Ascendus" style={{ height: 28, mixBlendMode: 'lighten' }} />
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.25)' }}>
            <span style={{ color: '#C6A85C', fontSize: 10 }}>✦</span>
            <span className="text-[9px] font-heading font-bold uppercase tracking-widest" style={{ color: '#C6A85C' }}>Pro</span>
          </div>
        </div>

        {/* Score projection */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center">
            <p className="font-mono font-bold leading-none mb-1" style={{ fontSize: 36, color: '#E07A5F' }}>
              {glowScore?.toFixed(1) ?? '—'}
            </p>
            <p className="text-[9px] font-body uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>Current</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowRight size={22} style={{ color: 'rgba(198,168,92,0.6)' }} />
            <span className="text-[8px] font-heading font-bold" style={{ color: '#C6A85C' }}>+{gap}</span>
          </div>
          <div className="text-center">
            <p className="font-mono font-bold leading-none mb-1" style={{ fontSize: 36, color: '#34C759' }}>
              {potential}
            </p>
            <p className="text-[9px] font-body uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>Potential</p>
          </div>
        </div>

        {/* Personalised hook */}
        <div className="mb-4 px-4 py-3.5 rounded-2xl"
          style={{ background: 'rgba(224,122,95,0.09)', border: '1px solid rgba(224,122,95,0.22)' }}>
          <p className="font-heading font-bold text-[14px] text-white mb-1 leading-snug">{hookHeadline}</p>
          <p className="font-body text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{hookSub}</p>
        </div>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex -space-x-1.5">
            {['#C6A85C','#A29BFE','#34C759'].map((c, i) => (
              <div key={i} className="w-5 h-5 rounded-full border-2 border-black" style={{ background: c, opacity: 0.85 }} />
            ))}
          </div>
          <p className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
            <span className="font-bold" style={{ color: 'rgba(255,255,255,0.65)' }}>1,200+ users</span> improved their score this month
          </p>
        </div>

        {/* Locked items */}
        <div className="space-y-1.5 mb-5">
          {locked.map(({ icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-base flex-shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-[12px] text-white leading-snug">{label}</p>
                <p className="font-body text-[10px] leading-snug" style={{ color: 'rgba(255,255,255,0.33)' }}>{sub}</p>
              </div>
              <Lock size={12} style={{ color: '#C6A85C', flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* Plan toggle */}
        <div className="rounded-xl p-1 mb-3" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="grid grid-cols-2 gap-0.5">
            {[
              { key: 'monthly', label: 'Monthly', price: '$7.99/mo' },
              { key: 'annual',  label: 'Annual',  price: '$4.17/mo', badge: 'SAVE 48%' },
            ].map(({ key, label, price, badge }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPlan(key)}
                className="py-2 rounded-lg text-center transition-all"
                style={{
                  background: plan === key ? 'rgba(198,168,92,0.18)' : 'transparent',
                  border: `1px solid ${plan === key ? 'rgba(198,168,92,0.4)' : 'transparent'}`,
                }}
              >
                <p className="text-[10px] font-heading font-bold leading-none mb-0.5"
                  style={{ color: plan === key ? '#C6A85C' : 'rgba(255,255,255,0.3)' }}>
                  {label}{badge && plan === key ? ` · ${badge}` : ''}
                </p>
                <p className="text-[12px] font-mono font-bold"
                  style={{ color: plan === key ? '#F0EDE8' : 'rgba(255,255,255,0.25)' }}>
                  {price}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Primary CTA — free trial */}
        <motion.button
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={() => handleCheckout(false)}
          disabled={loading}
          type="button"
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mb-1 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 50%, #A8893A 100%)',
            color: '#0A0A0A',
            boxShadow: '0 4px 20px rgba(198,168,92,0.35)',
            letterSpacing: '0.01em',
          }}
        >
          {loading ? 'Opening checkout…' : '✦ Start 7-Day Free Trial'}
        </motion.button>
        <p className="text-center text-[10px] font-body mb-3" style={{ color: 'rgba(255,255,255,0.22)' }}>
          $0 today · then {plan === 'annual' ? '$49.99/yr ($4.17/mo)' : '$7.99/mo'} · cancel anytime
        </p>

        {/* Secondary CTA — pay now */}
        <motion.button
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={() => handleCheckout(true)}
          disabled={loading}
          type="button"
          className="w-full py-3 rounded-xl font-heading font-bold text-[13px] mb-4 transition-all disabled:opacity-40"
          style={{
            background: 'rgba(198,168,92,0.08)',
            border: '1px solid rgba(198,168,92,0.28)',
            color: 'rgba(198,168,92,0.75)',
          }}
        >
          Pay Now — No Trial
        </motion.button>

        {error && (
          <p className="text-center text-[11px] font-body mb-3" style={{ color: '#EF4444' }}>{error}</p>
        )}

        {/* Dismiss — uses their actual score as guilt anchor */}
        <button
          onClick={onClose}
          type="button"
          className="w-full py-2 font-body text-[12px] text-center"
          style={{ color: 'rgba(255,255,255,0.22)' }}
        >
          No thanks, I'll stay at {glowScore?.toFixed(1) ?? '—'}
        </button>

      </div>
    </motion.div>
  )
}

// ─── Main Results Page ────────────────────────────────────────────────────────

export default function Results() {
  const navigate = useNavigate()
  const { currentScan, isPremium, pendingFacePhoto, assignedPhase, hairType, setHairType, userProfile } = useStore()
  const [showShareCard, setShowShareCard] = useState(false)
  const [revealDone, setRevealDone] = useState(false)

  // Show reveal only on first load for a fresh scan (within last 10s)
  const isNewScan = currentScan && (Date.now() - new Date(currentScan.analyzedAt).getTime()) < 10000
  const [showReveal] = useState(() => !!isNewScan)

  // Show paywall immediately for free users — after reveal if new scan, instantly otherwise
  const [showPaywall, setShowPaywall] = useState(() => !isPremium && !!currentScan && !isNewScan)

  useEffect(() => {
    if (!isPremium && currentScan && isNewScan && revealDone) {
      setShowPaywall(true)
    }
  }, [isPremium, currentScan, isNewScan, revealDone])

  if (!currentScan) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <p className="text-5xl mb-4">📸</p>
        <h2 className="font-heading font-bold text-xl text-primary mb-2">No scan yet</h2>
        <p className="text-secondary text-sm font-body mb-6">Take your first scan to see your results here.</p>
        <button onClick={() => navigate('/scan')} className="btn-primary max-w-xs">Start Scan</button>
      </div>
    )
  }

  const { faceData, umaxScore, tier, gender, aiScore, pillars: scanPillars, celebrityMatches } = currentScan
  const glowScore = currentScan.glowScore != null ? (currentScan.glowScore > 10 ? Math.round(currentScan.glowScore) / 10 : currentScan.glowScore) : null
  const pillars = scanPillars ?? aiScore?.pillars ?? null

  const profileData      = aiScore?.profileData   ?? null
  const profileScore     = aiScore?.profileScore  ?? null
  const hasSideProfile   = !!(aiScore?.hasSideProfile || profileData)
  const faceMetrics      = aiScore?.faceMetrics   ?? null

  const facialStructure = aiScore?.facialStructure ?? 'average'

  // Hair type: AI detected > user stored > null (needs manual pick)
  const aiDetectedHairType = aiScore?.hairType && aiScore.hairType !== 'unknown' ? aiScore.hairType : null
  const resolvedHT = resolveHairType(aiDetectedHairType, hairType)
  const hairRec = resolvedHT ? getHairRec(resolvedHT, facialStructure) : null

  // Celebrity matches — use AI data or fall back to structure-based defaults
  const CELEB_FALLBACKS = {
    male: {
      'strong':     [{ celebrity: 'Henry Cavill',    similarity: 81, shared_traits: 'Sharp jaw, high cheekbones, strong brow ridge' }, { celebrity: 'Brad Pitt',       similarity: 74, shared_traits: 'Defined cheekbones, square jaw, balanced thirds' }, { celebrity: 'Chris Hemsworth', similarity: 68, shared_traits: 'Wide jaw, angular structure, prominent brow' }],
      'defined':    [{ celebrity: 'Zac Efron',        similarity: 73, shared_traits: 'Defined jaw, average cheekbones, balanced thirds' }, { celebrity: 'Tom Holland',      similarity: 67, shared_traits: 'Almond eyes, narrow jaw, oval face shape' }, { celebrity: 'Miles Teller',     similarity: 61, shared_traits: 'Oval face, average cheekbones, straight nose' }],
      'average':    [{ celebrity: 'Chris Evans',      similarity: 76, shared_traits: 'Balanced facial thirds, straight nose, average jaw' }, { celebrity: 'Jake Gyllenhaal',  similarity: 69, shared_traits: 'Deep set eyes, oval face, medium cheekbones' }, { celebrity: 'John Krasinski',   similarity: 63, shared_traits: 'Square face, wide forehead, average cheekbones' }],
      'soft/round': [{ celebrity: 'Jack Black',       similarity: 72, shared_traits: 'Round face shape, soft jaw, wide nose' }, { celebrity: 'Seth Rogen',       similarity: 65, shared_traits: 'Round cheeks, undefined jaw, close set eyes' }, { celebrity: 'Jonah Hill',       similarity: 60, shared_traits: 'Full face, soft jaw, round cheeks' }],
    },
    female: {
      'strong':     [{ celebrity: 'Angelina Jolie',   similarity: 83, shared_traits: 'High cheekbones, sharp jaw, deep set eyes' }, { celebrity: 'Megan Fox',        similarity: 76, shared_traits: 'Sharp jaw, almond eyes, high cheekbones' }, { celebrity: 'Charlize Theron',  similarity: 70, shared_traits: 'High cheekbones, angular jaw, oval face' }],
      'defined':    [{ celebrity: 'Natalie Portman',  similarity: 80, shared_traits: 'Oval face, defined jaw, almond eyes' }, { celebrity: 'Emma Watson',       similarity: 73, shared_traits: 'Heart face shape, wide forehead, defined jaw' }, { celebrity: 'Zendaya',          similarity: 67, shared_traits: 'High cheekbones, oval face, almond eyes' }],
      'average':    [{ celebrity: 'Jennifer Aniston', similarity: 77, shared_traits: 'Oval face, balanced thirds, straight nose' }, { celebrity: 'Anne Hathaway',     similarity: 70, shared_traits: 'Oval face, wide eyes, average cheekbones' }, { celebrity: 'Sandra Bullock',   similarity: 64, shared_traits: 'Heart face, high forehead, balanced features' }],
      'soft/round': [{ celebrity: 'Adele',            similarity: 74, shared_traits: 'Round face shape, soft jaw, full cheeks' }, { celebrity: 'Rebel Wilson',      similarity: 67, shared_traits: 'Round face, soft jaw, wide cheeks' }, { celebrity: 'Melissa McCarthy', similarity: 61, shared_traits: 'Full face, soft jaw, round face shape' }],
    },
  }
  const resolvedMatches = (celebrityMatches ?? aiScore?.celebrityMatches) ||
    CELEB_FALLBACKS[gender === 'female' ? 'female' : 'male'][facialStructure] ||
    CELEB_FALLBACKS[gender === 'female' ? 'female' : 'male']['average']

  // ─── Skin Analysis ──────────────────────────────────────────────────────────
  const skinScore = faceData?.skinClarity ?? null
  const skinCategory =
    skinScore == null ? null :
    skinScore >= 7.5  ? 'Clear'         :
    skinScore >= 6.0  ? 'Good'          :
    skinScore >= 4.5  ? 'Fair'          :
    skinScore >= 3.5  ? 'Blemish-Prone' : 'Problematic'
  // Only flag issues for scores that actually indicate a problem.
  // Clear skin (7.5+) gets NO problem tags — only maintenance messaging.
  const skinIssues = skinScore == null ? [] : [
    skinScore < 5.5 ? 'acne'         : null,
    skinScore < 4.5 ? 'scarring'      : null,
    skinScore < 6.0 ? 'oiliness'      : null,
    skinScore < 5.0 ? 'dark_circles'  : null,
    skinScore < 6.5 ? 'dullness'      : null,
  ].filter(Boolean)
  const skinIsClear = skinScore != null && skinScore >= 7.5
  const skinPotential = skinScore != null ? Math.min(10, skinScore + (skinScore < 5 ? 2.5 : skinScore < 7 ? 1.8 : 1.2)).toFixed(1) : null

  const SKIN_INGREDIENTS = {
    acne: [{
      name: 'Benzoyl Peroxide 2.5%',
      why: 'Kills acne-causing bacteria (C. acnes) at the source. 2.5% is as effective as 10% with far less irritation.',
      how: 'Apply thin layer to affected areas after cleansing. Start 3×/week, increase to daily as tolerated.',
      when: 'PM only — causes photosensitivity.',
      timeline: '2–4 weeks for reduction. 8–12 weeks for significant clearing.',
      warning: 'Can bleach fabric. Patch test first. Do not use with tretinoin on same night.',
      pillar: 'Clears skin texture — directly raises your Features score.',
    }],
    scarring: [
      { name: 'Vitamin C (L-Ascorbic Acid 15%)', why: 'Inhibits melanin production — fades hyperpigmentation and post-acne marks.', how: 'Apply 3–4 drops to clean dry face. Let absorb 3 min before next step.', when: 'AM — boosts SPF protection and brightens through the day.', timeline: '4–8 weeks visible fading. Full effect in 12 weeks.', warning: 'Unstable — use within 3 months of opening. Store away from light.', pillar: 'Even skin tone reads as more symmetric — improves Harmony score.' },
      { name: 'Alpha Arbutin 2%', why: 'Inhibits tyrosinase (the enzyme that makes dark spots) — gentler than kojic acid.', how: 'Apply 2 drops after toner, before moisturizer.', when: 'AM and PM.', timeline: '6–8 weeks for measurable lightening.', warning: 'Stack with Vitamin C for 2× effect.', pillar: 'Reduces the visual evidence of past breakouts — raises Features score.' },
      { name: 'Retinol 0.3% → 0.5%', why: 'Speeds cell turnover — pushes scarred cells out and builds collagen beneath.', how: 'Rice-grain amount on full face. Start 1×/week, increase to 3× over 6 weeks.', when: 'PM only. Always use SPF next morning.', timeline: 'Visible texture change in 8–16 weeks. Best results at 6+ months.', warning: 'Purging is normal weeks 2–6. Do not combine with AHAs on same night.', pillar: 'Strongest OTC texture intervention — improves Features score long-term.' },
    ],
    oiliness: [{
      name: 'Niacinamide 10%',
      why: 'Regulates sebum production at the sebaceous gland level. Also reduces pore appearance.',
      how: 'Apply 2–3 drops after cleansing, before moisturizer.',
      when: 'AM and PM.',
      timeline: '4–6 weeks for visible pore and oil reduction.',
      warning: 'Do not layer with Vitamin C in the same routine — split AM/PM.',
      pillar: 'Controls shine and pore size — improves skin texture score.',
    }],
    dark_circles: [
      { name: 'Caffeine Eye Cream', why: 'Vasoconstrictor — constricts blood vessels under-eye to reduce dark circles and puffiness.', how: 'Tap gently with ring finger around orbital bone. Never pull the skin.', when: 'AM primarily. Can use PM too.', timeline: 'Immediate de-puffing. Consistent darkening reduction in 6–8 weeks.', warning: 'Will not fix structural dark circles (bone-related) — works on vascular/pigment type.', pillar: 'Improves Eye Area score — directly raises facial attractiveness.' },
      { name: 'Sleep Consistency', why: '7–9 hours reduces cortisol-driven inflammation and blood vessel dilation that causes under-eye darkness.', how: 'Same bedtime and wake time daily including weekends.', when: 'Ongoing.', timeline: 'Visible within 5–7 days of consistent sleep.', warning: 'No product replaces sleep. This is the root fix.', pillar: 'Sleep affects every score — Eye Area, skin clarity, and jawline definition all improve.' },
    ],
    dullness: [{
      name: 'AHA (Glycolic Acid 8% or Lactic Acid 10%)',
      why: 'Exfoliates dead cell layer — reveals brighter, smoother skin underneath.',
      how: 'Apply to dry face after cleansing. Leave 20 min then rinse or leave overnight.',
      when: 'PM 2–3×/week. Never on same night as retinol.',
      timeline: '2 weeks to notice glow. 6 weeks for significant brightness.',
      warning: 'Mandatory SPF next morning — AHAs increase photosensitivity. Start 1×/week.',
      pillar: 'Brightness directly improves perceived skin health — raises overall facial impression.',
    }],
  }

  const skinAMRoutine = skinIsClear ? [
    'Gentle cleanser (CeraVe Hydrating or La Roche-Posay Toleriane)',
    'Vitamin C serum 10–15% (maintains brightness and defends against sun damage)',
    'Lightweight moisturizer',
    'SPF 50 (your #1 long-term anti-aging tool — non-negotiable)',
  ] : [
    'Gentle cleanser (CeraVe or La Roche-Posay)',
    skinIssues.includes('scarring')    ? 'Vitamin C serum 15%'           : null,
    skinIssues.includes('oiliness')    ? 'Niacinamide 10%'               : null,
    skinIssues.includes('dark_circles')? 'Caffeine eye cream'            : null,
    'Lightweight moisturizer',
    'SPF 50 (non-negotiable — all actives require sun protection)',
  ].filter(Boolean)

  const skinPMRoutine = skinIsClear ? [
    'Gentle cleanser',
    'Retinol 0.025–0.05% 2×/week (preventative — maintains smooth texture long-term)',
    'Peptide moisturizer (builds collagen, supports skin firmness)',
  ] : [
    'Gentle cleanser',
    skinIssues.includes('acne')        ? 'Benzoyl Peroxide 2.5% (spot treatment or full face)' : null,
    skinIssues.includes('dullness')    ? 'AHA/glycolic acid 2–3×/week (alternate with retinol)' : null,
    skinIssues.includes('scarring')    ? 'Retinol 0.3% (start 1×/week, build up)'              : null,
    skinIssues.includes('oiliness')    ? 'Niacinamide 10%'               : null,
    'Moisturizer (heavier than AM is fine)',
  ].filter(Boolean)

  // ─── Nutrition Plan (TDEE) ──────────────────────────────────────────────────
  const nutHeightCm = userProfile?.heightCm ?? null
  const nutWeightKg = userProfile?.weightKg ?? null
  const nutGender   = userProfile?.gender ?? gender ?? 'male'
  const nutGoal     = userProfile?.goal ?? null

  const tdee = (() => {
    if (!nutHeightCm || !nutWeightKg) return null
    const age = 25 // default — age not collected in onboarding
    const bmr = nutGender === 'female'
      ? 10 * nutWeightKg + 6.25 * nutHeightCm - 5 * age - 161
      : 10 * nutWeightKg + 6.25 * nutHeightCm - 5 * age + 5
    return Math.round(bmr * 1.55)
  })()

  const nutritionPhase =
    nutGoal === 'Lose Fat' ? 'CUT' :
    nutGoal === 'Build Muscle' ? 'BULK' : 'RECOMP'

  const nutritionTarget = tdee == null ? null :
    nutritionPhase === 'CUT'  ? tdee - 500 :
    nutritionPhase === 'BULK' ? tdee + 300 : tdee

  const proteinTarget = nutWeightKg ? Math.round(nutWeightKg * 2.2 * 0.9) : null

  const nutritionPhaseLabel =
    nutritionPhase === 'CUT'  ? 'Cut Phase' :
    nutritionPhase === 'BULK' ? 'Lean Bulk' : 'Recomp'

  const nutritionProjection =
    nutritionPhase === 'CUT'  ? 'Lose ~1lb/week · improves appearance score +0.8 in 12 weeks' :
    nutritionPhase === 'BULK' ? 'Gain 0.5–1lb/week lean muscle · improves Dimorphism score +0.6 in 12 weeks' :
    'Simultaneous fat loss + muscle gain · improves overall score +0.5 in 12 weeks'

  const nutritionMacros = nutritionTarget ? {
    protein: proteinTarget ?? Math.round((nutritionTarget * 0.35) / 4),
    carbs:   Math.round((nutritionTarget * 0.40) / 4),
    fats:    Math.round((nutritionTarget * 0.25) / 9),
  } : null

  const nutritionFraming = {
    CUT:    { calNote: `${tdee != null ? tdee + ' TDEE' : 'TDEE'} − 500 cal deficit`, pillar: 'Improves your Dimorphism score — lower body fat directly reveals jawline definition and facial bone structure.' },
    BULK:   { calNote: `${tdee != null ? tdee + ' TDEE' : 'TDEE'} + 300 cal surplus`,  pillar: 'Improves your Dimorphism score — muscle mass increases structural masculinity and V-taper expression.' },
    RECOMP: { calNote: `${tdee != null ? tdee + ' TDEE' : 'TDEE'} maintenance calories`, pillar: 'Maintains Harmony score while improving Dimorphism — the most balanced appearance protocol.' },
  }[nutritionPhase]

  function handleShare() {
    setShowShareCard(true)
  }

  return (
    <>
    <Helmet>
      <title>Your AI Appearance Score &amp; Looksmax Results — Ascendus</title>
      <meta name="description" content="See your AI face rating, body composition score, celebrity lookalike matches, and a personalized 12-week looksmax plan built around your results." />
      <meta name="keywords" content="face rating results, AI appearance score, looksmax results, celebrity lookalike, glow up plan, facial analysis" />
    </Helmet>
    {/* Score reveal overlay — shown once for fresh scans */}
    {showReveal && !revealDone && (
      <ScoreReveal
        score={glowScore}
        tier={tier ?? 'Rising'}
        onDone={() => setRevealDone(true)}
      />
    )}
    <MotionPage className="px-4">
      {/* Header */}
      <div className="pt-10 pb-3 flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-primary">Your Results</h1>
          <p className="text-xs text-secondary font-body">
            {new Date(currentScan.analyzedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {gender && <span className="ml-1 capitalize">· {gender}</span>}
          </p>
        </div>
        <button onClick={handleShare} className="w-9 h-9 bg-card border border-default rounded-xl flex items-center justify-center">
          <Share2 size={15} className="text-secondary" />
        </button>
      </div>

      {/* ── Overall Rating (hero) ─────────────────────────────────── */}
      <div className="mb-3">
        <UMaxScoreBadge
          umaxScore={umaxScore ?? 5}
          gender={gender ?? 'male'}
          showScale
        />
      </div>

      {/* Percentile social proof */}
      {glowScore != null && (() => {
        const pct = glowScore >= 8 ? 'top 5%' : glowScore >= 7 ? 'top 15%' : glowScore >= 6 ? 'top 30%' : glowScore >= 5 ? 'top 50%' : 'bottom 40%'
        const col = glowScore >= 7 ? '#34C759' : glowScore >= 5 ? '#C6A85C' : '#E07A5F'
        return (
          <div className="mb-4 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: `${col}0D`, border: `1px solid ${col}25` }}>
            <span className="text-[13px]">📊</span>
            <p className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Your score places you in the <span className="font-bold" style={{ color: col }}>{pct}</span> of men on Ascendus
            </p>
          </div>
        )
      })()}

      {/* ── Score drag alert — free users only, needs pillar data ──── */}
      {!isPremium && pillars && (() => {
        const worst = Object.entries(pillars).reduce((a, b) => (a[1] < b[1] ? a : b))
        const LABELS = { harmony: 'Harmony', angularity: 'Angularity', features: 'Features', dimorphism: 'Dimorphism' }
        const label  = LABELS[worst[0]] ?? worst[0]
        const score  = worst[1]
        if (score > 7) return null
        const impact = Math.min(1.5, (7.5 - score) * 0.15).toFixed(1)
        return (
          <button
            type="button"
            onClick={() => setShowPaywall(true)}
            className="w-full mb-4 px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-left active:opacity-70 transition-opacity"
            style={{ background: 'rgba(224,122,95,0.08)', border: '1px solid rgba(224,122,95,0.2)' }}
          >
            <span className="text-[15px] flex-shrink-0">⚠</span>
            <p className="font-body text-[11px] leading-relaxed flex-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Your <span className="font-bold" style={{ color: '#E07A5F' }}>{label} ({score.toFixed(1)})</span> is your biggest score drag
              {' — '}<span className="font-bold" style={{ color: '#34C759' }}>fixing it adds ~+{impact} pts</span>
              <span style={{ color: '#C6A85C' }}> · See how →</span>
            </p>
          </button>
        )
      })()}

      {/* ── Full Scan / Basic Scan badge ─────────────────────────── */}
      <div className="mb-3 flex justify-center">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-heading font-bold text-[10px] uppercase tracking-wide"
          style={
            hasSideProfile
              ? { background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', color: '#34C759' }
              : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }
          }
        >
          {hasSideProfile ? '✦ Full Scan — Profile Analysis Included' : '◎ Basic Scan — Side Profile Not Included'}
        </div>
      </div>

      {/* ── Score breakdown card ───────────────────────────────────── */}
      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <GlowScoreRing score={glowScore} size="large" animated />
          <div className="flex-1">
            <p className="font-heading font-bold text-base text-primary mb-0.5">Score Breakdown</p>
            <p className="text-xs text-secondary font-body leading-relaxed">
              Face · Appeal · 4 Facial Pillars
            </p>
            <div className="grid gap-2 mt-2.5 grid-cols-2">
              {[
                { label: 'Face',   val: aiScore?.faceScore,    color: '#1A6B5C' },
                { label: 'Appeal', val: aiScore?.groomingScore, color: '#34C759' },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className="font-mono font-bold text-base" style={{ color }}>{val?.toFixed(1) ?? '—'}</p>
                  <p className="text-[9px] text-secondary font-body">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Strengths & Weaknesses ────────────────────────────── */}
      {(aiScore?.keyStrengths?.length > 0 || aiScore?.keyWeaknesses?.length > 0) && (
        <Section title="AI Analysis" emoji="🎯">
          {aiScore?.topImprovement && (
            <div className="mb-3 px-3 py-2.5 rounded-xl bg-[#C6A85C]/10 border border-[#C6A85C]/25">
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-[#C6A85C] mb-0.5">Top Priority</p>
              {isPremium
                ? <p className="text-xs text-primary font-body leading-relaxed">{aiScore.topImprovement}</p>
                : <ProText text={aiScore.topImprovement} onUpgrade={() => navigate('/premium')} />
              }
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 p-3">
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-success mb-2">Strengths</p>
              {aiScore?.keyStrengths?.map((s, i) => (
                <p key={i} className="text-[11px] font-body text-primary leading-snug mb-1 last:mb-0">✓ {s}</p>
              ))}
            </div>
            <div className="rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 p-3">
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-warning mb-2">To Improve</p>
              {aiScore?.keyWeaknesses?.map((w, i) => (
                <p key={i} className="text-[11px] font-body text-primary leading-snug mb-1 last:mb-0">→ {w}</p>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 text-[10px] text-secondary font-body">
              Facial structure: <span className="font-bold capitalize text-primary">{facialStructure}</span>
              {aiScore?.bodyFatLevel && aiScore.bodyFatLevel !== 'not_provided' && <> · Body: <span className="font-bold capitalize text-primary">{aiScore.bodyFatLevel.replace('_', ' ')}</span></>}
            </div>
          </div>
        </Section>
      )}

      {/* ── The 4 Pillars ────────────────────────────────────────── */}
      {pillars && (
        <Section title="The 4 Pillars" emoji="🏛️" defaultOpen={true}>
          <p className="text-[10px] text-secondary font-body mb-3 leading-relaxed">
            Your aesthetic score is built on 4 core pillars — each worth 25% of your overall face rating.
          </p>
          <div className="space-y-0">
            {[
              {
                key: 'harmony', label: 'Harmony', score: pillars.harmony,
                desc: 'How well all features work together as a cohesive visual unit.',
                detail: 'Symmetry · Facial thirds · Overall balance',
              },
              {
                key: 'angularity', label: 'Angularity', score: pillars.angularity,
                desc: 'Sharpness and definition of facial and physical structure.',
                detail: 'Jawline · Cheekbones · Brow ridge · Chin projection',
              },
              {
                key: 'features', label: 'Features', score: pillars.features,
                desc: 'Quality and attractiveness of individual facial features.',
                detail: 'Eyes · Nose · Lips · Skin · Hair',
              },
              {
                key: 'dimorphism', label: 'Dimorphism', score: pillars.dimorphism,
                desc: gender === 'female'
                  ? 'How strongly feminine characteristics are expressed.'
                  : 'How strongly masculine characteristics are expressed.',
                detail: gender === 'female'
                  ? 'Soft features · High cheekbones · Feminine structure'
                  : 'Strong jaw · Hunter eyes · Brow ridge · Definition',
              },
            ].map(({ key, label, score: rawScore, desc, detail }) => {
              const score = rawScore ?? 5.0
              const color = score >= 7 ? '#34C759' : score >= 5 ? '#F5A623' : '#E07A5F'
              const pct = ((score - 1) / 9) * 100
              return (
                <div key={key} className="py-3 border-b border-default last:border-0">
                  <div className="flex items-center gap-3 mb-1.5">
                    {/* Score badge — blurred for free */}
                    {isPremium ? (
                      <div
                        className="w-12 text-center py-1 rounded-lg text-xs font-mono font-bold flex-shrink-0"
                        style={{
                          color,
                          background: score >= 7 ? 'rgba(52,199,89,0.12)' : score >= 5 ? 'rgba(245,166,35,0.12)' : 'rgba(224,122,95,0.12)',
                        }}
                      >
                        {score.toFixed(1)}
                      </div>
                    ) : (
                      <div
                        className="w-12 text-center py-1 rounded-lg text-xs font-mono font-bold flex-shrink-0 select-none cursor-pointer"
                        style={{
                          color,
                          background: 'rgba(245,166,35,0.12)',
                          filter: 'blur(5px)',
                        }}
                        onClick={() => navigate('/premium')}
                      >
                        {score.toFixed(1)}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-heading font-bold text-primary">{label}</p>
                        <p className="text-[9px] text-secondary font-body">{detail}</p>
                      </div>
                      {/* Progress bar — blurred for free */}
                      {isPremium ? (
                        <div className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                          />
                        </div>
                      ) : (
                        <div
                          className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden cursor-pointer select-none"
                          style={{ filter: 'blur(3px)' }}
                          onClick={() => navigate('/premium')}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ background: color, width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{ color: isPremium ? color : 'transparent' }}>
                      /10
                    </span>
                  </div>
                  {isPremium
                    ? <p className="text-[10px] text-secondary font-body leading-relaxed mt-1" style={{ paddingLeft: '60px' }}>{desc}</p>
                    : <div style={{ paddingLeft: '60px' }}><ProText text={desc} onUpgrade={() => navigate('/premium')} /></div>
                  }
                </div>
              )
            })}
          </div>
          {/* Pillar avg */}
          <div className="mt-3 pt-3 border-t border-default flex items-center justify-between">
            <p className="text-[10px] font-heading font-bold text-secondary uppercase tracking-wide">Aesthetic Score (avg)</p>
            <p className="text-sm font-mono font-bold text-primary">
              {((pillars.harmony + pillars.angularity + pillars.features + pillars.dimorphism) / 4).toFixed(1)}/10
            </p>
          </div>
        </Section>
      )}

      {/* ── Face Metrics ─────────────────────────────────────────── */}
      {faceMetrics && (
        <Section title="Face Metrics" emoji="📐" defaultOpen={false}>
          {(() => {
            const mascFemLabel = gender === 'female' ? 'Femininity' : 'Masculinity'
            const metrics = [
              { key: 'jawline',               label: 'Jawline',        data: faceMetrics.jawline,               pro: false },
              { key: 'symmetry',              label: 'Symmetry',       data: faceMetrics.symmetry,              pro: false },
              { key: 'cheekbones',            label: 'Cheekbones',     data: faceMetrics.cheekbones,            pro: true  },
              { key: 'skinQuality',           label: 'Skin Quality',   data: faceMetrics.skinQuality,           pro: true  },
              { key: 'mascFem',               label: mascFemLabel,     data: faceMetrics.masculinityFemininity, pro: true  },
              { key: 'facialThirds',          label: 'Facial Thirds',  data: faceMetrics.facialThirds,          pro: true  },
            ]
            const locked4Count = metrics.filter(m => m.pro && !isPremium && m.data).length
            return (
              <>
                <p className="text-[10px] text-secondary font-body mb-3 leading-relaxed">
                  AI-scored breakdown of your individual facial features.
                  {!isPremium && locked4Count > 0 && <span style={{ color: '#C6A85C' }}> {locked4Count} metrics locked — upgrade to Pro to unlock.</span>}
                </p>
                {metrics.map(({ key, label, data, pro }) =>
                  data ? (
                    <FaceMetricBar
                      key={key}
                      label={label}
                      score={data.score}
                      descriptor={data.descriptor}
                      locked={pro && !isPremium}
                      onUpgrade={() => navigate('/premium')}
                    />
                  ) : null
                )}
              </>
            )
          })()}
        </Section>
      )}

      {/* ── Face Feature Breakdown ────────────────────────────────── */}
      <Section title="Face Feature Breakdown" emoji="👤" defaultOpen={false}>
        <div className="space-y-0">
          {[
            { label: 'Facial Symmetry', score: faceData?.symmetry, note: 'Sleeping on your back, correcting dominant chewing side, and fixing posture all improve symmetry over time.' },
            { label: 'Jawline Definition', score: faceData?.jawlineDefinition, note: 'Correlates directly with body fat %. Reducing body fat dramatically reveals the jawline. Mewing for long-term structural improvement.' },
            { label: 'Skin Clarity', score: faceData?.skinClarity, note: 'Consistent cleanser → treatment → moisturizer → SPF routine produces visible change in 4–8 weeks. Retinol or tretinoin accelerates results.' },
            { label: 'Facial Proportions', score: faceData?.facialProportions, note: 'Ideal face has equal facial thirds. Structural — address via mewing, hairstyle, beard length.' },
            { label: 'Eye Area', score: faceData?.eyeArea, note: 'Addressed via sleep, hydration, targeted eye cream, and strategic brow grooming. Sleep consistency is #1.' },
            { label: 'Overall Harmony', score: faceData?.facialHarmony, note: 'How all facial features read together. Improves as individual metrics improve — grooming and skincare have the fastest ROI.' },
          ].filter(m => m.score != null).map(m => (
            <ScoreRow key={m.label} label={m.label} score={m.score} note={m.note} isPremium={isPremium} onUpgrade={() => navigate('/premium')} />
          ))}
        </div>
      </Section>

      {/* ── Profile Analysis (side profile scan) ────────────────── */}
      {hasSideProfile && profileData && (
        <Section title="Profile Analysis" emoji="↗️" defaultOpen={false} badge="FULL">
          {/* Profile score row */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.18)' }}>
            <div className="text-center flex-shrink-0">
              <div
                className="text-2xl font-mono font-bold"
                style={{ color: profileScore >= 7 ? '#34C759' : profileScore >= 5 ? '#F5A623' : '#E07A5F' }}
              >
                {profileScore != null ? profileScore.toFixed(1) : '—'}
              </div>
              <div className="text-[9px] font-body text-secondary">/ 10</div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-heading font-bold text-primary">Profile Score</p>
              <p className="text-[10px] text-secondary font-body leading-snug mt-0.5">
                Assessed from your right-side profile photo · nose bridge, jaw projection, chin depth
              </p>
            </div>
          </div>

          {/* Profile metrics grid */}
          <div className="space-y-0">
            {[
              {
                key: 'nose_bridge',
                label: 'Nose Bridge',
                value: profileData.nose_bridge,
                descriptions: {
                  'high':     'High nose bridge — adds strong vertical definition and perceived structure to the mid-face.',
                  'medium':   'Average nose bridge height — proportional and balanced with your other features.',
                  'low':      'Low nose bridge — sits flatter on the profile; rhinoplasty or contouring can enhance this.',
                  'straight': 'Straight nose bridge profile — clean, balanced line that reads well in photos.',
                  'convex':   'Convex (Roman) nose profile — adds character and masculine distinction.',
                  'concave':  'Concave nose bridge — slightly upturned profile; generally considered a feminine trait.',
                },
                color: '#A29BFE',
              },
              {
                key: 'jawline_projection',
                label: 'Jawline Projection',
                value: profileData.jawline_projection,
                descriptions: {
                  'strong':   'Strong jaw projection — highly attractive from the side. One of the top masculine structural traits.',
                  'moderate': 'Moderate jaw projection — solid structural base. Mewing and chewing hard foods can improve this over time.',
                  'weak':     'Weak jaw projection — the jaw recedes behind the nose. Mewing, dental work, or corrective surgery addresses this.',
                  'recessed': 'Recessed jaw (retrognathia) — the chin and jaw sit back significantly. Orthognathic surgery is the definitive fix.',
                },
                color: '#F5A623',
              },
              {
                key: 'chin_projection',
                label: 'Chin Projection',
                value: profileData.chin_projection,
                descriptions: {
                  'ideal':      'Ideal chin projection — chin tip aligns with or slightly behind the lower lip when viewed from the side.',
                  'strong':     'Strong chin projection — prominent and forward. A highly attractive masculine trait from the side.',
                  'moderate':   'Moderate chin projection — slightly behind ideal. Chin exercises and mewing can marginally improve over time.',
                  'weak':       'Weak chin projection — chin recesses behind the lower lip. Chin filler or implant is the fastest solution.',
                  'recessed':   'Significantly recessed chin — noticeably soft from the side. This is capping your profile score the most.',
                },
                color: '#34C759',
              },
            ].map(({ key, label, value, descriptions, color }) => {
              const desc = value && descriptions[value]
                ? descriptions[value]
                : `${label} assessment not available.`
              const valueLabel = value
                ? value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ')
                : '—'
              const scoreVal = profileData[`${key}_score`] ?? null
              return (
                <div key={key} className="py-3 border-b border-default last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="px-2 py-0.5 rounded-md text-[10px] font-heading font-bold flex-shrink-0"
                      style={{ background: `${color}18`, color }}
                    >
                      {valueLabel}
                    </div>
                    <p className="text-sm font-heading font-bold text-primary flex-1">{label}</p>
                    {scoreVal != null && (
                      <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{ color }}>
                        {scoreVal.toFixed(1)}/10
                      </span>
                    )}
                  </div>
                  {isPremium
                    ? <p className="text-[10px] text-secondary font-body leading-relaxed">{desc}</p>
                    : <ProText text={desc} onUpgrade={() => navigate('/premium')} />
                  }
                </div>
              )
            })}
          </div>

          {/* Profile improvement note */}
          {profileScore != null && profileScore < 7 && (
            <div className="mt-3 rounded-xl p-3 border" style={{ borderColor: 'rgba(198,168,92,0.3)', background: 'rgba(198,168,92,0.06)' }}>
              <p className="text-[9px] font-heading font-bold uppercase tracking-wide mb-1" style={{ color: '#C6A85C' }}>
                Profile Improvement
              </p>
              <p className="text-[10px] font-body text-primary leading-relaxed">
                {profileScore < 5
                  ? 'Profile structure is significantly impacting your score. Mewing (tongue posture), jaw exercises, and reducing body fat are the highest-ROI non-surgical interventions. Consult an orthodontist if jaw recession is significant.'
                  : 'Mewing and hard chewing foods (2–3 minutes daily) can improve jaw projection over 6–12 months. Maintaining low body fat reveals existing jaw structure.'}
              </p>
            </div>
          )}
        </Section>
      )}


      {/* ── Hairstyle Recommendations ─────────────────────────────── */}
      <Section title="Hairstyle Recommendations" emoji="✂️" defaultOpen={false}>
        <div className="mb-2">
          {/* Hair type selector — shown when AI couldn't detect or user wants to override */}
          {(!resolvedHT || resolvedHT) && (
            <div className="mb-4">
              {aiDetectedHairType ? (
                <p className="text-[10px] text-secondary font-body mb-2">
                  AI detected: <span style={{ color: '#C6A85C' }} className="font-semibold capitalize">{aiDetectedHairType}</span> · tap to change
                </p>
              ) : (
                <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: '#C6A85C' }}>
                  Select your hair type for accurate recommendations
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {HAIR_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setHairType(opt.value)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-heading font-semibold border transition-all"
                    style={resolvedHT === opt.value
                      ? { background: 'linear-gradient(135deg, #FFD700, #C6A85C)', color: '#000', borderColor: '#C6A85C' }
                      : { background: 'transparent', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.12)' }
                    }
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hairRec ? (
            <>
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-[#C6A85C] mb-0.5">{hairRec.label}</p>
              <p className="text-xs text-secondary font-body leading-relaxed mb-3">{hairRec.advice}</p>
              <div className="space-y-2">
                {hairRec.cuts.map((cut, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(198,168,92,0.15)' }}
                    >
                      <span className="text-[10px] font-bold" style={{ color: '#C6A85C' }}>{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-xs font-heading font-bold text-primary">{cut.name}</p>
                      <p className="text-[10px] text-secondary font-body mt-0.5">{cut.why}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20">
                <p className="text-[10px] text-warning font-body"><span className="font-bold">Avoid:</span> {hairRec.avoid}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-secondary font-body text-center py-4">
              Select your hair type above to get personalized recommendations.
            </p>
          )}
        </div>
      </Section>

      {/* ── Celebrity Lookalikes ──────────────────────────────────── */}
      <Section title="Celebrity Lookalikes" emoji="⭐" defaultOpen={false}>
        <div className="space-y-0">
          {resolvedMatches.map((match, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-default last:border-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-heading font-bold text-sm"
                style={{ background: 'rgba(198,168,92,0.15)', color: '#C6A85C' }}
              >
                {match.celebrity?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1">
                {/* Name always visible */}
                <p className="text-sm font-heading font-bold text-primary">{match.celebrity}</p>
                {/* Shared traits — blurred for free */}
                {(match.shared_traits || match.reason) && (
                  isPremium ? (
                    <p className="text-[10px] font-body mt-0.5" style={{ color: '#C6A85C', opacity: 0.8 }}>
                      {match.shared_traits || match.reason}
                    </p>
                  ) : (
                    <p
                      className="text-[10px] font-body mt-0.5 select-none"
                      style={{ color: '#C6A85C', opacity: 0.5, filter: 'blur(4px)' }}
                    >
                      {match.shared_traits || match.reason}
                    </p>
                  )
                )}
                {/* Similarity bar — blurred for free */}
                {isPremium ? (
                  <div className="mt-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #C6A85C, #F5A623)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${match.similarity}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: i * 0.15 }}
                    />
                  </div>
                ) : (
                  <div
                    className="mt-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden select-none cursor-pointer"
                    style={{ filter: 'blur(3px)' }}
                    onClick={() => navigate('/premium')}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #C6A85C, #F5A623)', width: `${match.similarity}%` }}
                    />
                  </div>
                )}
              </div>
              {/* Similarity % — blurred for free */}
              {isPremium ? (
                <span className="text-xs font-mono font-bold text-[#C6A85C] flex-shrink-0">{match.similarity}%</span>
              ) : (
                <span
                  className="text-xs font-mono font-bold text-[#C6A85C] flex-shrink-0 select-none cursor-pointer"
                  style={{ filter: 'blur(5px)' }}
                  onClick={() => navigate('/premium')}
                >
                  {match.similarity}%
                </span>
              )}
            </div>
          ))}
        </div>
        {!isPremium && (
          <button
            onClick={() => navigate('/premium')}
            className="mt-3 w-full py-2 rounded-xl text-[11px] font-heading font-bold flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.2)', color: '#C6A85C' }}
          >
            🔒 Unlock similarity % and shared traits with PRO
          </button>
        )}
      </Section>

      {/* ── Skin Analysis ────────────────────────────────────────── */}
      {skinScore != null && (
        <Section title="Skin Analysis" emoji="🧬" defaultOpen={false} badge="PRO">
          {/* Free: score + category */}
          <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.18)' }}>
            <div className="text-center flex-shrink-0">
              <div className="text-2xl font-mono font-bold" style={{ color: skinScore >= 7.5 ? '#34C759' : skinScore >= 5 ? '#F5A623' : '#E07A5F' }}>
                {skinScore.toFixed(1)}
              </div>
              <div className="text-[9px] font-body text-secondary">/10</div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-heading font-bold text-primary">{skinCategory}</p>
              <p className="text-[10px] text-secondary font-body leading-snug">
                {skinIsClear
                  ? 'Your skin is in great condition. Focus on maintaining with SPF and hydration.'
                  : skinIssues.length > 0
                    ? `Detected: ${skinIssues.map(i => i.replace('_', ' ')).join(', ')}`
                    : 'No major skin issues detected'}
              </p>
              {!skinIsClear && skinPotential && (
                <p className="text-[10px] font-body mt-0.5" style={{ color: '#C6A85C' }}>
                  With this routine: {skinScore.toFixed(1)} → {skinPotential} skin score
                </p>
              )}
            </div>
          </div>

          {/* Pro: full ingredient protocol */}
          {isPremium ? (
            <div className="space-y-4">
              {skinIsClear && (
                <div className="p-3 rounded-xl" style={{ background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.2)' }}>
                  <p className="text-[11px] font-heading font-bold mb-1" style={{ color: '#34C759' }}>✓ Clear Skin Maintenance Protocol</p>
                  <p className="text-[10px] text-secondary font-body leading-relaxed">
                    Your skin is clear — the goal now is preservation, not treatment. Daily SPF 50 prevents photoaging (the #1 cause of visible skin decline). A low-dose retinol 2×/week maintains smooth texture over time. Vitamin C each morning fights oxidative damage and keeps tone even.
                  </p>
                </div>
              )}
              {!skinIsClear && skinIssues.map(issue => {
                const ingredients = SKIN_INGREDIENTS[issue]
                if (!ingredients) return null
                const list = Array.isArray(ingredients) ? ingredients : [ingredients]
                return (
                  <div key={issue}>
                    <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: '#C6A85C' }}>
                      {issue === 'dark_circles' ? 'Dark Circles' : issue.charAt(0).toUpperCase() + issue.slice(1)} Protocol
                    </p>
                    {list.map((ing, i) => (
                      <div key={i} className="mb-2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-[12px] font-heading font-bold text-primary mb-1">{ing.name}</p>
                        <p className="text-[10px] text-secondary font-body leading-relaxed mb-1"><span className="font-bold text-primary">Why:</span> {ing.why}</p>
                        <p className="text-[10px] text-secondary font-body leading-relaxed mb-1"><span className="font-bold text-primary">How:</span> {ing.how}</p>
                        <p className="text-[10px] text-secondary font-body leading-relaxed mb-1"><span className="font-bold text-primary">When:</span> {ing.when}</p>
                        <p className="text-[10px] text-secondary font-body leading-relaxed mb-1"><span className="font-bold text-primary">Timeline:</span> {ing.timeline}</p>
                        {ing.warning && <p className="text-[10px] text-warning font-body leading-relaxed mb-1"><span className="font-bold">⚠ Note:</span> {ing.warning}</p>}
                        <p className="text-[10px] font-body leading-relaxed mt-1.5" style={{ color: '#C6A85C' }}>Score impact: {ing.pillar}</p>
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* AM/PM Routine */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)' }}>
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: '#F5A623' }}>AM Routine</p>
                  {skinAMRoutine.map((step, i) => (
                    <p key={i} className="text-[10px] font-body text-secondary leading-snug mb-1">
                      {i + 1}. {step}
                    </p>
                  ))}
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(108,92,231,0.07)', border: '1px solid rgba(108,92,231,0.18)' }}>
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: '#A29BFE' }}>PM Routine</p>
                  {skinPMRoutine.map((step, i) => (
                    <p key={i} className="text-[10px] font-body text-secondary leading-snug mb-1">
                      {i + 1}. {step}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden">
              <div className="blur-sm pointer-events-none select-none opacity-35 space-y-2">
                {['Benzoyl Peroxide 2.5% — PM only, kills acne bacteria at source', 'Niacinamide 10% — AM + PM, regulates sebum and pore size', 'AHA Exfoliant — 2×/week PM, removes dead cells revealing brightness', 'AM Routine: Cleanser → Vit C → Moisturizer → SPF 50', 'PM Routine: Cleanser → BHA → Niacinamide → Moisturizer'].map((line, i) => (
                  <div key={i} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                    <p className="text-[10px] font-body text-primary">{line}</p>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl">
                <Lock size={18} className="text-[#C6A85C] mb-2" />
                <p className="font-heading font-bold text-sm text-primary mb-0.5">Pro Feature</p>
                <p className="text-[11px] text-secondary font-body mb-3 text-center px-4">Full ingredient protocol + AM/PM routine built from your skin scan</p>
                <button onClick={() => navigate('/premium')} className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-black" style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)' }}>
                  Upgrade to Pro →
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Personalized Product Stack ────────────────────────────── */}
      <ProductStack
        isPremium={isPremium}
        weaknesses={aiScore?.keyWeaknesses ?? []}
        skinIssues={skinIssues}
        groomingScore={aiScore?.groomingScore ?? null}
        pillars={pillars}
        gender={gender}
        onUpgrade={() => navigate('/premium')}
      />

      {/* ── Nutrition Plan ────────────────────────────────────────── */}
      <Section title="Nutrition Plan" emoji="🥩" defaultOpen={false} badge="PRO">
        {/* Free: calorie target + phase label */}
        <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)' }}>
          <div className="text-center flex-shrink-0">
            {nutritionTarget ? (
              <>
                <div className="text-2xl font-mono font-bold" style={{ color: '#F5A623' }}>{nutritionTarget.toLocaleString()}</div>
                <div className="text-[9px] font-body text-secondary">cal/day</div>
              </>
            ) : (
              <div className="text-sm font-heading font-bold text-secondary">—</div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-heading font-bold text-primary">{nutritionPhaseLabel}</p>
            <p className="text-[10px] text-secondary font-body leading-snug mt-0.5">{nutritionProjection}</p>
            {!nutritionTarget && (
              <p className="text-[10px] text-secondary font-body mt-1">Complete your height/weight in onboarding for exact targets.</p>
            )}
          </div>
        </div>

        {/* Pro: full breakdown */}
        {isPremium ? (
          <div className="space-y-3">
            {nutritionFraming && (
              <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-secondary mb-1">How This Works</p>
                <p className="text-[11px] font-body text-primary leading-relaxed">
                  <span className="font-bold">{nutritionFraming.calNote}</span>
                  {tdee && nutritionTarget && nutritionPhase !== 'RECOMP' && (
                    <> — a {Math.abs(nutritionTarget - tdee)} cal/day {nutritionPhase === 'CUT' ? 'deficit' : 'surplus'}.</>
                  )}
                </p>
                <p className="text-[10px] text-secondary font-body mt-1 leading-relaxed">{nutritionFraming.pillar}</p>
              </div>
            )}

            {nutritionMacros && (
              <div>
                <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-secondary mb-2">Daily Macro Targets</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Protein', value: nutritionMacros.protein + 'g', color: '#E07A5F', note: '~1g/lb bodyweight' },
                    { label: 'Carbs',   value: nutritionMacros.carbs   + 'g', color: '#F5A623', note: 'fuel + performance' },
                    { label: 'Fats',    value: nutritionMacros.fats    + 'g', color: '#34C759', note: 'hormones + skin' },
                  ].map(({ label, value, color, note }) => (
                    <div key={label} className="text-center p-2.5 rounded-xl" style={{ background: `${color}11`, border: `1px solid ${color}30` }}>
                      <div className="text-base font-mono font-bold" style={{ color }}>{value}</div>
                      <div className="text-[9px] font-heading font-bold text-secondary">{label}</div>
                      <div className="text-[8px] text-secondary font-body mt-0.5">{note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-secondary">Appearance Framing</p>
              {[
                nutritionPhase === 'CUT'  && { label: 'Jawline',    text: 'Every 1% body fat drop reveals more bone structure. Lower body fat = more defined jaw = higher Dimorphism score.' },
                nutritionPhase === 'CUT'  && { label: 'V-Taper',    text: 'As waist shrinks, your shoulder-to-waist ratio improves automatically — even without new muscle.' },
                nutritionPhase === 'BULK' && { label: 'Dimorphism', text: 'Muscle mass increases masculine structural expression — Dimorphism is the single pillar most responsive to muscle gain.' },
                nutritionPhase === 'BULK' && { label: 'V-Taper',    text: 'Shoulder and lat growth in surplus widens your silhouette faster than in recomp.' },
                { label: 'Protein (all phases)', text: `Hit ${proteinTarget ?? '~160'}g protein/day. Protein preserves muscle during cuts, builds it during bulks, and directly improves skin texture and collagen over time.` },
              ].filter(Boolean).map(({ label, text }, i) => (
                <div key={i} className="flex gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(198,168,92,0.15)' }}>
                    <span className="text-[9px] font-bold" style={{ color: '#C6A85C' }}>→</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-heading font-bold text-primary mb-0.5">{label}</p>
                    <p className="text-[10px] text-secondary font-body leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden">
            <div className="blur-sm pointer-events-none select-none opacity-35 space-y-2">
              {['Protein: 165g/day · 1g per lb bodyweight for appearance optimization', 'Carbs: 220g/day · Fuel training and recovery', 'Fats: 65g/day · Hormone production + skin health', 'Cut: −500 cal deficit · Lose 1lb/week, reveals jawline structure', 'Jawline unlocks: Every 1% body fat drop reveals more bone definition'].map((line, i) => (
                <div key={i} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <p className="text-[10px] font-body text-primary">{line}</p>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl">
              <Lock size={18} className="text-[#C6A85C] mb-2" />
              <p className="font-heading font-bold text-sm text-primary mb-0.5">Pro Feature</p>
              <p className="text-[11px] text-secondary font-body mb-3 text-center px-4">Full macro breakdown framed around appearance improvement — not generic health advice</p>
              <button onClick={() => navigate('/premium')} className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-black" style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)' }}>
                Upgrade to Pro →
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* ── Legal Disclaimers ─────────────────────────────────────── */}
      <div className="space-y-2 mb-4">
        {/* Wellness disclaimer */}
        <div className="px-4 py-3.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] font-body leading-relaxed text-secondary">
            💛 <span className="font-semibold text-primary">Wellbeing:</span> These scores are tools for self-improvement, not measures of your worth. If you are struggling with body image or mental health, please speak to a professional.
          </p>
        </div>
        {/* AI disclosure */}
        <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] font-body leading-relaxed text-secondary">
            🤖 <span className="font-semibold text-primary">AI Analysis:</span> Scores are generated by AI and are estimates only — not medical or clinical assessments. Results may vary.
          </p>
        </div>
        {/* Celebrity disclaimer */}
        <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] font-body leading-relaxed text-secondary">
            ⭐ <span className="font-semibold text-primary">Celebrity comparisons</span> are AI-generated estimates and do not imply any connection to or endorsement by the named individuals.
          </p>
        </div>
      </div>

      {/* ── CTAs ──────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-1" style={{ paddingBottom: !isPremium && !showPaywall ? '112px' : '32px' }}>
        <button
          onClick={() => setShowShareCard(true)}
          className="w-full py-4 rounded-2xl font-heading font-bold text-base text-black flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #FFD700, #C6A85C)' }}
        >
          <Share2 size={17} />
          Share Your Results Card
        </button>
        {isPremium && (
          <>
            <button onClick={() => navigate('/plan')} className="btn-primary flex items-center justify-center gap-2">
              See My 12-Week Roadmap <ArrowRight size={15} />
            </button>
            <button onClick={() => navigate('/scan')} className="btn-ghost border border-default">
              Take Another Scan
            </button>
          </>
        )}
      </div>
    </MotionPage>

    {/* ── Free tier sticky bottom CTA ──────────────────────────── */}
    {!isPremium && !showPaywall && (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-3"
        style={{
          background: 'linear-gradient(to top, rgba(8,6,4,0.98) 70%, rgba(8,6,4,0))',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('/referral')}
            className="py-3.5 rounded-2xl font-heading font-bold text-[13px] flex items-center justify-center gap-1.5"
            style={{
              background: 'rgba(198,168,92,0.10)',
              border: '1px solid rgba(198,168,92,0.30)',
              color: '#C6A85C',
            }}
          >
            🎁 Share 5 Friends
          </button>
          <button
            onClick={() => setShowPaywall(true)}
            className="py-3.5 rounded-2xl font-heading font-bold text-[13px] flex items-center justify-center gap-1.5 text-black"
            style={{
              background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)',
              boxShadow: '0 4px 16px rgba(198,168,92,0.3)',
            }}
          >
            Start Free Trial
          </button>
        </div>
      </div>
    )}

    {/* ── Share Card Modal ──────────────────────────────────────── */}
    <AnimatePresence>
      {showShareCard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <ShareCardModal
            scan={currentScan}
            isPremium={isPremium}
            facePhotoUrl={pendingFacePhoto ?? currentScan?.facePhotoUrl}
            phase={assignedPhase}
            onClose={() => setShowShareCard(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Paywall (free users) ──────────────────────────────────── */}
    <AnimatePresence>
      {showPaywall && !isPremium && (
        <PaywallSheet
          glowScore={glowScore}
          pillars={pillars}
          gender={gender ?? 'male'}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </AnimatePresence>
    </>
  )
}
