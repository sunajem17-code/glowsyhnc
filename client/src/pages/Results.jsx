import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion'
import { Share2, ArrowRight, ChevronDown, ChevronUp, ChevronRight, Lock, ShoppingBag, ExternalLink, Sparkles, Camera, BarChart2, Star, AlertTriangle, Target, Columns, Ruler, User, ArrowUpRight, Scissors, FlaskConical, Heart, Gift, Bot, Flame, Zap, TrendingUp, Dumbbell, Map, Home } from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import logo from '../assets/ascendus-icon.png'
import GlowScoreRing from '../components/GlowScoreRing'
import UMaxScoreBadge from '../components/UMaxScoreBadge'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import ShareCardModal from '../components/ShareCardModal'
import DevRankCard from '../components/DevRankCard'
import ProLock from '../components/ProLock'
import PromoModal from '../components/PromoModal'
import { scoreColor } from '../utils/analysis'
import { isNative, purchasePro, restorePurchases } from '../utils/iap'
import { GOLD_GRADIENT, RED } from '../utils/theme'

// Keys must match tier.label values from analysis.js MALE_TIERS / FEMALE_TIERS
const TIER_COLORS = {
  // Male tiers
  'Sub 3':               '#6B7280',
  'Low Tier Normie':     '#9CA3AF',
  'Mid Tier Normie':     '#60A5FA',
  'High Tier Normie':    '#34D399',
  'Chadlite':            '#F59E0B',
  'Chad':                '#EF4444',
  'Adam Lite':           '#DDA0FF',
  'True Adam':           '#FFD700',
  // Female tiers
  'Low Tier Becky':      '#9CA3AF',
  'Mid Tier Becky':      '#60A5FA',
  'High Tier Becky':     '#34D399',
  'Stacy':               '#F59E0B',
  'Eve':                 '#EF4444',
  'Eve Lite':            '#DDA0FF',
  'True Eve':            '#FFD700',
}

