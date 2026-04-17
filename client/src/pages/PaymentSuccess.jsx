import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useStore from '../store/useStore'
import { api } from '../utils/api'

const GOLD = '#C6A85C'
const GOLD_BORDER = 'rgba(198,168,92,0.25)'

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const { setIsPremium, isAuthenticated } = useStore()

  useEffect(() => {
    if (!isAuthenticated) return
    let attempts = 0
    const maxAttempts = 12 // poll for up to 24 seconds waiting for webhook

    const check = async () => {
      try {
        const { isPremium } = await api.payments.status()
        if (isPremium) {
          setIsPremium(true)
          return // done
        }
      } catch {}
      attempts++
      if (attempts < maxAttempts) setTimeout(check, 2000)
    }

    // Small initial delay to let webhook fire
    setTimeout(check, 1500)
  }, [isAuthenticated, setIsPremium])

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
          Your payment was successful. All premium features are now unlocked.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/', { replace: true })}
          className="w-full max-w-xs py-4 rounded-2xl font-heading font-bold text-[15px]"
          style={{
            background: `linear-gradient(135deg, #D4B96A 0%, ${GOLD} 50%, #A8893A 100%)`,
            color: '#0A0A0A',
            boxShadow: `0 4px 24px rgba(198,168,92,0.3)`,
          }}
        >
          Go to Dashboard →
        </motion.button>
      </motion.div>
    </div>
  )
}
