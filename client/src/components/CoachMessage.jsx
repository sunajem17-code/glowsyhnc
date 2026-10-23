import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ArrowUpRight, ShoppingBag } from 'lucide-react'
import { blockText, coachRevealCount, parseCoachMessage, safeCoachLink } from '../utils/coachMessage'
import './CoachMessage.css'

function InlineText({ text }) {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__|https?:\/\/[^\s]+)/g).map((part, index) => {
    if (/^(\*\*|__)/.test(part)) return <strong key={index}>{part.replace(/\*\*|__/g, '')}</strong>
    if (/^https?:\/\//.test(part)) {
      const url = safeCoachLink(part)
      return url ? <a key={index} href={url} target="_blank" rel="noopener noreferrer">View reference</a> : <span key={index}>[link unavailable]</span>
    }
    return <span key={index}>{part.replace(/\*\*|__/g, '')}</span>
  })
}
export default function CoachMessage({ content, reveal = false }) {
  const reducedMotion = useReducedMotion()
  const blocks = useMemo(() => parseCoachMessage(content), [content])
  const total = blocks.reduce((length, block) => length + blockText(block).length, 0)
  const [visible, setVisible] = useState(reveal ? 0 : total)
  const root = useRef(null)
  const stickToBottom = useRef(true)
  const typing = reveal && !reducedMotion && visible < total
  useEffect(() => {
    if (!reveal || reducedMotion) return
    let frame
    const started = performance.now()
    const tick = now => {
      const count = coachRevealCount(now - started, total)
      setVisible(count)
      if (count < total) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [content, reveal, reducedMotion, total])
  useEffect(() => {
    const container = root.current?.closest('[data-coach-scroll]')
    if (!container) return
    const track = () => { stickToBottom.current = container.scrollHeight - container.scrollTop - container.clientHeight < 90 }
    track()
    container.addEventListener('scroll', track, { passive: true })
    return () => container.removeEventListener('scroll', track)
  }, [])
  useEffect(() => {
    const container = root.current?.closest('[data-coach-scroll]')
    if (reveal && stickToBottom.current && container) container.scrollTop = container.scrollHeight
  }, [visible, reveal])
  let remaining = !reveal || reducedMotion ? total : visible
  return <div ref={root} className="coach-reply" aria-busy={typing}>
    {blocks.map((block, index) => {
      const fullText = blockText(block)
      const shown = fullText.slice(0, Math.max(0, remaining))
      remaining -= fullText.length
      if (!shown) return null
      if (block.type === 'product') {
        const name = shown.slice(0, block.name.length)
        const reason = shown.slice(block.name.length + 1)
        return <article key={index} className="coach-product"><ShoppingBag size={18} aria-hidden="true" /><div><h3>{name}</h3>{reason && <p><InlineText text={reason} /></p>}{shown.length === fullText.length && <a href={block.url} target="_blank" rel="noopener noreferrer sponsored">View on Amazon<ArrowUpRight size={14} /></a>}</div></article>
      }
      if (block.type === 'disclosure') return <p key={index} className="coach-disclosure">{shown}</p>
      if (block.type === 'step') return <div key={index} className="coach-step"><span className="coach-step-number">{block.number}</span><p><InlineText text={shown} /></p></div>
      return <p key={index}><InlineText text={shown} /></p>
    })}
    {typing && <span className="coach-typing-cursor" aria-hidden="true" />}
    <span className="sr-only" aria-live="polite">{typing ? 'Adonis is typing' : 'Adonis reply complete'}</span>
  </div>
}
