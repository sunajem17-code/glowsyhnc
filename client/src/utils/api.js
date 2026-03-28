const BASE = '/api'

async function request(path, options = {}) {
  const token = JSON.parse(localStorage.getItem('glowsync-storage') || '{}')?.state?.token
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }))
    throw new Error(err.error || 'Request failed')
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
      const token = JSON.parse(localStorage.getItem('glowsync-storage') || '{}')?.state?.token
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
    status: () => request('/payments/status'),
  },
}
