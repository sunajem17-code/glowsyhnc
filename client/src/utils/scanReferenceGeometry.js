import { coverTransform } from './scanPresentation.js'

const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
const mix = (a,b,t) => valid(a) && valid(b) ? {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t} : null
const xy = p => `${(p.x*100).toFixed(4)} ${(p.y*100).toFixed(4)}`
// Rounded, truncated wedge measured from IMG_2177.PNG. The inner edge has
// real height (~a quarter of the outer edge): it must not collapse to a tip.
// u spans outer cheek -> inner cheek; v follows the local cheek's downward axis.
export function cheekbonePanel(outerTop, innerTop, outerBottom) {
  if (![outerTop,innerTop,outerBottom].every(valid)) return ''
  const at=(u,v)=>xy({
    x:outerTop.x+u*(innerTop.x-outerTop.x)+v*(outerBottom.x-outerTop.x),
    y:outerTop.y+u*(innerTop.y-outerTop.y)+v*(outerBottom.y-outerTop.y),
  })
  return `M ${at(.16,0)}
    Q ${at(0,0)} ${at(0,.20)}
    L ${at(.015,.97)}
    Q ${at(.015,1)} ${at(.05,.985)}
    L ${at(.96,.32)}
    Q ${at(1,.30)} ${at(1,.26)}
    L ${at(1,.075)}
    Q ${at(1,.035)} ${at(.95,.035)}
    Z`
}
const line = list => list?.length && list.every(valid) ? `M ${list.map(xy).join(' L ')}` : ''
const smooth = list => {
  if (!list.every(valid)) return ''
  return `M ${xy(mix(list.at(-1),list[0],.5))} ` +
    list.map((p,i)=>`Q ${xy(p)} ${xy(mix(p,list[(i+1)%list.length],.5))}`).join(' ')+' Z'
}

// The reference uses a stable wedge and a tapered cheek panel, not a
// convex hull (whose topology changes with face proportions). Fit those same
// templates independently to each side's measured eye, cheek and jaw anchors.
export function referenceFeatures(points, imageAspect = 1) {
  const p=points || {}
  const wedges=[],cheeks=[],wedgePoints=[],cheekPoints=[]
  for(const s of ['L','R']) {
    const outerEye=p['eyeOuter'+s],eye=p['eyeBottom'+s],outer=p['cheek'+s]
    const inner=p['eyeInner'+s],jaw=p['jawMid'+s],mouth=p['mouth'+s]
    const baseUpper=mix(outerEye,outer,.55)
    const baseApex=mix(inner,mouth,.18)
    const baseLower=mix(outer,jaw,.30)
    // Move the whole panel down its local cheek axis, preserving its shape.
    const lowered=q=>valid(q)&&valid(baseUpper)&&valid(baseLower)
      ? {x:q.x+(baseLower.x-baseUpper.x)*.12,y:q.y+(baseLower.y-baseUpper.y)*.12} : null
    const upper=lowered(baseUpper),apex=lowered(baseApex),lower=lowered(baseLower)
    wedges.push(cheekbonePanel(upper,apex,lower))
    wedgePoints.push(mix(mix(upper,apex,.32),lower,.16))

    const top=mix(outerEye,outer,1.05)
    // Sloped shoulder drops inward from the high outer cheek, then the
    // inner edge tapers down to the jaw. Avoid the old horizontal cap.
    const innerTop=mix(top,mouth,.55)
    const tip=mix(jaw,p['jawChin'+s],.08)
    const outside=mix(outer,p['jaw'+s],.52)
    const inside=mix(mouth,outer,.32)
    // Four cubic arcs retain a rounded top, convex outer wall and tapered
    // jaw end. All controls follow this side of this face, including roll.
    if([top,tip,outerEye,inner].every(valid)) {
      // Fixed reference silhouette fitted to this cheek's local axes.
      const at=(u,v)=>xy({x:top.x+(tip.x-top.x)*v+(inner.x-outerEye.x)*.72*u,
        y:top.y+(tip.y-top.y)*v+(inner.y-outerEye.y)*.72*u})
      cheeks.push(`M ${at(.06,0)} Q ${at(.20,-.045)} ${at(.43,-.035)}
        L ${at(.94,.28)} C ${at(1.08,.47)} ${at(.42,.84)} ${at(0,1)}
        C ${at(-.23,.77)} ${at(-.20,.36)} ${at(-.08,.08)}
        Q ${at(-.055,.025)} ${at(.06,0)} Z`)
    } else cheeks.push('')
    cheekPoints.push(mix(mix(top,innerTop,.5),tip,.35))
  }
  const chinCenter=valid(p.chinSurface)?p.chinSurface:p.chin
  const chinPath=smooth([mix(p.jawChinL,p.mouthL,.22),mix(p.chin,p.lowerLip || p.chin,.22),
    mix(p.jawChinR,p.mouthR,.22),p.jawChinR,p.chin,p.jawChinL])
  // Reference: two short lower-jaw strokes, with an open gap at the chin.
  const jawSegments=['L','R'].map(s=>[
    mix(p['jaw'+s],p['jawMid'+s],.35),
    mix(p['jawMid'+s],p['jawChin'+s],.65),
  ])
  const lengths=jawSegments.map(([a,b])=>valid(a)&&valid(b)
    ? Math.hypot((b.x-a.x)*imageAspect,b.y-a.y) : 0)
  // Reference strokes span roughly 28% of the visible face width each.
  // Keep equal lengths without shrinking both to the shorter detected side.
  const sharedLength=valid(p.cheekL)&&valid(p.cheekR)
    ? Math.hypot((p.cheekR.x-p.cheekL.x)*imageAspect,p.cheekR.y-p.cheekL.y)*.28
    : Math.max(...lengths)
  const jawPath=jawSegments.map(([a,b],i)=>{
    if(!sharedLength || !lengths[i]) return ''
    const inset=(1-sharedLength/lengths[i])/2
    return line([mix(a,b,inset),mix(a,b,1-inset)])
  }).filter(Boolean).join(' ')
  const chinArcPoints=p.chinContour || [p.jawChinL,p.chin,p.jawChinR]
  const arcLeft=chinArcPoints[0],arcRight=chinArcPoints.at(-1)
  // Smooth quadratic arc through the measured chin, with no angular joins.
  const arcMid=mix(arcLeft,arcRight,.5)
  const arcControl=valid(arcMid)&&valid(p.chin)
    ? {x:2*p.chin.x-arcMid.x,y:2*p.chin.y-arcMid.y} : null
  const chinContour=[arcLeft,arcRight,arcControl].every(valid)
    ? `M ${xy(arcLeft)} Q ${xy(arcControl)} ${xy(arcRight)}` : ''
  return [
    {id:'chin',point:valid(p.chin)?p.chin:null,path:chinPath,kind:'point'},
    {id:'cheekbones',point:wedgePoints[0],path:wedges.join(' '),kind:'region',regions:wedges},
    {id:'jaw',point:valid(p.jawMidR)?p.jawMidR:null,path:jawPath,kind:'line'},
    {id:'cheeks',point:cheekPoints[0],path:cheeks.join(' '),kind:'region',regions:cheeks},
    {id:'submental',point:valid(chinCenter)?chinCenter:null,path:chinContour,kind:'line'},
  ]
}

// Match the capture screen's 4:5 cover crop, with no letterboxing.
// Photo, mesh, regional shapes and connector anchors all use this same mapping.
export function portraitTransform(width,height) {
  return coverTransform(width,height,400,500)
}
