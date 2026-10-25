import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Heart, MessageCircle, Plus, X, Send, Trash2, MoreVertical, TrendingUp, Users, Loader2, Copy, Image, Camera, Check, BarChart2, Flag, ChevronLeft } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import MotionPage from '../components/MotionPage'
import ScanHistoryRow from '../components/ScanHistoryRow'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { isPhysiqueProgressScan } from '../utils/progressHistory'
import { getHistoryScoreColor } from '../utils/scanHistory'
import { loadScanMedia } from '../utils/scanPhotoDb'
import demoMaleScan from '../assets/face-metrics-demo.jpg'
import demoFemaleScan from '../assets/face-metrics-demo-female.jpg'

const BORDER = 'rgba(255,255,255,0.07)'
const GOLD_LINE_GLOW = '0 0 14px rgba(198,168,92,0.4), 0 0 28px rgba(198,168,92,0.18), inset 0 0 10px rgba(198,168,92,0.1)'
const SAMPLE_LIKES_STORAGE_KEY = 'community.sample-liked-posts'

const SAMPLE_COMMUNITY_POSTS = [
  { id: 'sample-1', display_name: 'Jordan', post_type: 'glow-up', created_at: new Date(Date.now() - 18 * 60_000).toISOString(), score_before: 6.2, score_after: 7.4, before_photo_url: demoMaleScan, photo_url: demoMaleScan, caption: 'Six weeks of consistency is starting to show.', likes_count: 28, comments_count: 6, sample_comments: [{ id: 'sample-1-comment-1', display_name: 'Maya', content: 'The progress is really clear!', created_at: new Date(Date.now() - 10 * 60_000).toISOString() }, { id: 'sample-1-comment-2', display_name: 'Ethan', content: 'Consistency pays off. Nice work.', created_at: new Date(Date.now() - 5 * 60_000).toISOString() }] },
  { id: 'sample-2', display_name: 'Maya', post_type: 'rate-me', created_at: new Date(Date.now() - 52 * 60_000).toISOString(), photo_url: demoFemaleScan, avg_rating: 8.1, rating_count: 24, caption: 'Trying a new haircut. What do you think?', likes_count: 17, comments_count: 4, sample_comments: [{ id: 'sample-2-comment-1', display_name: 'Sofia', content: 'That style suits you!', created_at: new Date(Date.now() - 30 * 60_000).toISOString() }] },
  { id: 'sample-3', display_name: 'Ethan', post_type: 'glow-up', created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), score_before: 5.8, score_after: 6.6, before_photo_url: demoMaleScan, photo_url: demoMaleScan, caption: 'Better sleep and a simpler routine.', likes_count: 21, comments_count: 3, sample_comments: [{ id: 'sample-3-comment-1', display_name: 'Noah', content: 'What did you change in your routine?', created_at: new Date(Date.now() - 90 * 60_000).toISOString() }] },
  { id: 'sample-4', display_name: 'Ava', post_type: 'rate-me', created_at: new Date(Date.now() - 4 * 60 * 60_000).toISOString(), photo_url: demoFemaleScan, avg_rating: 7.6, rating_count: 16, caption: 'New lighting setup for my scan. Any tips?', likes_count: 13, comments_count: 2, sample_comments: [{ id: 'sample-4-comment-1', display_name: 'Jordan', content: 'Natural window light usually works well.', created_at: new Date(Date.now() - 3 * 60 * 60_000).toISOString() }] },
  { id: 'sample-5', display_name: 'Noah', post_type: 'glow-up', created_at: new Date(Date.now() - 7 * 60 * 60_000).toISOString(), score_before: 6.5, score_after: 7.0, before_photo_url: demoMaleScan, photo_url: demoMaleScan, caption: 'Keeping the routine simple and sticking with it.', likes_count: 35, comments_count: 8, sample_comments: [{ id: 'sample-5-comment-1', display_name: 'Ethan', content: 'Simple routines are easier to stay consistent with.', created_at: new Date(Date.now() - 6 * 60 * 60_000).toISOString() }] },
  { id: 'sample-6', display_name: 'Sofia', post_type: 'rate-me', created_at: new Date(Date.now() - 11 * 60 * 60_000).toISOString(), photo_url: demoFemaleScan, avg_rating: 8.4, rating_count: 31, caption: 'Which style suits me better?', likes_count: 26, comments_count: 5, sample_comments: [{ id: 'sample-6-comment-1', display_name: 'Maya', content: 'I like this look best!', created_at: new Date(Date.now() - 9 * 60 * 60_000).toISOString() }] },
  { id: 'sample-7', display_name: 'Jordan', post_type: 'question', created_at: new Date(Date.now() - 13 * 60 * 60_000).toISOString(), photo_url: demoMaleScan, caption: 'Any advice for reducing under-eye puffiness in the morning?', likes_count: 12, comments_count: 3, sample_comments: [{ id: 'sample-7-comment-1', display_name: 'Maya', content: 'A cool compress and getting enough sleep helped me.', created_at: new Date(Date.now() - 12 * 60 * 60_000).toISOString() }, { id: 'sample-7-comment-2', display_name: 'Ethan', content: 'Try keeping your hydration consistent too.', created_at: new Date(Date.now() - 11 * 60 * 60_000).toISOString() }] },
].map(post => ({ ...post, user_liked: 0, is_mine: 0 }))

function getSampleLikedIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAMPLE_LIKES_STORAGE_KEY) || '[]')
    return new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function withSampleLikeState() {
  const likedIds = getSampleLikedIds()
  return SAMPLE_COMMUNITY_POSTS.map(post => {
    const liked = likedIds.has(post.id)
    return { ...post, user_liked: liked ? 1 : 0, likes_count: post.likes_count + (liked ? 1 : 0) }
  })
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getFaceScanOverallScore(scan) {
  const raw = scan?.aiScore?.overallScore ?? scan?.glowScore ?? scan?.glow_score ?? scan?.overall_score
  const score = Number(raw)
  return raw != null && Number.isFinite(score) ? score : null
}

const Avatar = memo(function Avatar({ name, size = 9, subtle = false }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 font-heading font-bold text-sm`}
      style={{
        background: subtle ? 'rgba(198,168,92,0.12)' : 'rgba(198,168,92,0.15)',
        color: GOLD,
        border: `1px solid rgba(198,168,92,${subtle ? '0.16' : '0.2'})`,
        boxShadow: 'none',
      }}
    >
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
  )
})

// Module-level animation variants (no object recreation per render)
const CARD_VARIANTS = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

// Community posts can only use photos already saved with a face scan.
function FaceScanPhotoPicker({ label, pickerTitle, value, onChange, photos, disabled, emptyMessage, hideLabel = false }) {
  const [open, setOpen] = useState(false)
  const title = pickerTitle || (label === 'Before' || label === 'After' ? `${label} photo` : label)

  return (
    <div className="flex-1 min-w-0">
      {!hideLabel && <p className="font-heading font-bold text-[11px] uppercase tracking-widest mb-1.5"
        style={{ color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </p>}
      <button
        type="button"
        disabled={disabled}
        aria-label={`Choose ${title.toLowerCase()} from saved scans`}
        onClick={() => { triggerHaptic(); setOpen(value ? !open : true) }}
        className={`relative w-full rounded-2xl overflow-hidden disabled:opacity-50 ${value ? 'text-left' : 'flex items-center justify-center'}`}
        style={value
          ? { aspectRatio: '4 / 5', background: 'transparent', border: 0 }
          : { aspectRatio: '4 / 5', background: '#111111', border: '1.5px dashed rgba(255,255,255,0.08)' }}
      >
        {value ? (
          <div className="absolute inset-0">
            <TradingScanCard image={value.src} imageAlt={`${label} face scan`} label={label} score={value.score} compact />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Camera size={30} style={{ color: GOLD, filter: 'drop-shadow(0 0 8px rgba(198,168,92,0.38))' }} />
            <span className="font-body text-[11px] text-center px-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {disabled ? 'No face scans yet' : 'Choose a face scan'}
            </span>
          </div>
        )}
      </button>
      {open && (photos.length > 0 || emptyMessage) && createPortal(
        <div className="fixed inset-0 z-[10060] flex flex-col bg-black" role="dialog" aria-modal="true" aria-labelledby={`community-photo-picker-${label}`}>
        <header className="flex shrink-0 items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top,0px)+20px)]" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div>
              <h2 id={`community-photo-picker-${label}`} className="font-heading text-xl font-bold text-white">Choose {title}</h2>
              <p className="mt-1 font-body text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Select a saved scan from Progress</p>
            </div>
            <button type="button" aria-label="Close scan picker" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: '#151515', color: '#fff', border: `1px solid ${BORDER}` }}><X size={18} /></button>
          </header>
          <div aria-label={`Saved scans for ${label}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" style={{ touchAction: 'pan-y' }}>
            <div>
              {photos.map((photo, index) => photo.scan && <ScanHistoryRow
                key={photo.id}
                scan={photo.scan}
                index={index}
                showChevron={false}
                onTap={() => { onChange(photo); setOpen(false) }}
              />)}
            </div>
            {!photos.length && emptyMessage && <p className="px-2 py-6 text-center font-body text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{emptyMessage}</p>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function TradingScanCard({ image, imageAlt, label, subtitle, score, selected = false, compact = false }) {
  const hasFooter = Boolean(label || subtitle || score != null)
  return (
    <div className={`flex h-full w-full min-h-0 flex-col rounded-2xl ${compact ? 'p-2' : 'p-3'}`} style={{ background: '#141414', border: `1px solid ${selected ? GOLD : 'rgba(255,255,255,0.07)'}` }}>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-[#111]">
        <img src={image} alt={imageAlt} className="h-full w-full object-cover" />
      </div>
      {hasFooter && <div className={`flex shrink-0 items-center justify-between gap-2 ${compact ? 'pt-1.5' : 'pt-2.5'}`}>
          <div className="min-w-0">
            {label && <p className={`truncate font-heading font-semibold leading-tight text-primary ${compact ? 'text-[10px] uppercase tracking-wider' : 'text-[15px]'}`}>{label}</p>}
            {subtitle && <p className="mt-0.5 truncate font-heading font-bold text-[10px] tracking-wide" style={{ color: score != null ? getHistoryScoreColor(score) : 'rgba(255,255,255,0.48)' }}>{subtitle.toUpperCase()}</p>}
          </div>
          {score != null && <span className={`shrink-0 font-heading font-bold leading-none ${compact ? 'text-[14px]' : 'text-[22px]'}`} style={{ color: getHistoryScoreColor(score), letterSpacing: '-0.02em' }}>{Number(score).toFixed(1)}</span>}
        </div>}
    </div>
  )
}

// ── Comments sheet ────────────────────────────────────────────────────────────
function CommentsSheet({ post, onCommentAdded, displayName, previewOnly = false, sectionRef }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    if (previewOnly) {
      setComments(post.sample_comments || [])
      setLoading(false)
      return undefined
    }
    api.community.comments(post.id)
      .then(({ comments: c }) => setComments(c || []))
      .finally(() => setLoading(false))
  }, [post.id, previewOnly, post.sample_comments])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      if (previewOnly) {
        const comment = {
          id: `local-comment-${Date.now()}`,
          display_name: displayName || 'You',
          content: text.trim(),
          created_at: new Date().toISOString(),
          is_mine: true,
        }
        setComments(prev => [...prev, comment])
        setText('')
        onCommentAdded()
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        return
      }
      const { comment } = await api.community.addComment(post.id, { content: text.trim(), displayName })
      setComments(prev => [...prev, comment])
      setText('')
      onCommentAdded()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {} finally { setSending(false) }
  }

  async function deleteComment(id) {
    if (previewOnly) {
      setComments(prev => prev.filter(comment => comment.id !== id))
      return
    }
    try {
      await api.community.deleteComment(id)
      setComments(prev => prev.filter(c => c.id !== id))
    } catch {}
  }

  return (
    <section ref={sectionRef} className="mt-4 rounded-2xl p-4" style={{ background: '#141414', border: `1px solid ${BORDER}`, scrollMarginTop: 16 }}>
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: BORDER }}>
        <p className="font-heading font-bold text-sm text-primary">Comments <span className="text-secondary font-body">({post.comments_count ?? comments.length})</span></p>
      </div>

      <div className="py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: GOLD }} /></div>
        ) : comments.length === 0 ? (
          <p className="text-secondary font-body text-sm py-3">Be the first to comment</p>
        ) : comments.map(c => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar name={c.display_name} size={8} subtle />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-heading font-bold text-[12px] text-primary">{c.display_name}</span>
                <span className="text-[10px] text-secondary font-body">{timeAgo(c.created_at)}</span>
              </div>
              <p className="font-body text-[13px] text-primary leading-snug">{c.content}</p>
            </div>
            {c.is_mine && (
              <button onClick={() => { triggerHaptic(); deleteComment(c.id) }}>
                <Trash2 size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="pt-3 flex items-center gap-3 border-t"
        style={{ borderColor: BORDER }}>
        <Avatar name={displayName} size={8} subtle />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Add a comment…"
          maxLength={500}
          className="community-comment-input flex-1 bg-transparent font-body text-primary outline-none placeholder:text-secondary"
          style={{ fontSize: 16 }}
        />
        <button onClick={() => { triggerHaptic(); send() }} disabled={!text.trim() || sending}>
          <Send size={18} style={{ color: text.trim() ? GOLD : 'rgba(255,255,255,0.2)' }} />
        </button>
      </div>
    </section>
  )
}

// ── Share modal ───────────────────────────────────────────────────────────────
function ShareModal({ onClose, onPosted, user, scans, scanToShare, initialPhoto }) {
  const faceScans = [scanToShare, ...scans]
    .filter(scan => scan && !isPhysiqueProgressScan(scan))
    .filter((scan, index, all) => all.findIndex(item => item.id && item.id === scan.id) === index)
    .sort((a, b) => (Date.parse(b.scanDate ?? b.analyzedAt ?? b.created_at) || 0) - (Date.parse(a.scanDate ?? a.analyzedAt ?? a.created_at) || 0))
  const latestScan  = faceScans[0]

  const [postType,    setPostType]    = useState('glow-up')
  const displayName = user?.name?.split(' ')[0] ?? 'Anonymous'
  const [caption,     setCaption]     = useState('')
  const [afterPhoto,  setAfterPhoto]  = useState(null)
  const [beforePhoto, setBeforePhoto] = useState(null)
  const [ratePhoto,   setRatePhoto]   = useState(null)
  const [questionPhoto, setQuestionPhoto] = useState(null)
  const [faceScanPhotos, setFaceScanPhotos] = useState([])
  const [loadingFacePhotos, setLoadingFacePhotos] = useState(true)
  const [posting,     setPosting]     = useState(false)
  const [err,         setErr]         = useState('')

  useEffect(() => {
    let active = true
    setLoadingFacePhotos(true)
    Promise.all(faceScans.map(async (scan, index) => {
      let src = scan.facePhotoUrl ?? scan.face_photo_url ?? scan.face_image_url ?? null
      if (!src && scan.id) {
        const media = await loadScanMedia(scan.id)
        src = media?.photo ?? null
      }
      if (!src) return null
      const timestamp = scan.scanDate ?? scan.analyzedAt ?? scan.created_at
      const parsedDate = timestamp ? new Date(timestamp) : null
      const timestampMs = parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.getTime() : null
      const date = parsedDate && Number.isFinite(parsedDate.getTime())
        ? parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Face scan'
      return { id: scan.id ?? `face-scan-${index}`, src, date, timestamp: timestampMs, score: getFaceScanOverallScore(scan), scan }
    })).then(photos => {
      if (!active) return
      const available = photos.filter(Boolean)
      setFaceScanPhotos(available)
      setAfterPhoto(current => current || available.find(photo => photo.id === scanToShare?.id)
        || available.find(photo => photo.src === initialPhoto) || available[0] || null)
    }).finally(() => { if (active) setLoadingFacePhotos(false) })
    return () => { active = false }
  }, [scans, scanToShare?.id, initialPhoto])

  const scoreBefore = beforePhoto?.score ?? null
  const scoreAfter = afterPhoto?.score ?? null
  const beforePhotoChoices = faceScanPhotos.filter(photo => afterPhoto
    ? photo.timestamp != null && afterPhoto.timestamp != null && photo.timestamp < afterPhoto.timestamp
    : photo.id !== beforePhoto?.id)
  const afterPhotoChoices = faceScanPhotos.filter(photo => beforePhoto
    ? photo.timestamp != null && beforePhoto.timestamp != null && photo.timestamp > beforePhoto.timestamp
    : photo.id !== afterPhoto?.id)

  // Shrink modal when keyboard appears using visualViewport
  const [vvH, setVvH] = useState(window.visualViewport?.height ?? window.innerHeight)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setVvH(vv.height)
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])

  async function submit() {
    if (postType === 'glow-up' && !latestScan) { setErr('You need a scan first.'); return }
    if (postType === 'glow-up' && beforePhoto && afterPhoto && (
      beforePhoto.timestamp == null || afterPhoto.timestamp == null || beforePhoto.timestamp >= afterPhoto.timestamp
    )) {
      setErr('Choose an earlier scan for Before and a later scan for After.')
      return
    }
    if (postType === 'rate-me' && !ratePhoto)  { setErr('Add a photo to get rated.'); return }
    if (postType === 'question' && !caption.trim()) { setErr('Write your question first.'); return }
    setPosting(true); setErr('')
    try {
      if (postType === 'glow-up') {
        await api.community.post({
          displayName,
          scoreBefore: scoreBefore ?? scoreAfter,
          scoreAfter,
          photoUrl:       afterPhoto?.src || null,
          beforePhotoUrl: beforePhoto?.src || null,
          caption,
          postType: 'glow-up',
        })
      } else if (postType === 'rate-me') {
        await api.community.post({
          displayName,
          photoUrl: ratePhoto?.src,
          caption,
          postType: 'rate-me',
        })
      } else {
        await api.community.post({ displayName, caption: caption.trim(), photoUrl: questionPhoto?.src || null, postType: 'question' })
      }
      onPosted()
    } catch (e) {
      console.error('[community submit]', e)
      const msg = e?.message || ''
      const safe = msg && !msg.match(/^(internal_error|error|undefined|null)$/i)
      setErr(safe ? msg : "Couldn't post. Please try again.")
    } finally { setPosting(false) }
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[10050] flex flex-col"
      style={{ background: '#0A0A0A', height: vvH, minHeight: vvH }}
    >
      <div className="w-full h-full min-h-0 flex flex-col" style={{ height: vvH }}>
        {/* Fixed header */}
        <div className="relative flex-shrink-0 px-6 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}>
          <button type="button" aria-label="Go back" onClick={() => { triggerHaptic(); onClose() }} className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+12px)] w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}><ChevronLeft size={18} className="text-primary" /></button>
          <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: GOLD }}>COMMUNITY</p>
          <h1 className="font-heading font-bold text-[22px] leading-tight text-primary" style={{ letterSpacing: '-0.02em' }}>New Post</h1>
        </div>

        {/* Post type selector */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="mx-auto grid grid-cols-3 gap-[3px] rounded-full p-[3px]" style={{ width: 'min(360px, 100%)', height: 38, background: '#050505', border: '1px solid #292929' }}>
            {[{ id: 'glow-up', label: 'Glow-Up' }, { id: 'rate-me', label: 'Rate Me' }, { id: 'question', label: 'Question' }].map(t => (
              <button
                key={t.id}
                onClick={() => { triggerHaptic(); setPostType(t.id) }}
                className="min-w-0 flex items-center justify-center rounded-full font-heading font-medium text-[13px] transition-all"
                style={postType === t.id
                  ? { background: '#242424', color: '#fff' }
                  : { background: 'transparent', color: '#929292' }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 space-y-4" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>

          {postType === 'glow-up' ? (
            <>
              {/* Before / After photos */}
              <div>
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-[11px] uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Before</p>
                    <FaceScanPhotoPicker label="Before" value={beforePhoto} onChange={setBeforePhoto} photos={beforePhotoChoices} disabled={loadingFacePhotos || !faceScanPhotos.length} emptyMessage="No earlier scans are available than the selected After photo." hideLabel />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-[11px] uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>After</p>
                    <FaceScanPhotoPicker label="After" value={afterPhoto} onChange={setAfterPhoto} photos={afterPhotoChoices} disabled={loadingFacePhotos || !faceScanPhotos.length} emptyMessage="No later scans are available than the selected Before photo." hideLabel />
                  </div>
                </div>
                {!loadingFacePhotos && !faceScanPhotos.length && (
                  <p className="font-body text-[11px] mt-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Complete a face scan first to choose a photo.
                  </p>
                )}
              </div>
            </>
          ) : postType === 'rate-me' ? (
            <>
              <div>
                <div className="w-1/2 mx-auto">
                  <FaceScanPhotoPicker label="Photo" value={ratePhoto} onChange={setRatePhoto} photos={faceScanPhotos} disabled={loadingFacePhotos || !faceScanPhotos.length} />
                </div>
                {!loadingFacePhotos && !faceScanPhotos.length && (
                  <p className="font-body text-[11px] mt-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Complete a face scan first to choose a photo.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="w-1/2 mx-auto">
                  <FaceScanPhotoPicker label="Add a photo (optional)" pickerTitle="photo" value={questionPhoto} onChange={setQuestionPhoto} photos={faceScanPhotos} disabled={loadingFacePhotos || !faceScanPhotos.length} />
                </div>
                {!loadingFacePhotos && !faceScanPhotos.length && (
                  <p className="font-body text-[11px] mt-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>A photo is optional. Complete a face scan to attach one.</p>
                )}
              </div>
            </>
          )}

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-heading font-bold text-[11px] uppercase tracking-widest text-secondary">
                {postType === 'question' ? 'Your question' : <>Caption <span style={{ color: 'rgba(255,255,255,0.2)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></>}
              </label>
              <span className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {caption.length}/280
              </span>
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value.slice(0, 280))}
              placeholder={postType === 'question' ? 'What would you like advice on?' : postType === 'rate-me' ? 'Add context (age, improvements made…)' : 'What worked for you?'}
              rows={postType === 'question' ? 4 : 3}
              className="w-full px-3 py-2.5 rounded-xl font-body text-sm text-primary outline-none resize-none"
              style={{ background: '#111111', border: `1px solid ${BORDER}`, fontSize: 16 }}
            />
          </div>

          {err && <p className="text-[12px] font-body" style={{ color: '#EF4444' }}>{err}</p>}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); submit() }}
            disabled={posting}
            className="w-full rounded-2xl font-heading font-bold text-[17px] flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ minHeight: 66, padding: '0 16px', borderRadius: 16, background: GOLD_GRADIENT, color: '#0A0A0A', boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
          >
            {posting
              ? <><Loader2 size={15} className="animate-spin" /> Posting…</>
              : postType === 'rate-me' ? 'Post for Rating' : postType === 'question' ? 'Ask for Advice' : 'Post Glow-Up'
            }
          </motion.button>

          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}

// ── Load image helper (shared) ────────────────────────────────────────────────
function loadImg(src) {
  return new Promise((res, rej) => {
    const img = new window.Image()
    if (src && !src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload  = () => res(img)
    img.onerror = () => rej(new Error('load'))
    img.src = src
  })
}

function rrCtx(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

async function renderPostCard(post) {
  const W = 1080, H = 1080
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')

  // bg
  ctx.fillStyle = '#0D0D0D'; ctx.fillRect(0, 0, W, H)

  // card
  rrCtx(ctx, 36, 36, W - 72, H - 72, 48)
  ctx.fillStyle = '#141414'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1.5
  rrCtx(ctx, 36, 36, W - 72, H - 72, 48); ctx.stroke()

  // topbar
  ctx.font = '800 38px Inter, Arial'; ctx.fillStyle = GOLD
  ctx.textAlign = 'right'
  ctx.fillText('ASCENDUS', W - 80, 110)

  // username
  ctx.textAlign = 'left'
  ctx.font = '700 40px Inter, Arial'; ctx.fillStyle = '#ffffff'
  ctx.fillText(post.display_name ?? 'Anonymous', 80, 110)

  // score line
  const hasBefore = !!post.before_photo_url
  const hasAfter  = !!post.photo_url
  const scoreText = post.score_before != null && post.score_after != null
    ? `${post.score_before.toFixed(1)}  →  ${post.score_after.toFixed(1)}`
    : post.score_after != null ? `Score: ${post.score_after.toFixed(1)}` : null
  const improvement = post.score_before != null && post.score_after != null
    ? post.score_after - post.score_before : null

  if (scoreText) {
    ctx.font = '700 56px Inter, Arial'
    ctx.fillStyle = improvement != null && improvement >= 0 ? '#34D399' : '#EF4444'
    ctx.textAlign = 'center'
    ctx.fillText(scoreText, W / 2, 192)
  }

  // photo area
  const photoTop  = 230
  const photoH    = 640
  const photoGap  = 20
  const bothPhotos = hasBefore && hasAfter

  async function drawPhoto(src, x, y, w, h, label, labelColor) {
    try {
      const img = await loadImg(src)
      ctx.save()
      rrCtx(ctx, x, y, w, h, 20); ctx.clip()
      const scale = Math.max(w / img.width, h / img.height)
      const dw = img.width * scale, dh = img.height * scale
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
      ctx.restore()
      // label bar
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      rrCtx(ctx, x, y + h - 52, w, 52, 0); ctx.fill()
      ctx.font = '700 26px Inter, Arial'; ctx.fillStyle = labelColor
      ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + h - 18)
    } catch {}
  }

  if (bothPhotos) {
    const hw = (W - 72 - 20 - photoGap) / 2
    await drawPhoto(post.before_photo_url, 56, photoTop, hw, photoH, 'BEFORE', '#ffffff')
    await drawPhoto(post.photo_url,        56 + hw + photoGap, photoTop, hw, photoH, 'AFTER', GOLD)
  } else if (hasAfter) {
    await drawPhoto(post.photo_url, 56, photoTop, W - 112, photoH, 'AFTER', GOLD)
  } else if (hasBefore) {
    await drawPhoto(post.before_photo_url, 56, photoTop, W - 112, photoH, 'BEFORE', '#ffffff')
  }

  // caption
  if (post.caption) {
    const captionY = photoTop + photoH + 48
    ctx.font = '400 32px Inter, Arial'; ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.textAlign = 'center'
    const words = post.caption.split(' ')
    let line = '', lines = []
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > W - 160) { lines.push(line); line = w }
      else line = test
    }
    lines.push(line)
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, captionY + i * 44))
  }

  // footer
  ctx.font = '600 28px Inter, Arial'; ctx.fillStyle = GOLD
  ctx.textAlign = 'center'; ctx.letterSpacing = '2px'
  ctx.fillText('ascendus.store', W / 2, H - 58)
  ctx.letterSpacing = '0px'

  return c.toDataURL('image/jpeg', 0.92)
}

// ── Post share sheet ──────────────────────────────────────────────────────────
function PostShareSheet({ post, onClose }) {
  const [generating, setGenerating] = useState(false)
  const [copied,     setCopied]     = useState(false)

  async function shareAsImage() {
    setGenerating(true)
    try {
      const dataUrl = await renderPostCard(post)
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'ascendus-glowup.jpg', { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${post.display_name}'s Glow-Up`, files: [file] })
      } else {
        const a = document.createElement('a')
        a.href = dataUrl; a.download = 'ascendus-glowup.jpg'; a.click()
      }
    } catch (e) { if (e.name !== 'AbortError') console.error(e) }
    finally { setGenerating(false); onClose() }
  }

  async function copyText() {
    const text = post.score_before != null && post.score_after != null
      ? `${post.display_name} went ${post.score_before.toFixed(1)} → ${post.score_after.toFixed(1)} on Ascendus! 🔥 ascendus.store`
      : `Check out ${post.display_name}'s glow-up on Ascendus! 🔥 ascendus.store`
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(true)
    setTimeout(() => { setCopied(false); onClose() }, 1200)
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={SPRING_STANDARD}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl pb-safe"
        style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <p className="px-5 pb-4 font-heading font-bold text-sm text-primary">Share Post</p>
        <div className="px-4 flex flex-col gap-2">
          <button
            onClick={() => { triggerHaptic(); shareAsImage() }}
            disabled={generating}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl w-full text-left"
            style={{ background: '#242424', border: `1px solid ${BORDER}` }}
          >
            {generating
              ? <Loader2 size={20} className="animate-spin flex-shrink-0" style={{ color: GOLD }} />
              : <Image size={20} className="flex-shrink-0" style={{ color: GOLD }} />}
            <div>
              <p className="font-heading font-bold text-[13px] text-primary">Share as Image</p>
              <p className="font-body text-[11px] text-secondary">Branded card with before/after photos</p>
            </div>
          </button>
          <button
            onClick={() => { triggerHaptic(); copyText() }}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl w-full text-left"
            style={{ background: '#242424', border: `1px solid ${BORDER}` }}
          >
            {copied
              ? <Check size={20} className="flex-shrink-0" style={{ color: '#34D399' }} />
              : <Copy size={20} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }} />}
            <div>
              <p className="font-heading font-bold text-[13px] text-primary">{copied ? 'Copied!' : 'Copy Text'}</p>
              <p className="font-body text-[11px] text-secondary">Score + link to share anywhere</p>
            </div>
          </button>
          <button
            onClick={() => { triggerHaptic(); onClose() }}
            className="w-full py-3 rounded-2xl font-heading font-bold text-sm mt-1"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ── Rate Me scoring UI ────────────────────────────────────────────────────────
const RateMeScorer = memo(function RateMeScorer({ post, onRate }) {
  const [score, setScore] = useState(() => Number(post.user_rating ?? 5))
  const [submitting, setSubmitting] = useState(false)
  const [justVoted, setJustVoted] = useState(false)
  const [voteError, setVoteError] = useState('')
  const scoreRef = useRef(Number(post.user_rating ?? 5))
  const submittingRef = useRef(false)

  useEffect(() => {
    if (post.user_rating != null) {
      const nextScore = Number(post.user_rating)
      scoreRef.current = nextScore
      setScore(nextScore)
    }
  }, [post.user_rating])

  async function handleScore(score) {
    if (submittingRef.current || Number(post.user_rating) === score) return
    submittingRef.current = true
    setSubmitting(true)
    setVoteError('')
    try {
      await onRate(post.id, score)
      setJustVoted(true)
      triggerHaptic()
      window.setTimeout(() => setJustVoted(false), 2200)
    } catch { setVoteError('Could not save your rating. Try again.') }
    finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 pb-4" onClick={event => event.stopPropagation()}>
      <div>
          <div className="relative mb-2 min-h-7">
            <span className="absolute right-0 top-1/2 -translate-y-1/2 font-heading font-bold text-[22px]" style={{ color: GOLD, letterSpacing: '-0.02em' }}>
              {score.toFixed(1)} <span className="text-sm text-secondary">/ 10</span>
            </span>
            {submitting && <span className="absolute left-0 top-1/2 -translate-y-1/2 font-body text-[11px] text-secondary">Saving…</span>}
            <AnimatePresence>
              {justVoted && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6, x: -10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.85, x: 8 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-1.5 font-heading text-xs font-semibold whitespace-nowrap"
                  style={{ color: GOLD }}
                  aria-live="polite"
                >
                  <motion.span initial={{ rotate: -35, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 16 }}><Check size={15} /></motion.span>
                  Saved
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="relative flex h-7 items-center">
            <input
              id={`rate-me-${post.id}`}
              type="range"
              min="1"
              max="10"
              step="0.1"
              value={score}
              disabled={submitting || post.user_rating != null}
              aria-label={`Your rating for ${post.display_name}`}
              aria-valuetext={score.toFixed(1)}
              onPointerDown={event => event.stopPropagation()}
              onPointerUp={event => { event.stopPropagation(); handleScore(scoreRef.current) }}
              onKeyUp={event => {
                event.stopPropagation()
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) handleScore(scoreRef.current)
              }}
              onChange={event => {
                event.stopPropagation()
                const nextScore = Number(event.target.value)
                scoreRef.current = nextScore
                setScore(nextScore)
                setJustVoted(false)
              }}
              className="community-rating-slider block w-full touch-pan-x disabled:opacity-50"
              style={{ background: `linear-gradient(to right, ${GOLD} ${((score - 1) / 9) * 100}%, rgba(255,255,255,0.16) ${((score - 1) / 9) * 100}%)` }}
            />
            <AnimatePresence>
              {justVoted && (
                <motion.span
                  initial={{ opacity: 0.8, scale: 0.25 }}
                  animate={{ opacity: 0, scale: 2.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.65, ease: 'easeOut' }}
                  className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                  style={{ left: `${((score - 1) / 9) * 100}%`, borderColor: 'rgba(198,168,92,0.9)', boxShadow: '0 0 14px rgba(198,168,92,0.35)' }}
                  aria-hidden="true"
                />
              )}
            </AnimatePresence>
          </div>
          {voteError && <p className="mt-2 font-body text-xs" style={{ color: '#F87171' }} role="alert">{voteError}</p>}
      </div>
    </div>
  )
})

// ── Post card ─────────────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { value: 'spam',          label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'harassment',    label: 'Harassment or bullying' },
  { value: 'other',         label: 'Other' },
]

