import { useState, useEffect, useCallback } from 'react'
import { getApiUrl } from '../lib/api'

export function useExecutiveSales(period = 'this_month', limit = 2000) {
  const [salesData, setSalesData] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(`exec_sales_${period}`)
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
      const res = await fetch(getApiUrl(`/api/sales/executive-summary?period=${encodeURIComponent(period)}&limit=${limit}`))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data && data.success) {
        setSalesData(data)
        setError(null)
        try {
          sessionStorage.setItem(`exec_sales_${period}`, JSON.stringify(data))
        } catch (_) {}
      } else {
        throw new Error(data?.error || 'Failed to fetch sales summary')
      }
    } catch (err) {
      console.warn('[useExecutiveSales] Fetch error:', err.message)
      setError(err.message)
      // Anti-Wipe: fallback la cache dacă serverul are un glitch temporar
      try {
        const cached = sessionStorage.getItem(`exec_sales_${period}`)
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
  }, [period, limit, salesData])

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`exec_sales_${period}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && parsed.success) {
          setSalesData(parsed)
        }
      }
    } catch (_) {}
    fetchSales()
    const timer = setInterval(fetchSales, 30000) // auto-refresh every 30s
    return () => clearInterval(timer)
  }, [period, limit])

  return { salesData, loading, error, refetch: fetchSales }
}
