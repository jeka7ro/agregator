import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useLiveChecks() {
  const [restaurants, setRestaurants] = useState([])
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      
      let rests = []
      // 1. Try local API first (fastest, authoritative in local environment)
      try {
        const localRes = await fetch('http://localhost:3002/api/settings/restaurants')
        if (localRes.ok) {
          const localJson = await localRes.json()
          if (localJson.success && Array.isArray(localJson.restaurants) && localJson.restaurants.length > 0) {
            rests = localJson.restaurants
          }
        }
      } catch (localErr) {
        console.warn('Local restaurants fetch error, falling back to Supabase:', localErr)
      }

      // 2. Fallback to Supabase if local API had no data
      if (!rests || rests.length === 0) {
        try {
          const { data, error: restaurantsError } = await supabase.from('restaurants').select('*, brands(*)')
          if (!restaurantsError && Array.isArray(data) && data.length > 0) {
            rests = data
          }
        } catch (err) {
          console.warn('Supabase fetch failed:', err)
        }
      }

      let checksDict = {}
      try {
        const res = await fetch('http://localhost:3002/api/live-checks')
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.checks) {
            json.checks.forEach(c => {
              if (!checksDict[c.restaurant_id]) {
                checksDict[c.restaurant_id] = {}
              }
              checksDict[c.restaurant_id][c.platform] = c
            })
          }
        }
      } catch (err) {
        console.error('API Error:', err)
      }

      const transformed = (rests || []).map(r => {
        return {
          ...r,
          glovo_status: checksDict[r.id]?.glovo?.final_status || 'Neverificat',
          wolt_status: checksDict[r.id]?.wolt?.final_status || 'Neverificat',
          bolt_status: checksDict[r.id]?.bolt?.final_status || 'Neverificat',
          iiko_status: checksDict[r.id]?.iiko?.final_status || 'Neverificat',

          glovo_rating: checksDict[r.id]?.glovo?.rating || '-',
          wolt_rating: checksDict[r.id]?.wolt?.rating || '-',
          bolt_rating: checksDict[r.id]?.bolt?.rating || '-',
          iiko_rating: checksDict[r.id]?.iiko?.rating || '-'
        }
      })

      setRestaurants(transformed)
      setChecks(Object.values(checksDict).flatMap(obj => Object.values(obj)))
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Eroare generală useLiveChecks:', error)
    } finally { 
      setLoading(false) 
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [])

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
