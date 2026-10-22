import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Heart, MessageCircle, Share2, Plus, X, Send, Trash2, Pencil, MoreVertical, TrendingUp, Users, Loader2, Copy, Image, Check, Star, BarChart2, Flag, Settings, ChevronLeft } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { isPhysiqueProgressScan } from '../utils/progressHistory'
import { loadScanMedia } from '../utils/scanPhotoDb'
import demoMaleScan from '../assets/face-metrics-demo-cropped.jpg'
import demoFemaleScan from '../assets/face-metrics-demo-female.jpg'
import demoMaleScanOverlay from '../assets/face-metrics-demo.jpg'

const BORDER = 'rgba(255,255,255,0.07)'
const GOLD_LINE_GLOW = '0 0 14px rgba(198,168,92,0.4), 0 0 28px rgba(198,168,92,0.18), inset 0 0 10px rgba(198,168,92,0.1)'
const SAMPLE_LIKES_STORAGE_KEY = 'community.sample-liked-posts'

const SAMPLE_COMMUNITY_POSTS = [
  { id: 'sample-1', display_name: 'Jordan', post_type: 'glow-up', created_at: new Date(Date.now() - 18 * 60_000).toISOString(), score_before: 6.2, score_after: 7.4, before_photo_url: demoMaleScan, photo_url: demoMaleScanOverlay, caption: 'Six weeks of consistency is starting to show.', likes_count: 28, comments_count: 6, sample_comments: [{ id: 'sample-1-comment-1', display_name: 'Maya', content: 'The progress is really clear!', created_at: new Date(Date.now() - 10 * 60_000).toISOString() }, { id: 'sample-1-comment-2', display_name: 'Ethan', content: 'Consistency pays off. Nice work.', created_at: new Date(Date.now() - 5 * 60_000).toISOString() }] },
  { id: 'sample-2', display_name: 'Maya', post_type: 'rate-me', created_at: new Date(Date.now() - 52 * 60_000).toISOString(), photo_url: demoFemaleScan, avg_rating: 8.1, rating_count: 24, caption: 'Trying a new haircut. What do you think?', likes_count: 17, comments_count: 4, sample_comments: [{ id: 'sample-2-comment-1', display_name: 'Sofia', content: 'That style suits you!', created_at: new Date(Date.now() - 30 * 60_000).toISOString() }] },
  { id: 'sample-3', display_name: 'Ethan', post_type: 'glow-up', created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), score_before: 5.8, score_after: 6.6, before_photo_url: demoMaleScanOverlay, photo_url: demoMaleScan, caption: 'Better sleep and a simpler routine.', likes_count: 21, comments_count: 3, sample_comments: [{ id: 'sample-3-comment-1', display_name: 'Noah', content: 'What did you change in your routine?', created_at: new Date(Date.now() - 90 * 60_000).toISOString() }] },
  { id: 'sample-4', display_name: 'Ava', post_type: 'rate-me', created_at: new Date(Date.now() - 4 * 60 * 60_000).toISOString(), photo_url: demoFemaleScan, avg_rating: 7.6, rating_count: 16, caption: 'New lighting setup for my scan. Any tips?', likes_count: 13, comments_count: 2, sample_comments: [{ id: 'sample-4-comment-1', display_name: 'Jordan', content: 'Natural window light usually works well.', created_at: new Date(Date.now() - 3 * 60 * 60_000).toISOString() }] },
  { id: 'sample-5', display_name: 'Noah', post_type: 'glow-up', created_at: new Date(Date.now() - 7 * 60 * 60_000).toISOString(), score_before: 6.5, score_after: 7.0, before_photo_url: demoMaleScan, photo_url: demoMaleScanOverlay, caption: 'Keeping the routine simple and sticking with it.', likes_count: 35, comments_count: 8, sample_comments: [{ id: 'sample-5-comment-1', display_name: 'Ethan', content: 'Simple routines are easier to stay consistent with.', created_at: new Date(Date.now() - 6 * 60 * 60_000).toISOString() }] },
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
        boxShadow: subtle ? '0 0 5px rgba(198,168,92,0.12), inset 0 0 3px rgba(198,168,92,0.05)' : GOLD_LINE_GLOW,
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
function FaceScanPhotoPicker({ label, value, onChange, photos, disabled }) {
  const [open, setOpen] = useState(false)
  const selected = photos.find(photo => photo.id === value?.id)

  return (
    <div className="flex-1 min-w-0">
      <p className="font-heading font-bold text-[11px] uppercase tracking-widest mb-1.5"
        style={{ color: 'rgba(255,255,255,0.35)' }}>
        {label}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { triggerHaptic(); setOpen(value ? !open : true) }}
        className="relative w-full rounded-2xl overflow-hidden flex items-center justify-center disabled:opacity-50"
        style={{ aspectRatio: '3/4', background: value ? 'transparent' : '#1C1C1C', border: `1.5px dashed ${value ? 'transparent' : 'rgba(255,255,255,0.12)'}` }}
      >
        {value ? (
          <>
            <img src={value.src} alt={`${label} face scan`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              style={{ background: 'rgba(0,0,0,0.38)' }}>
              <Image size={18} color="#fff" />
              <span className="font-body text-[10px] text-white">{selected?.date ?? 'Change scan'}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Image size={22} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span className="font-body text-[11px] text-center px-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {disabled ? 'No face scans yet' : 'Choose a face scan'}
            </span>
          </div>
        )}
      </button>
      {open && photos.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <button key={photo.id} type="button" onClick={() => { onChange(photo); setOpen(false); triggerHaptic() }}
              className="relative rounded-xl overflow-hidden aspect-[3/4]"
              style={{ border: `1px solid ${photo.id === value?.id ? GOLD : 'rgba(255,255,255,0.12)'}`, boxShadow: photo.id === value?.id ? GOLD_LINE_GLOW : 'none' }}>
              <img src={photo.src} alt={`Face scan from ${photo.date}`} className="w-full h-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 py-1 text-[9px] text-white text-center"
                style={{ background: 'rgba(0,0,0,0.7)' }}>{photo.date}</span>
            </button>
          ))}
        </div>
      )}
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
  const [displayName, setDisplayName] = useState(user?.name?.split(' ')[0] ?? 'Anonymous')
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
      const date = parsedDate && Number.isFinite(parsedDate.getTime())
        ? parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Face scan'
      return { id: scan.id ?? `face-scan-${index}`, src, date, score: getFaceScanOverallScore(scan) }
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
      style={{ background: '#141414', height: vvH, minHeight: vvH }}
    >
      <div className="w-full h-full min-h-0 flex flex-col" style={{ height: vvH }}>
        {/* Fixed header */}
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0 border-b" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', borderColor: BORDER }}>
          <div>
            <p className="font-heading font-bold text-[11px] uppercase tracking-widest mb-0.5" style={{ color: GOLD }}>Community</p>
            <p className="font-heading font-bold text-base text-primary">New Post</p>
          </div>
          <button type="button" aria-label="Close post composer" onClick={() => { triggerHaptic(); onClose() }} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#1C1C1C', border: `1px solid ${BORDER}` }}><X size={18} style={{ color: 'rgba(255,255,255,0.65)' }} /></button>
        </div>

        {/* Post type selector */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="flex gap-2 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.035)' }}>
            {[{ id: 'glow-up', icon: <TrendingUp size={13} />, label: 'Glow-Up' }, { id: 'rate-me', icon: <Star size={13} />, label: 'Rate Me' }, { id: 'question', icon: <MessageCircle size={13} />, label: 'Question' }].map(t => (
              <button
                key={t.id}
                onClick={() => { triggerHaptic(); setPostType(t.id) }}
                className="min-w-0 flex-1 flex items-center justify-center gap-1 py-2.5 px-1 rounded-xl font-heading font-bold text-[11px] transition-all"
                style={postType === t.id
                  ? { background: GOLD, color: '#0A0A0A' }
                  : { color: 'rgba(255,255,255,0.4)' }}
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
                <p className="font-heading font-bold text-[11px] uppercase tracking-widest text-secondary mb-3">
                  Before &amp; After Photos
                </p>
                <div className="flex gap-3">
                  <FaceScanPhotoPicker label="Before" value={beforePhoto} onChange={setBeforePhoto} photos={faceScanPhotos} disabled={loadingFacePhotos || !faceScanPhotos.length} />
                  <FaceScanPhotoPicker label="After"  value={afterPhoto}  onChange={setAfterPhoto}  photos={faceScanPhotos} disabled={loadingFacePhotos || !faceScanPhotos.length} />
                </div>
                {!loadingFacePhotos && !faceScanPhotos.length && (
                  <p className="font-body text-[11px] mt-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Complete a face scan first to choose a photo.
                  </p>
                )}
              </div>
              {/* Score preview */}
              {scoreAfter != null && (
                <div className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.18)', boxShadow: GOLD_LINE_GLOW }}>
                  <TrendingUp size={18} style={{ color: GOLD }} />
                  <div>
                    <p className="font-heading font-bold text-sm" style={{ color: GOLD }}>
                      {scoreBefore != null && scoreBefore !== scoreAfter
                        ? `${scoreBefore.toFixed(1)} → ${scoreAfter.toFixed(1)}`
                        : `Score: ${scoreAfter.toFixed(1)}`}
                    </p>
                    <p className="font-body text-[11px] text-secondary">Visible on your post</p>
                  </div>
                </div>
              )}
            </>
          ) : postType === 'rate-me' ? (
            <>
              <div>
                <p className="font-heading font-bold text-[11px] uppercase tracking-widest text-secondary mb-3">Your Photo</p>
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
              <div className="flex items-start gap-3 p-3 rounded-2xl" style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.14)' }}>
                <MessageCircle size={18} className="mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                <div>
                  <p className="font-heading font-bold text-sm text-primary">Ask the community</p>
                  <p className="font-body text-[12px] leading-relaxed text-secondary">Share what you’re working through and get advice in the comments.</p>
                </div>
              </div>
              <div>
                <p className="font-heading font-bold text-[11px] uppercase tracking-widest text-secondary mb-3">Photo (optional)</p>
                <div className="w-1/2 mx-auto">
                  <FaceScanPhotoPicker label="Add a face scan" value={questionPhoto} onChange={setQuestionPhoto} photos={faceScanPhotos} disabled={loadingFacePhotos || !faceScanPhotos.length} />
                </div>
                {!loadingFacePhotos && !faceScanPhotos.length && (
                  <p className="font-body text-[11px] mt-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>A photo is optional. Complete a face scan to attach one.</p>
                )}
              </div>
            </>
          )}

          {/* Display name */}
          <div>
            <label className="block font-heading font-bold text-[11px] uppercase tracking-widest text-secondary mb-1.5">
              Display Name
            </label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value.slice(0, 30))}
              placeholder="Anonymous"
              className="w-full px-3 py-2.5 rounded-xl font-body text-sm text-primary outline-none"
              style={{ background: '#1C1C1C', border: `1px solid ${BORDER}`, fontSize: 16 }}
            />
          </div>

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
              style={{ background: '#1C1C1C', border: `1px solid ${BORDER}`, fontSize: 16 }}
            />
          </div>

          {err && <p className="text-[12px] font-body" style={{ color: '#EF4444' }}>{err}</p>}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); submit() }}
            disabled={posting}
            className="w-full py-3.5 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A' }}
          >
            {posting
              ? <><Loader2 size={15} className="animate-spin" /> Posting…</>
              : postType === 'rate-me' ? <><Star size={14} /> Post for Rating</> : postType === 'question' ? <><MessageCircle size={14} /> Ask for Advice</> : 'Share Glow-Up'
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
const RateMeScorer = memo(function RateMeScorer({ post, currentUserId, onRate, previewOnly = false }) {
  const isOwn = !!post.is_mine
  const [hoveredScore, setHoveredScore] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const displayScore = hoveredScore ?? post.user_rating ?? null

  async function handleScore(score) {
    if (isOwn || submitting) return
    setSubmitting(true)
    try { await onRate(post.id, score) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="px-4 pb-4">
      {/* Avg + count */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          <Star size={14} fill={GOLD} style={{ color: GOLD }} />
          <span className="font-mono font-bold text-[15px]" style={{ color: GOLD }}>
            {post.avg_rating != null ? Number(post.avg_rating).toFixed(1) : 'N/A'}
          </span>
        </div>
        <span className="font-body text-[11px] text-secondary">
          {post.rating_count > 0 ? `${post.rating_count} vote${post.rating_count !== 1 ? 's' : ''}` : 'No ratings yet'}
        </span>
        {post.user_rating != null && !isOwn && (
          <span className="ml-auto font-body text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(198,168,92,0.12)', color: GOLD }}>
            You: {post.user_rating}/10
          </span>
        )}
      </div>

      {/* 1–10 score buttons */}
      {!isOwn && (
        <div>
          <p className="font-heading font-bold text-[10px] uppercase tracking-widest text-secondary mb-2">
            {post.user_rating != null ? 'Change your rating' : 'Rate this person'}
          </p>
          <div className="grid grid-cols-10 gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const filled = displayScore != null && n <= displayScore
              const isRated = post.user_rating === n
              return (
                <motion.button
                  key={n}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onPointerEnter={() => setHoveredScore(n)}
                  onPointerLeave={() => setHoveredScore(null)}
                  onClick={event => { event.stopPropagation(); triggerHaptic(); handleScore(n) }}
                  disabled={submitting}
                  aria-label={`Rate ${post.display_name} ${n} out of 10`}
                  aria-pressed={isRated}
                  className="relative z-10 pointer-events-auto touch-manipulation select-none aspect-square rounded-lg flex items-center justify-center font-heading font-bold text-[11px] transition-colors disabled:cursor-wait"
                  style={{
                    background: filled ? (n >= 8 ? 'rgba(52,199,89,0.25)' : n >= 5 ? 'rgba(198,168,92,0.25)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${filled ? (n >= 8 ? 'rgba(52,199,89,0.5)' : n >= 5 ? 'rgba(198,168,92,0.45)' : 'rgba(239,68,68,0.3)') : 'rgba(255,255,255,0.08)'}`,
                    color: filled ? (n >= 8 ? '#34C759' : n >= 5 ? GOLD : '#E07A5F') : 'rgba(255,255,255,0.35)',
                    outline: isRated ? `2px solid ${GOLD}` : 'none',
                    outlineOffset: 1,
                    boxShadow: isRated || (filled && n >= 5 && n < 8) ? GOLD_LINE_GLOW : 'none',
                  }}
                >
                  {n}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}
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

// ── EditSheet ─────────────────────────────────────────────────────────────────
function EditSheet({ post, onClose, onSaved }) {
  const [caption,     setCaption]     = useState(post.caption     ?? '')
  const [displayName, setDisplayName] = useState(post.display_name ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { post: updated } = await api.community.editPost(post.id, { caption, displayName })
      onSaved(updated)
      onClose()
    } catch (e) {
      setError(e?.message || 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{    y: 80, opacity: 0 }}
        transition={SPRING_STANDARD}
        className="w-full rounded-t-2xl p-6"
        style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-bold text-base text-primary">Edit Post</h3>
          <button onClick={() => { triggerHaptic(); onClose() }} className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        <label className="block text-[11px] font-heading font-semibold uppercase tracking-widest text-secondary mb-1.5">
          Display Name
        </label>
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value.slice(0, 30))}
          maxLength={30}
          className="w-full rounded-xl px-4 py-3 text-sm font-body text-primary mb-4"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
        />

        <label className="block text-[11px] font-heading font-semibold uppercase tracking-widest text-secondary mb-1.5">
          Caption <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span>
        </label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value.slice(0, 280))}
          maxLength={280}
          rows={3}
          placeholder="What's your story?"
          className="w-full rounded-xl px-4 py-3 text-sm font-body text-primary resize-none mb-1"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
        />
        <p className="text-[11px] text-right mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>{caption.length}/280</p>

        {error && <p className="text-[12px] text-red-400 mb-3">{error}</p>}

        <button
          onClick={() => { triggerHaptic(); handleSave() }}
          disabled={saving || !displayName.trim()}
          className="w-full py-3.5 rounded-xl font-heading font-bold text-sm flex items-center justify-center gap-2"
          style={{ background: GOLD, color: '#0A0A0A', opacity: (saving || !displayName.trim()) ? 0.5 : 1 }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : 'Save Changes'}
        </button>
      </motion.div>
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onCancel}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{    scale: 0.92, opacity: 0 }}
        className="w-full max-w-xs rounded-2xl p-6"
        style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="font-body text-sm text-primary mb-5 text-center leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={() => { triggerHaptic(); onCancel() }}
            className="flex-1 py-3 rounded-xl font-heading font-bold text-[13px]"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => { triggerHaptic(); onConfirm() }}
            className="flex-1 py-3 rounded-xl font-heading font-bold text-[13px]"
            style={{ background: '#c0392b', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export const PostCard = memo(function PostCard({ post, currentUserId, displayName, onLike, onOpenComments, onOpenPost, onDelete, onEdit, onRate, previewOnly = false }) {
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [showReport, setShowReport]         = useState(false)
  const [showMenu, setShowMenu]             = useState(false)
  const [showEdit, setShowEdit]             = useState(false)
  const isRateMe = post.post_type === 'rate-me'
  const isQuestion = post.post_type === 'question'

  const improvement = post.score_before != null && post.score_after != null
    ? (post.score_after - post.score_before).toFixed(1)
    : null
  const sign = improvement >= 0 ? '+' : ''

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
      style={{ background: '#141414', border: BORDER, cursor: onOpenPost ? 'pointer' : undefined }}
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
            {isQuestion && (
              <span className="flex items-center gap-1 text-[9px] font-heading font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(198,168,92,0.12)', color: GOLD }}>
                <MessageCircle size={10} /> QUESTION
              </span>
            )}
          </div>
          <p className="font-body text-[11px] text-secondary">{timeAgo(post.created_at)}</p>
        </div>
        {!isRateMe && improvement !== null && (
          <div className="px-2.5 py-1 rounded-full" style={{
            background: improvement >= 0 ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${improvement >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            <span className="font-heading font-bold text-[12px]"
              style={{ color: improvement >= 0 ? '#34D399' : '#EF4444' }}>
              {sign}{improvement} pts
            </span>
          </div>
        )}
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
                >
                  <button
                    onClick={() => { triggerHaptic(); setShowMenu(false); setShowEdit(true) }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-body text-primary"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <Pencil size={13} style={{ color: GOLD }} /> Edit
                  </button>
                  <button
                    onClick={() => { triggerHaptic(); setShowMenu(false); onDelete(post.id) }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-body"
                    style={{ color: '#ef4444' }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      <AnimatePresence>
        {showEdit && (
          <EditSheet
            post={post}
            onClose={() => setShowEdit(false)}
            onSaved={updated => onEdit(post.id, updated)}
          />
        )}
      </AnimatePresence>

      {/* Score bar (glow-up only) */}
      {!isRateMe && post.score_before != null && post.score_after != null && (
        <div className="px-4 pb-3 flex items-center gap-3">
          <span className="font-mono text-[13px] text-secondary">{post.score_before.toFixed(1)}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(post.score_after / 10) * 100}%` }}
              transition={{ duration: 1, ease: EASE_STANDARD }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, #A8893A, ${GOLD})` }}
            />
          </div>
          <span className="font-mono font-bold text-[13px]" style={{ color: GOLD }}>{post.score_after.toFixed(1)}</span>
        </div>
      )}

      {/* Rate Me photo (large, centered) */}
      {isRateMe && hasAfter && (
        <div className="px-3 pb-3">
          <div className="rounded-xl overflow-hidden">
            <img src={post.photo_url} alt="Rate Me" loading="lazy" decoding="async" className="w-full object-cover" style={{ maxHeight: 340 }} />
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
            <div className="relative rounded-xl overflow-hidden">
              <img src={post.before_photo_url} alt="Before" loading="lazy" decoding="async" className="w-full object-cover" style={{ maxHeight: 280 }} />
              <div className="absolute bottom-0 inset-x-0 py-1 flex justify-center"
                style={{ background: 'rgba(0,0,0,0.55)' }}>
                <span className="font-heading font-bold text-[11px] text-white tracking-wider">BEFORE</span>
              </div>
            </div>
          )}
          {hasAfter && (
            <div className="relative rounded-xl overflow-hidden">
              <img src={post.photo_url} alt="After" loading="lazy" decoding="async" className="w-full object-cover" style={{ maxHeight: 280 }} />
              <div className="absolute bottom-0 inset-x-0 py-1 flex justify-center"
                style={{ background: 'rgba(0,0,0,0.55)' }}>
                <span className="font-heading font-bold text-[11px]" style={{ color: GOLD }}>AFTER</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        isQuestion ? (
          <div className="mx-3 mb-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(198,168,92,0.055)', border: '1px solid rgba(198,168,92,0.12)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <MessageCircle size={13} style={{ color: GOLD }} />
              <span className="font-heading font-bold text-[10px] uppercase tracking-widest" style={{ color: GOLD }}>Question</span>
            </div>
            <p className="font-body text-[15px] text-primary leading-relaxed">{post.caption}</p>
          </div>
        ) : (
          <p className="px-4 py-2 font-body text-[13px] text-primary leading-snug">{post.caption}</p>
        )
      )}

      {/* Rate Me scoring */}
      {isRateMe && (
        <RateMeScorer post={post} currentUserId={currentUserId} onRate={onRate} />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-3 border-t" style={{ borderColor: BORDER }}>
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
          {!isRateMe && (
            <button
              onClick={event => { event.stopPropagation(); triggerHaptic(); setShowShareSheet(true) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <Share2 size={16} />
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

  const [confirmDelete, setConfirmDelete] = useState(null) // postId pending confirm

  const handleDelete = useCallback((postId) => {
    setConfirmDelete(postId)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    const postId = confirmDelete
    setConfirmDelete(null)
    try {
      await api.community.deletePost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch {}
  }, [confirmDelete])

  const handleEdit = useCallback((postId, updated) => {
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, caption: updated.caption, display_name: updated.display_name }
        : p
    ))
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
      return
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
    } catch {}
  }, [posts])

  return (
    <MotionPage className="px-4 pb-8" style={activePost || showShare ? { overflow: 'hidden', touchAction: 'none' } : undefined}>
      <div className="flex items-center justify-between pb-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <div>
          <p className="text-[11px] text-secondary font-body uppercase tracking-widest mb-0.5">Community</p>
          <h1 className="font-heading font-bold text-[26px] text-primary" style={{ letterSpacing: '-0.02em' }}>
            Feed
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { triggerHaptic(); setShowShare(true) }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-heading font-bold text-[12px]"
            style={{ background: 'rgba(198,168,92,0.14)', border: '1px solid rgba(198,168,92,0.4)', color: GOLD, boxShadow: GOLD_LINE_GLOW }}
          >
            <Plus size={14} /> Post
          </motion.button>
          <button
            onClick={() => { triggerHaptic(); navigate('/settings') }}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            aria-label="Settings"
          >
            <Settings size={17} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

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
            onEdit={handleEdit}
            onRate={handleRate}
            previewOnly={previewFeed}
          />
        ))}
        </>
      )}

      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            message="Delete this post? This can't be undone."
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
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
                  onEdit={handleEdit}
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
