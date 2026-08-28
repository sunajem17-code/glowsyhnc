'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toYMD(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function PayoutCalendar() {
  const today = new Date()
  // Skip August — start at September if we're still in August
  const initMonth = today.getMonth() === 7 ? 8 : today.getMonth()
  const initYear = today.getMonth() === 7 && initMonth === 8 ? today.getFullYear() : today.getFullYear()

  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth) // 0-indexed
  const [payoutDays, setPayoutDays] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10)
    const end = new Date(year, month + 2, 0).toISOString().slice(0, 10)
    setLoading(true)
    supabase
      .from('payout_dates')
      .select('payout_date')
      .gte('payout_date', start)
      .lte('payout_date', end)
      .then(({ data }) => {
        setPayoutDays(new Set((data ?? []).map(d => d.payout_date)))
        setLoading(false)
      })
  }, [year, month])

  function prevMonth() {
    // Don't go back to August or earlier
    const newMonth = month === 0 ? 11 : month - 1
    const newYear = month === 0 ? year - 1 : year
    if (newYear === today.getFullYear() && newMonth <= 7) return // block Aug and before
    setMonth(newMonth); if (month === 0) setYear(y => y - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells = []

  // Leading overflow from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, current: false, overflow: 'prev' })
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, overflow: null })
  }
  // Trailing overflow — fill only to complete the current row (no extra rows)
  const remainder = cells.length % 7
  if (remainder !== 0) {
    let nextDay = 1
    while (cells.length % 7 !== 0) {
      cells.push({ day: nextDay++, current: false, overflow: 'next' })
    }
  }

  const todayYMD = toYMD(today.getFullYear(), today.getMonth(), today.getDate())
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="max-w-lg space-y-5 animate-fadein">
      <div>
        <h1 className="text-xl font-semibold text-text">Payout Calendar</h1>
      </div>

      <div className="rounded-lg border border-gold/20 bg-gold/5 px-4 py-3">
        <p className="text-xs text-text-muted leading-relaxed">
          <span className="font-semibold text-gold">Note:</span> Videos posted on payout days will be counted in the next payout cycle. Post on non-payout days for the fastest turnaround.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 hover:text-gold transition-colors active:scale-95"
          >
            ← Prev
          </button>
          <span className="font-semibold text-text">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 hover:text-gold transition-colors active:scale-95"
          >
            Next →
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px">
          {DAYS.map(d => (
            <div key={d} className="py-1 text-center text-[11px] font-medium text-text-muted/50 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="h-52 flex items-center justify-center text-sm text-text-muted">Loading…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell.current) {
                return (
                  <div key={`overflow-${i}`} className="flex items-center justify-center rounded-lg py-2 min-h-[44px]">
                    <span className="text-xs text-text-muted/20">{cell.day}</span>
                  </div>
                )
              }

              const ymd = toYMD(year, month, cell.day)
              const isPayout = payoutDays.has(ymd)
              const isToday = ymd === todayYMD
              const isPast = ymd < todayYMD

              return (
                <div
                  key={ymd}
                  className={`
                    flex flex-col items-center justify-center rounded-lg py-2 min-h-[44px] transition-all duration-150
                    ${isPayout ? 'border border-gold/50 bg-gold/10' : ''}
                    ${isToday && !isPayout ? 'border border-border bg-surface-raised' : ''}
                    ${isPast ? 'opacity-35' : ''}
                  `}
                >
                  <span className={`text-sm font-semibold leading-none ${isPayout ? 'text-gold' : isToday ? 'text-text' : 'text-text-muted'}`}>
                    {cell.day}
                  </span>
                  {isPayout ? (
                    <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-gold/80">Payout</span>
                  ) : !isPast ? (
                    <span className="mt-1 text-[8px] font-semibold uppercase tracking-wider text-text-muted/40">Post</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-5 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border border-gold/50 bg-gold/10" />
            <span className="text-xs text-text-muted">Payout day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted/40">Post</span>
            <span className="text-xs text-text-muted">= best day to submit</span>
          </div>
        </div>
      </div>
    </div>
  )
}
