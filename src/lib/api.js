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
