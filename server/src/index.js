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

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    // Allow all localhost ports in dev
    if (origin.startsWith('http://localhost:')) return callback(null, true)
    // Allow all Vercel preview and production domains
    if (origin.endsWith('.vercel.app')) return callback(null, true)
    // Allow ascendus.store (production custom domain)
    if (origin === 'https://ascendus.store' || origin === 'https://www.ascendus.store') return callback(null, true)
    // Allow custom CLIENT_URL if set
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
app.use('/api/payments', require('./routes/payments'))
app.use('/api/ai', require('./routes/aiScore'))
app.use('/api/leaderboard', require('./routes/leaderboard'))
app.use('/api/supabase',   require('./routes/supabaseRoutes'))
app.use('/api/coach',     require('./routes/coach'))
app.use('/api/hair',      require('./routes/hair'))
app.use('/api/referral',  require('./routes/referral'))

// Stripe connectivity test (remove after debugging)
app.get('/api/stripe-ping', async (req, res) => {
  const https = require('https')
  const result = await new Promise(resolve => {
    const req = https.request({ hostname: 'api.stripe.com', path: '/v1/charges', method: 'GET',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }, r => {
      resolve({ status: r.statusCode, ok: true })
    })
    req.on('error', e => resolve({ error: e.message, code: e.code }))
    req.setTimeout(5000, () => resolve({ error: 'timeout' }))
    req.end()
  })
  res.json(result)
})

// Health checks (root + api path — Railway probes /)
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
