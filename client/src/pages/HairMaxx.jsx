import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, X, Lock, Copy, Check,
  Scissors, Star, StarOff, Camera, Upload, Loader2,
  Sparkles, RotateCcw,
} from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import {
  FACE_SHAPES,
  HAIR_DENSITIES,
  HAIRLINES,
  FACE_PROFILES,
  getModifiedRecommendations,
  MAINTENANCE_COLORS,
  MAINTENANCE_LABELS,
} from '../utils/haircuts'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GOLD      = '#C9A84C'
const GOLD_DIM  = '#8C7035'
const SURFACE   = '#141414'
const SURFACE_2 = '#1C1C1C'
const SURFACE_3 = '#242424'
const BORDER    = '#2A2A2A'
const TEXT_PRI  = '#F0EDE6'
const TEXT_SEC  = '#7A7772'
const RED       = '#E07A5F'

// ─── Helpers ───────────────────────────────────────────────────────────────────
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result // data:image/jpeg;base64,...
      const base64 = result.split(',')[1]
      resolve({ base64, mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Step bar (manual flow) ────────────────────────────────────────────────────
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
            <span className="text-[9px] font-body whitespace-nowrap" style={{ color: i <= step ? GOLD : TEXT_SEC }}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex-1 h-px mb-4" style={{ background: i < step ? GOLD : BORDER }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Mode selector (entry) ────────────────────────────────────────────────────
function ModeSelector({ onAI, onManual }) {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="mb-2">
        <h2 className="font-heading font-bold text-xl mb-1" style={{ color: TEXT_PRI }}>
          How do you want to start?
        </h2>
        <p className="text-sm font-body" style={{ color: TEXT_SEC }}>
          AI Scan gives you instant, personalized results from a photo.
        </p>
      </div>

      {/* AI Scan option */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onAI}
        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left"
        style={{ background: `${GOLD}12`, border: `1.5px solid ${GOLD}50` }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${GOLD}20` }}
        >
          <Sparkles size={22} style={{ color: GOLD }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-heading font-bold text-[15px]" style={{ color: TEXT_PRI }}>AI Head Shape Scan</p>
            <span
              className="text-[9px] font-heading font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
              style={{ background: GOLD, color: '#0A0A0A' }}
            >
              NEW
            </span>
          </div>
          <p className="text-xs font-body" style={{ color: TEXT_SEC }}>
            Take or upload a photo — AI detects your head shape and picks your best cuts
          </p>
        </div>
        <ChevronRight size={18} style={{ color: GOLD }} />
      </motion.button>

      {/* Manual option */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onManual}
        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left"
        style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: SURFACE_3 }}>
          <Scissors size={22} style={{ color: TEXT_SEC }} />
        </div>
        <div className="flex-1">
          <p className="font-heading font-bold text-[15px] mb-0.5" style={{ color: TEXT_PRI }}>Select Manually</p>
          <p className="text-xs font-body" style={{ color: TEXT_SEC }}>Choose your face shape and hair details yourself</p>
        </div>
        <ChevronRight size={18} style={{ color: TEXT_SEC }} />
      </motion.button>
    </div>
  )
}

// ─── Photo Capture ─────────────────────────────────────────────────────────────
function PhotoCapture({ onPhoto, onBack }) {
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const cameraRef = useRef(null)
  const uploadRef = useRef(null)

  function handleFile(f) {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading font-bold text-xl mb-1" style={{ color: TEXT_PRI }}>
          Take or upload a photo
        </h2>
        <p className="text-sm font-body leading-relaxed" style={{ color: TEXT_SEC }}>
          Face forward, pull hair back if possible, good lighting.
        </p>
      </div>

      {/* Preview */}
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1' }}>
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          <button
            onClick={() => { setPreview(null); setFile(null) }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
          >
            <X size={14} style={{ color: '#fff' }} />
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl flex flex-col items-center justify-center gap-3 py-10"
          style={{ background: SURFACE_2, border: `1.5px dashed ${BORDER}` }}
        >
          <Camera size={32} style={{ color: TEXT_SEC }} />
          <p className="text-xs font-body" style={{ color: TEXT_SEC }}>No photo selected</p>
        </div>
      )}

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-heading font-semibold text-sm"
          style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: TEXT_PRI }}
        >
          <Camera size={16} style={{ color: GOLD }} />
          Camera
        </button>
        <button
          onClick={() => uploadRef.current?.click()}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-heading font-semibold text-sm"
          style={{ background: SURFACE_2, border: `1px solid ${BORDER}`, color: TEXT_PRI }}
        >
          <Upload size={16} style={{ color: GOLD }} />
          Upload
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />

      {/* Tip */}
      <div className="px-4 py-3 rounded-xl" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}25` }}>
        <p className="text-xs font-body leading-relaxed" style={{ color: GOLD_DIM }}>
          💡 Tips for best results: good front-facing lighting, hair pulled back from forehead, neutral expression
        </p>
      </div>

      {/* Analyze CTA */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => onPhoto(file)}
        disabled={!file}
        className="w-full py-4 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2"
        style={{
          background: file ? GOLD : SURFACE_3,
          color: file ? '#0A0A0A' : TEXT_SEC,
        }}
      >
        <Sparkles size={16} />
        Analyze My Head Shape
      </motion.button>
    </div>
  )
}

