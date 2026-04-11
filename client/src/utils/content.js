// ─── Content Database ─────────────────────────────────────────────────────────
// Pre-loaded exercises, skincare routines, grooming tips

export const POSTURE_EXERCISES = [
  { id: 'pe1', name: 'Chin Tucks', target: 'forward_head', duration: 5, sets: 3, reps: '10 reps', difficulty: 1,
    steps: ['Stand or sit tall against a wall.', 'Gently draw chin straight back (not down).', 'Hold for 5 seconds.', 'Release and repeat.'],
    muscles: 'Deep neck flexors', gif: 'https://i.imgur.com/jyWIQHL.gif',
    tip: 'Imagine making a double chin — that\'s correct form.' },
  { id: 'pe2', name: 'Wall Angels', target: 'rounded_shoulders', duration: 5, sets: 3, reps: '12 reps', difficulty: 2,
    steps: ['Stand with back flat against wall.', 'Arms at 90°, elbows touching wall.', 'Slowly raise arms overhead, keeping contact.', 'Lower back down slowly.'],
    muscles: 'Serratus anterior, lower traps', gif: 'https://i.imgur.com/example2.gif',
    tip: 'Keep your low back from arching off the wall.' },
  { id: 'pe3', name: 'Hip Flexor Stretch', target: 'anterior_pelvic_tilt', duration: 5, sets: 2, reps: '30s each side', difficulty: 1,
    steps: ['Kneel on right knee, left foot forward.', 'Push hips forward gently.', 'Raise right arm to intensify.', 'Hold 30s, switch sides.'],
    muscles: 'Psoas, iliacus, rectus femoris', gif: 'https://i.imgur.com/example3.gif',
    tip: 'Keep your core tight to maximize the stretch.' },
  { id: 'pe4', name: 'Thoracic Extensions', target: 'kyphosis', duration: 5, sets: 3, reps: '10 reps', difficulty: 2,
    steps: ['Place foam roller perpendicular to spine.', 'Position at mid-back, hands behind head.', 'Extend over the roller gently.', 'Move roller up the spine, repeat.'],
    muscles: 'Erector spinae, thoracic extensors', gif: 'https://i.imgur.com/example4.gif',
    tip: 'Only mobilize the thoracic spine — avoid lumbar.' },
  { id: 'pe5', name: 'Band Pull-Aparts', target: 'rounded_shoulders', duration: 5, sets: 4, reps: '15 reps', difficulty: 1,
    steps: ['Hold resistance band at shoulder width.', 'Arms extended straight in front.', 'Pull band apart, squeezing shoulder blades.', 'Return slowly.'],
    muscles: 'Rhomboids, rear deltoids, traps', gif: 'https://i.imgur.com/example5.gif',
    tip: 'Keep elbows straight throughout the movement.' },
  { id: 'pe6', name: 'Dead Bug', target: 'anterior_pelvic_tilt', duration: 8, sets: 3, reps: '10 reps per side', difficulty: 2,
    steps: ['Lie on back, arms straight up, knees 90°.', 'Flatten lower back into floor.', 'Lower opposite arm and leg simultaneously.', 'Return and switch sides.'],
    muscles: 'Transverse abdominis, core stabilizers', gif: 'https://i.imgur.com/example6.gif',
    tip: 'Keep your lower back GLUED to the floor throughout.' },
  { id: 'pe7', name: 'Face Pulls', target: 'rounded_shoulders', duration: 5, sets: 3, reps: '15 reps', difficulty: 1,
    steps: ['Set cable at eye height with rope attachment.', 'Grip with thumbs facing you.', 'Pull toward your face, elbows flaring out.', 'External rotate at peak.'],
    muscles: 'Rear delts, external rotators, traps', gif: 'https://i.imgur.com/example7.gif',
    tip: 'Focus on the external rotation at the end range.' },
  { id: 'pe8', name: 'Glute Bridges', target: 'anterior_pelvic_tilt', duration: 8, sets: 3, reps: '15 reps', difficulty: 1,
    steps: ['Lie on back, knees bent, feet flat.', 'Drive hips up, squeezing glutes hard.', 'Hold 2 seconds at top.', 'Lower with control.'],
    muscles: 'Glutes, hamstrings, posterior chain', gif: 'https://i.imgur.com/example8.gif',
    tip: 'Tuck your pelvis under at the top to fully activate glutes.' },
  { id: 'pe9', name: 'Cat-Cow Stretch', target: 'general_spine', duration: 3, sets: 2, reps: '10 cycles', difficulty: 1,
    steps: ['Start on all fours, wrists under shoulders.', 'Inhale: let belly drop (Cow).', 'Exhale: round spine to ceiling (Cat).', 'Alternate slowly.'],
    muscles: 'Spinal extensors and flexors', gif: 'https://i.imgur.com/example9.gif',
    tip: 'Move one vertebra at a time for maximum benefit.' },
  { id: 'pe10', name: 'Doorframe Chest Stretch', target: 'rounded_shoulders', duration: 3, sets: 3, reps: '30s hold', difficulty: 1,
    steps: ['Stand in a doorframe.', 'Place forearms on the doorframe at 90°.', 'Step forward until you feel chest stretch.', 'Hold 30s.'],
    muscles: 'Pectoralis major and minor', gif: 'https://i.imgur.com/example10.gif',
    tip: 'Try different arm heights to hit different chest fibers.' },
  { id: 'pe11', name: 'Prone Y-T-W', target: 'rounded_shoulders', duration: 8, sets: 3, reps: '10 reps each', difficulty: 2,
    steps: ['Lie face down, arms at sides.', 'Raise arms into Y shape, hold 2s.', 'Move arms to T shape, hold 2s.', 'Move to W (elbows bent), hold 2s.'],
    muscles: 'Lower/mid traps, serratus, rotator cuff', gif: 'https://i.imgur.com/example11.gif',
    tip: 'Use light weight or no weight at first.' },
  { id: 'pe12', name: 'Neck Side Stretch', target: 'forward_head', duration: 3, sets: 2, reps: '30s each side', difficulty: 1,
    steps: ['Sit tall on a chair.', 'Tilt ear toward shoulder gently.', 'Place same-side hand on head (no pulling).', 'Hold 30s, switch sides.'],
    muscles: 'SCM, upper trapezius, scalenes', gif: 'https://i.imgur.com/example12.gif',
    tip: 'Keep opposite shoulder depressed throughout.' },
  { id: 'pe13', name: 'Pallof Press', target: 'anterior_pelvic_tilt', duration: 8, sets: 3, reps: '12 reps', difficulty: 2,
    steps: ['Set cable at chest height, stand sideways.', 'Hold handle at chest.', 'Press straight out, resist rotation.', 'Hold 2s, return slowly.'],
    muscles: 'Core anti-rotation, obliques', gif: 'https://i.imgur.com/example13.gif',
    tip: 'Keep hips square — don\'t let them rotate at all.' },
  { id: 'pe14', name: 'Scapular Push-Ups', target: 'rounded_shoulders', duration: 5, sets: 3, reps: '15 reps', difficulty: 1,
    steps: ['Start in push-up position.', 'Without bending elbows, let chest drop between shoulder blades.', 'Push back up by protracting shoulders.', 'Repeat.'],
    muscles: 'Serratus anterior, rhomboids', gif: 'https://i.imgur.com/example14.gif',
    tip: 'This is all about the shoulder blades — not a regular push-up.' },
  { id: 'pe15', name: 'Couch Stretch', target: 'anterior_pelvic_tilt', duration: 5, sets: 2, reps: '90s each side', difficulty: 2,
    steps: ['Kneel with back shin against a couch/wall.', 'Step front foot forward into lunge.', 'Squeeze rear glute and tuck pelvis.', 'Hold position.'],
    muscles: 'Hip flexors, rectus femoris', gif: 'https://i.imgur.com/example15.gif',
    tip: 'The pelvic tuck is essential — without it you won\'t feel the stretch.' },
  { id: 'pe16', name: 'Jefferson Curl', target: 'general_spine', duration: 5, sets: 3, reps: '8 reps', difficulty: 3,
    steps: ['Stand on a step holding light weight.', 'Slowly curl spine forward vertebra by vertebra.', 'Arms hang, let head drop last.', 'Uncurl slowly from bottom up.'],
    muscles: 'Spinal erectors, hamstrings', gif: 'https://i.imgur.com/example16.gif',
    tip: 'Use very light weight — this is a mobility exercise.' },
  { id: 'pe17', name: 'Seated Row (Cable)', target: 'rounded_shoulders', duration: 8, sets: 4, reps: '12 reps', difficulty: 2,
    steps: ['Sit at cable row machine, slight knee bend.', 'Grip handles, torso upright.', 'Row elbows back, squeeze shoulder blades.', 'Return with control.'],
    muscles: 'Rhomboids, mid-traps, lats', gif: 'https://i.imgur.com/example17.gif',
    tip: 'Lead with elbows, not hands. Think "elbows in pockets."' },
  { id: 'pe18', name: 'Lateral Neck Flexion Strengthening', target: 'forward_head', duration: 5, sets: 3, reps: '12 reps', difficulty: 1,
    steps: ['Place hand on side of head.', 'Push head into hand while resisting with hand.', 'Hold 5 seconds.', 'Switch sides.'],
    muscles: 'Lateral neck flexors', gif: 'https://i.imgur.com/example18.gif',
    tip: 'Isometric — your head doesn\'t actually move.' },
  { id: 'pe19', name: 'Active Hang', target: 'general_spine', duration: 5, sets: 3, reps: '30s hang', difficulty: 2,
    steps: ['Hang from pull-up bar, shoulders relaxed first.', 'Then activate shoulders (depress shoulder blades).', 'Keep core lightly engaged.', 'Breathe normally for full duration.'],
    muscles: 'Lats, shoulder stabilizers, spine decompression', gif: 'https://i.imgur.com/example19.gif',
    tip: 'Alternate between passive and active hang within the set.' },
  { id: 'pe20', name: 'Reverse Snow Angel (Floor)', target: 'kyphosis', duration: 5, sets: 3, reps: '10 reps', difficulty: 1,
    steps: ['Lie face down, arms at sides, thumbs up.', 'Squeeze shoulder blades and raise arms.', 'Move arms in arc overhead (like snow angel).', 'Return.'],
    muscles: 'Lower traps, posterior rotator cuff', gif: 'https://i.imgur.com/example20.gif',
    tip: 'Keep forehead resting on floor throughout.' },
]

