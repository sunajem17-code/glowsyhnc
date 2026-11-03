import { FINAL_ONBOARDING_STEP } from '../utils/onboardingStartup.js'
import { BACKEND_ORIGIN } from '../utils/backend'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Loader2, Heart, Star, Sparkles, Bone, ScanLine, Scale, Dumbbell, Scissors, Flame, Zap, Shield, Check, X, Trophy, User, UserRound } from 'lucide-react'
import useStore from '../store/useStore'
import { api, setScanInFlight } from '../utils/api'
import logo from '../assets/ascendus-icon.png'
import hypergamyChart from '../assets/hypergamy-chart.png'
import haloEffectImg from '../assets/halo-effect-gold.png'
import marcovFitAvatar from '../assets/marcov-fit-avatar.png'
import yusufAliAvatar from '../assets/yusuf-ali-avatar.png'
import samHakimiAvatar from '../assets/sam-hakimii-avatar.png'
import { PhotoUploadStep, AnalyzingScreen, extractScanOverlayPoints, buildMeshPathD } from './Scan'
import { ANALYSIS_STEPS } from '../utils/analysisSteps'
import { profilePointsFromMesh, profilePointsFromVision } from '../utils/scanFeatureAnchors'
import { analyzeSideProfile } from '../utils/photoGeometry'
import { generatePlanTasks } from '../utils/content'
import { assignPhase } from '../utils/phase'
import { isNative } from '../utils/iap'
import { ensureNotificationPermission, requestNotificationPermission } from '../utils/notifications'
// SignInWithApple loaded dynamically per-call (see handleAppleSignIn)

// ── Animated processing overlay (bars + "Processing" label) ──────────────────
import { Capacitor } from '@capacitor/core'
import { getDeviceId } from '../utils/deviceId'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { ONBOARDING_GOLD } from '../utils/onboardingGold'
import { triggerHaptic, triggerPageHaptic } from '../utils/haptics'
import MotionPage from '../components/MotionPage'
import { nextOnboardingStep } from '../utils/onboardingProgress'
import ProcessingOverlay from '../components/ProcessingOverlay'
import { openAppStoreReview } from '../components/OnboardingFinalSteps'
import { buildProductionEvidence, requestProductionAnalysis } from '../utils/productionAnalysis'

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
const SURFACE = '#0D0D0D'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT = 'var(--text-primary)'
const DIM = 'var(--text-secondary)'

// Steps: 0=intro, 1=welcome, 2=signup, 3=consent, 4=gender, 5=goal, 6=heightweight, 7=scan
//         8=locked-reveal, 9=phase, 10=transformation, 11=rating
// Progress counter: only during data-collection steps (2–7)

// Draft persistence survives app restarts and excludes authentication fields.
const DRAFT_KEY = 'ascendus_onboarding_draft'
let guestSessionFlight = null

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // storage unavailable (private browsing, quota) — fail silently, non-critical
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
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
      , and AI analysis
    </p>
  )
}

function BackBtn({ onBack }) {
  return (
    <button
      onClick={onBack}
      aria-label="Go back"
      className="absolute flex items-center justify-center"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        left: 20,
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        zIndex: 10,
      }}
    >
      <ChevronLeft size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
    </button>
  )
}

