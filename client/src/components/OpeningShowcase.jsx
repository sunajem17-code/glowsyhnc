import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Pause, Play, RotateCcw, Signal, Wifi, BatteryFull } from 'lucide-react'
import { AnalyzingScreen } from '../pages/Scan'
import { LockedRevealScreen } from '../pages/ScanUnlockGate'
import { PRESENTATION_END } from '../utils/scanPresentation'
import ActualAppViewport from './ActualAppViewport'
import GlowUpPlanShowcase, { SHOWCASE_BODY_CHECKS, SHOWCASE_FACE_CHECKS } from './GlowUpPlanShowcase'
import StreakShowcase from './StreakShowcase'
import afterPhone from '../assets/opening-showcase/after-phone-hd.png'
import before from '../assets/opening-showcase/before.jpg'
import homeSelfie from '../assets/opening-showcase/home-selfie-before.png'
import points from '../assets/opening-showcase/home-selfie-landmarks.json'
import result from '../assets/opening-showcase/actual-scan.json'
import provenance from '../assets/opening-showcase/provenance.json'
import deviceFrame from '../assets/opening-showcase/iphone-16-pro-black-titanium.png'
import './openingShowcase.css'

/*
  Choreography taken frame by frame from the approved screen recording (9.77s, real time).
  All times are real milliseconds; the loop plays at 1x.

    Before the film: the phone rests on white while the real Ascendus analysis scans the face (SCAN_MS), then:
    0    -  300  phone settles
    300  -  560  push into the phone, scan dissolves into the real results screen
    560  - 1150  close in on the first metric cards (tilted)
    1150 - 2000  slow drift down the real metric cards
    2000 - 2700  pan across to the next cards (tilt reverses)
    (inserted at 2600, PROCON_MS) the real Pros and Cons screens, camera eases to a straight-on full phone
    2650 - 2900  dissolve to the 12-week plan countdown
    2900 - 5800  countdown ring fills while the number falls to 0 (ring colour shifts red -> cyan)
    5800 - 6500  zero pulses
    6300 - 6800  glitch dissolve into the after portrait (AI-generated visualization)
    6300 - 7900  after portrait fills the frame
    7900 - 8450  camera pulls back to the phone on white
    8450 - 9300  phone rests
    9300 - 9770  phone slides away, and slides back in at 0 for a seamless loop
*/
const SCAN_MS = 3300 // the real analysis sequence, compressed, on the phone at rest
const FILM_MS = 9770
const PROCON_AT = 2600 // film time where the feature reel (real app screens) is shown
// Reel scenes, in reel-local ms: Pros, Cons (both scrolling), Face plan, Body plan, Streak.
const REEL_SCENES = [0, 1100, 2200, 4400, 5900]
const PROCON_MS = 6800
const SIGN_HOLD = 600 // the after portrait holds this long so the sign can be read
export const OPENING_AD_DURATION = SCAN_MS + FILM_MS + PROCON_MS + SIGN_HOLD
const COUNT_START = 2900
const COUNT_END = 5800
const DAYS = 84 // the real 12-week plan, 12 x 7 days

const noop = () => {}
const clamp = n => Math.max(0, Math.min(1, n))
const clampTo = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const ease = n => n * n * n * (n * (n * 6 - 15) + 10) // smootherstep: gentler starts and stops
const seg = (t, a, b, v0, v1) => v0 + (v1 - v0) * ease(clamp((t - a) / (b - a)))

// Ring colour as the days fall: red -> orange -> yellow -> lime -> green -> cyan (matches the reference).
const HUE_STOPS = [[0, -10], [.35, -8], [.5, 22], [.58, 50], [.68, 85], [.78, 125], [.9, 130], [.94, 178], [1, 182]]
const hueAt = p => {
  for (let i = 1; i < HUE_STOPS.length; i++) {
    if (p <= HUE_STOPS[i][0]) {
      const [p0, h0] = HUE_STOPS[i - 1], [p1, h1] = HUE_STOPS[i]
      return h0 + (h1 - h0) * ease(clamp((p - p0) / (p1 - p0)))
    }
  }
  return HUE_STOPS[HUE_STOPS.length - 1][1]
}

