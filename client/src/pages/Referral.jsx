import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, ChevronLeft, Gift, Users, Share2, MessageCircle } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { api } from '../utils/api'

const GOLD = '#C6A85C'
const TOTAL_REFS = 5

function getReferralCode(user) {
  if (!user?.id) return 'ASCEND01'
  return `ASC${String(user.id).substring(0, 5).toUpperCase()}`
}

function getReferralLink(code) {
  return `https://ascendus.app/join?ref=${code}`
}

export default function Referral() {
  const navigate = useNavigate()
  const { user, referralCount, isPremium, proTrialActive, startProTrial } = useStore()

  const code = getReferralCode(user)
  const link = getReferralLink(code)
  const count = Math.min(referralCount ?? 0, TOTAL_REFS)
  const isComplete = count >= TOTAL_REFS
  const [copied, setCopied] = useState(false)
  const [trialStarted, setTrialStarted] = useState(proTrialActive)

  const shareText = `I've been using Ascendus to level up my looks — it gives you an AI Glow Score, custom plan & celebrity matches. Try it free 👇\n${link}`

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareNative() {
    if (navigator.share) {
      navigator.share({ title: 'Ascendus', text: shareText, url: link })
    } else {
      copyLink()
    }
  }

  function shareSMS() {
    window.open(`sms:?body=${encodeURIComponent(shareText)}`, '_self')
  }

  function shareInstagram() {
    copyLink()
    // Instagram doesn't support deep link sharing — copy link + instruct
    alert('Link copied! Paste it in your Instagram story or DM.')
  }

  function shareTikTok() {
    copyLink()
    alert('Link copied! Add it to your TikTok bio or paste in a video caption.')
  }

  async function claimTrial() {
    if (isComplete && !trialStarted) {
      try {
        await api.referral.claimTrial()
        startProTrial()
        setTrialStarted(true)
      } catch (err) {
        console.error('[Referral] Claim trial failed:', err.message)
      }
    }
  }

  return (
    <MotionPage className="flex flex-col min-h-full bg-page">
      {/* Header */}
      <div className="pt-14 pb-4 px-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <ChevronLeft size={18} className="text-primary" />
        </button>
        <h1
          className="font-heading font-bold text-xl text-primary"
          style={{ letterSpacing: '-0.02em' }}
        >
          Refer Friends
        </h1>
      </div>

      <div className="px-4 flex-1 pb-10">

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl p-5 mb-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1A1A1A 0%, #111 100%)',
            border: `1px solid rgba(198,168,92,0.25)`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 80% 20%, rgba(198,168,92,0.12) 0%, transparent 60%)',
            }}
          />
          <div className="relative z-10 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.25)' }}
            >
              <Gift size={26} style={{ color: GOLD }} />
            </div>
            <h2
              className="font-heading font-bold text-xl mb-1"
              style={{ color: '#fff', letterSpacing: '-0.02em' }}
            >
              Get 7 Days Pro Free
            </h2>
            <p className="font-body text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Refer {TOTAL_REFS} friends who sign up.{'\n'}No credit card needed.
            </p>
          </div>
        </motion.div>

        {/* Progress tracker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl p-4 mb-4"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={15} style={{ color: GOLD }} />
              <span className="font-heading font-bold text-sm text-primary">
                Your Progress
              </span>
            </div>
            <span className="font-mono font-bold text-sm" style={{ color: GOLD }}>
              {count}/{TOTAL_REFS}
            </span>
          </div>

          {/* Slot bubbles */}
          <div className="flex gap-2.5 mb-3">
            {Array.from({ length: TOTAL_REFS }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 h-2.5 rounded-full"
                style={{
                  background: i < count
                    ? `linear-gradient(90deg, #A8893A, ${GOLD})`
                    : 'var(--border)',
                }}
              />
            ))}
          </div>

          <p className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {isComplete
              ? 'You\'ve unlocked your free trial!'
              : `${TOTAL_REFS - count} more friend${TOTAL_REFS - count === 1 ? '' : 's'} needed`}
          </p>

          {/* Claim button — only shows when complete and not yet claimed */}
          <AnimatePresence>
            {isComplete && !trialStarted && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={claimTrial}
                className="w-full mt-3 py-3 rounded-xl font-heading font-bold text-sm"
                style={{
                  background: `linear-gradient(135deg, #A8893A, ${GOLD})`,
                  color: '#0A0A0A',
                }}
              >
                Claim 7 Days Pro Free →
              </motion.button>
            )}
            {trialStarted && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 py-2.5 rounded-xl text-center font-heading font-bold text-sm"
                style={{ background: 'rgba(198,168,92,0.1)', color: GOLD }}
              >
                Pro trial active — enjoy!
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Your referral code */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl p-4 mb-4"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p className="font-body text-xs text-secondary mb-2">Your referral code</p>
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3 mb-3"
            style={{ background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span
              className="font-mono font-bold text-xl tracking-widest"
              style={{ color: GOLD, letterSpacing: '0.15em' }}
            >
              {code}
            </span>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-xs font-heading font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: copied ? 'rgba(52,199,89,0.15)' : 'rgba(198,168,92,0.12)',
                color: copied ? '#34C759' : GOLD,
                border: `1px solid ${copied ? 'rgba(52,199,89,0.3)' : 'rgba(198,168,92,0.2)'}`,
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <p className="font-body text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {link}
          </p>
        </motion.div>

        {/* Share options */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl p-4 mb-4"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p className="font-heading font-bold text-sm text-primary mb-3">Share via</p>
          <div className="grid grid-cols-2 gap-2.5">
            <ShareButton
              icon={<MessageCircle size={17} />}
              label="iMessage / SMS"
              color="#34C759"
              onClick={shareSMS}
            />
            <ShareButton
              icon={<Share2 size={17} />}
              label="Share sheet"
              color={GOLD}
              onClick={shareNative}
            />
            <ShareButton
              icon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              }
              label="Instagram"
              color="#E1306C"
              onClick={shareInstagram}
            />
            <ShareButton
              icon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.79a4.85 4.85 0 01-1.02-.1z"/>
                </svg>
              }
              label="TikTok"
              color="#FF0050"
              onClick={shareTikTok}
            />
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl p-4"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <p className="font-heading font-bold text-sm text-primary mb-3">How it works</p>
          {[
            { step: '1', text: 'Share your code or link with friends' },
            { step: '2', text: 'They sign up using your link' },
            { step: '3', text: 'After 5 sign-ups, you get 7 days Pro free' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3 mb-2.5 last:mb-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(198,168,92,0.12)', border: '1px solid rgba(198,168,92,0.2)' }}
              >
                <span className="font-mono font-bold text-[10px]" style={{ color: GOLD }}>{step}</span>
              </div>
              <p className="font-body text-sm text-primary leading-snug">{text}</p>
            </div>
          ))}
          <p
            className="font-body text-[11px] mt-3 pt-3"
            style={{ color: 'rgba(255,255,255,0.3)', borderTop: '1px solid var(--border)' }}
          >
            Each code can only be used once per account. Referral counts are verified and may take up to 24 hours to update.
          </p>
        </motion.div>
      </div>
    </MotionPage>
  )
}

function ShareButton({ icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-left active:scale-[0.97] transition-transform"
      style={{
        background: '#0D0D0D',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </div>
      <span className="font-heading font-semibold text-[12px] text-primary leading-tight">{label}</span>
    </button>
  )
}
