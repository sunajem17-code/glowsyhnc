import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, X, Lock, Copy, Check,
  Scissors, Star, StarOff, Camera, Upload, Loader2,
  Sparkles, RotateCcw, Zap,
} from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'
import { takePhoto, pickPhoto, isNative } from '../utils/camera'
import {
  FACE_SHAPES,
  HAIR_DENSITIES,
  HAIRLINES,
  FACE_PROFILES,
  getModifiedRecommendations,
  MAINTENANCE_COLORS,
  MAINTENANCE_LABELS,
} from '../utils/haircuts'
import { GOLD, GOLD_GRADIENT, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const RED = '#E07A5F'

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = result.split(',')[1]
      resolve({ base64, mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Mode selector ─────────────────────────────────────────────────────────────
function ModeSelector({ onAI, onManual }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="rounded-3xl overflow-hidden relative"
        style={{ background: 'rgba(198,168,92,0.07)', border: '1.5px solid rgba(198,168,92,0.2)' }}
      >
        {/* Grid texture */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(rgba(198,168,92,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(198,168,92,0.04) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }} />
        <div className="relative px-5 pt-6 pb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-body text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(198,168,92,0.6)' }}>AI-Powered</p>
              <h2 className="font-heading font-bold text-[26px] text-primary leading-tight" style={{ letterSpacing: '-0.02em' }}>HairMaxx</h2>
              <p className="font-body text-[13px] text-secondary mt-1">Find your perfect cut based on your head shape</p>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(198,168,92,0.15)', border: '1px solid rgba(198,168,92,0.3)' }}>
              <Scissors size={26} style={{ color: GOLD }} />
            </div>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: '12+', label: 'Cut Styles' },
              { value: '6', label: 'Head Shapes' },
              { value: 'AI', label: 'Powered' },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-xl px-3 py-2.5 text-center"
                style={{ background: 'rgba(0,0,0,0.25)' }}>
                <p className="font-heading font-bold text-[16px]" style={{ color: GOLD }}>{value}</p>
                <p className="font-body text-[10px] text-secondary">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Section label */}
      <div>
        <p className="font-body text-[10px] uppercase tracking-widest text-secondary mb-3">Choose how to start</p>

        {/* AI scan — primary */}
        <motion.button
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { triggerHaptic(); onAI() }}
          className="w-full flex items-center gap-4 p-5 rounded-2xl text-left mb-3"
          style={{ background: GOLD_GRADIENT, boxShadow: '0 4px 24px rgba(198,168,92,0.28)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,0,0,0.2)' }}>
            <Sparkles size={20} color="#0A0A0A" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-heading font-bold text-[15px]" style={{ color: '#0A0A0A' }}>AI Head Shape Scan</p>
              <span className="text-[8px] font-heading font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: 'rgba(0,0,0,0.2)', color: '#0A0A0A' }}>NEW</span>
            </div>
            <p className="font-body text-[12px]" style={{ color: 'rgba(0,0,0,0.6)' }}>Photo scan → instant personalized cuts</p>
          </div>
          <ChevronRight size={18} style={{ color: 'rgba(0,0,0,0.5)' }} />
        </motion.button>

        {/* Manual — secondary */}
        <motion.button
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { triggerHaptic(); onManual() }}
          className="w-full flex items-center gap-4 p-5 rounded-2xl text-left"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)' }}>
            <Scissors size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-[15px] text-primary mb-0.5">Select Manually</p>
            <p className="font-body text-[12px] text-secondary">Choose your face shape yourself</p>
          </div>
          <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.25)' }} />
        </motion.button>
      </div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}
        className="rounded-2xl px-5 py-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="font-body text-[10px] uppercase tracking-widest text-secondary mb-3">How it works</p>
        <div className="flex flex-col gap-3">
          {[
            { n: '1', text: 'Take or upload a front-facing photo' },
            { n: '2', text: 'AI detects your head shape instantly' },
            { n: '3', text: 'Get your top haircuts + barber scripts' },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-heading font-bold text-[11px]"
                style={{ background: 'rgba(198,168,92,0.15)', color: GOLD }}>
                {n}
              </div>
              <p className="font-body text-[13px] text-primary">{text}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Photo Capture ─────────────────────────────────────────────────────────────
function PhotoCapture({ onPhoto, error }) {
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const uploadRef = useRef(null)

  function handleFile(f) {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleCamera() {
    if (isNative()) {
      try { const d = await takePhoto(); if (d) { setPreview(d); setFile(d) } } catch {}
    } else { uploadRef.current?.click() }
  }

  async function handleUpload() {
    if (isNative()) {
      try { const d = await pickPhoto(); if (d) { setPreview(d); setFile(d) } } catch {}
    } else { uploadRef.current?.click() }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-bold text-[22px] text-primary mb-1">Take a photo</h2>
        <p className="font-body text-[13px] text-secondary">Face forward, good lighting, hair visible.</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl" style={{ background: `${RED}12`, border: `1px solid ${RED}30` }}>
          <p className="font-body text-[12px]" style={{ color: RED }}>{error}</p>
        </div>
      )}

      {/* Photo area */}
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '4/5' }}>
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.7))' }} />
          <button
            onClick={() => { triggerHaptic(); setPreview(null); setFile(null) }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          >
            <X size={16} color="#fff" />
          </button>
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: GOLD }}>
              <Check size={12} color="#0A0A0A" />
            </div>
            <p className="font-heading font-semibold text-[13px] text-white">Photo ready</p>
          </div>
        </div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { triggerHaptic(); handleCamera() }}
          className="w-full flex flex-col items-center justify-center gap-4 rounded-2xl"
          style={{ aspectRatio: '4/5', background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)' }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}>
            <Camera size={28} style={{ color: GOLD }} />
          </div>
          <div className="text-center px-8">
            <p className="font-heading font-bold text-[15px] text-primary mb-1">Tap to take a photo</p>
            <p className="font-body text-[12px] text-secondary">or use the buttons below to upload</p>
          </div>
        </motion.button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => { triggerHaptic(); handleCamera() }}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-heading font-semibold text-[13px] text-primary"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <Camera size={15} style={{ color: GOLD }} /> Camera
        </button>
        <button onClick={() => { triggerHaptic(); handleUpload() }}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-heading font-semibold text-[13px] text-primary"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <Upload size={15} style={{ color: GOLD }} /> Upload
        </button>
      </div>

      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => { if (file) { triggerHaptic(); onPhoto(file) } }}
        disabled={!file}
        className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
        style={{ background: file ? GOLD_GRADIENT : 'rgba(255,255,255,0.06)', color: file ? '#0A0A0A' : 'rgba(255,255,255,0.2)', boxShadow: file ? '0 4px 20px rgba(198,168,92,0.28)' : 'none' }}
      >
        <Sparkles size={16} /> Analyze My Head Shape
      </motion.button>
    </div>
  )
}

