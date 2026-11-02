import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isSevenDayFreeTrial, trialRenewalText, isMonthlyExitTrial, eligibleThreeDayTrial } from './scanTrial.js'
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
  assert.equal(eligibleThreeDayTrial([weekly, monthly], { weekly: { status: 1 }, monthly: { status: 2 } }), monthly)
  assert.equal(eligibleThreeDayTrial([weekly, monthly], { weekly: { status: 2 }, monthly: { status: 2 } }, 'monthly'), monthly)
})

test('unknown eligibility and paid intro offers never become a free trial', () => {
  const pkg = { product: { ...product, identifier: 'weekly', subscriptionPeriod: 'P1W', introPrice: { price: 0, cycles: 1, periodUnit: 'DAY', periodNumberOfUnits: 3 } } }
  assert.equal(eligibleThreeDayTrial([pkg], { weekly: { status: 0 } }), null)
  assert.equal(eligibleThreeDayTrial([pkg], {}), null)
  assert.equal(eligibleThreeDayTrial([{ product: { ...pkg.product, introPrice: { ...pkg.product.introPrice, price: 1 } } }], { weekly: { status: 2 } }), null)
})

test('the active Xcode StoreKit configuration contains the advertised three-day trial', () => {
  const config = JSON.parse(readFileSync(new URL('../../ios/App/App/Ascendus.storekit', import.meta.url), 'utf8'))
  const monthly = config.subscriptionGroups.flatMap(group => group.subscriptions).find(product => product.productID === 'com.ascendus.app.monthly')
  assert.equal(monthly.introductoryOffer.paymentMode, 'free')
  assert.equal(monthly.introductoryOffer.subscriptionPeriod, 'P3D')
  assert.equal(monthly.introductoryOffer.numberOfPeriods, 1)
  assert.equal(monthly.recurringSubscriptionPeriod, 'P1M')
  const scheme = readFileSync(new URL('../../ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme', import.meta.url), 'utf8')
  assert.match(scheme, /storeKitConfigurationFileReference\s*=\s*"\.\.\/App\/Ascendus\.storekit"/)
})
