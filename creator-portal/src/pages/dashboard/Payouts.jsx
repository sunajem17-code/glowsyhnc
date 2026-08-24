import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

function monthLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function Payouts() {
  const [paid, setPaid] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    supabase
      .from('submissions')
      .select('*, briefs(title)')
      .eq('status', 'paid')
      .order('updated_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) setError(fetchError.message)
        else setPaid(data)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const currentMonthTotal = useMemo(() => {
    const now = new Date()
    return paid
      .filter((s) => {
        const d = new Date(s.updated_at)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, s) => sum + Number(s.payout_amount), 0)
  }, [paid])

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>
  if (error) return <p className="text-sm text-danger">{error}</p>

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text">Payouts</h1>

      <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
        <p className="text-sm text-text-muted">This month</p>
        <p className="mt-1 text-2xl font-semibold text-gold">${currentMonthTotal.toFixed(2)}</p>
      </div>

      {paid.length === 0 ? (
        <p className="text-sm text-text-muted">No payouts yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Brief</th>
                <th className="px-4 py-2.5 font-medium">Paid</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{s.briefs?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{monthLabel(s.updated_at)}</td>
                  <td className="px-4 py-3 text-gold">${Number(s.payout_amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
