const SCORE_LABELS = {
  v_taper: 'V-Taper', frame_width: 'Frame Width', muscle_mass: 'Muscle Mass',
  posture: 'Posture', proportions: 'Proportions', frame: 'Frame',
}

const MUSCLE_HINTS = [
  { area: 'Shoulders', muscles: ['Shoulders', 'Side delts', 'Rear delts'], pattern: /shoulder|deltoid|\bdelts?\b/i },
  { area: 'Chest', muscles: ['Chest', 'Triceps'], pattern: /upper chest|chest|pectoral|\bpecs?\b/i },
  { area: 'Back', muscles: ['Upper back', 'Lats', 'Rear delts'], pattern: /back width|back thickness|upper back|\blats?\b|back development|back/i },
  { area: 'Arms', muscles: ['Biceps', 'Triceps'], pattern: /arms?|biceps?|triceps?/i },
  { area: 'Core', muscles: ['Abdominals', 'Trunk'], pattern: /core|abdominal|\babs\b|midsection/i },
  { area: 'Legs', muscles: ['Quadriceps', 'Hamstrings', 'Glutes'], pattern: /lower body|\blegs?\b|quadriceps?|\bquads?\b/i },
  { area: 'Hamstrings and glutes', muscles: ['Hamstrings', 'Glutes'], pattern: /hamstrings?|glutes?|posterior chain/i },
  { area: 'Calves', muscles: ['Calves'], pattern: /calves?/i },
]

const PRIORITY_EXERCISES = {
  shoulders: /overhead press|shoulder press|lateral raise|rear.?delt|pike push.?up|prone y raise|push.?up plus/i,
  chest: /push.?up|press|chest|fly/i,
  back: /row|pulldown|pullover|reverse snow angel|prone w raise|face pull/i,
  arms: /curl|tricep|bicep|close.?grip push.?up/i,
  core: /plank|dead bug|bird dog|carry/i,
  legs: /squat|lunge|deadlift|hinge|bridge/i,
  calves: /calf raise/i,
}

