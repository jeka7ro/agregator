import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getApiUrl } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { getCanonicalCity } from '../lib/orderUtils'
import { getBrandInfo } from '../components/BrandAvatar'

const DEFAULT_KPIS = {
  today_sales: 0,
  today_orders_count: 0,
  kiosk_count: 0,
  casierie_count: 0,
  aggregators_count: 0,
  own_delivery_count: 0,
  active_in_kitchen: 0,
  waiting_courier: 0,
  on_way_count: 0,
  delivered_count: 0,
  problems_count: 0,
  avg_kitchen_time: 14.5,
  avg_courier_wait_time: 6.8,
  avg_delivery_time: 23.4,
  avg_total_time: 44.7
}

function getInitialState(period) {
  try {
    if (typeof window !== 'undefined' && period === 'today') {
      const cached = sessionStorage.getItem('dispatch_cache_today')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && Array.isArray(parsed.orders) && parsed.orders.length > 0) {
          return {
            period: parsed.period || 'today',
            period_label: parsed.period_label || 'Azi',
            period_date_range: parsed.period_date_range || '',
            kpis: parsed.kpis || DEFAULT_KPIS,
            orders: parsed.orders,
            stop_matrix: parsed.stop_matrix || [],
            stop_audit_log: parsed.stop_audit_log || []
          }
        }
      }
    }
  } catch (_) {}

  return {
    period: 'today',
    period_label: 'Azi',
    period_date_range: '',
    kpis: { ...DEFAULT_KPIS },
    orders: [],
    stop_matrix: [],
    stop_audit_log: []
  }
}

