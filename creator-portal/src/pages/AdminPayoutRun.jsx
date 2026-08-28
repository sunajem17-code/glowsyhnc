import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getNextPayoutDate, formatPayoutDate } from '../lib/payoutSchedule'

function ThresholdLabel({ tier }) {
  return tier === 'vip' ? '20% US + 20% T1' : '10% US + 10% T1'
}

function CreatorRow({ row, onPaid }) {
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState(null)

  async function pay() {
    setPaying(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('mark_payout_batch_paid', {
      p_creator_id: row.creator_id,
    })
    setPaying(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onPaid()
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        row.eligible ? 'border-border bg-surface' : 'border-danger/30 bg-danger/5'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-text">{row.discord_handle}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {row.tier} tier · needs <ThresholdLabel tier={row.tier} /> · has{' '}
            {row.us_audience_pct ?? '—'}% US, {row.t1_audience_pct ?? '—'}% T1
          </p>
          <p className="mt-0.5 text-xs text-text-muted">{row.unpaid_milestones} unpaid milestone(s)</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gold">${Number(row.total_owed).toFixed(2)}</p>
          {row.eligible ? (
            <button
              disabled={paying}
              onClick={pay}
              className="mt-1.5 rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {paying ? 'Paying…' : 'Mark batch as paid'}
            </button>
          ) : (
            <p className="mt-1.5 text-xs font-medium text-danger">
              Below threshold — excluded
            </p>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}

export function AdminPayoutRun() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nextDate, setNextDate] = useState(null)

  function load() {
    setLoading(true)
    Promise.all([supabase.rpc('get_weekly_payout_run'), getNextPayoutDate()])
      .then(([runRes, next]) => {
        if (runRes.error) setError(runRes.error.message)
        else setRows(runRes.data ?? [])
        setNextDate(next)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const eligible = rows.filter((r) => r.eligible)
  const flagged = rows.filter((r) => !r.eligible)
  const totalDue = eligible.reduce((sum, r) => sum + Number(r.total_owed), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">Payout Run</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every creator with unpaid milestones, summed across all their videos. Paying a creator
          marks every unpaid milestone in their ledger with today's batch date.
        </p>
        {nextDate && (
          <p className="mt-2 text-sm text-text">
            Next scheduled payout:{' '}
            <span className="font-medium text-gold">{formatPayoutDate(nextDate.payout_date)}</span>
            {nextDate.is_override && (
              <span className="ml-2 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                Schedule change
              </span>
            )}
          </p>
        )}
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-text-muted">Nothing owed right now.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
          <p className="text-sm text-text-muted">Ready to pay this run</p>
          <p className="mt-1 text-2xl font-semibold text-gold">${totalDue.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {eligible.length} creator(s) eligible
            {flagged.length > 0 && ` · ${flagged.length} flagged and excluded`}
          </p>
        </div>
      )}

      {eligible.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text">Ready to pay</h2>
          {eligible.map((row) => (
            <CreatorRow key={row.creator_id} row={row} onPaid={load} />
          ))}
        </div>
      )}

      {flagged.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-danger">
            Flagged — audience mix below tier threshold, not paid
          </h2>
          {flagged.map((row) => (
            <CreatorRow key={row.creator_id} row={row} onPaid={load} />
          ))}
        </div>
      )}
    </div>
  )
}
