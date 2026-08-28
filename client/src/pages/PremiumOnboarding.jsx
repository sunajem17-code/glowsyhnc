import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Loader2, Heart, Star, Sparkles, Bone, ScanLine, Scale, Dumbbell, Scissors, Flame, Zap, Shield, Check, X, Trophy, User, UserRound } from 'lucide-react'
import useStore from '../store/useStore'
import { api, setScanInFlight } from '../utils/api'
import logo from '../assets/ascendus-icon.png'
import { PhotoUploadStep, AnalyzingScreen, ANALYSIS_STEPS } from './Scan'
import { generatePlanTasks } from '../utils/content'
import { assignPhase } from '../utils/phase'
import { isNative } from '../utils/iap'
// SignInWithApple loaded dynamically per-call (see handleAppleSignIn)
import { Capacitor } from '@capacitor/core'
import { FirebaseAnalytics } from '@capacitor-firebase/analytics'
import { getDeviceId } from '../utils/deviceId'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import MotionPage from '../components/MotionPage'

// Analytics collection ships disabled by default (see GoogleService-Info.plist's
// IS_ANALYTICS_ENABLED) and is turned on here, once the user has actually agreed
// to it in StepConsent. No-op on web — no native bridge, and no web Firebase app
// configured yet either.
async function enableAnalytics() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await FirebaseAnalytics.setEnabled({ enabled: true })
  } catch {
    // analytics unavailable — not fatal, ignore
  }
}

async function logAnalyticsEvent(name, params) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await FirebaseAnalytics.logEvent({ name, params })
  } catch {
    // analytics unavailable — not fatal, ignore
  }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
// BG/TEXT/DIM now pull from index.css's shared --bg/--text-primary/--text-secondary
// custom properties (root wrapper below applies the "dark" scope so they resolve
// correctly — .dark isn't otherwise activated anywhere in the app). --text-secondary
// itself is overridden locally on that same wrapper: its shared .dark value
// (#4A4642) is calibrated for light-card text, not for overlay text on this
// near-black background, and doesn't meet the 4.5:1 contrast floor here.
const G = GOLD
const G_DIM = 'rgba(198,168,92,0.10)'
const G_BORDER = 'rgba(198,168,92,0.28)'
const BG = 'var(--bg)'
const SURFACE = '#111111'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT = 'var(--text-primary)'
const DIM = 'var(--text-secondary)'

// Steps: 0=intro, 1=welcome, 2=signup, 3=consent, 4=gender, 5=goal, 6=heightweight, 7=scan
//         8=locked-reveal, 9=phase, 10=transformation, 11=rating
// Progress counter: only during data-collection steps (2–7)

// Draft persistence: survives a refresh/backgrounding mid-quiz. Session-scoped
// (not localStorage) and excludes password fields so nothing sensitive lingers.
const DRAFT_KEY = 'ascendus_onboarding_draft'

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // storage unavailable (private browsing, quota) — fail silently, non-critical
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

const pageVariants = {
  enter: (dir) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
}
const pageTrans = SPRING_STANDARD

// ── Shared UI ─────────────────────────────────────────────────────────────────
function ConsentMicroText() {
  const navigate = useNavigate()
  return (
    <p className="text-center mt-3 font-body" style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', lineHeight: 1.5 }}>
      By tapping Begin Scan, you agree to our{' '}
      <span
        role="link"
        className="underline cursor-pointer"
        style={{ color: 'rgba(255,255,255,0.45)' }}
        onClick={() => navigate('/terms')}
      >Terms</span>
      ,{' '}
      <span
        role="link"
        className="underline cursor-pointer"
        style={{ color: 'rgba(255,255,255,0.45)' }}
        onClick={() => navigate('/privacy')}
      >Privacy Policy</span>
      , and AI analysis.
    </p>
  )
}

function BackBtn({ onBack }) {
  return (
    <button
      onClick={onBack}
      aria-label="Go back"
      className="absolute left-5 w-9 h-9 rounded-full flex items-center justify-center z-10"
      style={{ background: 'rgba(255,255,255,0.06)', top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <ChevronLeft size={18} style={{ color: DIM }} />
    </button>
  )
}

function GoldBtn({ label, onClick, disabled, loading }) {
  function handleClick() {
    triggerHaptic()
    onClick?.()
  }
  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="btn-primary flex items-center justify-center gap-2"
      style={{ background: GOLD_GRADIENT }}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {label}
    </button>
  )
}

function Checkbox({ checked, onToggle, label, sub }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-start gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all"
      style={{
        background: checked ? 'rgba(198,168,92,0.08)' : SURFACE,
        border: `1.5px solid ${checked ? G_BORDER : BORDER}`,
      }}
    >
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: checked ? G : 'transparent',
          border: checked ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div className="flex-1">
        <p className="font-heading font-semibold text-[13px]" style={{ color: TEXT }}>{label}</p>
        {sub && <p className="font-body text-[11px] leading-relaxed mt-0.5" style={{ color: DIM }}>{sub}</p>}
      </div>
    </button>
  )
}

function OptionGrid({ options, selected, onSelect, cols = 2 }) {
  return (
    <div className={`grid grid-cols-${cols} gap-3`}>
      {options.map(({ key, emoji, label, desc }) => {
        const isSelected = selected === key
        return (
          <motion.button
            key={key}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(key)}
            className="flex flex-col items-start p-4 rounded-2xl text-left transition-all duration-150"
            style={{
              background: isSelected ? G_DIM : SURFACE,
              border: `1.5px solid ${isSelected ? G_BORDER : BORDER}`,
            }}
          >
            {emoji && <span className="text-2xl mb-2">{emoji}</span>}
            <p className="font-heading font-bold text-[13px]" style={{ color: isSelected ? G : TEXT }}>
              {label}
            </p>
            {desc && <p className="font-body text-[11px] leading-relaxed mt-0.5" style={{ color: DIM }}>{desc}</p>}
          </motion.button>
        )
      })}
    </div>
  )
}

function Slider({ label, unit, value, displayValue, min, max, step = 1, onChange }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const pct = ((value - min) / (max - min)) * 100

  function calcValue(clientX) {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + ratio * (max - min)
    return Math.max(min, Math.min(max, Math.round(raw / step) * step))
  }

  function onPointerDown(e) {
    dragging.current = true
    trackRef.current.setPointerCapture(e.pointerId)
    onChange(calcValue(e.clientX))
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    onChange(calcValue(e.clientX))
  }

  function onPointerUp() {
    dragging.current = false
  }

  function onKeyDown(e) {
    const big = (max - min) / 20 || step
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(max, Math.round((value + step) / step) * step))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(min, Math.round((value - step) / step) * step))
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      onChange(Math.min(max, Math.round((value + big) / step) * step))
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      onChange(Math.max(min, Math.round((value - big) / step) * step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(min)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(max)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-[11px] font-heading font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {label}
        </span>
        <span className="font-heading font-bold text-[30px]" style={{ color: G, letterSpacing: '-0.02em' }}>
          {displayValue ?? value}<span className="text-[14px] ml-1" style={{ color: 'rgba(198,168,92,0.55)' }}>{unit}</span>
        </span>
      </div>

      {/* Track — pointer events handle both touch and mouse */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${displayValue ?? value}${unit || ''}`}
        className="relative flex items-center select-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A85C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
        style={{ height: 48, touchAction: 'none', cursor: 'pointer' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {/* Background track */}
        <div className="absolute inset-x-0 rounded-full" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }} />
        {/* Filled track */}
        <div
          className="absolute left-0 rounded-full"
          style={{ height: 4, width: `${pct}%`, background: `linear-gradient(90deg, #A8893A, ${G})` }}
        />
        {/* Thumb */}
        <div
          className="absolute rounded-full"
          style={{
            width: 28,
            height: 28,
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            background: G,
            border: `2.5px solid ${BG}`,
            boxShadow: `0 0 0 4px rgba(198,168,92,0.18), 0 0 14px rgba(198,168,92,0.45)`,
            pointerEvents: 'none',
          }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.2)' }}>{min}</span>
        <span className="text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.2)' }}>{max}</span>
      </div>
    </div>
  )
}

// ── STEP 0: Welcome ───────────────────────────────────────────────────────────
const SOCIAL_STATS = [
  { value: 'Countless', label: 'lives improved' },
  { value: '+1.2pts', label: 'avg score in 90 days' },
  { value: '78%', label: 'complete their plan' },
]

function StepIntro({ onNext }) {
  return (
    <div className="flex flex-col h-full px-6">
      <div className="flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE_STANDARD }}
        >
          <p className="font-heading font-bold text-[28px] leading-tight mb-5" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
            First Impressions<br />Are Fast
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5 }}
          className="space-y-4"
        >
          <p className="font-body text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Research on social perception shows people form judgments about attractiveness, confidence, and trustworthiness within seconds of seeing a face, often before a single word is spoken. That snap judgment shapes dating, social, and even professional outcomes.
          </p>
          <p className="font-body text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            The good news: most of what drives that impression (grooming, skin, fitness, posture, style) is genuinely improvable, not fixed.
          </p>
          <p className="font-body text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Ascendus uses AI to show you exactly where you stand and what's actually worth working on, so you're not guessing.
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="pb-10 pt-4"
      >
        <GoldBtn label="Next" onClick={onNext} />
      </motion.div>
    </div>
  )
}

