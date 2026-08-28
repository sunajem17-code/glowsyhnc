'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function CustomMilestonesPanel({ creatorId, onClose }) {
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
    <div className="mt-3 rounded-xl border border-gold/20 bg-gold/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">Custom Milestones</p>
        <button onClick={onClose} className="text-text-muted/50 hover:text-text text-xs">✕ Close</button>
      </div>
      {loading ? <p className="text-xs text-text-muted">Loading…</p> : (
        <>
          {milestones.length === 0 && (
            <p className="text-xs text-text-muted/60">None set — creator uses standard/VIP tier.</p>
          )}
          {milestones.map(m => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-sm">
              <span className="text-text-muted">
                {m.views_threshold >= 1_000_000
                  ? `${m.views_threshold / 1_000_000}M`
                  : `${(m.views_threshold / 1_000).toFixed(0)}K`} views
              </span>
              <span className="font-semibold text-gold">${Number(m.payout_amount).toFixed(2)}</span>
              <button onClick={() => remove(m.id)} className="text-text-muted/40 hover:text-danger transition-colors ml-4 text-xs">Remove</button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              type="number"
              placeholder="Views (e.g. 500000)"
              value={views}
              onChange={e => setViews(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:border-gold/50 focus:outline-none"
            />
            <input
              type="number"
              placeholder="$ payout"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-24 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:border-gold/50 focus:outline-none"
            />
            <button
              onClick={add}
              disabled={saving || !views || !amount}
              className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function CreatorRow({ creator, onSaved }) {
  const [role, setRole] = useState(creator.role)
  const [tier, setTier] = useState(creator.tier)
  const [usPct, setUsPct] = useState(creator.us_audience_pct ?? '')
  const [t1Pct, setT1Pct] = useState(creator.t1_audience_pct ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showMilestones, setShowMilestones] = useState(false)

  const dirty =
    role !== creator.role ||
    tier !== creator.tier ||
    Number(usPct || 0) !== Number(creator.us_audience_pct ?? 0) ||
    Number(t1Pct || 0) !== Number(creator.t1_audience_pct ?? 0)

  async function save() {
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('creators')
      .update({
        role,
        tier,
        us_audience_pct: usPct === '' ? null : Number(usPct),
        t1_audience_pct: t1Pct === '' ? null : Number(t1Pct),
      })
      .eq('id', creator.id)
    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    onSaved()
  }

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-4 py-3 text-text">{creator.discord_handle}</td>
        <td className="px-4 py-3">
          <select value={role} onChange={e => setRole(e.target.value)}
            className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none">
            <option value="creator">creator</option>
            <option value="admin">admin</option>
          </select>
        </td>
        <td className="px-4 py-3">
          <select value={tier} onChange={e => setTier(e.target.value)}
            className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none">
            <option value="standard">standard</option>
            <option value="vip">vip</option>
            <option value="custom">custom</option>
          </select>
        </td>
        <td className="px-4 py-3">
          <input type="number" min="0" max="100" step="0.1" value={usPct} onChange={e => setUsPct(e.target.value)}
            placeholder="—" className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none" />
        </td>
        <td className="px-4 py-3">
          <input type="number" min="0" max="100" step="0.1" value={t1Pct} onChange={e => setT1Pct(e.target.value)}
            placeholder="—" className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none" />
        </td>
        <td className="px-4 py-3 text-xs text-text-muted">
          {creator.tiktok_handle && <div>TT: @{creator.tiktok_handle.replace(/^@/, '')} {creator.tiktok_verified ? '✓' : ''}</div>}
          {creator.instagram_handle && <div>IG: @{creator.instagram_handle.replace(/^@/, '')} {creator.instagram_verified ? '✓' : ''}</div>}
          {!creator.tiktok_handle && !creator.instagram_handle && '—'}
        </td>
        <td className="px-4 py-3 text-xs text-text-muted">
          {creator.payment_method
            ? <><span className="capitalize">{creator.payment_method}</span>{creator.payment_details && <div className="text-gold truncate max-w-[120px]">{creator.payment_details}</div>}</>
            : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {dirty && (
              <button onClick={save} disabled={saving}
                className="rounded-md bg-gold px-2.5 py-1 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50">
                {saving ? '…' : 'Save'}
              </button>
            )}
            <button
              onClick={() => setShowMilestones(v => !v)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${showMilestones ? 'border-gold/40 text-gold' : 'border-border text-text-muted hover:border-gold/40 hover:text-gold'}`}
            >
              $ Custom
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </td>
      </tr>
      {/* Custom milestones panel — spans full row */}
      {showMilestones && (
        <tr>
          <td colSpan={8} className="px-4 pb-4">
            <CustomMilestonesPanel creatorId={creator.id} onClose={() => setShowMilestones(false)} />
          </td>
        </tr>
      )}
    </>
  )
}

export function AdminCreators() {
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  function load() {
    supabase
      .from('creators')
      .select('*')
      .order('discord_handle', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setCreators(data ?? [])
        setLoading(false)
      })
  }

  useEffect(load, [])

  const filtered = search.trim()
    ? creators.filter(c => c.discord_handle?.toLowerCase().includes(search.toLowerCase()))
    : creators

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text">Creators</h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage tiers, audience %, and custom payment milestones per creator.
          </p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-gold/50 focus:outline-none w-48"
        />
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Discord</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Tier</th>
                <th className="px-4 py-2.5 font-medium">US %</th>
                <th className="px-4 py-2.5 font-medium">T1 %</th>
                <th className="px-4 py-2.5 font-medium">Accounts</th>
                <th className="px-4 py-2.5 font-medium">Payment</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <CreatorRow key={c.id} creator={c} onSaved={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
