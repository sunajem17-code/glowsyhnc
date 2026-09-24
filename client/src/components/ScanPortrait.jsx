import { memo, useMemo, useState, useId } from 'react'
import { frontFeatureAnchors } from '../utils/scanFeatureAnchors'
import { scanCropTransform, faceCropTransform, projectPoint, SCAN_FEATURES } from '../utils/scanPresentation'
import { GOLD } from '../utils/theme'
import './scanReference.css'

export function DefinitionIcon({ kind, ...props }) {
  const paths = { chin: 'M3 5h18L12 21Z', cheekbones: 'M3 20 12 3l9 17ZM8 12l4 3 3-6', jaw: 'M3 20h18M3 20l7-15M13 6l1 1m3 2 1 1m2 2 1 1', cheeks: 'M13 2c2 6-5 7-3 11 2-1 4-2 5-5 5 5 6 8 3 12-6 6-15 0-12-6 0 4 4 3 4 0-1-4 4-6 3-12', submental: 'M2 12h4c3 0 0-10 4-10s1 20 5 20 1-10 5-10h2' }
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[kind] || paths.chin} /></svg>
}

const pathPoints = list => list?.map(p => `${p.x * 100},${p.y * 100}`).join(' ')
const regionPath = (list, exact = false) => {
  if (exact) return `M ${pathPoints(list)} Z`
  const mid = (a, b) => `${(a.x + b.x) * 50} ${(a.y + b.y) * 50}`
  return `M ${mid(list.at(-1), list[0])} ` + list.map((p, i) => `Q ${p.x * 100} ${p.y * 100} ${mid(p, list[(i + 1) % list.length])}`).join(' ') + ' Z'
}

