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
 const [opened, setOpened] = useState(false)
 useEffect(() => { getLandmarks(photo).then(async lm => {
   const { FACEMESH_TESSELATION } = await loadFaceMeshLibrary()
   setGeometry({ points: extractScanOverlayPoints(lm), meshPathD: buildMeshPathD(lm, FACEMESH_TESSELATION) })
 }).catch(e => setError(e.message)) }, [])
 const metrics = Object.fromEntries(['chin','cheekbones','jaw','cheeks','submental'].map((key,i) => [key,{ score: [5.3,6.8,8.7,4.2,2.7][i] }]))
 const scan = { facePhotoUrl: photo, aiScore: { definitionAnalysis: { metrics, overallScore: 5.5, focusAreaCount: 3 } } }
 return <div style={{ background:'#202027',height:'100dvh',overflow:'auto',padding:phone ? 0 : 20,color:'white',display:'flex',gap:30 }}>
  <div style={{ width:phone ? '100%' : 430,height:phone ? '100%' : 932,flexShrink:0,background:'#0e0d19',position:'relative',paddingTop:60,'--scan-safe-bottom':'34px' }} data-testid="phone">
   {error ? <p>{error}</p> : !geometry ? <p>Loading fixture landmarks…</p> : mode!=='results' ? <AnalyzingScreen key={replay} photo={photo} {...geometry} previewElapsed={mode==='live' ? undefined : time} onPresentationComplete={() => setCompleted(n=>n+1)} /> : <LockedRevealScreen scan={scan} previewGeometry={geometry} onAscend={() => setOpened(true)} />}
  </div>
  {!phone && <aside style={{ maxWidth:300,padding:20 }}><h1>Scan comparison fixture</h1><p>Development preview — sample scores only.</p><button onClick={() => setMode('scan')}>Scan</button> <button onClick={() => setMode('results')}>Results</button><p>{time} ms</p><input aria-label="Scan time" type="range" min="0" max="14530" step="10" value={time} onChange={e => setTime(Number(e.target.value))} />{[0,1435,3637,6139,8640,11142,13629,14530].map(t=><button key={t} style={{display:'block',padding:8}} onClick={()=>{setMode('scan');setTime(t)}}>{t} ms</button>)}{opened && <p role="status">Unlock callback reached.</p>}<button onClick={()=>{setReplay(n=>n+1);setCompleted(0);setMode('live')}}>Play full scan</button><p role="status">Presentation completed: {completed}</p></aside>}
 </div>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<Preview />)
