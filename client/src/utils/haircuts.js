// ─── HairMaxx Intelligence Database ──────────────────────────────────────────

export const FACE_SHAPES = [
  {
    id: 'oval',
    label: 'Oval',
    description: 'Balanced proportions. Forehead slightly wider than jaw, face longer than wide.',
    svgPath: 'M50 10 C75 10 90 30 90 55 C90 80 75 95 50 95 C25 95 10 80 10 55 C10 30 25 10 50 10Z',
  },
  {
    id: 'round',
    label: 'Round',
    description: 'Face width and length nearly equal. Soft jaw, full cheeks, no sharp angles.',
    svgPath: 'M50 10 C80 10 90 30 90 50 C90 70 80 90 50 90 C20 90 10 70 10 50 C10 30 20 10 50 10Z',
  },
  {
    id: 'square',
    label: 'Square',
    description: 'Strong, angular jaw. Forehead and jawline roughly the same width.',
    svgPath: 'M20 10 L80 10 L85 30 L85 75 L80 90 L20 90 L15 75 L15 30Z',
  },
  {
    id: 'heart',
    label: 'Heart',
    description: 'Wide forehead, high cheekbones, narrow jaw. Face tapers to a point at the chin.',
    svgPath: 'M15 15 L85 15 L88 35 L75 65 L50 95 L25 65 L12 35Z',
  },
  {
    id: 'diamond',
    label: 'Diamond',
    description: 'Narrow forehead, wide cheekbones, narrow jaw. Widest point at the cheeks.',
    svgPath: 'M50 8 L80 35 L85 55 L70 80 L50 95 L30 80 L15 55 L20 35Z',
  },
  {
    id: 'oblong',
    label: 'Oblong',
    description: 'Face is notably longer than wide. Forehead, cheeks, and jaw similar width.',
    svgPath: 'M25 8 L75 8 L82 30 L82 70 L75 92 L25 92 L18 70 L18 30Z',
  },
]

export const HAIR_DENSITIES = [
  { id: 'thin', label: 'Thin', sub: 'Fine, low volume' },
  { id: 'medium', label: 'Medium', sub: 'Average density' },
  { id: 'thick', label: 'Thick', sub: 'Dense, high volume' },
]

export const HAIRLINES = [
  { id: 'straight', label: 'Straight', sub: 'Even, clean line' },
  { id: 'receding', label: 'Receding', sub: 'Temple recession' },
  { id: 'widows_peak', label: "Widow's Peak", sub: 'V-shaped point' },
  { id: 'high', label: 'High', sub: 'Large forehead' },
]

// ─── Haircut Database ─────────────────────────────────────────────────────────

