import { useEffect, useRef } from 'react'

// Follow replies only while the reader is already at the end of the conversation.
export default function useCoachScroll(endRef, enabled, revision) {
  const following = useRef(true)
  useEffect(() => {
    if (!enabled) return
    const container = endRef.current?.closest('[data-coach-scroll]')
    if (!container) return
    const track = () => { following.current = container.scrollHeight - container.scrollTop - container.clientHeight < 48 }
    const follow = () => { if (following.current) container.scrollTop = container.scrollHeight }
    const resize = new ResizeObserver(follow)
    const observe = () => { resize.disconnect(); resize.observe(container); for (const child of container.children) resize.observe(child); follow() }
    const changes = new MutationObserver(observe)
    container.addEventListener('scroll', track, { passive: true })
    changes.observe(container, { childList: true, subtree: true, characterData: true })
    observe()
    return () => { resize.disconnect(); changes.disconnect(); container.removeEventListener('scroll', track) }
  }, [enabled, endRef])
  useEffect(() => {
    const container = endRef.current?.closest('[data-coach-scroll]')
    if (container && following.current) container.scrollTop = container.scrollHeight
  }, [revision, endRef])
  return () => { following.current = true }
}
