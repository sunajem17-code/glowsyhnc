function skincareRoutine(skinIssues, skinScore) {
  const skinIsClear = skinScore != null && skinScore >= 7.5
  const am = skinIsClear ? [
    'Gentle cleanser (CeraVe Hydrating or La Roche-Posay Toleriane)',
    'Vitamin C serum 10–15%',
    'Lightweight moisturizer',
    'SPF 50 (non-negotiable)',
  ] : [
    'Gentle cleanser (CeraVe or La Roche-Posay)',
    skinIssues.includes('scarring')     ? 'Vitamin C serum 15%'  : null,
    skinIssues.includes('oiliness')     ? 'Niacinamide 10%'      : null,
    skinIssues.includes('dark_circles') ? 'Caffeine eye cream'   : null,
    'Lightweight moisturizer',
    'SPF 50 (non-negotiable)',
  ].filter(Boolean)

  const pm = skinIsClear ? [
    'Gentle cleanser',
    'Retinol 0.025–0.05% 2×/week',
    'Peptide moisturizer',
  ] : [
    'Gentle cleanser',
    skinIssues.includes('acne')     ? 'Benzoyl Peroxide 2.5%'        : null,
    skinIssues.includes('dullness') ? 'AHA/glycolic acid 2–3×/week'  : null,
    skinIssues.includes('scarring') ? 'Retinol 0.3% (start 1×/week)' : null,
    skinIssues.includes('oiliness') ? 'Niacinamide 10%'              : null,
    'Moisturizer',
  ].filter(Boolean)

  return { am, pm }
}
module.exports = { skincareRoutine }