const EXERCISES = {
  Bodyweight: {
    shoulders: [
      ['Pike push-up', 'Shoulders', 3, '6-10', 'Start in an inverted V with hands shoulder-width apart. Bend elbows to lower your head between your hands, then press up while keeping your trunk braced.', 'Use a comfortable range; elevate hands on a stable surface only if one is available.'],
      ['Prone Y raise', 'Upper back and shoulders', 3, '10-15', 'Lie face down with arms in a Y. Lift hands slightly while keeping your neck relaxed, pause, then lower with control.', 'Prone W raise'],
      ['Push-up plus', 'Shoulders and chest', 3, '8-15', 'Hold a high plank, complete a controlled push-up, then gently spread your shoulder blades at the top without rounding your lower back.', 'Knee push-up plus'],
    ],
    chest: [
      ['Push-up', 'Chest and triceps', 3, '8-15', 'Set hands just outside shoulder width and brace your trunk. Lower under control with elbows angled comfortably, then press up without letting your hips sag.', 'Knee push-up'],
      ['Tempo push-up', 'Chest and shoulders', 3, '6-12', 'Use a standard push-up position. Lower for three steady counts, pause briefly near the floor, then press up while keeping your trunk braced.', 'Standard push-up'],
      ['Close-grip push-up', 'Chest and triceps', 2, '6-12', 'Place hands slightly inside shoulder width, brace your body, lower with elbows close to your sides, and press up smoothly.', 'Knee close-grip push-up'],
    ],
    back: [
      ['Prone W raise', 'Upper back and rear shoulders', 3, '10-15', 'Lie face down with elbows bent in a W. Gently draw shoulder blades down and together, lift hands slightly, pause, and lower.', 'Prone Y raise'],
      ['Reverse snow angel', 'Upper back and rear shoulders', 3, '8-12', 'Lie face down with arms by your sides. Sweep arms slowly toward a Y while keeping shoulders away from ears, then return.', 'Prone W raise'],
      ['Bird dog', 'Trunk and back control', 3, '8-12 each side', 'On hands and knees, brace gently and extend opposite arm and leg without twisting. Pause, return, and alternate sides.', 'Dead bug'],
    ],
    legs: [
      ['Split squat', 'Quadriceps and glutes', 3, '8-12 each side', 'Take a stable split stance, lower straight down within a comfortable range, then push through the front foot to stand.', 'Supported split squat'],
      ['Single-leg glute bridge', 'Glutes and hamstrings', 3, '8-12 each side', 'Lie on your back with one foot planted. Brace gently, lift hips by squeezing the glute, pause, then lower without arching your back.', 'Glute bridge'],
      ['Calf raise', 'Calves', 3, '12-20', 'Stand steadily and rise onto the balls of both feet. Pause briefly at the top, then lower slowly.', 'Seated calf raise using bodyweight'],
    ],
    core: [
      ['Dead bug', 'Abdominals and trunk', 3, '8-12 each side', 'Lie on your back with hips and knees bent. Brace gently and lower opposite arm and leg only as far as your back stays comfortable.', 'Heel taps'],
      ['Side plank', 'Obliques and trunk', 3, '20-40 sec each side', 'Support yourself on a forearm and knees or feet. Keep hips lifted and shoulders stacked; stop before your position sags.', 'Bent-knee side plank'],
      ['Front plank', 'Abdominals and trunk', 3, '20-45 sec', 'Support your body on forearms and toes or knees. Brace gently and keep ribs, hips, and shoulders aligned.', 'Knee plank'],
    ],
    arms: [
      ['Close-grip push-up', 'Triceps', 3, '6-12', 'Place hands slightly inside shoulder width, brace your body, lower with elbows close to your sides, and press up smoothly.', 'Knee close-grip push-up'],
      ['Self-resisted curl', 'Biceps', 3, '8-12 each side', 'Use one hand to provide gentle resistance while the other arm curls. Keep the working elbow by your side and use smooth, pain-free effort.', 'Isometric biceps hold'],
      ['Knee close-grip push-up', 'Triceps and chest', 3, '8-15', 'Keep knees grounded and hands slightly inside shoulder width. Lower with elbows close to your sides, then press away smoothly.', 'Close-grip wall push-up'],
    ],
    calves: [
      ['Calf raise', 'Calves', 3, '12-20', 'Stand steadily and rise onto the balls of both feet. Pause briefly at the top, then lower slowly.', 'Seated calf raise using bodyweight'],
      ['Single-leg calf raise', 'Calves', 3, '8-15 each side', 'Stand near a wall only for balance if one is available. Rise onto one foot, pause, and lower slowly; use two feet if balance is uncertain.', 'Two-leg calf raise'],
      ['Bent-knee calf raise', 'Soleus and calves', 3, '12-20', 'Stand with knees slightly bent and rise onto the balls of your feet. Pause at the top, then lower slowly.', 'Calf raise'],
    ],
  },
  Dumbbells: {}, 'Home gym': {}, 'Full gym': {},
}