export default function OpeningShowcase({ onStart, previewTime = null }) {
  const reduced = useReducedMotion()
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [ready, setReady] = useState(false)
  const [photo, setPhoto] = useState(null)
  const clock = useRef(0)
  const stageRef = useRef(null)
  const cameraRef = useRef(null)
  const displayRef = useRef(null)
  const [geometry, setGeometry] = useState({ width: 390, height: 506, phoneHeight: 496, displayWidth: 222 })
  useEffect(() => {
    const measure = () => {
      if (!stageRef.current || !cameraRef.current || !displayRef.current) return
      const next = { width: stageRef.current.clientWidth, height: stageRef.current.clientHeight, phoneHeight: parseFloat(getComputedStyle(cameraRef.current).height), displayWidth: parseFloat(getComputedStyle(displayRef.current).width) }
      setGeometry(old => Object.keys(next).every(key => old[key] === next[key]) ? old : next)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stageRef.current); observer.observe(displayRef.current); measure()
    return () => observer.disconnect()
  }, [])
  const time = previewTime ?? (reduced ? SCAN_MS + 1300 : elapsed)
  useEffect(() => {
    let active = true, url
    fetch(before).then(r => r.blob()).then(blob => { url = URL.createObjectURL(blob); if (active) setPhoto(url) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [])
  useEffect(() => {
    if (paused || reduced || !ready || previewTime != null) return
    let last = performance.now(), paint = last, id
    const tick = now => {
      if (!document.hidden) clock.current = (clock.current + Math.min(now - last, 100)) % OPENING_AD_DURATION
      last = now
      if (now - paint >= 15) { setElapsed(clock.current); paint = now }
      id = requestAnimationFrame(tick)
    }
    const resume = () => { last = performance.now() }
    document.addEventListener('visibilitychange', resume); id = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(id); document.removeEventListener('visibilitychange', resume) }
  }, [paused, reduced, ready, previewTime])
  const seek = value => { clock.current = value; setElapsed(value) }

  // This immutable record contains the genuine API response for the approved synthetic portrait.
  // It is passed directly to the real results components, never written into the user's store.
  const scan = useMemo(() => ({ id: result.scanId, serverScanId: result.scanId, facePhotoUrl: photo, scanDate: provenance.capturedAt.slice(0, 10), analyzedAt: provenance.capturedAt, aiScore: result, glowScore: result.overallScore, tier: result.tier, resultsUnlocked: true, progressSavedAt: provenance.capturedAt }), [photo])

  const tr = Math.max(0, time - SCAN_MS) // film time after the scan, including the Pros and Cons beat
  const u = tr <= PROCON_AT ? tr : Math.max(PROCON_AT, tr - PROCON_MS) // the rest of the film holds while the reel plays
  const t = u <= 7900 ? u : Math.max(7900, u - SIGN_HOLD) // and again while the glow-up sign is up
  const pcT = tr - PROCON_AT // reel-local time (negative before the reel)
  const proBlend = ease(clamp(pcT / 520)) * (pcT > PROCON_MS ? 0 : 1) // camera eases to the straight-on whole phone and holds
  const proLayer = ease(clamp((pcT - 80) / 320)) // stays up; the countdown covers the exit
  const sceneOpacity = i => proLayer * (i === 0 ? 1 : ease(clamp((pcT - REEL_SCENES[i] + 140) / 280))) * (i === REEL_SCENES.length - 1 ? 1 : 1 - ease(clamp((pcT - REEL_SCENES[i + 1] + 140) / 280)))
  const sceneT = i => pcT - REEL_SCENES[i]
  const reelMounted = time >= SCAN_MS + PROCON_AT - 1800
  const scanProgress = clamp(time / SCAN_MS)
  const fullScale = Math.min(3.2, geometry.width / (geometry.displayWidth * .86))
  const metricScale = Math.min(5.4, geometry.width / (geometry.displayWidth * .48))
  const portraitPhase = t >= 6300

  // Camera parameters. Each property has its own window so motion overlaps like a continuous move.
  let scale, focus, nativeX, framed, tilt, roll, rotateX
  if (portraitPhase) {
    const back = ease(clamp((t - 7900) / 550))
    scale = fullScale + (1 - fullScale) * back
    focus = 370; nativeX = 201; framed = 1 - back; tilt = 0; roll = 0; rotateX = 0
  } else {
    scale = t < 560 ? seg(t, 300, 560, 1, fullScale) : seg(t, 560, 1150, fullScale, metricScale)
    focus = t < 560 ? 290 : t < 1150 ? seg(t, 560, 1150, 290, 353) : t < 2000 ? seg(t, 1150, 2000, 353, 523) : seg(t, 2000, 2700, 523, 588)
    nativeX = t < 560 ? 201 : t < 1150 ? seg(t, 560, 1150, 201, 117) : t < 2000 ? seg(t, 1150, 2000, 117, 201) : seg(t, 2000, 2700, 201, 261)
    framed = seg(t, 300, 560, 0, 1)
    tilt = t < 2000 ? seg(t, 560, 1150, 0, -10) : seg(t, 2000, 2500, -10, 8)
    roll = t < 2000 ? seg(t, 560, 1150, 0, -3) : seg(t, 2000, 2500, -3, 3)
    rotateX = seg(t, 560, 1150, 0, 5)
  }
  const proScale = Math.min(fullScale, geometry.height * .94 / geometry.phoneHeight) // whole phone in frame
  if (proBlend > 0) {
    scale += (proScale - scale) * proBlend; focus += (437 - focus) * proBlend; nativeX += (201 - nativeX) * proBlend
    tilt *= 1 - proBlend; roll *= 1 - proBlend; rotateX *= 1 - proBlend; framed = 1
    scale *= 1 + .05 * clamp(pcT / PROCON_MS) // a slow push through the reel keeps it alive
  }
  const origin = geometry.phoneHeight * .46
  const screenPoint = geometry.phoneHeight * .025 + focus * (geometry.displayWidth / 402)
  const center = (geometry.height - geometry.phoneHeight) / 2 + origin + (screenPoint - origin) * scale
  const slide = (time < 260 ? 1.05 * (1 - ease(clamp(time / 260))) : t > 9300 ? 1.05 * ease(clamp((t - 9300) / 470)) : 0) * geometry.height
  const y = framed * (geometry.height * .5 - center) + slide
  const x = framed * (201 - nativeX) * (geometry.displayWidth / 402) * scale
  const cameraOpacity = t >= 2900 && t < 6300 ? 0 : 1

  // Layers inside the phone display.
  const analysisOpacity = 1 - ease(clamp((t - 300) / 320))
  const resultsOpacity = ease(clamp((t - 300) / 320)) * (portraitPhase ? 0 : 1) * (1 - proLayer)
  const afterOpacity = ease(clamp((t - 6500) / 300))
  const afterZoom = 1 + .5 * (1 - ease(clamp((t - 7800) / 600)))
  const pushBlur = 6 * Math.sin(Math.PI * clamp((t - 300) / 300))

  // Countdown (the real 12-week plan, 84 days).
  const countProgress = 1 - (1 - clamp((t - COUNT_START) / (COUNT_END - COUNT_START))) ** 1.3
  const countDays = Math.round(DAYS * (1 - countProgress))
  const countSpeed = t > COUNT_START && t < COUNT_END ? DAYS * 1.3 * (1 - clamp((t - COUNT_START) / (COUNT_END - COUNT_START))) ** .3 / ((COUNT_END - COUNT_START) / 1000) : 0
  const hue = hueAt(countProgress)
  const countColor = `hsl(${hue} ${countProgress > .93 ? 100 : 88}% ${countProgress > .93 ? 50 : 58}%)`
  const reelOut = ease(clamp((pcT - PROCON_MS + 420) / 420)) // the last reel scene dissolves into the countdown
  const countAlpha = Math.max(ease(clamp((t - 2650) / 250)), t < 2900 ? reelOut : 0) * (1 - ease(clamp((t - 6450) / 350)))
  const pulse = t < 5900 ? 1 : t < 6000 ? 1 - .7 * ease((t - 5900) / 100) : t < 6500 ? .65 + .35 * Math.cos(2 * Math.PI * (t - 6250) / 500) : .3
  const glitch = Math.sin(Math.PI * clamp((t - 6300) / 600))
  const circumference = 2 * Math.PI * 118
  const signIn = ease(clamp((u - 6850) / 480)) // "This is your glow up" lands with the after portrait
  const signOpacity = signIn * (1 - ease(clamp((u - (7900 + SIGN_HOLD - 350)) / 350)))
  const signFont = geometry.width * .15

  const analysisScreen = useMemo(() => <AnalyzingScreen photo={homeSelfie} points={points} previewElapsed={PRESENTATION_END * scanProgress} embeddedOverlay />, [scanProgress])
  const lock = { scan, unlocked: true, canAccessProUi: true, hideNavigationButton: false, savedProgressCard: true, onClose: noop }
  const prosScreen = useMemo(() => <LockedRevealScreen {...lock} initialView="photo" appearancePage="pros" />, [scan]) // eslint-disable-line react-hooks/exhaustive-deps
  const consScreen = useMemo(() => <LockedRevealScreen {...lock} initialView="photo" appearancePage="cons" />, [scan]) // eslint-disable-line react-hooks/exhaustive-deps
  const faceCount = clampTo(Math.floor((sceneT(2) - 250) / ((REEL_SCENES[3] - REEL_SCENES[2] - 600) / SHOWCASE_FACE_CHECKS)), 0, SHOWCASE_FACE_CHECKS)
  const bodyCount = clampTo(Math.floor((sceneT(3) - 300) / ((REEL_SCENES[4] - REEL_SCENES[3] - 600) / SHOWCASE_BODY_CHECKS)), 0, SHOWCASE_BODY_CHECKS)
  const flame = Math.round(ease(clamp((sceneT(4) - 60) / 560)) * 20) / 20
  const faceScreen = useMemo(() => <GlowUpPlanShowcase section="face" period="all" completedCount={faceCount} />, [faceCount])
  const bodyScreen = useMemo(() => <GlowUpPlanShowcase section="body" completedCount={bodyCount} completedFaceCount={SHOWCASE_FACE_CHECKS} />, [bodyCount])
  const streakScreen = useMemo(() => <StreakShowcase showGoals={false} fillProgress={flame} />, [flame])
  const resultsScreen = useMemo(() => <LockedRevealScreen scan={scan} unlocked canAccessProUi hideNavigationButton={false} savedProgressCard initialView="results" appearancePage="cons" onClose={noop} />, [scan])

  return <main className="opening-showcase">
    <section className="opening-theater" aria-label="Ascendus actual app screens in an iPhone 16 Pro">
      <div ref={stageRef} className="replica-stage replica-stage--light" data-time={Math.round(time)}>
        <motion.div ref={cameraRef} className="replica-camera" initial={false} style={{ x, y, scale, rotateY: reduced ? 0 : tilt, rotateZ: reduced ? 0 : roll, rotateX: reduced ? 0 : rotateX, opacity: cameraOpacity, transformPerspective: 1100 }}>
          <div className="replica-device replica-device--flip" aria-label="Apple iPhone 16 Pro, Black Titanium" style={{ '--device-detail-frame': 1 }}>
            <div className="replica-device-back" aria-hidden="true"><div className="replica-rear-camera"><i /><i /><i /><b /><em /></div></div>
            <div ref={displayRef} className="replica-display" style={{ filter: pushBlur > .05 ? `blur(${pushBlur.toFixed(2)}px)` : 'none' }}>
              <div className="replica-screen-scene" data-persistent-analysis aria-hidden={analysisOpacity < .5} style={{ zIndex: 1, opacity: analysisOpacity, pointerEvents: 'none' }}>
                <ActualAppViewport label="Actual Ascendus scan screen" onReady={() => setReady(true)} fullBleed>{analysisScreen}</ActualAppViewport>
              </div>
              {photo && <div className="replica-screen-scene" style={{ zIndex: 2, opacity: resultsOpacity }}>
                <ActualAppViewport label="Actual Ascendus results screen" onReady={() => setReady(true)}>{resultsScreen}</ActualAppViewport>
              </div>}
              {photo && reelMounted && <>
                <div className="replica-screen-scene" style={{ zIndex: 2, opacity: sceneOpacity(0), pointerEvents: 'none' }}><ActualAppViewport label="Actual Ascendus pros screen" onReady={() => setReady(true)} scrollProgress={ease(clamp((sceneT(0) - 150) / 800))}>{prosScreen}</ActualAppViewport></div>
                <div className="replica-screen-scene" style={{ zIndex: 3, opacity: sceneOpacity(1), pointerEvents: 'none' }}><ActualAppViewport label="Actual Ascendus cons screen" onReady={() => setReady(true)} scrollProgress={ease(clamp((sceneT(1) - 150) / 800))}>{consScreen}</ActualAppViewport></div>
                <div className="replica-screen-scene" style={{ zIndex: 4, opacity: sceneOpacity(2), pointerEvents: 'none' }}><ActualAppViewport label="Actual Ascendus face plan" onReady={() => setReady(true)}>{faceScreen}</ActualAppViewport></div>
                <div className="replica-screen-scene" style={{ zIndex: 5, opacity: sceneOpacity(3), pointerEvents: 'none' }}><ActualAppViewport label="Actual Ascendus body plan" onReady={() => setReady(true)}>{bodyScreen}</ActualAppViewport></div>
                <div className="replica-screen-scene" style={{ zIndex: 6, opacity: sceneOpacity(4), pointerEvents: 'none' }}><ActualAppViewport label="Actual Ascendus streak" onReady={() => setReady(true)}>{streakScreen}</ActualAppViewport></div>
              </>}
              <div className="opening-transformation" aria-label="AI-generated after visualization" style={{ opacity: afterOpacity, filter: `grayscale(${(1 - ease(clamp((t - 6600) / 350))).toFixed(2)})`, zIndex: 7 }}>
                <img className="opening-selfie-full" src={afterPhone} alt="AI-generated after visualization" style={{ transform: `scale(${afterZoom.toFixed(3)})`, transformOrigin: '50% 40%' }} />
              </div>
              <div className="replica-ios-status" aria-hidden="true"><span>9:41</span><div><Signal /><Wifi /><BatteryFull /></div></div>
              <i className="replica-home-indicator" aria-hidden="true" />
            </div>
            <img className="replica-official-bezel" src={deviceFrame} alt="Official Apple iPhone 16 Pro Black Titanium bezel" style={{ opacity: portraitPhase ? seg(t, 7500, 7900, 0, 1) : 1 }} />
          </div>
        </motion.div>

        {countAlpha > .001 && <div className="showcase-plan-countdown" style={{ opacity: countAlpha }} aria-label="12-week plan progression visualization">
          <div className="plan-countdown-dial" style={{ '--countdown-color': countColor, opacity: pulse }}>
            <svg viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="118" fill="none" stroke="#1a2123" strokeWidth="7" /><circle cx="140" cy="140" r="118" fill="none" stroke={countColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.max(countProgress, .004))} transform="rotate(-90 140 140)" style={{ filter: `drop-shadow(0 0 7px ${countColor})` }} /></svg>
            <div className="plan-countdown-type"><strong aria-hidden="true" style={{ filter: countSpeed > 1 ? `blur(${Math.min(1.6, countSpeed * .035).toFixed(2)}px)` : 'none' }}>{countDays}</strong><span>DAYS</span><b>12-WEEK PLAN</b></div>
          </div>
          {glitch > .01 && <div className="showcase-glitch" aria-hidden="true" style={{ opacity: glitch, backgroundPositionY: `${Math.round(t / 4) % 24}px` }} />}
        </div>}
        {signOpacity > .001 && <div className="opening-glowup" aria-label="This is your glow up" style={{ opacity: signOpacity }}>
          <div className="opening-glowup-scrim" />
          <div className="opening-glowup-text" style={{ transform: `translateY(${((1 - signIn) * 18).toFixed(1)}px)`, filter: signIn < .98 ? `blur(${((1 - signIn) * 6).toFixed(1)}px)` : 'none' }}>
            <span className="opening-glowup-brand" style={{ fontSize: signFont * .27 }}>ASCENDUS</span>
            <strong className="opening-glowup-line" style={{ fontSize: signFont * .6 }}>THIS IS YOUR</strong>
            <strong className="opening-glowup-hero" style={{ fontSize: signFont * 1.02 }}>GLOW UP</strong>
            <i className="opening-glowup-rule" style={{ transform: `scaleX(${ease(clamp((u - 7050) / 500)).toFixed(3)})` }} />
          </div>
        </div>}
      </div>
      <div className="opening-ad-transport">
        <button type="button" aria-label="Replay ad" onClick={() => seek(0)}><RotateCcw size={13} /></button>
        <button type="button" aria-label={reduced ? 'Replay ad' : paused ? 'Play ad' : 'Pause ad'} onClick={() => setPaused(v => !v)}>{paused || reduced ? <Play size={14} /> : <Pause size={14} />}</button>
      </div>
    </section>
    <div className="opening-copy"><h1>Get your personalized<br />analysis</h1><p>Your results. Your strengths. Your next steps.</p><button className="opening-start" type="button" onClick={onStart}>Get Started <ArrowRight size={19} /></button></div>
  </main>
}
