import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLiveChecks } from '../hooks/useLiveChecks'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useAuth } from '../lib/AuthContext'
import { getApiUrl } from '../lib/api'
import {
  Loader2,
  Store,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  X,
  Download,
  FileText,
  ShoppingBag,
  Play,
  RotateCw,
  Square,
  Webhook,
  Calendar,
  ShieldCheck,
  ArrowUpRight,
  MapPin,
  Clock
} from 'lucide-react'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import RestaurantDetailsModal from '../components/RestaurantDetailsModal'
import WebhookIntegrationModal from '../components/WebhookIntegrationModal'
import ZoomChartsSuite from '../components/charts/ZoomChartsSuite'
import CumulativeHourlyChart from '../components/charts/CumulativeHourlyChart'
import AppleDateRangePicker, { formatYmdRangeDisplay } from '../components/AppleDateRangePicker'
import WeatherCitiesStrip from '../components/WeatherCitiesStrip'
import { useExecutiveSales } from '../hooks/useExecutiveSales'
import { getRestaurantWorkingHoursStatus } from '../lib/orderUtils'
import { exportSheetsToExcel } from '../lib/excelExport'

function KPICard({ title, online, closed = 0, total, platform, isDark, t, language = 'ro' }) {
  const isAllScheduleClosed = total > 0 && online === 0 && closed === total
  const percentage = total > 0 ? Math.round((online / total) * 100) : 0
  const closedLbl = language === 'ru' ? 'Закрыто (график)' : language === 'en' ? 'Closed (schedule)' : 'Închis (program)'
  return (
    <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm border flex flex-col justify-between transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <PlatformLogo platform={platform} size={16} />
          <span className="text-[12px] font-semibold text-[#48484A] dark:text-[#AEAEB2] truncate">{title}</span>
        </div>
        <span className="text-[11px] font-semibold text-[#636366] dark:text-[#8E8E93] tabular-nums shrink-0" title={t('dashboard.availability')}>
          {online} / {total}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-1.5 min-w-0">
        {isAllScheduleClosed ? (
          <span className="text-[14px] font-semibold tracking-tight text-[#636366] dark:text-[#AEAEB2] truncate inline-flex items-center gap-1">
            <Clock size={12} className="shrink-0 opacity-80" />
            <span>{closedLbl}</span>
          </span>
        ) : (
          <>
            <span className="text-[20px] font-bold tracking-[-0.02em] tabular-nums leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">{percentage}%</span>
            <span className="text-[11px] text-[#636366] dark:text-[#8E8E93] font-medium truncate">
              {closed > 0 && online > 0
                ? (language === 'ru' ? `открыто (${closed} закр.)` : language === 'en' ? `open (${closed} closed)` : `deschis (${closed} înch.)`)
                : t('dashboard.online_badge')}
            </span>
          </>
        )}
      </div>
      <div className={`h-1.5 w-full rounded-full overflow-hidden mt-2 ${isDark ? 'bg-white/10' : 'bg-black/[0.06]'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isAllScheduleClosed
              ? 'bg-slate-400/50 dark:bg-slate-600/70'
              : percentage >= 80
                ? 'bg-emerald-500'
                : percentage >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
          }`}
          style={{ width: `${isAllScheduleClosed ? 100 : percentage}%` }}
        />
      </div>
    </div>
  )
}

const PERIOD_OPTIONS = [
  { key: 'today', ro: 'Azi', en: 'Today', ru: 'Сегодня' },
  { key: 'yesterday', ro: 'Ieri', en: 'Yesterday', ru: 'Вчера' },
  { key: 'this_week', ro: 'Săpt. Curentă', en: 'This Week', ru: 'Тек. Неделя' },
  { key: 'this_month', ro: 'Luna Curentă', en: 'This Month', ru: 'Тек. Месяц' },
  { key: 'last_month', ro: 'Luna Trecută', en: 'Last Month', ru: 'Прошлый Месяц' },
  { key: 'this_year', ro: 'Anul Curent', en: 'This Year', ru: 'Тек. Год' }
]

function formatPeriodRange(rangeStr, lang) {
  if (!rangeStr) return ''
  if (lang === 'en') {
    return rangeStr
      .replace('Ianuarie', 'January')
      .replace('Februarie', 'February')
      .replace('Martie', 'March')
      .replace('Aprilie', 'April')
      .replace('Mai', 'May')
      .replace('Iunie', 'June')
      .replace('Iulie', 'July')
      .replace('August', 'August')
      .replace('Septembrie', 'September')
      .replace('Octombrie', 'October')
      .replace('Noiembrie', 'November')
      .replace('Decembrie', 'December')
      .replace('Anul', 'Year')
  }
  if (lang === 'ru') {
    return rangeStr
      .replace('Ianuarie', 'Января')
      .replace('Februarie', 'Февраля')
      .replace('Martie', 'Марта')
      .replace('Aprilie', 'Апреля')
      .replace('Mai', 'Мая')
      .replace('Iunie', 'Июня')
      .replace('Iulie', 'Июля')
      .replace('August', 'Августа')
      .replace('Septembrie', 'Сентября')
      .replace('Octombrie', 'Октября')
      .replace('Noiembrie', 'Ноября')
      .replace('Decembrie', 'Декабря')
      .replace('Anul', 'Год')
  }
  return rangeStr
}

const AUTHORITATIVE_BRANDS = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

const DASHBOARD_PERIOD_STORAGE_KEY = 'ag_pref_dashboard_period_v1'
const DASHBOARD_CUSTOM_RANGE_KEY = 'ag_pref_dashboard_custom_range_v1'

function readSavedDashboardRange() {
  try {
    const raw = localStorage.getItem(DASHBOARD_CUSTOM_RANGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.from && /^\d{4}-\d{2}-\d{2}$/.test(parsed.from)) {
      const to = (parsed.to && /^\d{4}-\d{2}-\d{2}$/.test(parsed.to)) ? parsed.to : parsed.from
      return { from: parsed.from, to }
    }
  } catch (_) { }
  return null
}

