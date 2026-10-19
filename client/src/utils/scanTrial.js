export function trialRenewalText(product) {
  const periods = { P1W: 'week', P1M: 'month', P3M: '3 months', P6M: '6 months', P1Y: 'year' }
  const period = periods[product?.subscriptionPeriod]
  if (!period || !product?.priceString) return null
  return `Then ${product.priceString} per ${period}. Auto-renews unless canceled. Cancel anytime in Settings.`
}

export function isSevenDayFreeTrial(product) {
  const intro = product?.introPrice
  if (!intro || intro.price !== 0 || !trialRenewalText(product)) return false
  const daysPerUnit = { DAY: 1, WEEK: 7 }
  return daysPerUnit[intro.periodUnit] * intro.periodNumberOfUnits * intro.cycles === 7
}
