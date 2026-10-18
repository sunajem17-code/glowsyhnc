// Extensible HairMax catalog. Matching uses these explicit properties rather
// than asking a language model to invent a ranking from scratch.

const all = ['straight', 'wavy', 'curly', 'coily']
const densityAll = ['low', 'medium', 'high']

export const HAIR_CATALOG_VERSION = '2026-09-20-static-models-v1'
export const HAIR_CATALOG_SHEET = '/hairmax/catalog-models.png'

// Photography is supplied as one optimized catalog sheet. Each catalog entry
// points at its pre-generated model crop; HairMax never generates images while
// the user is browsing or swiping.
const MODEL_CROPS = {
  textured_crop: [1, 0], french_crop: [2, 0], messy_fringe: [3, 0], curly_fringe: [4, 0],
  low_taper_fringe: [0, 0], curly_taper: [5, 0], mid_taper_texture: [0, 1],
  curtains: [2, 1], flow: [3, 1], side_part: [4, 1], quiff: [5, 1],
  crew_cut: [0, 2], buzz_cut: [1, 2], caesar: [2, 2], slick_back: [3, 2],
  modern_mullet: [4, 2], pompadour: [5, 2],
}

const modelCrop = id => {
  const [column, row] = MODEL_CROPS[id]
  return {
    sheet: HAIR_CATALOG_SHEET,
    x: [11, 229, 446, 662, 879, 1096][column],
    y: [126, 475, 821][row],
    width: 205,
    height: 270,
    sheetWidth: 1312,
    sheetHeight: 1199,
  }
}

const THICKNESS_REQUIRED = new Set(['crew_cut', 'mid_taper_texture', 'curly_fringe', 'slick_back', 'quiff', 'pompadour', 'modern_mullet', 'flow'])

const style = (id, name, hairTypes, density, length, maintenance, visualEffects, barber, styling, growth = 'Ready now') => ({
  id, name, compatibleHairTypes: hairTypes, compatibleDensity: density, length,
  compatibleThickness: THICKNESS_REQUIRED.has(id) ? ['medium', 'thick'] : ['fine', 'medium', 'thick'],
  maintenance, visualEffects, barber, styling, growth, image: modelCrop(id),
})