const DUMBBELL_MOVES = {
  shoulders: [['Dumbbell overhead press', 'Shoulders', 3, '6-10', 'Hold dumbbells at shoulder height with wrists stacked. Brace, press overhead without arching your back, then lower under control.', 'Seated dumbbell press'], ['Dumbbell lateral raise', 'Side delts', 3, '10-15', 'Stand tall with soft elbows. Raise dumbbells out to the sides to a comfortable height, then lower slowly without swinging.', 'Lighter lateral raise'], ['Dumbbell rear-delt raise', 'Rear delts and upper back', 3, '10-15', 'Hinge at the hips with a neutral back. Raise light dumbbells out to the sides, pause, and lower with control.', 'Prone W raise']],
  chest: [['Dumbbell floor press', 'Chest and triceps', 3, '8-12', 'Lie on the floor with dumbbells above your chest. Lower until upper arms touch softly, then press up without bouncing.', 'Push-up'], ['Dumbbell squeeze press', 'Chest and triceps', 3, '8-12', 'Lie on the floor and keep dumbbells gently touching above your chest. Lower with control while maintaining light inward pressure, then press up.', 'Dumbbell floor press'], ['Push-up', 'Chest and triceps', 2, '8-15', 'Set hands just outside shoulder width, brace your trunk, lower smoothly, and press up without letting your hips sag.', 'Incline push-up']],
  back: [['Single-arm dumbbell row', 'Lats and upper back', 3, '8-12 each side', 'Support one hand on a stable surface. Hinge with a neutral back, row elbow toward your hip, then lower slowly.', 'Two-arm bent-over row'], ['Dumbbell pullover', 'Lats and chest', 3, '8-12', 'Lie on the floor holding one dumbbell securely with both hands. Keep a soft elbow bend and lower only as far as shoulders feel comfortable.', 'Single-arm row'], ['Dumbbell rear-delt raise', 'Rear delts and upper back', 3, '10-15', 'Hinge at the hips with a neutral back. Raise light dumbbells out to the sides, pause, and lower with control.', 'Prone W raise']],
  legs: [['Goblet squat', 'Quadriceps and glutes', 3, '8-12', 'Hold one dumbbell close to your chest. Sit hips down between your feet with the whole foot grounded, then stand smoothly.', 'Bodyweight squat'], ['Dumbbell Romanian deadlift', 'Hamstrings and glutes', 3, '8-12', 'Hold dumbbells in front of your thighs. Push hips back with a slight knee bend and neutral back, then stand by driving hips forward.', 'Glute bridge'], ['Dumbbell reverse lunge', 'Quadriceps and glutes', 3, '8-10 each side', 'Hold light dumbbells at your sides, step backward, lower within a comfortable range, and push through the front foot to return.', 'Reverse lunge']],
  legs: [['Goblet squat', 'Quadriceps and glutes', 3, '8-12', 'Hold one dumbbell close to your chest. Sit hips down between your feet with the whole foot grounded, then stand smoothly.', 'Bodyweight squat'], ['Dumbbell Romanian deadlift', 'Hamstrings and glutes', 3, '8-12', 'Hold dumbbells in front of your thighs. Push hips back with a slight knee bend and neutral back, then stand by driving hips forward.', 'Glute bridge'], ['Dumbbell reverse lunge', 'Quadriceps and glutes', 3, '8-10 each side', 'Hold light dumbbells at your sides, step backward, lower within a comfortable range, and push through the front foot to return.', 'Reverse lunge']],
  core: [['Dead bug', 'Abdominals and trunk', 3, '8-12 each side', 'Lie on your back with hips and knees bent. Brace gently and lower opposite arm and leg only as far as your back stays comfortable.', 'Front plank'], ['Dumbbell suitcase carry', 'Trunk and grip', 3, '30-45 sec each side', 'Hold one dumbbell at your side, stand tall without leaning, walk slowly, then switch sides.', 'Side plank'], ['Side plank', 'Obliques and trunk', 3, '20-40 sec each side', 'Support yourself on a forearm and knees or feet. Keep hips lifted and shoulders stacked; stop before your position sags.', 'Bent-knee side plank']],
  arms: [['Dumbbell curl', 'Biceps', 3, '8-12', 'Stand tall with elbows by your sides. Curl the dumbbells without swinging, pause, and lower slowly.', 'Self-resisted curl'], ['Dumbbell overhead triceps extension', 'Triceps', 3, '8-12', 'Hold one dumbbell securely overhead with elbows comfortably bent. Extend arms without arching your back, then lower slowly.', 'Close-grip push-up'], ['Close-grip push-up', 'Triceps and chest', 2, '8-15', 'Place hands slightly inside shoulder width. Keep elbows near your sides, lower under control, and press up smoothly.', 'Knee close-grip push-up']],
  calves: [['Dumbbell calf raise', 'Calves', 3, '10-20', 'Hold light dumbbells at your sides, stand steadily, rise onto the balls of your feet, pause, and lower slowly.', 'Bodyweight calf raise'], ['Bent-knee calf raise', 'Soleus and calves', 3, '12-20', 'Hold light dumbbells at your sides and keep knees softly bent. Rise smoothly, pause, and lower with control.', 'Bodyweight calf raise'], ['Single-leg calf raise', 'Calves', 3, '8-15 each side', 'Hold one light dumbbell at your side and balance carefully. Raise and lower through a comfortable range; use bodyweight if needed.', 'Two-leg calf raise']],
}

