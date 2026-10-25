import { useState, useEffect, useCallback, useRef } from 'react'
import { getApiUrl } from '../lib/api'

export function useLiveDispatch({ city = 'all', brand = 'all', restaurantId = 'all', autoRefreshSeconds = 15 } = {}) {
  const [data, setData] = useState({
    kpis: {
      today_sales: 0,
      today_orders_count: 0,
      active_in_kitchen: 0,
      waiting_courier: 0,
      on_way_count: 0,
      delivered_count: 0,
      problems_count: 0,
      avg_kitchen_time: 14.5,
      avg_courier_wait_time: 6.8,
      avg_delivery_time: 23.4,
      avg_total_time: 44.7
    },
    orders: [],
    stop_matrix: [],
    stop_audit_log: []
  })

  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true)
  const timerRef = useRef(null)

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)

      const params = new URLSearchParams()
      if (city && city !== 'all') params.set('city', city)
      if (brand && brand !== 'all') params.set('brand', brand)
      if (restaurantId && restaurantId !== 'all') params.set('restaurant_id', restaurantId)
      params.set('limit', '100')

      const res = await fetch(getApiUrl(`/api/dispatch/live?${params.toString()}`))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      if (json.success) {
        setData({
          kpis: json.kpis || {},
          orders: json.orders || [],
          stop_matrix: json.stop_matrix || [],
          stop_audit_log: json.stop_audit_log || []
        })
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.warn('[useLiveDispatch] Error fetching dispatch data:', err)
    } finally {
      setLoading(false)
    }
  }, [city, brand, restaurantId])

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
    loading,
    lastUpdated,
    fetchData,
    isAutoRefreshEnabled,
    setIsAutoRefreshEnabled
  }
}
