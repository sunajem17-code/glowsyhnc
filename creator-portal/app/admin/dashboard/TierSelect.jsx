'use client'
import { useState } from 'react'
import { supabase } from '../../../src/lib/supabase'

const TIERS = ['vip', 'standard', 'disqualified']

export function TierSelect({ submission, onUpdated }) {
  const [tier, setTier] = useState(submission.submission_tier ?? '')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [aiResult, setAiResult] = useState(null)

  async function runAiCheck() {
    setAiLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAiResult(data)
      setTier(data.tier)
    } catch (e) {
      setError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function callAction(action, extra = {}) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/submission-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission.id, action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onUpdated()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function saveTier() {
    // payout_amount is computed server-side from payout_tiers -- not sent here.
    callAction('save_tier', { submission_tier: tier || null })
  }

  function approve() { callAction('approve') }
  function reject()  { callAction('reject') }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text"
        >
          <option value="">— not reviewed —</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {submission.proof_screenshot_url && (
          <button
            onClick={runAiCheck}
            disabled={aiLoading}
            className="rounded bg-gold/10 px-2 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
          >
            {aiLoading ? 'Analysing…' : 'AI Check'}
          </button>
        )}

        <button
          onClick={saveTier}
          disabled={saving || !tier}
          className="rounded bg-surface-raised px-2 py-1 text-xs text-text hover:bg-border disabled:opacity-50"
        >
          Save
        </button>
      </div>

      {aiResult && (
        <p className="text-xs text-text-muted">
          US: {aiResult.us_pct}% → {aiResult.tier} → ${aiResult.payout_amount?.toFixed(2)}
        </p>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={approve}
          disabled={saving}
          className="rounded bg-gold/10 px-2 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={reject}
          disabled={saving}
          className="rounded bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20 disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
