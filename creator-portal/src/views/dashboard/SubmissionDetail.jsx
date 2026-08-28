'use client'
import { useEffect, useRef, useState } from 'react'

function thumbSrc(thumbnailUrl, videoUrl) {
  if (thumbnailUrl) return `/api/thumbnail?url=${encodeURIComponent(thumbnailUrl)}`
  if (videoUrl) return `/api/video-thumbnail?videoUrl=${encodeURIComponent(videoUrl)}`
  return null
}
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { StatusBadge } from '../../components/StatusBadge'

const MILESTONES = [
  { views: 30_000, payout: 15 },
  { views: 250_000, payout: 40 },
  { views: 1_000_000, payout: 100 },
  { views: 2_500_000, payout: 180 },
  { views: 5_000_000, payout: 300 },
]

function estimatedEarnings(views) {
  if (!views || views < MILESTONES[0].views) return null
  let earned = 0
  for (const m of MILESTONES) {
    if (views >= m.views) earned = m.payout
    else break
  }
  return earned
}

function nextMilestone(views) {
  return MILESTONES.find(m => m.views > (views ?? 0)) ?? null
}

function UploadAnalytics({ submission, onSaved }) {
  const { creator } = useAuth()
  const ref = useRef()
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState(null)
  const [preview, setPreview] = useState(submission.proof_screenshot_url ? 'existing' : null)

  async function handle(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setErr('Max 8MB'); return }
    setUploading(true); setErr(null)
    const path = `${creator.id}/${submission.id}-analytics-${Date.now()}`
    const { error: upErr } = await supabase.storage.from('proof-screenshots').upload(path, file, { upsert: true })
    if (upErr) { setErr('Upload failed'); setUploading(false); return }
    const { error: dbErr } = await supabase.from('submissions').update({ proof_screenshot_url: path }).eq('id', submission.id)
    setUploading(false)
    if (dbErr) { setErr('Could not save'); return }
    setPreview('new')
    onSaved()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => ref.current.click()}
          disabled={uploading}
          className="rounded-lg border border-gold/40 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/10 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading…' : submission.proof_screenshot_url || preview ? 'Replace Screenshot' : 'Upload Screenshot'}
        </button>
        {(submission.proof_screenshot_url || preview === 'new') && (
          <span className="text-xs text-gold">✓ Screenshot attached</span>
        )}
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  )
}

export function SubmissionDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    const { data, error: err } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single()
    if (err) setError(err.message)
    else setSub(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return <p className="text-sm text-text-muted p-6">Loading…</p>
  if (error) return <p className="text-sm text-danger p-6">{error}</p>
  if (!sub) return null

  const isApproved = sub.status === 'approved'

  return (
    <div className="max-w-2xl space-y-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors">
        ← Back to My Submissions
      </button>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {/* Thumbnail */}
        <a href={sub.video_url} target="_blank" rel="noopener noreferrer"
          className="group relative block w-full bg-black overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          <img src={thumbSrc(sub.thumbnail_url, sub.video_url)} alt="Video thumbnail"
            className="absolute inset-0 w-full h-full object-cover"
            onError={e => { e.currentTarget.style.opacity = '0' }} />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="rounded-full bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm">Open Video ↗</div>
          </div>
        </a>

        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <a href={sub.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-gold hover:underline break-all">
                {sub.video_url}
              </a>
              <p className="mt-1 text-xs text-text-muted/60">
                Submitted {new Date(sub.created_at).toLocaleDateString()} · {sub.platform}
              </p>
            </div>
            <StatusBadge status={sub.status} />
          </div>

          {/* Payout — only shown after admin approves */}
          {isApproved && sub.payout_amount > 0 ? (
            <div className="rounded-xl border border-gold/30 bg-gold/5 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold/70">Confirmed Payout</p>
              <p className="text-3xl font-bold text-gold mt-1">${Number(sub.payout_amount).toFixed(2)}</p>
              {sub.current_views > 0 && (
                <p className="text-xs text-text-muted mt-1">{sub.current_views.toLocaleString()} views · {sub.tier ?? 'standard'} tier</p>
              )}
            </div>
          ) : sub.status === 'rejected' ? (
            <div className="rounded-xl border border-danger/20 bg-danger/5 px-5 py-4">
              <p className="text-sm font-semibold text-danger">Video Rejected</p>
              {sub.admin_notes
                ? <p className="text-sm text-text-muted mt-1">{sub.admin_notes}</p>
                : <p className="text-sm text-text-muted/60 mt-1">No reason provided. Contact support if you have questions.</p>
              }
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-raised px-5 py-4 text-center">
              <p className="text-sm text-text-muted">Earnings are revealed after payout day review.</p>
              <p className="text-xs text-text-muted/50 mt-1">Upload your analytics screenshot below to ensure correct tier assignment.</p>
            </div>
          )}
        </div>
      </div>

      {/* Admin notes — shown whenever a note exists, any status */}
      {sub.admin_notes && sub.status !== 'rejected' && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Note from team</p>
          <p className="text-sm text-text">{sub.admin_notes}</p>
        </div>
      )}

      {/* Analytics upload */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
        <h2 className="font-semibold text-text">Analytics Screenshot</h2>
        <p className="text-sm text-text-muted">Attach a picture of your location metrics for this video to determine the tier it will be paid at.</p>
        <UploadAnalytics submission={sub} onSaved={load} />
      </div>
    </div>
  )
}

function Stat({ label, value, sub: subLabel, highlight }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-3 py-2.5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${highlight ? 'text-gold' : 'text-text'}`}>{value}</p>
      {subLabel && <p className="text-xs text-text-muted/60">{subLabel}</p>}
    </div>
  )
}
