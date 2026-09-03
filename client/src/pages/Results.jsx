import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Share2, ChevronDown, ChevronUp, ChevronRight, Lock,
  ShoppingBag, ExternalLink, Camera, BarChart2, Star,
  AlertTriangle, Ruler, User, Scissors, FlaskConical,
  Heart, Gift, Bot, Flame, Zap, TrendingUp, Dumbbell,
  Home, Columns,
} from 'lucide-react'
import { api } from '../utils/api'
import useStore from '../store/useStore'
import GlowScoreRing from '../components/GlowScoreRing'
import ShareCardModal from '../components/ShareCardModal'
import DevRankCard from '../components/DevRankCard'
import ProLock from '../components/ProLock'
import PaywallModal from '../components/PaywallModal'
import { GOLD_GRADIENT } from '../utils/theme'

// ─── Tier color map ───────────────────────────────────────────────────────────
const TIER_COLORS = {
  'Sub 3':            '#6B7280',
  'Low Tier Normie':  '#9CA3AF',
  'Mid Tier Normie':  '#60A5FA',
  'High Tier Normie': '#34D399',
  'Chadlite':         '#F59E0B',
  'Chad':             '#EF4444',
  'Adam Lite':        '#DDA0FF',
  'True Adam':        '#FFD700',
  'Low Tier Becky':   '#9CA3AF',
  'Mid Tier Becky':   '#60A5FA',
  'High Tier Becky':  '#34D399',
  'Stacy':            '#F59E0B',
  'Eve':              '#EF4444',
  'Eve Lite':         '#DDA0FF',
  'True Eve':         '#FFD700',
}

