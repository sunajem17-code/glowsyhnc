import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Gift } from 'lucide-react'
import useStore from '../store/useStore'
import { api } from '../utils/api'

// ─── PromoModal ───────────────────────────────────────────────────────────────
// Accepts a promo code, redeems it against /api/promo/redeem, and on success
// immediately flips isPremium in the global store so the UI updates without
// a page reload.  Parent controls visibility via AnimatePresence.

export default function PromoModal({ onClose, onSuccess }) {
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const inputRef              = useRef(null)

  const { setIsPremium, updateUser } = useStore()

  // Auto-focus the input when the modal mounts
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [])

  async function handleRedeem() {
    const trimmed = code.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      await api.promo.redeem(trimmed)

      // Immediately reflect Pro status in the UI — no page reload needed
      setIsPremium(true)
      updateUser({ is_pro: true, subscriptionTier: 'premium', subscription_tier: 'premium' })

      setSuccess(true)
      // Close after showing the success message
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2200)
    } catch (err) {
      const msg = err.message || 'Invalid promo code'
      const isExpired = msg.toLowerCase().includes('session') || msg.toLowerCase().includes('expired')
      setError(isExpired
        ? 'Your session expired. Sign in again, then re-enter your code.'
        : msg
      )
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !loading && !success) handleRedeem()
    if (e.key === 'Escape') onClose()
  }

  return (
    // Backdrop
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[320px] rounded-3xl p-6"
        style={{
          background: '#111111',
          border: '1px solid rgba(198,168,92,0.22)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(198,168,92,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-heading font-bold text-[15px] text-white leading-tight">Promo Code</p>
            <p className="font-body text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Enter your code below
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.07)' }}
            aria-label="Close"
          >
            <X size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            // ── Success state ──────────────────────────────────────────
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-4"
            >
              <Gift size={32} className="mb-3" style={{ color: '#C6A85C' }} />
              <p className="font-heading font-bold text-[15px] text-white mb-1">
                Lifetime Pro unlocked!
              </p>
              <p className="font-body text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                All Pro features are yours forever
              </p>
            </motion.div>
          ) : (
            // ── Input state ────────────────────────────────────────────
            <motion.div key="input">
              {/* Code input */}
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
                placeholder="Enter code"
                maxLength={32}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="w-full mb-3 px-4 py-3 rounded-2xl font-mono text-[15px] text-white placeholder:text-[rgba(255,255,255,0.22)] outline-none transition-all duration-150"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: error
                    ? '1.5px solid rgba(239,68,68,0.6)'
                    : '1.5px solid rgba(198,168,92,0.28)',
                  letterSpacing: '0.06em',
                }}
              />

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="font-body text-[11px] mb-3 text-center"
                    style={{ color: '#EF4444' }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Redeem button */}
              <button
                onClick={handleRedeem}
                disabled={loading || !code.trim()}
                className="w-full py-3.5 rounded-2xl font-heading font-bold text-[14px] text-black transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 45%, #A8893A 100%)',
                  boxShadow: code.trim() && !loading ? '0 4px 16px rgba(198,168,92,0.3)' : 'none',
                }}
              >
                {loading ? 'Checking…' : 'Redeem'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