function ReportSheet({ postId, onClose }) {
  const [selected, setSelected] = useState('inappropriate')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setSubmitting(true)
    try {
      await api.post(`/community/post/${postId}/report`, { reason: selected })
      setDone(true)
      setTimeout(onClose, 1800)
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={SPRING_STANDARD}
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl px-5 pt-5 pb-10"
        style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Check size={32} style={{ color: '#34D399' }} />
            <p className="font-heading font-bold text-base text-primary">Report submitted</p>
            <p className="font-body text-sm text-secondary text-center">Thanks for keeping the community safe. We'll review it shortly.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading font-bold text-base text-primary">Report post</h3>
              <button onClick={() => { triggerHaptic(); onClose() }}><X size={18} style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
            </div>
            <p className="font-body text-sm text-secondary mb-4">Why are you reporting this post?</p>
            <div className="flex flex-col gap-2 mb-6">
              {REPORT_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => { triggerHaptic(); setSelected(r.value) }}
                  className="flex items-center justify-between px-4 py-3 rounded-xl text-left"
                  style={{
                    background: selected === r.value ? 'rgba(198,168,92,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selected === r.value ? 'rgba(198,168,92,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: selected === r.value ? GOLD_LINE_GLOW : 'none',
                  }}
                >
                  <span className="font-body text-sm text-primary">{r.label}</span>
                  {selected === r.value && <Check size={14} style={{ color: GOLD }} />}
                </button>
              ))}
            </div>
            <button
              onClick={() => { triggerHaptic(); submit() }}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: submitting ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.15)', color: submitting ? 'rgba(255,255,255,0.3)' : '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          </>
        )}
      </motion.div>
    </>
  )
}

