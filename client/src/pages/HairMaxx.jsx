import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Bookmark, Check, ChevronLeft, ChevronRight, Heart, Scissors, Sparkles, X } from 'lucide-react'
import MotionPage from '../components/MotionPage'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import { loadScanMedia } from '../utils/scanPhotoDb'
import { DENSITIES, HAIR_CATALOG_VERSION, HAIR_TYPES, HAIRSTYLE_CATALOG, LENGTHS } from '../utils/hairCatalog'
import { conciseReason, rankHairstyles, structureFromScan } from '../utils/hairMatching'
import { portableEvidence } from '../utils/productionAnalysis'
import { GOLD, GOLD_GRADIENT, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import shortLengthPortrait from '../assets/hair-length/short.png'
import mediumLengthPortrait from '../assets/hair-length/medium.png'
import longLengthPortrait from '../assets/hair-length/long.png'
import type1BuzzCutReference from '../assets/hair-examples/type1-medium-high-short.jpg'
import type1CrewCutReference from '../assets/hair-examples/type1-all-density-short-crew-cut.jpg'
import type1ModCutReference from '../assets/hair-examples/type1-all-density-short-mod-cut.jpg'
import type1MiddlePartFlowReference from '../assets/hair-examples/type1-medium-short-middle-part-flow.png'
import type1TexturedFringeReference from '../assets/hair-examples/type1-medium-short-textured-fringe.png'
import type1MediumModCutReference from '../assets/hair-examples/type1-medium-short-mod-cut.png'
import type1LongWolfCutReference from '../assets/hair-examples/type1-long-wolf-cut.png'
import type1LongMiddlePartFlowReference from '../assets/hair-examples/type1-long-middle-part-flow.png'
import type1LongMiddlePartMulletReference from '../assets/hair-examples/type1-long-middle-part-mullet.png'
import type2MediumMiddlePartFlowReference from '../assets/hair-examples/type2-medium-middle-part-flow.png'
import type2ShortModCutReference from '../assets/hair-examples/type2-short-mod-cut.png'
import type2ShortWarriorCutReference from '../assets/hair-examples/type2-short-warrior-cut.png'
import type2MediumWolfCutReference from '../assets/hair-examples/type2-medium-wolf-cut.png'
import type2MediumModernShagReference from '../assets/hair-examples/type2-medium-modern-shag.png'
import type2LongWolfCutReference from '../assets/hair-examples/type2-long-wolf-cut.png'
import type2LongWavyLayersReference from '../assets/hair-examples/type2-long-wavy-layers.png'
import type3ShortFringeLowTaperReference from '../assets/hair-examples/type3-short-fringe-low-taper.png'
import type3ShortCurlyModernMulletReference from '../assets/hair-examples/type3-short-curly-modern-mullet.png'
import type3ShortCurlyMiddlePartReference from '../assets/hair-examples/type3-short-curly-middle-part.png'
import type3MediumLayeredCurlsReference from '../assets/hair-examples/type3-medium-layered-curls.png'
import type3MediumCurlyFroReference from '../assets/hair-examples/type3-medium-curly-fro.png'
import type3MediumTwistsReference from '../assets/hair-examples/type3-medium-twists.png'
import type3MediumCornrowsReference from '../assets/hair-examples/type3-medium-cornrows.png'
import type3MediumBraidsReference from '../assets/hair-examples/type3-medium-braids.png'
import type3LongCurlyWolfCutReference from '../assets/hair-examples/type3-long-curly-wolf-cut.png'
import type3LongCurlyFroReference from '../assets/hair-examples/type3-long-curly-fro.png'
import type3LongTwistsReference from '../assets/hair-examples/type3-long-twists.png'
import type3LongBraidsReference from '../assets/hair-examples/type3-long-braids.png'
import type4ShortBuzzCutReference from '../assets/hair-examples/type4-short-buzz-cut.png'
import type4ShortWavesReference from '../assets/hair-examples/type4-short-waves.png'
import type4ShortMiniFroLowTaperReference from '../assets/hair-examples/type4-short-mini-fro-low-taper.png'
import type4MediumFroMidTaperReference from '../assets/hair-examples/type4-medium-fro-mid-taper.png'
import type4MediumCornrowsReference from '../assets/hair-examples/type4-medium-cornrows.png'
import type4MediumDreadlocksReference from '../assets/hair-examples/type4-medium-dreadlocks.png'
import type4MediumBraidsReference from '../assets/hair-examples/type4-medium-braids.png'
import type4LongFroMidTaperReference from '../assets/hair-examples/type4-long-fro-mid-taper.png'
import type4LongDreadlocksReference from '../assets/hair-examples/type4-long-dreadlocks.png'
import type4LongBraidsReference from '../assets/hair-examples/type4-long-braids.png'

const BG = '#080808'
const PANEL = 'rgba(255,255,255,0.045)'
const LOCAL_HAIRMAXX_SCAN_BYPASS = import.meta.env.DEV && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)

function HairPattern({ type }) {
  const item = HAIR_TYPES.find(value => value.id === type)
  return <svg viewBox="0 0 32 48" className="w-8 h-10" aria-hidden="true">
    <path d={item?.pattern} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

function DensityDots({ density }) {
  const strands = {
    low: [8, 17, 27, 36],
    medium: [5, 11, 17, 23, 29, 35, 41],
    high: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40],
  }
  return <svg viewBox="0 0 44 44" className="w-[68px] h-[68px]" aria-hidden="true">
    <path d="M3 33 Q22 30 41 33 L40 39 Q39.5 42 35 42 H9 Q4.5 42 4 39 Z" fill="rgba(217,188,114,.3)" stroke="rgba(217,188,114,.72)" strokeWidth="1.5" />
    {(strands[density] || []).map((x, index) => {
      const sway = index % 2 ? 2 : -2
      const tip = x + (index % 3 - 1) * 1.5
      return <path key={index} d={`M${x} 34 C${x + sway} 27 ${x - sway} 17 ${tip} 8`} fill="none" stroke="#F3F0E7" strokeWidth="1.7" strokeLinecap="round" />
    })}
  </svg>
}

function LengthPortrait({ length }) {
  const portrait = {
    short: shortLengthPortrait,
    medium: mediumLengthPortrait,
    long: longLengthPortrait,
  }[length]
  return <img src={portrait} alt="" aria-hidden="true" className="w-16 h-16 object-contain" style={{ mixBlendMode: 'screen' }} />
}

// Same circular back button used across the app (see PageHeader.jsx and
// Scan.jsx's capture-screen header) — plain top-left button in normal flow,
// no sticky title bar. Each stage already carries its own "HairMax" eyebrow
// + heading in its content, so nothing is lost by dropping the bar's title.
function Header({ onBack, right }) {
  return <div className="sticky top-0 z-50 flex items-center justify-between px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 8, background: BG }}>
    <button
      type="button"
      onClick={onBack}
      aria-label="Go back"
      className="relative z-10 pointer-events-auto w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <ChevronLeft size={18} className="text-primary" />
    </button>
    {right}
  </div>
}

