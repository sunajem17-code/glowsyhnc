import { memo, useMemo, useState, useId, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { projectPoint, coverTransform, SCAN_FEATURES, badgeConnectorEnd } from '../utils/scanPresentation'
import { referenceFeatures, portraitTransform } from '../utils/scanReferenceGeometry'
import './scanReference.css'

// Static mesh is its own memoized SVG. Percentage updates never change its DOM,
// filter, path or opacity, allowing the WebView to retain its painted layer.
const FaceMesh = memo(function FaceMesh({ path, transform }) {
  const fadeId=useId().replace(/:/g,'')+'meshFade'
  if (!path) return null
  return <svg className="reference-mesh" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <radialGradient id={fadeId+'gradient'}>
        <stop offset="0" stopColor="white"/>
        <stop offset=".62" stopColor="white"/>
        <stop offset=".86" stopColor="white" stopOpacity=".45"/>
        <stop offset="1" stopColor="white" stopOpacity=".06"/>
      </radialGradient>
      <mask id={fadeId} maskContentUnits="objectBoundingBox">
        <rect width="1" height="1" fill={'url(#'+fadeId+'gradient)'}/>
      </mask>
    </defs>
    <path d={path} transform={transform} mask={'url(#'+fadeId+')'} fill="none" stroke="#e5dcc4" strokeWidth=".55" opacity=".26" vectorEffect="non-scaling-stroke" />
  </svg>
})

const FocusGeometry = memo(function FocusGeometry({ feature, transform, uid, active, compiling }) {
  if (active >= 0 && feature?.kind === 'point') {
    return <svg className="reference-geometry" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect className="reference-dimming" width="100" height="100" fill="#050507" />
    </svg>
  }
  if (active < 0 || !feature?.path) return null
  const line = feature.kind === 'line'
  const cheekbone = feature.id === 'cheekbones'
  const cheekLeanness = feature.id === 'cheeks'
  const jaw = feature.id === 'jaw' || feature.id === 'submental'
  return <svg className="reference-geometry" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <filter id={uid+'jawBloom'} x="-50%" y="-100%" width="200%" height="300%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="1.05 .48" />
      </filter>
      <filter id={uid+'jawCore'} x="-50%" y="-100%" width="200%" height="300%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation=".38 .175" />
      </filter>
      <filter id={uid+'soft'} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation=".9 .42" />
      </filter>
      <filter id={uid+'glow'} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.2 .55" result="halo" />
        <feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id={uid+'cheekBloom'} x="-60%" y="-100%" width="220%" height="300%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="2.6 1.2" />
      </filter>
      <filter id={uid+'cheekCore'} x="-30%" y="-50%" width="160%" height="200%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation=".35 .16" />
      </filter>
      <mask id={uid+'focus'} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <rect width="100" height="100" fill="white"/>
        <path d={feature.path} transform={transform} fill={line?'none':'black'} stroke="black" strokeWidth={line?'2':'1'} filter={'url(#'+uid+'soft)'} />
      </mask>
    </defs>
    <rect key={'dim'+active} className="reference-dimming" width="100" height="100" fill="#050507"
      mask={'url(#'+uid+'focus)'} />
    <g key={active} transform={transform} className="reference-region">
      {jaw ? <g fill="none" strokeLinecap="round">
        <path d={feature.path} stroke="#eadbb5" strokeWidth="7" strokeOpacity=".48"
          vectorEffect="non-scaling-stroke" filter={'url(#'+uid+'jawBloom)'}/>
        <path d={feature.path} stroke="#fff5dc" strokeWidth="3.2" strokeOpacity=".75"
          vectorEffect="non-scaling-stroke" filter={'url(#'+uid+'jawCore)'}/>
      </g> : (cheekbone || cheekLeanness) ? <g opacity=".8">
        {/* Broad milky bloom, separate from the translucent gold surface.
            This is intentionally not a sharp stroked triangle. */}
        <path d={feature.path} fill="#fff2ca" fillOpacity=".38" stroke="#fff8e8"
          strokeWidth="5" vectorEffect="non-scaling-stroke" filter={'url(#'+uid+'cheekBloom)'} />
        <path d={feature.path} fill="#dcc16f" fillOpacity=".32" stroke="#fff0c4"
          strokeWidth=".7" strokeOpacity=".55" vectorEffect="non-scaling-stroke" filter={'url(#'+uid+'cheekCore)'} />
        {cheekLeanness && <g fill="none" strokeLinejoin="round">
          <path d={feature.path} stroke="#fff9ec" strokeWidth="5" strokeOpacity=".7"
            vectorEffect="non-scaling-stroke" filter={'url(#'+uid+'cheekBloom)'} />
          <path d={feature.path} stroke="#fff5df" strokeWidth="1.7" strokeOpacity=".75"
            vectorEffect="non-scaling-stroke" filter={'url(#'+uid+'cheekCore)'} />
        </g>}
      </g> : <path d={feature.path} fill={line?'none':'#e0c988'} fillOpacity={feature.kind==='glow'?'.23':'.36'}
        stroke="#fff0be" strokeWidth={line?'1.6':'.8'} strokeOpacity=".6"
        vectorEffect="non-scaling-stroke" filter={'url(#'+uid+'glow)'} />}
      {line && !jaw && <path className="reference-contour-trace" d={feature.path} fill="none" stroke="#fff5da"
        strokeWidth="1" vectorEffect="non-scaling-stroke" pathLength="1"/>}
    </g>
  </svg>
})

function usePortraitRect(ref) {
  const [rect,setRect]=useState(null)
  useLayoutEffect(()=>{
    const el=ref.current
    if(!el) return
    const measure=()=>{
      const r=el.getBoundingClientRect()
      setRect(old=>old && old.left===r.left && old.top===r.top && old.width===r.width && old.height===r.height
        ? old : {left:r.left,top:r.top,width:r.width,height:r.height,viewportWidth:window.innerWidth})
    }
    measure()
    const observer=new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize',measure)
    window.addEventListener('scroll',measure,true)
    window.visualViewport?.addEventListener('resize',measure)
    window.visualViewport?.addEventListener('scroll',measure)
    return ()=>{
      observer.disconnect()
      window.removeEventListener('resize',measure)
      window.removeEventListener('scroll',measure,true)
      window.visualViewport?.removeEventListener('resize',measure)
      window.visualViewport?.removeEventListener('scroll',measure)
    }
  },[ref])
  return rect
}

const Callout = memo(function Callout({ feature, badge, point, rect, complete, percent, focused }) {
  if(!point) return null
  if(feature.id==='chin') badge={...badge,y:Math.min(94,point.y+5.5)}
  // Pixel offset in the displayed portrait, independent of photo resolution.
  if(feature.id==='chin') point={...point,y:point.y-1000/rect.height}
  const labelWidth=rect.width*.36
  const lineEnd=badgeConnectorEnd(point,badge,rect.width,rect.height)
  const labelCenter=Math.min(rect.viewportWidth-labelWidth/2-8,
    Math.max(labelWidth/2+8,rect.left+badge.x*rect.width/100))-rect.left
  return <div className="reference-callout" data-feature={feature.id}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {focused && <ellipse className="reference-anchor-ripple" cx={point.x} cy={point.y}
        rx="4" ry={4*rect.width/rect.height} fill="white" fillOpacity=".07"
        stroke="white" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
      {feature.id==='chin' && <>
        <defs>
          <radialGradient id="chin-point-halo">
            <stop offset="0" stopColor="#e0c988" stopOpacity=".38"/>
            <stop offset=".4" stopColor="#d9bb70" stopOpacity=".17"/>
            <stop offset="1" stopColor="#d9bb70" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <ellipse cx={point.x} cy={point.y} rx="10" ry={8*rect.width/rect.height} fill="url(#chin-point-halo)"/>
        <ellipse cx={point.x} cy={point.y} rx="2.8" ry={2.8*rect.width/rect.height} fill="none" stroke="#e0c988" strokeOpacity=".17" strokeWidth=".8" vectorEffect="non-scaling-stroke"/>
      </>}
      <path d={`M ${point.x} ${point.y} L ${lineEnd.x} ${lineEnd.y}`} fill="none" stroke="#d9bb70" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>
      <ellipse cx={point.x} cy={point.y} rx="4" ry={4*rect.width/rect.height} fill="none" stroke="#e0c988" strokeOpacity=".24" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
      <ellipse cx={point.x} cy={point.y} rx="1.3" ry={1.3*rect.width/rect.height} fill="#fff8e8"/>
    </svg>
    <div className="reference-badge-group" style={{left:badge.x+'%',top:badge.y+'%'}}>
      <div className={'reference-badge'+(complete?' is-complete':'')} aria-hidden="true">
        {complete?<svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>:percent+'%'}
      </div>
    </div>
    <span className="reference-label" style={{left:labelCenter,top:`calc(${badge.y}% + var(--bubble-size) / 2 + 7px)`}}>{badge.label}</span>
  </div>
})

export default function ScanPortrait({ photo, points, meshPathD, frame, onImageReady, captureFrame }) {
  const [size,setSize]=useState(null)
  const ref=useRef(null)
  const rect=usePortraitRect(ref)
  const uid=useId().replace(/:/g,'')
  const features=useMemo(()=>referenceFeatures(points,size?size.width/size.height:1),[points,size])
  const t=useMemo(()=>size?(captureFrame?coverTransform(size.width,size.height,captureFrame.width,captureFrame.height):portraitTransform(size.width,size.height,points)):{sx:1,sy:1,tx:0,ty:0},[size,points,captureFrame])
  const projected=useMemo(()=>features.map(f=>projectPoint(f.point,t)),[features,t])
  const transform=`translate(${t.tx} ${t.ty}) scale(${t.sx} ${t.sy})`
  const active=frame.active
  const sweepStart=Math.max(0,(projectPoint(points?.forehead,t)?.y??20)-3)
  const sweepEnd=Math.min(100,(projectPoint(points?.chin,t)?.y??80)+4)
  const portrait=<div ref={ref} className="reference-photo" style={captureFrame?{position:'fixed',...captureFrame,aspectRatio:'auto',zIndex:100}:undefined}>
      <div className={'reference-photo-clip'+(active>=0?' is-focused':'')+(active<0?' is-revealing':'')}
        style={{'--sweep-start':sweepStart+'%','--sweep-end':sweepEnd+'%',...(captureFrame?{borderRadius:captureFrame.borderRadius||0,border:0}:{})}}>
        <img src={photo || undefined} alt="Your photo being analyzed" draggable="false"
          onLoad={e=>{setSize({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight});onImageReady?.()}}
          style={{width:t.sx*100+'%',height:t.sy*100+'%',left:t.tx+'%',top:t.ty+'%',opacity:size?1:0}}/>
        {size && <FaceMesh path={meshPathD} transform={transform}/>}
        {size && <FocusGeometry feature={features[active]} transform={transform} uid={uid} active={active} compiling={frame.compiling}/>}
        {size && points && active<0 && <div className="reference-intro-sweep"/>}
      </div>
    </div>
  return <>
    {captureFrame ? createPortal(portrait,document.body) : portrait}
    {rect?.width > 0 && rect?.height > 0 && size && createPortal(
      <div className="reference-overlay" aria-hidden="true" style={{left:rect.left,top:rect.top,width:rect.width,height:rect.height,
        '--bubble-size':rect.width*.168+'px','--label-width':rect.width*.36+'px','--label-font':rect.width*.033+'px','--counter-font':rect.width*.051+'px'}}>
        {features.map((f,i)=>i<=active && <Callout key={f.id} feature={f} badge={SCAN_FEATURES[i]} point={projected[i]} rect={rect}
          focused={i===active}
          complete={frame.compiling || i<active || frame.progress>=1} percent={i===active?Math.min(100,Math.round(frame.progress*100)):100}/>)}
      </div>,document.body)}
  </>
}