const CUTS = {
  textured_crop: {
    id: 'textured_crop',
    name: 'Textured Crop',
    vibe: 'Modern. Low effort. Always clean.',
    maintenance: 'low',
    maintenanceFreq: 'Every 3–4 weeks',
    products: ['Matte clay', 'Sea salt spray'],
    barberScript: {
      say: `"Low skin fade on the sides and back — fade it from skin at the bottom up to about a 2 guard by the time you reach the parietal ridge. Leave the top at roughly 2 to 2.5 inches. Crop the fringe horizontally, then texturize the top with scissors, point cutting — I want movement, not bulk. Keep the hairline natural."`,
      sideGuard: 'Skin fade → 1 → 2',
      fadeType: 'Low skin fade',
      topLength: '2 to 2.5 inches',
      blendStyle: 'Hard part optional — clean blend otherwise',
      styling: 'Apply matte clay to damp hair, push forward, rough dry. No shine.',
    },
  },
  taper_fade_quiff: {
    id: 'taper_fade_quiff',
    name: 'Taper Fade Quiff',
    vibe: 'Sharp. Intentional. Elevated.',
    maintenance: 'medium',
    maintenanceFreq: 'Every 2–3 weeks',
    products: ['Medium-hold pomade', 'Blow dryer'],
    barberScript: {
      say: `"Mid taper fade on the sides — start with a 1 at the bottom and blend into a 3 by the temples. Leave the top 3 to 3.5 inches. I want a quiff — blow dry the top back and up with volume at the roots. Taper the sides clean, no hard line unless I ask. Natural hairline."`,
      sideGuard: '1 → 2 → 3',
      fadeType: 'Mid taper',
      topLength: '3 to 3.5 inches',
      blendStyle: 'Smooth mid taper',
      styling: 'Blow dry at the roots for volume, apply pomade while warm, shape back and up.',
    },
  },
  slick_back_undercut: {
    id: 'slick_back_undercut',
    name: 'Slick Back Undercut',
    vibe: 'Deliberate. Clean contrast. Works in any room.',
    maintenance: 'medium',
    maintenanceFreq: 'Every 3–4 weeks',
    products: ['Strong-hold pomade', 'Fine-tooth comb'],
    barberScript: {
      say: `"Disconnected undercut — I want the sides cut short with a 1.5 guard, no fade, clean disconnect at the parietal ridge. Leave the top long, at least 4 inches. No thinning on top, I want full weight. Hairline natural."`,
      sideGuard: '1.5 guard, no fade',
      fadeType: 'Disconnected (no fade)',
      topLength: '4+ inches',
      blendStyle: 'Hard disconnect, no blend',
      styling: 'Apply pomade to dry hair, comb straight back. Use high-shine for formal, matte for casual.',
    },
  },
  classic_taper: {
    id: 'classic_taper',
    name: 'Classic Taper',
    vibe: 'Timeless. Professional. Understated.',
    maintenance: 'medium',
    maintenanceFreq: 'Every 3 weeks',
    products: ['Medium pomade or cream', 'Side comb'],
    barberScript: {
      say: `"Classic taper — 1.5 guard at the bottom, taper up to a 3 or 4 by the crown. Side part on the left, comb the top over. Top length about 2.5 inches. Scissors only on top, point cut the ends. Clean neckline, natural sideburns."`,
      sideGuard: '1.5 → 3',
      fadeType: 'Low taper',
      topLength: '2.5 inches with side part',
      blendStyle: 'Gradual taper, no skin',
      styling: 'Comb side part, apply medium pomade. Clean and deliberate.',
    },
  },
  buzz_cut: {
    id: 'buzz_cut',
    name: 'Buzz Cut',
    vibe: 'Stripped back. Zero maintenance. Needs a strong jaw.',
    maintenance: 'low',
    maintenanceFreq: 'Every 1–2 weeks',
    products: ['None, or light moisturizer'],
    barberScript: {
      say: `"All-over 3 guard, taper the sides and back down to a 1.5 at the bottom. Blend the sides into the top. Tight, clean neckline — squared, not rounded."`,
      sideGuard: '1.5 → 3',
      fadeType: 'Taper',
      topLength: 'Guard 3 (3/8 inch)',
      blendStyle: 'Gradual taper',
      styling: 'None required.',
    },
  },
  mid_fade_textured: {
    id: 'mid_fade_textured',
    name: 'Mid Fade + Textured Top',
    vibe: 'Clean lines. Street-level edge.',
    maintenance: 'medium',
    maintenanceFreq: 'Every 2–3 weeks',
    products: ['Clay wax', 'Blow dryer optional'],
    barberScript: {
      say: `"Mid fade — skin at the bottom, blend up through a 1, 1.5, to a 2.5 at the temples. Leave the top about 3 inches. Texturize the top with scissors, point cutting — loose movement, not stiff. No hard part, natural fade into the top."`,
      sideGuard: 'Skin → 1 → 2.5',
      fadeType: 'Mid skin fade',
      topLength: '3 inches',
      blendStyle: 'Mid fade, no disconnect',
      styling: 'Work clay through slightly damp hair, blow dry into shape, leave rough.',
    },
  },
  french_crop: {
    id: 'french_crop',
    name: 'French Crop',
    vibe: 'European. Clean. Minimal.',
    maintenance: 'low',
    maintenanceFreq: 'Every 3–4 weeks',
    products: ['Matte paste'],
    barberScript: {
      say: `"High skin fade — tight on the sides, skin from the bottom blending into a 2 by the parietal. Leave the top 1.5 to 2 inches. Straight fringe, cut horizontally about half an inch above the eyebrows. No volume on top — flat, textured fringe."`,
      sideGuard: 'Skin → 1 → 2',
      fadeType: 'High skin fade',
      topLength: '1.5 to 2 inches, flat fringe',
      blendStyle: 'High tight fade',
      styling: 'Press flat with matte paste. Fringe forward. No blowdry volume.',
    },
  },
  side_part: {
    id: 'side_part',
    name: 'Side Part',
    vibe: 'Sharp. Controlled. Reads confidence.',
    maintenance: 'medium',
    maintenanceFreq: 'Every 3 weeks',
    products: ['Medium pomade or cream'],
    barberScript: {
      say: `"Low taper on the sides — 1 guard at the bottom fading to a 3. Hard part on the left side, razor sharp. Leave the top about 3 inches. Comb it clean over the part. No texture, controlled finish."`,
      sideGuard: '1 → 3',
      fadeType: 'Low taper + hard part',
      topLength: '3 inches combed over',
      blendStyle: 'Low taper with razor hard part',
      styling: 'Fine comb, medium pomade. Every strand intentional.',
    },
  },
  curtains: {
    id: 'curtains',
    name: 'Curtains / Middle Part',
    vibe: 'Current. Relaxed tension. Works with natural texture.',
    maintenance: 'medium',
    maintenanceFreq: 'Every 4–5 weeks',
    products: ['Light cream or sea salt spray'],
    barberScript: {
      say: `"Low taper on the sides — 1.5 at the bottom up to a 3, nothing above the temples. Leave the top long, 3.5 to 4 inches. I want a middle part — the top needs to fall naturally on both sides. Trim the ends to clean it up, no layers. Hairline natural."`,
      sideGuard: '1.5 → 3',
      fadeType: 'Low taper, conservative',
      topLength: '3.5 to 4 inches, center parted',
      blendStyle: 'Light taper, no skin',
      styling: 'Apply cream to damp hair, let air dry, middle part. Natural movement.',
    },
  },
  high_top_fade: {
    id: 'high_top_fade',
    name: 'High Fade + Volume Top',
    vibe: 'Adds height. Strong vertical line.',
    maintenance: 'medium',
    maintenanceFreq: 'Every 2 weeks',
    products: ['Strong pomade or mousse'],
    barberScript: {
      say: `"High fade — skin at the bottom fading up clean, the fade line should sit high, about an inch below the crown. Leave the top at least 3 inches. I want volume — blow dry it up. Natural hairline."`,
      sideGuard: 'Skin → 1 → 2',
      fadeType: 'High skin fade',
      topLength: '3+ inches with height',
      blendStyle: 'High tight fade',
      styling: 'Blow dry upward from roots, apply strong hold product for vertical volume.',
    },
  },
}

