const express = require('express')
const { v4: uuid } = require('uuid')
const db = require('../db')
// authMiddleware rejects the demo-token used by "Try Demo" (it's not a real
// JWT), which silently broke every community action for demo sessions.
// verifyToken accepts demo-token as a rate-limited guest (req.userId='demo'),
// the same pattern already used for the Claude-gated routes.
const { verifyToken: authMiddleware } = require('../middleware/claudeGate')
const { createLimiter } = require('../middleware/ratelimit')

const router = express.Router()

// 20 posts per user per day — prevents spam
const checkPostLimit = createLimiter('community_post', 20, '24 h', 24 * 60 * 60 * 1000)

// ── GET /api/community/feed ───────────────────────────────────────────────────
router.get('/feed', authMiddleware, (req, res) => {
  const userId = req.userId
  const posts = db.prepare(`
    SELECT
      cp.id, cp.display_name, cp.score_before, cp.score_after,
      cp.photo_url, cp.before_photo_url, cp.caption, cp.post_type, cp.created_at,
      (cp.user_id = ?) AS is_mine,
      (SELECT COUNT(*) FROM community_likes    WHERE post_id = cp.id) AS likes_count,
      (SELECT COUNT(*) FROM community_comments WHERE post_id = cp.id) AS comments_count,
      (SELECT COUNT(*) FROM community_likes    WHERE post_id = cp.id AND user_id = ?) AS user_liked,
      (SELECT COUNT(*) FROM community_ratings  WHERE post_id = cp.id) AS rating_count,
      (SELECT ROUND(AVG(score), 1) FROM community_ratings WHERE post_id = cp.id) AS avg_rating,
      (SELECT score FROM community_ratings WHERE post_id = cp.id AND user_id = ?) AS user_rating
    FROM community_posts cp
    ORDER BY cp.created_at DESC
    LIMIT 60
  `).all(userId, userId, userId)

  res.json({ posts })
})

