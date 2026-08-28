'use client'
import { useState, useTransition, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ScreenshotModal } from './ScreenshotModal'
import { TierSelect } from './TierSelect'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function FilterBar({ current }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function setFilter(key, value) {
    const params = new URLSearchParams(searchParams)
    params.set(key, value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex flex-wrap gap-3">
      {[
        { key: 'platform', label: 'Platform', options: ['all', 'tiktok', 'instagram'] },
        { key: 'status',   label: 'Status',   options: ['all', 'pending', 'approved', 'rejected', 'paid'] },
        { key: 'linkStatus', label: 'Link',   options: ['all', 'verified', 'missing'] },
      ].map(({ key, label, options }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{label}</span>
          <select
            value={current[key]}
            onChange={(e) => setFilter(key, e.target.value)}
            className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text"
          >
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Date</span>
        <input type="date" value={current.dateFrom ?? ''} onChange={(e) => setFilter('dateFrom', e.target.value)}
          className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
        <span className="text-xs text-text-muted">to</span>
        <input type="date" value={current.dateTo ?? ''} onChange={(e) => setFilter('dateTo', e.target.value)}
          className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text" />
      </div>
    </div>
  )
}

export function SubmissionsTable({ submissions: initial, currentFilters }) {
  const router = useRouter()
  const [screenshotUrl, setScreenshotUrl] = useState(null)

  const openScreenshot = useCallback(async (path) => {
    const { data } = await supabase.storage
      .from('proof-screenshots')
      .createSignedUrl(path, 120)
    if (data?.signedUrl) setScreenshotUrl(data.signedUrl)
  }, [])

  return (
    <>
      <FilterBar current={currentFilters} />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-text-muted">
            <tr>
              {['Clipper', 'Platform', 'Post Date', 'Initial', 'Live Views', 'Net', 'Screenshot', 'Tier', 'Payout', 'Status', 'Link', 'Actions'].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {initial.map((sub) => {
              const net = (sub.current_views ?? 0) - (sub.initial_views ?? 0)
              return (
                <tr key={sub.id} className="bg-surface hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3 text-text-muted">{sub.creators?.discord_handle ?? sub.creator_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 capitalize">{sub.platform}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-text-muted">
                    {sub.posted_at ? new Date(sub.posted_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">{(sub.initial_views ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{(sub.current_views ?? 0).toLocaleString()}</td>
                  <td className={`px-4 py-3 ${net > 0 ? 'text-gold' : 'text-text-muted'}`}>
                    {net >= 0 ? '+' : ''}{net.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {sub.proof_screenshot_url ? (
                      <button
                        onClick={() => openScreenshot(sub.proof_screenshot_url)}
                        className="text-gold hover:underline"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TierSelect submission={sub} onUpdated={() => router.refresh()} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {sub.payout_amount > 0 ? `$${Number(sub.payout_amount).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      sub.status === 'approved' ? 'bg-gold/10 text-gold' :
                      sub.status === 'rejected' ? 'bg-danger/10 text-danger' :
                      sub.status === 'paid'     ? 'bg-green-900/30 text-green-400' :
                      'bg-surface-raised text-text-muted'
                    }`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sub.has_agency_link ? (
                      <span className="text-xs text-gold">✓ Verified</span>
                    ) : (
                      <span className="text-xs text-danger">✗ Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={sub.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold hover:underline"
                    >
                      Open ↗
                    </a>
                  </td>
                </tr>
              )
            })}
            {initial.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-text-muted">
                  No submissions match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ScreenshotModal url={screenshotUrl} onClose={() => setScreenshotUrl(null)} />
    </>
  )
}
