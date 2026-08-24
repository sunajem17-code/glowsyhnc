import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { describeMilestones } from '../lib/payout'
import { StatusBadge } from '../components/StatusBadge'

async function openProof(path) {
  const { data, error } = await supabase.storage
    .from('proof-screenshots')
    .createSignedUrl(path, 60)
  if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}

function SubmissionCard({ submission, onUpdated }) {
  const [viewCount, setViewCount] = useState(submission.view_count_claimed)
  const [notes, setNotes] = useState(submission.admin_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function review(status) {
    setBusy(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('admin_review_submission', {
      p_submission_id: submission.id,
      p_status: status,
      p_admin_notes: notes.trim() || null,
      p_view_count_claimed:
        Number(viewCount) !== submission.view_count_claimed ? Number(viewCount) : null,
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onUpdated()
  }

  const hitMilestones = submission.milestones_hit ?? []
  const unpaidCount = hitMilestones.filter((m) => !m.batch_date).length
  const tier = submission.creators?.tier ?? 'standard'

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-text">{submission.briefs?.title}</p>
          <p className="mt-0.5 text-sm text-text-muted">
            {submission.creators?.discord_handle} · {tier} tier · {submission.platform}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {tier} milestones: {describeMilestones(submission.briefs?.payout_structure, tier)}
          </p>
          <a
            href={submission.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-sm text-gold hover:underline"
          >
            Open video ↗
          </a>
          {submission.proof_screenshot_url && (
            <button
              onClick={() => openProof(submission.proof_screenshot_url)}
              className="ml-4 text-sm text-gold hover:underline"
            >
              View proof
            </button>
          )}
          {hitMilestones.length > 0 && (
            <p className="mt-2 text-xs text-text-muted">
              Milestones hit:{' '}
              {hitMilestones
                .slice()
                .sort((a, b) => a.min_views - b.min_views)
                .map((m) => `${m.min_views.toLocaleString()} ($${m.amount})${m.batch_date ? '' : ' — unpaid'}`)
                .join(', ')}
            </p>
          )}
        </div>
        <div className="text-right">
          <StatusBadge status={submission.status} />
          <p className="mt-1.5 text-sm font-semibold text-gold">
            ${Number(submission.payout_amount).toFixed(2)}
          </p>
          {unpaidCount > 0 && (
            <p className="mt-0.5 text-xs text-text-muted">{unpaidCount} unpaid milestone(s)</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted">Current view count</label>
          <input
            type="number"
            min="0"
            value={viewCount}
            onChange={(e) => setViewCount(e.target.value)}
            className="mt-1 w-36 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text focus:border-gold/50 focus:outline-none"
          />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-text-muted">Admin notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text focus:border-gold/50 focus:outline-none"
          />
        </div>

        {submission.status === 'pending' && (
          <>
            <button
              disabled={busy}
              onClick={() => review('approved')}
              className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => review('rejected')}
              className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}

        {(submission.status === 'approved' || submission.status === 'paid') && (
          <button
            disabled={busy}
            onClick={() => review(submission.status)}
            className="rounded-lg border border-gold/40 px-3 py-1.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
          >
            Recompute (view growth)
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active — tracking growth' },
]

export function Admin() {
  const [tab, setTab] = useState('pending')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load() {
    setLoading(true)
    let query = supabase
      .from('submissions')
      .select(
        '*, briefs(title, payout_structure, min_view_threshold), creators(discord_handle, tier), milestones_hit(min_views, amount, batch_date)',
      )
      .order('created_at', { ascending: true })

    query = tab === 'pending' ? query.eq('status', 'pending') : query.in('status', ['approved', 'paid'])

    query.then(({ data, error: fetchError }) => {
      if (fetchError) setError(fetchError.message)
      else setSubmissions(data)
      setLoading(false)
    })
  }

  useEffect(load, [tab])

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text">Submission Review</h1>
      <p className="text-sm text-text-muted">
        Actual payment happens on the Payout Run page (weekly, per creator) — Recompute here just
        catches newly-crossed milestones as a video's views grow.
      </p>

      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-gold/10 text-gold' : 'text-text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && submissions.length === 0 && (
        <p className="text-sm text-text-muted">Nothing here.</p>
      )}
      <div className="space-y-4">
        {submissions.map((s) => (
          <SubmissionCard key={s.id} submission={s} onUpdated={load} />
        ))}
      </div>
    </div>
  )
}
