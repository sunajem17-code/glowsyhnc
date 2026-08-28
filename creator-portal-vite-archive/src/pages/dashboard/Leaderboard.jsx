import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

export function Leaderboard() {
  const { creator } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.rpc('get_leaderboard').then(({ data, error: rpcError }) => {
      if (rpcError) setError(rpcError.message)
      else setRows(data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">Leaderboard</h1>
        <p className="mt-1 text-sm text-text-muted">Ranked by total verified earnings</p>
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface text-text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Creator</th>
                <th className="px-4 py-2.5 font-medium">Tier</th>
                <th className="px-4 py-2.5 font-medium">Verified Earnings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.discord_handle}
                  className={`border-b border-border last:border-0 ${
                    row.discord_handle === creator?.discord_handle ? 'bg-gold/5' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-text-muted">{i + 1}</td>
                  <td className="px-4 py-3 text-text">{row.discord_handle}</td>
                  <td className="px-4 py-3 capitalize text-text-muted">{row.tier}</td>
                  <td className="px-4 py-3 font-medium text-gold">
                    ${Number(row.total_verified_earnings).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
