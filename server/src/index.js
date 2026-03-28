require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000', 'http://localhost:3001'], credentials: true }))
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
