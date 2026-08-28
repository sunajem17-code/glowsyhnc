import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import { triggerHaptic } from '../utils/haptics'

const UMAX_PURPLE = 'linear-gradient(135deg, #9D4EDD 0%, #7B2FBE 100%)'

export default function Dashboard() {
  const navigate = useNavigate()
  const scans = useStore(s => s.scans)
  const streak = useStore(s => s.streak)
  const currentPlan = useStore(s => s.currentPlan)
  const isPremium = useStore(s => s.isPremium)

  const latestScan = scans?.[0] ?? null
  const streakCount = streak?.current ?? 1
  const hasPlan = !!currentPlan?.tasks?.length

  return (
    <MotionPage baseClassName="" className="flex flex-col h-full" style={{ background: '#0a0a0a', overflow: 'auto' }}>
      {/* Header */}
      <div
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
          paddingLeft: 20, paddingRight: 20, paddingBottom: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <h1 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: 0 }}>
          {streakCount}🔥 day streak
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

      <div style={{ padding: '10px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Your progress card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => { triggerHaptic(); navigate('/results') }}
          style={{
            background: UMAX_PURPLE,
            borderRadius: 20,
            padding: '20px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Background sparkles */}
          <div style={{ position: 'absolute', right: 70, top: 10, opacity: 0.3, fontSize: 24 }}>✦</div>
          <div style={{ position: 'absolute', right: 100, bottom: 8, opacity: 0.2, fontSize: 16 }}>✦</div>
          <div style={{ position: 'absolute', right: 60, bottom: 20, opacity: 0.25, fontSize: 12 }}>✦</div>

          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: '0 0 10px' }}>
              Your progress
            </p>
            <div
              onClick={e => { e.stopPropagation(); triggerHaptic(); navigate('/results') }}
              style={{
                background: '#fff', borderRadius: 50, padding: '8px 20px',
                display: 'inline-flex', alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: '#7B2FBE', fontWeight: 700, fontSize: 15 }}>View</span>
            </div>
          </div>
          <span style={{ fontSize: 64, flexShrink: 0 }}>😎</span>
        </motion.div>

        {/* Your routine section */}
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: '0 0 10px 4px' }}>
            Your routine
          </h2>

          {hasPlan ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentPlan.tasks.slice(0, 4).map((task, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => { triggerHaptic(); navigate('/plan') }}
                  style={{
                    background: '#161616', borderRadius: 16,
                    padding: '16px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: task.completed ? '#10B981' : '#7B2FBE', flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#fff', fontWeight: 600, fontSize: 15, margin: 0 }}>{task.label || task.title}</p>
                    {task.subtitle && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '2px 0 0' }}>{task.subtitle}</p>}
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20 }}>›</span>
                </motion.div>
              ))}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { triggerHaptic(); navigate('/plan') }}
                style={{
                  width: '100%', marginTop: 4, padding: '16px 0',
                  borderRadius: 16, background: '#161616',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                View full plan →
              </motion.button>
            </div>
          ) : (
            <div
              style={{
                background: '#161616', borderRadius: 16,
                padding: '28px 20px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, margin: 0 }}>
                Scan to get your daily glow up routine
              </p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: '4px 0 10px 4px' }}>
            Quick actions
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: '💪 Workout plan', to: '/workout-plan' },
              { label: '✂️ HairMaxx', to: '/hairmaxx' },
              { label: '❤️ SwipeMaxx', to: '/swipemaxx' },
              { label: '📈 Progress', to: '/progress' },
            ].map(({ label, to }) => (
              <motion.button
                key={to}
                whileTap={{ scale: 0.96 }}
                onClick={() => { triggerHaptic(); navigate(to) }}
                style={{
                  background: '#161616', borderRadius: 14,
                  padding: '16px 14px', textAlign: 'left',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#fff', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </MotionPage>
  )
}
