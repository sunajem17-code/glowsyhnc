import { useCallback, useRef, useState } from 'react'
import { useMotionValue, animate } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

// Left-edge hit width — matches the width iOS's own edge-pan recognizer uses,
// which keeps this from fighting interior horizontal gestures (CompareSlider,
// etc.) since those never start a drag from the literal screen edge.
const EDGE_ZONE_PX = 24
const COMMIT_DISTANCE_RATIO = 0.35
const COMMIT_VELOCITY = 600 // px/s — a fast flick commits regardless of distance
const RUBBER_BAND_START_RATIO = 0.7
const RUBBER_BAND_CONSTANT = 0.55

// Same soft-boundary formula as the rest of the fluid-interface guidance —
// resistance grows the further past the soft limit the finger travels.
function rubberband(overshoot, dimension, constant = RUBBER_BAND_CONSTANT) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

// Drives the interruptible edge-swipe-to-go-back gesture used by Layout.
// Returns a motion value (`x`) to bind onto the current page's transform,
// pointer handlers to attach to a thin left-edge hit zone, and the release
// data Layout needs to hand off into the exit variant on a committed swipe.
export function useSwipeBack({ enabled }) {
  const navigate = useNavigate()
  const x = useMotionValue(0)
  const [swipeExit, setSwipeExit] = useState(null) // { velocity } while a commit's exit plays

  const dragging       = useRef(false)
  const pointerId      = useRef(null)
  const startX         = useRef(0)
  const dragBaseX      = useRef(0)
  const lastX          = useRef(0)
  const lastT          = useRef(0)
  const velocity       = useRef(0)
  const containerWidth = useRef(window.innerWidth)
  const activeAnim     = useRef(null)

  const onPointerDown = useCallback((e) => {
    if (!enabled || swipeExit) return
    // #root is centered (margin: auto) above its own max-width on wide
    // viewports, so both the edge-zone check and the drag math below need
    // measurements against the app's own rendered width/position, not the
    // raw browser viewport — otherwise this only behaves correctly at true
    // mobile widths where #root happens to fill the viewport exactly.
    const rect = e.currentTarget.parentElement.getBoundingClientRect()
    const localX = e.clientX - rect.left
    if (localX > EDGE_ZONE_PX) return
    containerWidth.current = rect.width
    dragging.current = true
    pointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    startX.current = e.clientX
    dragBaseX.current = x.get() // continue from wherever x currently sits (interruptibility)
    lastX.current = e.clientX
    lastT.current = performance.now()
    velocity.current = 0
    activeAnim.current?.stop()
  }, [enabled, swipeExit, x])

  const onPointerMove = useCallback((e) => {
    if (!dragging.current || e.pointerId !== pointerId.current) return
    const now = performance.now()
    const dt = now - lastT.current
    if (dt > 0) velocity.current = ((e.clientX - lastX.current) / dt) * 1000
    lastX.current = e.clientX
    lastT.current = now

    const width = containerWidth.current
    const raw   = Math.max(0, dragBaseX.current + (e.clientX - startX.current))
    const softMax = width * RUBBER_BAND_START_RATIO
    const next = raw <= softMax ? raw : softMax + rubberband(raw - softMax, width)
    x.set(next)
  }, [x])

  const endDrag = useCallback((e) => {
    if (!dragging.current || e.pointerId !== pointerId.current) return
    dragging.current = false

    const width    = containerWidth.current
    const progress = x.get() / width
    const commit   = progress > COMMIT_DISTANCE_RATIO || velocity.current > COMMIT_VELOCITY

    if (commit) {
      triggerHaptic()
      setSwipeExit({ velocity: velocity.current, width })
      // Deferred a frame so the swipeExit state commits — and Layout re-renders
      // the still-current page with the updated `custom` — before navigate(-1)
      // changes the route key. AnimatePresence freezes the exiting element's
      // props at the render just before its key disappears, so without this
      // split, the exit variant would see custom=null and fall back to the
      // default fade instead of the velocity-aware slide-off.
      requestAnimationFrame(() => navigate(-1))
    } else {
      activeAnim.current = animate(x, 0, { ...SPRING_STANDARD, velocity: velocity.current })
    }
  }, [navigate, x])

  // Called once the committed exit's animation has actually finished (wired to
  // AnimatePresence's onExitComplete) so a fresh page starts clean.
  const resetAfterExit = useCallback(() => {
    setSwipeExit(null)
    x.set(0)
  }, [x])

  return {
    x,
    swipeExit,
    resetAfterExit,
    edgeHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