// ─── Face Shape → Recommendations ────────────────────────────────────────────

export const FACE_PROFILES = {
  oval: {
    summary: 'Oval is the benchmark face shape. Most cuts work. The goal is to maintain balance without adding unnecessary width or length.',
    avoid: {
      cuts: ['Very long top styles', 'Extremely wide side volume'],
      reason: 'Oval faces are already balanced. Extreme proportions in any direction disrupt that.',
    },
    recommendations: [
      {
        ...CUTS.textured_crop,
        why: 'The proportions of a textured crop mirror the natural balance of an oval face. Clean, no-nonsense.',
        matchScore: 98,
      },
      {
        ...CUTS.slick_back_undercut,
        why: 'An oval face can carry the strong contrast of a disconnected undercut without it looking severe.',
        matchScore: 94,
      },
      {
        ...CUTS.taper_fade_quiff,
        why: 'The quiff adds intentional height without disrupting the natural symmetry.',
        matchScore: 91,
      },
      {
        ...CUTS.classic_taper,
        why: 'The classic taper is built for oval faces. Clean proportions, no excess.',
        matchScore: 88,
      },
    ],
  },
  round: {
    summary: 'Round faces need cuts that add vertical length and reduce perceived width. Height on top, tight on the sides.',
    avoid: {
      cuts: ['Buzz cuts', 'Short all-over crops', 'Center parts', 'Wide side volume'],
      reason: 'These styles emphasize the circular shape of the face, making it appear wider and shorter.',
    },
    recommendations: [
      {
        ...CUTS.high_top_fade,
        why: 'The high fade removes all width from the sides while the volume on top creates a vertical line that lengthens the face.',
        matchScore: 97,
      },
      {
        ...CUTS.taper_fade_quiff,
        why: 'The quiff pushes the eye upward, elongating the face. The mid fade keeps the sides tight.',
        matchScore: 94,
      },
      {
        ...CUTS.mid_fade_textured,
        why: 'Tight sides create contrast. The slightly longer top adds length to the face silhouette.',
        matchScore: 89,
      },
      {
        ...CUTS.slick_back_undercut,
        why: 'Slicking the hair back creates a longer face profile. The disconnected undercut removes side width entirely.',
        matchScore: 85,
      },
    ],
  },
  square: {
    summary: 'Square faces have strong jawlines. The goal is to soften the angles slightly, not fight them. Textured and layered styles work well.',
    avoid: {
      cuts: ['Box fades', 'Flat tops', 'Blunt hard cuts at the temples', 'Very tight buzz cuts'],
      reason: 'These cuts mirror and amplify the geometric shape of the face, making the jaw appear even more pronounced and angular.',
    },
    recommendations: [
      {
        ...CUTS.textured_crop,
        why: 'Texture breaks up the hard lines of a square face. The softness on top contrasts well with the strong jaw beneath.',
        matchScore: 96,
      },
      {
        ...CUTS.curtains,
        why: 'The natural flow of curtains softens the angular jaw. Medium length prevents the face from looking too boxy.',
        matchScore: 93,
      },
      {
        ...CUTS.french_crop,
        why: 'The horizontal fringe draws attention up and away from the jaw. Keeps it modern and clean.',
        matchScore: 90,
      },
      {
        ...CUTS.classic_taper,
        why: 'A controlled taper rounds off the corners of a square face without removing its natural strength.',
        matchScore: 86,
      },
    ],
  },
  heart: {
    summary: 'Heart faces have a wide forehead and narrow jaw. The goal is to reduce upper visual weight and add width at the lower half.',
    avoid: {
      cuts: ['Pompadours', 'Quiffs with high volume', 'Slicked back styles', 'Hard parts on the widest point of the forehead'],
      reason: 'These styles add visual weight to the top of the face, where heart shapes are already widest.',
    },
    recommendations: [
      {
        ...CUTS.side_part,
        why: 'A side part redirects attention and breaks up the forehead width. The tapered sides keep the lower face visible.',
        matchScore: 96,
      },
      {
        ...CUTS.textured_crop,
        why: 'The fringe naturally covers part of the forehead, reducing its visual dominance.',
        matchScore: 93,
      },
      {
        ...CUTS.curtains,
        why: 'Curtains with a center part split the forehead into two smaller sections, balancing the face.',
        matchScore: 91,
      },
      {
        ...CUTS.mid_fade_textured,
        why: 'The fade keeps the sides clean. Textured top with forward movement draws attention to the center, not the forehead edges.',
        matchScore: 87,
      },
    ],
  },
  diamond: {
    summary: 'Diamond faces have narrow foreheads, wide cheekbones, and narrow jaws. The goal is to add width at the forehead and jaw, reduce cheekbone emphasis.',
    avoid: {
      cuts: ['High fades that expose temples', 'Mohawks', 'Styles that add width at the cheekbones'],
      reason: 'These cuts further narrow the forehead and exaggerate the widest point of the face at the cheekbones.',
    },
    recommendations: [
      {
        ...CUTS.side_part,
        why: 'The side part adds visual width to the forehead — the narrowest point of a diamond face. This creates better overall proportion.',
        matchScore: 97,
      },
      {
        ...CUTS.classic_taper,
        why: 'The controlled volume on top adds forehead presence without exposing the temples.',
        matchScore: 93,
      },
      {
        ...CUTS.french_crop,
        why: 'A horizontal fringe widens the forehead visually and draws attention upward, away from the cheekbones.',
        matchScore: 90,
      },
      {
        ...CUTS.curtains,
        why: 'Long curtains frame the face from forehead to jaw, balancing the prominent cheekbones.',
        matchScore: 87,
      },
    ],
  },
  oblong: {
    summary: 'Oblong faces are longer than wide. The goal is to add width at the sides and avoid styles that add height or lengthen the face further.',
    avoid: {
      cuts: ['Pompadours', 'Quiffs', 'Long top styles that add height', 'Middle parts with flat sides'],
      reason: 'Height adds to the perceived length of the face. These cuts make oblong faces appear longer.',
    },
    recommendations: [
      {
        ...CUTS.textured_crop,
        why: 'The short, flat top does not add length. Side texture can add width. Clean and proportionate.',
        matchScore: 96,
      },
      {
        ...CUTS.french_crop,
        why: 'The horizontal fringe creates a visual width line that breaks up the length of the face.',
        matchScore: 94,
      },
      {
        ...CUTS.curtains,
        why: 'Curtains that fall out to the sides add visual width. The length sits horizontally, not vertically.',
        matchScore: 91,
      },
      {
        ...CUTS.mid_fade_textured,
        why: 'Some side texture remains, adding width. The moderate top length does not exaggerate face length.',
        matchScore: 87,
      },
    ],
  },
}

