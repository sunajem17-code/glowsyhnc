// Processing labels are built only from landmarks detected in the user's photo.
// Coordinates are normalized to the source image, so they remain aligned when
// the photo is resized on screen. Hairline is intentionally absent: FaceMesh's
// upper-face boundary is not a measured hairline.
const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1

const midpoint = (a, b) => valid(a) && valid(b)
  ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  : null

// Weighted point between a and b (t=0 → a, t=1 → b). Used to place a synthetic
// "upper cheek" anchor below the eye without needing an unverified landmark
// index — eyeBottomL sits right on the lower eyelid rim, so a highlight
// anchored there alone still reads as touching the eye; blending 70% of the
// way toward the cheekbone point moves it clearly onto the cheek instead.
const lerp = (a, b, t) => valid(a) && valid(b)
  ? { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  : null

const available = entries => entries.filter(({ point }) => valid(point))
const region = points => points.every(valid) ? points : null

export function frontFeatureAnchors(p) {
  if (!p) return []
  // Synthetic "upper cheek" anchors, 70% of the way from just-under-the-eye
  // toward the cheekbone point — eyeBottomL/eyeBottomR alone sit right on
  // the lower eyelid rim, which still reads as touching the eye. Blending
  // toward cheekL/cheekR moves the anchor clearly onto the cheek without
  // guessing at an unverified landmark index.
  const upperCheekL = lerp(p.eyeBottomL, p.cheekL, 0.7)
  const upperCheekR = lerp(p.eyeBottomR, p.cheekR, 0.7)
  return available([
    { id: 'chin-definition', label: 'CHIN DEFINITION', point: p.chin, badgeX: 90, badgeY: 74,
      regions: [region([p.jawChinL, p.chin, p.jawChinR])] },
    // Temple → upper cheek → cheekbone point. Previously used the eye
    // CORNERS (eyeOuterL/eyeInnerL) as two of the four vertices, which put
    // those points directly on the eyelid — since the polygon connects its
    // vertices in order, that drew the highlight straight across the eyes.
    { id: 'cheekbone-prominence', label: 'CHEEKBONE PROMINENCE', point: p.cheekL, badgeX: 10, badgeY: 29,
      regions: [region([p.templeL, upperCheekL, p.cheekL]), region([p.templeR, upperCheekR, p.cheekR])] },
    { id: 'jaw-definition', label: 'JAW DEFINITION', point: p.jawR, badgeX: 90, badgeY: 52,
      contour: region([p.jawL, p.jawMidL, p.jawChinL, p.chin, p.jawChinR, p.jawMidR, p.jawR]) },
    // Extended down through jawChin (not just jawMid) so the highlighted
    // region actually spans the cheek-to-jaw transition the "ogee curve"
    // name refers to, instead of stopping mid-cheek. Starts from eyeBottomL
    // (below the eyelid) rather than eyeOuterL (the eye corner itself) for
    // the same reason as cheekbone-prominence above — the eye corner as a
    // polygon vertex drew the top edge straight across the eye.
    { id: 'cheek-leanness', label: 'CHEEK LEANNESS & OGEE CURVE', point: p.cheekL, badgeX: 10, badgeY: 61,
      regions: [region([p.eyeBottomL, p.cheekL, p.jawChinL, p.jawMidL]), region([p.eyeBottomR, p.cheekR, p.jawChinR, p.jawMidR])] },
    { id: 'submental-definition', label: 'SUBMENTAL DEFINITION', point: p.chin, badgeX: 90, badgeY: 28,
      contour: region([p.jawChinL, p.chin, p.jawChinR]) },
  ])
}

export function profileFeatureAnchors(p) {
  if (!p) return []
  return available([
    { id: 'profile-brow', label: 'BROW', point: p.brow, badgeX: 10, badgeY: 22 },
    { id: 'profile-eye', label: 'EYE', point: p.eye, badgeX: 90, badgeY: 31 },
    { id: 'profile-nose-bridge', label: 'NOSE BRIDGE', point: p.noseBridge, badgeX: 10, badgeY: 42 },
    { id: 'profile-nose-tip', label: 'NOSE TIP', point: p.noseTip, badgeX: 90, badgeY: 48 },
    { id: 'profile-lips', label: 'LIPS', point: p.lips, badgeX: 10, badgeY: 61 },
    { id: 'profile-chin', label: 'CHIN', point: p.chin, badgeX: 90, badgeY: 72 },
    { id: 'profile-jaw', label: 'JAWLINE', point: p.jaw, badgeX: 10, badgeY: 79 },
  ])
}

export function profilePointsFromVision(landmarks) {
  if (!landmarks) return null
  const point = name => Array.isArray(landmarks[name]) && landmarks[name].length === 2
    ? { x: landmarks[name][0], y: landmarks[name][1] }
    : null
  return {
    brow: point('brow'),
    eye: point('eye'),
    noseBridge: point('noseBridge'),
    noseTip: point('nose'),
    lips: point('lips'),
    chin: point('chin'),
    jaw: point('jaw'),
  }
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
