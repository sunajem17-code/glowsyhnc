'use client'
import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-gold">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function SubmitVideo() {
  const { creator } = useAuth()
  const [videoUrl, setVideoUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const hasUrl = videoUrl.trim().length > 0

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setVideoUrl(text.trim())
    } catch {
      // clipboard permission denied — do nothing
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const url = videoUrl.trim()
    if (!url) { setError('Paste your TikTok or Instagram link first.'); return }
    setSubmitting(true)
    const res = await fetch('/api/submissions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: url }),
    })
    const result = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(result.error ?? 'Submission failed — try again.'); return }
    setSuccess(true)
    setVideoUrl('')
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Submit Video</h1>
        <p className="mt-1 text-sm text-text-muted">Submit your TikTok or Instagram Reel for payout review</p>
      </div>

      {/* Main URL card */}
      <div className="rounded-2xl border border-border bg-surface p-8 space-y-5">
        <h2 className="text-center text-lg font-semibold text-text">Upload your video URL</h2>

        {/* Input row */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-4 py-3">
          <input
            type="url"
            value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
            placeholder="Paste TikTok or Instagram Reel URL"
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={handlePaste}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-muted hover:border-gold/40 hover:text-gold transition-colors shrink-0"
          >
            <ClipboardIcon />
            Paste
          </button>
        </div>

        {/* Error / success */}
        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            ✓ Submitted! Your video is now pending review.
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !hasUrl}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all ${
            hasUrl && !submitting
              ? 'bg-gold text-black hover:opacity-90'
              : 'bg-surface-raised text-text-muted cursor-not-allowed'
          }`}
        >
          <SendIcon />
          {submitting ? 'Checking…' : 'Submit Video'}
        </button>
      </div>

      {/* Two info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Requirements */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <h3 className="font-semibold text-text">Requirements</h3>
          <ul className="space-y-2.5">
            {[
              { bold: 'Verified', rest: 'account only' },
              { bold: 'TikTok:', rest: 'tag @ascendus_app in caption' },
              { bold: 'Instagram:', rest: 'tag @ascendus_app in caption' },
              { bold: '1,000+ followers:', rest: 'add bio link (beacons.ai/ascendus)' },
              { bold: 'No duplicates', rest: '— each video once only' },
            ].map(({ bold, rest }) => (
              <li key={bold} className="flex items-start gap-2.5 text-sm text-text-muted">
                <CheckIcon />
                <span><strong className="text-text">{bold}</strong> {rest}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Payout info */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <h3 className="font-semibold text-text">Payout Info</h3>
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0">⚠️</span>
            <p className="text-sm text-text-muted leading-relaxed">
              <strong className="text-text">Est. Earnings</strong> shown are based on Standard tier. Final payout may be <strong className="text-text">higher or lower</strong> depending on your US audience % and view count at payout time.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0">💰</span>
            <div className="text-sm text-text-muted leading-relaxed space-y-1">
              <p>If your account has <strong className="text-text">1,000+ followers</strong>, you must have the following in your bio to qualify for payment:</p>
              <pre className="mt-1.5 rounded-lg bg-surface-raised px-3 py-2 text-xs text-text-muted font-sans whitespace-pre-line">{`#1 App to Ascend\nDownload here👇\nhttps://beacons.ai/ascendus`}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
