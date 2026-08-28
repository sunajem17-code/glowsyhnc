'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../../components/StatusBadge'
import { getNextPayoutDate } from '../../lib/payoutSchedule'

function usePayoutCountdown() {
  const [nextPayout, setNextPayout] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    getNextPayoutDate().then(d => setNextPayout(d)).catch(() => {})
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const target = nextPayout ? new Date(`${nextPayout.payout_date}T00:00:00`) : null
  const ms = target ? Math.max(0, target.getTime() - now) : 0
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  const pad = n => String(n).padStart(2, '0')

  return nextPayout
    ? `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`
    : null
}

function thumbSrc(thumbnailUrl, videoUrl) {
  if (thumbnailUrl) return `/api/thumbnail?url=${encodeURIComponent(thumbnailUrl)}`
  if (videoUrl) return `/api/video-thumbnail?videoUrl=${encodeURIComponent(videoUrl)}`
  return null
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.26 8.26 0 004.84 1.56V6.85a4.85 4.85 0 01-1.07-.16z"/>
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

function VideoCard({ s, onRemove, countdown }) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const isApproved = s.status === 'approved'
  const confirmTimer = useRef(null)

  function handleRemove(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirming) {
      setConfirming(true)
      // Auto-cancel confirmation after 4 seconds if user doesn't click again
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setRemoving(true)
    supabase.from('submissions').delete().eq('id', s.id).then(() => onRemove(s.id))
  }

  return (
    <div className="rounded-xl border border-border bg-surface hover:border-gold/30 transition-colors">
      <Link href={`/dashboard/submissions/${s.id}`} className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="shrink-0 w-16 h-20 rounded-lg overflow-hidden bg-surface-raised flex items-center justify-center relative">
          <img
            src={thumbSrc(s.thumbnail_url, s.video_url)}
            alt="thumbnail"
            className="w-full h-full object-cover"
            onError={e => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextSibling.style.display = 'flex'
            }}
          />
          <span className="text-2xl opacity-20 absolute inset-0 items-center justify-center hidden" style={{ display: 'none' }}>
            {s.platform === 'tiktok' ? '🎵' : '📸'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* URL + right column (date / status / remove) */}
          <div className="flex items-start justify-between gap-2">
            {/* Left: URL then inline status info */}
            <div className="min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-text-muted min-w-0">
                <span className="shrink-0">{s.platform === 'tiktok' ? <TikTokIcon /> : <InstagramIcon />}</span>
                <span className="text-xs truncate">{s.video_url.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </div>

              {/* Status info — sits flush under the URL */}
              {isApproved && s.payout_amount > 0 ? (
                <div className="rounded-lg border border-gold/20 bg-gold/5 px-2 py-1 self-start mt-0.5">
                  <p className="text-[10px] text-text-muted/60">Confirmed payout</p>
                  <p className="text-sm font-semibold text-gold">${Number(s.payout_amount).toFixed(2)}</p>
                </div>
              ) : s.status === 'rejected' ? (
                <p className="text-[11px] text-danger/70 mt-0.5">Rejected{s.admin_notes ? ` — ${s.admin_notes}` : ''}</p>
              ) : (
                <p className="text-[11px] text-text-muted/40 mt-0.5">Earnings visible after payout day review</p>
              )}

              {!isApproved && s.status !== 'rejected' && countdown && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-text-muted/40 uppercase tracking-wide">Analytics due in</span>
                  <span className="text-[10px] font-mono font-semibold text-text-muted/60">{countdown}</span>
                </div>
              )}

              {s.proof_screenshot_url && <p className="text-[10px] font-medium text-gold/50 mt-0.5">📊 Analytics attached</p>}
            </div>

            {/* Right: date pill / status badge / remove */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="rounded-full bg-surface-raised border border-border px-2.5 py-0.5 text-xs font-medium text-text-muted">
                {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <StatusBadge status={s.status} />
              <button
                onClick={handleRemove}
                disabled={removing}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all shadow-sm
                  ${confirming
                    ? 'bg-red-500/25 text-red-400 ring-1 ring-red-500/50'
                    : 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/25'
                  } ${removing ? 'opacity-40 pointer-events-none' : ''}`}
              >
                {removing ? '…' : confirming ? 'Sure?' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

const SELECT_COLS = 'id, video_url, platform, status, payout_amount, created_at, proof_screenshot_url, thumbnail_url, admin_notes'

export function MySubmissions() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const countdown = usePayoutCountdown()

  useEffect(() => {
    supabase
      .from('submissions')
      .select(SELECT_COLS)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setSubmissions(data ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>
  if (error) return <p className="text-sm text-danger">{error}</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">My Submissions</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Click any video to view details or upload your analytics screenshot.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center">
          <p className="text-sm text-text-muted">No videos submitted yet.</p>
          <p className="mt-1 text-xs text-text-muted/60">Go to Submit Video, paste your link, and we handle the rest.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(s => (
            <VideoCard key={s.id} s={s} countdown={countdown} onRemove={id => setSubmissions(prev => prev.filter(x => x.id !== id))} />
          ))}
        </div>
      )}
    </div>
  )
}