function StepWelcome({ onCreateAccount, onSignIn, onDemo }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col h-full px-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center items-center text-center pt-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE_STANDARD }}
          className="mb-4"
        >
          <img src={logo} alt="Ascendus" style={{ width: 200, mixBlendMode: 'lighten' }} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="font-heading font-bold text-[22px] mb-2"
          style={{ color: TEXT, letterSpacing: '-0.02em' }}
        >
          Brutally honest. Built to improve you.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="font-body text-[15px] leading-relaxed mb-5"
          style={{ color: DIM }}
        >
          Brutally accurate AI scoring<br />and a 12-week plan built for you.
        </motion.p>

        {/* Urgency badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
          style={{ background: 'rgba(198,168,92,0.1)', border: `1px solid ${G_BORDER}` }}
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: G }} />
          <span className="font-heading font-bold text-[12px]" style={{ color: G }}>
            Get your free score in 60 seconds
          </span>
        </motion.div>

        {/* Social proof stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.45 }}
          className="w-full grid grid-cols-3 gap-2 mb-2"
        >
          {SOCIAL_STATS.map(({ value, label }, i) => (
            <div
              key={i}
              className="rounded-2xl py-3 px-2 text-center"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
            >
              <p className="font-heading font-bold text-[16px]" style={{ color: G }}>{value}</p>
              <p className="font-body text-[10px] leading-tight mt-0.5" style={{ color: DIM }}>{label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="pb-10 pt-4 space-y-3">
        <GoldBtn label="Get Started" onClick={onCreateAccount} />
        <button
          onClick={onSignIn}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] transition-all"
          style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT }}
        >
          Sign In
        </button>
        <p className="text-center font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
          By continuing you agree to our{' '}
          <button onClick={() => navigate('/terms')} className="underline" style={{ color: 'rgba(198,168,92,0.65)' }}>Terms</button>
          {' '}and{' '}
          <button onClick={() => navigate('/privacy')} className="underline" style={{ color: 'rgba(198,168,92,0.65)' }}>Privacy Policy</button>
        </p>
        {onDemo && (
          <button
            onClick={onDemo}
            className="w-full py-2 font-body text-[11px]"
            style={{ color: 'rgba(255,255,255,0.18)', background: 'transparent', border: 'none' }}
          >
            App Review Demo Access
          </button>
        )}
      </div>
    </div>
  )
}

// ── SIGN IN MODE (inline) ─────────────────────────────────────────────────────
function SignInView({ onBack, onSuccess, onAppleSignIn }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth           = useStore(s => s.setAuth)
  const setHasOnboarded   = useStore(s => s.setHasOnboarded)
  const setLegalConsented = useStore(s => s.setLegalConsented)
  const setAgeConfirmed   = useStore(s => s.setAgeConfirmed)
  const setReferralCode   = useStore(s => s.setReferralCode)

  async function handleSignIn(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.auth.login({ email: form.email, password: form.password })
      setAuth(data.user, data.token)
      setReferralCode(String(data.user.id).substring(0, 8).toUpperCase())
      setLegalConsented()
      setAgeConfirmed()
      clearDraft()
      setHasOnboarded()
      onSuccess()
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    color: TEXT, borderColor: 'rgba(255,255,255,0.12)', background: SURFACE,
    borderWidth: 1, borderStyle: 'solid', borderRadius: 12, padding: '14px 16px',
    width: '100%', fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
  }

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20">
        <h1 className="font-heading font-bold text-[28px] mb-1" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          Welcome back.
        </h1>
        <p className="font-body text-[13px] mb-8" style={{ color: DIM }}>Sign in to continue your journey.</p>

        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <label className="text-[11px] font-body font-medium uppercase tracking-wide mb-1.5 block" style={{ color: DIM }}>Email</label>
            <input type="email" placeholder="you@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={inputStyle} required />
          </div>
          <div>
            <label className="text-[11px] font-body font-medium uppercase tracking-wide mb-1.5 block" style={{ color: DIM }}>Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} placeholder="Your password"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ ...inputStyle, paddingRight: 48 }} required />
              <button type="button" onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}
                className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: DIM }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-sm font-body" style={{ color: '#EF4444' }}>{error}</p>
            </div>
          )}

          <div className="pt-2 space-y-3">
            <GoldBtn label={loading ? 'Signing in…' : 'Sign In'} onClick={handleSignIn} loading={loading} />
            {Capacitor.getPlatform() === 'ios' && onAppleSignIn && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                  <span className="text-[11px] font-body" style={{ color: DIM }}>or</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                </div>
                <button
                  type="button"
                  onClick={onAppleSignIn}
                  className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] transition-all flex items-center justify-center gap-2"
                  style={{ background: '#FFFFFF', color: '#000000', border: 'none' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.39.07 2.36.74 3.18.8 1.22-.24 2.39-.93 3.7-.84 1.58.13 2.77.74 3.54 1.9-3.24 1.94-2.54 5.87.5 6.99-.58 1.59-1.36 3.15-2.92 4.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Sign in with Apple
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}


// ── STEP 4: Gender ────────────────────────────────────────────────────────────
// Mars symbol (♂) — stroke-based SVG
// Icons rebuilt from design handoff (Gender Onboarding.dc.html).
// Male: translate(9,0) from the original dc.html inlined into coordinates so cx=55
// (centered in 110-wide viewBox). Rendered at square 110×110 — this was the root
// cause of all prior centering issues (original had non-square 220×125 rendering).
// Female: already centered at cx=55 in the original file, unchanged.
function MarsIcon({ color }) {
  return (
    <svg width="144" height="144" viewBox="0 0 110 110" fill="none" style={{ display: 'block' }}>
      <circle cx="55" cy="64" r="26" stroke={color} strokeWidth="7" />
      <line x1="73" y1="46" x2="101" y2="18" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <polyline points="77,18 101,18 101,42" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function VenusIcon({ color }) {
  return (
    <svg width="144" height="144" viewBox="0 0 110 110" fill="none" style={{ display: 'block' }}>
      <circle cx="55" cy="38" r="26" stroke={color} strokeWidth="7" />
      <line x1="55" y1="64" x2="55" y2="98" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <line x1="39" y1="82" x2="71" y2="82" stroke={color} strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

const UMAX_PURPLE = 'linear-gradient(180deg, #9D4EDD 0%, #7B2FBE 100%)'
const UMAX_PURPLE_DIM = 'linear-gradient(180deg, #6B3FA0 0%, #512B8C 100%)'

function StepGender({ data, onChange, onNext }) {
  const [selected, setSelected] = useState(null)

  function pick(gender) {
    triggerHaptic()
    setSelected(gender)
    onChange('gender', gender)
    setTimeout(onNext, 220)
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 76px)' }}>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ color: '#ffffff', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}
        >
          Choose gender
        </motion.h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: '0 24px 24px' }}>
        {[
          { key: 'male', label: 'Male' },
          { key: 'female', label: 'Female' },
        ].map(({ key, label }, i) => (
          <motion.button
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => pick(key)}
            style={{
              width: '100%', padding: '22px 0',
              borderRadius: 50,
              background: selected === key ? UMAX_PURPLE_DIM : UMAX_PURPLE,
              border: 'none', cursor: 'pointer',
              color: '#ffffff', fontWeight: 700, fontSize: 20,
              fontFamily: 'inherit',
              boxShadow: selected === key ? 'none' : '0 4px 24px rgba(155,78,221,0.35)',
            }}
          >
            {label}
          </motion.button>
        ))}
      </div>

      <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)', textAlign: 'center' }}>
        <button
          onClick={() => { triggerHaptic(); onChange('gender', 'male'); onNext() }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 16, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          skip
        </button>
      </div>
    </div>
  )
}

// ── STEP REFERRAL ────────────────────────────────────────────────────────────
function StepReferral({ onNext }) {
  const [code, setCode] = useState('')

  function handleContinue() {
    triggerHaptic()
    // Store code in sessionStorage so it can be sent after auth
    if (code.trim()) {
      try { sessionStorage.setItem('asc_referral_code', code.trim().toUpperCase()) } catch {}
    }
    onNext()
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 76px)' }}>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ color: '#ffffff', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}
        >
          Do you have a referral code?
        </motion.h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 24px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <input
            type="text"
            placeholder="jX7yT2"
            value={code}
            onChange={e => setCode(e.target.value)}
            autoCapitalize="characters"
            maxLength={12}
            style={{
              width: '100%', padding: '20px 20px',
              borderRadius: 16,
              background: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#ffffff', fontSize: 18, fontWeight: 600, fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
              letterSpacing: '0.05em',
            }}
          />
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14, marginTop: 12, marginBottom: 32 }}>
            Enter your code here, or skip
          </p>
          <button
            onClick={handleContinue}
            style={{
              width: '100%', padding: '22px 0',
              borderRadius: 50,
              background: UMAX_PURPLE,
              border: 'none', cursor: 'pointer',
              color: '#ffffff', fontWeight: 700, fontSize: 20,
              fontFamily: 'inherit',
              boxShadow: '0 4px 24px rgba(155,78,221,0.35)',
            }}
          >
            Continue
          </button>
        </motion.div>
      </div>
    </div>
  )
}

// ── STEP NOTIFICATIONS ───────────────────────────────────────────────────────
function StepNotifications({ onNext }) {
  async function handleEnable() {
    triggerHaptic()
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      await PushNotifications.requestPermissions()
    } catch {
      // not available on web or permission unavailable — proceed anyway
    }
    onNext()
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 76px)' }}>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ color: '#ffffff', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}
        >
          Enable notifications
        </motion.h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12, duration: 0.4, type: 'spring', stiffness: 200 }}
          style={{
            width: 220, height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, #3a3a3a, #1a1a1a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: 100 }}>🔔</span>
        </motion.div>
      </div>

      <div style={{ padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
        <button
          onClick={handleEnable}
          style={{
            width: '100%', padding: '22px 0',
            borderRadius: 50,
            background: UMAX_PURPLE,
            border: 'none', cursor: 'pointer',
            color: '#ffffff', fontWeight: 700, fontSize: 20,
            fontFamily: 'inherit',
            boxShadow: '0 4px 24px rgba(155,78,221,0.35)',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}


// ── STEP AUTH: Sign up / Sign in ─────────────────────────────────────────────
function StepAuth({ onNext }) {
  const [loading, setLoading] = useState(null) // 'apple' | 'google' | null
  const [error, setError]     = useState('')
  const setAuth = useStore(s => s.setAuth)
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const isGuest         = useStore(s => s.isGuest)
  const user            = useStore(s => s.user)

  // Already signed in on native — skip this step (web stays for dev visibility)
  useEffect(() => {
    if (isNative() && isAuthenticated && !isGuest) onNext()
  }, [])

  async function handleApple() {
    triggerHaptic()
    setError('')
    setLoading('apple')
    try {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
      const appleResult = await SignInWithApple.authorize({
        clientId: 'com.ascendus.app',
        scopes: 'email name',
        nonce: Math.random().toString(36).substring(2, 15),
      })
      const identityToken = appleResult?.response?.identityToken
      if (!identityToken) throw new Error('Apple Sign In did not return a valid token')

      const API_BASE = (import.meta.env.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app').replace(/\/$/, '')
      const authRes = await fetch(`${API_BASE}/api/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityToken,
          user: appleResult.response.user,
          email: appleResult.response.email,
          fullName: appleResult.response.fullName,
          guestUserId: isGuest ? user?.id : undefined,
        }),
      })
      const authData = await authRes.json()
      if (!authRes.ok) throw new Error(authData.error || 'Authentication failed')
      setAuth(authData.user, authData.token)
      onNext()
    } catch (err) {
      if (err?.message?.toLowerCase().includes('cancel')) {
        // user dismissed the sheet — not an error
      } else {
        setError(err.message || 'Sign in failed. Please try again.')
      }
    } finally {
      setLoading(null)
    }
  }

  function handleGoogle() {
    triggerHaptic()
    setError('Google Sign In coming soon.')
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 76px)' }}>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ color: '#ffffff', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}
        >
          Create your account
        </motion.h1>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch', padding: '0 24px', gap: 14 }}>
        {/* Google — white, on top like Umax */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleGoogle}
          disabled={!!loading}
          style={{
            width: '100%', padding: '20px 0', borderRadius: 50,
            background: '#ffffff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            cursor: 'pointer', opacity: loading === 'apple' ? 0.5 : 1,
          }}
        >
          {loading === 'google' ? (
            <Loader2 size={24} color="#000" style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 19, color: '#000', letterSpacing: '-0.01em' }}>
            {loading === 'google' ? 'Signing in…' : 'Sign in with Google'}
          </span>
        </motion.button>

        {/* Apple — black below like Umax */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleApple}
          disabled={!!loading}
          style={{
            width: '100%', padding: '20px 0', borderRadius: 50,
            background: '#0a0a0a', border: '1.5px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading === 'google' ? 0.5 : 1,
          }}
        >
          {loading === 'apple' ? (
            <Loader2 size={24} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.42.07 2.4.81 3.22.82.94-.17 1.83-.89 3.13-.96 1.69-.09 2.96.64 3.78 1.82-3.47 2.08-2.67 6.62.87 7.89-.62 1.48-1.46 2.94-3 3.29zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
          )}
          <span style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 19, color: '#fff', letterSpacing: '-0.01em' }}>
            {loading === 'apple' ? 'Signing in…' : 'Sign in with Apple'}
          </span>
        </motion.button>

        {error ? (
          <p className="text-center font-body text-[12px]" style={{ color: '#E85D9E' }}>{error}</p>
        ) : null}

        {/* TODO: remove before launch */}
        <button
          onClick={() => { triggerHaptic(); onNext() }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', marginTop: 8, textDecoration: 'underline' }}
        >
          Skip for now (dev only)
        </button>
      </div>
    </div>
  )
}

