/**
 * Single source of truth for tier-label assignment on the server.
 * Must be called with the FINAL score actually shown to the user
 * (i.e. after rescan anchoring), never an intermediate/raw value.
 */

const MALE_TIERS = [
  { min: 9.5, label: 'True Adam' },
  { min: 9.0, label: 'Adam Lite' },
  { min: 8.0, label: 'Chad' },
  { min: 7.0, label: 'Chadlite' },
  { min: 6.0, label: 'High Tier Normie' },
  { min: 5.0, label: 'Mid Tier Normie' },
  { min: 4.0, label: 'Low Tier Normie' },
  { min: 0,   label: 'Sub 3' },
]

const FEMALE_TIERS = [
  { min: 9.5, label: 'True Eve' },
  { min: 9.0, label: 'Eve Lite' },
  { min: 8.0, label: 'Eve' },
  { min: 7.0, label: 'Stacy' },
  { min: 6.0, label: 'High Tier Becky' },
  { min: 5.0, label: 'Mid Tier Becky' },
  { min: 4.0, label: 'Low Tier Becky' },
  { min: 0,   label: 'Sub 3' },
]

function getTier(score, gender = 'male') {
  const rounded = Math.round(Number(score) * 10) / 10
  const table = gender === 'female' ? FEMALE_TIERS : MALE_TIERS
  return table.find(t => rounded >= t.min).label
}

module.exports = { getTier, MALE_TIERS, FEMALE_TIERS }
