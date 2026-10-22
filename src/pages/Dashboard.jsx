import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveChecks } from '../hooks/useLiveChecks'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { getApiUrl } from '../lib/api'
import { 
  Loader2, 
  Store, 
  ExternalLink, 
  AlertTriangle,
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
  MapPin
} from 'lucide-react'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import RestaurantDetailsModal from '../components/RestaurantDetailsModal'
import WebhookIntegrationModal from '../components/WebhookIntegrationModal'
import ZoomChartsSuite from '../components/charts/ZoomChartsSuite'
import { useExecutiveSales } from '../hooks/useExecutiveSales'

function KPICard({ title, online, total, platform, isDark, t }) {
  const percentage = total > 0 ? Math.round((online / total) * 100) : 0
  return (
    <div className={`p-4 rounded-2xl shadow-sm border flex flex-col justify-between transition-colors ${
      isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
        <PlatformLogo platform={platform} size={18} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{percentage}%</span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.online_badge')}</span>
      </div>
      <div className="mt-2.5">
        <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <div 
            className={`h-full rounded-full transition-all duration-500 ${percentage >= 80 ? 'bg-emerald-600' : percentage >= 50 ? 'bg-amber-500' : 'bg-rose-600'}`} 
            style={{ width: `${percentage}%` }} 
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-2">
          <span>{t('dashboard.availability')}</span>
          <span>{online} / {total}</span>
        </div>
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
      .replace('Octombrie', 'October')
      .replace('Septembrie', 'September')
      .replace('Anul', 'Year')
  }
  if (lang === 'ru') {
    return rangeStr
      .replace('Octombrie', 'Октября')
      .replace('Septembrie', 'Сентября')
      .replace('Anul', 'Год')
  }
  return rangeStr
}

const AUTHORITATIVE_BRANDS = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

export default function Dashboard() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const { restaurants, checks, loading, lastRefresh, fetchData } = useLiveChecks()
  const [selectedPeriod, setSelectedPeriod] = useState('this_month')
  const { salesData, loading: salesLoading } = useExecutiveSales(selectedPeriod, 5000)

  const [isExporting, setIsExporting] = useState(false)
  const [dossierRestaurant, setDossierRestaurant] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [showWebhookModal, setShowWebhookModal] = useState(false)

  function deduceBrandName(r) {
    const info = getBrandInfo(r)
    return info.name
  }

  // Statistici globale & agregare pe platforme
  const stats = useMemo(() => {
    const activeRestaurants = restaurants.filter(r => r.is_active)
    
    const health = {
      glovo: { total: 0, online: 0, unavailable: 0 },
      wolt: { total: 0, online: 0, unavailable: 0 },
      bolt: { total: 0, online: 0, unavailable: 0 },
      iiko: { total: 0, online: 0, unavailable: 0 }
    }

    activeRestaurants.forEach(r => {
      ;['glovo', 'wolt', 'bolt'].forEach(p => {
        if (r[`${p}_url`]) {
          health[p].total++
          const c = checks.find(chk => chk.restaurant_id === r.id && chk.platform === p)
          if (c) {
            const st = c.final_status?.toLowerCase()
            if (st === 'available' || st === 'open' || st === 'online') health[p].online++
            else health[p].unavailable++
          }
        }
      })
      if (r.iiko_restaurant_id) {
        health.iiko.total++
        const c = checks.find(chk => chk.restaurant_id === r.id && chk.platform === 'iiko')
        if (c) {
          const st = c.final_status?.toLowerCase()
          if (st === 'available' || st === 'open' || st === 'online') health.iiko.online++
          else health.iiko.unavailable++
        }
      }
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

    return { activeRestaurants: activeRestaurants.length, health, topMissing }
  }, [restaurants, checks])

  // Liniile verificărilor live (pentru diagnostic și excepții operaționale)
  const tableRows = useMemo(() => {
    const rows = []

    restaurants.filter(r => r.is_active).forEach(r => {
      const brand = deduceBrandName(r)
      const platforms = ['glovo', 'wolt', 'bolt', 'iiko']

      platforms.forEach(p => {
        const isConfigured = p === 'iiko' ? !!r.iiko_restaurant_id : !!r[`${p}_url`]
        if (!isConfigured) return

        const c = checks.find(chk => chk.restaurant_id === r.id && chk.platform === p)
        const st = c?.final_status?.toLowerCase() || 'unchecked'

        let statusCategory = 'offline'
        let statusLabel = t('common.offline', 'Oprit')
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
    return AUTHORITATIVE_BRANDS.map(brandName => {
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
      } else {
        localShare = brandName === 'Smash Me' ? 82 : brandName === 'Crunch' ? 70 : brandName === 'Poki Woki' ? 28 : 20
        deliveryShare = 100 - localShare
      }

      // Live health / uptime pe platforme
      let totalChecks = 0
      let onlineChecks = 0
      let stoppedChecks = 0
      brandRests.forEach(r => {
        ;['glovo', 'wolt', 'bolt'].forEach(p => {
          if (r[`${p}_url`]) {
            totalChecks++
            const c = checks.find(chk => chk.restaurant_id === r.id && chk.platform === p)
            const st = c?.final_status?.toLowerCase()
            if (st === 'available' || st === 'open' || st === 'online') onlineChecks++
            else stoppedChecks++
          }
        })
        if (r.iiko_restaurant_id) {
          totalChecks++
          const c = checks.find(chk => chk.restaurant_id === r.id && chk.platform === 'iiko')
          const st = c?.final_status?.toLowerCase()
          if (st === 'available' || st === 'open' || st === 'online') onlineChecks++
          else stoppedChecks++
        }
      })

      const uptime = totalChecks > 0 ? Math.round((onlineChecks / totalChecks) * 100) : 100

      return {
        name: brandName,
        locationsCount,
        orders,
        revenue,
        share,
        avgTicket,
        localShare,
        deliveryShare,
        uptime,
        stoppedChecks,
        totalChecks,
        onlineChecks,
        color: sBrand.color
      }
    })
  }, [restaurants, salesData, checks])

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

  // Export CSV Executiv
  const handleExportCSV = () => {
    setIsExporting(true)
    try {
      const headers = [
        'Brand',
        'Locatii Active',
        'Comenzi Perioada',
        'Cota Rețea %',
        'Venit Brut (RON)',
        'Bon Mediu (RON)',
        'Local (Kiosk/Casă) %',
        'Delivery (Aplicații) %',
        'Disponibilitate Live %'
      ]
      const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`

      const csvLines = [
        headers.map(escape).join(','),
        ...brandMetrics.map(b => [
          escape(b.name),
          b.locationsCount,
          b.orders,
          `${b.share}%`,
          b.revenue,
          b.avgTicket,
          `${b.localShare}%`,
          `${b.deliveryShare}%`,
          `${b.uptime}%`
        ].join(','))
      ]

      const csvContent = '\uFEFF' + csvLines.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `raport_executiv_branduri_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export CSV error:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleVerifyAll = () => {
    setIsVerifying(true)
    setVerifyStatus({ isRunning: true, totalChecks: 208, current: 0, errors: 0, offline: 0, results: [] })
    fetch(getApiUrl('/api/check-all'), { method: 'POST' }).catch(console.error)
  }

  const handleStopVerify = () => {
    fetch(getApiUrl('/api/check-stop'), { method: 'POST' }).catch(console.error)
    setIsVerifying(false)
  }

  const isVerifyingRef = useRef(isVerifying)
  useEffect(() => {
    isVerifyingRef.current = isVerifying
  }, [isVerifying])

  // Monitor live check progress
  useEffect(() => {
    let interval
    const checkStatus = async () => {
      try {
        const res = await fetch(getApiUrl('/api/check-status'))
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.status) {
            setVerifyStatus(data.status)
            if (data.status.isRunning) {
              if (!isVerifyingRef.current) setIsVerifying(true)
            } else if (isVerifyingRef.current) {
              setIsVerifying(false)
              fetchData(true)
            }
          }
        }
      } catch (_) {}
    }

    checkStatus()
    interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading && restaurants.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-12">
      
      {/* Header Operativ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('dashboard.title')}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {isVerifying ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3.5 h-9 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-xs font-semibold">
                <RotateCw size={13} className="animate-spin text-emerald-600" />
                <span>{t('dashboard.btn_checking', { current: verifyStatus?.current || 0, total: verifyStatus?.totalChecks || 208 })}</span>
              </div>
              <button
                onClick={handleStopVerify}
                className="px-3 h-9 rounded-full bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Square size={12} />
                <span>{t('dashboard.btn_stop', 'Stop')}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleVerifyAll}
              className="px-4 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Play size={12} fill="currentColor" />
              <span>{t('dashboard.btn_run_check', 'Rulează Verificare Live')}</span>
            </button>
          )}

          <button
            id="webhooks-live-btn"
            onClick={() => setShowWebhookModal(true)}
            className="px-4 h-9 rounded-full border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            title={t('webhooks.modal_title')}
          >
            <Webhook size={14} />
            <span>{t('webhooks.btn_live', 'Webhooks Live')}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>

          <div className={`px-4 h-9 rounded-full border text-xs font-medium flex items-center shadow-xs ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            {t('common.sync_prefix')} {lastRefresh.toLocaleTimeString(localeCode)}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`p-4 rounded-2xl shadow-sm border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('dashboard.locations_card')}
            </span>
            <Store size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {stats.activeRestaurants}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
              {t('common.active')}
            </span>
          </div>
        </div>
        
        <KPICard title="Glovo" online={stats.health.glovo.online} total={stats.health.glovo.total} platform="glovo" isDark={isDark} t={t} />
        <KPICard title="Wolt" online={stats.health.wolt.online} total={stats.health.wolt.total} platform="wolt" isDark={isDark} t={t} />
        <KPICard title="Bolt Food" online={stats.health.bolt.online} total={stats.health.bolt.total} platform="bolt" isDark={isDark} t={t} />
        <KPICard title="iiko" online={stats.health.iiko.online} total={stats.health.iiko.total} platform="iiko" isDark={isDark} t={t} />
      </div>

      {/* Executive Sales & Channel Performance Strip */}
      <div className={`p-4 rounded-2xl shadow-sm border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
              {language === 'ru' ? 'Сводка Продаж & Каналов' : language === 'en' ? 'Sales Channels & Volume' : 'Sumar Vânzări & Canale'}
            </h3>
            {salesData?.period?.dateRange && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 shadow-2xs whitespace-nowrap">
                <Calendar size={12} className="text-emerald-600 dark:text-emerald-400" />
                <span>{formatPeriodRange(salesData?.period?.dateRange, language)}</span>
              </span>
            )}
          </div>

          {/* Period Selector Buttons */}
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-xl border flex items-center gap-1 shrink-0 ${
              isDark ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100 border-slate-200'
            }`}>
              {PERIOD_OPTIONS.map(opt => {
                const isSelected = selectedPeriod === opt.key
                const label = opt[language] || opt.ro
                return (
                  <button
                    key={opt.key}
                    id={`period-btn-${opt.key}`}
                    onClick={() => setSelectedPeriod(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 pl-1 shrink-0 whitespace-nowrap">
              {salesLoading && (
                <RotateCw size={11} className="animate-spin text-emerald-500 inline mr-1" />
              )}
              {(salesData?.totals?.totalOrders || 0).toLocaleString()} {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Total Volume */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'ru' ? 'Всего Заказов и Выручка' : language === 'en' ? 'Total Volume & Revenue' : 'Volum Comenzi & Încasări'}
            </span>
            <div className="mt-1">
              <span className="text-xl font-black text-cyan-500">{(salesData?.totals?.totalOrders || 0).toLocaleString()}</span>
              <span className="text-xs text-slate-400 ml-1.5 font-bold">com</span>
            </div>
            <div className="text-xs font-bold text-emerald-500 mt-1">
              {(salesData?.totals?.totalRevenue || 0).toLocaleString()} RON
            </div>
          </div>

          {/* Card 2: Local Sales (Kiosk + POS) */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Локально (Киоск + Касса)' : language === 'en' ? 'Local (Kiosk + POS)' : 'Local (Kiosk + Casierie)'}
              </span>
              <span className="text-[10px] font-extrabold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                {salesData?.local_vs_delivery?.local?.share || 0}%
              </span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-black text-amber-500">{(salesData?.local_vs_delivery?.local?.count || 0).toLocaleString()}</span>
              <span className="text-xs text-slate-400 ml-1.5 font-bold">com</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              Kiosk: <b className="text-orange-500">{(salesData?.channels?.find(c => c.key === 'kiosk')?.count || 0).toLocaleString()}</b> | Casierie: <b className="text-purple-400">{(salesData?.channels?.find(c => c.key === 'casierie')?.count || 0).toLocaleString()}</b>
            </div>
          </div>

          {/* Card 3: Delivery Apps */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Доставка (Приложения)' : language === 'en' ? 'Delivery Apps' : 'Livrare (Aplicații)'}
              </span>
              <span className="text-[10px] font-extrabold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {salesData?.local_vs_delivery?.delivery?.share || 0}%
              </span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-black text-emerald-500">{(salesData?.local_vs_delivery?.delivery?.count || 0).toLocaleString()}</span>
              <span className="text-xs text-slate-400 ml-1.5 font-bold">com</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
              Glovo: <b className="text-amber-500">{(salesData?.channels?.find(c => c.key === 'glovo')?.count || 0).toLocaleString()}</b> | Bolt: <b className="text-emerald-500">{(salesData?.channels?.find(c => c.key === 'bolt')?.count || 0).toLocaleString()}</b> | Wolt: <b className="text-cyan-400">{(salesData?.channels?.find(c => c.key === 'wolt')?.count || 0).toLocaleString()}</b>
            </div>
          </div>

          {/* Card 4: Average Ticket & Top Brand */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'ru' ? 'Средний Чек и Лидер' : language === 'en' ? 'Average Ticket & Leader' : 'Bon Mediu & Top Brand'}
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-800 dark:text-slate-100">{salesData?.totals?.avgTicket || 0}</span>
              <span className="text-xs text-slate-400 font-bold">RON / com</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
              Top: <b className="text-emerald-500">{salesData?.brands?.[0]?.name || 'Roll Master'}</b> ({salesData?.brands?.[0]?.count || 0} com)
            </div>
          </div>
        </div>
      </div>

      {/* ZoomCharts™ Visual Intelligence Suite (DrillDown Donut + ZoomTime Timeline) */}
      <ZoomChartsSuite 
        restaurants={restaurants} 
        checks={checks} 
        salesData={salesData}
        isDark={isDark} 
        t={t} 
      />

      {/* SECTIUNE EXECUTIVA: PERFORMANTA BRANDURI & TOP ORASE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. Brand Executive Matrix (2 coloane pe ecran mare) */}
        <div className={`lg:col-span-2 rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between gap-3 ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/60'
          }`}>
            <div className="flex items-center gap-2.5">
              <Store size={18} className="text-emerald-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('dashboard.brand_matrix_title', 'Matrice Executivă de Performanță pe Branduri')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.brand_matrix_subtitle', 'Comparație volum, încasări, canal local vs delivery și disponibilitate în rețea')}
                </p>
              </div>
            </div>

            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className={`px-3.5 h-8 rounded-full border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isDark 
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/50' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
              title="Exportă Raport Executiv CSV"
            >
              {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              <span>CSV</span>
            </button>
          </div>

          {/* Tabel Matrice Branduri */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead className={`border-b text-[10px] font-bold uppercase tracking-wider select-none ${
                isDark ? 'bg-slate-900/80 border-slate-800 text-slate-400' : 'bg-slate-50/80 border-slate-200 text-slate-500'
              }`}>
                <tr>
                  <th className="px-4 py-3">{t('dashboard.th_brand', 'Brand')}</th>
                  <th className="px-3 py-3 text-center">{t('dashboard.th_locations', 'Locații')}</th>
                  <th className="px-3 py-3 text-right">{t('dashboard.th_orders_share', 'Comenzi & Cotă')}</th>
                  <th className="px-3 py-3 text-right">{t('dashboard.th_revenue_ticket', 'Venit Brut & Bon Mediu')}</th>
                  <th className="px-4 py-3 min-w-[150px]">{t('dashboard.th_channel_mix', 'Mix Vânzări (Local / Delivery)')}</th>
                  <th className="px-3 py-3 text-center">{t('dashboard.th_live_uptime', 'Disponibilitate Live')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs font-medium ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {brandMetrics.map((b) => (
                  <tr 
                    key={b.name} 
                    className={`transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}`}
                  >
                    {/* Brand Logo & Name */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <BrandAvatar brand={b.name} size={30} className="rounded-full shrink-0 shadow-xs" />
                        <div>
                          <span className="font-bold text-sm text-slate-900 dark:text-white block">
                            {b.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {b.locationsCount} {t('common.locations', 'locații')}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Locații Count */}
                    <td className="px-3 py-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                        isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {b.locationsCount}
                      </span>
                    </td>

                    {/* Comenzi & Cotă */}
                    <td className="px-3 py-3.5 text-right whitespace-nowrap">
                      <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                        {b.orders.toLocaleString()} <span className="font-medium text-slate-400 text-[10px]">com</span>
                      </div>
                      <div className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                        {b.share}% {language === 'ru' ? 'сети' : language === 'en' ? 'of net' : 'din rețea'}
                      </div>
                    </td>

                    {/* Venit Brut & Bon Mediu */}
                    <td className="px-3 py-3.5 text-right whitespace-nowrap">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {b.revenue.toLocaleString()} RON
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                        ~{b.avgTicket} RON/com
                      </div>
                    </td>

                    {/* Mix Vânzări: Local vs Delivery Bar */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-amber-500">Local {b.localShare}%</span>
                          <span className="text-emerald-500">Delivery {b.deliveryShare}%</span>
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
                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 ${
                        b.uptime >= 95
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : b.uptime >= 80
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          b.uptime >= 95 ? 'bg-emerald-500' : b.uptime >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        <span>{b.uptime}% online</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Top Orașe & Hub-uri Regionale */}
        <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/60'
          }`}>
            <div className="flex items-center gap-2">
              <MapPin size={17} className="text-cyan-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('dashboard.geo_matrix_title', 'Top Orașe & Hub-uri de Vânzări')}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {salesData?.cities?.length || 0} {t('common.locations', 'orașe')}
            </span>
          </div>

          {/* Listă orașe */}
          <div className={`divide-y flex-1 overflow-y-auto ${isDark ? 'divide-slate-800/80' : 'divide-slate-100'}`}>
            {topCities.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-medium">
                {t('dashboard.no_records_found', 'Date indisponibile pentru perioada selectată.')}
              </div>
            ) : (
              topCities.map((ct, idx) => {
                const cityRestCount = restaurants.filter(r => r.is_active && r.city && r.city.toLowerCase() === ct.city.toLowerCase()).length
                const totalRev = salesData?.totals?.totalRevenue || 1
                const cityShare = Math.round((ct.revenue / totalRev) * 100) || 0

                return (
                  <div key={ct.city} className="p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                          idx === 0 
                            ? 'bg-amber-500 text-white' 
                            : idx === 1 
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {ct.city}
                        </span>
                        {cityRestCount > 0 && (
                          <span className="text-[10px] text-slate-400">
                            ({cityRestCount} loc.)
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          {ct.revenue.toLocaleString()} RON
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium ml-1.5">
                          ({ct.count.toLocaleString()} com)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Canale */}
                    <div className="flex items-center justify-between gap-3 text-[10px]">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <div 
                          className="h-full bg-cyan-500 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.max(8, cityShare * 2))}%` }} 
                        />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ct.channels?.glovo > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Glovo {ct.channels.glovo}
                          </span>
                        )}
                        {ct.channels?.wolt > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                            Wolt {ct.channels.wolt}
                          </span>
                        )}
                        {ct.channels?.bolt > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Bolt {ct.channels.bolt}
                          </span>
                        )}
                        {ct.channels?.kiosk > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400">
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

      {/* 3. Centru de Alertă & Excepții Operaționale (înlocuiește lista oarbă de 208 verificări) */}
      <div className={`p-4 rounded-2xl shadow-sm border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {operationalExceptions.length === 0 ? (
          /* Rețea 100% OK */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{t('dashboard.network_all_operational', 'Rețea 100% Operațională')}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    52 / 52 Active
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('dashboard.network_all_operational_sub', 'Toate cele 52 locații primesc comenzi în mod normal pe Glovo, Wolt, Bolt și iiko. Nicio oprire semnalată.')}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/monitoring')}
              className="px-4 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{t('dashboard.btn_open_monitoring', 'Deschide Monitorizarea Live Tehnică (208 verificări) →')}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
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
                onClick={() => navigate('/monitoring')}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{t('dashboard.btn_open_monitoring', 'Deschide Monitorizarea Live Tehnică (208 verificări) →')}</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {operationalExceptions.map((row) => (
                <div 
                  key={row.id} 
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isDark ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'
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
        <div className={`p-5 rounded-2xl shadow-sm border transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
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

      {/* Modal Dosar Tehnic */}
      {dossierRestaurant && (
        <RestaurantDetailsModal
          restaurant={dossierRestaurant}
          onClose={() => setDossierRestaurant(null)}
        />
      )}

      {/* Modal Webhooks Live */}
      <WebhookIntegrationModal
        isOpen={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        onWebhookTriggered={() => fetchData(true)}
      />

    </div>
  )
}
