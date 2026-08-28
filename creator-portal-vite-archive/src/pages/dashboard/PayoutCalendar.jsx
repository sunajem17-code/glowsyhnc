import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatPayoutDate } from '../../lib/payoutSchedule'

export function PayoutCalendar() {
  const [dates, setDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('payout_dates')
      .select('*')
      .gte('payout_date', today)
      .order('payout_date', { ascending: true })
      .limit(12)
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setDates(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">Payout Calendar</h1>
        <p className="mt-1 text-sm text-text-muted">
          Upcoming payout dates — money moves on these dates only.
        </p>
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          {dates.map((d, i) => (
            <div
              key={d.id}
              className={`flex items-center justify-between rounded-xl border p-4 ${
                i === 0 ? 'border-gold/30 bg-gold/5' : 'border-border bg-surface'
              }`}
            >
              <div>
                <p className="font-medium text-text">{formatPayoutDate(d.payout_date)}</p>
                {d.note && <p className="mt-0.5 text-xs text-text-muted">{d.note}</p>}
              </div>
              <div className="flex items-center gap-2">
                {i === 0 && (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                    Next
                  </span>
                )}
                {d.is_override && (
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold">
                    Schedule change
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
