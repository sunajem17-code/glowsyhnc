import ScanCelebration from './src/components/ScanCelebration'
import { BrowserRouter } from 'react-router-dom'
import { SCAN_STARTS, COMPILE_AT, PRESENTATION_END } from './src/utils/scanPresentation'
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnalyzingScreen, extractScanOverlayPoints, buildMeshPathD } from './src/pages/Scan'
import { LockedRevealScreen } from './src/pages/ScanUnlockGate'
import { getLandmarks, loadFaceMeshLibrary } from './src/utils/faceLandmarks'
import photo from './src/assets/face-metrics-demo.jpg'
import './src/index.css'

// Development-only visual fixture; never mutates auth, payments, or the real scan store.
function Preview() {
 const [geometry, setGeometry] = useState(null)
 const [error, setError] = useState('')
 const [time, setTime] = useState(9400)
 const phone = new URLSearchParams(location.search).has('phone')
 const [mode, setMode] = useState(new URLSearchParams(location.search).get('view') || 'scan')
 const [replay, setReplay] = useState(0)
 const [completed, setCompleted] = useState(0)
 const [timing, setTiming] = useState(null)
 const [opened, setOpened] = useState(false)
 useEffect(() => { getLandmarks(photo).then(async lm => {
   const { FACEMESH_TESSELATION } = await loadFaceMeshLibrary()
   setGeometry({ points: extractScanOverlayPoints(lm), meshPathD: buildMeshPathD(lm, FACEMESH_TESSELATION) })
 }).catch(e => setError(e.message)) }, [])
 useEffect(() => {
   if (mode !== 'live') return
   setTiming(null)
   const intervals = []
   let last = null, started = null, raf
   const sample = now => {
     if (started == null) started = now
     if (last != null) intervals.push(now-last)
     last = now
     if (now-started < PRESENTATION_END + 70) raf=requestAnimationFrame(sample)
     else {
       const sorted=[...intervals].sort((a,b)=>a-b)
       setTiming({fps: (1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length)).toFixed(1), p95:sorted[Math.floor(sorted.length*.95)].toFixed(1), slow:intervals.filter(t=>t>25).length})
     }
   }
   raf=requestAnimationFrame(sample)
   return () => cancelAnimationFrame(raf)
 }, [mode,replay])
 const metrics = Object.fromEntries(['chin','cheekbones','jaw','cheeks','submental'].map((key,i) => [key,{ score: [5.3,6.8,8.7,4.2,2.7][i] }]))
 const scan = { facePhotoUrl: photo, aiScore: { definitionAnalysis: { metrics, overallScore: 5.5, focusAreaCount: 3 } } }
 return <div style={{ background:'#181818',height:'100dvh',overflow:'auto',padding:phone ? 0 : 20,color:'white',display:'flex',gap:30 }}>
  <div style={{ width:phone ? '100%' : 430,height:phone ? '100%' : 932,flexShrink:0,background:'#080808',position:'relative',paddingTop:60,'--scan-safe-bottom':'34px' }} data-testid="phone">
   {error ? <p>{error}</p> : !geometry ? <p>Loading fixture landmarks…</p> : mode!=='results' ? <AnalyzingScreen key={replay} photo={photo} {...geometry} previewElapsed={mode==='live' ? undefined : time} onPresentationComplete={() => setCompleted(n=>n+1)} /> : <LockedRevealScreen scan={scan} previewGeometry={geometry} onAscend={() => setOpened(true)} />}
  </div>
  {mode === 'results' && <ScanCelebration />}
  {!phone && <aside style={{ maxWidth:300,padding:20 }}><h1>Scan comparison fixture</h1><p>Development preview — sample scores only.</p><button onClick={() => setMode('scan')}>Scan</button> <button onClick={() => setMode('results')}>Results</button><p>{time} ms</p><input aria-label="Scan time" type="range" min="0" max={PRESENTATION_END} step="10" value={time} onChange={e => setTime(Number(e.target.value))} />{[0,...SCAN_STARTS.map(Math.ceil),COMPILE_AT,PRESENTATION_END].map(t=><button key={t} style={{display:'block',padding:8}} onClick={()=>{setMode('scan');setTime(t)}}>{t} ms</button>)}{opened && <p role="status">Unlock callback reached.</p>}<button onClick={()=>{setReplay(n=>n+1);setCompleted(0);setMode('live')}}>Play full scan</button><p role="status">Presentation completed: {completed}</p>{timing && <p role="status">Browser frame clock: {timing.fps} fps; p95 {timing.p95} ms; {timing.slow} frames over 25 ms. This is a browser timing sample, not a device rendering guarantee.</p>}</aside>}
 </div>
}
if (import.meta.env.DEV) {
 const root = createRoot(document.getElementById('root'))
 root.render(<BrowserRouter><Preview /></BrowserRouter>)
 import.meta.hot?.dispose(() => root.unmount())
}
