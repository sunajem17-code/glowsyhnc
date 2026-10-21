import { createHash, timingSafeEqual } from 'node:crypto'
import { parseScript } from '../src/lib/wrizzScript.js'

const digest = value => createHash('sha256').update(value).digest()
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value)
const reply = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)) }

async function redis(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error('storage')
  const data = await response.json()
  if (data.error) throw new Error('storage')
  return data.result
}

function videosFor(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) throw new Error('Provide between one and five videos.')
  return value.map(item => {
    if (!item || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 80 || typeof item.contactName !== 'string' || !item.contactName.trim() || item.contactName.length > 36 || typeof item.scriptText !== 'string' || item.scriptText.length > 20000) throw new Error('Each video needs title (1–80 characters), contactName (1–36), and scriptText (up to 20,000).')
    const parsed = parseScript(item.scriptText)
    if (parsed.errors.length || !parsed.messages.length || parsed.messages.length > 100 || parsed.messages.some(m => m.text.length > 2000)) throw new Error(parsed.errors[0] || 'Each script needs 1–100 short messages.')
    return { title: item.title, contactName: item.contactName, scriptText: item.scriptText }
  })
}

async function bodyFor(req) {
  let body = req.body
  if (body === undefined) {
    let raw = ''
    for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 1500000) throw new Error('Request too large.') }
    body = raw
  }
  if (Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body)) > 1500000) throw new Error('Request too large.')
  try { return typeof body === 'string' ? JSON.parse(body) : body } catch { throw new Error('Send valid JSON.') }
}

export default async function handler(req, res) {
  const token = process.env.WRIZZ_BRIDGE_TOKEN
  if (!token || token.length < 32 || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return reply(res, 503, { error: 'Configure WRIZZ_BRIDGE_TOKEN (at least 32 characters) and both Upstash Redis REST variables in Vercel, then redeploy.' })
  const authorization = req.headers.authorization || ''
  if (!timingSafeEqual(digest(authorization), digest(`Bearer ${token}`))) return reply(res, 401, { error: 'A valid WRizz connection token is required.' })
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return reply(res, 405, { error: 'Use GET or POST.' }) }
  const prefix = `wrizz:bridge:${process.env.WRIZZ_BRIDGE_NAMESPACE || 'personal'}:`
  const queue = prefix + 'pending', lease = prefix + 'lease', snapshot = prefix + 'snapshot'
  try {
    const hits = await redis(['EVAL', "local n=redis.call('INCR',KEYS[1]) if n==1 then redis.call('EXPIRE',KEYS[1],60) end return n", 1, prefix + 'rate'])
    if (hits > 180) { res.setHeader('Retry-After', '60'); return reply(res, 429, { error: 'Too many connection requests. Wait one minute.' }) }
    if (req.method === 'GET') {
      const [state, pending] = await Promise.all([redis(['GET', snapshot]), redis(['ZCARD', queue])])
      return reply(res, 200, { pendingCommands: pending, browser: state ? JSON.parse(state) : null, note: 'Rendering runs in the connected WRizz browser, which must stay open. Downloads remain in that browser. A stale lastSeen means rendering status is unknown.' })
    }
    let body
    try { body = await bodyFor(req) } catch (e) { return reply(res, 400, { error: e.message }) }
    if (!body || typeof body !== 'object') return reply(res, 400, { error: 'Send a JSON object.' })
    if (body.type === 'add_scripts' || body.type === 'render_queue') {
      if (!validId(body.requestId)) return reply(res, 400, { error: 'Supply a unique requestId (8–80 letters, digits, underscores or hyphens); reuse it when retrying the same request.' })
      let videos = []
      try { if (body.type === 'add_scripts') videos = videosFor(body.videos) } catch (e) { return reply(res, 400, { error: e.message }) }
      if (body.render !== undefined && typeof body.render !== 'boolean') return reply(res, 400, { error: 'render must be true or false.' })
      const command = { id: body.requestId, created: Date.now(), videos, render: body.type === 'render_queue' || body.render === true }
      const result = await redis(['EVAL', "if redis.call('EXISTS',KEYS[2])==1 then return 0 end if redis.call('ZCARD',KEYS[1])>=50 then return -1 end redis.call('SET',KEYS[2],ARGV[2],'EX',604800) redis.call('ZADD',KEYS[1],ARGV[3],ARGV[1]) return 1", 2, queue, prefix + 'command:' + command.id, command.id, JSON.stringify(command), command.created])
      if (result === -1) return reply(res, 429, { error: 'The remote inbox is full. Open WRizz and let it receive pending commands.' })
      return reply(res, 202, { requestId: command.id, status: result === 0 ? 'already_received' : 'accepted', note: 'Accepted for the connected browser; not proof of a completed render. Read GET /api/bridge for status.' })
    }
    if (!validId(body.workerId)) return reply(res, 400, { error: 'A valid browser workerId is required.' })
    if (body.type === 'claim') {
      // A single browser owns the inbox. It renews this lease while rendering too.
      const owned = await redis(['EVAL', "local owner=redis.call('GET',KEYS[1]) if owner and owner~=ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[1],'EX',45) return 1", 1, lease, body.workerId])
      if (!owned) return reply(res, 200, { command: null, otherBrowser: true })
      const entry = await redis(['EVAL', "for i=1,50 do local ids=redis.call('ZRANGE',KEYS[1],0,0) if #ids==0 then return false end local data=redis.call('GET',ARGV[1]..ids[1]) if data then return data end redis.call('ZREM',KEYS[1],ids[1]) end return false", 1, queue, prefix + 'command:'])
      return reply(res, 200, { command: entry ? JSON.parse(entry) : null })
    }
    if (body.type === 'ack') {
      if (!validId(body.requestId)) return reply(res, 400, { error: 'Invalid requestId.' })
      const result = await redis(['EVAL', "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('ZREM',KEYS[2],ARGV[2]) return 1", 2, lease, queue, body.workerId, body.requestId])
      return reply(res, result ? 200 : 409, result ? { received: true } : { error: 'The browser connection lease expired. Reconnect and retry.' })
    }
    if (body.type === 'publish') {
      if (!body.state || !Array.isArray(body.state.jobs) || body.state.jobs.length > 50) return reply(res, 400, { error: 'Invalid browser state.' })
      const result = await redis(['EVAL', "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2],'EX',604800) return 1", 2, lease, snapshot, body.workerId, JSON.stringify({ ...body.state, lastSeen: new Date().toISOString() })])
      return reply(res, result ? 200 : 409, result ? { synced: true } : { error: 'Another browser owns this connection.' })
    }
    return reply(res, 400, { error: 'Unknown action. Use add_scripts or render_queue.' })
  } catch { return reply(res, 503, { error: 'The WRizz connection storage is unavailable. Check the Vercel Redis settings, then retry with the same requestId.' }) }
}
