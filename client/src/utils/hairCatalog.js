// Extensible HairMax catalog. Matching uses these explicit properties rather
// than asking a language model to invent a ranking from scratch.

const all = ['straight', 'wavy', 'curly', 'coily']
const densityAll = ['low', 'medium', 'high']

const THICKNESS_REQUIRED = new Set(['crew_cut', 'mid_taper_texture', 'curly_fringe', 'slick_back', 'quiff', 'pompadour', 'modern_mullet', 'flow'])

const style = (id, name, hairTypes, density, length, maintenance, visualEffects, barber, styling, growth = 'Ready now') => ({
  id, name, compatibleHairTypes: hairTypes, compatibleDensity: density, length,
  compatibleThickness: THICKNESS_REQUIRED.has(id) ? ['medium', 'thick'] : ['fine', 'medium', 'thick'],
  maintenance, visualEffects, barber, styling, growth,
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
  { id: 'straight', label: 'Straight', pattern: 'M2 12 L30 12' },
  { id: 'wavy', label: 'Wavy', pattern: 'M2 12 C8 2 14 22 20 12 C24 6 27 8 30 12' },
  { id: 'curly', label: 'Curly', pattern: 'M3 12 C3 3 13 3 13 12 C13 21 23 21 23 12 C23 5 29 5 30 10' },
  { id: 'coily', label: 'Coily', pattern: 'M3 12 C3 5 9 5 9 12 C9 19 15 19 15 12 C15 5 21 5 21 12 C21 19 27 19 27 12' },
]

export const DENSITIES = ['low', 'medium', 'high']
export const THICKNESSES = ['fine', 'medium', 'thick']
export const LENGTHS = ['short', 'medium', 'long', 'any']
export const MAINTENANCE = ['low', 'some', 'any']