EXERCISES.Dumbbells = DUMBBELL_MOVES
for (const equipment of ['Home gym', 'Full gym']) EXERCISES[equipment] = DUMBBELL_MOVES
EXERCISES['Home gym'] = DUMBBELL_MOVES
EXERCISES['Full gym'] = { ...DUMBBELL_MOVES,
  shoulders: [...DUMBBELL_MOVES.shoulders, ['Cable lateral raise', 'Side delts', 2, '12-15 each side', 'Set the cable low, stand tall, and raise your arm out to the side with a soft elbow; lower slowly.', 'Dumbbell lateral raise']],
  back: [...DUMBBELL_MOVES.back, ['Lat pulldown', 'Lats and upper back', 3, '8-12', 'Use a comfortable grip, draw shoulders down, pull the bar toward upper chest without leaning back, and return slowly.', 'Single-arm dumbbell row']],
}

function cleanList(value) { return Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 8) : [] }
function inferMusclePriorities(physique, scores, userFocus = 'Auto from scan') {
  if (userFocus === 'Balanced') return []
  if (userFocus && userFocus !== 'Auto from scan' && userFocus !== 'Balanced') {
    const chosen = MUSCLE_HINTS.find(item => item.area === userFocus)
    if (chosen) return [{ ...chosen, reason: 'Chosen by you as the area to emphasize.', confidence: 'user-selected' }]
  }

  const findings = [...cleanList(physique?.physique_improvements), ...cleanList(physique?.physiqueImprovements)]
  const supported = []
  for (const finding of findings) {
    const match = MUSCLE_HINTS.find(item => item.pattern.test(finding))
    if (match && !supported.some(item => item.area === match.area)) supported.push({ ...match, reason: finding, confidence: 'supported observation' })
  }
  if (supported.length) return supported.slice(0, 2)

  if (Number(scores.v_taper) <= 6 || Number(scores.frame_width) <= 6) {
    return [{ ...MUSCLE_HINTS[0], reason: 'The visible shoulder-to-waist/frame ratings suggest upper-body width may be worth emphasizing; this is a tentative photo-based cue, not a muscle measurement.', confidence: 'tentative visual cue' }, { ...MUSCLE_HINTS[2], reason: 'The visible shoulder-to-waist/frame ratings suggest balanced upper-back work may help; the scan does not directly measure back strength or thickness.', confidence: 'tentative visual cue' }]
  }
  return []
}

