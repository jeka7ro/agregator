import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

const CACHE_PREFIX = 'cum_hourly_v2_'
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000 // 6h SWR instant render
const memoryCache = new Map()
const inFlightMap = new Map()

function readCache(key) {
  const mem = memoryCache.get(key)
  if (mem && mem.success) return mem
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.data?.success && (Date.now() - (parsed.ts || 0) < CACHE_MAX_AGE_MS)) {
          memoryCache.set(key, parsed.data)
          return parsed.data
        }
      }
    }
  } catch (_) {}
  return null
}

function writeCache(key, data) {
  if (!data || !data.success) return
  memoryCache.set(key, data)
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
    }
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('ag-auth-cache-purge', () => {
    memoryCache.clear()
    inFlightMap.clear()
    try {
      const toDel = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && (k.startsWith('cum_hourly_v1_') || k.startsWith(CACHE_PREFIX))) toDel.push(k)
      }
      toDel.forEach(k => localStorage.removeItem(k))
    } catch (_) {}
  })
}

export function useCumulativeHourly({ period = 'this_month', customRange = null, compare = 'primary' } = {}) {
  const { user } = useAuth()

  const scopeParams = useMemo(() => {
    if (!user || user.role === 'admin') {
      return { cities: '', brands: '', restaurants: '', key: 'all' }
    }
    const cities = (user.allowed_cities || ['all']).filter(c => c && c !== 'all').join(',')
    const brands = (user.allowed_brands || ['all']).filter(b => b && b !== 'all').join(',')
    const restaurants = (user.allowed_restaurants || ['all']).filter(r => r && r !== 'all').join(',')
    return {
      cities,
      brands,
      restaurants,
      key: `${cities || 'all'}|${brands || 'all'}|${restaurants || 'all'}`
    }
  }, [user?.role, user?.allowed_cities, user?.allowed_brands, user?.allowed_restaurants])

  const customFrom = period === 'custom' && customRange?.from ? String(customRange.from).trim() : ''
  const customTo = period === 'custom' && customRange?.to ? String(customRange.to).trim() : customFrom

  const cacheKey = `${CACHE_PREFIX}${period}_${customFrom}_${customTo}_${compare}_${scopeParams.key}`
  const [data, setData] = useState(() => readCache(cacheKey))
  const [loading, setLoading] = useState(() => !readCache(cacheKey))
  const [error, setError] = useState(null)
  const reqIdRef = useRef(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const fetchCumulative = useCallback(async (silent = false) => {
    const reqId = ++reqIdRef.current
    try {
      if (!silent && !readCache(cacheKey)) setLoading(true)

      let reqPromise = inFlightMap.get(cacheKey)
      if (!reqPromise) {
        const params = new URLSearchParams({ period, compare })
        if (period === 'custom' && customFrom) {
          params.set('from', customFrom)
          if (customTo) params.set('to', customTo)
        }
        if (scopeParams.cities) params.set('cities', scopeParams.cities)
        if (scopeParams.brands) params.set('brands', scopeParams.brands)
        if (scopeParams.restaurants) params.set('restaurants', scopeParams.restaurants)

        reqPromise = fetch(getApiUrl(`/api/sales/cumulative-hourly?${params.toString()}`))
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.json()
          })
          .then(json => {
            if (!json?.success) throw new Error(json?.error || 'Failed to load cumulative hourly data')
            writeCache(cacheKey, json)
            return json
          })
          .finally(() => {
            if (inFlightMap.get(cacheKey) === reqPromise) inFlightMap.delete(cacheKey)
          })
        inFlightMap.set(cacheKey, reqPromise)
      }

      const json = await reqPromise
      if (!isMountedRef.current || reqId !== reqIdRef.current) return
      setData(json)
      setError(null)
    } catch (err) {
      if (!isMountedRef.current || reqId !== reqIdRef.current) return
      setError(err.message)
      const fallback = readCache(cacheKey)
      if (fallback) setData(fallback)
    } finally {
      if (isMountedRef.current && reqId === reqIdRef.current) setLoading(false)
    }
  }, [period, customFrom, customTo, compare, scopeParams.cities, scopeParams.brands, scopeParams.restaurants, cacheKey])

  useEffect(() => {
    const cached = readCache(cacheKey)
    if (cached) {
      setData(cached)
      setLoading(false)
    }
    fetchCumulative(Boolean(cached))

    // Auto-refresh live periods every 2–3 minutes during operating hours (10:00–22:00 RO)
    if (period === 'yesterday' || period === 'last_month') return
    if (period === 'custom' && customTo) {
      try {
        const todayRo = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
        if (customTo < todayRo) return
      } catch (_) {}
    }

    const intervalMs = period === 'today' ? 120000 : 240000
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const roHour = Number(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Bucharest',
            hour: '2-digit',
            hour12: false
          }).format(new Date())
        )
        if (roHour >= 22 || roHour < 10) return
      } catch (_) {}
      fetchCumulative(true)
    }, intervalMs)

    return () => {
      clearInterval(timer)
      reqIdRef.current += 1
    }
  }, [cacheKey, period, customTo, fetchCumulative])

  return { data, loading, error, refetch: fetchCumulative }
}
