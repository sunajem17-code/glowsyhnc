import test from 'node:test'
import assert from 'node:assert/strict'
import { amazonSearchUrl, amazonProductUrl } from './amazonAffiliate.js'
test('AI searches always use the configured Canadian marketplace and Associates tag', () => {
  for (const query of ['Niacinamide 10% + Zinc 1%', 'CeraVe & tag=attacker-20', 'https://evil.example/?tag=other', 'Crème SPF 50']) {
    const url = new URL(amazonSearchUrl(query))
    assert.equal(url.origin, 'https://www.amazon.ca')
    assert.equal(url.pathname, '/s')
    assert.deepEqual(url.searchParams.getAll('tag'), ['ascendusapp05-20'])
    assert.equal(url.searchParams.get('k'), query)
  }
  assert.equal(amazonProductUrl('B00TTD9BRC'), 'https://www.amazon.ca/dp/B00TTD9BRC?tag=ascendusapp05-20')
})
