import { useEffect, useState } from 'react'
import './scanReference.css'

// Decorative only: mounted by a successful scan navigation, never an API timer.
export default function ScanCelebration() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1600)
    return () => clearTimeout(timer)
  }, [])
  if (!visible) return null
  return <div className="scan-celebration" aria-hidden="true">
    {Array.from({ length: 36 }, (_, i) => <i key={i} style={{
      left: `${(i * 29) % 100}%`,
      background: ['#C6A85C', '#E0C988', '#fff0c4'][i % 3],
      '--drift': `${(i % 2 ? 1 : -1) * (20 + i % 7 * 8)}px`,
      '--turn': `${180 + i * 31}deg`,
      animationDelay: `${i % 6 * 45}ms`,
      borderRadius: i % 3 === 0 ? '50%' : '1px',
    }} />)}
  </div>
}
