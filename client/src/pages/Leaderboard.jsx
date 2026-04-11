import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import useStore from '../store/useStore'
import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import { api } from '../utils/api'

const GOLD = '#C6A85C'
const GOLD_DIM = 'rgba(198,168,92,0.1)'
const GOLD_BORDER = 'rgba(198,168,92,0.25)'

function maskUsername(username) {
  if (!username || username.length <= 2) return username
  return username.slice(0, 2) + '***'
}

function RankBadge({ rank }) {
  if (rank === 1) return <span className="text-xl">👑</span>
  if (rank === 2) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(192,192,192,0.15)' }}>
      <span className="font-mono font-bold text-[11px]" style={{ color: 'rgba(192,192,192,0.8)' }}>2</span>
    </div>
  )
  if (rank === 3) return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(205,127,50,0.15)' }}>
      <span className="font-mono font-bold text-[11px]" style={{ color: 'rgba(205,127,50,0.8)' }}>3</span>
    </div>
  )
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <span className="font-mono font-bold text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{rank}</span>
    </div>
  )
}

export default function Leaderboard() {
  const { currentScan, user } = useStore()
  const [leaderboard, setLeaderboard] = useState([])
  const [weekStart, setWeekStart] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitUsername, setSubmitUsername] = useState(user?.name ?? '')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [userRank, setUserRank] = useState(null)

  async function loadLeaderboard() {
    setLoading(true)
    setError('')
    try {
      const data = await api.leaderboard.get()
      setLeaderboard(data.leaderboard ?? [])
      setWeekStart(data.weekStart ?? '')
      // Find user rank
      if (submitUsername) {
        const idx = (data.leaderboard ?? []).findIndex(
          e => e.username.toLowerCase() === submitUsername.toLowerCase()
        )
        setUserRank(idx >= 0 ? idx + 1 : null)
      }
    } catch (err) {
      setError('Could not load leaderboard. Make sure the server is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeaderboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit() {
    if (!submitUsername.trim()) {
      setSubmitError('Enter a username')
      return
    }
    if (!currentScan?.umaxScore) {
      setSubmitError('Complete a scan first to get your score')
      return
    }
    setSubmitLoading(true)
    setSubmitError('')
    try {
      await api.leaderboard.submit({ username: submitUsername.trim(), score: currentScan.umaxScore })
      setSubmitSuccess(true)
      await loadLeaderboard()
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit score')
    } finally {
      setSubmitLoading(false)
    }
  }

  function formatWeekStart(dateStr) {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <MotionPage className="px-4">
      <PageHeader
        title="Most Improved 🏆"
        subtitle="This week · Anonymous · Resets Monday"
      />

      {/* User rank banner */}
      {userRank && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-4 flex items-center justify-between"
          style={{ background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}` }}
        >
          <div>
            <p className="text-[10px] font-heading font-bold uppercase tracking-widest mb-0.5" style={{ color: GOLD }}>
              Your Rank
            </p>
            <p className="font-heading font-bold text-2xl" style={{ color: GOLD }}>#{userRank}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Week of {formatWeekStart(weekStart)}
            </p>
            {currentScan?.umaxScore && (
              <p className="font-mono font-bold text-sm mt-0.5" style={{ color: GOLD }}>
                {currentScan.umaxScore.toFixed(1)}/10
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Submit score section */}
      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className="font-heading font-bold text-sm text-primary mb-1">Submit Your Score</p>
        <p className="text-[11px] font-body mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {currentScan?.umaxScore
            ? `Your current score: ${currentScan.umaxScore.toFixed(1)}/10`
            : 'Complete a scan first to get your score'}
        </p>

        {submitSuccess ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 py-2"
          >
            <span className="text-base">✅</span>
            <p className="text-sm font-heading font-bold" style={{ color: GOLD }}>Score submitted!</p>
          </motion.div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={submitUsername}
              onChange={e => setSubmitUsername(e.target.value)}
              placeholder="Username"
              maxLength={20}
              className="flex-1 px-3 py-2.5 rounded-xl font-body text-[13px] outline-none"
              style={{
                background: '#111',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#F0EDE8',
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={submitLoading || !currentScan?.umaxScore}
              className="px-4 py-2.5 rounded-xl font-heading font-bold text-[12px] flex items-center gap-1.5 transition-all duration-200"
              style={{
                background: !currentScan?.umaxScore ? 'rgba(198,168,92,0.15)' : `linear-gradient(135deg, #D4B96A, ${GOLD}, #A8893A)`,
                color: !currentScan?.umaxScore ? 'rgba(255,255,255,0.3)' : '#0A0A0A',
                cursor: !currentScan?.umaxScore ? 'not-allowed' : 'pointer',
              }}
            >
              {submitLoading ? <Loader2 size={13} className="animate-spin" /> : 'Submit'}
            </button>
          </div>
        )}

        {submitError && (
          <p className="mt-2 text-[11px] font-body" style={{ color: '#EF4444' }}>{submitError}</p>
        )}
      </div>

      {/* Leaderboard list */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-heading font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Week of {formatWeekStart(weekStart)}
        </p>
        <button
          onClick={loadLeaderboard}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <RefreshCw size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: GOLD }} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={32} className="mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="text-sm font-heading font-bold text-primary mb-1">Unavailable</p>
          <p className="text-xs font-body" style={{ color: 'rgba(255,255,255,0.35)' }}>{error}</p>
          <button
            onClick={loadLeaderboard}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-heading font-bold"
            style={{ background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}` }}
          >
            Try Again
          </button>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-3">🏆</span>
          <p className="text-sm font-heading font-bold text-primary mb-1">No entries yet</p>
          <p className="text-xs font-body" style={{ color: 'rgba(255,255,255,0.35)' }}>Be the first to submit your score this week!</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {leaderboard.map((entry, index) => {
              const rank = index + 1
              const isFirst = rank === 1
              const improvement = entry.improvement ?? (entry.current_score - entry.initial_score)
              const improvementDisplay = improvement >= 0
                ? `+${improvement.toFixed(1)}`
                : improvement.toFixed(1)

              return (
                <motion.div
                  key={entry.username}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: isFirst ? GOLD_DIM : '#111',
                    border: `1px solid ${isFirst ? GOLD_BORDER : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <RankBadge rank={rank} />

                  <div className="flex-1 min-w-0">
                    <p
                      className="font-heading font-bold text-[13px] truncate"
                      style={{ color: isFirst ? GOLD : '#F0EDE8' }}
                    >
                      {maskUsername(entry.username)}
                    </p>
                    <p className="text-[10px] font-body" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Score: {entry.current_score?.toFixed(1)}/10
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p
                      className="font-mono font-bold text-[14px]"
                      style={{ color: improvement > 0 ? '#10B981' : improvement < 0 ? '#EF4444' : 'rgba(255,255,255,0.4)' }}
                    >
                      {improvementDisplay}
                    </p>
                    <p className="text-[9px] font-body" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      improvement
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <div className="pb-8" />
    </MotionPage>
  )
}
