import { useEffect, useState } from 'react'
import { triggerHaptic } from './haptics'

export default function useTypewriter(text, speed = 38, startDelay = 0) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    if (!text) return
    let interval
    const timeout = setTimeout(() => {
      let i = 0
      interval = setInterval(() => {
        setDisplayed(text.slice(0, ++i))
        triggerHaptic()
        if (i >= text.length) clearInterval(interval)
      }, speed)
    }, startDelay)
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [text, speed, startDelay])
  return displayed
}
