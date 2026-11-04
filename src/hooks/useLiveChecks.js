import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { getCanonicalCity } from '../lib/orderUtils'
import { getBrandInfo } from '../components/BrandAvatar'

let memoryCachedRestaurants = []
let memoryCachedChecks = []

try {
  if (typeof window !== 'undefined') {
    const savedRests = sessionStorage.getItem('live_checks_restaurants')
    const savedChecks = sessionStorage.getItem('live_checks_data')
    if (savedRests) memoryCachedRestaurants = JSON.parse(savedRests) || []
    if (savedChecks) memoryCachedChecks = JSON.parse(savedChecks) || []
  }
} catch (_) {}

export function useLiveChecks({ rawUnfiltered = false } = {}) {
  const { user, canAccessCity, canAccessBrand, canAccessRestaurant, hasScopeRestrictions } = useAuth()
  const [rawRestaurants, setRawRestaurants] = useState(() => memoryCachedRestaurants)
  const [rawChecks, setRawChecks] = useState(() => memoryCachedChecks)
  const [loading, setLoading] = useState(() => memoryCachedRestaurants.length === 0)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent && memoryCachedRestaurants.length === 0) setLoading(true)

      const fetchWithTimeout = async (url, ms = 3500) => {
        const ctrl = new AbortController()
        const id = setTimeout(() => ctrl.abort(), ms)
        try {
          return await fetch(url, { signal: ctrl.signal })
        } finally {
          clearTimeout(id)
        }
      }

      const [restResResult, checksResResult] = await Promise.allSettled([
        fetchWithTimeout(getApiUrl('/api/settings/restaurants'), 3500),
        fetchWithTimeout(getApiUrl('/api/live-checks'), 3500)
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

      const transformed = (rests || []).map(r => {
        return {
          ...r,
          glovo_status: checksDict[r.id]?.glovo?.final_status || 'available',
          wolt_status: checksDict[r.id]?.wolt?.final_status || 'available',
          bolt_status: checksDict[r.id]?.bolt?.final_status || 'available',
          iiko_status: checksDict[r.id]?.iiko?.final_status || 'available',

          glovo_rating: checksDict[r.id]?.glovo?.rating || '-',
          wolt_rating: checksDict[r.id]?.wolt?.rating || '-',
          bolt_rating: checksDict[r.id]?.bolt?.rating || '-',
          iiko_rating: checksDict[r.id]?.iiko?.rating || '-'
        }
      })

      const flatChecks = Object.values(checksDict).flatMap(obj => Object.values(obj))
      if (transformed.length > 0) {
        memoryCachedRestaurants = transformed
        try { sessionStorage.setItem('live_checks_restaurants', JSON.stringify(transformed)) } catch (_) {}
      }
      if (flatChecks.length > 0) {
        memoryCachedChecks = flatChecks
        try { sessionStorage.setItem('live_checks_data', JSON.stringify(flatChecks)) } catch (_) {}
      }

      setRawRestaurants(transformed)
      setRawChecks(flatChecks)
      setLastRefresh(new Date())
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

  const latestChecksMap = {}
  checks.forEach(c => {
    const key = `${c.restaurant_id}_${c.platform}`
    if (!latestChecksMap[key]) latestChecksMap[key] = c
  })

  function getLatestCheck(restaurantId, platform) {
    return latestChecksMap[`${restaurantId}_${platform}`] || null
  }

  return { restaurants, checks, loading, lastRefresh, getLatestCheck, fetchData }
}
