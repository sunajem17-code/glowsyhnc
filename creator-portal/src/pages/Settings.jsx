import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export function Settings() {
  const { creator, refreshCreator } = useAuth()
  const [tiktokHandle, setTiktokHandle] = useState(creator?.tiktok_handle ?? '')
  const [instagramHandle, setInstagramHandle] = useState(creator?.instagram_handle ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: updateError } = await supabase
      .from('creators')
      .update({
        tiktok_handle: tiktokHandle.trim() || null,
        tiktok_connected: tiktokHandle.trim().length > 0,
        instagram_handle: instagramHandle.trim() || null,
        instagram_connected: instagramHandle.trim().length > 0,
      })
      .eq('id', creator.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await refreshCreator()
    setSaved(true)
  }

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-semibold text-text">Settings</h1>
      <p className="mt-1 text-sm text-text-muted">
        Connect the handles you post content from. This just links your account for brief
        eligibility — no platform OAuth yet.
      </p>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-text-muted" htmlFor="tiktok">
            TikTok handle
          </label>
          <input
            id="tiktok"
            value={tiktokHandle}
            onChange={(e) => setTiktokHandle(e.target.value)}
            placeholder="@yourhandle"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-gold/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted" htmlFor="instagram">
            Instagram handle
          </label>
          <input
            id="instagram"
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            placeholder="@yourhandle"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-gold/50 focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-gold">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