function pickMoves(equipment, category, priorityAreas, daysPerWeek, dayIndex) {
  const library = EXERCISES[equipment] || EXERCISES.Bodyweight
  const priority = priorityAreas[(dayIndex) % Math.max(1, priorityAreas.length)]
  const area = priority?.area.toLowerCase() || ''
  const candidateKey = area.includes('shoulder') ? 'shoulders' : area.includes('chest') ? 'chest' : area.includes('back') ? 'back' : area.includes('calv') ? 'calves' : area.includes('leg') || area.includes('hamstring') || area.includes('glute') ? 'legs' : area.includes('core') ? 'core' : area.includes('arm') ? 'arms' : null
  const allowedPriorityGroups = {
    Upper: ['shoulders', 'chest', 'back', 'arms', 'core'], Lower: ['legs', 'calves', 'core'],
    Push: ['shoulders', 'chest', 'arms', 'core'], Pull: ['back', 'shoulders', 'arms', 'core'], Legs: ['legs', 'calves', 'core'],
  }
  const main = priority && (category === 'Priority' || category === 'Full Body' || allowedPriorityGroups[category]?.includes(candidateKey)) ? priority : null
  const priorityKey = main ? candidateKey : null
  const ordered = priorityKey ? [priorityKey] : []
  const sequence = category === 'Lower' || category === 'Legs' ? [...ordered, 'legs', 'calves', 'core']
    : category === 'Upper' ? [...ordered, 'chest', 'back', 'shoulders', 'arms', 'core']
      : category === 'Push' ? [...ordered, 'chest', 'shoulders', 'arms', 'core']
        : category === 'Pull' ? [...ordered, 'back', 'shoulders', 'arms', 'core']
          : [...ordered, 'legs', 'chest', 'back', 'core']
  const selected = []
  for (const muscle of sequence) {
    const moves = library[muscle] || library.core
    const move = moves[(dayIndex + selected.length) % moves.length]
    if (!selected.some(item => item[0] === move[0])) selected.push(move)
    if (selected.length === 4) break
  }
  while (selected.length < 3) selected.push(library.core[selected.length % library.core.length])
  return selected.map(([name, targetMuscles, sets, reps, instructions, substitute], index) => ({
    name, targetMuscles: [targetMuscles], sets: main && priorityKey && index === 0 ? Math.min(4, sets + 1) : sets,
    reps, restSeconds: sets >= 3 ? 90 : 60, effortTarget: 'Finish with about 2–3 good reps in reserve.',
    why: main && priorityKey && index === 0 ? `Extra work for your ${main.area.toLowerCase()} emphasis: ${main.reason}` : 'Included to keep the weekly program balanced around your selected goal.',
    instructions, progressionInstructions: 'Log every set. When all sets reach the top of the range with steady form and the target effort, add a rep or use the listed harder variation.', alternatives: [substitute],
  }))
}

function buildBaselineWorkout({ daysPerWeek, level, goal, equipment, scores, physique, userFocus }) {
  const priorities = inferMusclePriorities(physique, scores, userFocus)
  const title = priorities[0]?.area || 'Balanced full body'
  const split = daysPerWeek <= 3 ? `${daysPerWeek}-day Full Body` : daysPerWeek === 4 ? '4-day Upper/Lower' : daysPerWeek === 5 ? '5-day Upper/Lower + priority' : '6-day Push/Pull/Legs'
  const days = Array.from({ length: daysPerWeek }, (_, index) => {
    const kind = daysPerWeek <= 3 ? 'Full Body' : daysPerWeek === 4 ? (index % 2 === 0 ? 'Upper' : 'Lower') : daysPerWeek === 5 ? ['Upper', 'Lower', 'Upper', 'Lower', 'Priority'][index] : ['Push', 'Pull', 'Legs'][index % 3]
    const label = kind === 'Priority' ? `${title} Focus` : kind
    return { name: `${label} ${['A', 'B', 'C'][Math.floor(index / 3)] || ''}`.trim(), focus: kind === 'Priority' ? `${title} emphasis` : kind === 'Full Body' ? (priorities[0]?.area ? `Balanced with ${priorities[0].area.toLowerCase()} emphasis` : 'Balanced full-body strength') : `${kind} strength and balance`, targetMuscles: kind === 'Lower' || kind === 'Legs' ? ['Quadriceps', 'Hamstrings', 'Glutes'] : kind === 'Upper' || kind === 'Push' || kind === 'Pull' ? ['Chest', 'Back', 'Shoulders', 'Arms'] : ['Upper body', 'Lower body', 'Trunk'], exercises: pickMoves(equipment, kind, priorities, daysPerWeek, index) }
  })
  const primary = priorities[0]
  return {
    split, trainingLevel: level, trainingEmphasis: primary ? `${primary.area} + balanced development` : 'Balanced development',
    emphasisReason: primary ? `${primary.reason} This is a training suggestion, not a diagnosis.` : 'The saved scan does not contain a sufficiently specific, reliable muscle-group finding. This baseline follows your goal; you can choose a focus before regenerating.',
    prioritySource: primary?.confidence || 'balanced baseline',
    priorities: priorities.map((item, index) => ({ area: item.area, muscles: item.muscles, role: index === 0 ? 'Primary' : 'Secondary', reason: item.reason, confidence: item.confidence })),
    maintenanceAreas: ['Chest', 'Back', 'Shoulders', 'Arms', 'Quadriceps', 'Hamstrings', 'Glutes', 'Trunk'],
    days, fallbackUsed: true,
    fallbackNotice: 'AI could not return a complete schedule, so this safe equipment-matched baseline was created. Its scan focus is tentative; review or change it before starting.',
    goal,
  }
}

