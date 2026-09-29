import { useState, useMemo, useEffect } from 'react'
import { useLiveChecks } from '../hooks/useLiveChecks'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { AlertOctagon, TrendingDown, Clock, ExternalLink, Loader2, AlertCircle, CheckCircle2, X, Check } from 'lucide-react'
import BrandAvatar, { cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import { getApiUrl } from '../lib/api'

const HOURLY_LOSS_RATE = 50 // 50 RON per hour fallback if restaurant metadata is missing

export default function Alerts() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const { restaurants, checks, loading } = useLiveChecks()

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
  }, [restaurants, checks, resolvedIncidentIds, t])

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
    <div className="flex flex-col h-full w-full space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('alerts.title')}
        </h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Total Loss */}
        <div className={`rounded-2xl shadow-sm border p-6 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center">
              <TrendingDown size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('alerts.loss_card_title')}
            </h3>
          </div>
          <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">
            {formatMoney(alertsData.totalEstimatedLoss)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">
            {t('alerts.loss_card_desc')}
          </div>
        </div>

        {/* Active Incidents */}
        <div className={`rounded-2xl shadow-sm border p-6 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
              <AlertOctagon size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('alerts.incidents_card_title')}
            </h3>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {alertsData.activeAlerts.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">
            {t('alerts.incidents_card_desc')}
          </div>
        </div>

        {/* Total Downtime */}
        <div className={`rounded-2xl shadow-sm border p-6 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
              <Clock size={18} />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('alerts.downtime_card_title')}
            </h3>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {formatTime(alertsData.totalDowntimeMinutes)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">
            {t('alerts.downtime_card_desc')}
          </div>
        </div>

      </div>

      {/* TABS & TABLE */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* TAB SWITCHER */}
        <div className={`px-6 py-3 border-b flex items-center justify-between ${
          isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'active'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <AlertCircle size={14} />
              <span>{t('alerts.active_tab')}</span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] ${
                activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}>
                {alertsData.activeAlerts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('resolved')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'resolved'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 size={14} />
              <span>{t('alerts.resolved_tab')}</span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] ${
                activeTab === 'resolved' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}>
                {resolvedHistory.length}
              </span>
            </button>
          </div>

          <span className={`text-xs font-bold hidden sm:inline-block ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {t('alerts.table_badge')}
          </span>
        </div>
        
        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead className={`border-b text-[11px] font-bold uppercase tracking-wider ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="px-6 py-3.5">{t('alerts.th_restaurant')}</th>
                <th className="px-6 py-3.5 w-36">{t('alerts.th_platform')}</th>
                <th className="px-6 py-3.5">{t('alerts.th_issue')}</th>
                <th className="px-6 py-3.5 text-right w-32">{t('alerts.th_downtime')}</th>
                <th className="px-6 py-3.5 text-right w-36">{t('alerts.th_loss')}</th>
                <th className="px-6 py-3.5 text-center w-28">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-sm ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              
              {/* ACTIVE TAB ROWS */}
              {activeTab === 'active' && (
                alertsData.activeAlerts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center text-slate-500 dark:text-slate-400 font-medium">
                      {t('alerts.no_issues')}
                    </td>
                  </tr>
                ) : (
                  alertsData.activeAlerts.map((alert) => {
                    const cleanedName = cleanRestaurantName(alert.restaurant.name)
                    return (
                      <tr 
                        key={alert.key} 
                        className={`transition-colors ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <BrandAvatar brand={alert.restaurant} size={32} className="rounded-full shrink-0 shadow-xs" />
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-white">
                                {cleanedName}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{alert.city}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <PlatformLogo platform={alert.platform} size={18} />
                            <span className="text-sm font-bold capitalize text-slate-800 dark:text-slate-200">{alert.platform}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{alert.message}</span>
                          </div>
                          <div className="mt-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 uppercase">
                              {alert.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {formatTime(alert.downtime)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                            {formatMoney(alert.estimatedLoss)}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {alert.hourlyRate} RON/h
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setResolvingIncident(alert)
                                setResolveReason('')
                              }}
                              className="px-3 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors shadow-xs"
                              title={t('alerts.resolve_btn')}
                            >
                              <Check size={13} />
                              <span>{t('alerts.resolve_btn')}</span>
                            </button>

                            {alert.url && (
                              <a 
                                href={alert.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`w-7 h-7 rounded-full border inline-flex items-center justify-center transition-colors ${
                                  isDark 
                                    ? 'border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200' 
                                    : 'border-slate-200 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600'
                                }`}
                                title={t('alerts.open_in_platform')}
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )
              )}

              {/* RESOLVED TAB ROWS */}
              {activeTab === 'resolved' && (
                resolvedHistory.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-20 text-center text-slate-500 dark:text-slate-400 font-medium">
                      Nu există incidente rezolvate în istoric.
                    </td>
                  </tr>
                ) : (
                  resolvedHistory.map((item, idx) => {
                    const cleanedName = cleanRestaurantName(item.restaurant?.name || '')
                    return (
                      <tr 
                        key={`${item.key}-${idx}`} 
                        className={`transition-colors ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <BrandAvatar brand={item.restaurant} size={32} className="rounded-full shrink-0 shadow-xs" />
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-white">
                                {cleanedName}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.city}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <PlatformLogo platform={item.platform} size={18} />
                            <span className="text-sm font-bold capitalize text-slate-800 dark:text-slate-200">{item.platform}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 size={14} />
                            <span>{t('alerts.resolved_at')} {formatDateTime(item.resolvedAt)}</span>
                          </div>
                          {item.resolvedReason && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                              "{item.resolvedReason}"
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {formatTime(item.finalDuration || item.downtime)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                          {formatMoney(item.finalLoss || item.estimatedLoss)}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            {t('alerts.resolved_badge', 'Rezolvat')}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* RESOLVE MODAL (NO BROWSER ALERT/CONFIRM) */}
      {resolvingIncident && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 size={20} />
                <h3 className="text-base font-bold">{t('alerts.resolve_modal_title')}</h3>
              </div>
              <button 
                onClick={() => setResolvingIncident(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              {t('alerts.resolve_modal_desc')}
            </p>

            <form onSubmit={handleConfirmResolve} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('alerts.resolve_reason_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('alerts.resolve_reason_placeholder')}
                  value={resolveReason}
                  onChange={e => setResolveReason(e.target.value)}
                  className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-xs ${
                    isDark 
                      ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500' 
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolvingIncident(null)}
                  className={`px-4 h-9 rounded-full text-xs font-bold border transition-colors ${
                    isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingResolve}
                  className="px-5 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
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