// The dense wireframe never re-renders for percentage-counter updates.
const PortraitGeometry = memo(function PortraitGeometry({ features, active, compiling, results, meshPathD, transform, uid }) {
  const current = features[active]
  const focused = !results && !compiling && Boolean(current?.point)
  const regions = current?.regions?.filter(Boolean) || []
  const focusShape = <>
    {regions.map((polygon, i) => <path key={i} d={regionPath(polygon, current?.exact)} />)}
    {current?.contours?.filter(Boolean).map((contour, i) => <polyline key={`c${i}`} points={pathPoints(contour)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
    {current?.contour && <polyline points={pathPoints(current.contour)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
  </>
  return <svg className="reference-geometry" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <mask id={`${uid}spot`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <rect width="100" height="100" fill="white" />
        <g transform={transform} fill="black" color="black">{focusShape}</g>
      </mask>
      <mask id={`${uid}region`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <g transform={transform} fill="white" color="white">{focusShape}</g>
      </mask>
      <linearGradient id={`${uid}light`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e0c988" stopOpacity="0" />
        <stop offset=".8" stopColor="#e0c988" stopOpacity=".06" />
        <stop offset=".96" stopColor="#fff2c9" stopOpacity=".42" />
        <stop offset="1" stopColor="#e0c988" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect className="reference-focus-scrim" width="100" height="100" fill="black" mask={`url(#${uid}spot)`} style={{ opacity: focused ? .64 : 0 }} />
    <g transform={transform}>
      {meshPathD && <path d={meshPathD} fill="none" stroke={results ? '#E6DBC0' : GOLD} strokeWidth=".45" vectorEffect="non-scaling-stroke" opacity={results ? .25 : focused ? .1 : .28} />}
      {features.map((feature, i) => {
        if (!feature.point || (!results && (i !== active || compiling))) return null
        const color = results ? SCAN_FEATURES[i].color : GOLD
        return <g key={feature.id} className={results ? undefined : 'reference-region-reveal'}>
          {feature.regions?.filter(Boolean).map((polygon, j) => <path key={j} d={regionPath(polygon, feature.exact)} fill={color} fillOpacity=".09" stroke={color} strokeWidth="1" strokeOpacity=".9" vectorEffect="non-scaling-stroke" pathLength="1" className={results ? undefined : 'reference-trace'} />)}
          {feature.contours?.filter(Boolean).map((contour, j) => <polyline key={`c${j}`} points={pathPoints(contour)} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" pathLength="1" className="reference-trace" />)}
          {feature.contour && <polyline points={pathPoints(feature.contour)} fill="none" stroke={color} strokeWidth="1.4" opacity=".9" vectorEffect="non-scaling-stroke" pathLength="1" className={results ? undefined : 'reference-trace'} />}
        </g>
      })}
    </g>
    {focused && <g mask={`url(#${uid}region)`} key={active}>
      {meshPathD && <path d={meshPathD} transform={transform} fill="none" stroke="#f5e4b5" strokeWidth=".75" vectorEffect="non-scaling-stroke" opacity=".6" />}
      <rect className="reference-hologram-band" x="0" y="-30" width="100" height="30" fill={`url(#${uid}light)`} />
    </g>}
  </svg>
})

// One registered image/geometry surface shared by processing and the result portrait.
export default function ScanPortrait({ photo, points, meshPathD, frame, results = false, onRegion, regionValues = {} }) {
  const [size, setSize] = useState(null)
  const uid = useId().replace(/:/g, '')
  const t = size ? (results ? faceCropTransform(size.width, size.height, points) : scanCropTransform(size.width, size.height, points)) : { sx: 1, sy: 1, tx: 0, ty: 0 }
  const features = useMemo(() => frontFeatureAnchors(points), [points])
  const active = frame?.active ?? -1
  const compiling = frame?.compiling ?? false
  const current = features[active]
  const transformed = p => projectPoint(p, t)
  const transform = `translate(${t.tx} ${t.ty}) scale(${t.sx} ${t.sy})`
  const focus = transformed(current?.focus || current?.point)
  const focusing = !results && !compiling && Boolean(focus)
  const zoom = focusing ? 1.045 : 1
  const cameraStyle = {
    transform: `translate3d(${focusing ? (50 - focus.x) * .045 : 0}%,${focusing ? (50 - focus.y) * .045 : 0}%,0) scale(${zoom})`,
  }
  const resultBadges = [{ x: 90, y: 102 }, { x: 8, y: -1 }, { x: 7, y: 99 }, { x: 92, y: -1 }, { x: 50, y: 116 }]
  return <div className={results ? 'definition-face' : 'reference-photo'}>
    <div className="reference-camera" style={cameraStyle}>
    <div className="reference-photo-clip">
      <img src={photo || undefined} alt={results ? 'Your facial analysis' : 'Photo being analyzed'} onLoad={e => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} style={{ position: 'absolute', width: `${t.sx * 100}%`, height: `${t.sy * 100}%`, left: `${t.tx}%`, top: `${t.ty}%`, maxWidth: 'none', opacity: size ? 1 : 0, filter: `brightness(${results ? .72 : .92})` }} />
      {size && <PortraitGeometry features={features} active={active} compiling={compiling} results={results} meshPathD={meshPathD} transform={transform} uid={uid} />}
      {!results && active < 0 && points && <div className="reference-sweep reference-intro-sweep" />}

    </div>
    {size && features.map((feature, i) => {
      if (!feature.point || (!results && (i > active || i < active - 2))) return null
      const p = transformed(feature.point)
      const badge = results ? resultBadges[i] : SCAN_FEATURES[i]
      const color = results ? SCAN_FEATURES[i].color : GOLD
      const done = compiling || i < active || frame?.progress >= 1
      const percent = Math.min(99, Math.round((frame?.progress || 0) * 100))
      return <div key={feature.id} className="reference-callout" style={{ '--region-color': color }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={`M ${p.x} ${p.y} L ${badge.x} ${badge.y}`} stroke={color} strokeWidth="1" opacity=".8" vectorEffect="non-scaling-stroke" />
          <ellipse cx={p.x} cy={p.y} rx={results ? 1.3 : .9} ry={results ? 1.3 : .9 * 333 / 723} fill={results ? color : '#fff'} />
        </svg>
        {results ? <button className="definition-region" style={{ left: `${badge.x}%`, top: `${badge.y}%` }} onClick={() => onRegion?.(feature.id)} aria-label={`${feature.label}: unlock score`}><DefinitionIcon kind={SCAN_FEATURES[i].icon} width="14" height="14" /><span aria-hidden="true" className="definition-blur">{regionValues[feature.id] ?? '—'}</span></button>
          : <div className="reference-badge-group" style={{ left: `${badge.x}%`, top: `${badge.y}%` }}>
            <div className={`reference-badge ${done ? 'is-complete' : ''}`} aria-hidden="true">{done ? <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : `${percent}%`}</div>
            <span className="reference-label">{feature.id === 'submental' ? <>Submental<br />Definition</> : feature.id === 'cheekbones' ? <>Cheekbone<br />Prominence</> : feature.id === 'cheeks' ? <>Cheek Leanness &amp;<br />Ogee Curve</> : feature.label}</span>
          </div>}
      </div>
    })}
    {!results && !compiling && current?.point && frame.progress < .45 && <div key={active} className="reference-pulse" style={{ left: `${transformed(current.point).x}%`, top: `${transformed(current.point).y}%` }} />}
    </div>
  </div>
}
