import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import { api } from '../utils/api'

const GOLD = '#C6A85C'
const GOLD_BORDER = 'rgba(198,168,92,0.25)'
const SESSION_KEY = 'asc_pro_splash_shown'

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const { setIsPremium, isAuthenticated, refreshProStatus } = useStore()
  const navigatedRef = useRef(false)

  useEffect(() => {
    // Stripe only redirects here on successful payment — set premium immediately (optimistic)
    setIsPremium(true)
    // Mark the pro splash as already shown so it doesn't fire again on top of this page
    sessionStorage.setItem(SESSION_KEY, '1')

    // Background: confirm with server + sync profile (non-blocking)
    if (isAuthenticated) {
      refreshProStatus().catch(() => {})

      let attempts = 0
      const poll = async () => {
        try {
          const { isPremium } = await api.payments.status()
          if (isPremium) { setIsPremium(true); return }
        } catch {}
        attempts++
        if (attempts < 8) setTimeout(poll, 2500)
      }
      setTimeout(poll, 1500)
    }

    // Auto-navigate to dashboard after 2.8 s so user stays logged in
    const t = setTimeout(() => {
      if (!navigatedRef.current) {
        navigatedRef.current = true
        navigate('/', { replace: true })
      }
    }, 2800)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-8 text-center"
      style={{ background: '#0A0A0A' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
          style={{ background: `rgba(198,168,92,0.12)`, border: `1px solid ${GOLD_BORDER}` }}
        >
          <span className="text-4xl">✦</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="font-heading font-bold text-[28px] mb-2"
          style={{ color: '#F0EDE8', letterSpacing: '-0.02em' }}
        >
          Welcome to Premium
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="font-body text-[14px] mb-10 max-w-xs leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          Payment confirmed. Taking you to your dashboard…
        </motion.p>

        {/* Loading dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2"
        >
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: GOLD }}
            />
          ))}
        </motion.div>

        {/* Manual fallback button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { navigatedRef.current = true; navigate('/', { replace: true }) }}
          className="mt-8 font-body text-[13px] underline"
          style={{ color: 'rgba(198,168,92,0.6)' }}
        >
          Go to Dashboard →
        </motion.button>
      </motion.div>
    </div>
  )
}