// ─── AI Loading ────────────────────────────────────────────────────────────────
function AILoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}
      >
        <Loader2 size={28} style={{ color: GOLD }} className="animate-spin" />
      </div>
      <div className="text-center">
        <p className="font-heading font-bold text-base mb-1" style={{ color: TEXT_PRI }}>Analyzing your head shape…</p>
        <p className="text-xs font-body" style={{ color: TEXT_SEC }}>This takes about 10–15 seconds</p>
      </div>
    </div>
  )
}

// ─── AI Results ────────────────────────────────────────────────────────────────
function AIResults({ result, isPremium, onUpgrade, onRescan }) {
  const [copiedIdx, setCopiedIdx] = useState(null)

  function copyScript(text, idx) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const shapeLabel = capitalize(result.headShape) + ' Head Shape'
  const hairTypeLabel = capitalize(result.hairType)

  return (
    <div className="space-y-5">
      {/* Head shape hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-5"
        style={{ background: `${GOLD}10`, border: `1.5px solid ${GOLD}40` }}
      >
        <p className="text-[10px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>AI Detected</p>
        <h2 className="font-heading font-bold text-2xl mb-2" style={{ color: GOLD }}>{shapeLabel}</h2>
        <p className="text-sm font-body leading-relaxed" style={{ color: TEXT_PRI }}>{result.headShapeDescription}</p>
      </motion.div>

      {/* Hair type */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: SURFACE_3 }}>
          <Scissors size={15} style={{ color: GOLD }} />
        </div>
        <div>
          <p className="text-[10px] font-body uppercase tracking-widest" style={{ color: TEXT_SEC }}>Hair Type Detected</p>
          <p className="font-heading font-bold text-sm" style={{ color: TEXT_PRI }}>{hairTypeLabel}</p>
        </div>
      </motion.div>

      {/* Top 3 haircuts */}
      <div>
        <p className="text-[10px] font-body uppercase tracking-widest mb-3" style={{ color: TEXT_SEC }}>
          Top 3 Haircuts for Your Shape
        </p>

        <div className="relative">
          {/* Recommendations */}
          <div className="space-y-4" style={{ filter: isPremium ? 'none' : undefined }}>
            {result.recommendations?.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: isPremium ? 1 : i === 0 ? 1 : 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: SURFACE_2,
                  border: `1px solid ${i === 0 ? GOLD + '60' : BORDER}`,
                  filter: !isPremium && i > 0 ? 'blur(5px)' : 'none',
                  userSelect: !isPremium && i > 0 ? 'none' : 'auto',
                }}
              >
                {/* Top bar */}
                <div
                  className="px-4 py-3 flex items-center gap-2"
                  style={{ background: i === 0 ? `${GOLD}12` : SURFACE_3, borderBottom: `1px solid ${BORDER}` }}
                >
                  {i === 0 && (
                    <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: GOLD, color: '#0A0A0A' }}>
                      Best Match
                    </span>
                  )}
                  <span className="text-[10px] font-body" style={{ color: TEXT_SEC }}>#{i + 1}</span>
                </div>

                <div className="px-4 py-4 space-y-3">
                  <h3 className="font-heading font-bold text-base" style={{ color: TEXT_PRI }}>{rec.name}</h3>

                  {/* Why it works */}
                  <div className="px-3 py-2.5 rounded-xl" style={{ background: SURFACE_3 }}>
                    <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>Why it works</p>
                    <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_PRI }}>{rec.whyItWorks}</p>
                  </div>

                  {/* How to ask */}
                  <div className="px-3 py-2.5 rounded-xl" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
                    <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>How to ask at the barber</p>
                    <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_PRI }}>{rec.howToAsk}</p>
                    <button
                      onClick={() => copyScript(rec.howToAsk, i)}
                      className="mt-2 flex items-center gap-1.5 text-[10px] font-heading font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ background: copiedIdx === i ? `${GOLD}20` : SURFACE_3, color: copiedIdx === i ? GOLD : TEXT_SEC }}
                    >
                      {copiedIdx === i ? <Check size={11} /> : <Copy size={11} />}
                      {copiedIdx === i ? 'Copied' : 'Copy script'}
                    </button>
                  </div>

                  {/* Avoid */}
                  <div className="px-3 py-2 rounded-xl" style={{ background: `${RED}10`, border: `1px solid ${RED}25` }}>
                    <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: RED }}>Avoid with this cut</p>
                    <p className="text-xs font-body leading-relaxed" style={{ color: `${RED}CC` }}>{rec.avoid}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pro lock overlay for cuts 2 & 3 */}
          {!isPremium && (
            <div
              className="absolute inset-x-0 flex flex-col items-center justify-end pb-4"
              style={{ top: '38%', background: 'linear-gradient(to bottom, transparent 0%, #141414 35%)' }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}` }}
              >
                <Lock size={20} style={{ color: GOLD }} />
              </div>
              <p className="font-heading font-bold text-sm mb-1" style={{ color: TEXT_PRI }}>Unlock All Recommendations</p>
              <p className="text-xs font-body mb-4 text-center px-8" style={{ color: TEXT_SEC }}>
                See all 3 haircuts with barber scripts
              </p>
              <button
                onClick={onUpgrade}
                className="px-6 py-2.5 rounded-xl font-heading font-bold text-sm"
                style={{ background: GOLD, color: '#0A0A0A' }}
              >
                Upgrade to Pro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* What to avoid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl px-4 py-4"
        style={{ background: `${RED}10`, border: `1px solid ${RED}25` }}
      >
        <p className="text-[9px] font-body uppercase tracking-widest mb-2" style={{ color: RED }}>
          What to avoid — and why
        </p>
        <p className="text-xs font-body leading-relaxed" style={{ color: `${RED}CC` }}>
          {result.whatToAvoid}
        </p>
      </motion.div>

      {/* Rescan */}
      <button
        onClick={onRescan}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-heading font-semibold text-sm"
        style={{ background: SURFACE_2, color: TEXT_SEC, border: `1px solid ${BORDER}` }}
      >
        <RotateCcw size={14} />
        Scan Again
      </button>
    </div>
  )
}

// ─── Existing manual flow components (unchanged) ───────────────────────────────
function FaceShapeSelector({ selected, onSelect }) {
  return (
    <div>
      <h2 className="font-heading font-bold text-xl mb-1" style={{ color: TEXT_PRI }}>Select your face shape</h2>
      <p className="text-sm font-body mb-6" style={{ color: TEXT_SEC }}>The foundation of every good cut.</p>
      <div className="grid grid-cols-3 gap-3">
        {FACE_SHAPES.map(shape => {
          const isActive = selected === shape.id
          return (
            <motion.button
              key={shape.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(shape.id)}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-200"
              style={{ background: isActive ? `${GOLD}15` : SURFACE_2, borderColor: isActive ? GOLD : BORDER }}
            >
              <svg viewBox="0 0 100 100" width={52} height={52}>
                <path
                  d={shape.svgPath}
                  fill={isActive ? `${GOLD}25` : `${TEXT_SEC}15`}
                  stroke={isActive ? GOLD : TEXT_SEC}
                  strokeWidth="2"
                />
              </svg>
              <span className="text-xs font-heading font-semibold" style={{ color: isActive ? GOLD : TEXT_PRI }}>
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

function HairDetailsSelector({ density, hairline, onDensity, onHairline }) {
  return (
    <div>
      <h2 className="font-heading font-bold text-xl mb-1" style={{ color: TEXT_PRI }}>Hair details</h2>
      <p className="text-sm font-body mb-6" style={{ color: TEXT_SEC }}>For precise recommendations.</p>
      <div className="mb-6">
        <p className="text-xs font-heading font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_SEC }}>Hair Density</p>
        <div className="grid grid-cols-3 gap-3">
          {HAIR_DENSITIES.map(d => {
            const isActive = density === d.id
            return (
              <button key={d.id} onClick={() => onDensity(d.id)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl border transition-all"
                style={{ background: isActive ? `${GOLD}15` : SURFACE_2, borderColor: isActive ? GOLD : BORDER }}
              >
                <span className="text-sm font-heading font-bold" style={{ color: isActive ? GOLD : TEXT_PRI }}>{d.label}</span>
                <span className="text-[10px] font-body" style={{ color: TEXT_SEC }}>{d.sub}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-heading font-semibold uppercase tracking-widest mb-3" style={{ color: TEXT_SEC }}>Hairline</p>
        <div className="grid grid-cols-2 gap-3">
          {HAIRLINES.map(h => {
            const isActive = hairline === h.id
            return (
              <button key={h.id} onClick={() => onHairline(h.id)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl border transition-all"
                style={{ background: isActive ? `${GOLD}15` : SURFACE_2, borderColor: isActive ? GOLD : BORDER }}
              >
                <span className="text-sm font-heading font-bold" style={{ color: isActive ? GOLD : TEXT_PRI }}>{h.label}</span>
                <span className="text-[10px] font-body" style={{ color: TEXT_SEC }}>{h.sub}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BarberScriptModal({ cut, onClose }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(cut.barberScript.say.replace(/"/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl p-6"
        style={{ background: SURFACE_2 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: BORDER }} />
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>Barber Script</p>
            <h3 className="font-heading font-bold text-lg" style={{ color: TEXT_PRI }}>{cut.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: SURFACE_3 }}>
            <X size={16} style={{ color: TEXT_SEC }} />
          </button>
        </div>
        <div className="rounded-2xl p-4 mb-4" style={{ background: SURFACE_3, border: `1px solid ${BORDER}` }}>
          <p className="text-[10px] font-body uppercase tracking-widest mb-2" style={{ color: TEXT_SEC }}>Say exactly this:</p>
          <p className="text-sm font-body leading-relaxed" style={{ color: TEXT_PRI }}>{cut.barberScript.say}</p>
          <button onClick={handleCopy} className="mt-3 flex items-center gap-2 text-xs font-heading font-semibold px-3 py-2 rounded-xl transition-all"
            style={{ background: copied ? `${GOLD}20` : SURFACE_2, color: copied ? GOLD : TEXT_SEC }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy script'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Side Guard', value: cut.barberScript.sideGuard },
            { label: 'Fade Type', value: cut.barberScript.fadeType },
            { label: 'Top Length', value: cut.barberScript.topLength },
            { label: 'Blend Style', value: cut.barberScript.blendStyle },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3" style={{ background: SURFACE_3, border: `1px solid ${BORDER}` }}>
              <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: TEXT_SEC }}>{label}</p>
              <p className="text-xs font-heading font-semibold" style={{ color: TEXT_PRI }}>{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}30` }}>
          <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>Styling at home</p>
          <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_PRI }}>{cut.barberScript.styling}</p>
        </div>
        {cut.products?.length > 0 && (
          <div className="mt-3">
            <p className="text-[9px] font-body uppercase tracking-widest mb-2" style={{ color: TEXT_SEC }}>Products needed</p>
            <div className="flex flex-wrap gap-2">
              {cut.products.map(p => (
                <span key={p} className="text-[10px] font-body px-2.5 py-1 rounded-full"
                  style={{ background: SURFACE_3, color: TEXT_SEC, border: `1px solid ${BORDER}` }}>{p}</span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function CutCard({ cut, rank, saved, onSave, onScript, delay = 0 }) {
  const mainColor = MAINTENANCE_COLORS[cut.maintenance] ?? GOLD
  const mainLabel = MAINTENANCE_LABELS[cut.maintenance] ?? ''
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl overflow-hidden"
      style={{ background: SURFACE_2, border: `1px solid ${rank === 0 ? GOLD + '60' : BORDER}` }}
    >
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: rank === 0 ? `${GOLD}12` : SURFACE_3, borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2">
          {rank === 0 && <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: GOLD, color: '#0A0A0A' }}>Best Match</span>}
          <span className="text-[10px] font-body" style={{ color: TEXT_SEC }}>#{rank + 1}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold" style={{ color: GOLD }}>{cut.matchScore}% match</span>
          <button onClick={() => onSave(cut.id)} className="p-1.5 rounded-lg transition-colors"
            style={{ background: saved ? `${GOLD}20` : SURFACE_2 }}>
            {saved ? <Star size={13} style={{ color: GOLD }} fill={GOLD} /> : <StarOff size={13} style={{ color: TEXT_SEC }} />}
          </button>
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="font-heading font-bold text-base" style={{ color: TEXT_PRI }}>{cut.name}</h3>
            <p className="text-xs font-body" style={{ color: TEXT_SEC }}>{cut.vibe}</p>
          </div>
          <span className="text-[9px] font-heading font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0"
            style={{ background: `${mainColor}18`, color: mainColor, border: `1px solid ${mainColor}30` }}>{mainLabel}</span>
        </div>
        <div className="mt-3 px-3 py-2.5 rounded-xl" style={{ background: SURFACE_3 }}>
          <p className="text-[9px] font-body uppercase tracking-widest mb-1" style={{ color: GOLD_DIM }}>Why it fits you</p>
          <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_PRI }}>{cut.why}</p>
        </div>
        {(cut.hairlineNote || cut.densityNote) && (
          <div className="mt-2 px-3 py-2 rounded-xl" style={{ background: `${RED}15`, border: `1px solid ${RED}30` }}>
            <p className="text-xs font-body leading-relaxed" style={{ color: RED }}>{cut.hairlineNote || cut.densityNote}</p>
          </div>
        )}
        <button onClick={() => onScript(cut)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-heading font-semibold text-sm transition-all active:scale-98"
          style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
          <Scissors size={14} />
          View Barber Script
        </button>
      </div>
    </motion.div>
  )
}

function ManualResultsView({ faceShape, density, hairline, savedCuts, onSave, isPremium, onUpgrade, onReset }) {
  const [scriptCut, setScriptCut] = useState(null)
  const profile = FACE_PROFILES[faceShape]
  const recommendations = getModifiedRecommendations(faceShape, hairline, density)
  const faceLabel = FACE_SHAPES.find(s => s.id === faceShape)?.label ?? faceShape
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-body uppercase tracking-widest mb-0.5" style={{ color: GOLD_DIM }}>{faceLabel} Face</p>
          <h2 className="font-heading font-bold text-xl" style={{ color: TEXT_PRI }}>Your Cuts</h2>
        </div>
        <button onClick={onReset} className="text-xs font-heading font-semibold px-3 py-1.5 rounded-xl"
          style={{ background: SURFACE_2, color: TEXT_SEC, border: `1px solid ${BORDER}` }}>Start over</button>
      </div>
      <div className="rounded-xl px-4 py-3 mb-5" style={{ background: SURFACE_2, borderLeft: `3px solid ${GOLD}` }}>
        <p className="text-xs font-body leading-relaxed" style={{ color: TEXT_SEC }}>{profile.summary}</p>
      </div>
      <div className="mb-5 rounded-xl px-4 py-3" style={{ background: `${RED}10`, border: `1px solid ${RED}25` }}>
        <p className="text-[9px] font-body uppercase tracking-widest mb-2" style={{ color: RED }}>What to avoid — and why</p>
        <p className="text-[11px] font-body leading-relaxed mb-2" style={{ color: `${RED}90` }}>{profile.avoid.reason}</p>
        <div className="flex flex-wrap gap-1.5">
          {profile.avoid.cuts.map(cut => (
            <span key={cut} className="text-[10px] font-body px-2 py-0.5 rounded-full"
              style={{ background: `${RED}18`, color: RED, border: `1px solid ${RED}25` }}>{cut}</span>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {recommendations.map((cut, i) => (
          <CutCard key={cut.id} cut={cut} rank={i} saved={savedCuts.includes(cut.id)}
            onSave={onSave} onScript={setScriptCut} delay={i * 0.07} />
        ))}
      </div>
      {savedCuts.length > 0 && (
        <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}>
          <p className="text-[9px] font-body uppercase tracking-widest mb-2" style={{ color: TEXT_SEC }}>Saved ({savedCuts.length})</p>
          <div className="flex flex-wrap gap-2">
            {savedCuts.map(id => {
              const rec = recommendations.find(r => r.id === id)
              return rec ? (
                <span key={id} className="text-[10px] font-body px-2.5 py-1 rounded-full"
                  style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>{rec.name}</span>
              ) : null
            })}
          </div>
        </div>
      )}
      <AnimatePresence>
        {scriptCut && <BarberScriptModal cut={scriptCut} onClose={() => setScriptCut(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HairMaxx() {
  const navigate = useNavigate()
  const { isPremium } = useStore()

  // AI flow state
  const [mode, setMode]         = useState(null) // null | 'ai' | 'manual'
  const [aiStep, setAiStep]     = useState('capture') // 'capture' | 'loading' | 'results'
  const [aiResult, setAiResult] = useState(null)
  const [aiError, setAiError]   = useState(null)

  // Manual flow state
  const [manualStep, setManualStep] = useState(0)
  const [faceShape, setFaceShape]   = useState(null)
  const [density, setDensity]       = useState(null)
  const [hairline, setHairline]     = useState(null)
  const [savedCuts, setSavedCuts]   = useState([])

  const canNext0 = !!faceShape
  const canNext1 = !!density && !!hairline

  async function handlePhotoSubmit(file) {
    if (!file) return
    setAiStep('loading')
    setAiError(null)
    try {
      const { base64, mediaType } = await fileToBase64(file)
      const result = await api.hair.analyze({ imageData: base64, mediaType })
      setAiResult(result)
      setAiStep('results')
    } catch (err) {
      setAiError(err.message || 'Analysis failed. Please try again.')
      setAiStep('capture')
    }
  }

  function handleBack() {
    if (mode === 'ai') {
      if (aiStep === 'results' || aiStep === 'loading') { setAiStep('capture'); setAiResult(null) }
      else { setMode(null) }
    } else if (mode === 'manual') {
      if (manualStep > 0) setManualStep(s => s - 1)
      else setMode(null)
    } else {
      navigate(-1)
    }
  }

  function handleManualNext() {
    if (manualStep === 0 && canNext0) setManualStep(1)
    else if (manualStep === 1 && canNext1) setManualStep(2)
  }

  function resetAll() {
    setMode(null)
    setAiStep('capture')
    setAiResult(null)
    setAiError(null)
    setManualStep(0)
    setFaceShape(null)
    setDensity(null)
    setHairline(null)
  }

  function toggleSave(id) {
    setSavedCuts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="min-h-screen" style={{ background: SURFACE }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 pt-12 pb-4"
        style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={handleBack} className="p-2 -ml-2 rounded-xl" style={{ color: TEXT_SEC }}>
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <p className="font-heading font-bold text-base" style={{ color: TEXT_PRI }}>HairMaxx</p>
          <p className="text-[9px] font-body uppercase tracking-widest" style={{ color: GOLD_DIM }}>Haircut Intelligence</p>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-6 pb-32">
        {/* Manual flow step bar */}
        {mode === 'manual' && manualStep < 2 && <StepBar step={manualStep} />}

        <AnimatePresence mode="wait">

          {/* ── Mode selector ── */}
          {mode === null && (
            <motion.div key="mode" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <ModeSelector onAI={() => setMode('ai')} onManual={() => setMode('manual')} />
            </motion.div>
          )}

          {/* ── AI: Photo Capture ── */}
          {mode === 'ai' && aiStep === 'capture' && (
            <motion.div key="ai-capture" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              {aiError && (
                <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: `${RED}10`, border: `1px solid ${RED}30` }}>
                  <p className="text-xs font-body" style={{ color: RED }}>{aiError}</p>
                </div>
              )}
              <PhotoCapture onPhoto={handlePhotoSubmit} onBack={() => setMode(null)} />
            </motion.div>
          )}

          {/* ── AI: Loading ── */}
          {mode === 'ai' && aiStep === 'loading' && (
            <motion.div key="ai-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AILoading />
            </motion.div>
          )}

          {/* ── AI: Results ── */}
          {mode === 'ai' && aiStep === 'results' && aiResult && (
            <motion.div key="ai-results" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <AIResults
                result={aiResult}
                isPremium={isPremium}
                onUpgrade={() => navigate('/premium')}
                onRescan={() => { setAiStep('capture'); setAiResult(null) }}
              />
            </motion.div>
          )}

          {/* ── Manual: Face Shape ── */}
          {mode === 'manual' && manualStep === 0 && (
            <motion.div key="manual-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <FaceShapeSelector selected={faceShape} onSelect={setFaceShape} />
            </motion.div>
          )}

          {/* ── Manual: Hair Details ── */}
          {mode === 'manual' && manualStep === 1 && (
            <motion.div key="manual-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <HairDetailsSelector density={density} hairline={hairline} onDensity={setDensity} onHairline={setHairline} />
            </motion.div>
          )}

          {/* ── Manual: Results ── */}
          {mode === 'manual' && manualStep === 2 && (
            <motion.div key="manual-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <ManualResultsView
                faceShape={faceShape} density={density} hairline={hairline}
                savedCuts={savedCuts} onSave={toggleSave}
                isPremium={isPremium} onUpgrade={() => navigate('/premium')}
                onReset={resetAll}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Manual flow next button */}
      {mode === 'manual' && manualStep < 2 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4"
          style={{ background: `linear-gradient(to top, ${SURFACE} 60%, transparent)` }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleManualNext}
            disabled={manualStep === 0 ? !canNext0 : !canNext1}
            className="w-full py-4 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: (manualStep === 0 ? canNext0 : canNext1) ? GOLD : SURFACE_3,
              color: (manualStep === 0 ? canNext0 : canNext1) ? '#0A0A0A' : TEXT_SEC,
            }}
          >
            {manualStep === 1 ? <><Scissors size={16} />Get My Cuts</> : <>Next<ChevronRight size={16} /></>}
          </motion.button>
        </div>
      )}
    </div>
  )
}
