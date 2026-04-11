// Phase assignment based on body score from AI scan
export function assignPhase(bodyScore, goal) {
  if (!bodyScore) return 'TRANSFORM'
  if (bodyScore < 4.0) return 'LEAN'
  if (bodyScore >= 6.5 && goal === 'Style & Grooming') return 'REFINE'
  if (bodyScore > 6.0 && goal === 'Face & Jawline') return 'SCULPT'
  if (bodyScore >= 6.5) return 'REFINE'
  return 'TRANSFORM'
}

export const PHASE_META = {
  LEAN: {
    label: 'Cut Phase',
    emoji: '🔥',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
    desc: 'Your scan shows excess body fat that is hiding your facial bone structure and jawline. Losing fat is the single highest-ROI move you can make for your looks right now.',
    focus: ['Caloric deficit to reveal facial structure', 'Mewing 24/7 — results compound as fat reduces', 'Skincare routine to maximise skin quality', 'Style basics while you transform'],
  },
  SCULPT: {
    label: 'Bulk Phase',
    emoji: '💪',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.1)',
    border: 'rgba(59,130,246,0.25)',
    desc: 'Good body composition but your face and jawline have room to improve. This phase focuses on facial structure, mewing, grooming, and skin to maximise your facial rating.',
    focus: ['Advanced mewing and jaw exercises daily', 'Full skincare protocol — retinol, Vitamin C, SPF', 'Beard and brow grooming optimisation', 'Haircut that complements your face shape'],
  },
  TRANSFORM: {
    label: 'Recomp Phase',
    emoji: '⚡',
    color: '#C6A85C',
    bg: 'rgba(198,168,92,0.1)',
    border: 'rgba(198,168,92,0.25)',
    desc: 'You\'re in the middle ground with clear upside across face, body, and style. This phase attacks all three simultaneously for the biggest visible improvement in 90 days.',
    focus: ['Skincare routine starts now — no excuses', 'Mewing and jaw exercises daily', 'Body composition improvement for better ratios', 'Grooming and style upgrade'],
  },
  REFINE: {
    label: 'Maintenance Phase',
    emoji: '✅',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.25)',
    desc: 'Strong foundation. This phase is about dialling in the details that separate good-looking from exceptional — advanced skincare, precise grooming, style, and facial optimisation.',
    focus: ['Advanced skincare: tretinoin, peptides, acids', 'Precision grooming — brows, beard line, hair', 'Style and wardrobe optimisation', 'Fine-tuning facial aesthetics'],
  },
}

