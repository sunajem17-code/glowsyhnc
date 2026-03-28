import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Lock, Copy, Check, Scissors, BookOpen, Star, StarOff } from 'lucide-react'
import useStore from '../store/useStore'
import {
  FACE_SHAPES,
  HAIR_DENSITIES,
  HAIRLINES,
  FACE_PROFILES,
  getModifiedRecommendations,
  MAINTENANCE_COLORS,
  MAINTENANCE_LABELS,
} from '../utils/haircuts'

// ─── Design tokens (luxury dark) ──────────────────────────────────────────────
const GOLD = '#C9A84C'
const GOLD_DIM = '#8C7035'
const SURFACE = '#141414'
const SURFACE_2 = '#1C1C1C'
const SURFACE_3 = '#242424'
const BORDER = '#2A2A2A'
const TEXT_PRI = '#F0EDE6'
const TEXT_SEC = '#7A7772'

// ─── Step indicators ──────────────────────────────────────────────────────────
const STEPS = ['Face Shape', 'Hair Details', 'Your Cuts']

function StepBar({ step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-300"
              style={{
                background: i <= step ? GOLD : SURFACE_3,
                color: i <= step ? '#0A0A0A' : TEXT_SEC,
                border: `1px solid ${i <= step ? GOLD : BORDER}`,
              }}
            >
              {i + 1}
            </div>
            <span
              className="text-[9px] font-body whitespace-nowrap"
              style={{ color: i <= step ? GOLD : TEXT_SEC }}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="flex-1 h-px mb-4"
              style={{ background: i < step ? GOLD : BORDER }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Face Shape Selector ───────────────────────────────────────────────────────
function FaceShapeSelector({ selected, onSelect }) {
  return (
    <div>
      <h2 className="font-heading font-bold text-xl mb-1" style={{ color: TEXT_PRI }}>
        Select your face shape
      </h2>
      <p className="text-sm font-body mb-6" style={{ color: TEXT_SEC }}>
        The foundation of every good cut.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {FACE_SHAPES.map(shape => {
          const isActive = selected === shape.id
          return (
            <motion.button
              key={shape.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(shape.id)}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-200"
              style={{
                background: isActive ? `${GOLD}15` : SURFACE_2,
                borderColor: isActive ? GOLD : BORDER,
              }}
            >
              <svg viewBox="0 0 100 100" width={52} height={52}>
                <path
                  d={shape.svgPath}
                  fill={isActive ? `${GOLD}25` : `${TEXT_SEC}15`}
                  stroke={isActive ? GOLD : TEXT_SEC}
                  strokeWidth="2"
                />
              </svg>
              <span
                className="text-xs font-heading font-semibold"
                style={{ color: isActive ? GOLD : TEXT_PRI }}
              >
                {shape.label}
              </span>
            </motion.button>
          )
        })}
      </div>
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 px-4 py-3 rounded-xl"
          style={{ background: SURFACE_2, borderLeft: `3px solid ${GOLD}` }}
        >
          <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_SEC }}>
            {FACE_SHAPES.find(s => s.id === selected)?.description}
          </p>
        </motion.div>
      )}
    </div>
  )
}

