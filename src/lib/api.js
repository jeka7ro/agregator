/**
 * Central API Base URL Configuration
 * In local dev: defaults to http://localhost:3002
 * On Netlify / Production: uses VITE_API_URL from environment or fallback
 */
export const API_BASE = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.PROD ? '' : 'http://localhost:3002')

export function getApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${cleanPath}`
}

// Shared in-flight & short-TTL GET deduplicator (eliminates React StrictMode & multi-component duplicate fetches)
const _getInFlight = new Map()
const _getCache = new Map()

export function clearApiDedupCache(prefix = '') {
  if (!prefix) {
    _getCache.clear()
    return
  }
  for (const k of _getCache.keys()) {
    if (k.includes(prefix)) _getCache.delete(k)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('ag-auth-cache-purge', () => _getCache.clear())
}

export async function fetchJsonDedup(url, { ttlMs = 15000, force = false, timeoutMs = 15000 } = {}) {
  const now = Date.now()
  if (!force && ttlMs > 0) {
    const hit = _getCache.get(url)
    if (hit && now - hit.ts < ttlMs) return hit.data
  }
  if (!force && _getInFlight.has(url)) {
    return _getInFlight.get(url)
  }

  const promise = (async () => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    const tid = ctrl && timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null
    try {
      const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (ttlMs > 0) _getCache.set(url, { ts: Date.now(), data })
      return data
    } finally {
      if (tid) clearTimeout(tid)
      if (_getInFlight.get(url) === promise) _getInFlight.delete(url)
    }
  })()

  _getInFlight.set(url, promise)
  return promise
}
