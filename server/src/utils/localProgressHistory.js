const { calculatePotentialScore } = require('./potentialScore')

function getLocalProgressHistory(db, userId) {
  return db.prepare(`
    SELECT * FROM scans
    WHERE user_id = ? AND analyzed_at IS NOT NULL AND glow_score IS NOT NULL
    ORDER BY scan_date DESC
  `).all(userId).map(scan => ({
    id: scan.id,
    created_at: scan.analyzed_at || scan.scan_date,
    overall_score: scan.glow_score,
    potential_score: calculatePotentialScore(scan.glow_score),
    face_score: scan.face_total_score,
    face_image_url: scan.face_photo_url,
    body_image_url: scan.body_photo_url,
  }))
}

module.exports = { getLocalProgressHistory }
