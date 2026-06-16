const API_URL = import.meta.env.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app'
const BASE = `https://${API_URL.replace(/^https?:\/\//, '')}/api`

async function request(path, options = {}) {
  const token = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')?.state?.token
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  // AI scoring can take 20–40s — give it 130s. All other calls get 15s.
  const isAiCall = path.startsWith('/ai/') || path.startsWith('/tindermaxx/')
  const timeoutMs = isAiCall ? 130_000 : 15_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers, signal: controller.signal })
  } catch (networkErr) {
    clearTimeout(timeoutId)
    // fetch() itself threw — server is unreachable or timed out
    if (networkErr.name === 'AbortError') throw new Error('Request timed out. Please check your connection.')
    throw new Error('Server unavailable')
  }
  clearTimeout(timeoutId)
  if (!res.ok) {
    // If the proxy returns HTML (Vite can't reach the backend), treat as unavailable
    const contentType = res.headers.get('content-type') || ''
    // 502/504 are proxy/gateway errors that return HTML — bail early.
    // 503 from our own API returns JSON (rate-limit payload) — let it fall through.
    if (contentType.includes('text/html') || res.status === 502 || res.status === 504) {
      throw new Error('Server unavailable')
    }
    const errBody = await res.json().catch(() => ({}))
    if (res.status === 401) {
      // Only treat as "session expired" if it's an auth middleware rejection
      // (i.e. user has a stored token that the server rejected).
      // Login/register endpoints return 401 for wrong credentials — show that message instead.
      const isAuthEndpoint = path.startsWith('/auth/')
      if (!isAuthEndpoint) {
        try {
          const stored = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')
          if (stored?.state?.token && stored.state.token !== 'demo-token') {
            stored.state.token = null
            stored.state.isAuthenticated = false
            localStorage.setItem('ascendus-storage', JSON.stringify(stored))
          }
        } catch {}
        throw new Error('Session expired. Please sign in again.')
      }
      throw new Error(errBody.error || 'Invalid email or password')
    }
    // Attach structured fields (retryAfter, plan, status, etc.) to the thrown error
    const err = new Error(errBody.error || `Something went wrong (${res.status})`)
    err.status = res.status
    if (errBody.retryAfter) err.retryAfter = errBody.retryAfter
    if (errBody.plan)       err.plan       = errBody.plan
    throw err
  }
  return res.json()
}

export const api = {
  auth: {
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    appleSignIn: (data) => request('/auth/apple', { method: 'POST', body: JSON.stringify(data) }),
  },
  user: {
    profile: () => request('/user/profile'),
    update: (data) => request('/user/profile', { method: 'PUT', body: JSON.stringify(data) }),
    deleteAccount: () => request('/user/account', { method: 'DELETE' }),
    scanHistory: () => request('/user/scan-history'),
  },
  scan: {
    upload: (formData) => {
      const token = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')?.state?.token
      return fetch(`${BASE}/scan/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then(r => r.json())
    },
    analyze: (scanId) => request(`/scan/analyze/${scanId}`, { method: 'POST' }),
    history: () => request('/scan/history'),
    get: (id) => request(`/scan/${id}`),
  },
  plan: {
    current: () => request('/plan/current'),
    generate: (scanId) => request('/plan/generate', { method: 'POST', body: JSON.stringify({ scanId }) }),
    tasks: (planId) => request(`/plan/${planId}/tasks`),
  },
  tasks: {
    complete: (taskId) => request(`/tasks/${taskId}/complete`, { method: 'POST' }),
  },
  checkin: {
    create: (data) => request('/checkin', { method: 'POST', body: JSON.stringify(data) }),
    history: () => request('/checkin/history'),
  },
  progress: {
    timeline: () => request('/progress/timeline'),
    compare: (id1, id2) => request(`/progress/compare?id1=${id1}&id2=${id2}`),
  },
  products: {
    recommended:     ()     => request('/products/recommended'),
    recommendations: (data) => request('/products/recommendations', { method: 'POST', body: JSON.stringify(data) }),
  },
  payments: {
    createCheckout: (plan, noTrial = false) => request('/payments/create-checkout', { method: 'POST', body: JSON.stringify({ plan, noTrial }) }),
    portal: () => request('/payments/portal', { method: 'POST' }),
    status: () => request('/payments/status'),
  },
  ai: {
    score: (data) => request('/ai/score', { method: 'POST', body: JSON.stringify(data) }),
  },
  coach: {
    message: (data) => request('/coach/message', { method: 'POST', body: JSON.stringify(data) }),
  },
  hair: {
    analyze: (data) => request('/hair/analyze', { method: 'POST', body: JSON.stringify(data) }),
    tryon:   (data) => request('/hair/tryon',   { method: 'POST', body: JSON.stringify(data) }),
  },
  leaderboard: {
    get: () => request('/leaderboard'),
    submit: (data) => request('/leaderboard/submit', { method: 'POST', body: JSON.stringify(data) }),
  },
  referral: {
    count:     () => request('/referral/count'),
    claimTrial: () => request('/referral/claim-trial', { method: 'POST' }),
    unlockPro: () => request('/referral/unlock-pro',   { method: 'POST' }),
  },
  swipemaxx: {
    rank: (data) => request('/swipemaxx/rank', { method: 'POST', body: JSON.stringify(data) }),
  },
  tindermaxx: {
    rank: (data) => request('/tindermaxx/rank', { method: 'POST', body: JSON.stringify(data) }),
  },
  community: {
    feed:           ()           => request('/community/feed'),
    post:           (data)       => request('/community/post', { method: 'POST', body: JSON.stringify(data) }),
    deletePost:     (id)         => request(`/community/post/${id}`, { method: 'DELETE' }),
    like:           (id)         => request(`/community/post/${id}/like`, { method: 'POST' }),
    comments:       (id)         => request(`/community/post/${id}/comments`),
    addComment:     (id, data)   => request(`/community/post/${id}/comment`, { method: 'POST', body: JSON.stringify(data) }),
    deleteComment:  (id)         => request(`/community/comment/${id}`, { method: 'DELETE' }),
    rate:           (id, score)  => request(`/community/post/${id}/rate`, { method: 'POST', body: JSON.stringify({ score }) }),
  },
  promo: {
    redeem: (code) => request('/promo/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  },
  potential: {
    analyze: (data) => request('/potential/analyze', { method: 'POST', body: JSON.stringify(data) }),
    glowUp:  (data) => request('/potential/glow-up',  { method: 'POST', body: JSON.stringify(data) }),
  },
  supabase: {
    // Persist a completed scan + tasks to Supabase. Fire-and-forget safe.
    saveScan:     (data)        => request('/supabase/scans',          { method: 'POST',  body: JSON.stringify(data) }),
    getScans:     ()            => request('/supabase/scans'),
    getProgress:  ()            => request('/supabase/progress'),
    getTasks:     ()            => request('/supabase/tasks'),
    updateTask:   (id, data)    => request(`/supabase/tasks/${id}`,    { method: 'PATCH', body: JSON.stringify(data) }),
    updateUser:   (data)        => request('/supabase/user',           { method: 'PUT',   body: JSON.stringify(data) }),
    uploadImage:  (data)        => request('/supabase/upload-image',   { method: 'POST',  body: JSON.stringify(data) }),
    status:       ()            => request('/supabase/status'),
  },
}
