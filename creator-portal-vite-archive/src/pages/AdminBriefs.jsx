import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = {
  id: null,
  title: '',
  description: '',
  min_view_threshold: 0,
  active: true,
  standard: [{ min_views: '', amount: '' }],
  vip: [{ min_views: '', amount: '' }],
}

function briefToForm(brief) {
  const toRows = (arr) =>
    Array.isArray(arr) && arr.length > 0
      ? arr.map((m) => ({ min_views: m.min_views, amount: m.amount }))
      : [{ min_views: '', amount: '' }]

  return {
    id: brief.id,
    title: brief.title,
    description: brief.description ?? '',
    min_view_threshold: brief.min_view_threshold,
    active: brief.active,
    standard: toRows(brief.payout_structure?.milestones?.standard),
    vip: toRows(brief.payout_structure?.milestones?.vip),
  }
}

function rowsToMilestones(rows) {
  return rows
    .filter((r) => r.min_views !== '' && r.amount !== '')
    .map((r) => ({ min_views: Number(r.min_views), amount: Number(r.amount) }))
    .sort((a, b) => a.min_views - b.min_views)
}

function MilestoneEditor({ label, rows, onChange }) {
  function updateRow(i, field, value) {
    const next = rows.slice()
    next[i] = { ...next[i], [field]: value }
    onChange(next)
  }
  function addRow() {
    onChange([...rows, { min_views: '', amount: '' }])
  }
  function removeRow(i) {
    onChange(rows.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <p className="text-xs font-medium text-text-muted">{label} milestones</p>
      <div className="mt-1.5 space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="min views"
              value={row.min_views}
              onChange={(e) => updateRow(i, 'min_views', e.target.value)}
              className="w-32 rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none"
            />
            <span className="text-text-muted">→ $</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="amount"
              value={row.amount}
              onChange={(e) => updateRow(i, 'amount', e.target.value)}
              className="w-24 rounded-md border border-border bg-bg px-2 py-1 text-sm text-text focus:border-gold/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-xs text-text-muted hover:text-danger"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-1.5 text-xs text-gold hover:underline"
      >
        + Add milestone
      </button>
    </div>
  )
}

function BriefForm({ form, setForm, onSaved, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payout_structure = {
      milestones: {
        standard: rowsToMilestones(form.standard),
        vip: rowsToMilestones(form.vip),
      },
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      min_view_threshold: Number(form.min_view_threshold) || 0,
      active: form.active,
      payout_structure,
    }

    const { error: saveError } = form.id
      ? await supabase.from('briefs').update(payload).eq('id', form.id)
      : await supabase.from('briefs').insert(payload)

    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <label className="block text-xs font-medium text-text-muted">Title</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-gold/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-muted">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-gold/50 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-6">
        <div>
          <label className="block text-xs font-medium text-text-muted">Min view threshold</label>
          <input
            type="number"
            min="0"
            value={form.min_view_threshold}
            onChange={(e) => setForm({ ...form, min_view_threshold: e.target.value })}
            className="mt-1 w-36 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-gold/50 focus:outline-none"
          />
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Active
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MilestoneEditor
          label="Standard"
          rows={form.standard}
          onChange={(rows) => setForm({ ...form, standard: rows })}
        />
        <MilestoneEditor
          label="VIP"
          rows={form.vip}
          onChange={(rows) => setForm({ ...form, vip: rows })}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create brief'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export function AdminBriefs() {
  const [briefs, setBriefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)

  function load() {
    supabase
      .from('briefs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message)
        else setBriefs(data)
        setLoading(false)
      })
  }

  useEffect(load, [])

  function handleSaved() {
    setForm(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Briefs</h1>
          <p className="mt-1 text-sm text-text-muted">
            Milestone amounts are cumulative per tier — see the Payout calculation section in the
            README for the exact model.
          </p>
        </div>
        {!form && (
          <button
            onClick={() => setForm(EMPTY_FORM)}
            className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90"
          >
            + New brief
          </button>
        )}
      </div>

      {form && (
        <BriefForm form={form} setForm={setForm} onSaved={handleSaved} onCancel={() => setForm(null)} />
      )}

      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="space-y-3">
        {briefs.map((brief) => (
          <div
            key={brief.id}
            className="flex items-start justify-between rounded-xl border border-border bg-surface p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-text">{brief.title}</p>
                {!brief.active && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                    inactive
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-text-muted">{brief.description}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Min views: {brief.min_view_threshold.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => setForm(briefToForm(brief))}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:text-gold"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