export const HYPERTROPHY_EXERCISES = [
  { id: 'he1', name: 'Dumbbell Lateral Raises', target: 'shoulder_width', muscle: 'Lateral deltoids',
    sets: 4, reps: '15-20', rest: '60s', progression: '+2.5lb every 2 weeks',
    difficulty: 1, instructions: 'Raise arms to sides until parallel to floor. Control the negative. Slight forward lean.' },
  { id: 'he2', name: 'Overhead Press (Barbell/DB)', target: 'shoulder_width', muscle: 'All 3 deltoid heads',
    sets: 4, reps: '8-12', rest: '90s', progression: '+5lb per week',
    difficulty: 2, instructions: 'Press directly overhead. Keep core braced. Lower to chin level.' },
  { id: 'he3', name: 'Lat Pulldown', target: 'v_taper', muscle: 'Latissimus dorsi',
    sets: 4, reps: '10-12', rest: '90s', progression: '+5lb per week',
    difficulty: 1, instructions: 'Grip slightly wider than shoulder width. Pull to upper chest. Lean back slightly.' },
  { id: 'he4', name: 'Pull-Ups / Assisted Pull-Ups', target: 'v_taper', muscle: 'Lats, biceps, rear delts',
    sets: 4, reps: 'Max reps', rest: '2min', progression: 'Add 1 rep per week',
    difficulty: 3, instructions: 'Full dead hang start. Pull until chin over bar. Lower with 3-second negative.' },
  { id: 'he5', name: 'Cable Rows', target: 'v_taper', muscle: 'Mid-back, rhomboids',
    sets: 4, reps: '10-12', rest: '90s', progression: '+5lb per week',
    difficulty: 1, instructions: 'Row to lower sternum. Lead with elbows. Pause at contraction.' },
  { id: 'he6', name: 'Upright Rows', target: 'shoulder_width', muscle: 'Lateral delts, traps',
    sets: 3, reps: '12-15', rest: '60s', progression: '+2.5lb every 2 weeks',
    difficulty: 2, instructions: 'Grip shoulder-width. Pull to chest height, elbows high. Use wrist strap if needed.' },
  { id: 'he7', name: 'Cable Lateral Raises', target: 'shoulder_width', muscle: 'Lateral deltoid',
    sets: 3, reps: '15-20', rest: '45s', progression: '+2.5lb per 2 weeks',
    difficulty: 1, instructions: 'Single arm. Raise across body. Constant cable tension is the advantage here.' },
  { id: 'he8', name: 'Planks', target: 'core', muscle: 'Transverse abdominis, obliques',
    sets: 3, reps: '45-90s', rest: '60s', progression: '+10s per week',
    difficulty: 1, instructions: 'Elbows under shoulders. Straight line head to heels. Breathe normally.' },
  { id: 'he9', name: 'Cable Woodchops', target: 'core', muscle: 'Obliques, core',
    sets: 3, reps: '12 each side', rest: '60s', progression: '+5lb per 2 weeks',
    difficulty: 2, instructions: 'Rotate through the core, not the arms. Keep hips square.' },
  { id: 'he10', name: 'Hanging Leg Raises', target: 'core', muscle: 'Lower abs, hip flexors',
    sets: 3, reps: '10-15', rest: '90s', progression: '+2 reps per week',
    difficulty: 3, instructions: 'Hang from bar. Raise legs to 90° or higher. No swinging.' },
  { id: 'he11', name: 'Incline Dumbbell Press', target: 'upper_chest', muscle: 'Upper pectoralis',
    sets: 4, reps: '10-12', rest: '90s', progression: '+5lb per week',
    difficulty: 2, instructions: '30-45° incline. Press at 75° angle from body. Full stretch at bottom.' },
  { id: 'he12', name: 'Romanian Deadlift', target: 'posterior_chain', muscle: 'Hamstrings, glutes',
    sets: 4, reps: '10-12', rest: '2min', progression: '+10lb per week',
    difficulty: 2, instructions: 'Hip hinge, soft knee bend. Bar stays close to legs. Feel hamstring stretch.' },
  { id: 'he13', name: 'Dips (Chest Version)', target: 'chest_width', muscle: 'Lower pec, triceps',
    sets: 3, reps: '10-15', rest: '90s', progression: 'Add weight when 15 reps is easy',
    difficulty: 2, instructions: 'Lean forward to target chest. Lower until shoulder at elbow height. Push up.' },
  { id: 'he14', name: 'Rear Delt Fly', target: 'shoulder_width', muscle: 'Rear deltoids',
    sets: 4, reps: '15-20', rest: '60s', progression: '+2.5lb per 2 weeks',
    difficulty: 1, instructions: 'Bent over or face-down on incline bench. Light weight, high reps. Squeeze hard.' },
  { id: 'he15', name: 'Barbell Shrugs', target: 'trap_development', muscle: 'Upper trapezius',
    sets: 4, reps: '12-15', rest: '60s', progression: '+10lb per week',
    difficulty: 1, instructions: 'Hold barbell at thighs. Shrug straight up (not rolling). Hold 1 second.' },
]

