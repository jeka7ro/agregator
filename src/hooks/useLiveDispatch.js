import { useState, useEffect, useCallback, useRef } from 'react'
import { getApiUrl } from '../lib/api'

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

export function useLiveDispatch({ city = 'all', brand = 'all', restaurantId = 'all', channel = 'all', period = 'today', autoRefreshSeconds = 15 } = {}) {
  const [data, setData] = useState(() => getInitialState(period))
  const [loading, setLoading] = useState(() => data.orders.length === 0)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true)
  const timerRef = useRef(null)

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent && data.orders.length === 0) setLoading(true)

      const params = new URLSearchParams()
      if (city && city !== 'all') params.set('city', city)
      if (brand && brand !== 'all') params.set('brand', brand)
      if (restaurantId && restaurantId !== 'all') params.set('restaurant_id', restaurantId)
      if (channel && channel !== 'all') params.set('channel', channel)
      if (period && period !== 'all') params.set('period', period)
      const fetchLimit = (period === 'today' || period === 'yesterday') ? '3500' : '2500'
      params.set('limit', fetchLimit)

      const res = await fetch(getApiUrl(`/api/dispatch/live?${params.toString()}`))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      if (json && json.success) {
        const incomingOrders = Array.isArray(json.orders) ? json.orders : []

        setData(prev => {
          // Anti-Wipe Resilience Guard:
          // Dacă pe ecran aveam deja comenzi live (>10) și primim un răspuns gol pentru perioada "today",
          // este o eroare tranzitorie de DB/rețea. Păstrăm datele existente pentru a nu cauza ecran negru utilizatorului!
          if (incomingOrders.length === 0 && prev.orders.length > 10 && (period === 'today')) {
            console.warn('[useLiveDispatch] Server returned 0 orders while active orders exist. Retaining cached orders.')
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

          // Salvăm în sessionStorage pentru persistență instantă la refresh
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
      // La eroare de rețea sau timeout, NU ștergem datele existente din starea locală
    } finally {
      setLoading(false)
    }
  }, [city, brand, restaurantId, channel, period, data.orders.length])

  useEffect(() => {
    fetchData(false)
  }, [fetchData])

  useEffect(() => {
    if (!isAutoRefreshEnabled || autoRefreshSeconds <= 0) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      fetchData(true)
    }, autoRefreshSeconds * 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isAutoRefreshEnabled, autoRefreshSeconds, fetchData])

  return {
    kpis: data.kpis,
    orders: data.orders,
    stopMatrix: data.stop_matrix,
    stopAuditLog: data.stop_audit_log,
    period: data.period,
    periodLabel: data.period_label,
    periodDateRange: data.period_date_range,
    loading,
    lastUpdated,
    fetchData,
    isAutoRefreshEnabled,
    setIsAutoRefreshEnabled
  }
}
