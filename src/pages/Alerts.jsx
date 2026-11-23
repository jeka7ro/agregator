import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveChecks } from '../hooks/useLiveChecks'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useAuth } from '../lib/AuthContext'
import { AlertOctagon, TrendingDown, Clock, ExternalLink, Loader2, AlertCircle, CheckCircle2, X, Check } from 'lucide-react'
import BrandAvatar, { cleanRestaurantName, getBrandInfo } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import { getApiUrl } from '../lib/api'
import { getCanonicalCity, getRestaurantWorkingHoursStatus } from '../lib/orderUtils'

const HOURLY_LOSS_RATE = 50 // 50 RON per hour fallback if restaurant metadata is missing

export default function Alerts() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const { canAccessCity, canAccessBrand, hasScopeRestrictions } = useAuth()
  const { restaurants, checks, loading } = useLiveChecks()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filterBrand, setFilterBrand] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('brand')
      if (p && p !== 'all') return p
    } catch (_) {}
    return 'all'
  })
  const [filterCity, setFilterCity] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('city')
      if (p && p !== 'all') return getCanonicalCity(p) || 'all'
    } catch (_) {}
    return 'all'
  })

  useEffect(() => {
    try {
      const pBrand = searchParams.get('brand') || 'all'
      if (pBrand !== filterBrand) setFilterBrand(pBrand)
      const pCity = searchParams.get('city')
      const nextCity = pCity && pCity !== 'all' ? getCanonicalCity(pCity) : 'all'
      if (nextCity !== filterCity) setFilterCity(nextCity)
    } catch (_) {}
  }, [searchParams])

  useEffect(() => {
    const onGlobalReset = () => {
      setFilterBrand('all')
      setFilterCity('all')
    }
    window.addEventListener('global-reset-filters', onGlobalReset)
    return () => window.removeEventListener('global-reset-filters', onGlobalReset)
  }, [])

  const [activeTab, setActiveTab] = useState('active') // 'active' | 'resolved'
  const [resolvedIncidentIds, setResolvedIncidentIds] = useState(() => {
    try {
      const saved = localStorage.getItem('resolved_incident_ids')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [resolvedHistory, setResolvedHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('resolved_incidents_history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Modal resolving state
  const [resolvingIncident, setResolvingIncident] = useState(null)
  const [resolveReason, setResolveReason] = useState('')
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false)

  useEffect(() => {
    localStorage.setItem('resolved_incident_ids', JSON.stringify(resolvedIncidentIds))
  }, [resolvedIncidentIds])

  useEffect(() => {
    localStorage.setItem('resolved_incidents_history', JSON.stringify(resolvedHistory))
  }, [resolvedHistory])

  const scopedResolvedHistory = useMemo(() => {
    if (!hasScopeRestrictions) return resolvedHistory
    return (resolvedHistory || []).filter(item => {
      const city = item.city || item.restaurant?.city || item.restaurant?.name || ''
      if (city && !canAccessCity(getCanonicalCity(city) || city)) return false
      if (item.restaurant) {
        const b = getBrandInfo(item.restaurant)?.name
        if (b && !canAccessBrand(b)) return false
      }
      return true
    })
  }, [resolvedHistory, hasScopeRestrictions, canAccessCity, canAccessBrand])

  // Compute alerts
  const alertsData = useMemo(() => {
    const rawActiveAlerts = []
    let totalEstimatedLoss = 0
    let totalDowntimeMinutes = 0

    checks.forEach(c => {
      const st = c.final_status?.toLowerCase()
      if (st === 'error' || st === 'closed' || st === 'unavailable') {
        const r = restaurants.find(res => res.id === c.restaurant_id)
        if (r && r.is_active) {
          // Never count scheduled after-hours closing (22:00–10:00) as an active outage or financial loss!
          if (c.outside_working_hours || !getRestaurantWorkingHoursStatus(r.working_hours).isOpen) return
          const p = String(c.platform || '').toLowerCase()
          const pUrl = p !== 'iiko' ? r[`${p}_url`] : r.iiko_restaurant_id
          if (!pUrl || (p !== 'iiko' && String(pUrl).includes('/search'))) return

          if (filterBrand !== 'all') {
            const bInfo = getBrandInfo(r)
            if (bInfo.name.toLowerCase() !== filterBrand.toLowerCase()) return
          }
          if (filterCity !== 'all') {
            if (getCanonicalCity(r.city || r.name) !== getCanonicalCity(filterCity)) return
          }

          const checkTime = c.checked_at ? new Date(c.checked_at).getTime() : Date.now()
          const downtimeMins = Math.max(15, Math.round((Date.now() - checkTime) / 60000))
          const rate = Number(r.revenue_per_hour) || HOURLY_LOSS_RATE
          const loss = (downtimeMins / 60) * rate

          const alertKey = `${c.id || c.restaurant_id}-${c.platform}`
          const isResolved = resolvedIncidentIds.includes(alertKey)

          if (!isResolved) {
            totalDowntimeMinutes += downtimeMins
            totalEstimatedLoss += loss

            rawActiveAlerts.push({
              key: alertKey,
              id: c.id,
              restaurant: r,
              city: r.city,
              platform: c.platform,
              status: st,
              message: c.ui_error_message || t('alerts.default_diagnostic'),
              downtime: downtimeMins,
              hourlyRate: rate,
              estimatedLoss: loss,
              url: r[`${c.platform}_url`],
              detectedAt: c.checked_at || new Date().toISOString()
            })
          }
        }
      }
    })

    rawActiveAlerts.sort((a, b) => b.estimatedLoss - a.estimatedLoss)

    return { activeAlerts: rawActiveAlerts, totalEstimatedLoss, totalDowntimeMinutes }
  }, [restaurants, checks, resolvedIncidentIds, filterBrand, filterCity, t])

  // Handle resolve incident
  const handleConfirmResolve = async (e) => {
    e.preventDefault()
    if (!resolvingIncident) return

    setIsSubmittingResolve(true)
    const alertKey = resolvingIncident.key
    const now = new Date().toISOString()

    try {
      if (resolvingIncident.id) {
        await fetch(getApiUrl(`/api/stop-events/${resolvingIncident.id}/resolve`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: resolveReason })
        }).catch(() => null)
      }

      const resolvedItem = {
        ...resolvingIncident,
        resolvedAt: now,
        resolvedReason: resolveReason || 'Rezolvat din interfață',
        finalDuration: resolvingIncident.downtime,
        finalLoss: resolvingIncident.estimatedLoss
      }

      setResolvedIncidentIds(prev => [...prev, alertKey])
      setResolvedHistory(prev => [resolvedItem, ...prev.slice(0, 49)])
      setResolvingIncident(null)
      setResolveReason('')
    } catch (err) {
      console.error('Error resolving incident:', err)
    } finally {
      setIsSubmittingResolve(false)
    }
  }

  if (loading && restaurants.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    )
  }

  const formatMoney = (val) => new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(val)
  const formatTime = (mins) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'
  const formatDateTime = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(localeCode, {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="flex flex-col h-full w-full space-y-3.5 pb-6">
      
      {/* Header Compact Laptop */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7]">
          {t('alerts.title')}
        </h2>
        {(filterBrand !== 'all' || filterCity !== 'all') && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              {filterBrand !== 'all' ? filterBrand : ''} {filterCity !== 'all' ? `(${filterCity})` : ''}
            </span>
            <button
              onClick={() => {
                setFilterBrand('all')
                setFilterCity('all')
                try {
                  const next = new URLSearchParams(searchParams)
                  next.delete('brand')
                  next.delete('city')
                  setSearchParams(next, { replace: true })
                } catch (_) {}
              }}
              className="apple-btn-sm"
            >
              <X size={12} />
              <span>{t('common.all_brands', 'Toate')}</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards — Compact Laptop Rhythm */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Total Loss */}
        <div className={`rounded-2xl shadow-sm border px-4 py-3 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {t('alerts.loss_card_title')}
            </h3>
            <div className="w-7 h-7 rounded-lg bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <TrendingDown size={14} />
            </div>
          </div>
          <div className="text-[22px] font-bold tracking-tight tabular-nums leading-tight text-rose-600 dark:text-rose-400">
            {formatMoney(alertsData.totalEstimatedLoss)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {t('alerts.loss_card_desc')}
          </div>
        </div>

        {/* Active Incidents */}
        <div className={`rounded-2xl shadow-sm border px-4 py-3 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {t('alerts.incidents_card_title')}
            </h3>
            <div className="w-7 h-7 rounded-lg bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertOctagon size={14} />
            </div>
          </div>
          <div className="text-[22px] font-bold tracking-tight tabular-nums leading-tight text-slate-900 dark:text-white">
            {alertsData.activeAlerts.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {t('alerts.incidents_card_desc')}
          </div>
        </div>

        {/* Total Downtime */}
        <div className={`rounded-2xl shadow-sm border px-4 py-3 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {t('alerts.downtime_card_title')}
            </h3>
            <div className="w-7 h-7 rounded-lg bg-[#047857]/12 text-[#047857] dark:text-[#10B981] flex items-center justify-center shrink-0">
              <Clock size={14} />
            </div>
          </div>
          <div className="text-[22px] font-bold tracking-tight tabular-nums leading-tight text-slate-900 dark:text-white">
            {formatTime(alertsData.totalDowntimeMinutes)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {t('alerts.downtime_card_desc')}
          </div>
        </div>

      </div>

      {/* TABS & TABLE — Apple macOS Tahoe Segmented Control + Luminous Empty State */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* APPLE SEGMENTED TAB SWITCHER */}
        <div className="px-4 py-2.5 border-b border-black/[0.06] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <div role="group" className="apple-segmented">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`apple-segment !h-[26px] ${activeTab === 'active' ? 'apple-segment-active' : ''}`}
            >
              <AlertCircle size={13} className={alertsData.activeAlerts.length > 0 ? 'text-rose-500' : 'text-[#047857] dark:text-[#10B981]'} />
              <span>{t('alerts.active_tab')}</span>
              <span className={`px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums ${
                alertsData.activeAlerts.length > 0
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'bg-black/[0.06] dark:bg-white/12 text-slate-600 dark:text-slate-300'
              }`}>
                {alertsData.activeAlerts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('resolved')}
              className={`apple-segment !h-[26px] ${activeTab === 'resolved' ? 'apple-segment-active' : ''}`}
            >
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>{t('alerts.resolved_tab')}</span>
              <span className="px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums bg-black/[0.06] dark:bg-white/12 text-slate-600 dark:text-slate-300">
                {scopedResolvedHistory.length}
              </span>
            </button>
          </div>

          <span className="text-[11.5px] font-medium text-[#636366] dark:text-[#AEAEB2] hidden sm:inline-block">
            {t('alerts.table_badge')}
          </span>
        </div>
        
        {/* CONTENT AREA: Apple System Status Empty State when 0 rows, otherwise Finder Table */}
        {activeTab === 'active' && alertsData.activeAlerts.length === 0 ? (
          <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-xs">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {language === 'ru'
                ? 'Все точки работают в штатном режиме'
                : language === 'en'
                  ? 'All locations are operating normally'
                  : 'Toate locațiile funcționează în parametri normali'}
            </h3>
            <p className="text-[12.5px] text-[#636366] dark:text-[#AEAEB2] mt-1 max-w-md">
              {t('alerts.no_issues')}
            </p>
            <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>
                  {restaurants.filter(r => r.is_active !== false).length}{' '}
                  {language === 'ru' ? 'активных точек · 100% онлайн' : language === 'en' ? 'active locations · 100% online' : 'locații active · 100% online'}
                </span>
              </span>
              {scopedResolvedHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('resolved')}
                  className="apple-btn-secondary !h-7 !text-[11.5px]"
                >
                  <span>{t('alerts.resolved_tab')} ({scopedResolvedHistory.length})</span>
                </button>
              )}
            </div>
          </div>
        ) : activeTab === 'resolved' && scopedResolvedHistory.length === 0 ? (
          <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
            <div className="w-11 h-11 rounded-2xl bg-[#047857]/10 border border-[#047857]/20 text-[#047857] dark:text-[#10B981] flex items-center justify-center mb-3">
              <Clock size={20} />
            </div>
            <h3 className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {language === 'ru'
                ? 'История решенных инцидентов пуста'
                : language === 'en'
                  ? 'No resolved incidents recorded'
                  : 'Nu există incidente rezolvate în istoric'}
            </h3>
            <p className="text-[12px] text-[#636366] dark:text-[#AEAEB2] mt-1">
              {language === 'ru'
                ? 'Все закрытые остановки и восстановленные каналы будут сохраняться здесь.'
                : language === 'en'
                  ? 'Resolved outages and restored platform channels will appear here.'
                  : 'Toate opririle rezolvate și canalele restaurate vor apărea aici.'}
            </p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr>
                <th className="px-4 py-2.5">{t('alerts.th_restaurant')}</th>
                <th className="px-4 py-2.5 w-36">{t('alerts.th_platform')}</th>
                <th className="px-4 py-2.5">{t('alerts.th_issue')}</th>
                <th className="px-4 py-2.5 text-right w-28">{t('alerts.th_downtime')}</th>
                <th className="px-4 py-2.5 text-right w-32">{t('alerts.th_loss')}</th>
                <th className="px-4 py-2.5 text-center w-32">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              
              {/* ACTIVE TAB ROWS */}
              {activeTab === 'active' && alertsData.activeAlerts.map((alert) => {
                const cleanedName = cleanRestaurantName(alert.restaurant.name)
                return (
                  <tr key={alert.key}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <BrandAvatar brand={alert.restaurant} size={28} className="rounded-full shrink-0" />
                        <div>
                          <div className="font-semibold text-[13px] text-slate-900 dark:text-white leading-tight">
                            {cleanedName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{alert.city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <PlatformLogo platform={alert.platform} size={17} />
                        <span className="text-[13px] font-semibold capitalize text-slate-800 dark:text-slate-200">{alert.platform}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-[12.5px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{alert.message}</span>
                      </div>
                      <div className="mt-1">
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-500/12 text-rose-600 dark:text-rose-400">
                          {alert.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                      {formatTime(alert.downtime)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <div className="text-[13px] font-bold text-rose-600 dark:text-rose-400">
                        {formatMoney(alert.estimatedLoss)}
                      </div>
                      <div className="text-[10.5px] text-slate-400">
                        {alert.hourlyRate} RON/h
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingIncident(alert)
                            setResolveReason('')
                          }}
                          className="apple-btn-primary !h-7 !px-2.5 !text-[11px]"
                          title={t('alerts.resolve_btn')}
                        >
                          <Check size={12} />
                          <span>{t('alerts.resolve_btn')}</span>
                        </button>

                        {alert.url && (
                          <a
                            href={alert.url}
                            target="_blank"
                            rel="noreferrer"
                            className="apple-btn-secondary !w-7 !h-7 !p-0"
                            title={t('alerts.open_in_platform')}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {/* RESOLVED TAB ROWS */}
              {activeTab === 'resolved' && scopedResolvedHistory.map((item, idx) => {
                const cleanedName = cleanRestaurantName(item.restaurant?.name || '')
                return (
                  <tr key={`${item.key}-${idx}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <BrandAvatar brand={item.restaurant} size={28} className="rounded-full shrink-0" />
                        <div>
                          <div className="font-semibold text-[13px] text-slate-900 dark:text-white leading-tight">
                            {cleanedName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <PlatformLogo platform={item.platform} size={17} />
                        <span className="text-[13px] font-semibold capitalize text-slate-800 dark:text-slate-200">{item.platform}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 size={13} />
                        <span>{t('alerts.resolved_at')} {formatDateTime(item.resolvedAt)}</span>
                      </div>
                      {item.resolvedReason && (
                        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 italic">
                          „{item.resolvedReason}”
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                      {formatTime(item.finalDuration || item.downtime)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatMoney(item.finalLoss || item.estimatedLoss)}
                    </td>
                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
                        {t('alerts.resolved_badge', 'Rezolvat')}
                      </span>
                    </td>
                  </tr>
                )
              })}

            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* RESOLVE SHEET — macOS Tahoe 26 */}
      {resolvingIncident && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setResolvingIncident(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setResolvingIncident(null) }}
          tabIndex={-1}
          className="fixed inset-0 apple-sheet-backdrop z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-sheet w-full max-w-md overflow-hidden"
          >
            <div className="apple-sheet-header px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} />
                <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">{t('alerts.resolve_modal_title')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingIncident(null)}
                aria-label="Close"
                className="apple-sheet-close"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleConfirmResolve} className="p-5 space-y-4">
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('alerts.resolve_modal_desc')}
              </p>

              <div>
                <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('alerts.resolve_reason_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('alerts.resolve_reason_placeholder')}
                  value={resolveReason}
                  onChange={e => setResolveReason(e.target.value)}
                  className={`w-full px-3.5 h-9 text-[13px] rounded-xl border outline-none transition-colors ${
                    isDark
                      ? 'bg-white/[0.06] border-white/12 text-white placeholder:text-slate-500 focus:border-[#10B981]'
                      : 'bg-white border-black/12 text-slate-900 placeholder:text-slate-400 focus:border-[#047857]'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setResolvingIncident(null)}
                  className="apple-btn-secondary"
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingResolve}
                  className="apple-btn-primary disabled:opacity-50"
                >
                  <Loader2 className={`w-3.5 h-3.5 ${isSubmittingResolve ? 'animate-spin' : 'hidden'}`} />
                  <span>{isSubmittingResolve ? t('alerts.resolving') : t('alerts.confirm_resolve')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
