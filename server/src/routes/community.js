const express = require('express')
const { v4: uuid } = require('uuid')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { createLimiter } = require('../middleware/ratelimit')

const router = express.Router()

// 20 posts per user per day — prevents spam
const checkPostLimit = createLimiter('community_post', 20, '24 h', 24 * 60 * 60 * 1000)

// ── GET /api/community/feed ───────────────────────────────────────────────────
router.get('/feed', authMiddleware, (req, res) => {
  const userId = req.userId
  const posts = db.prepare(`
    SELECT
      cp.*,
      (SELECT COUNT(*) FROM community_likes  WHERE post_id = cp.id) AS likes_count,
      (SELECT COUNT(*) FROM community_comments WHERE post_id = cp.id) AS comments_count,
      (SELECT COUNT(*) FROM community_likes  WHERE post_id = cp.id AND user_id = ?) AS user_liked
    FROM community_posts cp
    ORDER BY cp.created_at DESC
    LIMIT 60
  `).all(userId)

  res.json({ posts })
})

// ── POST /api/community/post ─────────────────────────────────────────────────
router.post('/post', authMiddleware, async (req, res) => {
  const allowed = await checkPostLimit(req.userId)
  if (!allowed) return res.status(429).json({ error: 'Slow down — too many posts today.' })

  const { displayName, scoreBefore, scoreAfter, photoUrl, beforePhotoUrl, caption } = req.body
  const id = uuid()

  db.prepare(`
    INSERT INTO community_posts (id, user_id, display_name, score_before, score_after, photo_url, before_photo_url, caption)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.userId,
    (displayName || 'Anonymous').slice(0, 30),
    scoreBefore    ?? null,
    scoreAfter     ?? null,
    photoUrl       || null,
    beforePhotoUrl || null,
    (caption       || '').slice(0, 280),
  )

  const post = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(id)
  res.json({ post })
})

// ── DELETE /api/community/post/:id ───────────────────────────────────────────
router.delete('/post/:id', authMiddleware, (req, res) => {
  const post = db.prepare('SELECT id FROM community_posts WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId)
  if (!post) return res.status(404).json({ error: 'Not found' })

  db.prepare('DELETE FROM community_comments WHERE post_id = ?').run(req.params.id)
  db.prepare('DELETE FROM community_likes    WHERE post_id = ?').run(req.params.id)
  db.prepare('DELETE FROM community_posts    WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── POST /api/community/post/:id/like — toggle ────────────────────────────────
router.post('/post/:id/like', authMiddleware, (req, res) => {
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
    'SELECT * FROM community_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 100'
  ).all(req.params.id)
  res.json({ comments })
})

// ── POST /api/community/post/:id/comment ─────────────────────────────────────
router.post('/post/:id/comment', authMiddleware, (req, res) => {
  const { content, displayName } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' })

  const id = uuid()
  db.prepare(
    'INSERT INTO community_comments (id, post_id, user_id, display_name, content) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.id, req.userId, (displayName || 'Anonymous').slice(0, 30), content.trim().slice(0, 500))

  const comment = db.prepare('SELECT * FROM community_comments WHERE id = ?').get(id)
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

module.exports = router
