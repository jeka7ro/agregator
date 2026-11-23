import { useState, useEffect, useMemo, useRef } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useAuth } from '../lib/AuthContext'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  BarChart3,
  PieChart,
  Flame,
  MapPin,
  Store,
  TrendingUp,
  ShoppingBag,
  Filter,
  X,
  RefreshCw,
  UtensilsCrossed,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight
} from 'lucide-react'
import BrandAvatar, { cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import AppleDateRangePicker, { formatYmdRangeDisplay, translateRoDateRange } from '../components/AppleDateRangePicker'
import { getProductImage } from '../lib/productImages'
import { getCanonicalCity, escapeCsvCell } from '../lib/orderUtils'
import { getApiUrl } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

function StatusBadge({ status }) {
  const { t } = useLanguage()
  const isOnline = status === 'available' || status === 'open' || status === 'online'
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border inline-flex items-center gap-1.5 shadow-2xs ${isOnline
      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
      : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
      }`}>
      {isOnline ? (
        <>
          <CheckCircle2 size={12} className="shrink-0" />
          <span className="whitespace-nowrap">{t ? t('common.online', 'Online') : 'Online'}</span>
        </>
      ) : (
        <>
          <XCircle size={12} className="shrink-0" />
          <span className="whitespace-nowrap">{status === 'error' ? (t ? t('common.error', 'Eroare') : 'Eroare') : (t ? t('common.stopped', 'Oprit') : 'Oprit')}</span>
        </>
      )}
    </span>
  )
}

function ProductPhoto({ src, name, brand }) {
  const [failed, setFailed] = useState(false)
  const resolvedSrc = useMemo(() => getProductImage(name, brand, src), [src, name, brand])

  return (
    <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shrink-0 flex items-center justify-center shadow-2xs group">
      {!failed && resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name || 'Produs'}
          className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
          <BrandAvatar brand={brand} size={24} />
        </div>
      )}
    </div>
  )
}

// Interactive SVG Donut Component
function InteractiveDonut({ data = [], activeKey, onSelect, centerTitle, centerValue, isDark }) {
  const [hovered, setHovered] = useState(null)
  const total = useMemo(() => data.reduce((sum, d) => sum + (Number(d.value) || 0), 0), [data])

  const size = 220
  const strokeWidth = 26
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  let accumulatedPercent = 0
  const slices = data.map((item) => {
    const val = Number(item.value) || 0
    const percent = total > 0 ? val / total : 0
    const strokeDasharray = `${percent * circumference} ${circumference}`
    const strokeDashoffset = -accumulatedPercent * circumference
    accumulatedPercent += percent

    const isSelected = activeKey === item.key
    const isHover = hovered === item.key

    return {
      ...item,
      val,
      percent,
      strokeDasharray,
      strokeDashoffset,
      isSelected,
      isHover
    }
  })

  const currentHoverItem = slices.find(s => s.key === hovered) || slices.find(s => s.key === activeKey)

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={isDark ? '#1E293B' : '#F1F5F9'}
            strokeWidth={strokeWidth}
          />
          {slices.map((slice) => (
            <circle
              key={slice.key}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={slice.color}
              strokeWidth={slice.isHover || slice.isSelected ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              strokeLinecap="round"
              className="cursor-pointer transition-all duration-300 hover:opacity-90"
              onMouseEnter={() => setHovered(slice.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(slice.key === activeKey ? null : slice.key)}
            />
          ))}
        </svg>

        {/* Center info */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {currentHoverItem ? currentHoverItem.label : centerTitle}
          </span>
          <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {currentHoverItem
              ? `${Math.round(currentHoverItem.val).toLocaleString('ro-RO')} ${currentHoverItem.unit || ''}`
              : centerValue}
          </span>
          {currentHoverItem && (
            <span className="text-xs font-bold text-emerald-500 mt-0.5">
              {Math.round(currentHoverItem.percent * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Mini Legend */}
      <div className="grid grid-cols-2 gap-2 mt-4 w-full">
        {slices.map((slice) => (
          <button
            key={slice.key}
            onClick={() => onSelect(slice.key === activeKey ? null : slice.key)}
            className={`flex items-center justify-between p-1.5 px-2 rounded-xl text-xs transition-all ${activeKey === slice.key
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-bold scale-[1.02]'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium'
              }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="truncate">{slice.label}</span>
            </div>
            <span className="text-[11px] font-bold opacity-80 ml-1">
              {Math.round(slice.percent * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Reports() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const { user, canAccessCity, canAccessBrand, canAccessRestaurant, hasScopeRestrictions } = useAuth()

  // Main Tabs: 'analytics' (Executive Suite) vs 'audit' (Scan Logs)
  const [activeTab, setActiveTab] = useState('analytics')

  // Period Selector for Analytics
  const [period, setPeriod] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const p = sp.get('period')
      if (p === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(sp.get('from') || '')) return 'custom'
      if (p) return p
    } catch (_) { }
    return 'this_week'
  })
  const [customRange, setCustomRange] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const f = sp.get('from')
      const tVal = sp.get('to') || f
      if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
        return { from: f, to: (tVal && /^\d{4}-\d{2}-\d{2}$/.test(tVal)) ? tVal : f }
      }
    } catch (_) { }
    return null
  })
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(() => !analyticsData)

  // Cross-Filter States
  const [filterCity, setFilterCity] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('city')
      if (p && p !== 'all') return p
    } catch (_) { }
    return null
  })
  const [filterBrand, setFilterBrand] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('brand')
      if (p && p !== 'all') return p
    } catch (_) { }
    return null
  })
  const [filterChannel, setFilterChannel] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('channel')
      if (p && p !== 'all') return p
    } catch (_) { }
    return null
  })
  const [filterLocation, setFilterLocation] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('location')
      if (p && p !== 'all') return p
    } catch (_) {}
    return null
  })
  const [filterWorkpoint, setFilterWorkpoint] = useState(null)
  const [filterSlot, setFilterSlot] = useState(null) // { day, hour }
  const [hoveredHeatCell, setHoveredHeatCell] = useState(null)
  const [knownLocations, setKnownLocations] = useState([])

  const updateUrlFilter = (key, value) => {
    try {
      const url = new URL(window.location.href)
      if (value && value !== 'all') {
        url.searchParams.set(key, value)
      } else {
        url.searchParams.delete(key)
      }
      window.history.replaceState({}, '', url.toString())
    } catch (_) { }
  }

  const handleSetBrand = (b) => {
    setFilterBrand(b)
    updateUrlFilter('brand', b)
  }

  const handleSetCity = (c) => {
    setFilterCity(c)
    updateUrlFilter('city', c)
  }

  const handleSetLocation = (loc) => {
    const val = loc && loc !== 'all' ? loc : null
    setFilterLocation(val)
    updateUrlFilter('location', val)
  }

  const handleSetChannel = (ch) => {
    setFilterChannel(ch)
    updateUrlFilter('channel', ch)
  }

  const handleSetPeriod = (p) => {
    setPeriod(p)
    setCustomRange(null)
    try {
      const url = new URL(window.location.href)
      if (p && p !== 'all') url.searchParams.set('period', p)
      else url.searchParams.delete('period')
      url.searchParams.delete('from')
      url.searchParams.delete('to')
      window.history.replaceState({}, '', url.toString())
    } catch (_) { }
  }

  const handleSelectCustomRange = ({ from, to }) => {
    if (!from) return
    const endDay = to || from
    setCustomRange({ from, to: endDay })
    setPeriod('custom')
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('period', 'custom')
      url.searchParams.set('from', from)
      url.searchParams.set('to', endDay)
      window.history.replaceState({}, '', url.toString())
    } catch (_) { }
  }

  useEffect(() => {
    const onPopState = () => {
      try {
        const sp = new URLSearchParams(window.location.search)
        const pPeriod = sp.get('period')
        const pFrom = sp.get('from')
        const pTo = sp.get('to') || pFrom
        if (pPeriod === 'custom' && pFrom && /^\d{4}-\d{2}-\d{2}$/.test(pFrom)) {
          setCustomRange({ from: pFrom, to: (pTo && /^\d{4}-\d{2}-\d{2}$/.test(pTo)) ? pTo : pFrom })
          setPeriod('custom')
        } else if (pPeriod) {
          setCustomRange(null)
          setPeriod(pPeriod)
        }
        const pCity = sp.get('city')
        setFilterCity(pCity && pCity !== 'all' ? pCity : null)
        const pBrand = sp.get('brand')
        setFilterBrand(pBrand && pBrand !== 'all' ? pBrand : null)
        const pChannel = sp.get('channel')
        setFilterChannel(pChannel && pChannel !== 'all' ? pChannel : null)
      } catch (_) { }
    }
    const onGlobalReset = () => {
      setFilterCity(null)
      setFilterLocation(null)
      setFilterBrand(null)
      setFilterChannel(null)
      setFilterWorkpoint(null)
      setFilterSlot(null)
      setPeriod('this_week')
      setCustomRange(null)
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('global-reset-filters', onGlobalReset)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('global-reset-filters', onGlobalReset)
    }
  }, [])

  // Search in workpoints
  const [searchWorkpoint, setSearchWorkpoint] = useState('')

  // Technical Audit Table States (Tab 2)
  const [auditData, setAuditData] = useState([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const auditLimit = 25

  // Fetch Executive Analytics Data (passes city scope + location/brand/channel filters so BOTH KPIs AND 24x7 Heatmap match 100%)
  const allowedCitiesKey = useMemo(() => {
    const allowedC = (user?.allowed_cities || ['all']).filter(c => c !== 'all')
    return allowedC.join(',')
  }, [user?.allowed_cities])

  const analyticsReqIdRef = useRef(0)
  const auditReqIdRef = useRef(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // Clamp URL-initialized city/brand filters to user scope if restricted
  useEffect(() => {
    if (!hasScopeRestrictions) return
    if (filterCity && !canAccessCity(filterCity)) setFilterCity(null)
    if (filterBrand && !canAccessBrand(filterBrand)) setFilterBrand(null)
  }, [hasScopeRestrictions, filterCity, filterBrand, canAccessCity, canAccessBrand])

  const fetchAnalytics = async () => {
    const reqId = ++analyticsReqIdRef.current
    setLoadingAnalytics(true)
    const params = new URLSearchParams({ period, limit: '10000' })
    if (period === 'custom' && customRange?.from) {
      params.set('from', customRange.from)
      if (customRange.to) params.set('to', customRange.to)
    }
    const effectiveCities = filterCity ? filterCity : allowedCitiesKey
    if (effectiveCities) params.set('cities', effectiveCities)
    if (filterLocation) params.set('location', filterLocation)
    if (filterWorkpoint) params.set('restaurant_id', filterWorkpoint)
    if (filterBrand) params.set('brand', filterBrand)
    if (filterChannel) params.set('channel', filterChannel)
    const cacheStorageKey = `reports_cache_v5_${params.toString()}`
    try {
      const res = await fetch(getApiUrl(`/api/sales/executive-summary?${params.toString()}`))
      const json = await res.json()
      if (!isMountedRef.current || reqId !== analyticsReqIdRef.current) return
      if (json.success) {
        setAnalyticsData(json)
        if (Array.isArray(json.availableLocations) && json.availableLocations.length > 0) {
          setKnownLocations(json.availableLocations)
        }
        try {
          sessionStorage.setItem(cacheStorageKey, JSON.stringify(json))
        } catch (_) { }
      } else {
        throw new Error(json.error || 'Failed to fetch executive summary')
      }
    } catch (err) {
      if (!isMountedRef.current || reqId !== analyticsReqIdRef.current) return
      console.error("Executive analytics fetch error:", err)
      try {
        const cached = sessionStorage.getItem(cacheStorageKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && parsed.success) {
            setAnalyticsData(parsed)
          }
        }
      } catch (_) { }
    } finally {
      if (isMountedRef.current && reqId === analyticsReqIdRef.current) setLoadingAnalytics(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams({ period, limit: '10000' })
    if (period === 'custom' && customRange?.from) {
      params.set('from', customRange.from)
      if (customRange.to) params.set('to', customRange.to)
    }
    const effectiveCities = filterCity ? filterCity : allowedCitiesKey
    if (effectiveCities) params.set('cities', effectiveCities)
    if (filterLocation) params.set('location', filterLocation)
    if (filterWorkpoint) params.set('restaurant_id', filterWorkpoint)
    if (filterBrand) params.set('brand', filterBrand)
    if (filterChannel) params.set('channel', filterChannel)
    const cacheStorageKey = `reports_cache_v5_${params.toString()}`
    try {
      const cached = sessionStorage.getItem(cacheStorageKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && parsed.success) {
          setAnalyticsData(parsed)
        }
      }
    } catch (_) { }
    fetchAnalytics()
    return () => {
      analyticsReqIdRef.current += 1
    }
  }, [period, customRange?.from, customRange?.to, allowedCitiesKey, filterCity, filterLocation, filterWorkpoint, filterBrand, filterChannel])

  // Fetch Audit Scan Logs (Tab 2) — respects city/brand/restaurant scope
  const fetchAuditLogs = async (p) => {
    const reqId = ++auditReqIdRef.current
    setLoadingAudit(true)
    const allowedC = (user?.allowed_cities || ['all']).filter(c => c !== 'all')
    const citiesQuery = allowedC.length > 0 ? `&cities=${encodeURIComponent(allowedC.join(','))}` : ''
    const filterScopedRows = (rows) => {
      if (!hasScopeRestrictions) return rows || []
      return (rows || []).filter(row => {
        const c = row.restaurants?.city || row.restaurants?.name || ''
        if (c && !canAccessCity(c)) return false
        if (row.restaurants?.name && !canAccessBrand(row.restaurants.name)) return false
        if (row.restaurant_id && !canAccessRestaurant(row.restaurant_id)) return false
        return true
      })
    }
    try {
      const res = await fetch(getApiUrl(`/api/reports/verifications?page=${p}&limit=${auditLimit}${citiesQuery}`))
      const json = await res.json()
      if (!isMountedRef.current || reqId !== auditReqIdRef.current) return
      if (json.success) {
        const scoped = filterScopedRows(json.data)
        setAuditData(scoped)
        setAuditTotal(hasScopeRestrictions && allowedC.length === 0 ? scoped.length : (json.total ?? scoped.length))
        setAuditTotalPages(json.totalPages || 1)
        setAuditPage(json.page || p)
      }
    } catch (err) {
      if (!isMountedRef.current || reqId !== auditReqIdRef.current) return
      console.warn("API audit fetch failed, falling back to Supabase:", err)
      try {
        const offset = (p - 1) * auditLimit
        const { data: dbData, count } = await supabase
          .from('monitoring_checks')
          .select('*, restaurants(name, city)', { count: 'exact' })
          .neq('final_status', 'error')
          .order('checked_at', { ascending: false })
          .range(offset, offset + auditLimit - 1)

        if (!isMountedRef.current || reqId !== auditReqIdRef.current) return
        if (dbData) {
          const scoped = filterScopedRows(dbData)
          setAuditData(scoped)
          setAuditTotal(hasScopeRestrictions ? scoped.length : (count || scoped.length))
          setAuditTotalPages(Math.ceil((count || scoped.length) / auditLimit) || 1)
          setAuditPage(p)
        }
      } catch (dbErr) {
        console.error("Supabase fallback failed:", dbErr)
      }
    } finally {
      if (isMountedRef.current && reqId === auditReqIdRef.current) setLoadingAudit(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs(auditPage)
    }
  }, [activeTab, auditPage])

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'
  const formatDate = (isoString) => {
    if (!isoString) return '-'
    const d = new Date(isoString)
    return d.toLocaleString(localeCode, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  const periodFormattedRange = useMemo(() => {
    if (!analyticsData?.period?.startDate || !analyticsData?.period?.endDate) {
      return analyticsData?.period?.dateRange || '-'
    }
    const s = new Date(analyticsData.period.startDate)
    const e = new Date(analyticsData.period.endDate)
    const sStr = s.toLocaleDateString(localeCode, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    const eStr = e.toLocaleDateString(localeCode, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    if (String(analyticsData.period.startDate).slice(0, 10) === String(analyticsData.period.endDate).slice(0, 10)) {
      return eStr
    }
    return `${sStr} - ${eStr}`
  }, [analyticsData, localeCode])
  const scopedWorkpoints = useMemo(() => {
    if (!analyticsData?.workpoints) return []
    const targetCityCanon = filterCity ? getCanonicalCity(filterCity) : null
    return analyticsData.workpoints.filter(wp => {
      const wpCity = wp.city || ''
      const wpCityCanon = getCanonicalCity(wpCity || wp.name || '')
      const wpBrand = wp.brand || ''
      const wpName = wp.name || ''
      if (hasScopeRestrictions) {
        if (!canAccessCity(wpCityCanon || wpCity)) return false
        if (!canAccessBrand(wpBrand || wpName)) return false
        if (!canAccessRestaurant(wp.id)) return false
      }
      if (targetCityCanon && wpCityCanon !== targetCityCanon && !wpCity.toLowerCase().includes(filterCity.toLowerCase())) return false
      if (filterBrand && !wpBrand.toLowerCase().includes(filterBrand.toLowerCase())) return false
      if (filterWorkpoint && wp.id !== filterWorkpoint) return false
      if (filterChannel && (!wp.channels || !wp.channels[filterChannel] || wp.channels[filterChannel] <= 0)) return false
      return true
    })
  }, [analyticsData, hasScopeRestrictions, canAccessCity, canAccessBrand, canAccessRestaurant, filterCity, filterBrand, filterChannel, filterWorkpoint])

  const filteredWorkpoints = useMemo(() => {
    if (!searchWorkpoint.trim()) return scopedWorkpoints
    const q = searchWorkpoint.toLowerCase()
    return scopedWorkpoints.filter(wp =>
      (wp.name || '').toLowerCase().includes(q) ||
      (wp.city || '').toLowerCase().includes(q) ||
      (wp.brand || '').toLowerCase().includes(q)
    )
  }, [scopedWorkpoints, searchWorkpoint])

  const displaySummary = useMemo(() => {
    const hasStructFilter = Boolean(hasScopeRestrictions || filterCity || filterBrand || filterChannel || filterWorkpoint)
    if (!hasStructFilter) {
      return {
        totalRevenue: analyticsData?.totals?.totalRevenue || 0,
        totalOrders: analyticsData?.totals?.totalOrders || 0,
        avgTicket: analyticsData?.totals?.avgTicket || 0,
        localShare: analyticsData?.local_vs_delivery?.local?.share || 0,
        deliveryShare: analyticsData?.local_vs_delivery?.delivery?.share || 0,
        topBrandName: analyticsData?.brands?.[0]?.name || 'Roll Master',
        topBrandCount: analyticsData?.brands?.[0]?.count || 0,
        topBrandRev: analyticsData?.brands?.[0]?.revenue || 0,
        channels: analyticsData?.channels || [],
        brands: analyticsData?.brands || [],
        cities: analyticsData?.cities || []
      }
    }
    let rev = 0
    let ord = 0
    let locCnt = 0
    let delCnt = 0
    const chTotals = { kiosk: 0, casierie: 0, glovo: 0, wolt: 0, bolt: 0, direct: 0 }
    const bMap = {}
    const cMap = {}
    for (const wp of scopedWorkpoints) {
      const wpCnt = filterChannel ? (wp.channels?.[filterChannel] || 0) : (wp.count || 0)
      const wpRatio = wp.count > 0 ? wpCnt / wp.count : 1
      const wpRev = Math.round((wp.revenue || 0) * wpRatio)
      ord += wpCnt
      rev += wpRev
      if (filterChannel) {
        chTotals[filterChannel] = (chTotals[filterChannel] || 0) + wpCnt
        if (filterChannel === 'kiosk' || filterChannel === 'casierie') locCnt += wpCnt
        else delCnt += wpCnt
      } else {
        Object.keys(chTotals).forEach(k => {
          chTotals[k] += Number(wp.channels?.[k] || 0)
        })
        locCnt += (wp.channels?.kiosk || 0) + (wp.channels?.casierie || 0)
        delCnt += (wp.channels?.glovo || 0) + (wp.channels?.wolt || 0) + (wp.channels?.bolt || 0) + (wp.channels?.direct || 0)
      }
      const b = wp.brand || 'Roll Master'
      if (!bMap[b]) bMap[b] = { name: b, count: 0, revenue: 0 }
      bMap[b].count += wpCnt
      bMap[b].revenue += wpRev

      const c = getCanonicalCity(wp.city || wp.name || '') || wp.city || 'Alte Orașe'
      if (!cMap[c]) cMap[c] = { city: c, name: c, count: 0, revenue: 0 }
      cMap[c].count += wpCnt
      cMap[c].revenue += wpRev
    }
    const topB = Object.values(bMap).sort((a, b) => b.revenue - a.revenue)[0] || { name: 'Roll Master', count: 0, revenue: 0 }
    const totCh = locCnt + delCnt
    const filteredChannels = (analyticsData?.channels || []).map(ch => ({
      ...ch,
      count: chTotals[ch.key] || 0,
      share: ord > 0 ? Math.round(((chTotals[ch.key] || 0) / ord) * 100) : 0
    }))
    const filteredBrands = (analyticsData?.brands || []).map(b => ({
      ...b,
      count: bMap[b.name]?.count || 0,
      revenue: bMap[b.name]?.revenue || 0,
      share: rev > 0 ? Math.round(((bMap[b.name]?.revenue || 0) / rev) * 100) : 0
    })).filter(b => b.count > 0 || !hasScopeRestrictions)
    const filteredCities = Object.values(cMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(c => ({ ...c, share: rev > 0 ? Math.round((c.revenue / rev) * 100) : 0 }))

    return {
      totalRevenue: rev,
      totalOrders: ord,
      avgTicket: ord > 0 ? (rev / ord).toFixed(2) : '0',
      localShare: totCh > 0 ? Math.round((locCnt / totCh) * 100) : 0,
      deliveryShare: totCh > 0 ? Math.round((delCnt / totCh) * 100) : 0,
      topBrandName: topB.name,
      topBrandCount: topB.count,
      topBrandRev: topB.revenue,
      channels: filteredChannels,
      brands: filteredBrands,
      cities: filteredCities
    }
  }, [analyticsData, scopedWorkpoints, hasScopeRestrictions, filterCity, filterBrand, filterChannel, filterWorkpoint])

  // Cross-Filtered Top Products
  const filteredProducts = useMemo(() => {
    if (!analyticsData?.topProducts) return []
    return analyticsData.topProducts.filter(p => {
      const pBrand = p.brand || ''
      if (filterBrand && !pBrand.toLowerCase().includes(filterBrand.toLowerCase())) return false
      return true
    })
  }, [analyticsData, filterBrand])

  // Heatmap Data & Max Calculations
  const dayNames = useMemo(() => {
    if (language === 'ru') return ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
    if (language === 'en') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']
  }, [language])

  const dayShortNames = useMemo(() => {
    if (language === 'ru') return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    if (language === 'en') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum']
  }, [language])

  const heatmapMatrix = analyticsData?.heatmap || []
  const maxHeatCount = useMemo(() => {
    let max = 1
    for (const row of heatmapMatrix) {
      for (const cell of row) {
        if (cell.count > max) max = cell.count
      }
    }
    return max
  }, [heatmapMatrix])

  // Active filters count
  const hasActiveFilters = Boolean(filterCity || filterLocation || filterBrand || filterChannel || filterWorkpoint || filterSlot)

  const clearAllFilters = () => {
    setFilterCity(null)
    setFilterLocation(null)
    setFilterBrand(null)
    setFilterChannel(null)
    setFilterWorkpoint(null)
    setFilterSlot(null)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('city')
      url.searchParams.delete('location')
      url.searchParams.delete('brand')
      url.searchParams.delete('channel')
      window.history.replaceState({}, '', url.toString())
    } catch (_) { }
  }

  // Export CSV for Audit Logs
  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      let exportRows = auditData
      try {
        const allowedC = (user?.allowed_cities || ['all']).filter(c => c !== 'all')
        const citiesQuery = allowedC.length > 0 ? `&cities=${encodeURIComponent(allowedC.join(','))}` : ''
        const res = await fetch(getApiUrl(`/api/reports/verifications?page=1&limit=1000${citiesQuery}`))
        const json = await res.json()
        if (json.success && json.data) {
          exportRows = hasScopeRestrictions
            ? json.data.filter(row => {
                const c = row.restaurants?.city || row.restaurants?.name || ''
                if (c && !canAccessCity(c)) return false
                if (row.restaurants?.name && !canAccessBrand(row.restaurants.name)) return false
                if (row.restaurant_id && !canAccessRestaurant(row.restaurant_id)) return false
                return true
              })
            : json.data
        }
      } catch { }

      const headers = [
        t('reports.th_nr', 'Nr.'),
        t('reports.th_datetime', 'Data si Ora'),
        t('reports.th_city', 'Oras'),
        t('reports.th_location', 'Restaurant'),
        t('reports.th_platform', 'Platforma'),
        t('reports.th_status', 'Status'),
        t('reports.th_diagnostic', 'Diagnostic')
      ]

      const escapeCSV = escapeCsvCell

      const csvLines = [
        headers.map(escapeCSV).join(','),
        ...exportRows.map((row, idx) => [
          idx + 1,
          escapeCSV(formatDate(row.checked_at)),
          escapeCSV(row.restaurants?.city || '-'),
          escapeCSV(cleanRestaurantName(row.restaurants?.name) || '-'),
          escapeCSV(row.platform || '-'),
          escapeCSV(row.final_status === 'available' || row.final_status === 'open' ? 'Online' : 'Oprit'),
          escapeCSV(row.ui_error_message || '-')
        ].join(','))
      ]

      const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `raport_audit_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full space-y-6 pb-12">

      {/* Top Header & Master Switchers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {activeTab === 'analytics'
                  ? t('reports.executive_title', 'Rapoarte & Inteligență Operațională')
                  : t('reports.title', 'Jurnal & Rapoarte Scanări')}
              </h1>
            </div>
          </div>
        </div>

        {/* Tab Switcher — Apple Segmented Control */}
        <div className="flex items-center gap-2 self-start lg:self-center shrink-0 flex-nowrap">
          <div role="group" className="apple-segmented shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`apple-segment !h-8 !px-3.5 ${activeTab === 'analytics' ? 'apple-segment-active' : ''}`}
            >
              <Flame size={13} className="text-amber-500 shrink-0" />
              <span>{t('reports.tab_analytics', 'Vânzări & Heatmap')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`apple-segment !h-8 !px-3.5 ${activeTab === 'audit' ? 'apple-segment-active' : ''}`}
            >
              <Clock size={13} className="text-[#047857] dark:text-[#34D399] shrink-0" />
              <span>{t('reports.tab_audit', 'Jurnal Scanări')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => activeTab === 'analytics' ? fetchAnalytics() : fetchAuditLogs(auditPage)}
            disabled={loadingAnalytics || loadingAudit}
            className="apple-btn-secondary !w-8 !h-8 !p-0 shrink-0"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={(loadingAnalytics || loadingAudit) ? 'animate-spin text-[#047857] dark:text-[#34D399]' : ''} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE ANALYTICS & HEATMAP                                      */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">

          {/* Period Segmented Control & Location/Brand Filters */}
          <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-2.5 rounded-2xl border ${
            isDark ? 'bg-slate-900 border-white/[0.09]' : 'bg-white border-black/[0.06]'
          }`}>
            <div className="flex flex-wrap items-center gap-2">
              <AppleDateRangePicker
                period={period}
                customRange={customRange}
                displayLabel={
                  period === 'custom' && customRange?.from
                    ? formatYmdRangeDisplay(customRange.from, customRange.to || customRange.from, language)
                    : (analyticsData?.period?.dateRange ? translateRoDateRange(analyticsData.period.dateRange, language) : '')
                }
                onSelectRange={handleSelectCustomRange}
                onSelectPreset={handleSetPeriod}
                defaultPreset="this_week"
                align="left"
                variant="emerald"
              />
              <div role="group" className="apple-segmented">
                {[
                  { key: 'today', label: t('reports.period_today', 'Azi') },
                  { key: 'yesterday', label: t('reports.period_yesterday', 'Ieri') },
                  { key: 'this_week', label: t('reports.period_this_week', 'Săpt. Curentă') },
                  { key: 'this_month', label: t('reports.period_this_month', 'Luna Curentă') },
                  { key: 'last_month', label: t('reports.period_last_month', 'Luna Trecută') },
                  { key: 'this_year', label: t('reports.period_this_year', 'Anul Curent') },
                  { key: 'all', label: t('reports.period_all', 'Total Istoric') }
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSetPeriod(p.key)}
                    className={`apple-segment !h-[26px] !px-2.5 !text-[11px] ${
                      period === p.key ? 'apple-segment-active' : ''
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location & Brand Selectors (filters KPI cards + 24x7 Heatmap + Channels + Top Products) */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {knownLocations.length > 0 && (
                <div className="relative flex items-center">
                  <MapPin size={13} className={`absolute left-2.5 pointer-events-none ${filterLocation ? 'text-white' : 'text-emerald-500'}`} />
                  <select
                    value={filterLocation || 'all'}
                    onChange={(e) => handleSetLocation(e.target.value)}
                    className={`pl-7 pr-6 py-1.5 rounded-xl text-xs font-bold border outline-none cursor-pointer transition-all ${
                      filterLocation
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                      {language === 'ru'
                        ? `Все локации (${knownLocations.length})`
                        : language === 'en'
                          ? `All locations (${knownLocations.length})`
                          : `Toate locațiile (${knownLocations.length})`}
                    </option>
                    {knownLocations.map(loc => (
                      <option key={loc} value={loc} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative flex items-center">
                <Store size={13} className={`absolute left-2.5 pointer-events-none ${filterBrand ? 'text-white' : 'text-amber-500'}`} />
                <select
                  value={filterBrand || 'all'}
                  onChange={(e) => handleSetBrand(e.target.value === 'all' ? null : e.target.value)}
                  className={`pl-7 pr-6 py-1.5 rounded-xl text-xs font-bold border outline-none cursor-pointer transition-all ${
                    filterBrand
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                  }`}
                >
                  <option value="all" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                    {language === 'ru' ? 'Все бренды' : language === 'en' ? 'All brands' : 'Toate brandurile'}
                  </option>
                  {['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']
                    .filter(b => !hasScopeRestrictions || canAccessBrand(b))
                    .map(b => (
                      <option key={b} value={b} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                        {b}
                      </option>
                    ))}
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <X size={13} />
                  <span>{t('reports.clear_filters', 'Resetează Filtrele')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Cross-Filters Ribbon */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-xs">
              <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 mr-1 whitespace-nowrap">
                <Filter size={13} /> {t('reports.filter_active', 'Filtru activ')}:
              </span>
              {filterLocation && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-emerald-600 text-white whitespace-nowrap">
                  <MapPin size={11} /> {language === 'ru' ? 'Локация' : 'Locație'}: {filterLocation}
                  <button onClick={() => handleSetLocation(null)} className="hover:opacity-75"><X size={12} /></button>
                </span>
              )}
              {filterCity && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-indigo-600 text-white whitespace-nowrap">
                  {t('reports.filter_city_label', 'Oraș')}: {filterCity}
                  <button onClick={() => handleSetCity(null)} className="hover:opacity-75"><X size={12} /></button>
                </span>
              )}
              {filterBrand && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-emerald-600 text-white whitespace-nowrap">
                  {t('reports.filter_brand_label', 'Brand')}: {filterBrand}
                  <button onClick={() => handleSetBrand(null)} className="hover:opacity-75"><X size={12} /></button>
                </span>
              )}
              {filterChannel && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-amber-500 text-white whitespace-nowrap">
                  {t('reports.filter_channel_label', 'Canal')}: {filterChannel.toUpperCase()}
                  <button onClick={() => handleSetChannel(null)} className="hover:opacity-75"><X size={12} /></button>
                </span>
              )}
              {filterSlot && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-violet-600 text-white whitespace-nowrap">
                  {t('reports.filter_slot_label', 'Slot')}: {dayNames[filterSlot.day]} {String(filterSlot.hour).padStart(2, '0')}:00
                  <button onClick={() => setFilterSlot(null)} className="hover:opacity-75"><X size={12} /></button>
                </span>
              )}
              {filterWorkpoint && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-slate-700 text-white whitespace-nowrap">
                  {t('reports.filter_workpoint_label', 'Bucătărie')}: {filterWorkpoint.slice(0, 8)}...
                  <button onClick={() => setFilterWorkpoint(null)} className="hover:opacity-75"><X size={12} /></button>
                </span>
              )}
            </div>
          )}

          {/* Loading Skeleton / Real Analytics */}
          {loadingAnalytics ? (
            <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Loader2 size={40} className="animate-spin text-emerald-500 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Se compilează heatmap-ul și analizele multi-dimensionale...
              </p>
            </div>
          ) : (
            <>
              {/* ROW 1: Executive KPI Metrics Cards — Compact Laptop Rhythm */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Total Revenue */}
                <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[12px] font-medium mb-1">
                    <span className="truncate">{t('reports.total_revenue', 'Încasări Totale')}</span>
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <TrendingUp size={13} />
                    </div>
                  </div>
                  <div className="text-[20px] md:text-[22px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums leading-tight">
                    {Math.round(displaySummary.totalRevenue).toLocaleString(localeCode)}{' '}
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">RON</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 tabular-nums">
                    <span>{t('reports.avg_ticket_label', 'Bon mediu:')}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{displaySummary.avgTicket} RON</span>
                  </div>
                </div>

                {/* Total Orders */}
                <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[12px] font-medium mb-1">
                    <span className="truncate">{t('reports.total_orders', 'Volum Comenzi')}</span>
                    <div className="w-6 h-6 rounded-lg bg-[#047857]/12 text-[#047857] dark:bg-[#10B981]/18 dark:text-[#34D399] flex items-center justify-center shrink-0">
                      <ShoppingBag size={13} />
                    </div>
                  </div>
                  <div className="text-[20px] md:text-[22px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums leading-tight">
                    {displaySummary.totalOrders.toLocaleString(localeCode)}{' '}
                    <span className="text-xs font-medium text-slate-400">{t('reports.orders_unit', 'comenzi')}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 truncate tabular-nums">
                    <span>{t('reports.period_prefix', 'Perioada:')}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{periodFormattedRange}</span>
                  </div>
                </div>

                {/* Local vs Delivery Ratio */}
                <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[12px] font-medium mb-1">
                    <span className="truncate">{t('reports.channel_ratio_title', 'Canal: Local vs Delivery')}</span>
                    <div className="w-6 h-6 rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <UtensilsCrossed size={13} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 tabular-nums leading-tight">
                    <span className="text-[20px] font-bold text-amber-600 dark:text-amber-400">
                      {displaySummary.localShare}%
                    </span>
                    <span className="text-[11px] text-slate-400">{t('reports.channel_local', 'local')}</span>
                    <span className="text-slate-300 dark:text-slate-700">/</span>
                    <span className="text-[20px] font-bold text-emerald-600 dark:text-emerald-400">
                      {displaySummary.deliveryShare}%
                    </span>
                    <span className="text-[11px] text-slate-400">{t('reports.channel_delivery', 'delivery')}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden flex">
                    <div style={{ width: `${displaySummary.localShare}%` }} className="bg-amber-500 h-full" />
                    <div style={{ width: `${displaySummary.deliveryShare}%` }} className="bg-emerald-500 h-full" />
                  </div>
                </div>

                {/* Top Brand / Workpoint */}
                <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[12px] font-medium mb-1">
                    <span className="truncate">{t('reports.top_brand_title', 'Brand Lider')}</span>
                    <div className="w-6 h-6 rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                      <Sparkles size={13} />
                    </div>
                  </div>
                  <div className="text-[19px] md:text-[20px] font-bold text-slate-900 dark:text-white truncate leading-tight">
                    {displaySummary.topBrandName}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between gap-2 tabular-nums">
                    <span className="truncate">{displaySummary.topBrandCount.toLocaleString(localeCode)} {t('reports.orders_unit', 'comenzi')}</span>
                    <span className="font-semibold text-[#047857] dark:text-[#34D399] shrink-0">
                      {Math.round(displaySummary.topBrandRev).toLocaleString(localeCode)} RON
                    </span>
                  </div>
                </div>
              </div>

              {/* ROW 2: 24h x 7 Days Hourly Demand Heatmap — Laptop Compact */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Flame size={16} className="text-amber-500" />
                    {t('reports.heatmap_title', 'Heatmap Vânzări: Distribuție 24 Ore x 7 Zile')}
                  </h3>

                  {/* Heat Legend */}
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 shrink-0 whitespace-nowrap">
                    <span className="whitespace-nowrap">{t('reports.heat_low', 'Scăzut')}</span>
                    <div className="flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800" />
                      <span className="w-3.5 h-3.5 rounded bg-emerald-200 dark:bg-emerald-950" />
                      <span className="w-3.5 h-3.5 rounded bg-emerald-400 dark:bg-emerald-800" />
                      <span className="w-3.5 h-3.5 rounded bg-emerald-500 dark:bg-emerald-600" />
                      <span className="w-3.5 h-3.5 rounded bg-amber-500 dark:bg-amber-500" />
                    </div>
                    <span className="whitespace-nowrap">{t('reports.heat_high', 'Vârf Rush')}</span>
                  </div>
                </div>

                {/* Heatmap Grid Matrix */}
                <div className="overflow-x-auto pb-2 custom-scrollbar">
                  <div className="min-w-[760px]">
                    {/* Hours Header (00..23) */}
                    <div className="grid grid-cols-[80px_repeat(24,1fr)_70px] gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                      <div className="text-left whitespace-nowrap">{t('reports.heat_day_col', 'Zi')}</div>
                      {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className={h === 12 || h === 13 || h === 19 || h === 20 ? 'text-amber-500 font-black' : ''}>
                          {h}
                        </div>
                      ))}
                      <div className="text-right whitespace-nowrap">{t('reports.heat_total_col', 'Total')}</div>
                    </div>

                    {/* Day Rows */}
                    {heatmapMatrix.map((row, dayIdx) => {
                      const dayTotalOrders = row.reduce((s, c) => s + c.count, 0)
                      return (
                        <div
                          key={dayIdx}
                          className="grid grid-cols-[80px_repeat(24,1fr)_70px] gap-1 items-center mb-1.5"
                        >
                          {/* Day Label */}
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                            {dayShortNames[dayIdx]}
                          </div>

                          {/* 24 Hour Cells */}
                          {row.map((cell, hourIdx) => {
                            const isCellSelected = filterSlot?.day === dayIdx && filterSlot?.hour === hourIdx
                            const count = cell.count
                            const intensity = count > 0 ? count / maxHeatCount : 0

                            // Dynamic color classes based on intensity
                            let bgClass = isDark ? 'bg-slate-800/40 text-slate-600' : 'bg-slate-100 text-slate-400'
                            if (intensity > 0.7) {
                              bgClass = 'bg-amber-500 text-white font-black shadow-xs shadow-amber-500/30'
                            } else if (intensity > 0.45) {
                              bgClass = 'bg-emerald-500 text-white font-bold'
                            } else if (intensity > 0.2) {
                              bgClass = isDark ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-300 text-emerald-950 font-bold'
                            } else if (count > 0) {
                              bgClass = isDark ? 'bg-emerald-950/80 text-emerald-300' : 'bg-emerald-100 text-emerald-800 font-semibold'
                            }

                            return (
                              <button
                                key={hourIdx}
                                onClick={() => {
                                  if (isCellSelected) setFilterSlot(null)
                                  else setFilterSlot({ day: dayIdx, hour: hourIdx })
                                }}
                                onMouseEnter={() => setHoveredHeatCell({ day: dayIdx, hour: hourIdx, cell })}
                                onMouseLeave={() => setHoveredHeatCell(null)}
                                className={`h-8 rounded-lg flex items-center justify-center text-[10px] transition-all transform duration-150 relative ${bgClass} ${isCellSelected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#1C1C1E] scale-110 z-10' : 'hover:scale-105'
                                  }`}
                                title={`${dayNames[dayIdx]} ${hourIdx}:00 - ${count} ${t('reports.orders_unit', 'comenzi')} (${Math.round(cell.revenue).toLocaleString(localeCode)} RON)`}
                              >
                                {count > 0 ? count : ''}
                              </button>
                            )
                          })}

                          {/* Day Row Total */}
                          <div className="text-xs font-black text-slate-900 dark:text-white text-right">
                            {dayTotalOrders.toLocaleString(localeCode)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Heatmap Tooltip info box when hovered */}
                <div className="h-6 mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                  {hoveredHeatCell ? (
                    <div className="flex items-center gap-3 animate-fade-in font-semibold text-slate-800 dark:text-slate-200">
                      <span className="text-emerald-500 font-bold">
                        {dayNames[hoveredHeatCell.day]}, {String(hoveredHeatCell.hour).padStart(2, '0')}:00 - {String(hoveredHeatCell.hour + 1).padStart(2, '0')}:00:
                      </span>
                      <span>{hoveredHeatCell.cell.count} {t('reports.orders_unit', 'comenzi')}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {Math.round(hoveredHeatCell.cell.revenue).toLocaleString(localeCode)} RON
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      {t('reports.heat_hint', 'Trece mouse-ul peste orice căsuță sau fă click pentru a filtra analizele pe acea oră.')}
                    </span>
                  )}
                </div>
              </div>

              {/* ROW 3: Interactive Visual Donuts (Canale & Branduri) & Bar Chart (Top Orașe) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Card 1: Canale & Kiosks Donut */}
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <PieChart size={18} className="text-indigo-500" />
                        {t('reports.donut_channels', 'Distribuție Canale & Kiosk-uri')}
                      </span>
                      {filterChannel && (
                        <button onClick={() => handleSetChannel(null)} className="text-xs font-bold text-rose-500 hover:underline shrink-0 whitespace-nowrap">
                          {t('reports.clear_filters', 'Reset')}
                        </button>
                      )}
                    </h3>
                  </div>

                  <InteractiveDonut
                    data={(displaySummary.channels || []).map(ch => ({
                      key: ch.key,
                      label: ch.label,
                      value: ch.count,
                      unit: t('reports.orders_unit', 'comenzi'),
                      color: ch.color || '#3B82F6'
                    }))}
                    activeKey={filterChannel}
                    onSelect={(k) => handleSetChannel(k)}
                    centerTitle={t('reports.donut_center_orders', 'Total Comenzi')}
                    centerValue={(displaySummary.totalOrders || 0).toLocaleString(localeCode)}
                    isDark={isDark}
                  />
                </div>

                {/* Card 2: Proporție Branduri */}
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Layers size={18} className="text-emerald-500" />
                        {t('reports.donut_brands', 'Distribuție Branduri')}
                      </span>
                      {filterBrand && (
                        <button onClick={() => handleSetBrand(null)} className="text-xs font-bold text-rose-500 hover:underline shrink-0 whitespace-nowrap">
                          {t('reports.clear_filters', 'Reset')}
                        </button>
                      )}
                    </h3>
                  </div>

                  <InteractiveDonut
                    data={(displaySummary.brands || []).map(b => ({
                      key: b.name,
                      label: b.name,
                      value: b.revenue,
                      unit: 'RON',
                      color: b.color || '#10B981'
                    }))}
                    activeKey={filterBrand}
                    onSelect={(k) => handleSetBrand(k)}
                    centerTitle={t('reports.donut_center_sales', 'Total Vânzări')}
                    centerValue={`${Math.round((displaySummary.totalRevenue || 0) / 1000)}k RON`}
                    isDark={isDark}
                  />
                </div>

                {/* Card 3: Top Orașe (Click to filter by city) */}
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div className="mb-3">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <MapPin size={18} className="text-rose-500" />
                        {t('reports.bar_cities', 'Top Orașe & Hub-uri')}
                      </span>
                      {filterCity && (
                        <button onClick={() => handleSetCity(null)} className="text-xs font-bold text-rose-500 hover:underline shrink-0 whitespace-nowrap">
                          {t('reports.clear_filters', 'Reset')}
                        </button>
                      )}
                    </h3>
                  </div>

                  {/* Ranked list of top cities */}
                  <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
                    {(displaySummary.cities || []).map((ct, idx) => {
                      const isSelected = filterCity?.toLowerCase() === ct.city.toLowerCase()
                      const maxCityRev = displaySummary.cities?.[0]?.revenue || 1
                      const pct = Math.min(100, Math.round((ct.revenue / maxCityRev) * 100))

                      return (
                        <button
                          key={ct.city}
                          onClick={() => handleSetCity(isSelected ? null : ct.city)}
                          className={`w-full text-left p-2.5 rounded-2xl transition-all border ${isSelected
                            ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 shadow-xs'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent'
                            }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold mb-1">
                            <span className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black flex items-center justify-center text-slate-500 shrink-0">
                                {idx + 1}
                              </span>
                              <span className="truncate">{ct.city}</span>
                            </span>
                            <div className="text-right shrink-0 whitespace-nowrap">
                              <span className="text-emerald-600 dark:text-emerald-400 font-black">
                                {Math.round(ct.revenue).toLocaleString(localeCode)} RON
                              </span>
                              <span className="text-slate-400 text-[10px] ml-1.5 font-medium whitespace-nowrap">
                                ({ct.count} {t('reports.orders_short', 'com.')})
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>

              {/* ROW 4: Bestselling Products (de sus în jos) & Workpoints Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Top Produse (Bestsellers de sus în jos) */}
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShoppingBag size={18} className="text-amber-500" />
                      {t('reports.top_products', 'Top Produse (Bestsellers de sus în jos)')}
                    </h3>
                    <span className="text-xs font-bold text-slate-400 shrink-0 whitespace-nowrap">
                      {filteredProducts.length} {t('reports.products_unit', 'produse')}
                    </span>
                  </div>

                  <div className="overflow-y-auto max-h-[460px] pr-1 space-y-2.5 custom-scrollbar">
                    {filteredProducts.map((p, idx) => {
                      const maxProdRev = filteredProducts[0]?.revenue || 1
                      const pct = Math.min(100, Math.round((p.revenue / maxProdRev) * 100))

                      return (
                        <div
                          key={p.name + '_' + idx}
                          className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-6 h-6 rounded-xl text-xs font-black flex items-center justify-center shrink-0 ${idx === 0
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : idx === 1
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                                  : idx === 2
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}>
                                {idx + 1}
                              </span>

                              {/* Real iiko Product Image */}
                              <ProductPhoto src={p.imageUrl} name={p.name} brand={cleanRestaurantName(p.brand) || p.brand} />

                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate">
                                  {p.name}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <BrandAvatar brand={cleanRestaurantName(p.brand) || p.brand} size={14} />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                    {cleanRestaurantName(p.brand) || p.brand}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 whitespace-nowrap">
                              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                {Math.round(p.revenue).toLocaleString(localeCode)} RON
                              </div>
                              <div className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                                {p.count} {t('reports.pcs_unit', 'buc.')} (~{p.avgPrice} {t('reports.price_per_pc', 'lei/buc')})
                              </div>
                            </div>
                          </div>

                          {/* Relative share bar */}
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div style={{ width: `${pct}%` }} className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right: Puncte de Lucru (Workpoints) */}
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Store size={18} className="text-blue-500" />
                      {t('reports.workpoints', 'Puncte de Lucru & Bucătării Active')}
                    </h3>

                    {/* Quick filter input */}
                    <input
                      type="text"
                      placeholder={t('reports.search_workpoint_placeholder', 'Caută bucătărie sau locație...')}
                      value={searchWorkpoint}
                      onChange={(e) => setSearchWorkpoint(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
                    />
                  </div>

                  <div className="overflow-y-auto max-h-[460px] pr-1 space-y-2.5 custom-scrollbar">
                    {filteredWorkpoints.length === 0 ? (
                      <div className="py-16 text-center text-xs text-slate-400 font-medium">
                        {t('reports.no_workpoints_match', 'Nicio bucătărie nu corespunde filtrelor selectate.')}
                      </div>
                    ) : (
                      filteredWorkpoints.map((wp) => {
                        const isSelected = filterWorkpoint === wp.id
                        return (
                          <div
                            key={wp.id}
                            onClick={() => setFilterWorkpoint(isSelected ? null : wp.id)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${isSelected
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs'
                              : 'border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2.5 truncate">
                                <BrandAvatar brand={wp.brand || wp.name} size={32} />
                                <div className="truncate">
                                  <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                                    {cleanRestaurantName(wp.name)}
                                  </h4>
                                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                    <MapPin size={10} /> {wp.city} • {wp.brand}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right shrink-0 whitespace-nowrap">
                                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                  {Math.round(wp.revenue).toLocaleString(localeCode)} RON
                                </div>
                                <div className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                                  {wp.count} {t('reports.orders_unit', 'comenzi')}
                                </div>
                              </div>
                            </div>

                            {/* Channels badges for this workpoint */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                              {Object.entries(wp.channels || {}).map(([ch, cnt]) => {
                                if (!cnt || cnt <= 0) return null
                                return (
                                  <span
                                    key={ch}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                  >
                                    <PlatformLogo platform={ch} size={11} />
                                    <span>{cnt}</span>
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )
                      }))}
                  </div>
                </div>

              </div>
            </>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TECHNICAL SCAN AUDIT LOGS (The Previous Monitoring Check Table)    */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('reports.title', 'Jurnal Audit Scanări')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {t('reports.total_records', 'Total înregistrări: {count}').replace('{count}', auditTotal.toLocaleString())}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleExportCSV}
                disabled={isExporting || (loadingAudit && auditData.length === 0)}
                className="px-4 h-9 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-400"
              >
                {isExporting ? <Loader2 size={14} className="animate-spin text-emerald-600" /> : <Download size={14} />}
                {isExporting ? t('reports.exporting') : t('reports.export_csv')}
              </button>

              <button
                onClick={() => fetchAuditLogs(auditPage)}
                disabled={loadingAudit}
                className="px-4 h-9 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                <Loader2 size={14} className={loadingAudit ? 'animate-spin text-emerald-600' : 'hidden'} />
                {t('reports.refresh')}
              </button>
            </div>
          </div>

          {/* Audit Table */}
          <div className="rounded-3xl shadow-sm border overflow-hidden flex flex-col transition-colors bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="border-b text-[11px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3.5 text-center w-20">{t('reports.th_nr')}</th>
                    <th className="px-6 py-3.5">{t('reports.th_datetime')}</th>
                    <th className="px-6 py-3.5">{t('reports.th_city')}</th>
                    <th className="px-6 py-3.5">{t('reports.th_location')}</th>
                    <th className="px-6 py-3.5 text-center w-32">{t('reports.th_platform')}</th>
                    <th className="px-6 py-3.5 text-center w-32">{t('reports.th_status')}</th>
                    <th className="px-6 py-3.5 text-right">{t('reports.th_diagnostic')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm divide-slate-100 dark:divide-slate-800">
                  {loadingAudit && auditData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-24 text-center">
                        <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto" />
                      </td>
                    </tr>
                  ) : auditData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-24 text-center text-slate-500 font-medium">
                        {t('reports.no_records')}
                      </td>
                    </tr>
                  ) : (
                    auditData.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="px-6 py-3.5 text-center font-semibold text-xs text-slate-400">
                          {(auditPage - 1) * auditLimit + idx + 1}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          {formatDate(row.checked_at)}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-bold text-slate-900 dark:text-white uppercase">
                          {row.restaurants?.city || '-'}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <BrandAvatar brand={row.restaurants?.name} size={22} />
                            <span>{cleanRestaurantName(row.restaurants?.name)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <PlatformLogo platform={row.platform} size={18} />
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <StatusBadge status={row.final_status} />
                        </td>
                        <td className="px-6 py-3.5 text-right text-xs text-slate-500 dark:text-slate-400">
                          {row.ui_error_message || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>{t('reports.total_records', 'Total înregistrări: {count}').replace('{count}', auditTotal.toLocaleString())}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                  disabled={auditPage <= 1}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-bold text-slate-900 dark:text-white">
                  {auditPage} / {auditTotalPages}
                </span>
                <button
                  onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
                  disabled={auditPage >= auditTotalPages}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
