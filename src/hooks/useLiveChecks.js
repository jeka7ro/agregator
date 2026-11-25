import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { getCanonicalCity } from '../lib/orderUtils'
import { getBrandInfo } from '../components/BrandAvatar'

const LS_RESTS_KEY = 'live_checks_restaurants_v3'
const LS_CHECKS_KEY = 'live_checks_data_v3'
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h for instant 0ms SWR paint
const DEDUP_FRESH_MS = 15 * 1000 // 15s dedup window across concurrent hooks & route switches

let memoryCachedRestaurants = []
let memoryCachedChecks = []
let memoryLastRefresh = new Date()
let lastSuccessfulFetchTs = 0
let inFlightPromise = null
const listeners = new Set()

function notifyListeners() {
  for (const fn of listeners) {
    try { fn() } catch (_) {}
  }
}

function loadFromStorage(key) {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.data) && (Date.now() - (parsed.ts || 0) < CACHE_MAX_AGE_MS)) {
      return parsed.data
    }
  } catch (_) {}
  return []
}

function saveToStorage(key, data) {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  } catch (_) {}
}

memoryCachedRestaurants = loadFromStorage(LS_RESTS_KEY)
memoryCachedChecks = loadFromStorage(LS_CHECKS_KEY)

export function clearLiveChecksCache() {
  memoryCachedRestaurants = []
  memoryCachedChecks = []
  lastSuccessfulFetchTs = 0
  inFlightPromise = null
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LS_RESTS_KEY)
      localStorage.removeItem(LS_CHECKS_KEY)
      sessionStorage.removeItem('live_checks_restaurants_v2')
      sessionStorage.removeItem('live_checks_data_v2')
    }
  } catch (_) {}
  notifyListeners()
}

if (typeof window !== 'undefined') {
  window.addEventListener('ag-auth-cache-purge', () => {
    memoryCachedRestaurants = []
    memoryCachedChecks = []
    lastSuccessfulFetchTs = 0
    inFlightPromise = null
    notifyListeners()
  })
}

async function runSharedLiveChecksFetch(forceRefresh = false) {
  // Share a single in-flight request across MainLayout + Dashboard + Monitoring
  if (inFlightPromise && !forceRefresh) {
    return inFlightPromise
  }
  // Skip redundant immediate re-fetch when data was just fetched (< 15s ago)
  if (!forceRefresh && memoryCachedRestaurants.length > 0 && (Date.now() - lastSuccessfulFetchTs < DEDUP_FRESH_MS)) {
    return { restaurants: memoryCachedRestaurants, checks: memoryCachedChecks }
  }

  const exec = (async () => {
    const fetchWithTimeout = async (url, ms = 8000) => {
      const ctrl = new AbortController()
      const id = setTimeout(() => ctrl.abort(), ms)
      try {
        return await fetch(url, { signal: ctrl.signal })
      } finally {
        clearTimeout(id)
      }
    }

    const checksEndpoint = forceRefresh
      ? getApiUrl(`/api/live-checks?refresh=1&_t=${Date.now()}`)
      : getApiUrl('/api/live-checks')

    const [restResResult, checksResResult] = await Promise.allSettled([
      fetchWithTimeout(getApiUrl('/api/settings/restaurants'), 6000),
      fetchWithTimeout(checksEndpoint, 8500)
    ])

    let rests = []
    if (restResResult.status === 'fulfilled' && restResResult.value.ok) {
      const localJson = await restResResult.value.json()
      if (localJson.success && Array.isArray(localJson.restaurants) && localJson.restaurants.length > 0) {
        rests = localJson.restaurants
      }
    }

    if (!rests || rests.length === 0) {
      if (memoryCachedRestaurants.length > 0) {
        rests = memoryCachedRestaurants
      } else {
        try {
          const { data, error: restaurantsError } = await supabase.from('restaurants').select('*, brands(*)')
          if (!restaurantsError && Array.isArray(data) && data.length > 0) {
            rests = data
          }
        } catch (err) {
          console.warn('Supabase fetch failed:', err)
        }
      }
    }

    let checksDict = {}
    if (checksResResult.status === 'fulfilled' && checksResResult.value.ok) {
      const json = await checksResResult.value.json()
      if (json.success && Array.isArray(json.checks)) {
        json.checks.forEach(c => {
          if (!checksDict[c.restaurant_id]) {
            checksDict[c.restaurant_id] = {}
          }
          checksDict[c.restaurant_id][c.platform] = c
        })
      }
    }

    if (Object.keys(checksDict).length === 0 && memoryCachedChecks.length > 0) {
      memoryCachedChecks.forEach(c => {
        if (!checksDict[c.restaurant_id]) checksDict[c.restaurant_id] = {}
        checksDict[c.restaurant_id][c.platform] = c
      })
    }

    const transformed = (rests || []).map(r => ({
      ...r,
      glovo_status: checksDict[r.id]?.glovo?.final_status || 'unchecked',
      wolt_status: checksDict[r.id]?.wolt?.final_status || 'unchecked',
      bolt_status: checksDict[r.id]?.bolt?.final_status || 'unchecked',
      iiko_status: checksDict[r.id]?.iiko?.final_status || 'unchecked',

      glovo_rating: checksDict[r.id]?.glovo?.rating || '-',
      wolt_rating: checksDict[r.id]?.wolt?.rating || '-',
      bolt_rating: checksDict[r.id]?.bolt?.rating || '-',
      iiko_rating: checksDict[r.id]?.iiko?.rating || '-'
    }))

    const flatChecks = Object.values(checksDict).flatMap(obj => Object.values(obj))
    if (transformed.length > 0) {
      memoryCachedRestaurants = transformed
      saveToStorage(LS_RESTS_KEY, transformed)
    }
    if (flatChecks.length > 0) {
      memoryCachedChecks = flatChecks
      saveToStorage(LS_CHECKS_KEY, flatChecks)
    }
    memoryLastRefresh = new Date()
    lastSuccessfulFetchTs = Date.now()
    notifyListeners()
    return { restaurants: transformed, checks: flatChecks }
  })()

  inFlightPromise = exec
  try {
    return await exec
  } finally {
    if (inFlightPromise === exec) inFlightPromise = null
  }
}

