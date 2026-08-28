import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024

export function SubmitVideo() {
  const { creator } = useAuth()
  const [briefs, setBriefs] = useState([])
  const [briefId, setBriefId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [platform, setPlatform] = useState('tiktok')
  const [postedAt, setPostedAt] = useState('')
  const [viewCount, setViewCount] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase
      .from('briefs')
      .select('id, title')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setBriefs(data)
          setBriefId(data[0].id)
        }
      })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!briefId || !videoUrl.trim() || !postedAt) {
      setError('Fill in all required fields.')
      return
    }
    if (screenshot && screenshot.size > MAX_SCREENSHOT_BYTES) {
      setError('Screenshot must be under 8MB.')
      return
    }

    setSubmitting(true)

    let proofScreenshotUrl = null
    if (screenshot) {
      const path = `${creator.id}/${crypto.randomUUID()}-${screenshot.name}`
      const { error: uploadError } = await supabase.storage
        .from('proof-screenshots')
        .upload(path, screenshot)
      if (uploadError) {
        setSubmitting(false)
        setError(`Screenshot upload failed: ${uploadError.message}`)
        return
      }
      proofScreenshotUrl = path
    }

    const { error: insertError } = await supabase.from('submissions').insert({
      creator_id: creator.id,
      brief_id: briefId,
      video_url: videoUrl.trim(),
      platform,
      posted_at: new Date(postedAt).toISOString(),
      view_count_claimed: Number(viewCount) || 0,
      proof_screenshot_url: proofScreenshotUrl,
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSuccess(true)
    setVideoUrl('')
    setPostedAt('')
    setViewCount('')
    setScreenshot(null)
    e.target.reset()
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-lg font-semibold text-text">Submit Video</h1>
      <p className="mt-1 text-sm text-text-muted">
        Post date can't be more than 30 days ago — this is enforced server-side.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-text-muted" htmlFor="brief">
            Brief
          </label>
          <select
            id="brief"
            value={briefId}
            onChange={(e) => setBriefId(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-gold/50 focus:outline-none"
          >
            {briefs.map((brief) => (
              <option key={brief.id} value={brief.id}>
                {brief.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted" htmlFor="platform">
            Platform
          </label>
          <select
            id="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-gold/50 focus:outline-none"
          >
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted" htmlFor="video-url">
            Video link
          </label>
          <input
            id="video-url"
            type="url"
            required
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://tiktok.com/@you/video/..."
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-gold/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted" htmlFor="posted-at">
            Posted on
          </label>
          <input
            id="posted-at"
            type="datetime-local"
            required
            value={postedAt}
            onChange={(e) => setPostedAt(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-gold/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted" htmlFor="view-count">
            Current view count
          </label>
          <input
            id="view-count"
            type="number"
            min="0"
            required
            value={viewCount}
            onChange={(e) => setViewCount(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-gold/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted" htmlFor="screenshot">
            Proof screenshot
          </label>
          <input
            id="screenshot"
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            className="mt-1.5 w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-text"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-gold">Submitted for review.</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  )
}
