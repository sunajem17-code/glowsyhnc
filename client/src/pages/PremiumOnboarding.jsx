import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Loader2, Heart, Briefcase, Star, Sparkles, Bone, ScanLine, Scale, Dumbbell, Scissors, Flame, Zap, Shield, Check, X, Trophy, User, UserRound } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import logo from '../assets/ascendus-icon.png'
import TransformationScreen from '../components/TransformationScreen'
import { StepRating, StepScoresWaiting } from '../components/OnboardingFinalSteps'
import { PhotoUploadStep, AnalyzingScreen, ANALYSIS_STEPS } from './Scan'
import { generatePlanTasks } from '../utils/content'
import { assignPhase } from '../utils/phase'
import { checkTrialEligibility, isNative, purchasePro } from '../utils/iap'
// SignInWithApple loaded dynamically per-call (see handleAppleSignIn)
import { Capacitor } from '@capacitor/core'
import { FirebaseAnalytics } from '@capacitor-firebase/analytics'
import { getDeviceId } from '../utils/deviceId'
import { GOLD, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
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
        <GoldBtn label="Next →" onClick={onNext} />
      </motion.div>
    </div>
  )
}

function StepWelcome({ onCreateAccount, onSignIn, onAppleSignIn }) {
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
        <GoldBtn label="Create Account →" onClick={onCreateAccount} />
        {Capacitor.getPlatform() === 'ios' && (
          <button
            onClick={onAppleSignIn}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] transition-all flex items-center justify-center gap-2"
            style={{ background: '#FFFFFF', color: '#000000', border: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="black">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.29.07 2.19.79 3.03.81.96-.04 1.87-.78 3.09-.83 1.42-.07 2.72.54 3.69 1.78a5.12 5.12 0 0 0-2.14 4.28c.07 2.04 1.22 3.87 3.23 4.82-.4 1.08-.94 2.13-1.9 3zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Sign in with Apple
          </button>
        )}
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

// ── STEP 1: Sign Up ───────────────────────────────────────────────────────────
function StepSignUp({ data, onChange, onNext, onBack, setAuthData }) {
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth = useStore(s => s.setAuth)
  const setReferralCode = useStore(s => s.setReferralCode)

  const valid = data.email?.trim() && data.password?.trim().length >= 8

  async function handleRegister() {
    if (!valid) return
    setError('')
    setLoading(true)
    try {
      // Pass referral code if user arrived via a referral link (?ref=ASCXXXXX)
      const urlParams = new URLSearchParams(window.location.search)
      const refCode = urlParams.get('ref')
      const deviceId = await getDeviceId().catch(() => null)
      const res = await api.auth.register({
        email: data.email.trim(),
        password: data.password.trim(),
        ...(refCode   ? { refCode }   : {}),
        ...(deviceId  ? { deviceId }  : {}),
      })
      setAuth(res.user, res.token)
      setReferralCode(String(res.user.id).substring(0, 8).toUpperCase())
      setAuthData({ userId: res.user.id, token: res.token })
      onNext()
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
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
      <div className="flex-1 flex flex-col justify-center pt-20 overflow-y-auto">
        <h1 className="font-heading font-bold text-[28px] mb-1" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          Create your account.
        </h1>
        <p className="font-body text-[13px] mb-6" style={{ color: DIM }}>Your journey starts here.</p>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-body font-medium uppercase tracking-wide mb-1.5 block" style={{ color: DIM }}>Email</label>
            <input type="email" placeholder="you@example.com" value={data.email || ''}
              onChange={e => onChange('email', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="text-[11px] font-body font-medium uppercase tracking-wide mb-1.5 block" style={{ color: DIM }}>Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters"
                value={data.password || ''} onChange={e => onChange('password', e.target.value)}
                style={{ ...inputStyle, paddingRight: 48 }} />
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
        </div>
      </div>

      <div className="pb-10 pt-4">
        <GoldBtn label={loading ? 'Creating account…' : 'Continue →'} onClick={handleRegister}
          disabled={!valid} loading={loading} />
      </div>
    </div>
  )
}


// ── STEP 3: Legal Consent ─────────────────────────────────────────────────────
function StepConsent({ checks, onToggle, onNext, onBack }) {
  const navigate = useNavigate()
  const allChecked = Object.values(checks).every(Boolean)

  function handleAgree() {
    enableAnalytics()
    onNext()
  }

  const items = [
    { key: 'legalAgeConsent', label: 'I confirm I am 17 years of age or older and agree to the Terms of Service and Privacy Policy.', sub: null, link: 'both' },
    {
      key: 'aiConsent',
      label: 'I consent to AI photo analysis',
      sub: 'My face photos will be sent to Anthropic Claude AI for analysis and stored securely. I can delete my data anytime in Settings.',
    },
    {
      key: 'disclaimer',
      label: 'I understand scores are AI estimates only',
      sub: 'These scores are for self-improvement purposes only and are not medical assessments or clinical evaluations.',
    },
  ]

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col pt-20 overflow-y-auto">
        <h1 className="font-heading font-bold text-[26px] mb-1" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          Before you begin.
        </h1>
        <p className="font-body text-[13px] mb-5" style={{ color: DIM }}>
          All 3 must be checked to continue.
        </p>

        <div className="space-y-2.5 mb-5">
          {items.map(({ key, label, sub, link }) => (
            <div key={key}>
              <Checkbox
                checked={!!checks[key]}
                onToggle={() => onToggle(key)}
                label={
                  link === 'both' ? (
                    <span>
                      I confirm I am 17 years of age or older and agree to the{' '}
                      <span role="link" onClick={e => { e.stopPropagation(); navigate('/terms') }} className="underline cursor-pointer" style={{ color: G }}>Terms of Service</span>
                      {' '}and{' '}
                      <span role="link" onClick={e => { e.stopPropagation(); navigate('/privacy') }} className="underline cursor-pointer" style={{ color: G }}>Privacy Policy</span>
                      .
                    </span>
                  ) : link ? (
                    <span>
                      {label.split(' Terms of Service')[0]}
                      {label.includes('Terms of Service') && (
                        <> <span role="link" onClick={e => { e.stopPropagation(); navigate('/terms') }} className="underline cursor-pointer" style={{ color: G }}>Terms of Service</span></>
                      )}
                      {label.includes('Privacy Policy') && (
                        <> <span role="link" onClick={e => { e.stopPropagation(); navigate('/privacy') }} className="underline cursor-pointer" style={{ color: G }}>Privacy Policy</span></>
                      )}
                    </span>
                  ) : label
                }
                sub={sub}
              />
            </div>
          ))}
        </div>

        <div className="px-4 py-3.5 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[11px] leading-relaxed" style={{ color: DIM }}>
            <Heart size={14} style={{ color: '#F5A623', display: 'inline', verticalAlign: 'middle', marginRight: 4, flexShrink: 0 }} /> <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Wellbeing reminder:</span> Scores are tools for self-improvement, not measures of your worth. If you struggle with body image, please speak to a mental health professional.
          </p>
        </div>
      </div>

      <div className="pb-10 pt-2">
        <GoldBtn label="I Agree, Continue →" onClick={handleAgree} disabled={!allChecked} />
      </div>
    </div>
  )
}

// ── STEP: Name ────────────────────────────────────────────────────────────────
function StepName({ data, onChange, onNext, onBack }) {
  const inputStyle = {
    color: TEXT, borderColor: 'rgba(255,255,255,0.12)', background: SURFACE,
    borderWidth: 1, borderStyle: 'solid', borderRadius: 12, padding: '14px 16px',
    width: '100%', fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none',
  }

  // Best-effort — the name isn't critical-path, so a network hiccup here
  // should never block onboarding. Advance regardless of outcome.
  async function handleContinue() {
    try {
      await api.user.update({ name: data.name.trim() })
    } catch (err) {
      console.error('[StepName] Failed to save name:', err.message)
    } finally {
      onNext()
    }
  }

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20">
        <h1 className="font-heading font-bold text-[28px] mb-2 text-center" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          What's your name?
        </h1>
        <p className="font-body text-[13px] mb-8 text-center" style={{ color: DIM }}>
          We'll use this to personalize your results.
        </p>
        <input
          type="text"
          placeholder="Your name"
          value={data.name || ''}
          onChange={e => onChange('name', e.target.value)}
          style={inputStyle}
        />
      </div>
      <div className="pb-10">
        <GoldBtn label="Continue →" onClick={handleContinue} disabled={!data.name?.trim()} />
      </div>
    </div>
  )
}

// ── STEP 4: Gender ────────────────────────────────────────────────────────────
function StepGender({ data, onChange, onNext, onBack }) {
  const isMale   = data.gender === 'male'
  const isFemale = data.gender === 'female'

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20">
        <h1 className="font-heading font-bold text-[28px] mb-2" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          Are you male or female?
        </h1>
        <p className="font-body text-[13px] mb-8" style={{ color: DIM }}>
          Calibrates your score, tier labels, and recommendations.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Male */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange('gender', 'male')}
            className="flex flex-col items-center py-10 rounded-2xl transition-all duration-150"
            style={{
              background: isMale ? 'rgba(37,99,235,0.12)' : SURFACE,
              border: `2px solid ${isMale ? '#3B82F6' : BORDER}`,
              boxShadow: isMale ? '0 0 24px rgba(59,130,246,0.18)' : 'none',
            }}
          >
            <User size={40} className="mb-3" style={{ color: isMale ? '#60A5FA' : TEXT }} />
            <p className="font-heading font-bold text-[18px]" style={{ color: isMale ? '#60A5FA' : TEXT }}>Male</p>
          </motion.button>

          {/* Female */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange('gender', 'female')}
            className="flex flex-col items-center py-10 rounded-2xl transition-all duration-150"
            style={{
              background: isFemale ? 'rgba(236,72,153,0.10)' : SURFACE,
              border: `2px solid ${isFemale ? '#EC4899' : BORDER}`,
              boxShadow: isFemale ? '0 0 24px rgba(236,72,153,0.15)' : 'none',
            }}
          >
            <UserRound size={40} className="mb-3" style={{ color: isFemale ? '#F472B6' : TEXT }} />
            <p className="font-heading font-bold text-[18px]" style={{ color: isFemale ? '#F472B6' : TEXT }}>Female</p>
          </motion.button>
        </div>
      </div>
      <div className="pb-10">
        <GoldBtn label="Continue →" onClick={onNext} disabled={!data.gender} />
      </div>
    </div>
  )
}

// ── STEP 5: Goal ──────────────────────────────────────────────────────────────
const GOAL_OPTIONS = [
  { key: 'dating',      Icon: Heart,    label: 'Dating & Relationships',  desc: 'Attract more attention and build confidence with partners' },
  { key: 'career',      Icon: Briefcase, label: 'Career & Networking',     desc: 'Command presence and make strong first impressions' },
  { key: 'confidence',  Icon: Shield,   label: 'Self-Confidence',         desc: 'Feel good in your own skin and carry yourself better' },
  { key: 'appearance',  Icon: Sparkles, label: 'Overall Appearance',      desc: 'Optimize every aspect of how you look and present' },
]

function StepGoal({ data, onChange, onNext, onBack }) {
  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20 gap-3">
        <div className="mb-4">
          <h1 className="font-heading font-bold text-[28px] mb-2" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
            {"What's your main goal?"}
          </h1>
          <p className="font-body text-[14px]" style={{ color: DIM }}>
            Pick the one that matters most
          </p>
        </div>

        {GOAL_OPTIONS.map(({ key, Icon, label, desc }) => {
          const isSelected = data.goal === key
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange('goal', key)}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all duration-150"
              style={{
                background: isSelected ? 'rgba(198,168,92,0.08)' : SURFACE,
                border: `1.5px solid ${isSelected ? G : BORDER}`,
              }}
            >
              <Icon size={22} style={{ color: isSelected ? G : 'rgba(255,255,255,0.5)' }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-[14px] leading-tight" style={{ color: isSelected ? G : TEXT }}>
                  {label}
                </p>
                <p className="font-body text-[12px] leading-relaxed mt-0.5" style={{ color: DIM }}>
                  {desc}
                </p>
              </div>
              {/* Gold checkmark */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: isSelected ? G : 'transparent',
                  border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                }}
              >
                {isSelected && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>
      <div className="pb-10 pt-4">
        <GoldBtn label="Continue →" onClick={onNext} disabled={!data.goal} />
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
        <GoldBtn label="Continue →" onClick={onNext} disabled={selected.length === 0} />
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
    text: "the celeb lookalike got me dead 😭 but fr the breakdown of my features was actually eye opening. fixed my grooming based on what it said and i been getting way more compliments. simple changes hit different when you know exactly what to fix",
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
              1,522+ users leveling up
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
        <GoldBtn label="Continue →" onClick={onNext} />
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
          unit={units === 'imperial' ? `ft ${feet}'${inches}"` : 'cm'}
          value={cm}
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
        <GoldBtn label="Continue →" onClick={onNext} />
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
        <GoldBtn label="Continue →" onClick={onNext} />
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
        <GoldBtn label="Continue →" onClick={onNext} />
      </div>
    </div>
  )
}

// ── STEP 7: Photo Capture + Analysis (face → side profile → analyze) ─────────
function StepScanCapture({ gender, onDone, onBack }) {
  const [phase, setPhase]               = useState('face') // 'face' | 'side' | 'analyzing' | 'retry_error'
  const [facePhoto, setFacePhoto]       = useState(null)
  const [sidePhoto, setSidePhoto]       = useState(null)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [slowAnalysis, setSlowAnalysis] = useState(false)
  const [error, setError]               = useState('')
  const [rateLimited, setRateLimited]   = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const retrySideRef = useRef(null)

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
          resolve(canvas.toDataURL('image/jpeg', 0.85))
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

    try {
      const faceB64 = await toBase64(face)
      setFacePhoto(faceB64) // upgrade blob URL → stable data URL so retries don't expire
      const sideB64 = side ? await toBase64(side) : null
      if (sideB64) setSidePhoto(sideB64)
      setAnalysisStep(1)
      setSlowAnalysis(false)
      const stageTimer = setInterval(() => setAnalysisStep(prev => Math.min(prev + 1, 3)), 1800)
      const slowTimer  = setTimeout(() => setSlowAnalysis(true), 12000)

      let aiResult
      try {
        aiResult = await Promise.race([
          api.ai.score({ faceImage: faceB64, sideImage: sideB64, gender: gender || 'male' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Analysis timed out. Please try again')), 120_000)),
        ])
      } finally {
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

      console.log('[SCAN DONE] calling onDone with scanRecord id:', scanRecord.id)
      onDone(scanRecord)
    } catch (err) {
      console.error('[SCAN DONE] runAnalysisWithData caught error:', err?.message, err?.status)
      const m = (err.message || '').toLowerCase()
      const isRateLimit = err.message === 'rate_limited' || err.status === 429
        || m.includes('quota') || m.includes('exceeded') || m.includes('rate limit')
        || m.includes('rate_limit') || m.includes('too many') || m.includes('overloaded')
        || m.includes('capacity') || m.includes('credit') || m.includes('high demand')
      if (isRateLimit) {
        retrySideRef.current = side
        setRateLimited(true)
        setRetryCountdown(err.retryAfter || 30)
        setPhase('retry_error')
      } else {
        setError(err.message || 'Something went wrong, please try again.')
        setPhase('retry_error')
      }
    }
  }

  if (phase === 'retry_error') {
    return (
      <div className="flex flex-col h-full items-center justify-center px-8" style={{ background: BG }}>
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          {rateLimited ? (
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
              <p className="font-body text-[13px] text-center" style={{ color: DIM }}>{error || "We're experiencing high demand. Please try again in 30 seconds."}</p>
              <button
                onClick={() => { setError(''); runAnalysisWithData(facePhoto, retrySideRef.current) }}
                className="w-full py-3 rounded-2xl font-heading font-bold text-sm"
                style={{ background: 'rgba(198,168,92,0.18)', color: '#C6A85C' }}>
                Try Again
              </button>
              <button
                onClick={() => setPhase(retrySideRef.current ? 'side' : 'face')}
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
      <div className="flex flex-col h-full px-6" style={{ background: BG }}>
        <BackBtn onBack={() => { setPhase('face'); setError('') }} />
        <div className="pt-12 pb-4">
          <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: G }}>
            STEP 2 OF 2
          </p>
          <h1 className="font-heading font-bold text-[26px] leading-tight mb-2" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
            Now, your side profile.
          </h1>
          <p className="font-body text-[13px]" style={{ color: DIM }}>
            Turn 90° to your right · Chin level · Same lighting
          </p>
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="font-body text-[13px] text-center" style={{ color: '#EF4444' }}>{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <PhotoUploadStep
            stepNum={2}
            guide={null}
            photo={sidePhoto}
            onPhoto={setSidePhoto}
            gender={gender || 'male'}
          />
        </div>

        <div className="pb-10 pt-2 flex flex-col gap-3">
          <GoldBtn
            label={sidePhoto ? 'Analyze My Results →' : 'Upload or Take a Side Photo'}
            onClick={() => runAnalysisWithData(facePhoto, sidePhoto)}
            disabled={!sidePhoto}
          />
          <button
            onClick={() => runAnalysisWithData(facePhoto, null)}
            className="w-full py-2 font-body text-[12px] text-center transition-opacity hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.28)' }}
          >
            Skip side profile
          </button>
        </div>
      </div>
    )
  }

  // phase === 'face'
  return (
    <div className="flex flex-col h-full px-6" style={{ background: BG }}>
      <BackBtn onBack={onBack} />
      <div className="pt-12 pb-4">
        <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: G }}>
          STEP 1 OF 2
        </p>
        <h1 className="font-heading font-bold text-[26px] leading-tight mb-2" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          Take your front photo.
        </h1>
        <p className="font-body text-[13px]" style={{ color: DIM }}>
          Front-facing · Neutral expression · Good lighting · No hat or glasses
        </p>
      </div>

      {error && (
        <div className="mb-3 px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="font-body text-[13px] text-center" style={{ color: '#EF4444' }}>{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <PhotoUploadStep
          stepNum={1}
          guide={null}
          photo={facePhoto}
          onPhoto={(url) => setFacePhoto(url)}
          gender={gender || 'male'}
        />
      </div>

      {/* Only rendered once a photo exists — PhotoUploadStep's own "Upload or
          Take a Selfie" pill already prompts for the photo itself, so a
          second disabled prompt here was a redundant duplicate. This button's
          real job is advancing to the side-profile phase, which nothing else
          on this screen does. */}
      {facePhoto && (
        <div className="pb-10 pt-2">
          <GoldBtn
            label="Continue →"
            onClick={() => { setPhase('side'); setError('') }}
          />
        </div>
      )}
    </div>
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
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', letterSpacing: '0.04em' }}
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
  const units              = useStore(s => s.units)
  const setUserProfile     = useStore(s => s.setUserProfile)
  const setHasOnboarded    = useStore(s => s.setHasOnboarded)
  const setLegalConsented  = useStore(s => s.setLegalConsented)
  const setAgeConfirmed    = useStore(s => s.setAgeConfirmed)
  const setGender          = useStore(s => s.setGender)
  const setAssignedPhase   = useStore(s => s.setAssignedPhase)
  const setUnits           = useStore(s => s.setUnits)
  const setAuth            = useStore(s => s.setAuth)
  const addScan            = useStore(s => s.addScan)
  const currentScan        = useStore(s => s.currentScan)
  const setCurrentScan     = useStore(s => s.setCurrentScan)
  const patchScanExtendedMetrics = useStore(s => s.patchScanExtendedMetrics)
  const setCurrentPlan     = useStore(s => s.setCurrentPlan)
  const setPendingFacePhoto = useStore(s => s.setPendingFacePhoto)
  const setLastScanDate    = useStore(s => s.setLastScanDate)
  const incrementScanCount = useStore(s => s.incrementScanCount)
  const setIsPremium       = useStore(s => s.setIsPremium)

  // Purchase state for StepScoresWaiting's "Unlock Results Now" button — moved
  // here from ScanUnlockGate.jsx's handleAscend (Step 1 of retiring that
  // screen; ScanUnlockGate itself is untouched and still routable at /unlock,
  // just no longer reachable from this button).
  const [trialEligibility, setTrialEligibility] = useState({ monthly: 'unknown', yearly: 'unknown' })
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')

  useEffect(() => {
    checkTrialEligibility()
      .then(result => setTrialEligibility(result))
      .catch(() => {})
  }, [])

  // Restore an in-progress draft (unauthenticated only — an authenticated user
  // always starts fresh at Consent) so a refresh/backgrounding mid-quiz doesn't
  // silently discard answers already entered.
  const draft = isAuthenticated ? null : loadDraft()

  // Dormant again — the Welcome screen (steps[1], "Brutally honest. Built
  // to improve you.") must always be the literal first thing a never-signed-up
  // user sees, no slides in front of it. IntroSlides (the 3-slide "why
  // Ascendus" sequence) stays in the codebase in case it's wanted again
  // later, but introDone defaults true so it never shows unprompted.
  const [introDone, setIntroDone] = useState(true)
  // StepIntro (index 0, "First Impressions Are Fast") is skipped for the
  // same reason — new unauthenticated sessions start straight at Welcome(1).
  // If already authenticated, skip Intro(0), Welcome(1), SignUp(2) — start at Consent(3)
  const [step, setStep] = useState(isAuthenticated ? 3 : (draft?.step ?? 1))
  const [dir, setDir] = useState(1)
  const [signingIn, setSigningIn] = useState(false)
  const [authData, setAuthData] = useState(null)

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    ageConfirmed: null,
    gender: '', goal: '',
    improvementFocus: [],
    ...draft?.formData,
  })

  const [checks, setChecks] = useState({
    legalAgeConsent: false, aiConsent: false, disclaimer: false,
    ...draft?.checks,
  })

  // Persist a draft on every change (password fields excluded on purpose).
  useEffect(() => {
    if (isAuthenticated) return
    const { password, confirmPassword, ...safeFormData } = formData
    saveDraft({ step, formData: safeFormData, checks })
  }, [step, formData, checks, isAuthenticated])

  function updateField(key, value) {
    if (key === '_units') {
      setUnits(value)
    } else {
      setFormData(prev => ({ ...prev, [key]: value }))
    }
  }

  function toggleCheck(key) {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function goNext() { setDir(1); setStep(s => s + 1) }
  function goBack() {
    if (step === 0) return
    if (step === 1 && authData) return
    setDir(-1)
    setStep(s => s - 1)
  }

  // Called by StepScanCapture when analysis completes — saves the scan record
  // to the store, then continues the normal step sequence (Transformation →
  // Rating → ScoresWaiting) instead of jumping straight to the /unlock route.
  // hasOnboarded only flips at the very end, in handleAscend — flipping it
  // here would swap App.jsx out of the !hasOnboarded routing branch mid-flow
  // and unmount this component.
  //
  // Phase is computed with the same assignPhase(faceScore, goal) call
  // Scan.jsx's own (post-onboarding) scan flow uses — this is the actual
  // vocabulary ActionPlan.jsx and generatePlanTasks() read (LEAN/SCULPT/
  // TRANSFORM/REFINE), not the separate BMI-based CUT/BULK/RECOMP/MAINTENANCE
  // result WorkoutPlan.jsx's body-stats screen shows.
  function handleScanDone(scanRecord) {
    console.log('[SCAN DONE] handleScanDone fired', JSON.stringify({ id: scanRecord?.id, score: scanRecord?.umaxScore, tier: scanRecord?.tier }))
    try {
      const g = formData.gender || 'male'
      const phase = assignPhase(scanRecord.faceData?.aestheticScore, formData.goal)
      console.log('[SCAN DONE] calling generatePlanTasks')
      const tasks = generatePlanTasks(scanRecord.faceData, scanRecord.pillars, phase, g)
      console.log('[SCAN DONE] generatePlanTasks done, tasks count:', tasks?.length)

      setCurrentPlan({ id: `plan-${Date.now()}`, scanId: scanRecord.id, tasks, createdAt: new Date().toISOString(), weekNumber: 1 })
      setPendingFacePhoto(scanRecord.facePhotoUrl)
      addScan(scanRecord)
      setCurrentScan(scanRecord)
      setAssignedPhase(phase)
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

      console.log('[SCAN DONE] calling goNext')
      goNext()
      console.log('[SCAN DONE] goNext called')
    } catch (err) {
      console.error('[SCAN DONE] ERROR in handleScanDone:', err?.message, err?.stack)
    }
  }

  // NOT a verbatim port of ScanUnlockGate.jsx's handleAscend — it couldn't be.
  // In the original flow, finish('/unlock') already ran (setHasOnboarded,
  // setLegalConsented, setAgeConfirmed, setUserProfile, the Supabase profile
  // patch) before ScanUnlockGate ever mounted, so its handleAscend never had
  // to worry about onboarding-completion state. Here, this button IS what
  // used to trigger finish() — but unlike finish()'s other side effects (none
  // of which gate any route — see below), setHasOnboarded() is NOT run
  // unconditionally up front anymore. It's the one flag App.jsx's routing
  // actually checks (!hasOnboarded ? <PremiumOnboarding/> : ...), so setting
  // it before the purchase even starts meant closing the app mid-purchase
  // (during the StoreKit sheet, on a cancel, on a network drop) left the user
  // permanently marked "onboarded" with isPremium still false and no route
  // back to any paywall — a real bypass, not hypothetical. It now only flips
  // on the native success path below, and — since the web/Stripe redirect
  // tears down this whole function's execution context — on confirmed
  // payment in PaymentSuccess.jsx instead. An interrupted attempt now
  // correctly leaves hasOnboarded false, sending the user back through
  // onboarding (from Consent — the step array always resets there for an
  // already-authenticated user) rather than skipping it. The other fields
  // below (userProfile/gender/legalConsented/ageConfirmed, the Supabase
  // patch) are harmless to set unconditionally — nothing gates access on
  // them, only hasOnboarded does, and re-onboarding just re-sets them anyway.
  async function handleAscend() {
    clearDraft()
    setUserProfile({ goal: formData.goal })
    setGender(formData.gender || null)
    setLegalConsented()
    setAgeConfirmed()
    if (authData) {
      api.user.update({ gender: formData.gender }).catch(() => {})
      const profilePatch = {}
      if (formData.goal) profilePatch.goal_type = formData.goal
      profilePatch.ai_consent = !!checks.aiConsent
      profilePatch.consent_at = new Date().toISOString()
      api.supabase.updateUser(profilePatch).catch(() => {})
    }

    setIsPurchasing(true)
    setPurchaseError('')
    try {
      if (isNative()) {
        // Prefer whichever plan the "3-Day Free Trial" copy is actually
        // promising — monthly by default, but fall back to yearly if only
        // that one is trial-eligible.
        const plan = trialEligibility.monthly === 'eligible' ? 'monthly'
          : trialEligibility.yearly === 'eligible' ? 'yearly' : 'monthly'
        const result = await purchasePro(plan)
        if (result?.success) {
          const rcUserId = result.customerInfo?.originalAppUserId
          api.payments.syncRc(rcUserId).catch(() => {})
          sessionStorage.setItem('asc_pro_splash_shown', '1')
          setIsPremium(true)
          setHasOnboarded()
          logAnalyticsEvent('purchase_completed', { plan, platform: 'native' })
          navigate('/results', { replace: true })
          return
        }
        // Resolved without granting the entitlement — either the user
        // cancelled or something else went wrong without throwing. Reset so
        // the button never gets stuck spinning either way.
        if (result?.reason !== 'cancelled') {
          setPurchaseError('Unable to complete purchase. Please try again.')
        }
        setIsPurchasing(false)
        return
      }
      // Web: Stripe checkout — same flow as PaywallSheet's handleCheckout.
      const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
      const token  = stored?.state?.token
      if (!token || token === 'demo-token') { setIsPurchasing(false); navigate('/auth'); return }
      const { url } = await api.payments.createCheckout('monthly', false)
      window.location.href = url
      // Leave isPurchasing=true — the page is about to navigate away.
    } catch (err) {
      const msg = (err?.message || '').toLowerCase()
      if (!msg.includes('cancel')) {
        setPurchaseError(err?.message || 'Unable to complete purchase. Please try again.')
      }
      setIsPurchasing(false)
    }
  }

  // PromoModal already flips isPremium/updates the user in the store itself
  // on redemption — this only handles the piece that's specific to still
  // being mid-onboarding: completing it (so App.jsx's !hasOnboarded gate
  // stops routing back here) and moving on to results, same as a successful
  // purchase above.
  function handlePromoSuccess() {
    sessionStorage.setItem('asc_pro_splash_shown', '1')
    setHasOnboarded()
    logAnalyticsEvent('promo_redeemed', { source: 'onboarding' })
    navigate('/results', { replace: true })
  }

  // Progress bar: only during data-collection steps (2–7); post-scan celebration screens (8–10) get no counter
  const QUIZ_START = isAuthenticated ? 3 : 2
  const QUIZ_END = 7
  const showProgress = step >= QUIZ_START && step <= QUIZ_END
  const progressPct = showProgress ? ((step - QUIZ_START) / (QUIZ_END - QUIZ_START)) * 100 : 0
  const stepCounter = step - QUIZ_START + 1
  const stepTotal = QUIZ_END - QUIZ_START + 1

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
      // Apple already provides identity — skip SignUp(2), go straight to Consent(3)
      setStep(3)
    } catch (err) {
      if (err?.code === 'SIGN_IN_CANCELLED' || err?.code === 1001 || err?.message?.includes('cancel')) return
      console.error('[APPLE AUTH] PremiumOnboarding error:', err)
    }
  }

  // Flow: 0=intro, 1=welcome, 2=signup, 3=consent, 4=name, 5=gender, 6=goal,
  //       7=scan(face+side), 8=transformation, 9=rating,
  //       10=scores-waiting (real score + tier + growth area + celeb match + locked
  //       tile grid — the single score-reveal moment in onboarding, previewing
  //       what /unlock shows) → /unlock
  // Body stats (height/weight) and the BMI-based phase result are no longer
  // collected here — moved to WorkoutPlan.jsx (see BodyStatsStep.jsx), so
  // they're gathered when actually needed instead of upfront for everyone.
  const steps = [
    <StepIntro key="intro" onNext={goNext} />,
    <StepWelcome key="welcome"
      onCreateAccount={goNext}
      onSignIn={() => setSigningIn(true)}
      onAppleSignIn={handleAppleSignIn}
    />,
    <StepSignUp key="signup" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack} setAuthData={setAuthData}
    />,
    <StepConsent key="consent" checks={checks} onToggle={toggleCheck}
      onNext={goNext} onBack={goBack}
    />,
    <StepName key="name" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack}
    />,
    <StepGender key="gender" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack}
    />,
    <StepGoal key="goal" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack}
    />,
    <StepScanCapture key="scan"
      gender={formData.gender}
      onDone={handleScanDone}
      onBack={goBack}
    />,
    <TransformationScreen key="transformation" onNext={goNext} />,
    <StepRating key="rating" onNext={goNext} />,
    <StepScoresWaiting key="scores-waiting" scan={currentScan} onAscend={handleAscend} onPromoSuccess={handlePromoSuccess} isPurchasing={isPurchasing} error={purchaseError} />,
  ]

  return (
    <MotionPage
      baseClassName=""
      className="relative flex flex-col h-full overflow-hidden dark"
      style={{ background: BG, '--text-secondary': 'rgba(255,255,255,0.5)' }}
    >
      {/* Progress bar (steps 1-9) */}
      {showProgress && (
        <div className="absolute top-0 left-0 right-0 h-0.5 z-20" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, #A8893A, ${G}, #D4B96A)` }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* Logo — centered so it never collides with BackBtn (left-5) or the step counter (right-5) */}
      {showProgress && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <img src={logo} alt="Ascendus" style={{ width: 20, height: 20, mixBlendMode: 'lighten', opacity: 0.65 }} />
        </div>
      )}

      {/* Step counter */}
      {showProgress && (
        <div className="absolute right-5 z-20" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Step {stepCounter} of {stepTotal}
          </span>
        </div>
      )}

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
