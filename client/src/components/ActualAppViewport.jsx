import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

// Render the production components at iPhone 16 Pro's native logical viewport.
// A separate root and router keep the presentation from navigating the real app.
export default function ActualAppViewport({ children, label, onReady, scrollProgress = 0, photoMotion = false, fullBleed = false, fitHeight = false }) {
  const host = useRef(null)
  const frame = useRef(null)
  const root = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [nativeHeight,setNativeHeight]=useState(874)
  const [scale, setScale] = useState(.5)
  const scroll = useRef(scrollProgress)
  scroll.current = scrollProgress
  const applyScroll = useRef(null)
  const ready = useRef(onReady)
  ready.current = onReady
  useEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver(entries => {const box=entries[0].contentRect;const nextScale=box.width/402;setScale(nextScale);setNativeHeight(fitHeight&&nextScale>0?box.height/nextScale:874)})
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [fitHeight])
  useEffect(()=>{
    const doc=frame.current?.contentDocument
    if(!loaded||!doc)return
    for(const el of [doc.documentElement,doc.body,doc.getElementById("replica-root")])if(el)el.style.height=`${nativeHeight}px`
  },[loaded,nativeHeight])
  useEffect(() => {
    if (!loaded) return
    const doc = frame.current?.contentDocument
    if (!doc) return
    for (const node of document.querySelectorAll('style, link[rel="stylesheet"]')) doc.head.appendChild(node.cloneNode(true))
    const base = doc.createElement('style')
    base.textContent = 'html,body,#replica-root{margin:0;width:402px;height:874px;overflow:hidden;background:#0a0a0a}html{color-scheme:dark}#replica-safe-area{height:100%;padding-top:48px;padding-bottom:26px;box-sizing:border-box;--text-secondary:rgba(255,255,255,.5)}#replica-safe-area>div{height:100%}'
    doc.head.appendChild(base)
    root.current = createRoot(doc.getElementById('replica-root'))
    const resize = new ResizeObserver(() => applyScroll.current?.())
    let observed = null
    applyScroll.current = () => {
      const list = doc.querySelector('.appearance-points')
      if (list && observed !== list) { resize.disconnect(); resize.observe(list); observed = list }
      if (list) list.scrollTop = Math.max(0, list.scrollHeight - list.clientHeight) * Math.max(0, Math.min(1, scroll.current))
    }
    const observer = new MutationObserver(() => applyScroll.current?.())
    observer.observe(doc.getElementById('replica-root'), { childList:true, subtree:true })
    ready.current?.()
    return () => { observer.disconnect(); resize.disconnect(); applyScroll.current = null; const mounted = root.current; root.current = null; queueMicrotask(() => mounted?.unmount()) }
  }, [loaded])
  useEffect(() => {
    if (!loaded || !root.current) return
    root.current.render(<MemoryRouter><div id="replica-safe-area" className="dark">{children}</div></MemoryRouter>)
  }, [loaded, children])
  useEffect(() => {
    if (!loaded) return
    const id = requestAnimationFrame(() => applyScroll.current?.())
    return () => cancelAnimationFrame(id)
  }, [loaded, scrollProgress])
  useEffect(() => {
    const doc=frame.current?.contentDocument
    if(!loaded||!doc)return
    doc.documentElement.dataset.selfieMotion=String(photoMotion)
    if(!doc.getElementById('selfie-presentation-motion')){
      const style=doc.createElement('style');style.id='selfie-presentation-motion'
      style.textContent='html[data-selfie-motion="true"] img[alt="uploaded"]{animation:selfie-handheld 2.3s ease-in-out infinite;transform-origin:50% 42%}@keyframes selfie-handheld{0%,100%{transform:scale(1.025) translate(-1px,1px) rotate(-.3deg)}50%{transform:scale(1.04) translate(1px,-2px) rotate(.3deg)}}'
      doc.head.appendChild(style)
    }
  },[loaded,photoMotion])
  useEffect(()=>{
    const doc=frame.current?.contentDocument
    if(!loaded||!doc)return
    doc.documentElement.dataset.scanFull=String(fullBleed)
    if(!doc.getElementById('showcase-full-scan')){
      const style=doc.createElement('style');style.id='showcase-full-scan'
      style.textContent='html[data-scan-full="true"] #replica-safe-area{padding:0}html[data-scan-full="true"] .reference-segments,html[data-scan-full="true"] .reference-intro-sweep{display:none}html[data-scan-full="true"] .reference-scan{position:relative;padding:0;overflow:hidden}html[data-scan-full="true"] .reference-scan>div:first-child{position:absolute;top:60px;left:0;right:0;z-index:5}html[data-scan-full="true"] .reference-photo{position:absolute;inset:0;width:100%;height:100%;aspect-ratio:auto}html[data-scan-full="true"] .reference-photo-clip{border:0;border-radius:0}'
      doc.head.appendChild(style)
    }
  },[loaded,fullBleed])
  return <div ref={host} className="replica-native-host">
    <iframe ref={frame} title={label} tabIndex={-1} className="replica-native-frame" style={{width:402,height:nativeHeight,transform:`scale(${scale})`}} onLoad={() => setLoaded(true)} srcDoc={'<!doctype html><html class="dark"><head><meta name="viewport" content="width=402,initial-scale=1"></head><body><div id="replica-root"></div></body></html>'} />
  </div>
}