// ── POST /api/community/post ─────────────────────────────────────────────────
router.post('/post', authMiddleware, async (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up for a free account to share with the community.' })
  const allowed = await checkPostLimit(req.userId)
  if (!allowed) return res.status(429).json({ error: 'Slow down — too many posts today.' })

  const { displayName, scoreBefore, scoreAfter, photoUrl, beforePhotoUrl, caption, postType } = req.body
  const type = (postType === 'rate-me' ? 'rate-me' : 'glow-up')
  const id = uuid()

  try {
    db.prepare(`
      INSERT INTO community_posts (id, user_id, display_name, score_before, score_after, photo_url, before_photo_url, caption, post_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.userId,
      (displayName || 'Anonymous').slice(0, 30),
      scoreBefore    ?? null,
      scoreAfter     ?? null,
      photoUrl       || null,
      beforePhotoUrl || null,
      (caption       || '').slice(0, 280),
      type,
    )
  } catch (e) {
    console.error('[community post insert]', e?.message, e?.stack)
    return res.status(500).json({ error: 'Could not save your post. Please try again.' })
  }

  const post = db.prepare(`
    SELECT id, display_name, score_before, score_after, photo_url, before_photo_url,
           caption, post_type, created_at, 1 AS is_mine
    FROM community_posts WHERE id = ?
  `).get(id)
  res.json({ post })
})

// ── PATCH /api/community/post/:id ────────────────────────────────────────────
router.patch('/post/:id', authMiddleware, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to edit posts.' })

  const existing = db.prepare('SELECT id, user_id FROM community_posts WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Post not found.' })
  if (existing.user_id !== req.userId) return res.status(403).json({ error: 'Not your post.' })

  const { caption, displayName } = req.body
  db.prepare(`
    UPDATE community_posts
    SET caption = COALESCE(?, caption), display_name = COALESCE(?, display_name)
    WHERE id = ?
  `).run(
    caption      != null ? caption.slice(0, 280)      : null,
    displayName  != null ? displayName.slice(0, 30)   : null,
    req.params.id,
  )

  const updated = db.prepare(
    'SELECT id, display_name, caption FROM community_posts WHERE id = ?'
  ).get(req.params.id)
  res.json({ post: updated })
})

// ── DELETE /api/community/post/:id ───────────────────────────────────────────
router.delete('/post/:id', authMiddleware, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to delete posts.' })

  const existing = db.prepare('SELECT id, user_id FROM community_posts WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Post not found.' })
  if (existing.user_id !== req.userId) return res.status(403).json({ error: 'Not your post.' })

  db.prepare('DELETE FROM community_comments WHERE post_id = ?').run(req.params.id)
  db.prepare('DELETE FROM community_likes    WHERE post_id = ?').run(req.params.id)
  db.prepare('DELETE FROM community_ratings  WHERE post_id = ?').run(req.params.id)
  db.prepare('DELETE FROM community_reports  WHERE post_id = ?').run(req.params.id)
  db.prepare('DELETE FROM community_posts    WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── POST /api/community/post/:id/like — toggle ────────────────────────────────
router.post('/post/:id/like', authMiddleware, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to like posts.' })
  const postId   = req.params.id
  const existing = db.prepare('SELECT id FROM community_likes WHERE post_id = ? AND user_id = ?')
    .get(postId, req.userId)

  if (existing) {
    db.prepare('DELETE FROM community_likes WHERE post_id = ? AND user_id = ?').run(postId, req.userId)
  } else {
    db.prepare('INSERT INTO community_likes (id, post_id, user_id) VALUES (?, ?, ?)').run(uuid(), postId, req.userId)
  }

  const { c: likes } = db.prepare('SELECT COUNT(*) AS c FROM community_likes WHERE post_id = ?').get(postId)
  res.json({ liked: !existing, likes })
})

// ── GET /api/community/post/:id/comments ─────────────────────────────────────
router.get('/post/:id/comments', authMiddleware, (req, res) => {
  const comments = db.prepare(
    'SELECT id, post_id, display_name, content, created_at FROM community_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 100'
  ).all(req.params.id)
  res.json({ comments })
})

// ── POST /api/community/post/:id/comment ─────────────────────────────────────
router.post('/post/:id/comment', authMiddleware, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to comment.' })
  const { content, displayName } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' })

  const id = uuid()
  db.prepare(
    'INSERT INTO community_comments (id, post_id, user_id, display_name, content) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.id, req.userId, (displayName || 'Anonymous').slice(0, 30), content.trim().slice(0, 500))

  const comment = db.prepare(
    'SELECT id, post_id, display_name, content, created_at FROM community_comments WHERE id = ?'
  ).get(id)
  res.json({ comment })
})

// ── DELETE /api/community/comment/:id ────────────────────────────────────────
router.delete('/comment/:id', authMiddleware, (req, res) => {
  const comment = db.prepare('SELECT id FROM community_comments WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId)
  if (!comment) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM community_comments WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── POST /api/community/post/:id/rate — submit or update a 1-10 rating ───────
router.post('/post/:id/rate', authMiddleware, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to rate posts.' })
  const postId = req.params.id
  const post   = db.prepare('SELECT id, post_type FROM community_posts WHERE id = ?').get(postId)
  if (!post)                      return res.status(404).json({ error: 'Post not found' })
  if (post.post_type !== 'rate-me') return res.status(400).json({ error: 'This post does not accept ratings' })

  const score = parseInt(req.body.score, 10)
  if (isNaN(score) || score < 1 || score > 10) {
    return res.status(400).json({ error: 'Score must be 1–10' })
  }

  // Upsert: update if user already rated, insert otherwise
  const existing = db.prepare('SELECT id FROM community_ratings WHERE post_id = ? AND user_id = ?')
    .get(postId, req.userId)
  if (existing) {
    db.prepare('UPDATE community_ratings SET score = ? WHERE post_id = ? AND user_id = ?')
      .run(score, postId, req.userId)
  } else {
    db.prepare('INSERT INTO community_ratings (id, post_id, user_id, score) VALUES (?, ?, ?, ?)')
      .run(uuid(), postId, req.userId, score)
  }

  const row = db.prepare('SELECT COUNT(*) AS c, ROUND(AVG(score), 1) AS avg FROM community_ratings WHERE post_id = ?').get(postId)
  res.json({ rating_count: row.c, avg_rating: row.avg, user_rating: score })
})

// ── POST /api/community/post/:id/report ──────────────────────────────────────
// Required by Apple App Store Guidelines 1.2 for apps with user-generated content.
// Post is flagged for review — NOT auto-deleted. One report per user per post.
router.post('/post/:id/report', authMiddleware, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to report posts.' })
  const postId = req.params.id
  const post = db.prepare('SELECT id FROM community_posts WHERE id = ?').get(postId)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  const VALID_REASONS = ['spam', 'inappropriate', 'harassment', 'other']
  const reason = VALID_REASONS.includes(req.body.reason) ? req.body.reason : 'inappropriate'

  try {
    db.prepare(
      'INSERT OR IGNORE INTO community_reports (id, post_id, reporter_id, reason) VALUES (?, ?, ?, ?)'
    ).run(uuid(), postId, req.userId, reason)
    console.log(`[community] report filed: post=${postId} by=${req.userId} reason=${reason}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[community report]', err.message)
    res.status(500).json({ error: 'Could not file report. Please try again.' })
  }
})

module.exports = router
