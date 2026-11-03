export const EXIT_TRIAL_PRODUCT_ID = 'com.ascendus.app.monthly'

export function trialRenewalText(product) {
  const periods = { P1W: 'week', P1M: 'month', P3M: '3 months', P6M: '6 months', P1Y: 'year' }
  const period = periods[product?.subscriptionPeriod]
  if (!period || !product?.priceString) return null
  return `Then ${product.priceString} per ${period}. Auto-renews unless canceled. Cancel anytime in Settings.`
}

function isFreeTrialDuration(product, expectedDays) {
  const intro = product?.introPrice
  if (!intro || intro.price !== 0 || !trialRenewalText(product)) return false
  const daysPerUnit = { DAY: 1, WEEK: 7 }
  return daysPerUnit[intro.periodUnit] * intro.periodNumberOfUnits * intro.cycles === expectedDays
}

export const isSevenDayFreeTrial = product => isFreeTrialDuration(product, 7)
export const isThreeDayFreeTrial = product => isFreeTrialDuration(product, 3)

export function eligibleThreeDayTrial(packages, eligibility, productId = null) {
  return packages.find(pkg => (!productId || pkg.product?.identifier === productId)
    && isThreeDayFreeTrial(pkg.product)
    && eligibility[pkg.product.identifier]?.status === 2) || null
}

// Exit-intent trial renews on the existing monthly product only.
export function isMonthlyExitTrial(product) {
  return product?.identifier === 'com.ascendus.app.monthly'
    && product.subscriptionPeriod === 'P1M'
    && isThreeDayFreeTrial(product)
}

export function eligibleExitTrial(packages, eligibility) {
  return eligibleThreeDayTrial(
    packages.filter(pkg => isMonthlyExitTrial(pkg.product)),
    eligibility,
    EXIT_TRIAL_PRODUCT_ID,
  )
}
