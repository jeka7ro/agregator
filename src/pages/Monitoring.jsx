import { useState, useMemo, useEffect } from 'react'
import { 
  AlertCircle, 
  Search, 
  Activity, 
  Power, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ExternalLink,
  Store,
  ChevronLeft,
  ChevronRight,
  Loader2,
  XCircle,
  Clock,
  FileText,
  Webhook
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useLiveChecks } from '../hooks/useLiveChecks'
import PlatformLogo from '../components/PlatformLogo'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import RestaurantDetailsModal from '../components/RestaurantDetailsModal'
import { getApiUrl } from '../lib/api'
import WebhookIntegrationModal from '../components/WebhookIntegrationModal'

function AnimatedNumber({ value }) {
  return <span className="animate-in fade-in slide-in-from-bottom-2 duration-300">{value}</span>
}

export default function Monitoring() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()

  const { restaurants, checks, loading, getLatestCheck, fetchData } = useLiveChecks()

  const [activeBrand, setActiveBrand] = useState('all')

  // Paginare & Căutare State
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(15)
  
  // Detalii verificare (Modal) & Dosar Tehnic
  const [selectedCheckDetail, setSelectedCheckDetail] = useState(null)
  const [dossierRestaurant, setDossierRestaurant] = useState(null)
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Strictly 5 authoritative brands
  const authoritativeBrands = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

  function deduceBrandName(r) {
    const info = getBrandInfo(r)
    return info.name
  }

  const { groupedByBrand, allBrands } = useMemo(() => {
    const grouped = {
      'Roll Master': [],
      'Poki Woki': [],
      'Love Sushi': [],
      'Smash Me': [],
      'Crunch': []
    }

    restaurants.forEach(r => {
      if (!r.is_active) return;
      const brand = deduceBrandName(r)
      if (grouped[brand]) {
        grouped[brand].push(r)
      } else {
        grouped['Roll Master'].push(r)
      }
    })
    
    return {
      groupedByBrand: grouped,
      allBrands: ['all', ...authoritativeBrands]
    }
  }, [restaurants])

  let displayedRestaurants = []
  if (activeBrand === 'all') {
    displayedRestaurants = restaurants.filter(r => r.is_active)
  } else {
    displayedRestaurants = groupedByBrand[activeBrand] || []
  }

  // Filtrare pe baza căutării (Search)
  const filteredRestaurants = useMemo(() => {
    if (!search.trim()) return displayedRestaurants;
    const s = search.toLowerCase();
    return displayedRestaurants.filter(r => 
      (r.name && cleanRestaurantName(r.name).toLowerCase().includes(s)) || 
      (r.city && r.city.toLowerCase().includes(s)) ||
      (r.address && r.address.toLowerCase().includes(s))
    );
  }, [displayedRestaurants, search])

  // Sortare
  const sortedRestaurants = useMemo(() => {
    let sortableItems = [...filteredRestaurants];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'name') {
          aVal = cleanRestaurantName(aVal || '').toLowerCase();
          bVal = cleanRestaurantName(bVal || '').toLowerCase();
        } else if (sortConfig.key === 'city') {
          aVal = (aVal || '').toLowerCase();
          bVal = (bVal || '').toLowerCase();
        } else if (['glovo', 'wolt', 'bolt', 'iiko'].includes(sortConfig.key)) {
            const getStatusRank = (status) => {
                const norm = status?.toLowerCase();
                if (norm === 'error') return 0;
                if (norm === 'offline' || norm === 'closed' || norm === 'unavailable') return 1;
                if (!status) return 2;
                return 3;
            };
            const aCheck = getLatestCheck(a.id, sortConfig.key)?.final_status;
            const bCheck = getLatestCheck(b.id, sortConfig.key)?.final_status;
            aVal = getStatusRank(aCheck);
            bVal = getStatusRank(bCheck);
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredRestaurants, sortConfig, getLatestCheck]);

  useEffect(() => {
    setPage(1)
  }, [activeBrand, search, rowsPerPage])

  const total = sortedRestaurants.length;
  const totalPages = rowsPerPage === 9999 ? 1 : Math.ceil(total / rowsPerPage) || 1;
  const startIndex = (page - 1) * rowsPerPage;
  const paginatedRestaurants = rowsPerPage === 9999 
    ? sortedRestaurants 
    : sortedRestaurants.slice(startIndex, startIndex + rowsPerPage);

  const isWithinWorkingHours = (workingHours) => {
    if (!workingHours) return true
    const start = workingHours.start || (typeof workingHours === 'object' && workingHours.open)
    const end = workingHours.end || (typeof workingHours === 'object' && workingHours.close)
    if (!start || !end) return true

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const [startH, startM] = start.split(':').map(Number)
    const [endH, endM] = end.split(':').map(Number)
    const startMinutes = (startH || 0) * 60 + (startM || 0)
    const endMinutes = (endH || 0) * 60 + (endM || 0)

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes
    }
  }

  const getStatusInfo = (status, isOutsideHours = false) => {
    if (!status) return { 
      badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
      label: t('common.unchecked'),
      icon: <Activity size={12} className="opacity-50" />
    }
    const norm = status.toLowerCase()
    if (norm === 'available' || norm === 'open' || norm === 'online') return { 
      badgeClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      label: t('common.online'),
      icon: <CheckCircle2 size={12} />
    }
    if (isOutsideHours && (norm === 'closed' || norm === 'offline' || norm === 'unavailable')) {
      return { 
        badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        label: t('alerts.outside_hours', 'În afara programului'),
        icon: <Clock size={12} />
      }
    }
    if (norm === 'closed' || norm === 'offline' || norm === 'unavailable') return { 
      badgeClass: 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
      label: t('common.offline'),
      icon: <Power size={12} />
    }
    return { 
      badgeClass: 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
      label: t('common.error'),
      icon: <AlertTriangle size={12} />
    }
  }

  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [showReport, setShowReport] = useState(false)

  const handleVerifyAll = () => {
    setIsVerifying(true)
    setShowReport(true)
    setVerifyStatus({ isRunning: true, totalChecks: 0, current: 0, errors: 0, offline: 0, results: [] })
    fetch(getApiUrl('/api/check-all'), { method: 'POST' }).catch(console.error)
  }

  const handleStopVerify = () => {
    fetch(getApiUrl('/api/check-stop'), { method: 'POST' }).catch(console.error)
    setIsVerifying(false)
  }

  useEffect(() => {
    let interval;
    if (isVerifying) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(getApiUrl('/api/check-status'))
          if (res.ok) {
            const data = await res.json()
            setVerifyStatus(data.status)
            if (data.status && !data.status.isRunning) {
              setIsVerifying(false)
              fetchData(true)
            }
          }
        } catch (err) {
          console.error(err)
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [isVerifying, fetchData])

  if (loading && restaurants.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('monitoring.loading_status')}
        </p>
      </div>
    )
  }

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  return (
    <div className="flex flex-col h-full w-full space-y-6">
      
      {/* HEADER OPERAȚIONAL */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('monitoring.title')}
        </h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          {/* Căutare */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder={t('monitoring.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-10 pr-4 h-10 text-sm rounded-full border outline-none transition-all shadow-xs ${
                isDark 
                  ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
              }`}
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setShowWebhookModal(true)}
              className="px-4 h-10 rounded-full border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-2"
              title={t('webhooks.modal_title')}
            >
              <Webhook size={16} />
              <span className="hidden sm:inline">{t('webhooks.btn_live')}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </button>

            <button
              onClick={handleVerifyAll}
              disabled={isVerifying}
              className="px-5 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none disabled:opacity-50"
            >
              <Loader2 size={16} className={isVerifying ? "animate-spin" : "hidden"} />
              <span>{isVerifying ? t('monitoring.scanning') : t('monitoring.check_status')}</span>
            </button>
            
            {isVerifying && (
              <button
                onClick={handleStopVerify}
                className="px-4 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                title={t('monitoring.stop_scan')}
              >
                <XCircle size={16} />
                <span>{t('monitoring.stop_label')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABS BRANDURI (DOAR CELE 5 AUTORITARE) */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        {allBrands.map(brand => {
          const isActive = activeBrand === brand;
          const count = brand === 'all' ? displayedRestaurants.length : groupedByBrand[brand]?.length || 0;
          return (
            <button 
              key={brand}
              onClick={() => setActiveBrand(brand)}
              className={`px-4 h-9 rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-xs ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark 
                    ? 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {brand !== 'all' ? (
                <BrandAvatar brand={brand} size={18} className="rounded-full shrink-0" />
              ) : (
                <Store size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              )}
              <span>{brand === 'all' ? t('common.all_brands') : brand}</span>
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

      {/* CARD TABEL */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col flex-1 transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className={`text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 select-none border-b ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th onClick={() => handleSort('index')} className="px-4 py-3.5 w-16 text-center cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                  {t('monitoring.th_nr')} {sortConfig.key === 'index' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('city')} className="px-4 py-3.5 w-32 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                  {t('monitoring.th_city')} {sortConfig.key === 'city' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('name')} className="px-4 py-3.5 min-w-[260px] cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                  {t('monitoring.th_location')} {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('glovo')} className="px-4 py-3.5 text-center min-w-[120px] cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                  {t('monitoring.th_glovo')} {sortConfig.key === 'glovo' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('wolt')} className="px-4 py-3.5 text-center min-w-[120px] cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                  {t('monitoring.th_wolt')} {sortConfig.key === 'wolt' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('bolt')} className="px-4 py-3.5 text-center min-w-[120px] cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                  {t('monitoring.th_bolt')} {sortConfig.key === 'bolt' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('iiko')} className="px-4 py-3.5 text-center min-w-[120px] cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors">
                  {t('monitoring.th_iiko')} {sortConfig.key === 'iiko' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-4 py-3.5 text-right w-32 text-slate-500 dark:text-slate-400">
                  {t('monitoring.th_last_check')}
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y text-sm ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {paginatedRestaurants.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                        <Store size={24} />
                      </div>
                      <h3 className="text-sm font-bold mb-1">{t('monitoring.no_locations_found')}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('monitoring.no_locations_desc')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedRestaurants.map((r, index) => (
                <tr 
                  key={r.id} 
                  className={`transition-colors group ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                >
                  {/* Nr. Crt. */}
                  <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {startIndex + index + 1}
                  </td>

                  {/* Oraș */}
                  <td className="px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                    {r.city}
                  </td>

                  {/* Brand Avatar + Nume Locație (FĂRĂ duplicare text brand) */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <BrandAvatar brand={r} size={32} className="rounded-full shrink-0 shadow-xs" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setDossierRestaurant(r)}
                            className="text-left font-bold text-sm text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block"
                            title={t('settings.th_dossier', 'Dosar Tehnic')}
                          >
                            {cleanRestaurantName(r.name)}
                          </button>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[280px] flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            <span className="truncate">{r.address || t('common.no_address')}</span>
                            {r.working_hours?.start && r.working_hours?.end && (
                              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {r.working_hours.start}-{r.working_hours.end}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDossierRestaurant(r)}
                        className={`p-1.5 rounded-full border transition-colors shrink-0 opacity-70 hover:opacity-100 ${
                          isDark 
                            ? 'border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white' 
                            : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                        }`}
                        title={t('settings.th_dossier', 'Dosar Tehnic')}
                      >
                        <FileText size={14} />
                      </button>
                    </div>
                  </td>
                  
                  {/* COLOANE PLATFORME */}
                  {['glovo', 'wolt', 'bolt', 'iiko'].map(p => {
                    const hasPlatform = (p !== 'iiko' && r[`${p}_url`]) || (p === 'iiko' && r.iiko_restaurant_id);
                    if (!hasPlatform) {
                      return (
                        <td key={p} className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${
                            isDark ? 'bg-slate-800/40 border-slate-800 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                          }`}>
                            {t('common.inactive')}
                          </span>
                        </td>
                      );
                    }

                    const check = getLatestCheck(r.id, p);
                    const outside = !isWithinWorkingHours(r.working_hours);
                    const info = getStatusInfo(check?.final_status, outside);
                    
                    return (
                      <td key={p} className="px-4 py-3.5 text-center align-middle whitespace-nowrap">
                        <div 
                          onClick={() => {
                            if (check) setSelectedCheckDetail({ check, restaurant: r, platform: p, info });
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all hover:scale-105 cursor-pointer ${info.badgeClass}`}
                          title="Apasă pentru mai multe detalii"
                        >
                          <PlatformLogo platform={p} size={14} className="shrink-0" />
                          <span className="whitespace-nowrap leading-none">{info.label}</span>
                        </div>
                        
                        {/* Avertismente Stop List */}
                        <div className="flex flex-col gap-1 mt-1.5 items-center">
                          {check?.disabled_categories?.length > 0 && (
                            <span 
                              title={check.disabled_categories.join(', ')}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 cursor-help"
                            >
                              {t('monitoring.cat_stop_badge', { count: check.disabled_categories.length })}
                            </span>
                          )}

                          {check?.missing_products?.length > 0 && (
                            <span 
                              title={check.missing_products.map(mp => typeof mp === 'string' ? mp : (mp.name || 'Produs')).join(', ')}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 cursor-help"
                            >
                              {t('monitoring.missing_badge', { count: check.missing_products.length })}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}

                  {/* Ultima verificare */}
                  <td className="px-4 py-3.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                    {(() => {
                      const checksForR = checks.filter(c => c.restaurant_id === r.id);
                      if (checksForR.length === 0) return <span className="opacity-40">{t('common.never')}</span>;
                      const latest = new Date(Math.max(...checksForR.map(c => new Date(c.checked_at).getTime())));
                      const diffMins = Math.floor((Date.now() - latest.getTime()) / 60000);
                      
                      if (diffMins < 1) return <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t('common.now')}</span>;
                      if (diffMins < 60) return `${diffMins}m`;
                      return latest.toLocaleString(localeCode, { hour: '2-digit', minute: '2-digit' });
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER PAGINARE */}
        <div className={`px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
        }`}>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>{t('common.rows')}</span>
              <select 
                value={rowsPerPage} 
                onChange={e => setRowsPerPage(Number(e.target.value))} 
                className={`h-8 px-3 rounded-full border text-xs font-bold outline-none cursor-pointer ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>{t('common.all')}</option>
              </select>
            </div>
            <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} hidden sm:block`}></div>
            <span>
              {t('common.total')} <span className="font-bold text-slate-900 dark:text-white">{total}</span> {t('common.locations')}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>
              {t('common.page')} <span className="font-bold text-slate-900 dark:text-white">{total === 0 ? 0 : page}</span> {t('common.of')} {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button 
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setPage(p => p - 1)} 
                disabled={page === 1 || total === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setPage(p => p + 1)} 
                disabled={page >= totalPages || total === 0}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* MODAL SCANARE GLOBAL */}
      {showReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl w-full max-w-md shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            <div className={`p-6 text-center space-y-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
                isVerifying 
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' 
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
              }`}>
                {isVerifying ? <Loader2 size={30} className="animate-spin" /> : <CheckCircle2 size={30} />}
              </div>
              <h3 className="text-xl font-bold">
                {isVerifying ? t('monitoring.scan_modal_title_progress') : t('monitoring.scan_modal_title_done')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isVerifying ? t('monitoring.scan_modal_desc_progress') : t('monitoring.scan_modal_desc_done')}
              </p>
            </div>
            
            {/* Progress Bar */}
            {isVerifying && verifyStatus && (
              <div className={`h-1.5 w-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div 
                  className="h-full bg-emerald-600 transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(5, Math.round((verifyStatus.current / Math.max(1, verifyStatus.totalChecks)) * 100)))}%` }}
                />
              </div>
            )}
            
            <div className="p-6 overflow-y-auto space-y-4">
              {verifyStatus && (
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-4 rounded-2xl border ${
                    isDark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('monitoring.scan_modal_verified')}
                    </span>
                    <span className="text-base font-bold">
                      <AnimatedNumber value={verifyStatus.current} key={verifyStatus.current} /> / {verifyStatus.totalChecks || '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30">
                    <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
                      {t('monitoring.scan_modal_stopped')}
                    </span>
                    <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                      <AnimatedNumber value={verifyStatus.offline} key={verifyStatus.offline} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-4 border-t flex justify-end ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <button
                onClick={() => {
                  setShowReport(false);
                  setVerifyStatus(null);
                }}
                disabled={isVerifying}
                className={`px-5 h-10 rounded-full text-sm font-bold transition-colors disabled:opacity-50 ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALII VERIFICARE */}
      {selectedCheckDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl w-full max-w-lg shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
             
             {/* Header */}
             <div className={`px-6 py-5 border-b flex items-center justify-between ${
               isDark ? 'border-slate-800' : 'border-slate-100'
             }`}>
               <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${
                   isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                 }`}>
                   <PlatformLogo platform={selectedCheckDetail.platform} size={22} />
                 </div>
                 <div>
                   <h3 className="text-base font-bold">
                     {t('monitoring.modal_title')}
                   </h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                     {cleanRestaurantName(selectedCheckDetail.restaurant.name)} • {selectedCheckDetail.restaurant.city}
                   </p>
                 </div>
               </div>
               <button 
                 onClick={() => setSelectedCheckDetail(null)} 
                 className={`w-8 h-8 rounded-full border flex items-center justify-center text-slate-500 transition-colors ${
                   isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                 }`}
               >
                 <X size={16} />
               </button>
             </div>
             
             {/* Body */}
             <div className="p-6 overflow-y-auto space-y-4">
                
                {/* Status Principal */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('monitoring.modal_diagnostic_state')}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedCheckDetail.info.badgeClass}`}>
                    {selectedCheckDetail.info.icon}
                    {selectedCheckDetail.info.label}
                  </span>
                </div>
                
                {/* Grid indicatori */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-4 rounded-2xl border ${
                    isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-200'
                  }`}>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      {t('monitoring.modal_store_open')}
                    </span>
                    <div className={`text-xl font-bold flex items-center gap-2 ${selectedCheckDetail.check.ui_is_open ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {selectedCheckDetail.check.ui_is_open ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                      {selectedCheckDetail.check.ui_is_open ? t('common.yes') : t('common.no')}
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl border ${
                    isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-200'
                  }`}>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      {t('monitoring.modal_orders_active')}
                    </span>
                    <div className={`text-xl font-bold flex items-center gap-2 ${selectedCheckDetail.check.ui_can_order ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {selectedCheckDetail.check.ui_can_order ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                      {selectedCheckDetail.check.ui_can_order ? t('common.yes') : t('common.no')}
                    </div>
                  </div>
                </div>

                {/* Eroare (daca exista) */}
                {selectedCheckDetail.check.ui_error_message && (
                  <div className="p-4 border rounded-2xl bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50">
                    <span className="block text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> {t('monitoring.modal_error_reason')}
                    </span>
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                      {selectedCheckDetail.check.ui_error_message}
                    </p>
                  </div>
                )}

                {/* Avertismente Stop List */}
                {(selectedCheckDetail.check.missing_products?.length > 0 || selectedCheckDetail.check.disabled_categories?.length > 0) && (
                  <div className="p-4 border rounded-2xl bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50">
                    <span className="block text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                      <AlertCircle size={14} /> {t('common.stop_list')} ({selectedCheckDetail.check.missing_products?.length || 0})
                    </span>
                    
                    {selectedCheckDetail.check.disabled_categories?.length > 0 && (
                      <div className="mb-3">
                        <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          {t('monitoring.modal_stopped_categories')}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCheckDetail.check.disabled_categories.map((cat, i) => (
                            <span key={i} className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedCheckDetail.check.missing_products?.length > 0 && (
                      <div>
                        <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          {t('monitoring.modal_stopped_products')}
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                          {selectedCheckDetail.check.missing_products.map((prod, i) => (
                            <span key={i} className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                              {typeof prod === 'string' ? prod : (prod.name || 'Produs')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
             </div>
             
             {/* Footer Modal */}
             <div className={`px-6 py-4 border-t flex justify-between items-center gap-4 ${
               isDark ? 'border-slate-800' : 'border-slate-100'
             }`}>
               <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                 {t('common.sync_prefix')} {new Date(selectedCheckDetail.check.checked_at).toLocaleTimeString(localeCode)}
               </div>
               {selectedCheckDetail.restaurant[`${selectedCheckDetail.platform}_url`] && (
                 <a
                   href={selectedCheckDetail.restaurant[`${selectedCheckDetail.platform}_url`]}
                   target="_blank"
                   rel="noreferrer"
                   className="px-5 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all flex items-center gap-2"
                 >
                   <span>{t('monitoring.modal_open_platform', { platform: selectedCheckDetail.platform.toUpperCase() })}</span>
                   <ExternalLink size={14} />
                 </a>
               )}
             </div>
           </div>
        </div>
      )}

      {/* Modal Dosar Tehnic Restaurant */}
      {dossierRestaurant && (
        <RestaurantDetailsModal
          restaurant={dossierRestaurant}
          onClose={() => setDossierRestaurant(null)}
        />
      )}

      {/* Modal Integrări Webhooks Oficiale Wolt & Bolt */}
      <WebhookIntegrationModal
        isOpen={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        onWebhookTriggered={() => fetchData(true)}
      />
    </div>
  )
}