function ChoiceGrid({ title, subtitle, options, value, onChange, questionNumber, questionCount, questionKey, visual = false }) {
  const details = {
    density: { low: 'More scalp visible, less overall coverage', medium: 'Balanced coverage across your scalp', high: 'Fuller coverage with less scalp showing' },
    strandThickness: { fine: 'Thin, delicate strands', medium: 'Average strand thickness', thick: 'Thicker, coarser strands' },
    desiredLength: { short: 'A close cut or short style', medium: 'Some length to style', long: 'Shoulder length or longer', any: 'Open to any length' },
    maintenancePreference: { low: 'Keep daily styling simple', some: 'A little styling each day', any: 'Open to any routine' },
  }
  return <div className="flex-1 min-h-0 flex flex-col px-1 pb-3 pt-2">
    <div className="grid gap-1.5 mb-8 shrink-0" style={{ gridTemplateColumns: `repeat(${questionCount}, minmax(0, 1fr))` }} aria-label={`Step ${questionNumber} of ${questionCount}`}>
      {Array.from({ length: questionCount }, (_, index) => <span key={index} className="h-[3px] rounded-full" style={{ background: index < questionNumber ? '#F4F1EA' : 'rgba(255,255,255,.14)' }} />)}
    </div>
    <h2 className="font-heading font-bold text-[30px] text-white leading-[1.12] tracking-[-.025em]">{title}</h2>
    {subtitle && <p className="font-body text-[13px] text-secondary mt-2">{subtitle}</p>}
    <div className="mt-7 flex-1 min-h-0 flex flex-col gap-3 pb-1">
      {options.map(option => {
        const id = typeof option === 'string' ? option : option.id
        const label = typeof option === 'string'
          ? questionKey === 'density'
            ? ({ low: 'Low density', medium: 'Medium density', high: 'High density' }[id] || id)
            : (id === 'any' ? 'Any length' : id.charAt(0).toUpperCase() + id.slice(1))
          : option.label
        const description = (typeof option === 'string' ? null : option.description) || details[questionKey]?.[id] || ''
        const selected = value === id
        return <motion.button key={id} whileTap={{ scale: .985 }} onClick={() => { triggerHaptic(); onChange(id) }}
          className={`w-full flex-1 ${['density', 'desiredLength'].includes(questionKey) ? 'min-h-[116px]' : 'min-h-[92px]'} rounded-[22px] flex items-center gap-4 px-5 py-4 text-left`}
          style={{ background: selected ? 'rgba(198,168,92,.09)' : 'rgba(255,255,255,.018)', border: `1.5px solid ${selected ? 'rgba(198,168,92,.65)' : 'rgba(255,255,255,.1)'}` }}>
          <div className={`${['density', 'desiredLength'].includes(questionKey) ? 'w-[72px] h-[72px]' : 'w-12 h-12'} shrink-0 flex items-center justify-center text-white`}>
            {visual && <HairPattern type={id} />}
            {questionKey === 'desiredLength' && ['short', 'medium', 'long'].includes(id) && <LengthPortrait length={id} />}
            {!visual && questionKey === 'density' && <DensityDots density={id} />}
            {!visual && questionKey !== 'density' && questionKey !== 'desiredLength' && ['low', 'medium', 'high'].includes(id) && <div className="flex items-end gap-[3px] h-7">{Array.from({ length: id === 'low' ? 3 : id === 'medium' ? 5 : 7 }, (_, index) => <i key={index} className="block w-[3px] rounded-full bg-current" style={{ height: `${12 + (index % 3) * 5}px`, opacity: .65 + (index % 2) * .2 }} />)}</div>}
            {!visual && questionKey !== 'density' && questionKey !== 'desiredLength' && !['low', 'medium', 'high'].includes(id) && <Scissors size={25} strokeWidth={1.8} />}
          </div>
          <div className="min-w-0">
            <span className={`block font-heading font-bold ${['density', 'desiredLength'].includes(questionKey) ? 'text-[19px]' : 'text-[17px]'} leading-tight`} style={{ color: selected ? '#F2D77E' : '#D9BC72', textShadow: selected ? '0 0 12px rgba(217,188,114,.62), 0 0 3px rgba(255,231,160,.45)' : '0 0 9px rgba(217,188,114,.42), 0 0 2px rgba(255,231,160,.3)' }}>{label}</span>
            {description && <span className={`block mt-1 ${['density', 'desiredLength'].includes(questionKey) ? 'text-[16px]' : 'text-[15px]'} font-medium leading-[1.35] text-white/90`}>{description}</span>}
          </div>
        </motion.button>
      })}
    </div>
  </div>
}

function ConnectedIntro({ structure, image, onBack, onContinue, onRescan }) {
  // Header block ported verbatim from Scan.jsx's step 1/2 header (position,
  // sizes, back-button style) so this screen matches it exactly instead of
  // having its own hand-tuned treatment.
  return <div className="h-full flex flex-col">
    <div className="relative flex-shrink-0 px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)', paddingBottom: 16 }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="absolute left-4 z-10 pointer-events-auto w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <ChevronLeft size={18} className="text-primary" />
      </button>
      <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1 uppercase" style={{ color: GOLD }}>HairMax</p>
      <h1 className="font-heading font-bold text-[26px] leading-tight text-primary" style={{ letterSpacing: '-0.02em' }}>Find your best hairstyle</h1>
    </div>
    {/* Photo fills the remaining space at its native resolution (no fixed
        aspect-ratio box shrinking it down) and the button is pinned at the
        bottom with the same safe-area padding as Scan.jsx's previewPhoto
        screen, instead of trailing directly under the photo. */}
    <div className="flex-1 min-h-0 px-5">
      <div className="w-full h-full rounded-[28px] overflow-hidden" style={{ background: PANEL }}>
        {image ? <img src={image} alt="Your Ascendus scan" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Scissors size={42} color={GOLD} /></div>}
      </div>
    </div>
    <div className="flex-shrink-0 px-5" style={{ paddingTop: 14, paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))' }}>
      <button
        onClick={() => (structure.connected && image) || LOCAL_HAIRMAXX_SCAN_BYPASS ? onContinue() : onRescan()}
        className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]"
        style={{ background: GOLD_GRADIENT, color: '#080808' }}
      >
        Continue
      </button>
    </div>
  </div>
}

function Matching({ profile, structure }) {
  const [step, setStep] = useState(0)
  const steps = ['Matching styles', 'Ranking matches', 'Preparing slideshow']
  useEffect(() => {
    const timer = setInterval(() => setStep(value => Math.min(2, value + 1)), 700)
    return () => clearInterval(timer)
  }, [])
  return <div className="min-h-[78vh] px-6 flex flex-col items-center justify-center text-center">
    <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-20 h-20 rounded-[26px] flex items-center justify-center mb-7" style={{ background: 'rgba(198,168,92,.1)', border: '1px solid rgba(198,168,92,.35)', boxShadow: '0 0 50px rgba(198,168,92,.12)' }}><Scissors size={31} color={GOLD} /></motion.div>
    <p className="text-[10px] tracking-[.26em] uppercase mb-2" style={{ color: GOLD }}>Building your looks</p>
    <h2 className="font-heading font-bold text-[26px] text-white mb-7">Made for your face and hair.</h2>
    <div className="w-full max-w-xs space-y-3 text-left">
      {[`Face geometry${structure.connected ? '' : ' unavailable'}`, `${profile.hairType} hair`, `${profile.density} density`].map(text => <div key={text} className="flex items-center gap-3"><span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(198,168,92,.16)', color: GOLD }}><Check size={13} /></span><span className="text-[13px] text-white/65 capitalize">{text}</span></div>)}
    </div>
    <div className="mt-9 flex items-center gap-2">{steps.map((label, index) => <div key={label} className="flex items-center gap-2"><i className="block w-2 h-2 rounded-full" style={{ background: index <= step ? GOLD : 'rgba(255,255,255,.14)' }} />{index === step && <span className="text-[10px] uppercase tracking-wider text-white/45">{label}</span>}</div>)}</div>
  </div>
}

function CatalogModelImage({ recommendation, className = '', compact = false }) {
  const [failed, setFailed] = useState(false)
  const src = recommendation.style.image.src
  const isUserReference = recommendation.engine === 'user_reference'
  useEffect(() => setFailed(false), [src])
  return <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: '4 / 5', background: '#000' }}>
    {failed ? <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">Photo unavailable</div>
      : <img src={src} alt={`${recommendation.style.name} hairstyle reference`} draggable={false} onError={() => setFailed(true)} className={`w-full h-full ${isUserReference ? 'object-cover' : 'object-contain object-bottom'}`} style={isUserReference ? { objectPosition: 'center 72%' } : undefined} loading={compact ? 'lazy' : 'eager'} />}
  </div>
}

function DetailSheet({ recommendation, onClose, onBarber }) {
  const style = recommendation.style
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.78)' }} onClick={onClose}>
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={SPRING_STANDARD} className="w-full max-h-[88vh] overflow-y-auto rounded-t-[30px] p-5" style={{ background: '#111', borderTop: '1px solid rgba(255,255,255,.1)' }} onClick={event => event.stopPropagation()}>
      <div className="flex justify-between items-start mb-5"><div><p className="text-[9px] uppercase tracking-[.2em]" style={{ color: GOLD }}>Why it works</p><h3 className="font-heading font-bold text-[24px] text-white mt-1">{style.name}</h3></div><button type="button" aria-label="Close hairstyle details" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: PANEL }}><X size={16} color="white" /></button></div>
      <CatalogModelImage recommendation={recommendation} className="w-full rounded-2xl mb-5" />
      <div className="space-y-4">
        <section><p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Why it fits you</p><p className="text-[13px] leading-relaxed text-white/80">{conciseReason(recommendation)}</p></section>
        <section><p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Hair compatibility</p><p className="text-[13px] leading-relaxed text-white/80">{recommendation.compatibilityFactors?.length ? recommendation.compatibilityFactors.join(' · ') : 'Compatible with your selected hair type, density, and strand thickness.'}</p></section>
        <div className="grid grid-cols-2 gap-3"><section className="rounded-xl p-3" style={{ background: PANEL }}><p className="text-[9px] uppercase text-white/40">Maintenance</p><p className="text-[13px] capitalize text-white mt-1">{style.maintenance}</p></section><section className="rounded-xl p-3" style={{ background: PANEL }}><p className="text-[9px] uppercase text-white/40">Growth</p><p className="text-[13px] text-white mt-1">{style.growth}</p></section></div>
        <section><p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Styling</p><p className="text-[13px] leading-relaxed text-white/80">{style.styling}</p></section>
      </div>
      <button onClick={onBarber} className="w-full mt-6 py-4 rounded-2xl font-heading font-bold text-[14px]" style={{ background: GOLD_GRADIENT, color: '#080808' }}>Show barber</button>
    </motion.div>
  </motion.div>
}

