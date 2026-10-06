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

// Envelope of the detected upper-cheek surface points, including the outer
// face boundary. Interior mesh points must not fold the outline inward.
const cheekEnvelope = points => {
  if (!points?.length || !points.every(valid)) return null
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const half = list => {
    const hull = []
    for (const p of list) {
      while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), p) <= 0) hull.pop()
      hull.push(p)
    }
    return hull.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

export function frontFeatureAnchors(p) {
  const pt = p || {}
  const leftUpper = cheekEnvelope(pt.malarL)
  const rightUpper = cheekEnvelope(pt.malarR)
  // Preserve the requested stage order; missing landmarks are not invented or removed from the count.
  return [
    { id: 'chin', label: 'Chin Definition', point: pt.chin, regions: [] },
    { id: 'cheekbones', label: 'Cheekbone Prominence', point: midpoint(pt.malarL?.[0], pt.malarL?.[1]), focus: midpoint(pt.cheekL, pt.cheekR), regions: [leftUpper, rightUpper], exact: true },
    { id: 'jaw', label: 'Jaw Definition', point: pt.jawMidR, contour: pt.jawContour },
    { id: 'cheeks', label: 'Cheek Leanness & Ogee Curve', point: pt.buccalL?.[2], regions: [cheekEnvelope(pt.buccalL), cheekEnvelope(pt.buccalR)], exact: true },
    { id: 'submental', label: 'Submental Definition', point: pt.chin, contour: pt.chinContour },

  ]
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

// Decorative scan regions are registered to measured landmarks. Their shapes
// reproduce the reference's wedge and tapered-cheek overlays, not new scores.
export function referenceScanFeatures(points) {
  const features = frontFeatureAnchors(points)
  if (!points) return features
  const mix = (a, b, t) => valid(a) && valid(b) ? {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t} : null
  const wedge = side => {
    const outer=points[`eyeOuter${side}`], inner=points[`eyeInner${side}`]
    const cheek=points[`cheek${side}`], jaw=points[`jaw${side}`]
    return region([mix(outer,cheek,.42),mix(inner,points.chin,.08),mix(inner,points.chin,.17),mix(cheek,jaw,.25)])
  }
  const cheek = side => {
    const edge=points[`cheek${side}`], jaw=points[`jaw${side}`], mid=points[`jawMid${side}`]
    const nose=points.nose, mouth=points[`mouth${side}`]
    return region([mix(edge,nose,.05),mix(edge,nose,.30),mix(edge,mouth,.55),mix(mid,jaw,.12),mix(edge,jaw,.65)])
  }
  const wedges=[wedge('L'),wedge('R')], cheeks=[cheek('L'),cheek('R')]
  features[0]={...features[0],halo:true}
  features[1]={...features[1],regions:wedges.every(Boolean)?wedges:features[1].regions}
  features[2]={...features[2],contours:[points.mandibleL?.slice(3,8),points.mandibleR?.slice(3,8)],contour:null}
  features[3]={...features[3],regions:cheeks.every(Boolean)?cheeks:features[3].regions}
  return features
}
