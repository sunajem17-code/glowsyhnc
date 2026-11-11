const express = require('express')
const { v4: uuid } = require('uuid')
const db = require('../db')
// authMiddleware rejects the demo-token used by "Try Demo" (it's not a real
// JWT), which silently broke every community action for demo sessions.
// verifyToken accepts demo-token as a rate-limited guest (req.userId='demo'),
// the same pattern already used for the Claude-gated routes.
const { verifyToken: authMiddleware, requirePro } = require('../middleware/claudeGate')
const { communityScanScores } = require('../lib/communityScanScores')
const { ownedCoachScan } = require('../lib/coachScanContext')
const { createLimiter } = require('../middleware/ratelimit')
const crypto = require('crypto')
const { findObjectionableContent, OBJECTIONABLE_MESSAGE } = require('../lib/contentFilter')
const { notifyModerators } = require('../lib/moderationAlert')

const router = express.Router()

// 20 posts per user per day — prevents spam
const checkPostLimit = createLimiter('community_post', 20, '24 h', 24 * 60 * 60 * 1000)

// ── Community safety (App Store Guideline 1.2) ────────────────────────────────
// Users must accept the community guidelines before they can see or use the
// community, objectionable text is rejected, content can be reported and users
// blocked, and moderators can remove content and ban users.
const TERMS_VERSION = '2026-11'
const AUTO_HIDE_REPORTS = 3 // distinct reports that hide a post until it is reviewed

function hasAcceptedTerms(userId) {
  if (userId === 'demo') return true // demo sessions are read-only guests
  return Boolean(db.prepare('SELECT 1 FROM community_terms_acceptances WHERE user_id = ?').get(userId))
}
function isBanned(userId) {
  return Boolean(db.prepare('SELECT 1 FROM community_bans WHERE user_id = ?').get(userId))
}
function requireTerms(req, res, next) {
  if (!hasAcceptedTerms(req.userId)) {
    return res.status(403).json({ code: 'terms_required', error: 'Please accept the Community Guidelines to continue.' })
  }
  next()
}
function requireNotBanned(req, res, next) {
  if (isBanned(req.userId)) {
    return res.status(403).json({ code: 'community_banned', error: 'Your access to the community has been removed for violating the Community Guidelines.' })
  }
  next()
}
const communityGuards = [requireTerms, requireNotBanned]

function removePostCascade(postId) {
  db.prepare('DELETE FROM community_comment_reports WHERE comment_id IN (SELECT id FROM community_comments WHERE post_id = ?)').run(postId)
  db.prepare('DELETE FROM community_comments WHERE post_id = ?').run(postId)
  db.prepare('DELETE FROM community_likes    WHERE post_id = ?').run(postId)
  db.prepare('DELETE FROM community_ratings  WHERE post_id = ?').run(postId)
  db.prepare('DELETE FROM community_reports  WHERE post_id = ?').run(postId)
  db.prepare('DELETE FROM community_posts    WHERE id = ?').run(postId)
}

// ── GET /api/community/terms — has this user accepted the guidelines? ─────────
router.get('/terms', authMiddleware, (req, res) => {
  // Demo/guest-token sessions can't persist acceptance, so they are always asked (client keeps a session flag).
  res.json({ accepted: req.userId === 'demo' ? false : hasAcceptedTerms(req.userId), version: TERMS_VERSION, banned: isBanned(req.userId) })
})

// ── POST /api/community/terms/accept ─────────────────────────────────────────
router.post('/terms/accept', authMiddleware, (req, res) => {
  if (req.userId !== 'demo') {
    db.prepare(`
      INSERT INTO community_terms_acceptances (user_id, version) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET version = excluded.version, accepted_at = datetime('now')
    `).run(req.userId, TERMS_VERSION)
  }
  res.json({ accepted: true, version: TERMS_VERSION })
})