export const PostCard = memo(function PostCard({ post, currentUserId, displayName, onLike, onOpenComments, onOpenPost, onDelete, onRate, previewOnly = false }) {
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [showReport, setShowReport]         = useState(false)
  const [showMenu, setShowMenu]             = useState(false)
  const isRateMe = post.post_type === 'rate-me'
  const isQuestion = post.post_type === 'question'

  const hasBefore = !!post.before_photo_url
  const hasAfter  = !!post.photo_url

  return (
    <motion.div
      variants={CARD_VARIANTS}
      initial="initial"
      animate="animate"
      onClick={onOpenPost ? () => onOpenPost(post) : undefined}
      onKeyDown={onOpenPost ? event => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenPost(post) }
      } : undefined}
      tabIndex={onOpenPost ? 0 : undefined}
      aria-label={onOpenPost ? `Open ${post.display_name}'s post` : undefined}
      className="rounded-2xl overflow-hidden mb-3"
      style={{ background: '#111111', border: BORDER, cursor: onOpenPost ? 'pointer' : undefined }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar name={post.display_name} />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-heading font-bold text-[13px] text-primary">{post.display_name}</p>
            {isRateMe && (
              <span className="text-[9px] font-heading font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(198,168,92,0.12)', color: GOLD }}>
                RATE ME
              </span>
            )}
            {!isRateMe && !isQuestion && (
              <span className="text-[9px] font-heading font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(198,168,92,0.12)', color: GOLD }}>
                GLOW UP
              </span>
            )}
            {isQuestion && (
              <span className="text-[9px] font-heading font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(198,168,92,0.12)', color: GOLD }}>
                QUESTION
              </span>
            )}
          </div>
          <p className="font-body text-[11px] text-secondary">{timeAgo(post.created_at)}</p>
        </div>
        {!!post.is_mine && (
          <div className="relative">
            <button
              onClick={event => { event.stopPropagation(); triggerHaptic(); setShowMenu(v => !v) }}
              className="p-1.5 rounded-lg"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <MoreVertical size={16} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={{    opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-8 rounded-xl overflow-hidden z-30"
                  style={{ background: '#222', border: '1px solid rgba(255,255,255,0.12)', minWidth: 140 }}
                  onClick={event => event.stopPropagation()}
                >
                  <button
                    onClick={event => { event.stopPropagation(); triggerHaptic(); setShowMenu(false); onDelete(post.id) }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-heading font-semibold"
                    style={{ color: '#ff6b6b', background: 'rgba(239,68,68,0.10)' }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Social post captions sit above their media */}
      {post.caption && (
        isQuestion ? (
          <p className="px-4 pb-3 font-body text-[13px] text-primary leading-snug">{post.caption}</p>
        ) : (
          <p className="px-4 pb-3 font-body text-[13px] text-primary leading-snug">{post.caption}</p>
        )
      )}

      {/* Rate Me photo (large, centered) */}
      {isRateMe && hasAfter && (
        <div className="px-3 pb-3">
          <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-2xl" style={{ aspectRatio: '4 / 5' }}>
            <div className="absolute inset-0">
            <TradingScanCard image={post.photo_url} imageAlt="Rate Me photo" compact />
            </div>
          </div>
        </div>
      )}

      {isQuestion && hasAfter && (
        <div className="px-3 pb-3">
          <div className="rounded-xl overflow-hidden">
            <img src={post.photo_url} alt="Photo attached to question" loading="lazy" decoding="async" className="w-full object-cover" style={{ maxHeight: 340 }} />
          </div>
        </div>
      )}

      {/* Glow-up Before / After photos */}
      {!isRateMe && !isQuestion && (hasBefore || hasAfter) && (
        <div className={`px-3 pb-3 ${hasBefore && hasAfter ? 'grid grid-cols-2 gap-2' : ''}`}>
          {hasBefore && (
            <div className={`relative overflow-hidden rounded-2xl ${hasBefore && hasAfter ? '' : 'mx-auto w-full max-w-[360px]'}`} style={{ aspectRatio: '4 / 5' }} aria-label={post.score_before != null ? `Before score ${post.score_before.toFixed(1)}` : 'Before photo'}>
              <div className="absolute inset-0">
                <TradingScanCard image={post.before_photo_url} imageAlt="Before scan" label="Before" score={post.score_before} compact />
              </div>
            </div>
          )}
          {hasAfter && (
            <div className={`relative overflow-hidden rounded-2xl ${hasBefore && hasAfter ? '' : 'mx-auto w-full max-w-[360px]'}`} style={{ aspectRatio: '4 / 5' }} aria-label={post.score_after != null ? `After score ${post.score_after.toFixed(1)}` : 'After photo'}>
              <div className="absolute inset-0">
                <TradingScanCard image={post.photo_url} imageAlt="After scan" label="After" score={post.score_after} compact />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rate Me scoring */}
      {isRateMe && (
        <RateMeScorer post={post} onRate={onRate} />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-3">
        <button
          onClick={event => { event.stopPropagation(); triggerHaptic(); onLike(post.id) }}
          className="community-like-button flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ color: post.user_liked ? GOLD : 'rgba(255,255,255,0.4)' }}
          aria-label={post.user_liked ? 'Unlike post' : 'Like post'}
        >
          <motion.span
            whileTap={{ scale: 0.78, rotate: post.user_liked ? -10 : 10 }}
            animate={{
              scale: post.user_liked ? [1, 1.28, 1] : 1,
              filter: post.user_liked ? 'drop-shadow(0 0 6px rgba(198,168,92,0.65))' : 'drop-shadow(0 0 0px rgba(198,168,92,0))',
            }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="inline-flex"
          >
            <Heart size={16} fill={post.user_liked ? GOLD : 'none'} />
          </motion.span>
          <span className="font-body text-[12px]">{post.likes_count ?? 0}</span>
        </button>
        <button
          onClick={event => { event.stopPropagation(); triggerHaptic(); onOpenComments(post) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <MessageCircle size={16} />
          <span className="font-body text-[12px]">{post.comments_count ?? 0}</span>
        </button>
        <div className="flex items-center gap-1 ml-auto">
          {!post.is_mine && !previewOnly && (
            <button
              onClick={event => { event.stopPropagation(); triggerHaptic(); setShowReport(true) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{ color: 'rgba(255,255,255,0.2)' }}
              aria-label="Report post"
            >
              <Flag size={14} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showShareSheet && (
          <PostShareSheet post={post} onClose={() => setShowShareSheet(false)} />
        )}
        {showReport && (
          <ReportSheet postId={post.id} onClose={() => setShowReport(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  )
})

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Community() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, scans, currentScan } = useStore()
  const [shareDraft, setShareDraft] = useState(() => location.state?.shareScanId ? {
    scanId: location.state.shareScanId, photo: location.state.sharePhoto,
  } : null)
  const scanToShare = shareDraft
    ? (currentScan?.id === shareDraft.scanId ? currentScan : scans.find(scan => scan.id === shareDraft.scanId))
    : null

  const [posts, setPosts]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [previewFeed, setPreviewFeed] = useState(false)
  const [showShare, setShowShare]   = useState(Boolean(shareDraft))
  const [activePost, setActivePost] = useState(null)
  const [showPostComments, setShowPostComments] = useState(false)
  const commentsSectionRef = useRef(null)

  const displayName = user?.name?.split(' ')[0] ?? 'Anonymous'

  const openPost = useCallback((post, withComments = false) => {
    setActivePost(post)
    setShowPostComments(withComments)
  }, [])

  const closePost = useCallback(() => {
    setActivePost(null)
    setShowPostComments(false)
  }, [])

  useEffect(() => {
    if (!activePost || !showPostComments) return
    const frame = requestAnimationFrame(() => commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [activePost?.id, showPostComments])

  function scrollToPostComments() {
    setShowPostComments(true)
    requestAnimationFrame(() => commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  useEffect(() => { loadFeed() }, [])
  useEffect(() => {
    if (location.state?.shareScanId) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  async function loadFeed() {
    setLoading(true)
    try {
      const { posts: p } = await api.community.feed()
      if (p?.length) {
        setPosts(p)
        setPreviewFeed(false)
      } else if (import.meta.env.DEV) {
        setPosts(withSampleLikeState())
        setPreviewFeed(true)
      } else {
        setPosts([])
        setPreviewFeed(false)
      }
    } catch {
      if (import.meta.env.DEV) {
        setPosts(withSampleLikeState())
        setPreviewFeed(true)
      } else {
        setPosts([])
        setPreviewFeed(false)
      }
    } finally { setLoading(false) }
  }

  const handleLike = useCallback(async (postId) => {
    if (String(postId).startsWith('sample-')) {
      const post = posts.find(item => item.id === postId)
      if (!post) return
      const liked = !post.user_liked
      const likesCount = Math.max(0, (post.likes_count || 0) + (liked ? 1 : -1))
      const likedIds = getSampleLikedIds()
      if (liked) likedIds.add(postId)
      else likedIds.delete(postId)
      try { localStorage.setItem(SAMPLE_LIKES_STORAGE_KEY, JSON.stringify([...likedIds])) } catch {}
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post
        return { ...post, user_liked: liked ? 1 : 0, likes_count: likesCount }
      }))
      setActivePost(current => current?.id === postId ? { ...current, user_liked: liked ? 1 : 0, likes_count: likesCount } : current)
      return
    }
    try {
      const { liked, likes } = await api.community.like(postId)
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, user_liked: liked ? 1 : 0, likes_count: likes } : p
      ))
      setActivePost(current => current?.id === postId ? { ...current, user_liked: liked ? 1 : 0, likes_count: likes } : current)
    } catch {}
  }, [posts])

  const handleDelete = useCallback(async (postId) => {
    try {
      await api.community.deletePost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
      setActivePost(current => current?.id === postId ? null : current)
    } catch {}
  }, [])

  const handleCommentAdded = useCallback(() => {
    setPosts(prev => prev.map(p =>
      p.id === activePost?.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
    ))
    setActivePost(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev)
  }, [activePost?.id])

  const handleRate = useCallback(async (postId, score) => {
    if (String(postId).startsWith('sample-')) {
      const post = posts.find(item => item.id === postId)
      if (!post) return
      const count = post.rating_count || 0
      const previous = post.user_rating
      const nextCount = previous == null ? count + 1 : count
      const nextAverage = previous == null
        ? ((Number(post.avg_rating || 0) * count) + score) / Math.max(nextCount, 1)
        : ((Number(post.avg_rating || 0) * count) - previous + score) / Math.max(count, 1)
      const updated = { ...post, avg_rating: nextAverage, rating_count: nextCount, user_rating: score }
      setPosts(prev => prev.map(item => item.id === postId ? updated : item))
      setActivePost(current => current?.id === postId ? { ...current, avg_rating: updated.avg_rating, rating_count: updated.rating_count, user_rating: updated.user_rating } : current)
      return true
    }
    try {
      const data = await api.community.rate(postId, score)
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, avg_rating: data.avg_rating, rating_count: data.rating_count, user_rating: data.user_rating }
          : p
      ))
      setActivePost(current => current?.id === postId ? {
        ...current,
        avg_rating: data.avg_rating,
        rating_count: data.rating_count,
        user_rating: data.user_rating,
      } : current)
      return true
    } catch (error) {
      throw error
    }
  }, [posts])

  return (
    <MotionPage
      className="px-4 pb-8"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        ...(activePost || showShare ? { overflow: 'hidden', touchAction: 'none' } : {}),
      }}
    >

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: GOLD }} />
        </div>
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-4 py-12 text-center"
          style={{ minHeight: 'calc(100vh - 160px)' }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.1)', border: '1px solid rgba(198,168,92,0.3)', boxShadow: GOLD_LINE_GLOW }}>
            <Users size={28} style={{ color: GOLD, filter: 'drop-shadow(0 0 6px rgba(198,168,92,0.65))' }} />
          </div>
          <p className="font-heading font-bold text-base text-primary">Be the first to share</p>
          <p className="font-body text-sm text-secondary max-w-[220px]">
            Share your glow-up and inspire others on their journey.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); setShowShare(true) }}
            className="w-full max-w-[260px] px-6 py-3 rounded-2xl font-heading font-bold text-sm"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
          >
            Share My Glow-Up
          </motion.button>
        </motion.div>
      ) : (
        <>
        {previewFeed && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl" style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.18)' }}>
            <Image size={13} style={{ color: GOLD }} />
            <p className="font-heading font-bold text-[10px] uppercase tracking-widest" style={{ color: GOLD }}>Sample feed · local preview</p>
          </div>
        )}
        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.id}
            displayName={displayName}
            onLike={handleLike}
            onOpenComments={post => openPost(post, true)}
            onOpenPost={post => openPost(post, false)}
            onDelete={handleDelete}
            onRate={handleRate}
            previewOnly={previewFeed}
          />
        ))}
        </>
      )}

      <AnimatePresence>
        {showShare && (
          <ShareModal
            onClose={() => { setShowShare(false); setShareDraft(null) }}
            onPosted={() => { setShowShare(false); setShareDraft(null); loadFeed() }}
            user={user}
            scans={scans}
            scanToShare={scanToShare}
            initialPhoto={shareDraft?.photo}
          />
        )}
      </AnimatePresence>
      {!activePost && !showShare && createPortal(
        <motion.button
          type="button"
          aria-label="Create a post"
          title="Create a post"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => { triggerHaptic(); setShowShare(true) }}
          className="fixed z-[60] flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            right: 20,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
            background: GOLD_GRADIENT,
            color: '#0A0A0A',
            boxShadow: '0 6px 22px rgba(198,168,92,0.32)',
          }}
        >
          <Plus size={22} strokeWidth={2.5} />
        </motion.button>,
        document.body,
      )}
      {activePost && createPortal(
            <motion.div
              key={`post-detail-${activePost.id}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex flex-col"
              style={{ background: '#0A0A0A', zIndex: 10050 }}
            >
              <div className="flex-shrink-0 flex items-center gap-3 px-4 border-b" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: 12, borderColor: BORDER, background: '#0A0A0A' }}>
                <button type="button" onClick={() => { triggerHaptic(); closePost() }} aria-label="Back to community feed" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#1A1A1A', border: `1px solid ${BORDER}`, color: 'rgba(255,255,255,0.75)' }}>
                  <ChevronLeft size={19} />
                </button>
                <div>
                  <p className="font-heading font-bold text-[11px] uppercase tracking-widest" style={{ color: GOLD }}>Community</p>
                  <p className="font-heading font-bold text-base text-primary">Post</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
                <PostCard
                  key={`post-card-detail-${activePost.id}`}
                  post={activePost}
                  currentUserId={user?.id}
                  displayName={displayName}
                  onLike={handleLike}
                  onOpenComments={scrollToPostComments}
                  onDelete={handleDelete}
                  onRate={handleRate}
                  previewOnly={previewFeed}
                />
                <CommentsSheet
                  key={`post-comments-${activePost.id}`}
                  post={activePost}
                  onCommentAdded={handleCommentAdded}
                  displayName={displayName}
                  previewOnly={previewFeed}
                  sectionRef={commentsSectionRef}
                />
              </div>
            </motion.div>
        , document.body
      )}
    </MotionPage>
  )
}
