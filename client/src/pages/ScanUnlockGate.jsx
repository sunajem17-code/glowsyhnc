import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Share2, Check, Loader2, Users, ChevronRight } from 'lucide-react'
import useStore from '../store/useStore'
import { StepScoresWaiting } from '../components/OnboardingFinalSteps'
import { purchasePro, isNative } from '../utils/iap'
import { api } from '../utils/api'

const G    = '#C6A85C'
const GRAD = 'linear-gradient(135deg, #D4B96A 0%, #C6A85C 50%, #A8893A 100%)'
const BG   = '#080808'
const TEXT = '#F0EDE8'
const DIM  = 'rgba(255,255,255,0.38)'
const SURF = 'rgba(255,255,255,0.04)'

const REQUIRED = 3

function InviteSheet({ referralCode, referralCount, onClose, onUnlocked }) {
  const [count, setCount]         = useState(referralCount)
  const [sharing, setSharing]     = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockErr, setUnlockErr] = useState('')
  const [shareCount, setShareCount] = useState(0) // shares triggered this session
  const { setIsPremium }          = useStore()
  const navigate                  = useNavigate()

  const link    = referralCode ? `https://ascendus.store/r/${referralCode}` : 'https://ascendus.store'
  const shareText = `I'm using Ascendus to track my glow-up — it gives you an AI Glow Score, custom plan & celebrity lookalike matches. Try it free 👇 ${link}`

  // Poll referral count after each share attempt — friend must actually register for count to rise
  async function pollCount() {
    try {
      const { count: fresh } = await api.referral.count()
      setCount(fresh ?? 0)
      return fresh ?? 0
    } catch { return count }
  }

  async function handleShare() {
    setSharing(true)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Ascendus', text: shareText, url: link })
      } else {
        await navigator.clipboard?.writeText(shareText)
      }
      setShareCount(n => n + 1)
      // Poll after short delay so server has time to process if friend signs up instantly
      setTimeout(async () => {
        const fresh = await pollCount()
        if (fresh >= REQUIRED) handleUnlock(fresh)
      }, 1500)
    } catch (err) {
      // Share cancelled — not an error
    } finally {
      setSharing(false)
    }
  }

  async function handleUnlock(freshCount) {
    const c = freshCount ?? count
    if (c < REQUIRED) {
      setUnlockErr(`Need ${REQUIRED - c} more friend${REQUIRED - c !== 1 ? 's' : ''} to sign up first.`)
      return
    }
    setUnlocking(true)
    setUnlockErr('')
    try {
      const { ok, isPremium: granted } = await api.referral.unlockPro()
      if (ok && granted) {
        sessionStorage.setItem('asc_pro_splash_shown', '1')
        setIsPremium(true)
        navigate('/results', { replace: true })
      }
    } catch (err) {
      const msg = err?.message || ''
      if (msg.toLowerCase().includes('need')) {
        // Server says not enough yet — re-poll to sync local count
        const fresh = await pollCount()
        setUnlockErr(`${fresh}/${REQUIRED} friends signed up so far. Share with more to unlock.`)
      } else {
        setUnlockErr(msg || 'Something went wrong. Try again.')
      }
    } finally {
      setUnlocking(false)
    }
  }

  const done = count >= REQUIRED

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="absolute inset-x-0 bottom-0 rounded-t-3xl z-10 flex flex-col"
      style={{ background: '#111', border: '1px solid rgba(198,168,92,0.15)', borderBottom: 0, maxHeight: '85vh' }}
    >
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
      </div>

      <div className="px-6 pb-10 pt-3 overflow-y-auto">

        {/* Header */}
        <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1" style={{ color: G }}>INVITE & UNLOCK</p>
        <h2 className="font-heading font-bold text-[24px] leading-tight mb-1" style={{ color: TEXT, letterSpacing: '-0.02em' }}>
          Get Pro free.<br />Invite {REQUIRED} friends.
        </h2>
        <p className="font-body text-[13px] mb-6" style={{ color: DIM }}>
          Each friend must sign up using your link. Once {REQUIRED} join, your full results unlock permanently.
        </p>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-heading font-bold text-[11px] tracking-wide uppercase" style={{ color: DIM }}>Friends joined</span>
            <span className="font-mono font-bold text-[13px]" style={{ color: done ? '#34C759' : G }}>{count}/{REQUIRED}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: done ? '#34C759' : GRAD }}
              initial={false}
              animate={{ width: `${Math.min(100, (count / REQUIRED) * 100)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {[...Array(REQUIRED)].map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: i < count ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${i < count ? '#34C759' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {i < count
                    ? <Check size={12} style={{ color: '#34C759' }} />
                    : <span className="text-[9px] font-bold" style={{ color: DIM }}>{i + 1}</span>
                  }
                </div>
              </div>
            ))}
            {/* filler */}
            <div />
          </div>
        </div>

        {/* Verification note */}
        <div className="mb-5 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.18)' }}>
          <p className="text-[10.5px] font-body leading-relaxed" style={{ color: 'rgba(198,168,92,0.75)' }}>
            <span className="font-bold">How it counts:</span> a friend registers with your link — only real sign-ups count, not just link opens or shares.
          </p>
        </div>

        {/* Share CTA */}
        {!done && (
          <motion.button
            whileTap={{ scale: sharing ? 1 : 0.97 }}
            onClick={handleShare}
            disabled={sharing}
            className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2 mb-3 disabled:opacity-60"
            style={{ background: GRAD, color: '#0A0A0A', boxShadow: '0 4px 20px rgba(198,168,92,0.35)' }}
          >
            {sharing
              ? <Loader2 size={16} className="animate-spin" />
              : <Share2 size={16} />
            }
            {sharing ? 'Opening share…' : shareCount > 0 ? 'Share Again' : 'Share Your Link'}
          </motion.button>
        )}

        {/* Unlock CTA — enabled only when count >= REQUIRED */}
        <motion.button
          whileTap={{ scale: (done && !unlocking) ? 0.97 : 1 }}
          onClick={() => handleUnlock()}
          disabled={!done || unlocking}
          className="w-full py-4 rounded-2xl font-heading font-bold text-[15px] flex items-center justify-center gap-2 mb-2 disabled:opacity-40"
          style={{
            background: done ? GRAD : SURF,
            border: done ? 'none' : '1px solid rgba(255,255,255,0.1)',
            color: done ? '#0A0A0A' : DIM,
            boxShadow: done ? '0 4px 20px rgba(198,168,92,0.35)' : 'none',
          }}
        >
          {unlocking
            ? <Loader2 size={16} className="animate-spin" />
            : <Users size={16} />
          }
          {unlocking
            ? 'Unlocking…'
            : done
            ? 'Unlock My Results Now'
            : `${REQUIRED - count} more friend${REQUIRED - count !== 1 ? 's' : ''} needed`
          }
        </motion.button>

        {unlockErr && (
          <p className="text-center text-[11px] font-body mt-1" style={{ color: '#EF4444' }}>{unlockErr}</p>
        )}

        {/* Re-poll button — shows after at least one share triggered */}
        {shareCount > 0 && !done && (
          <button
            onClick={async () => { const fresh = await pollCount(); if (fresh >= REQUIRED) handleUnlock(fresh) }}
            className="w-full mt-2 py-2 font-body text-[12px] text-center flex items-center justify-center gap-1"
            style={{ color: DIM }}
          >
            Check if friends joined <ChevronRight size={12} />
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 font-body text-[12px] text-center"
          style={{ color: 'rgba(255,255,255,0.22)' }}
        >
          Maybe later
        </button>
      </div>
    </motion.div>
  )
}

export default function ScanUnlockGate() {
  const navigate  = useNavigate()
  const { currentScan, isPremium, setIsPremium } = useStore()

  const [showInvite, setShowInvite]       = useState(false)
  const [referralCode, setReferralCode]   = useState(null)
  const [referralCount, setReferralCount] = useState(0)
  const [loadingRef, setLoadingRef]       = useState(false)

  // If premium already, skip gate
  useEffect(() => {
    if (isPremium) navigate('/results', { replace: true })
  }, [isPremium])

  // If no completed scan, send back to scan
  useEffect(() => {
    if (!currentScan) navigate('/scan', { replace: true })
  }, [currentScan])

  // Fetch referral state once on mount
  useEffect(() => {
    if (!currentScan || isPremium) return
    setLoadingRef(true)
    api.referral.count()
      .then(({ count, code }) => { setReferralCount(count || 0); setReferralCode(code || null) })
      .catch(() => {})
      .finally(() => setLoadingRef(false))
  }, [])

  if (isPremium || !currentScan) return null

  async function handleAscend() {
    if (isNative()) {
      try {
        const result = await purchasePro('annual')
        if (result?.success) {
          api.payments.syncRc().catch(() => {})
          sessionStorage.setItem('asc_pro_splash_shown', '1')
          setIsPremium(true)
          navigate('/results', { replace: true })
        }
      } catch (err) {
        const msg = (err?.message || '').toLowerCase()
        if (!msg.includes('cancel')) navigate('/premium')
      }
    } else {
      navigate('/premium')
    }
  }

  function handleInvite() {
    setShowInvite(true)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: BG }}>
      <StepScoresWaiting
        scan={currentScan}
        onAscend={handleAscend}
        onInvite={handleInvite}
      />
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => setShowInvite(false)}
          >
            <div onClick={e => e.stopPropagation()} className="absolute inset-0">
              <InviteSheet
                referralCode={referralCode}
                referralCount={referralCount}
                onClose={() => setShowInvite(false)}
                onUnlocked={() => navigate('/results', { replace: true })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