// ── STEP 6: Improvement Focus ─────────────────────────────────────────────────
const FOCUS_OPTIONS = [
  { key: 'jawline',   Icon: Bone,      label: 'Jawline & Chin' },
  { key: 'skin',      Icon: Sparkles,  label: 'Skin Quality' },
  { key: 'eyes',      Icon: ScanLine,  label: 'Eyes & Brows' },
  { key: 'symmetry',  Icon: Scale,     label: 'Overall Symmetry' },
  { key: 'body',      Icon: Dumbbell,  label: 'Body & Physique' },
  { key: 'hair',      Icon: Scissors,  label: 'Hair & Grooming' },
]

function StepImprovementFocus({ data, onChange, onNext, onBack }) {
  const selected = data.improvementFocus || []

  function toggle(key) {
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key]
    onChange('improvementFocus', next)
  }

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20">
        <div className="mb-5">
          <h1 className="font-heading font-bold text-[28px] mb-2" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
            What would you most want to improve?
          </h1>
          <div className="flex items-center gap-3">
            <p className="font-body text-[14px]" style={{ color: DIM }}>Select all that apply</p>
            {selected.length > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-heading font-bold text-[12px] px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(198,168,92,0.15)', color: G, border: `1px solid ${G_BORDER}` }}
              >
                {selected.length} selected
              </motion.span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FOCUS_OPTIONS.map(({ key, Icon, label }) => {
            const isSelected = selected.includes(key)
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggle(key)}
                className="flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all duration-150"
                style={{
                  background: isSelected ? 'rgba(198,168,92,0.08)' : SURFACE,
                  border: `1.5px solid ${isSelected ? G : BORDER}`,
                }}
              >
                <Icon size={18} style={{ color: isSelected ? G : 'rgba(255,255,255,0.5)' }} className="flex-shrink-0" />
                <p className="font-heading font-semibold text-[13px] flex-1 leading-tight" style={{ color: isSelected ? G : TEXT }}>
                  {label}
                </p>
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isSelected ? G : 'transparent',
                    border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                  }}
                >
                  {isSelected && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      <div className="pb-10 pt-4">
        <GoldBtn label="Continue" onClick={onNext} disabled={selected.length === 0} />
      </div>
    </div>
  )
}

