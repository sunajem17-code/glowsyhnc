const PRODUCTION_ORIGIN = 'https://glowsyhnc-production-e16b.up.railway.app'

export function resolveBackendOrigin(value, development = false) {
  if (development) return '' // Vite proxies local API, uploads, and tracking requests.
  const origin = (value || PRODUCTION_ORIGIN).trim().replace(/\/+$/, '')
  return /^https?:\/\//.test(origin) ? origin : `https://${origin}`
}

export const BACKEND_ORIGIN = resolveBackendOrigin(import.meta.env?.VITE_API_URL, import.meta.env?.DEV)
export const API_BASE = `${BACKEND_ORIGIN}/api`
