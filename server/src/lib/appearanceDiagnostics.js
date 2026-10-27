// Finding counts only: never include scan IDs, photos, tokens, or finding text.
function recordAppearanceCounts(stage, pros, cons) {
  if (process.env.NODE_ENV === 'production') return
  console.info('[appearance-analysis]', { stage, pros: count(pros), cons: count(cons) })
}

function count(rows) {
  return Array.isArray(rows) ? rows.length : 0
}

module.exports = { recordAppearanceCounts }
