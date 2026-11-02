const test = require('node:test')
const assert = require('node:assert/strict')
const { requireScanOwner } = require('./scanOwner')
function database(response) {
  return { from(table) {
    assert.equal(table, 'users')
    return { select(columns) {
      assert.equal(columns, 'id')
      return { eq(column, value) {
        assert.equal(column, 'id'); assert.equal(value, 'verified-owner')
        return { maybeSingle: async () => response }
      } }
    } }
  } }
}
test('an existing authenticated account can begin analysis', async () => {
  await requireScanOwner(database({ data: { id: 'verified-owner' } }), 'verified-owner')
})
test('a deleted account expires its session before analysis', async () => {
  await assert.rejects(requireScanOwner(database({ data: null }), 'verified-owner'), e => e.status === 401 && e.code === 'scan_owner_missing')
})
test('a database outage does not expire a valid session', async () => {
  await assert.rejects(requireScanOwner(database({ error: { message: 'timeout' } }), 'verified-owner'), e => e.status === 503 && e.code === 'scan_owner_unavailable')
})
