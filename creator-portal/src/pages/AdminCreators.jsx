import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function CreatorRow({ creator, onSaved }) {
  const [role, setRole] = useState(creator.role)
  const [tier, setTier] = useState(creator.tier)
  const [usPct, setUsPct] = useState(creator.us_audience_pct ?? '')
  const [t1Pct, setT1Pct] = useState(creator.t1_audience_pct ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

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
    if (updateError) {
      setError(updateError.message)
      return
    }
    onSaved()
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 text-text">{creator.discord_handle}</td>
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none"
        >
          <option value="creator">creator</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none"
        >
          <option value="standard">standard</option>
          <option value="vip">vip</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={usPct}
          onChange={(e) => setUsPct(e.target.value)}
          placeholder="—"
          className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={t1Pct}
          onChange={(e) => setT1Pct(e.target.value)}
          placeholder="—"
          className="w-20 rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none"
        />
      </td>
      <td className="px-4 py-3 text-xs text-text-muted">
        {creator.tiktok_connected && <span className="mr-2">TikTok: {creator.tiktok_handle}</span>}
        {creator.instagram_connected && <span>IG: {creator.instagram_handle}</span>}
        {!creator.tiktok_connected && !creator.instagram_connected && '—'}
      </td>
      <td className="px-4 py-3">
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-gold px-2.5 py-1 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '…' : 'Save'}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  )
}

export function AdminCreators() {
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load() {
    supabase
      .from('creators')
      .select('*')
      .order('discord_handle', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setCreators(data)
        setLoading(false)
      })
  }

  useEffect(load, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Creators</h1>
        <p className="mt-1 text-sm text-text-muted">
          Tier and audience % gate weekly payout eligibility (Standard: 10% US + 10% T1 · VIP:
          20% US + 20% T1).
        </p>
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
                <th className="px-4 py-2.5 font-medium">Platforms</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <CreatorRow key={c.id} creator={c} onSaved={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
