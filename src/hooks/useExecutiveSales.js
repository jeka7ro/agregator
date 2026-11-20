import { useState, useEffect, useCallback, useMemo } from 'react'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { getCanonicalCity } from '../lib/orderUtils'
import { getBrandInfo } from '../components/BrandAvatar'

export function useExecutiveSales(period = 'this_month', limit = 2000) {
  const { user, canAccessCity, canAccessBrand, canAccessRestaurant, hasScopeRestrictions } = useAuth()
  const allowedCitiesKey = useMemo(() => {
    if (!user || user.role === 'admin') return ''
    const allowedC = (user.allowed_cities || ['all']).filter(c => c && c !== 'all')
    return allowedC.join(',')
  }, [user?.role, user?.allowed_cities])

  const cacheKey = `exec_sales_v5_${period}_${allowedCitiesKey || 'all'}`

  const [salesData, setSalesData] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && parsed.success) return parsed
        }
      }
    } catch (_) {}
    return null
  })
  const [loading, setLoading] = useState(() => !salesData)
  const [error, setError] = useState(null)

  const fetchSales = useCallback(async () => {
    try {
      if (!salesData) setLoading(true)
      const params = new URLSearchParams({ period, limit: String(limit) })
      if (allowedCitiesKey) params.set('cities', allowedCitiesKey)
      const res = await fetch(getApiUrl(`/api/sales/executive-summary?${params.toString()}`))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data && data.success) {
        setSalesData(data)
        setError(null)
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data))
        } catch (_) {}
      } else {
        throw new Error(data?.error || 'Failed to fetch sales summary')
      }
    } catch (err) {
      console.warn('[useExecutiveSales] Fetch error:', err.message)
      setError(err.message)
      // Anti-Wipe: fallback la cache dacă serverul are un glitch temporar
      try {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && parsed.success) {
            setSalesData(parsed)
          }
        }
      } catch (_) {}
    } finally {
      setLoading(false)
    }
  }, [period, limit, allowedCitiesKey, cacheKey])

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && parsed.success) {
          setSalesData(parsed)
        }
      }
    } catch (_) {}
    fetchSales()
    // Immutable historical periods never need background polling (0 wasted function invocations)
    if (period === 'yesterday' || period === 'last_month') return

    const refreshMs = period === 'today' ? 120000 : 300000 // 2 min for today, 5 min for week/month/year
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
      fetchSales()
    }, refreshMs)
    return () => clearInterval(timer)
  }, [period, limit, allowedCitiesKey, cacheKey, fetchSales])

  const scopedSalesData = useMemo(() => {
    if (!salesData || !hasScopeRestrictions) return salesData

    const rawByRest = salesData.byRestaurant || {}
    const workpoints = salesData.workpoints || []
    const wpMap = {}
    workpoints.forEach(w => {
      if (w && w.id) wpMap[w.id] = w
    })

    const filteredByRest = {}
    let totalOrders = 0
    let totalRevenue = 0
    let totalGrossRevenue = 0
    const chTotals = { kiosk: 0, casierie: 0, glovo: 0, wolt: 0, bolt: 0, direct: 0 }
    const brandMap = {}
    const cityMap = {}
    let matchedAnyRestMeta = false

    Object.entries(rawByRest).forEach(([restId, rData]) => {
      const wp = wpMap[restId] || {}
      const rawCity = rData.city || wp.city || rData.name || wp.name || ''
      const rawBrand = rData.brand || wp.brand || getBrandInfo({ name: rData.name || wp.name, brand: rData.brand || wp.brand })?.name || ''
      if (rawCity || rawBrand) matchedAnyRestMeta = true

      const rCity = getCanonicalCity(rawCity)
      if (!canAccessCity(rCity || rawCity)) return
      if (!canAccessBrand(rawBrand || rData.name || wp.name)) return
      if (!canAccessRestaurant(restId)) return

      filteredByRest[restId] = { ...wp, ...rData, city: rCity || rawCity, brand: rawBrand }
      const cnt = Number(rData.count || 0)
      const rev = Number(rData.revenue || 0)
      const grossRev = Number(rData.grossRevenue || rev)
      totalOrders += cnt
      totalRevenue += rev
      totalGrossRevenue += grossRev

      const chObj = rData.channels || wp.channels || {}
      Object.keys(chTotals).forEach(k => {
        chTotals[k] += Number(chObj[k] || 0)
      })

      if (rawBrand) {
        if (!brandMap[rawBrand]) brandMap[rawBrand] = { name: rawBrand, count: 0, revenue: 0, grossRevenue: 0 }
        brandMap[rawBrand].count += cnt
        brandMap[rawBrand].revenue += rev
        brandMap[rawBrand].grossRevenue += grossRev
      }
      if (rCity) {
        if (!cityMap[rCity]) cityMap[rCity] = { city: rCity, name: rCity, count: 0, revenue: 0, grossRevenue: 0, locationsCount: 0, channels: {} }
        cityMap[rCity].count += cnt
        cityMap[rCity].revenue += rev
        cityMap[rCity].grossRevenue += grossRev
        cityMap[rCity].locationsCount += 1
        Object.keys(chTotals).forEach(k => {
          cityMap[rCity].channels[k] = (cityMap[rCity].channels[k] || 0) + Number(chObj[k] || 0)
        })
      }
    })

    const hasByRest = matchedAnyRestMeta && Object.keys(rawByRest).length > 0

    const filteredBrands = (salesData.brands || [])
      .filter(b => canAccessBrand(b.name))
      .map(b => {
        const bOverride = brandMap[b.name]
        if (hasByRest && !bOverride) {
          return { ...b, count: 0, revenue: 0, grossRevenue: 0, share: 0 }
        }
        const rev = (hasByRest && bOverride) ? Math.round(bOverride.revenue) : b.revenue
        const grossRev = (hasByRest && bOverride) ? Math.round(bOverride.grossRevenue) : (b.grossRevenue || rev)
        const cnt = (hasByRest && bOverride) ? bOverride.count : b.count
        return {
          ...b,
          count: cnt,
          revenue: rev,
          grossRevenue: grossRev,
          share: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 100
        }
      })

    const filteredCities = (salesData.cities || [])
      .filter(c => canAccessCity(c.city || c.name))
      .map(c => {
        const cityLabel = c.city || c.name || ''
        const canon = getCanonicalCity(cityLabel)
        const cOverride = cityMap[canon]
        if (hasByRest && !cOverride) {
          return { ...c, city: cityLabel, name: cityLabel, count: 0, revenue: 0, grossRevenue: 0, share: 0 }
        }
        const rev = (hasByRest && cOverride) ? Math.round(cOverride.revenue) : c.revenue
        const grossRev = (hasByRest && cOverride) ? Math.round(cOverride.grossRevenue) : (c.grossRevenue || rev)
        const cnt = (hasByRest && cOverride) ? cOverride.count : c.count
        return {
          ...c,
          city: cityLabel,
          name: cityLabel,
          count: cnt,
          revenue: rev,
          grossRevenue: grossRev,
          channels: (hasByRest && cOverride?.channels) ? cOverride.channels : (c.channels || {}),
          locationsCount: cOverride ? cOverride.locationsCount : c.locationsCount,
          share: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 100
        }
      })

    const avgTicketVal = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0'
    const localCnt = chTotals.kiosk + chTotals.casierie
    const delivCnt = chTotals.glovo + chTotals.wolt + chTotals.bolt + chTotals.direct

    return {
      ...salesData,
      byRestaurant: hasByRest ? filteredByRest : rawByRest,
      brands: filteredBrands,
      cities: filteredCities,
      channels: hasByRest
        ? (salesData.channels || []).map(ch => ({
            ...ch,
            count: chTotals[ch.key] || 0,
            share: totalOrders > 0 ? Math.round(((chTotals[ch.key] || 0) / totalOrders) * 100) : 0
          }))
        : salesData.channels,
      local_vs_delivery: hasByRest
        ? {
            local: {
              count: localCnt,
              revenue: Math.round(totalRevenue * (totalOrders > 0 ? localCnt / totalOrders : 0)),
              share: totalOrders > 0 ? Math.round((localCnt / totalOrders) * 100) : 0
            },
            delivery: {
              count: delivCnt,
              revenue: Math.round(totalRevenue * (totalOrders > 0 ? delivCnt / totalOrders : 0)),
              share: totalOrders > 0 ? Math.round((delivCnt / totalOrders) * 100) : 0
            }
          }
        : salesData.local_vs_delivery,
      totals: hasByRest ? {
        ...(salesData.totals || {}),
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        totalGrossRevenue: Math.round(totalGrossRevenue),
        avgTicket: avgTicketVal,
        avgOrderValue: Math.round(Number(avgTicketVal))
      } : salesData.totals
    }
  }, [salesData, hasScopeRestrictions, canAccessCity, canAccessBrand, canAccessRestaurant])

  return { salesData: scopedSalesData, loading, error, refetch: fetchSales }
}