// ── STEP 7: Social Proof ──────────────────────────────────────────────────────
const REVIEWS = [
  {
    initials: 'SN',
    name: 'Soheen Najem',
    text: "downloaded it on a whim and honestly was not ready for how accurate it was. it pointed out stuff about my face i never even noticed. been doing the routine for 6 weeks and my skin is genuinely different. people keep asking what i changed",
  },
  {
    initials: 'M',
    name: 'Mekhi',
    text: "wasn't expecting the breakdown of my features to be that accurate ngl 😭 fixed my grooming based on what it said and i been getting way more compliments. simple changes hit different when you know exactly what to fix",
  },
  {
    initials: 'AT',
    name: 'Aaliyah Torres',
    text: "i was so close to not downloading this. glad i did. it told me my skin tone was uneven and gave me specific products. 2 months later my foundation routine takes half the time because my skin actually looks good now. worth every penny",
  },
]

function GoldStars() {
  return (
    <div className="flex gap-0.5">
      {[0,1,2,3,4].map(i => (
        <svg key={i} width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1L7.93 4.91H12.07L8.82 7.27L10.07 11.18L6.5 8.82L2.93 11.18L4.18 7.27L0.93 4.91H5.07L6.5 1Z" fill="#C6A85C"/>
        </svg>
      ))}
    </div>
  )
}

