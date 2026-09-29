import React, { useState, useEffect } from 'react'
import { X, Clock, ExternalLink, AlertTriangle, ShieldCheck, ShoppingBag, Database, Send, CheckCircle2, Loader2, Calendar } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import BrandAvatar, { cleanRestaurantName } from './BrandAvatar'
import PlatformLogo from './PlatformLogo'

export default function RestaurantDetailsModal({ restaurant, isOpen, onClose }) {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()

  const [activeTab, setActiveTab] = useState('overview')
  const [stops, setStops] = useState([])
  const [stoppedProducts, setStoppedProducts] = useState([])
  const [loadingStops, setLoadingStops] = useState(false)

  useEffect(() => {
    if (!isOpen || !restaurant?.id) return

    setActiveTab('overview')

    // Fetch stops
    setLoadingStops(true)
    fetch(`http://localhost:3002/api/stop-events?restaurantId=${restaurant.id}&limit=20`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStops(data.events || [])
        }
      })
      .catch(console.error)
      .finally(() => setLoadingStops(false))

    // Fetch stopped products from iiko / discrepancies
    fetch(`http://localhost:3002/api/own-brands/stopped-products?restaurantId=${restaurant.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.products) {
          setStoppedProducts(data.products)
        } else {
          setStoppedProducts([])
        }
      })
      .catch(() => setStoppedProducts([]))
  }, [isOpen, restaurant?.id])

  if (!isOpen || !restaurant) return null

  const cleanedName = cleanRestaurantName(restaurant.name)
  const workingHours = restaurant.working_hours || {}
  const openTime = workingHours.start || '10:00'
  const closeTime = workingHours.end || '22:00'
  const telegramGroup = workingHours.telegram_group_id || restaurant.telegram_group_id || '—'
  const notificationsActive = workingHours.notification_enabled !== false

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  const formatDateTime = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(localeCode, {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-3xl rounded-3xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden transition-all ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* HEADER */}
        <div className={`p-6 pb-4 border-b flex items-start justify-between gap-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3.5">
            <BrandAvatar brand={restaurant} size={48} className="rounded-2xl shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold leading-snug">
                  {cleanedName}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  restaurant.is_active 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' 
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {restaurant.is_active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {restaurant.city} · {restaurant.address || t('common.no_address')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* TABS */}
        <div className={`px-6 pt-3 border-b flex items-center gap-2 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Calendar size={14} />
            {t('details_modal.tab_overview')}
          </button>

          <button
            onClick={() => setActiveTab('stops')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'stops'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <AlertTriangle size={14} />
            {t('details_modal.tab_stops')}
            {stops.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {stops.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'menu'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShoppingBag size={14} />
            {t('details_modal.tab_menu')}
            {stoppedProducts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                {stoppedProducts.length}
              </span>
            )}
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Metrics row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock size={13} /> {t('settings.field_working_hours')}
                  </div>
                  <div className="text-base font-bold mt-1.5 text-slate-900 dark:text-white">
                    {openTime} – {closeTime}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                    {t('settings.card_schedules_desc')}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Send size={13} /> Telegram
                  </div>
                  <div className="text-xs font-bold mt-1.5 text-slate-900 dark:text-white truncate" title={telegramGroup}>
                    {telegramGroup}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${notificationsActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    {notificationsActive ? 'Alerte Active' : 'Dezactivat'}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Database size={13} /> {t('settings.field_revenue_rate')}
                  </div>
                  <div className="text-base font-bold mt-1.5 text-slate-900 dark:text-white">
                    {restaurant.revenue_per_hour || 100} RON / h
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Calcul downtime financiar
                  </div>
                </div>
              </div>

              {/* Platform links */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  {t('settings.section_platform_links')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {['glovo', 'wolt', 'bolt'].map(platform => {
                    const url = restaurant[`${platform}_url`]
                    return (
                      <div 
                        key={platform}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                          isDark ? 'bg-slate-800/50 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <PlatformLogo platform={platform} size={22} />
                          <span className="text-xs font-bold capitalize">{platform === 'bolt' ? 'Bolt Food' : platform}</span>
                        </div>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                          >
                            <span>Link</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Lipsă</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* iiko organization */}
              {restaurant.iiko_restaurant_id && (
                <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <PlatformLogo platform="iiko" size={24} />
                    <div>
                      <div className="text-xs font-bold">iiko Cloud ID</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 select-all">
                        {restaurant.iiko_restaurant_id}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck size={14} /> Sincronizat
                  </span>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: STOPS */}
          {activeTab === 'stops' && (
            <div>
              {loadingStops ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="animate-spin text-emerald-600" size={28} />
                </div>
              ) : stops.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                  {t('details_modal.no_stops')}
                </div>
              ) : (
                <div className="rounded-2xl border overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'bg-slate-800/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                      <tr>
                        <th className="px-4 py-3">Platformă</th>
                        <th className="px-4 py-3">De la</th>
                        <th className="px-4 py-3">Până la</th>
                        <th className="px-4 py-3">Durată</th>
                        <th className="px-4 py-3 text-right">Pierdere</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {stops.map(s => {
                        const isLive = !s.resumed_at
                        return (
                          <tr key={s.id} className={isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'}>
                            <td className="px-4 py-3 font-bold flex items-center gap-2">
                              <PlatformLogo platform={s.platform} size={16} />
                              <span className="capitalize">{s.platform}</span>
                            </td>
                            <td className="px-4 py-3">{formatDateTime(s.stopped_at)}</td>
                            <td className="px-4 py-3">
                              {isLive ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                                  Activ
                                </span>
                              ) : (
                                formatDateTime(s.resumed_at)
                              )}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {s.duration_minutes ? `${s.duration_minutes} min` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                              {s.estimated_loss_amount ? `${s.estimated_loss_amount} RON` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MENU / STOP LIST */}
          {activeTab === 'menu' && (
            <div>
              {stoppedProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                  {t('details_modal.no_stopped_products')}
                </div>
              ) : (
                <div className="rounded-2xl border overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                      isDark ? 'bg-slate-800/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                      <tr>
                        <th className="px-4 py-3">{t('details_modal.product_name')}</th>
                        <th className="px-4 py-3">{t('details_modal.category')}</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {stoppedProducts.map((p, idx) => (
                        <tr key={idx} className={isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'}>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {typeof p === 'string' ? p : (p.name || 'Produs')}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {p.category || 'Meniu Principal'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                              Stop-List
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className={`p-4 px-6 border-t flex items-center justify-end ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'}`}>
          <button
            onClick={onClose}
            className={`px-5 h-9 rounded-full text-xs font-bold border transition-colors ${
              isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-white' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-800'
            }`}
          >
            {t('common.close')}
          </button>
        </div>

      </div>
    </div>
  )
}
