import { useEffect, useState } from 'react'
export default function ScreenLoading() {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 7000); return () => clearTimeout(timer) }, [])
  return <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center" style={{background:'var(--bg)',color:'var(--text-primary)'}} role="status" aria-live="polite">
    <p className="font-body text-sm">{slow ? 'This screen is taking longer to load.' : 'Loading your next screen…'}</p>
    {slow && <><p className="text-sm text-secondary">For live preview, keep your Mac running and both devices on the same Wi-Fi.</p><button type="button" onClick={()=>window.location.reload()} className="rounded-xl px-6 py-3 font-bold" style={{background:'#C6A85C',color:'#0A0A0A'}}>Reload screen</button></>}
  </div>
}