function GoldBtn({ label, onClick, disabled, loading, solid = false }) {
  function handleClick() {
    triggerHaptic()
    onClick?.()
  }
  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="btn-primary h-[60px] py-0 rounded-2xl text-[17px] flex items-center justify-center gap-2"
      style={{ background: solid ? ONBOARDING_GOLD : GOLD_GRADIENT }}
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
            Research on social perception shows people form judgments about attractiveness, confidence, and trustworthiness within seconds of seeing a face, often before a single word is spoken That snap judgment shapes dating, social, and even professional outcomes
          </p>
          <p className="font-body text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            The good news: most of what drives that impression (grooming, skin, fitness, posture, style) is genuinely improvable, not fixed
          </p>
          <p className="font-body text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Ascendus uses AI to show you exactly where you stand and what's actually worth working on, so you're not guessing
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="pb-10 pt-4"
      >
        <GoldBtn label="Continue" onClick={onNext} />
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
          Welcome to Ascendus
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="font-body text-[15px] leading-relaxed mb-5"
          style={{ color: DIM }}
        >
          Brutally accurate AI scoring<br />and a 12-week plan built for you
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

function StepGender({ data, onChange, onNext }) {
  const [selected, setSelected] = useState(null)

  const MALE_BLUE   = '#FFFFFF'
  const FEMALE_PINK = '#FFFFFF'

  function pick(gender) {
    triggerHaptic()
    setSelected(gender)
    onChange('gender', gender)
    setTimeout(onNext, 300)
  }

  const cardStyle = (gender) => ({
    width: 288, height: 288,
    borderRadius: 22,
    border: `1.5px solid ${selected === gender ? '#C6A85C' : '#262626'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'background 0.2s, border 0.2s', flexShrink: 0,
    background: selected === gender ? 'rgba(198,168,92,0.10)' : '#0D0D0D',
  })

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="px-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}
      >
        <h1 className="font-heading font-bold text-[28px] leading-tight" style={{ color: '#ffffff', letterSpacing: '-0.02em', textShadow: '0 0 24px rgba(255,255,255,0.25)' }}>
          What's Your Gender
        </h1>
      </motion.div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 40 }}>
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.06 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => pick('male')}
          style={cardStyle('male')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <MarsIcon color={MALE_BLUE} />
            <div style={{ color: selected === 'male' ? '#C6A85C' : '#ffffff', fontWeight: 700, fontSize: 24, marginTop: 8 }}>Male</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.12 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => pick('female')}
          style={cardStyle('female')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VenusIcon color={FEMALE_PINK} />
            <div style={{ color: selected === 'female' ? '#C6A85C' : '#ffffff', fontWeight: 700, fontSize: 24, marginTop: 8 }}>Female</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ── STEP REFERRAL ────────────────────────────────────────────────────────────
function StepReferral({ onNext }) {
  const [code, setCode] = useState('')
  function handleContinue() {
    triggerHaptic()
    if (code.trim()) {
      try { sessionStorage.setItem('asc_referral_code', code.trim().toUpperCase()) } catch {}
    }
    onNext()
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}>
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <h1 className="font-heading font-bold text-[26px] leading-tight" style={{ color: '#ffffff', letterSpacing: '-0.02em' }}>Do you have a referral code?</h1>
        </motion.div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <input
            type="text"
            placeholder="AB1CD"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 5))}
            autoCapitalize="characters"
            maxLength={5}
            style={{
              width: '100%', padding: '22px 20px',
              borderRadius: 16,
              background: '#1a1a1a',
              border: `1px solid ${code.length === 5 ? 'rgba(198,168,92,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: '#ffffff', fontSize: 22, fontWeight: 700, fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
              letterSpacing: '0.18em', textAlign: 'center',
              transition: 'border-color 0.2s',
            }}
          />
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14, marginTop: 12 }}>
            Enter your 5-letter code, or skip
          </p>
        </motion.div>
      </div>

      <div style={{ padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          style={{
            width: '100%', height: 60, padding: 0,
            borderRadius: 16,
            background: GOLD_GRADIENT,
            border: 'none', cursor: 'pointer',
            color: '#000000', fontWeight: 700, fontSize: 17,
            fontFamily: 'inherit',
            boxShadow: '0 4px 24px rgba(198,168,92,0.35)',
          }}
        >
          Continue
        </motion.button>
      </div>
    </div>
  )
}

// ── STEP CONSEQUENCES ────────────────────────────────────────────────────────
const CONSEQUENCES = [
  {
    icon:  '⚠️',
    color: '#EF4444',
    text:  'A limited dating life — your pool narrows every year you let this slide',
  },
  {
    icon:  '🔁',
    color: '#F97316',
    text:  'The confidence spiral: rejection → insecurity → less effort → more rejection',
  },
  {
    icon:  '📉',
    color: '#EF4444',
    text:  'Studies show appearance directly impacts perceived competence and hireability',
  },
  {
    icon:  '⏳',
    color: '#F97316',
    text:  'Your peak window is now The habits you build in your 20s define your 30s',
  },
]

function StepConsequences({ onNext }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}>
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#EF4444', textTransform: 'uppercase', marginBottom: 10 }}>
            REALITY CHECK
          </p>
          <h1
            className="font-heading font-bold leading-tight"
            style={{ fontSize: 27, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: 8 }}
          >
            What staying the same actually costs you
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            Most people know something is off Few do anything about it
          </p>
        </motion.div>
      </div>

      {/* Consequence list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', gap: 12 }}>
        {CONSEQUENCES.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.09, duration: 0.32, ease: 'easeOut' }}
            style={{
              display:      'flex',
              gap:          14,
              alignItems:   'flex-start',
              background:   `${c.color}0D`,
              border:       `1px solid ${c.color}28`,
              borderRadius: 14,
              padding:      '14px 16px',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.5, margin: 0 }}>
              {c.text}
            </p>
          </motion.div>
        ))}

        {/* Divider callout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.35 }}
          style={{
            marginTop: 4,
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(198,168,92,0.06)',
            border: '1px solid rgba(198,168,92,0.22)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 13, color: '#C6A85C', fontWeight: 600, margin: 0, lineHeight: 1.45 }}>
            Ascendus shows you exactly where you are — and the fastest path to where you want to be
          </p>
        </motion.div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { triggerHaptic(); onNext() }}
          style={{
            width: '100%', height: 60, padding: 0,
            borderRadius: 16,
            background: GOLD_GRADIENT,
            border: 'none', cursor: 'pointer',
            color: '#000000', fontWeight: 700, fontSize: 17,
            fontFamily: 'inherit',
            boxShadow: '0 4px 24px rgba(198,168,92,0.35)',
          }}
        >
          I'm ready to change this
        </motion.button>
      </div>
    </div>
  )
}

// ── STEP TESTIMONIALS ────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    handle:  '@samhakimii',
    rating:  5,
    quote:   'I used to be unhappy with my looks and genuinely didn\'t even know where to start, but each scan would point out all my weaknesses and I slowly fixed them and ascended.',
    initials:'SH',
    color:   '#C6A85C',
    avatar:  samHakimiAvatar,
  },
  {
    handle:  '@yusufali_',
    rating:  5,
    quote:   'I used to get bullied for being overweight and decided to finally lock in. After literally just following the 12 week plan, I looked unrecognizable.',
    initials:'KJ',
    color:   '#60A5FA',
    avatar:  yusufAliAvatar,
  },
  {
    handle:  '@marcov.fit',
    rating:  5,
    quote:   'It helped me understand what to focus on and gave me a plan that helped me get hollow cheeks in 3 weeks.',
    initials:'MV',
    color:   '#C6A85C',
    avatar:  marcovFitAvatar,
  },
]

function StarRow({ n = 5 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} size={12} fill="#C6A85C" stroke="none" />
      ))}
    </span>
  )
}

function StepTestimonials({ onNext }) {
  const reviewRequested = useRef(false)

  useEffect(() => {
    if (!isNative()) return
    // Let the slide settle before asking iOS to present its rating dialog.
    const timer = setTimeout(() => {
      if (reviewRequested.current) return
      reviewRequested.current = true
      void openAppStoreReview()
    }, 700)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{
      width: '100%', height: '100%', background: '#0a0a0a',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}>
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          {/* Star cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ display: 'inline-flex', gap: 3 }}>
              {[0,1,2,3,4].map(i => <Star key={i} size={18} fill="#C6A85C" stroke="none" />)}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#C6A85C', fontFamily: 'inherit' }}>4.9</span>
          </div>

          <h1
            className="font-heading font-bold leading-tight"
            style={{ fontSize: 28, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: 6 }}
          >
            See why thousands are ascending
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: 0 }}>
            Real results from real people
          </p>
        </motion.div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px', gap: 12 }}>
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.handle}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.1, duration: 0.35, ease: 'easeOut' }}
            style={{
              background:   '#0D0D0D',
              border:       '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding:      '16px 18px',
              display:      'flex',
              gap:          14,
              alignItems:   'flex-start',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: t.avatar ? 'transparent' : `${t.color}22`,
              border:     t.avatar ? 'none' : `1.5px solid ${t.color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {t.avatar
                ? <img src={t.avatar} alt={`${t.handle} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: ['@marcov.fit', '@yusufali_'].includes(t.handle) ? 'center 75%' : 'center 30%' }} />
                : <span style={{ fontSize: 14, fontWeight: 700, color: t.color, fontFamily: 'inherit' }}>{t.initials}</span>}
            </div>

            {/* Body */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'inherit' }}>
                  {t.handle}
                </span>
                <StarRow n={t.rating} />
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45, margin: 0 }}>
                "{t.quote}"
              </p>
            </div>
          </motion.div>
        ))}

        {/* Trust badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.46, duration: 0.35 }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 0 0',
          }}
        >
        </motion.div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => { triggerHaptic(); onNext() }}
          style={{
            width: '100%', height: 60, padding: 0,
            borderRadius: 16,
            background: GOLD_GRADIENT,
            border: 'none', cursor: 'pointer',
            color: '#000000', fontWeight: 700, fontSize: 17,
            fontFamily: 'inherit',
            boxShadow: '0 4px 24px rgba(198,168,92,0.35)',
          }}
        >
          Continue
        </motion.button>
      </div>
    </div>
  )
}

// ── STEP NOTIFICATIONS ───────────────────────────────────────────────────────
function StepNotifications({ onNext }) {
  const [loading, setLoading] = useState(false)
  const requesting = useRef(false)

  async function enableNotifications() {
    if (requesting.current) return
    requesting.current = true
    setLoading(true)
    try {
      const status = { display: await ensureNotificationPermission() }
      if (status.display === 'granted') {
        void requestNotificationPermission()
      }
    } catch (err) {
      console.warn('[Notifications] Permission request failed:', err?.message)
    } finally {
      requesting.current = false
      setLoading(false)
      onNext()
    }
  }


  function handleEnable() {
    if (requesting.current) return
    if (!isNative()) {
      onNext()
      return
    }
    void enableNotifications()
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a0a', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}>
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <h1 className="font-heading font-bold text-[26px] leading-tight" style={{ color: '#ffffff', letterSpacing: '-0.02em' }}>Enable notifications</h1>
        </motion.div>
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

      <div style={{ padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}>
        <GoldBtn
          label={isNative() ? 'Allow notifications' : 'Continue'}
          onClick={handleEnable}
          loading={loading}
        />
      </div>
    </div>
  )
}


// ── Halo Effect SVG Diagram ───────────────────────────────────────────────────
function HaloEffectDiagram() {
  const G = '#C6A85C'
  return (
    <svg viewBox="0 0 340 220" width="100%" style={{ display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect width="340" height="220" fill="#111111" rx="14"/>

      {/* Divider */}
      <line x1="170" y1="16" x2="170" y2="204" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>

      {/* ── LEFT: Higher Attractiveness ── */}
      <text x="85" y="28" textAnchor="middle" fill="white" fontFamily="sans-serif" fontSize="11" fontWeight="700">Higher Attractiveness</text>

      {/* Golden glow behind face */}
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#C6A85C" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#C6A85C" stopOpacity="0"/>
      </radialGradient>
      <ellipse cx="85" cy="95" rx="52" ry="60" fill="url(#glow)"/>

      {/* Attractive face */}
      {/* Head */}
      <ellipse cx="85" cy="88" rx="30" ry="36" fill="#3d2b1f"/>
      {/* Hair */}
      <path d="M55 72 Q57 48 85 44 Q113 48 115 72 Q105 56 85 54 Q65 56 55 72Z" fill="#5a3515"/>
      {/* Side hair */}
      <path d="M55 72 Q52 80 54 90" stroke="#5a3515" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M115 72 Q118 80 116 90" stroke="#5a3515" strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* Strong jawline */}
      <path d="M58 100 Q60 124 85 130 Q110 124 112 100" fill="#3a2518"/>
      {/* Eyes */}
      <ellipse cx="74" cy="84" rx="6" ry="5" fill="white"/>
      <ellipse cx="96" cy="84" rx="6" ry="5" fill="white"/>
      <ellipse cx="75" cy="84" rx="3" ry="3" fill="#1a0f08"/>
      <ellipse cx="97" cy="84" rx="3" ry="3" fill="#1a0f08"/>
      <ellipse cx="76" cy="83" rx="1" ry="1" fill="white"/>
      <ellipse cx="98" cy="83" rx="1" ry="1" fill="white"/>
      {/* Eyebrows strong */}
      <path d="M68 78 Q74 75 80 77" stroke="#4a2e10" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M90 77 Q96 75 102 78" stroke="#4a2e10" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* Nose */}
      <path d="M85 88 L82 100 Q85 103 88 100 L85 88" fill="#2e1f10" opacity="0.6"/>
      {/* Confident smile */}
      <path d="M73 110 Q85 120 97 110" stroke="#c07850" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* Chin */}
      <path d="M75 124 Q85 132 95 124" stroke="#2e1f10" strokeWidth="1.5" fill="none"/>
      {/* Collar / suit */}
      <path d="M55 140 Q60 130 75 132 L85 140 L95 132 Q110 130 115 140 L120 160 L50 160Z" fill="#2a2a2a"/>
      <path d="M75 132 L85 148 L95 132" fill="#3a3a3a"/>
      <rect x="83" y="132" width="4" height="16" fill="#e8e0d0" opacity="0.4"/>

      {/* Gold pills left */}
      {/* Row 1 */}
      <rect x="26" y="163" width="72" height="16" rx="8" fill="rgba(198,168,92,0.2)" stroke={G} strokeWidth="0.8"/>
      <text x="62" y="174" textAnchor="middle" fill={G} fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Trustworthy</text>
      <rect x="102" y="163" width="60" height="16" rx="8" fill="rgba(198,168,92,0.2)" stroke={G} strokeWidth="0.8"/>
      <text x="132" y="174" textAnchor="middle" fill={G} fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Competent</text>
      {/* Row 2 */}
      <rect x="16" y="183" width="58" height="16" rx="8" fill="rgba(198,168,92,0.2)" stroke={G} strokeWidth="0.8"/>
      <text x="45" y="194" textAnchor="middle" fill={G} fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Confident</text>
      <rect x="78" y="183" width="60" height="16" rx="8" fill="rgba(198,168,92,0.2)" stroke={G} strokeWidth="0.8"/>
      <text x="108" y="194" textAnchor="middle" fill={G} fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Successful</text>
      <rect x="142" y="183" width="52" height="16" rx="8" fill="rgba(198,168,92,0.2)" stroke={G} strokeWidth="0.8"/>
      <text x="168" y="194" textAnchor="middle" fill={G} fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Likeable</text>

      {/* ── RIGHT: Lower Attractiveness ── */}
      <text x="255" y="28" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontFamily="sans-serif" fontSize="11" fontWeight="700">Lower Attractiveness</text>

      {/* Plain face */}
      <ellipse cx="255" cy="90" rx="28" ry="34" fill="#222222" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
      {/* Sparse hair */}
      <path d="M227 76 Q232 62 255 60 Q270 62 275 70" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M228 76 Q225 68 230 62" stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none"/>
      {/* Eyes droopy */}
      <ellipse cx="244" cy="86" rx="5.5" ry="4" fill="rgba(255,255,255,0.7)"/>
      <ellipse cx="266" cy="86" rx="5.5" ry="4" fill="rgba(255,255,255,0.7)"/>
      <ellipse cx="244" cy="87" rx="3" ry="2.5" fill="#555"/>
      <ellipse cx="266" cy="87" rx="3" ry="2.5" fill="#555"/>
      {/* Bags under eyes */}
      <path d="M239 91 Q244 94 249 91" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none"/>
      <path d="M261 91 Q266 94 271 91" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none"/>
      {/* Nose bulbous */}
      <ellipse cx="255" cy="102" rx="6" ry="5" fill="#2a2a2a" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8"/>
      {/* Frown */}
      <path d="M244 114 Q255 108 266 114" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Jowls */}
      <path d="M229 108 Q226 118 232 124" stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none"/>
      <path d="M281 108 Q284 118 278 124" stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none"/>
      {/* Worn shirt */}
      <path d="M227 142 Q232 132 245 134 L255 142 L265 134 Q278 132 283 142 L288 162 L222 162Z" fill="#2a2520"/>
      <path d="M245 134 L255 150 L265 134" fill="#332d28"/>

      {/* Gray pills right */}
      <rect x="178" y="163" width="72" height="16" rx="8" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
      <text x="214" y="174" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Less Capable</text>
      <rect x="254" y="163" width="80" height="16" rx="8" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
      <text x="294" y="174" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Less Trustworthy</text>

      <rect x="178" y="183" width="62" height="16" rx="8" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
      <text x="209" y="194" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Overlooked</text>
      <rect x="244" y="183" width="52" height="16" rx="8" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
      <text x="270" y="194" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif" fontSize="8.5" fontWeight="600">Average</text>
      <rect x="300" y="183" width="32" height="16" rx="8" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
      <text x="316" y="194" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="sans-serif" fontSize="7.5" fontWeight="600">Forget</text>
    </svg>
  )
}

