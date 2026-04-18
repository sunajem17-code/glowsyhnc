require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

// Validate Stripe key at startup (warn only — don't crash server)
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) {
  console.warn('⚠️  STRIPE_SECRET_KEY is missing or invalid:', process.env.STRIPE_SECRET_KEY?.slice(0, 12) || '(not set)')
} else {
  console.log('✅ Stripe key loaded:', process.env.STRIPE_SECRET_KEY.slice(0, 12) + '...')
}
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3002

// ── Stripe webhook — MUST be first, before cors() and express.json() ─────────
// express.raw() preserves the raw body bytes Stripe needs for signature verification.
// If express.json() runs first, req.body becomes a parsed object and sig check fails.
const paymentsRouter = require('./routes/payments')
app.post('/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  paymentsRouter.handleWebhook,
)
console.log('✅ Stripe webhook registered at /api/payments/webhook (raw body)')

// ── General middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (origin.startsWith('http://localhost:')) return callback(null, true)
    if (origin.endsWith('.vercel.app')) return callback(null, true)
    if (origin === 'https://ascendus.store' || origin === 'https://www.ascendus.store') return callback(null, true)
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve uploaded photos
const UPLOADS_DIR = path.join(__dirname, '../../data/uploads')
app.use('/uploads', express.static(UPLOADS_DIR))

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/user', require('./routes/user'))
app.use('/api/scan', require('./routes/scan'))
app.use('/api/plan', require('./routes/plan'))
app.use('/api/tasks', require('./routes/tasks'))
app.use('/api/checkin', require('./routes/checkin'))
app.use('/api/progress', require('./routes/progress'))
app.use('/api/products', require('./routes/products'))
app.use('/api/payments', paymentsRouter)
app.use('/api/ai', require('./routes/aiScore'))
app.use('/api/leaderboard', require('./routes/leaderboard'))
app.use('/api/supabase',   require('./routes/supabaseRoutes'))
app.use('/api/coach',     require('./routes/coach'))
app.use('/api/hair',      require('./routes/hair'))
app.use('/api/referral',  require('./routes/referral'))

// Stripe connectivity test (remove after debugging)
app.get('/api/stripe-ping', async (req, res) => {
  const dns = require('dns').promises
  const results = {}
  try {
    const addrs = await dns.lookup('api.stripe.com')
    results.dns = addrs.address
  } catch (e) {
    results.dns_error = e.message
    return res.json(results)
  }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch('https://api.stripe.com/v1/charges', {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    })
    clearTimeout(timer)
    results.http_status = r.status
  } catch (e) {
    results.http_error = e.message
  }
  res.json(results)
})

// Health checks
app.get('/',          (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/health',    (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/api/health',(req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GlowSync API running on http://0.0.0.0:${PORT}`)
})