function readSavedDashboardPeriod() {
  try {
    const saved = localStorage.getItem(DASHBOARD_PERIOD_STORAGE_KEY)
    if (saved === 'custom' && readSavedDashboardRange()) return 'custom'
    if (saved && PERIOD_OPTIONS.some(o => o.key === saved)) return saved
  } catch (_) { }
  return 'today'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const { canAccessBrand, hasScopeRestrictions } = useAuth()
  const { restaurants, checks, loading, lastRefresh, fetchData } = useLiveChecks()
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const p = sp.get('period')
      if (p === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(sp.get('from') || '')) return 'custom'
      if (p && PERIOD_OPTIONS.some(o => o.key === p)) return p
    } catch (_) { }
    return readSavedDashboardPeriod()
  })

  const [customRange, setCustomRange] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const f = sp.get('from')
      const tVal = sp.get('to') || f
      if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
        return { from: f, to: (tVal && /^\d{4}-\d{2}-\d{2}$/.test(tVal)) ? tVal : f }
      }
      if (!sp.get('period') && localStorage.getItem(DASHBOARD_PERIOD_STORAGE_KEY) === 'custom') {
        return readSavedDashboardRange()
      }
    } catch (_) { }
    return null
  })

  const handlePeriodChange = (periodKey) => {
    setSelectedPeriod(periodKey)
    setCustomRange(null)
    try {
      localStorage.setItem(DASHBOARD_PERIOD_STORAGE_KEY, periodKey)
      localStorage.removeItem(DASHBOARD_CUSTOM_RANGE_KEY)
      const url = new URL(window.location.href)
      url.searchParams.delete('period')
      url.searchParams.delete('from')
      url.searchParams.delete('to')
      window.history.replaceState({}, '', url.toString())
    } catch (_) { }
  }

  const handleCustomRangeSelect = ({ from, to }) => {
    if (!from) return
    const endDay = to || from
    const nextRange = { from, to: endDay }
    setCustomRange(nextRange)
    setSelectedPeriod('custom')
    try {
      localStorage.setItem(DASHBOARD_PERIOD_STORAGE_KEY, 'custom')
      localStorage.setItem(DASHBOARD_CUSTOM_RANGE_KEY, JSON.stringify(nextRange))
      const url = new URL(window.location.href)
      url.searchParams.delete('period')
      url.searchParams.delete('from')
      url.searchParams.delete('to')
      window.history.replaceState({}, '', url.toString())
    } catch (_) { }
  }

  useEffect(() => {
    const onPopState = () => {
      try {
        const sp = new URLSearchParams(window.location.search)
        const p = sp.get('period')
        const f = sp.get('from')
        const tVal = sp.get('to') || f
        if (p === 'custom' && f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
          setCustomRange({ from: f, to: (tVal && /^\d{4}-\d{2}-\d{2}$/.test(tVal)) ? tVal : f })
          setSelectedPeriod('custom')
        } else if (p && PERIOD_OPTIONS.some(o => o.key === p)) {
          setCustomRange(null)
          setSelectedPeriod(p)
        } else {
          const savedP = readSavedDashboardPeriod()
          setSelectedPeriod(savedP)
          setCustomRange(savedP === 'custom' ? readSavedDashboardRange() : null)
        }
      } catch (_) { }
    }
    const onStorage = (e) => {
      if (e.key === DASHBOARD_PERIOD_STORAGE_KEY || e.key === DASHBOARD_CUSTOM_RANGE_KEY) {
        const savedP = readSavedDashboardPeriod()
        setSelectedPeriod(savedP)
        setCustomRange(savedP === 'custom' ? readSavedDashboardRange() : null)
      }
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    const onGlobalReset = () => {
      const savedP = readSavedDashboardPeriod()
      setSelectedPeriod(savedP)
      setCustomRange(savedP === 'custom' ? readSavedDashboardRange() : null)
    }
    window.addEventListener('global-reset-filters', onGlobalReset)
    return () => window.removeEventListener('global-reset-filters', onGlobalReset)
  }, [])

  const { salesData, loading: salesLoading } = useExecutiveSales(selectedPeriod, 5000, customRange)

  const [isExporting, setIsExporting] = useState(false)
  const [dossierRestaurant, setDossierRestaurant] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [showWebhookModal, setShowWebhookModal] = useState(false)

  function deduceBrandName(r) {
    const info = getBrandInfo(r)
    return info.name
  }

  // Statistici globale & agregare pe platforme (100% onest față de programul de funcționare Europe/Bucharest)
  const stats = useMemo(() => {
    const activeRestaurants = restaurants.filter(r => r.is_active)
    const defaultSched = getRestaurantWorkingHoursStatus(null)

    const health = {
      glovo: { total: 0, online: 0, closed: 0, unchecked: 0, unavailable: 0 },
      wolt: { total: 0, online: 0, closed: 0, unchecked: 0, unavailable: 0 },
      bolt: { total: 0, online: 0, closed: 0, unchecked: 0, unavailable: 0 },
      iiko: { total: 0, online: 0, closed: 0, unchecked: 0, unavailable: 0 }
    }

    let openNowLocations = 0
    let closedScheduleLocations = 0

    const classifyChannel = (p, c, r) => {
      const sched = getRestaurantWorkingHoursStatus(r.working_hours)
      const st = String(c?.final_status || '').toLowerCase()
      if (st === 'closed' || c?.outside_working_hours) {
        health[p].closed++
        return 'closed'
      }
      if (st === 'available' || st === 'open' || st === 'online') {
        if (!sched.isOpen && c?.verified_via !== 'live_order') {
          health[p].closed++
          return 'closed'
        }
        health[p].online++
        return 'online'
      }
      if (st === 'unavailable' || st === 'error') {
        if (!sched.isOpen) {
          health[p].closed++
          return 'closed'
        }
        health[p].unavailable++
        return 'unavailable'
      }
      if (!sched.isOpen) {
        health[p].closed++
        return 'closed'
      }
      health[p].unchecked++
      return 'unchecked'
    }

    activeRestaurants.forEach(r => {
      let hasAnyOnline = false
      let hasAnyClosed = false
      ;['glovo', 'wolt', 'bolt'].forEach(p => {
        if (r[`${p}_url`] && !String(r[`${p}_url`]).includes('/search')) {
          health[p].total++
          const c = checks.find(chk => chk.restaurant_id === r.id && chk.platform === p)
          const bucket = classifyChannel(p, c, r)
          if (bucket === 'online') hasAnyOnline = true
          else if (bucket === 'closed') hasAnyClosed = true
        }
      })
      if (r.iiko_restaurant_id) {
        health.iiko.total++
        const c = checks.find(chk => chk.restaurant_id === r.id && chk.platform === 'iiko')
        const bucket = classifyChannel('iiko', c, r)
        if (bucket === 'online') hasAnyOnline = true
        else if (bucket === 'closed') hasAnyClosed = true
      }
      if (hasAnyOnline) openNowLocations++
      else if (hasAnyClosed) closedScheduleLocations++
    })

    // Produse lipsa reale
    const missingFreq = {}
    checks.forEach(c => {
      if (c.missing_products?.length > 0) {
        c.missing_products.forEach(mp => {
          let name = typeof mp === 'string' ? mp : mp?.name
          if (!name || name === 'Produs' || name.trim() === '' || name === 'null') return
          missingFreq[name] = (missingFreq[name] || 0) + 1
        })
      }
    })

    const topMissing = Object.entries(missingFreq).sort((a, b) => b[1] - a[1])
    const isScheduleClosed = activeRestaurants.length > 0 && openNowLocations === 0 && closedScheduleLocations > 0

    return {
      activeRestaurants: activeRestaurants.length,
      openNowLocations,
      closedScheduleLocations,
      isScheduleClosed,
      roTime: defaultSched.roTime,
      scheduleLabel: defaultSched.label,
      health,
      topMissing
    }
  }, [restaurants, checks])

  // Liniile verificărilor live (pentru diagnostic și excepții operaționale)
  const tableRows = useMemo(() => {
    const rows = []

    restaurants.filter(r => r.is_active).forEach(r => {
      const brand = deduceBrandName(r)
      const platforms = ['glovo', 'wolt', 'bolt', 'iiko']

      platforms.forEach(p => {
        const pUrl = r[`${p}_url`]
        const isConfigured = p === 'iiko' ? !!r.iiko_restaurant_id : (!!pUrl && !String(pUrl).includes('/search'))
        if (!isConfigured) return

        const c = checks.find(chk => chk.restaurant_id === r.id && chk.platform === p)
        const sched = getRestaurantWorkingHoursStatus(r.working_hours)
        const rawSt = c?.final_status?.toLowerCase() || (sched.isOpen ? 'unchecked' : 'closed')
        const st = (!sched.isOpen && c?.verified_via !== 'live_order') ? 'closed' : rawSt

        let statusCategory = 'unchecked'
        let statusLabel = t('common.unchecked', 'Neverificat')
        let diagnostic = c?.ui_error_message || '-'

        if (st === 'available' || st === 'open' || st === 'online') {
          statusCategory = 'online'
          statusLabel = t('common.online', 'Online')
          diagnostic = c?.raw_data?.delivery_time_min
            ? t('dashboard.diag_active_delivery', { min: c.raw_data.delivery_time_min, max: c.raw_data.delivery_time_max })
            : p === 'iiko'
              ? (c?.raw_data?.active_products_count ? t('dashboard.diag_synced_syrve', { count: c.raw_data.active_products_count }) : t('dashboard.diag_synced_iiko'))
              : t('dashboard.diag_active_orders')
        } else if (st === 'closed') {
          statusCategory = 'closed'
          statusLabel = t('common.closed', 'Închis')
          diagnostic = c?.ui_error_message || t('dashboard.diag_closed_schedule')
        } else if (st === 'unavailable') {
          statusCategory = 'offline'
          statusLabel = t('common.offline', 'Indisponibil')
          diagnostic = c?.ui_error_message || (p === 'wolt' ? t('dashboard.diag_unavail_wolt') : p === 'glovo' ? t('dashboard.diag_unavail_glovo') : t('dashboard.diag_store_stopped'))
        } else if (st === 'error') {
          statusCategory = 'error'
          statusLabel = t('common.error', 'Eroare')
          diagnostic = c?.ui_error_message || t('dashboard.diag_conn_error')
        }

        rows.push({
          id: `${r.id}_${p}`,
          restaurant: r,
          brand,
          city: r.city || 'General',
          platform: p,
          url: r[`${p}_url`],
          statusCategory,
          statusLabel,
          diagnostic,
          checkedAt: c?.checked_at ? new Date(c.checked_at) : null
        })
      })
    })

    return rows
  }, [restaurants, checks, t])

  // Matrice Executivă de Performanță pe Branduri
  const brandMetrics = useMemo(() => {
    return AUTHORITATIVE_BRANDS.filter(b => canAccessBrand(b)).map(brandName => {
      const brandRests = restaurants.filter(r => r.is_active && deduceBrandName(r) === brandName)
      const locationsCount = brandRests.length

      const sBrand = salesData?.brands?.find(b => b.name === brandName) || {
        count: 0,
        revenue: 0,
        share: 0,
        color: '#3B82F6'
      }

      const orders = sBrand.count || 0
      const revenue = sBrand.revenue || 0
      const grossRevenue = sBrand.grossRevenue || revenue
      const share = sBrand.share || 0
      const avgTicket = orders > 0 ? Math.round(revenue / orders) : 0

      // Mix local vs delivery
      let localOrders = 0
      let deliveryOrders = 0
      if (salesData?.byRestaurant) {
        brandRests.forEach(r => {
          const rStats = salesData.byRestaurant[r.id]
          if (rStats?.channels) {
            localOrders += (rStats.channels.kiosk || 0) + (rStats.channels.casierie || 0)
            deliveryOrders += (rStats.channels.glovo || 0) + (rStats.channels.wolt || 0) + (rStats.channels.bolt || 0)
          }
        })
      }
      let localShare = 0
      let deliveryShare = 0
      if (localOrders + deliveryOrders > 0) {
        localShare = Math.round((localOrders / (localOrders + deliveryOrders)) * 100)
        deliveryShare = 100 - localShare
      }

      // Live health / uptime pe platforme (respectă programul de lucru)
      let totalChecks = 0
      let onlineChecks = 0
      let closedChecks = 0
      let stoppedChecks = 0
      brandRests.forEach(r => {
        const sched = getRestaurantWorkingHoursStatus(r.working_hours)
        const evalCheck = (c) => {
          const st = String(c?.final_status || '').toLowerCase()
          if (st === 'closed' || c?.outside_working_hours) { closedChecks++; return }
          if (st === 'available' || st === 'open' || st === 'online') {
            if (!sched.isOpen && c?.verified_via !== 'live_order') { closedChecks++; return }
            onlineChecks++
            return
          }
          if (!sched.isOpen) { closedChecks++; return }
          if (st === 'unavailable' || st === 'error') { stoppedChecks++; return }
        }
        ;['glovo', 'wolt', 'bolt'].forEach(p => {
          if (r[`${p}_url`] && !String(r[`${p}_url`]).includes('/search')) {
            totalChecks++
            evalCheck(checks.find(chk => chk.restaurant_id === r.id && chk.platform === p))
          }
        })
        if (r.iiko_restaurant_id) {
          totalChecks++
          evalCheck(checks.find(chk => chk.restaurant_id === r.id && chk.platform === 'iiko'))
        }
      })

      const isBrandScheduleClosed = totalChecks > 0 && onlineChecks === 0 && closedChecks === totalChecks
      const uptime = totalChecks > 0 ? Math.round((onlineChecks / totalChecks) * 100) : 0

      return {
        name: brandName,
        locationsCount,
        orders,
        revenue,
        grossRevenue,
        share,
        avgTicket,
        localShare,
        deliveryShare,
        uptime,
        closedChecks,
        isBrandScheduleClosed,
        stoppedChecks,
        totalChecks,
        onlineChecks,
        color: sBrand.color
      }
    }).filter(b => !hasScopeRestrictions || b.locationsCount > 0 || b.orders > 0)
  }, [restaurants, salesData, checks, canAccessBrand, hasScopeRestrictions])

  // Top Orașe & Hub-uri de Vânzări
  const topCities = useMemo(() => {
    if (!salesData?.cities?.length) return []
    return salesData.cities.slice(0, 6)
  }, [salesData])

  // Excepții operaționale active (magazine oprite / offline ce necesită intervenție)
  const operationalExceptions = useMemo(() => {
    return tableRows.filter(row => row.statusCategory === 'offline' || row.statusCategory === 'error')
  }, [tableRows])

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  // Export Excel (.xlsx) Executiv — 2 sheet-uri reale: Branduri + Top Orașe
  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const brandRows = brandMetrics.map((b) => ({
        'Brand': b.name,
        'Locații Active': Number(b.locationsCount) || 0,
        'Comenzi Perioadă': Number(b.orders) || 0,
        'Cotă Rețea (%)': Number(b.share) || 0,
        'Venit Net (RON)': Number(b.revenue) || 0,
        'Venit Brut (RON)': Number(b.grossRevenue || b.revenue) || 0,
        'Bon Mediu (RON)': Number(b.avgTicket) || 0,
        'Local Kiosk/Casă (%)': Number(b.localShare) || 0,
        'Delivery Aplicații (%)': Number(b.deliveryShare) || 0,
        'Disponibilitate Live (%)': Number(b.uptime) || 0
      }))

      const cityRows = topCities.map((ct, idx) => ({
        'Nr.': idx + 1,
        'Oraș': String(ct?.city || ct?.name || ''),
        'Comenzi': Number(ct?.count) || 0,
        'Venit Net (RON)': Math.round(Number(ct?.revenue) || 0),
        'Venit Brut (RON)': Math.round(Number(ct?.grossRevenue || ct?.revenue) || 0),
        'Glovo': Number(ct?.channels?.glovo) || 0,
        'Wolt': Number(ct?.channels?.wolt) || 0,
        'Bolt': Number(ct?.channels?.bolt) || 0,
        'Kiosk': Number(ct?.channels?.kiosk) || 0,
        'Casierie': Number(ct?.channels?.casierie) || 0
      }))

      const sheets = [
        {
          name: 'Matrice Branduri',
          headers: ['Brand', 'Locații Active', 'Comenzi Perioadă', 'Cotă Rețea (%)', 'Venit Net (RON)', 'Venit Brut (RON)', 'Bon Mediu (RON)', 'Local Kiosk/Casă (%)', 'Delivery Aplicații (%)', 'Disponibilitate Live (%)'],
          rows: brandRows
        }
      ]
      if (cityRows.length > 0) {
        sheets.push({
          name: 'Top Orașe',
          headers: ['Nr.', 'Oraș', 'Comenzi', 'Venit Net (RON)', 'Venit Brut (RON)', 'Glovo', 'Wolt', 'Bolt', 'Kiosk', 'Casierie'],
          rows: cityRows
        })
      }

      await exportSheetsToExcel(
        sheets,
        `raport_executiv_branduri_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`
      )
    } catch (err) {
      console.error('Export Excel error:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const [showScanReport, setShowScanReport] = useState(false)
  const verifyAbortRef = useRef(null)

  const handleVerifyAll = () => {
    if (isVerifying) {
      setShowScanReport(true)
      return
    }
    if (verifyAbortRef.current) verifyAbortRef.current.abort()
    const controller = new AbortController()
    verifyAbortRef.current = controller

    const expectedTotal = Math.max(1, tableRows.length * 4 || 204)
    setIsVerifying(true)
    setShowScanReport(true)
    setVerifyStatus({ isRunning: true, totalChecks: expectedTotal, current: 0, errors: 0, offline: 0, results: [] })
    fetch(getApiUrl('/api/check-all'), { method: 'POST', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json().catch(() => null)
        if (data?.status) {
          setVerifyStatus({ ...data.status, isRunning: false })
          setIsVerifying(false)
          fetchData(true)
        } else {
          setIsVerifying(false)
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        console.error(err)
        setIsVerifying(false)
        setVerifyStatus(prev => prev ? { ...prev, isRunning: false, error: err.message } : null)
      })
  }

  const handleStopVerify = () => {
    if (verifyAbortRef.current) {
      verifyAbortRef.current.abort()
      verifyAbortRef.current = null
    }
    fetch(getApiUrl('/api/check-stop'), { method: 'POST' }).catch(console.error)
    setIsVerifying(false)
    setVerifyStatus(prev => prev ? { ...prev, isRunning: false } : null)
  }

  // Smooth live progress ticker while synchronous /api/check-all runs (~7-8s) — prevents stale serverless /api/check-status premature stop
  useEffect(() => {
    if (!isVerifying) return
    const timer = setInterval(() => {
      setVerifyStatus(prev => {
        if (!prev || !prev.isRunning) return prev
        const maxDuringScan = Math.max(1, Math.round((prev.totalChecks || 204) * 0.92))
        const nextCur = Math.min(maxDuringScan, (prev.current || 0) + Math.max(8, Math.round((prev.totalChecks || 204) / 14)))
        return { ...prev, current: nextCur }
      })
    }, 550)
    return () => clearInterval(timer)
  }, [isVerifying])

  if (loading && restaurants.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    )
  }

  return (
    <div className="w-full space-y-3.5 pb-6">

      {/* Header Operativ Compact pentru Laptop — Apple HIG Toolbar Rhythm */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] leading-tight">
          {t('dashboard.title')}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11.5px] font-medium text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">
            {t('common.sync_prefix')} {lastRefresh.toLocaleTimeString(localeCode)}
          </span>

          <button
            id="webhooks-live-btn"
            type="button"
            onClick={() => setShowWebhookModal(true)}
            className="apple-btn-secondary !h-[30px]"
            title={t('webhooks.modal_title')}
          >
            <Webhook size={13} className="text-[#515154] dark:text-[#AEAEB2]" />
            <span>{t('webhooks.btn_live', 'Webhooks Live')}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </button>

          {isVerifying ? (
            <div className="flex items-center gap-1.5">
              <div className="apple-btn-secondary !h-[30px] !cursor-default">
                <RotateCw size={12} className="animate-spin text-[#0A7B5C] dark:text-emerald-400" />
                <span className="tabular-nums">{t('dashboard.btn_checking', { current: verifyStatus?.current || 0, total: verifyStatus?.totalChecks || tableRows.length || 208 })}</span>
              </div>
              <button
                type="button"
                onClick={handleStopVerify}
                className="apple-btn-secondary !h-[30px] !text-rose-600 dark:!text-rose-400"
              >
                <Square size={10} />
                <span>{t('dashboard.btn_stop', 'Stop')}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleVerifyAll}
              className="apple-btn-primary !h-[30px]"
            >
              <Play size={10} fill="currentColor" />
              <span>{t('dashboard.btn_run_check', 'Rulează Verificare Live')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ROW 1 — Adaptive Top Command Strip (Exact 50% | 50% symmetry, external section headers ABOVE cards):
          • Laptop (< 1920px): 5 Operational KPI Cards above 4 Sales & Period Cards
          • Wide / Fullscreen (>= 1920px): 50% Operational KPIs | 50% Sales & Channel Strip */}
      <div className="grid grid-cols-1 3xl:grid-cols-2 gap-3 items-stretch">
        {/* Operational Status KPIs (Left 50% on Wide/Full) */}
        <div className="min-w-0 flex flex-col space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 min-h-[30px] shrink-0">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#047857] dark:text-[#10B981] shrink-0" />
              <span>{language === 'ru' ? 'Статус Сети и Платформ' : language === 'en' ? 'Network & Platform Status' : 'Status Rețea & Platforme'}</span>
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold tabular-nums ${
              isDark ? 'bg-white/[0.06] text-[#AEAEB2]' : 'bg-black/[0.05] text-[#636366]'
            }`}>
              {stats.isScheduleClosed
                ? `${stats.closedScheduleLocations}/${stats.activeRestaurants} · ${stats.scheduleLabel}`
                : `${stats.openNowLocations || stats.activeRestaurants}/${stats.activeRestaurants} ${language === 'ru' ? 'в сети' : language === 'en' ? 'online' : 'online'}`}
            </span>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm border flex flex-col justify-between transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Store size={15} className="text-[#047857] dark:text-[#34D399] shrink-0" />
                <span className="text-[12px] font-semibold text-[#48484A] dark:text-[#AEAEB2] truncate">
                  {t('dashboard.locations_card')}
                </span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                stats.isScheduleClosed
                  ? 'bg-slate-500/12 text-[#636366] dark:text-[#AEAEB2]'
                  : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
              }`}>
                {stats.isScheduleClosed
                  ? (language === 'ru' ? 'Вне графика' : language === 'en' ? 'After hours' : 'Program închis')
                  : t('common.active')}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-[20px] font-bold tracking-[-0.02em] tabular-nums leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
                {stats.isScheduleClosed ? stats.activeRestaurants : (stats.openNowLocations > 0 && stats.closedScheduleLocations > 0 ? `${stats.openNowLocations}/${stats.activeRestaurants}` : stats.activeRestaurants)}
              </span>
              <span className="text-[11px] text-[#636366] dark:text-[#8E8E93] font-medium truncate">
                {stats.isScheduleClosed
                  ? `${stats.scheduleLabel}`
                  : t('common.locations', 'locații')}
              </span>
            </div>
            <div className={`h-1.5 w-full rounded-full overflow-hidden mt-2 ${isDark ? 'bg-white/10' : 'bg-black/[0.06]'}`}>
              <div className={`h-full rounded-full w-full ${stats.isScheduleClosed ? 'bg-slate-400/50 dark:bg-slate-600/70' : 'bg-gradient-to-r from-[#047857] to-[#10B981]'}`} />
            </div>
          </div>

          <KPICard title="Glovo" online={stats.health.glovo.online} closed={stats.health.glovo.closed} total={stats.health.glovo.total} platform="glovo" isDark={isDark} t={t} language={language} />
          <KPICard title="Wolt" online={stats.health.wolt.online} closed={stats.health.wolt.closed} total={stats.health.wolt.total} platform="wolt" isDark={isDark} t={t} language={language} />
          <KPICard title="Bolt Food" online={stats.health.bolt.online} closed={stats.health.bolt.closed} total={stats.health.bolt.total} platform="bolt" isDark={isDark} t={t} language={language} />
          <KPICard title="iiko" online={stats.health.iiko.online} closed={stats.health.iiko.closed} total={stats.health.iiko.total} platform="iiko" isDark={isDark} t={t} language={language} />
          </div>
        </div>

        {/* Executive Sales & Channel Performance Strip (Right 50% on Wide/Full — title & period controls ABOVE cards) */}
        <div className="min-w-0 flex flex-col space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 min-h-[30px] shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <ShoppingBag size={15} className="text-[#047857] dark:text-[#10B981] shrink-0" />
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
              {language === 'ru' ? 'Сводка Продаж & Каналов' : language === 'en' ? 'Sales Channels & Volume' : 'Sumar Vânzări & Canale'}
            </h3>
            <AppleDateRangePicker
              period={selectedPeriod}
              customRange={customRange}
              displayLabel={
                selectedPeriod === 'custom' && customRange?.from
                  ? formatYmdRangeDisplay(customRange.from, customRange.to || customRange.from, language)
                  : (salesData?.period?.dateRange ? formatPeriodRange(salesData.period.dateRange, language) : '')
              }
              onSelectRange={handleCustomRangeSelect}
              onSelectPreset={handlePeriodChange}
              defaultPreset="today"
              align="left"
              variant="emerald"
            />
          </div>

          {/* Period Selector — Apple Segmented Control (compact single row) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div role="group" className="apple-segmented">
              {PERIOD_OPTIONS.map(opt => {
                const isSelected = selectedPeriod === opt.key
                const label = opt[language] || opt.ro
                return (
                  <button
                    key={opt.key}
                    type="button"
                    id={`period-btn-${opt.key}`}
                    onClick={() => handlePeriodChange(opt.key)}
                    className={`apple-segment !h-[24px] !px-2.5 !text-[11px] ${isSelected ? 'apple-segment-active' : ''}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="text-[11.5px] font-semibold text-[#515154] dark:text-[#AEAEB2] pl-0.5 shrink-0 whitespace-nowrap tabular-nums">
              {salesLoading && (
                <RotateCw size={11} className="animate-spin text-[#0A7B5C] dark:text-emerald-400 inline mr-1" />
              )}
              {(salesData?.totals?.totalOrders || 0).toLocaleString()} {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Card 1: Total Volume */}
          <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm border flex flex-col justify-between transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium text-[#48484A] dark:text-[#AEAEB2] truncate">
                {language === 'ru' ? 'Заказы и выручка' : language === 'en' ? 'Orders & Revenue' : 'Comenzi și încasări'}
              </span>
              <span className="w-5 h-5 rounded-full bg-[#047857]/12 text-[#047857] dark:bg-[#10B981]/18 dark:text-[#34D399] inline-flex items-center justify-center shrink-0">
                <ShoppingBag size={11} />
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[20px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums leading-tight">
                {(salesData?.totals?.totalOrders || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-[#636366] dark:text-[#8E8E93] font-medium">
                {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}
              </span>
            </div>
            <div className="text-[11.5px] font-semibold text-[#047857] dark:text-[#34D399] mt-1 flex flex-wrap items-center gap-x-1 tabular-nums truncate">
              <span>{(salesData?.totals?.totalRevenue || 0).toLocaleString()} RON</span>
              {(salesData?.totals?.totalGrossRevenue || 0) > (salesData?.totals?.totalRevenue || 0) && (
                <span className="text-[10.5px] font-medium text-[#636366] dark:text-[#8E8E93]">
                  · {(salesData?.totals?.totalGrossRevenue || 0).toLocaleString()} {language === 'ru' ? 'без скидки' : language === 'en' ? 'gross' : 'brut'}
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Local Sales (Kiosk + POS) */}
          <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm border flex flex-col justify-between transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium text-[#48484A] dark:text-[#AEAEB2] truncate">
                {language === 'ru' ? 'Локально (Киоск + Касса)' : language === 'en' ? 'Local (Kiosk + POS)' : 'Local (Kiosk + Casierie)'}
              </span>
              <span className="text-[10.5px] font-semibold text-[#B45309] dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
                {salesData?.local_vs_delivery?.local?.share || 0}%
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[20px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums leading-tight">
                {(salesData?.local_vs_delivery?.local?.count || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-[#636366] dark:text-[#8E8E93] font-medium">
                {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}
              </span>
            </div>
            <div className="text-[11px] text-[#48484A] dark:text-[#AEAEB2] font-medium mt-1 truncate tabular-nums">
              Kiosk: <b className="text-[#1D1D1F] dark:text-white">{(salesData?.channels?.find(c => c.key === 'kiosk')?.count || 0).toLocaleString()}</b> · {language === 'ru' ? 'Касса' : language === 'en' ? 'POS' : 'Casierie'}: <b className="text-[#1D1D1F] dark:text-white">{(salesData?.channels?.find(c => c.key === 'casierie')?.count || 0).toLocaleString()}</b>
            </div>
          </div>

          {/* Card 3: Delivery Apps */}
          <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm border flex flex-col justify-between transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium text-[#48484A] dark:text-[#AEAEB2] truncate">
                {language === 'ru' ? 'Доставка (Приложения)' : language === 'en' ? 'Delivery Apps' : 'Livrare (Aplicații)'}
              </span>
              <span className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
                {salesData?.local_vs_delivery?.delivery?.share || 0}%
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[20px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums leading-tight">
                {(salesData?.local_vs_delivery?.delivery?.count || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-[#636366] dark:text-[#8E8E93] font-medium">
                {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}
              </span>
            </div>
            <div className="text-[11px] text-[#48484A] dark:text-[#AEAEB2] font-medium mt-1 truncate tabular-nums">
              Glovo: <b className="text-[#1D1D1F] dark:text-white">{(salesData?.channels?.find(c => c.key === 'glovo')?.count || 0).toLocaleString()}</b> · Bolt: <b className="text-[#1D1D1F] dark:text-white">{(salesData?.channels?.find(c => c.key === 'bolt')?.count || 0).toLocaleString()}</b> · Wolt: <b className="text-[#1D1D1F] dark:text-white">{(salesData?.channels?.find(c => c.key === 'wolt')?.count || 0).toLocaleString()}</b>
            </div>
          </div>

          {/* Card 4: Average Ticket & Top Brand */}
          <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm border flex flex-col justify-between transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] font-medium text-[#48484A] dark:text-[#AEAEB2] truncate">
                {language === 'ru' ? 'Средний чек и лидер' : language === 'en' ? 'Average Ticket & Leader' : 'Bon mediu și lider'}
              </span>
              <span className="w-5 h-5 rounded-full bg-violet-500/12 text-violet-600 dark:text-violet-400 inline-flex items-center justify-center shrink-0">
                <Store size={11} />
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[20px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums leading-tight">
                {salesData?.totals?.avgTicket || 0}
              </span>
              <span className="text-[11px] text-[#636366] dark:text-[#8E8E93] font-medium">
                RON / {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}
              </span>
            </div>
            <div className="text-[11px] text-[#48484A] dark:text-[#AEAEB2] font-medium mt-1 truncate tabular-nums">
              Top: <b className="text-[#047857] dark:text-[#34D399]">{salesData?.brands?.[0]?.name || 'Roll Master'}</b> ({(salesData?.brands?.[0]?.count || 0).toLocaleString()} {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'})
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ROW 2 — Symmetric 2-Container Charts Row (50% | 50% on Wide/Full >= 1920px):
          • Left 50%: Total Comenzi Cumulat (header above card)
          • Right 50%: Analiză Operațională & Vizuală (header above 2 sub-charts, 100% matched height) */}
      <div className="grid grid-cols-1 3xl:grid-cols-2 gap-3 items-stretch">
        <div className="min-w-0 flex flex-col">
          <CumulativeHourlyChart
            selectedPeriod={selectedPeriod}
            customRange={customRange}
            isDark={isDark}
            language={language}
          />
        </div>

        <div className="min-w-0 flex flex-col">
          <ZoomChartsSuite
            restaurants={restaurants}
            checks={checks}
            salesData={salesData}
            isDark={isDark}
            t={t}
          />
        </div>
      </div>

      {/* ROW 3 — Symmetric 2-Container Executive Row directly beneath the 2 Chart Containers (50% | 50%, external section headers ABOVE cards):
          • Laptop (lg): Brand Matrix (2/3) + Top Cities (1/3)
          • Wide / Fullscreen (3xl): Brand Matrix (50%) | Top Cities (50%) — aligned 1:1 with Row 1 & Row 2 center seam! */}
      <div className="grid grid-cols-1 lg:grid-cols-3 3xl:grid-cols-2 gap-3 items-stretch">

        {/* 1. Brand Executive Matrix (Left 50% on 3xl, 2/3 on lg — external header ABOVE card) */}
        <div className="lg:col-span-2 3xl:col-span-1 min-w-0 flex flex-col space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 min-h-[30px] shrink-0">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2 min-w-0 truncate">
              <Store size={15} className="text-[#047857] dark:text-[#10B981] shrink-0" />
              <span className="truncate">{t('dashboard.brand_matrix_title', 'Matrice Executivă de Performanță pe Branduri')}</span>
            </h3>

            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="apple-btn-secondary !h-[28px] !px-3 !text-[11px] !text-[#047857] dark:!text-[#34D399] shrink-0"
              title={language === 'ru' ? 'Экспорт отчета в Excel (.xlsx)' : language === 'en' ? 'Export Executive Report to Excel (.xlsx)' : 'Exportă Raport Executiv Excel (.xlsx)'}
            >
              {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              <span>Excel</span>
            </button>
          </div>

          <div className={`flex-1 min-w-0 rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>

          {/* Tabel Matrice Branduri — 100% în fereastră, fără scroll orizontal pe laptop */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className={`border-b text-[10px] font-bold uppercase tracking-wider select-none ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-400' : 'bg-slate-50/80 border-slate-200 text-slate-500'
                }`}>
                <tr>
                  <th className="px-3 py-2.5">{t('dashboard.th_brand', 'Brand')}</th>
                  <th className="px-2 py-2.5 text-center">{t('dashboard.th_locations', 'Locații')}</th>
                  <th className="px-2.5 py-2.5 text-right">{t('dashboard.th_orders_share', 'Comenzi & Cotă')}</th>
                  <th className="px-2.5 py-2.5 text-right">{t('dashboard.th_revenue_ticket', 'Venit Brut & Bon Mediu')}</th>
                  <th className="px-3 py-2.5 min-w-[130px]">{t('dashboard.th_channel_mix', 'Mix Vânzări (Local / Delivery)')}</th>
                  <th className="px-2.5 py-2.5 text-center">{t('dashboard.th_live_uptime', 'Disponibilitate Live')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs font-medium ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {brandMetrics.map((b) => (
                  <tr
                    key={b.name}
                    className={`transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}`}
                  >
                    {/* Brand Logo & Name */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <BrandAvatar brand={b.name} size={28} className="rounded-full shrink-0 shadow-xs" />
                        <div className="min-w-0">
                          <span className="font-bold text-[13px] text-slate-900 dark:text-white block truncate">
                            {b.name}
                          </span>
                          <span className="text-[10.5px] text-slate-400">
                            {b.locationsCount} {t('common.locations', 'locații')}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Locații Count */}
                    <td className="px-2 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-xs tabular-nums ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                        }`}>
                        {b.locationsCount}
                      </span>
                    </td>

                    {/* Comenzi & Cotă */}
                    <td className="px-2.5 py-2.5 text-right whitespace-nowrap">
                      <div className="font-extrabold text-slate-900 dark:text-white text-xs tabular-nums">
                        {b.orders.toLocaleString()} <span className="font-medium text-slate-400 text-[10px]">{language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}</span>
                      </div>
                      <div className="text-[10px] font-bold text-[#047857] dark:text-[#34D399] mt-0.5 tabular-nums">
                        {b.share}% {language === 'ru' ? 'сети' : language === 'en' ? 'of net' : 'din rețea'}
                      </div>
                    </td>

                    {/* Venit Brut & Bon Mediu */}
                    <td className="px-2.5 py-2.5 text-right whitespace-nowrap">
                      <div className="font-bold text-[#047857] dark:text-[#34D399] text-xs tabular-nums">
                        {b.revenue.toLocaleString()} RON
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5 tabular-nums">
                        {b.grossRevenue > b.revenue
                          ? `${b.grossRevenue.toLocaleString()} RON (${language === 'ru' ? 'без ск.' : language === 'en' ? 'gross' : 'brut'})`
                          : `~${b.avgTicket} RON/${language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}`}
                      </div>
                    </td>

                    {/* Mix Vânzări: Local vs Delivery Bar */}
                    <td className="px-3 py-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between gap-2 text-[10px] font-bold tabular-nums">
                          <span className="text-amber-700 dark:text-amber-400">Local {b.localShare}%</span>
                          <span className="text-emerald-700 dark:text-emerald-400">Delivery {b.deliveryShare}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${b.localShare}%` }}
                            title={`Local: ${b.localShare}%`}
                          />
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${b.deliveryShare}%` }}
                            title={`Delivery: ${b.deliveryShare}%`}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Live Uptime */}
                    <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                      {b.isBrandScheduleClosed ? (
                        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold inline-flex items-center gap-1 bg-slate-500/10 text-[#636366] dark:text-[#AEAEB2] border border-slate-500/20">
                          <Clock size={10} />
                          <span>{language === 'ru' ? 'Закрыто' : language === 'en' ? 'Closed' : 'Închis'}</span>
                        </span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 tabular-nums ${b.uptime >= 95
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : b.uptime >= 80
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${b.uptime >= 95 ? 'bg-emerald-500' : b.uptime >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                          <span>{b.uptime}% online</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>

        {/* 2. Top Orașe & Hub-uri Regionale (Right 50% on 3xl, 1/3 on lg — external header ABOVE card matching Brand Matrix 1:1) */}
        <div className="lg:col-span-1 3xl:col-span-1 min-w-0 flex flex-col space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 min-h-[30px] shrink-0">
            <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2 min-w-0 truncate">
              <MapPin size={15} className="text-[#047857] dark:text-[#10B981] shrink-0" />
              <span className="truncate">{t('dashboard.geo_matrix_title', 'Top Orașe & Hub-uri de Vânzări')}</span>
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold tabular-nums shrink-0 ${
              isDark ? 'bg-white/[0.06] text-[#AEAEB2]' : 'bg-black/[0.05] text-[#636366]'
            }`}>
              {salesData?.cities?.length || 0} {t('common.locations', 'orașe')}
            </span>
          </div>

          <div className={`flex-1 min-w-0 rounded-2xl shadow-sm border overflow-hidden flex flex-col max-h-[520px] 3xl:max-h-[380px] transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>

          {/* Listă orașe — 2 coloane echilibrate pe 3xl când sunt >= 2 orașe */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${
            topCities.length >= 2
              ? `grid grid-cols-1 3xl:grid-cols-2 content-start ${isDark ? 'bg-slate-800/40 gap-px' : 'bg-slate-100/90 gap-px'}`
              : `divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-100'}`
          }`}>
            {topCities.length === 0 ? (
              <div className="col-span-full p-6 text-center text-xs text-slate-400 font-medium">
                {t('dashboard.no_records_found', 'Date indisponibile pentru perioada selectată.')}
              </div>
            ) : (
              topCities.map((ct, idx) => {
                const cityName = String(ct?.city || ct?.name || '')
                const cityRestCount = restaurants.filter(r => r.is_active && r.city && r.city.toLowerCase() === cityName.toLowerCase()).length
                const totalRev = salesData?.totals?.totalRevenue || 1
                const cityShare = Math.round(((ct?.revenue || 0) / totalRev) * 100) || 0

                return (
                  <div key={cityName || idx} className={`px-3.5 py-2.5 transition-colors min-w-0 ${isDark ? 'bg-slate-900 hover:bg-slate-800/50' : 'bg-white hover:bg-slate-50/70'}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${idx === 0
                            ? 'bg-amber-500 text-white'
                            : idx === 1
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {cityName}
                        </span>
                        {cityRestCount > 0 && (
                          <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                            ({cityRestCount})
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <div className="font-bold text-xs text-[#047857] dark:text-[#34D399] leading-tight">
                          {(ct?.revenue || 0).toLocaleString()} RON
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
                          {(ct?.count || 0).toLocaleString()} {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}
                          {(ct?.grossRevenue || 0) > (ct?.revenue || 0) && (
                            <span className="ml-1 opacity-80">· {(ct?.grossRevenue || 0).toLocaleString()} {language === 'ru' ? 'б/ск' : language === 'en' ? 'gr.' : 'brut'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar & Canale — wrapping curat fără overflow */}
                    <div className="space-y-1.5">
                      <div className="w-full h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-[#047857] to-[#10B981] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(8, cityShare * 2))}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-[9.5px] tabular-nums">
                        {ct.channels?.glovo > 0 && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            Glovo {ct.channels.glovo}
                          </span>
                        )}
                        {ct.channels?.wolt > 0 && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-sky-500/10 text-sky-700 dark:text-sky-400">
                            Wolt {ct.channels.wolt}
                          </span>
                        )}
                        {ct.channels?.bolt > 0 && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                            Bolt {ct.channels.bolt}
                          </span>
                        )}
                        {ct.channels?.kiosk > 0 && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-orange-500/10 text-orange-700 dark:text-orange-400">
                            Kiosk {ct.channels.kiosk}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          </div>
        </div>
      </div>

      {/* ROW 4 — Centru de Alertă & Excepții Operaționale + Stop-List iiko (Full-width simetric, sau 50% | 50% pe 3xl când există și Stop-List) */}
      <div className={`grid grid-cols-1 gap-3 items-stretch ${stats.topMissing.length > 0 ? '3xl:grid-cols-2' : ''}`}>
      <div className={`p-4 rounded-2xl shadow-sm border flex flex-col justify-center transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
        {operationalExceptions.length === 0 ? (
          stats.isScheduleClosed ? (
            /* În afara programului (22:00 - 10:00) — afișare onestă */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-[#636366] dark:text-[#AEAEB2] shrink-0">
                  <Clock size={20} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    <span>
                      {language === 'ru'
                        ? 'Сеть закрыта по графику'
                        : language === 'en'
                          ? 'Network Closed (After Hours)'
                          : 'Rețea închisă după program'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/12 text-[#636366] dark:text-[#AEAEB2] border border-slate-500/20 tabular-nums">
                      {stats.closedScheduleLocations} / {stats.activeRestaurants} · {stats.scheduleLabel}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {language === 'ru'
                      ? `Текущее время в Румынии: ${stats.roTime}. Локации находятся вне графика работы (${stats.scheduleLabel}). Автоматический мониторинг и алерты возобновятся в 10:00.`
                      : language === 'en'
                        ? `Current Romania time: ${stats.roTime}. Locations are outside operating hours (${stats.scheduleLabel}). Automated monitoring and alerts resume at 10:00.`
                        : `Ora curentă în România: ${stats.roTime}. Locațiile sunt în afara programului de lucru (${stats.scheduleLabel}). Monitorizarea automată și alertele reîncep la 10:00.`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate('/monitoring' + (window.location.search || ''))}
                className="apple-btn-secondary !h-9 !px-3.5 shrink-0"
              >
                <span>
                  {language === 'ru'
                    ? `Live-Мониторинг (${tableRows.length})`
                    : language === 'en'
                      ? `Live Monitoring (${tableRows.length})`
                      : `Monitorizare Live (${tableRows.length})`}
                </span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          ) : (
            /* Rețea Operațională în timpul programului */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#047857] dark:text-[#34D399] shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    <span>{t('dashboard.network_all_operational', 'Rețea 100% Operațională')}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-[#047857] dark:text-[#34D399] border border-emerald-500/20 tabular-nums">
                      {stats.openNowLocations} / {stats.activeRestaurants} {language === 'ru' ? 'Открыты' : language === 'en' ? 'Open' : 'Deschise'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {stats.closedScheduleLocations > 0
                      ? (language === 'ru'
                          ? `${stats.openNowLocations} локаций активно принимают заказы (${stats.closedScheduleLocations} закрыты по графику). Незапланированных остановок не зафиксировано.`
                          : language === 'en'
                            ? `${stats.openNowLocations} locations are actively receiving orders (${stats.closedScheduleLocations} closed by schedule). No unplanned stops detected.`
                            : `${stats.openNowLocations} locații primesc comenzi activ (${stats.closedScheduleLocations} închise după program). Nicio oprire neplanificată.`)
                      : (language === 'ru'
                          ? `Все ${stats.activeRestaurants} локаций принимают заказы в штатном режиме на Glovo, Wolt, Bolt и iiko. Остановок не зафиксировано.`
                          : language === 'en'
                            ? `All ${stats.activeRestaurants} locations are receiving orders normally on Glovo, Wolt, Bolt and iiko. No stops detected.`
                            : `Toate cele ${stats.activeRestaurants} locații primesc comenzi în mod normal pe Glovo, Wolt, Bolt și iiko. Nicio oprire semnalată.`)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate('/monitoring' + (window.location.search || ''))}
                className="apple-btn-secondary !h-9 !px-3.5 shrink-0"
              >
                <span>
                  {language === 'ru'
                    ? `Live-Мониторинг (${tableRows.length})`
                    : language === 'en'
                      ? `Live Monitoring (${tableRows.length})`
                      : `Monitorizare Live (${tableRows.length})`}
                </span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          )
        ) : (
          /* Excepții / Opriri active ce necesită atenție */
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-rose-500/20">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle size={16} />
                <span>
                  {t('dashboard.network_exceptions_title', { count: operationalExceptions.length })}
                </span>
              </div>
              <button
                onClick={() => navigate('/monitoring' + (window.location.search || ''))}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>
                  {language === 'ru'
                    ? `Открыть Live-Мониторинг (${tableRows.length} проверок) →`
                    : language === 'en'
                      ? `Open Live Technical Monitoring (${tableRows.length} checks) →`
                      : `Deschide Monitorizarea Live Tehnică (${tableRows.length} verificări) →`}
                </span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {operationalExceptions.map((row) => (
                <div
                  key={row.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BrandAvatar brand={row.restaurant} size={28} className="rounded-full shrink-0 shadow-xs" />
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                        {cleanRestaurantName(row.restaurant.name)}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          {row.city}
                        </span>
                        <span className="text-[10px] text-slate-500">•</span>
                        <div className="inline-flex items-center gap-1">
                          <PlatformLogo platform={row.platform} size={12} />
                          <span className="capitalize text-[10px] font-bold text-rose-500">
                            {row.platform} {row.statusLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDossierRestaurant(row.restaurant)}
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title={t('dashboard.tooltip_open_dossier', 'Deschide Dosar Tehnic')}
                    >
                      <FileText size={13} />
                    </button>
                    {row.url && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        title={t('dashboard.tooltip_open_platform', 'Deschide pe platformă')}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Secțiune Discretă: Produse Oprite pe Bucătărie (iiko Stop-List) */}
      {stats.topMissing.length > 0 && (
        <div className={`p-5 rounded-2xl shadow-sm border transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <ShoppingBag size={15} className="text-amber-500" />
              {t('dashboard.kitchen_stop_list_title', 'Produse Oprite din Vânzare în Bucătărie (Stop-List iiko POS)')}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
              {t('dashboard.items_count', { count: stats.topMissing.length })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {stats.topMissing.map(([name, count], i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80 inline-flex items-center gap-2"
              >
                <span>{name}</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  {t('dashboard.stores_count_tag', { count })}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* ROW 5 — Condiții Meteo Live în Orașele Rețelei (compact, jos, click = zoom pe Harta Curierilor) */}
      <WeatherCitiesStrip
        collapsible
        onSelectCity={(cityKey) => navigate(cityKey === 'all' ? '/couriers-map' : `/couriers-map?city=${encodeURIComponent(cityKey)}`)}
      />

      {/* Modal Dosar Tehnic */}
      {dossierRestaurant && (
        <RestaurantDetailsModal
          restaurant={dossierRestaurant}
          isOpen={Boolean(dossierRestaurant)}
          onClose={() => setDossierRestaurant(null)}
        />
      )}

      {/* Modal Webhooks Live */}
      <WebhookIntegrationModal
        isOpen={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        onWebhookTriggered={() => fetchData(true)}
      />

      {/* SHEET SCANARE LIVE — macOS Tahoe 26 (identic cu Monitoring) */}
      {showScanReport && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setShowScanReport(false)
            if (!isVerifying) setVerifyStatus(null)
          }}
          className="fixed inset-0 m-0 apple-sheet-backdrop z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-sheet w-full max-w-md overflow-hidden flex flex-col max-h-[88vh]"
          >
            <div className="apple-sheet-header relative px-5 py-4 text-center space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowScanReport(false)
                  if (!isVerifying) setVerifyStatus(null)
                }}
                aria-label={t('common.close')}
                className="apple-sheet-close absolute top-3.5 right-3.5"
              >
                <X size={15} />
              </button>

              <div className={`w-11 h-11 rounded-2xl mx-auto flex items-center justify-center ${isVerifying
                ? 'bg-[#047857]/12 text-[#047857] dark:text-[#10B981]'
                : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                }`}>
                {isVerifying ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle2 size={22} />}
              </div>
              <h3 className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-white">
                {isVerifying ? t('monitoring.scan_modal_title_progress') : t('monitoring.scan_modal_title_done')}
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                {isVerifying ? t('monitoring.scan_modal_desc_progress') : t('monitoring.scan_modal_desc_done')}
              </p>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 custom-scrollbar">
              {verifyStatus && (() => {
                const pct = verifyStatus.totalChecks > 0
                  ? Math.min(100, Math.max(0, Math.round((verifyStatus.current / verifyStatus.totalChecks) * 100)))
                  : (isVerifying ? 0 : 100)
                return (
                  <>
                    <div className="apple-inset-card p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {language === 'ru' ? 'Прогресс проверки' : language === 'en' ? 'Scan progress' : 'Progres verificare'}
                        </span>
                        <span className="font-semibold tabular-nums text-[#047857] dark:text-[#10B981]">
                          {pct}%
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/[0.08]'}`}>
                        <div
                          className="h-full rounded-full bg-[#047857] dark:bg-[#10B981] transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {!isVerifying && verifyStatus.duration_ms > 0 && (
                        <div className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                          {language === 'ru'
                            ? `Проверено live за ${(verifyStatus.duration_ms / 1000).toFixed(1)} сек`
                            : language === 'en'
                              ? `Live scan completed in ${(verifyStatus.duration_ms / 1000).toFixed(1)}s`
                              : `Scanare live finalizată în ${(verifyStatus.duration_ms / 1000).toFixed(1)}s`}
                        </div>
                      )}
                    </div>

                    <div className="apple-inset-card flex items-center justify-between px-4 py-3">
                      <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
                        {t('monitoring.scan_modal_verified')}
                      </span>
                      <span className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-white">
                        {verifyStatus.current} / {verifyStatus.totalChecks || '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 rounded-[14px] border border-rose-500/20 bg-rose-500/8">
                      <span className="text-[13px] font-medium text-rose-700 dark:text-rose-300">
                        {t('monitoring.scan_modal_stopped')}
                      </span>
                      <span className="text-[15px] font-bold tabular-nums text-rose-600 dark:text-rose-400">
                        {verifyStatus.offline || 0}
                      </span>
                    </div>

                    {!isVerifying && Array.isArray(verifyStatus.results) && verifyStatus.results.length > 0 && (
                      <div className="apple-inset-card p-3 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {verifyStatus.results.slice(0, 12).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-[11.5px]">
                            <span className="font-semibold text-rose-600 dark:text-rose-400 truncate">
                              {cleanRestaurantName(item.restaurant)} · {String(item.platform || '').toUpperCase()}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[48%] text-right">
                              {item.reason || item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="px-5 py-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end gap-2 shrink-0">
              {isVerifying ? (
                <button
                  type="button"
                  onClick={handleStopVerify}
                  className="apple-btn-secondary !text-rose-600 dark:!text-rose-400"
                >
                  <Square size={12} />
                  <span>{t('monitoring.stop_scan')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowScanReport(false)
                    setVerifyStatus(null)
                  }}
                  className="apple-btn-secondary"
                >
                  {t('common.close')}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
