import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { describeMilestones } from '../../lib/payout'

export function ActiveBriefs() {
  const { creator } = useAuth()
  const [briefs, setBriefs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    supabase
      .from('briefs')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) setError(fetchError.message)
        else setBriefs(data)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) return <p className="text-sm text-text-muted">Loading briefs…</p>
  if (error) return <p className="text-sm text-danger">{error}</p>
  if (briefs.length === 0) return <p className="text-sm text-text-muted">No active briefs right now.</p>

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text">Active Briefs</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {briefs.map((brief) => (
          <div key={brief.id} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-semibold text-text">{brief.title}</h2>
            <p className="mt-1.5 text-sm text-text-muted">{brief.description}</p>
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-text-muted">
                Min views: <span className="text-text">{brief.min_view_threshold.toLocaleString()}</span>
              </p>
              <p className="text-text-muted">
                Payout ({creator?.tier ?? 'standard'} tier):{' '}
                <span className="text-gold">
                  {describeMilestones(brief.payout_structure, creator?.tier)}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