function BarberMode({ recommendation, onClose }) {
  const { style } = recommendation
  return <div className="fixed inset-0 z-[60] overflow-y-auto px-5 pb-10" style={{ background: BG, paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
    <div className="flex items-center justify-between mb-5"><button type="button" aria-label="Go back" onClick={onClose} className="relative z-10 pointer-events-auto"><ArrowLeft size={22} color="white" /></button><p className="font-heading font-bold text-white">Show Barber</p><div className="w-6" /></div>
    <CatalogModelImage recommendation={recommendation} className="w-full rounded-[26px] mb-6" />
    <p className="text-[10px] uppercase tracking-[.22em] mb-1" style={{ color: GOLD }}>Reference</p><h2 className="font-heading font-bold text-[27px] text-white mb-6">{style.name}</h2>
    <div className="space-y-3">{Object.entries(style.barber).map(([part, value]) => <div key={part} className="rounded-2xl p-4" style={{ background: PANEL, border: '1px solid rgba(255,255,255,.07)' }}><p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">{part}</p><p className="text-[14px] text-white/85 leading-relaxed">{value}</p></div>)}</div>
    <div className="rounded-2xl p-4 mt-3" style={{ background: 'rgba(198,168,92,.08)', border: '1px solid rgba(198,168,92,.22)' }}><p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: GOLD }}>Styling</p><p className="text-[14px] text-white/85">{style.styling}</p></div>
  </div>
}

function Looks({ recommendations, active, setActive }) {
  const item = recommendations[Math.min(active, recommendations.length - 1)]
  if (!item) return <p className="px-6 py-12 text-white/60 text-center">No cuts match these preferences yet.</p>
  const go = direction => {
    if (recommendations.length < 2) return
    triggerHaptic()
    setActive(value => (value + direction + recommendations.length) % recommendations.length)
  }
  return <div className="px-5 pt-3 pb-6 max-w-lg mx-auto">
    <motion.div key={item.hairstyleId}
      drag={recommendations.length > 1 ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }} dragElastic={.18}
      onDragEnd={(_, info) => { if (info.offset.x < -45) go(1); else if (info.offset.x > 45) go(-1) }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }}
      tabIndex={0} role="group" aria-roledescription="slide"
      aria-label={`${item.style.name}, ${active + 1} of ${recommendations.length}. Swipe or use arrow keys to change haircut.`}
      onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); go(1) } else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1) } }}
      className="rounded-[30px] overflow-hidden border border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C6A85C]"
      style={{ background: '#080808', touchAction: 'pan-y' }}>
      <CatalogModelImage recommendation={item} className="w-full h-[67svh] max-h-[700px] min-h-[360px]" />
      <h1 className="min-h-[82px] px-5 py-5 flex items-center justify-center text-center font-heading font-bold text-[25px] leading-tight text-white" style={{ background: '#080808' }}>{item.style.name}</h1>
    </motion.div>
    {recommendations.length > 1 && <div className="flex items-center justify-center gap-4 pt-4" aria-label={`Hairstyle ${active + 1} of ${recommendations.length}`}>
      <button type="button" onClick={() => go(-1)} aria-label="Previous hairstyle" className="w-9 h-9 rounded-full flex items-center justify-center text-white/75 active:scale-95 transition-transform" style={{ background: PANEL, border: '1px solid rgba(255,255,255,.12)' }}><ChevronLeft size={18} /></button>
      <div className="flex items-center justify-center gap-2">
        {recommendations.map((recommendation, index) => <button key={recommendation.hairstyleId} type="button" onClick={() => { triggerHaptic(); setActive(index) }} aria-label={`Show ${recommendation.style.name}`} aria-current={index === active ? 'true' : undefined} className="h-2.5 rounded-full transition-all" style={{ width: index === active ? 22 : 9, background: index === active ? GOLD : 'rgba(255,255,255,.25)' }} />)}
      </div>
      <button type="button" onClick={() => go(1)} aria-label="Next hairstyle" className="w-9 h-9 rounded-full flex items-center justify-center text-white/75 active:scale-95 transition-transform" style={{ background: PANEL, border: '1px solid rgba(255,255,255,.12)' }}><ChevronRight size={18} /></button>
    </div>}
  </div>
}

function SavedLooks({ recommendations, savedIds, onSelect }) {
  const saved = savedIds.map(id => recommendations.find(item => item.hairstyleId === id) ?? (() => {
    const style = HAIRSTYLE_CATALOG.find(item => item.id === id)
    return style ? { hairstyleId: id, style, reasons: [], compatibilityFactors: [], limitations: [] } : null
  })()).filter(Boolean)
  return <div className="px-5 py-6"><h1 className="font-heading font-bold text-[28px] text-white mb-1">Saved Looks</h1><p className="text-[13px] text-white/45 mb-6">Your hairstyle shortlist.</p>{saved.length ? <div className="grid grid-cols-2 gap-3">{saved.map(item => <button key={item.hairstyleId} onClick={() => onSelect(item)} className="text-left"><CatalogModelImage recommendation={item} className="w-full rounded-2xl" /><p className="font-heading font-bold text-[12px] text-white mt-2">{item.style.name}</p></button>)}</div> : <div className="rounded-2xl py-14 text-center" style={{ background: PANEL }}><Heart size={24} color={GOLD} className="mx-auto mb-3" /><p className="text-[13px] text-white/55">Save a look to compare later.</p></div>}</div>
}

