import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import FaceScanOverlay from '../components/FaceScanOverlay'
import { triggerHaptic } from '../utils/haptics'

const UMAX_PURPLE = 'linear-gradient(180deg, #9D4EDD 0%, #7B2FBE 100%)'

export default function ScanHome() {
  const navigate = useNavigate()
  const scans = useStore(s => s.scans)
  const latestScan = scans?.[0] ?? null
  const [tab, setTab] = useState(0) // 0=begin, 1=past (dots like Umax)

  const tabs = [
    { id: 'begin' },
    ...(latestScan ? [{ id: 'past' }] : []),
    { id: 'body' },
  ]

  return (
    <MotionPage baseClassName="" className="flex flex-col h-full" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          paddingLeft: 20, paddingRight: 20, paddingBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <h1 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: '-0.01em' }}>
          Facial Analysis
        </h1>
        <button
          onClick={() => { triggerHaptic(); navigate('/settings') }}
          style={{
            background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <Settings size={18} color="rgba(255,255,255,0.5)" />
        </button>
      </div>

      {/* Main card — face mesh placeholder */}
      <div style={{ flex: 1, padding: '0 14px 14px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            borderRadius: 24,
            overflow: 'hidden',
            position: 'relative',
            background: '#111',
            minHeight: 0,
          }}
        >
          {/* Face placeholder / last scan photo */}
          {latestScan?.facePhotoUrl ? (
            <img
              src={latestScan.facePhotoUrl}
              alt="Last scan"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f1e 100%)' }}>
              {/* Generic face silhouette */}
              <svg viewBox="0 0 300 400" style={{ width: '100%', height: '100%', opacity: 0.25 }} preserveAspectRatio="xMidYMid meet">
                <ellipse cx="150" cy="160" rx="80" ry="100" fill="#fff"/>
                <ellipse cx="150" cy="300" rx="60" ry="40" fill="#fff"/>
              </svg>
            </div>
          )}

          {/* Face mesh overlay */}
          <FaceScanOverlay loop showDots={false} />

          {/* Gradient + text overlay at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
              padding: '60px 24px 28px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}
          >
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 20, textAlign: 'center', margin: 0, lineHeight: 1.3 }}>
              Get your ratings and recommendations
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { triggerHaptic(); navigate('/scan/capture') }}
              style={{
                width: '100%',
                padding: '20px 0',
                borderRadius: 50,
                background: UMAX_PURPLE,
                border: 'none', cursor: 'pointer',
                color: '#fff', fontWeight: 700, fontSize: 18,
                fontFamily: 'inherit',
                boxShadow: '0 4px 24px rgba(155,78,221,0.45)',
              }}
            >
              Begin scan
            </motion.button>
          </div>
        </div>

        {/* Dots */}
        {tabs.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 12 }}>
            {tabs.map((_, i) => (
              <div
                key={i}
                onClick={() => setTab(i)}
                style={{
                  width: i === tab ? 20 : 6, height: 6, borderRadius: 99,
                  background: i === tab ? '#fff' : 'rgba(255,255,255,0.25)',
                  transition: 'all 0.2s', cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </MotionPage>
  )
}