export const SKINCARE_ROUTINES = {
  acne: {
    name: 'Acne-Prone',
    description: 'Targets breakouts, controls oil, and prevents new blemishes.',
    am: [
      { step: 1, action: 'Cleanser', product: 'CeraVe Foaming Facial Cleanser', why: 'Removes overnight oil without over-drying', affiliate: '#' },
      { step: 2, action: 'Toner', product: 'Paula\'s Choice BHA 2% (diluted)', why: 'Exfoliates inside pores, kills acne bacteria', affiliate: '#' },
      { step: 3, action: 'Moisturizer', product: 'La Roche-Posay Effaclar Duo', why: 'Hydrates while targeting acne', affiliate: '#' },
      { step: 4, action: 'SPF', product: 'EltaMD UV Clear SPF 46', why: 'Non-comedogenic, calms inflammation', affiliate: '#' },
    ],
    pm: [
      { step: 1, action: 'Oil Cleanser', product: 'DHC Deep Cleansing Oil', why: 'Dissolves sunscreen without disrupting skin barrier', affiliate: '#' },
      { step: 2, action: 'Cleanser', product: 'CeraVe Foaming Facial Cleanser', why: 'Second cleanse removes residue', affiliate: '#' },
      { step: 3, action: 'Treatment', product: 'The Ordinary Niacinamide 10% + Zinc 1%', why: 'Reduces pore appearance and controls sebum', affiliate: '#' },
      { step: 4, action: 'Spot Treatment', product: 'Differin Adapalene Gel 0.1%', why: 'Retinoid that prevents new breakouts at the source', affiliate: '#' },
      { step: 5, action: 'Moisturizer', product: 'CeraVe PM Moisturizing Lotion', why: 'Lightweight, ceramide-rich, won\'t clog pores', affiliate: '#' },
    ]
  },
  antiaging: {
    name: 'Anti-Aging',
    description: 'Reduces fine lines, firms skin, and promotes collagen production.',
    am: [
      { step: 1, action: 'Cleanser', product: 'Cetaphil Gentle Skin Cleanser', why: 'Gentle cleanse that preserves moisture barrier', affiliate: '#' },
      { step: 2, action: 'Vitamin C Serum', product: 'Skinceuticals C E Ferulic (or Klairs alternative)', why: '15% L-ascorbic acid — the gold standard for collagen support', affiliate: '#' },
      { step: 3, action: 'Moisturizer', product: 'The Ordinary Natural Moisturizing Factors', why: 'Seals in actives, provides ceramides', affiliate: '#' },
      { step: 4, action: 'SPF', product: 'Supergoop Unseen Sunscreen SPF 40', why: 'UV damage is the #1 cause of aging', affiliate: '#' },
    ],
    pm: [
      { step: 1, action: 'Cleanser', product: 'Vanicream Gentle Facial Cleanser', why: 'pH-balanced, fragrance-free', affiliate: '#' },
      { step: 2, action: 'Retinol/Retinoid', product: 'The Ordinary Retinol 0.5% (start 2x/week)', why: 'The most proven anti-aging ingredient', affiliate: '#' },
      { step: 3, action: 'Eye Cream', product: 'CeraVe Eye Repair Cream', why: 'Ceramides and niacinamide for the delicate eye area', affiliate: '#' },
      { step: 4, action: 'Moisturizer', product: 'First Aid Beauty Ultra Repair Cream', why: 'Occlusive layer locks everything in overnight', affiliate: '#' },
      { step: 5, action: 'Facial Oil (optional)', product: 'The Ordinary Rosehip Seed Oil', why: 'Rich in natural retinoids and fatty acids', affiliate: '#' },
    ]
  },
  hyperpigmentation: {
    name: 'Hyperpigmentation',
    description: 'Fades dark spots, evens skin tone, and brightens complexion.',
    am: [
      { step: 1, action: 'Cleanser', product: 'Neutrogena Brightening Daily Scrub', why: 'Gentle exfoliation to boost brightness', affiliate: '#' },
      { step: 2, action: 'Brightening Serum', product: 'The Ordinary Alpha Arbutin 2% + HA', why: 'Inhibits melanin production safely', affiliate: '#' },
      { step: 3, action: 'Niacinamide', product: 'The Ordinary Niacinamide 10% + Zinc', why: 'Reduces dark spots and redness', affiliate: '#' },
      { step: 4, action: 'SPF', product: 'Black Girl Sunscreen SPF 30', why: 'UV exposure worsens hyperpigmentation — non-negotiable', affiliate: '#' },
    ],
    pm: [
      { step: 1, action: 'Double Cleanse', product: 'Bioderma Micellar Water + CeraVe Hydrating Cleanser', why: 'Remove sunscreen and debris thoroughly', affiliate: '#' },
      { step: 2, action: 'Chemical Exfoliant', product: 'Paula\'s Choice 8% AHA Gel (3x/week)', why: 'Accelerates cell turnover to shed pigmented cells', affiliate: '#' },
      { step: 3, action: 'Vitamin C', product: 'Timeless 20% Vitamin C + E + Ferulic', why: 'Antioxidant that inhibits melanin at night', affiliate: '#' },
      { step: 4, action: 'Moisturizer', product: 'Vanicream Moisturizing Lotion', why: 'Simple, fragrance-free moisture to support barrier', affiliate: '#' },
      { step: 5, action: 'Spot Treatment', product: 'Tranexamic Acid 5% (Naturium or Topicals)', why: 'Targets stubborn dark spots specifically', affiliate: '#' },
    ]
  },
  dry: {
    name: 'Dry/Dehydrated',
    description: 'Deeply hydrates, replenishes moisture barrier, and reduces tightness.',
    am: [
      { step: 1, action: 'Cleanser', product: 'CeraVe Hydrating Cleanser', why: 'Creamy, no-strip formula with hyaluronic acid', affiliate: '#' },
      { step: 2, action: 'Hyaluronic Acid', product: 'The Ordinary Hyaluronic Acid 2% + B5', why: 'Apply to damp skin to draw moisture in', affiliate: '#' },
      { step: 3, action: 'Rich Moisturizer', product: 'Neutrogena Hydro Boost Water Gel', why: 'Glycerin-rich, plumping formula', affiliate: '#' },
      { step: 4, action: 'SPF', product: 'La Roche-Posay Anthelios Melt-in Milk SPF 100', why: 'Non-drying SPF critical for skin health', affiliate: '#' },
    ],
    pm: [
      { step: 1, action: 'Oil Cleanser', product: 'Clinique Take The Day Off Cleansing Balm', why: 'Melts away product without stripping', affiliate: '#' },
      { step: 2, action: 'Hyaluronic Acid', product: 'Belif The True Cream Aqua Bomb', why: 'Intense hydration for overnight repair', affiliate: '#' },
      { step: 3, action: 'Barrier Repair', product: 'CeraVe Moisturizing Cream', why: '3 essential ceramides + cholesterol for barrier repair', affiliate: '#' },
      { step: 4, action: 'Facial Oil', product: 'Squalane Oil (Biossance or The Ordinary)', why: 'Occlusive that mimics skin\'s own sebum', affiliate: '#' },
      { step: 5, action: 'Sleeping Mask', product: 'LANEIGE Water Sleeping Mask', why: 'Hyaluronic acid + sleep-specific repair complex', affiliate: '#' },
    ]
  },
  oily: {
    name: 'Oily/Combination',
    description: 'Controls shine, minimizes pores, and balances the skin.',
    am: [
      { step: 1, action: 'Gel Cleanser', product: 'La Roche-Posay Effaclar Gel Cleanser', why: 'Controls oil without causing dehydration rebound', affiliate: '#' },
      { step: 2, action: 'Toner', product: 'Thayers Witch Hazel Toner (alcohol-free)', why: 'Tightens pores, balances pH', affiliate: '#' },
      { step: 3, action: 'Light Moisturizer', product: 'Neutrogena Oil-Free Moisture', why: 'Hydration without adding shine', affiliate: '#' },
      { step: 4, action: 'SPF', product: 'EltaMD UV Clear SPF 46', why: 'Matte finish, oil-controlling formula', affiliate: '#' },
    ],
    pm: [
      { step: 1, action: 'Gel Cleanser', product: 'CeraVe Foaming Facial Cleanser', why: 'Deep clean end-of-day oil build-up', affiliate: '#' },
      { step: 2, action: 'BHA Exfoliant', product: 'Paula\'s Choice BHA Liquid Exfoliant (3x/week)', why: 'Dissolves oil inside pores', affiliate: '#' },
      { step: 3, action: 'Niacinamide', product: 'The Ordinary Niacinamide 10% + Zinc 1%', why: 'Regulates sebum production over time', affiliate: '#' },
      { step: 4, action: 'Light Gel Moisturizer', product: 'The Ordinary Natural Moisturizing Factors', why: 'Just enough hydration to prevent over-production', affiliate: '#' },
    ]
  },
  sensitive: {
    name: 'Sensitive',
    description: 'Calms redness, strengthens the barrier, and avoids irritation triggers.',
    am: [
      { step: 1, action: 'Gentle Cleanser', product: 'Vanicream Gentle Facial Cleanser', why: 'Free of dyes, fragrance, and common irritants', affiliate: '#' },
      { step: 2, action: 'Calming Toner', product: 'Avene Thermal Spring Water', why: 'Instantly soothes reactive skin', affiliate: '#' },
      { step: 3, action: 'Moisturizer', product: 'La Roche-Posay Toleriane Double Repair', why: 'Ceramide + niacinamide: dual barrier repair', affiliate: '#' },
      { step: 4, action: 'Mineral SPF', product: 'Blue Lizard Sensitive Mineral Sunscreen SPF 50', why: 'Zinc oxide only — no chemical filter irritants', affiliate: '#' },
    ],
    pm: [
      { step: 1, action: 'Micellar Water', product: 'Bioderma Sensibio H2O', why: 'The gold standard for sensitive skin cleansing', affiliate: '#' },
      { step: 2, action: 'Barrier Serum', product: 'SkinFix Barrier+ Triple Lipid-Peptide Serum', why: 'Rebuilds compromised barrier overnight', affiliate: '#' },
      { step: 3, action: 'Rich Cream', product: 'Avene Cicalfate+ Restorative Protective Cream', why: 'Zinc sulfate + sucralfate for recovery', affiliate: '#' },
    ]
  }
}

