import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { getNextPayoutDate, formatPayoutDate } from '../../lib/payoutSchedule'

function monthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    })
  }
  return options
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function CountdownCard({ nextPayout }) {
  const [now, setNow] = useState(Date.now())
  const target = nextPayout ? new Date(`${nextPayout.payout_date}T00:00:00`) : null

  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [nextPayout])

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-6">
      {target ? (
        <>
          <p className="text-sm text-text-muted">
            Time until your next payout — {formatPayoutDate(nextPayout.payout_date)}
            {nextPayout.is_override && (
              <span className="ml-2 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                Schedule change
              </span>
            )}
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-wide text-gold">
            {formatCountdown(target.getTime() - now)}
          </p>
        </>
      ) : (
        <p className="text-sm text-text-muted">No upcoming payout dates scheduled.</p>
      )}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-text">{value}</p>
    </div>
  )
}

export function Dashboard() {
  const { creator } = useAuth()
  const [month, setMonth] = useState(monthOptions()[0].value)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ verified: 0, unverified: 0, posts: 0, views: 0 })
  const [nextPayout, setNextPayout] = useState(null)

  useEffect(() => {
    if (!creator) return
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      const [submissionsRes, milestonesRes, nextPayoutRes] = await Promise.allSettled([
        supabase.from('submissions').select('id, view_count_claimed').eq('creator_id', creator.id),
        supabase
          .from('milestones_hit')
          .select('amount, batch_date, submissions!inner(creator_id)')
          .eq('submissions.creator_id', creator.id),
        getNextPayoutDate(),
      ])

      if (!active) return

      if (submissionsRes.value?.error) {
        setError(submissionsRes.value.error.message)
        setLoading(false)
        return
      }
      if (milestonesRes.value?.error) {
        setError(milestonesRes.value.error.message)
        setLoading(false)
        return
      }
      if (nextPayoutRes.status === 'rejected') {
        setError(nextPayoutRes.reason?.message ?? 'Failed to load payout schedule')
        setLoading(false)
        return
      }

      const submissions = submissionsRes.value.data ?? []
      const milestones = milestonesRes.value.data ?? []

      const verified = milestones
        .filter((m) => m.batch_date)
        .reduce((sum, m) => sum + Number(m.amount), 0)
      const unverified = milestones
        .filter((m) => !m.batch_date)
        .reduce((sum, m) => sum + Number(m.amount), 0)
      const posts = submissions.length
      const views = submissions.reduce((sum, s) => sum + s.view_count_claimed, 0)

      setStats({ verified, unverified, posts, views })
      setNextPayout(nextPayoutRes.value)
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [creator])

  const months = useMemo(monthOptions, [])
  const hasConnectedAccount = creator?.tiktok_connected || creator?.instagram_connected

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-text-muted">Track your performance and earnings</p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-gold/50 focus:outline-none"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <CountdownCard nextPayout={nextPayout} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Verified Earnings"
          value={loading ? '—' : `$${stats.verified.toFixed(2)}`}
        />
        <StatCard
          label="Unverified Earnings"
          value={loading ? '—' : `$${stats.unverified.toFixed(2)}`}
        />
        <StatCard label="Posts" value={loading ? '—' : stats.posts.toLocaleString()} />
        <StatCard label="Views" value={loading ? '—' : stats.views.toLocaleString()} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-semibold text-text">Your Active Accounts & Deals</h2>
        <p className="mt-1 text-sm text-text-muted">
          Each account earns based on the tier it was approved at
        </p>

        {!hasConnectedAccount ? (
          <p className="mt-4 text-sm text-text-muted">
            No verified accounts yet. Connect and verify an account in Settings to start earning.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {creator.tiktok_connected && (
              <AccountRow platform="TikTok" handle={creator.tiktok_handle} creator={creator} />
            )}
            {creator.instagram_connected && (
              <AccountRow
                platform="Instagram"
                handle={creator.instagram_handle}
                creator={creator}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AccountRow({ platform, handle, creator }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-bg px-4 py-3">
      <div>
        <p className="text-sm font-medium text-text">
          {platform} · {handle}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {creator.us_audience_pct ?? '—'}% US · {creator.t1_audience_pct ?? '—'}% T1
        </p>
      </div>
      <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-medium capitalize text-gold">
        {creator.tier}
      </span>
    </div>
  )
}
