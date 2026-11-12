import React from 'react'
import { createRoot } from 'react-dom/client'
import OpeningShowcase, { OPENING_AD_DURATION } from '../components/OpeningShowcase'
import '../index.css'
if (import.meta.env.DEV) {
  // Fixed timeline frames are only available in this development entry point.
  const raw = new URLSearchParams(window.location.search).get('at')
  const previewTime = raw != null && Number.isFinite(Number(raw)) ? Math.max(0, Math.min(OPENING_AD_DURATION - 1, Number(raw))) : null
  createRoot(document.getElementById('root')).render(<OpeningShowcase previewTime={previewTime} onStart={() => { window.location.href = '/onboarding' }} />)
}
