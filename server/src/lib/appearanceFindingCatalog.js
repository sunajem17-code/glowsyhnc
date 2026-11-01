// Stable IDs identify one underlying feature across scans. The model selects
// only entries supported by the current scan; canonical titles and actions
// keep the resulting advice focused and easy to compare over time.
const APPEARANCE_FINDING_CATALOG = {
  facial_symmetry: { title: 'Facial symmetry', type: 'score', evidence: 'a clear left-to-right difference in feature height, spacing, or facial midline', guidance: 'Name the features that differ. Do not infer a cause or repeat the same difference under eye, brow, or jaw findings.' },
  jawline_definition: { title: 'Jawline definition', type: 'score', evidence: 'the visible jaw edge and lower-face definition', guidance: 'Describe how clear the jaw edge looks. Do not claim that grooming changes bone structure or infer body fat from a face.' },
  cheekbone_prominence: { title: 'Cheekbone prominence', type: 'score', evidence: 'visible cheekbone height and prominence', guidance: 'Describe cheekbone prominence directly. Do not call it bloating or guess its cause.' },
  skin_quality: { title: 'Skin quality', type: 'score', evidence: 'visible skin texture, breakouts, marks, redness, dryness, oiliness, or uneven tone', guidance: 'Name the visible skin feature behind the score. Do not turn the score alone into an acne or health diagnosis.' },
  facial_proportions: { title: 'Facial proportions', type: 'score', evidence: 'visible balance of the upper, middle, and lower face', guidance: 'Say which section looks out of balance; do not repeat it as forehead balance or facial thirds.' },
  eye_area: { title: 'Eye area', type: 'score', evidence: 'a specific visible eye-area feature such as eyelid exposure, eye spacing, openness, or under-eye appearance', guidance: 'If a distinct sub-feature is visible, use its specific catalog entry instead of a vague general eye-area point.' },
  facial_harmony: { title: 'Facial balance', type: 'score', evidence: 'a specific interaction between visible features that is not already covered by another finding', guidance: 'Name the combination of features. Do not use this as a duplicate or generic filler point.' },
  grooming: { title: 'Grooming', type: 'score', evidence: 'a clearly visible grooming issue not already covered by hair, brow, lip, or facial-hair findings', guidance: 'Name the exact area and one practical tidy-up step. Do not use this as a duplicate catch-all.' },

  chin_projection: { title: 'Chin projection', type: 'profile', evidence: 'chin position compared with the lips in a clear side view', guidance: 'Describe the visible chin position. Haircuts and jaw exercises do not change chin bone position; suggest an orthodontic or qualified specialist assessment only if the person wants to explore structural options.' },
  jaw_projection: { title: 'Jaw projection', type: 'profile', evidence: 'how far the jaw sits forward in a clear side view', guidance: 'Describe the visible profile plainly. Do not suggest grooming or mewing changes bone position.' },
  jaw_width: { title: 'Jaw width', type: 'profile', evidence: 'visible jaw width relative to the rest of the face in a suitable view', guidance: 'Describe width compared with the face; do not invent a measurement.' },
  gonial_angle: { title: 'Jaw angle', type: 'profile', evidence: 'the visible corner where the jaw turns upward in a clear side view', guidance: 'Describe whether this corner looks distinct or soft. Do not confuse it with a neck-to-jaw angle.' },
  ramus_height: { title: 'Jaw height', type: 'profile', evidence: 'visible height of the back part of the jaw in a clear side view', guidance: 'Explain ramus as the back part of the jaw. Do not claim it can be changed with exercises.' },
  midface_projection: { title: 'Midface projection', type: 'profile', evidence: 'midface support visible in a clear side view', guidance: 'Describe the visible profile without claiming a diagnosis or unsupported measurement.' },
  cheekbone_visibility: { title: 'Cheekbone visibility', type: 'visible', evidence: 'clearly visible cheek contour or lack of contour, distinct from overall cheekbone prominence', guidance: 'Use only when this is a separate visible contour issue from the cheekbone score finding.' },
  facial_width_height: { title: 'Face width and length', type: 'visible', evidence: 'a clear visible balance between face width and face length', guidance: 'Describe the overall shape without inventing a ratio or measurement.' },
  forehead_balance: { title: 'Forehead balance', type: 'visible', evidence: 'visible forehead proportion relative to the rest of the face, distinct from the facial-thirds finding', guidance: 'Use only when it is a separate, specific issue not already covered by facial proportions.' },

  canthal_tilt: { title: 'Outer eye-corner tilt', type: 'visible', evidence: 'a clearly visible direction of the outer eye corner compared with the inner corner', guidance: 'Describe the visible eye-corner direction without calling it a disorder or implying exercises can change it.' },
  eyelid_exposure: { title: 'Upper eyelid exposure', type: 'visible', evidence: 'visible amount of upper eyelid showing above the iris', guidance: 'Describe how much upper lid is visible. Do not diagnose ptosis or recommend eye exercises.' },
  lower_scleral_show: { title: 'White below the iris', type: 'visible', evidence: 'clearly visible white of the eye below the iris', guidance: 'Describe only what is visible; do not diagnose an eye condition.' },
  eye_openness: { title: 'Eye openness', type: 'visible', evidence: 'a clear difference in how open the two eyes look or a distinct, consistently visible openness concern', guidance: 'Name the visible difference. Do not diagnose a droopy eyelid or lazy eye.' },
  eye_alignment: { title: 'Eye alignment', type: 'visible', evidence: 'a clear visible difference in the direction the eyes appear to point', guidance: 'Describe visible alignment only. Do not diagnose strabismus or lazy eye; suggest an eye-care professional for a persistent or new difference.' },
  eye_spacing: { title: 'Eye spacing', type: 'visible', evidence: 'eye spacing that is clearly wide or close compared with visible eye width', guidance: 'Describe the visible spacing without claiming a medical or measured diagnosis.' },
  orbital_depth: { title: 'Eye depth', type: 'visible', evidence: 'a clearly visible deep-set or prominent eye area', guidance: 'Explain that this describes appearance, not a measured bone feature. Do not repeat under-eye shadowing as eye depth.' },
  brow_position: { title: 'Brow position', type: 'visible', evidence: 'a clear difference in brow height or position relative to the eyes', guidance: 'Name the visible side or position. Do not repeat the same issue as brow shape or facial symmetry.' },
  brow_shape: { title: 'Brow shape', type: 'visible', evidence: 'visible brow shape or stray hairs that can be safely groomed', guidance: 'Suggest trimming only a few obvious stray hairs or asking a careful barber; avoid aggressive plucking.' },
  brow_density: { title: 'Brow density', type: 'visible', evidence: 'clearly sparse or uneven brow hair that noticeably changes the eye frame', guidance: 'Describe the sparse area; do not diagnose hair loss or recommend harsh treatments.' },
  eyelash_density: { title: 'Eyelash density', type: 'visible', evidence: 'clearly sparse or uneven lashes that noticeably affect the eye frame', guidance: 'Keep advice optional and eye-safe; do not suggest products near the eye without appropriate professional guidance.' },
  under_eye: { title: 'Under-eye area', type: 'visible', evidence: 'a clear under-eye concern that does not fit a more specific darkness, hollowing, or puffiness finding', guidance: 'Use the specific under-eye entry whenever the visible issue can be identified.' },
  under_eye_darkness: { title: 'Under-eye darkness', type: 'visible', evidence: 'clearly visible darker color beneath the eyes', guidance: 'Describe the color without guessing its cause. Do not promise a cream will remove it.' },
  under_eye_hollowing: { title: 'Under-eye hollowness', type: 'visible', evidence: 'a clearly visible hollow or sunken area beneath the eyes', guidance: 'Describe the visible hollow without guessing why it is present.' },
  under_eye_puffiness: { title: 'Under-eye puffiness', type: 'visible', evidence: 'clearly visible puffiness beneath or around the eyes', guidance: 'Describe what is visible without claiming water retention or a health cause. For sudden or persistent swelling, suggest asking a clinician.' },

  nose_balance: { title: 'Nose balance', type: 'visible', evidence: 'a visible proportion or shape concern supported by the front or side view', guidance: 'Name the visible feature; do not use a vague nose criticism or invent a measurement.' },
  lip_balance: { title: 'Upper-to-lower lip balance', type: 'visible', evidence: 'a clearly visible difference in upper-to-lower lip proportion', guidance: 'Describe the visible proportion, not a judgment about the person.' },
  lip_condition: { title: 'Lip dryness', type: 'visible', evidence: 'clearly visible dryness, chapping, or flaking on the lips', guidance: 'Suggest plain lip balm and avoiding picking; do not diagnose a condition.' },

  hairline_shape: { title: 'Hairline shape', type: 'visible', evidence: 'a clearly visible hairline shape or recession; do not infer hidden thinning', guidance: 'Describe the visible hairline. Do not diagnose hair loss.' },
  hairstyle_shape: { title: 'Hair shape', type: 'visible', evidence: 'visible haircut shape, styling, or uneven edges', guidance: 'Give a specific haircut or styling suggestion only when the hair itself is the concern.' },
  hair_density: { title: 'Hair density', type: 'visible', evidence: 'visible thinning or sparse density only where the scalp is shown', guidance: 'Do not infer hidden thinning or diagnose hair loss.' },
  facial_hair_grooming: { title: 'Facial-hair outline', type: 'visible', evidence: 'facial hair is present and visibly uneven, untrimmed, or poorly defined', guidance: 'Name the edge or area to tidy. Never say facial hair needs grooming when none is present.' },
  facial_hair_length: { title: 'Facial-hair length', type: 'visible', evidence: 'facial hair is present and its visible length looks uneven or poorly suited to a neat outline', guidance: 'Suggest a specific shorter trim or clean shave only when supported by the visible hair.' },
  facial_hair_choice: { title: 'Facial-hair style', type: 'visible', evidence: 'facial hair is present and a different trim or clean shave could visibly improve neatness', guidance: 'Treat as an optional style choice, not a defect; do not duplicate an outline or length finding.' },

  skin_texture: { title: 'Skin texture', type: 'visible', evidence: 'clearly visible roughness, bumps, or uneven texture not already covered by a more specific skin finding', guidance: 'Name the visible texture. Avoid harsh scrubs or claiming a routine will erase it.' },
  visible_spots: { title: 'Visible breakouts', type: 'visible', evidence: 'clearly visible spots or breakout-like blemishes; do not diagnose acne', guidance: 'Describe the visible spots without calling them acne as a diagnosis. Suggest a gentle routine; persistent or painful breakouts can be discussed with a clinician.' },
  post_breakout_marks: { title: 'Post-breakout marks', type: 'visible', evidence: 'visible red or dark marks that look distinct from active spots', guidance: 'Call them visible marks, not scars, unless lasting scar texture is clearly present.' },
  visible_scarring: { title: 'Skin scarring', type: 'visible', evidence: 'clearly visible lasting indented or raised skin scars', guidance: 'Do not promise skincare will remove scars; suggest a dermatologist consultation if the person wants treatment options.' },
  visible_redness: { title: 'Skin redness', type: 'visible', evidence: 'clearly visible redness or uneven color', guidance: 'Describe its location without diagnosing rosacea, irritation, or another condition.' },
  uneven_skin_tone: { title: 'Uneven skin tone', type: 'visible', evidence: 'clearly visible darker or lighter patches that are distinct from redness or post-breakout marks', guidance: 'Describe the visible color difference without guessing its cause; suggest daily sunscreen and professional advice for persistent changes.' },
  skin_oiliness: { title: 'Oily-looking skin', type: 'visible', evidence: 'clear, broad skin shine that is not just a reflection or bright spot', guidance: 'Suggest gentle cleansing and a light, non-comedogenic moisturizer; do not recommend stripping or harsh scrubbing.' },
  skin_dryness: { title: 'Dry or flaky skin', type: 'visible', evidence: 'clearly visible flaky or dry patches', guidance: 'Suggest a gentle moisturizer and avoiding harsh scrubs; do not diagnose a skin condition.' },
  pore_visibility: { title: 'Visible pores', type: 'visible', evidence: 'pores are clearly prominent at the scan detail and this is not ordinary visible skin texture', guidance: 'Be clear that pores are normal and cannot be permanently closed; avoid harsh products or unrealistic promises.' },
  facial_fullness: { title: 'Facial fullness', type: 'visible', evidence: 'clearly visible cheek fullness or roundness', guidance: 'Describe fullness only. Never infer body fat, bloating, or its cause from a face; weight advice requires reliable body measurements or a physique scan.' },
}

const APPEARANCE_FINDING_IDS = Object.freeze(Object.keys(APPEARANCE_FINDING_CATALOG))

function canonicalizeFinding(value) {
  const id = typeof value?.catalog_id === 'string' ? value.catalog_id
    : typeof value?.catalogId === 'string' ? value.catalogId : null
  const definition = id ? APPEARANCE_FINDING_CATALOG[id] : null
  if (!definition) throw new Error('Appearance finding has an unknown catalog ID')
  return { ...value, catalogId: id, title: definition.title }
}

function catalogPrompt() {
  return Object.entries(APPEARANCE_FINDING_CATALOG)
    .map(([id, item]) => `- ${id}: ${item.title} — include only when this scan shows: ${item.evidence}. Advice rule: ${item.guidance}`)
    .join('\n')
}

module.exports = { APPEARANCE_FINDING_CATALOG, APPEARANCE_FINDING_IDS, canonicalizeFinding, catalogPrompt }
