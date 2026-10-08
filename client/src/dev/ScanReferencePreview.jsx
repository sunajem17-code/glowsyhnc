import React,{useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {AnalyzingScreen,extractScanOverlayPoints,buildMeshPathD} from '../pages/Scan'
import {getLandmarks} from '../utils/faceLandmarks'
import male from '../assets/face-metrics-demo.jpg'
import '../index.css'

function Preview(){
 const [photo,setPhoto]=useState(import.meta.hot?.data.testPhoto || male)
 const [points,setPoints]=useState(null),[mesh,setMesh]=useState(null)
 const [time,setTime]=useState(4600),[run,setRun]=useState(0),[error,setError]=useState('')
 useEffect(()=>{
  let cancelled=false
  setPoints(null);setMesh(null);setError('')
  getLandmarks(photo).then(async lm=>{
   const mod=await import('@mediapipe/face_mesh')
   if(cancelled)return
   setPoints(extractScanOverlayPoints(lm))
   setMesh(buildMeshPathD(lm,mod.FACEMESH_TESSELATION||mod.default?.FACEMESH_TESSELATION||window.FACEMESH_TESSELATION))
  }).catch(e=>{if(!cancelled)setError(e.message)})
  return()=>{cancelled=true}
 },[photo])
 const loadPhoto=e=>{
  const f=e.target.files?.[0];if(!f)return
  const reader=new FileReader()
  reader.onload=()=>{if(import.meta.hot)import.meta.hot.data.testPhoto=reader.result;setPhoto(reader.result)}
  reader.readAsDataURL(f)
 }
 return <main style={{height:'100dvh',background:'#0d0c12',paddingTop:64,boxSizing:'border-box'}}>
  <style>{`
   .scan-preview-controls{position:fixed;top:0;left:0;right:0;z-index:20000;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;background:#13120f;padding:10px;color:#ddd;font:12px -apple-system,BlinkMacSystemFont,sans-serif}
   .scan-preview-controls button{border:1px solid #5c5033;border-radius:6px;padding:6px 9px;color:#e0c988;background:#242018}
   .scan-preview-controls button[aria-pressed=true]{background:#c6a85c;color:#101010}
   .scan-preview-controls input{max-width:170px;font-size:11px}
  `}</style>
  <header className="scan-preview-controls">
   <input aria-label="Test photo" type="file" accept="image/*" onChange={loadPhoto}/>
   {[['Intro',0],['Chin',2000],['Cheekbones',4600],['Jaw',7800],['Cheeks',9800],['Submental',12000]].map(([name,t])=><button key={t} aria-pressed={time===t} onClick={()=>setTime(t)}>{name}</button>)}
   <button onClick={()=>{setTime(undefined);setRun(x=>x+1)}} disabled={!points}>Replay</button>
   <output>{error || (points?'':'Mapping face…')}</output>
  </header>
  <AnalyzingScreen key={photo+run} photo={photo} points={points} meshPathD={mesh} previewElapsed={time}/>
 </main>
}
if(import.meta.env.DEV){
 const root=import.meta.hot?.data.root || createRoot(document.getElementById('root'))
 root.render(<Preview/>)
 if(import.meta.hot)import.meta.hot.dispose(data=>{data.root=root;data.testPhoto=import.meta.hot.data.testPhoto})
}
