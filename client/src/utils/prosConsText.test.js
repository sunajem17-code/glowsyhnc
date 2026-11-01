import test from 'node:test'
import assert from 'node:assert/strict'
import { withoutRatings } from './prosConsText.js'
test('saved Pros/Cons lose ratings while keeping the finding and advice',()=>{
  assert.equal(withoutRatings('Broad shoulders (8.2/10)'), 'Broad shoulders')
  assert.equal(withoutRatings('Your rating is 8/10. Broad shoulders create a V-shaped silhouette.'), 'Broad shoulders create a V-shaped silhouette.')
  assert.equal(withoutRatings('Train shoulders twice a week.'), 'Train shoulders twice a week.')
})