export default function HairMaxx() {
  const navigate = useNavigate()
  const currentScan = useStore(state => state.currentScan)
  const fallbackScan = useStore(state => state.scans?.[0])
  const scan = currentScan ?? fallbackScan
  const lastFaceScanImage = useStore(state => state.lastFaceScanImage)
  const storedHairType = useStore(state => state.hairType)
  const setHairType = useStore(state => state.setHairType)
  const storedProfile = useStore(state => state.hairProfile)
  const setHairProfile = useStore(state => state.setHairProfile)
  const recommendationCache = useStore(state => state.hairRecommendationCache)
  const setRecommendationCache = useStore(state => state.setHairRecommendationCache)
  const savedIds = useStore(state => state.savedHairLookIds)
  const toggleSaved = useStore(state => state.toggleSavedHairLook)

  const structure = useMemo(() => structureFromScan(scan), [scan])
  const [sourceImage, setSourceImage] = useState(lastFaceScanImage || currentScan?.facePhotoUrl || null)
  const [stage, setStage] = useState('intro')
  const [question, setQuestion] = useState(0)
  const [profile, setProfile] = useState(() => storedProfile && storedProfile.scanId === (scan?.id ?? null) ? storedProfile : {
    scanId: scan?.id ?? null, hairType: ['straight', 'wavy', 'curly', 'coily'].includes(storedHairType) ? storedHairType : null,
    density: null, strandThickness: 'medium', desiredLength: 'any', maintenancePreference: 'any',
  })
  const [recommendations, setRecommendations] = useState([])
  const [active, setActive] = useState(0)
  const [detail, setDetail] = useState(null)
  const [barber, setBarber] = useState(null)
  const questionAdvanceTimer = useRef(null)
  const matchingRunId = useRef(0)

  useEffect(() => () => {
    if (questionAdvanceTimer.current) clearTimeout(questionAdvanceTimer.current)
    matchingRunId.current += 1
  }, [])

  useEffect(() => {
    if (sourceImage || !scan?.id) return
    loadScanMedia(scan.id).then(media => { if (media?.photo) setSourceImage(media.photo) })
  }, [scan?.id, sourceImage])

  const questions = useMemo(() => [
    { key: 'hairType', title: "What's your hair type?", subtitle: null, options: HAIR_TYPES, visual: true },
    { key: 'density', title: 'How dense is your hair?', subtitle: null, options: DENSITIES, columns: 3 },
    { key: 'desiredLength', title: 'What length are you open to?', subtitle: null, options: LENGTHS.filter(length => length !== 'any'), columns: 3 },
  ], [])

  function startQuestions() {
    // Re-ask the full profile whenever HairMax is entered. The saved profile
    // remains available for matching and recommendations, but must not skip
    // the questionnaire after the user presses Continue.
    if (questionAdvanceTimer.current) clearTimeout(questionAdvanceTimer.current)
    questionAdvanceTimer.current = null
    matchingRunId.current += 1
    setQuestion(0)
    setStage('questions')
  }

  function answer(value) {
    const item = questions[question]
    const nextProfile = { ...profile, [item.key]: value, scanId: scan?.id ?? null }
    setProfile(nextProfile)
    if (questionAdvanceTimer.current) clearTimeout(questionAdvanceTimer.current)
    if (question < questions.length - 1) {
      questionAdvanceTimer.current = setTimeout(() => {
        questionAdvanceTimer.current = null
        setQuestion(index => index + 1)
      }, 140)
    }
    else beginMatching(nextProfile)
  }

  function cacheKey(nextProfile) {
    const evidenceVersion = structure.evidence?.schemaVersion ?? structure.evidence?.version ?? 'measured-v1'
    const profileKey = ['hairType', 'density', 'strandThickness', 'desiredLength', 'maintenancePreference'].map(key => nextProfile[key]).join('|')
    return `${scan?.id ?? 'no-scan'}|${evidenceVersion}|${profileKey}|${HAIR_CATALOG_VERSION}`
  }

  function resolveRecommendations(items, engine, hairProfile) {
    const isType1ShortProfile = hairProfile.hairType === 'straight' && hairProfile.desiredLength === 'short'
    const isType2ShortProfile = hairProfile.hairType === 'wavy' && hairProfile.desiredLength === 'short'
    const isType3ShortProfile = hairProfile.hairType === 'curly' && hairProfile.desiredLength === 'short'
    const isType3MediumProfile = hairProfile.hairType === 'curly' && hairProfile.desiredLength === 'medium'
    const isType3LongProfile = hairProfile.hairType === 'curly' && hairProfile.desiredLength === 'long'
    const isType4ShortProfile = hairProfile.hairType === 'coily' && hairProfile.desiredLength === 'short'
    const isType4MediumProfile = hairProfile.hairType === 'coily' && hairProfile.desiredLength === 'medium'
    const isType4LongProfile = hairProfile.hairType === 'coily' && hairProfile.desiredLength === 'long'
    const isType2MediumProfile = hairProfile.hairType === 'wavy' && hairProfile.desiredLength === 'medium'
    const excludedType1ShortStyles = new Set(['straight_crew', 'side_swept_crop', 'compact_crop', 'short_taper'])
    const excludedType2ShortStyles = new Set(['compact_crop', 'short_taper'])
    const excludedType3ShortStyles = new Set(['short_curly_taper'])
    const excludedType3MediumStyles = new Set(['brushed_back_layers'])
    const excludedType3LongStyles = new Set(['long_loose_curls', 'long_curtain_curls'])
    const excludedType2MediumStyles = new Set(['wavy_layers', 'wavy_shag', 'brushed_back_layers', 'side_part_waves'])
    const resolved = items.map((item, index) => {
      const style = HAIRSTYLE_CATALOG.find(value => value.id === item.hairstyleId)
      const hardCompatible = style && style.compatibleHairTypes.includes(hairProfile.hairType) &&
        style.compatibleDensity.includes(hairProfile.density) && style.compatibleThickness.includes(hairProfile.strandThickness || 'medium')
      const excluded = item.hairstyleId === 'layered_wolf' ||
        (isType1ShortProfile && excludedType1ShortStyles.has(item.hairstyleId)) ||
        (isType2ShortProfile && excludedType2ShortStyles.has(item.hairstyleId)) ||
        (isType3ShortProfile && excludedType3ShortStyles.has(item.hairstyleId)) ||
        (isType2MediumProfile && excludedType2MediumStyles.has(item.hairstyleId)) ||
        (isType3MediumProfile && excludedType3MediumStyles.has(item.hairstyleId)) ||
        (isType3LongProfile && excludedType3LongStyles.has(item.hairstyleId))
      return hardCompatible && !excluded ? {
        hairstyleId: item.hairstyleId, style, rank: item.rank ?? index + 1,
        compatibility: item.compatibility ?? Math.max(72, 97 - index * 4),
        reasons: item.matchReasons ?? item.reasons ?? [],
        relevantMeasurements: item.relevantMeasurements ?? [],
        compatibilityFactors: item.compatibilityFactors ?? [], limitations: item.limitations ?? [],
        engine: item.engine ?? engine,
      } : null
    }).filter(Boolean)

    if (isType4ShortProfile) {
      resolved.unshift({
        hairstyleId: 'community-reference-type4-short-buzz-cut',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for a Type 4 short buzz cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 4 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type4-short-buzz-cut',
          name: 'Waves',
          appearance: 'Type 4 reference photo',
          compatibleHairTypes: ['coily'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'low',
          growth: 'Keeps the coily hair very short and evenly shaped.',
          styling: 'Keep the short coils moisturized and the outline neat between cuts.',
          barber: {
            top: 'Cut the Type 4 coils short and even all over, following the buzz cut reference.',
            sides: 'Keep the sides short and consistent with the top.',
            back: 'Keep the back short and evenly blended.',
            taper: 'Use a subtle natural edge-up without adding a high fade.',
          },
          image: { src: type4ShortBuzzCutReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type4-short-waves',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for Type 4 short waves.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 4 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type4-short-waves',
          name: 'Buzz Cut',
          appearance: 'Type 4 reference photo',
          compatibleHairTypes: ['coily'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'some',
          growth: 'Keeps the hair close while shaping the natural wave pattern across the scalp.',
          styling: 'Brush consistently in the direction of the wave pattern and protect it with a durag.',
          barber: {
            top: 'Keep the hair short and even, preserving the defined 360 wave pattern.',
            sides: 'Blend the sides close while keeping the wave pattern visible.',
            back: 'Keep the back short and connected to the wave pattern.',
            taper: 'Use a clean low taper that preserves the natural hairline.',
          },
          image: { src: type4ShortWavesReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type4-short-mini-fro-low-taper',
        rank: 2,
        compatibility: 100,
        reasons: ['Reference photo for a Type 4 short Mini Fro with Low Taper.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 4 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type4-short-mini-fro-low-taper',
          name: 'Mini Fro with Low Taper',
          appearance: 'Type 4 reference photo',
          compatibleHairTypes: ['coily'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'some',
          growth: 'Keeps a short rounded fro with a neat, low taper at the temples and nape.',
          styling: 'Moisturize the coils and pick out the top gently to maintain its rounded shape.',
          barber: {
            top: 'Keep a short, rounded mini fro with enough coil length to show natural texture.',
            sides: 'Shape the sides while preserving the rounded fro silhouette.',
            back: 'Keep the back short and balanced with the rounded top.',
            taper: 'Blend a low taper around the temples and nape, keeping the transition subtle.',
          },
          image: { src: type4ShortMiniFroLowTaperReference, width: 941, height: 1672 },
        },
      })
    }

    if (isType4MediumProfile) {
      const type4MediumReferences = [
        {
          id: 'community-reference-type4-medium-fro-mid-taper',
          name: 'Fro with Mid Taper',
          image: type4MediumFroMidTaperReference,
          reasons: ['Reference photo for a Type 4 medium Fro with Mid Taper.'],
          growth: 'Keeps medium coils full and rounded with a mid taper for a clean outline.',
          styling: 'Moisturize the coils and pick them out gently to keep the fro full and defined.',
          barber: {
            top: 'Keep medium length through the top and shape the coils into a balanced rounded fro.',
            sides: 'Preserve the fro shape while blending into a mid taper.',
            back: 'Keep medium length and fullness through the back.',
            taper: 'Blend a mid taper at the temples and nape.',
          },
        },
        {
          id: 'community-reference-type4-medium-cornrows',
          name: 'Cornrows',
          image: type4MediumCornrowsReference,
          reasons: ['Reference photo for Type 4 medium cornrows.'],
          growth: 'Keeps medium hair neat in close, scalp-hugging braids.',
          styling: 'Keep the rows moisturized and protect them while sleeping.',
          barber: {
            top: 'Part the hair cleanly and braid it close to the scalp in straight-back cornrows.',
            sides: 'Continue the cornrow pattern neatly around the sides while preserving the natural hairline.',
            back: 'Braid through to medium-length ends at the nape.',
            taper: 'Keep the hairline natural without a fade.',
          },
        },
        {
          id: 'community-reference-type4-medium-dreadlocks',
          name: 'Dreadlocks',
          image: type4MediumDreadlocksReference,
          reasons: ['Reference photo for Type 4 medium dreadlocks.'],
          growth: 'Keeps medium locs framing the face and falling around the shoulders.',
          styling: 'Keep the locs clean and moisturized, and maintain the parts as they grow.',
          barber: {
            top: 'Maintain medium locs with clean, balanced sections and a natural center part.',
            sides: 'Keep the locs full and even around the sides without cutting them into braids.',
            back: 'Preserve medium length through the back, with locs around the shoulders.',
            taper: 'Keep the outline natural without a fade.',
          },
        },
        {
          id: 'community-reference-type4-medium-braids',
          name: 'Braids',
          image: type4MediumBraidsReference,
          reasons: ['Reference photo for Type 4 medium braids.'],
          growth: 'Keeps medium hair neatly sectioned into individual braids that frame the face.',
          styling: 'Keep the braids neat and moisturized, and protect them while sleeping.',
          barber: {
            top: 'Create medium individual braids with clean, balanced sections across the crown.',
            sides: 'Continue the braids evenly around the sides while preserving the natural hairline.',
            back: 'Braid through to medium-length ends around the shoulders.',
            taper: 'Keep the outline natural without a fade.',
          },
        },
      ]

      resolved.unshift(...type4MediumReferences.map((reference, rank) => ({
        hairstyleId: reference.id,
        rank,
        compatibility: 100,
        reasons: reference.reasons,
        relevantMeasurements: [],
        compatibilityFactors: ['Type 4 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: reference.id,
          name: reference.name,
          appearance: 'Type 4 reference photo',
          compatibleHairTypes: ['coily'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: reference.growth,
          styling: reference.styling,
          barber: reference.barber,
          image: { src: reference.image, width: 941, height: 1672 },
        },
      })))
    }

    if (isType4LongProfile) {
      const type4LongReferences = [
        {
          id: 'community-reference-type4-long-fro-mid-taper',
          name: 'Fro with Mid Taper',
          image: type4LongFroMidTaperReference,
          reasons: ['Reference photo for a Type 4 long Fro with Mid Taper.'],
          growth: 'Keeps long coils full and rounded with a mid taper to define the outline.',
          styling: 'Moisturize the coils and pick them out gently to preserve the full shape and definition.',
          barber: {
            top: 'Preserve long coils and shape them into a large, rounded fro.',
            sides: 'Keep the fro full while blending the sides into a mid taper.',
            back: 'Maintain long, full coils through the back.',
            taper: 'Blend a mid taper at the temples and nape without reducing the fro length.',
          },
        },
        {
          id: 'community-reference-type4-long-dreadlocks',
          name: 'Dreadlocks',
          image: type4LongDreadlocksReference,
          reasons: ['Reference photo for Type 4 long dreadlocks.'],
          growth: 'Keeps long locs flowing past the shoulders with a natural center part.',
          styling: 'Keep the locs clean and moisturized, and protect them while sleeping.',
          barber: {
            top: 'Maintain long locs with clean, balanced sections and a natural center part.',
            sides: 'Keep the locs full and even around the sides.',
            back: 'Preserve long locs through the back, extending past the shoulders.',
            taper: 'Keep the outline natural without a fade.',
          },
        },
        {
          id: 'community-reference-type4-long-braids',
          name: 'Braids',
          image: type4LongBraidsReference,
          imageHeight: 1671,
          reasons: ['Reference photo for Type 4 long braids.'],
          growth: 'Keeps long individual braids falling past the shoulders with clean, even sections.',
          styling: 'Keep the braids neat and moisturized, and protect them while sleeping.',
          barber: {
            top: 'Create long individual braids with clean, balanced sections across the crown.',
            sides: 'Continue the braids evenly around the sides while preserving the natural hairline.',
            back: 'Preserve long braids through the back, extending past the shoulders.',
            taper: 'Keep the outline natural without a fade.',
          },
        },
      ]

      resolved.unshift(...type4LongReferences.map((reference, rank) => ({
        hairstyleId: reference.id,
        rank,
        compatibility: 100,
        reasons: reference.reasons,
        relevantMeasurements: [],
        compatibilityFactors: ['Type 4 hair', 'Long length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: reference.id,
          name: reference.name,
          appearance: 'Type 4 reference photo',
          compatibleHairTypes: ['coily'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: reference.growth,
          styling: reference.styling,
          barber: reference.barber,
          image: { src: reference.image, width: 941, height: reference.imageHeight ?? 1672 },
        },
      })))
    }

    if (isType1ShortProfile) {
      resolved.unshift({
        hairstyleId: 'community-reference-type1-crew-cut',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 short crew cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Short length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-crew-cut',
          name: 'Crew Cut',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'low',
          growth: 'Suitable for a shorter cut',
          styling: 'Keep the top lightly textured and the sides neat.',
          barber: {
            top: 'Keep the top short with natural texture, following the crew cut reference.',
            sides: 'Keep the sides close and evenly blended.',
            back: 'Keep the back short and clean.',
            taper: 'Use a subtle taper around the edges.',
          },
          image: { src: type1CrewCutReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type1-mod-cut',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 short Mod Cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Short length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-mod-cut',
          name: 'Mod Cut',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'some',
          growth: 'Suitable for a shorter cut',
          styling: 'Wear the textured fringe forward and keep the sides softly shaped.',
          barber: {
            top: 'Leave a textured top with a soft fringe across the forehead, matching the Mod Cut reference.',
            sides: 'Keep some length around the sides with a soft, natural shape.',
            back: 'Leave light length at the back to keep the rounded silhouette.',
            taper: 'Avoid a sharp high fade; blend the sides naturally.',
          },
          image: { src: type1ModCutReference, width: 941, height: 1672 },
        },
      })

      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type1-buzz-cut',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 short buzz cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Short length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-buzz-cut',
          name: 'Buzz Cut',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'low',
          growth: 'Suitable for a shorter cut',
          styling: 'Keep the short shape neat with a light styling product.',
          barber: {
            top: 'Keep the top short and evenly textured, following the buzz cut reference.',
            sides: 'Keep the sides short and blended into the top.',
            back: 'Keep the back short and clean.',
            taper: 'Use a subtle, even taper around the edges.',
          },
          image: { src: type1BuzzCutReference, width: 941, height: 1672 },
        },
      })
    }
    if (isType2ShortProfile) {
      resolved.unshift({
        hairstyleId: 'community-reference-type2-buzz-cut',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for a Type 2 short buzz cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 2 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type2-buzz-cut',
          name: 'Buzz Cut',
          appearance: 'Type 2 reference photo',
          compatibleHairTypes: ['wavy'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'low',
          growth: 'Suitable for a shorter cut',
          styling: 'Keep the short shape neat with a light styling product.',
          barber: {
            top: 'Keep the top short and evenly textured, following the buzz cut reference.',
            sides: 'Keep the sides short and blended into the top.',
            back: 'Keep the back short and clean.',
            taper: 'Use a subtle, even taper around the edges.',
          },
          image: { src: type1BuzzCutReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type2-short-mod-cut',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 2 short Mod Cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 2 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type2-short-mod-cut',
          name: 'Mod Cut',
          appearance: 'Type 2 reference photo',
          compatibleHairTypes: ['wavy'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'some',
          growth: 'Suitable for a shorter cut',
          styling: 'Style the short waves forward into a loose, textured fringe.',
          barber: {
            top: 'Leave a short, textured top with a soft wavy fringe across the forehead.',
            sides: 'Keep some length around the sides and shape the natural waves.',
            back: 'Keep the back short with a soft, natural outline.',
            taper: 'Avoid a sharp high fade; blend the sides naturally.',
          },
          image: { src: type2ShortModCutReference, width: 941, height: 1671 },
        },
      })
      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type2-short-warrior-cut',
        rank: 2,
        compatibility: 100,
        reasons: ['Reference photo for a Type 2 short Warrior Cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 2 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type2-short-warrior-cut',
          name: 'Warrior Cut',
          appearance: 'Type 2 reference photo',
          compatibleHairTypes: ['wavy'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'some',
          growth: 'Suitable for a shorter layered cut',
          styling: 'Let the natural waves add texture through the top and softly shaped back.',
          barber: {
            top: 'Keep a short, textured top with natural wave and a loose forward fringe.',
            sides: 'Shape the sides close while preserving soft natural texture.',
            back: 'Keep the nape softly layered and compact for the Warrior Cut silhouette.',
            taper: 'Blend the sides and nape naturally without a sharp high fade.',
          },
          image: { src: type2ShortWarriorCutReference, width: 941, height: 1671 },
        },
      })
    }
    if (hairProfile.hairType === 'curly' && hairProfile.desiredLength === 'short') {
      resolved.unshift({
        hairstyleId: 'community-reference-type3-short-fringe-low-taper',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for Type 3 short fringe with a low taper.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-short-fringe-low-taper',
          name: 'Fringe with Low Taper',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'some',
          growth: 'Keeps the curls short while leaving enough length for a defined fringe',
          styling: 'Define the short curls forward into a natural fringe and keep the taper subtle and low.',
          barber: {
            top: 'Keep the top short with defined Type 3 curls, shaped forward into a soft fringe.',
            sides: 'Use a subtle low taper around the temples, keeping it low and blended.',
            back: 'Keep the nape neat and naturally blended into the curls.',
            taper: 'Start the taper low around the ears and nape; avoid taking it high into the curls.',
          },
          image: { src: type3ShortFringeLowTaperReference, width: 1145, height: 1374 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type3-short-curly-modern-mullet',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 3 short Curly Modern Mullet.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-short-curly-modern-mullet',
          name: 'Curly Modern Mullet',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'some',
          growth: 'Keeps the sides short while leaving extra curl length at the nape',
          styling: 'Define the curls on top and fringe, leaving the back longer for a modern mullet shape.',
          barber: {
            top: 'Keep short, defined Type 3 curls through the crown with a natural curly fringe.',
            sides: 'Shape the sides short with a low, blended taper.',
            back: 'Leave extra length at the nape and layer the curls to form a soft modern mullet tail.',
            taper: 'Keep the taper low around the temples and nape; preserve the longer curls at the back.',
          },
          image: { src: type3ShortCurlyModernMulletReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type3-short-curly-middle-part',
        rank: 2,
        compatibility: 100,
        reasons: ['Reference photo for a Type 3 short Curly Middle Part.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Short length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-short-curly-middle-part',
          name: 'Curly Middle Part',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'short',
          maintenance: 'some',
          growth: 'Keeps the curls short with a defined center part and balanced shape',
          styling: 'Part the curls near the center and let the short curls frame both sides of the face.',
          barber: {
            top: 'Keep the curls short with a natural center part and balanced volume on both sides.',
            sides: 'Shape the sides evenly to frame the face while preserving the curl pattern.',
            back: 'Keep the back short and blended into the overall rounded shape.',
            taper: 'Use a soft, low natural taper; avoid a high fade that removes the side shape.',
          },
          image: { src: type3ShortCurlyMiddlePartReference, width: 941, height: 1672 },
        },
      })
    }
    if (hairProfile.hairType === 'straight' && hairProfile.desiredLength === 'medium') {
      resolved.unshift({
        hairstyleId: 'community-reference-type1-middle-part-flow',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 medium-length middle part flow.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Medium length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-middle-part-flow',
          name: 'Middle Part Flow',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Suitable for medium-length styling',
          styling: 'Part the hair near the center and let the longer layers flow naturally away from the face.',
          barber: {
            top: 'Keep medium length on top with a relaxed center part and natural movement.',
            sides: 'Leave enough length at the sides to sweep back and blend into the top.',
            back: 'Keep the back medium length with soft, flowing layers.',
            taper: 'Use a subtle, natural blend without a sharp fade.',
          },
          image: { src: type1MiddlePartFlowReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type1-textured-fringe',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 medium-length textured fringe.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Medium length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-textured-fringe',
          name: 'Textured Fringe',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Suitable for a medium-length textured style',
          styling: 'Wear the textured layers forward with a loose, natural fringe.',
          barber: {
            top: 'Keep medium length on top with choppy texture and a loose fringe over the forehead.',
            sides: 'Leave soft length around the sides and blend it naturally into the top.',
            back: 'Keep the back medium length with lightly textured layers.',
            taper: 'Use a soft, natural blend rather than a sharp fade.',
          },
          image: { src: type1TexturedFringeReference, width: 941, height: 1671 },
        },
      })
      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type1-medium-mod-cut',
        rank: 2,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 medium-length Mod Cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Medium length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-medium-mod-cut',
          name: 'Mod Cut',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Suitable for medium-length styling',
          styling: 'Wear the layered shape loose, with the fringe falling naturally across the forehead.',
          barber: {
            top: 'Keep medium length and add soft layers with a loose fringe across the forehead.',
            sides: 'Leave enough length to frame the face and connect into the top layers.',
            back: 'Keep medium length with a softly layered, slightly rounded shape.',
            taper: 'Blend naturally around the sides and back without a sharp fade.',
          },
          image: { src: type1MediumModCutReference, width: 941, height: 1670 },
        },
      })
    }
    if (hairProfile.hairType === 'wavy' && hairProfile.desiredLength === 'medium') {
      resolved.unshift({
        hairstyleId: 'community-reference-type2-middle-part-flow',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for a Type 2 medium-length middle part flow.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 2 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type2-middle-part-flow',
          name: 'Middle Part Flow',
          appearance: 'Type 2 reference photo',
          compatibleHairTypes: ['wavy'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Suitable for medium-length styling',
          styling: 'Part the wavy hair near the center and let the layers flow naturally away from the face.',
          barber: {
            top: 'Keep medium length on top with a relaxed center part and natural wave movement.',
            sides: 'Leave enough length at the sides to sweep back and blend into the top.',
            back: 'Keep the back medium length with soft, flowing layers.',
            taper: 'Use a subtle, natural blend without a sharp fade.',
          },
          image: { src: type2MediumMiddlePartFlowReference, width: 941, height: 1671 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type2-medium-wolf-cut',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 2 medium-length wolf cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 2 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type2-medium-wolf-cut',
          name: 'Wolf Cut',
          appearance: 'Type 2 reference photo',
          compatibleHairTypes: ['wavy'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Suitable for medium-length layered styling',
          styling: 'Keep the waves loose and airy, with textured layers framing the face.',
          barber: {
            top: 'Keep medium, choppy layers through the crown with natural wave and a loose fringe.',
            sides: 'Use feathered layers that frame the face and blend into the crown.',
            back: 'Keep the back medium length with distinct, soft layers and a lightly tapered shape.',
            taper: 'Blend the sides and back with layered shaping rather than a close fade.',
          },
          image: { src: type2MediumWolfCutReference, width: 941, height: 1671 },
        },
      })
      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type2-medium-modern-shag',
        rank: 2,
        compatibility: 100,
        reasons: ['Reference photo for a Type 2 medium-length Modern Shag.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 2 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type2-medium-modern-shag',
          name: 'Modern Shag',
          appearance: 'Type 2 reference photo',
          compatibleHairTypes: ['wavy'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Suitable for medium-length layered styling',
          styling: 'Keep the waves loose and airy, with textured layers framing the face.',
          barber: {
            top: 'Keep medium-length, choppy layers through the crown with natural wave and a soft fringe.',
            sides: 'Use feathered layers to frame the face and blend into the crown.',
            back: 'Keep the back medium length with soft, airy layers.',
            taper: 'Blend naturally around the sides and back without a sharp fade.',
          },
          image: { src: type2MediumModernShagReference, width: 941, height: 1671 },
        },
      })
    }
    if (hairProfile.hairType === 'curly' && hairProfile.desiredLength === 'medium') {
      resolved.unshift({
        hairstyleId: 'community-reference-type3-medium-layered-curls',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for Type 3 medium layered curls.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-medium-layered-curls',
          name: 'Layered Curls',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Preserves medium length while adding definition and shape to the curls',
          styling: 'Define the curls and let the medium layers frame the face with natural movement.',
          barber: {
            top: 'Keep medium length through the crown and shape the natural curls into soft layers.',
            sides: 'Leave medium length around the sides with blended layers that frame the face.',
            back: 'Shape the back into a balanced medium-length silhouette with defined curls.',
            taper: 'Keep the outline soft and natural without a close fade.',
          },
          image: { src: type3MediumLayeredCurlsReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type3-medium-curly-fro',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 3 medium Curly Fro.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-medium-curly-fro',
          name: 'Curly Fro',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Builds a rounded medium-length shape with natural curl volume',
          styling: 'Pick out and define the curls to keep the fro rounded, full, and balanced.',
          barber: {
            top: 'Keep medium length and shape the curls into an even, rounded fro silhouette.',
            sides: 'Preserve balanced volume around the sides; lightly shape to maintain the rounded outline.',
            back: 'Keep medium length through the back and blend it into the rounded shape.',
            taper: 'Keep the hairline natural with no high fade.',
          },
          image: { src: type3MediumCurlyFroReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type3-medium-twists',
        rank: 2,
        compatibility: 100,
        reasons: ['Reference photo for Type 3 medium twists.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-medium-twists',
          name: 'Finger Coils',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Maintains medium length with individually defined twists around the head',
          styling: 'Keep the twists defined and moisturized, letting them frame the face naturally.',
          barber: {
            top: 'Create medium two-strand twists with a clear center part and balanced sections.',
            sides: 'Continue the twists at medium length around the sides, with loose ends framing the face.',
            back: 'Keep medium-length twists through the back and nape.',
            taper: 'Keep the outline natural without a fade.',
          },
          image: { src: type3MediumTwistsReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(3, 0, {
        hairstyleId: 'community-reference-type3-medium-cornrows',
        rank: 3,
        compatibility: 100,
        reasons: ['Reference photo for Type 3 medium cornrows.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-medium-cornrows',
          name: 'Cornrows',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Keeps medium length while securing curls in neat, scalp-hugging braids.',
          styling: 'Keep the rows clean and moisturized, and protect the braids while sleeping.',
          barber: {
            top: 'Part the hair into clean sections and braid close to the scalp in straight-back cornrows.',
            sides: 'Continue the cornrow pattern neatly across the sides, preserving the natural hairline.',
            back: 'Braid through to medium-length ends around the nape and let them hang naturally.',
            taper: 'Keep the edges natural without a fade.',
          },
          image: { src: type3MediumCornrowsReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(4, 0, {
        hairstyleId: 'community-reference-type3-medium-braids',
        rank: 4,
        compatibility: 100,
        reasons: ['Reference photo for Type 3 medium braids.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Medium length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-medium-braids',
          name: 'Braids',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'medium',
          maintenance: 'some',
          growth: 'Keeps medium-length hair organized in individual braids that frame the face.',
          styling: 'Keep the braids neat and moisturized, and protect them while sleeping.',
          barber: {
            top: 'Create medium individual braids with clean, balanced sections across the crown.',
            sides: 'Continue the braids evenly around the sides, keeping a natural hairline.',
            back: 'Braid through the back to medium-length ends that fall around the shoulders.',
            taper: 'Keep the outline natural without a fade.',
          },
          image: { src: type3MediumBraidsReference, width: 940, height: 1672 },
        },
      })
    }
    if (hairProfile.hairType === 'curly' && hairProfile.desiredLength === 'long') {
      resolved.unshift({
        hairstyleId: 'community-reference-type3-long-curly-wolf-cut',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for a Type 3 long curly wolf cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Long length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-long-curly-wolf-cut',
          name: 'Curly Wolf Cut',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Keeps long curls while shaping rounded layers and a softly tapered silhouette.',
          styling: 'Define the curls and let the long layers fall naturally around the face and shoulders.',
          barber: {
            top: 'Keep long, rounded layers through the crown to create volume and defined curl shape.',
            sides: 'Use soft face-framing layers that preserve the overall length and curl pattern.',
            back: 'Leave the back long with graduated layers and natural curl definition.',
            taper: 'Keep the hairline soft and natural without a close fade.',
          },
          image: { src: type3LongCurlyWolfCutReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type3-long-curly-fro',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 3 long Curly Fro.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Long length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-long-curly-fro',
          name: 'Curly Fro',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Preserves long curls in a full, rounded shape with natural definition.',
          styling: 'Pick out and define the curls for a balanced rounded silhouette with length around the shoulders.',
          barber: {
            top: 'Keep long length through the crown and shape the curls into a full, rounded fro.',
            sides: 'Preserve the curl volume at the sides and shape it evenly around the face.',
            back: 'Keep the back long, rounded, and full through the shoulders.',
            taper: 'Keep the hairline natural without a close fade.',
          },
          image: { src: type3LongCurlyFroReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type3-long-twists',
        rank: 2,
        compatibility: 100,
        reasons: ['Reference photo for Type 3 long twists.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Long length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-long-twists',
          name: 'Twists',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Keeps long hair in defined individual twists that fall to the shoulders.',
          styling: 'Keep the twists moisturized and defined, and protect them while sleeping.',
          barber: {
            top: 'Create long individual two-strand twists with clean, balanced sections and a center part.',
            sides: 'Continue the twists evenly around the sides while keeping the natural hairline.',
            back: 'Keep the twists long through the back, with ends reaching the shoulders.',
            taper: 'Keep the outline natural without a fade.',
          },
          image: { src: type3LongTwistsReference, width: 941, height: 1671 },
        },
      })
      resolved.splice(3, 0, {
        hairstyleId: 'community-reference-type3-long-braids',
        rank: 3,
        compatibility: 100,
        reasons: ['Reference photo for Type 3 long braids.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 3 hair', 'Long length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type3-long-braids',
          name: 'Braids',
          appearance: 'Type 3 reference photo',
          compatibleHairTypes: ['curly'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Keeps long hair neatly sectioned into defined braids that fall below the shoulders.',
          styling: 'Keep the braids clean and moisturized, and protect them while sleeping.',
          barber: {
            top: 'Create long individual braids with clean, balanced sections and a center part.',
            sides: 'Continue the braids evenly around the sides, preserving a natural hairline.',
            back: 'Keep the braids long through the back, extending below the shoulders.',
            taper: 'Keep the outline natural without a fade.',
          },
          image: { src: type3LongBraidsReference, width: 941, height: 1672 },
        },
      })
    }
    if (hairProfile.hairType === 'wavy' && hairProfile.desiredLength === 'long') {
      resolved.unshift({
        hairstyleId: 'community-reference-type2-long-wolf-cut',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for a Type 2 long wolf cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 2 hair', 'Long length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type2-long-wolf-cut',
          name: 'Wolf Cut',
          appearance: 'Type 2 reference photo',
          compatibleHairTypes: ['wavy'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Requires long layers around the sides and back',
          styling: 'Keep the long waves loose and airy, with a soft fringe framing the face.',
          barber: {
            top: 'Keep long, choppy layers through the crown with natural wave and a loose fringe.',
            sides: 'Use feathered layers that frame the cheeks and connect into the crown.',
            back: 'Leave the back long with distinct, soft layers and a gently tapered shape.',
            taper: 'Blend the sides and back with layered shaping rather than a close fade.',
          },
          image: { src: type2LongWolfCutReference, width: 941, height: 1671 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type2-long-wavy-layers',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for Type 2 long wavy layers.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 2 hair', 'Long length', 'Any density'],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type2-long-wavy-layers',
          name: 'Long Wavy Layers',
          appearance: 'Type 2 reference photo',
          compatibleHairTypes: ['wavy'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Keeps long length while adding movement and shape',
          styling: 'Wear the long layers loose to bring out natural waves and movement.',
          barber: {
            top: 'Keep the top long with soft, blended layers and a natural center part.',
            sides: 'Shape long, face-framing layers that flow into the sides without removing too much length.',
            back: 'Keep the back long with airy, cascading layers and soft ends.',
            taper: 'Blend naturally around the sides and back; avoid a sharp fade.',
          },
          image: { src: type2LongWavyLayersReference, width: 941, height: 1672 },
        },
      })
    }
    if (hairProfile.hairType === 'straight' && hairProfile.desiredLength === 'long') {
      resolved.unshift({
        hairstyleId: 'community-reference-type1-long-wolf-cut',
        rank: 0,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 long wolf cut.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Long length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-long-wolf-cut',
          name: 'Wolf Cut',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Requires long layers around the sides and back',
          styling: 'Keep the layers loose and airy, with a soft fringe framing the face.',
          barber: {
            top: 'Keep long, choppy layers through the crown with a loose face-framing fringe.',
            sides: 'Use feathered layers that frame the cheeks and connect smoothly to the crown.',
            back: 'Leave the back long with distinct, soft layers and a gently tapered shape.',
            taper: 'Blend the sides and back with layered shaping rather than a close fade.',
          },
          image: { src: type1LongWolfCutReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(1, 0, {
        hairstyleId: 'community-reference-type1-long-middle-part-flow',
        rank: 1,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 long middle part flow.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Long length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-long-middle-part-flow',
          name: 'Middle Part Flow',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Requires long, face-framing length',
          styling: 'Part near the center and let the long layers flow back naturally from the face.',
          barber: {
            top: 'Keep long length through the top with a soft center part and natural lift.',
            sides: 'Leave long face-framing layers that sweep back from the part.',
            back: 'Keep the back long and layered with a loose, flowing outline.',
            taper: 'Blend the sides and back with long layers rather than a close fade.',
          },
          image: { src: type1LongMiddlePartFlowReference, width: 941, height: 1672 },
        },
      })
      resolved.splice(2, 0, {
        hairstyleId: 'community-reference-type1-long-middle-part-mullet',
        rank: 2,
        compatibility: 100,
        reasons: ['Reference photo for a Type 1 long middle part mullet.'],
        relevantMeasurements: [],
        compatibilityFactors: ['Type 1 hair', 'Long length', `${hairProfile.density} density`],
        limitations: [],
        engine: 'user_reference',
        style: {
          id: 'community-reference-type1-long-middle-part-mullet',
          name: 'Middle Part Mullet',
          appearance: 'Type 1 reference photo',
          compatibleHairTypes: ['straight'],
          compatibleDensity: ['low', 'medium', 'high'],
          compatibleThickness: ['fine', 'medium', 'thick'],
          length: 'long',
          maintenance: 'some',
          growth: 'Requires long length at the back with shorter face-framing sides',
          styling: 'Keep a center part through the top, shorter curtain sides and longer feathered length at the back.',
          barber: {
            top: 'Keep long curtain layers with a clear center part and soft volume.',
            sides: 'Shape shorter, feathered layers around the ears and face.',
            back: 'Leave the back long with a distinct, softly layered mullet shape.',
            taper: 'Blend the sides into the longer back with layered shaping, not a close fade.',
          },
          image: { src: type1LongMiddlePartMulletReference, width: 941, height: 1671 },
        },
      })
    }
    if (hairProfile.desiredLength === 'long' && ['straight', 'wavy'].includes(hairProfile.hairType)) {
      const providedLongStyles = hairProfile.hairType === 'straight'
        ? new Set([
          'community-reference-type1-long-wolf-cut',
          'community-reference-type1-long-middle-part-flow',
          'community-reference-type1-long-middle-part-mullet',
        ])
        : hairProfile.hairType === 'wavy'
          ? new Set([
            'community-reference-type2-long-wolf-cut',
            'community-reference-type2-long-wavy-layers',
          ])
          : new Set()
      const sentStylesOnly = resolved.filter(item => providedLongStyles.has(item.hairstyleId || item.style?.id))
      resolved.splice(0, resolved.length, ...sentStylesOnly)
    }
    return resolved
  }

  async function beginMatching(nextProfile) {
    if (questionAdvanceTimer.current) clearTimeout(questionAdvanceTimer.current)
    questionAdvanceTimer.current = null
    const runId = ++matchingRunId.current
    nextProfile = { ...nextProfile, catalogVersion: HAIR_CATALOG_VERSION, strandThickness: nextProfile.strandThickness || 'medium', maintenancePreference: nextProfile.maintenancePreference || 'any' }
    setHairProfile(nextProfile)
    setHairType(nextProfile.hairType)
    setActive(0)
    const key = cacheKey(nextProfile)
    if (recommendationCache?.key === key && recommendationCache.recommendations?.length) {
      const cached = resolveRecommendations(recommendationCache.recommendations, recommendationCache.engine, nextProfile)
      if (cached.length) {
        setRecommendations(cached)
        setStage('looks')
        return
      }
    }
    setStage('matching')
    let ranked
    try {
      const response = await api.hair.recommend({ hairProfile: nextProfile, analysisEvidence: portableEvidence(structure.evidence) })
      if (runId !== matchingRunId.current) return
      ranked = resolveRecommendations(response.recommendations ?? [], response.engine, nextProfile)
      if (!ranked.length) ranked = resolveRecommendations(rankHairstyles(nextProfile, structure, 18), 'deterministic_catalog_fallback_v1', nextProfile)
    } catch (error) {
      if (runId !== matchingRunId.current) return
      console.error('[HairMax] Grounded recommendation request failed:', error?.message)
      ranked = resolveRecommendations(rankHairstyles(nextProfile, structure, 8), 'deterministic_catalog_fallback_v1', nextProfile)
    }
    if (!ranked.length) { setRecommendations([]); setStage('recommend_error'); return }
    setRecommendationCache({
      key,
      engine: ranked[0]?.engine,
      recommendations: ranked.map(({ hairstyleId, rank, compatibility, reasons, relevantMeasurements, compatibilityFactors, limitations, engine }) => ({ hairstyleId, rank, compatibility, reasons, relevantMeasurements, compatibilityFactors, limitations, engine })),
    })
    setRecommendations(ranked)
    setStage('looks')
  }

  function back() {
    if (questionAdvanceTimer.current) clearTimeout(questionAdvanceTimer.current)
    questionAdvanceTimer.current = null
    if (stage === 'matching') matchingRunId.current += 1
    if (barber) { setBarber(null); return }
    if (detail) { setDetail(null); return }
    if (stage === 'intro') {
      const historyIndex = window.history.state?.idx
      if (Number.isInteger(historyIndex) && historyIndex > 0) navigate(-1)
      else navigate('/extras', { replace: true })
    }
    else if (stage === 'questions') question > 0 ? setQuestion(value => value - 1) : setStage('intro')
    else if (stage === 'saved') setStage('looks')
    else if (stage === 'looks') { setQuestion(questions.length - 1); setStage('questions') }
    else if (stage === 'matching' || stage === 'recommend_error') { setQuestion(questions.length - 1); setStage('questions') }
    else setStage('intro')
  }

  function backToHairLength() {
    if (barber) { setBarber(null); return }
    if (detail) { setDetail(null); return }
    const lengthQuestion = questions.findIndex(item => item.key === 'desiredLength')
    setQuestion(lengthQuestion >= 0 ? lengthQuestion : 0)
    setStage('questions')
  }

  const selectedQuestion = questions[question]
  // Intro uses the same plain "flex flex-col h-full" root Scan.jsx uses for
  // its own step screens (real available height inherited from Layout's
  // flex chain, no scroll) instead of MotionPage's default page-scroll
  // (fixed calc(100vh-72px) + overflow-y-auto) — that mismatch was both the
  // wrong proportions and why the intro screen could scroll at all. Other
  // stages (questions/looks/saved) keep the normal scrollable behavior.
  return <MotionPage
    baseClassName={stage === 'intro' ? '' : 'page-scroll'}
    className={stage === 'intro' ? 'flex flex-col h-full' : stage === 'questions' ? 'flex flex-col' : ''}
    style={{ background: BG }}
  >
    {/* ConnectedIntro carries its own back button (matching Scan.jsx's step
        header exactly), so the generic bar is skipped for that stage. */}
    {stage !== 'intro' && <Header onBack={stage === 'looks' ? backToHairLength : back} />}
    <AnimatePresence mode="wait">
      {stage === 'intro' && <motion.div key="intro" className="flex-1 min-h-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ConnectedIntro structure={structure} image={sourceImage} onBack={back} onContinue={startQuestions} onRescan={() => navigate('/scan/capture')} /></motion.div>}
      {stage === 'questions' && selectedQuestion && <motion.div key={`q-${question}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 min-h-0 flex flex-col px-5"><ChoiceGrid {...selectedQuestion} questionKey={selectedQuestion.key} questionNumber={question + 1} questionCount={questions.length} value={profile[selectedQuestion.key]} onChange={answer} /></motion.div>}
      {stage === 'matching' && <motion.div key="matching" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Matching profile={profile} structure={structure} /></motion.div>}
      {stage === 'recommend_error' && <motion.div key="recommend-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[70vh] px-6 flex flex-col items-center justify-center text-center"><Sparkles size={30} color={GOLD} /><h2 className="font-heading font-bold text-[22px] text-white mt-5">Couldn’t build your looks</h2><p className="text-[13px] text-white/50 mt-2 mb-6">Your scan is safe. Try the grounded matching step again.</p><button onClick={() => beginMatching(profile)} className="px-6 py-3 rounded-2xl font-heading font-bold text-[13px]" style={{ background: GOLD_GRADIENT, color: '#080808' }}>Try again</button></motion.div>}
      {stage === 'looks' && <motion.div key="looks" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Looks structure={structure} onEdit={() => { setQuestion(0); setStage('questions') }} recommendations={recommendations} active={active} setActive={setActive} savedIds={savedIds} onSave={toggleSaved} onDetails={setDetail} onSaved={() => setStage('saved')} /></motion.div>}
      {stage === 'saved' && <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><SavedLooks recommendations={recommendations} savedIds={savedIds} onSelect={item => { setDetail(item); setStage('looks') }} /></motion.div>}
    </AnimatePresence>
    <AnimatePresence>{detail && <DetailSheet recommendation={detail} onClose={() => setDetail(null)} onBarber={() => setBarber(detail)} />}</AnimatePresence>
    {barber && <BarberMode recommendation={barber} onClose={() => setBarber(null)} />}
  </MotionPage>
}