// ── GET /api/community/feed ───────────────────────────────────────────────────
router.get('/feed', authMiddleware, requireTerms, (req, res) => {
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
    WHERE (cp.user_id = ? OR (
            COALESCE(cp.hidden, 0) = 0
        AND cp.user_id NOT IN (SELECT blocked_id FROM community_blocks WHERE blocker_id = ?)
        AND cp.user_id NOT IN (SELECT user_id FROM community_bans)
        AND cp.id NOT IN (SELECT post_id FROM community_reports WHERE reporter_id = ?)
      ))
    ORDER BY cp.created_at DESC
    LIMIT 60
  `).all(userId, userId, userId, userId, userId, userId)

  res.json({ posts })
})

// ── POST /api/community/post ─────────────────────────────────────────────────
router.post('/post', authMiddleware, requirePro, ...communityGuards, async (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up for a free account to share with the community.' })
  if (findObjectionableContent(req.body?.caption, req.body?.displayName)) return res.status(400).json({ error: OBJECTIONABLE_MESSAGE })
  const allowed = await checkPostLimit(req.userId)
  if (!allowed) return res.status(429).json({ error: 'Slow down — too many posts today.' })

  const { displayName, beforeScanId, afterScanId, photoUrl, beforePhotoUrl, caption, postType } = req.body
  const type = ['rate-me', 'question'].includes(postType) ? postType : 'glow-up'
  const id = uuid()

  try {
    const scores = await communityScanScores({ isPro: req.isPro, userId: req.userId, postType: type, beforeScanId, afterScanId, ownedScan: ownedCoachScan })
    db.prepare(`
      INSERT INTO community_posts (id, user_id, display_name, score_before, score_after, photo_url, before_photo_url, caption, post_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.userId,
      (displayName || 'Anonymous').slice(0, 30),
      scores.before,
      scores.after,
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

// ── DELETE /api/community/post/:id ───────────────────────────────────────────
router.delete('/post/:id', authMiddleware, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to delete posts.' })

  const existing = db.prepare('SELECT id, user_id FROM community_posts WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Post not found.' })
  if (existing.user_id !== req.userId) return res.status(403).json({ error: 'Not your post.' })

  removePostCascade(req.params.id)
  res.json({ ok: true })
})

// ── POST /api/community/post/:id/like — toggle ────────────────────────────────
router.post('/post/:id/like', authMiddleware, requirePro, ...communityGuards, (req, res) => {
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
router.get('/post/:id/comments', authMiddleware, requireTerms, (req, res) => {
  const comments = db.prepare(`
    SELECT id, post_id, display_name, content, created_at, (user_id = ?) AS is_mine
    FROM community_comments
    WHERE post_id = ?
      AND (user_id = ? OR (
            COALESCE(hidden, 0) = 0
        AND user_id NOT IN (SELECT blocked_id FROM community_blocks WHERE blocker_id = ?)
        AND user_id NOT IN (SELECT user_id FROM community_bans)
        AND id NOT IN (SELECT comment_id FROM community_comment_reports WHERE reporter_id = ?)
      ))
    ORDER BY created_at ASC LIMIT 100
  `).all(req.userId, req.params.id, req.userId, req.userId, req.userId)
  res.json({ comments })
})

// ── POST /api/community/post/:id/comment ─────────────────────────────────────
router.post('/post/:id/comment', authMiddleware, requirePro, ...communityGuards, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to comment.' })
  const { content, displayName } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' })
  if (findObjectionableContent(content, displayName)) return res.status(400).json({ error: OBJECTIONABLE_MESSAGE })

  const id = uuid()
  db.prepare(
    'INSERT INTO community_comments (id, post_id, user_id, display_name, content) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.params.id, req.userId, (displayName || 'Anonymous').slice(0, 30), content.trim().slice(0, 500))

  const comment = db.prepare(
    'SELECT id, post_id, display_name, content, created_at, 1 AS is_mine FROM community_comments WHERE id = ?'
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
router.post('/post/:id/rate', authMiddleware, requirePro, ...communityGuards, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to rate posts.' })
  const postId = req.params.id
  const post   = db.prepare('SELECT id, post_type FROM community_posts WHERE id = ?').get(postId)
  if (!post)                      return res.status(404).json({ error: 'Post not found' })
  if (post.post_type !== 'rate-me') return res.status(400).json({ error: 'This post does not accept ratings' })

  const submittedScore = req.body.score
  if (typeof submittedScore !== 'number' || !Number.isFinite(submittedScore) || submittedScore < 1 || submittedScore > 10) {
    return res.status(400).json({ error: 'Score must be 1–10' })
  }
  const score = Math.round(submittedScore * 10) / 10

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
router.post('/post/:id/report', authMiddleware, requireTerms, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to report posts.' })
  const postId = req.params.id
  const post = db.prepare('SELECT id, user_id, caption FROM community_posts WHERE id = ?').get(postId)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  const VALID_REASONS = ['spam', 'inappropriate', 'harassment', 'other']
  const reason = VALID_REASONS.includes(req.body.reason) ? req.body.reason : 'inappropriate'

  try {
    db.prepare(
      'INSERT OR IGNORE INTO community_reports (id, post_id, reporter_id, reason) VALUES (?, ?, ?, ?)'
    ).run(uuid(), postId, req.userId, reason)
    console.log(`[community] report filed: post=${postId} by=${req.userId} reason=${reason}`)
    const { c: reportCount } = db.prepare('SELECT COUNT(*) AS c FROM community_reports WHERE post_id = ?').get(postId)
    // Hide the post for everyone else once enough people flag it, until it is reviewed.
    if (reportCount >= AUTO_HIDE_REPORTS) db.prepare('UPDATE community_posts SET hidden = 1 WHERE id = ?').run(postId)
    notifyModerators(`Post reported (${reason}) — review within 24h`, [
      `post: ${postId}`, `author: ${post.user_id}`, `reports: ${reportCount}${reportCount >= AUTO_HIDE_REPORTS ? ' (auto-hidden)' : ''}`,
      `caption: ${(post.caption || '').slice(0, 200)}`,
    ])
    res.json({ ok: true })
  } catch (err) {
    console.error('[community report]', err.message)
    res.status(500).json({ error: 'Could not file report. Please try again.' })
  }
})

// ── POST /api/community/comment/:id/report ───────────────────────────────────
router.post('/comment/:id/report', authMiddleware, requireTerms, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to report comments.' })
  const comment = db.prepare('SELECT id, user_id, post_id, content FROM community_comments WHERE id = ?').get(req.params.id)
  if (!comment) return res.status(404).json({ error: 'Comment not found' })
  const VALID_REASONS = ['spam', 'inappropriate', 'harassment', 'other']
  const reason = VALID_REASONS.includes(req.body?.reason) ? req.body.reason : 'inappropriate'
  try {
    db.prepare('INSERT OR IGNORE INTO community_comment_reports (id, comment_id, reporter_id, reason) VALUES (?, ?, ?, ?)')
      .run(uuid(), comment.id, req.userId, reason)
    const { c: reportCount } = db.prepare('SELECT COUNT(*) AS c FROM community_comment_reports WHERE comment_id = ?').get(comment.id)
    if (reportCount >= AUTO_HIDE_REPORTS) db.prepare('UPDATE community_comments SET hidden = 1 WHERE id = ?').run(comment.id)
    notifyModerators(`Comment reported (${reason}) — review within 24h`, [
      `comment: ${comment.id}`, `post: ${comment.post_id}`, `author: ${comment.user_id}`,
      `reports: ${reportCount}${reportCount >= AUTO_HIDE_REPORTS ? ' (auto-hidden)' : ''}`,
      `content: ${(comment.content || '').slice(0, 200)}`,
    ])
    res.json({ ok: true })
  } catch (err) {
    console.error('[community comment report]', err.message)
    res.status(500).json({ error: 'Could not file report. Please try again.' })
  }
})

// ── POST /api/community/block — block the author of a post or comment ────────
// Body: { postId } or { commentId }. Authors are never exposed to clients, so the
// server resolves who to block. Returns the post ids to drop from the feed at once.
router.post('/block', authMiddleware, requireTerms, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Sign up to block users.' })
  const { postId, commentId } = req.body || {}
  let target = null
  if (postId) target = db.prepare('SELECT user_id FROM community_posts WHERE id = ?').get(postId)
  else if (commentId) target = db.prepare('SELECT user_id FROM community_comments WHERE id = ?').get(commentId)
  if (!target) return res.status(404).json({ error: 'Not found' })
  if (target.user_id === req.userId) return res.status(400).json({ error: "You can't block yourself." })

  db.prepare('INSERT OR IGNORE INTO community_blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)')
    .run(uuid(), req.userId, target.user_id)
  const removedPostIds = db.prepare('SELECT id FROM community_posts WHERE user_id = ?').all(target.user_id).map(row => row.id)
  notifyModerators('User blocked — possible abusive user', [
    `blocked user: ${target.user_id}`, `blocked by: ${req.userId}`, `trigger: ${postId ? `post ${postId}` : `comment ${commentId}`}`,
  ])
  res.json({ ok: true, removedPostIds })
})

// ── Moderator tools (act on reports within 24h) ──────────────────────────────
// Enabled only when COMMUNITY_ADMIN_TOKEN is set in the server environment.
// Send it as the x-moderation-token header.
function requireModerator(req, res, next) {
  const expected = process.env.COMMUNITY_ADMIN_TOKEN
  if (!expected) return res.status(404).json({ error: 'Not found' })
  const given = Buffer.from(String(req.get('x-moderation-token') || ''))
  const wanted = Buffer.from(expected)
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return res.status(403).json({ error: 'Forbidden' })
  next()
}

function banUser(userId, reason) {
  db.prepare('INSERT OR REPLACE INTO community_bans (user_id, reason) VALUES (?, ?)').run(userId, reason || null)
}

// GET /api/community/admin/reports — everything reported and still on the platform
router.get('/admin/reports', requireModerator, (req, res) => {
  const posts = db.prepare(`
    SELECT cp.id, cp.user_id AS author_id, cp.caption, cp.photo_url, cp.created_at, COALESCE(cp.hidden, 0) AS hidden,
           COUNT(r.id) AS report_count, GROUP_CONCAT(DISTINCT r.reason) AS reasons, MIN(r.created_at) AS first_reported_at
    FROM community_reports r JOIN community_posts cp ON cp.id = r.post_id
    GROUP BY cp.id ORDER BY first_reported_at ASC
  `).all()
  const comments = db.prepare(`
    SELECT cc.id, cc.user_id AS author_id, cc.post_id, cc.content, cc.created_at, COALESCE(cc.hidden, 0) AS hidden,
           COUNT(r.id) AS report_count, GROUP_CONCAT(DISTINCT r.reason) AS reasons, MIN(r.created_at) AS first_reported_at
    FROM community_comment_reports r JOIN community_comments cc ON cc.id = r.comment_id
    GROUP BY cc.id ORDER BY first_reported_at ASC
  `).all()
  res.json({ posts, comments })
})

// POST /api/community/admin/post/:id/remove  { ban?: boolean (default true) }
router.post('/admin/post/:id/remove', requireModerator, (req, res) => {
  const post = db.prepare('SELECT id, user_id FROM community_posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Post not found' })
  removePostCascade(post.id)
  if (req.body?.ban !== false) banUser(post.user_id, `post ${post.id} removed by moderator`)
  res.json({ ok: true, banned: req.body?.ban !== false ? post.user_id : null })
})

// POST /api/community/admin/comment/:id/remove  { ban?: boolean (default true) }
router.post('/admin/comment/:id/remove', requireModerator, (req, res) => {
  const comment = db.prepare('SELECT id, user_id FROM community_comments WHERE id = ?').get(req.params.id)
  if (!comment) return res.status(404).json({ error: 'Comment not found' })
  db.prepare('DELETE FROM community_comment_reports WHERE comment_id = ?').run(comment.id)
  db.prepare('DELETE FROM community_comments WHERE id = ?').run(comment.id)
  if (req.body?.ban !== false) banUser(comment.user_id, `comment ${comment.id} removed by moderator`)
  res.json({ ok: true, banned: req.body?.ban !== false ? comment.user_id : null })
})

// POST /api/community/admin/post/:id/dismiss — report reviewed, content is fine
router.post('/admin/post/:id/dismiss', requireModerator, (req, res) => {
  db.prepare('DELETE FROM community_reports WHERE post_id = ?').run(req.params.id)
  db.prepare('UPDATE community_posts SET hidden = 0 WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/community/admin/ban/:userId
router.post('/admin/ban/:userId', requireModerator, (req, res) => {
  banUser(req.params.userId, req.body?.reason)
  res.json({ ok: true })
})

module.exports = router
