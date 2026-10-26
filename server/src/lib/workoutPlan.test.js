const test = require('node:test')
const assert = require('node:assert/strict')
const { buildBaselineWorkout, inferMusclePriorities, validateWorkoutPlan } = require('./workoutPlan')

const shoulderScan = { physique_improvements: ['Shoulder width appears less developed relative to the waist in this front-facing photo.'] }
const chestScan = { physique_improvements: ['Upper chest fullness could use more development based on the visible front view.'] }

test('baseline generator returns exact complete schedules for every supported equipment and day count', () => {
  for (const equipment of ['Bodyweight', 'Dumbbells', 'Home gym', 'Full gym']) {
    for (let days = 2; days <= 6; days += 1) {
      const plan = buildBaselineWorkout({ daysPerWeek: days, level: 'advanced', goal: 'gain strength', equipment, scores: { frame_width: 4.5 }, physique: shoulderScan, userFocus: 'Auto from scan' })
      assert.equal(plan.days.length, days)
      assert.ok(plan.days.every(day => day.exercises.length >= 3 && day.exercises.every(exercise => exercise.instructions && exercise.progressionInstructions && exercise.alternatives.length)))
      assert.ok(plan.days.some(day => day.exercises.some(exercise => exercise.why.includes('Extra work'))))
    }
  }
})

test('bodyweight fallback does not require unselected equipment', () => {
  const plan = buildBaselineWorkout({ daysPerWeek: 5, level: 'advanced', goal: 'gain strength', equipment: 'Bodyweight', scores: {}, physique: shoulderScan, userFocus: 'Auto from scan' })
  const exercises = plan.days.flatMap(day => day.exercises)
  assert.ok(exercises.every(exercise => !/dumbbell|barbell|cable|machine|pull.?up|chin.?up|bench|resistance band|step.?up|leg press/i.test(`${exercise.name} ${exercise.instructions} ${exercise.alternatives.join(' ')}`)))
})

test('different supported scan findings and user focus change the fallback exercises', () => {
  const args = { daysPerWeek: 5, level: 'advanced', goal: 'gain strength', equipment: 'Dumbbells', scores: {}, userFocus: 'Auto from scan' }
  const shoulderPlan = buildBaselineWorkout({ ...args, physique: shoulderScan })
  const chestPlan = buildBaselineWorkout({ ...args, physique: chestScan })
  const names = plan => plan.days.flatMap(day => day.exercises.map(exercise => exercise.name)).join('|')
  assert.notEqual(names(shoulderPlan), names(chestPlan))
  assert.equal(inferMusclePriorities({}, {}, 'Balanced').length, 0)
  assert.equal(inferMusclePriorities({}, {}, 'Legs')[0].area, 'Legs')
})

test('validator rejects missing days, missing instructions, and bodyweight equipment violations', () => {
  const valid = buildBaselineWorkout({ daysPerWeek: 2, level: 'beginner', goal: 'build muscle', equipment: 'Bodyweight', scores: {}, physique: {}, userFocus: 'Balanced' })
  assert.equal(validateWorkoutPlan(valid, 2, 'Bodyweight'), true)
  assert.equal(validateWorkoutPlan({ ...valid, days: valid.days.slice(0, 1) }, 2, 'Bodyweight'), false)
  const missingInstructions = structuredClone(valid)
  delete missingInstructions.days[0].exercises[0].instructions
  assert.equal(validateWorkoutPlan(missingInstructions, 2, 'Bodyweight'), false)
  const requiresBar = structuredClone(valid)
  requiresBar.days[0].exercises[0].name = 'Barbell bench press'
  assert.equal(validateWorkoutPlan(requiresBar, 2, 'Bodyweight'), false)
})
