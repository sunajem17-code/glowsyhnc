import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import logo from '../assets/ascendus-icon.png'

export default function Auth() {
  const navigate = useNavigate()
  const setHasOnboarded = useStore(s => s.setHasOnboarded)
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth, resetOnboarding } = useStore()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.auth.login({ email: form.email, password: form.password })
      setAuth(data.user, data.token)
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
          ? 'Server unavailable. Use "Try Demo" below to explore all features instantly — no account needed.'
          : err.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  function demoLogin() {
    const demoUser = {
      id: 'demo-user',
      name: 'Alex',
      email: 'alex@ascendus.app',
      avatarUrl: null,
      subscriptionTier: 'free',
      createdAt: new Date().toISOString(),
    }
    setAuth(demoUser, 'demo-token')
  }

  const inputClass = `
    w-full px-4 py-3.5 rounded-xl font-body text-sm outline-none transition-all duration-200
    bg-transparent border focus:border-[#C6A85C]
  `

  return (
    <div
      className="page-scroll-full flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <div className="px-6 pt-16 pb-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center mb-8"
        >
          <img src={logo} alt="Ascendus" style={{ height: 52, mixBlendMode: 'lighten' }} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h1
            className="font-heading font-bold text-[34px] leading-[1.1] text-primary mb-2.5"
            style={{ letterSpacing: '-0.02em' }}
          >
            Welcome{'\n'}back.
          </h1>
          <p className="text-secondary font-body text-[15px]">
            Continue where you left off.
          </p>
        </motion.div>
      </div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={handleSubmit}
        className="flex-1 px-6 space-y-3"
      >
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
          />
        </div>

        <div>
          <label className="text-[11px] font-body font-medium text-secondary mb-1.5 block uppercase tracking-wide">
            Password
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Your password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className={inputClass + ' pr-12'}
              style={{
                color: 'var(--text-primary)',
                borderColor: 'var(--border-strong)',
                background: 'var(--card)',
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
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
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-[11px] text-secondary font-body">or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <button
            type="button"
            onClick={demoLogin}
            className="btn-ghost"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            Try Demo — No Account Needed
          </button>
        </div>
      </motion.form>

      {/* New user prompt */}
      <div className="px-6 py-10 text-center">
        <span className="text-sm text-secondary font-body">Don't have an account? </span>
        <button
          onClick={() => { resetOnboarding(); navigate('/') }}
          className="text-sm font-heading font-bold"
          style={{ color: '#C6A85C' }}
        >
          Sign Up
        </button>
      </div>
    </div>
  )
}
