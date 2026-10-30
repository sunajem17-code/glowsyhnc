// Reviewed 2026-10-30. Community experiences inform usability, not diagnoses.
// The model selects IDs; URLs and practical instructions come from this catalogue.
const SOURCES = {
  eyes: { title: 'DermNet: dark circles', url: 'https://dermnetnz.org/topics/dark-circles-under-the-eyes', type: 'clinical' },
  puffiness: { title: 'Mayo Clinic: under-eye bags', url: 'https://www.mayoclinic.org/diseases-conditions/bags-under-eyes/diagnosis-treatment/drc-20369931', type: 'clinical' },
  acne: { title: 'American Academy of Dermatology: acne care', url: 'https://www.aad.org/public/diseases/acne/skin-care/tips', type: 'clinical' },
  shaving: { title: 'American Academy of Dermatology: razor bumps', url: 'https://www.aad.org/news/how-to-prevent-razor-bumps', type: 'clinical' },
  jaw: { title: 'American Association of Orthodontists: mewing', url: 'https://aaoinfo.org/whats-trending/is-mewing-bad-for-you/', type: 'clinical' },
  haircut: { title: 'Barber guidance: useful haircut references', url: 'https://www.highgate-cuts.co.uk/blog/post/haircut-reference-photos', type: 'professional' },
}
const GUIDES = {
  under_eye_shadows: {
    title: 'Work out what the shadow actually is',
    appliesTo: 'Clearly visible under-eye shading; never infer its cause from a score.',
    steps: ['Compare one photo facing a window with one under overhead light, keeping your head level. A big change suggests lighting contributes; it does not diagnose the cause.', 'Avoid rubbing. Use sun protection and a tolerated moisturizer for dryness; neither fills a hollow nor changes eye shape.', 'If the shading persists and bothers you, ask a dermatologist to distinguish pigment, visible vessels and structural shadow before buying treatments.'],
    frequency: 'Check once in consistent light; keep daily care simple.',
    timeframe: 'Lighting changes are immediate. Persistent pigmentation or hollowing has no guaranteed home-treatment timeline.',
    limits: 'Sleep and hydration are not universal cures. Do not self-prescribe iron, allergy drugs, lash-growth drugs or injections from a selfie.',
    sources: [SOURCES.eyes],
  },
  under_eye_puffiness: {
    title: 'Try gentle relief for temporary puffiness',
    appliesTo: 'Visible under-eye swelling, without claiming a medical cause.',
    steps: ['Rest a clean washcloth dampened with cool water over closed eyes for a few minutes. Use light contact, not pressure or ice directly on skin.', 'Notice whether the puffiness varies through the day. Keep a regular sleep schedule; if itchy eyes or nasal allergies are also a concern, discuss those symptoms with a clinician.', 'Compare under the same lighting and at the same time of day before deciding whether an approach helps.'],
    frequency: 'As needed for temporary puffiness.',
    timeframe: 'A compress may offer temporary relief; persistent bags may not respond to home care.',
    limits: 'Eye pain, vision changes or new one-sided swelling need prompt medical advice. A photo cannot distinguish the underlying causes.',
    sources: [SOURCES.puffiness],
  },
  skin_basics: {
    title: 'Build a routine you can actually keep',
    appliesTo: 'Visible uneven skin texture or blemishes; do not diagnose acne from an unclear image.',
    steps: ['Use a gentle cleanser with your fingertips; avoid scrubs and picking. Choose non-comedogenic products if breakouts are a concern.', 'Use a moisturizer you tolerate and broad-spectrum SPF 30+ outdoors, following the label.', 'Introduce only one change at a time. Keep the routine consistent; seek a dermatologist for painful, scarring or persistent breakouts.'],
    frequency: 'Simple morning/evening care; sunscreen as directed.',
    timeframe: 'Skin improvement often takes weeks to months. Compare weekly photos rather than judging daily.',
    limits: 'A photo cannot identify the right acne medication. Do not combine multiple strong actives or put acne products near the eyes.',
    sources: [SOURCES.acne],
  },
  shaving_irritation: {
    title: 'Reduce friction in your shaving routine',
    appliesTo: 'Visible irritation in a shaved area; state uncertainty rather than diagnosing razor bumps.',
    steps: ['Soften hair with warm water and use a moisturizing shaving cream.', 'Shave in the direction the hair grows with light strokes; avoid stretching skin and repeated close passes.', 'Consider leaving a little length with an electric trimmer if close shaving irritates you. Keep tools clean; get persistent or painful bumps checked.'],
    frequency: 'At each shave; adjust to your skin’s tolerance.',
    timeframe: 'Reassess irritation between shaves, not from one immediate after-shave photo.',
    limits: 'Do not dig out hairs, pick bumps or use shared blades. Facial redness can have causes unrelated to shaving.',
    sources: [SOURCES.shaving],
  },
  hair_shape: {
    title: 'Make the haircut work outside the barber’s chair',
    appliesTo: 'Visible hair shape or uneven bulk; not hidden hair loss or invented face ratios.',
    steps: ['Choose two reference photos with hair texture and density similar to yours, including a side view.', 'Tell your barber how many minutes you will style it each morning and how often you can return. Ask what length and weight to retain.', 'Ask them to show one repeatable styling method. Try the styling change before committing to a major cut.'],
    frequency: 'At your next cut; practise the agreed styling routine.',
    timeframe: 'Styling can change presentation immediately; the right shape may take a cut or grow-out period.',
    limits: 'This is a reversible style choice, not a treatment or a guaranteed increase in attractiveness.',
    sources: [SOURCES.haircut],
  },
  jaw_expectations: {
    title: 'Separate presentation from bone structure',
    appliesTo: 'Clearly visible lower-face presentation, with lighting and pose limitations stated.',
    steps: ['Check the jaw in even light with a relaxed, level head before treating a shadow as a problem.', 'If facial hair is present, compare an even trim with your current style; ask a barber for an option you can maintain.', 'If you have bite discomfort or a functional concern, ask a dentist or orthodontist rather than trying jaw-training devices.'],
    frequency: 'Compare once under matched conditions; maintain your preferred grooming.',
    timeframe: 'Grooming changes presentation immediately. Exercises are not a reliable way to reshape jaw bones.',
    limits: 'A face photo cannot establish a need to lose weight. Avoid hard-chewing regimens, forced tongue pressure, dehydration and promises of structural changes.',
    sources: [SOURCES.jaw],
  },
}
function attachGuides(analysis) {
  return { ...analysis, improvementOpportunities: analysis.improvementOpportunities.map(row => ({ ...row,
    ...(GUIDES[row.guideId] ? { guide: { ...GUIDES[row.guideId], reviewedAt: '2026-10-30' } } : {}),
  })) }
}
module.exports = { GUIDES, SOURCES, attachGuides }
