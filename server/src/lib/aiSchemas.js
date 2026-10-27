// Existing model output contracts. These describe the current fields; they do
// not change scoring formulas or create values when analysis fails.
const string = { type: 'string' }
const number = { type: 'number' }
const score = { type: 'number', minimum: 1, maximum: 10 }
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const array = (items, limits = {}) => ({ type: 'array', items, ...limits })
const strings = array(string)
const enumeration = values => ({ type: 'string', enum: values })
const scores = keys => object(Object.fromEntries(keys.map(key => [key, score])))
const metric = object({ score, descriptor: string })
const metrics = keys => object(Object.fromEntries(keys.map(key => [key, metric])))
const appearanceFinding = object({
  title: { type: 'string', minLength: 1, maxLength: 80 },
  observation: { type: 'string', minLength: 1, maxLength: 240 },
  significance: { type: 'string', maxLength: 160 },
  recommendation: { type: 'string', maxLength: 200 },
  metric_keys: array(enumeration([
    'face_score', 'grooming_score',
    'pillar_harmony', 'pillar_angularity', 'pillar_features', 'pillar_dimorphism',
    'sub_symmetry', 'sub_jawline_definition', 'sub_skin_clarity', 'sub_facial_proportions', 'sub_eye_area', 'sub_facial_harmony',
    'metric_jawline', 'metric_cheekbones', 'metric_symmetry', 'metric_skin_quality', 'metric_masculinity_femininity', 'metric_facial_thirds',
  ]), { minItems: 1, maxItems: 2 }),
})

function core(hasSide) {
  const properties = {
    face_score: score, grooming_score: score,
    facial_structure: enumeration(['heavy', 'soft/round', 'average', 'defined', 'strong', 'elite']),
    hair_type: enumeration(['straight', 'wavy', 'curly', 'coily', 'locs', 'bald', 'unknown']),
    pillars: scores(['harmony', 'angularity', 'features', 'dimorphism']),
    sub_scores: scores(['symmetry', 'jawline_definition', 'skin_clarity', 'facial_proportions', 'eye_area', 'facial_harmony']),
    key_strengths: array(string, { maxItems: 6 }), key_weaknesses: array(string, { maxItems: 6 }),
    top_improvement: string,
    appearance_analysis: object({
      strengths: array(appearanceFinding, { maxItems: 6 }),
      improvement_opportunities: array(appearanceFinding, { maxItems: 6 }),
      positive_observations: array(appearanceFinding, { maxItems: 0 }),
    }),
    visual_observations: array(object({
      id: enumeration(['visible_acne', 'visible_scarring', 'visible_oiliness', 'visible_dark_circles', 'visible_dullness', 'visible_temporal_recession', 'visible_crown_thinning', 'visible_diffuse_thinning', 'hairline_asymmetry', 'facial_hair', 'grooming_issue']),
      category: enumeration(['skin', 'hair', 'grooming']), source: enumeration(['visual_observation']),
      confidence: enumeration(['low', 'medium', 'high']),
      images_supporting: array(enumeration(['front', 'profile'])), limitations: strings,
    })),
    face_metrics: metrics(['jawline', 'cheekbones', 'symmetry', 'skin_quality', 'masculinity_femininity', 'facial_thirds']),
  }
  if (hasSide) properties.profile = object({ profile_score: score,
    nose_bridge: enumeration(['soft', 'medium', 'strong', 'aquiline']),
    jawline_projection: enumeration(['recessed', 'average', 'projected', 'strong']),
    chin_projection: enumeration(['recessed', 'average', 'projected', 'prominent']),
  })
  return object(properties)
}

const extended = object({ extended_metrics: object({
  eyes: metrics(['orbital_depth', 'canthal_tilt', 'eyebrow_density', 'eyelash_density', 'eyelid_exposure', 'under_eye_health']),
  lower_third: metrics(['lips', 'mandible', 'gonial_angle', 'ramus', 'hyoid_skin_tightness', 'jaw_width']),
  midface: metrics(['cheekbones', 'maxilla', 'nose', 'ipd', 'fwhr', 'compactness']),
  upper_third: metrics(['norwood_stage', 'forehead_proportion', 'hairline_recession', 'hair_thinning', 'hairline_density', 'forehead_slope']),
  miscellaneous: metrics(['skin', 'harmony', 'symmetry', 'neck_width', 'bloat', 'bone_mass']),
}) })

const physique = object({ ...scores(['proportions', 'leanness', 'frame', 'posture', 'overall_presentation', 'potential', 'muscle_mass', 'body_fat_score', 'v_taper', 'frame_width']).properties,
  body_fat_level: enumeration(['very_lean', 'lean', 'average', 'above_average', 'heavy']),
  physique_strengths: strings, physique_improvements: strings, physique_notes: string,
})
const physiqueDisplayRatings = scores(['potential', 'muscle_mass', 'body_fat_score', 'v_taper', 'frame_width'])
const validation = object({ valid: { type: 'boolean' }, faceCount: { type: 'integer', minimum: 0 },
  issues: array(object({ type: enumeration(['no_face', 'not_a_person', 'multiple_faces', 'too_far', 'too_close', 'face_cropped', 'too_dark', 'too_blurry']), message: string }), { maxItems: 5 }),
})
const workout = object({
  split: string, trainingLevel: string, trainingEmphasis: string, emphasisReason: string,
  priorities: array(object({ area: string, muscles: array(string, { minItems: 1, maxItems: 4 }), role: enumeration(['Primary', 'Secondary']), reason: string, confidence: enumeration(['supported observation', 'tentative visual cue', 'user-selected']) }), { maxItems: 3 }),
  maintenanceAreas: array(string, { minItems: 1, maxItems: 10 }),
  days: array(object({ name: string, focus: string, targetMuscles: array(string, { minItems: 1, maxItems: 6 }),
    exercises: array(object({ name: string, targetMuscles: array(string, { minItems: 1, maxItems: 4 }), sets: { type: 'integer', minimum: 1, maximum: 6 }, reps: string, restSeconds: { type: 'integer', minimum: 30, maximum: 300 }, effortTarget: string, why: string, instructions: string, progressionInstructions: string, alternatives: array(string, { minItems: 1, maxItems: 2 }) }), { minItems: 3, maxItems: 6 }),
  }))
})
const products = array(object({ name: string, description: string, searchQuery: string }), { minItems: 5, maxItems: 5 })
const potential = object({ improvements: array(string, { minItems: 3, maxItems: 3 }), potential_tier: string, timeline: string, headline: string })
function ranking(count) { return object({ winner_index: { type: 'integer', minimum: 0, maximum: count - 1 },
  rankings: array(object({ index: { type: 'integer', minimum: 0, maximum: count - 1 }, rank: { type: 'integer', minimum: 1, maximum: count }, score, reason: string }), { minItems: count, maxItems: count }), winner_tips: strings,
}) }

module.exports = { core, extended, physique, physiqueDisplayRatings, validation, workout, products, potential, ranking }
