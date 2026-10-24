const test = require('node:test')
const assert = require('node:assert/strict')
const { coachingKnowledge, EYE_GUIDANCE } = require('./appearanceKnowledge')
const { amazonUrl, normalizeAmazonLinks, productWithLink, formatCoachReply, allowsProductRecommendations } = require('./affiliateRecommendations')

test('affiliate searches preserve exact queries and cannot inject another tag or destination', () => {
  const url = new URL(amazonUrl('CeraVe Eye Repair Cream &tag=someone-else'))
  assert.equal(url.origin, 'https://www.amazon.ca')
  assert.equal(url.pathname, '/s')
  assert.equal(url.searchParams.get('tag'), 'ascendusapp05-20')
  assert.equal(url.searchParams.getAll('tag').length, 1)
  assert.equal(url.searchParams.get('k'), 'CeraVe Eye Repair Cream &tag=someone-else')
  assert.throws(() => amazonUrl(''), /required/)
  assert.throws(() => amazonUrl('cream', { AMAZON_ASSOCIATE_TAG: 'bad&redirect=evil' }), /Invalid/)
})
test('wrong model affiliate links are rebuilt and opaque shortlinks are not trusted', () => {
  const text = normalizeAmazonLinks('Try https://www.amazon.com/s?k=brow+gel&tag=other-20 or https://amzn.to/opaque')
  assert.match(text, /amazon\.ca/)
  assert.match(text, /tag=ascendusapp05-20/)
  assert.doesNotMatch(text, /tag=other-20|amzn\.to/)
})
test('commercial recommendations always get deterministic tagged searches and disclosure', () => {
  const message = formatCoachReply(JSON.stringify({ message: 'An optional moisturizer may help visible dryness, not hollowing.',
    products: [{ name: 'CeraVe Eye Repair Cream', reason: 'Surface hydration only; not an anatomical fix.', searchQuery: 'CeraVe Eye Repair Cream' }] }))
  assert.match(message, /CeraVe Eye Repair Cream/)
  assert.match(message, /https:\/\/www\.amazon\.ca\/s\?k=CeraVe\+Eye\+Repair\+Cream&tag=ascendusapp05-20/)
  assert.match(message, /may earn a commission/)
  assert.equal(new URL(productWithLink({ name: 'Brow gel', searchQuery: 'clear brow gel' }).amazonUrl).searchParams.get('tag'), 'ascendusapp05-20')
})
test('no product is forced for a structural concern; prohibited cosmetic drug/device links are omitted', () => {
  const noProducts = formatCoachReply(JSON.stringify({ message: 'A cream will not change canthal tilt.', products: [] }))
  assert.doesNotMatch(noProducts, /amazon|commission/)
  const drug = formatCoachReply(JSON.stringify({ message: 'Ask a clinician about drug-related questions.', products: [
    { name: 'Minoxidil', searchQuery: 'minoxidil eyebrows', reason: 'Unverified model proposal' },
  ] }))
  assert.doesNotMatch(drug, /amazon|tag=/)
})
test('invalid model formats fail rather than silently becoming user-facing instructions', () => {
  assert.throws(() => formatCoachReply('not valid JSON'))
  assert.throws(() => formatCoachReply(JSON.stringify({ message: 'hello', products: [{}] })))
})
test('eye guidance is selected for eye questions, saved concerns and multi-turn follow-ups', () => {
  assert.ok(coachingKnowledge('What about my canthal tilt?').includes(EYE_GUIDANCE))
  assert.ok(coachingKnowledge('How do I fix the first thing?', [{ role: 'assistant', content: 'We discussed under-eye shadows.' }]).includes(EYE_GUIDANCE))
  assert.ok(coachingKnowledge('What should I prioritize?', [], { latest: { improvements: ['Under-eye shadows'] } }).includes(EYE_GUIDANCE))
  assert.equal(coachingKnowledge('Suggest a haircut').includes(EYE_GUIDANCE), false)
  assert.match(coachingKnowledge('How should I lose facial fat?'), /does not establish body-fat/)
})

test('drug, procedure and structural-change questions cannot trigger shopping links',()=>{
 for(const question of ['Should I use oral minoxidil for lashes?', 'Can cream change canthal tilt?', 'Can a jaw trainer change bone?', 'Should I get fillers injected?']) assert.equal(allowsProductRecommendations(question),false)
 assert.equal(allowsProductRecommendations('Suggest a moisturizer for dry under-eye skin'),true)
 const reply=formatCoachReply(JSON.stringify({message:'A structural concern is not a cream problem.',products:[{name:'CeraVe Eye Repair Cream',searchQuery:'CeraVe Eye Repair Cream',reason:'An unnecessary model suggestion'}]}),{allowProducts:false})
 assert.doesNotMatch(reply,/amazon|commission|CeraVe/)
})
