const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const path = require('node:path')

test('server boots when promo redemption is not configured', async () => {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '0',
    UPSTASH_REDIS_REST_URL: 'https://redis.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'test-only-token',
    JWT_SECRET: 'test-only-jwt-secret',
  }
  delete env.PROMO_CODE
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk })
  child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk })

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Server did not become ready. Output: ${output}`)), 8000)
      child.on('error', error => { clearTimeout(timeout); reject(error) })
      child.on('exit', (code, signal) => {
        clearTimeout(timeout)
        reject(new Error(`Server exited before becoming ready (code=${code}, signal=${signal}). Output: ${output}`))
      })
      const ready = () => { clearTimeout(timeout); resolve() }
      child.stdout.on('data', chunk => { if (String(chunk).includes('GlowSync API running')) ready() })
      child.stderr.on('data', chunk => { if (String(chunk).includes('GlowSync API running')) ready() })
    })
    assert.match(output, /GlowSync API running/)
  } finally {
    child.kill('SIGTERM')
  }
})
