import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Shield, CreditCard, Share2, Trash2,
  ChevronRight, LogOut, Star, Award, Camera, X, Copy, Check,
} from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import GlowScoreRing from '../components/GlowScoreRing'

const GOLD = '#C6A85C'
const GOLD_BORDER = 'rgba(198,168,92,0.25)'
const SURFACE = '#111111'
const SURFACE_2 = '#181818'
const BORDER = 'rgba(255,255,255,0.07)'
const TEXT = '#F0EDE8'
const TEXT_DIM = '#5A5652'

function SettingsRow({ icon: Icon, label, value, onClick, danger, toggle, checked }) {
  return (
    <button
      onClick={onClick}
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
  const { user, scans, streak, logout, isPremium } = useStore()
  const [notifications, setNotifications] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(false)

  const bestScore = scans.length > 0 ? Math.max(...scans.map(s => s.glowScore)) : 0
  const latestScan = scans[0]

  function handleLogout() {
    logout()
    navigate('/auth')
  }

  function handleShare() {
    const shareText = `I've been tracking my glow-up with GlowSync! My current score: ${latestScan?.glowScore ?? '—'}/100`
    const shareUrl = 'https://glowsync.app'
    if (navigator.share) {
      navigator.share({ title: 'GlowSync', text: shareText, url: shareUrl })
    } else {
      setShareOpen(true)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText('https://glowsync.app')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function submitRating(stars) {
    setRating(stars)
    setRated(true)
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
    <MotionPage className="px-4">
      <PageHeader title="Profile" />

      {/* ── Profile Card ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
              {user?.name ?? 'GlowSync User'}
            </h2>
            <p className="text-[12px] font-body truncate" style={{ color: TEXT_DIM }}>
              {user?.email ?? 'demo@glowsync.app'}
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
        transition={{ delay: 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-3 gap-2.5 mb-5"
      >
        {[
          { label: 'Total Scans', value: scans.length || '—', symbol: '#' },
          { label: 'Best Score', value: bestScore || '—', symbol: '↑' },
          { label: 'Streak', value: streak.current > 0 ? `${streak.current}d` : '—', symbol: '🔥' },
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

      {/* ── Premium CTA ──────────────────────────────────────────── */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
              <span className="text-base font-mono" style={{ color: GOLD }}>✦</span>
              <span
                className="text-[10px] font-heading font-bold uppercase tracking-widest"
                style={{ color: GOLD }}
              >
                GlowSync Premium
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
              onClick={() => navigate('/premium')}
              className="w-full py-3.5 rounded-xl font-heading font-bold text-[14px]"
              style={{
                background: `linear-gradient(135deg, #D4B96A 0%, ${GOLD} 45%, #A8893A 100%)`,
                color: '#0A0A0A',
                boxShadow: `0 4px 20px rgba(198,168,92,0.3)`,
                letterSpacing: '0.01em',
              }}
            >
              Start Free Trial →
            </motion.button>
            <p className="text-center text-[10px] font-body mt-2.5" style={{ color: TEXT_DIM }}>
              7-day free trial · Cancel anytime
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Settings ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
          onClick={() => {}}
        />
        <div style={dividerStyle} />
        <SettingsRow
          icon={CreditCard}
          label="Subscription"
          value={isPremium ? '✦ Premium' : 'Free'}
          onClick={() => navigate('/premium')}
        />
      </motion.div>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mb-3"
        style={sectionStyle}
      >
        <SettingsRow
          icon={Share2}
          label="Share GlowSync"
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
        transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-3"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Shield size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        <p className="text-[11px] font-body" style={{ color: TEXT_DIM }}>
          <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Privacy First —</span>{' '}
          All photo analysis runs on-device. We never sell your data.
        </p>
      </motion.div>

      {/* ── Danger Zone ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
          onClick={() => {
            if (confirm('Are you sure? This permanently deletes all your data.')) {
              logout()
              navigate('/auth')
            }
          }}
          danger
        />
      </motion.div>

      {/* ── Version ──────────────────────────────────────────────── */}
      <p className="text-center text-[10px] font-body pb-8" style={{ color: TEXT_DIM }}>
        GlowSync v1.0.0
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
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full rounded-t-3xl p-6"
              style={{ background: '#161616', border: `1px solid ${BORDER}`, borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3
                  className="font-heading font-bold text-[17px]"
                  style={{ color: TEXT, letterSpacing: '-0.01em' }}
                >
                  Share GlowSync
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
                  ? `My GlowSync score is ${latestScan.glowScore}/100 — track your glow-up at glowsync.app`
                  : 'Track your full-body glow-up at glowsync.app'}
              </p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  {
                    label: 'Twitter / X',
                    emoji: '𝕏',
                    bg: '#0A0A0A',
                    border: 'rgba(255,255,255,0.1)',
                    action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I've been tracking my glow-up with GlowSync ${latestScan ? `My score: ${latestScan.glowScore}/100` : ''}\n\nglowsync.app`)}`, '_blank'),
                  },
                  {
                    label: 'WhatsApp',
                    emoji: '💬',
                    bg: '#0D1F12',
                    border: 'rgba(37,211,102,0.2)',
                    action: () => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out GlowSync — the full-body glow-up tracker glowsync.app`)}`, '_blank'),
                  },
                  {
                    label: 'Instagram',
                    emoji: '📸',
                    bg: '#1A0D1A',
                    border: 'rgba(193,53,132,0.2)',
                    action: () => { copyLink(); alert('Link copied! Paste it in your Instagram bio or story.') },
                  },
                ].map(({ label, emoji, bg, border, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl active:scale-95 transition-transform"
                    style={{ background: bg, border: `1px solid ${border}` }}
                  >
                    <span className="text-xl">{emoji}</span>
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
                onClick={copyLink}
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
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full rounded-t-3xl p-6 text-center"
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
                  <p className="text-5xl mb-3">🙏</p>
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
                    Enjoying GlowSync?
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
                        onClick={() => setRating(star)}
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
                    onClick={() => rating > 0 && submitRating(rating)}
                    disabled={rating === 0}
                    className="w-full py-3.5 rounded-xl font-heading font-bold text-[14px] transition-all"
                    style={{
                      background: rating > 0
                        ? `linear-gradient(135deg, #D4B96A 0%, ${GOLD} 45%, #A8893A 100%)`
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
  )
}