// ─── AI Loading ────────────────────────────────────────────────────────────────
function AILoading() {
  const steps = ['Reading head shape…', 'Matching cut styles…', 'Building your results…']
  const [idx, setIdx] = useState(0)
  useState(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % steps.length), 1600)
    return () => clearInterval(id)
  })

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(198,168,92,0.1)', border: '1.5px solid rgba(198,168,92,0.25)' }}>
          <Scissors size={32} style={{ color: GOLD }} />
        </div>
        <motion.div
          className="absolute -inset-2 rounded-3xl"
          style={{ border: `1.5px solid ${GOLD}`, opacity: 0.4 }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="text-center">
        <p className="font-heading font-bold text-[18px] text-primary mb-2">Analyzing…</p>
        <AnimatePresence mode="wait">
          <motion.p key={idx}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="font-body text-[13px] text-secondary">
            {steps[idx]}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background: GOLD }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── AI Results ────────────────────────────────────────────────────────────────
function AIResults({ result, isPremium, onUpgrade, onRescan }) {
  const [copiedIdx, setCopiedIdx] = useState(null)

  function copyScript(text, idx) {
    triggerHaptic()
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Head shape hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-5 relative overflow-hidden"
        style={{ background: 'rgba(198,168,92,0.08)', border: '1.5px solid rgba(198,168,92,0.3)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(rgba(198,168,92,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(198,168,92,0.03) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="font-body text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(198,168,92,0.6)' }}>AI Detected</p>
            <h2 className="font-heading font-bold text-[22px] mb-2" style={{ color: GOLD }}>{capitalize(result.headShape)} Shape</h2>
            <p className="font-body text-[12px] text-primary leading-relaxed">{result.headShapeDescription}</p>
          </div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(198,168,92,0.15)' }}>
            <Sparkles size={20} style={{ color: GOLD }} />
          </div>
        </div>
      </motion.div>

      {/* Hair type */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(198,168,92,0.1)' }}>
          <Scissors size={16} style={{ color: GOLD }} />
        </div>
        <div>
          <p className="font-body text-[10px] uppercase tracking-widest text-secondary">Detected Hair Type</p>
          <p className="font-heading font-bold text-[14px] text-primary">{capitalize(result.hairType)}</p>
        </div>
      </motion.div>

      {/* Recommendations */}
      <div>
        <p className="font-body text-[10px] uppercase tracking-widest text-secondary mb-3">Top Haircuts for Your Shape</p>
        <div className="relative">
          <div className="space-y-3">
            {result.recommendations?.map((rec, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06 }}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${i === 0 ? 'rgba(198,168,92,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  filter: !isPremium && i > 0 ? 'blur(5px)' : 'none',
                  userSelect: !isPremium && i > 0 ? 'none' : 'auto',
                }}
              >
                <div className="px-4 py-2.5 flex items-center gap-2"
                  style={{ background: i === 0 ? 'rgba(198,168,92,0.08)' : 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {i === 0 && (
                    <span className="text-[9px] font-heading font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: GOLD, color: '#0A0A0A' }}>Best Match</span>
                  )}
                  <span className="font-body text-[10px] text-secondary">#{i + 1}</span>
                </div>
                <div className="px-4 py-4 space-y-3">
                  <h3 className="font-heading font-bold text-[15px] text-primary">{rec.name}</h3>
                  <div className="px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="font-body text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(198,168,92,0.6)' }}>Why it works</p>
                    <p className="font-body text-[12px] text-primary leading-relaxed">{rec.whyItWorks}</p>
                  </div>
                  <div className="px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.18)' }}>
                    <p className="font-body text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(198,168,92,0.6)' }}>Say this at the barber</p>
                    <p className="font-body text-[12px] text-primary leading-relaxed">{rec.howToAsk}</p>
                    <button onClick={() => copyScript(rec.howToAsk, i)}
                      className="mt-2 flex items-center gap-1.5 text-[10px] font-heading font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ background: copiedIdx === i ? 'rgba(198,168,92,0.2)' : 'rgba(255,255,255,0.06)', color: copiedIdx === i ? GOLD : 'rgba(255,255,255,0.4)' }}>
                      {copiedIdx === i ? <Check size={11} /> : <Copy size={11} />}
                      {copiedIdx === i ? 'Copied' : 'Copy script'}
                    </button>
                  </div>
                  <div className="px-3 py-2 rounded-xl"
                    style={{ background: `${RED}0F`, border: `1px solid ${RED}25` }}>
                    <p className="font-body text-[9px] uppercase tracking-widest mb-1" style={{ color: RED }}>Avoid</p>
                    <p className="font-body text-[12px] leading-relaxed" style={{ color: `${RED}CC` }}>{rec.avoid}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {!isPremium && (
            <div className="absolute inset-x-0 flex flex-col items-center justify-end pb-4"
              style={{ top: '38%', background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 35%)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(198,168,92,0.15)', border: `1px solid ${GOLD}` }}>
                <Lock size={20} style={{ color: GOLD }} />
              </div>
              <p className="font-heading font-bold text-[14px] text-primary mb-1">Unlock All Recommendations</p>
              <p className="font-body text-[12px] text-secondary mb-4 text-center px-8">See all 3 haircuts with barber scripts</p>
              <button onClick={() => { triggerHaptic(); onUpgrade() }}
                className="px-6 py-3 rounded-2xl font-heading font-bold text-[14px]"
                style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}>
                Upgrade to Pro
              </button>
            </div>
          )}
        </div>
      </div>

      {result.whatToAvoid && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="rounded-xl px-4 py-4"
          style={{ background: `${RED}0F`, border: `1px solid ${RED}25` }}>
          <p className="font-body text-[9px] uppercase tracking-widest mb-2" style={{ color: RED }}>What to avoid</p>
          <p className="font-body text-[12px] leading-relaxed" style={{ color: `${RED}CC` }}>{result.whatToAvoid}</p>
        </motion.div>
      )}

      <button onClick={() => { triggerHaptic(); onRescan() }}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-heading font-semibold text-[13px]"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <RotateCcw size={14} /> Scan Again
      </button>
    </div>
  )
}

// ─── Manual flow ───────────────────────────────────────────────────────────────
export function FaceShapeSelector({ selected, onSelect }) {
  return (
    <div>
      <h2 className="font-heading font-bold text-[22px] text-primary mb-1">Your face shape</h2>
      <p className="font-body text-[13px] text-secondary mb-5">The foundation of every great cut.</p>
      <div className="grid grid-cols-3 gap-3">
        {FACE_SHAPES.map(shape => {
          const active = selected === shape.id
          return (
            <motion.button key={shape.id} whileTap={{ scale: 0.95 }}
              onClick={() => { triggerHaptic(); onSelect(shape.id) }}
              className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all duration-200"
              style={{
                background: active ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${active ? 'rgba(198,168,92,0.5)' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: active ? '0 0 16px rgba(198,168,92,0.15)' : 'none',
              }}>
              <svg viewBox="0 0 100 100" width={54} height={54}>
                <path d={shape.svgPath}
                  fill={active ? 'rgba(198,168,92,0.2)' : 'rgba(255,255,255,0.05)'}
                  stroke={active ? GOLD : 'rgba(255,255,255,0.25)'}
                  strokeWidth="2.5" />
              </svg>
              <span className="font-heading font-semibold text-[11px]" style={{ color: active ? GOLD : 'rgba(255,255,255,0.6)' }}>
                {shape.label}
              </span>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-4 px-4 py-3 rounded-xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${GOLD}` }}>
            <p className="font-body text-[12px] text-secondary leading-relaxed">
              {FACE_SHAPES.find(s => s.id === selected)?.description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function HairDetailsSelector({ density, hairline, onDensity, onHairline }) {
  return (
    <div>
      <h2 className="font-heading font-bold text-[22px] text-primary mb-1">Hair details</h2>
      <p className="font-body text-[13px] text-secondary mb-5">Helps us give you precise recommendations.</p>
      <div className="mb-6">
        <p className="font-heading font-semibold text-[10px] uppercase tracking-widest text-secondary mb-3">Hair Density</p>
        <div className="grid grid-cols-3 gap-3">
          {HAIR_DENSITIES.map(d => {
            const active = density === d.id
            return (
              <button key={d.id} onClick={() => { triggerHaptic(); onDensity(d.id) }}
                className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl transition-all"
                style={{
                  background: active ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${active ? 'rgba(198,168,92,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: active ? '0 0 16px rgba(198,168,92,0.12)' : 'none',
                }}>
                <span className="font-heading font-bold text-[14px]" style={{ color: active ? GOLD : 'rgba(255,255,255,0.85)' }}>{d.label}</span>
                <span className="font-body text-[10px] text-secondary">{d.sub}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="font-heading font-semibold text-[10px] uppercase tracking-widest text-secondary mb-3">Hairline</p>
        <div className="grid grid-cols-2 gap-3">
          {HAIRLINES.map(h => {
            const active = hairline === h.id
            return (
              <button key={h.id} onClick={() => { triggerHaptic(); onHairline(h.id) }}
                className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl transition-all"
                style={{
                  background: active ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${active ? 'rgba(198,168,92,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: active ? '0 0 16px rgba(198,168,92,0.12)' : 'none',
                }}>
                <span className="font-heading font-bold text-[14px]" style={{ color: active ? GOLD : 'rgba(255,255,255,0.85)' }}>{h.label}</span>
                <span className="font-body text-[10px] text-secondary">{h.sub}</span>
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
    triggerHaptic()
    navigator.clipboard.writeText(cut.barberScript.say.replace(/"/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={SPRING_STANDARD}
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl p-6"
        style={{ background: 'var(--bg)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-body text-[10px] uppercase tracking-widest text-secondary mb-1">Barber Script</p>
            <h3 className="font-heading font-bold text-[18px] text-primary">{cut.name}</h3>
          </div>
          <button onClick={() => { triggerHaptic(); onClose() }}
            className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="font-body text-[10px] uppercase tracking-widest text-secondary mb-2">Say exactly this:</p>
          <p className="font-body text-[13px] text-primary leading-relaxed">{cut.barberScript.say}</p>
          <button onClick={handleCopy}
            className="mt-3 flex items-center gap-2 text-[11px] font-heading font-semibold px-3 py-2 rounded-xl transition-all"
            style={{ background: copied ? 'rgba(198,168,92,0.18)' : 'rgba(255,255,255,0.06)', color: copied ? GOLD : 'rgba(255,255,255,0.4)' }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
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
            <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-body text-[9px] uppercase tracking-widest text-secondary mb-1">{label}</p>
              <p className="font-heading font-semibold text-[12px] text-primary">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.2)' }}>
          <p className="font-body text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(198,168,92,0.6)' }}>Styling at home</p>
          <p className="font-body text-[12px] text-primary leading-relaxed">{cut.barberScript.styling}</p>
        </div>
        {cut.products?.length > 0 && (
          <div>
            <p className="font-body text-[9px] uppercase tracking-widest text-secondary mb-2">Products</p>
            <div className="flex flex-wrap gap-2">
              {cut.products.map(p => (
                <span key={p} className="font-body text-[10px] px-3 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
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

function CutCard({ cut, rank, saved, onSave, onScript, delay = 0 }) {
  const mainColor = MAINTENANCE_COLORS[cut.maintenance] ?? GOLD
  const mainLabel = MAINTENANCE_LABELS[cut.maintenance] ?? ''
  const isBest = rank === 0
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${isBest ? 'rgba(198,168,92,0.4)' : 'rgba(255,255,255,0.08)'}`,
      }}>
      <div className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: isBest ? 'rgba(198,168,92,0.08)' : 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          {isBest && (
            <span className="font-heading font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: GOLD, color: '#0A0A0A' }}>Best Match</span>
          )}
          <span className="font-body text-[10px] text-secondary">#{rank + 1}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-[11px]" style={{ color: GOLD }}>{cut.matchScore}%</span>
          <button onClick={() => { triggerHaptic(); onSave(cut.id) }}
            className="p-1.5 rounded-lg" style={{ background: saved ? 'rgba(198,168,92,0.15)' : 'rgba(255,255,255,0.05)' }}>
            {saved ? <Star size={13} style={{ color: GOLD }} fill={GOLD} /> : <StarOff size={13} style={{ color: 'rgba(255,255,255,0.35)' }} />}
          </button>
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-heading font-bold text-[15px] text-primary">{cut.name}</h3>
            <p className="font-body text-[12px] text-secondary">{cut.vibe}</p>
          </div>
          <span className="font-heading font-semibold text-[9px] px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0"
            style={{ background: `${mainColor}15`, color: mainColor, border: `1px solid ${mainColor}25` }}>
            {mainLabel}
          </span>
        </div>
        <div className="px-3 py-2.5 rounded-xl mb-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="font-body text-[9px] uppercase tracking-widest mb-1" style={{ color: 'rgba(198,168,92,0.6)' }}>Why it fits you</p>
          <p className="font-body text-[12px] text-primary leading-relaxed">{cut.why}</p>
        </div>
        {(cut.hairlineNote || cut.densityNote) && (
          <div className="px-3 py-2 rounded-xl mb-2"
            style={{ background: `${RED}0F`, border: `1px solid ${RED}25` }}>
            <p className="font-body text-[12px] leading-relaxed" style={{ color: RED }}>{cut.hairlineNote || cut.densityNote}</p>
          </div>
        )}
        <button onClick={() => { triggerHaptic(); onScript(cut) }}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-heading font-semibold text-[13px]"
          style={{ background: 'rgba(198,168,92,0.08)', color: GOLD, border: '1px solid rgba(198,168,92,0.25)' }}>
          <Scissors size={14} /> View Barber Script
        </button>
      </div>
    </motion.div>
  )
}

export function ManualResultsView({ faceShape, density, hairline, savedCuts, onSave, isPremium, onUpgrade, onReset }) {
  const [scriptCut, setScriptCut] = useState(null)
  const profile = FACE_PROFILES[faceShape]
  const recommendations = getModifiedRecommendations(faceShape, hairline, density)
  const faceLabel = FACE_SHAPES.find(s => s.id === faceShape)?.label ?? faceShape
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-body text-[10px] uppercase tracking-widest text-secondary mb-0.5">{faceLabel} Face</p>
          <h2 className="font-heading font-bold text-[22px] text-primary">Your Cuts</h2>
        </div>
        <button onClick={() => { triggerHaptic(); onReset() }}
          className="font-heading font-semibold text-[12px] px-3 py-1.5 rounded-xl text-secondary"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          Start over
        </button>
      </div>
      <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${GOLD}` }}>
        <p className="font-body text-[12px] text-secondary leading-relaxed">{profile.summary}</p>
      </div>
      <div className="mb-4 rounded-xl px-4 py-3" style={{ background: `${RED}0F`, border: `1px solid ${RED}25` }}>
        <p className="font-body text-[9px] uppercase tracking-widest mb-2" style={{ color: RED }}>What to avoid</p>
        <p className="font-body text-[12px] leading-relaxed mb-2" style={{ color: `${RED}90` }}>{profile.avoid.reason}</p>
        <div className="flex flex-wrap gap-1.5">
          {profile.avoid.cuts.map(cut => (
            <span key={cut} className="font-body text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: `${RED}15`, color: RED, border: `1px solid ${RED}25` }}>{cut}</span>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {recommendations.map((cut, i) => (
          <CutCard key={cut.id} cut={cut} rank={i} saved={savedCuts.includes(cut.id)}
            onSave={onSave} onScript={setScriptCut} delay={i * 0.06} />
        ))}
      </div>
      <AnimatePresence>
        {scriptCut && <BarberScriptModal cut={scriptCut} onClose={() => setScriptCut(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function HairMaxx() {
  const navigate = useNavigate()
  const { isPremium } = useStore()

  const [mode, setMode]         = useState(null)
  const [aiStep, setAiStep]     = useState('capture')
  const [aiResult, setAiResult] = useState(null)
  const [aiError, setAiError]   = useState(null)
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
      let base64, mediaType
      if (typeof file === 'string' && file.startsWith('data:')) {
        const [header, data] = file.split(',')
        base64 = data
        mediaType = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
      } else {
        const result = await fileToBase64(file)
        base64 = result.base64
        mediaType = result.mediaType
      }
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
      else setMode(null)
    } else if (mode === 'manual') {
      if (manualStep > 0) setManualStep(s => s - 1)
      else setMode(null)
    } else {
      navigate(-1)
    }
  }

  function resetAll() {
    setMode(null); setAiStep('capture'); setAiResult(null); setAiError(null)
    setManualStep(0); setFaceShape(null); setDensity(null); setHairline(null)
  }

  const showBack = mode !== null
  const showNext = mode === 'manual' && manualStep < 2
  const nextEnabled = manualStep === 0 ? canNext0 : canNext1

  return (
    <>
    <MotionPage style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 pb-4"
        style={{ background: 'var(--bg)', borderBottom: mode !== null ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        {showBack ? (
          <button onClick={() => { triggerHaptic(); handleBack() }}
            className="p-2 -ml-2 rounded-xl" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <ChevronLeft size={22} />
          </button>
        ) : <div className="w-9" />}
        <div className="text-center">
          {mode !== null && <p className="font-heading font-bold text-[16px] text-primary">HairMaxx</p>}
          {mode === 'manual' && manualStep < 2 && (
            <p className="font-body text-[10px] text-secondary">Step {manualStep + 1} of 2</p>
          )}
        </div>
        <div className="w-9" />
      </div>

      <div className="px-5 pt-4 pb-32">
        <AnimatePresence mode="wait">
          {mode === null && (
            <motion.div key="mode" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <ModeSelector onAI={() => setMode('ai')} onManual={() => setMode('manual')} />
            </motion.div>
          )}
          {mode === 'ai' && aiStep === 'capture' && (
            <motion.div key="ai-capture" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <PhotoCapture onPhoto={handlePhotoSubmit} error={aiError} />
            </motion.div>
          )}
          {mode === 'ai' && aiStep === 'loading' && (
            <motion.div key="ai-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AILoading />
            </motion.div>
          )}
          {mode === 'ai' && aiStep === 'results' && aiResult && (
            <motion.div key="ai-results" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <AIResults result={aiResult} isPremium={isPremium}
                onUpgrade={() => navigate('/unlock?paywall=1')}
                onRescan={() => { setAiStep('capture'); setAiResult(null) }} />
            </motion.div>
          )}
          {mode === 'manual' && manualStep === 0 && (
            <motion.div key="manual-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <FaceShapeSelector selected={faceShape} onSelect={setFaceShape} />
            </motion.div>
          )}
          {mode === 'manual' && manualStep === 1 && (
            <motion.div key="manual-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <HairDetailsSelector density={density} hairline={hairline} onDensity={setDensity} onHairline={setHairline} />
            </motion.div>
          )}
          {mode === 'manual' && manualStep === 2 && (
            <motion.div key="manual-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <ManualResultsView faceShape={faceShape} density={density} hairline={hairline}
                savedCuts={savedCuts} onSave={id => setSavedCuts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                isPremium={isPremium} onUpgrade={() => navigate('/unlock?paywall=1')}
                onReset={resetAll} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionPage>

    {showNext && (
      <div className="fixed bottom-0 left-0 right-0 px-5 pt-4"
        style={{ background: 'linear-gradient(to top, var(--bg) 60%, transparent)', paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))' }}>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { triggerHaptic(); if (manualStep === 0 && canNext0) setManualStep(1); else if (manualStep === 1 && canNext1) setManualStep(2) }}
          disabled={!nextEnabled}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2 transition-all"
          style={{ background: nextEnabled ? GOLD_GRADIENT : 'rgba(255,255,255,0.06)', color: nextEnabled ? '#0A0A0A' : 'rgba(255,255,255,0.2)', boxShadow: nextEnabled ? '0 4px 20px rgba(198,168,92,0.28)' : 'none' }}>
          {manualStep === 1 ? <><Scissors size={16} />Get My Cuts</> : <>Next <ChevronRight size={16} /></>}
        </motion.button>
      </div>
    )}
    </>
  )
}
