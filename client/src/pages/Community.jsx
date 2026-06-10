import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Share2, Plus, X, Send, Trash2, TrendingUp, Users, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'

const GOLD    = '#C6A85C'
const BORDER  = 'rgba(255,255,255,0.07)'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function Avatar({ name, size = 9 }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center flex-shrink-0 font-heading font-bold text-sm`}
      style={{ background: 'rgba(198,168,92,0.15)', color: GOLD, border: '1px solid rgba(198,168,92,0.2)' }}
    >
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
  )
}

// ── Comments sheet ────────────────────────────────────────────────────────────
function CommentsSheet({ post, onClose, onCommentAdded, userId, displayName }) {
  const [comments, setComments]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    api.community.comments(post.id)
      .then(({ comments: c }) => setComments(c || []))
      .finally(() => setLoading(false))
  }, [post.id])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const { comment } = await api.community.addComment(post.id, { content: text.trim(), displayName })
      setComments(prev => [...prev, comment])
      setText('')
      onCommentAdded()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {} finally { setSending(false) }
  }

  async function deleteComment(id) {
    try {
      await api.community.deleteComment(id)
      setComments(prev => prev.filter(c => c.id !== id))
    } catch {}
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl overflow-hidden"
      style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '75vh' }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
      </div>
      <div className="flex items-center justify-between px-4 pb-3 border-b" style={{ borderColor: BORDER }}>
        <p className="font-heading font-bold text-sm text-primary">Comments</p>
        <button onClick={onClose}><X size={18} style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: GOLD }} /></div>
        ) : comments.length === 0 ? (
          <p className="text-center text-secondary font-body text-sm py-8">Be the first to comment</p>
        ) : comments.map(c => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar name={c.display_name} size={8} />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-heading font-bold text-[12px] text-primary">{c.display_name}</span>
                <span className="text-[10px] text-secondary font-body">{timeAgo(c.created_at)}</span>
              </div>
              <p className="font-body text-[13px] text-primary leading-snug">{c.content}</p>
            </div>
            {c.user_id === userId && (
              <button onClick={() => deleteComment(c.id)}>
                <Trash2 size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 flex items-center gap-3 border-t" style={{ borderColor: BORDER, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <Avatar name={displayName} size={8} />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 bg-transparent font-body text-[13px] text-primary outline-none placeholder:text-secondary"
        />
        <button onClick={send} disabled={!text.trim() || sending}>
          <Send size={18} style={{ color: text.trim() ? GOLD : 'rgba(255,255,255,0.2)' }} />
        </button>
      </div>
    </motion.div>
  )
}

// ── Share glow-up modal ───────────────────────────────────────────────────────
function ShareModal({ onClose, onPosted, user, scans }) {
  const latestScan = scans[0]
  const prevScan   = scans.find((s, i) => i > 0)
  const scoreAfter  = latestScan?.glowScore ?? null
  const scoreBefore = prevScan?.glowScore   ?? null

  const [displayName, setDisplayName] = useState(user?.name?.split(' ')[0] ?? 'Anonymous')
  const [caption, setCaption]         = useState('')
  const [sharePhoto, setSharePhoto]   = useState(false)
  const [posting, setPosting]         = useState(false)
  const [err, setErr]                 = useState('')

  async function submit() {
    if (!latestScan) { setErr("You need a scan first."); return }
    setPosting(true)
    setErr('')
    try {
      await api.community.post({
        displayName,
        scoreBefore: scoreBefore ?? scoreAfter,
        scoreAfter,
        photoUrl: sharePhoto ? (latestScan.facePhotoUrl ?? null) : null,
        caption,
      })
      onPosted()
    } catch (e) {
      setErr(e.message || 'Failed to post. Try again.')
    } finally { setPosting(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full rounded-t-3xl p-5 pb-8"
        style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="font-heading font-bold text-base text-primary">Share Your Glow-Up</p>
          <button onClick={onClose}><X size={18} style={{ color: 'rgba(255,255,255,0.4)' }} /></button>
        </div>

        {/* Score preview */}
        {scoreAfter != null && (
          <div
            className="flex items-center gap-3 p-3 rounded-2xl mb-4"
            style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.18)' }}
          >
            <TrendingUp size={18} style={{ color: GOLD }} />
            <div>
              <p className="font-heading font-bold text-sm" style={{ color: GOLD }}>
                {scoreBefore != null && scoreBefore !== scoreAfter
                  ? `${scoreBefore.toFixed(1)} → ${scoreAfter.toFixed(1)}`
                  : `Score: ${scoreAfter.toFixed(1)}`}
              </p>
              <p className="font-body text-[11px] text-secondary">This will be visible on your post</p>
            </div>
          </div>
        )}

        {/* Display name */}
        <label className="block font-heading font-bold text-[11px] uppercase tracking-widest text-secondary mb-1.5">
          Display Name
        </label>
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value.slice(0, 30))}
          placeholder="Anonymous"
          className="w-full px-3 py-2.5 rounded-xl font-body text-sm text-primary mb-4 outline-none"
          style={{ background: '#242424', border: BORDER }}
        />

        {/* Caption */}
        <label className="block font-heading font-bold text-[11px] uppercase tracking-widest text-secondary mb-1.5">
          Caption (optional)
        </label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value.slice(0, 280))}
          placeholder="What worked for you?"
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl font-body text-sm text-primary mb-4 outline-none resize-none"
          style={{ background: '#242424', border: BORDER }}
        />

        {err && <p className="text-[12px] font-body mb-3" style={{ color: '#EF4444' }}>{err}</p>}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={posting}
          className="w-full py-3.5 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, #D4B96A, ${GOLD}, #A8893A)`, color: '#0A0A0A' }}
        >
          {posting ? <><Loader2 size={15} className="animate-spin" /> Posting…</> : 'Share Glow-Up'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────────
function PostCard({ post, currentUserId, displayName, onLike, onOpenComments, onDelete }) {
  const improvement = post.score_before != null && post.score_after != null
    ? (post.score_after - post.score_before).toFixed(1)
    : null
  const sign = improvement >= 0 ? '+' : ''

  async function handleShare() {
    const text = `${post.display_name} went ${post.score_before?.toFixed(1) ?? '?'} → ${post.score_after?.toFixed(1) ?? '?'} on Ascendus! 🔥 ascendus.store`
    if (navigator.share) {
      try { await navigator.share({ text }) } catch {}
    } else {
      navigator.clipboard?.writeText(text)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden mb-3"
      style={{ background: '#141414', border: BORDER }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar name={post.display_name} />
        <div className="flex-1">
          <p className="font-heading font-bold text-[13px] text-primary">{post.display_name}</p>
          <p className="font-body text-[11px] text-secondary">{timeAgo(post.created_at)}</p>
        </div>
        {improvement !== null && (
          <div
            className="px-2.5 py-1 rounded-full"
            style={{
              background: improvement >= 0 ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${improvement >= 0 ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            <span
              className="font-heading font-bold text-[12px]"
              style={{ color: improvement >= 0 ? '#34D399' : '#EF4444' }}
            >
              {sign}{improvement} pts
            </span>
          </div>
        )}
        {post.user_id === currentUserId && (
          <button onClick={() => onDelete(post.id)}>
            <Trash2 size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </button>
        )}
      </div>

      {/* Score bar */}
      {post.score_before != null && post.score_after != null && (
        <div className="px-4 pb-3 flex items-center gap-3">
          <span className="font-mono text-[13px] text-secondary">{post.score_before.toFixed(1)}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(post.score_after / 10) * 100}%` }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, #A8893A, ${GOLD})` }}
            />
          </div>
          <span className="font-mono font-bold text-[13px]" style={{ color: GOLD }}>{post.score_after.toFixed(1)}</span>
        </div>
      )}

      {/* Photo */}
      {post.photo_url && (
        <img
          src={post.photo_url}
          alt="Glow-up"
          className="w-full object-cover"
          style={{ maxHeight: 320 }}
        />
      )}

      {/* Caption */}
      {post.caption && (
        <p className="px-4 py-3 font-body text-[13px] text-primary leading-snug">{post.caption}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-3 border-t" style={{ borderColor: BORDER }}>
        <button
          onClick={() => onLike(post.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors"
          style={{ color: post.user_liked ? '#EF4444' : 'rgba(255,255,255,0.4)' }}
        >
          <Heart size={16} fill={post.user_liked ? '#EF4444' : 'none'} />
          <span className="font-body text-[12px]">{post.likes_count ?? 0}</span>
        </button>
        <button
          onClick={() => onOpenComments(post)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <MessageCircle size={16} />
          <span className="font-body text-[12px]">{post.comments_count ?? 0}</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl ml-auto"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          <Share2 size={16} />
        </button>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Community() {
  const { user, scans } = useStore()

  const [posts, setPosts]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [showShare, setShowShare]     = useState(false)
  const [activePost, setActivePost]   = useState(null) // for comments

  const displayName = user?.name?.split(' ')[0] ?? 'Anonymous'

  useEffect(() => {
    loadFeed()
  }, [])

  async function loadFeed() {
    setLoading(true)
    try {
      const { posts: p } = await api.community.feed()
      setPosts(p || [])
    } catch {} finally { setLoading(false) }
  }

  async function handleLike(postId) {
    try {
      const { liked, likes } = await api.community.like(postId)
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, user_liked: liked ? 1 : 0, likes_count: likes }
          : p
      ))
    } catch {}
  }

  async function handleDelete(postId) {
    try {
      await api.community.deletePost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch {}
  }

  function handleCommentAdded() {
    setPosts(prev => prev.map(p =>
      p.id === activePost?.id
        ? { ...p, comments_count: (p.comments_count || 0) + 1 }
        : p
    ))
  }

  return (
    <MotionPage className="px-4 pb-8">
      <div className="flex items-center justify-between pt-14 pb-5">
        <div>
          <p className="text-[11px] text-secondary font-body uppercase tracking-widest mb-0.5">Community</p>
          <h1 className="font-heading font-bold text-[26px] text-primary" style={{ letterSpacing: '-0.02em' }}>
            Glow-Ups
          </h1>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-heading font-bold text-[12px]"
          style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.25)', color: GOLD }}
        >
          <Plus size={14} /> Share yours
        </motion.button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: GOLD }} />
        </div>
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 py-16 text-center"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(198,168,92,0.08)', border: '1px solid rgba(198,168,92,0.15)' }}>
            <Users size={28} style={{ color: 'rgba(198,168,92,0.5)' }} />
          </div>
          <p className="font-heading font-bold text-base text-primary">Be the first to share</p>
          <p className="font-body text-sm text-secondary max-w-[220px]">
            Share your glow-up and inspire others on their journey.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowShare(true)}
            className="px-6 py-3 rounded-2xl font-heading font-bold text-sm"
            style={{ background: `linear-gradient(135deg, #D4B96A, ${GOLD}, #A8893A)`, color: '#0A0A0A' }}
          >
            Share My Glow-Up
          </motion.button>
        </motion.div>
      ) : (
        posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.id}
            displayName={displayName}
            onLike={handleLike}
            onOpenComments={setActivePost}
            onDelete={handleDelete}
          />
        ))
      )}

      {/* Modals */}
      <AnimatePresence>
        {showShare && (
          <ShareModal
            onClose={() => setShowShare(false)}
            onPosted={() => { setShowShare(false); loadFeed() }}
            user={user}
            scans={scans}
          />
        )}
        {activePost && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setActivePost(null)}
            />
            <CommentsSheet
              post={activePost}
              onClose={() => setActivePost(null)}
              onCommentAdded={handleCommentAdded}
              userId={user?.id}
              displayName={displayName}
            />
          </>
        )}
      </AnimatePresence>
    </MotionPage>
  )
}
