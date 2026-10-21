export function buildLocalCoachPreviewReply(prompt, scanContext) {
  const question = String(prompt || '').toLowerCase()
  const score = Number(scanContext?.glowScore)
  const scoreLine = Number.isFinite(score) && score > 0
    ? ` Your latest scan is ${score.toFixed(1)}/10, so focus on steady, repeatable improvements rather than chasing a quick fix.`
    : ''

  if (/skin|acne|pimple|routine|moistur|cleanser|spf|sunscreen/.test(question)) {
    return `**A simple skin routine**\nStart with a gentle cleanser, a non-comedogenic moisturizer, and broad-spectrum SPF 30+ each morning. At night, cleanse and moisturize. Introduce only one new active at a time, and stop if it irritates your skin. For persistent acne or pain, check in with a dermatologist.${scoreLine}`
  }
  if (/jaw|chin|face shape|jawline/.test(question)) {
    return `**A practical jawline focus**\nKeep it healthy and gradual: consistent strength training, regular sleep, hydration, and a balanced eating pattern matter more than jaw gadgets or extreme dieting. A haircut or facial-hair shape that suits your face can also make a noticeable styling difference.${scoreLine}`
  }
  if (/workout|training|muscle|gym|exercise/.test(question)) {
    return `**A solid training starting point**\nTry full-body resistance training 3 days per week. Use a few basic movements, keep good form, and add a small amount of weight or reps over time. Leave recovery days between hard sessions and aim for consistent sleep and meals. Adjust the plan to your experience and any advice from your clinician.${scoreLine}`
  }
  if (/hair|style|clothes|outfit|presentation|groom/.test(question)) {
    return `**A quick presentation win**\nChoose one change you can repeat: keep hair tidy in a shape that works with its natural texture, maintain simple grooming, and wear clean, well-fitting clothes. Take a photo in even daylight to compare options fairly.${scoreLine}`
  }
  return `**Your next step**\nUse your scan as a baseline, pick one area to work on for the next two weeks, and keep the routine simple. Track it with consistent photos and notes. Prioritize sleep, regular movement, hydration, and patient progress over drastic changes.${scoreLine}`
}
