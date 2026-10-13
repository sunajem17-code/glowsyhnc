const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('developer access relative imports match Linux filename casing', () => {
  const route = path.resolve(__dirname, '../routes/developerAccess.js')
  const source = fs.readFileSync(route, 'utf8')
  for (const [, name] of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
    const resolved = require.resolve(path.resolve(path.dirname(route), name))
    const parts = resolved.split(path.sep)
    let current = path.parse(resolved).root
    for (const part of parts.filter(Boolean)) {
      assert.ok(fs.readdirSync(current).includes(part), `Import ${name} has incorrect filename casing: ${part}`)
      current = path.join(current, part)
    }
  }
})
