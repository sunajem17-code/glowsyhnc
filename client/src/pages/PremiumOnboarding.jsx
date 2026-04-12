import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import logo from '../assets/ascendus-icon.png'

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = '#C6A85C'
const G_DIM = 'rgba(198,168,92,0.10)'
const G_BORDER = 'rgba(198,168,92,0.28)'
const BG = '#080808'
const SURFACE = '#111111'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.35)'

// Steps with progress bar: 1-9. Step 10 = phase result (no progress)
const TOTAL_QUIZ_STEPS = 10

const pageVariants = {
  enter: (dir) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
}
const pageTrans = { type: 'spring', stiffness: 380, damping: 36 }

// ── Shared UI ─────────────────────────────────────────────────────────────────
function BackBtn({ onBack }) {
  return (
    <button
      onClick={onBack}
      className="absolute top-14 left-5 w-9 h-9 rounded-full flex items-center justify-center z-10"
      style={{ background: 'rgba(255,255,255,0.06)' }}
    >
      <ChevronLeft size={18} style={{ color: DIM }} />
    </button>
  )
}

function GoldBtn({ label, onClick, disabled, loading }) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2"
      style={{
        background: disabled || loading
          ? 'rgba(198,168,92,0.22)'
          : `linear-gradient(135deg, #D4B96A 0%, ${G} 50%, #A8893A 100%)`,
        color: disabled || loading ? 'rgba(255,255,255,0.25)' : '#0A0A0A',
        boxShadow: disabled || loading ? 'none' : `0 4px 20px rgba(198,168,92,0.25)`,
        letterSpacing: '0.01em',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {label}
    </motion.button>
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

function Slider({ label, unit, value, min, max, step = 1, onChange }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[11px] font-heading font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {label}
        </span>
        <span className="font-heading font-bold text-[30px]" style={{ color: G, letterSpacing: '-0.02em' }}>
          {value}<span className="text-[14px] ml-1" style={{ color: 'rgba(198,168,92,0.55)' }}>{unit}</span>
        </span>
      </div>
      <div className="relative h-[44px] flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="absolute left-0 h-1 rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, #A8893A, ${G})` }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-x-0 w-full opacity-0 h-[44px] cursor-pointer"
          style={{ zIndex: 2 }}
        />
        <div
          className="absolute w-6 h-6 rounded-full border-2 pointer-events-none"
          style={{ left: `calc(${pct}% - ${pct * 0.24}px - 2px)`, background: G, borderColor: BG, boxShadow: `0 0 12px rgba(198,168,92,0.5)`, zIndex: 1 }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.2)' }}>{min}{unit}</span>
        <span className="text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.2)' }}>{max}{unit}</span>
      </div>
    </div>
  )
}

// ── STEP 0: Welcome ───────────────────────────────────────────────────────────
const SOCIAL_STATS = [
  { value: '10,000+', label: 'men looksmaxxing' },
  { value: '+1.2pts', label: 'avg score in 90 days' },
  { value: '78%', label: 'complete their plan' },
]

function StepWelcome({ onCreateAccount, onSignIn }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col h-full px-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center items-center text-center pt-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
          Brutally accurate AI scoring, celebrity matches,<br />and a 12-week plan built for you.
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
function SignInView({ onBack, onSuccess }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth = useStore(s => s.setAuth)
  const { setHasOnboarded, setLegalConsented, setReferralCode } = useStore()

  async function handleSignIn(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.auth.login({ email: form.email, password: form.password })
      setAuth(data.user, data.token)
      setReferralCode(String(data.user.id).substring(0, 8).toUpperCase())
      setLegalConsented()
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

          <div className="pt-2">
            <GoldBtn label={loading ? 'Signing in…' : 'Sign In'} onClick={handleSignIn} loading={loading} />
          </div>
        </form>
      </div>
    </div>
  )
}

// ── STEP 1: Sign Up ───────────────────────────────────────────────────────────
function StepSignUp({ data, onChange, onNext, onBack, setAuthData }) {
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setAuth = useStore(s => s.setAuth)
  const setReferralCode = useStore(s => s.setReferralCode)

  const valid = data.name?.trim() && data.email?.trim() && data.password?.length >= 8
    && data.password === data.confirmPassword

  async function handleRegister() {
    if (!valid) return
    setError('')
    setLoading(true)
    try {
      // Pass referral code if user arrived via a referral link (?ref=ASCXXXXX)
      const urlParams = new URLSearchParams(window.location.search)
      const refCode = urlParams.get('ref')
      const res = await api.auth.register({
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
        ...(refCode ? { refCode } : {}),
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
            <label className="text-[11px] font-body font-medium uppercase tracking-wide mb-1.5 block" style={{ color: DIM }}>Full Name</label>
            <input type="text" placeholder="Your name" value={data.name || ''}
              onChange={e => onChange('name', e.target.value)} style={inputStyle} />
          </div>
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
                className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: DIM }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-body font-medium uppercase tracking-wide mb-1.5 block" style={{ color: DIM }}>Confirm Password</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} placeholder="Repeat password"
                value={data.confirmPassword || ''} onChange={e => onChange('confirmPassword', e.target.value)}
                style={{ ...inputStyle, paddingRight: 48,
                  borderColor: data.confirmPassword && data.password !== data.confirmPassword ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)',
                }} />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: DIM }}>
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {data.confirmPassword && data.password !== data.confirmPassword && (
              <p className="text-[11px] mt-1 font-body" style={{ color: '#EF4444' }}>Passwords do not match</p>
            )}
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

// ── STEP 2: Age Gate ──────────────────────────────────────────────────────────
function StepAgeGate({ data, onChange, onNext, onBack }) {
  const confirmed = data.ageConfirmed === true
  const blocked   = data.ageConfirmed === false

  return (
    <div className="flex flex-col h-full px-6">
      <BackBtn onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center pt-20">
        <h1 className="font-heading font-bold text-[28px] mb-2" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          How old are you?
        </h1>
        <p className="font-body text-[13px] mb-8" style={{ color: DIM }}>
          Ascendus is available to users 17 and older.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {[
            { key: true,  label: '17 or older', emoji: '✅', color: '#34C759', bg: 'rgba(52,199,89,0.08)', border: 'rgba(52,199,89,0.28)' },
            { key: false, label: 'Under 17',    emoji: '🔒', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
          ].map(({ key, label, emoji, color, bg, border }) => {
            const isSelected = data.ageConfirmed === key
            return (
              <motion.button
                key={String(key)}
                whileTap={{ scale: 0.96 }}
                onClick={() => onChange('ageConfirmed', key)}
                className="flex flex-col items-center py-8 rounded-2xl transition-all"
                style={{
                  background: isSelected ? bg : SURFACE,
                  border: `1.5px solid ${isSelected ? border : BORDER}`,
                }}
              >
                <span className="text-3xl mb-3">{emoji}</span>
                <p className="font-heading font-bold text-[14px]" style={{ color: isSelected ? color : TEXT }}>{label}</p>
              </motion.button>
            )
          })}
        </div>

        {blocked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p className="text-sm font-heading font-bold text-center" style={{ color: '#EF4444' }}>
              Ascendus is for users 17 and older.
            </p>
            <p className="text-[12px] font-body text-center mt-1" style={{ color: 'rgba(239,68,68,0.7)' }}>
              Contact support@ascendus.com if you believe this is an error.
            </p>
          </motion.div>
        )}
      </div>

      <div className="pb-10">
        <GoldBtn label="Continue →" onClick={onNext} disabled={!confirmed} />
      </div>
    </div>
  )
}

// ── STEP 3: Legal Consent ─────────────────────────────────────────────────────
function StepConsent({ checks, onToggle, onNext, onBack }) {
  const navigate = useNavigate()
  const allChecked = Object.values(checks).every(Boolean)

  const items = [
    { key: 'age', label: 'I am 17 years of age or older', sub: null },
    { key: 'terms', label: 'I agree to the Terms of Service', sub: null, link: '/terms' },
    { key: 'privacy', label: 'I agree to the Privacy Policy', sub: null, link: '/privacy' },
    {
      key: 'aiConsent',
      label: 'I consent to AI photo analysis',
      sub: 'My face and body photos will be sent to Anthropic Claude AI for analysis and stored securely. I can delete my data anytime in Settings.',
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
          All 5 must be checked to continue.
        </p>

        <div className="space-y-2.5 mb-5">
          {items.map(({ key, label, sub, link }) => (
            <div key={key}>
              <Checkbox
                checked={!!checks[key]}
                onToggle={() => onToggle(key)}
                label={
                  link ? (
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
            💛 <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Wellbeing reminder:</span> Scores are tools for self-improvement, not measures of your worth. If you struggle with body image, please speak to a mental health professional.
          </p>
        </div>
      </div>

      <div className="pb-10 pt-2">
        <GoldBtn label="I Agree — Continue →" onClick={onNext} disabled={!allChecked} />
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
            className="flex flex-col items-center py-10 rounded-3xl transition-all duration-150"
            style={{
              background: isMale ? 'rgba(37,99,235,0.12)' : SURFACE,
              border: `2px solid ${isMale ? '#3B82F6' : BORDER}`,
              boxShadow: isMale ? '0 0 24px rgba(59,130,246,0.18)' : 'none',
            }}
          >
            <span className="text-4xl mb-3">♂</span>
            <p className="font-heading font-bold text-[18px]" style={{ color: isMale ? '#60A5FA' : TEXT }}>Male</p>
            <p className="font-body text-[11px] mt-1.5" style={{ color: DIM }}>Masculine model</p>
          </motion.button>

          {/* Female */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange('gender', 'female')}
            className="flex flex-col items-center py-10 rounded-3xl transition-all duration-150"
            style={{
              background: isFemale ? 'rgba(236,72,153,0.10)' : SURFACE,
              border: `2px solid ${isFemale ? '#EC4899' : BORDER}`,
              boxShadow: isFemale ? '0 0 24px rgba(236,72,153,0.15)' : 'none',
            }}
          >
            <span className="text-4xl mb-3">♀</span>
            <p className="font-heading font-bold text-[18px]" style={{ color: isFemale ? '#F472B6' : TEXT }}>Female</p>
            <p className="font-body text-[11px] mt-1.5" style={{ color: DIM }}>Feminine model</p>
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
  { key: 'dating',      emoji: '❤️', label: 'Dating & Relationships',  desc: 'Attract more attention and build confidence with partners' },
  { key: 'career',      emoji: '💼', label: 'Career & Networking',     desc: 'Command presence and make strong first impressions' },
  { key: 'confidence',  emoji: '🛡️', label: 'Self-Confidence',         desc: 'Feel good in your own skin and carry yourself better' },
  { key: 'appearance',  emoji: '✨', label: 'Overall Appearance',      desc: 'Optimize every aspect of how you look and present' },
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

        {GOAL_OPTIONS.map(({ key, emoji, label, desc }) => {
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
              <span className="text-2xl flex-shrink-0">{emoji}</span>
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
  { key: 'jawline',   emoji: '🦴', label: 'Jawline & Chin' },
  { key: 'skin',      emoji: '✨', label: 'Skin Quality' },
  { key: 'eyes',      emoji: '👁️', label: 'Eyes & Brows' },
  { key: 'symmetry',  emoji: '⚖️', label: 'Overall Symmetry' },
  { key: 'body',      emoji: '💪', label: 'Body & Physique' },
  { key: 'hair',      emoji: '💇', label: 'Hair & Grooming' },
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
          {FOCUS_OPTIONS.map(({ key, emoji, label }) => {
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
                <span className="text-xl flex-shrink-0">{emoji}</span>
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
            <span className="text-2xl">🏆</span>
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
  const feet = Math.floor(cm / 30.48)
  const inches = Math.round((cm / 30.48 - feet) * 12)

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
          unit={units === 'imperial' ? `lbs (${lbs})` : 'kg'}
          value={kg}
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

// ── STEP 8: BMI Result ────────────────────────────────────────────────────────
function calcBMI(heightCm, weightKg) {
  return weightKg / Math.pow(heightCm / 100, 2)
}

const BMI_TIERS = [
  {
    max: 18.5,
    label: 'Underweight',
    phase: 'BULK phase',
    phaseEmoji: '💪',
    directive: '+300 cal surplus',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.09)',
    border: 'rgba(59,130,246,0.28)',
    impact: 'Being underweight means your face looks gaunt and your frame lacks presence. Building muscle mass will fill out your jaw, neck, and shoulders — directly raising your score.',
  },
  {
    max: 25,
    label: 'Healthy Weight',
    phase: 'RECOMP',
    phaseEmoji: '⚡',
    directive: 'Maintain calories',
    color: '#C6A85C',
    bg: 'rgba(198,168,92,0.09)',
    border: 'rgba(198,168,92,0.28)',
    impact: "You're in the ideal range to recomp — lose fat and build muscle simultaneously. This is the most effective phase for improving your appearance rating.",
  },
  {
    max: 30,
    label: 'Overweight',
    phase: 'CUT phase',
    phaseEmoji: '🔥',
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
    phaseEmoji: '🔥',
    directive: '-500 to -750 cal deficit · urgent',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.09)',
    border: 'rgba(239,68,68,0.28)',
    impact: 'Body fat is the single biggest factor dragging your score. It hides your facial bone structure, jawline, and neck — three of the highest-weight metrics in your rating.',
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
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
          <p className="font-heading font-bold text-[22px] mb-1" style={{ color: TEXT }}>
            {tier.phaseEmoji} {tier.phase}
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
        <GoldBtn label="Continue →" onClick={onNext} />
      </div>
    </div>
  )
}

// ── STEP 10: Phase Assignment ─────────────────────────────────────────────────
function calculatePhase(goal, heightCm, weightKg) {
  const bmi = weightKg / Math.pow(heightCm / 100, 2)
  if (goal === 'Maintain') return 'MAINTENANCE'
  if (goal === 'Lose Fat' || bmi > 27) return 'CUT'
  if (goal === 'Build Muscle' && bmi < 22) return 'BULK'
  return 'RECOMP'
}

const PHASE_INFO = {
  CUT: {
    emoji: '🔥',
    label: 'CUT',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    headline: 'Your Phase: Cut',
    why: 'Based on your goal and body stats, losing body fat is your highest-leverage move. Reducing body fat will reveal your jawline, V-taper, and muscle definition — directly boosting your score.',
    actions: ['500 cal/day deficit', '0.8–1g protein per lb', 'Cardio 3× per week', 'Strength training 4× per week'],
  },
  BULK: {
    emoji: '💪',
    label: 'BULK',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    headline: 'Your Phase: Bulk',
    why: 'Your stats show you have room to build mass. Adding muscle to your frame will improve your V-taper, broaden your shoulders, and elevate your overall physique score significantly.',
    actions: ['250–300 cal/day surplus', '0.8–1g protein per lb', 'Compound lifts 4–5× per week', 'Focus on progressive overload'],
  },
  RECOMP: {
    emoji: '⚡',
    label: 'RECOMP',
    color: '#C6A85C',
    bg: 'rgba(198,168,92,0.08)',
    border: 'rgba(198,168,92,0.25)',
    headline: 'Your Phase: Recomp',
    why: "You're in the ideal zone to recompose — lose fat and build muscle simultaneously. This is the most effective phase for improving your overall appearance rating.",
    actions: ['Maintenance calories (±100)', '1g protein per lb bodyweight', 'Strength training 4× per week', 'Track weekly photos for progress'],
  },
  MAINTENANCE: {
    emoji: '🎯',
    label: 'MAINTENANCE',
    color: '#34C759',
    bg: 'rgba(52,199,89,0.08)',
    border: 'rgba(52,199,89,0.25)',
    headline: 'Your Phase: Maintenance',
    why: "You're happy with your current physique. Your plan focuses on consistency, optimizing grooming, skincare, and posture — the highest ROI improvements at your level.",
    actions: ['Maintenance calories', 'Strength training 3–4× per week', 'Focus on grooming & skincare', 'Posture correction protocol'],
  },
}

function StepPhaseResult({ data, onFinish }) {
  const phase = calculatePhase(data.goal, data.height || 175, data.weight || 75)
  const info = PHASE_INFO[phase]

  return (
    <div className="flex flex-col h-full px-6">
      <div className="flex-1 flex flex-col justify-center">
        {/* Phase badge */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-6"
        >
          <div className="text-5xl mb-4">{info.emoji}</div>
          <div
            className="inline-block px-6 py-2.5 rounded-full font-heading font-bold text-[13px] uppercase tracking-widest mb-5"
            style={{ background: info.bg, border: `1.5px solid ${info.border}`, color: info.color }}
          >
            {info.label}
          </div>
          <h1 className="font-heading font-bold text-[28px] mb-3" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
            Your personalized<br />plan is ready.
          </h1>
          <p className="font-body text-[14px] leading-relaxed" style={{ color: DIM }}>
            {info.why}
          </p>
        </motion.div>

        {/* Action items */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-4 mb-4"
          style={{ background: info.bg, border: `1px solid ${info.border}` }}
        >
          <p className="font-heading font-bold text-[11px] uppercase tracking-widest mb-3" style={{ color: info.color }}>
            Your Protocol
          </p>
          <div className="space-y-2">
            {info.actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: info.color }} />
                <p className="font-body text-[13px]" style={{ color: TEXT }}>{a}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}
        >
          <p className="font-body text-[11px] text-center" style={{ color: DIM }}>
            Take your first scan to unlock your AI Glow Score and personalized 12-week plan.
          </p>
        </motion.div>
      </div>

      <div className="pb-10 pt-4">
        <GoldBtn label="Start My First Scan →" onClick={onFinish} />
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
// Steps: 0=welcome, 1=signup, 2=age, 3=consent, 4=gender, 5=goal,
//        6=height, 7=weight, 8=bmi, 9=experience, 10=phase

// ── Intro Slides ─────────────────────────────────────────────────────────────
const SLIDE_GOLD = '#C9A84C'
const SLIDE_GOLD_DIM = 'rgba(201,168,76,0.12)'
const SLIDE_GOLD_BORDER = 'rgba(201,168,76,0.28)'

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
            transition={{ delay: 0.08 + i * 0.12, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
    'AI identifies exact weak points',
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
              <span className="mt-0.5 flex-shrink-0" style={{ color: '#E05555', fontSize: 10 }}>✕</span>
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
              <span className="mt-0.5 flex-shrink-0" style={{ color: SLIDE_GOLD, fontSize: 10 }}>✓</span>
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
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
            transition={{ delay: 0.15 + i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 rounded-xl px-2 py-3 flex flex-col items-center gap-1"
            style={{ background: '#0A0A0A', border: `0.5px solid rgba(201,168,76,0.25)` }}
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
        className="absolute top-14 right-5 z-20 font-heading font-semibold text-[12px] px-4 py-2 rounded-xl"
        style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', letterSpacing: '0.04em' }}
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
              ? '0 4px 20px rgba(201,168,76,0.3)'
              : '0 2px 12px rgba(201,168,76,0.5)',
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
  const {
    setUserProfile, setHasOnboarded, setLegalConsented,
    setGender, setAssignedPhase, setUnits, units,
  } = useStore()

  const [introDone, setIntroDone] = useState(false)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [signingIn, setSigningIn] = useState(false)
  const [authData, setAuthData] = useState(null)

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    ageConfirmed: null,
    gender: '', goal: '',
    improvementFocus: [],
    height: 175, weight: 75,
  })

  const [checks, setChecks] = useState({
    age: false, terms: false, privacy: false, aiConsent: false, disclaimer: false,
  })

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

  function finish() {
    const phase = calculatePhase(formData.goal, formData.height, formData.weight)
    setUserProfile({
      height: formData.height,
      weight: formData.weight,
      goal: formData.goal,
    })
    setGender(formData.gender || null)
    setAssignedPhase(phase)
    setLegalConsented()
    setHasOnboarded()

    if (authData) {
      api.user.update({
        gender: formData.gender,
        height_cm: formData.height,
        weight_kg: formData.weight,
      }).catch(() => {})

      // Save goal_type, improvement_focus, and legal consent to Supabase (fire-and-forget)
      const profilePatch = {}
      if (formData.goal) profilePatch.goal_type = formData.goal
      if (formData.improvementFocus?.length) profilePatch.improvement_focus = formData.improvementFocus
      // Persist consent audit trail server-side
      profilePatch.ai_consent = !!checks.aiConsent
      profilePatch.consent_at = new Date().toISOString()
      api.supabase.updateUser(profilePatch).catch(() => {})
    }

    navigate('/')
  }

  // Progress bar: steps 1–9
  const showProgress = step >= 1 && step <= 10
  const progressPct = showProgress ? ((step - 1) / TOTAL_QUIZ_STEPS) * 100 : 0

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
        />
      </div>
    )
  }

  const steps = [
    <StepWelcome key="welcome"
      onCreateAccount={goNext}
      onSignIn={() => setSigningIn(true)}
    />,
    <StepSignUp key="signup" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack} setAuthData={setAuthData}
    />,
    <StepAgeGate key="age" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack}
    />,
    <StepConsent key="consent" checks={checks} onToggle={toggleCheck}
      onNext={goNext} onBack={goBack}
    />,
    <StepGender key="gender" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack}
    />,
    <StepGoal key="goal" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack}
    />,
    <StepImprovementFocus key="focus" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack}
    />,
    <StepSocialProof key="social" onNext={goNext} onBack={goBack} />,
    <StepHeight key="height" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack} units={units}
    />,
    <StepWeight key="weight" data={formData} onChange={updateField}
      onNext={goNext} onBack={goBack} units={units}
    />,
    <StepBMI key="bmi" data={formData}
      onNext={goNext} onBack={goBack}
    />,
    <StepPhaseResult key="phase" data={formData} onFinish={finish} />,
  ]

  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={{ background: BG }}>
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

      {/* Step counter */}
      {showProgress && step < 11 && (
        <div className="absolute top-3 right-5 z-20">
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {step} / {TOTAL_QUIZ_STEPS}
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
    </div>
  )
}