// ── STEP: Halo Effect / Why Looksmax ─────────────────────────────────────────
const HALO_LINES = [
  "People judge your character\nbased on your face in 3 seconds",
  "Make every second count",
]

function HaloTypewriter({ start }) {
  const [lineIdx, setLineIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const idx = useRef(0)

  useEffect(() => {
    if (!start) return
    idx.current = 0
    setDisplayed('')
    setDone(false)
    setLineIdx(0)
  }, [start])

  useEffect(() => {
    if (!start) return
    triggerPageHaptic()
  }, [start, lineIdx])

  useEffect(() => {
    if (!start) return
    const text = HALO_LINES[lineIdx]
    idx.current = 0
    setDisplayed('')
    setDone(false)
    const id = setInterval(() => {
      if (idx.current < text.length) {
        setDisplayed(text.slice(0, idx.current + 1))
        idx.current++
      } else {
        clearInterval(id)
        if (lineIdx === 0) {
          setTimeout(() => {
            setDisplayed('')
            setTimeout(() => setLineIdx(1), 300)
          }, 1200)
        } else {
          setDone(true)
        }
      }
    }, 28)
    return () => clearInterval(id)
  }, [start, lineIdx])

  const cursor = start && !done ? (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.5, repeat: Infinity }}
      style={{ color: ONBOARDING_GOLD, marginLeft: 1 }}
    >|</motion.span>
  ) : null
  const displayLines = displayed.split('\n')
  return (
    <span style={{ whiteSpace: 'pre-line' }}>
      {displayLines.map((line, i) => (
        <span key={i}>
          {line}
          {i === displayLines.length - 1 ? cursor : '\n'}
        </span>
      ))}
    </span>
  )
}

