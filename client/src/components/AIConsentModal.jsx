import { motion, AnimatePresence } from 'framer-motion'
import { Shield, X } from 'lucide-react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'

const SURFACE = '#111111'
const BORDER = 'rgba(255,255,255,0.08)'
const TEXT = '#F0EDE8'
const DIM = 'rgba(255,255,255,0.5)'

async function openPrivacy() {
  const url = 'https://ascendus.store/privacy'
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url })
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export function hasAIConsent() {
  try { return localStorage.getItem('ai_consent_granted') === 'true' } catch { return false }
}

export default function AIConsentModal({ onAgree, onDecline }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          className="w-full rounded-t-2xl overflow-hidden"
          style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderBottom: 'none', maxHeight: '85vh', overflowY: 'auto' }}
        >
          {/* drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>

          <div className="px-6 pt-4 pb-10">
            {/* icon */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(198,168,92,0.1)', border: `1px solid rgba(198,168,92,0.25)` }}>
                <Shield size={28} style={{ color: GOLD }} />
              </div>
            </div>

            <h2 className="font-heading font-bold text-[22px] text-center mb-3"
              style={{ color: TEXT, letterSpacing: '-0.02em' }}>
              AI-Powered Analysis
            </h2>

            <p className="font-body text-[13px] text-center leading-relaxed mb-6" style={{ color: DIM }}>
              Ascendus uses Anthropic's Claude AI to analyze your photos and generate your looksmax score.
              Your photos are processed securely and are not stored permanently.
              By continuing, you agree to our{' '}
              <button
                onClick={openPrivacy}
                className="underline"
                style={{ color: GOLD, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
              >
                Privacy Policy
              </button>
              {' '}and consent to AI analysis of your facial features.
            </p>

            <button
              onClick={() => {
                try { localStorage.setItem('ai_consent_granted', 'true') } catch {}
                onAgree()
              }}
              className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] text-black mb-3"
              style={{ background: GOLD_GRADIENT }}
            >
              I Agree &amp; Continue
            </button>

            <button
              onClick={onDecline}
              className="w-full py-4 rounded-2xl font-heading font-bold text-[14px]"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: `1px solid ${BORDER}` }}
            >
              Decline
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