export const GROOMING_TIPS = [
  { id: 'g1', category: 'hairstyle', title: 'Oval Face — Best Hairstyles',
    description: 'The most versatile face shape. Almost any style works. Best options: textured quiff, side part, crew cut with texture, or long wavy styles. Avoid: extremely flat styles that elongate the face.',
    tip: 'Your face shape suits both longer and shorter styles — experiment freely.' },
  { id: 'g2', category: 'hairstyle', title: 'Round Face — Best Hairstyles',
    description: 'Goal is to add height and reduce width. Best: high fade with volume on top, undercut with a pompadour, textured crop. Avoid: full beards without fade, bowl cuts, curly mid-length.',
    tip: 'Volume on top elongates — always keep sides tight.' },
  { id: 'g3', category: 'hairstyle', title: 'Square Face — Best Hairstyles',
    description: 'Strong angles already. Goal: soften the jaw or accentuate masculinity. Best: side-swept styles, textured top with fade, longer curtain bangs. Avoid: buzzcuts (emphasizes jaw too much), full-top high volume.',
    tip: 'A little length and texture at the top balances a square jaw beautifully.' },
  { id: 'g4', category: 'hairstyle', title: 'Oblong/Long Face — Best Hairstyles',
    description: 'Add width, reduce length. Best: fringe/bangs, mid-length sides, textured curls or waves, curtain hair. Avoid: styles that add height (mohawks, high pompadour), long straight hair.',
    tip: 'Curtain hair (center-parted, falling on sides) is near-perfect for long faces.' },
  { id: 'g5', category: 'hairstyle', title: 'Heart Face — Best Hairstyles',
    description: 'Wide forehead, narrow chin — add width below and de-emphasize forehead. Best: side part, layered medium length, wave styles, chin-length or longer. Avoid: center parts that draw attention to forehead width.',
    tip: 'Volume at the sides near the jaw balances the heart shape.' },
  { id: 'g6', category: 'beard', title: 'Weak Jawline — Beard Styles',
    description: 'Use beard to add structure. Best: short-to-medium stubble (3-7mm) along jawline and chin. Keep the cheek line clean. Full beard with defined edges creates the illusion of a stronger jaw.',
    tip: 'Avoid no-beard if jaw is weak — even 2-3mm stubble adds definition.' },
  { id: 'g7', category: 'beard', title: 'Strong Jawline — Beard Styles',
    description: 'Enhance or let it breathe. Best: clean-shaven (shows the jaw), heavy stubble (5 o\'clock shadow), or a well-groomed full beard. All options work when the jaw is already strong.',
    tip: 'Stubble at 5-7mm is considered universally most attractive regardless of face shape.' },
  { id: 'g8', category: 'beard', title: 'Round Face — Beard Styles',
    description: 'Add length to reduce roundness. Best: goatee-style with length at the chin, ducktail beard, or a full beard that\'s longer at the chin than cheeks. Avoid: full bushy cheek beards with no structure.',
    tip: 'Keep cheeks tight or faded — length only at chin.' },
  { id: 'g9', category: 'eyebrow', title: 'Eyebrow Grooming Basics',
    description: '1) Identify your natural arch — this is where the highest point should be. 2) Remove strays between brows (unibrow area). 3) Clean up the bottom edge (not top). 4) Trim long hairs flush with the brow. 5) Never over-pluck — always under-groom.',
    tip: 'Most men only need a trim and unibrow cleanup — less is more.' },
  { id: 'g10', category: 'glasses', title: 'Glasses by Face Shape',
    description: 'Round face: angular rectangular frames. Square face: round or oval frames. Oval face: almost any frame. Oblong face: deeper frames with strong horizontals. Heart face: bottom-heavy or rimless. Diamond: oval or rimless.',
    tip: 'The frame width should match the widest part of your face.' },
  { id: 'g11', category: 'skincare_basics', title: 'Men\'s Skincare: The Minimum',
    description: 'The bare minimum for healthy skin: 1) Cleanse AM + PM. 2) Moisturize AM + PM. 3) SPF every morning. That\'s it. Start there. Add actives (vitamin C, retinol, niacinamide) once the basics are consistent.',
    tip: 'Consistency with basics > expensive products used inconsistently.' },
  { id: 'g12', category: 'fragrance', title: 'Fragrance Guidance',
    description: 'Apply to pulse points: neck, wrists, behind ears. Don\'t rub — pat. Fresh/citrus scents for day, woody/oriental for evening. 2-3 sprays max. Rotate fragrances to avoid nose blindness.',
    tip: 'A good fragrance is one of the highest ROI grooming investments.' },
]

