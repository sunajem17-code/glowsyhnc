require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

// ── Boot-time security checks — crash fast if critical config is missing ──────
if (process.env.NODE_ENV === 'production') {
  const required = [
    ['UPSTASH_REDIS_REST_URL',   'Rate limiting requires Redis in production'],
    ['UPSTASH_REDIS_REST_TOKEN', 'Rate limiting requires Redis in production'],
    ['JWT_SECRET',               'Auth requires JWT_SECRET in production'],
    ['PROMO_CODE',               'Promo code must be set in Railway, never hardcoded'],
  ]
  for (const [key, msg] of required) {
    if (!process.env[key]) throw new Error(`[boot] ${key} is not set — ${msg}`)
  }
  console.log('✅ All required production env vars present')
}

// Validate Stripe key at startup (warn only — don't crash server)
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) {
  console.warn('⚠️  STRIPE_SECRET_KEY is missing or invalid — set it in Railway environment variables')
} else {
  console.log('✅ Stripe key loaded: sk_***')
}

// ── Referral velocity-hold re-checker — runs every 15 min ────────────────────
try {
  const cron = require('node-cron')
  const { resolveVelocityHolds } = require('./utils/referralRecheck')
  cron.schedule('*/15 * * * *', async () => {
    try { await resolveVelocityHolds() } catch (e) { console.error('[ReferralRecheck] cron error:', e.message) }
  })
  // Run once immediately on startup to catch any holds that survived a restart
  resolveVelocityHolds().catch(e => console.error('[ReferralRecheck] startup run error:', e.message))
  console.log('✅ Referral re-check scheduler started (every 15 min)')
} catch (e) {
  console.warn('⚠️  Referral re-check scheduler not started:', e.message)
}

// ── Built-in email scheduler (replaces Make.com) ──────────────────────────────
try {
  const cron = require('node-cron')
  const { sendUpgradeNudge, sendWeeklyRecap } = require('../ascendus-mailer')
  const { createClient } = require('@supabase/supabase-js')

  const schedSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  )

  async function runDailyNudge() {
    console.log('⏰ Running daily nudge job...')
    try {
      const { data: users, error } = await schedSupabase.from('free_users_day3').select('user_id')
      if (error) { console.error('Nudge job fetch error:', error.message); return }
      if (!users?.length) { console.log('Nudge job: no eligible users'); return }
      let sent = 0, skipped = 0, failed = 0
      for (const { user_id } of users) {
        try {
          const r = await sendUpgradeNudge(user_id)
          r.success ? sent++ : skipped++
        } catch (e) { console.error('Nudge error for', user_id, e.message); failed++ }
        await new Promise(r => setTimeout(r, 300))
      }
      console.log(`✅ Daily nudge done: ${sent} sent, ${skipped} skipped, ${failed} failed`)
    } catch (e) { console.error('Nudge job error:', e.message) }
  }

  async function runWeeklyRecaps() {
    console.log('⏰ Running weekly recap job...')
    try {
      const { data: users, error } = await schedSupabase
        .from('profiles').select('id').eq('plan', 'pro')
      if (error) { console.error('Weekly recap fetch error:', error.message); return }
      if (!users?.length) { console.log('Weekly recap: no pro users'); return }
      let sent = 0, skipped = 0, failed = 0
      for (const { id } of users) {
        try {
          const r = await sendWeeklyRecap(id)
          r.success ? sent++ : skipped++
        } catch (e) { failed++ }
        await new Promise(r => setTimeout(r, 300))
      }
      console.log(`✅ Weekly recap done: ${sent} sent, ${skipped} skipped, ${failed} failed`)
    } catch (e) { console.error('Weekly recap job error:', e.message) }
  }

  // Daily nudge at 9:00 AM UTC
  cron.schedule('0 9 * * *', runDailyNudge, { timezone: 'UTC' })
  // Weekly recap every Monday at 9:00 AM UTC
  cron.schedule('0 9 * * 1', runWeeklyRecaps, { timezone: 'UTC' })

  console.log('✅ Email scheduler started (daily nudge 9AM UTC, weekly recap Mon 9AM UTC)')
} catch (e) {
  console.warn('⚠️  Email scheduler not started:', e.message)
}
const express     = require('express')
const cors        = require('cors')
const helmet      = require('helmet')
const compression = require('compression')
const path    = require('path')

const app  = express()
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

// ── Compression (gzip) — must come before routes ──────────────────────────────
app.use(compression())

// ── Reduce JSON body limit (10mb is far too large — 2mb is plenty) ────────────
// Note: express.json below is set to 2mb

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow /uploads static files
}))

// ── General middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (origin.startsWith('http://localhost:')) return callback(null, true)
    if (/^https:\/\/glowsyhnc(-[a-z0-9]+)?\.vercel\.app$/.test(origin)) return callback(null, true)
    if (origin === 'https://ascendus.store' || origin === 'https://www.ascendus.store') return callback(null, true)
    if (origin === 'capacitor://localhost' || origin === 'ionic://localhost') return callback(null, true)
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve uploaded photos
const UPLOADS_DIR = path.join(__dirname, '../../data/uploads')
app.use('/uploads', express.static(UPLOADS_DIR))

// Routes
app.use('/api/auth',        require('./routes/auth'))
app.use('/api/user',        require('./routes/user'))
app.use('/api/scan',        require('./routes/scan').router)
app.use('/api/plan',        require('./routes/plan'))
app.use('/api/tasks',       require('./routes/tasks'))
app.use('/api/checkin',     require('./routes/checkin'))
app.use('/api/progress',    require('./routes/progress'))
app.use('/api/products',    require('./routes/products'))
app.use('/api/payments',    paymentsRouter)
app.use('/api/ai',          require('./routes/aiScore'))
app.use('/api/leaderboard', require('./routes/leaderboard').router)
app.use('/api/supabase',    require('./routes/supabaseRoutes'))
app.use('/api/coach',       require('./routes/coach'))
app.use('/api/hair',        require('./routes/hair'))
app.use('/api/referral',    require('./routes/referral'))
app.use('/api/promo',       require('./routes/promo'))
app.use('/api/potential',   require('./routes/potential'))
app.use('/api/swipemaxx',   require('./routes/swipemaxx'))
app.use('/api/tindermaxx', express.json({ limit: '15mb' }), require('./routes/tindermaxx'))
// Community posts can contain base64 photos — allow up to 15mb
app.use('/api/community',   express.json({ limit: '15mb' }), require('./routes/community'))
app.use('/webhooks',        require('./routes/email-webhooks'))
// RevenueCat's auth is a plain shared-secret header (checked inside the
// route itself), not a body-dependent signature like Stripe's — no raw-body
// handling needed here, the global express.json() above already parses it.
app.use('/api/webhooks',    require('./routes/revenuecatWebhook'))

// Health checks
app.get('/',           (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/health',     (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Deployed commit — RAILWAY_GIT_COMMIT_SHA is injected automatically by Railway
app.get('/api/version', (req, res) => res.json({
  commit: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
  timestamp: new Date().toISOString(),
}))

// Error handler
app.use((err, req, res, next) => {
  console.error('[server error]', err?.message, err?.stack)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GlowSync API running on http://0.0.0.0:${PORT}`)
})
