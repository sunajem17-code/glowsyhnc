import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { isNative } from '../utils/iap'
import { InAppReview } from '@capacitor-community/in-app-review'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Shield, CreditCard, Share2, Trash2,
  ChevronRight, LogOut, Star, Award, Camera, X, Copy, Check, Eye, BarChart2, Database, Sparkles, ChevronDown,
  User, Heart, Ruler, Map, TrendingUp, RefreshCw, Bot, MessageCircle, ArrowRight,
} from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import GlowScoreRing from '../components/GlowScoreRing'
import { ACHIEVEMENTS } from '../utils/achievements'
import { api } from '../utils/api'
import { GOLD, GOLD_GRADIENT, EASE_STANDARD, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

// ─── Cancel Subscription Modal ────────────────────────────────────────────────

const CANCEL_REASONS = [
  'Too expensive',
  'Not using it enough',
  'Found another app',
  'Missing features I need',
  'Other',
]

const LOSES = [
  { icon: <Ruler size={16} style={{ color: GOLD }} />, label: 'Detailed face metrics (6 pillars + profile)' },
  { icon: <Sparkles size={16} style={{ color: GOLD }} />, label: 'AI hairstyle simulator (HairMaxx)' },
  { icon: <Map size={16} style={{ color: GOLD }} />, label: 'Your 12-week transformation plan' },
  { icon: <TrendingUp size={16} style={{ color: GOLD }} />, label: 'Progress tracking & before/after' },
  { icon: <RefreshCw size={16} style={{ color: GOLD }} />, label: 'Unlimited monthly scans' },
  { icon: <Bot size={16} style={{ color: GOLD }} />, label: 'AI Improvement Coach' },
]

function CancelModal({ onClose }) {
  const { setIsPremium } = useStore()
  const [step, setStep] = useState(1) // 1 = persuade, 2 = reason, 3 = done
  const [reason, setReason] = useState('')
  const [reasonOpen, setReasonOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [portalError, setPortalError] = useState('')

  async function confirmCancel() {
    if (!reason) return
    setCancelling(true)
    setPortalError('')
    try {
      if (isNative()) {
        // iOS: Apple manages subscriptions — open Apple ID subscription settings
        await Browser.open({ url: 'https://apps.apple.com/account/subscriptions' })
        setCancelling(false)
      } else {
        const { url } = await api.payments.portal()
        window.location.href = url
      }
    } catch (err) {
      setPortalError('Could not open billing portal. Please contact support@ascendus.com.')
      setCancelling(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING_STANDARD}
        className="w-full rounded-t-2xl overflow-y-auto"
        style={{ background: '#0D0D0D', maxHeight: '90vh', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Step 1 — Persuasion */}
        {step === 1 && (
          <div className="px-5 pt-3 pb-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading font-bold text-[18px] text-white">Manage Subscription</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <X size={15} className="text-white" />
              </button>
            </div>

            <p className="font-body text-sm text-white/50 mb-4">
              Are you sure? Cancelling will remove access to:
            </p>

            <div className="space-y-2 mb-5">
              {LOSES.map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="flex-shrink-0 flex items-center">{icon}</span>
                  <p className="font-body text-[13px] text-white/75">{label}</p>
                </div>
              ))}
            </div>

            {/* Retention offer */}
            <div className="rounded-2xl px-4 py-4 mb-4"
              style={{ background: 'rgba(198,168,92,0.07)', border: '1px solid rgba(198,168,92,0.22)' }}>
              <p className="font-heading font-bold text-[13px] text-white mb-1">Stay for $7.99 this month</p>
              <p className="font-body text-[11px] text-white/50 mb-3">
                50% off your next month, one-time offer to keep your progress alive.
              </p>
              <button
                onClick={() => { triggerHaptic(); onClose() }}
                className="w-full py-3 rounded-xl font-heading font-bold text-[13px] text-black"
                style={{ background: GOLD_GRADIENT }}
              >
                Keep Premium at 50% Off →
              </button>
            </div>

            <button
              onClick={() => { triggerHaptic(); setStep(2) }}
              className="w-full py-2.5 font-body text-[13px] text-center"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              No thanks, continue cancelling
            </button>
          </div>
        )}

        {/* Step 2 — Reason + Confirm */}
        {step === 2 && (
          <div className="px-5 pt-3 pb-10">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading font-bold text-[18px] text-white">One last thing</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <X size={15} className="text-white" />
              </button>
            </div>

            <p className="font-body text-sm text-white/50 mb-4">
              Why are you cancelling? Your feedback helps us improve.
            </p>

            {/* Reason picker */}
            <div className="relative mb-5">
              <button
                onClick={() => setReasonOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                <span className="font-body text-sm" style={{ color: reason ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)' }}>
                  {reason || 'Select a reason…'}
                </span>
                <ChevronDown size={15} className="text-white/30" />
              </button>
              <AnimatePresence>
                {reasonOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute top-full left-0 right-0 mt-1 rounded-2xl overflow-hidden z-10"
                    style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.10)' }}
                  >
                    {CANCEL_REASONS.map(r => (
                      <button
                        key={r}
                        onClick={() => { setReason(r); setReasonOpen(false) }}
                        className="w-full text-left px-4 py-3 font-body text-sm border-b last:border-0"
                        style={{
                          color: reason === r ? GOLD : 'rgba(255,255,255,0.75)',
                          borderColor: 'rgba(255,255,255,0.06)',
                          background: reason === r ? 'rgba(198,168,92,0.06)' : 'transparent',
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => { triggerHaptic(); confirmCancel() }}
              disabled={!reason || cancelling}
              className="w-full py-4 rounded-2xl font-heading font-bold text-[14px] mb-3 flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', color: '#EF4444' }}
            >
              {cancelling ? 'Opening portal…' : 'Confirm Cancellation'}
            </button>
            {portalError && (
              <p className="text-center font-body text-[11px] mb-2" style={{ color: '#EF4444' }}>{portalError}</p>
            )}
            <p className="text-center font-body text-[11px] text-white/25">
              You keep access until the end of your billing period.
            </p>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div className="px-5 pt-3 pb-10 text-center">
            <div className="mb-4 mt-6"><User size={40} style={{ color: GOLD }} /></div>
            <h3 className="font-heading font-bold text-[18px] text-white mb-2">Subscription Cancelled</h3>
            <p className="font-body text-sm text-white/50 mb-6 leading-relaxed">
              You'll have access until the end of your current period.<br />
              Your data is saved. Come back anytime.
            </p>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-heading font-bold text-[14px]"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

const GOLD_BORDER = 'rgba(198,168,92,0.25)'
const SURFACE = '#111111'
const SURFACE_2 = '#181818'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT = '#F0EDE8'
const TEXT_DIM = '#5A5652'

function SettingsRow({ icon: Icon, label, value, onClick, danger, toggle, checked }) {
  return (
    <button
      onClick={() => { triggerHaptic(); onClick?.() }}
      className="w-full flex items-center gap-3.5 py-4 px-4 transition-colors"
      style={{ background: 'transparent' }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Icon
          size={15}
          style={{ color: danger ? '#EF4444' : 'rgba(255,255,255,0.45)' }}
        />
      </div>
      <span
        className="flex-1 text-[13px] font-body text-left"
        style={{ color: danger ? '#EF4444' : TEXT }}
      >
        {label}
      </span>
      {toggle ? (
        <div
          className="w-11 h-6 rounded-full relative transition-colors"
          style={{ background: checked ? GOLD : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
            style={{ transform: checked ? 'translateX(20px)' : 'translateX(4px)' }}
          />
        </div>
      ) : value ? (
        <span className="text-[11px] font-body" style={{ color: TEXT_DIM }}>{value}</span>
      ) : (
        <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
      )}
    </button>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, scans, streak, logout, isPremium, privacySettings, setPrivacySetting, clearAllScanData, achievements } = useStore()
  const [notifications, setNotifications] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancellingDirect, setCancellingDirect] = useState(false)
  const [cancelDirectError, setCancelDirectError] = useState('')
  const [copied, setCopied] = useState(false)
  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [dataDeleted, setDataDeleted] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState('')
  const deleteBackdropRef = useRef(null)

  // Real native version/build, not a hardcoded string — lets a real device
  // confirm exactly what's installed instead of guessing from a static label
  // that was never wired up (was permanently "v1.0.0" regardless of the
  // actual build). isNative()/CapApp.getInfo() resolve nothing on web.
  const [appVersion, setAppVersion] = useState('(web)')
  useEffect(() => {
    if (!isNative()) return
    CapApp.getInfo().then(info => setAppVersion(`v${info.version} (${info.build})`)).catch(err => console.warn('[Profile] CapApp.getInfo failed:', err?.message))
  }, [])

  // Lock scroll on the page behind the modal. On iOS WebView, overflow:hidden
  // alone doesn't stop momentum scroll — we also intercept touchmove at the
  // document level with { passive: false } so preventDefault() actually works.
  useEffect(() => {
    if (!deleteAccountOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    const prevent = (e) => e.preventDefault()
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => {
      document.body.style.overflow = prev
      document.documentElement.style.overflow = ''
      document.removeEventListener('touchmove', prevent)
    }
  }, [deleteAccountOpen])

  const bestScore = scans.length > 0 ? Math.max(...scans.map(s => s.glowScore)) : 0
  const latestScan = scans[0]

  function handleLogout() {
    logout()
    navigate('/auth')
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    setDeleteAccountError('')

    // Block the global session-expired redirect while deletion is in-flight so
    // the user sees a meaningful error instead of being silently bounced to /auth.
    const suppressRedirect = (e) => e.stopImmediatePropagation()
    window.addEventListener('auth:session-expired', suppressRedirect, true)

    try {
      const result = await api.user.deleteAccount()
      logout()
      navigate('/', { replace: true })
    } catch (err) {
      console.error('[DELETE] error:', err?.message, err?.status, err?.stack)
      const msg = err.message || ''
      const isExpired = msg.toLowerCase().includes('session') || msg.toLowerCase().includes('expired')
      setDeleteAccountError(
        isExpired
          ? 'Your session expired. Sign out and sign back in, then delete your account.'
          : msg || 'Deletion failed. Try again or email support@ascendus.com.'
      )
      setDeletingAccount(false)
    } finally {
      window.removeEventListener('auth:session-expired', suppressRedirect, true)
    }
  }

  async function handleCancelDirect() {
    setCancellingDirect(true)
    setCancelDirectError('')
    try {
      if (isNative()) {
        await Browser.open({ url: 'https://apps.apple.com/account/subscriptions' })
        setCancellingDirect(false)
      } else {
        const { url } = await api.payments.portal()
        window.location.href = url
      }
    } catch (err) {
      setCancelDirectError('Could not open billing portal. Try again or email support@ascendus.com.')
      setCancellingDirect(false)
    }
  }

  function handleShare() {
    const shareText = `I've been tracking my glow-up with Ascendus! My current score: ${latestScan?.glowScore ?? 'N/A'}/100`
    const shareUrl = 'https://ascendus.store'
    if (navigator.share) {
      navigator.share({ title: 'Ascendus', text: shareText, url: shareUrl })
    } else {
      setShareOpen(true)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText('https://ascendus.store')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function submitRating(stars) {
    setRating(stars)
    setRated(true)
    if (stars >= 4 && Capacitor.isNativePlatform()) {
      try {
        await InAppReview.requestReview()
      } catch { /* best-effort — Apple throttles this to a few times/year */ }
    }
    setTimeout(() => setRateOpen(false), 1800)
  }

  const sectionStyle = {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    overflow: 'hidden',
  }

  const dividerStyle = {
    height: 1,
    background: BORDER,
    marginLeft: 56,
  }

  return (
    <>
    <MotionPage className="px-4">
      <PageHeader title="Profile" />

      {/* ── Profile Card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_STANDARD }}
        className="mb-5 rounded-2xl p-5"
        style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: '#1A1A1A',
                border: `1.5px solid rgba(255,255,255,0.09)`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <span
                className="font-heading font-bold text-2xl"
                style={{ color: 'rgba(255,255,255,0.88)' }}
              >
                {(user?.name?.[0] ?? 'G').toUpperCase()}
              </span>
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: GOLD,
                border: '2px solid #111',
              }}
            >
              <Camera size={10} style={{ color: '#0A0A0A' }} />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2
              className="font-heading font-bold text-[17px] truncate"
              style={{ color: TEXT, letterSpacing: '-0.01em' }}
            >
              {user?.name ?? 'Ascendus User'}
            </h2>
            <p className="text-[12px] font-body truncate" style={{ color: TEXT_DIM }}>
              {user?.email ?? 'demo@ascendus.app'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {isPremium ? (
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-bold"
                  style={{
                    background: 'rgba(198,168,92,0.12)',
                    border: `1px solid ${GOLD_BORDER}`,
                    color: GOLD,
                  }}
                >
                  ✦ Premium
                </span>
              ) : (
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-bold"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: TEXT_DIM,
                  }}
                >
                  Free Plan
                </span>
              )}
              <span className="text-[10px] font-body" style={{ color: TEXT_DIM }}>
                Since {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : 'today'}
              </span>
            </div>
          </div>

          {/* Score ring */}
          <GlowScoreRing score={latestScan?.glowScore ?? 0} size="small" animated={false} />
        </div>
      </motion.div>

      {/* ── Stats Row ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.35, ease: EASE_STANDARD }}
        className="grid grid-cols-3 gap-2.5 mb-5"
      >
        {[
          { label: 'Total Scans', value: scans.length || 'N/A', symbol: '#' },
          { label: 'Best Score', value: bestScore || 'N/A', symbol: '↑' },
          { label: 'Streak', value: streak.current > 0 ? `${streak.current}d` : 'N/A', symbol: '🔥' },
        ].map(({ label, value, symbol }) => (
          <div
            key={label}
            className="text-center py-4 rounded-2xl"
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            <p
              className="font-mono font-bold text-[22px] leading-none mb-1"
              style={{ color: TEXT, letterSpacing: '-0.02em' }}
            >
              {value}
            </p>
            <p className="text-[10px] font-body" style={{ color: TEXT_DIM }}>{label}</p>
          </div>
        ))}
      </motion.div>

      {/* ── Achievements ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35, ease: EASE_STANDARD }}
        className="mb-5 rounded-2xl p-4"
        style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-heading font-bold text-[14px]" style={{ color: TEXT }}>Achievements</p>
          <p className="font-body text-[11px]" style={{ color: TEXT_DIM }}>
            {(achievements ?? []).length}/{Object.keys(ACHIEVEMENTS).length} unlocked
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {Object.values(ACHIEVEMENTS).map(ach => {
            const unlocked = (achievements ?? []).includes(ach.key)
            return (
              <div
                key={ach.key}
                className="flex flex-col items-center py-3 px-2 rounded-xl text-center"
                style={{
                  background: unlocked ? `${ach.color}10` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${unlocked ? ach.color + '30' : 'rgba(255,255,255,0.05)'}`,
                  opacity: unlocked ? 1 : 0.4,
                }}
              >
                <ach.Icon size={20} className="mb-1" style={{ color: unlocked ? ach.color : 'rgba(255,255,255,0.3)' }} />
                <p className="font-heading font-bold text-[10px] leading-tight" style={{ color: unlocked ? ach.color : TEXT_DIM }}>
                  {ach.title}
                </p>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* ── Premium CTA ──────────────────────────────────────────── */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: EASE_STANDARD }}
          className="mb-5 rounded-2xl overflow-hidden"
          style={{
            background: '#111',
            border: `1px solid ${GOLD_BORDER}`,
            boxShadow: `0 4px 24px rgba(198,168,92,0.1)`,
          }}
        >
          {/* Top gold glow strip */}
          <div
            className="h-px w-full"
            style={{ background: `linear-gradient(90deg, transparent, rgba(198,168,92,0.4), transparent)` }}
          />
          <div className="px-5 pt-5 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} style={{ color: GOLD }} />
              <span
                className="text-[10px] font-heading font-bold uppercase tracking-widest"
                style={{ color: GOLD }}
              >
                Ascendus Premium
              </span>
            </div>
            <h3
              className="font-heading font-bold text-[20px] mb-1"
              style={{ color: TEXT, letterSpacing: '-0.02em' }}
            >
              Unlock Premium Access
            </h3>
            <p className="font-body text-[13px] mb-4" style={{ color: TEXT_DIM }}>
              Full analysis. Full control.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { triggerHaptic(); navigate('/premium') }}
              className="w-full py-3.5 rounded-xl font-heading font-bold text-[14px]"
              style={{
                background: GOLD_GRADIENT,
                color: '#0A0A0A',
                boxShadow: `0 4px 20px rgba(198,168,92,0.3)`,
                letterSpacing: '0.01em',
              }}
            >
              Start Free Trial <ArrowRight size={15} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </motion.button>
            <p className="text-center text-[10px] font-body mt-2.5" style={{ color: TEXT_DIM }}>
              3-day free trial · Cancel anytime
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Settings ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.35, ease: EASE_STANDARD }}
        className="mb-3"
        style={sectionStyle}
      >
        <SettingsRow
          icon={Bell}
          label="Push Notifications"
          toggle
          checked={notifications}
          onClick={() => setNotifications(v => !v)}
        />
        <div style={dividerStyle} />
        <SettingsRow
          icon={Shield}
          label="Privacy Settings"
          onClick={() => setPrivacyOpen(true)}
        />
        <div style={dividerStyle} />
        {isPremium ? (
          <>
            <SettingsRow
              icon={CreditCard}
              label="Manage Subscription"
              value="✦ Premium"
              onClick={() => setCancelOpen(true)}
            />
            <div style={dividerStyle} />
            <SettingsRow
              icon={Trash2}
              label={cancellingDirect ? 'Opening portal…' : 'Cancel Subscription'}
              danger
              onClick={handleCancelDirect}
            />
            {cancelDirectError && (
              <p className="px-4 pb-2 text-[11px] font-body" style={{ color: '#EF4444' }}>
                {cancelDirectError}
              </p>
            )}
          </>
        ) : (
          <SettingsRow
            icon={CreditCard}
            label="Upgrade to Pro"
            value="Free"
            onClick={() => navigate('/premium')}
          />
        )}
        <div style={dividerStyle} />
        <SettingsRow
          icon={Shield}
          label="Privacy Policy"
          onClick={async () => {
            if (Capacitor.isNativePlatform()) {
              await Browser.open({ url: 'https://ascendus.store/privacy' })
            } else {
              navigate('/privacy')
            }
          }}
        />
        <div style={dividerStyle} />
        <SettingsRow
          icon={Shield}
          label="Terms of Service"
          onClick={async () => {
            if (Capacitor.isNativePlatform()) {
              await Browser.open({ url: 'https://ascendus.store/terms' })
            } else {
              navigate('/terms')
            }
          }}
        />
      </motion.div>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17, duration: 0.35, ease: EASE_STANDARD }}
        className="mb-3"
        style={sectionStyle}
      >
        <SettingsRow
          icon={Share2}
          label="Share Ascendus"
          onClick={handleShare}
        />
        <div style={dividerStyle} />
        <SettingsRow
          icon={Award}
          label="Rate the App"
          onClick={() => setRateOpen(true)}
        />
      </motion.div>

      {/* ── Privacy Badge ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: EASE_STANDARD }}
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-3"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Shield size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        <p className="text-[11px] font-body" style={{ color: TEXT_DIM }}>
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Privacy First:</span>{' '}
          Photos are analyzed by AI and stored securely. We never sell your data.
        </p>
      </motion.div>

      {/* ── Danger Zone ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.35, ease: EASE_STANDARD }}
        className="mb-5"
        style={sectionStyle}
      >
        <SettingsRow
          icon={LogOut}
          label="Sign Out"
          onClick={handleLogout}
          danger
        />
        <div style={{ height: 1, background: 'rgba(239,68,68,0.12)', marginLeft: 56 }} />
        <SettingsRow
          icon={Trash2}
          label="Delete Account & Data"
          onClick={() => { setDeleteAccountOpen(true); setDeleteAccountError('') }}
          danger
        />
      </motion.div>

      {/* ── Version ──────────────────────────────────────────────── */}
      <p className="text-center text-[10px] font-body pb-8" style={{ color: TEXT_DIM }}>
        Ascendus {appVersion}
      </p>

      {/* ── Share Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShareOpen(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={SPRING_STANDARD}
              className="w-full rounded-t-2xl p-6"
              style={{ background: '#161616', border: `1px solid ${BORDER}`, borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3
                  className="font-heading font-bold text-[17px]"
                  style={{ color: TEXT, letterSpacing: '-0.01em' }}
                >
                  Share Ascendus
                </h3>
                <button
                  onClick={() => setShareOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <X size={15} style={{ color: TEXT_DIM }} />
                </button>
              </div>

              <p className="text-[13px] font-body mb-5" style={{ color: TEXT_DIM }}>
                {latestScan
                  ? `My Ascendus score is ${latestScan.glowScore}/100. Track your glow-up at ascendus.store`
                  : 'Track your glow-up at ascendus.store'}
              </p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  {
                    label: 'Twitter / X',
                    emoji: '𝕏',
                    bg: '#0A0A0A',
                    border: 'rgba(255,255,255,0.1)',
                    action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I've been tracking my glow-up with Ascendus ${latestScan ? `My score: ${latestScan.glowScore}/100` : ''}\n\nascendus.store`)}`, '_blank'),
                  },
                  {
                    label: 'WhatsApp',
                    Icon: MessageCircle,
                    iconColor: '#25D366',
                    bg: '#0D1F12',
                    border: 'rgba(37,211,102,0.2)',
                    action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out Ascendus — the AI appearance tracker ascendus.store`)}`, '_blank'),
                  },
                  {
                    label: 'Instagram',
                    Icon: Camera,
                    iconColor: '#C13584',
                    bg: '#1A0D1A',
                    border: 'rgba(193,53,132,0.2)',
                    action: () => { copyLink(); alert('Link copied! Paste it in your Instagram bio or story.') },
                  },
                ].map(({ label, Icon, iconColor, emoji, bg, border, action }) => (
                  <button
                    key={label}
                    onClick={() => { triggerHaptic(); action() }}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform"
                    style={{ background: bg, border: `1px solid ${border}` }}
                  >
                    <span className="text-xl">{Icon ? <Icon size={22} style={{ color: iconColor }} /> : emoji}</span>
                    <span
                      className="text-[10px] font-heading font-bold"
                      style={{ color: 'rgba(255,255,255,0.6)' }}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => { triggerHaptic(); copyLink() }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl transition-colors"
                style={{
                  border: `1.5px dashed ${copied ? GOLD : 'rgba(255,255,255,0.12)'}`,
                  background: copied ? 'rgba(198,168,92,0.06)' : 'transparent',
                }}
              >
                {copied
                  ? <Check size={15} style={{ color: GOLD }} />
                  : <Copy size={15} style={{ color: 'rgba(255,255,255,0.4)' }} />
                }
                <span
                  className="text-sm font-heading font-bold"
                  style={{ color: copied ? GOLD : 'rgba(255,255,255,0.5)' }}
                >
                  {copied ? 'Link Copied!' : 'Copy Link'}
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Privacy Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {privacyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={() => { setPrivacyOpen(false); setDeleteConfirm(false); setDataDeleted(false) }}
          >
            <motion.div
              initial={{ y: 400 }}
              animate={{ y: 0 }}
              exit={{ y: 400 }}
              transition={SPRING_STANDARD}
              className="w-full rounded-t-2xl p-6"
              style={{ background: '#161616', border: `1px solid ${BORDER}`, borderBottom: 'none', maxHeight: '85vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <Shield size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  </div>
                  <h3 className="font-heading font-bold text-[17px]" style={{ color: TEXT, letterSpacing: '-0.01em' }}>
                    Privacy Settings
                  </h3>
                </div>
                <button
                  onClick={() => { setPrivacyOpen(false); setDeleteConfirm(false); setDataDeleted(false) }}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <X size={15} style={{ color: TEXT_DIM }} />
                </button>
              </div>

              {/* Privacy info */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Shield size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 2 }} />
                <p className="text-[11px] font-body" style={{ color: TEXT_DIM, lineHeight: 1.5 }}>
                  Your photos are sent to <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Anthropic Claude AI</span> for analysis and stored securely in our database. We do not sell your data. You can delete everything anytime below.
                </p>
              </div>

              {/* Toggle rows */}
              <div className="space-y-2 mb-5">
                {[
                  {
                    key: 'savePhotos',
                    icon: Eye,
                    label: 'Save Scan Photos',
                    desc: 'Keep face photos stored locally for progress comparisons.',
                  },
                  {
                    key: 'faceDataRetention',
                    icon: Database,
                    label: 'Retain Scan Data',
                    desc: 'Store your scan history and scores locally for progress tracking.',
                  },
                  {
                    key: 'personalizedTips',
                    icon: Sparkles,
                    label: 'Personalised Recommendations',
                    desc: 'Use your scan results to tailor improvement advice to your profile.',
                  },
                  {
                    key: 'analytics',
                    icon: BarChart2,
                    label: 'Anonymous Analytics',
                    desc: 'Share anonymous usage data to help improve the app. No personal data included.',
                  },
                ].map(({ key, icon: Icon, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-start gap-3.5 px-4 py-3.5 rounded-2xl"
                    style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Icon size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-semibold text-[13px] mb-0.5" style={{ color: TEXT }}>{label}</p>
                      <p className="font-body text-[11px]" style={{ color: TEXT_DIM, lineHeight: 1.5 }}>{desc}</p>
                    </div>
                    <button
                      onClick={() => setPrivacySetting(key, !privacySettings?.[key])}
                      className="w-11 h-6 rounded-full relative transition-colors flex-shrink-0 mt-1"
                      style={{ background: privacySettings?.[key] ? GOLD : 'rgba(255,255,255,0.1)' }}
                    >
                      <motion.div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white"
                        animate={{ x: privacySettings?.[key] ? 20 : 4 }}
                        transition={SPRING_STANDARD}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Delete all scan data */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
                <div className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <Trash2 size={14} style={{ color: '#EF4444' }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-semibold text-[13px] mb-0.5" style={{ color: '#EF4444' }}>Delete All Scan Data</p>
                      <p className="font-body text-[11px]" style={{ color: TEXT_DIM, lineHeight: 1.5 }}>
                        Permanently removes all scans, photos, check-ins, and progress data from this device.
                      </p>
                    </div>
                  </div>

                  {dataDeleted ? (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.08)' }}
                    >
                      <Check size={13} style={{ color: '#EF4444' }} />
                      <p className="text-[12px] font-heading font-bold" style={{ color: '#EF4444' }}>All scan data deleted.</p>
                    </motion.div>
                  ) : deleteConfirm ? (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 mt-3">
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        className="flex-1 py-2.5 rounded-xl font-heading font-bold text-[12px]"
                        style={{ background: 'rgba(255,255,255,0.06)', color: TEXT_DIM }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { triggerHaptic(); clearAllScanData(); setDataDeleted(true); setDeleteConfirm(false) }}
                        className="flex-1 py-2.5 rounded-xl font-heading font-bold text-[12px]"
                        style={{ background: '#EF4444', color: 'white' }}
                      >
                        Yes, Delete All
                      </button>
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => { triggerHaptic(); setDeleteConfirm(true) }}
                      className="w-full mt-3 py-2.5 rounded-xl font-heading font-bold text-[12px] transition-all"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Delete All Data
                    </button>
                  )}
                </div>
              </div>

              <p className="text-center text-[10px] font-body mt-4 pb-2" style={{ color: TEXT_DIM }}>
                Settings saved automatically · All data stays on your device
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rate Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {rateOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setRateOpen(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={SPRING_STANDARD}
              className="relative w-full rounded-t-2xl p-6 text-center"
              style={{ background: '#161616', border: `1px solid ${BORDER}`, borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setRateOpen(false)}
                className="absolute right-6 top-6 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <X size={15} style={{ color: TEXT_DIM }} />
              </button>

              {rated ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <Heart size={48} className="mb-3" style={{ color: GOLD }} />
                  <h3
                    className="font-heading font-bold text-xl mb-1"
                    style={{ color: TEXT, letterSpacing: '-0.01em' }}
                  >
                    Thank you!
                  </h3>
                  <p className="text-sm font-body" style={{ color: TEXT_DIM }}>
                    Your feedback means the world to us.
                  </p>
                </motion.div>
              ) : (
                <>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'rgba(198,168,92,0.1)', border: `1px solid ${GOLD_BORDER}` }}
                  >
                    <Star size={24} fill={GOLD} style={{ color: GOLD }} />
                  </div>
                  <h3
                    className="font-heading font-bold text-[19px] mb-1"
                    style={{ color: TEXT, letterSpacing: '-0.01em' }}
                  >
                    Enjoying Ascendus?
                  </h3>
                  <p className="text-[13px] font-body mb-6" style={{ color: TEXT_DIM }}>
                    Tap a star to rate your experience
                  </p>

                  <div className="flex justify-center gap-3 mb-6">
                    {[1, 2, 3, 4, 5].map(star => (
                      <motion.button
                        key={star}
                        whileTap={{ scale: 0.85 }}
                        animate={{ scale: rating >= star ? 1.15 : 1 }}
                        onClick={() => { triggerHaptic(); setRating(star) }}
                      >
                        <Star
                          size={34}
                          fill={rating >= star ? GOLD : 'none'}
                          style={{ color: rating >= star ? GOLD : 'rgba(255,255,255,0.15)' }}
                        />
                      </motion.button>
                    ))}
                  </div>

                  <button
                    onClick={() => { if (rating > 0) { triggerHaptic(); submitRating(rating) } }}
                    disabled={rating === 0}
                    className="w-full py-3.5 rounded-xl font-heading font-bold text-[14px] transition-all"
                    style={{
                      background: rating > 0
                        ? GOLD_GRADIENT
                        : 'rgba(255,255,255,0.06)',
                      color: rating > 0 ? '#0A0A0A' : TEXT_DIM,
                      opacity: rating === 0 ? 0.5 : 1,
                    }}
                  >
                    {rating >= 4 ? 'Submit & Leave a Review' : 'Submit Rating'}
                  </button>
                  <p className="text-[10px] font-body mt-3" style={{ color: TEXT_DIM }}>
                    {rating >= 4
                      ? "You'll be taken to leave a public review."
                      : 'Your feedback helps us improve.'}
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </MotionPage>

      {/* ── Cancel Subscription Modal — portal escapes MotionPage transform ── */}
      {createPortal(
        <AnimatePresence>
          {cancelOpen && (
            <CancelModal onClose={() => setCancelOpen(false)} />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Delete Account Modal — rendered in a portal so MotionPage's
           CSS transform doesn't create a new stacking context that traps
           position:fixed, causing the backdrop to be clipped. ─────────── */}
      {createPortal(
        <AnimatePresence>
          {deleteAccountOpen && (
            <motion.div
              ref={deleteBackdropRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                display: 'flex', alignItems: 'flex-end',
                background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)',
                touchAction: 'none',
              }}
              onClick={(e) => { if (e.target === deleteBackdropRef.current && !deletingAccount) setDeleteAccountOpen(false) }}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={SPRING_STANDARD}
                style={{
                  width: '100%',
                  background: '#0D0D0D',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderBottom: 'none',
                  borderRadius: '24px 24px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Handle */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
                  <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
                </div>

                <div style={{ padding: '16px 20px', paddingBottom: 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))', flexShrink: 0 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}>
                        <Trash2 size={16} style={{ color: '#EF4444' }} />
                      </div>
                      <h3 className="font-heading font-bold text-[18px] text-white">Delete Account</h3>
                    </div>
                    <button
                      onClick={() => !deletingAccount && setDeleteAccountOpen(false)}
                      style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer' }}
                    >
                      <X size={15} className="text-white" />
                    </button>
                  </div>

                  {/* Warning box */}
                  <div style={{ borderRadius: 16, padding: '16px', marginBottom: 20, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <p className="font-heading font-bold text-[13px]" style={{ color: '#EF4444', marginBottom: 8 }}>
                      This is permanent and cannot be undone.
                    </p>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        'Your account and login will be deleted',
                        'All scans, scores, and progress history',
                        'Your 12-week plan and check-in streak',
                        'Your active subscription will be cancelled',
                      ].map(line => (
                        <li key={line} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ marginTop: 2, fontSize: 10, color: 'rgba(239,68,68,0.7)', flexShrink: 0 }}>✕</span>
                          <span className="font-body text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Error */}
                  {deleteAccountError && (
                    <p className="font-body text-[11px] text-center" style={{ color: '#EF4444', marginBottom: 12 }}>
                      {deleteAccountError}
                    </p>
                  )}

                  {/* Buttons */}
                  <button
                    onClick={() => { triggerHaptic(); handleDeleteAccount() }}
                    disabled={deletingAccount}
                    className="font-heading font-bold text-[14px]"
                    style={{ width: '100%', padding: '16px', borderRadius: 16, background: '#EF4444', color: 'white', border: 'none', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: deletingAccount ? 0.5 : 1, cursor: deletingAccount ? 'not-allowed' : 'pointer' }}
                  >
                    {deletingAccount ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{ display: 'inline-block', width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}
                        />
                        Deleting…
                      </>
                    ) : 'Yes, Delete Everything'}
                  </button>
                  <button
                    onClick={() => setDeleteAccountOpen(false)}
                    disabled={deletingAccount}
                    className="font-heading font-bold text-[14px]"
                    style={{ width: '100%', padding: '14px', borderRadius: 16, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