// ─── Modifier Rules ───────────────────────────────────────────────────────────

export function getModifiedRecommendations(faceShape, hairline, density) {
  const profile = FACE_PROFILES[faceShape]
  if (!profile) return []

  let cuts = [...profile.recommendations]

  // Receding hairline adjustments
  if (hairline === 'receding') {
    cuts = cuts.map(c => ({
      ...c,
      hairlineNote: c.id === 'slick_back_undercut' || c.id === 'side_part'
        ? 'Note: A receding hairline makes this cut less effective — slicked-back styles expose the recession.'
        : c.id === 'buzz_cut'
        ? 'Note: A buzz cut is a strong choice with a receding hairline — it removes the contrast.'
        : null,
    }))
  }

  // Thin hair adjustments
  if (density === 'thin') {
    cuts = cuts.map(c => ({
      ...c,
      densityNote: c.id === 'taper_fade_quiff' || c.id === 'high_top_fade'
        ? 'Note: Thin hair will not hold much volume in this style. A sea salt spray or volumizing mousse is required.'
        : null,
    }))
  }

  // Thick hair adjustments
  if (density === 'thick') {
    cuts = cuts.map(c => ({
      ...c,
      densityNote: c.id === 'textured_crop' || c.id === 'french_crop'
        ? 'Note: Thick hair will need thinning scissors on the top to prevent bulk. Tell your barber.'
        : null,
    }))
  }

  return cuts
}

export const MAINTENANCE_COLORS = {
  low: '#4CAF72',
  medium: '#C9A84C',
  high: '#E07A5F',
}

export const MAINTENANCE_LABELS = {
  low: 'Low maintenance',
  medium: 'Medium maintenance',
  high: 'High maintenance',
}
