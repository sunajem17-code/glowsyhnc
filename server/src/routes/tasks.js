const express = require('express')
const { v4: uuid } = require('uuid')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.post('/:id/complete', authMiddleware, (req, res) => {
  const task = db.prepare(`SELECT t.* FROM tasks t
    JOIN action_plans p ON t.plan_id = p.id
    WHERE t.id = ? AND p.user_id = ?`).get(req.params.id, req.userId)

  if (!task) return res.status(404).json({ error: 'Task not found' })

  try {
    db.prepare('INSERT INTO task_completions (id, task_id, user_id) VALUES (?, ?, ?)')
      .run(uuid(), task.id, req.userId)
    res.json({ completed: true })
  } catch (err) {
    // Unique constraint means already completed today
    db.prepare('DELETE FROM task_completions WHERE task_id = ? AND user_id = ? AND completion_date = date(\'now\')').run(task.id, req.userId)
    res.json({ completed: false })
  }
})

module.exports = router
