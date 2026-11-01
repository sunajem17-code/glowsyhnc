import { getRevealRatings } from './revealRatings'
import { getPhysiqueMetricScore } from './physiqueResults'

const metricAdvice = {
  symmetry: 'For a small left-to-right difference, keep grooming even on both sides. A face scan cannot tell whether a difference is caused by bone, expression, or a temporary habit, so do not try to force your face into place.',
  skin: 'Use a gentle cleanser and plain moisturizer daily, and add SPF 30 in the morning. If the scan notes acne, add one acne treatment at a time; painful or lasting acne is best handled with a clinician.',
  jawline: 'A lower jawline score means the jaw reads less clearly in this scan. A haircut cannot change that. If you have extra body fat, gradual fat loss can reveal more of your existing shape; strength train, eat regular balanced meals, and avoid crash diets. Mewing and jaw gadgets are not proven ways to grow an adult jaw.',
  cheekbones: 'A lower cheekbone score means the cheek area reads less prominent. If facial puffiness is present, prioritize regular sleep and steady hydration; do not dehydrate or crash diet. Styling can frame the area, but it cannot change cheekbone structure.',
  'eye area': 'Work on the parts you can change safely: keep brows tidy without over-plucking, get enough sleep, and use a simple moisturizer. A photo score cannot diagnose a lazy eye or eyelid condition; ask an eye-care professional if you notice vision trouble or a persistent eye turn.',
  'facial proportions': 'This score describes how the features fit together; it is not a flaw you can change with exercises. Focus first on lower-scoring areas you can act on, such as skin care and grooming, and avoid products that promise to reshape bone.',
  'facial harmony': 'This is a broad score, not one body part to fix. Use the lower specific scores below it to choose practical steps instead of trying to change your face with unproven devices or exercises.',
  'hair / grooming': 'Choose a haircut that works with your natural hair and keep the edges and facial hair intentional. A barber can help you pick a shape; grooming changes presentation, not facial structure.',
}

function scoreNumber(value) {
  if (value == null || value === '') return null
  const score = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number(value?.score)
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null
}

function scanAreas(scan) {
  const ai = scan?.aiScore || scan || {}
  const metrics = ai.faceMetrics || ai.face_metrics || {}
  const sub = ai.faceSubScores || ai.face_sub_scores || {}
  const ratings = getRevealRatings(scan)
  const areas = [
    ['jawline', ratings.find(item => item.label === 'Jawline')?.value ?? scoreNumber(sub.jawlineDefinition ?? sub.jawline_definition) ?? scoreNumber(metrics.jawline)],
    ['cheekbones', ratings.find(item => item.label === 'Cheekbones')?.value ?? scoreNumber(sub.cheekbones ?? sub.cheekboneProminence) ?? scoreNumber(metrics.cheekbones)],
    ['skin', ratings.find(item => item.label === 'Skin Quality')?.value ?? scoreNumber(sub.skinClarity ?? sub.skin_clarity) ?? scoreNumber(metrics.skinQuality)],
    ['symmetry', ratings.find(item => item.label === 'Symmetry')?.value ?? scoreNumber(sub.symmetry) ?? scoreNumber(metrics.symmetry)],
    ['eye area', scoreNumber(sub.eyeArea ?? sub.eye_area) ?? scoreNumber(metrics.eyeArea ?? metrics.eye_area)],
    ['facial proportions', scoreNumber(sub.facialProportions ?? sub.facial_proportions) ?? scoreNumber(metrics.facialProportions ?? metrics.facial_proportions)],
    ['facial harmony', scoreNumber(sub.facialHarmony ?? sub.facial_harmony) ?? scoreNumber(metrics.facialHarmony ?? metrics.facial_harmony)],
  ]
  return areas.filter(([, score]) => score != null)
}

function savedImprovementAdvice(scan) {
  const analysis = scan?.aiScore?.appearanceAnalysis || scan?.appearanceAnalysis
  return Array.isArray(analysis?.improvementOpportunities) ? analysis.improvementOpportunities : []
}

function topicForFinding(finding) {
  const text = `${finding?.title || ''} ${finding?.observation || ''}`.toLowerCase()
  if (/jaw|chin|lower.face/.test(text)) return 'jawline'
  if (/cheek|midface/.test(text)) return 'cheekbones'
  if (/skin|acne|pimple/.test(text)) return 'skin'
  if (/symmetr|left.right|alignment/.test(text)) return 'symmetry'
  if (/eye|brow|eyelid/.test(text)) return 'eye area'
  if (/proportion|thirds/.test(text)) return 'facial proportions'
  if (/harmony/.test(text)) return 'facial harmony'
  if (/hair|groom/.test(text)) return 'hair / grooming'
  return null
}