function HaloSubTypewriter({ start }) {
  const text = 'What impression are you making?'
  const [displayed, setDisplayed] = useState('')
  const idx = useRef(0)

  useEffect(() => {
    if (!start) return
    // delay until main typewriter is roughly done (~2 lines × chars × 28ms + pauses ≈ 3.5s)
    const delay = setTimeout(() => {
      triggerPageHaptic()
      idx.current = 0
      setDisplayed('')
      const id = setInterval(() => {
        idx.current++
        setDisplayed(text.slice(0, idx.current))
        if (idx.current >= text.length) clearInterval(id)
      }, 24)
      return () => clearInterval(id)
    }, 200)
    return () => clearTimeout(delay)
  }, [start])

  return <span>{displayed}</span>
}

function StepHaloEffect({ onNext, onBack }) {
  const G = ONBOARDING_GOLD
  const TEXT = '#FFFFFF'
  const [imgLoaded, setImgLoaded] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.src = haloEffectImg
  }, [])
  return (
    <div
      style={{ position: 'absolute', inset: 0, background: '#0A0A0A', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Content */}
      <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', padding: '0 24px 0', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}>
        <h1 className="font-heading font-bold text-[28px] leading-tight" style={{ color: TEXT, letterSpacing: '-0.02em', marginBottom: 16, textShadow: '0 0 24px rgba(255,255,255,0.25)' }}>
          Your face<br />speaks before you do
        </h1>
        <div style={{ margin: '-200px -24px 0', paddingTop: '5%', paddingBottom: '5%' }}>
          <img
            src={haloEffectImg}
            alt="The Halo Effect"
            onLoad={() => setImgLoaded(true)}
            style={{ display: 'block', width: '91%', margin: '0 auto', mixBlendMode: 'screen' }}
          />
        </div>
      </div>

      {/* Gold text */}
      <div style={{ flexShrink: 0, padding: '8px 24px', transform: 'translateY(-60px) scale(1.45)', transformOrigin: 'center' }}>
        <p
          className="font-heading font-extrabold text-[16px] leading-snug"
          style={{ color: G, textAlign: 'center', textShadow: `0 0 24px rgba(198,168,92,0.8)`, letterSpacing: '-0.01em' }}
        >
          <HaloSubTypewriter start={true} />
        </p>
      </div>

      {/* Bottom button */}
      <div style={{ flexShrink: 0, padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}>
        <GoldBtn label="Continue" onClick={onNext} solid />
      </div>
    </div>
  )
}

// ── STEP: Hypergamy ───────────────────────────────────────────────────────────
function StepHypergamy({ onNext, onBack }) {
  const G = '#C6A85C'
  const G_BORDER = 'rgba(198,168,92,0.28)'
  const TEXT = '#FFFFFF'
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0A0A0A' }}>
      {/* Header + chart — padded so card doesn't overlap */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 260, overflowY: 'auto', padding: '0 24px 12px' }}>
        <BackBtn onBack={onBack} />
        <h1 className="font-heading font-bold text-[24px] leading-tight" style={{ color: TEXT, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Dating apps changed the rules
        </h1>
        <p className="font-body text-[14px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>
          The top 20% get 80% of the attention — unless you optimize your structure
        </p>
        <div style={{ borderRadius: 16, overflow: 'hidden', border: `1.5px solid ${G_BORDER}` }}>
          <img src={hypergamyChart} alt="Hypergamy data chart" style={{ display: 'block', width: '100%' }} />
        </div>
      </div>

      {/* Bottom card — locked to bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 24px' }}>
        <div style={{
          background: '#0D0D0D',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: '12px 16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <h2 className="font-heading font-bold text-[14px]" style={{ color: TEXT, letterSpacing: '-0.01em', margin: 0 }}>
            Hypergamy
          </h2>
          <p className="font-body text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)', margin: 0 }}>
            Modern dating apps changed the math completely Women now have instant access to top tier profiles globally, meaning the average guy is no longer just competing locally Right now 80% of attention goes to the top 20% of men, leaving the rest nearly invisible in a crowded digital marketplace{' '}
            <span style={{ color: 'rgba(255,255,255,0.88)' }}>The good news is it is not about luck It is all about optimization</span>{' '}
            Once you figure out where you actually stand structurally, you can stop guessing, start maximizing your potential, and command the attention you deserve
          </p>
          <GoldBtn label="Find out where you rank" onClick={onNext} />
        </div>
      </div>
    </div>
  )
}

// ── STEP: Why Appearance Matters ──────────────────────────────────────────────
function StepWhyAppearance({ onNext, onBack }) {
  const G = '#C6A85C'
  const G_BORDER = 'rgba(198,168,92,0.28)'
  const TEXT = '#FFFFFF'
  const BG = '#0A0A0A'
  const stats = [
    { value: '12%', label: 'Higher average earnings', sub: 'Reported among more attractive workers', cite: 'Hamermesh & Biddle, 1994' },
    { value: '72%', label: 'Say appearance affects first impressions', sub: 'Within seconds', cite: 'OnePoll Survey, 2019' },
    { value: '3×', label: 'More likely to be rated positively in competence, trust & likeability', sub: '', cite: 'Dion, Berscheid & Walster, 1972' },
  ]
  return (
    <div className="flex flex-col h-full px-6" style={{ background: BG }}>
      <div className="flex-1 flex flex-col justify-start pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}>
        <motion.h1
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}
          className="font-heading font-bold text-[28px] leading-tight" style={{ color: TEXT, letterSpacing: '-0.02em', marginBottom: 16, textShadow: '0 0 24px rgba(255,255,255,0.25)' }}
        >
          Appearance isn't shallow, it's strategic
        </motion.h1>
        <div className="flex flex-col gap-3 mt-5">
          {stats.map((s, i) => (
            <motion.div
              key={s.value}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut', delay: 0.25 + i * 0.1 }}
              className="rounded-2xl px-6 py-4" style={{ background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.07)', height: 150, display: 'flex', alignItems: 'center' }}>
              <div className="flex items-center gap-5" style={{ width: '100%' }}>
                <span className="font-heading font-bold text-[36px] shrink-0 w-20 text-center" style={{ color: G, textShadow: `0 0 18px rgba(198,168,92,0.7), 0 0 40px rgba(198,168,92,0.35)` }}>{s.value}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-heading font-semibold text-[16px] leading-snug" style={{ color: 'rgba(255,255,255,0.9)' }}>{s.label}</span>
                  {s.sub ? <span className="font-heading font-semibold text-[16px] leading-snug" style={{ color: 'rgba(255,255,255,0.9)' }}>{s.sub}</span> : null}
                  {s.cite ? <p className="font-heading font-bold text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>{s.cite}</p> : null}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}>
        <GoldBtn label="Continue" onClick={onNext} />
      </div>
    </div>
  )
}

// ── STEP 6: Improvement Focus ─────────────────────────────────────────────────
// ── STEP: Cinematic Closer ────────────────────────────────────────────────────
function useTypewriter(text, speed = 38) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    if (!text) return
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      triggerHaptic()
      if (i >= text.length) clearInterval(iv)
    }, speed)
    return () => clearInterval(iv)
  }, [text, speed])
  return displayed
}

function StepCinematic({ onNext }) {
  const lines = [
    { text: 'Looks shape how the world sees you', gold: false },
    { text: 'They can shape first impressions', gold: false },
    { text: "Now it's time to see where you stand", gold: false },
    { text: 'Scan your face and find your starting point', gold: false },
  ]
  const [lineIdx, setLineIdx] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const displayed = useTypewriter(lines[lineIdx]?.text, 55)

  useEffect(() => {
    // Light tap as each new line starts — skip lineIdx 0 on mount (feels like a jolt on open)
    if (lineIdx > 0) triggerPageHaptic()
  }, [lineIdx])

  useEffect(() => {
    let cancelled = false
    const line = lines[lineIdx]
    const dur = line?.text.length * 55 + 1600
    const t = setTimeout(() => {
      if (cancelled) return
      if (lineIdx < lines.length - 1) {
        setLineIdx(i => i + 1)
      } else {
        setLeaving(true)
        setTimeout(() => { if (!cancelled) onNext() }, 700)
      }
    }, dur)
    return () => { cancelled = true; clearTimeout(t) }
  }, [lineIdx, onNext])

  function handleTap() {
    triggerHaptic()
    if (lineIdx < lines.length - 1) {
      setLineIdx(i => i + 1)
    } else {
      onNext()
    }
  }

  return (
    <motion.div
      onClick={handleTap}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.6, ease: 'easeIn' }}
      style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, #1a1a1a 0%, #000000 70%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 36px', cursor: 'pointer',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={lineIdx}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          className="font-heading font-bold text-center"
          style={{
            fontSize: lines[lineIdx]?.gold ? 36 : 32,
            whiteSpace: 'normal',
            lineHeight: 1.25,
            letterSpacing: lines[lineIdx]?.gold ? '0.04em' : '-0.02em',
            color: lines[lineIdx]?.gold ? '#C6A85C' : '#ffffff',
            textShadow: lines[lineIdx]?.gold
              ? '0 0 30px rgba(198,168,92,0.7), 0 0 60px rgba(198,168,92,0.3)'
              : '0 0 20px rgba(198,168,92,0.25)',
          }}
        >
          {displayed}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  )
}

// ── STEP: Primary Goal ───────────────────────────────────────────────────────
const GoalIconDating = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>
    <path d="M7.5 9.5c0 .687.265 1.383.697 1.844l3.009 3.264a1.14 1.14 0 0 0 .407.314 1 1 0 0 0 .783-.004 1.14 1.14 0 0 0 .398-.31l3.008-3.264A2.77 2.77 0 0 0 16.5 9.5 2.5 2.5 0 0 0 12 8a2.5 2.5 0 0 0-4.5 1.5"/>
  </svg>
)
const GoalIconJawline = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"/>
  </svg>
)
const GoalIconSkin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>
    <path d="M20 2v4"/><path d="M22 4h-4"/>
    <circle cx="4" cy="20" r="2"/>
  </svg>
)
const GoalIconGlow = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/>
    <path d="M5 21h14"/>
  </svg>
)

const PRIMARY_GOAL_OPTIONS = [
  {
    key: 'dating',
    Icon: GoalIconDating,
    label: 'Dating & Social Confidence',
    desc: 'Feel more confident in photos, dating apps, and in person',
  },
  {
    key: 'jawline',
    Icon: GoalIconJawline,
    label: 'Jawline & Face Shape',
    desc: 'Define your jawline, improve lower face structure, and optimize facial posture',
  },
  {
    key: 'skin',
    Icon: GoalIconSkin,
    label: 'Skin Quality & Tone',
    desc: 'Clear up acne, fix texture, and build a simple high-impact skincare routine',
  },
  {
    key: 'glow',
    Icon: GoalIconGlow,
    label: 'Total Glow-Up & Symmetry',
    desc: 'Get a complete breakdown of your facial features and discover where to focus first',
  },
]

// ── STEP: Attractiveness Impact ───────────────────────────────────────────────
function StepAttractivenessImpact({ onNext, onBack }) {
  const bars = [
    { label: 'Dating',       pct: 80, gold: true },
    { label: 'Popularity',   pct: 65 },
    { label: 'Career Oppt', pct: 40 },
    { label: 'Income',       pct: 30 },
  ]
  const touchStartX = useRef(null)
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx < -50) { triggerPageHaptic(); onNext() }
    else if (dx > 50) { triggerPageHaptic(); onBack() }
  }
  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ background: '#0A0A0A', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Top text — same position as every other page */}
      <div style={{ flexShrink: 0, padding: '0 24px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 22px)' }}>
        <h1 className="font-heading font-bold text-[28px] leading-tight mb-2" style={{ color: TEXT, letterSpacing: '-0.02em', textShadow: '0 0 24px rgba(255,255,255,0.25)' }}>
          How looks shape your life
        </h1>
        <p className="font-body text-[14px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>
          99 out of 100 people don't realize how much attractiveness affects them in their day to day life
        </p>
      </div>

      {/* Bars — fill remaining space */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '24px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', flex: 1 }}>
          {bars.map(({ label, pct, gold }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="font-heading font-semibold text-[17px]" style={{ width: 110, color: gold ? G : 'rgba(255,255,255,0.75)', flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: 6,
                  background: gold ? 'linear-gradient(90deg, #D4AF6A 0%, #C6A85C 100%)' : 'rgba(255,255,255,0.9)',
                  boxShadow: gold ? '0 0 20px rgba(198,168,92,1), 0 0 50px rgba(198,168,92,0.6), 0 0 80px rgba(198,168,92,0.3)' : 'none',
                }} />
              </div>
              <span className="font-heading font-bold text-[17px]" style={{ width: 44, textAlign: 'right', color: gold ? G : 'rgba(255,255,255,0.75)', flexShrink: 0 }}>{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom button — same position as every other page */}
      <div style={{ flexShrink: 0, padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)' }}>
        <GoldBtn label="Continue" onClick={onNext} />
      </div>
    </div>
  )
}

function StepPrimaryGoal({ data, onChange, onNext, onBack }) {
  const selected = data.primaryGoal || ''

  function pick(key) {
    triggerHaptic()
    onChange('primaryGoal', key)
    setTimeout(onNext, 220)
  }

  return (
    <div className="flex flex-col h-full px-6" style={{ background: BG }}>
      <div className="flex-1 flex flex-col justify-start pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 52px)' }}>
        <motion.h1
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}
          className="font-heading font-bold text-[28px] leading-tight"
          style={{ color: TEXT, letterSpacing: '-0.02em', marginBottom: 16, textShadow: '0 0 24px rgba(255,255,255,0.25)' }}
        >
          What do you want to improve first?
        </motion.h1>

        <div className="flex flex-col gap-3 mt-6">
          {PRIMARY_GOAL_OPTIONS.map(({ key, Icon, label, desc }, i) => {
            const isSelected = selected === key
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.97 }}
                onClick={() => pick(key)}
                className="flex items-center gap-4 px-5 rounded-2xl text-left transition-all duration-150"
                style={{
                  height: 130,
                  background: isSelected ? 'rgba(198,168,92,0.10)' : SURFACE,
                  border: `1.5px solid ${isSelected ? G : BORDER}`,
                }}
              >
                <span className="leading-none flex-shrink-0" style={{ color: '#fff' }}><Icon /></span>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-heading font-extrabold text-[17px] leading-snug mb-0.5"
                    style={{ color: G, textShadow: '0 0 18px rgba(198,168,92,0.6)' }}
                  >
                    {label}
                  </p>
                  <p className="font-body font-bold text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {desc}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>

      </div>
    </div>
  )
}

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
    triggerHaptic()
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key]
    onChange('improvementFocus', next)
  }

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center">
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
      <div className="flex-1 overflow-y-auto px-6 pb-4">
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
// ── Shared layout for face and side photo steps ───────────────────────────────
// Must be defined at module level — never inside a render function — so React
// sees a stable component type across re-renders.
function PhotoStepScreen({ stepLabel, headline, photo, photoType, gender, triggerRef, onPhoto, onBack, error: screenError, buttonLabel, onButton, extra }) {
  return (
    <div className="flex flex-col h-full" style={{ background: '#080808' }}>
      <BackBtn onBack={onBack} />
      <div className="px-6">
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
          stepNum={photoType === 'side' ? 2 : 1}
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
  const [liveAnalysisResult, setLiveAnalysisResult] = useState(null)
  const [analysisPoints, setAnalysisPoints] = useState(null)
  const [analysisLandmarks, setAnalysisLandmarks] = useState(null)
  const [sideAnalysisPoints, setSideAnalysisPoints] = useState(null)
  const [sideAnalysisLandmarks, setSideAnalysisLandmarks] = useState(null)
  const [sideDetectionPending, setSideDetectionPending] = useState(false)
  const [meshPathD, setMeshPathD] = useState(null)
  const [error, setError]               = useState('')
  const [rateLimited, setRateLimited]   = useState(false)
  const [quotaExhausted, setQuotaExhausted] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const retrySideRef = useRef(null)
  const frontLandmarksRef = useRef(null)
  const animationGateRef = useRef(null)
  const sideTriggerRef = useRef(null)
  const faceTriggerRef = useRef(null)
  const finishAnimation = useCallback(() => {
    animationGateRef.current?.()
    animationGateRef.current = null
  }, [])

  function ensureFrontLandmarks(url) {
    if (!url) return Promise.resolve(null)
    if (frontLandmarksRef.current?.url === url) return frontLandmarksRef.current.promise
    setAnalysisPoints(null)
    setMeshPathD(null)
    const promise = import('../utils/faceLandmarks.js')
      .then(({ getLandmarks }) => getLandmarks(url))
      .then(lm => {
        setAnalysisLandmarks(lm)
        const points = extractScanOverlayPoints(lm)
        if (points) setAnalysisPoints(points)
        import('@mediapipe/face_mesh').then(mod => {
          const FACEMESH_TESSELATION = mod.FACEMESH_TESSELATION || mod.default?.FACEMESH_TESSELATION || globalThis.FACEMESH_TESSELATION
          const path = buildMeshPathD(lm, FACEMESH_TESSELATION)
          if (path) setMeshPathD(path)
        }).catch(() => {})
        return { points, landmarks: lm }
      })
      .catch(err => {
        console.warn('[PremiumOnboarding] Front landmark mapping unavailable:', err?.message)
        return null
      })
    frontLandmarksRef.current = { url, promise }
    return promise
  }
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
      setTimeout(() => reject(new Error('Photo processing timed out Please retake your photo')), 15_000)
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
    setLiveAnalysisResult(null)
    setSideAnalysisPoints(null)
    setSideAnalysisLandmarks(null)
    setSideDetectionPending(!!side)
    const animationGate = new Promise(resolve => { animationGateRef.current = resolve })

    // Fire MediaPipe landmark detection in parallel with the AI call so
    // FacialAnalysisOverlay gets real per-user coordinates instead of null.
    let frontLandmarksPromise = Promise.resolve(null)
    if (face) {
      setAnalysisStep(1)
      frontLandmarksPromise = ensureFrontLandmarks(face)
    }

    const slowTimer  = setTimeout(() => setSlowAnalysis(true), 12000)

    try {
      const faceB64 = await toBase64(face)
      setFacePhoto(faceB64) // upgrade blob URL → stable data URL so retries don't expire
      const sideB64 = side ? await toBase64(side) : null
      if (sideB64) setSidePhoto(sideB64)
      let sideLandmarksPromise = Promise.resolve(null)
      let sideProfileGeometryResult = null
      if (sideB64) {
        if (Capacitor.isNativePlatform()) {
          sideLandmarksPromise = analyzeSideProfile(sideB64).then(result => {
            sideProfileGeometryResult = result
            const profilePoints = result?.detected ? profilePointsFromVision(result.landmarks) : null
            if (profilePoints) setSideAnalysisPoints(profilePoints)
            return profilePoints
          }).catch(err => {
            console.warn('[PremiumOnboarding] Profile mapping unavailable:', err?.message)
            return null
          })
            .finally(() => setSideDetectionPending(false))
        } else {
          sideLandmarksPromise = frontLandmarksPromise.then(() => import('../utils/faceLandmarks.js'))
            .then(({ getLandmarks }) => getLandmarks(sideB64))
            .then(lm => {
              setSideAnalysisLandmarks(lm)
              const profilePoints = profilePointsFromMesh(lm)
              setSideAnalysisPoints(profilePoints)
              return profilePoints
            })
            .catch(err => {
              console.warn('[PremiumOnboarding] Profile mapping unavailable:', err?.message)
              return null
            })
            .finally(() => setSideDetectionPending(false))
        }
      } else {
        setSideDetectionPending(false)
      }
      setSlowAnalysis(false)
      const frontDetection = await frontLandmarksPromise
      if (!frontDetection?.points || !frontDetection?.landmarks) throw new Error('LANDMARK DETECTION FAILED — retake a clear front photo and try again.')
      // Only native detection supplies measured profile geometry. Web mesh
      // anchors are optional and must not block analysis of the actual photo.
      if (sideB64 && Capacitor.isNativePlatform()) await sideLandmarksPromise
      const sideProfileGeometry = sideProfileGeometryResult?.detected
        ? { facialConvexityDegrees: sideProfileGeometryResult.facialConvexityDegrees ?? null }
        : null
      const analysisEvidence = await buildProductionEvidence({
        frontImage: faceB64,
        frontLandmarks: frontDetection.landmarks,
        qualityGate: { passed: true, state: 'SUCCESS', source: 'onboarding_capture_gate' },
        sideProfileGeometry: sideProfileGeometryResult,
      })
      setAnalysisStep(2)

      // Wait for the silent guest session to resolve before calling the
      // authenticated API. If the user reaches analysis faster than the
      // POST /auth/guest round-trip, this yields until the token is stored.
      if (guestReadyRef?.current) await guestReadyRef.current

      let aiResult
      let presentationFollowup = null
      try {
        setScanInFlight(true)
        aiResult = await requestProductionAnalysis({
          apiClient: api,
          faceImage: faceB64,
          sideImage: sideB64,
          sideProfileGeometry,
          evidence: analysisEvidence,
          gender: gender || 'male',
        })
        presentationFollowup = aiResult.presentationPromise ?? null
        delete aiResult.presentationPromise
      } finally {
        setScanInFlight(false)
        clearTimeout(slowTimer)
        setSlowAnalysis(false)
      }

      setLiveAnalysisResult(aiResult)
      setAnalysisStep(3)

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
        analysisEvidence: aiResult.analysisEvidence,
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

      await Promise.race([animationGate, new Promise((_, reject) => setTimeout(() => reject(new Error('Could not track the face for the analysis animation Please retry the scan')), 30000))])
      onDone(scanRecord)
      presentationFollowup?.then(feedback => {
        if (feedback) useStore.getState().patchScanPresentation(scanRecord.id, feedback)
      }).catch(() => {})
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
        setError(err.message || 'Something went wrong, please try again')
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
              <p className="font-body text-[13px] text-center" style={{ color: DIM }}>Free accounts get 3 scans per day Upgrade to Ascendus Max for unlimited scans</p>
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
                <p className="font-body text-[13px] mt-1" style={{ color: DIM }}>We're experiencing high demand right now Please try again in 30 seconds</p>
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
              <p className="font-body text-[13px] text-center" style={{ color: DIM }}>{error || 'Please try again'}</p>
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
        <AnalyzingScreen currentStep={analysisStep} slow={slowAnalysis} photo={facePhoto} sidePhoto={sidePhoto} scanResult={liveAnalysisResult} points={analysisPoints} sidePoints={sideAnalysisPoints} rawLandmarks={analysisLandmarks} sideRawLandmarks={sideAnalysisLandmarks} meshPathD={meshPathD} sideDetectionPending={sideDetectionPending} onSequenceComplete={finishAnimation} />
      </div>
    )
  }

  if (phase === 'side') {
    return (
      <PhotoStepScreen
        stepLabel="STEP 3 OF 3"
        headline="Now, your side profile"
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
        extra={null}
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
      onButton={async () => {
        if (!facePhoto) faceTriggerRef.current?.()
        else {
          try {
            const { validateScanQuality } = await import('../utils/scanQuality.js')
            const quality = await validateScanQuality(facePhoto)
            if (!quality.passed) {
              setError(quality.issues?.[0]?.advice || 'Please retake a clearer front photo')
              return
            }
            ensureFrontLandmarks(facePhoto)
            setPhase('side'); setError('')
          } catch { setError('Could not check the photo Please try again') }
        }
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
  const setPrimaryGoal     = useStore(s => s.setPrimaryGoal)
  const setAssignedPhase   = useStore(s => s.setAssignedPhase)
  const setUnits           = useStore(s => s.setUnits)
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
    // Strict Mode and quick remounts share one request. A late guest response
    // must never replace an account the user signed into while it was pending.
    if (!guestSessionFlight) guestSessionFlight = api.auth.guest().finally(() => { guestSessionFlight = null })
    guestReadyRef.current = guestSessionFlight
      .then(({ userId, token }) => {
        if (!useStore.getState().isAuthenticated) setGuestSession(userId, token)
      })
      .catch(err => console.warn('[Onboarding] Guest session failed (non-fatal):', err?.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep answers, but never restore a saved screen index on a new mount.
  // Old drafts can point at the cinematic/end of a different onboarding flow.
  const [draft] = useState(loadDraft)
  const [step, setStep] = useState(0)
  const activeStepRef = useRef(step)
  activeStepRef.current = step
  const [dir, setDir] = useState(1)
  const [sessionError, setSessionError] = useState('')

  const [formData, setFormData] = useState({
    gender: '', goal: '', primaryGoal: '',
    improvementFocus: [],
    ...draft?.formData,
  })

  // Persist a draft on every step/field change.
  useEffect(() => {
    saveDraft({ formData })
  }, [step, formData, isAuthenticated])


  function updateField(key, value) {
    if (key === '_units') {
      setUnits(value)
    } else {
      setFormData(prev => ({ ...prev, [key]: value }))
    }
  }

  function goNext() {
    // An outgoing screen's delayed/duplicate callback must not advance a new screen.
    if (activeStepRef.current !== step) return
    const next = nextOnboardingStep(step)
    activeStepRef.current = next
    setDir(1)
    setStep(next)
  }
  function goBack() {
    if (step <= 0 || activeStepRef.current !== step) return
    const previous = nextOnboardingStep(step, -1)
    activeStepRef.current = previous
    setDir(-1)
    setStep(previous)
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
      if (scanRecord.facePhotoUrl) {
        import('../utils/scanPhotoDb.js').then(({ saveScanMedia }) =>
          saveScanMedia(scanRecord.id, { photo: scanRecord.facePhotoUrl })
        ).catch(err => console.warn('[OnboardingScan] Could not persist scan photo:', err?.message))
      }
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

  // Called after StepNotifications — final unlock.
  async function handleFinalDone() {
    if (activeStepRef.current !== FINAL_ONBOARDING_STEP) return
    // Never persist a shared fake login when the guest request failed.
    if (!useStore.getState().token) {
      try {
        await guestReadyRef.current
        if (!useStore.getState().token) {
          const { userId, token } = await api.auth.guest()
          if (!userId || !token) throw new Error('Guest session unavailable')
          if (!useStore.getState().isAuthenticated) setGuestSession(userId, token)
        }
      } catch (err) {
        console.error('[Onboarding] Could not establish session:', err?.message)
        setSessionError('Unable to reconnect. Please check your connection and try again.')
        return
      }
    }
    clearDraft()
    setGender(formData.gender || null)
    if (formData.primaryGoal) setPrimaryGoal(formData.primaryGoal)
    setLegalConsented()
    setAgeConfirmed()
    setHasOnboarded(FINAL_ONBOARDING_STEP)
  }


  // Start directly with the existing gender question.
  const steps = [
    <StepGender key="gender" data={formData} onChange={updateField} onNext={goNext} />,
    <StepHaloEffect key="haloEffect" onNext={goNext} onBack={goBack} />,
    <StepWhyAppearance key="whyAppearance" onNext={goNext} onBack={goBack} />,
    <StepPrimaryGoal key="primaryGoal" data={formData} onChange={updateField} onNext={goNext} onBack={goBack} />,
    <StepNotifications key="notifications" onNext={goNext} />,
    <StepTestimonials key="testimonials" onNext={goNext} />,
    <StepCinematic key="cinematic" onNext={handleFinalDone} />,
  ]

  return (
    <MotionPage
      baseClassName=""
      className="relative flex flex-col h-full overflow-hidden dark"
      style={{ background: '#0a0a0a', '--text-secondary': 'rgba(255,255,255,0.5)' }}
    >
      {sessionError && <div role="alert" className="absolute inset-x-4 bottom-8 z-[60] rounded-2xl bg-[#171717] p-5 text-center text-white">
        <p>{sessionError}</p>
        <button className="mt-3 rounded-xl bg-[#C6A85C] px-5 py-3 text-black" onClick={() => { setSessionError(''); handleFinalDone() }}>Try again</button>
      </div>}
      {/* Progress bar — hidden on cinematic (last) step */}
      {step < steps.length - 1 && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0' }}>
            {steps.slice(0, -1).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? '#FFFFFF' : 'rgba(255,255,255,0.15)', transition: 'background 0.3s' }} />
            ))}
          </div>
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
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(e, info) => {
            if (info.offset.x > 60 && step > 0) { triggerPageHaptic(); goBack() }
          }}
        >
          {steps[step]}
        </motion.div>
      </AnimatePresence>
    </MotionPage>
  )
}