export function useLiveDispatch({ city = 'all', brand = 'all', restaurantId = 'all', channel = 'all', period = 'today', autoRefreshSeconds = 300 } = {}) {
  const { user, canAccessCity, canAccessBrand, canAccessRestaurant } = useAuth()
  const [data, setData] = useState(() => getInitialState(period))
  const [loading, setLoading] = useState(() => data.orders.length === 0)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(autoRefreshSeconds)
  const timerRef = useRef(null)
  const countdownRef = useRef(autoRefreshSeconds)
  const isFetchingRef = useRef(false)
  const fetchDataRef = useRef(null)

  const fetchData = useCallback(async (silent = false) => {
    countdownRef.current = autoRefreshSeconds
    setSecondsUntilRefresh(autoRefreshSeconds)

    if (isFetchingRef.current && silent) return
    isFetchingRef.current = true

    try {
      if (!silent) setLoading(true)

      const params = new URLSearchParams()
      if (city && city !== 'all') params.set('city', city)
      if (brand && brand !== 'all') params.set('brand', brand)
      if (restaurantId && restaurantId !== 'all') params.set('restaurant_id', restaurantId)
      if (channel && channel !== 'all') params.set('channel', channel)
      if (period && period !== 'all') params.set('period', period)
      const fetchLimit = (period === 'today' || period === 'yesterday') ? '3500' : '2500'
      params.set('limit', fetchLimit)
      params.set('_t', String(Date.now()))

      const res = await fetch(getApiUrl(`/api/dispatch/live?${params.toString()}`))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      if (json && json.success) {
        const incomingOrders = Array.isArray(json.orders) ? json.orders : []

        setData(prev => {
          if (incomingOrders.length === 0 && prev.orders.length > 10 && (period === 'today')) {
            return prev
          }

          const nextData = {
            period: json.period || period,
            period_label: json.period_label || '',
            period_date_range: json.period_date_range || '',
            kpis: json.kpis || (incomingOrders.length === 0 ? prev.kpis : DEFAULT_KPIS),
            orders: incomingOrders.length > 0 ? incomingOrders : prev.orders,
            stop_matrix: json.stop_matrix || prev.stop_matrix || [],
            stop_audit_log: json.stop_audit_log || prev.stop_audit_log || []
          }

          if (period === 'today' && incomingOrders.length > 0 && (!city || city === 'all') && (!brand || brand === 'all')) {
            try {
              sessionStorage.setItem('dispatch_cache_today', JSON.stringify(nextData))
            } catch (_) {}
          }

          return nextData
        })
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.warn('[useLiveDispatch] Error fetching dispatch data:', err)
      setLastUpdated(new Date())
    } finally {
      isFetchingRef.current = false
      setLoading(false)
    }
  }, [city, brand, restaurantId, channel, period, autoRefreshSeconds])

  fetchDataRef.current = fetchData

  useEffect(() => {
    fetchData(false)
  }, [fetchData])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!isAutoRefreshEnabled || autoRefreshSeconds <= 0) {
      return
    }

    countdownRef.current = autoRefreshSeconds
    setSecondsUntilRefresh(autoRefreshSeconds)

    timerRef.current = setInterval(() => {
      // Nu consuma resurse când tab-ul este în fundal sau în pauza nocturnă 22:00 - 10:00
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

      if (countdownRef.current <= 1) {
        countdownRef.current = autoRefreshSeconds
        setSecondsUntilRefresh(autoRefreshSeconds)
        if (fetchDataRef.current) {
          fetchDataRef.current(true)
        }
      } else {
        countdownRef.current -= 1
        setSecondsUntilRefresh(countdownRef.current)
      }
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isAutoRefreshEnabled, autoRefreshSeconds])

  const scopedOrders = useMemo(() => {
    const raw = data.orders || []
    if (!user || user.role === 'admin') return raw
    const allC = (user.allowed_cities || ['all']).includes('all')
    const allB = (user.allowed_brands || ['all']).includes('all')
    const allR = (user.allowed_restaurants || ['all']).includes('all')
    if (allC && allB && allR) return raw

    return raw.filter(ord => {
      const ordCity = getCanonicalCity(ord.restaurant_city || ord.city || ord.restaurant_name || '')
      const ordBrand = ord.brand_name || ord.brand || getBrandInfo({ name: ord.restaurant_name, brand: ord.brand_name })?.name || ''
      if (!allC && !canAccessCity(ordCity || ord.restaurant_city || ord.restaurant_name)) return false
      if (!allB && !canAccessBrand(ordBrand || ord.restaurant_name)) return false
      if (!allR && ord.restaurant_id && !canAccessRestaurant(ord.restaurant_id)) return false
      return true
    })
  }, [data.orders, user, canAccessCity, canAccessBrand, canAccessRestaurant])

  const scopedStopMatrix = useMemo(() => {
    const raw = data.stop_matrix || []
    if (!user || user.role === 'admin') return raw
    const allC = (user.allowed_cities || ['all']).includes('all')
    const allB = (user.allowed_brands || ['all']).includes('all')
    const allR = (user.allowed_restaurants || ['all']).includes('all')
    if (allC && allB && allR) return raw

    return raw.filter(st => {
      const stCity = getCanonicalCity(st.city || st.restaurant_city || st.restaurant_name || st.name || '')
      const stBrand = st.brand || st.brand_name || getBrandInfo({ name: st.restaurant_name || st.name, brand: st.brand })?.name || ''
      if (!allC && !canAccessCity(stCity || st.city || st.restaurant_name || st.name)) return false
      if (!allB && !canAccessBrand(stBrand || st.restaurant_name || st.name)) return false
      if (!allR && st.restaurant_id && !canAccessRestaurant(st.restaurant_id)) return false
      return true
    })
  }, [data.stop_matrix, user, canAccessCity, canAccessBrand, canAccessRestaurant])

  const scopedKpis = useMemo(() => {
    if (!user || user.role === 'admin') return data.kpis
    const allC = (user.allowed_cities || ['all']).includes('all')
    const allB = (user.allowed_brands || ['all']).includes('all')
    const allR = (user.allowed_restaurants || ['all']).includes('all')
    if (allC && allB && allR) return data.kpis

    const list = scopedOrders || []
    let todaySales = 0
    let kioskCount = 0
    let casierieCount = 0
    let aggregatorsCount = 0
    let ownDeliveryCount = 0
    let activeInKitchen = 0
    let waitingCourier = 0
    let onWayCount = 0
    let deliveredCount = 0
    let problemsCount = 0
    let kSum = 0, kCnt = 0
    let wSum = 0, wCnt = 0
    let dSum = 0, dCnt = 0
    let tSum = 0, tCnt = 0

    list.forEach(o => {
      todaySales += Number(o.total_amount || 0)
      const ch = String(o.channel_type || '').toLowerCase()
      const pl = String(o.platform || '').toLowerCase()
      if (ch === 'kiosk' || pl === 'kiosk') kioskCount++
      else if (ch === 'casierie' || pl === 'casierie' || pl === 'in-store') casierieCount++
      else if (ch === 'own_delivery') ownDeliveryCount++
      else aggregatorsCount++

      if (o.stage === 'wait_cooking' || o.stage === 'cooking') activeInKitchen++
      else if (o.stage === 'ready') waitingCourier++
      else if (o.stage === 'on_way') onWayCount++
      else if (o.stage === 'delivered') deliveredCount++

      if (o.has_problem || o.sla_breached) problemsCount++

      if (Number(o.kitchen_minutes) > 0) { kSum += Number(o.kitchen_minutes); kCnt++ }
      if (Number(o.courier_wait_minutes) > 0) { wSum += Number(o.courier_wait_minutes); wCnt++ }
      if (Number(o.delivery_minutes) > 0) { dSum += Number(o.delivery_minutes); dCnt++ }
      if (Number(o.total_minutes || o.lead_time_minutes) > 0) { tSum += Number(o.total_minutes || o.lead_time_minutes); tCnt++ }
    })

    return {
      ...data.kpis,
      today_sales: Math.round(todaySales * 100) / 100,
      today_orders_count: list.length,
      kiosk_count: kioskCount,
      casierie_count: casierieCount,
      aggregators_count: aggregatorsCount,
      own_delivery_count: ownDeliveryCount,
      active_in_kitchen: activeInKitchen,
      waiting_courier: waitingCourier,
      on_way_count: onWayCount,
      delivered_count: deliveredCount,
      problems_count: problemsCount,
      avg_kitchen_time: kCnt > 0 ? Number((kSum / kCnt).toFixed(1)) : (data.kpis?.avg_kitchen_time || 14.5),
      avg_courier_wait_time: wCnt > 0 ? Number((wSum / wCnt).toFixed(1)) : (data.kpis?.avg_courier_wait_time || 5.8),
      avg_delivery_time: dCnt > 0 ? Number((dSum / dCnt).toFixed(1)) : (data.kpis?.avg_delivery_time || 16.6),
      avg_total_time: tCnt > 0 ? Number((tSum / tCnt).toFixed(1)) : (data.kpis?.avg_total_time || 36.4)
    }
  }, [data.kpis, scopedOrders, user])

  return {
    kpis: scopedKpis,
    orders: scopedOrders,
    stopMatrix: scopedStopMatrix,
    stopAuditLog: data.stop_audit_log,
    period: data.period,
    periodLabel: data.period_label,
    periodDateRange: data.period_date_range,
    loading,
    lastUpdated,
    fetchData,
    isAutoRefreshEnabled,
    setIsAutoRefreshEnabled,
    secondsUntilRefresh
  }
}
