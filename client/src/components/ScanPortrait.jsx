import { useState, useId } from 'react'
import { frontFeatureAnchors } from '../utils/scanFeatureAnchors'
import { coverTransform, faceCropTransform, projectPoint, SCAN_FEATURES } from '../utils/scanPresentation'
import { GOLD } from '../utils/theme'
import './scanReference.css'

export function DefinitionIcon({ kind, ...props }) {
  const paths = { chin: 'M3 5h18L12 21Z', cheekbones: 'M3 20 12 3l9 17ZM8 12l4 3 3-6', jaw: 'M3 20h18M3 20l7-15M13 6l1 1m3 2 1 1m2 2 1 1', cheeks: 'M13 2c2 6-5 7-3 11 2-1 4-2 5-5 5 5 6 8 3 12-6 6-15 0-12-6 0 4 4 3 4 0-1-4 4-6 3-12', submental: 'M2 12h4c3 0 0-10 4-10s1 20 5 20 1-10 5-10h2' }
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[kind] || paths.chin} /></svg>
}

// One registered image/geometry surface shared by processing and the result portrait.
export default function ScanPortrait({ photo, points, meshPathD, elapsed = 0, frame, results = false, onRegion, regionValues = {} }) {
  const [size, setSize] = useState(null)
  const uid = useId().replace(/:/g, '')
  const t = size ? (results ? faceCropTransform(size.width, size.height, points) : coverTransform(size.width, size.height)) : { sx: 1, sy: 1, tx: 0, ty: 0 }
  const features = frontFeatureAnchors(points)
  const active = frame?.active ?? -1
  const compiling = frame?.compiling ?? false
  const current = features[active]
  const transformed = p => projectPoint(p, t)
  const pathPoints = list => list?.map(p => `${p.x * 100},${p.y * 100}`).join(' ')
  const regionPath = list => {
    const mid = (a, b) => `${(a.x + b.x) * 50} ${(a.y + b.y) * 50}`
    return `M ${mid(list.at(-1), list[0])} ` + list.map((p, i) => `Q ${p.x * 100} ${p.y * 100} ${mid(p, list[(i + 1) % list.length])}`).join(' ') + ' Z'
  }
  const transform = `translate(${t.tx} ${t.ty}) scale(${t.sx} ${t.sy})`
  const resultBadges = [{ x: 90, y: 102 }, { x: 8, y: -1 }, { x: 7, y: 99 }, { x: 92, y: -1 }, { x: 50, y: 116 }]
  return <div className={results ? 'definition-face' : 'reference-photo'}>
    <div className="reference-photo-clip">
      <img src={photo || undefined} alt={results ? 'Your facial analysis' : 'Photo being analyzed'} onLoad={e => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} style={{ position: 'absolute', width: `${t.sx * 100}%`, height: `${t.sy * 100}%`, left: `${t.tx}%`, top: `${t.ty}%`, maxWidth: 'none', opacity: size ? 1 : 0, filter: `brightness(${results ? .72 : active < 0 || compiling ? .85 : .43})` }} />
      {size && <svg className="reference-geometry" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><filter id={`${uid}glow`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation=".8" /></filter></defs>
        <g transform={transform}>
          {meshPathD && <path d={meshPathD} fill="none" stroke={results ? '#E6DBC0' : GOLD} strokeWidth=".32" vectorEffect="non-scaling-stroke" opacity={compiling || results ? .32 : active < 0 ? .32 * Math.min(1, elapsed / 450) : .15} />}
          {features.map((feature, i) => {
            if (!feature.point || (!results && i !== active)) return null
            const color = results ? SCAN_FEATURES[i].color : GOLD
            return <g key={feature.id}>
              {feature.regions?.filter(Boolean).map((polygon, j) => <g key={j}>
                <path d={regionPath(polygon)} fill={color} opacity=".45" filter={`url(#${uid}glow)`} />
                <path d={regionPath(polygon)} fill={color} fillOpacity=".2" stroke={color} strokeWidth=".5" strokeOpacity=".7" vectorEffect="non-scaling-stroke" />
              </g>)}
              {feature.contour && <polyline points={pathPoints(feature.contour)} fill="none" stroke={color} strokeWidth={results ? 1.2 : 2} opacity=".7" vectorEffect="non-scaling-stroke" />}
            </g>
          })}
        </g>
      </svg>}
      {!results && active < 0 && points && <div className="reference-sweep" style={{ left: `${Math.max(0, transformed(points.templeL)?.x ?? 15)}%`, width: `${Math.abs((transformed(points.templeR)?.x ?? 85) - (transformed(points.templeL)?.x ?? 15))}%`, top: `${transformed(points.eyeBottomL)?.y + Math.sin(Math.min(1, elapsed / 1435) * Math.PI) * 18}%` }} />}
    </div>
    {size && features.map((feature, i) => {
      if (!feature.point || (!results && i > active)) return null
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
    {!results && current?.point && frame.progress < .45 && <div key={active} className="reference-pulse" style={{ left: `${transformed(current.point).x}%`, top: `${transformed(current.point).y}%` }} />}
  </div>
}