function adviceForArea(area, scan) {
  const saved = savedImprovementAdvice(scan).find(item => topicForFinding(item) === area)
  const recommendation = typeof saved?.recommendation === 'string' ? saved.recommendation.trim() : ''
  const isPhotoAdvice = /\b(?:photo|picture|camera|lighting|light source|angle|shot)\b/i.test(recommendation)
  return recommendation && !isPhotoAdvice ? recommendation : metricAdvice[area] || 'Use the matching improvement note from your scan and make one small, repeatable change at a time.'
}

function priorConversationText(conversation = []) {
  return conversation
    .filter(message => message?.role === 'user' && typeof message.content === 'string')
    .slice(-12)
    .map(message => message.content)
    .join('\n')
    .toLowerCase()
}

function hasNoFacialHair(conversation = []) {
  return /\b(?:(?:don't|dont|do not) have facial hair|(?:can't|cannot) grow (?:a )?(?:beard|facial hair)|i(?:'m| am) clean[- ]shaven|no facial hair|i have no beard)\b/i.test(priorConversationText(conversation))
}

function findingForArea(area, scan) {
  return savedImprovementAdvice(scan).find(item => topicForFinding(item) === area) || null
}

function cleanAdviceForContext(advice, conversation) {
  if (!hasNoFacialHair(conversation)) return advice
  const cleaned = advice
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !/facial hair|beard|mustache|moustache/i.test(sentence))
    .join(' ')
    .trim()
  return cleaned || 'Keep the area clean and focus on changes that can affect how your existing jawline reads. Do not expect exercises or jaw gadgets to reshape adult bone.'
}

function describeArea(area, value, scan, conversation) {
  const finding = findingForArea(area, scan)
  const scoreText = value == null ? '' : `Your saved scan rates it ${value.toFixed(1)}/10. `
  const observation = typeof finding?.observation === 'string' ? finding.observation.trim() : ''
  const recommendation = cleanAdviceForContext(adviceForArea(area, scan), conversation)
  return [scoreText + observation, recommendation].filter(Boolean).join('\n\n')
}

function buildLocalCoachPreviewReplyCore(prompt, scanContext) {
  const question = String(prompt || '').toLowerCase()
  const score = Number(scanContext?.glowScore)
  const scoreLine = Number.isFinite(score) && score > 0 ? `Latest overall score: ${score.toFixed(1)}/10.` : ''
  const conversation = scanContext?.conversation || []
  const areas = scanAreas(scanContext?.scan)
  const lowerAreas = areas.filter(([, value]) => value < 8).sort((a, b) => a[1] - b[1])
  const relevantFindings = savedImprovementAdvice(scanContext?.scan)
  const asksForAll = /all (?:the )?(?:areas|things|improvements)|everything|list|what can i (?:fix|improve)|areas i can pick/.test(question)
  const asksForPriority = /what should i (?:fix|work on|focus on|improve) first|what to (?:fix|work on|improve) first|what can i improve first|first to|holding my score back|biggest|most important|top priority|where should i start/.test(question)

  // A request for improvement advice is about the selected/latest scan. Only
  // enter the timeline branch when the user explicitly asks for change over
  // time; matching the word "improve" alone wrongly turned advice requests
  // into earliest-vs-newest comparisons.
  const asksAboutTrend = /\b(?:all|every)\s+(?:of\s+)?(?:my\s+)?(?:saved\s+)?scans\b|\b(?:have i|am i|did i|have my scores|are my scores)\b.{0,50}\b(?:improv(?:ed|ing)?|better|worse|chang(?:ed|ing)|progress)\b|\b(?:compare|comparison|trend|progress)\b.{0,40}\b(?:scans?|scores?|ratings?)\b|\b(?:scans?|scores?|ratings?)\b.{0,40}\b(?:over time|since my|between my|across my)\b|\b(?:better|worse|improv(?:ed|ing)?)\b.{0,40}\b(?:since my last scan|since my previous scan|over time)\b/.test(question)

  if (asksAboutTrend) {
    const history = (Array.isArray(scanContext?.scans) ? scanContext.scans : [scanContext?.scan])
      .filter(Boolean)
      .map(scan => ({ scan, at: Date.parse(scan?.analyzedAt ?? scan?.scanDate ?? scan?.created_at ?? scan?.createdAt ?? scan?.scan_date) || 0 }))
      .sort((a, b) => a.at - b.at)
    if (history.length < 2) {
      const oneScan = history.length === 1
      return `${oneScan ? 'I can see one completed scan, so I can’t tell whether you have improved yet. Save another scan later to make a real comparison.' : 'I can’t find completed scans on this device to compare yet. Once you have at least two saved scans, I can check your progress.'}\n\nFor a steady plan between scans, open and follow the Face & Body Routine.${scoreLine ? `\n\n${scoreLine}` : ''}`
    }

    const first = history[0]
    const latest = history[history.length - 1]
    const dateLabel = at => at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'date not saved'
    const firstRatings = getRevealRatings(first.scan)
    const latestRatings = getRevealRatings(latest.scan)
    const comparisons = firstRatings.flatMap((rating, index) => {
      const before = scoreNumber(rating.value)
      const after = scoreNumber(latestRatings[index]?.value)
      if (before == null || after == null) return []
      const delta = Math.round((after - before) * 10) / 10
      const movement = Math.abs(delta) < 0.1 ? 'about the same' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}`
      return [`${rating.label}: ${before.toFixed(1)} → ${after.toFixed(1)} (${movement})`]
    })
    const physiqueMetrics = [
      ['Physique overall', 'overall'], ['Muscle mass', 'muscle_mass'], ['Body fat score', 'body_fat_score'],
      ['V-taper', 'v_taper'], ['Frame width', 'frame_width'],
    ]
    physiqueMetrics.forEach(([label, key]) => {
      const before = getPhysiqueMetricScore(first.scan, key)
      const after = getPhysiqueMetricScore(latest.scan, key)
      if (before == null || after == null) return
      const delta = Math.round((after - before) * 10) / 10
      const movement = Math.abs(delta) < 0.1 ? 'about the same' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}`
      comparisons.push(`${label}: ${before.toFixed(1)} → ${after.toFixed(1)} (${movement})`)
    })
    const trend = comparisons.length
      ? comparisons.join('\n')
      : 'The saved scans do not have matching score fields, so I can’t compare their ratings reliably.'
    return `I compared your earliest and newest saved scans (${history.length} scans total): ${dateLabel(first.at)} to ${dateLabel(latest.at)}.\n\n${trend}\n\nThese are changes in the app’s ratings, not proof that your appearance changed by the same amount. Keep using the same routine and compare again later. Open and follow the Face & Body Routine for your daily face and body steps.${scoreLine ? `\n\n${scoreLine}` : ''}`
  }

  if (asksForAll || asksForPriority) {
    const selected = asksForAll ? lowerAreas : lowerAreas.slice(0, 1)
    const advice = selected.map(([area, value]) => {
      const title = area.replace(/\b\w/g, letter => letter.toUpperCase())
      return `**${title} — ${value.toFixed(1)}/10**\n${describeArea(area, value, scanContext?.scan, conversation)}`
    })
    const unmatchedFindings = relevantFindings.filter(item => !selected.some(([area]) => topicForFinding(item) === area))
    if (asksForAll) {
      unmatchedFindings.forEach(item => {
        const title = String(item?.title || '').trim()
        const recommendation = String(item?.recommendation || '').trim()
        if (title && recommendation && !/\b(?:photo|picture|camera|lighting|light source|angle|shot)\b/i.test(recommendation)) {
          advice.push(`**${title}**\n${recommendation}`)
        }
      })
    }
    if (advice.length) {
      const lead = asksForPriority
        ? `Start with **${selected[0]?.[0] || 'your lowest-rated area'}**. It is your lowest scored area in the saved scan, so it is the clearest first focus.`
        : 'Here are the improvement areas supported by your saved scan, from lowest score upward:'
      return [lead, ...advice, scoreLine].filter(Boolean).join('\n\n')
    }
    if (relevantFindings.length) {
      const findings = relevantFindings.filter(item => item?.title && item?.recommendation)
      if (findings.length) return `${asksForPriority ? 'Start with this scan finding:' : 'These are the improvement areas in your scan:'}\n\n${findings.map(item => `**${item.title}**\n${item.recommendation}`).join('\n\n')}${scoreLine ? `\n\n${scoreLine}` : ''}`
    }
    return `I can’t see detailed face-area scores in the scan saved on this device, so I won’t guess at a flaw. Open the latest scan results to refresh them, then ask me again.${scoreLine ? ` ${scoreLine}` : ''}`
  }

  if (/skin|acne|pimple|routine|moistur|cleanser|spf|sunscreen/.test(question)) {
    const skinScore = areas.find(([area]) => area === 'skin')?.[1]
    const finding = findingForArea('skin', scanContext?.scan)
    const scanNote = finding?.observation ? `Your scan rates skin ${skinScore?.toFixed(1) ?? '—'}/10 and notes: ${finding.observation.trim()} ` : ''
    return `**Skin: a simple routine**\n${scanNote}In the morning, wash gently, use a plain moisturizer, then broad-spectrum SPF 30+. At night, wash and moisturize. If you have acne, add one over-the-counter acne product at a time and follow its label; stop if it burns or swells. If acne is painful or leaves marks, book a dermatologist. Don’t scrub or pick.` + (scoreLine ? `\n\n${scoreLine}` : '')
  }
  if (/jaw|chin|face shape|jawline/.test(question)) {
    const jawScore = areas.find(([area]) => area === 'jawline')?.[1]
    const jaw = describeArea('jawline', jawScore, scanContext?.scan, conversation)
    const addedStep = /body fat|fat loss|weight loss/i.test(jaw)
      ? ''
      : 'If you personally have excess body fat, a slow, sustainable reduction may reveal more of your existing jawline; the scan cannot tell your body-fat level. Don’t crash diet.'
    return `**Jawline: what to work on**\n${jaw || 'Your saved scan does not include a specific jawline finding, so I will not invent one.'}\n\nMewing, hard chewing, and jaw gadgets have not been shown to grow an adult jaw. ${addedStep}`.trim() + (scoreLine ? `\n\n${scoreLine}` : '')
  }
  if (/workout|training|muscle|gym|exercise/.test(question)) {
    return `**A simple 3-day strength plan**\nDo this on Monday, Wednesday, and Friday, or leave one rest day between workouts. Start with 2 sets of 8–12 reps for each: chair or goblet squats, push-ups (use a wall or bench if needed), a backpack or band row, hip bridges, and a light overhead press. Rest 1–2 minutes between sets. Pick a load that lets you finish with good form. When you can do 12 reps easily in both sets, add a little weight or choose a slightly harder version. Stop for sharp pain; if you have an injury or health condition, ask a clinician before starting. Track the weights and reps so you can see progress.${scoreLine ? `\n\n${scoreLine}` : ''}`
  }
  if (/hair|style|clothes|outfit|presentation|groom/.test(question)) {
    return `**A quick presentation win**\nChoose one change you can repeat: keep hair tidy in a shape that works with its natural texture, maintain simple grooming, and wear clean, well-fitting clothes. Take a photo in even daylight to compare options fairly.${scoreLine ? `\n\n${scoreLine}` : ''}`
  }
  if (lowerAreas.length) {
    const [area, value] = lowerAreas[0]
    return `**Start with ${area} (${value.toFixed(1)}/10)**\n${describeArea(area, value, scanContext?.scan, conversation)}\n\nThis is the lowest rated area in your saved scan.${scoreLine ? `\n\n${scoreLine}` : ''}`
  }
  return `Tell me what you want to improve, or ask “what should I fix first?” and I’ll use your saved scan scores to name the best starting point. I won’t invent a weakness when the scan has no supporting score.${scoreLine ? `\n\n${scoreLine}` : ''}`
}

// Keep the local Pro preview connected to the same in-app routine as the
// server-backed Coach, including when a response is produced by a specific
// advice branch above.
export function buildLocalCoachPreviewReply(prompt, scanContext) {
  const reply = buildLocalCoachPreviewReplyCore(prompt, scanContext)
  const routineIsRelevant = /routine|plan|daily|skincare|skin|workout|training|fitness|improv|fix|focus|advice|recommend|jaw|groom/i.test(String(prompt || ''))
  if (/face & body routine/i.test(reply) || !routineIsRelevant) return reply
  return `${reply}\n\nFor a plan you can follow each day, open the Face & Body Routine and use the Face Routine or Body Routine that matches your goal.`
}
