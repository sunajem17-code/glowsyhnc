import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { GOLD, GOLD_GRADIENT } from '../../../utils/theme'
import { PostCard } from '../../Community'
import { COMMUNITY_DEMO_POST, COMMUNITY_DEMO_COMMENTS } from '../../../utils/tourDemoData'

// Reuses the real PostCard, fed a fake post + local-only handlers — no real
// community.* API calls, so the demo can't touch the live feed or fail
// against a post id that doesn't exist server-side. Comments use a bespoke
// local panel (not the real CommentsSheet, which does its own live fetch/post
// calls) for the same reason.
export default function CommunityDemoStep() {
  const [post, setPost] = useState(COMMUNITY_DEMO_POST)
  const [comments, setComments] = useState(COMMUNITY_DEMO_COMMENTS)
  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState('')

  function toggleLike() {
    setPost(p => ({
      ...p,
      user_liked: !p.user_liked,
      likes_count: p.likes_count + (p.user_liked ? -1 : 1),
    }))
  }

  function sendReply() {
    if (!draft.trim()) return
    setComments(c => [...c, { id: `local-${Date.now()}`, display_name: 'You', text: draft.trim(), created_at: new Date().toISOString() }])
    setPost(p => ({ ...p, comments_count: p.comments_count + 1 }))
    setDraft('')
  }

  return (
    <div className="h-full flex flex-col justify-center pb-6 relative">
      <div className="text-center mb-4">
        <span className="font-heading font-bold text-[10px] tracking-[0.16em]" style={{ color: GOLD }}>COMMUNITY</span>
        <h2 className="font-heading font-bold text-[22px] leading-tight mt-1.5" style={{ color: '#F0EDE8', letterSpacing: '-0.01em' }}>
          People post their glow-ups
        </h2>
        <p className="font-body text-[13px] mt-1.5 max-w-[280px] mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Real posts, real feed — this one's a sample. Try liking it or leaving a reply.
        </p>
      </div>

      <div className="max-w-[300px] w-full mx-auto">
        <PostCard
          post={post}
          currentUserId="demo-user"
          displayName="You"
          onLike={toggleLike}
          onOpenComments={() => setShowComments(true)}
          onDelete={() => {}}
          onEdit={() => {}}
          onRate={() => {}}
        />
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-end"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => setShowComments(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
              className="w-full rounded-t-2xl flex flex-col"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 0, maxHeight: '70%' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="font-heading font-bold text-[13px]" style={{ color: '#F0EDE8' }}>Comments</p>
                <button onClick={() => setShowComments(false)} aria-label="Close comments" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                {comments.map(c => (
                  <div key={c.id}>
                    <p className="font-heading font-bold text-[12px]" style={{ color: '#F0EDE8' }}>{c.display_name}</p>
                    <p className="font-body text-[12.5px] leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendReply()}
                  placeholder="Write a reply…"
                  className="flex-1 px-3.5 py-2.5 rounded-xl font-body text-[13px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#F0EDE8' }}
                />
                <button
                  onClick={sendReply}
                  disabled={!draft.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30"
                  style={{ background: GOLD_GRADIENT }}
                >
                  <Send size={14} style={{ color: '#0A0A0A' }} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
