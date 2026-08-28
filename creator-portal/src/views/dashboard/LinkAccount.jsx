'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

function extractHandle(url, platform) {
  try {
    const clean = url.trim().replace(/\/+$/, '')
    if (platform === 'tiktok') {
      const m = clean.match(/tiktok\.com\/@([^/?#]+)/)
      return m ? m[1] : null
    } else {
      const m = clean.match(/instagram\.com\/([^/?#]+)/)
      return m ? m[1] : null
    }
  } catch {
    return null
  }
}

function TikTokIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.26 8.26 0 004.84 1.56V6.85a4.85 4.85 0 01-1.07-.16z"/>
    </svg>
  )
}

function InstagramIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

function AddAccountForm({ platform, verificationCode, onAdded }) {
  const label = platform === 'tiktok' ? 'TikTok' : 'Instagram'
  const placeholder = platform === 'tiktok'
    ? 'https://www.tiktok.com/@yourhandle'
    : 'https://www.instagram.com/yourhandle'

  const [profileUrl, setProfileUrl] = useState('')
  const [handle, setHandle] = useState(null)
  const [error, setError] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [done, setDone] = useState(false)

  function handleGetCode(e) {
    e.preventDefault()
    const h = extractHandle(profileUrl, platform)
    if (!h) {
      setError(`Paste your full ${label} profile URL — e.g. ${placeholder}`)
      return
    }
    setError(null)
    setHandle(h)
  }

  async function handleVerify(e) {
    e.preventDefault()
    setVerifying(true)
    setError(null)
    const res = await fetch('/api/verify-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, handle }),
    })
    const data = await res.json()
    setVerifying(false)
    if (res.ok) {
      setDone(true)
      setTimeout(() => onAdded(), 800)
    } else {
      setError(data.error ?? 'Verification failed — try again.')
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-4 text-center">
        <p className="text-sm font-semibold text-gold">✓ Account verified!</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        {platform === 'tiktok' ? <TikTokIcon /> : <InstagramIcon />}
        <h3 className="font-semibold text-text text-sm">Add {label} Account</h3>
      </div>

      {!handle ? (
        /* Step 1: enter URL */
        <form onSubmit={handleGetCode} className="space-y-3">
          <input
            type="url"
            value={profileUrl}
            onChange={e => setProfileUrl(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-gold/50 focus:outline-none"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
          >
            Get My Code
          </button>
        </form>
      ) : (
        /* Step 2: show code + verify */
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-4 space-y-2">
            <p className="text-xs font-semibold text-gold uppercase tracking-wide">Add this to your {label} bio</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-surface-raised px-4 py-2.5 text-xl font-mono font-bold text-text tracking-widest text-center">
                {verificationCode}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(verificationCode)}
                className="shrink-0 rounded-lg border border-border px-3 py-2.5 text-xs text-text-muted hover:border-gold/40 hover:text-gold transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setHandle(null); setError(null) }}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={verifying}
              className="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {verifying ? 'Checking…' : 'Verify'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function LinkAccount() {
  const { creator } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [adding, setAdding] = useState(null)

  async function loadAccounts() {
    setLoadingAccounts(true)
    const { data } = await supabase
      .from('creator_accounts')
      .select('id, platform, handle, verified, created_at')
      .order('created_at', { ascending: false })
    setAccounts(data ?? [])
    setLoadingAccounts(false)
  }

  useEffect(() => {
    if (creator) loadAccounts()
  }, [creator])

  if (!creator) return null

  function handleAdded() {
    setAdding(null)
    loadAccounts()
  }

  return (
    <div className="max-w-lg space-y-6 animate-fadein">
      <div>
        <h1 className="text-lg font-semibold text-text">Link Account</h1>
      </div>

      {/* 3-step instructions */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">How it works</p>
        <div className="space-y-4">
          {[
            { n: '1', text: 'Paste your TikTok or Instagram profile link' },
            { n: '2', text: "We'll give you a unique 4-letter code to add to your bio" },
            { n: '3', text: "Once it's there, hit Verify and you're linked" },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-start gap-3">
              <div className="shrink-0 h-6 w-6 rounded-full bg-gold/10 flex items-center justify-center">
                <span className="text-xs font-bold text-gold">{n}</span>
              </div>
              <p className="text-sm text-text-muted leading-snug pt-0.5">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Linked accounts list */}
      {!loadingAccounts && accounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Linked Accounts</p>
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <div className="text-text-muted">
                {acc.platform === 'tiktok' ? <TikTokIcon /> : <InstagramIcon />}
              </div>
              <span className="flex-1 text-sm font-medium text-text">@{acc.handle}</span>
              {acc.verified
                ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gold/20 text-gold">✓ Verified</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-border text-text-muted">Pending</span>
              }
            </div>
          ))}
        </div>
      )}

      {/* Add buttons */}
      {adding === null && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAdding('tiktok')}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-muted hover:border-gold/40 hover:text-gold transition-colors"
          >
            <TikTokIcon />
            Add TikTok
          </button>
          <button
            onClick={() => setAdding('instagram')}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-muted hover:border-gold/40 hover:text-gold transition-colors"
          >
            <InstagramIcon />
            Add Instagram
          </button>
        </div>
      )}

      {/* Active form */}
      {adding && (
        <div className="space-y-3">
          <AddAccountForm
            platform={adding}
            verificationCode={creator.verification_code ?? '····'}
            onAdded={handleAdded}
          />
          <button
            onClick={() => setAdding(null)}
            className="w-full text-center text-sm text-text-muted hover:text-text transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
