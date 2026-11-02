import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Moon } from 'lucide-react'
import useStore from '../store/useStore'
const setScanLaunchingSelector = s => s.setScanLaunching
import MotionPage from '../components/MotionPage'
import FaceScanOverlay from '../components/FaceScanOverlay'
import { GOLD, GOLD_GRADIENT } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'
import { hasCompletedStartingPoint, startingPointCompletionKey } from '../utils/onboardingStartup.js'

const DAILY_SCAN_LIMIT = 3

function CardShell({ eyebrow, title, body, cta, icon: Icon = null, onAction, visual, visualClassName = 'flex-1', footer }) {
  return (
    <div
      className="flex flex-col justify-center h-full px-6 pb-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
    >
      <div className={`relative rounded-2xl overflow-hidden mb-5 ${visualClassName}`} style={{ background: '#000' }}>
        {visual}
      </div>
      <p className="font-heading font-bold text-[11px] tracking-[0.18em] mb-1.5" style={{ color: GOLD }}>
        {eyebrow}
      </p>
      <h2 className="font-heading font-bold text-[24px] text-primary mb-2" style={{ letterSpacing: '-0.02em' }}>
        {title}
      </h2>
      {footer ?? (
        <>
          {body && (
            <p className="font-body text-[14px] text-secondary mb-6 leading-relaxed">
              {body}
            </p>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerHaptic(); onAction() }}
            className="w-full h-[60px] rounded-2xl font-heading font-bold text-[17px] flex items-center justify-center gap-2"
            style={{ background: GOLD_GRADIENT, color: '#0A0A0A', fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, boxShadow: '0 4px 24px rgba(198,168,92,0.35)' }}
          >
            {Icon && <Icon size={17} />}{cta}
          </motion.button>
        </>
      )}
    </div>
  )
}

function FaceScanCard({ onBegin, limitMessage }) {
  const navigate = useNavigate()
  if (limitMessage) {
    return (
      <CardShell
        eyebrow="DAILY LIMIT REACHED"
        title="3 Scans Done"
        body={limitMessage}
        cta="View Progress"
        onAction={() => navigate('/timeline')}
        visualClassName="aspect-[4/5] flex-shrink-0"
        visual={
          <>
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
              <Moon size={56} style={{ color: `${GOLD}55` }} />
            </div>
            <FaceScanOverlay loop showDots={false} />
          </>
        }
      />
    )
  }

  return (
    <CardShell
      eyebrow="NEW FACE SCAN"
      title="Begin Scan"
      body="Get your personalized analysis"
      cta="Start Your Scan"
      onAction={onBegin}
      visualClassName="aspect-[4/5] flex-shrink-0"
      visual={
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera size={48} style={{ color: `${GOLD}66` }} />
          </div>
          <FaceScanOverlay loop showDots={false} />
        </>
      }
    />
  )
}

export default function ScanHome() {
  const navigate = useNavigate()
  const scans = useStore(s => s.scans)
  const streak = useStore(s => s.streak)
  const proScanCount = useStore(s => s.proScanCount)
  const proScanFirstAt = useStore(s => s.proScanFirstAt)
  const setScanLaunching = useStore(setScanLaunchingSelector)
  const user = useStore(s => s.user)
  const startingPointCompletedByUser = useStore(s => s.startingPointCompletedByUser)
  const completeStartingPoint = useStore(s => s.completeStartingPoint)
  const [showHint, setShowHint] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
      return !hasCompletedStartingPoint({
        user,
        startingPointCompletedByUser: saved.state?.startingPointCompletedByUser,
      })
    } catch { return true }
  })

  function dismissHint() {
    completeStartingPoint()
    setShowHint(false)
  }

  useEffect(() => {
    const key = startingPointCompletionKey(user)
    setShowHint(!hasCompletedStartingPoint({ user, startingPointCompletedByUser }))
  }, [user?.id, startingPointCompletedByUser])

  // Hide permanently once the user has completed their first scan.
  useEffect(() => {
    if (scans?.length > 0) dismissHint()
  }, [scans?.length])

  useEffect(() => { setScanLaunching(false) }, [])

  function beginScan(path) {
    triggerHaptic()
    setScanLaunching(true)
    navigate(path)
  }

  const windowStart = proScanFirstAt ? new Date(proScanFirstAt).getTime() : null
  const inWindow = windowStart && (Date.now() - windowStart) < 24 * 60 * 60 * 1000
  const atLimit = inWindow && proScanCount >= DAILY_SCAN_LIMIT

  const limitMessage = atLimit
    ? (streak.current > 0
        ? `Come back tomorrow to continue your ${streak.current} day streak!`
        : 'Come back tomorrow to start a streak!')
    : null

  return (
    <MotionPage baseClassName="" className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0">
          <FaceScanCard onBegin={() => beginScan('/scan/capture')} limitMessage={limitMessage} />
        </div>
      </div>

      {/* First-time hint overlay */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={dismissHint}
            style={{
              position: 'absolute', inset: 0, zIndex: 40,
              pointerEvents: 'none',
            }}
          >
            {/* Tooltip + arrow — far right, bounce together */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: [0, 7, 0] }}
              transition={{
                opacity: { delay: 0.2, duration: 0.3 },
                y: { delay: 0.5, duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
              }}
              style={{
                position: 'absolute',
                bottom: 140,
                right: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              {/* Box */}
              <div style={{
                border: '1.5px solid #C6A85C',
                borderRadius: 9,
                paddingTop: 6, paddingBottom: 6,
                paddingLeft: 10, paddingRight: 10,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                  fontWeight: 700, fontSize: 11,
                  color: '#C6A85C', whiteSpace: 'nowrap',
                }}>
                  Find your starting point
                </span>
              </div>

              {/* Arrow — chunky outlined shape */}
              <svg width="22" height="30" viewBox="0 0 22 30" fill="none">
                <path
                  d="M7 2 L15 2 L15 20 L20 20 L11 30 L2 20 L7 20 Z"
                  fill="none"
                  stroke="#C6A85C"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </MotionPage>
  )
}
