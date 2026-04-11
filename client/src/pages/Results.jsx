import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { Share2, ArrowRight, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import useStore from '../store/useStore'
import logo from '../assets/ascendus-icon.png'
import GlowScoreRing from '../components/GlowScoreRing'
import UMaxScoreBadge from '../components/UMaxScoreBadge'
import MotionPage from '../components/MotionPage'
import ShareCardModal from '../components/ShareCardModal'
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

// ─── Body metric detail card ──────────────────────────────────────────────────

function BodyMetricCard({ label, score, classification, keyLine, urgencyLine, detected, protocol, scoreImpact, isPremium, onUpgrade }) {
  const [open, setOpen] = useState(false)
  const col = score >= 8 ? '#34C759' : score >= 6 ? '#C6A85C' : score >= 4 ? '#F5A623' : '#E07A5F'
  const bg  = score >= 8 ? 'rgba(52,199,89,0.12)' : score >= 6 ? 'rgba(198,168,92,0.12)' : score >= 4 ? 'rgba(245,166,35,0.12)' : 'rgba(224,122,95,0.12)'
  const pct = score != null ? ((score - 1) / 9) * 100 : 0
  const hasExpand = !!(detected || protocol || scoreImpact)

  return (
    <div className="py-3 border-b border-default last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 text-center py-1.5 rounded-lg" style={{ background: bg }}>
          <div className="text-sm font-mono font-bold leading-none" style={{ color: col }}>
            {score != null ? score.toFixed(1) : '—'}
          </div>
          <div className="text-[8px] font-mono mt-0.5 opacity-70" style={{ color: col }}>/10</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
            <p className="text-[13px] font-heading font-bold text-primary">{label}</p>
            {classification && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: col, background: bg }}>
                {classification}
              </span>
            )}
          </div>
          {keyLine && <p className="text-[10px] font-body text-secondary mb-1 leading-snug">{keyLine}</p>}
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-1">
            <motion.div
              className="h-full rounded-full"
              style={{ background: col }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          {urgencyLine && (
            <p className="text-[10px] font-body leading-tight" style={{ color: col }}>
              {urgencyLine}
            </p>
          )}
        </div>

        {hasExpand && (
          <button onClick={() => setOpen(o => !o)} className="flex-shrink-0 mt-1 flex flex-col items-center">
            {!isPremium && <Lock size={9} className="text-[#C6A85C] mb-0.5" />}
            {open ? <ChevronUp size={13} className="text-secondary" /> : <ChevronDown size={13} className="text-secondary" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && hasExpand && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5" style={{ paddingLeft: '60px' }}>
              {isPremium ? (
                <>
                  {detected && (
                    <div className="rounded-xl p-2.5 bg-black/[0.03] dark:bg-white/[0.04]">
                      <p className="text-[9px] font-heading font-bold uppercase tracking-wide text-secondary mb-1">What Was Detected</p>
                      <p className="text-[11px] font-body text-primary leading-relaxed">{detected}</p>
                    </div>
                  )}
                  {protocol && (
                    <div className="rounded-xl p-2.5 bg-black/[0.03] dark:bg-white/[0.04]">
                      <p className="text-[9px] font-heading font-bold uppercase tracking-wide text-secondary mb-1">Fix Protocol</p>
                      <p className="text-[11px] font-body text-primary leading-relaxed">{protocol}</p>
                    </div>
                  )}
                  {scoreImpact && (
                    <div className="rounded-xl p-2.5 border" style={{ borderColor: col + '40', background: bg }}>
                      <p className="text-[9px] font-heading font-bold uppercase tracking-wide mb-1" style={{ color: col }}>Score Impact</p>
                      <p className="text-[11px] font-body font-semibold leading-relaxed" style={{ color: col }}>{scoreImpact}</p>
                    </div>
                  )}
                </>
              ) : (
                <ProText text={[detected, protocol].filter(Boolean).join(' ')} onUpgrade={onUpgrade} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

function PaywallSheet({ glowScore, onClose }) {
  const navigate = useNavigate()
  const [plan, setPlan] = useState('annual')

  const potential = Math.min(10, (glowScore ?? 5) + 1.8).toFixed(1)

  const locked = [
    { icon: '⭐', label: 'Celebrity Lookalikes', sub: '3 matches with % similarity + shared traits' },
    { icon: '💪', label: 'Complete Body Analysis', sub: '12 detailed body metrics & protocols' },
    { icon: '🗺️', label: '12-Week Personalized Plan', sub: 'Built from your exact scores' },
    { icon: '📈', label: `Score Projection +${(1.8).toFixed(1)}`, sub: `Your potential: ${potential}/10` },
    { icon: '📊', label: 'Progress Tracking', sub: 'Before/after comparison graph' },
    { icon: '🤖', label: 'AI Improvement Coach', sub: 'Ask questions about your results' },
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

      <div className="flex-1 px-5 pt-10 pb-10 flex flex-col">
        {/* Header */}
        <div className="text-center mb-6">
          <img src={logo} alt="Ascendus" style={{ height: 36, mixBlendMode: 'lighten', margin: '0 auto 12px' }} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.25)' }}>
            <span style={{ color: '#C6A85C', fontSize: 11 }}>✦</span>
            <span className="text-[10px] font-heading font-bold uppercase tracking-widest" style={{ color: '#C6A85C' }}>Pro</span>
          </div>
          <h2 className="font-heading font-bold text-[26px] text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
            You're leaving gains<br />on the table.
          </h2>
          <p className="font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Unlock your complete analysis and 12-week transformation plan.
          </p>
        </div>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className="flex -space-x-1.5">
            {['#C6A85C','#A29BFE','#34C759'].map((c, i) => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-black" style={{ background: c, opacity: 0.85 }} />
            ))}
          </div>
          <p className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
            <span className="font-bold" style={{ color: 'rgba(255,255,255,0.65)' }}>847 men</span> upgraded this week
          </p>
        </div>

        {/* Locked items */}
        <div className="space-y-2 mb-5">
          {locked.map(({ icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3 px-3.5 py-3 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-lg">{icon}</span>
              <div className="flex-1">
                <p className="font-heading font-semibold text-[13px] text-white">{label}</p>
                <p className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>
              </div>
              <Lock size={13} style={{ color: '#C6A85C', flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* Plan toggle */}
        <div className="rounded-2xl p-1.5 mb-3" style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="grid grid-cols-2 gap-1">
            {[
              { key: 'monthly', label: 'Monthly', price: '$9.99/mo', save: '' },
              { key: 'annual', label: 'Annual', price: '$4.99/mo', save: 'Best Value' },
            ].map(({ key, label, price, save }) => (
              <button key={key} onClick={() => setPlan(key)}
                className="py-3 rounded-xl text-center transition-all"
                style={{
                  background: plan === key ? 'rgba(198,168,92,0.12)' : 'transparent',
                  border: `1px solid ${plan === key ? 'rgba(198,168,92,0.35)' : 'transparent'}`,
                }}>
                <p className="text-[11px] font-heading font-bold" style={{ color: plan === key ? '#C6A85C' : 'rgba(255,255,255,0.35)' }}>{label}</p>
                <p className="text-sm font-mono font-bold" style={{ color: plan === key ? '#F0EDE8' : 'rgba(255,255,255,0.35)' }}>{price}</p>
                {save && <span className="text-[9px] font-heading font-bold" style={{ color: '#C6A85C' }}>{save} ★</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Primary CTA */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/premium')}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] mb-2"
          style={{
            background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)',
            color: '#0A0A0A',
            boxShadow: '0 4px 24px rgba(198,168,92,0.3)',
          }}
        >
          Start Free Trial →
        </motion.button>
        <p className="text-center text-[10px] font-body mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {plan === 'annual' ? 'Billed $59.99/year after 7-day trial' : 'Billed $9.99/month after 7-day trial'} · Cancel anytime
        </p>

        {/* Referral alternative */}
        <button onClick={() => { onClose(); navigate('/referral') }}
          className="w-full py-3 rounded-2xl font-heading font-bold text-[13px] border mb-3"
          style={{ color: '#C6A85C', borderColor: 'rgba(198,168,92,0.25)', background: 'transparent' }}>
          🎁 Share with 5 Friends → Get 7 Days Free
        </button>

        {/* No thanks */}
        <button
          onClick={onClose}
          className="w-full py-2.5 font-body text-[13px] text-center"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          No thanks, show me my free results
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

  const { faceData, bodyData, umaxScore, tier, gender, aiScore, pillars: scanPillars, celebrityMatches, bodySkipped } = currentScan
  const glowScore = currentScan.glowScore != null ? (currentScan.glowScore > 10 ? Math.round(currentScan.glowScore) / 10 : currentScan.glowScore) : null
  const pillars = scanPillars ?? aiScore?.pillars ?? null

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

  // ─── Body metric detail computations ────────────────────────────────────────
  const bDetail = bodyData?.detail ?? {}

  // V-Taper
  const swrScore    = bodyData?.shoulderWaistRatio ?? null
  const swrEstimate = bDetail.swr_estimate ?? null
  const swrClass    =
    swrScore == null ? null :
    swrScore >= 7.5  ? 'Strong V-Taper' :
    swrScore >= 5.5  ? 'Moderate V-Taper' :
    swrScore >= 4.0  ? 'Weak V-Taper' : 'No V-Taper'
  const swrKeyLine = swrEstimate
    ? `Estimated ratio: ${swrEstimate} · Ideal is 1.6:1 or higher`
    : 'Ideal shoulder-to-waist ratio: 1.6:1 or higher'
  const swrUrgency =
    swrScore != null && swrScore < 4 ? '⚠ Critical — V-taper is a top metric for attractiveness' :
    swrScore != null && swrScore < 6 ? 'Building shoulder width is your highest-ROI body move' : null
  const swrDetected = swrEstimate
    ? `Estimated shoulder-to-waist ratio: ${swrEstimate}. ${swrClass ? swrClass + ' classification.' : ''} The ideal ratio for a strong V-shape is 1.6:1 or higher. Below 1.3 = No V-Taper, 1.3–1.45 = Weak, 1.45–1.6 = Moderate, above 1.6 = Strong.`
    : `V-Taper assessed from visible shoulder and waist proportions in photo. ${swrClass ? swrClass + ' detected.' : ''} The ideal shoulder-to-waist ratio is 1.6:1 or higher.`
  const swrProtocol =
    swrScore != null && swrScore < 7.5
      ? 'Priority exercises: Lateral raises 4×15, Wide-grip pull-ups 4×8, Overhead press 4×10. Run these 3× per week minimum. Additionally: enter a calorie deficit to shrink your waist. Visible improvement in 8–12 weeks with consistent execution.'
      : 'Maintain with lateral raises 3×15 weekly. Use progressive overload to widen further. Protect it during bulk phases by monitoring waist measurements.'
  const swrScoreImpact =
    swrScore != null && swrScore < 6.5
      ? `Building to Strong V-Taper (7.5+) combined with a cut phase could add approximately +${Math.min((7.5 - swrScore) * 0.12, 1.5).toFixed(1)} points to your overall score.`
      : null

  // Posture
  const postureScore  = bodyData?.posture ?? null
  const postureGrade  = bodyData?.postureGradeValue ?? null
  const postureIssues = bDetail.posture_issues ?? []
  const isNoIssues    = !postureIssues.length || postureIssues.every(x => x === 'none')
  const postureGradeExplain = {
    A: 'Elite posture. You stand tall with no visible imbalances. This is actively boosting your score.',
    B: "Good posture with minor issues. One or two areas to correct — you're close to elite.",
    C: 'Moderate posture issues are visibly affecting your appearance and perceived height.',
    D: 'Significant posture problems. This is lowering your score by 1+ points.',
    F: 'Severe posture issues detected. This is one of the biggest single drags on your overall score.',
  }[postureGrade] ?? null
  const postureDetectedLines = [
    postureIssues.includes('forward_head')          ? 'Forward head posture detected'     : null,
    postureIssues.includes('rounded_shoulders')     ? 'Rounded shoulders detected'        : null,
    postureIssues.includes('anterior_pelvic_tilt')  ? 'Anterior pelvic tilt detected'     : null,
    isNoIssues                                      ? 'No major posture issues detected'   : null,
  ].filter(Boolean)
  const postureDetected = [
    postureGrade && postureGradeExplain ? `Grade ${postureGrade}: ${postureGradeExplain}` : null,
    postureDetectedLines.length ? postureDetectedLines.join(' · ') : null,
  ].filter(Boolean).join(' ')
  const postureProtocolLines = [
    postureIssues.includes('forward_head')         ? 'Forward head → Chin tucks 3×20 daily, keep screens at eye level.'                              : null,
    postureIssues.includes('rounded_shoulders')    ? 'Rounded shoulders → Wall angels 3×12, face pulls 4×15, stretch pecs every morning.'            : null,
    postureIssues.includes('anterior_pelvic_tilt') ? 'Anterior pelvic tilt → Hip flexor stretches 2×60s, glute bridges 3×20, dead bugs 3×10 daily.' : null,
    isNoIssues                                     ? 'Maintain: Thoracic extensions and daily mobility to lock in your posture.'                      : null,
  ].filter(Boolean)
  const postureProtocol = postureProtocolLines.length
    ? postureProtocolLines.join(' ') + ' Consistent execution produces 2-grade improvement in 6 weeks.'
    : null
  const postureUrgency =
    postureScore != null && postureScore < 4 ? `⚠ Grade ${postureGrade ?? 'D'} — posture is significantly dragging your score` :
    postureScore != null && postureScore < 6 ? `Grade ${postureGrade ?? 'C'} — visible issues affecting perceived height and jaw` : null
  const postureScoreImpact =
    postureScore != null && postureScore < 7
      ? `Improving from grade ${postureGrade ?? 'C'} to grade A would add approximately +${Math.min((8.5 - postureScore) * 0.10, 1.2).toFixed(1)} to your overall score.`
      : null

  // Body Proportions
  const propScore  = bodyData?.bodyProportions ?? null
  const armDev     = bDetail.arm_development ?? null
  const chestDev   = bDetail.chest_development ?? null
  const bFrame     = bDetail.frame ?? null
  const propClass  =
    propScore == null ? null :
    propScore >= 7.5  ? 'Well Proportioned' :
    propScore >= 5.5  ? 'Average' :
    propScore >= 4.0  ? 'Imbalanced' : 'Significantly Imbalanced'
  const propKeyLine = [
    armDev   && `Arms: ${armDev}`,
    chestDev && `Chest: ${chestDev}`,
    bFrame   && `Frame: ${bFrame}`,
  ].filter(Boolean).join(' · ')
  const worstArea = armDev === 'underdeveloped' ? 'arms' : chestDev === 'flat' ? 'chest' : null
  const propDetected = [
    armDev   && `Arm development: ${armDev}.`,
    chestDev && `Chest development: ${chestDev}.`,
    bFrame   && `Overall frame: ${bFrame}.`,
    (!armDev && !chestDev && !bFrame) ? 'Proportions assessed from visible body structure in photo.' : null,
    worstArea ? `Your ${worstArea} are the primary imbalance — prioritize these before adding overall volume.` : null,
  ].filter(Boolean).join(' ')
  const propProtocol =
    worstArea === 'arms'
      ? 'Priority (arms): Barbell curls 3×10, skull crushers 3×12, hammer curls 3×15 — 2× per week. Add cable curls and tricep pushdowns. Visible change in 8–10 weeks of progressive loading.'
      : worstArea === 'chest'
      ? 'Priority (chest): Incline dumbbell press 4×10, cable flyes 3×12, weighted dips 3×12 — 2× per week. Incline press targets upper chest which is most visible. Expect change in 8–12 weeks.'
      : 'Focus on symmetry. Match lagging muscle groups to your strongest. Use progressive overload on any underdeveloped area before adding overall training volume.'
  const propScoreImpact =
    propScore != null && propScore < 6
      ? `Balancing proportions to 7.5+ could contribute approximately +${Math.min((7.5 - propScore) * 0.10, 1.0).toFixed(1)} to your overall score.`
      : null

  // Body Composition
  const compScore    = bodyData?.bodyComposition ?? null
  const bfRange      = bDetail.bf_range ?? null
  const muscleMass   = bDetail.muscle_mass_rating ?? null
  const compCategory = bodyData?.compositionCategory ?? null
  const compClass    =
    compCategory === 'LEAN_ATHLETIC' ? 'Lean Athletic' :
    compCategory === 'ATHLETIC'      ? 'Athletic'      :
    compCategory === 'AVERAGE'       ? 'Average'       :
    compCategory === 'OVERWEIGHT'    ? 'Overweight'    :
    compCategory === 'OBESE'         ? 'Obese'         : null
  const compKeyLine = [
    bfRange    && `Est. body fat: ${bfRange}%`,
    muscleMass && `Muscle mass: ${muscleMass.replace('_', ' ')}`,
  ].filter(Boolean).join(' · ')
  const compUrgency =
    compScore != null && compScore < 4 ? '⚠ Body fat is capping your entire score — this is your #1 fix' :
    compScore != null && compScore < 6 ? 'Body fat is simultaneously hiding your jawline and V-taper' : null
  const currentBsVal     = bodyData?.bodyScore ?? 5.0
  const gainIfAthletic   = currentBsVal < 7.5 ? Math.min((7.5 - currentBsVal) * 0.35, 2.5) : 0
  const projectedOverallScore = glowScore != null && gainIfAthletic > 0.1
    ? Math.min(glowScore + gainIfAthletic, 10).toFixed(1) : null
  const bfWeeksEstimate = bfRange
    ? (parseInt(bfRange.split('-')[0]) > 30 ? '20–28 weeks'
      : parseInt(bfRange.split('-')[0]) > 25 ? '16–20 weeks'
      : parseInt(bfRange.split('-')[0]) > 20 ? '12–16 weeks' : '8–12 weeks')
    : '12–20 weeks'
  const compDetected = [
    bfRange
      ? `Estimated body fat: ${bfRange}% (${compClass ?? 'assessed from photo'}).`
      : `Current category: ${compClass ?? 'assessed from photo'}.`,
    muscleMass ? `Muscle mass: ${muscleMass.replace('_', ' ')}.` : null,
    'Body fat is the single metric that simultaneously affects your score, jawline definition, V-taper, and posture grade.',
  ].filter(Boolean).join(' ')
  const compProtocol = bfRange
    ? `Target body fat: 12–15%. Currently estimated at ${bfRange}%. Calorie target: 500 cal/day deficit. Protein: 0.8–1g per lb of bodyweight. Estimated timeline to target range: ${bfWeeksEstimate}. This is your #1 improvement area — fixing this moves multiple metrics simultaneously.`
    : `Target body fat: 12–15%. Calorie target: 500 cal/day deficit. Protein: 0.8–1g per lb of bodyweight. Estimated timeline: ${bfWeeksEstimate}. Lowering body fat simultaneously improves your jawline, V-taper, and posture grade.`
  const compScoreImpact =
    projectedOverallScore != null && gainIfAthletic > 0.3
      ? `If you reach Athletic body fat (12–15%), your overall score would increase from ${glowScore?.toFixed(1)} to approximately ${projectedOverallScore}. This is the highest-impact single change you can make.`
      : null

  // ─── Skin Analysis ──────────────────────────────────────────────────────────
  const skinScore = faceData?.skinClarity ?? null
  const skinCategory =
    skinScore == null ? null :
    skinScore >= 8    ? 'Clear'         :
    skinScore >= 6.5  ? 'Good'          :
    skinScore >= 5    ? 'Fair'          :
    skinScore >= 3.5  ? 'Blemish-Prone' : 'Problematic'
  const skinIssues = skinScore == null ? [] : [
    skinScore < 6.5 ? 'acne'         : null,
    skinScore < 5   ? 'scarring'      : null,
    skinScore < 7   ? 'oiliness'      : null,
    skinScore < 6   ? 'dark_circles'  : null,
    skinScore < 8   ? 'dullness'      : null,
  ].filter(Boolean)
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

  const skinAMRoutine = [
    'Gentle cleanser (CeraVe or La Roche-Posay)',
    skinIssues.includes('scarring')    ? 'Vitamin C serum 15%'           : null,
    skinIssues.includes('oiliness')    ? 'Niacinamide 10%'               : null,
    skinIssues.includes('dark_circles')? 'Caffeine eye cream'            : null,
    'Lightweight moisturizer',
    'SPF 50 (non-negotiable — all actives require sun protection)',
  ].filter(Boolean)

  const skinPMRoutine = [
    'Gentle cleanser',
    skinIssues.includes('acne')        ? 'Benzoyl Peroxide 2.5% (spot treatment or full face)' : null,
    skinIssues.includes('dullness')    ? 'AHA/glycolic acid 2–3×/week (alternate with retinol)' : null,
    skinIssues.includes('scarring')    ? 'Retinol 0.3% (start 1×/week, build up)'              : null,
    skinIssues.includes('oiliness')    ? 'Niacinamide 10%'               : null,
    'Moisturizer (heavier than AM is fine)',
  ].filter(Boolean)

  // ─── Body Workout Plan ──────────────────────────────────────────────────────
  const workoutPhase =
    compCategory === 'OBESE' || compCategory === 'OVERWEIGHT' ? 'CUT' :
    compCategory === 'LEAN_ATHLETIC' ? 'SPECIALIZE' : 'RECOMP'

  const workoutPhaseLabel =
    workoutPhase === 'CUT'       ? 'Fat Loss + V-Taper Building' :
    workoutPhase === 'SPECIALIZE'? 'Specialization — Fix Weak Areas' : 'Recomp — Build While Cutting'

  const WORKOUT_LIBRARY = {
    vtaper: [
      { name: 'Wide-Grip Pull-Up',     sets: '4×8',  rest: '90s', why: 'Widens upper back — the #1 V-taper driver. Each set increases visible lat width.', scoreImpact: 'Adds lat width — directly improves Shoulder-Waist Ratio score.', week: 'Wk 1–12' },
      { name: 'Lateral Raise (Cable)', sets: '4×15', rest: '60s', why: 'Grows medial deltoid — widens shoulder silhouette above the waistline.', scoreImpact: 'Wider shoulders increase V-Taper and Dimorphism scores.', week: 'Wk 1–12' },
      { name: 'Overhead Press',        sets: '4×8',  rest: '90s', why: 'Builds anterior and medial delts — broadens shoulder cap for stronger V-taper.', scoreImpact: 'Shoulder mass directly increases Dimorphism pillar.', week: 'Wk 1–12' },
      { name: 'Cable Crunch + Vacuum', sets: '3×20', rest: '45s', why: 'Strengthens transverse abdominis to visually narrow the waist in combination with deficit.', scoreImpact: 'Narrower waist improves ratio — raises V-Taper score.', week: 'Wk 5–12' },
    ],
    posture: [
      { name: 'Face Pull (Cable)',      sets: '4×15', rest: '60s', why: 'Corrects rounded shoulders by strengthening rear delts and rotator cuff.', scoreImpact: 'Grade C → B improvement adds ~+0.4 to overall score.', week: 'Wk 1–12' },
      { name: 'Wall Angel',            sets: '3×12', rest: '45s', why: 'Resets thoracic extension — directly counters rounded-upper-back pattern.', scoreImpact: 'Upright posture increases perceived height by 1–2 inches visually.', week: 'Wk 1–8' },
      { name: 'Dead Bug',              sets: '3×10', rest: '45s', why: 'Activates deep core to correct anterior pelvic tilt — flattens stomach, straightens spine.', scoreImpact: 'APT correction improves Posture grade and reduces belly protrusion.', week: 'Wk 1–8' },
    ],
    proportion: [
      { name: 'Incline Dumbbell Press', sets: '4×10', rest: '90s', why: 'Targets upper chest — most visually prominent chest area both clothed and shirtless.', scoreImpact: 'Upper chest development improves Body Proportions score.', week: 'Wk 1–12' },
      { name: 'Barbell Curl',          sets: '3×10', rest: '60s', why: 'Builds bicep peak — most visible arm muscle from front angle.', scoreImpact: 'Arm development improves Proportions score and overall body impression.', week: 'Wk 1–12' },
      { name: 'Weighted Dip',          sets: '3×12', rest: '90s', why: 'Trains lower chest and tricep — creates fullness and arm thickness.', scoreImpact: 'Tricep mass adds visible arm thickness even in a T-shirt.', week: 'Wk 1–12' },
    ],
    composition: [
      { name: 'HIIT Sprint Intervals', sets: '8×30s / 90s rest', rest: 'Built-in', why: 'Spikes EPOC (post-exercise burn) — burns fat for 24–48h post-session.', scoreImpact: 'Fat loss simultaneously improves jawline, V-taper, and posture score.', week: 'Wk 1–12' },
      { name: 'Romanian Deadlift',     sets: '4×10', rest: '90s', why: 'Builds posterior chain while in a deficit — protects muscle during fat loss.', scoreImpact: 'Maintains body proportions score while cutting.', week: 'Wk 1–12' },
    ],
  }

  const weakBodyAreas = [
    swrScore    != null && swrScore    < 6.5 ? 'vtaper'      : null,
    propScore   != null && propScore   < 6   ? 'proportion'  : null,
    postureScore != null && postureScore < 6 ? 'posture'     : null,
    compScore   != null && compScore   < 5   ? 'composition' : null,
  ].filter(Boolean)

  const generatedWorkout = (() => {
    const areas = weakBodyAreas.length > 0 ? weakBodyAreas : ['vtaper']
    const exercises = areas.flatMap(a => WORKOUT_LIBRARY[a] ?? [])
    if (workoutPhase === 'CUT' && !weakBodyAreas.includes('composition')) {
      exercises.push(...WORKOUT_LIBRARY.composition)
    }
    const seen = new Set()
    return exercises.filter(e => { if (seen.has(e.name)) return false; seen.add(e.name); return true }).slice(0, 7)
  })()

  const workoutFreePreview = generatedWorkout[0] ?? null

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
    compCategory === 'OBESE' || compCategory === 'OVERWEIGHT' || nutGoal === 'Lose Fat' ? 'CUT' :
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

      {/* ── Body photo missing banner ─────────────────────────────── */}
      {bodySkipped && (
        <button
          onClick={() => navigate('/scan')}
          className="w-full mb-4 px-4 py-3 rounded-2xl flex items-center gap-3 text-left"
          style={{
            background: 'linear-gradient(135deg, rgba(198,168,92,0.1) 0%, rgba(198,168,92,0.04) 100%)',
            border: '1px solid rgba(198,168,92,0.3)',
          }}
        >
          <span className="text-lg flex-shrink-0">📸</span>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-[13px]" style={{ color: '#C6A85C' }}>
              Add a body photo to get your full score
            </p>
            <p className="font-body text-[11px] text-secondary leading-snug">
              Your score currently uses face only (70%) + grooming (30%). Tap to rescan with body.
            </p>
          </div>
          <ArrowRight size={14} style={{ color: '#C6A85C', flexShrink: 0 }} />
        </button>
      )}

      {/* ── Score breakdown card ───────────────────────────────────── */}
      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <GlowScoreRing score={glowScore} size="large" animated />
          <div className="flex-1">
            <p className="font-heading font-bold text-base text-primary mb-0.5">Score Breakdown</p>
            <p className="text-xs text-secondary font-body leading-relaxed">
              Face 55% · Body 35% · Appeal 10%
              {aiScore?.bodyFatCapApplied && <span className="text-warning"> · Body cap applied</span>}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              {[
                { label: 'Face', val: aiScore?.faceScore, color: '#1A6B5C' },
                { label: 'Body', val: aiScore?.bodyScore, color: '#F5A623' },
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
              {aiScore?.bodyFatLevel && <> · Body: <span className="font-bold capitalize text-primary">{aiScore.bodyFatLevel.replace('_', ' ')}</span></>}
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
                    <div
                      className="w-12 text-center py-1 rounded-lg text-xs font-mono font-bold flex-shrink-0"
                      style={{
                        color,
                        background: score >= 7 ? 'rgba(52,199,89,0.12)' : score >= 5 ? 'rgba(245,166,35,0.12)' : 'rgba(224,122,95,0.12)',
                      }}
                    >
                      {score.toFixed(1)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-heading font-bold text-primary">{label}</p>
                        <p className="text-[9px] text-secondary font-body">{detail}</p>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{ color }}>
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

      {/* ── Body Analysis ─────────────────────────────────────────── */}
      <Section title="Body Analysis" emoji="💪" defaultOpen={false}>
        {/* Score overview */}
        <div className="mb-3 rounded-xl p-3" style={{ background: 'rgba(26,107,92,0.07)', border: '1px solid rgba(26,107,92,0.15)' }}>
          <p className="text-[9px] font-heading font-bold uppercase tracking-wide text-secondary mb-2">
            Body Sub-Scores · <span style={{ color: '#C6A85C' }}>contributes 35% to your overall rating</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'V-Taper',      score: swrScore   },
              { label: 'Posture',      score: postureScore },
              { label: 'Proportions', score: propScore   },
              { label: 'Comp',         score: compScore  },
            ].map(({ label, score: s }) => {
              const c = s != null ? (s >= 7 ? '#34C759' : s >= 5 ? '#F5A623' : '#E07A5F') : '#888'
              return (
                <div key={label} className="text-center">
                  <div className="text-base font-mono font-bold leading-none mb-0.5" style={{ color: c }}>
                    {s != null ? s.toFixed(1) : '—'}
                  </div>
                  <div className="text-[9px] text-secondary font-body">{label}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-0">
          {swrScore != null && (
            <BodyMetricCard
              label="Shoulder-Waist Ratio (V-Taper)"
              score={swrScore}
              classification={swrClass}
              keyLine={swrKeyLine}
              urgencyLine={swrUrgency}
              detected={swrDetected}
              protocol={swrProtocol}
              scoreImpact={swrScoreImpact}
              isPremium={isPremium}
              onUpgrade={() => navigate('/premium')}
            />
          )}
          {postureScore != null && (
            <BodyMetricCard
              label={`Posture · Grade ${postureGrade ?? '—'}`}
              score={postureScore}
              classification={postureGrade ? `Grade ${postureGrade}` : null}
              keyLine={postureDetectedLines.length ? postureDetectedLines.join(' · ') : null}
              urgencyLine={postureUrgency}
              detected={postureDetected}
              protocol={postureProtocol}
              scoreImpact={postureScoreImpact}
              isPremium={isPremium}
              onUpgrade={() => navigate('/premium')}
            />
          )}
          {propScore != null && (
            <BodyMetricCard
              label="Body Proportions"
              score={propScore}
              classification={propClass}
              keyLine={propKeyLine || null}
              urgencyLine={propScore < 6 ? 'Imbalanced development is reducing your overall score' : null}
              detected={propDetected}
              protocol={propProtocol}
              scoreImpact={propScoreImpact}
              isPremium={isPremium}
              onUpgrade={() => navigate('/premium')}
            />
          )}
          {compScore != null && (
            <BodyMetricCard
              label="Body Composition"
              score={compScore}
              classification={compClass}
              keyLine={compKeyLine || null}
              urgencyLine={compUrgency}
              detected={compDetected}
              protocol={compProtocol}
              scoreImpact={compScoreImpact}
              isPremium={isPremium}
              onUpgrade={() => navigate('/premium')}
            />
          )}
        </div>

        {/* Score projection */}
        {projectedOverallScore != null && gainIfAthletic > 0.3 && (
          <div className="mt-3 rounded-xl p-3 border" style={{ borderColor: 'rgba(245,166,35,0.40)', background: 'rgba(245,166,35,0.07)' }}>
            <p className="text-[9px] font-heading font-bold uppercase tracking-wide mb-1.5" style={{ color: '#F5A623' }}>
              Your Potential Score
            </p>
            <p className="text-xs font-body leading-relaxed text-primary">
              If you reach Athletic body fat (12–15%) and build your V-Taper, your score could increase from{' '}
              <span className="font-bold font-mono" style={{ color: '#E07A5F' }}>{glowScore?.toFixed(1)}</span>
              {' '}to approximately{' '}
              <span className="font-bold font-mono" style={{ color: '#34C759' }}>{projectedOverallScore}</span>.
            </p>
          </div>
        )}
      </Section>

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
                <p className="text-sm font-heading font-bold text-primary">{match.celebrity}</p>
                {(match.shared_traits || match.reason) && (
                  <p className="text-[10px] font-body mt-0.5" style={{ color: '#C6A85C', opacity: 0.8 }}>
                    {match.shared_traits || match.reason}
                  </p>
                )}
                <div className="mt-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #C6A85C, #F5A623)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${match.similarity}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: i * 0.15 }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-[#C6A85C] flex-shrink-0">{match.similarity}%</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Skin Analysis ────────────────────────────────────────── */}
      {skinScore != null && (
        <Section title="Skin Analysis" emoji="🧬" defaultOpen={false} badge="PRO">
          {/* Free: score + category */}
          <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.18)' }}>
            <div className="text-center flex-shrink-0">
              <div className="text-2xl font-mono font-bold" style={{ color: skinScore >= 7 ? '#34C759' : skinScore >= 5 ? '#F5A623' : '#E07A5F' }}>
                {skinScore.toFixed(1)}
              </div>
              <div className="text-[9px] font-body text-secondary">/10</div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-heading font-bold text-primary">{skinCategory}</p>
              <p className="text-[10px] text-secondary font-body leading-snug">
                {skinIssues.length > 0
                  ? `Detected: ${skinIssues.map(i => i.replace('_', ' ')).join(', ')}`
                  : 'No major skin issues detected'}
              </p>
              {skinPotential && (
                <p className="text-[10px] font-body mt-0.5" style={{ color: '#C6A85C' }}>
                  With this routine: {skinScore.toFixed(1)} → {skinPotential} skin score
                </p>
              )}
            </div>
          </div>

          {/* Pro: full ingredient protocol */}
          {isPremium ? (
            <div className="space-y-4">
              {skinIssues.length > 0 && skinIssues.map(issue => {
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

      {/* ── Body Workout Plan ─────────────────────────────────────── */}
      {generatedWorkout.length > 0 && (
        <Section title="Body Workout Plan" emoji="💪" defaultOpen={false} badge="PRO">
          {/* Free: phase label + 1 exercise preview */}
          <div className="mb-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(26,107,92,0.08)', border: '1px solid rgba(26,107,92,0.20)' }}>
            <p className="text-[9px] font-heading font-bold uppercase tracking-wide text-secondary mb-0.5">Your Training Phase</p>
            <p className="text-sm font-heading font-bold text-primary">{workoutPhaseLabel}</p>
            <p className="text-[10px] text-secondary font-body mt-0.5">
              Built from your body scan · {weakBodyAreas.length > 0 ? `Targeting: ${weakBodyAreas.join(', ')}` : 'Targeting: V-Taper development'}
            </p>
          </div>

          {workoutFreePreview && (
            <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[12px] font-heading font-bold text-primary">{workoutFreePreview.name}</p>
                <div className="flex gap-2">
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(26,107,92,0.15)', color: '#1A6B5C' }}>{workoutFreePreview.sets}</span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full text-secondary" style={{ background: 'rgba(255,255,255,0.05)' }}>Rest {workoutFreePreview.rest}</span>
                </div>
              </div>
              <p className="text-[10px] text-secondary font-body leading-relaxed">{workoutFreePreview.why}</p>
              <p className="text-[10px] font-body mt-1" style={{ color: '#C6A85C' }}>Score impact: {workoutFreePreview.scoreImpact}</p>
            </div>
          )}

          {/* Pro: full plan */}
          {isPremium ? (
            <div className="space-y-2">
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-secondary mb-2">12-Week Appearance Plan · {generatedWorkout.length} exercises</p>
              {generatedWorkout.map((ex, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[12px] font-heading font-bold text-primary leading-tight">{ex.name}</p>
                    <div className="flex gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(26,107,92,0.15)', color: '#1A6B5C' }}>{ex.sets}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full text-secondary" style={{ background: 'rgba(255,255,255,0.05)' }}>{ex.week}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-secondary font-body leading-relaxed mb-1">{ex.why}</p>
                  <p className="text-[10px] font-body" style={{ color: '#C6A85C' }}>Score impact: {ex.scoreImpact}</p>
                </div>
              ))}
              <div className="mt-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.18)' }}>
                <p className="text-[10px] font-body text-secondary leading-relaxed">
                  <span className="font-bold text-primary">Frequency:</span> 4×/week. Run each session in the order listed.
                  {workoutPhase === 'CUT' ? ' Combine with 500 cal/day deficit for maximum fat loss while maintaining muscle.' : workoutPhase === 'BULK' ? ' Eat 300 cal surplus on training days. Prioritize protein at 1g/lb bodyweight.' : ' Eat at maintenance. High protein (1g/lb) mandatory for recomp to work.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden">
              <div className="blur-sm pointer-events-none select-none opacity-35 space-y-2">
                {['Wide-Grip Pull-Up — 4×8 · Widens upper back — V-taper driver', 'Lateral Raise — 4×15 · Grows medial deltoid, widens silhouette', 'Overhead Press — 4×8 · Broadens shoulder cap', 'Face Pull — 4×15 · Corrects rounded shoulders', 'Incline Dumbbell Press — 4×10 · Upper chest visibility'].map((ex, i) => (
                  <div key={i} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                    <p className="text-[10px] font-body text-primary">{ex}</p>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl">
                <Lock size={18} className="text-[#C6A85C] mb-2" />
                <p className="font-heading font-bold text-sm text-primary mb-0.5">Pro Feature</p>
                <p className="text-[11px] text-secondary font-body mb-3 text-center px-4">Full 12-week appearance-focused plan built from your body scan results</p>
                <button onClick={() => navigate('/premium')} className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-black" style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)' }}>
                  Upgrade to Pro →
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

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
          glowScore={currentScan?.glowScore}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </AnimatePresence>
    </>
  )
}