export const HAIRSTYLE_CATALOG = [
  style('textured_crop', 'Textured Crop', ['straight', 'wavy'], densityAll, 'short', 'low',
    { topHeight: 'low', foreheadExposure: 'low', sideWidth: 'low', jawEmphasis: 'medium' },
    { top: 'Keep 5–7 cm with point-cut texture.', sides: 'Short and softly blended.', back: 'Follow the side blend.', taper: 'Low taper; keep the hairline natural.' },
    'Work a small amount of matte paste through dry hair.'),
  style('french_crop', 'French Crop', ['straight', 'wavy'], densityAll, 'short', 'low',
    { topHeight: 'low', foreheadExposure: 'low', sideWidth: 'low', jawEmphasis: 'medium' },
    { top: 'Keep 4–6 cm and direct forward.', sides: 'Short, with a clean blend.', back: 'Match the sides.', taper: 'Low or mid taper with a soft fringe.' },
    'Use matte paste and press the fringe forward.'),
  style('caesar', 'Modern Caesar', ['straight', 'wavy', 'curly'], densityAll, 'short', 'low',
    { topHeight: 'low', foreheadExposure: 'low', sideWidth: 'medium', jawEmphasis: 'low' },
    { top: 'Keep an even short layer with a soft fringe.', sides: 'Scissor or guard cut without extreme contrast.', back: 'Keep tidy and natural.', taper: 'Subtle taper at the edges.' },
    'Comb forward with light cream.'),
  style('crew_cut', 'Crew Cut', ['straight', 'wavy'], ['medium', 'high'], 'short', 'low',
    { topHeight: 'medium', foreheadExposure: 'high', sideWidth: 'low', jawEmphasis: 'high' },
    { top: 'Short, graduating slightly longer toward the front.', sides: 'Taper close.', back: 'Taper close.', taper: 'Classic low taper.' },
    'Use a touch of matte paste at the front.'),
  style('buzz_cut', 'Buzz Cut', all, densityAll, 'short', 'low',
    { topHeight: 'none', foreheadExposure: 'high', sideWidth: 'low', jawEmphasis: 'high' },
    { top: 'Even guard length.', sides: 'One guard shorter if desired.', back: 'Match the sides.', taper: 'Natural taper at neckline and sideburns.' },
    'No daily styling required.'),
  style('low_taper_fringe', 'Low Taper + Fringe', all, densityAll, 'medium', 'medium',
    { topHeight: 'low', foreheadExposure: 'low', sideWidth: 'medium', jawEmphasis: 'medium' },
    { top: 'Keep enough length for a loose forward fringe.', sides: 'Preserve weight above a low taper.', back: 'Softly blended.', taper: 'Low taper around temples and neckline.' },
    'Use curl cream or texture cream and let the fringe fall naturally.', 'May need 6–9 cm on top'),
  style('mid_taper_texture', 'Mid Taper + Texture', ['straight', 'wavy', 'curly'], ['medium', 'high'], 'medium', 'medium',
    { topHeight: 'medium', foreheadExposure: 'medium', sideWidth: 'low', jawEmphasis: 'high' },
    { top: 'Keep 7–9 cm with visible texture.', sides: 'Blend into a mid taper.', back: 'Continue the taper cleanly.', taper: 'Mid taper without a hard disconnect.' },
    'Dry into shape and finish with matte clay.', 'May need 7–9 cm on top'),
  style('curly_taper', 'Curly Taper', ['curly', 'coily'], ['medium', 'high'], 'medium', 'low',
    { topHeight: 'medium', foreheadExposure: 'medium', sideWidth: 'medium', jawEmphasis: 'medium' },
    { top: 'Keep the natural curl pattern and shape only the outline.', sides: 'Retain controlled volume.', back: 'Natural curl shape.', taper: 'Low taper at temples and neckline.' },
    'Apply leave-in conditioner and curl cream; air dry.'),
  style('curly_fringe', 'Curly Fringe', ['curly', 'coily'], ['medium', 'high'], 'medium', 'medium',
    { topHeight: 'low', foreheadExposure: 'low', sideWidth: 'medium', jawEmphasis: 'low' },
    { top: 'Keep curls long enough to sit across the forehead.', sides: 'Scissor blend with moderate volume.', back: 'Soft natural outline.', taper: 'Optional low taper.' },
    'Define curls with cream and avoid brushing dry.', 'May need 8–12 cm on top'),
  style('curtains', 'Curtains', ['straight', 'wavy'], ['medium', 'high'], 'medium', 'medium',
    { topHeight: 'low', foreheadExposure: 'medium', sideWidth: 'high', jawEmphasis: 'low' },
    { top: 'Keep 10–14 cm with a center split.', sides: 'Scissor cut and connected.', back: 'Keep soft length.', taper: 'Only a subtle neckline taper.' },
    'Use light cream and dry away from the center part.', 'Needs 10–14 cm on top'),
  style('side_part', 'Soft Side Part', ['straight', 'wavy'], densityAll, 'medium', 'medium',
    { topHeight: 'medium', foreheadExposure: 'medium', sideWidth: 'medium', jawEmphasis: 'medium' },
    { top: 'Keep 7–10 cm and part naturally.', sides: 'Scissor blend or low taper.', back: 'Neat, connected finish.', taper: 'Low taper; no forced hard part.' },
    'Use a flexible cream and comb loosely.'),
  style('messy_fringe', 'Messy Fringe', ['straight', 'wavy', 'curly'], densityAll, 'medium', 'low',
    { topHeight: 'low', foreheadExposure: 'low', sideWidth: 'medium', jawEmphasis: 'low' },
    { top: 'Keep 7–10 cm with irregular point-cut texture.', sides: 'Leave some weight and blend softly.', back: 'Natural, tidy finish.', taper: 'Low taper only.' },
    'Use texture spray and arrange with fingers.'),
  style('slick_back', 'Slick Back', ['straight', 'wavy'], ['medium', 'high'], 'long', 'high',
    { topHeight: 'medium', foreheadExposure: 'high', sideWidth: 'low', jawEmphasis: 'high' },
    { top: 'Keep at least 12 cm with weight.', sides: 'Keep connected and controlled.', back: 'Enough length to flow backward.', taper: 'Subtle taper; avoid a harsh disconnect.' },
    'Blow dry backward and finish with cream or pomade.', 'Needs 12+ cm on top'),
  style('quiff', 'Modern Quiff', ['straight', 'wavy'], ['medium', 'high'], 'medium', 'high',
    { topHeight: 'high', foreheadExposure: 'high', sideWidth: 'low', jawEmphasis: 'high' },
    { top: 'Keep 9–12 cm, longer at the front.', sides: 'Tapered and close.', back: 'Clean blend.', taper: 'Low or mid taper.' },
    'Blow dry upward and back; finish with matte clay.', 'Needs 9–12 cm at the front'),
  style('pompadour', 'Soft Pompadour', ['straight', 'wavy'], ['medium', 'high'], 'long', 'high',
    { topHeight: 'high', foreheadExposure: 'high', sideWidth: 'medium', jawEmphasis: 'high' },
    { top: 'Keep 12–15 cm at the front with graduated length.', sides: 'Scissor blend with controlled weight.', back: 'Connected and shaped.', taper: 'Low taper only.' },
    'Blow dry for volume and finish with pliable pomade.', 'Needs 12–15 cm at the front'),
  style('modern_mullet', 'Modern Mullet', ['straight', 'wavy', 'curly'], ['medium', 'high'], 'long', 'medium',
    { topHeight: 'medium', foreheadExposure: 'medium', sideWidth: 'low', jawEmphasis: 'medium' },
    { top: 'Textured, moderate length.', sides: 'Taper around the ears.', back: 'Retain deliberate length with layers.', taper: 'Temple taper, connected to the back.' },
    'Use texture cream and keep the finish loose.', 'Needs length through the back'),
  style('flow', 'Layered Flow', ['straight', 'wavy', 'curly'], ['medium', 'high'], 'long', 'medium',
    { topHeight: 'low', foreheadExposure: 'medium', sideWidth: 'high', jawEmphasis: 'low' },
    { top: 'Long layers that move away from the face.', sides: 'Scissor cut and connected.', back: 'Layered length around the collar.', taper: 'No fade; tidy edges only.' },
    'Use light cream and air dry or diffuse.', 'Needs medium-to-long growth'),
]

