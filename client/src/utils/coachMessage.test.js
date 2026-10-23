import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCoachMessage, safeCoachLink, blockText, coachRevealCount } from './coachMessage.js'
const url = 'https://www.amazon.ca/s?k=CeraVe+Cleanser&tag=ascendusapp05-20'
test('existing saved recommendations become product cards without changing their affiliate destination', () => {
  const blocks = parseCoachMessage(`Keep your routine simple.\n\nCeraVe Hydrating Cleanser — Gentle cleansing for the saved concern.\n${url}\n\nAffiliate links: Ascendus may earn a commission.`)
  assert.deepEqual(blocks.map(block => block.type), ['paragraph','product','disclosure'])
  assert.equal(blocks[1].name,'CeraVe Hydrating Cleanser')
  assert.equal(blocks[1].url,url)
  assert.equal(blocks[1].reason,'Gentle cleansing for the saved concern.')
  assert.equal(blockText(blocks[1]).includes('https:'),false)
})
test('a standalone product URL does not consume an unrelated advice paragraph', () => {
  const blocks=parseCoachMessage(`Keep the current hairstyle.\n${url}`)
  assert.equal(blocks[0].text,'Keep the current hairstyle.')
  assert.equal(blocks[1].name,'Recommended product')
})
test('numbered advice and paragraphs preserve content without empty spacer blocks', () => {
  const blocks=parseCoachMessage('1) Lighting first. Use even front lighting.\n\n2. Keep your routine simple.\n\nA final thought.')
  assert.equal(blocks.length,3)
  assert.deepEqual(blocks[0],{type:'step',number:'1',text:'Lighting first. Use even front lighting.'})
  assert.equal(blocks[2].text,'A final thought.')
})
test('unsafe, credential-bearing and lookalike URLs cannot become product links', () => {
  const credentialed = new URL('https://amazon.ca/s')
  credentialed.username = 'test-user'
  credentialed.password = 'test-value'
  for(const link of ['javascript:alert(1)','http://amazon.ca/s','https://amazon.ca.evil.example/s','https://amazon.ca@evil.example/s',credentialed.href]) assert.equal(safeCoachLink(link,true),null)
  assert.equal(safeCoachLink(url,true),url)
})
test('fast reveal progresses over time, stays bounded and never skips straight to the full reply', () => {
  assert.equal(coachRevealCount(0,1000),0)
  assert.equal(coachRevealCount(100,1000),60)
  assert.equal(coachRevealCount(500,1000),300)
  assert.equal(coachRevealCount(100000,1000),1000)
  assert.equal(coachRevealCount(-1,1000),0)
})
test('typing time is independent of URL tracking length', () => {
  const block=parseCoachMessage(`Product — A simple reason.\n${url}`)[0]
  assert.equal(blockText(block),'Product\nA simple reason.')
})
