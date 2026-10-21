import catalog from '../data/hairCatalog.json' with { type: 'json' }

export const HAIR_CATALOG_VERSION = '2026-10-18-individual-portraits-v2'
export const HAIRSTYLE_CATALOG = catalog

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