export const HAIR_TYPES = [
  { id: 'straight', label: 'Type 1 Hair', description: 'Straight strands with little to no curl.', pattern: 'M16 3 C15.5 16 16.5 32 16 45' },
  { id: 'wavy', label: 'Type 2 Hair', description: 'Loose waves with a soft S shape.', pattern: 'M16 3 C7 8 7 14 16 19 C25 24 25 30 16 35 C7 40 7 44 16 45' },
  { id: 'curly', label: 'Type 3 Hair', description: 'Defined curls with a springy shape.', pattern: 'M16 3 C3 3 3 13 16 13 C29 13 29 23 16 23 C3 23 3 33 16 33 C29 33 29 43 16 45' },
  { id: 'coily', label: 'Type 4 Hair', description: 'Tight coils with a compact pattern.', pattern: 'M16 3 C23 3 23 8 16 8 C9 8 9 13 16 13 C23 13 23 18 16 18 C9 18 9 23 16 23 C23 23 23 28 16 28 C9 28 9 33 16 33 C23 33 23 38 16 38 C9 38 9 43 16 45' },
]

export const DENSITIES = ['low', 'medium', 'high']
export const THICKNESSES = ['fine', 'medium', 'thick']
export const LENGTHS = ['short', 'medium', 'long', 'any']
export const MAINTENANCE = ['low', 'some', 'any']