function validateWorkoutPlan(plan, daysPerWeek, equipment, priorities = []) {
  if (!plan || !Array.isArray(plan.days) || plan.days.length !== daysPerWeek) return false
  const allowed = new Set(Object.keys(EXERCISES))
  if (!allowed.has(equipment)) return false
  const prohibited = equipment === 'Bodyweight' ? /dumbbell|barbell|cable|machine|pull.?up|chin.?up|lat pulldown|bench|resistance band|step.?up|leg press/i
    : equipment === 'Dumbbells' || equipment === 'Home gym' ? /barbell|cable|lat pulldown|leg press|machine|bench/i
      : null
  const complete = plan.days.every(day => day && typeof day.name === 'string' && typeof day.focus === 'string' && Array.isArray(day.targetMuscles) && day.targetMuscles.length > 0 && Array.isArray(day.exercises) && day.exercises.length >= 3 && day.exercises.length <= 6 && day.exercises.every(exercise => exercise && typeof exercise.name === 'string' && Array.isArray(exercise.targetMuscles) && exercise.targetMuscles.length > 0 && Number.isInteger(exercise.sets) && exercise.sets >= 1 && typeof exercise.reps === 'string' && Number.isInteger(exercise.restSeconds) && exercise.restSeconds >= 30 && exercise.restSeconds <= 300 && typeof exercise.effortTarget === 'string' && typeof exercise.why === 'string' && typeof exercise.instructions === 'string' && exercise.instructions.length > 10 && typeof exercise.progressionInstructions === 'string' && Array.isArray(exercise.alternatives) && exercise.alternatives.length > 0 && (!prohibited || !prohibited.test(`${exercise.name} ${exercise.alternatives.join(' ')}`))))
  if (!complete) return false
  if (!priorities.length) return true
  const primary = priorities[0]
  const area = primary.area.toLowerCase()
  const key = area.includes('shoulder') ? 'shoulders' : area.includes('chest') ? 'chest' : area.includes('back') ? 'back' : area.includes('calv') ? 'calves' : area.includes('leg') || area.includes('hamstring') || area.includes('glute') ? 'legs' : area.includes('core') ? 'core' : area.includes('arm') ? 'arms' : null
  const expectedExercise = PRIORITY_EXERCISES[key]
  if (!expectedExercise) return false
  const priorityDays = plan.days.filter(day => day.exercises.some(exercise => expectedExercise.test(exercise.name)))
  const requiredSessions = daysPerWeek >= 4 ? 2 : 1
  const weeklyPrioritySets = plan.days.flatMap(day => day.exercises).filter(exercise => expectedExercise.test(exercise.name)).reduce((total, exercise) => total + exercise.sets, 0)
  if (priorityDays.length < requiredSessions || weeklyPrioritySets < requiredSessions * 3) return false
  if (priorities[1]) {
    const secondary = priorities[1].area.toLowerCase()
    const secondaryKey = secondary.includes('shoulder') ? 'shoulders' : secondary.includes('chest') ? 'chest' : secondary.includes('back') ? 'back' : secondary.includes('calv') ? 'calves' : secondary.includes('leg') || secondary.includes('hamstring') || secondary.includes('glute') ? 'legs' : secondary.includes('core') ? 'core' : secondary.includes('arm') ? 'arms' : null
    const secondaryPattern = PRIORITY_EXERCISES[secondaryKey]
    if (!secondaryPattern || !plan.days.some(day => day.exercises.some(exercise => secondaryPattern.test(exercise.name)))) return false
  }
  return true
}

module.exports = { buildBaselineWorkout, inferMusclePriorities, validateWorkoutPlan }
