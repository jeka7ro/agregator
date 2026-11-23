import React, { useState, useEffect } from 'react'
import { X, Clock, ExternalLink, AlertTriangle, ShieldCheck, ShoppingBag, Database, Send, CheckCircle2, Loader2, Calendar, Flame, UtensilsCrossed } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import BrandAvatar, { cleanRestaurantName } from './BrandAvatar'
import PlatformLogo from './PlatformLogo'
import { getApiUrl } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

export default function RestaurantDetailsModal({ restaurant, isOpen = true, onClose }) {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()

  const [activeTab, setActiveTab] = useState('overview')
  const [stops, setStops] = useState([])
  const [stoppedProducts, setStoppedProducts] = useState([])
  const [loadingStops, setLoadingStops] = useState(false)
  const [kitchenStatus, setKitchenStatus] = useState(null)
  const [loadingKitchen, setLoadingKitchen] = useState(false)

  useEffect(() => {
    if (!isOpen || !restaurant) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, restaurant, onClose])

  useEffect(() => {
    if (!isOpen || !restaurant?.id) return

    setActiveTab('overview')

    // Fetch stops: try API first, fallback to Supabase direct query
    setLoadingStops(true)
    fetch(getApiUrl(`/api/stop-events?restaurantId=${restaurant.id}&limit=20`))
      .then(res => res.json())
      .then(data => {
        if (data.success && data.events) {
          setStops(data.events)
        } else {
          throw new Error('API failed')
        }
      })
      .catch(async () => {
        try {
          const { data, error } = await supabase
            .from('stop_events')
            .select('*')
            .eq('restaurant_id', restaurant.id)
            .order('stopped_at', { ascending: false })
            .limit(20)
          if (!error && data) {
            setStops(data)
          }
        } catch (sbErr) {
          console.error('Supabase stops error:', sbErr)
        }
      })
      .finally(() => setLoadingStops(false))

    // Fetch stopped products from iiko / discrepancies
    fetch(getApiUrl(`/api/own-brands/stopped-products?restaurantId=${restaurant.id}`))
      .then(res => res.json())
      .then(data => {
        if (data.success && data.products) {
          setStoppedProducts(data.products)
        } else {
          setStoppedProducts([])
        }
      })
      .catch(() => setStoppedProducts([]))

    // Fetch kitchen activity status (live orders from iiko in the last 30 mins)
    setLoadingKitchen(true)
    fetch(getApiUrl(`/api/kitchen-status?restaurantId=${restaurant.id}&minutes=30`))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setKitchenStatus(data)
        } else {
          setKitchenStatus(null)
        }
      })
      .catch(() => setKitchenStatus(null))
      .finally(() => setLoadingKitchen(false))
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
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose?.() }}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 apple-sheet-backdrop animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="apple-sheet w-full max-w-3xl flex flex-col max-h-[88vh] overflow-hidden"
      >
        {/* LIQUID GLASS HEADER */}
        <div className="apple-sheet-header px-5 py-3.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BrandAvatar brand={restaurant} size={40} className="rounded-xl shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[16px] font-semibold tracking-tight leading-snug text-slate-900 dark:text-white truncate">
                  {cleanedName}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                  restaurant.is_active
                    ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
                    : 'bg-black/[0.06] dark:bg-white/10 text-slate-500 dark:text-slate-400'
                }`}>
                  {restaurant.is_active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {restaurant.city} · {restaurant.address || t('common.no_address')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="apple-sheet-close"
          >
            <X size={15} />
          </button>
        </div>

        {/* APPLE SEGMENTED TABS */}
        <div className="px-5 py-2.5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="apple-segmented">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`apple-segment ${activeTab === 'overview' ? 'apple-segment-active' : ''}`}
            >
              <Calendar size={13} />
              <span>{t('details_modal.tab_overview')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stops')}
              className={`apple-segment ${activeTab === 'stops' ? 'apple-segment-active' : ''}`}
            >
              <AlertTriangle size={13} />
              <span>{t('details_modal.tab_stops')}</span>
              {stops.length > 0 && (
                <span className="px-1.5 rounded-full text-[10px] font-semibold tabular-nums bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  {stops.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`apple-segment ${activeTab === 'menu' ? 'apple-segment-active' : ''}`}
            >
              <ShoppingBag size={13} />
              <span>{t('details_modal.tab_menu')}</span>
              {stoppedProducts.length > 0 && (
                <span className="px-1.5 rounded-full text-[10px] font-semibold tabular-nums bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  {stoppedProducts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              
              {/* Metrics row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="apple-inset-card p-3.5">
                  <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock size={13} className="text-[#047857] dark:text-[#10B981]" /> {t('settings.field_working_hours')}
                  </div>
                  <div className="text-[16px] font-semibold mt-1 text-slate-900 dark:text-white tabular-nums">
                    {openTime} – {closeTime}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    {t('settings.card_schedules_desc')}
                  </div>
                </div>

                <div className="apple-inset-card p-3.5">
                  <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Send size={13} className="text-[#047857] dark:text-[#10B981]" /> Telegram
                  </div>
                  <div className="text-[13px] font-semibold mt-1 text-slate-900 dark:text-white truncate" title={telegramGroup}>
                    {telegramGroup}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${notificationsActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    {notificationsActive ? 'Alerte Active' : 'Dezactivat'}
                  </div>
                </div>

                <div className="apple-inset-card p-3.5">
                  <div className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Database size={13} className="text-[#047857] dark:text-[#10B981]" /> {t('settings.field_revenue_rate')}
                  </div>
                  <div className="text-[16px] font-semibold mt-1 text-slate-900 dark:text-white tabular-nums">
                    {restaurant.revenue_per_hour || 100} RON / h
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Calcul downtime financiar
                  </div>
                </div>
              </div>

              {/* Diagnostic Bucătărie & Comenzi Live (iiko) */}
              <div className={`p-3.5 rounded-[14px] border transition-all ${
                kitchenStatus?.kitchen_busy
                  ? (isDark ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-amber-50/70 border-amber-200/80 text-amber-900')
                  : 'apple-inset-card text-slate-700 dark:text-slate-300'
              }`}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <Flame size={15} className={kitchenStatus?.kitchen_busy ? 'text-amber-500' : 'text-slate-400'} />
                    <span className="text-[12.5px] font-semibold">
                      Diagnostic activitate bucătărie (ultimele 30 min)
                    </span>
                  </div>
                  <span className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full ${
                    kitchenStatus?.kitchen_busy
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      : 'bg-black/[0.06] dark:bg-white/10 text-slate-600 dark:text-slate-300'
                  }`}>
                    {loadingKitchen ? 'Verificare...' : kitchenStatus?.kitchen_busy ? 'Bucătărie activă' : 'Fără comenzi recente'}
                  </span>
                </div>
                <div className="text-[12px]">
                  {loadingKitchen ? (
                    <span className="text-slate-400">Se interoghează starea comenzilor live iiko...</span>
                  ) : kitchenStatus?.kitchen_busy ? (
                    <span>
                      S-au recepționat <strong>{kitchenStatus.total_orders_count} comenzi</strong> recent ({kitchenStatus.restaurant_orders_count} restaurant / casă, {kitchenStatus.delivery_orders_count} livrări). Bucătăria gătește comenzi fizice.
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      Nicio comandă nouă recepționată în ultimele 30 de minute (iiko Cloud Webhook pregătit).
                    </span>
                  )}
                </div>
              </div>

              {/* Platform links */}
              <div>
                <h4 className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {t('settings.section_platform_links')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {['glovo', 'wolt', 'bolt'].map(platform => {
                    const url = restaurant[`${platform}_url`]
                    return (
                      <div
                        key={platform}
                        className="apple-inset-card px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <PlatformLogo platform={platform} size={20} />
                          <span className="text-[12.5px] font-semibold capitalize text-slate-900 dark:text-white">{platform === 'bolt' ? 'Bolt Food' : platform}</span>
                        </div>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="apple-btn-sm text-[#047857] dark:text-[#10B981]"
                          >
                            <span>Link</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">Lipsă</span>
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
