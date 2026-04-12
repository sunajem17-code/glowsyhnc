const API_URL = import.meta.env.VITE_API_URL || 'https://glowsyhnc-production-e16b.up.railway.app'
const BASE = `https://${API_URL.replace(/^https?:\/\//, '')}/api`

async function request(path, options = {}) {
  const token = JSON.parse(localStorage.getItem('ascendus-storage') || '{}')?.state?.token
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  let res
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers })
  } catch (networkErr) {
    // fetch() itself threw — server is unreachable
    throw new Error('Server unavailable')
  }
  if (!res.ok) {
    // If the proxy returns HTML (Vite can't reach the backend), treat as unavailable
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/html') || res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('Server unavailable')
    }
    const errBody = await res.json().catch(() => ({}))
    if (res.status === 401) {
      // Clear stale auth state so the app redirects to sign-in on next render
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
    throw new Error(errBody.error || `Something went wrong (${res.status})`)
  }
  return res.json()
}

export const api = {
  auth: {
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  },
  user: {
    profile: () => request('/user/profile'),
    update: (data) => request('/user/profile', { method: 'PUT', body: JSON.stringify(data) }),
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
    recommended: () => request('/products/recommended'),
  },
  payments: {
    createCheckout: (plan) => request('/payments/create-checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
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
  },
  leaderboard: {
    get: () => request('/leaderboard'),
    submit: (data) => request('/leaderboard/submit', { method: 'POST', body: JSON.stringify(data) }),
  },
  referral: {
    count: () => request('/referral/count'),
    claimTrial: () => request('/referral/claim-trial', { method: 'POST' }),
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
