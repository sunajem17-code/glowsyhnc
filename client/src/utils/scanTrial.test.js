import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isSevenDayFreeTrial, trialRenewalText, isMonthlyExitTrial, eligibleThreeDayTrial, eligibleExitTrial, EXIT_TRIAL_PRODUCT_ID } from './scanTrial.js'
const product = { priceString: '$9.99', subscriptionPeriod: 'P1M', introPrice: { price: 0, cycles: 1, periodUnit: 'WEEK', periodNumberOfUnits: 1 } }
test('only a zero-cost seven-day intro can be advertised as a week free', () => {
  assert.equal(isSevenDayFreeTrial(product), true)
  for (const introPrice of [null, { ...product.introPrice, price: 1 }, { ...product.introPrice, cycles: 2 }, { ...product.introPrice, periodUnit: 'MONTH' }]) {
    assert.equal(isSevenDayFreeTrial({ ...product, introPrice }), false)
  }
  assert.equal(isSevenDayFreeTrial({ ...product, introPrice: { price: 0, cycles: 1, periodUnit: 'DAY', periodNumberOfUnits: 7 } }), true)
})
test('trial cannot hide an unknown renewal price or billing period', () => {
  assert.equal(isSevenDayFreeTrial({ ...product, priceString: null }), false)
  assert.equal(isSevenDayFreeTrial({ ...product, subscriptionPeriod: null }), false)
  assert.equal(trialRenewalText(product), 'Then $9.99 per month. Auto-renews unless canceled. Cancel anytime in Settings.')
})

test('exit trial accepts only the monthly product, never annual or another SKU', () => {
  const monthly = { ...product, identifier: 'com.ascendus.app.monthly' }
  assert.equal(isMonthlyExitTrial(monthly), true)
  assert.equal(isMonthlyExitTrial({ ...monthly, subscriptionPeriod: 'P1Y' }), false)
  assert.equal(isMonthlyExitTrial({ ...monthly, identifier: 'com.ascendus.app.yearly.discount' }), false)
  assert.equal(isMonthlyExitTrial({ ...monthly, introPrice: null }), false)
})

test('three-day offer accepts a configured eligible product with disclosed renewal terms', () => {
  const monthly = { product: { ...product, identifier: 'monthly', introPrice: { price: 0, cycles: 1, periodUnit: 'DAY', periodNumberOfUnits: 3 } } }
  const weekly = { product: { ...monthly.product, identifier: 'weekly', subscriptionPeriod: 'P1W' } }
  const annual = { product: { ...monthly.product, identifier: 'com.ascendus.app.yearly', subscriptionPeriod: 'P1Y' } }
  assert.equal(eligibleThreeDayTrial([monthly, annual], { monthly: { status: 3 }, 'com.ascendus.app.yearly': { status: 2 } }), annual)
  assert.match(trialRenewalText(annual.product), /per year/)
  assert.equal(eligibleThreeDayTrial([weekly, monthly], { weekly: { status: 1 }, monthly: { status: 2 } }), monthly)
  assert.equal(eligibleThreeDayTrial([weekly, monthly], { weekly: { status: 2 }, monthly: { status: 2 } }, 'monthly'), monthly)
})

test('unknown eligibility and paid intro offers never become a free trial', () => {
  const pkg = { product: { ...product, identifier: 'weekly', subscriptionPeriod: 'P1W', introPrice: { price: 0, cycles: 1, periodUnit: 'DAY', periodNumberOfUnits: 3 } } }
  assert.equal(eligibleThreeDayTrial([pkg], { weekly: { status: 0 } }), null)
  assert.equal(eligibleThreeDayTrial([pkg], {}), null)
  assert.equal(eligibleThreeDayTrial([{ product: { ...pkg.product, introPrice: { ...pkg.product.introPrice, price: 1 } } }], { weekly: { status: 2 } }), null)
})

test('the optional local fixture contains the trial while the app scheme uses Apple sandbox', () => {
  const config = JSON.parse(readFileSync(new URL('../../ios/App/App/Ascendus.storekit', import.meta.url), 'utf8'))
  const subscriptions = config.subscriptionGroups.flatMap(group => group.subscriptions)
  const yearly = subscriptions.find(product => product.productID === 'com.ascendus.app.yearly')
  const monthly = subscriptions.find(product => product.productID === EXIT_TRIAL_PRODUCT_ID)
  assert.equal(monthly.recurringSubscriptionPeriod, 'P1M')
  assert.equal(monthly.introductoryOffer.paymentMode, 'free')
  assert.equal(monthly.introductoryOffer.subscriptionPeriod, 'P1W')
  assert.equal(monthly.displayPrice, '9.99')
  assert.equal(yearly.introductoryOffer.paymentMode, 'free')
  assert.equal(yearly.introductoryOffer.subscriptionPeriod, 'P3D')
  assert.equal(yearly.introductoryOffer.numberOfPeriods, 1)
  assert.equal(yearly.recurringSubscriptionPeriod, 'P1Y')
  const scheme = readFileSync(new URL('../../ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme', import.meta.url), 'utf8')
  assert.doesNotMatch(scheme, /<StoreKitConfigurationFileReference/)
  assert.doesNotMatch(scheme, /\sstoreKitConfigurationFileReference\s*=/)
})

test('exit offer requires an eligible seven-day monthly intro and preserves renewal terms', () => {
  const monthly = { product: { ...product, identifier: EXIT_TRIAL_PRODUCT_ID } }
  const annual = { product: { ...monthly.product, identifier: 'com.ascendus.app.yearly', subscriptionPeriod: 'P1Y' } }
  const eligible = { [EXIT_TRIAL_PRODUCT_ID]: { status: 2 }, [annual.product.identifier]: { status: 2 } }
  assert.equal(eligibleExitTrial([annual, monthly], eligible), monthly)
  assert.equal(eligibleExitTrial([annual], eligible), null)
  for (const status of [0, 1, 3, undefined]) assert.equal(eligibleExitTrial([monthly], { [EXIT_TRIAL_PRODUCT_ID]: { status } }), null)
  for (const introPrice of [{...product.introPrice,price:1}, {...product.introPrice,periodUnit:'DAY',periodNumberOfUnits:3}, null]) {
    assert.equal(eligibleExitTrial([{ product: { ...monthly.product, introPrice } }], eligible), null)
  }
  assert.equal(trialRenewalText(monthly.product), 'Then $9.99 per month. Auto-renews unless canceled. Cancel anytime in Settings.')
})
