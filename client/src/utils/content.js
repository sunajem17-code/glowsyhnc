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

// Generate action plan tasks from analysis results
export function generatePlanTasks(faceData, bodyData) {
  const tasks = []
  let taskId = 1

  // Posture tasks
  if (bodyData.posture < 8) {
    const postureExercises = POSTURE_EXERCISES.filter(e =>
      bodyData.forwardHeadAngle > 10 ? e.target === 'forward_head' || e.target === 'rounded_shoulders'
      : e.target === 'rounded_shoulders' || e.target === 'anterior_pelvic_tilt'
    ).slice(0, 3)

    postureExercises.forEach(ex => {
      tasks.push({
        id: `task-${taskId++}`, category: 'posture',
        title: ex.name,
        description: ex.instructions || ex.steps[0],
        duration: ex.duration,
        difficulty: ex.difficulty,
        sets: ex.sets, reps: ex.reps,
        frequency: 'daily', week: 1, completed: false,
        exerciseId: ex.id,
        steps: ex.steps,
      })
    })
  }

  // Skincare tasks
  if (faceData.skinClarity < 7) {
    const routine = faceData.skinClarity < 5 ? SKINCARE_ROUTINES.acne : SKINCARE_ROUTINES.oily
    tasks.push({
      id: `task-${taskId++}`, category: 'skin',
      title: `AM Skincare Routine (${routine.name})`,
      description: `${routine.am.length}-step morning routine to address your skin clarity score.`,
      duration: 5, difficulty: 1, frequency: 'daily', week: 1, completed: false,
      routineType: 'am', skinType: Object.keys(SKINCARE_ROUTINES).find(k => SKINCARE_ROUTINES[k] === routine),
    })
    tasks.push({
      id: `task-${taskId++}`, category: 'skin',
      title: `PM Skincare Routine (${routine.name})`,
      description: `${routine.pm.length}-step evening routine. The PM routine is where most improvement happens.`,
      duration: 7, difficulty: 1, frequency: 'daily', week: 1, completed: false,
      routineType: 'pm', skinType: Object.keys(SKINCARE_ROUTINES).find(k => SKINCARE_ROUTINES[k] === routine),
    })
  }

  // Body/shoulder tasks
  if (bodyData.shoulderWaistRatio < 7) {
    const bodyExercises = HYPERTROPHY_EXERCISES.filter(e => e.target === 'shoulder_width').slice(0, 2)
    bodyExercises.forEach(ex => {
      tasks.push({
        id: `task-${taskId++}`, category: 'body',
        title: ex.name,
        description: ex.instructions,
        duration: 15, difficulty: ex.difficulty,
        sets: ex.sets, reps: ex.reps, rest: ex.rest,
        frequency: '3x/week', week: 1, completed: false, exerciseId: ex.id,
      })
    })
  }

  // V-taper tasks
  if (bodyData.bodyComposition < 6.5) {
    const vExercise = HYPERTROPHY_EXERCISES.find(e => e.target === 'v_taper')
    if (vExercise) {
      tasks.push({
        id: `task-${taskId++}`, category: 'body',
        title: vExercise.name,
        description: vExercise.instructions,
        duration: 20, difficulty: vExercise.difficulty,
        sets: vExercise.sets, reps: vExercise.reps,
        frequency: '3x/week', week: 1, completed: false, exerciseId: vExercise.id,
      })
    }
  }

  // Grooming tip task
  if (faceData.jawlineDefinition < 6.5) {
    const tip = GROOMING_TIPS.find(t => t.category === 'beard')
    tasks.push({
      id: `task-${taskId++}`, category: 'style',
      title: 'Review Beard/Grooming Strategy',
      description: tip.description,
      duration: 10, difficulty: 1, frequency: 'weekly', week: 1, completed: false,
      tip: tip.tip,
    })
  }

  // Hydration task (always included)
  tasks.push({
    id: `task-${taskId++}`, category: 'health',
    title: 'Drink 8+ Glasses of Water',
    description: 'Hydration is one of the fastest ways to improve skin clarity and energy. Track daily.',
    duration: 0, difficulty: 1, frequency: 'daily', week: 1, completed: false,
  })

  // Sleep task
  tasks.push({
    id: `task-${taskId++}`, category: 'health',
    title: 'Get 7-9 Hours of Sleep',
    description: 'Sleep is when your body repairs collagen, regulates cortisol, and reduces eye puffiness.',
    duration: 0, difficulty: 1, frequency: 'daily', week: 1, completed: false,
  })

  return tasks
}
