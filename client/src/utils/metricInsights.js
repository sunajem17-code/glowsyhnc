// Tier-based metric insight templates.
// 5 tiers per metric with genuinely different framing per tier — not adjective swaps.
// Score → tier: exceptional ≥8.5, strong 7–8.4, average 5–6.9, below 3–4.9, low <3
// Tone: confident, direct, constructive. Honest at the low end, never insulting.

const TIERS = [
  { min: 8.5, key: 'exceptional' },
  { min: 7.0, key: 'strong' },
  { min: 5.0, key: 'average' },
  { min: 3.0, key: 'below' },
  { min: 0,   key: 'low' },
]

const INSIGHTS = {
  // ── Eyes ────────────────────────────────────────────────────────────────────
  canthalTilt: {
    exceptional: "Strongly positive tilt — your outer corners sit noticeably higher than the inner, giving a sharp, hunter-eyed read.",
    strong:      "Positive tilt working in your favor. The upward angle adds real edge and definition to the eye shape.",
    average:     "Your tilt is close to neutral. Not a weakness, but it isn't adding the angular edge a positive tilt creates.",
    below:       "Slightly negative tilt is softening the eye shape. The outer corners dip just enough to reduce perceived sharpness.",
    low:         "Negative tilt is the primary factor pulling this score down — the outer corners sit below the inner, blunting the eye's edge.",
  },
  orbitalDepth: {
    exceptional: "Deep-set orbits create strong shadow contrast that frames the eyes definitively without any product.",
    strong:      "Good orbital depth — your brow ridge creates enough shadow to give the eyes a well-framed, defined look.",
    average:     "Moderate depth. Your eyes sit in a middle zone — not flat, but not delivering the contrast deeper orbits provide.",
    below:       "Shallow orbital depth means less natural shadow framing around the eye, reducing perceived definition.",
    low:         "Very flat orbital plane — the eye area reads as underdefined because there's minimal brow-ridge shadow working for it.",
  },
  eyebrowDensity: {
    exceptional: "Dense, well-distributed brows that frame the face strongly — a major visual anchor working for you.",
    strong:      "Solid brow density. Good frame for the eye area and the face overall.",
    average:     "Average density. Brows are present but not dominant — grooming and fill can push this noticeably higher.",
    below:       "Sparse in key zones, which weakens the frame around the eyes. Addressable with grooming and the right fill technique.",
    low:         "Very low density is creating a weak brow frame. One of the highest-ROI areas to address first.",
  },
  eyelashDensity: {
    exceptional: "Dense lashes with strong contrast — defining the eye border cleanly and amplifying the eye's visual size.",
    strong:      "Good lash density. They're doing real framing work for the eye shape.",
    average:     "Moderate density. Not a liability, but more density would sharpen the eye's visual edge.",
    below:       "Sparse lashes are softening the eye border. Addressable and not structural.",
    low:         "Very sparse — the eye border reads as poorly defined. One of the more fixable items on the list.",
  },
  eyelidExposure: {
    exceptional: "High lid exposure — a significant positive. More lid showing reads as more awake, open, and visually dominant.",
    strong:      "Good lid exposure. Your eyes read as open and engaged, with the lid contributing positively to the shape.",
    average:     "Moderate exposure. Not hood-heavy, but more lid showing would strengthen the eye's dominance.",
    below:       "Significant hooding is compressing the visible lid. This is the most reducible factor in this score.",
    low:         "Heavy hooding is covering most of the lid. Mostly structural, but posture and facial tension have measurable impact.",
  },
  underEyeHealth: {
    exceptional: "Clean under-eye area with minimal hollowing and discoloration — reads as well-rested and healthy.",
    strong:      "Good under-eye quality. Minor issues that don't significantly drag on the eye area's overall read.",
    average:     "Some hollowing or discoloration present. Hydration, sleep quality, and sodium have the highest impact here.",
    below:       "Noticeable hollowing or discoloration is pulling this down. These are largely lifestyle-addressable factors.",
    low:         "Significant under-eye issues — likely a mix of hollowing and pigmentation. Sleep and hydration are your highest-leverage variables.",
  },

  // ── Lower Third ─────────────────────────────────────────────────────────────
  lips: {
    exceptional: "Strong lip volume and definition — structurally balanced and contributing clearly to the lower face.",
    strong:      "Good lip structure. Volume and definition are working for you in the lower third.",
    average:     "Average lip volume and definition. Not detracting, but not contributing significantly either.",
    below:       "Thinner lips or reduced definition are weakening the lower face read. Hydration and styling choices can shift this.",
    low:         "Very reduced lip volume is the primary factor here. The lower face reads as underpowered as a result.",
  },
  mandible: {
    exceptional: "Exceptional mandibular width and definition — this is the structural authority the lower face carries.",
    strong:      "Strong mandible. The lower jaw is contributing real width and structure to the overall face shape.",
    average:     "Moderate mandibular development. Structural floor is there, but definition isn't carrying.",
    below:       "Underdeveloped mandibular structure is softening the lower face. Body fat and posture are the adjustable factors.",
    low:         "Weak mandibular definition is significantly limiting the lower face. Body composition is the highest-leverage variable here.",
  },
  gonialAngle: {
    exceptional: "Gonial angle sits in a strong aesthetic zone — angular enough to define the jaw without looking overly harsh.",
    strong:      "Good gonial angle contributing real definition to the jaw corner. A genuine positive.",
    average:     "Moderate gonial angle — jaw corners are visible but not particularly sharp or defining.",
    below:       "Blunted gonial angle is reducing jaw definition at the corners. Mewing and masticatory work are the primary levers.",
    low:         "Rounded gonial angle is why the jaw reads as soft. Structural, but masticatory habits have documented long-term impact.",
  },
  ramus: {
    exceptional: "Tall ramus height — creates the vertical face structure that reads as strong and proportionate.",
    strong:      "Good ramus height contributing to solid lower face proportions.",
    average:     "Average ramus height. Proportions are fine but not a feature.",
    below:       "Shorter ramus is compressing the lower face's vertical read. Mostly structural.",
    low:         "Short ramus height is creating a compressed lower third. Forward growth habits have the most long-term impact here.",
  },
  hyoidSkinTightness: {
    exceptional: "Tight neck-jaw junction — reads as clean and well-defined with no soft tissue excess.",
    strong:      "Good tightness in the neck-jaw area. The transition reads as clean.",
    average:     "Moderate tightness. Some softening at the neck-jaw junction improvable with body composition.",
    below:       "Notable softness at the hyoid area. Body fat percentage is the primary driver and the most addressable factor.",
    low:         "Significant neck-jaw softness is pulling this score down substantially. Body composition is the single highest-ROI lever.",
  },
  jawWidth: {
    exceptional: "Wide jaw — a major structural positive giving the lower face its visual authority.",
    strong:      "Good jaw width. The lower face has solid lateral structure.",
    average:     "Moderate jaw width. Not narrow, but not adding significant horizontal impact to the lower face.",
    below:       "Narrower jaw is limiting the lower face's horizontal read. Body fat affects perceived width more than most realize.",
    low:         "Narrow jaw is significantly limiting the lower third's presence. Most structural factor in this category.",
  },

  // ── Midface ─────────────────────────────────────────────────────────────────
  cheekbones: {
    exceptional: "High, prominent cheekbones — creating strong lateral structure and shadow definition in the midface.",
    strong:      "Good cheekbone projection. They're adding real structural character to the midface.",
    average:     "Moderate cheekbone presence. Not flat, but not dominating the midface the way prominent cheekbones do.",
    below:       "Flat or recessed cheekbones are limiting the midface's structure. Body fat percentage has the most immediate impact.",
    low:         "Very recessed cheekbone area is the main thing holding this score down. Body composition is the most addressable variable.",
  },
  maxilla: {
    exceptional: "Strong maxillary projection giving the midface real forward structure — a significant positive.",
    strong:      "Good maxillary projection. Your midface sits forward with solid structure.",
    average:     "Moderate maxillary development. The midface is adequate but not projecting with authority.",
    below:       "Recessed maxilla is pulling the midface back. Mewing and forward growth habits are the long-term levers.",
    low:         "Significant maxillary recession is the primary factor limiting the midface. This is what forward growth protocols target.",
  },
  nose: {
    exceptional: "Strong nasal proportionality — size, projection, and width are well-calibrated for your face.",
    strong:      "Good nasal proportions. Shape and size are working with the face, not against it.",
    average:     "Moderate proportionality. No single feature is dramatically off, but overall calibration could be stronger.",
    below:       "One or more nasal dimensions sit outside ideal ratios for your facial structure.",
    low:         "Significant nasal proportionality issues are the main factor limiting midface coherence.",
  },
  ipd: {
    exceptional: "Ideal interpupillary distance for your face width — eye spacing reads as naturally balanced.",
    strong:      "Good IPD ratio. Eye spacing is well-calibrated to your facial width.",
    average:     "Moderate IPD ratio. Eye spacing is acceptable but not optimal for your face width.",
    below:       "IPD sits either too close or too wide for your face proportions, affecting how the midface reads.",
    low:         "Significant interpupillary spacing issue relative to face width — a structural factor affecting facial harmony.",
  },
  fwhr: {
    exceptional: "Your facial width-to-height ratio sits in a strong aesthetic zone — compact, structured, and visually balanced.",
    strong:      "Good FWHR. Your face proportions have a solid compact structure.",
    average:     "Moderate FWHR. Face proportions are in an average zone — not a liability, not an asset.",
    below:       "FWHR pulling toward the weaker end. Face structure reads as either too elongated or too wide.",
    low:         "FWHR significantly outside ideal range. This proportion issue affects the overall face read.",
  },
  compactness: {
    exceptional: "Highly compact facial proportions — features are well-condensed with minimal wasted space between them.",
    strong:      "Good facial compactness. Features sit close together in a way that reads as structured.",
    average:     "Moderate compactness. Feature spacing is acceptable but not especially tight.",
    below:       "Stretched feature spacing is reducing facial compactness. Reads as less structured in the midface.",
    low:         "Low compactness — features are spread significantly, weakening midface cohesion.",
  },

  // ── Upper Third ─────────────────────────────────────────────────────────────
  norwoodStage: {
    exceptional: "Hairline is fully intact and well-placed — no recession.",
    strong:      "Minimal recession at most. Hairline is in very good shape.",
    average:     "Some temple or hairline recession is present but not severe. This is when intervention is most effective.",
    below:       "Noticeable hairline recession affecting the upper third. Earlier treatment gives better outcomes.",
    low:         "Significant hairline recession substantially impacting the upper third. Treatment or styling adaptation is the priority.",
  },
  foreheadProportion: {
    exceptional: "Forehead height is well-proportioned relative to the rest of the face — strong facial third balance.",
    strong:      "Good forehead proportion. Height sits in a solid range for your facial thirds.",
    average:     "Moderate forehead proportion. Height is acceptable but not optimally balanced.",
    below:       "Forehead height sits outside ideal proportion for your facial thirds — either too tall or too compressed.",
    low:         "Significant forehead proportion imbalance is affecting how the facial thirds read overall.",
  },
  hairlineRecession: {
    exceptional: "No meaningful hairline recession — hairline shape is intact and well-defined.",
    strong:      "Very minor recession at most. Hairline is largely intact.",
    average:     "Moderate recession at the temples. Shape is shifting but still manageable.",
    below:       "Noticeable temporal recession is affecting the hairline shape significantly.",
    low:         "Extensive recession has significantly altered the hairline. Styling and treatment adaptation are the main paths forward.",
  },
  hairThinning: {
    exceptional: "No noticeable thinning — hair density is strong across the scalp.",
    strong:      "Minimal thinning. Hair density is largely maintained.",
    average:     "Some thinning present. Density is reduced but not dramatically so.",
    below:       "Noticeable thinning reducing scalp coverage. Minoxidil and DHT-blocking protocols have the most evidence at this stage.",
    low:         "Significant thinning across the scalp. Treatment and styling adaptation are the priority.",
  },
  hairlineDensity: {
    exceptional: "Dense hairline with full coverage at the frontal zone — a major upper-third positive.",
    strong:      "Good hairline density. Frontal coverage is solid.",
    average:     "Moderate hairline density. Coverage is adequate but not full.",
    below:       "Reduced density at the hairline is creating visible thinning at the front. Most treatable at this stage.",
    low:         "Very low hairline density — the frontal zone shows significant transparency. Highest-priority hair concern to address.",
  },
  foreheadSlope: {
    exceptional: "Your forehead slope is strong and well-angled — vertical to slightly reclined reads as structurally dominant.",
    strong:      "Good forehead slope contributing positively to the upper third's structure.",
    average:     "Moderate forehead slope. Neither strongly vertical nor excessively reclined.",
    below:       "Your forehead slope is either too flat or too reclined, reducing the upper third's structural read.",
    low:         "Significant slope issue — highly reclined or very flat — the main factor limiting the upper third.",
  },

  // ── Miscellaneous ───────────────────────────────────────────────────────────
  skin: {
    exceptional: "Excellent skin clarity, texture, and tone — a clear net positive in every scan metric.",
    strong:      "Good skin quality. Clarity and tone are working for you. Minor issues at most.",
    average:     "Average skin quality. Some texture or tone unevenness that a consistent routine addresses.",
    below:       "Noticeable skin issues — likely a mix of texture and tone concerns. Consistent AM/PM routine is the highest-ROI intervention.",
    low:         "Skin quality is a major limiting factor here. It's also one of the most addressable — routine consistency is the variable.",
  },
  harmony: {
    exceptional: "Exceptional feature harmony — every element is proportioned and positioned in a way that reinforces the whole.",
    strong:      "Strong harmony. Your features work well together with minimal tension between them.",
    average:     "Moderate harmony. Individual features are fine but the balance between them isn't fully cohesive.",
    below:       "Some disharmony between features is reducing overall aesthetic coherence. Partly addressable through styling.",
    low:         "Feature disharmony is significantly limiting the face's overall read. One of the harder structural metrics to move.",
  },
  symmetry: {
    exceptional: "Near-perfect symmetry — very rare, and it's having a meaningful positive effect on every metric it touches.",
    strong:      "High symmetry. Small asymmetries that don't register in any meaningful way.",
    average:     "Average symmetry. Some asymmetry is present and visible up close, but within a normal range.",
    below:       "Noticeable asymmetry affecting how the face reads in photos and straight-on.",
    low:         "Significant asymmetry is one of the main factors holding multiple metrics back. Mostly structural.",
  },
  neckWidth: {
    exceptional: "Strong neck width providing the structural base for the lower face and reading as powerful.",
    strong:      "Good neck width. The structural base for the face is solid.",
    average:     "Moderate neck width. Adequate, but not contributing significantly to the structural read.",
    below:       "Narrower neck is weakening the structural base. Trap and neck development are the direct levers here.",
    low:         "Very narrow neck is limiting the structural presence of the lower face and overall. Trap and neck training are the priority.",
  },
  bloat: {
    exceptional: "Very low bloat — face is reading as lean and defined with no meaningful water or fat retention.",
    strong:      "Good leanness in the face. Minimal bloat affecting the structural reads.",
    average:     "Some facial bloat present. Body fat percentage, sodium, and hydration are the variables to adjust.",
    below:       "Noticeable facial bloat is softening multiple structural reads. Body fat and dietary sodium are the two highest-leverage variables.",
    low:         "Significant facial bloat is masking structural features across nearly every category. Body composition change has the highest impact of anything on this list.",
  },
  boneMass: {
    exceptional: "Strong underlying bone structure — the structural foundation that every other metric builds on.",
    strong:      "Good bone structure. A solid foundation supporting the scores in structural categories.",
    average:     "Average bone structure. The structural foundation is adequate but not exceptional.",
    below:       "Below-average bone density and development is limiting the structural floor across multiple categories.",
    low:         "Weak bone structure is the foundational limiting factor. Downstream of genetics and early development — the hardest variable to change.",
  },
}

export function getMetricInsight(metricKey, score) {
  if (score == null || !INSIGHTS[metricKey]) return null
  const tier = TIERS.find(t => score >= t.min)?.key ?? 'low'
  return INSIGHTS[metricKey][tier] ?? null
}