function ScoreReveal({ score, tier, onDone }) {
  const reducedMotion = useReducedMotion()
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

  const getScoreIcon = (s) => s >= 8.5 ? <Flame size={40} style={{ color: '#FF6B35' }} /> : s >= 7 ? <Zap size={40} style={{ color: '#F5A623' }} /> : s >= 5 ? <TrendingUp size={40} style={{ color: '#34C759' }} /> : <Dumbbell size={40} style={{ color: '#60A5FA' }} />

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
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reducedMotion ? { duration: 0.2, ease: 'easeOut' } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reducedMotion ? { duration: 0.2, ease: 'easeOut' } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 text-center"
              >
                <div className="flex justify-center mb-2">{getScoreIcon(score ?? 0)}</div>
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
      advice: 'Versatile face shape. Most styles work. Aim for clean execution.',
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
      advice: 'Elite bone structure. Almost any style works.',
      cuts: [
        { name: 'Caesar Cut', why: 'Timeless for strong jaw and brow ridge' },
        { name: 'Modern Pompadour', why: 'Commands attention, pairs with structure' },
        { name: 'French Crop / Buzz', why: 'Both showcase structure without fighting it' },
      ],
      avoid: 'Messy, unkempt styles. The only thing that can pull you down',
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
      avoid: 'Letting waves grow out wide on the sides. Widens the face',
    },
    average: {
      label: 'Average Face · Wavy Hair',
      advice: 'Wavy texture is versatile. Lean into natural movement.',
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
      avoid: 'Over-product and helmet hair. Your natural texture is the asset',
    },
  },

  // ── Curly (Type 3 — 3a/3b/3c) ────────────────────────────────────────────
  curly: {
    'soft/round': {
      label: 'Round Face · Curly Hair',
      advice: 'Height is your best friend. Keep the sides tapered and stack volume upward.',
      cuts: [
        { name: 'Curly Top Fade', why: 'Volume stays on top, sides stay tight. Elongates face' },
        { name: 'Defined Curl with Taper', why: 'Structure and definition prevent width-spreading' },
        { name: 'Curly Fringe Forward', why: 'Brings the eye forward and down, reducing roundness' },
      ],
      avoid: 'Wide curly afro shapes or letting sides grow out. Adds width to an already wide face',
    },
    average: {
      label: 'Average Face · Curly Hair',
      advice: 'Lucky. Curly hair works well here. Focus on definition and moisture.',
      cuts: [
        { name: 'Curly Top Fade', why: 'Clean and modern, suits the balanced shape' },
        { name: 'Defined Curl Afro', why: 'Natural texture shines with balanced proportions' },
        { name: 'Curtain Curls', why: 'Soft and flattering, works with curl pattern' },
      ],
      avoid: 'Letting curls dry out and frizz. Definition is everything',
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
      advice: 'Elite structure + curls is a rare combo. Own it.',
      cuts: [
        { name: 'High Fade with Curly Top', why: 'Maximizes the contrast with strong bone structure' },
        { name: 'Defined Full Curl', why: 'Volume complements without overpowering the face' },
        { name: 'Curly Caesar', why: 'Classic cut adapted for curls. Sharp and confident' },
      ],
      avoid: 'Messy, undefined frizz. Define those curls with product',
    },
  },

  // ── Coily / Afro (Type 4 — 4a/4b/4c) ────────────────────────────────────
  coily: {
    'soft/round': {
      label: 'Round Face · Coily/Afro Hair',
      advice: 'Stack all height upward. Taper the sides tight to elongate and define.',
      cuts: [
        { name: 'High Top Fade', why: 'Adds dramatic height. Elongates the face significantly' },
        { name: 'Afro with Tapered Sides', why: 'Volume on top, tight sides. The ideal round-face afro' },
        { name: 'Twist Out with Fade', why: 'Structured definition adds length and reduces width perception' },
      ],
      avoid: 'Full rounded afro with no tapering. It mirrors the round face and doubles the width',
    },
    average: {
      label: 'Average Face · Coily/Afro Hair',
      advice: 'Almost anything works. Shadow fade with afro or locs is a signature look.',
      cuts: [
        { name: 'Shadow Fade with Afro', why: 'Clean gradient keeps the look sharp and balanced' },
        { name: 'Tapered Afro', why: 'Natural volume with clean edges. Timeless' },
        { name: 'Twist Out', why: 'Definition and texture, suits the balanced proportions' },
      ],
      avoid: 'Neglected edges. Line-ups make or break the afro look',
    },
    defined: {
      label: 'Defined Face · Coily/Afro Hair',
      advice: 'Sharp angles + coily texture is a powerful combination.',
      cuts: [
        { name: 'Soft Afro with Rounded Top', why: 'The softness contrasts and complements sharp angles' },
        { name: 'Mid Fade with Afro Top', why: 'Structure on the sides highlights the jawline' },
        { name: 'Twist Out Natural', why: 'Texture adds softness without hiding structure' },
      ],
      avoid: 'Flat tops or extremely angular cuts. Competes with the face, not complements it',
    },
    strong: {
      label: 'Strong Structure · Coily/Afro Hair',
      advice: 'Elite bones + afro texture = powerful and distinctive.',
      cuts: [
        { name: 'Full Afro', why: 'Volume frames the strong structure with authority' },
        { name: 'High Top Fade', why: 'Dramatic height amplifies the bone structure' },
        { name: 'Tapered Sides with Volume Top', why: 'Maximizes contrast and showcases structure' },
      ],
      avoid: 'Unkempt or neglected texture. Moisture and definition are non-negotiable',
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
      avoid: 'Locs worn fully down and loose. Adds width at jaw level',
    },
    average: {
      label: 'Average Face · Locs',
      advice: 'Locs suit balanced faces at any length. Maintain them well.',
      cuts: [
        { name: 'Mid-Length Locs Any Style', why: 'Balanced face handles any loc length or style' },
        { name: 'Long Locs Worn Back', why: 'Elongates face and looks polished' },
        { name: 'Short Locs with Line-Up', why: 'Clean and structured. Sharp presentation' },
      ],
      avoid: 'Neglected, frizzy locs without moisture or retwisting. Upkeep is everything',
    },
    defined: {
      label: 'Defined Face · Locs',
      advice: 'Sharp structure + locs is an iconic combination.',
      cuts: [
        { name: 'Loc Mohawk', why: 'Adds angularity that complements sharp features' },
        { name: 'Short Locs Fade', why: 'Precision edges match the precision of the face' },
        { name: 'Mid-Length Locs Worn Up', why: 'Height enhances vertical length of a defined face' },
      ],
      avoid: 'Flat, fully down locs that cover the jawline. Show it off',
    },
    strong: {
      label: 'Strong Structure · Locs',
      advice: 'Strong bone structure wears every loc style with authority.',
      cuts: [
        { name: 'Long Locs Worn Down', why: 'Elongates and frames elite structure' },
        { name: 'Long Locs Worn Back', why: 'Full exposure of the structure. Nothing to hide' },
        { name: 'Mid-Length Locs Any Style', why: 'Structure carries any length effortlessly' },
      ],
      avoid: 'Over-accessorizing locs. The face and locs speak for themselves',
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
      avoid: 'Clean-shaven bald. Removes all structure from the face at once',
    },
    average: {
      label: 'Average Face · Bald/Shaved',
      advice: 'Bald works on a balanced face. Maintain skin and beard sharp.',
      cuts: [
        { name: 'Clean Bald with Beard', why: 'Classic combination. Confident and sharp' },
        { name: 'Stubble Bald', why: 'Low maintenance, always looks intentional' },
        { name: 'Shadow Fade to Bald', why: 'Gradual transition looks deliberate not receding' },
      ],
      avoid: 'Patchy or ungroomed beard. If you go bald, the beard must be sharp',
    },
    defined: {
      label: 'Defined Face · Bald/Shaved',
      advice: 'Strong structure is amplified bald. This is the power move.',
      cuts: [
        { name: 'Clean Shaved Bald', why: 'Maximum structure exposure. The Vin Diesel effect' },
        { name: 'Bald with Sharp Beard', why: 'Defines the jaw even further' },
        { name: 'Shadow Fade to Skin', why: 'Polished look that highlights structure' },
      ],
      avoid: 'Anything that looks accidental. Commit fully to the look',
    },
    strong: {
      label: 'Strong Structure · Bald/Shaved',
      advice: 'Elite structure bald is the highest tier aesthetic. No hair needed.',
      cuts: [
        { name: 'Clean Bald', why: 'Nothing can compete with elite bald structure' },
        { name: 'Bald with Full Beard', why: 'The full power look. Dominant and intentional' },
        { name: 'Polished Bald', why: 'Moisturized, shining scalp signals discipline' },
      ],
      avoid: 'Neglected scalp. Moisturize daily and keep the look deliberate',
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
  { value: 'straight', label: 'Straight' },
  { value: 'wavy',     label: 'Wavy' },
  { value: 'curly',    label: 'Curly' },
  { value: 'coily',    label: 'Coily/Afro' },
  { value: 'locs',     label: 'Locs' },
  { value: 'bald',     label: 'Bald/Shaved' },
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
  const pct = Math.min(100, Math.max(0, ((score - 1) / 9) * 100))

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
        <ShoppingBag size={16} />
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
                description="AI-matched products based on your scan results and skin analysis."
                className="mt-1"
              />
            ) : (
              <>
                {/* Intro blurb — Pro */}
                <p className="text-[10px] text-secondary font-body mb-3 leading-snug">
                  Products matched to your scan. Selected based on your improvement areas and skin analysis.
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
                    No recommendations available right now. Try again after your next scan.
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
          <p className="text-[10px] text-secondary font-body">Upgrade to Pro to view this metric</p>
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

function Section({ title, icon, children, defaultOpen = true, badge, onOpenChange }) {
  const [open, setOpen] = useState(defaultOpen)
  function toggle() {
    setOpen(o => {
      const next = !o
      onOpenChange?.(next)
      return next
    })
  }
  return (
    <div className="card mb-3">
      <button className="w-full flex items-center gap-2 mb-1" onClick={toggle}>
        <span className="flex-shrink-0">{icon}</span>
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

// ─── Paywall Full-Screen ──────────────────────────────────────────────────────

function PaywallSheet({ glowScore, pillars, gender, onClose }) {
  const reducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const { setIsPremium } = useStore()
  const [plan, setPlan]       = useState('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showPromo, setShowPromo] = useState(false)

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
    ? `Your ${worstLabel} has the most room to grow, and it's your fastest path to +${scoreDrag} pts.`
    : `You're ${gap} points below your potential.`

  const hookSub = worstLabel && worstScore != null && worstScore < 6.5
    ? `One focused pillar. Pro unlocks the exact protocol to raise it.`
    : `Your full breakdown and 12-week protocol are waiting.`

  // ── Direct checkout ───────────────────────────────────────────────────────
  async function handleCheckout() {
    setLoading(true)
    setError('')
    try {
      if (isNative()) {
        // iOS: Apple In-App Purchase via RevenueCat
        const result = await purchasePro(plan)
        if (result?.success) {
          const rcUserId = result.customerInfo?.originalAppUserId
          api.payments.syncRc(rcUserId).catch(() => {})
          sessionStorage.setItem('asc_pro_splash_shown', '1')
          setIsPremium(true)
          navigate('/dashboard')
        }
      } else {
        // Web: Stripe checkout
        const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
        const token  = stored?.state?.token
        if (!token || token === 'demo-token') { navigate('/auth'); return }
        const { url } = await api.payments.createCheckout(plan, false)
        window.location.href = url
      }
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (!msg.includes('cancel')) {
        setError('Unable to complete purchase. Please try again.')
      }
      setLoading(false)
    }
  }

  const locked = [
    worstLabel && worstScore != null && worstScore < 6.5
      ? { icon: <Target size={14} style={{ color: '#C6A85C' }} />, label: `Maximize Your ${worstLabel}`, sub: `Exact protocol to raise ${worstScore.toFixed(1)} → 8.0+` }
      : { icon: <TrendingUp size={14} style={{ color: '#C6A85C' }} />, label: 'Score Projection', sub: `Your potential: ${potential}/10 · roadmap included` },
    { icon: <Ruler size={14} style={{ color: '#C6A85C' }} />, label: 'Full Face Metrics', sub: '6 detailed scores + AI descriptors' },
    { icon: <Scissors size={14} style={{ color: '#C6A85C' }} />, label: 'Hairstyle Recommendations', sub: 'Face-shape matched styles + protocols' },
    { icon: <Map size={14} style={{ color: '#C6A85C' }} />, label: '12-Week Personalized Plan', sub: 'Built from your exact scan results' },
    { icon: <Bot size={14} style={{ color: '#C6A85C' }} />, label: 'AI Improvement Coach', sub: 'Unlimited questions about your results' },
  ]

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 24 }}
      transition={reducedMotion ? { duration: 0.2, ease: 'easeOut' } : { type: 'spring', bounce: 0, duration: 0.35 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#080604' }}
    >
      {/* Gold top accent */}
      <div className="h-px w-full flex-shrink-0"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(198,168,92,0.55), transparent)' }} />

      {/* Scrollable content — everything except the sticky dismiss footer */}
      <div className="flex-1 overflow-y-auto px-5 pt-9 pb-4 flex flex-col">

        {/* Logo + badge */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <img src={logo} alt="Ascendus" style={{ height: 28, mixBlendMode: 'lighten' }} />
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.25)' }}>
            <Sparkles size={10} style={{ color: '#C6A85C' }} />
            <span className="text-[9px] font-heading font-bold uppercase tracking-widest" style={{ color: '#C6A85C' }}>Pro</span>
          </div>
        </div>

        {/* Score projection */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center">
            <p className="font-mono font-bold leading-none mb-1" style={{ fontSize: 36, color: '#E07A5F' }}>
              {glowScore?.toFixed(1) ?? 'N/A'}
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
              <span className="flex-shrink-0 flex items-center">{icon}</span>
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
                className="relative py-2 rounded-lg text-center transition-colors duration-200 ease-out"
                style={{
                  border: `1px solid ${plan === key ? 'rgba(198,168,92,0.4)' : 'transparent'}`,
                }}
              >
                {plan === key && (
                  <motion.div
                    layoutId="planHighlight"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'rgba(198,168,92,0.18)' }}
                    transition={reducedMotion ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.3 }}
                  />
                )}
                <p className="relative text-[10px] font-heading font-bold leading-none mb-0.5"
                  style={{ color: plan === key ? '#C6A85C' : 'rgba(255,255,255,0.3)' }}>
                  {label}{badge && plan === key ? ` · ${badge}` : ''}
                </p>
                <p className="relative text-[12px] font-mono font-bold"
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
          onClick={handleCheckout}
          disabled={loading}
          type="button"
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mb-1 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          style={{
            background: GOLD_GRADIENT,
            color: '#0A0A0A',
            boxShadow: '0 4px 20px rgba(198,168,92,0.35)',
            letterSpacing: '0.01em',
          }}
        >
          {loading ? 'Opening checkout…' : 'Start 3-Day Free Trial'}
        </motion.button>

        {/* Apple IAP required disclosure */}
        <div className="mt-1 mb-2 space-y-0.5">
          <p className="text-center text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {isNative()
              ? 'Ascendus Pro is $7.99/month or $49.99/year. Payment charged to your Apple ID.'
              : `$0 today · then ${plan === 'annual' ? '$49.99/yr ($4.17/mo)' : '$7.99/mo'} · cancel anytime`}
          </p>
          {isNative() && (
            <p className="text-center text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.18)' }}>
              Renews automatically. Cancel in Apple ID Account Settings 24h before renewal.
            </p>
          )}
        </div>

        {error && (
          <p className="text-center text-[11px] font-body mb-2" style={{ color: RED }}>{error}</p>
        )}

        {/* Restore Purchases — required by Apple */}
        {isNative() && (
          <button
            onClick={async () => {
              setLoading(true)
              setError('')
              try {
                const info = await restorePurchases()
                if (info?.entitlements?.active?.['Ascendus Pro']) {
                  const rcUserId = info?.originalAppUserId
                  api.payments.syncRc(rcUserId).catch(() => {})
                  sessionStorage.setItem('asc_pro_splash_shown', '1')
                  setIsPremium(true)
                  onClose()
                } else {
                  setError('No previous purchase found.')
                }
              } catch {
                setError('Restore failed. Please try again.')
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
            type="button"
            className="w-full py-1.5 font-body text-[11px] text-center transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'rgba(198,168,92,0.5)' }}
          >
            Restore Purchases
          </button>
        )}

      </div>{/* end scrollable content */}

      {/* Sticky dismiss footer — always visible, no scrolling required */}
      <div
        className="flex-shrink-0 px-5 flex flex-col gap-1"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        {!isNative() && (
          <button
            onClick={() => setShowPromo(true)}
            type="button"
            className="w-full py-1.5 font-body text-[11px] text-center transition-opacity hover:opacity-70"
            style={{ color: 'rgba(198,168,92,0.45)' }}
          >
            Have a promo code?
          </button>
        )}
        <button
          onClick={onClose}
          type="button"
          className="w-full py-3 font-body text-[13px] text-center"
          style={{ color: 'rgba(255,255,255,0.30)' }}
        >
          No thanks, I'll stay at {glowScore?.toFixed(1) ?? 'N/A'}
        </button>
      </div>

      {/* Promo modal */}
      <AnimatePresence>
        {showPromo && (
          <PromoModal
            onClose={() => setShowPromo(false)}
            onSuccess={onClose}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skincare ingredient protocols (module-level — stable across renders) ─────

const SKIN_INGREDIENTS = {
  acne: [{
    name: 'Benzoyl Peroxide 2.5%',
    why: 'Kills acne-causing bacteria (C. acnes) at the source. 2.5% is as effective as 10% with far less irritation.',
    how: 'Apply thin layer to affected areas after cleansing. Start 3×/week, increase to daily as tolerated.',
    when: 'PM only. Causes photosensitivity.',
    timeline: '2–4 weeks for reduction. 8–12 weeks for significant clearing.',
    warning: 'Can bleach fabric. Patch test first. Do not use with tretinoin on same night.',
    pillar: 'Clears skin texture. Directly raises your Features score.',
  }],
  scarring: [
    { name: 'Vitamin C (L-Ascorbic Acid 15%)', why: 'Inhibits melanin production. Fades hyperpigmentation and post-acne marks.', how: 'Apply 3–4 drops to clean dry face. Let absorb 3 min before next step.', when: 'AM. Boosts SPF protection and brightens through the day.', timeline: '4–8 weeks visible fading. Full effect in 12 weeks.', warning: 'Unstable. Use within 3 months of opening. Store away from light.', pillar: 'Even skin tone reads as more symmetric. Improves Harmony score.' },
    { name: 'Alpha Arbutin 2%', why: 'Inhibits tyrosinase (the enzyme that makes dark spots). Gentler than kojic acid.', how: 'Apply 2 drops after toner, before moisturizer.', when: 'AM and PM.', timeline: '6–8 weeks for measurable lightening.', warning: 'Stack with Vitamin C for 2× effect.', pillar: 'Reduces the visual evidence of past breakouts. Raises Features score.' },
    { name: 'Retinol 0.3% → 0.5%', why: 'Speeds cell turnover. Pushes scarred cells out and builds collagen beneath.', how: 'Rice-grain amount on full face. Start 1×/week, increase to 3× over 6 weeks.', when: 'PM only. Always use SPF next morning.', timeline: 'Visible texture change in 8–16 weeks. Best results at 6+ months.', warning: 'Purging is normal weeks 2–6. Do not combine with AHAs on same night.', pillar: 'Strongest OTC texture intervention. Improves Features score long-term.' },
  ],
  oiliness: [{
    name: 'Niacinamide 10%',
    why: 'Regulates sebum production at the sebaceous gland level. Also reduces pore appearance.',
    how: 'Apply 2–3 drops after cleansing, before moisturizer.',
    when: 'AM and PM.',
    timeline: '4–6 weeks for visible pore and oil reduction.',
    warning: 'Do not layer with Vitamin C in the same routine. Split AM/PM.',
    pillar: 'Controls shine and pore size. Improves skin texture score.',
  }],
  dark_circles: [
    { name: 'Caffeine Eye Cream', why: 'Vasoconstrictor. Constricts blood vessels under-eye to reduce dark circles and puffiness.', how: 'Tap gently with ring finger around orbital bone. Never pull the skin.', when: 'AM primarily. Can use PM too.', timeline: 'Immediate de-puffing. Consistent darkening reduction in 6–8 weeks.', warning: 'Will not fix structural dark circles (bone-related). Works on vascular/pigment type.', pillar: 'Improves Eye Area score. Directly raises facial attractiveness.' },
    { name: 'Sleep Consistency', why: '7–9 hours reduces cortisol-driven inflammation and blood vessel dilation that causes under-eye darkness.', how: 'Same bedtime and wake time daily including weekends.', when: 'Ongoing.', timeline: 'Visible within 5–7 days of consistent sleep.', warning: 'No product replaces sleep. This is the root fix.', pillar: 'Sleep affects every score. Eye Area, skin clarity, and jawline definition all improve.' },
  ],
  dullness: [{
    name: 'AHA (Glycolic Acid 8% or Lactic Acid 10%)',
    why: 'Exfoliates dead cell layer. Reveals brighter, smoother skin underneath.',
    how: 'Apply to dry face after cleansing. Leave 20 min then rinse or leave overnight.',
    when: 'PM 2–3×/week. Never on same night as retinol.',
    timeline: '2 weeks to notice glow. 6 weeks for significant brightness.',
    warning: 'Mandatory SPF next morning. AHAs increase photosensitivity. Start 1×/week.',
    pillar: 'Brightness directly improves perceived skin health. Raises overall facial impression.',
  }],
}

// ─── Main Results Page ────────────────────────────────────────────────────────

export default function Results() {
  const navigate = useNavigate()
  const { currentScan, isPremium, pendingFacePhoto, assignedPhase, hairType, setHairType, user } = useStore()
  const [showShareCard,   setShowShareCard]   = useState(false)
  // Secret dev-only score override — only ever true for the account that
  // redeemed the SOHAIL promo code (checked server-side, see user.promoRedeemed
  // in server/src/routes/user.js). Completely separate from the real share
  // card; see DevRankCard.jsx.
  const isDevUnlocked = user?.promoRedeemed === true
  const [showDevCard, setShowDevCard] = useState(false)
  const [revealDone, setRevealDone] = useState(false)

  // Show reveal only on first load for a fresh scan (within last 10s), and only
  // if ScanUnlockGate's own UnlockReveal hasn't already played this score —
  // promo-code unlocks flag this so the user doesn't watch the same score
  // count up twice in one session.
  const isNewScan = currentScan && (Date.now() - new Date(currentScan.analyzedAt).getTime()) < 10000
  const [showReveal] = useState(() => {
    if (!isNewScan) return false
    try {
      if (sessionStorage.getItem('asc_reveal_shown') === (currentScan?.id ?? '')) return false
    } catch {}
    return true
  })

  // Show paywall after a short delay — let free users see their scores first
  const [showPaywall, setShowPaywall] = useState(false)
  const paywallDismissed = useRef(!!sessionStorage.getItem('asc_paywall_dismissed'))
  const ffbOpen          = useRef(false)   // true while Face Feature Breakdown is expanded
  const paywallTimer     = useRef(null)    // pending setTimeout handle

  function handleFfbOpenChange(isOpen) {
    ffbOpen.current = isOpen
    if (isOpen && paywallTimer.current) {
      // User opened the free section — cancel the pending auto-paywall
      clearTimeout(paywallTimer.current)
      paywallTimer.current = null
    }
  }

  // Ask for review after the user has seen their results — compliant timing
  // (post-engagement, not during onboarding). Fires once per session for
  // premium users viewing a fresh scan result.
  useEffect(() => {
    if (!isPremium || !isNewScan || !revealDone) return
    const t = setTimeout(async () => {
      try {
        const { InAppReview } = await import('@capacitor-community/in-app-review')
        await InAppReview.requestReview()
      } catch { /* Apple throttles this — best effort */ }
    }, 2000)
    return () => clearTimeout(t)
  }, [isPremium, isNewScan, revealDone])

  useEffect(() => {
    if (isPremium || !currentScan || paywallDismissed.current) return
    if (isNewScan) {
      if (revealDone && !ffbOpen.current) setShowPaywall(true)
    } else {
      paywallTimer.current = setTimeout(() => {
        if (!ffbOpen.current) setShowPaywall(true)
        paywallTimer.current = null
      }, 3000)
      return () => {
        clearTimeout(paywallTimer.current)
        paywallTimer.current = null
      }
    }
  }, [isPremium, currentScan, isNewScan, revealDone])

  if (!currentScan) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <Camera size={48} className="mb-4" style={{ color: '#C6A85C' }} />
        <h2 className="font-heading font-bold text-xl text-primary mb-2">No scan yet</h2>
        <p className="text-secondary text-sm font-body mb-6">Take your first scan to see your results here.</p>
        <button onClick={() => navigate('/scan/capture')} className="btn-primary max-w-xs">Start Scan</button>
      </div>
    )
  }

  const { faceData, umaxScore, tier, gender, aiScore, pillars: scanPillars } = currentScan
  const glowScore = currentScan.glowScore != null ? (currentScan.glowScore > 10 ? Math.round(currentScan.glowScore) / 10 : currentScan.glowScore) : null

  const pillars = scanPillars ?? aiScore?.pillars ?? null

  // Potential: face ceiling is +1.4. Physique scoring no longer happens as
  // part of the main scan (see Training Plan flow for that), so this no
  // longer factors in a physique-based upside — old scans that happen to
  // still have stored physiqueScore data are intentionally not read here.
  const potentialScore = Math.min(10, (glowScore ?? 5) + 1.4)

  const profileData      = aiScore?.profileData   ?? null
  const profileScore     = aiScore?.profileScore  ?? null
  const hasSideProfile   = !!(aiScore?.hasSideProfile || profileData)
  const faceMetrics      = aiScore?.faceMetrics   ?? null

  const facialStructure = aiScore?.facialStructure ?? 'average'

  // Hair type: AI detected > user stored > null (needs manual pick)
  const aiDetectedHairType = aiScore?.hairType && aiScore.hairType !== 'unknown' ? aiScore.hairType : null
  const resolvedHT = resolveHairType(aiDetectedHairType, hairType)
  const hairRec = resolvedHT ? getHairRec(resolvedHT, facialStructure) : null

  // ─── Skin Analysis ──────────────────────────────────────────────────────────
  const skinScore = faceData?.skinClarity ?? null
  const skinCategory =
    skinScore == null ? null :
    skinScore >= 7.5  ? 'Clear'         :
    skinScore >= 6.0  ? 'Good'          :
    skinScore >= 4.5  ? 'Fair'          :
    skinScore >= 3.5  ? 'Blemish-Prone' : 'Needs Attention'
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

  const skinAMRoutine = skinIsClear ? [
    'Gentle cleanser (CeraVe Hydrating or La Roche-Posay Toleriane)',
    'Vitamin C serum 10–15% (maintains brightness and defends against sun damage)',
    'Lightweight moisturizer',
    'SPF 50 (your #1 long-term anti-aging tool, non-negotiable)',
  ] : [
    'Gentle cleanser (CeraVe or La Roche-Posay)',
    skinIssues.includes('scarring')    ? 'Vitamin C serum 15%'           : null,
    skinIssues.includes('oiliness')    ? 'Niacinamide 10%'               : null,
    skinIssues.includes('dark_circles')? 'Caffeine eye cream'            : null,
    'Lightweight moisturizer',
    'SPF 50 (non-negotiable: all actives require sun protection)',
  ].filter(Boolean)

  const skinPMRoutine = skinIsClear ? [
    'Gentle cleanser',
    'Retinol 0.025–0.05% 2×/week (preventative, maintains smooth texture long-term)',
    'Peptide moisturizer (builds collagen, supports skin firmness)',
  ] : [
    'Gentle cleanser',
    skinIssues.includes('acne')        ? 'Benzoyl Peroxide 2.5% (spot treatment or full face)' : null,
    skinIssues.includes('dullness')    ? 'AHA/glycolic acid 2–3×/week (alternate with retinol)' : null,
    skinIssues.includes('scarring')    ? 'Retinol 0.3% (start 1×/week, build up)'              : null,
    skinIssues.includes('oiliness')    ? 'Niacinamide 10%'               : null,
    'Moisturizer (heavier than AM is fine)',
  ].filter(Boolean)

  function handleShare() {
    setShowShareCard(true)
  }

  return (
    <>
    <Helmet>
      <title>Your AI Appearance Score &amp; Looksmax Results | Ascendus</title>
      <meta name="description" content="See your AI face rating, body composition score, and a personalized 12-week looksmax plan built around your results." />
      <meta name="keywords" content="face rating results, AI appearance score, looksmax results, glow up plan, facial analysis" />
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
      <PageHeader
        title="Your Results"
        subtitle={
          <>
            {new Date(currentScan.analyzedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {gender && <span className="ml-1 capitalize">· {gender}</span>}
          </>
        }
        action={
          <button onClick={handleShare} className="w-9 h-9 bg-card border border-default rounded-xl flex items-center justify-center">
            <Share2 size={15} className="text-secondary" />
          </button>
        }
      />

      {/* ── Citations / Medical Disclaimer ──────────────────────── */}
      <div className="mb-3 px-3 py-2.5 rounded-xl flex items-start gap-2"
        style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.25)' }}>
        <span className="text-[11px] flex-shrink-0" style={{ color: '#C6A85C' }}>ℹ</span>
        <p className="text-[10px] font-body leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          For informational purposes only, not medical or clinical advice.
          Analysis is AI-generated and draws on published guidelines from{' '}
          <a href="https://www.aad.org/public/everyday-care/skin-care-basics" target="_blank" rel="noopener noreferrer" style={{ color: '#C6A85C', textDecoration: 'underline' }}>AAD</a>
          ,{' '}
          <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3583892/" target="_blank" rel="noopener noreferrer" style={{ color: '#C6A85C', textDecoration: 'underline' }}>NIH</a>
          , and{' '}
          <a href="https://www.healthline.com/nutrition/12-ways-to-look-younger" target="_blank" rel="noopener noreferrer" style={{ color: '#C6A85C', textDecoration: 'underline' }}>Healthline</a>
          . Consult a qualified professional before making health decisions.
        </p>
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
            <BarChart2 size={13} />
            <p className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Your score places you in the <span className="font-bold" style={{ color: col }}>{pct}</span> of users on Ascendus
            </p>
          </div>
        )
      })()}

      {/* ── Motivational one-liner — strongest pillar ────────────── */}
      {pillars && (() => {
        const best = Object.entries(pillars).reduce((a, b) => (a[1] > b[1] ? a : b))
        const PILLAR_LABELS_MOT = { harmony: 'Harmony', angularity: 'Angularity', features: 'Features', dimorphism: gender === 'female' ? 'Femininity' : 'Dimorphism' }
        const bestLabel = PILLAR_LABELS_MOT[best[0]] ?? best[0]
        const bestScore = best[1]
        const MOTIV_LINES = {
          harmony:    'Your facial balance is already working for you. Maximize it with targeted symmetry and posture work.',
          angularity: 'Your bone structure is already working for you. Lean out to reveal its full potential.',
          features:   'Your individual features are already working for you. Refine the details for maximum impact.',
          dimorphism: gender === 'female'
            ? 'Your femininity score is already working for you. Skincare and grooming will amplify it further.'
            : 'Your masculine presence is already working for you. Build on this foundation consistently.',
        }
        const motivLine = MOTIV_LINES[best[0]] ?? `Your ${bestLabel} is already working for you. Here's how to maximize it.`
        return (
          <div className="mb-3 px-3 py-2.5 rounded-xl flex items-start gap-2.5"
            style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.2)' }}>
            <Star size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#C6A85C', fill: '#C6A85C' }} />
            <p className="font-body text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <span className="font-bold" style={{ color: '#C6A85C' }}>{bestLabel} {bestScore.toFixed(1)}</span>{': '}{motivLine}
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
            <AlertTriangle size={15} className="flex-shrink-0" style={{ color: '#E07A5F' }} />
            <p className="font-body text-[11px] leading-relaxed flex-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Your <span className="font-bold" style={{ color: '#C6A85C' }}>{label} ({score.toFixed(1)})</span> is your biggest growth opportunity
              {'. '}<span className="font-bold" style={{ color: '#34C759' }}>Targeting it adds ~+{impact} pts</span>
              <span style={{ color: '#C6A85C' }}> · See how</span>
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
          {hasSideProfile ? 'Full Scan: Profile Analysis Included' : 'Basic Scan: Side Profile Not Included'}
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
                  <p className="font-mono font-bold text-base" style={{ color }}>{val?.toFixed(1) ?? 'N/A'}</p>
                  <p className="text-[9px] text-secondary font-body">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Strengths & Weaknesses ────────────────────────────── */}
      {(aiScore?.keyStrengths?.length > 0 || aiScore?.keyWeaknesses?.length > 0) && (
        <Section title="AI Analysis" icon={<Target size={16} style={{ color: '#C6A85C' }} />}>
          {aiScore?.topImprovement && (
            <div className="mb-3 px-3 py-2.5 rounded-xl bg-[#C6A85C]/10 border border-[#C6A85C]/25">
              <p className="text-[10px] font-body italic text-[#C6A85C] mb-1 opacity-80">The biggest thing to work on right now:</p>
              {isPremium
                ? <p className="text-xs text-primary font-body leading-relaxed">{aiScore.topImprovement}</p>
                : <ProText text={aiScore.topImprovement} onUpgrade={() => navigate('/premium')} />
              }
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 p-3">
              <p className="text-[10px] font-heading font-bold text-success mb-2">What's Working</p>
              {aiScore?.keyStrengths?.map((s, i) => (
                <p key={i} className="text-[11px] font-body text-primary leading-snug mb-1.5 last:mb-0">{s}</p>
              ))}
            </div>
            <div className="rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 p-3">
              <p className="text-[10px] font-heading font-bold text-warning mb-2">What To Focus On</p>
              {aiScore?.keyWeaknesses?.map((w, i) => (
                <p key={i} className="text-[11px] font-body text-primary leading-snug mb-1.5 last:mb-0">{w}</p>
              ))}
            </div>
          </div>
          {facialStructure && (
            <div className="mt-2 text-[10px] text-secondary font-body leading-relaxed">
              {facialStructure === 'average'
                ? <>Overall facial structure sits in a solid baseline range with real upside to unlock.</>
                : <>Facial structure is <span className="font-bold capitalize text-primary">{facialStructure}</span>, a genuine asset to build on.</>
              }
            </div>
          )}
        </Section>
      )}

      {/* ── The 4 Pillars ────────────────────────────────────────── */}
      {pillars && (
        <Section title="The 4 Pillars" icon={<Columns size={16} style={{ color: '#C6A85C' }} />} defaultOpen={true}>
          <p className="text-[10px] text-secondary font-body mb-3 leading-relaxed">
            Your aesthetic score is built on 4 core pillars, each worth 25% of your overall face rating.
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
        <Section title="Face Metrics" icon={<Ruler size={16} style={{ color: '#C6A85C' }} />} defaultOpen={false}>
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
                  {!isPremium && locked4Count > 0 && <span style={{ color: '#C6A85C' }}> {locked4Count} metrics locked. Upgrade to Pro to unlock.</span>}
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
                <button
                  onClick={() => navigate(isPremium ? '/coach' : '/premium')}
                  className="w-full mt-4 flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.18)' }}
                >
                  <div className="flex items-center gap-2">
                    <Bot size={14} style={{ color: '#C6A85C' }} />
                    <span className="text-[12px] font-heading font-semibold" style={{ color: '#C6A85C' }}>
                      Ask AI Coach about these metrics
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'rgba(198,168,92,0.5)' }} />
                </button>
              </>
            )
          })()}
        </Section>
      )}

      {/* ── Face Feature Breakdown ────────────────────────────────── */}
      <Section
        title="Face Feature Breakdown"
        icon={<User size={16} style={{ color: '#C6A85C' }} />}
        defaultOpen={false}
        onOpenChange={handleFfbOpenChange}
      >
        <div className="space-y-0">
          {(() => {
            const rows = [
              { label: 'Facial Symmetry',    score: faceData?.symmetry,           note: 'Sleeping on your back, correcting dominant chewing side, and fixing posture all improve symmetry over time.' },
              { label: 'Jawline Definition', score: faceData?.jawlineDefinition,  note: 'Correlates directly with body fat %. Reducing body fat dramatically reveals the jawline. Mewing for long-term structural improvement.' },
              { label: 'Skin Clarity',       score: faceData?.skinClarity,        note: 'Consistent cleanser → treatment → moisturizer → SPF routine produces visible change in 4–8 weeks. Retinol or tretinoin accelerates results.' },
              { label: 'Facial Proportions', score: faceData?.facialProportions,  note: 'Ideal face has equal facial thirds. Structural. Address via mewing, hairstyle, beard length.' },
              { label: 'Eye Area',           score: faceData?.eyeArea,            note: 'Addressed via sleep, hydration, targeted eye cream, and strategic brow grooming. Sleep consistency is #1.' },
              { label: 'Overall Harmony',    score: faceData?.facialHarmony,      note: 'How all facial features read together. Improves as individual metrics improve. Grooming and skincare have the fastest ROI.' },
            ].filter(m => m.score != null)
            if (rows.length === 0) {
              return (
                <p className="font-body text-[12px] text-center py-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Feature scores are generated during your scan and available on your next analysis.
                </p>
              )
            }
            return rows.map(m => (
              <ScoreRow key={m.label} label={m.label} score={m.score} note={m.note} isPremium={isPremium} onUpgrade={() => navigate('/premium')} />
            ))
          })()}
        </div>
      </Section>

      {/* ── Profile Analysis (side profile scan) ────────────────── */}
      {hasSideProfile && profileData && (
        <Section title="Profile Analysis" icon={<ArrowUpRight size={16} style={{ color: '#C6A85C' }} />} defaultOpen={false} badge="FULL">
          {/* Profile score row */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.18)' }}>
            <div className="text-center flex-shrink-0">
              <div
                className="text-2xl font-mono font-bold"
                style={{ color: profileScore >= 7 ? '#34C759' : profileScore >= 5 ? '#F5A623' : '#E07A5F' }}
              >
                {profileScore != null ? profileScore.toFixed(1) : 'N/A'}
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
                  'soft':     'A low, flat nose bridge sits closer to the face; rhinoplasty or contouring can add vertical definition.',
                  'medium':   'Average nose bridge height. Proportional and balanced with your other features.',
                  'strong':   'High, straight nose bridge. Adds strong vertical definition and perceived structure to the mid-face.',
                  'aquiline': 'Aquiline (Roman/curved) nose bridge. Adds character and masculine distinction from the profile.',
                },
                color: '#A29BFE',
              },
              {
                key: 'jawline_projection',
                label: 'Jawline Projection',
                value: profileData.jawline_projection,
                descriptions: {
                  'strong':    'Strong jaw projection. Highly attractive from the side. One of the top structural traits in profile aesthetics.',
                  'projected': 'Good jaw projection. Forward-sitting jaw adds strength to the profile. Mewing and chewing hard foods can maintain and improve this.',
                  'average':   'Average jaw projection. Solid structural base. Mewing consistently and keeping body fat low can push this higher over time.',
                  'recessed':  'Recessed jaw (retrognathia). The chin and jaw sit back significantly. Orthognathic surgery is the definitive fix; mewing addresses mild cases.',
                },
                color: '#F5A623',
              },
              {
                key: 'chin_projection',
                label: 'Chin Projection',
                value: profileData.chin_projection,
                descriptions: {
                  'prominent': 'Prominent chin projection. Well ahead of the E-line. A highly attractive masculine trait from the side.',
                  'projected': 'Good chin projection. Chin sits forward of the lower lip, giving a strong profile. One of the top masculine structural traits.',
                  'average':   'Average chin projection. On or near the Ricketts E-line. Mewing and chin exercises can marginally improve this over time.',
                  'recessed':  'Chin has significant improvement potential. Sits back from ideal profile position. Chin filler is the fastest solution; chin implant for permanent change.',
                },
                color: '#34C759',
              },
            ].map(({ key, label, value, descriptions, color }) => {
              const desc = value && descriptions[value]
                ? descriptions[value]
                : `${label} assessment not available.`
              const valueLabel = value
                ? value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ')
                : 'N/A'
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
      <Section title="Hairstyle Recommendations" icon={<Scissors size={16} style={{ color: '#C6A85C' }} />} defaultOpen={false}>
        <div className="mb-2">
          {/* Hair type selector — always shown so user can select or override AI detection */}
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
                    {opt.label}
                  </button>
                ))}
              </div>
          </div>

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

      {/* ── Skin Analysis ────────────────────────────────────────── */}
      {skinScore != null && (
        <Section title="Skin Analysis" icon={<FlaskConical size={16} style={{ color: '#C6A85C' }} />} defaultOpen={false} badge="PRO">
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
                    Your skin is clear. The goal now is preservation, not treatment. Daily SPF 50 prevents photoaging (the #1 cause of visible skin decline). A low-dose retinol 2×/week maintains smooth texture over time. Vitamin C each morning fights oxidative damage and keeps tone even.
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
                        {ing.warning && <p className="text-[10px] text-warning font-body leading-relaxed mb-1"><span className="font-bold flex items-center gap-1"><AlertTriangle size={11} /> Note:</span> {ing.warning}</p>}
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
                {['Benzoyl Peroxide 2.5%: PM only, kills acne bacteria at source', 'Niacinamide 10%: AM + PM, regulates sebum and pore size', 'AHA Exfoliant: 2×/week PM, removes dead cells revealing brightness', 'AM Routine: Cleanser → Vit C → Moisturizer → SPF 50', 'PM Routine: Cleanser → BHA → Niacinamide → Moisturizer'].map((line, i) => (
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
                  Upgrade to Pro
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

      {/* ── Legal Disclaimers ─────────────────────────────────────── */}
      <div className="space-y-2 mb-4">
        {/* Wellness disclaimer */}
        <div className="px-4 py-3.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] font-body leading-relaxed text-secondary">
            <Heart size={14} style={{ color: '#F5A623', display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> <span className="font-semibold text-primary">Wellbeing:</span> These scores are tools for self-improvement, not measures of your worth. If you are struggling with body image or mental health, please speak to a professional.
          </p>
        </div>
        {/* AI disclosure */}
        <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] font-body leading-relaxed text-secondary">
            <Bot size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> <span className="font-semibold text-primary">AI Analysis:</span> Scores are generated by AI and are estimates only, not medical or clinical assessments. Results may vary.
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
        {isDevUnlocked && (
          <button
            onClick={() => setShowDevCard(true)}
            className="w-full py-3 rounded-2xl font-heading font-semibold text-[13px] flex items-center justify-center gap-2"
            style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.25)', color: '#C6A85C' }}
          >
            <FlaskConical size={14} />
            Dev Override
          </button>
        )}
        {isPremium && (
          <>
            <button onClick={() => navigate('/workout-plan')} className="btn-primary flex items-center justify-center gap-2">
              See My Training Plan <ArrowRight size={15} />
            </button>
            <button onClick={() => navigate('/scan/capture')} className="btn-ghost border border-default">
              Take Another Scan
            </button>
          </>
        )}
      </div>
    </MotionPage>

    {/* ── Free tier sticky bottom CTA ──────────────────────────── */}
    {/* Note: position:fixed bottom:0 visually covers the app's BottomNav
        (which is a normal-flow, non-fixed element with no z-index of its
        own) — without an explicit way back, free users land here and have
        no path to the homepage. The Home button below fixes that directly. */}
    {!isPremium && !showPaywall && (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-3"
        style={{
          background: 'linear-gradient(to top, rgba(8,6,4,0.98) 70%, rgba(8,6,4,0))',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: 'auto 1fr 1fr' }}>
          <button
            onClick={() => navigate('/')}
            aria-label="Back to home"
            className="w-[46px] flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Home size={17} style={{ color: 'rgba(255,255,255,0.7)' }} />
          </button>
          <button
            onClick={() => navigate('/referral')}
            className="py-3.5 rounded-2xl font-heading font-bold text-[13px] flex items-center justify-center gap-1.5"
            style={{
              background: 'rgba(198,168,92,0.10)',
              border: '1px solid rgba(198,168,92,0.30)',
              color: '#C6A85C',
            }}
          >
            <Gift size={14} style={{ display: 'inline', marginRight: 4 }} /> Share 5 Friends
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

    {/* ── Dev Override Card (SOHAIL-only, fully separate from the real card) ── */}
    <AnimatePresence>
      {isDevUnlocked && showDevCard && (
        <DevRankCard scan={currentScan} onClose={() => setShowDevCard(false)} />
      )}
    </AnimatePresence>

    {/* ── Paywall (free users) ──────────────────────────────────── */}
    <AnimatePresence>
      {showPaywall && !isPremium && (
        <PaywallSheet
          glowScore={glowScore}
          pillars={pillars}
          gender={gender ?? 'male'}
          onClose={() => { sessionStorage.setItem('asc_paywall_dismissed', '1'); paywallDismissed.current = true; setShowPaywall(false) }}
        />
      )}
    </AnimatePresence>
    </>
  )
}
