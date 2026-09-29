import { useState, useMemo, useEffect, useRef } from 'react'
import { useLiveChecks } from '../hooks/useLiveChecks'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { 
  Loader2, 
  Store, 
  Activity, 
  ExternalLink, 
  Power, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  ShoppingBag,
  Play,
  RotateCw,
  Square
} from 'lucide-react'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import RestaurantDetailsModal from '../components/RestaurantDetailsModal'

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

export default function Dashboard() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const { restaurants, checks, loading, lastRefresh, fetchData } = useLiveChecks()

  const [activeBrand, setActiveBrand] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rowsPerPage] = useState(15)
  const [isExporting, setIsExporting] = useState(false)
  const [dossierRestaurant, setDossierRestaurant] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null)

  const authoritativeBrands = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

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

  // Liniile tabelului operational complet
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

  // Filtrare tabel
  const filteredRows = useMemo(() => {
    return tableRows.filter(row => {
      // Filtru Brand
      if (activeBrand !== 'all' && row.brand !== activeBrand) return false
      // Filtru Platforma
      if (platformFilter !== 'all' && row.platform !== platformFilter) return false
      // Filtru Status
      if (statusFilter === 'online' && row.statusCategory !== 'online') return false
      if (statusFilter === 'offline' && row.statusCategory === 'online') return false

      // Cautare text
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = row.restaurant.name && row.restaurant.name.toLowerCase().includes(q)
        const matchCity = row.city && row.city.toLowerCase().includes(q)
        const matchDiag = row.diagnostic && row.diagnostic.toLowerCase().includes(q)
        if (!matchName && !matchCity && !matchDiag) return false
      }

      return true
    })
  }, [tableRows, activeBrand, platformFilter, statusFilter, search])

  // Paginare SmartDevize
  const total = filteredRows.length
  const totalPages = Math.ceil(total / rowsPerPage) || 1
  const startIndex = (page - 1) * rowsPerPage
  const paginatedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage)

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  // Export CSV
  const handleExportCSV = () => {
    setIsExporting(true)
    try {
      const headers = [
        t('dashboard.th_nr', 'Nr.'),
        t('dashboard.th_city', 'Oraș'),
        t('common.restaurant', 'Restaurant'),
        'Brand',
        t('dashboard.th_platform', 'Platformă'),
        t('dashboard.th_status', 'Status'),
        t('dashboard.th_diagnostic', 'Diagnostic'),
        t('dashboard.th_synced', 'Sincronizat')
      ]
      const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`

      const csvLines = [
        headers.map(escape).join(','),
        ...filteredRows.map((row, idx) => {
          const dateStr = row.checkedAt ? row.checkedAt.toLocaleString(localeCode) : '-'
          return [
            idx + 1,
            escape(row.city),
            escape(cleanRestaurantName(row.restaurant.name)),
            escape(row.brand),
            escape(row.platform.toUpperCase()),
            escape(row.statusLabel),
            escape(row.diagnostic),
            escape(dateStr)
          ].join(',')
        })
      ]

      const csvContent = '\uFEFF' + csvLines.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `statistica_retea_${new Date().toISOString().slice(0, 10)}.csv`
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
    fetch('http://localhost:3002/api/check-all', { method: 'POST' }).catch(console.error)
  }

  const handleStopVerify = () => {
    fetch('http://localhost:3002/api/check-stop', { method: 'POST' }).catch(console.error)
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
        const res = await fetch('http://localhost:3002/api/check-status')
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
    <div className="flex flex-col h-full w-full space-y-6">
      
      {/* Header Operativ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('dashboard.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('dashboard.subtitle')}
          </p>
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
          <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {t('dashboard.monitored_continuous')}
          </div>
        </div>
        
        <KPICard title="Glovo" online={stats.health.glovo.online} total={stats.health.glovo.total} platform="glovo" isDark={isDark} t={t} />
        <KPICard title="Wolt" online={stats.health.wolt.online} total={stats.health.wolt.total} platform="wolt" isDark={isDark} t={t} />
        <KPICard title="Bolt Food" online={stats.health.bolt.online} total={stats.health.bolt.total} platform="bolt" isDark={isDark} t={t} />
        <KPICard title="iiko" online={stats.health.iiko.online} total={stats.health.iiko.total} platform="iiko" isDark={isDark} t={t} />
      </div>

      {/* Tabs Filtru Branduri */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        {['all', ...authoritativeBrands].map(b => {
          const isActive = activeBrand === b
          const count = b === 'all' 
            ? stats.activeRestaurants 
            : restaurants.filter(r => r.is_active && deduceBrandName(r) === b).length
          return (
            <button
              key={b}
              onClick={() => { setActiveBrand(b); setPage(1); }}
              className={`px-4 h-9 rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-xs ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark 
                    ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {b !== 'all' ? (
                <BrandAvatar brand={b} size={18} className="rounded-full shrink-0" />
              ) : (
                <Store size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              )}
              <span>{b === 'all' ? t('common.all_brands') : b}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isActive 
                  ? 'bg-white/20 text-white' 
                  : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* CARD PRINCIPAL: TABEL OPERATIONAL COMPLET */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col flex-1 transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Bara de Comanda a Tabelului: Cautare, Filtre, Export CSV */}
        <div className={`p-4 border-b flex flex-col md:flex-row items-center justify-between gap-3 ${
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
            {/* Cautare */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input 
                type="text"
                placeholder={t('common.search_placeholder', 'Caută restaurant, oraș sau adresă...')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className={`w-full pl-10 pr-4 h-9 text-xs rounded-full border outline-none transition-all shadow-xs ${
                  isDark 
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                }`}
              />
            </div>

            {/* Filtru Platforma */}
            <select
              value={platformFilter}
              onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
              className={`h-9 px-3 rounded-full text-xs font-bold border outline-none cursor-pointer transition-colors ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <option value="all">{t('dashboard.filter_all_platforms', 'Toate Platformele')}</option>
              <option value="glovo">Glovo</option>
              <option value="wolt">Wolt</option>
              <option value="bolt">Bolt Food</option>
              <option value="iiko">iiko</option>
            </select>

            {/* Filtru Status */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={`h-9 px-3 rounded-full text-xs font-bold border outline-none cursor-pointer transition-colors ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <option value="all">{t('dashboard.filter_all_statuses', 'Toate Statusurile')}</option>
              <option value="online">{t('dashboard.filter_only_online', 'Doar Online')}</option>
              <option value="offline">{t('dashboard.filter_only_offline', 'Doar Oprite / Indisponibile')}</option>
            </select>
          </div>

          {/* Buton Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={isExporting || filteredRows.length === 0}
            className={`px-4 h-9 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 shrink-0 ${
              isDark 
                ? 'bg-emerald-950/30 border-emerald-800/60 hover:bg-emerald-900/50 text-emerald-400' 
                : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-700'
            } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={t('dashboard.export_title', 'Descarcă tabelul în format CSV Excel')}
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin text-emerald-600" />
            ) : (
              <Download size={14} className="text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{isExporting ? t('dashboard.btn_exporting', 'Se exportă...') : t('dashboard.btn_export_csv', 'Exportă Statistici (CSV)')}</span>
          </button>
        </div>

        {/* Tabelul de Date Conform SmartDevize */}
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className={`border-b text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 select-none ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="px-4 py-3.5 w-16 text-center">{t('dashboard.th_nr', 'Nr.')}</th>
                <th className="px-4 py-3.5 w-32">{t('dashboard.th_city', 'Oraș')}</th>
                <th className="px-4 py-3.5 min-w-[240px]">{t('dashboard.th_location', 'Restaurant & Locație')}</th>
                <th className="px-4 py-3.5 w-32 text-center">{t('dashboard.th_platform', 'Platformă')}</th>
                <th className="px-4 py-3.5 w-36 text-center">{t('dashboard.th_status', 'Status')}</th>
                <th className="px-4 py-3.5 min-w-[240px]">{t('dashboard.th_diagnostic', 'Diagnostic & Stare Reală')}</th>
                <th className="px-4 py-3.5 w-28 text-center">{t('dashboard.th_synced', 'Sincronizat')}</th>
                <th className="px-4 py-3.5 w-24 text-center">{t('dashboard.th_actions', 'Acțiuni')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-sm ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center text-slate-500 dark:text-slate-400 font-medium">
                    {t('dashboard.no_records_found', 'Nu s-au găsit înregistrări conform filtrelor aplicate.')}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const cleanedName = cleanRestaurantName(row.restaurant.name)
                  const cityInName = row.city && cleanedName.toLowerCase().includes(row.city.toLowerCase())

                  return (
                    <tr 
                      key={row.id} 
                      className={`transition-colors group ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                    >
                      {/* Nr. Crt. */}
                      <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {startIndex + idx + 1}
                      </td>

                      {/* Oraș */}
                      <td className="px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                        {row.city}
                      </td>

                      {/* Restaurant & Brand */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <BrandAvatar brand={row.restaurant} size={28} className="rounded-full shrink-0 shadow-xs" />
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-slate-900 dark:text-white block truncate">
                              {cleanedName}
                            </span>
                            {!cityInName && row.city && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                                {row.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Platformă */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 whitespace-nowrap">
                          <PlatformLogo platform={row.platform} size={16} className="shrink-0" />
                          <span className="capitalize font-bold text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {row.platform === 'iiko' ? 'iiko' : row.platform}
                          </span>
                        </div>
                      </td>

                      {/* Status Operațional */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {row.statusCategory === 'online' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 inline-flex items-center gap-1.5 shadow-2xs">
                            <CheckCircle2 size={12} className="shrink-0" /> <span className="whitespace-nowrap">{row.statusLabel}</span>
                          </span>
                        ) : row.statusCategory === 'closed' ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 inline-flex items-center gap-1.5 shadow-2xs">
                            <Clock size={12} className="shrink-0" /> <span className="whitespace-nowrap">{row.statusLabel}</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 inline-flex items-center gap-1.5 shadow-2xs">
                            <Power size={12} className="shrink-0" /> <span className="whitespace-nowrap">{row.statusLabel}</span>
                          </span>
                        )}
                      </td>

                      {/* Diagnostic & Detalii Reale */}
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        <span className="truncate max-w-[280px] block" title={row.diagnostic}>
                          {row.diagnostic}
                        </span>
                      </td>

                      {/* Sincronizat */}
                      <td className="px-4 py-3.5 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {row.checkedAt ? row.checkedAt.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>

                      {/* Acțiuni */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDossierRestaurant(row.restaurant)}
                            className={`p-1.5 rounded-full border transition-colors ${
                              isDark 
                                ? 'border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white' 
                                : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                            }`}
                            title={t('dashboard.tooltip_open_dossier', 'Deschide Dosar Tehnic')}
                          >
                            <FileText size={13} />
                          </button>
                          {row.url && (
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`p-1.5 rounded-full border transition-colors ${
                                isDark 
                                  ? 'border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white' 
                                  : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                              }`}
                              title={t('dashboard.tooltip_open_platform', 'Deschide pagina pe platformă')}
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer SmartDevize: Total înregistrări, Paginare */}
        <div className={`px-6 py-3.5 flex items-center justify-between border-t transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('dashboard.pagination_showing', { count: paginatedRows.length, total: total })}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('common.page', 'Pagina')} <span className="font-bold text-slate-900 dark:text-white">{page}</span> {t('common.of', 'din')} {totalPages}
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                  page === 1 
                    ? 'opacity-30 cursor-not-allowed text-slate-400' 
                    : isDark 
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-300' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title={t('common.page')}
              >
                <ChevronLeft size={16} />
              </button>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                  page >= totalPages 
                    ? 'opacity-30 cursor-not-allowed text-slate-400' 
                    : isDark 
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-300' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title={t('common.page')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

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

    </div>
  )
}
