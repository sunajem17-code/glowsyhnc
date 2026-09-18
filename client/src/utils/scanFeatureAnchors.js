// Processing labels are built only from landmarks detected in the user's photo.
// Coordinates are normalized to the source image, so they remain aligned when
// the photo is resized on screen. Hairline is intentionally absent: FaceMesh's
// upper-face boundary is not a measured hairline.
const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1

const midpoint = (a, b) => valid(a) && valid(b)
  ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  : null

const available = entries => entries.filter(({ point }) => valid(point))
const region = points => points.every(valid) ? points : null

export function frontFeatureAnchors(p) {
  if (!p) return []
  return available([
    { id: 'chin', label: 'CHIN', point: p.chin, side: 'right', badgeY: 79, radius: 48,
      regions: [region([p.jawChinL, p.chin, p.jawChinR])] },
    { id: 'eyes', label: 'EYE AREA', point: midpoint(p.eyeOuterL, p.eyeInnerL), secondaryPoint: midpoint(p.eyeOuterR, p.eyeInnerR), side: 'left', badgeY: 29, radius: 45,
      regions: [region([p.eyeOuterL, p.eyeInnerL, midpoint(p.eyeInnerL, p.cheekL), midpoint(p.eyeOuterL, p.cheekL)]),
        region([p.eyeInnerR, p.eyeOuterR, midpoint(p.eyeOuterR, p.cheekR), midpoint(p.eyeInnerR, p.cheekR)])] },
    { id: 'jaw', label: 'JAWLINE', point: p.jawR, secondaryPoint: p.jawL, side: 'right', badgeY: 62, radius: 56,
      contour: region([p.jawL, p.jawMidL, p.jawChinL, p.chin, p.jawChinR, p.jawMidR, p.jawR]) },
    { id: 'cheeks', label: 'CHEEKBONES', point: p.cheekL, secondaryPoint: p.cheekR, side: 'left', badgeY: 51, radius: 52,
      regions: [region([p.eyeOuterL, p.cheekL, p.jawMidL]), region([p.eyeOuterR, p.cheekR, p.jawMidR])] },
    { id: 'structure', label: 'FACIAL STRUCTURE', point: p.nose, side: 'right', badgeY: 24, radius: 58,
      contour: region([p.forehead, p.nose, p.chin]) },
  ])
}

export function profileFeatureAnchors(p) {
  if (!p) return []
  return available([
    { id: 'profile-brow', label: 'BROW', point: p.brow, side: 'left', badgeY: 24, radius: 42 },
    { id: 'profile-nose', label: 'NOSE TIP', point: p.noseTip, side: 'right', badgeY: 42, radius: 46 },
    { id: 'profile-chin', label: 'CHIN', point: p.chin, side: 'right', badgeY: 72, radius: 50 },
  ])
}

export function profilePointsFromVision(landmarks) {
  if (!landmarks) return null
  const point = name => Array.isArray(landmarks[name]) && landmarks[name].length === 2
    ? { x: landmarks[name][0], y: landmarks[name][1] }
    : null
  return { brow: point('brow'), noseTip: point('nose'), chin: point('chin') }
}

export function profilePointsFromMesh(lm) {
  if (!lm?.[1]) return null
  const point = i => lm[i] && { x: lm[i].x, y: lm[i].y }
  const nose = point(1)
  const closestToNose = (a, b) => {
    if (!valid(nose)) return null
    if (!valid(a)) return b
    if (!valid(b)) return a
    return Math.abs(a.x - nose.x) < Math.abs(b.x - nose.x) ? a : b
  }
  return {
    forehead: point(10),
    brow: closestToNose(point(105), point(334)),
    eye: closestToNose(point(33), point(263)),
    noseBridge: point(168),
    noseTip: nose,
    lips: midpoint(point(13), point(14)),
    chin: point(152),
    jaw: closestToNose(point(172), point(397)),
  }
}
