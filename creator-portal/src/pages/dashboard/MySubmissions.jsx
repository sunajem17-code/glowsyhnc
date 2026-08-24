import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../../components/StatusBadge'

async function openProof(path) {
  const { data, error } = await supabase.storage
    .from('proof-screenshots')
    .createSignedUrl(path, 60)
  if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}

function ViewCountCell({ submission, onSaved }) {
  const [value, setValue] = useState(submission.view_count_claimed)
  const [saving, setSaving] = useState(false)
  const editable = submission.status === 'pending' || submission.status === 'approved'
  const dirty = Number(value) !== submission.view_count_claimed

  if (!editable) return <span>{submission.view_count_claimed.toLocaleString()}</span>

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('submissions')
      .update({ view_count_claimed: Number(value) })
      .eq('id', submission.id)
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none"
      />
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-gold px-2 py-1 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {saving ? '…' : 'Update'}
        </button>
      )}
    </div>
  )
}

export function MySubmissions() {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load() {
    supabase
      .from('submissions')
      .select('*, briefs(title)')
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setSubmissions(data)
        setLoading(false)
      })
  }

  useEffect(load, [])

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>
  if (error) return <p className="text-sm text-danger">{error}</p>
  if (submissions.length === 0) return <p className="text-sm text-text-muted">No submissions yet.</p>

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text">My Submissions</h1>
      <p className="text-sm text-text-muted">
        Update your view count as it grows — payouts are calculated cumulatively per milestone
        crossed.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface text-text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Brief</th>
              <th className="px-4 py-2.5 font-medium">Platform</th>
              <th className="px-4 py-2.5 font-medium">Views claimed</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Payout</th>
              <th className="px-4 py-2.5 font-medium">Proof</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text">{s.briefs?.title ?? '—'}</td>
                <td className="px-4 py-3 capitalize text-text-muted">{s.platform}</td>
                <td className="px-4 py-3 text-text-muted">
                  <ViewCountCell submission={s} onSaved={load} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {s.payout_amount > 0 ? `$${Number(s.payout_amount).toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {s.proof_screenshot_url ? (
                    <button
                      onClick={() => openProof(s.proof_screenshot_url)}
                      className="text-gold hover:underline"
                    >
                      View
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