export function prefetchLiveChecks() {
  return runSharedLiveChecksFetch(false).catch(() => null)
}

export function useLiveChecks({ rawUnfiltered = false } = {}) {
  const { canAccessCity, canAccessBrand, canAccessRestaurant, hasScopeRestrictions } = useAuth()
  const [rawRestaurants, setRawRestaurants] = useState(() => memoryCachedRestaurants)
  const [rawChecks, setRawChecks] = useState(() => memoryCachedChecks)
  const [loading, setLoading] = useState(() => memoryCachedRestaurants.length === 0)
  const [lastRefresh, setLastRefresh] = useState(() => memoryLastRefresh)

  useEffect(() => {
    const sync = () => {
      setRawRestaurants(memoryCachedRestaurants)
      setRawChecks(memoryCachedChecks)
      setLastRefresh(memoryLastRefresh)
      if (memoryCachedRestaurants.length > 0) setLoading(false)
    }
    listeners.add(sync)
    return () => { listeners.delete(sync) }
  }, [])

  const fetchData = useCallback(async (silent = false, forceRefresh = false) => {
    try {
      if (!silent && memoryCachedRestaurants.length === 0) setLoading(true)
      await runSharedLiveChecksFetch(forceRefresh)
    } catch (error) {
      console.error('Eroare generală useLiveChecks:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      // Oprește orice verificare automată în intervalul nocturn 22:00 - 10:00 (0 consum trafic)
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
      fetchData(true)
    }, 300000)
    return () => clearInterval(interval)
  }, [fetchData])

  const restaurants = useMemo(() => {
    if (rawUnfiltered || !hasScopeRestrictions) return rawRestaurants
    return rawRestaurants.filter(r => {
      const rCity = getCanonicalCity(r.city || r.name || '')
      const rBrand = getBrandInfo(r)?.name || r.brand || ''
      if (!canAccessCity(rCity || r.city || r.name)) return false
      if (!canAccessBrand(rBrand || r)) return false
      if (r.id && !canAccessRestaurant(r.id)) return false
      return true
    })
  }, [rawRestaurants, rawUnfiltered, hasScopeRestrictions, canAccessCity, canAccessBrand, canAccessRestaurant])

  const checks = useMemo(() => {
    if (rawUnfiltered || !hasScopeRestrictions) return rawChecks
    const allowedRestIds = new Set(restaurants.map(r => String(r.id)))
    return rawChecks.filter(c => allowedRestIds.has(String(c.restaurant_id)))
  }, [rawChecks, restaurants, rawUnfiltered, hasScopeRestrictions])

  const latestChecksMap = useMemo(() => {
    const map = {}
    checks.forEach(c => {
      const key = `${c.restaurant_id}_${c.platform}`
      if (!map[key]) map[key] = c
    })
    return map
  }, [checks])

  const getLatestCheck = useCallback((restaurantId, platform) => {
    return latestChecksMap[`${restaurantId}_${platform}`] || null
  }, [latestChecksMap])

  return { restaurants, checks, loading, lastRefresh, getLatestCheck, fetchData }
}
