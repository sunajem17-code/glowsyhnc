// Movie timestamps, measured in presentation order. The recording starts mid-sweep.
export const SCAN_STARTS = [1435, 3636.667, 6138.333, 8640, 11141.667, 13630, 15830, 18030]
export const COMPILE_AT = 20230
export const PRESENTATION_END = 21130
export const SCAN_FEATURES = [
  { id: 'chin', label: 'Chin Definition', x: 95, y: 74, color: '#E0C988', icon: 'chin' },
  { id: 'cheekbones', label: 'Cheekbone Prominence', x: 5, y: 30, color: '#D4B96A', icon: 'cheekbones' },
  { id: 'jaw', label: 'Jaw Definition', x: 95, y: 52, color: '#C6A85C', icon: 'jaw' },
  { id: 'cheeks', label: 'Cheek Leanness & Ogee Curve', x: 5, y: 62, color: '#B99A50', icon: 'cheeks' },
  { id: 'submental', label: 'Submental Definition', x: 95, y: 30, color: '#A8893A', icon: 'submental' },
  { id: 'eyes', label: 'Eye Contours', x: 5, y: 43, color: '#E0C988', icon: 'eyes' },
  { id: 'eyebrows', label: 'Eyebrow Shape', x: 50, y: 12, color: '#D4B96A', icon: 'brows' },
  { id: 'mandible', label: 'Mandible Contour', x: 5, y: 84, color: '#C6A85C', icon: 'jaw' },
]
export function scanFrame(elapsed) {
  const active = SCAN_STARTS.findLastIndex(t => elapsed >= t)
  return { active, compiling: elapsed >= COMPILE_AT, complete: elapsed >= PRESENTATION_END,
    progress: active < 0 ? 0 : Math.min(1, (elapsed - SCAN_STARTS[active]) / (active === 0 ? 883.333 : 1150)) }
}
// A gate cannot strand an async scan when its view unmounts or a retry supersedes it.
export function presentationGate() {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  let settled = false
  return { promise, finish(ok = true) { if (!settled) { settled = true; settle(ok) } } }
}
// Source-image normalized coordinates -> a CSS object-fit:cover viewport.
export function coverTransform(width, height, frameWidth = 333, frameHeight = 723) {
  const scale = Math.max(frameWidth / width, frameHeight / height)
  const sx = width * scale / frameWidth, sy = height * scale / frameHeight
  return { sx, sy, tx: (1 - sx) * 50, ty: (1 - sy) * 50 }
}
export function projectPoint(point, t) {
  return point && { x: point.x * 100 * t.sx + t.tx, y: point.y * 100 * t.sy + t.ty }
}

export function faceCropTransform(width, height, points) {
  if (!points?.forehead || !points?.chin || !points?.cheekL || !points?.cheekR) return coverTransform(width, height, 260, 260)
  const cx = (points.cheekL.x + points.cheekR.x) / 2
  const cy = (points.forehead.y + points.chin.y) / 2
  const side = Math.max(Math.abs(points.cheekR.x - points.cheekL.x) * width, Math.abs(points.chin.y - points.forehead.y) * height) * 1.35
  if (side < 1) return coverTransform(width, height, 260, 260)
  return { sx: width / side, sy: height / side, tx: 50 - cx * width / side * 100, ty: 50 - cy * height / side * 100 }
}

// Preserve the complete detected face rather than cropping lateral jaw/cheek
// points out of the narrow scan viewport. Photo and overlay share this mapping.
export function scanCropTransform(width, height, points) {
  if (!points?.jawContour?.length || !points?.forehead) return coverTransform(width, height)
  const bounds = [...points.jawContour, points.forehead]
  const xs = bounds.map(p => p.x), ys = bounds.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const scale = Math.min(333 * .82 / ((maxX-minX)*width), 723 * .76 / ((maxY-minY)*height))
  if (!Number.isFinite(scale)) return coverTransform(width,height)
  const sx = width*scale/333, sy = height*scale/723
  return {sx,sy,tx:50-(minX+maxX)/2*sx*100,ty:50-(minY+maxY)/2*sy*100}
}
