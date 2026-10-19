import test from 'node:test'
import assert from 'node:assert/strict'
import { isSevenDayFreeTrial, trialRenewalText } from './scanTrial.js'
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