export function generateRoadmap(phase, weakScores = {}) {
  const roadmap = {
    'Week 1–2': [],
    'Week 3–4': [],
    'Month 2': [],
    'Month 3': [],
  }

  if (phase === 'LEAN') {
    roadmap['Week 1–2'] = [
      { id: 'r1', title: 'Start mewing — tongue on roof of mouth 24/7', category: 'style', duration: 5, details: 'Full tongue flat on palate with suction hold. Do this constantly. As fat reduces, your bone structure becomes visible. This compounds over months.' },
      { id: 'r2', title: 'Calculate your caloric deficit', category: 'health', duration: 10, details: 'Use a TDEE calculator online. Subtract 400–500 calories. Fat loss reveals your jawline and cheekbones faster than anything else.' },
      { id: 'r3', title: 'Start a basic skincare routine', category: 'skin', duration: 8, details: 'AM: Gentle cleanser + SPF 50. PM: Gentle cleanser + moisturiser. Two steps minimum — always.' },
      { id: 'r4', title: 'Get a haircut this week', category: 'style', duration: 60, details: 'A well-suited haircut is an immediate upgrade. Tell your barber your face shape from your scan results.' },
    ]
    roadmap['Week 3–4'] = [
      { id: 'r5', title: 'Add chin tucks — 3 sets × 30 reps daily', category: 'style', duration: 10, details: 'Pull chin straight back, hold 3 seconds. Strengthens neck and reduces double chin appearance. Do in car, at desk, anywhere.' },
      { id: 'r6', title: 'Eliminate liquid calories', category: 'health', duration: 5, details: 'Cut juice, alcohol, sugary drinks. Water, black coffee, sparkling water only. Easy 300–500 calorie reduction per day.' },
      { id: 'r7', title: 'Take weekly progress photos', category: 'health', duration: 5, details: 'Same lighting, same location, Sunday morning. Front and side profile. Your face changes faster than the scale reflects.' },
    ]
    roadmap['Month 2'] = [
      { id: 'r8', title: 'Add mastic gum — 20 min/day chewing', category: 'style', duration: 20, details: 'Strengthens masseter muscles. More visible at lower body fat. Use Falim or Mewingpack brand.' },
      { id: 'r9', title: 'Upgrade to Vitamin C serum in AM', category: 'skin', duration: 5, details: 'Apply after cleansing, before SPF. Brightens skin, fades dark spots, improves tone. Use 10–15% L-ascorbic acid.' },
      { id: 'r10', title: 'Groom eyebrows — visit a salon or barber', category: 'style', duration: 30, details: 'Cleaned up brows make your face look more defined and put-together. Huge ROI for 30 minutes.' },
    ]
    roadmap['Month 3'] = [
      { id: 'r11', title: 'Re-scan — compare before and after', category: 'health', duration: 10, details: 'Take photos in the exact same conditions as your original scan. The AI will show your score improvement.' },
      { id: 'r12', title: 'Add retinol to your PM routine', category: 'skin', duration: 5, details: 'Start 0.025–0.05% retinol 2x per week on dry skin. The most proven anti-ageing and texture ingredient available without prescription.' },
      { id: 'r13', title: 'Wardrobe audit — fit over brand', category: 'style', duration: 60, details: 'Your clothes should fit perfectly. At lower body fat your proportions improve — update your wardrobe accordingly. Slim-fit basics first.' },
    ]
  } else if (phase === 'SCULPT') {
    roadmap['Week 1–2'] = [
      { id: 'r1', title: 'Start mewing — full tongue on palate 24/7', category: 'style', duration: 5, details: 'Entire tongue flat against the roof of your mouth. Suction hold. This is the most important habit — do it always.' },
      { id: 'r2', title: 'Build your full skincare routine', category: 'skin', duration: 10, details: 'AM: Cleanser → Vitamin C serum → SPF 50. PM: Cleanser → Retinol or niacinamide → Moisturiser. Consistency matters more than products.' },
      { id: 'r3', title: 'Get a haircut matched to your face shape', category: 'style', duration: 60, details: 'Use your face shape from the scan to guide your barber. The right haircut frames your face and draws attention to your best features.' },
      { id: 'r4', title: 'Groom your eyebrows', category: 'style', duration: 30, details: 'Clean up the unibrow and stray hairs. Defined brows make your eyes look sharper and your face more symmetrical.' },
    ]
    roadmap['Week 3–4'] = [
      { id: 'r5', title: 'Add mastic gum chewing — 20 min/day', category: 'style', duration: 20, details: 'Hardens masseter muscles, giving a more square and defined jaw appearance. Use while watching TV or commuting.' },
      { id: 'r6', title: 'Add chin tucks — 3 × 30 reps daily', category: 'style', duration: 10, details: 'Strengthens deep neck flexors and reduces forward head posture. Dramatically improves profile view.' },
      { id: 'r7', title: 'Optimise your sleep position', category: 'health', duration: 5, details: 'Sleep on your back without a pillow or with a thin pillow. Side sleeping can cause asymmetry over time. Back sleeping reduces puffiness.' },
    ]
    roadmap['Month 2'] = [
      { id: 'r8', title: 'Add tretinoin to your routine', category: 'skin', duration: 5, details: 'Start 0.025% tretinoin 2x per week. The gold standard — prescription-strength retinoid. Reduces pores, improves texture, and boosts collagen.' },
      { id: 'r9', title: 'Start beard sculpting or clean shave protocol', category: 'style', duration: 15, details: 'A well-shaped beard can mask a weak jawline. A clean shave with defined razor lines works if your jaw is strong. Know which suits you.' },
      { id: 'r10', title: 'Upgrade your wardrobe — fit is everything', category: 'style', duration: 60, details: 'Clothes that fit perfectly. Slim fit, not skinny. V-necks elongate the neck. Dark colours on bottom. Invest in 3–5 quality basics.' },
    ]
    roadmap['Month 3'] = [
      { id: 'r11', title: 'Re-scan to measure facial score improvement', category: 'health', duration: 10, details: 'Your face should show measurable improvement in symmetry and grooming scores after 90 days of consistent habits.' },
      { id: 'r12', title: 'Under-eye treatment — caffeine eye cream', category: 'skin', duration: 5, details: 'Apply morning under-eye cream with caffeine. Reduces puffiness and dark circles. Major impact on perceived attractiveness and youth.' },
      { id: 'r13', title: 'Posture correction — dead hangs and wall slides', category: 'style', duration: 10, details: '60-second dead hang daily. Wall slides 3 × 10. Good posture instantly improves your profile and height appearance.' },
    ]
  } else if (phase === 'REFINE') {
    roadmap['Week 1–2'] = [
      { id: 'r1', title: 'Start tretinoin — 0.025% 2x per week', category: 'skin', duration: 5, details: 'The most scientifically backed anti-ageing ingredient. Increases cell turnover, reduces pores, and improves skin texture long-term.' },
      { id: 'r2', title: 'Get a precision haircut at a quality barber', category: 'style', duration: 60, details: 'Not a cheap chain — find a skilled barber. Bring reference photos. The right fade and shape changes your entire face framing.' },
      { id: 'r3', title: 'Upgrade brow grooming — threading or waxing', category: 'style', duration: 30, details: 'Professional threading at a salon gives precision that razors can\'t. A defined brow arch lifts the eye area immediately.' },
    ]
    roadmap['Week 3–4'] = [
      { id: 'r5', title: 'Add niacinamide serum — morning or evening', category: 'skin', duration: 5, details: '10% niacinamide reduces pore appearance, evens skin tone, controls oil. Pairs well with everything. The most underrated ingredient.' },
      { id: 'r6', title: 'Optimise sleep — 8 hours in a dark, cold room', category: 'health', duration: 5, details: 'Sleep is the most powerful anti-ageing tool. Cortisol breaks down collagen. Blackout curtains, 18°C, no phone for 1 hour before bed.' },
      { id: 'r7', title: 'Upgrade your fragrance', category: 'style', duration: 30, details: 'Scent is a powerful part of your image. A quality fragrance leaves a lasting impression. Test 2–3 at a department store and choose one signature scent.' },
    ]
    roadmap['Month 2'] = [
      { id: 'r8', title: 'Book a professional facial or chemical peel', category: 'skin', duration: 60, details: 'An AHA peel or HydraFacial gives results no home routine can match. One treatment can visibly improve texture, tone, and glow.' },
      { id: 'r9', title: 'Wardrobe refinement — quality over quantity', category: 'style', duration: 120, details: 'Sell or donate anything that doesn\'t fit perfectly. Replace with 3–5 quality, well-fitted pieces. Aim for a consistent, intentional aesthetic.' },
      { id: 'r10', title: 'Add a peptide serum to your PM routine', category: 'skin', duration: 5, details: 'Copper peptides or Matrixyl 3000. Signals skin to produce more collagen. Stack with tretinoin on alternating nights.' },
    ]
    roadmap['Month 3'] = [
      { id: 'r11', title: 'Final scan — document your 90-day progress', category: 'health', duration: 10, details: 'Same lighting, same pose as your first scan. The AI comparison will show exactly how much your scores improved.' },
      { id: 'r12', title: 'Teeth whitening', category: 'style', duration: 30, details: 'Whiter teeth are an instant attractiveness boost. Use professional whitening strips (Crest 3D White Whitestrips) for 2 weeks.' },
      { id: 'r13', title: 'Posture mastery — daily dead hangs', category: 'style', duration: 5, details: '60-90 second dead hang every morning. Decompresses spine, improves shoulder posture, makes you appear taller. Instant appearance upgrade.' },
    ]
  } else { // TRANSFORM
    roadmap['Week 1–2'] = [
      { id: 'r1', title: 'Start mewing — tongue on roof of mouth now', category: 'style', duration: 5, details: 'Full tongue flat against your palate. Suction hold. Do this every waking moment. The most impactful free thing you can do.' },
      { id: 'r2', title: 'Start a basic skincare routine today', category: 'skin', duration: 8, details: 'AM: Cleanser + SPF 50. PM: Cleanser + moisturiser. These 4 products. Every single day. No excuses.' },
      { id: 'r3', title: 'Get a haircut this week', category: 'style', duration: 60, details: 'Book a barber this week. A good haircut is the fastest appearance upgrade available. Show them your face shape from your results.' },
      { id: 'r4', title: 'Fix your posture — wall stand drill', category: 'style', duration: 5, details: 'Stand against a wall: heels, calves, glutes, shoulders, back of head all touching. Hold 60 seconds. Do this daily to reset your posture.' },
    ]
    roadmap['Week 3–4'] = [
      { id: 'r5', title: 'Add chin tucks — 3 × 30 reps daily', category: 'style', duration: 10, details: 'Pull chin straight back, hold 3 seconds, release. Eliminates forward head posture and reduces chin fat. Do anywhere.' },
      { id: 'r6', title: 'Groom your eyebrows', category: 'style', duration: 30, details: 'Clean, defined brows are one of the fastest appearance upgrades. Visit a threading salon or ask your barber.' },
      { id: 'r7', title: 'Take weekly photos — front and side profile', category: 'health', duration: 5, details: 'Same spot, same lighting every Sunday. Progress photos show changes your eyes miss day to day.' },
    ]
    roadmap['Month 2'] = [
      { id: 'r8', title: 'Upgrade skincare — add Vitamin C and retinol', category: 'skin', duration: 5, details: 'AM: Add Vitamin C serum before SPF. PM: Add retinol 0.1% 2x per week. These two ingredients drive the most visible skin improvement.' },
      { id: 'r9', title: 'Add mastic gum chewing — 20 min/day', category: 'style', duration: 20, details: 'Strengthens jaw muscles for a more defined look. Use while watching TV or commuting. Consistency over 8 weeks shows clear results.' },
      { id: 'r10', title: 'Wardrobe audit — fit over brand', category: 'style', duration: 60, details: 'Every item should fit your body. Slim-fit basics in neutral colours. One well-fitted outfit beats ten poorly-fitted ones.' },
    ]
    roadmap['Month 3'] = [
      { id: 'r11', title: 'Re-scan — compare 90-day progress', category: 'health', duration: 10, details: 'Run your scan again in the same conditions. Your score improvement will reflect the habits you\'ve built over 90 days.' },
      { id: 'r12', title: 'Start tretinoin — see a dermatologist or online prescription', category: 'skin', duration: 5, details: 'The most impactful skincare upgrade available. 0.025% to start. Game-changing for skin texture, pores, and long-term appearance.' },
      { id: 'r13', title: 'Upgrade your fragrance', category: 'style', duration: 30, details: 'Scent is part of your presentation. Test fragrances at a store. Choose one signature scent and wear it consistently.' },
    ]
  }

  // Add skin-specific tasks based on weak scores
  if (weakScores.skinClarity < 5) {
    roadmap['Week 1–2'].push({
      id: 'rs1', title: 'Start salicylic acid cleanser for acne', category: 'skin', duration: 5,
      details: '2% salicylic acid cleanser morning and night. Clears pores, reduces breakouts within 2–3 weeks. CeraVe SA or Paula\'s Choice.'
    })
  }

  // Add jawline tasks based on weak scores
  if (weakScores.jawlineDefinition < 5) {
    roadmap['Week 1–2'].push({
      id: 'rj1', title: 'Mewing: start the suction hold technique', category: 'style', duration: 5,
      details: 'Press full tongue to palate and create suction. This is the correct mewing form. Forward tongue pressure is the goal, not just tongue up.'
    })
    roadmap['Week 3–4'].push({
      id: 'rj2', title: 'Mastic gum — 20 min/day for jaw definition', category: 'style', duration: 20,
      details: 'Mastic gum is the hardest chewing gum available. Builds masseter muscle. Most noticeable at lower body fat percentages.'
    })
  }

  return roadmap
}
