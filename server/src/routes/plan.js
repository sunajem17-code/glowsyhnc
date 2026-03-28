const express = require('express')
const { v4: uuid } = require('uuid')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.get('/current', authMiddleware, (req, res) => {
  const plan = db.prepare(`SELECT * FROM action_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).get(req.userId)
  if (!plan) return res.json({ plan: null })

  const tasks = db.prepare('SELECT * FROM tasks WHERE plan_id = ? ORDER BY sort_order').all(plan.id)
  const completions = db.prepare(`
    SELECT task_id FROM task_completions WHERE user_id = ? AND completion_date = date('now')
  `).all(req.userId).map(r => r.task_id)

  const tasksWithStatus = tasks.map(t => ({
    ...t,
    completed: completions.includes(t.id),
    steps: t.instructions ? JSON.parse(t.instructions) : [],
  }))

  res.json({ plan: { ...plan, tasks: tasksWithStatus } })
})

router.post('/generate', authMiddleware, (req, res) => {
  const { scanId, tasks } = req.body
  if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ error: 'Tasks array required' })

  const planId = uuid()
  const now = new Date().toISOString()

  db.prepare('INSERT INTO action_plans (id, user_id, scan_id, created_at) VALUES (?, ?, ?, ?)').run(planId, req.userId, scanId, now)

  const insertTask = db.prepare(`INSERT INTO tasks (id, plan_id, category, title, description, duration_min, difficulty, sets, reps, frequency, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  tasks.forEach((task, i) => {
    insertTask.run(task.id || uuid(), planId, task.category, task.title, task.description, task.duration || 5, task.difficulty || 1, task.sets || null, task.reps || null, task.frequency || 'daily', i)
  })

  res.json({ planId })
})

router.get('/:id/tasks', authMiddleware, (req, res) => {
  const plan = db.prepare('SELECT * FROM action_plans WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!plan) return res.status(404).json({ error: 'Plan not found' })

  const tasks = db.prepare('SELECT * FROM tasks WHERE plan_id = ? ORDER BY sort_order').all(plan.id)
  res.json({ tasks })
})

module.exports = router