// ─── 12-Week Personalized Plan Generator ──────────────────────────────────────
export function generatePlanTasks(faceData, bodyData, pillars = null, phase = 'TRANSFORM', gender = 'male') {
  const isFemale = gender === 'female'
  const lowH = pillars ? pillars.harmony < 6 : false
  const lowA = pillars ? pillars.angularity < 6 : false
  const lowF = pillars ? pillars.features < 6 : false
  const lowD = pillars ? pillars.dimorphism < 6 : false

  const tasks = []
  let uid = 0
  const add = (week, cat, title, desc, freq, dur, diff, extra = {}) =>
    tasks.push({ id: `pt-${++uid}`, week, category: cat, title, description: desc, frequency: freq, duration: dur, difficulty: diff, completed: false, ...extra })

  // ─── CORE HABITS (every week) ───────────────────────────────────────────────
  for (let w = 1; w <= 12; w++) {
    add(w, 'nutrition', 'Sleep 8+ Hours', 'Cortisol reduction and collagen synthesis happen during sleep. Blackout curtains, 18°C room, phone off 1 hour before bed.', 'daily', 0, 1)
    add(w, 'nutrition', 'Drink 3L Water', 'Hydration improves skin clarity, energy, and recovery. Use a tracked bottle. Aim for 3 litres spread throughout the day.', 'daily', 0, 1)
  }

  // ─── SKINCARE PROGRESSION (weeks 1–12) ─────────────────────────────────────
  add(1, 'skin', 'Start AM Skincare: Cleanser + SPF 50', 'Gentle cleanser then SPF 50. These two steps are non-negotiable. SPF is the highest ROI anti-aging product available.', 'daily', 5, 1)
  add(1, 'skin', 'Start PM Skincare: Cleanser + Moisturizer', 'Remove SPF buildup with a gentle cleanser PM. Apply moisturizer on slightly damp skin for better absorption.', 'daily', 5, 1)
  add(2, 'skin', 'AM Skincare: Build the Habit', 'By now this should feel automatic. Cleanser → SPF 50. Every day, no exceptions. The habit matters more than the products.', 'daily', 5, 1)
  add(2, 'skin', 'PM: Add Niacinamide Serum', 'Introduce 10% niacinamide after cleansing, before moisturizer. Reduces pores and evens skin tone within 4 weeks.', 'daily', 7, 2)
  add(3, 'skin', 'AM Upgrade: Add Vitamin C Serum', '10–15% Vitamin C between cleanser and SPF. Brightens, fights pigmentation, and boosts SPF efficacy. Apply to dry skin.', 'daily', 7, 2)
  add(3, 'skin', 'PM: Introduce Retinol 0.1% (2×/week)', 'Apply on dry skin 2×/week — Monday and Thursday. The most proven skin-improvement ingredient. Start low, build up.', '2x/week', 5, 3)
  add(4, 'skin', 'AM Stack Locked: Cleanser + Vit C + SPF', 'Your morning routine is now a 3-step stack. Consistency here is the foundation of your long-term skin score.', 'daily', 7, 2)
  add(4, 'skin', 'PM: Assess Retinol Tolerance', 'No purging or irritation? Tolerating well. If irritated, move to once a week and buffer with moisturizer. Normal adjustment.', '2x/week', 5, 2)
  add(5, 'skin', 'PM: Increase Retinol to 3×/week', 'Skin has adapted. Increase to Mon/Wed/Fri. First visible texture improvements should appear this week.', '3x/week', 5, 3)
  add(5, 'skin', 'Add Eye Cream: Caffeine-Based', 'Caffeine eye cream applied morning. Reduces puffiness and dark circles. Major impact on perceived youth and health.', 'daily', 3, 1)
  add(6, 'skin', 'Routine Progress Check', 'Take a skin comparison photo in the same lighting as week 1. Skin clarity should show measurable improvement by now.', 'once', 10, 1)
  add(7, 'skin', 'PM Upgrade: Consider Tretinoin 0.025%', 'If you have access, upgrade from retinol to tretinoin 0.025%. Prescription-strength results — apply 3×/week to dry skin.', '3x/week', 5, 3)
  add(7, 'skin', 'Add Hyaluronic Acid to AM Routine', 'Apply HA serum to damp skin before Vitamin C. Plumps skin and dramatically improves product absorption.', 'daily', 5, 2)
  add(8, 'skin', 'Dermarolling: First Session (0.5mm)', 'Clean dermaroller on cleansed skin. Creates micro-channels for product absorption. Apply hyaluronic acid immediately after. SPF the next day.', '1x/week', 20, 3)
  add(9, 'skin', 'Routine Maintenance + Dermarolling (Week 2)', 'Full stack is locked. Second dermarolling session. Results are compounding now — stay consistent.', 'daily', 7, 2)
  add(10, 'skin', 'Add Peptide Serum to PM Routine', 'Matrixyl 3000 or copper peptides on alternating nights with retinol/tretinoin. Maximum collagen synthesis stimulus.', 'daily', 5, 2)
  add(11, 'skin', 'Full Skincare Stack: Maintenance Mode', 'All habits are locked in. This is maintenance. Improvements from here are pure compounding from consistent habits.', 'daily', 7, 1)
  add(12, 'skin', 'Final Skin Progress Photo', 'Same lighting, angle, and distance as week 1. Document your skin transformation over 12 weeks.', 'once', 5, 1)

  // ─── POSTURE (weeks 1–12) ───────────────────────────────────────────────────
  add(1, 'posture', 'Wall Stand Reset: 5 Minutes Daily', 'Heels, glutes, shoulders, and head touching a wall. Hold 5 minutes to reset accumulated postural damage from screens.', 'daily', 5, 1)
  add(1, 'posture', 'Chin Tucks: 3×10 (Hold 5s each)', 'Pull chin straight back, hold 5 seconds. Directly counters forward head posture and sharpens jaw appearance from the side.', 'daily', 5, 1)
  add(2, 'posture', 'Chin Tucks 3×15 + Wall Stand 8 min', 'Increasing volume. Your neck muscles should feel engagement now. This combination immediately improves your profile view.', 'daily', 8, 1)
  add(3, 'posture', 'Add Dead Hang: 3×30 Seconds', 'Hang from any bar. Decompresses spine, broadens shoulder appearance, and improves thoracic posture. Best bang-for-buck exercise.', 'daily', 5, 2)
  add(4, 'posture', 'Face Pulls: 3×15 (Band or Cable)', 'Horizontal pulling motion. Retracts shoulders and strengthens rear delts. Essential for correcting rounded shoulders.', '3x/week', 10, 2)
  add(5, 'posture', 'Dead Hang Upgrade: 3×60 Seconds', 'Full 60-second hangs. You should feel significant shoulder decompression. Add scapular retractions mid-hang.', 'daily', 8, 2)
  add(6, 'posture', 'Wall Angels: 3×12', 'Back flat against wall, arms at 90°. Slide overhead while keeping contact. Activates serratus anterior and corrects rounded shoulders.', 'daily', 8, 2)
  add(7, 'posture', 'Posture Stack: 15 Min Daily Protocol', 'Combine all three: dead hang 3×60s → band pulls 3×20 → wall stand 5 min. This is now your permanent daily protocol.', 'daily', 15, 2)
  add(8, 'posture', 'Posture Side Profile Check', 'Video yourself from the side in your natural standing position. Your head should now be directly above your shoulders.', 'once', 5, 1)
  add(9, 'posture', 'Posture Stack: Continue Protocol', 'Full protocol maintained. Your default standing posture is significantly improved. People notice this.', 'daily', 15, 2)
  add(11, 'posture', 'Posture Mastery: Lock In the Habit', 'This is now a permanent daily habit. Posture defines your height appearance, confidence, and first impressions.', 'daily', 15, 1)

  // ─── GROOMING (selected weeks) ──────────────────────────────────────────────
  add(1, 'grooming', 'Haircut: Face-Shape Optimized', 'Book your barber this week. Show them your face shape. The right haircut is the single fastest appearance upgrade available.', 'once', 60, 1)
  add(2, 'grooming', 'Eyebrow Grooming', 'Clean up with threading or a barber trim. Defined brows make your eyes appear larger, sharper, and more symmetrical.', 'once', 20, 1)
  add(isFemale ? 3 : 4, 'grooming',
    isFemale ? 'Brow + Lash Enhancement Routine' : 'Beard Strategy: Define Your Look',
    isFemale ? 'Brow shaping pencil or tint + lash serum for growth. Defines and frames your eyes — major face score improvement.' : 'Decide: grow with a defined neckline and cheekline, or clean shave with a precise razor edge. Your beard should enhance, not hide, your jawline.',
    'once', 20, 2)
  add(6, 'grooming', 'Signature Fragrance', 'Visit a store. Test three options: one fresh, one warm, one bold. Choose one and wear it consistently. Scent is part of your aesthetic.', 'once', 30, 1)
  add(8, 'grooming', 'Teeth Whitening: 2-Week Course', 'Start a whitening strip course. Whiter teeth are a significant and underrated attractiveness upgrade. Crest 3D White or equivalent.', 'daily', 15, 1)
  add(10, 'grooming', 'Second Haircut: Refined Cut', 'Your face is more defined now. Request a tighter, more precise cut. Bring a reference photo you admire.', 'once', 60, 2)
  add(12, 'grooming', 'Final Grooming Audit', 'Review every element: hair, brows, skin, fragrance, teeth, nails. Lock in your personal grooming standard permanently.', 'once', 30, 2)

  // ─── FACE (mewing + jaw) ────────────────────────────────────────────────────
  if (phase !== 'LEAN') {
    add(1, 'face', 'Mewing: Start Correct Tongue Posture', 'Entire tongue flat against the palate — not just the tip. Suction hold. Lips together, teeth lightly touching. Maintain 24/7.', 'always', 0, 2)
    add(3, 'face', 'Mewing: 10-Minute Active Sessions', 'Dedicated 10-minute suction hold practice daily. This trains the habit faster than passive mewing alone.', 'daily', 10, 2)
    add(5, 'face', 'Mastic Gum: 20 min/day', 'Falim or mastic gum. Builds masseter definition. Most visible at lower body fat. Use while watching TV or commuting.', 'daily', 20, 2)
    add(7, 'face', 'Jaw Protocol: Triple Stack', 'Mewing 24/7 + 20 min mastic gum + 3×30 chin tucks daily. Maximum jaw definition stimulus. Difficulty increases progressively.', 'daily', 30, 3)
    add(10, 'face', 'Mewing: Hard Mode — Peak Suction Hold', 'Your mewing should be automatic now. Apply maximum upward tongue pressure during dedicated sessions. Results are compounding.', 'daily', 10, 3)
  } else {
    add(1, 'face', 'Mewing: Start Now (Compounds With Fat Loss)', 'Every % of fat you lose makes your bone structure more visible. Mewing now means results are already compounding.', 'always', 0, 2)
    add(4, 'face', 'Mastic Gum: Start at Lower Body Fat', 'You have lost enough fat that jaw muscle development is now visible. Add mastic gum 20 min/day.', 'daily', 20, 2)
    add(7, 'face', 'Jaw Protocol: Mewing + Gum + Chin Tucks', 'Triple stack as you approach your leanest point. Jaw definition is at its maximum visibility now.', 'daily', 30, 3)
  }

  // ─── TRAINING (phase-aware) ─────────────────────────────────────────────────
  if (phase === 'LEAN') {
    add(1, 'nutrition', 'Caloric Deficit: Track Everything (–400 kcal)', 'Calculate TDEE and subtract 400 calories. Fat loss reveals jawline and cheekbones faster than any other intervention.', 'daily', 10, 2)
    add(1, 'training', 'Zone 2 Cardio: 20 min × 3/week', 'Conversational-pace cardio — walking uphill, cycling, or rowing. Foundation of your fat loss protocol.', '3x/week', 20, 1)
    add(2, 'nutrition', 'Eliminate Liquid Calories', 'No juice, alcohol, or soft drinks. Water, black coffee, sparkling water only. Easy 300–500 calorie reduction per day.', 'daily', 0, 1)
    add(3, 'training', 'Add Resistance Training: 3×/week', 'Compound lifts to preserve muscle during deficit. Squat, row, overhead press. Muscle burns calories at rest.', '3x/week', 50, 2)
    add(4, 'training', 'Cardio Increase: 30 min Zone 2 × 4/week', 'Increase cardio volume. Fat loss should be 0.5–1% bodyweight per week. Dial in deficit if not matching target.', '4x/week', 30, 2)
    add(6, 'training', 'Add HIIT: 20 min × 1/week', '20 seconds all-out, 40 seconds rest × 10 rounds. Boosts metabolism for 24 hours post-session.', '1x/week', 20, 3)
    add(8, 'training', 'Peak Fat Loss Protocol', 'Zone 2 × 4/week + 1 HIIT + resistance 3/week. You are at your leanest. Facial structure should be clearly visible now.', '5x/week', 40, 3)
    add(10, 'training', 'Transition to Maintenance Calories', 'You have hit your fat loss target. Increase calories by +100/week until TDEE. Maintain leanness.', 'daily', 5, 2)
    add(12, 'training', 'Recomp Phase: Maintain Leanness', 'Eat at maintenance. Continue resistance training. Building muscle without gaining fat.', '4x/week', 50, 2)
  } else if (phase === 'SCULPT') {
    add(1, 'training', 'Compound Lifting: Foundation (3×/week)', 'Squat, deadlift, overhead press, barbell row. These build your frame and elevate testosterone. 3 sets × 8 reps.', '3x/week', 60, 2)
    add(3, 'training', 'Training Upgrade: 4×/week + Accessories', 'Add shoulder width priority: lateral raises 4×15 and face pulls 3×20 at every session.', '4x/week', 70, 3)
    add(5, 'training', 'Progressive Overload: Add Weight to All Lifts', 'Add 5lb to all main lifts this week. Track in an app. Progressive overload is the primary driver of frame and testosterone.', '4x/week', 70, 3)
    add(7, 'training', 'Hypertrophy Phase: 4×8–12 Focus', 'Shift to 4 sets of 8–12 reps with 90s rest. Maximizes muscle size and visible masculine silhouette.', '4x/week', 70, 3)
    add(9, 'training', 'Peak Training: Intensity Phase', 'Heaviest weights of the program. Test 1-rep max on squat and deadlift. Your frame is at its peak.', '4x/week', 80, 3)
    add(11, 'training', 'Maintenance Training', 'Maintain training frequency. Transition to a program you can sustain long-term.', '3x/week', 60, 2)
  } else if (phase === 'TRANSFORM') {
    add(1, 'training', 'Compound Training: Foundation (3×/week)', 'Squat, deadlift, overhead press, row. Hit all major muscle groups. 3 sets × 8 reps to start.', '3x/week', 60, 2)
    add(2, 'nutrition', 'Set Caloric Target: Slight Surplus (+200 kcal)', 'Small surplus supports muscle growth. Track calories for 2 weeks to establish your baseline TDEE.', 'daily', 10, 2)
    add(4, 'training', 'Training Upgrade: 4×/week + Accessories', 'Add lateral raises and face pulls for shoulder width. Biggest visual upgrades per session hour.', '4x/week', 70, 3)
    add(6, 'training', 'Deload Week: Reduce Volume 50%', 'Reduce weight and sets by half. Deloads drive long-term progress. Your body needs intentional recovery.', '3x/week', 40, 1)
    add(7, 'training', 'Hypertrophy Phase: 4×10–12 Reps', 'Moderate weight, full range of motion, 4 sets × 10–12. Maximizes muscle size and visible aesthetics.', '4x/week', 70, 3)
    add(9, 'training', 'Strength Phase: Heavy + Low Rep', '4 sets × 5–6 reps, heavy weight. Strength gains translate to more muscle mass and denser appearance long-term.', '4x/week', 80, 3)
    add(11, 'training', 'Peak Performance Phase', 'Heavy compounds 3×/week + hypertrophy accessories 1×/week. You are at the peak of your 12-week program.', '4x/week', 75, 3)
  } else { // REFINE
    add(1, 'training', 'Strength Maintenance + Physique Refinement', 'Heavy compounds 3×/week. Add isolation work for shoulder caps, chest, and arms. Refine your V-taper.', '3x/week', 60, 2)
    add(3, 'training', 'Add Advanced Accessories: Laterals + Face Pulls', 'Priority accessories for shoulder width — 4×15–20 lateral raises + 3×20 face pulls at every session.', '4x/week', 70, 2)
    add(5, 'training', 'Full Program Running: Peak Physique Ahead', 'Your training is optimized. Progressive overload on compounds + high-rep isolations. Peak aesthetics in 6 weeks.', '4x/week', 70, 3)
    add(7, 'skin', 'Professional Facial or Chemical Peel', 'Book an AHA peel or HydraFacial. One session delivers results no home routine can match. Major texture and tone upgrade.', 'once', 60, 2)
    add(8, 'style', 'Wardrobe Refinement: Quality Over Quantity', 'Audit your wardrobe. Remove anything that does not fit perfectly. Replace with 3–5 quality, well-fitted pieces.', 'once', 90, 2)
    add(9, 'training', 'Advanced Techniques: Drop Sets + Supersets', 'Drop sets on lateral raises. Supersets for arms. Maximum muscle stimulus and metabolic stress.', '4x/week', 75, 3)
    add(11, 'training', 'Final Phase: Lock In Physique', 'Training is a permanent habit. Aesthetics are at peak. The re-scan will reflect this.', '4x/week', 70, 2)
  }

  // ─── NUTRITION EXTRAS ───────────────────────────────────────────────────────
  add(1, 'nutrition', 'Set Your Daily Protein Target', 'Calculate: 0.8g per lb of bodyweight. Protein drives muscle growth, skin quality, and satiety. Set this target now.', 'daily', 5, 1)
  add(3, 'nutrition', 'Meal Prep Sunday', 'Prep meals for the week every Sunday. Consistency requires infrastructure. A stocked fridge removes all excuses.', 'weekly', 60, 2)
  add(5, 'nutrition', 'Eliminate Ultra-Processed Foods', 'UPFs cause systemic inflammation that shows in skin, energy, and body composition. This week: swap all UPFs for whole foods.', 'daily', 0, 2)
  add(7, 'nutrition', 'Add Creatine: 5g Daily', 'Creatine monohydrate 5g/day. Improves training output, muscle fullness, and has cognitive benefits. Most studied supplement.', 'daily', 0, 1)
  add(9, 'nutrition', 'Lock In Micronutrient Stack', 'Omega-3 2g EPA/DHA + Vitamin D3 2000–5000 IU + Zinc 30mg. Daily. Foundational for hormones, skin, and recovery.', 'daily', 0, 1)

  // ─── PILLAR-SPECIFIC EXTRAS ─────────────────────────────────────────────────
  if (lowH) {
    add(1, 'face', 'Symmetry: Dominant-Side Jaw Awareness', 'Chew on your non-dominant side 60% of the time. Reduces facial asymmetry caused by uneven jaw muscle development.', 'daily', 5, 1)
    add(4, 'training', 'Priority: Unilateral Exercises', 'Single-arm and single-leg dumbbell variations identify and close left-right strength imbalances. Symmetry starts with the body.', '3x/week', 50, 2)
    add(8, 'face', 'Facial Lymphatic Drainage Massage', 'Bilateral gua sha or lymphatic massage, 5 minutes each side. Reduces puffiness asymmetry and improves facial definition.', 'daily', 10, 2)
  }

  if (lowF) {
    add(1, 'skin', 'Features Priority: SPF 50+ Non-Negotiable', 'UV damage is the primary driver of features score decline. SPF every single day — even indoors, even in winter. Non-negotiable.', 'daily', 2, 1)
    add(5, 'skin', 'Dermarolling 0.5mm (Features Protocol)', 'Micro-needling improves texture, pore appearance, and product absorption. Weekly sessions compound over months.', '1x/week', 20, 3)
    add(9, 'skin', 'Consider Professional Skin Treatment', 'A professional chemical peel or microneedling session at this stage delivers results beyond any home routine. Book a consultation.', 'once', 5, 2)
  }

  if (lowD && !isFemale) {
    add(2, 'nutrition', 'Testosterone Stack: D3 + Zinc + Omega-3', 'Vitamin D3 5000 IU + Zinc 30mg + Omega-3 2g EPA/DHA daily. Measurably elevates testosterone within 4–6 weeks.', 'daily', 0, 1)
    add(3, 'training', 'Cold Exposure: End Showers Cold (3 min)', 'End every shower with 3 minutes of cold water. Elevates testosterone, lowers cortisol, and accelerates recovery.', 'daily', 5, 2)
  }

  if (lowD && isFemale) {
    add(2, 'style', 'Silhouette: High-Waisted Styling Audit', 'High-waisted bottoms emphasize waist-to-hip ratio — the primary feminine dimorphism driver. Audit your wardrobe this week.', 'once', 60, 1)
    add(5, 'training', 'Hip Thrust Priority: 4×12', 'Hip thrusts are the #1 glute builder. Heavy hip thrusts reshape the feminine silhouette faster than any other exercise.', '3x/week', 15, 2)
  }

  if (lowA) {
    add(1, 'face', 'Angularity: Mewing 24/7 — Suction Hold', 'Entire tongue flat on palate with suction hold. This is your primary angularity intervention. Do it always, every waking moment.', 'always', 0, 2)
    add(3, 'face', 'Angularity: Mastic Gum 20 min + Chin Tucks', 'Mastic gum builds masseter definition. Stack with 3×30 chin tucks. Double stimulus for jaw structure.', 'daily', 25, 3)
    add(6, 'face', 'Angularity: Peak Jawline Protocol', 'Mewing 24/7 + mastic gum 20 min + chin tucks 4×30 + caloric deficit if applicable. Maximum structural stimulus.', 'daily', 35, 3)
  }

  // ─── WEEK 12 RESCAN ─────────────────────────────────────────────────────────
  add(12, 'face', 'RESCAN: Your 12-Week Transformation', 'The most important task of the program. Scan under identical conditions as week 1. Your score reflects 12 weeks of compounding habits.', 'once', 15, 1, { isRescan: true })

  return tasks
}