function StepSocialProof({ onNext, onBack }) {
  return (
    <div className="flex flex-col h-full">
      <BackBtn onBack={onBack} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pt-20 pb-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={22} style={{ color: '#C6A85C' }} />
            <span
              className="font-heading font-bold text-[13px] px-3 py-1 rounded-full"
              style={{ background: 'rgba(198,168,92,0.12)', color: G, border: `1px solid ${G_BORDER}` }}
            >
              1,200+ users leveling up
            </span>
            <GoldStars />
          </div>

          <h1
            className="font-heading font-bold text-[26px] leading-tight mb-2"
            style={{ color: TEXT, letterSpacing: '-0.02em' }}
          >
            Join Thousands of Ascendus Users
          </h1>
          <p className="font-body text-[14px]" style={{ color: DIM }}>
            See what others are saying about Ascendus
          </p>
        </div>

        {/* Review cards */}
        <div className="flex flex-col gap-3">
          {REVIEWS.map(({ initials, name, text }) => (
            <div
              key={name}
              className="p-4 rounded-2xl"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
            >
              <div className="flex items-center gap-3 mb-3">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(198,168,92,0.15)', border: `1px solid ${G_BORDER}` }}
                >
                  <span className="font-heading font-bold text-[11px]" style={{ color: G }}>{initials}</span>
                </div>
                <div>
                  <p className="font-heading font-semibold text-[13px]" style={{ color: TEXT }}>{name}</p>
                  <GoldStars />
                </div>
              </div>
              <p className="font-body text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-10 pt-3 flex-shrink-0">
        <GoldBtn label="Continue" onClick={onNext} />
      </div>
    </div>
  )
}

// ── STEP 8: Height ─────────────────────────────────────────────────────────────
function StepHeight({ data, onChange, onNext, onBack, units }) {
  const cm = data.height || 175
  let feet = Math.floor(cm / 30.48)
  let inches = Math.round((cm / 30.48 - feet) * 12)
  if (inches === 12) { feet += 1; inches = 0 }

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20">
        <h1 className="font-heading font-bold text-[28px] mb-2" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          How tall are you?
        </h1>
        <p className="font-body text-[13px] mb-8" style={{ color: DIM }}>Used to calculate your ideal body ratios.</p>

        <Slider
          label="Height"
          unit={units === 'imperial' ? '' : 'cm'}
          value={cm}
          displayValue={units === 'imperial' ? `${feet}'${inches}"` : cm}
          min={140}
          max={220}
          onChange={v => onChange('height', v)}
        />

        <div className="flex gap-2 mt-4">
          {['metric', 'imperial'].map(u => (
            <button key={u} onClick={() => onChange('_units', u)}
              className="flex-1 py-2.5 rounded-xl font-heading font-bold text-[12px] capitalize"
              style={{
                background: units === u ? G_DIM : SURFACE,
                border: `1px solid ${units === u ? G_BORDER : BORDER}`,
                color: units === u ? G : DIM,
              }}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <div className="pb-10">
        <GoldBtn label="Continue" onClick={onNext} />
      </div>
    </div>
  )
}

// ── STEP 7: Weight ────────────────────────────────────────────────────────────
function StepWeight({ data, onChange, onNext, onBack, units }) {
  const kg = data.weight || 75
  const lbs = Math.round(kg * 2.205)

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20">
        <h1 className="font-heading font-bold text-[28px] mb-2" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          How much do you weigh?
        </h1>
        <p className="font-body text-[13px] mb-8" style={{ color: DIM }}>Used to calculate your BMI and training phase.</p>

        <Slider
          label="Weight"
          unit={units === 'imperial' ? 'lbs' : 'kg'}
          value={kg}
          displayValue={units === 'imperial' ? lbs : kg}
          min={40}
          max={180}
          onChange={v => onChange('weight', v)}
        />

        <div className="flex gap-2 mt-4">
          {['metric', 'imperial'].map(u => (
            <button key={u} onClick={() => onChange('_units', u)}
              className="flex-1 py-2.5 rounded-xl font-heading font-bold text-[12px] capitalize"
              style={{
                background: units === u ? G_DIM : SURFACE,
                border: `1px solid ${units === u ? G_BORDER : BORDER}`,
                color: units === u ? G : DIM,
              }}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <div className="pb-10">
        <GoldBtn label="Continue" onClick={onNext} />
      </div>
    </div>
  )
}

// ── STEP 8 (kept for reference, no longer used) ───────────────────────────────
function calcBMI(heightCm, weightKg) {
  return weightKg / Math.pow(heightCm / 100, 2)
}

const BMI_TIERS = [
  {
    max: 18.5,
    label: 'Underweight',
    phase: 'BULK phase',
    PhaseIcon: Dumbbell,
    directive: '+300 cal surplus',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.09)',
    border: 'rgba(59,130,246,0.28)',
    impact: 'Being underweight means your face looks gaunt and your frame lacks presence. Building muscle mass will fill out your jaw, neck, and shoulders, directly raising your score.',
  },
  {
    max: 25,
    label: 'Healthy Weight',
    phase: 'RECOMP',
    PhaseIcon: Zap,
    directive: 'Maintain calories',
    color: '#C6A85C',
    bg: 'rgba(198,168,92,0.09)',
    border: 'rgba(198,168,92,0.28)',
    impact: "You're in the ideal range to recomp. Lose fat and build muscle simultaneously. This is the most effective phase for improving your appearance rating.",
  },
  {
    max: 30,
    label: 'Overweight',
    phase: 'CUT phase',
    PhaseIcon: Flame,
    directive: '-500 cal deficit',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.09)',
    border: 'rgba(245,158,11,0.28)',
    impact: 'Excess body fat is hiding your jawline, cheekbones, and V-taper. Reducing to a healthy range will visibly sharpen your face and improve your score significantly.',
  },
  {
    max: Infinity,
    label: 'Obese',
    phase: 'CUT phase',
    PhaseIcon: Flame,
    directive: '-500 to -750 cal deficit · urgent',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.09)',
    border: 'rgba(239,68,68,0.28)',
    impact: 'Body fat reduction is your highest-impact lever. Leaning out reveals facial bone structure, jawline, and neck definition, three of the highest-weight metrics in your rating.',
  },
]

function getBMITier(bmi) {
  return BMI_TIERS.find(t => bmi < t.max) ?? BMI_TIERS[BMI_TIERS.length - 1]
}

function StepBMI({ data, onNext, onBack }) {
  const heightCm = data.height || 175
  const weightKg = data.weight || 75
  const bmi = calcBMI(heightCm, weightKg)
  const tier = getBMITier(bmi)

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20 overflow-y-auto">

        {/* BMI value */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE_STANDARD }}
          className="text-center mb-6"
        >
          <p className="font-body text-[11px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Your BMI</p>
          <p className="font-heading font-bold" style={{ fontSize: 72, color: tier.color, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {bmi.toFixed(1)}
          </p>
          <div
            className="inline-block mt-3 px-5 py-2 rounded-full font-heading font-bold text-[13px] uppercase tracking-widest"
            style={{ background: tier.bg, border: `1.5px solid ${tier.border}`, color: tier.color }}
          >
            {tier.label}
          </div>
        </motion.div>

        {/* Phase recommendation */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-4 mb-4"
          style={{ background: tier.bg, border: `1px solid ${tier.border}` }}
        >
          <p className="font-body text-[11px] uppercase tracking-widest mb-1" style={{ color: tier.color }}>Recommended Phase</p>
          <p className="font-heading font-bold text-[22px] mb-1 flex items-center gap-2" style={{ color: TEXT }}>
            <tier.PhaseIcon size={20} style={{ color: tier.color }} /> {tier.phase}
          </p>
          <p className="font-heading font-bold text-[13px]" style={{ color: tier.color }}>{tier.directive}</p>
        </motion.div>

        {/* Appearance score impact */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}
        >
          <p className="font-body text-[11px] uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            How this affects your appearance score
          </p>
          <p className="font-body text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {tier.impact}
          </p>
        </motion.div>
      </div>

      <div className="pb-10 pt-4">
        <p style={{ fontSize: '12px', color: '#888', marginTop: '0px', marginBottom: '16px', lineHeight: 1.5 }}>
          BMI classifications based on{' '}
          <a href="https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight"
             target="_blank" rel="noopener noreferrer" style={{ color: '#d4af37' }}>
            World Health Organization guidelines
          </a>
          {' '}and{' '}
          <a href="https://www.nhlbi.nih.gov/health/educational/lose_wt/BMI/bmicalc.htm"
             target="_blank" rel="noopener noreferrer" style={{ color: '#d4af37' }}>
            NIH Body Mass Index tables
          </a>.
        </p>
        <GoldBtn label="Continue" onClick={onNext} />
      </div>
    </div>
  )
}

// ── Shared layout for face and side photo steps ───────────────────────────────
// Must be defined at module level — never inside a render function — so React
// sees a stable component type across re-renders.
function PhotoStepScreen({ stepLabel, headline, photo, photoType, gender, triggerRef, onPhoto, onBack, error: screenError, buttonLabel, onButton, extra }) {
  return (
    <div className="flex flex-col h-full" style={{ background: '#080808' }}>
      <BackBtn onBack={onBack} />
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}>
        <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: G }}>
          {stepLabel}
        </p>
        <h1 className="font-heading font-bold text-[26px] leading-tight" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          {headline}
        </h1>
      </div>

      {screenError && (
        <div className="mx-6 mb-3 px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="font-body text-[13px] text-center" style={{ color: '#EF4444' }}>{screenError}</p>
        </div>
      )}

      <div className="px-3 pb-3">
        <PhotoUploadStep
          stepNum={1}
          heroLayout
          photoType={photoType}
          guide={null}
          photo={photo}
          onPhoto={onPhoto}
          gender={gender || 'male'}
          triggerRef={triggerRef}
        />
      </div>

      <div className="px-6 pb-2 pt-4">
        <GoldBtn label={buttonLabel} onClick={onButton} />
        {extra}
      </div>
    </div>
  )
}

// ── STEP 7: Photo Capture + Analysis (face → side profile → analyze) ─────────
function StepScanCapture({ gender, onDone, onBack, guestReadyRef }) {
  const [phase, setPhase]               = useState('face') // 'face' | 'side' | 'analyzing' | 'retry_error'
  const [facePhoto, setFacePhoto]       = useState(null)
  const [sidePhoto, setSidePhoto]       = useState(null)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [slowAnalysis, setSlowAnalysis] = useState(false)
  const [error, setError]               = useState('')
  const [rateLimited, setRateLimited]   = useState(false)
  const [quotaExhausted, setQuotaExhausted] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const retrySideRef = useRef(null)
  const sideTriggerRef = useRef(null)
  const faceTriggerRef = useRef(null)
  // Countdown → auto-retry with the same photos
  useEffect(() => {
    if (!rateLimited) return
    if (retryCountdown <= 0) {
      setRateLimited(false)
      runAnalysisWithData(facePhoto, retrySideRef.current)
      return
    }
    const t = setTimeout(() => setRetryCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [rateLimited, retryCountdown]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toBase64(url, maxPx = 1024) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Photo processing timed out. Please retake your photo')), 15_000)
    )
    const convert = (async () => {
      const res = await fetch(url)
      const blob = await res.blob()
      return new Promise((resolve, reject) => {
        const img = new Image()
        const blobUrl = URL.createObjectURL(blob)
        img.onload = () => {
          URL.revokeObjectURL(blobUrl)
          const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
          const w = Math.round(img.width * scale)
          const h = Math.round(img.height * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          const outKB = Math.round(dataUrl.length * 0.75 / 1024)
          const inKB  = Math.round(blob.size / 1024)
          console.log(`[toBase64] ${img.width}x${img.height} → ${w}x${h} | ${inKB}KB → ${outKB}KB (${Math.round(outKB/inKB*100)}% of original)`)
          resolve(dataUrl)
        }
        img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Image load failed')) }
        img.src = blobUrl
      })
    })()
    return Promise.race([convert, timeout])
  }

  async function runAnalysisWithData(face, side) {
    setPhase('analyzing')
    setError('')
    setAnalysisStep(0)

    // Start the visual progress timer immediately so the bar advances as soon as
    // the analyzing screen appears — not after toBase64 finishes (which can take
    // several seconds for large camera photos, leaving the bar stuck at 5%).
    const stageTimer = setInterval(() => setAnalysisStep(prev => Math.min(prev + 1, 3)), 1800)
    const slowTimer  = setTimeout(() => setSlowAnalysis(true), 12000)

    try {
      const faceB64 = await toBase64(face)
      setFacePhoto(faceB64) // upgrade blob URL → stable data URL so retries don't expire
      const sideB64 = side ? await toBase64(side) : null
      if (sideB64) setSidePhoto(sideB64)
      setSlowAnalysis(false)

      // Wait for the silent guest session to resolve before calling the
      // authenticated API. If the user reaches analysis faster than the
      // POST /auth/guest round-trip, this yields until the token is stored.
      if (guestReadyRef?.current) await guestReadyRef.current

      let aiResult
      try {
        setScanInFlight(true)
        aiResult = await Promise.race([
          api.ai.score({ faceImage: faceB64, sideImage: sideB64, gender: gender || 'male' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timed out. Please try again')), 120_000)),
        ])
      } finally {
        setScanInFlight(false)
        clearInterval(stageTimer)
        clearTimeout(slowTimer)
        setSlowAnalysis(false)
      }

      setAnalysisStep(3)
      await new Promise(r => setTimeout(r, 350))
      setAnalysisStep(4)

      const scanRecord = {
        id:             `scan-${Date.now()}`,
        scanDate:       new Date().toISOString(),
        analyzedAt:     new Date().toISOString(),
        facePhotoUrl:   faceB64,
        sidePhotoUrl:   sideB64,
        hasSideProfile: !!sideB64,
        gender:         gender || 'male',
        umaxScore:      aiResult.overallScore,
        glowScore:      Math.round(aiResult.overallScore * 10) / 10,
        tier:           aiResult.tier,
        aiScore:        aiResult,
        faceData: {
          aestheticScore:    aiResult.faceScore,
          pillars:           null,
          symmetry:          aiResult.faceSubScores?.symmetry          ?? null,
          jawlineDefinition: aiResult.faceSubScores?.jawlineDefinition ?? null,
          skinClarity:       aiResult.faceSubScores?.skinClarity       ?? null,
          facialProportions: aiResult.faceSubScores?.facialProportions ?? null,
          eyeArea:           aiResult.faceSubScores?.eyeArea           ?? null,
          facialHarmony:     aiResult.faceSubScores?.facialHarmony     ?? null,
        },
        pillars:          aiResult.pillars          ?? null,
        extendedMetrics:  aiResult.extendedMetrics  ?? null,
        extendedMetricsStatus: aiResult.extendedMetricsStatus ?? null,
      }

      onDone(scanRecord)
    } catch (err) {
      console.error('[SCAN DONE] runAnalysisWithData caught error:', err?.message, err?.status, err?.errorCode)
      retrySideRef.current = side
      const code = err.errorCode || ''
      if (code === 'hourly_cap_reached') {
        // Per-user daily/hourly quota exhausted — retrying in 30s won't help.
        setQuotaExhausted(true)
        setRateLimited(false)
        setPhase('retry_error')
      } else if (code === 'claude_rate_limited' || err.status === 429) {
        // True server-side load — auto-retry after the indicated window.
        setQuotaExhausted(false)
        setRateLimited(true)
        setRetryCountdown(err.retryAfter || 30)
        setPhase('retry_error')
      } else {
        setQuotaExhausted(false)
        setRateLimited(false)
        setError(err.message || 'Something went wrong, please try again.')
        setPhase('retry_error')
      }
    }
  }

  if (phase === 'retry_error') {
    return (
      <div className="flex flex-col h-full items-center justify-center px-8" style={{ background: BG }}>
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          {quotaExhausted ? (
            <>
              <p className="font-heading font-bold text-base text-center" style={{ color: TEXT }}>Daily scan limit reached</p>
              <p className="font-body text-[13px] text-center" style={{ color: DIM }}>Free accounts get 3 scans per day. Upgrade to Ascendus Pro for unlimited scans.</p>
              <button
                onClick={onDone}
                className="w-full py-3 rounded-2xl font-heading font-bold text-sm"
                style={{ background: 'rgba(198,168,92,0.18)', color: '#C6A85C' }}>
                Upgrade to Pro
              </button>
            </>
          ) : rateLimited ? (
            <>
              <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(198,168,92,0.2)" strokeWidth="4" />
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#C6A85C" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (retryCountdown / 30)}`}
                    style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-heading font-bold text-xl" style={{ color: '#C6A85C' }}>{retryCountdown}</span>
                </div>
              </div>
              <div className="text-center">
                <p className="font-heading font-bold text-base" style={{ color: TEXT }}>High demand right now</p>
                <p className="font-body text-[13px] mt-1" style={{ color: DIM }}>We're experiencing high demand right now. Please try again in 30 seconds.</p>
                <p className="font-body text-[12px] mt-1" style={{ color: DIM }}>Auto-retrying in {retryCountdown}s…</p>
              </div>
              <button
                onClick={() => { setRateLimited(false); runAnalysisWithData(facePhoto, retrySideRef.current) }}
                className="w-full py-3 rounded-2xl font-heading font-bold text-sm"
                style={{ background: 'rgba(198,168,92,0.18)', color: '#C6A85C' }}>
                Retry Now
              </button>
            </>
          ) : (
            <>
              <p className="font-heading font-bold text-base text-center" style={{ color: TEXT }}>Something went wrong</p>
              <p className="font-body text-[13px] text-center" style={{ color: DIM }}>{error || 'Please try again.'}</p>
              <button
                onClick={() => { setError(''); runAnalysisWithData(facePhoto, retrySideRef.current) }}
                className="w-full py-3 rounded-2xl font-heading font-bold text-sm"
                style={{ background: 'rgba(198,168,92,0.18)', color: '#C6A85C' }}>
                Try Again
              </button>
              <button
                onClick={() => {
                  if (retrySideRef.current) { setSidePhoto(null); setPhase('side') }
                  else { setFacePhoto(null); setPhase('face') }
                }}
                className="w-full py-2 font-body text-[12px] text-center"
                style={{ color: DIM }}>
                Retake photo
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'analyzing') {
    return (
      <div className="flex flex-col h-full" style={{ background: BG }}>
        <AnalyzingScreen currentStep={analysisStep} slow={slowAnalysis} photo={facePhoto} />
      </div>
    )
  }

  if (phase === 'side') {
    return (
      <PhotoStepScreen
        stepLabel="STEP 3 OF 3"
        headline="Now, your side profile."
        photo={sidePhoto}
        photoType="side"
        gender={gender}
        triggerRef={sideTriggerRef}
        onPhoto={setSidePhoto}
        onBack={() => { setPhase('face'); setError('') }}
        error={error}
        buttonLabel={sidePhoto ? 'Analyze My Results' : 'Begin Scan'}
        onButton={() => {
          if (!sidePhoto) sideTriggerRef.current?.()
          else runAnalysisWithData(facePhoto, sidePhoto)
        }}
        extra={<ConsentMicroText />}
      />
    )
  }

  // phase === 'face'
  return (
    <PhotoStepScreen
      stepLabel="STEP 2 OF 3"
      headline="Take your front photo"
      photo={facePhoto}
      photoType="face"
      gender={gender}
      triggerRef={faceTriggerRef}
      onPhoto={(url) => { setFacePhoto(url); setError('') }}
      onBack={onBack}
      error={error}
      buttonLabel={facePhoto ? 'Continue' : 'Begin Scan'}
      onButton={() => {
        if (!facePhoto) faceTriggerRef.current?.()
        else { enableAnalytics(); setPhase('side'); setError('') }
      }}
      extra={<ConsentMicroText />}
    />
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
// Steps: 0=welcome, 1=signup, 2=age, 3=consent, 4=gender, 5=goal,
//        6=height, 7=weight, 8=bmi, 9=experience, 10=phase

// ── Intro Slides ─────────────────────────────────────────────────────────────
// Was a separate, drifted gold (#C9A84C) — fixing the color anyway since
// it's cheap and the file's already being touched.
const SLIDE_GOLD = GOLD
const SLIDE_GOLD_DIM = G_DIM
const SLIDE_GOLD_BORDER = G_BORDER

function Slide1() {
  const stats = [
    { num: '72%',  text: 'of people judge character based on appearance alone' },
    { num: '3.5x', text: 'more likely to be hired if considered attractive' },
    { num: '8 sec', text: 'before someone decides if they\'re attracted to you' },
  ]
  return (
    <div className="flex-1 flex flex-col justify-center px-6 pt-20 pb-4">
      <h1 className="font-heading font-bold text-center mb-2" style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.02em', color: '#F0EDE8' }}>
        The Truth Nobody Tells You
      </h1>
      <p className="font-body text-center text-[14px] mb-7" style={{ color: SLIDE_GOLD }}>
        Looks affect every area of your life
      </p>

      <div className="flex flex-col gap-3 mb-6">
        {stats.map(({ num, text }, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.12, duration: 0.4, ease: EASE_STANDARD }}
            className="flex items-center gap-4 px-5 py-4 rounded-2xl"
            style={{ background: SLIDE_GOLD_DIM, border: `0.5px solid ${SLIDE_GOLD_BORDER}` }}
          >
            <span className="font-heading font-bold flex-shrink-0 w-16 text-center" style={{ fontSize: 28, color: SLIDE_GOLD, lineHeight: 1 }}>{num}</span>
            <div style={{ width: 1, height: 32, background: SLIDE_GOLD_BORDER, flexShrink: 0 }} />
            <p className="font-body text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.75)' }}>{text}</p>
          </motion.div>
        ))}
      </div>

      <p className="font-body text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
        *Princeton University &amp; Harvard Business School research
      </p>
    </div>
  )
}

function Slide2() {
  const withoutItems = [
    'Random grooming',
    'No idea what to fix',
    'Hoping for results',
    'Generic advice',
  ]
  const withItems = [
    'AI identifies your top growth opportunities',
    'Personalized fix for each one',
    'Tracks real improvement',
    'Specific to YOUR face',
  ]
  return (
    <div className="flex-1 flex flex-col justify-center px-6 pt-20 pb-4">
      <h1 className="font-heading font-bold text-center mb-7" style={{ fontSize: 26, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#F0EDE8' }}>
        Most Guys Are Leaving<br />Points on the Table
      </h1>

      <div className="flex gap-3 mb-6">
        {/* Without */}
        <div className="flex-1 rounded-2xl p-4" style={{ background: 'rgba(224,60,60,0.06)', border: '0.5px solid rgba(224,60,60,0.25)' }}>
          <p className="font-heading font-bold text-[13px] mb-3" style={{ color: '#E05555' }}>Without a plan</p>
          {withoutItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-start gap-2 mb-2"
            >
              <X size={10} className="mt-0.5 flex-shrink-0" style={{ color: '#E05555' }} />
              <p className="font-body text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>{item}</p>
            </motion.div>
          ))}
        </div>

        {/* With Ascendus */}
        <div className="flex-1 rounded-2xl p-4" style={{ background: SLIDE_GOLD_DIM, border: `0.5px solid ${SLIDE_GOLD_BORDER}` }}>
          <p className="font-heading font-bold text-[13px] mb-3" style={{ color: SLIDE_GOLD }}>With Ascendus</p>
          {withItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-start gap-2 mb-2"
            >
              <Check size={10} className="mt-0.5 flex-shrink-0" style={{ color: SLIDE_GOLD }} />
              <p className="font-body text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.80)' }}>{item}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="font-heading font-bold text-center text-[16px]" style={{ color: '#F0EDE8' }}>
        The difference isn't genetics.<br />It's information.
      </p>
    </div>
  )
}

function Slide3() {
  const quickStats = [
    { num: '+1.4pts', label: 'Average score gain' },
    { num: '6 wks',  label: 'Avg time to see skin improvement' },
    { num: '78%',    label: 'Users who see visible results' },
  ]
  return (
    <div className="flex-1 flex flex-col justify-center px-6 pt-20 pb-4">
      <h1 className="font-heading font-bold text-center mb-6" style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.02em', color: '#F0EDE8' }}>
        Your Potential Is<br />Already There
      </h1>

      {/* Score arrow visual */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_STANDARD }}
        className="rounded-2xl px-6 py-5 mb-6 flex flex-col items-center"
        style={{ background: SLIDE_GOLD_DIM, border: `0.5px solid ${SLIDE_GOLD_BORDER}` }}
      >
        <div className="flex items-center gap-4 mb-3">
          <div className="flex flex-col items-center">
            <span className="font-heading font-bold text-[36px] leading-none" style={{ color: 'rgba(255,255,255,0.45)' }}>5.1</span>
            <span className="font-body text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>before</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span style={{ color: SLIDE_GOLD, fontSize: 28 }}>→</span>
            <span className="font-body text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>90 days</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-heading font-bold text-[36px] leading-none" style={{ color: SLIDE_GOLD }}>6.8</span>
            <span className="font-body text-[10px] mt-1" style={{ color: SLIDE_GOLD }}>after</span>
          </div>
        </div>
        <p className="font-body text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Average Ascendus user improvement in 90 days
        </p>
      </motion.div>

      {/* 3 quick stats */}
      <div className="flex gap-2 mb-6">
        {quickStats.map(({ num, label }, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.4, ease: EASE_STANDARD }}
            className="flex-1 rounded-xl px-2 py-3 flex flex-col items-center gap-1"
            style={{ background: '#0A0A0A', border: `0.5px solid rgba(198,168,92,0.25)` }}
          >
            <span className="font-heading font-bold text-[18px] leading-none" style={{ color: SLIDE_GOLD }}>{num}</span>
            <p className="font-body text-[10px] text-center leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
          </motion.div>
        ))}
      </div>

      <p className="font-heading font-bold text-center text-[16px]" style={{ color: '#F0EDE8' }}>
        You just need to know where to start.
      </p>
    </div>
  )
}

const SLIDE_COMPONENTS = [Slide1, Slide2, Slide3]

function IntroSlides({ onDone }) {
  const [slide, setSlide] = useState(0)
  const [dir, setDir] = useState(1)
  const total = SLIDE_COMPONENTS.length

  function next() {
    if (slide < total - 1) { setDir(1); setSlide(s => s + 1) }
    else onDone()
  }

  const SlideContent = SLIDE_COMPONENTS[slide]

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0A0A0A' }}>
      {/* Skip */}
      <button
        onClick={onDone}
        className="absolute right-5 z-20 font-heading font-semibold text-[12px] px-4 py-2 rounded-xl"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 44px)', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', letterSpacing: '0.04em' }}
      >
        Skip
      </button>

      {/* Progress dots */}
      <div className="absolute top-[5.5rem] left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {SLIDE_COMPONENTS.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === slide ? 20 : 6, opacity: i === slide ? 1 : 0.35 }}
            transition={{ duration: 0.3 }}
            style={{ height: 6, borderRadius: 99, background: SLIDE_GOLD }}
          />
        ))}
      </div>

      {/* Slide */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={slide}
          custom={dir}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={pageTrans}
          className="flex flex-col h-full"
        >
          <SlideContent />
        </motion.div>
      </AnimatePresence>

      {/* CTA */}
      <div className="px-6 pb-12 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          className="w-full py-4 font-heading font-bold text-[15px]"
          style={{
            background: slide < total - 1
              ? `linear-gradient(135deg, #D4B96A 0%, ${SLIDE_GOLD} 50%, #A8893A 100%)`
              : SLIDE_GOLD,
            color: '#000000',
            borderRadius: slide < total - 1 ? 16 : 12,
            boxShadow: slide < total - 1
              ? '0 4px 20px rgba(198,168,92,0.3)'
              : '0 2px 12px rgba(198,168,92,0.5)',
            letterSpacing: '0.02em',
          }}
        >
          {slide < total - 1 ? 'Continue' : "Let's Get Started"}
        </motion.button>
      </div>
    </div>
  )
}

export default function PremiumOnboarding() {
  const navigate = useNavigate()
  const isAuthenticated    = useStore(s => s.isAuthenticated)
  const isGuest            = useStore(s => s.isGuest)
  const units              = useStore(s => s.units)
  const setUserProfile     = useStore(s => s.setUserProfile)
  const setHasOnboarded    = useStore(s => s.setHasOnboarded)
  const setLegalConsented  = useStore(s => s.setLegalConsented)
  const setAgeConfirmed    = useStore(s => s.setAgeConfirmed)
  const setGender          = useStore(s => s.setGender)
  const setAssignedPhase   = useStore(s => s.setAssignedPhase)
  const setUnits           = useStore(s => s.setUnits)
  const setAuth            = useStore(s => s.setAuth)
  const setGuestSession    = useStore(s => s.setGuestSession)
  const addScan                = useStore(s => s.addScan)
  const setCurrentScan         = useStore(s => s.setCurrentScan)
  const setLastFaceScanCapture = useStore(s => s.setLastFaceScanCapture)
  const patchScanExtendedMetrics = useStore(s => s.patchScanExtendedMetrics)
  const setCurrentPlan     = useStore(s => s.setCurrentPlan)
  const setPendingFacePhoto = useStore(s => s.setPendingFacePhoto)
  const setLastScanDate    = useStore(s => s.setLastScanDate)
  const incrementScanCount = useStore(s => s.incrementScanCount)
  const setIsPremium       = useStore(s => s.setIsPremium)
  const user               = useStore(s => s.user)

  // Silently establish a guest session so the AI score API call during the
  // "Analyzing…" step has a valid JWT — even though the user hasn't signed in
  // yet. The guest account is upgraded to a real Apple ID account at the paywall.
  // Store the promise so StepScanCapture can await it before firing the score API.
  const guestReadyRef = useRef(null)
  useEffect(() => {
    if (isAuthenticated) { guestReadyRef.current = Promise.resolve(); return }
    guestReadyRef.current = api.auth.guest()
      .then(({ userId, token }) => { setGuestSession(userId, token) })
      .catch(err => console.warn('[Onboarding] Guest session failed (non-fatal):', err?.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore an in-progress draft so a refresh/backgrounding mid-quiz doesn't
  // silently discard answers already entered. Authenticated users clamp to
  // step ≥ 3 so they never see Welcome/SignUp again.
  const draft = loadDraft()

  // Intro slides play first for new users on every fresh app launch.
  const [introDone, setIntroDone] = useState(false)
  // StepIntro (index 0, "First Impressions Are Fast") is skipped for the
  // same reason — new unauthenticated sessions start straight at Welcome(1).
  // If already authenticated, skip Intro(0), Welcome(1), SignUp(2) — start at Consent(3)
  // Unauthenticated users start at Welcome (step 1). With the new flow, auth
  // happens at the paywall, so users are always unauthenticated during onboarding.
  // Interrupted sessions (isAuthenticated=true but hasOnboarded=false) resume at gender (step 2).
  // Gender (step 2) is the first screen on a fresh launch. Welcome/Intro are
  // still in the steps array but skipped by default — start at 2 for everyone.
  // Flow simplified: gender is now step 0. Always start at 0.
  const [step, setStep] = useState(draft?.step ?? 0)
  const [dir, setDir] = useState(1)
  const [signingIn, setSigningIn] = useState(false)

  const [formData, setFormData] = useState({
    gender: '', goal: '',
    improvementFocus: [],
    ...draft?.formData,
  })

  // Persist a draft on every step/field change.
  useEffect(() => {
    saveDraft({ step, formData })
  }, [step, formData, isAuthenticated])

  function updateField(key, value) {
    if (key === '_units') {
      setUnits(value)
    } else {
      setFormData(prev => ({ ...prev, [key]: value }))
    }
  }

  function goNext() {
    setDir(1)
    setStep(s => s + 1)
  }
  function goBack() {
    if (step <= 0) return
    setDir(-1)
    setStep(s => s - 1)
  }

  // REMOVED: handleScanDone — moved to paywall flow
  // eslint-disable-next-line no-unused-vars
  function handleScanDone(scanRecord) {
    try {
      const g = formData.gender || 'male'
      const phase = assignPhase(scanRecord.faceData?.aestheticScore, formData.goal)
      const tasks = generatePlanTasks(scanRecord.faceData, scanRecord.pillars, phase, g)

      setCurrentPlan({ id: `plan-${Date.now()}`, scanId: scanRecord.id, tasks, createdAt: new Date().toISOString(), weekNumber: 1 })
      setPendingFacePhoto(scanRecord.facePhotoUrl)
      addScan(scanRecord)
      setCurrentScan(scanRecord)
      setAssignedPhase(phase)

      // Fire-and-forget: MediaPipe landmark extraction for FaceMetricsExplorer
      if (scanRecord.facePhotoUrl) {
        const photo = scanRecord.facePhotoUrl
        const sid   = scanRecord.id
        import('../utils/faceLandmarks.js')
          .then(({ getLandmarks, toExplorerLandmarks2D, computeExplorerMetrics }) =>
            getLandmarks(photo).then(lm => {
              const named2D   = toExplorerLandmarks2D(lm)
              const explorerM = computeExplorerMetrics(lm, g)
              if (explorerM) {
                setLastFaceScanCapture(photo, named2D, explorerM)
                import('../utils/scanPhotoDb.js').then(({ saveScanMedia }) =>
                  saveScanMedia(sid, { photo, landmarks2D: named2D, faceMetrics: explorerM })
                ).catch(() => {})
              }
            })
          )
          .catch(err => console.warn('[FaceExplorer] Landmark detection:', err.message))
      }
      setLastScanDate(new Date().toISOString())
      incrementScanCount()
      logAnalyticsEvent('scan_completed', { tier: scanRecord?.tier, score: scanRecord?.umaxScore, source: 'onboarding' })

      // Extended metrics (30-metric breakdown) were split into a separate,
      // slower follow-up call for latency — fire it now, non-blocking, so
      // StepScoresWaiting's CategoryCard teasers hot-update once it resolves
      // instead of blocking the onboarding scan result on it. Same pattern
      // as the regular Scan.jsx flow.
      if (scanRecord.facePhotoUrl && scanRecord.extendedMetricsStatus === 'pending') {
        api.ai.scoreExtendedMetrics({ faceImage: scanRecord.facePhotoUrl, gender: g })
          .then(({ extendedMetrics }) => {
            patchScanExtendedMetrics(scanRecord.id, extendedMetrics, 'ready')
          })
          .catch(err => {
            console.warn('[SCAN DONE] Extended metrics follow-up failed (non-fatal):', err?.message)
            patchScanExtendedMetrics(scanRecord.id, null, 'failed')
          })
      }

      // Persist to Supabase non-blocking — same fields as regular Scan flow
      api.supabase.saveScan({
        overallScore:  scanRecord.umaxScore,
        tier:          scanRecord.tier,
        faceScore:     scanRecord.faceData?.aestheticScore,
        harmony:       scanRecord.pillars?.harmony,
        angularity:    scanRecord.pillars?.angularity,
        features:      scanRecord.pillars?.features,
        dimorphism:    scanRecord.pillars?.dimorphism,
        gender:        g,
        assignedPhase: phase?.toLowerCase(),
        tasks,
      }).catch(() => {})

      goNext()
    } catch (err) {
      console.error('[SCAN DONE] ERROR in handleScanDone:', err?.message, err?.stack)
    }
  }

  // Called after StepAuth — moves to notifications step.
  function handleAuthDone() {
    goNext()
  }

  // Called after StepNotifications — final unlock.
  function handleFinalDone() {
    clearDraft()
    setGender(formData.gender || null)
    setLegalConsented()
    setAgeConfirmed()
    setHasOnboarded()
    logAnalyticsEvent('onboarding_completed', { source: 'notifications_step' })
  }

  // Flow: 0=gender, 1=referral, 2=auth, 3=notifications
  const TOTAL_STEPS = 4

  // Intro slides (shown before the quiz for new users)
  if (!introDone) {
    return <IntroSlides onDone={() => setIntroDone(true)} />
  }

  // Sign in mode
  if (signingIn) {
    return (
      <div className="relative flex flex-col h-full overflow-hidden" style={{ background: BG }}>
        <SignInView
          onBack={() => setSigningIn(false)}
          onSuccess={() => navigate('/')}
          onAppleSignIn={handleAppleSignIn}
        />
      </div>
    )
  }

  // REMOVED: purchaseSuccess welcome screen — no longer purchasing in onboarding

  function handleDemo() {
    setAuth({ id: 'demo', name: 'Demo User', email: 'demo@ascendus.app' }, 'demo-token')
    setLegalConsented(true)
    setAgeConfirmed(true)
    setStep(2) // skip straight to gender (index 2 in new flow)
  }

  // Used only by the Sign In modal (returning users). New-user auth now happens
  // inside handleAscend at the paywall, not here.
  async function handleAppleSignIn() {
    if (!Capacitor.isNativePlatform()) return
    try {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
      const result = await SignInWithApple.authorize({
        clientId: 'com.ascendus.app',
        redirectURI: 'https://ascendus.store/auth/apple/callback',
        scopes: 'email name',
        state: Date.now().toString(),
        nonce: Math.random().toString(36).substring(2, 15),
      })
      const token = result?.response?.identityToken
      if (!token) throw new Error('No identity token returned')

      const API_BASE = (import.meta.env.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app').replace(/\/$/, '')
      const res = await fetch(`${API_BASE}/api/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityToken: token,
          user: result.response.user,
          email: result.response.email,
          fullName: result.response.fullName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')

      setAuth(data.user, data.token)
      clearDraft()
      setHasOnboarded()
      setSigningIn(false)
    } catch (err) {
      if (err?.code === 'SIGN_IN_CANCELLED' || err?.code === 1001 || err?.message?.includes('cancel')) return
      console.error('[APPLE AUTH] Sign-in error:', err)
      throw err
    }
  }

  // Flow: 0=gender, 1=referral, 2=auth, 3=notifications
  const steps = [
    <StepGender key="gender" data={formData} onChange={updateField} onNext={goNext} />,
    <StepReferral key="referral" onNext={goNext} />,
    <StepAuth key="auth" onNext={handleAuthDone} />,
    <StepNotifications key="notifications" onNext={handleFinalDone} />,
  ]

  return (
    <MotionPage
      baseClassName=""
      className="relative flex flex-col h-full overflow-hidden dark"
      style={{ background: '#0a0a0a', '--text-secondary': 'rgba(255,255,255,0.5)' }}
    >
      {/* Umax-style story progress bar */}
      <div
        style={{
          position: 'absolute',
          top: 'env(safe-area-inset-top, 0px)',
          left: 0, right: 0,
          display: 'flex',
          gap: 4,
          padding: '12px 16px 0',
          zIndex: 20,
        }}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 99,
              background: i <= step ? '#ffffff' : 'rgba(255,255,255,0.25)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={pageTrans}
          className="absolute inset-0"
        >
          {steps[step]}
        </motion.div>
      </AnimatePresence>
    </MotionPage>
  )
}
