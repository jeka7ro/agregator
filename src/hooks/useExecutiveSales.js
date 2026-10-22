import { useState, useEffect, useCallback } from 'react'
import { getApiUrl } from '../lib/api'

export function useExecutiveSales(period = 'this_month', limit = 2000) {
  const [salesData, setSalesData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(getApiUrl(`/api/sales/executive-summary?period=${encodeURIComponent(period)}&limit=${limit}`))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setSalesData(data)
        setError(null)
      } else {
        throw new Error(data.error || 'Failed to fetch sales summary')
      }
    } catch (err) {
      console.warn('[useExecutiveSales] Fetch error:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [period, limit])

  useEffect(() => {
    fetchSales()
    const timer = setInterval(fetchSales, 30000) // auto-refresh every 30s
    return () => clearInterval(timer)
  }, [fetchSales])

  return { salesData, loading, error, refetch: fetchSales }
}