// ─── Score reveal ─────────────────────────────────────────────────────────────
function ScoreReveal({ score, tier, onDone }) {
  const reducedMotion = useReducedMotion()
  const [phase, setPhase] = useState('dark')
  const [display, setDisplay] = useState(0)
  const tierColor = TIER_COLORS[tier] ?? '#C6A85C'

  useEffect(() => {
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
      if (current >= target) { clearInterval(timer); setTimeout(() => setPhase('tier'), 300) }
    }, interval)
    return () => clearInterval(timer)
  }, [phase, score])

  useEffect(() => {
    if (phase !== 'tier') return
    const t = setTimeout(() => setPhase('done'), 1600)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => { if (phase === 'done') onDone() }, [phase, onDone])

  const getScoreIcon = (s) =>
    s >= 8.5 ? <Flame size={40} style={{ color: '#FF6B35' }} />
    : s >= 7  ? <Zap   size={40} style={{ color: '#F5A623' }} />
    : s >= 5  ? <TrendingUp size={40} style={{ color: '#34C759' }} />
    : <Dumbbell size={40} style={{ color: '#60A5FA' }} />

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div key="reveal" initial={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: '#000' }}>
          <AnimatePresence>
            {phase !== 'dark' && (
              <motion.div
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reducedMotion ? { duration: 0.2 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center">
                <p className="font-heading font-bold" style={{ fontSize: 96, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff', textShadow: `0 0 60px ${tierColor}88` }}>
                  {display.toFixed(1)}
                </p>
                <p className="font-heading text-[18px] mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>out of 10</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {phase === 'tier' && (
              <motion.div
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reducedMotion ? { duration: 0.2 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 text-center">
                <div className="flex justify-center mb-2">{getScoreIcon(score ?? 0)}</div>
                <div className="inline-block px-6 py-2.5 rounded-full font-heading font-bold text-[15px] uppercase tracking-widest"
                  style={{ background: `${tierColor}18`, border: `1.5px solid ${tierColor}55`, color: tierColor, boxShadow: `0 0 30px ${tierColor}33` }}>
                  {tier}
                </div>
                <p className="mt-3 font-body text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Tap to see full breakdown</p>
              </motion.div>
            )}
          </AnimatePresence>
          {phase !== 'dark' && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(circle at 50% 45%, ${tierColor}22 0%, transparent 65%)` }} />
          )}
          {phase !== 'dark' && (
            <button onClick={onDone} className="absolute bottom-14 font-body text-[12px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              tap to skip
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Hairstyle recommendations ────────────────────────────────────────────────
const HAIRSTYLE_RECS = {
  straight: {
    'soft/round': { label: 'Round Face · Straight Hair', advice: 'Add height on top to elongate. Avoid width-adding styles.', cuts: [{ name: 'Textured Crop', why: 'Adds height, creates illusion of length' }, { name: 'French Crop with Fringe', why: 'Structured top reduces roundness' }, { name: 'Quiff', why: 'Volume on top draws the eye upward' }], avoid: 'Buzz cuts, bowl cuts, or anything that emphasizes width' },
    average:      { label: 'Average Face · Straight Hair', advice: 'Versatile face shape. Most styles work. Aim for clean execution.', cuts: [{ name: 'Undercut', why: 'Clean contrast, always sharp' }, { name: 'Ivy League / Side Part', why: 'Classic and timeless' }, { name: 'Textured Quiff', why: 'Adds dimension without altering face shape' }], avoid: 'Overly complex styles that distract rather than enhance' },
    defined:      { label: 'Defined Face · Straight Hair', advice: 'Strong structure supports clean, minimal cuts beautifully.', cuts: [{ name: 'Buzz Cut', why: 'Showcases bone structure unobstructed' }, { name: 'Slick Back', why: 'Exposes the hairline, emphasizes jaw' }, { name: 'Mid Fade Crew Cut', why: 'Sharp edges complement your jawline' }], avoid: 'Heavy volume styles that compete with your natural structure' },
    strong:       { label: 'Strong Structure · Straight Hair', advice: 'Elite bone structure. Almost any style works.', cuts: [{ name: 'Caesar Cut', why: 'Timeless for strong jaw and brow ridge' }, { name: 'Modern Pompadour', why: 'Commands attention, pairs with structure' }, { name: 'French Crop / Buzz', why: 'Both showcase structure without fighting it' }], avoid: "Messy, unkempt styles. The only thing that can pull you down" },
  },
  wavy: {
    'soft/round': { label: 'Round Face · Wavy Hair', advice: 'Use the natural wave to add height. Keep sides tight.', cuts: [{ name: 'Wavy Textured Crop', why: 'Wave adds natural height and structure' }, { name: 'Quiff with Fade', why: 'Directs volume upward, not outward' }, { name: 'Fringe with Taper', why: 'Softens roundness, adds forward length' }], avoid: 'Letting waves grow out wide on the sides. Widens the face' },
    average:      { label: 'Average Face · Wavy Hair', advice: 'Wavy texture is versatile. Lean into natural movement.', cuts: [{ name: 'Messy Textured Cut', why: 'Natural movement enhances features' }, { name: 'Curtain Fringe', why: 'Trending and flattering on most face shapes' }, { name: 'Mid Fade with Waves', why: 'Clean sides with natural top texture' }], avoid: 'Overly straight blowouts that eliminate natural texture' },
    defined:      { label: 'Defined Face · Wavy Hair', advice: 'Sharp structure pairs well with controlled wave texture.', cuts: [{ name: 'Slick Back with Waves', why: 'Controlled and sharp' }, { name: 'Textured Crop Fade', why: 'Wave texture adds personality to structure' }, { name: 'Short Back and Sides', why: 'Clean contrast, showcases bone structure' }], avoid: 'Uncontrolled volume that obscures the jaw and cheekbones' },
    strong:       { label: 'Strong Structure · Wavy Hair', advice: 'Strong bones + wavy texture = effortless style.', cuts: [{ name: 'Textured Caesar', why: 'Wave adds dimension to a powerful cut' }, { name: 'Slick Back', why: 'Shows off structure completely' }, { name: 'Curtain Fringe', why: 'Softens without hiding your strong structure' }], avoid: 'Over-product and helmet hair. Your natural texture is the asset' },
  },
  curly: {
    'soft/round': { label: 'Round Face · Curly Hair', advice: 'Height is your best friend. Keep the sides tapered and stack volume upward.', cuts: [{ name: 'Curly Top Fade', why: 'Volume stays on top, sides stay tight. Elongates face' }, { name: 'Defined Curl with Taper', why: 'Structure and definition prevent width-spreading' }, { name: 'Curly Fringe Forward', why: 'Brings the eye forward and down, reducing roundness' }], avoid: 'Wide curly afro shapes or letting sides grow out. Adds width to an already wide face' },
    average:      { label: 'Average Face · Curly Hair', advice: 'Lucky. Curly hair works well here. Focus on definition and moisture.', cuts: [{ name: 'Curly Top Fade', why: 'Clean and modern, suits the balanced shape' }, { name: 'Defined Curl Afro', why: 'Natural texture shines with balanced proportions' }, { name: 'Curtain Curls', why: 'Soft and flattering, works with curl pattern' }], avoid: 'Letting curls dry out and frizz. Definition is everything' },
    defined:      { label: 'Defined Face · Curly Hair', advice: 'Sharp structure + curly texture = unique and striking.', cuts: [{ name: 'Curly Mid Fade', why: 'Sharp line-up with natural top texture pops' }, { name: 'Short Curl Crop', why: 'Controlled length shows off cheekbones and jaw' }, { name: 'Curly Fringe', why: 'Adds a soft contrast to the angular structure' }], avoid: 'Perm-straight styles that erase your natural curl pattern advantage' },
    strong:       { label: 'Strong Structure · Curly Hair', advice: 'Elite structure + curls is a rare combo. Own it.', cuts: [{ name: 'High Fade with Curly Top', why: 'Maximizes the contrast with strong bone structure' }, { name: 'Defined Full Curl', why: 'Volume complements without overpowering the face' }, { name: 'Curly Caesar', why: 'Classic cut adapted for curls. Sharp and confident' }], avoid: 'Messy, undefined frizz. Define those curls with product' },
  },
  coily: {
    'soft/round': { label: 'Round Face · Coily/Afro Hair', advice: 'Stack all height upward. Taper the sides tight to elongate and define.', cuts: [{ name: 'High Top Fade', why: 'Adds dramatic height. Elongates the face significantly' }, { name: 'Afro with Tapered Sides', why: 'Volume on top, tight sides. The ideal round-face afro' }, { name: 'Twist Out with Fade', why: 'Structured definition adds length and reduces width perception' }], avoid: 'Full rounded afro with no tapering. It mirrors the round face and doubles the width' },
    average:      { label: 'Average Face · Coily/Afro Hair', advice: 'Almost anything works. Shadow fade with afro or locs is a signature look.', cuts: [{ name: 'Shadow Fade with Afro', why: 'Clean gradient keeps the look sharp and balanced' }, { name: 'Tapered Afro', why: 'Natural volume with clean edges. Timeless' }, { name: 'Twist Out', why: 'Definition and texture, suits the balanced proportions' }], avoid: 'Neglected edges. Line-ups make or break the afro look' },
    defined:      { label: 'Defined Face · Coily/Afro Hair', advice: 'Sharp angles + coily texture is a powerful combination.', cuts: [{ name: 'Soft Afro with Rounded Top', why: 'The softness contrasts and complements sharp angles' }, { name: 'Mid Fade with Afro Top', why: 'Structure on the sides highlights the jawline' }, { name: 'Twist Out Natural', why: 'Texture adds softness without hiding structure' }], avoid: 'Flat tops or extremely angular cuts. Competes with the face, not complements it' },
    strong:       { label: 'Strong Structure · Coily/Afro Hair', advice: 'Elite bones + afro texture = powerful and distinctive.', cuts: [{ name: 'Full Afro', why: 'Volume frames the strong structure with authority' }, { name: 'High Top Fade', why: 'Dramatic height amplifies the bone structure' }, { name: 'Tapered Sides with Volume Top', why: 'Maximizes contrast and showcases structure' }], avoid: 'Unkempt or neglected texture. Moisture and definition are non-negotiable' },
  },
  locs: {
    'soft/round': { label: 'Round Face · Locs', advice: 'Wear locs upward or on top to add height. Keep the sides clean.', cuts: [{ name: 'Short Locs with Fade', why: 'Clean sides + structured top elongates the face' }, { name: 'Mid-Length Locs Worn Up', why: 'Height adds length to a round face' }, { name: 'Loc Mohawk', why: 'Volume in the center creates angularity and height' }], avoid: 'Locs worn fully down and loose. Adds width at jaw level' },
    average:      { label: 'Average Face · Locs', advice: 'Locs suit balanced faces at any length. Maintain them well.', cuts: [{ name: 'Mid-Length Locs Any Style', why: 'Balanced face handles any loc length or style' }, { name: 'Long Locs Worn Back', why: 'Elongates face and looks polished' }, { name: 'Short Locs with Line-Up', why: 'Clean and structured. Sharp presentation' }], avoid: 'Neglected, frizzy locs without moisture or retwisting. Upkeep is everything' },
    defined:      { label: 'Defined Face · Locs', advice: 'Sharp structure + locs is an iconic combination.', cuts: [{ name: 'Loc Mohawk', why: 'Adds angularity that complements sharp features' }, { name: 'Short Locs Fade', why: 'Precision edges match the precision of the face' }, { name: 'Mid-Length Locs Worn Up', why: 'Height enhances vertical length of a defined face' }], avoid: 'Flat, fully down locs that cover the jawline. Show it off' },
    strong:       { label: 'Strong Structure · Locs', advice: 'Strong bone structure wears every loc style with authority.', cuts: [{ name: 'Long Locs Worn Down', why: 'Elongates and frames elite structure' }, { name: 'Long Locs Worn Back', why: 'Full exposure of the structure. Nothing to hide' }, { name: 'Mid-Length Locs Any Style', why: 'Structure carries any length effortlessly' }], avoid: 'Over-accessorizing locs. The face and locs speak for themselves' },
  },
  bald: {
    'soft/round': { label: 'Round Face · Bald/Shaved', advice: 'Grow a beard to add angularity and length to the chin.', cuts: [{ name: 'Full Beard', why: 'Adds definition and elongates the face shape' }, { name: 'Goatee / Chin Beard', why: 'Lengthens the chin, reduces apparent roundness' }, { name: 'Stubble', why: 'Even light stubble adds jaw definition' }], avoid: 'Clean-shaven bald. Removes all structure from the face at once' },
    average:      { label: 'Average Face · Bald/Shaved', advice: 'Bald works on a balanced face. Maintain skin and beard sharp.', cuts: [{ name: 'Clean Bald with Beard', why: 'Classic combination. Confident and sharp' }, { name: 'Stubble Bald', why: 'Low maintenance, always looks intentional' }, { name: 'Shadow Fade to Bald', why: 'Gradual transition looks deliberate not receding' }], avoid: 'Patchy or ungroomed beard. If you go bald, the beard must be sharp' },
    defined:      { label: 'Defined Face · Bald/Shaved', advice: 'Strong structure is amplified bald. This is the power move.', cuts: [{ name: 'Clean Shaved Bald', why: 'Maximum structure exposure. The Vin Diesel effect' }, { name: 'Bald with Sharp Beard', why: 'Defines the jaw even further' }, { name: 'Shadow Fade to Skin', why: 'Polished look that highlights structure' }], avoid: 'Anything that looks accidental. Commit fully to the look' },
    strong:       { label: 'Strong Structure · Bald/Shaved', advice: 'Elite structure bald is the highest tier aesthetic. No hair needed.', cuts: [{ name: 'Clean Bald', why: 'Nothing can compete with elite bald structure' }, { name: 'Bald with Full Beard', why: 'The full power look. Dominant and intentional' }, { name: 'Polished Bald', why: 'Moisturized, shining scalp signals discipline' }], avoid: 'Neglected scalp. Moisturize daily and keep the look deliberate' },
  },
}

function resolveHairType(aiHairType, storedHairType) {
  const valid = ['straight', 'wavy', 'curly', 'coily', 'locs', 'bald']
  if (storedHairType && valid.includes(storedHairType)) return storedHairType
  if (aiHairType && valid.includes(aiHairType)) return aiHairType
  return null
}
function getHairRec(hairType, faceShape) {
  const shape = ['soft/round', 'average', 'defined', 'strong'].includes(faceShape) ? faceShape : 'average'
  const typeMap = HAIRSTYLE_RECS[hairType]
  if (!typeMap) return null
  return typeMap[shape] ?? typeMap['average']
}
const HAIR_TYPE_OPTIONS = [
  { value: 'straight', label: 'Straight' },
  { value: 'wavy',     label: 'Wavy'     },
  { value: 'curly',    label: 'Curly'    },
  { value: 'coily',    label: 'Coily/Afro' },
  { value: 'locs',     label: 'Locs'     },
  { value: 'bald',     label: 'Bald/Shaved' },
]

// ─── Skin ingredients ─────────────────────────────────────────────────────────
const SKIN_INGREDIENTS = {
  acne: [{ name: 'Benzoyl Peroxide 2.5%', why: 'Kills acne-causing bacteria (C. acnes) at the source. 2.5% is as effective as 10% with far less irritation.', how: 'Apply thin layer to affected areas after cleansing. Start 3×/week, increase to daily as tolerated.', when: 'PM only. Causes photosensitivity.', timeline: '2–4 weeks for reduction. 8–12 weeks for significant clearing.', warning: 'Can bleach fabric. Patch test first. Do not use with tretinoin on same night.', pillar: 'Clears skin texture. Directly raises your Features score.' }],
  scarring: [
    { name: 'Vitamin C (L-Ascorbic Acid 15%)', why: 'Inhibits melanin production. Fades hyperpigmentation and post-acne marks.', how: 'Apply 3–4 drops to clean dry face. Let absorb 3 min before next step.', when: 'AM. Boosts SPF protection and brightens through the day.', timeline: '4–8 weeks visible fading. Full effect in 12 weeks.', warning: 'Unstable. Use within 3 months of opening. Store away from light.', pillar: 'Even skin tone reads as more symmetric. Improves Harmony score.' },
    { name: 'Alpha Arbutin 2%', why: 'Inhibits tyrosinase (the enzyme that makes dark spots). Gentler than kojic acid.', how: 'Apply 2 drops after toner, before moisturizer.', when: 'AM and PM.', timeline: '6–8 weeks for measurable lightening.', warning: 'Stack with Vitamin C for 2× effect.', pillar: 'Reduces the visual evidence of past breakouts. Raises Features score.' },
    { name: 'Retinol 0.3% → 0.5%', why: 'Speeds cell turnover. Pushes scarred cells out and builds collagen beneath.', how: 'Rice-grain amount on full face. Start 1×/week, increase to 3× over 6 weeks.', when: 'PM only. Always use SPF next morning.', timeline: 'Visible texture change in 8–16 weeks. Best results at 6+ months.', warning: 'Purging is normal weeks 2–6. Do not combine with AHAs on same night.', pillar: 'Strongest OTC texture intervention. Improves Features score long-term.' },
  ],
  oiliness: [{ name: 'Niacinamide 10%', why: 'Regulates sebum production at the sebaceous gland level. Also reduces pore appearance.', how: 'Apply 2–3 drops after cleansing, before moisturizer.', when: 'AM and PM.', timeline: '4–6 weeks for visible pore and oil reduction.', warning: 'Do not layer with Vitamin C in the same routine. Split AM/PM.', pillar: 'Controls shine and pore size. Improves skin texture score.' }],
  dark_circles: [
    { name: 'Caffeine Eye Cream', why: 'Vasoconstrictor. Constricts blood vessels under-eye to reduce dark circles and puffiness.', how: 'Tap gently with ring finger around orbital bone. Never pull the skin.', when: 'AM primarily. Can use PM too.', timeline: 'Immediate de-puffing. Consistent darkening reduction in 6–8 weeks.', warning: 'Will not fix structural dark circles (bone-related). Works on vascular/pigment type.', pillar: 'Improves Eye Area score. Directly raises facial attractiveness.' },
    { name: 'Sleep Consistency', why: '7–9 hours reduces cortisol-driven inflammation and blood vessel dilation that causes under-eye darkness.', how: 'Same bedtime and wake time daily including weekends.', when: 'Ongoing.', timeline: 'Visible within 5–7 days of consistent sleep.', warning: 'No product replaces sleep. This is the root fix.', pillar: 'Sleep affects every score. Eye Area, skin clarity, and jawline definition all improve.' },
  ],
  dullness: [{ name: 'AHA (Glycolic Acid 8% or Lactic Acid 10%)', why: 'Exfoliates dead cell layer. Reveals brighter, smoother skin underneath.', how: 'Apply to dry face after cleansing. Leave 20 min then rinse or leave overnight.', when: 'PM 2–3×/week. Never on same night as retinol.', timeline: '2 weeks to notice glow. 6 weeks for significant brightness.', warning: 'Mandatory SPF next morning. AHAs increase photosensitivity. Start 1×/week.', pillar: 'Brightness directly improves perceived skin health. Raises overall facial impression.' }],
}

// ─── Protocol color map for Skin tab ─────────────────────────────────────────
const PROTOCOL_META = {
  acne:         { color: '#EF4444', label: 'Acne Protocol'        },
  scarring:     { color: '#A29BFE', label: 'Scarring & Marks'     },
  oiliness:     { color: '#60A5FA', label: 'Oiliness Protocol'    },
  dark_circles: { color: '#2DD4BF', label: 'Dark Circles Protocol'},
  dullness:     { color: '#F5A623', label: 'Dullness Protocol'    },
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview', icon: BarChart2   },
  { id: 'metrics',   label: 'Face',     icon: Ruler       },
  { id: 'profile',   label: 'Profile',  icon: User        },
  { id: 'skin',      label: 'Skin',     icon: FlaskConical},
  { id: 'products',  label: 'Products', icon: ShoppingBag },
]

// ─── Canonical metric row ─────────────────────────────────────────────────────
function MetricRow({ label, note, score, locked = false, onUpgrade }) {
  if (locked) {
    return (
      <div className="relative overflow-hidden py-3 border-b border-default last:border-0">
        <div className="blur-sm select-none pointer-events-none opacity-40">
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <p className="text-sm font-heading font-semibold text-primary">{label}</p>
              <p className="text-[10px] text-secondary font-body mt-0.5">Pro metric</p>
            </div>
            <span className="font-mono font-bold text-sm" style={{ color: '#C6A85C' }}>
              7.5<span className="text-[9px] font-normal text-secondary">/10</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full w-3/4" style={{ background: 'linear-gradient(90deg, #B8973E, #C6A85C)' }} />
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-between px-3 rounded-lg"
          style={{ background: 'rgba(18,18,18,0.78)', backdropFilter: 'blur(2px)' }}>
          <div className="flex items-center gap-1.5">
            <Lock size={10} style={{ color: '#C6A85C' }} />
            <span className="text-[10px] font-heading font-bold" style={{ color: '#C6A85C' }}>Pro metric</span>
          </div>
          <button onClick={onUpgrade}
            className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-md text-black"
            style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 100%)' }}>
            Unlock
          </button>
        </div>
      </div>
    )
  }

  const pct   = score != null ? Math.min(100, Math.max(0, ((score - 1) / 9) * 100)) : 0
  const color = score >= 7 ? '#34C759' : score >= 5 ? '#F5A623' : '#E07A5F'

  return (
    <div className="py-3 border-b border-default last:border-0">
      <div className="flex items-start justify-between mb-1.5 gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-semibold text-primary">{label}</p>
          {note && <p className="text-[10px] text-secondary font-body mt-0.5 leading-snug">{note}</p>}
        </div>
        <span className="font-mono font-bold text-sm flex-shrink-0" style={{ color }}>
          {score?.toFixed(1)}<span className="text-[9px] font-normal text-secondary">/10</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}77 0%, ${color} 100%)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}

// ─── Inline pro text gate ─────────────────────────────────────────────────────
function ProText({ text, onUpgrade }) {
  return (
    <div className="relative rounded-xl overflow-hidden mt-1">
      <p className="text-[10px] text-secondary font-body blur-[4px] select-none pointer-events-none leading-relaxed">{text}</p>
      <div className="absolute inset-0 flex items-center justify-between px-2.5 bg-card/60 backdrop-blur-[1px] rounded-xl">
        <div className="flex items-center gap-1.5">
          <Lock size={10} className="text-[#C6A85C]" />
          <span className="text-[10px] font-heading font-bold text-[#C6A85C]">Pro detail</span>
        </div>
        <button onClick={onUpgrade}
          className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-md text-black"
          style={{ background: '#F5A623' }}>
          Unlock
        </button>
      </div>
    </div>
  )
}

// ─── Main Results page ────────────────────────────────────────────────────────
export default function Results() {
  const navigate = useNavigate()
  const { currentScan, isPremium, pendingFacePhoto, assignedPhase, hairType, setHairType, user } = useStore()

  const [activeTab,        setActiveTab]        = useState('overview')
  const [showShareCard,    setShowShareCard]     = useState(false)
  const [showPaywall,      setShowPaywall]       = useState(false)
  const [hairOpen,         setHairOpen]          = useState(false)
  const [products,         setProducts]          = useState([])
  const [productsLoading,  setProductsLoading]   = useState(false)
  const [productsFetched,  setProductsFetched]   = useState(false)
  const [revealDone,       setRevealDone]         = useState(false)

  const isDevUnlocked     = user?.promoRedeemed === true
  const [showDevCard,     setShowDevCard]        = useState(false)
  const paywallDismissed  = useRef(!!sessionStorage.getItem('asc_paywall_dismissed'))
  const paywallTimer      = useRef(null)

  const isNewScan = currentScan && (Date.now() - new Date(currentScan.analyzedAt).getTime()) < 10000
  const [showReveal] = useState(() => {
    if (!isNewScan) return false
    try { if (sessionStorage.getItem('asc_reveal_shown') === (currentScan?.id ?? '')) return false } catch {}
    return true
  })

  // Paywall auto-show
  useEffect(() => {
    if (isPremium || !currentScan || paywallDismissed.current) return
    if (isNewScan) {
      if (revealDone) setShowPaywall(true)
    } else {
      paywallTimer.current = setTimeout(() => {
        setShowPaywall(true)
        paywallTimer.current = null
      }, 3000)
      return () => { clearTimeout(paywallTimer.current); paywallTimer.current = null }
    }
  }, [isPremium, currentScan, isNewScan, revealDone])

  // In-app review after reveal (premium + fresh scan)
  useEffect(() => {
    if (!isPremium || !isNewScan || !revealDone) return
    const t = setTimeout(async () => {
      try { const { InAppReview } = await import('@capacitor-community/in-app-review'); await InAppReview.requestReview() } catch {}
    }, 2000)
    return () => clearTimeout(t)
  }, [isPremium, isNewScan, revealDone])

  // Products fetch — must be above the early return to satisfy Rules of Hooks
  useEffect(() => {
    if (!currentScan || activeTab !== 'products' || productsFetched || !isPremium) return
    const { faceData: fd, aiScore: ai, pillars: sp, gender: g } = currentScan
    const sk = fd?.skinClarity ?? null
    const issues = sk == null ? [] : [
      sk < 5.5 ? 'acne' : null, sk < 4.5 ? 'scarring' : null,
      sk < 6.0 ? 'oiliness' : null, sk < 5.0 ? 'dark_circles' : null,
      sk < 6.5 ? 'dullness' : null,
    ].filter(Boolean)
    setProductsLoading(true)
    api.products.recommendations({
      weaknesses:    ai?.keyWeaknesses ?? [],
      skinIssues:    issues,
      groomingScore: ai?.groomingScore ?? null,
      pillars:       sp ?? ai?.pillars ?? null,
      gender:        g,
    }).then(({ products: recs }) => { setProducts(recs || []); setProductsFetched(true) })
      .catch(() => { setProducts([]); setProductsFetched(true) })
      .finally(() => setProductsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, productsFetched, isPremium, currentScan])

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
  const glowScore    = currentScan.glowScore != null ? (currentScan.glowScore > 10 ? Math.round(currentScan.glowScore) / 10 : currentScan.glowScore) : null
  const pillars      = scanPillars ?? aiScore?.pillars ?? null
  const tierColor    = TIER_COLORS[tier] ?? '#C6A85C'

  const profileData    = aiScore?.profileData  ?? null
  const profileScore   = aiScore?.profileScore ?? null
  const hasSideProfile = !!(aiScore?.hasSideProfile || profileData)
  const faceMetrics    = aiScore?.faceMetrics  ?? null
  const facialStructure = aiScore?.facialStructure ?? 'average'

  const aiDetectedHairType = aiScore?.hairType && aiScore.hairType !== 'unknown' ? aiScore.hairType : null
  const resolvedHT = resolveHairType(aiDetectedHairType, hairType)
  const hairRec    = resolvedHT ? getHairRec(resolvedHT, facialStructure) : null

  // Skin data
  const skinScore = faceData?.skinClarity ?? null
  const skinCategory =
    skinScore == null ? null :
    skinScore >= 7.5  ? 'Clear'         :
    skinScore >= 6.0  ? 'Good'          :
    skinScore >= 4.5  ? 'Fair'          :
    skinScore >= 3.5  ? 'Blemish-Prone' : 'Needs Attention'
  const skinIssues = skinScore == null ? [] : [
    skinScore < 5.5 ? 'acne'        : null,
    skinScore < 4.5 ? 'scarring'    : null,
    skinScore < 6.0 ? 'oiliness'    : null,
    skinScore < 5.0 ? 'dark_circles': null,
    skinScore < 6.5 ? 'dullness'    : null,
  ].filter(Boolean)
  const skinIsClear   = skinScore != null && skinScore >= 7.5
  const skinPotential = skinScore != null ? Math.min(10, skinScore + (skinScore < 5 ? 2.5 : skinScore < 7 ? 1.8 : 1.2)).toFixed(1) : null

  const skinAMRoutine = skinIsClear ? [
    'Gentle cleanser (CeraVe Hydrating or La Roche-Posay Toleriane)',
    'Vitamin C serum 10–15%',
    'Lightweight moisturizer',
    'SPF 50 (non-negotiable)',
  ] : [
    'Gentle cleanser (CeraVe or La Roche-Posay)',
    skinIssues.includes('scarring')     ? 'Vitamin C serum 15%'  : null,
    skinIssues.includes('oiliness')     ? 'Niacinamide 10%'      : null,
    skinIssues.includes('dark_circles') ? 'Caffeine eye cream'   : null,
    'Lightweight moisturizer',
    'SPF 50 (non-negotiable)',
  ].filter(Boolean)

  const skinPMRoutine = skinIsClear ? [
    'Gentle cleanser',
    'Retinol 0.025–0.05% 2×/week',
    'Peptide moisturizer',
  ] : [
    'Gentle cleanser',
    skinIssues.includes('acne')     ? 'Benzoyl Peroxide 2.5%'        : null,
    skinIssues.includes('dullness') ? 'AHA/glycolic acid 2–3×/week'  : null,
    skinIssues.includes('scarring') ? 'Retinol 0.3% (start 1×/week)' : null,
    skinIssues.includes('oiliness') ? 'Niacinamide 10%'              : null,
    'Moisturizer',
  ].filter(Boolean)

  // Pillar defs
  const mascFemLabel = gender === 'female' ? 'Femininity' : 'Dimorphism'
  const PILLAR_DEFS = [
    { key: 'harmony',    label: 'Harmony',     detail: 'Symmetry · Balance · Facial thirds' },
    { key: 'angularity', label: 'Angularity',  detail: 'Jaw · Cheekbones · Brow ridge' },
    { key: 'features',   label: 'Features',    detail: 'Eyes · Nose · Lips · Skin' },
    { key: 'dimorphism', label: mascFemLabel,  detail: gender === 'female' ? 'Soft features · Femininity' : 'Jaw strength · Hunter eyes' },
  ]

  function amazonUrl(q) { return `https://www.amazon.com/s?k=${encodeURIComponent(q)}` }

  // ── Percentile label ──────────────────────────────────────────────────────
  const pctLabel = glowScore == null ? null
    : glowScore >= 8 ? 'top 5%' : glowScore >= 7 ? 'top 15%' : glowScore >= 6 ? 'top 30%' : glowScore >= 5 ? 'top 50%' : 'bottom 40%'
  const pctColor = glowScore >= 7 ? '#34C759' : glowScore >= 5 ? '#C6A85C' : '#E07A5F'

  // ── Worst pillar for score-drag alert ────────────────────────────────────
  const worstPillar = pillars ? Object.entries(pillars).reduce((a, b) => (a[1] < b[1] ? a : b)) : null
  const PILLAR_LABELS_MAP = { harmony: 'Harmony', angularity: 'Angularity', features: 'Features', dimorphism: gender === 'female' ? 'Femininity' : 'Dimorphism' }

  // ─────────────────────────────────────────────────────────────────────────
  // Tab panel renderers (inline functions, not components, so no hook rules)
  // ─────────────────────────────────────────────────────────────────────────

  function renderOverview() {
    const upgrade = () => navigate('/premium')
    return (
      <div className="px-4 pb-6">
        {/* Scan type badge */}
        <div className="flex justify-center pt-4 mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-heading font-bold text-[10px] uppercase tracking-wide"
            style={hasSideProfile
              ? { background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', color: '#34C759' }
              : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
            {hasSideProfile ? 'Full Scan: Profile Included' : 'Basic Scan: No Side Profile'}
          </div>
        </div>

        {/* Percentile badge */}
        {pctLabel && (
          <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2"
            style={{ background: `${pctColor}0D`, border: `1px solid ${pctColor}25` }}>
            <BarChart2 size={13} style={{ color: pctColor }} />
            <p className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              You're in the <span className="font-bold" style={{ color: pctColor }}>{pctLabel}</span> of Ascendus users
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mb-4 px-3 py-2.5 rounded-xl flex items-start gap-2"
          style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.25)' }}>
          <span className="text-[11px] flex-shrink-0" style={{ color: '#C6A85C' }}>ℹ</span>
          <p className="text-[10px] font-body leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            For informational purposes only, not medical advice. AI-generated from published{' '}
            <a href="https://www.aad.org/public/everyday-care/skin-care-basics" target="_blank" rel="noopener noreferrer" style={{ color: '#C6A85C', textDecoration: 'underline' }}>AAD</a>,{' '}
            <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3583892/" target="_blank" rel="noopener noreferrer" style={{ color: '#C6A85C', textDecoration: 'underline' }}>NIH</a>, and{' '}
            <a href="https://www.healthline.com/nutrition/12-ways-to-look-younger" target="_blank" rel="noopener noreferrer" style={{ color: '#C6A85C', textDecoration: 'underline' }}>Healthline</a>{' '}
            guidelines.
          </p>
        </div>

        {/* 4-pillar grid */}
        {pillars && (
          <div className="mb-4">
            <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <Columns size={11} /> The 4 Pillars
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {PILLAR_DEFS.map(({ key, label, detail }) => {
                const score   = pillars[key] ?? 5.0
                const color   = score >= 7 ? '#34C759' : score >= 5 ? '#F5A623' : '#E07A5F'
                const pct     = Math.max(0, ((score - 1) / 9) * 100)
                return (
                  <div key={key} className="rounded-2xl p-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[12px] font-heading font-bold text-primary">{label}</p>
                      {isPremium
                        ? <span className="text-sm font-mono font-bold" style={{ color }}>{score.toFixed(1)}</span>
                        : <span className="text-sm font-mono font-bold cursor-pointer" style={{ color, filter: 'blur(5px)' }} onClick={() => navigate('/premium')}>{score.toFixed(1)}</span>
                      }
                    </div>
                    <p className="text-[9px] text-secondary font-body mb-2 leading-tight">{detail}</p>
                    {isPremium
                      ? (
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <motion.div className="h-full rounded-full" style={{ background: color }}
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }} />
                        </div>
                      ) : (
                        <div className="h-1 rounded-full overflow-hidden cursor-pointer" style={{ background: 'rgba(255,255,255,0.07)', filter: 'blur(3px)' }}
                          onClick={() => navigate('/premium')}>
                          <div className="h-full rounded-full" style={{ background: color, width: `${pct}%` }} />
                        </div>
                      )
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Score-drag alert (free users) */}
        {!isPremium && worstPillar && worstPillar[1] <= 7 && (() => {
          const label  = PILLAR_LABELS_MAP[worstPillar[0]] ?? worstPillar[0]
          const score  = worstPillar[1]
          const impact = Math.min(1.5, (7.5 - score) * 0.15).toFixed(1)
          return (
            <button type="button" onClick={() => setShowPaywall(true)}
              className="w-full mb-4 px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-left active:opacity-70 transition-opacity"
              style={{ background: 'rgba(224,122,95,0.08)', border: '1px solid rgba(224,122,95,0.2)' }}>
              <AlertTriangle size={15} className="flex-shrink-0" style={{ color: '#E07A5F' }} />
              <p className="font-body text-[11px] leading-relaxed flex-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Your <span className="font-bold" style={{ color: '#C6A85C' }}>{label} ({score.toFixed(1)})</span> is your biggest growth opportunity.{' '}
                <span className="font-bold" style={{ color: '#34C759' }}>Targeting it adds ~+{impact} pts</span>
                <span style={{ color: '#C6A85C' }}> · See how</span>
              </p>
            </button>
          )
        })()}

        {/* Biggest thing to work on — gold treatment */}
        {(aiScore?.topImprovement || aiScore?.keyWeaknesses?.length > 0) && (
          <div className="mb-3 rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(198,168,92,0.28)', background: 'rgba(198,168,92,0.04)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(198,168,92,0.12)', background: 'rgba(198,168,92,0.06)' }}>
              <AlertTriangle size={12} style={{ color: '#C6A85C' }} />
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide" style={{ color: '#C6A85C' }}>
                Biggest Lever Right Now
              </p>
            </div>
            <div className="px-4 py-3">
              {aiScore?.topImprovement ? (
                isPremium
                  ? <p className="text-[12px] font-body text-primary leading-relaxed">{aiScore.topImprovement}</p>
                  : <ProText text={aiScore.topImprovement} onUpgrade={upgrade} />
              ) : aiScore?.keyWeaknesses?.length > 0 ? (
                <div className="space-y-1">
                  {aiScore.keyWeaknesses.map((w, i) => (
                    <p key={i} className="text-[12px] font-body text-primary leading-snug flex items-start gap-2">
                      <span style={{ color: '#C6A85C', flexShrink: 0 }}>→</span> {w}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* What's working — green treatment */}
        {aiScore?.keyStrengths?.length > 0 && (
          <div className="mb-4 rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(52,199,89,0.22)', background: 'rgba(52,199,89,0.04)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(52,199,89,0.1)', background: 'rgba(52,199,89,0.06)' }}>
              <Star size={12} style={{ color: '#34C759', fill: '#34C759' }} />
              <p className="text-[10px] font-heading font-bold uppercase tracking-wide" style={{ color: '#34C759' }}>
                What's Working
              </p>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {aiScore.keyStrengths.map((s, i) => (
                <p key={i} className="text-[12px] font-body text-primary leading-snug flex items-start gap-2">
                  <span style={{ color: '#34C759', flexShrink: 0 }}>✓</span> {s}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Motivational line */}
        {pillars && (() => {
          const best = Object.entries(pillars).reduce((a, b) => (a[1] > b[1] ? a : b))
          const bestLabel = { harmony: 'Harmony', angularity: 'Angularity', features: 'Features', dimorphism: gender === 'female' ? 'Femininity' : 'Dimorphism' }[best[0]] ?? best[0]
          const lines = {
            harmony:    'Facial balance is already working for you. Maximize it with symmetry and posture work.',
            angularity: 'Bone structure is already working for you. Lean out to reveal its full potential.',
            features:   'Individual features are already working for you. Refine the details for maximum impact.',
            dimorphism: gender === 'female' ? 'Femininity score is working for you. Skincare and grooming will amplify it.' : 'Masculine presence is working for you. Build on this foundation consistently.',
          }
          return (
            <div className="mb-4 px-3 py-2.5 rounded-xl flex items-start gap-2.5"
              style={{ background: 'rgba(198,168,92,0.05)', border: '1px solid rgba(198,168,92,0.15)' }}>
              <Star size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#C6A85C', fill: '#C6A85C' }} />
              <p className="font-body text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span className="font-bold" style={{ color: '#C6A85C' }}>{bestLabel} {best[1].toFixed(1)}</span>
                {': '}{lines[best[0]] ?? `Your ${bestLabel} is already working for you.`}
              </p>
            </div>
          )
        })()}

        {/* Hairstyle recs — collapsible */}
        <div className="mb-4 rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <button className="w-full flex items-center gap-2 px-4 py-3" onClick={() => setHairOpen(o => !o)}>
            <Scissors size={14} style={{ color: '#C6A85C' }} />
            <p className="flex-1 text-left text-sm font-heading font-bold text-primary">Hairstyle Recommendations</p>
            {hairOpen ? <ChevronUp size={13} className="text-secondary" /> : <ChevronDown size={13} className="text-secondary" />}
          </button>
          <AnimatePresence>
            {hairOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                <div className="px-4 pb-4">
                  {/* Type selector */}
                  {aiDetectedHairType
                    ? <p className="text-[10px] text-secondary font-body mb-2">AI detected: <span style={{ color: '#C6A85C' }} className="font-semibold capitalize">{aiDetectedHairType}</span> · tap to change</p>
                    : <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: '#C6A85C' }}>Select your hair type</p>
                  }
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {HAIR_TYPE_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setHairType(opt.value)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-heading font-semibold border transition-all"
                        style={resolvedHT === opt.value
                          ? { background: 'linear-gradient(135deg, #FFD700, #C6A85C)', color: '#000', borderColor: '#C6A85C' }
                          : { background: 'transparent', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.12)' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {hairRec ? (
                    <>
                      <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-[#C6A85C] mb-0.5">{hairRec.label}</p>
                      <p className="text-xs text-secondary font-body leading-relaxed mb-3">{hairRec.advice}</p>
                      <div className="space-y-2 mb-3">
                        {hairRec.cuts.map((cut, i) => (
                          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: 'rgba(198,168,92,0.15)' }}>
                              <span className="text-[9px] font-bold" style={{ color: '#C6A85C' }}>{i + 1}</span>
                            </div>
                            <div>
                              <p className="text-xs font-heading font-bold text-primary">{cut.name}</p>
                              <p className="text-[10px] text-secondary font-body mt-0.5">{cut.why}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20">
                        <p className="text-[10px] text-warning font-body"><span className="font-bold">Avoid:</span> {hairRec.avoid}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-secondary font-body text-center py-2">Select your hair type above.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Legal / wellbeing */}
        <div className="space-y-2 mb-4">
          <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-body leading-relaxed text-secondary">
              <Heart size={13} style={{ color: '#F5A623', display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              <span className="font-semibold text-primary">Wellbeing:</span> These scores are tools for self-improvement, not measures of your worth. If you're struggling with body image, please speak to a professional.
            </p>
          </div>
          <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-body leading-relaxed text-secondary">
              <Bot size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              <span className="font-semibold text-primary">AI Analysis:</span> Scores are estimates only, not medical assessments.
            </p>
          </div>
        </div>

        {/* Share CTA */}
        <button onClick={() => setShowShareCard(true)}
          className="w-full py-4 rounded-2xl font-heading font-bold text-base text-black flex items-center justify-center gap-2 mb-3"
          style={{ background: 'linear-gradient(135deg, #FFD700, #C6A85C)' }}>
          <Share2 size={17} /> Share Your Results Card
        </button>
        {isPremium && (
          <button onClick={() => navigate('/workout-plan')} className="btn-primary flex items-center justify-center gap-2 mb-2">
            See My Training Plan <ChevronRight size={15} />
          </button>
        )}
        {isDevUnlocked && (
          <button onClick={() => setShowDevCard(true)}
            className="w-full py-3 rounded-2xl font-heading font-semibold text-[13px] flex items-center justify-center gap-2"
            style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.25)', color: '#C6A85C' }}>
            Dev Override
          </button>
        )}
      </div>
    )
  }

  function renderMetrics() {
    const upgrade = () => navigate('/premium')
    const mascFemLabel2 = gender === 'female' ? 'Femininity' : 'Masculinity'
    const aiRows = faceMetrics ? [
      { key: 'jawline',              label: 'Jawline',          data: faceMetrics.jawline,               pro: false },
      { key: 'symmetry',             label: 'Symmetry',         data: faceMetrics.symmetry,              pro: false },
      { key: 'cheekbones',           label: 'Cheekbones',       data: faceMetrics.cheekbones,            pro: true  },
      { key: 'skinQuality',          label: 'Skin Quality',     data: faceMetrics.skinQuality,           pro: true  },
      { key: 'mascFem',              label: mascFemLabel2,      data: faceMetrics.masculinityFemininity, pro: true  },
      { key: 'facialThirds',         label: 'Facial Thirds',    data: faceMetrics.facialThirds,          pro: true  },
    ].filter(r => r.data) : []

    const scanRows = [
      faceData?.jawlineDefinition != null && { key: 'jawlineDef', label: 'Jawline Definition', score: faceData.jawlineDefinition, note: 'Sharpness and visibility of the jawline from the front.', pro: false },
      faceData?.eyeArea           != null && { key: 'eyeArea',    label: 'Eye Area',           score: faceData.eyeArea,           note: 'Periorbital definition, under-eye quality, eye shape.', pro: true  },
    ].filter(Boolean)

    const lockedCount = aiRows.filter(r => r.pro && !isPremium).length + scanRows.filter(r => r.pro && !isPremium).length

    return (
      <div className="px-4 pb-6 pt-4">
        {/* Intro */}
        <p className="text-[10px] text-secondary font-body mb-3 leading-relaxed">
          AI-scored breakdown of your individual facial metrics.
          {!isPremium && lockedCount > 0 && <span style={{ color: '#C6A85C' }}> {lockedCount} metrics locked behind Pro.</span>}
        </p>

        {/* AI server metrics */}
        {aiRows.length > 0 && (
          <div className="card mb-3">
            <p className="text-[9px] font-heading font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              AI Analysis Metrics
            </p>
            {aiRows.map(({ key, label, data, pro }) => (
              <MetricRow
                key={key}
                label={label}
                note={data.descriptor}
                score={data.score}
                locked={pro && !isPremium}
                onUpgrade={upgrade}
              />
            ))}
          </div>
        )}

        {/* Scan-computed metrics */}
        {scanRows.length > 0 && (
          <div className="card mb-3">
            <p className="text-[9px] font-heading font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Scan Measurements
            </p>
            {scanRows.map(({ key, label, score, note, pro }) => (
              <MetricRow
                key={key}
                label={label}
                note={note}
                score={score}
                locked={pro && !isPremium}
                onUpgrade={upgrade}
              />
            ))}
          </div>
        )}

        {!faceMetrics && scanRows.length === 0 && (
          <p className="font-body text-[12px] text-center py-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Metric scores are generated during your scan and available on your next analysis.
          </p>
        )}

        {/* AI Coach CTA */}
        <button onClick={() => navigate(isPremium ? '/coach' : '/premium')}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.18)' }}>
          <div className="flex items-center gap-2">
            <Bot size={14} style={{ color: '#C6A85C' }} />
            <span className="text-[12px] font-heading font-semibold" style={{ color: '#C6A85C' }}>
              Ask AI Coach about these metrics
            </span>
          </div>
          <ChevronRight size={14} style={{ color: 'rgba(198,168,92,0.5)' }} />
        </button>
      </div>
    )
  }

  function renderProfile() {
    const upgrade = () => navigate('/premium')
    if (!hasSideProfile || !profileData) {
      return (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <User size={40} className="mb-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="font-heading font-bold text-base text-primary mb-2">No side profile scan</p>
          <p className="text-secondary text-[12px] font-body mb-6 leading-relaxed">
            Your next scan can include a right-side profile photo for jaw projection, nose bridge, and chin depth analysis.
          </p>
          <button onClick={() => navigate('/scan/capture')} className="btn-primary max-w-xs">
            Take a New Scan
          </button>
        </div>
      )
    }

    return (
      <div className="px-4 pb-6 pt-4">
        {/* Profile score card */}
        <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl"
          style={{ background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.18)' }}>
          <div className="text-center flex-shrink-0">
            <div className="text-3xl font-mono font-bold"
              style={{ color: profileScore >= 7 ? '#34C759' : profileScore >= 5 ? '#F5A623' : '#E07A5F' }}>
              {profileScore != null ? profileScore.toFixed(1) : 'N/A'}
            </div>
            <div className="text-[9px] font-body text-secondary">/10</div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-heading font-bold text-primary mb-0.5">Profile Score</p>
            <p className="text-[10px] text-secondary font-body leading-snug">
              Right-side profile · Nose bridge · Jaw projection · Chin depth
            </p>
          </div>
        </div>

        {/* Feature rows */}
        <div className="card mb-4">
          {[
            { key: 'nose_bridge', label: 'Nose Bridge', color: '#A29BFE', descriptions: { soft: 'Low, flat nose bridge — rhinoplasty or contouring can add vertical definition.', medium: 'Proportional and balanced with your other features.', strong: 'High, straight nose bridge. Adds strong vertical definition to the mid-face.', aquiline: 'Aquiline (Roman/curved) bridge. Adds character and masculine distinction.' } },
            { key: 'jawline_projection', label: 'Jawline Projection', color: '#F5A623', descriptions: { strong: 'Strong jaw projection — highly attractive from the side. Top structural trait.', projected: 'Good jaw projection. Mewing and hard chewing can maintain and improve this.', average: 'Average jaw projection. Mewing consistently and keeping body fat low helps.', recessed: 'Recessed jaw (retrognathia). Orthognathic surgery is definitive; mewing for mild cases.' } },
            { key: 'chin_projection', label: 'Chin Projection', color: '#34C759', descriptions: { prominent: 'Prominent chin projection. Well ahead of the E-line. Highly attractive trait.', projected: 'Good chin projection. Sits forward of the lower lip — a strong profile trait.', average: 'Average chin projection. On or near the Ricketts E-line.', recessed: 'Chin sits back from ideal position. Chin filler fastest fix; implant for permanent change.' } },
          ].map(({ key, label, color, descriptions }) => {
            const value      = profileData[key]
            const desc       = value && descriptions[value] ? descriptions[value] : `${label} assessment not available.`
            const valueLabel = value ? value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ') : 'N/A'
            const scoreVal   = profileData[`${key}_score`] ?? null
            return (
              <div key={key} className="py-3 border-b border-default last:border-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="px-2 py-0.5 rounded-md text-[10px] font-heading font-bold flex-shrink-0"
                    style={{ background: `${color}18`, color }}>
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
                  : <ProText text={desc} onUpgrade={upgrade} />
                }
              </div>
            )
          })}
        </div>

        {/* Improvement callout */}
        {profileScore != null && profileScore < 7 && (
          <div className="rounded-2xl p-4"
            style={{ border: '1.5px solid rgba(198,168,92,0.35)', background: 'rgba(198,168,92,0.06)' }}>
            <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: '#C6A85C' }}>
              Profile Improvement Protocol
            </p>
            <p className="text-[11px] font-body text-primary leading-relaxed">
              {profileScore < 5
                ? 'Profile structure is significantly impacting your score. Mewing (tongue posture), jaw exercises, and reducing body fat are the highest-ROI non-surgical interventions. Consult an orthodontist if jaw recession is significant.'
                : 'Mewing and hard chewing (2–3 minutes daily) can improve jaw projection over 6–12 months. Low body fat reveals existing jaw structure.'}
            </p>
          </div>
        )}
      </div>
    )
  }

  function renderSkin() {
    const upgrade = () => navigate('/premium')
    if (skinScore == null) {
      return (
        <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
          <FlaskConical size={40} className="mb-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="font-body text-[12px] text-secondary">Skin data unavailable — take a new scan to get your skin analysis.</p>
        </div>
      )
    }

    const skinColor = skinScore >= 7.5 ? '#34C759' : skinScore >= 5 ? '#F5A623' : '#E07A5F'

    return (
      <div className="px-4 pb-6 pt-4">
        {/* Score card */}
        <div className="flex items-center gap-4 mb-4 p-4 rounded-2xl"
          style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.18)' }}>
          <div className="text-center flex-shrink-0">
            <div className="text-3xl font-mono font-bold" style={{ color: skinColor }}>{skinScore.toFixed(1)}</div>
            <div className="text-[9px] font-body text-secondary">/10</div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-heading font-bold text-primary">{skinCategory}</p>
            <p className="text-[10px] text-secondary font-body leading-snug mt-0.5">
              {skinIsClear
                ? 'Clear skin. Focus on maintenance with SPF and hydration.'
                : skinIssues.length > 0
                  ? `Detected: ${skinIssues.map(i => i.replace('_', ' ')).join(', ')}`
                  : 'No major skin issues detected'}
            </p>
            {!skinIsClear && skinPotential && (
              <p className="text-[10px] font-body mt-1" style={{ color: '#C6A85C' }}>
                With this routine: {skinScore.toFixed(1)} → {skinPotential}
              </p>
            )}
          </div>
        </div>

        {/* Pro content */}
        {isPremium ? (
          <div className="space-y-4">
            {skinIsClear && (
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.2)' }}>
                <p className="text-[11px] font-heading font-bold mb-1.5" style={{ color: '#34C759' }}>✓ Clear Skin Maintenance Protocol</p>
                <p className="text-[10px] text-secondary font-body leading-relaxed">
                  Your skin is clear. The goal now is preservation, not treatment. Daily SPF 50 prevents photoaging. A low-dose retinol 2×/week maintains smooth texture. Vitamin C each morning fights oxidative damage.
                </p>
              </div>
            )}

            {/* Protocol groups with colored left-border markers */}
            {!skinIsClear && skinIssues.map(issue => {
              const ingredients = SKIN_INGREDIENTS[issue]
              if (!ingredients) return null
              const list = Array.isArray(ingredients) ? ingredients : [ingredients]
              const pm   = PROTOCOL_META[issue]
              return (
                <div key={issue} style={{ borderLeft: `3px solid ${pm.color}`, paddingLeft: 12 }}>
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: pm.color }}>
                    {pm.label}
                  </p>
                  {list.map((ing, i) => (
                    <div key={i} className="mb-2 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-[12px] font-heading font-bold text-primary mb-1">{ing.name}</p>
                      <p className="text-[10px] text-secondary font-body leading-relaxed mb-1"><span className="font-bold text-primary">Why:</span> {ing.why}</p>
                      <p className="text-[10px] text-secondary font-body leading-relaxed mb-1"><span className="font-bold text-primary">How:</span> {ing.how}</p>
                      <p className="text-[10px] text-secondary font-body leading-relaxed mb-1"><span className="font-bold text-primary">When:</span> {ing.when}</p>
                      <p className="text-[10px] text-secondary font-body leading-relaxed mb-1"><span className="font-bold text-primary">Timeline:</span> {ing.timeline}</p>
                      {ing.warning && (
                        <p className="text-[10px] text-warning font-body leading-relaxed mb-1">
                          <span className="font-bold">⚠ Note:</span> {ing.warning}
                        </p>
                      )}
                      <p className="text-[10px] font-body leading-relaxed mt-1.5" style={{ color: '#C6A85C' }}>
                        Score impact: {ing.pillar}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })}

            {/* AM/PM routine */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl" style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)' }}>
                <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: '#F5A623' }}>AM Routine</p>
                {skinAMRoutine.map((step, i) => (
                  <p key={i} className="text-[10px] font-body text-secondary leading-snug mb-1">{i + 1}. {step}</p>
                ))}
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(108,92,231,0.07)', border: '1px solid rgba(108,92,231,0.18)' }}>
                <p className="text-[10px] font-heading font-bold uppercase tracking-wide mb-2" style={{ color: '#A29BFE' }}>PM Routine</p>
                {skinPMRoutine.map((step, i) => (
                  <p key={i} className="text-[10px] font-body text-secondary leading-snug mb-1">{i + 1}. {step}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden">
            <div className="blur-sm pointer-events-none select-none opacity-35 space-y-2">
              {['Benzoyl Peroxide 2.5%: PM only', 'Niacinamide 10%: AM + PM', 'AHA Exfoliant: 2×/week PM', 'AM: Cleanser → Vit C → SPF 50', 'PM: Cleanser → Treatment → Moisturizer'].map((line, i) => (
                <div key={i} className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <p className="text-[10px] font-body text-primary">{line}</p>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-2xl">
              <Lock size={18} className="text-[#C6A85C] mb-2" />
              <p className="font-heading font-bold text-sm text-primary mb-0.5">Pro Feature</p>
              <p className="text-[11px] text-secondary font-body mb-3 text-center px-4">Full ingredient protocol + AM/PM routine from your skin scan</p>
              <button onClick={upgrade} className="px-4 py-2 rounded-xl text-xs font-heading font-bold text-black"
                style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)' }}>
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderProducts() {
    const upgrade = () => navigate('/premium')

    if (!isPremium) {
      return (
        <div className="px-4 pt-4 pb-6">
          <ProLock solid onUpgrade={upgrade}
            label="Your Personalized Product Stack"
            description="AI-matched products based on your scan results and skin analysis." />
        </div>
      )
    }

    return (
      <div className="px-4 pt-4 pb-6">
        <p className="text-[10px] text-secondary font-body mb-4 leading-snug">
          Products matched to your scan · Selected from your improvement areas and skin analysis.
        </p>

        {productsLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-default animate-pulse">
                <div className="w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'rgba(198,168,92,0.1)' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded w-3/4" style={{ background: 'rgba(198,168,92,0.15)' }} />
                  <div className="h-2 rounded w-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center gap-1.5 py-2">
              <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#C6A85C', borderTopColor: 'transparent' }} />
              <span className="text-[10px] text-secondary font-body">Personalizing your stack…</span>
            </div>
          </div>
        )}

        {!productsLoading && productsFetched && products.length === 0 && (
          <p className="text-[11px] text-secondary font-body text-center py-8">
            No recommendations available right now. Try again after your next scan.
          </p>
        )}

        {!productsLoading && products.map((product, i) => (
          <motion.a key={i}
            href={`https://www.amazon.com/s?k=${encodeURIComponent(product.searchQuery || product.name)}`}
            target="_blank" rel="noopener noreferrer"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 py-3 border-b border-default no-underline active:opacity-70 transition-opacity group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(198,168,92,0.1)' }}>
              <ShoppingBag size={16} style={{ color: '#C6A85C' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-[13px] text-primary leading-tight mb-0.5 truncate flex items-center gap-1">
                {product.name}
                <ExternalLink size={9} className="text-secondary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <p className="text-[10px] text-secondary font-body truncate">{product.description}</p>
            </div>
            <span className="flex-shrink-0 text-[9px] font-heading font-bold px-2 py-1 rounded-lg"
              style={{ background: '#FF9900', color: '#000' }}>
              Amazon
            </span>
          </motion.a>
        ))}

        {!productsLoading && productsFetched && products.length > 0 && (
          <p className="text-[9px] text-secondary font-body text-center mt-3 opacity-50">
            Links open Amazon search · Ascendus may earn from qualifying purchases
          </p>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const bottomPad = !isPremium && !showPaywall
    ? 'calc(env(safe-area-inset-bottom) + 108px)'
    : 'calc(env(safe-area-inset-bottom) + 24px)'

  return (
    <>
      <Helmet>
        <title>Your AI Appearance Score &amp; Looksmax Results | Ascendus</title>
        <meta name="description" content="See your AI face rating, body composition score, and a personalized 12-week looksmax plan built around your results." />
        <meta name="keywords" content="face rating results, AI appearance score, looksmax results, glow up plan, facial analysis" />
      </Helmet>

      {showReveal && !revealDone && (
        <ScoreReveal score={glowScore} tier={tier ?? 'Rising'} onDone={() => setRevealDone(true)} />
      )}

      {/* Full-screen layout */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#080604', overflow: 'hidden' }}>

        {/* ── Fixed hero ──────────────────────────────────────────────── */}
        <div style={{ paddingTop: 'env(safe-area-inset-top)', background: '#0A0A0A', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <GlowScoreRing score={glowScore} size="medium" animated />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <p className="font-mono font-bold text-[28px] text-white leading-none flex-shrink-0">{glowScore?.toFixed(1) ?? '—'}</p>
                <p className="text-[11px] text-secondary font-body flex-shrink-0">/ 10</p>
                {tier && (
                  <div className="ml-1 px-2.5 py-0.5 rounded-full font-heading font-bold text-[9px] uppercase tracking-widest flex-shrink truncate"
                    style={{ background: `${tierColor}15`, border: `1px solid ${tierColor}40`, color: tierColor }}>
                    {tier}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-secondary font-body mt-0.5 truncate">
                {new Date(currentScan.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {gender && ` · ${gender.charAt(0).toUpperCase() + gender.slice(1)}`}
              </p>
            </div>
            <button onClick={() => setShowShareCard(true)}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Share2 size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="relative flex" style={{ background: '#0A0A0A', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className="relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
                style={{ color: active ? '#C6A85C' : 'rgba(255,255,255,0.28)' }}>
                <Icon size={14} />
                <span className="text-[8px] font-heading font-bold uppercase tracking-wide">{label}</span>
                {active && (
                  <motion.div layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: 1.5, background: '#C6A85C' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Scrollable panel ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{ paddingBottom: bottomPad }}>
              {activeTab === 'overview'  && renderOverview()}
              {activeTab === 'metrics'   && renderMetrics()}
              {activeTab === 'profile'   && renderProfile()}
              {activeTab === 'skin'      && renderSkin()}
              {activeTab === 'products'  && renderProducts()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Free user sticky bottom CTA ──────────────────────────────── */}
      {!isPremium && !showPaywall && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', background: 'linear-gradient(to top, rgba(8,6,4,0.98) 70%, rgba(8,6,4,0))', backdropFilter: 'blur(12px)' }}>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'auto 1fr 1fr' }}>
            <button onClick={() => navigate('/')} aria-label="Back to home"
              className="w-[46px] flex items-center justify-center rounded-2xl flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <Home size={17} style={{ color: 'rgba(255,255,255,0.7)' }} />
            </button>
            <button onClick={() => navigate('/premium')}
              className="py-3.5 rounded-2xl font-heading font-bold text-[13px] flex items-center justify-center gap-1.5"
              style={{ background: 'rgba(198,168,92,0.10)', border: '1px solid rgba(198,168,92,0.30)', color: '#C6A85C' }}>
              <Gift size={14} /> Share 3 Friends
            </button>
            <button onClick={() => setShowPaywall(true)}
              className="py-3.5 rounded-2xl font-heading font-bold text-[13px] flex items-center justify-center gap-1.5 text-black"
              style={{ background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)', boxShadow: '0 4px 16px rgba(198,168,92,0.3)' }}>
              Get Ascendus Pro
            </button>
          </div>
        </div>
      )}

      {/* ── Share card modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showShareCard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
            <ShareCardModal scan={currentScan} isPremium={isPremium}
              facePhotoUrl={pendingFacePhoto ?? currentScan?.facePhotoUrl}
              phase={assignedPhase} onClose={() => setShowShareCard(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dev override card ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isDevUnlocked && showDevCard && (
          <DevRankCard scan={currentScan} onClose={() => setShowDevCard(false)} />
        )}
      </AnimatePresence>

      {/* ── Paywall (free users) ──────────────────────────────────────── */}
      <AnimatePresence>
        {showPaywall && !isPremium && (
          <PaywallModal scan={currentScan} gender={gender ?? 'male'}
            onClose={() => { sessionStorage.setItem('asc_paywall_dismissed', '1'); paywallDismissed.current = true; setShowPaywall(false) }}
            onPurchaseSuccess={() => setShowPaywall(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
