import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, X, Sparkles, Trophy, ChevronLeft, Lock, Loader2, Star, AlertCircle } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import { takePhoto, pickPhoto, isNative } from '../utils/camera'
import PageHeader from '../components/PageHeader'
import MotionPage from '../components/MotionPage'
import { isNative as checkNative } from '../utils/iap'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const SURFACE = '#141414'
const BORDER  = 'rgba(255,255,255,0.07)'

function scoreColor(s) {
  if (s >= 8) return '#34D399'
  if (s >= 6) return '#F5A623'
  return '#9CA3AF'
}

function RankBadge({ rank }) {
  const colors = { 1: GOLD, 2: '#9CA3AF', 3: '#CD7F32' }
  const color  = colors[rank] ?? 'rgba(255,255,255,0.3)'
  return (
    <div
      className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center font-heading font-bold text-[11px]"
      style={{ background: color, color: rank === 1 ? '#0A0A0A' : '#fff', boxShadow: rank === 1 ? `0 0 12px ${color}88` : 'none' }}
    >
      {rank}
    </div>
  )
}

export default function TinderMaxx() {
  const navigate  = useNavigate()
  const { isPremium, user, gender } = useStore()

  const [photos, setPhotos]     = useState([]) // { url, base64, mediaType }
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const fileRef = useRef()

  const maxPhotos = 5

  // ── Add photo from file input ──────────────────────────────────────────────
  async function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    const remaining = maxPhotos - photos.length
    const toAdd = files.slice(0, remaining)
    for (const file of toAdd) {
      const url = URL.createObjectURL(file)
      const base64 = await fileToBase64(file)
      setPhotos(prev => [...prev, { url, base64, mediaType: file.type || 'image/jpeg' }])
    }
    e.target.value = ''
  }

  function fileToBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.readAsDataURL(file)
    })
  }

  async function handleNativePhoto() {
    try {
      const photo = await pickPhoto()
      if (!photo) return
      setPhotos(prev => [...prev, { url: photo.dataUrl, base64: photo.base64, mediaType: 'image/jpeg' }])
    } catch {}
  }

  function removePhoto(i) {
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
    setResult(null)
  }

  async function handleAnalyze() {
    if (photos.length < 2) { setError('Add at least 2 photos to compare.'); return }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const data = await api.tindermaxx.rank({
        photos: photos.map(p => ({ base64: p.base64, mediaType: p.mediaType })),
        gender: gender || 'male',
      })
      setResult(data)
    } catch (err) {
      if (err.plan === 'premium') {
        navigate('/premium?from=tindermaxx')
      } else {
        setError(err.message || 'Analysis failed. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Pro gate ───────────────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <MotionPage className="px-4">
        <PageHeader title="TinderMaxx" />
        <div
          className="mt-8 rounded-2xl p-8 flex flex-col items-center text-center gap-4"
          style={{ background: 'rgba(198,168,92,0.04)', border: `1px solid rgba(198,168,92,0.18)` }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.1)' }}>
            <Lock size={28} style={{ color: GOLD }} />
          </div>
          <h2 className="font-heading font-bold text-xl text-primary">Pro Feature</h2>
          <p className="font-body text-sm text-secondary max-w-[260px]">
            Upload your photos and AI picks your best dating profile photo — with reasons and tips.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); navigate('/premium?from=tindermaxx') }}
            className="w-full py-3.5 rounded-2xl font-heading font-bold text-sm"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
          >
            Unlock TinderMaxx
          </motion.button>
        </div>
      </MotionPage>
    )
  }

  return (
    <MotionPage className="px-4 pb-8">
      <PageHeader title="TinderMaxx" subtitle="Find your best dating photo" />

      {/* ── Photo grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {photos.map((p, i) => {
          const rank = result?.rankings?.find(r => r.index === i)?.rank
          const isWinner = result?.winner_index === i
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden"
              style={{
                border: isWinner
                  ? `2px solid ${GOLD}`
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isWinner ? `0 0 20px ${GOLD}44` : 'none',
              }}
            >
              <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              {rank && <RankBadge rank={rank} />}
              {isWinner && (
                <div className="absolute top-2 right-2">
                  <Trophy size={14} style={{ color: GOLD }} />
                </div>
              )}
              {!loading && !result && (
                <button
                  onClick={() => { triggerHaptic(); removePhoto(i) }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.6)' }}
                >
                  <X size={12} className="text-white" />
                </button>
              )}
            </motion.div>
          )
        })}

        {/* Empty slots */}
        {photos.length < maxPhotos && !result && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { triggerHaptic(); isNative() ? handleNativePhoto() : fileRef.current?.click() }}
            className="aspect-[3/4] rounded-2xl flex flex-col items-center justify-center gap-2"
            style={{ background: '#1C1C1C', border: `1.5px dashed rgba(198,168,92,0.3)` }}
          >
            <Upload size={20} style={{ color: 'rgba(198,168,92,0.6)' }} />
            <span className="text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Add photo
            </span>
          </motion.button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Error ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertCircle size={14} style={{ color: '#EF4444' }} />
            <p className="text-[12px] font-body" style={{ color: '#EF4444' }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Analyze button ───────────────────────────────────────────────── */}
      {!result && (
        <motion.button
          whileTap={{ scale: loading ? 1 : 0.97 }}
          onClick={() => { triggerHaptic(); handleAnalyze() }}
          disabled={loading || photos.length < 2}
          className="w-full py-4 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 mb-4 disabled:opacity-40"
          style={{
            background: GOLD_GRADIENT,
            color: '#0A0A0A',
          }}
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Analyzing your photos…</>
          ) : (
            <><Sparkles size={16} /> Find My Best Photo</>
          )}
        </motion.button>
      )}

      {photos.length > 0 && !result && !loading && (
        <p className="text-center text-[11px] font-body mb-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {photos.length} photo{photos.length > 1 ? 's' : ''} added · {maxPhotos - photos.length} slots left
        </p>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_STANDARD }}
          >
            {/* Winner reveal */}
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: 'rgba(198,168,92,0.06)', border: `1px solid rgba(198,168,92,0.25)` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} style={{ color: GOLD }} />
                <p className="font-heading font-bold text-sm" style={{ color: GOLD }}>Winner</p>
              </div>
              <div className="flex gap-3 items-start">
                <img
                  src={photos[result.winner_index]?.url}
                  alt="Winner"
                  className="w-20 rounded-xl object-cover"
                  style={{ aspectRatio: '3/4', border: `2px solid ${GOLD}` }}
                />
                <div className="flex-1">
                  <p className="font-body text-[13px] text-primary leading-snug mb-3">
                    {result.rankings?.find(r => r.index === result.winner_index)?.reason}
                  </p>
                  <p className="font-heading font-bold text-[11px] mb-1.5" style={{ color: GOLD }}>
                    Tips to make it even better:
                  </p>
                  {result.winner_tips?.map((tip, i) => (
                    <p key={i} className="font-body text-[12px] text-secondary mb-1">
                      {i + 1}. {tip}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Full ranking */}
            <div
              className="rounded-2xl overflow-hidden mb-5"
              style={{ background: '#141414', border: BORDER }}
            >
              <p className="px-4 pt-4 pb-2 font-heading font-bold text-[11px] uppercase tracking-widest text-secondary">
                All Rankings
              </p>
              {[...result.rankings]
                .sort((a, b) => a.rank - b.rank)
                .map((r) => (
                  <div
                    key={r.index}
                    className="flex items-center gap-3 px-4 py-3 border-t"
                    style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                  >
                    <span
                      className="font-heading font-bold text-sm w-5 text-center"
                      style={{ color: r.rank === 1 ? GOLD : 'rgba(255,255,255,0.3)' }}
                    >
                      #{r.rank}
                    </span>
                    <img
                      src={photos[r.index]?.url}
                      alt={`Photo ${r.index + 1}`}
                      className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-[12px] text-primary leading-snug truncate">{r.reason}</p>
                    </div>
                    <span
                      className="font-mono font-bold text-sm flex-shrink-0"
                      style={{ color: scoreColor(r.score) }}
                    >
                      {r.score.toFixed(1)}
                    </span>
                  </div>
                ))}
            </div>

            {/* Retry */}
            <button
              onClick={() => { triggerHaptic(); setResult(null); setPhotos([]) }}
              className="w-full py-3 rounded-2xl font-heading font-bold text-sm"
              style={{ background: '#1C1C1C', border: BORDER, color: 'rgba(255,255,255,0.6)' }}
            >
              Try Different Photos
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionPage>
  )
}
