require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true })
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://glowsyhnc.vercel.app',
  'https://glowsyhnc-git-main-sunajem17-2402s-projects.vercel.app',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
]
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`GlowSync API running on http://localhost:${PORT}`)
})
