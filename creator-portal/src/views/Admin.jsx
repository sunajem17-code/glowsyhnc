'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatusBadge } from '../components/StatusBadge'

const PAYMENT_LABEL = { paypal: 'PayPal', crypto: 'Crypto', wise: 'Wise' }

async function openProof(path) {
  const { data, error } = await supabase.storage.from('proof-screenshots').createSignedUrl(path, 60)
  if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}

function thumbSrc(url) {
  if (!url) return null
  return `/api/thumbnail?url=${encodeURIComponent(url)}`
}

// ─── Custom Milestones Editor ──────────────────────────────────────────────
function CustomMilestones({ creatorId }) {
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [views, setViews] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('custom_milestones')
      .select('*')
      .eq('creator_id', creatorId)
      .order('views_threshold', { ascending: true })
    setMilestones(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [creatorId])

  async function add() {
    if (!views || !amount) return
    setSaving(true)
    await supabase.from('custom_milestones').insert({
      creator_id: creatorId,
      views_threshold: Number(views),
      payout_amount: Number(amount),
    })
    setViews(''); setAmount('')
    await load()
    setSaving(false)
  }

  async function remove(id) {
    await supabase.from('custom_milestones').delete().eq('id', id)
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Custom Milestones</p>
      {loading ? <p className="text-xs text-text-muted">Loading…</p> : (
        <>
          {milestones.length === 0 && <p className="text-xs text-text-muted/50">No custom milestones — using standard/VIP rates.</p>}
          {milestones.map(m => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-1.5 text-xs">
              <span className="text-text-muted">
                {m.views_threshold >= 1_000_000
                  ? `${m.views_threshold / 1_000_000}M`
                  : `${(m.views_threshold / 1_000).toFixed(0)}K`} views
              </span>
              <span className="font-semibold text-gold">${Number(m.payout_amount).toFixed(2)}</span>
              <button onClick={() => remove(m.id)} className="text-text-muted/40 hover:text-danger transition-colors ml-3">✕</button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input type="number" placeholder="Views (e.g. 500000)" value={views} onChange={e => setViews(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:border-gold/50 focus:outline-none" />
            <input type="number" placeholder="$ amount" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-24 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:border-gold/50 focus:outline-none" />
            <button onClick={add} disabled={saving || !views || !amount}
              className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-40">
              Add
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Submission Card ──────────────────────────────────────────────────────
function SubmissionCard({ submission, onUpdated }) {
  const [viewCount, setViewCount] = useState(submission.current_views ?? 0)
  const [notes, setNotes] = useState(submission.admin_notes ?? '')
  const [tier, setTier] = useState(submission.tier ?? 'standard')
  const [payout, setPayout] = useState(submission.payout_amount ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const creator = submission.creators ?? {}
  const isPending = submission.status === 'pending'

  async function review(status) {
    setBusy(true); setError(null)
    const { error: err } = await supabase
      .from('submissions')
      .update({
        status,
        tier,
        admin_notes: notes.trim() || null,
        current_views: Number(viewCount),
        view_count_claimed: Number(viewCount),
        payout_amount: status === 'approved' ? Number(payout) : submission.payout_amount,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id)
    setBusy(false)
    if (err) { setError(err.message); return }
    onUpdated()
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Thumbnail strip */}
      {submission.thumbnail_url && (
        <div className="h-20 w-full bg-surface-raised overflow-hidden">
          <img src={thumbSrc(submission.thumbnail_url)} alt="" className="w-full h-full object-cover opacity-70"
            onError={e => { e.currentTarget.style.display = 'none' }} />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-text text-sm">{creator.discord_handle ?? '—'}</p>
            <a href={submission.video_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gold hover:underline break-all line-clamp-1">
              {submission.video_url?.replace(/^https?:\/\/(www\.)?/, '')}
            </a>
            <p className="text-xs text-text-muted/50 mt-0.5 capitalize">{submission.platform} · {new Date(submission.created_at).toLocaleDateString()}</p>
          </div>
          <StatusBadge status={submission.status} />
        </div>

        {/* Tier + analytics */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-[10px] text-text-muted/60 uppercase tracking-wide mb-0.5">Tier</p>
            <select value={tier} onChange={e => setTier(e.target.value)}
              className="rounded-lg border border-border bg-bg px-2 py-1 text-xs text-gold font-semibold focus:outline-none cursor-pointer">
              <option value="standard">Standard</option>
              <option value="vip">VIP</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {submission.proof_screenshot_url && (
            <button onClick={() => openProof(submission.proof_screenshot_url)}
              className="text-xs text-gold hover:underline mt-3.5">📊 View analytics ↗</button>
          )}
        </div>

        {/* Custom milestones when custom tier selected */}
        {tier === 'custom' && (
          <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
            <CustomMilestones creatorId={creator.id} />
          </div>
        )}

        {/* Payment info */}
        {(creator.payment_method || creator.payment_details) && (
          <div className="rounded-lg border border-border bg-bg px-3 py-2">
            <p className="text-[10px] text-text-muted/60 uppercase tracking-wide">Pay to</p>
            <p className="text-xs text-text mt-0.5">
              {PAYMENT_LABEL[creator.payment_method] ?? creator.payment_method}
              {creator.payment_details && <span className="ml-2 text-gold">{creator.payment_details}</span>}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-text-muted mb-1">View count</label>
              <input type="number" min="0" value={viewCount} onChange={e => setViewCount(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:border-gold/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-1">Payout amount ($)</label>
              <input type="number" min="0" step="0.01" value={payout} onChange={e => setPayout(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:border-gold/50 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-text-muted mb-1">Note to creator (shown on rejection or approval)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional message to creator…"
              className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:border-gold/50 focus:outline-none" />
          </div>

          <div className="flex gap-2">
            {isPending ? (
              <>
                <button disabled={busy} onClick={() => review('approved')}
                  className="flex-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50">
                  ✓ Approve
                </button>
                <button disabled={busy} onClick={() => review('rejected')}
                  className="flex-1 rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50">
                  ✗ Reject
                </button>
              </>
            ) : (
              <>
                <button disabled={busy} onClick={() => review('approved')}
                  className="flex-1 rounded-lg bg-gold/20 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/30 disabled:opacity-50">
                  Re-approve
                </button>
                <button disabled={busy} onClick={() => review('rejected')}
                  className="flex-1 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger/70 hover:bg-danger/10 disabled:opacity-50">
                  Reject
                </button>
              </>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────
function SummaryBar({ all }) {
  const pending = all.filter(s => s.status === 'pending').length
  const approved = all.filter(s => s.status === 'approved').length
  const totalPayout = all.filter(s => s.status === 'approved').reduce((sum, s) => sum + Number(s.payout_amount ?? 0), 0)
  const withScreenshot = all.filter(s => s.proof_screenshot_url).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Pending', value: pending },
        { label: 'Approved', value: approved },
        { label: 'Total paid out', value: `$${totalPayout.toFixed(2)}` },
        { label: 'With analytics', value: `${withScreenshot}/${all.length}` },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-text-muted">{label}</p>
          <p className="text-lg font-semibold text-text mt-0.5">{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main Admin view ─────────────────────────────────────────────────────
const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export function Admin() {
  const [tab, setTab] = useState('pending')
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  function load() {
    setLoading(true)
    supabase
      .from('submissions')
      .select('*, creators(id, discord_handle, tier, tiktok_handle, instagram_handle, payment_method, payment_details)')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setAll(data ?? [])
        setLoading(false)
      })
  }

  useEffect(load, [])

  const filtered = (search.trim()
    ? all.filter(s =>
        s.creators?.discord_handle?.toLowerCase().includes(search.toLowerCase()) ||
        s.video_url?.toLowerCase().includes(search.toLowerCase())
      )
    : all
  ).filter(s => s.status === tab)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Review Queue</h1>
          <p className="text-sm text-text-muted mt-0.5">Approve or reject submissions, set tier and payout amount.</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search creator or URL…"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-gold/50 focus:outline-none w-52"
        />
      </div>

      {!loading && <SummaryBar all={all} />}

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => {
          const count = all.filter(s => s.status === t.key).length
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-gold/10 text-gold' : 'text-text-muted hover:text-text'}`}>
              {t.label}
              {count > 0 && <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === t.key ? 'bg-gold/20 text-gold' : 'bg-border text-text-muted'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-text-muted">Nothing here.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(s => <SubmissionCard key={s.id} submission={s} onUpdated={load} />)}
      </div>
    </div>
  )
}