// ─── Hair Details Selector ────────────────────────────────────────────────────
function HairDetailsSelector({ density, hairline, onDensity, onHairline }) {
  return (
    <div>
      <h2 className="font-heading font-bold text-xl mb-1" style={{ color: TEXT_PRI }}>
        Hair details
      </h2>
      <p className="text-sm font-body mb-6" style={{ color: TEXT_SEC }}>
        For precise recommendations.
      </p>

      <div className="mb-6">
        <p className="text-xs font-heading font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_SEC }}>
          Hair Density
        </p>
        <div className="grid grid-cols-3 gap-3">
          {HAIR_DENSITIES.map(d => {
            const isActive = density === d.id
            return (
              <button
                key={d.id}
                onClick={() => onDensity(d.id)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl border transition-all"
                style={{
                  background: isActive ? `${GOLD}15` : SURFACE_2,
                  borderColor: isActive ? GOLD : BORDER,
                }}
              >
                <span className="text-sm font-heading font-bold" style={{ color: isActive ? GOLD : TEXT_PRI }}>
                  {d.label}
                </span>
                <span className="text-[10px] font-body" style={{ color: TEXT_SEC }}>{d.sub}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-heading font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_SEC }}>
          Hairline
        </p>
        <div className="grid grid-cols-2 gap-3">
          {HAIRLINES.map(h => {
            const isActive = hairline === h.id
            return (
              <button
                key={h.id}
                onClick={() => onHairline(h.id)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl border transition-all"
                style={{
                  background: isActive ? `${GOLD}15` : SURFACE_2,
                  borderColor: isActive ? GOLD : BORDER,
                }}
              >
                <span className="text-sm font-heading font-bold" style={{ color: isActive ? GOLD : TEXT_PRI }}>
                  {h.label}
                </span>
                <span className="text-[10px] font-body" style={{ color: TEXT_SEC }}>{h.sub}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Barber Script Modal ───────────────────────────────────────────────────────
function BarberScriptModal({ cut, onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(cut.barberScript.say.replace(/"/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl p-6"
        style={{ background: SURFACE_2 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: BORDER }} />

        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>
              Barber Script
            </p>
            <h3 className="font-heading font-bold text-lg" style={{ color: TEXT_PRI }}>{cut.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: SURFACE_3 }}>
            <X size={16} style={{ color: TEXT_SEC }} />
          </button>
        </div>

        {/* Exact words to say */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: SURFACE_3, border: `1px solid ${BORDER}` }}>
          <p className="text-[10px] font-body uppercase tracking-widest mb-2" style={{ color: TEXT_SEC }}>
            Say exactly this:
          </p>
          <p className="text-sm font-body leading-relaxed" style={{ color: TEXT_PRI }}>
            {cut.barberScript.say}
          </p>
          <button
            onClick={handleCopy}
            className="mt-3 flex items-center gap-2 text-xs font-heading font-semibold px-3 py-2 rounded-xl transition-all"
            style={{ background: copied ? `${GOLD}20` : SURFACE_2, color: copied ? GOLD : TEXT_SEC }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy script'}
          </button>
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Side Guard', value: cut.barberScript.sideGuard },
            { label: 'Fade Type', value: cut.barberScript.fadeType },
            { label: 'Top Length', value: cut.barberScript.topLength },
            { label: 'Blend Style', value: cut.barberScript.blendStyle },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3" style={{ background: SURFACE_3, border: `1px solid ${BORDER}` }}>
              <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: TEXT_SEC }}>
                {label}
              </p>
              <p className="text-xs font-heading font-semibold" style={{ color: TEXT_PRI }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Styling */}
        <div className="rounded-xl p-3" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}30` }}>
          <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>
            Styling at home
          </p>
          <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_PRI }}>
            {cut.barberScript.styling}
          </p>
        </div>

        {/* Products */}
        {cut.products?.length > 0 && (
          <div className="mt-3">
            <p className="text-[9px] font-body uppercase tracking-widest mb-2" style={{ color: TEXT_SEC }}>
              Products needed
            </p>
            <div className="flex flex-wrap gap-2">
              {cut.products.map(p => (
                <span
                  key={p}
                  className="text-[10px] font-body px-2.5 py-1 rounded-full"
                  style={{ background: SURFACE_3, color: TEXT_SEC, border: `1px solid ${BORDER}` }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Recommendation Card ───────────────────────────────────────────────────────
function CutCard({ cut, rank, saved, onSave, onScript, delay = 0 }) {
  const mainColor = MAINTENANCE_COLORS[cut.maintenance] ?? GOLD
  const mainLabel = MAINTENANCE_LABELS[cut.maintenance] ?? ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl overflow-hidden"
      style={{ background: SURFACE_2, border: `1px solid ${rank === 0 ? GOLD + '60' : BORDER}` }}
    >
      {/* Top bar */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: rank === 0 ? `${GOLD}12` : SURFACE_3, borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2">
          {rank === 0 && (
            <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: GOLD, color: '#0A0A0A' }}>
              Best Match
            </span>
          )}
          <span className="text-[10px] font-body" style={{ color: TEXT_SEC }}>
            #{rank + 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Match score */}
          <span className="text-xs font-mono font-bold" style={{ color: GOLD }}>
            {cut.matchScore}% match
          </span>
          {/* Save */}
          <button
            onClick={() => onSave(cut.id)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: saved ? `${GOLD}20` : SURFACE_2 }}
          >
            {saved
              ? <Star size={13} style={{ color: GOLD }} fill={GOLD} />
              : <StarOff size={13} style={{ color: TEXT_SEC }} />
            }
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="font-heading font-bold text-base" style={{ color: TEXT_PRI }}>{cut.name}</h3>
            <p className="text-xs font-body" style={{ color: TEXT_SEC }}>{cut.vibe}</p>
          </div>
          {/* Maintenance badge */}
          <span
            className="text-[9px] font-heading font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0"
            style={{ background: `${mainColor}18`, color: mainColor, border: `1px solid ${mainColor}30` }}
          >
            {mainLabel}
          </span>
        </div>

        {/* Why it fits */}
        <div className="mt-3 px-3 py-2.5 rounded-xl" style={{ background: SURFACE_3 }}>
          <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>
            Why it fits you
          </p>
          <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_PRI }}>
            {cut.why}
          </p>
        </div>

        {/* Notes from modifiers */}
        {(cut.hairlineNote || cut.densityNote) && (
          <div className="mt-2 px-3 py-2 rounded-xl" style={{ background: '#E07A5F15', border: '1px solid #E07A5F30' }}>
            <p className="text-xs font-body leading-relaxed" style={{ color: '#E07A5F' }}>
              {cut.hairlineNote || cut.densityNote}
            </p>
          </div>
        )}

        {/* Barber script CTA */}
        <button
          onClick={() => onScript(cut)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-heading font-semibold text-sm transition-all active:scale-98"
          style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}
        >
          <Scissors size={14} />
          View Barber Script
        </button>
      </div>
    </motion.div>
  )
}

// ─── AI Simulator Section (premium gate) ──────────────────────────────────────
function AISimulatorSection({ isPremium, onUpgrade }) {
  return (
    <div className="mt-6 mb-2">
      <div className="relative rounded-2xl overflow-hidden" style={{ border: `1px solid ${GOLD}40` }}>
        {/* Blurred preview content */}
        <div className="px-4 py-5" style={{ filter: isPremium ? 'none' : 'blur(6px)', background: SURFACE_2 }}>
          <p className="font-heading font-bold text-base mb-1" style={{ color: TEXT_PRI }}>AI Haircut Simulator</p>
          <p className="text-xs font-body" style={{ color: TEXT_SEC }}>Upload a photo. See exactly how each cut looks on your face before you sit in the chair.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {['Textured Crop', 'Taper Quiff', 'Curtains'].map(name => (
              <div key={name} className="h-20 rounded-xl" style={{ background: SURFACE_3 }} />
            ))}
          </div>
        </div>

        {/* Lock overlay for free users */}
        {!isPremium && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(20,20,20,0.75)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}` }}>
              <Lock size={18} style={{ color: GOLD }} />
            </div>
            <p className="font-heading font-bold text-sm mb-1" style={{ color: TEXT_PRI }}>AI Simulator</p>
            <p className="text-[11px] font-body mb-4 text-center px-6" style={{ color: TEXT_SEC }}>
              See the cut on your actual face before committing.
            </p>
            <button
              onClick={onUpgrade}
              className="px-5 py-2 rounded-xl font-heading font-bold text-sm"
              style={{ background: GOLD, color: '#0A0A0A' }}
            >
              Unlock with Premium
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Results view ──────────────────────────────────────────────────────────────
function ResultsView({ faceShape, density, hairline, savedCuts, onSave, isPremium, onUpgrade, onReset }) {
  const [scriptCut, setScriptCut] = useState(null)
  const profile = FACE_PROFILES[faceShape]
  const recommendations = getModifiedRecommendations(faceShape, hairline, density)
  const faceLabel = FACE_SHAPES.find(s => s.id === faceShape)?.label ?? faceShape

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-body uppercase tracking-widest mb-0.5" style={{ color: GOLD_DIM }}>
            {faceLabel} Face
          </p>
          <h2 className="font-heading font-bold text-xl" style={{ color: TEXT_PRI }}>Your Cuts</h2>
        </div>
        <button
          onClick={onReset}
          className="text-xs font-heading font-semibold px-3 py-1.5 rounded-xl"
          style={{ background: SURFACE_2, color: TEXT_SEC, border: `1px solid ${BORDER}` }}
        >
          Start over
        </button>
      </div>

      {/* Shape summary */}
      <div
        className="rounded-xl px-4 py-3 mb-5"
        style={{ background: SURFACE_2, borderLeft: `3px solid ${GOLD}` }}
      >
        <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_SEC }}>
          {profile.summary}
        </p>
      </div>

      {/* Avoid section */}
      <div className="mb-5 rounded-xl px-4 py-3" style={{ background: '#E07A5F10', border: '1px solid #E07A5F25' }}>
        <p className="text-[9px] font-body uppercase tracking-widest mb-2" style={{ color: '#E07A5F' }}>
          What to avoid — and why
        </p>
        <p className="text-[11px] font-body leading-relaxed mb-2" style={{ color: '#E07A5F90' }}>
          {profile.avoid.reason}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {profile.avoid.cuts.map(cut => (
            <span
              key={cut}
              className="text-[10px] font-body px-2 py-0.5 rounded-full"
              style={{ background: '#E07A5F18', color: '#E07A5F', border: '1px solid #E07A5F25' }}
            >
              {cut}
            </span>
          ))}
        </div>
      </div>

      {/* Cut cards */}
      <div className="space-y-4">
        {recommendations.map((cut, i) => (
          <CutCard
            key={cut.id}
            cut={cut}
            rank={i}
            saved={savedCuts.includes(cut.id)}
            onSave={onSave}
            onScript={setScriptCut}
            delay={i * 0.07}
          />
        ))}
      </div>

      {/* AI Simulator */}
      <AISimulatorSection isPremium={isPremium} onUpgrade={onUpgrade} />

      {/* Saved cuts */}
      {savedCuts.length > 0 && (
        <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}>
          <p className="text-[9px] font-body uppercase tracking-widest mb-2" style={{ color: TEXT_SEC }}>
            Saved ({savedCuts.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {savedCuts.map(id => {
              const rec = recommendations.find(r => r.id === id)
              return rec ? (
                <span
                  key={id}
                  className="text-[10px] font-body px-2.5 py-1 rounded-full"
                  style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}
                >
                  {rec.name}
                </span>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Barber script modal */}
      <AnimatePresence>
        {scriptCut && (
          <BarberScriptModal cut={scriptCut} onClose={() => setScriptCut(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HairMaxx() {
  const navigate = useNavigate()
  const { isPremium } = useStore()

  const [step, setStep] = useState(0)
  const [faceShape, setFaceShape] = useState(null)
  const [density, setDensity] = useState(null)
  const [hairline, setHairline] = useState(null)
  const [savedCuts, setSavedCuts] = useState([])

  const canNext0 = !!faceShape
  const canNext1 = !!density && !!hairline

  function handleNext() {
    if (step === 0 && canNext0) setStep(1)
    else if (step === 1 && canNext1) setStep(2)
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1)
    else navigate(-1)
  }

  function handleReset() {
    setStep(0)
    setFaceShape(null)
    setDensity(null)
    setHairline(null)
  }

  function toggleSave(id) {
    setSavedCuts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen" style={{ background: SURFACE }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-4 pt-12 pb-4"
        style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}` }}
      >
        <button onClick={handleBack} className="p-2 -ml-2 rounded-xl" style={{ color: TEXT_SEC }}>
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <p className="font-heading font-bold text-base" style={{ color: TEXT_PRI }}>HairMaxx</p>
          <p className="text-[9px] font-body uppercase tracking-widest" style={{ color: GOLD_DIM }}>
            Haircut Intelligence
          </p>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-6 pb-32">
        {/* Step bar */}
        {step < 2 && <StepBar step={step} />}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <FaceShapeSelector selected={faceShape} onSelect={setFaceShape} />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <HairDetailsSelector
                density={density}
                hairline={hairline}
                onDensity={setDensity}
                onHairline={setHairline}
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ResultsView
                faceShape={faceShape}
                density={density}
                hairline={hairline}
                savedCuts={savedCuts}
                onSave={toggleSave}
                isPremium={isPremium}
                onUpgrade={() => navigate('/premium')}
                onReset={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Next / Get Results CTA */}
      {step < 2 && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4"
          style={{ background: `linear-gradient(to top, ${SURFACE} 60%, transparent)` }}
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleNext}
            disabled={step === 0 ? !canNext0 : !canNext1}
            className="w-full py-4 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: (step === 0 ? canNext0 : canNext1) ? GOLD : SURFACE_3,
              color: (step === 0 ? canNext0 : canNext1) ? '#0A0A0A' : TEXT_SEC,
            }}
          >
            {step === 1 ? (
              <>
                <Scissors size={16} />
                Get My Cuts
              </>
            ) : (
              <>
                Next
                <ChevronRight size={16} />
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  )
}
