import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import logo from '../assets/ascendus-icon.png'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setAuth, setHasOnboarded } = useStore()

  const [mode, setMode] = useState(() => searchParams.get('mode') === 'signup' ? 'signup' : 'login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function switchMode(next) {
    setMode(next)
    setError('')
    setForm({ name: '', email: '', password: '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let data
      if (mode === 'signup') {
        data = await api.auth.register({ name: form.name, email: form.email, password: form.password })
      } else {
        data = await api.auth.login({ email: form.email, password: form.password })
      }
      setAuth(data.user, data.token)
      setHasOnboarded()
    } catch (err) {
      const isNetworkError =
        err.message === 'Failed to fetch' ||
        err.message === 'Server unavailable' ||
        err.message === 'Network error' ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('fetch') ||
        err.message?.includes('(500)') ||
        err.message?.includes('(502)') ||
        err.message?.includes('(503)') ||
        err.message?.includes('(504)')
      setError(
        isNetworkError
          ? 'Server unavailable. Please check your connection and try again.'
          : err.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleAppleSignIn() {
    setError('')
    setLoading(true)
    try {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')

      const options = {
        clientId: 'com.ascendus.app',
        redirectURI: 'https://ascendus.store/auth/apple/callback',
        scopes: 'email name',
        state: Date.now().toString(),
        nonce: Math.random().toString(36).substring(2, 15),
      }

      const result = await SignInWithApple.authorize(options)

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
      setHasOnboarded()
    } catch (err) {
      console.error('[APPLE AUTH] Error:', err)
      if (err?.code === 'SIGN_IN_CANCELLED' || err?.message?.includes('cancel') || err?.code === 1001) {
        // User cancelled — do nothing
      } else {
        setError('Sign in with Apple failed. Please try email sign in instead.')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `
    w-full px-4 py-3.5 rounded-xl font-body text-sm outline-none transition-all duration-200
    bg-transparent border focus:border-[#C6A85C]
  `

  const isSignup = mode === 'signup'

  return (
    <div
      className="page-scroll-full flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <div className="px-6 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center mb-8"
        >
          <img src={logo} alt="Ascendus" style={{ height: 52, mixBlendMode: 'lighten' }} />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <h1
              className="font-heading font-bold text-[34px] leading-[1.1] text-primary mb-2.5"
              style={{ letterSpacing: '-0.02em' }}
            >
              {isSignup ? 'Create your\naccount.' : 'Welcome\nback.'}
            </h1>
            <p className="text-secondary font-body text-[15px]">
              {isSignup ? 'Start your free analysis today.' : 'Continue where you left off.'}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={handleSubmit}
        className="flex-1 px-6 space-y-3"
      >
        <AnimatePresence>
          {isSignup && (
            <motion.div
              key="name-field"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label className="text-[11px] font-body font-medium text-secondary mb-1.5 block uppercase tracking-wide">
                Name
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputClass}
                style={{
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-strong)',
                  background: 'var(--card)',
                }}
                required={isSignup}
                autoComplete="name"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <label className="text-[11px] font-body font-medium text-secondary mb-1.5 block uppercase tracking-wide">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className={inputClass}
            style={{
              color: 'var(--text-primary)',
              borderColor: 'var(--border-strong)',
              background: 'var(--card)',
            }}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="text-[11px] font-body font-medium text-secondary mb-1.5 block uppercase tracking-wide">
            Password
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder={isSignup ? 'Create a password' : 'Your password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className={inputClass + ' pr-12'}
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-strong)',
                background: 'var(--card)',
              }}
              required
              minLength={isSignup ? 8 : undefined}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              aria-pressed={showPw}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {isSignup && (
            <p className="text-[11px] text-secondary font-body mt-1.5">Minimum 8 characters</p>
          )}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <p className="text-sm font-body" style={{ color: '#EF4444' }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-2 space-y-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center justify-center gap-2"
            style={{ color: '#0A0A0A' }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading
              ? (isSignup ? 'Creating account…' : 'Signing in…')
              : (isSignup ? 'Create Account' : 'Sign In')}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-[11px] text-secondary font-body">or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {Capacitor.getPlatform() === 'ios' && (
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-body text-sm font-semibold transition-all duration-200"
            style={{ background: '#FFFFFF', color: '#000000', border: '1px solid rgba(0,0,0,0.12)' }}
          >
            <svg width="16" height="19" viewBox="0 0 16 19" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.179 10.131c-.022-2.184 1.784-3.242 1.865-3.296-1.017-1.487-2.597-1.69-3.158-1.71-1.341-.137-2.626.799-3.306.799-.68 0-1.724-.783-2.838-.761-1.451.022-2.796.852-3.544 2.149-1.52 2.635-.389 6.526 1.086 8.659.724 1.041 1.583 2.207 2.711 2.165 1.093-.044 1.505-.699 2.824-.699 1.32 0 1.694.699 2.844.675 1.174-.019 1.913-1.055 2.626-2.1.833-1.202 1.174-2.37 1.192-2.43-.026-.011-2.277-.874-2.302-3.451zm-2.158-6.35C11.678 2.91 12.2 1.983 12.04 1c-.826.033-1.831.551-2.422 1.244-.532.614-1.001 1.598-.875 2.541.922.07 1.864-.468 2.278-1.004z" fill="#000000"/>
            </svg>
            Sign in with Apple
          </button>
          )}
        </div>
      </motion.form>

      {/* Mode toggle */}
      <div className="px-6 pt-10 pb-4 text-center">
        {isSignup ? (
          <>
            <span className="text-sm text-secondary font-body">Already have an account? </span>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-sm font-heading font-bold"
              style={{ color: '#C6A85C' }}
            >
              Sign In
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-secondary font-body">Don't have an account? </span>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-sm font-heading font-bold"
              style={{ color: '#C6A85C' }}
            >
              Sign Up
            </button>
          </>
        )}
      </div>

      {/* Privacy + Terms links — shown in signup mode */}
      {isSignup && (
        <p className="px-6 pb-10 text-center font-body text-xs text-secondary">
          By signing up you agree to our{' '}
          <a href="/terms" className="underline" style={{ color: '#C6A85C' }}>Terms of Use</a>
          {' '}and{' '}
          <a href="/privacy" className="underline" style={{ color: '#C6A85C' }}>Privacy Policy</a>.
        </p>
      )}
    </div>
  )
}
