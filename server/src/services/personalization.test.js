const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const { normalizeContext, contextKey, validProducts, createPersonalizationStore } = require('./personalization')
const { skincareRoutine } = require('../utils/skincareRoutine')
test('saved routine and products survive store recreation and are isolated by account and scan', async () => {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE personalized_recommendations(user_id TEXT, context_key TEXT, payload TEXT, PRIMARY KEY(user_id,context_key))')
  try {
    const key = contextKey(normalizeContext({scanId:'scan-1'}))
    const payload = {products:[{name:'A', description:'B', searchQuery:'A'}], routine:skincareRoutine(['acne'], 4), source:'ai'}
    const first = createPersonalizationStore(db, () => null)
    assert.deepEqual(await first.save('a', key, payload), payload)
    const reopened = createPersonalizationStore(db, () => null)
    assert.deepEqual(await reopened.get('a', key), payload)
    assert.equal(await reopened.get('b', key), null)
    assert.equal(await reopened.get('a', contextKey(normalizeContext({scanId:'scan-2'}))), null)
    assert.deepEqual(await reopened.save('a', key, {products:[]}), payload)
    assert.ok(payload.routine.pm.includes('Benzoyl Peroxide 2.5%'))
  } finally { db.close() }
})
test('context is canonical and invalid input / model output is rejected', () => {
  assert.equal(contextKey(normalizeContext({skinIssues:['acne','oiliness']})),contextKey(normalizeContext({skinIssues:['oiliness','acne']})))
  for (const body of [{skinIssues:'acne'}, {skinScore:Infinity}, {pillars:[]}, {weaknesses:[{}]}]) assert.throws(() => normalizeContext(body))
  assert.equal(validProducts([{name:'x'}]), false)
  assert.equal(validProducts([{name:'x', description:'y', searchQuery:'z'}]), true)
})
test('production storage errors never fall back to ephemeral SQLite', async () => {
  const query = { select(){return this}, eq(){return this}, async maybeSingle(){return {error:new Error('offline')}} }
  const store = createPersonalizationStore({prepare(){throw new Error('must not use sqlite')}}, () => ({from(){return query}}))
  await assert.rejects(store.get('a','key'), /offline/)
})
test('snapshot survives closing and reopening a file-backed database', async () => {
  const fs = require('node:fs')
  const os = require('node:os')
  const path = require('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ascendus-personalization-'))
  let db
  try {
    const file = path.join(dir, 'test.db')
    db = new Database(file)
    db.exec('CREATE TABLE personalized_recommendations(user_id TEXT, context_key TEXT, payload TEXT, PRIMARY KEY(user_id,context_key))')
    const payload = {routine:skincareRoutine([],8),products:[{name:'saved'}]}
    await createPersonalizationStore(db,()=>null).save('a','scan',payload)
    db.close()
    db = new Database(file)
    assert.deepEqual(await createPersonalizationStore(db,()=>null).get('a','scan'),payload)
  } finally { if (db?.open) db.close(); fs.rmSync(dir,{recursive:true,force:true}) }
})
