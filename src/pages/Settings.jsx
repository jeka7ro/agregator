import { useState, useEffect, useMemo } from 'react'
import { 
  SlidersHorizontal, 
  Save, 
  RefreshCw, 
  Search, 
  Edit2, 
  X, 
  CheckCircle2, 
  XCircle, 
  Store, 
  Clock, 
  Database,
  Radio,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  FileText,
  Webhook
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import BrandAvatar, { cleanRestaurantName, getBrandInfo } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import RestaurantDetailsModal from '../components/RestaurantDetailsModal'
import WebhookIntegrationModal from '../components/WebhookIntegrationModal'
import { getApiUrl } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

const AUTHORITATIVE_BRANDS = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

export default function Settings() {
  const { isDark } = useTheme()
  const { t } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [restaurants, setRestaurants] = useState([])
  const [statusInfo, setStatusInfo] = useState(null)
  const [isTriggeringMonitoring, setIsTriggeringMonitoring] = useState(false)
  const [isTriggeringSalesSync, setIsTriggeringSalesSync] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [showOnlyActive, setShowOnlyActive] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Edit Modal State
  const [editingRestaurant, setEditingRestaurant] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type })
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  // Telegram Bot State
  const [botToken, setBotToken] = useState(() => localStorage.getItem('telegram_bot_token') || '')
  const [testChatId, setTestChatId] = useState(() => localStorage.getItem('telegram_test_chat_id') || '')
  const [isTestingTelegram, setIsTestingTelegram] = useState(false)
  const [showTelegramCard, setShowTelegramCard] = useState(false)

  // Details Modal State
  const [selectedRestaurantForDetails, setSelectedRestaurantForDetails] = useState(null)
  const [showWebhookModal, setShowWebhookModal] = useState(false)

  // Action: Test Telegram Bot
  const handleTestTelegram = async () => {
    if (!testChatId.trim()) {
      showToast(t('telegram.test_error') + ': Introduceți ID-ul de Chat / Grup', 'error')
      return
    }
    try {
      setIsTestingTelegram(true)
      localStorage.setItem('telegram_bot_token', botToken)
      localStorage.setItem('telegram_test_chat_id', testChatId)

      const res = await fetch(getApiUrl('/api/telegram/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          botToken: botToken.trim() || undefined, 
          chatId: testChatId.trim() 
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('telegram.test_success'), 'success')
      } else {
        showToast(data.error || t('telegram.test_error'), 'error')
      }
    } catch (err) {
      showToast(t('telegram.test_error'), 'error')
    } finally {
      setIsTestingTelegram(false)
    }
  }

  // Load status and restaurants
  const fetchData = async () => {
    try {
      setLoading(true)
      const [statusRes, restsRes] = await Promise.all([
        fetch(getApiUrl('/api/settings/status')).then(r => r.json()).catch(() => null),
        fetch(getApiUrl('/api/settings/restaurants')).then(r => r.json()).catch(() => null)
      ])

      if (statusRes && statusRes.success) setStatusInfo(statusRes)
      if (restsRes && restsRes.success && Array.isArray(restsRes.restaurants) && restsRes.restaurants.length > 0) {
        setRestaurants(restsRes.restaurants)
      } else {
        // Fallback to Supabase if API endpoint is not available
        try {
          const { data: dbRests } = await supabase.from('restaurants').select('*, brands(*)').order('name')
          if (dbRests && dbRests.length > 0) {
            setRestaurants(dbRests)
          }
        } catch (dbErr) {
          console.warn('Supabase fallback for settings restaurants failed:', dbErr)
        }
      }
    } catch (err) {
      console.error('Error loading settings data:', err)
      showToast(t('settings.toast_save_error', 'Eroare la încărcarea datelor de configurare'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Action: Trigger Monitoring
  const handleTriggerMonitoring = async () => {
    try {
      setIsTriggeringMonitoring(true)
      const res = await fetch(getApiUrl('/api/settings/trigger-monitoring'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('settings.toast_monitoring_started'), 'success')
      } else {
        showToast((t('settings.toast_save_error') + ' ' + (data.error || 'Necunoscut')), 'error')
      }
    } catch (err) {
      showToast(t('settings.toast_save_error'), 'error')
    } finally {
      setIsTriggeringMonitoring(false)
    }
  }

  // Action: Trigger Sales Sync
  const handleTriggerSalesSync = async () => {
    try {
      setIsTriggeringSalesSync(true)
      const res = await fetch(getApiUrl('/api/settings/trigger-sales-sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 2 })
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('settings.toast_sales_synced'), 'success')
      } else {
        showToast(t('settings.toast_save_error') + ' ' + (data.error || 'Necunoscut'), 'error')
      }
    } catch (err) {
      showToast(t('settings.toast_save_error'), 'error')
    } finally {
      setIsTriggeringSalesSync(false)
    }
  }

  // Action: Save Edited Restaurant
  const handleSaveRestaurant = async (e) => {
    e.preventDefault()
    if (!editingRestaurant) return

    try {
      setIsSaving(true)
      const workingHoursPayload = {
        start: editingRestaurant.working_hours_start || editingRestaurant.working_hours?.start || '10:00',
        end: editingRestaurant.working_hours_end || editingRestaurant.working_hours?.end || '22:00',
        telegram_group_id: editingRestaurant.telegram_group_id || editingRestaurant.working_hours?.telegram_group_id || '',
        notification_enabled: editingRestaurant.notification_enabled !== undefined 
          ? editingRestaurant.notification_enabled 
          : (editingRestaurant.working_hours?.notification_enabled !== false)
      }

      let saveSuccess = false

      // Try worker API first if reachable
      try {
        const res = await fetch(getApiUrl(`/api/settings/restaurants/${editingRestaurant.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingRestaurant.name,
            city: editingRestaurant.city,
            address: editingRestaurant.address,
            glovo_url: editingRestaurant.glovo_url,
            wolt_url: editingRestaurant.wolt_url,
            bolt_url: editingRestaurant.bolt_url,
            iiko_restaurant_id: editingRestaurant.iiko_restaurant_id,
            revenue_per_hour: editingRestaurant.revenue_per_hour,
            is_active: editingRestaurant.is_active,
            working_hours: workingHoursPayload
          })
        })
        const data = await res.json()
        if (data.success) saveSuccess = true
      } catch (apiErr) {
        // Fallback to direct Supabase update (useful on Netlify if worker is offline)
        const { error: sbErr } = await supabase.from('restaurants').update({
          name: editingRestaurant.name,
          city: editingRestaurant.city,
          address: editingRestaurant.address,
          glovo_url: editingRestaurant.glovo_url,
          wolt_url: editingRestaurant.wolt_url,
          bolt_url: editingRestaurant.bolt_url,
          iiko_restaurant_id: editingRestaurant.iiko_restaurant_id,
          revenue_per_hour: editingRestaurant.revenue_per_hour,
          is_active: editingRestaurant.is_active,
          working_hours: workingHoursPayload
        }).eq('id', editingRestaurant.id)

        if (!sbErr) saveSuccess = true
      }

      if (saveSuccess) {
        setRestaurants(prev => prev.map(r => r.id === editingRestaurant.id ? { 
          ...r, 
          ...editingRestaurant,
          working_hours: workingHoursPayload
        } : r))
        setEditingRestaurant(null)
        showToast(t('settings.toast_save_success'), 'success')
      } else {
        showToast(t('settings.toast_save_error'), 'error')
      }
    } catch (err) {
      console.error('Error updating restaurant:', err)
      showToast(t('settings.toast_save_error'), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Brands strictly from AUTHORITATIVE_BRANDS list
  const brandsList = useMemo(() => {
    return ['all', ...AUTHORITATIVE_BRANDS]
  }, [])

  // Filtered restaurants
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(r => {
      const brandInfo = getBrandInfo(r)
      const matchBrand = selectedBrand === 'all' || brandInfo.name === selectedBrand
      const matchActive = !showOnlyActive || r.is_active

      const cleanedName = cleanRestaurantName(r.name)
      const query = searchTerm.toLowerCase().trim()
      const matchSearch = !query || 
        (cleanedName && cleanedName.toLowerCase().includes(query)) ||
        (r.city && r.city.toLowerCase().includes(query)) ||
        (r.address && r.address.toLowerCase().includes(query))

      return matchBrand && matchActive && matchSearch
    })
  }, [restaurants, selectedBrand, showOnlyActive, searchTerm])

  // Pagination logic
  const totalPages = Math.ceil(filteredRestaurants.length / itemsPerPage) || 1
  const paginatedRestaurants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredRestaurants.slice(start, start + itemsPerPage)
  }, [filteredRestaurants, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedBrand, showOnlyActive, searchTerm])

  if (loading && restaurants.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[120] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/90 dark:text-rose-300 dark:border-rose-800'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-300 dark:border-emerald-800'
          }`}>
            {toastMessage.type === 'error' ? <XCircle className="w-5 h-5 text-rose-600 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            <span className="text-sm font-bold">{toastMessage.message}</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('settings.title')}
        </h2>

        {/* Quick Trigger Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleTriggerMonitoring}
            disabled={isTriggeringMonitoring}
            className="px-4 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Loader2 className={`w-3.5 h-3.5 ${isTriggeringMonitoring ? 'animate-spin' : 'hidden'}`} />
            <span>{isTriggeringMonitoring ? t('settings.scanning_action') : t('settings.trigger_monitoring')}</span>
          </button>

          <button
            onClick={handleTriggerSalesSync}
            disabled={isTriggeringSalesSync}
            className={`px-4 h-9 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 disabled:opacity-50 ${
              isDark 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
                : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Loader2 className={`w-3.5 h-3.5 ${isTriggeringSalesSync ? 'animate-spin' : 'hidden'}`} />
            <span>{isTriggeringSalesSync ? t('settings.syncing_action') : t('settings.trigger_sales_sync')}</span>
          </button>

          <button
            onClick={() => setShowTelegramCard(prev => !prev)}
            className={`px-4 h-9 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 ${
              showTelegramCard
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : isDark 
                  ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' 
                  : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t('telegram.card_title')}</span>
          </button>

          <button
            onClick={() => setShowWebhookModal(true)}
            className={`px-4 h-9 rounded-full text-xs font-bold border transition-colors flex items-center gap-2 cursor-pointer ${
              isDark 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-cyan-400' 
                : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-cyan-700'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>{t('webhooks.btn_live', 'Webhooks Live')}</span>
          </button>
        </div>
      </div>

      {/* TELEGRAM CONFIG CARD (COLLAPSIBLE) */}
      {showTelegramCard && (
        <div className={`p-5 rounded-3xl border shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-3 border-b pb-3 border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center font-bold">
                <Send size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold">{t('telegram.card_title')}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('telegram.card_desc')}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowTelegramCard(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold px-2 py-1"
            >
              {t('common.close')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('telegram.bot_token')}
              </label>
              <input
                type="password"
                placeholder="Ex: 123456789:ABCdefGHI..."
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-xs ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t('telegram.chat_id')}
              </label>
              <input
                type="text"
                placeholder="Ex: -100123456789"
                value={testChatId}
                onChange={e => setTestChatId(e.target.value)}
                className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-xs ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500'
                }`}
              />
            </div>

            <div>
              <button
                onClick={handleTestTelegram}
                disabled={isTestingTelegram}
                className="w-full h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Loader2 className={`w-3.5 h-3.5 ${isTestingTelegram ? 'animate-spin' : 'hidden'}`} />
                <span>{isTestingTelegram ? t('telegram.testing') : t('telegram.test_btn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total & Active Restaurants */}
        <div className={`rounded-2xl shadow-sm border p-5 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('settings.card_registered')}
            </span>
            <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {statusInfo?.active_restaurants ?? 52}
              <span className="text-sm font-semibold text-slate-400"> / {statusInfo?.total_restaurants ?? 152}</span>
            </div>
            <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('settings.card_addresses_configured')}
            </div>
          </div>
        </div>

        {/* iiko Cloud Connection */}
        <div className={`rounded-2xl shadow-sm border p-5 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('settings.card_iiko_title')}
            </span>
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{t('settings.card_iiko_connected')}</span>
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              {t('settings.card_iiko_desc')}
            </div>
          </div>
        </div>

        {/* Monitoring Schedules */}
        <div className={`rounded-2xl shadow-sm border p-5 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('settings.card_schedules_title')}
            </span>
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="flex flex-wrap gap-1.5">
              {(statusInfo?.monitoring_schedule || ['11:00', '13:00', '17:00', '18:00', '19:00']).map(time => (
                <span key={time} className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                  {time}
                </span>
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t('settings.card_schedules_desc')}
            </div>
          </div>
        </div>

        {/* Live Cache Status */}
        <div className={`rounded-2xl shadow-sm border p-5 flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('settings.card_cache_title')}
            </span>
            <Radio className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {statusInfo?.live_checks_cached ?? restaurants.length}
              <span className="text-xs font-medium text-slate-400 ml-1.5">{t('common.records', 'înregistrări')}</span>
            </div>
            <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> {t('settings.card_cache_safe')}
            </div>
          </div>
        </div>

      </div>

      {/* FILTER & SEARCH BAR */}
      <div className={`rounded-2xl shadow-sm border p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={t('common.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 h-10 text-sm rounded-full border outline-none transition-all shadow-sm ${
              isDark 
                ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500' 
                : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400'
            }`}
          />
        </div>

        {/* Brand & Active Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className={`h-10 px-4 rounded-full text-xs font-bold border outline-none cursor-pointer shadow-sm ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-slate-200' 
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {brandsList.map(b => (
                <option key={b} value={b}>
                  {b === 'all' ? t('common.all_brands') : b}
                </option>
              ))}
            </select>
          </div>

          <label className={`flex items-center gap-2 px-4 h-10 rounded-full text-xs font-bold border cursor-pointer select-none transition-all shadow-sm ${
            showOnlyActive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400'
              : isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={e => setShowOnlyActive(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>{t('common.only_active')} ({statusInfo?.active_restaurants ?? 52})</span>
          </label>

          <button
            onClick={fetchData}
            title={t('reports.refresh', 'Actualizează')}
            className={`w-8 h-8 rounded-full border transition-colors flex items-center justify-center text-slate-400 hover:text-emerald-600 ${
              isDark 
                ? 'border-slate-700 hover:bg-slate-800' 
                : 'border-slate-200 hover:bg-emerald-50'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

        </div>
      </div>

      {/* RESTAURANTS TABLE */}
      <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col flex-1 transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className={`border-b text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <tr>
                <th className="px-6 py-3.5 w-16 text-center">{t('settings.th_nr')}</th>
                <th className="px-6 py-3.5 w-32">{t('settings.th_city')}</th>
                <th className="px-6 py-3.5 min-w-[260px]">{t('settings.th_restaurant')}</th>
                <th className="px-6 py-3.5 text-center w-28">{t('settings.th_glovo')}</th>
                <th className="px-6 py-3.5 text-center w-28">{t('settings.th_wolt')}</th>
                <th className="px-6 py-3.5 text-center w-28">{t('settings.th_bolt')}</th>
                <th className="px-6 py-3.5 text-center w-28">{t('settings.th_status')}</th>
                <th className="px-6 py-3.5 text-center w-20">{t('settings.th_actions')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-sm ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {paginatedRestaurants.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center text-slate-500 dark:text-slate-400 font-medium">
                    {t('settings.no_match')}
                  </td>
                </tr>
              ) : (
                paginatedRestaurants.map((r, idx) => {
                  const itemIndex = (currentPage - 1) * itemsPerPage + idx + 1
                  const cleanedName = cleanRestaurantName(r.name)

                  return (
                    <tr 
                      key={r.id} 
                      className={`transition-colors group ${
                        isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      
                      {/* Nr (fara font-mono) */}
                      <td className="px-6 py-4 text-center text-xs font-semibold text-slate-400">
                        {itemIndex}
                      </td>

                      {/* City */}
                      <td className="px-6 py-4 font-bold text-sm text-slate-800 dark:text-slate-200">
                        {r.city}
                      </td>

                      {/* Restaurant & Address (Doar logo + nume curatat + adresa, fara badge repetat) */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <BrandAvatar brand={r} size={32} className="rounded-full shrink-0 shadow-xs" />
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {cleanedName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[320px]">
                              {r.address || t('common.unconfigured_address', 'Adresă neconfigurată')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Glovo Link (Icon curat, fara culori tipatoare) */}
                      <td className="px-6 py-4 text-center">
                        {r.glovo_url ? (
                          <a
                            href={r.glovo_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all hover:scale-105 shadow-xs ${
                              isDark 
                                ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-600' 
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                            title={`Glovo: ${cleanedName}`}
                          >
                            <PlatformLogo platform="glovo" size={18} />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-700 font-medium">—</span>
                        )}
                      </td>

                      {/* Wolt Link (Icon curat, fara culori tipatoare) */}
                      <td className="px-6 py-4 text-center">
                        {r.wolt_url ? (
                          <a
                            href={r.wolt_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all hover:scale-105 shadow-xs ${
                              isDark 
                                ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-600' 
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                            title={`Wolt: ${cleanedName}`}
                          >
                            <PlatformLogo platform="wolt" size={18} />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-700 font-medium">—</span>
                        )}
                      </td>

                      {/* Bolt Food Link (Icon curat, fara culori tipatoare) */}
                      <td className="px-6 py-4 text-center">
                        {r.bolt_url ? (
                          <a
                            href={r.bolt_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all hover:scale-105 shadow-xs ${
                              isDark 
                                ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-600' 
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                            title={`Bolt Food: ${cleanedName}`}
                          >
                            <PlatformLogo platform="bolt" size={18} />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-700 font-medium">—</span>
                        )}
                      </td>

                      {/* Status Active/Inactive */}
                      <td className="px-6 py-4 text-center">
                        {r.is_active ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t('common.active')}
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 inline-flex items-center gap-1">
                            {t('common.inactive')}
                          </span>
                        )}
                      </td>

                      {/* Actions: Details Dossier & Edit Modal */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedRestaurantForDetails(r)}
                            className={`w-8 h-8 rounded-full border transition-colors inline-flex items-center justify-center text-slate-400 hover:text-blue-500 ${
                              isDark 
                                ? 'border-slate-700 hover:bg-slate-800' 
                                : 'border-slate-200 hover:bg-blue-50'
                            }`}
                            title={t('settings.details_btn')}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setEditingRestaurant({
                              ...r,
                              working_hours_start: r.working_hours?.start || '10:00',
                              working_hours_end: r.working_hours?.end || '22:00',
                              telegram_group_id: r.working_hours?.telegram_group_id || r.telegram_group_id || '',
                              notification_enabled: r.working_hours?.notification_enabled !== false
                            })}
                            className={`w-8 h-8 rounded-full border transition-colors inline-flex items-center justify-center text-slate-400 hover:text-emerald-600 ${
                              isDark 
                                ? 'border-slate-700 hover:bg-slate-800' 
                                : 'border-slate-200 hover:bg-emerald-50'
                            }`}
                            title={t('settings.edit_modal_title')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className={`px-6 py-4 border-t flex items-center justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('settings.displayed_count', { shown: filteredRestaurants.length, total: restaurants.length })}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('common.page')} <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> {t('common.of')} {totalPages}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark 
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-300' 
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark 
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-300' 
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* EDIT MODAL */}
      {editingRestaurant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`rounded-2xl w-full max-w-xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            {/* Modal Header */}
            <div className={`px-6 py-5 border-b flex items-center justify-between ${
              isDark ? 'border-slate-800' : 'border-slate-100'
            }`}>
              <div className="flex items-center gap-3">
                <BrandAvatar brand={editingRestaurant} size={36} className="rounded-full shadow-xs" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('settings.edit_modal_title')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('settings.edit_modal_subtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingRestaurant(null)}
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors ${
                  isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRestaurant} className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    {t('settings.field_name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRestaurant.name || ''}
                    onChange={e => setEditingRestaurant({ ...editingRestaurant, name: e.target.value })}
                    className={`w-full px-4 h-10 text-sm rounded-full border outline-none transition-all shadow-sm ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500' 
                        : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    {t('settings.field_city')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRestaurant.city || ''}
                    onChange={e => setEditingRestaurant({ ...editingRestaurant, city: e.target.value })}
                    className={`w-full px-4 h-10 text-sm rounded-full border outline-none transition-all shadow-sm ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500' 
                        : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('settings.field_address')}
                </label>
                <input
                  type="text"
                  value={editingRestaurant.address || ''}
                  onChange={e => setEditingRestaurant({ ...editingRestaurant, address: e.target.value })}
                  placeholder={t('settings.field_address_placeholder')}
                  className={`w-full px-4 h-10 text-sm rounded-full border outline-none transition-all shadow-sm ${
                    isDark 
                      ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500' 
                      : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('settings.field_revenue_rate')}
                </label>
                <input
                  type="number"
                  value={editingRestaurant.revenue_per_hour || 100}
                  onChange={e => setEditingRestaurant({ ...editingRestaurant, revenue_per_hour: Number(e.target.value) })}
                  className={`w-full px-4 h-10 text-sm rounded-full border outline-none transition-all shadow-sm ${
                    isDark 
                      ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500' 
                      : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
              </div>

              {/* Platform URLs */}
              <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className="block text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {t('settings.section_platform_links')}
                </span>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('settings.field_glovo_url')}
                  </label>
                  <input
                    type="url"
                    placeholder="https://glovoapp.com/ro/ro/store/{id}"
                    value={editingRestaurant.glovo_url || ''}
                    onChange={e => setEditingRestaurant({ ...editingRestaurant, glovo_url: e.target.value })}
                    className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-sm ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500' 
                        : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('settings.field_wolt_url')}
                  </label>
                  <input
                    type="url"
                    placeholder="https://wolt.com/en/rou/restaurant/{id}"
                    value={editingRestaurant.wolt_url || ''}
                    onChange={e => setEditingRestaurant({ ...editingRestaurant, wolt_url: e.target.value })}
                    className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-sm ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500' 
                        : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('settings.field_bolt_url')}
                  </label>
                  <input
                    type="url"
                    placeholder="https://food.bolt.eu/ro-ro/store/{id}/"
                    value={editingRestaurant.bolt_url || ''}
                    onChange={e => setEditingRestaurant({ ...editingRestaurant, bolt_url: e.target.value })}
                    className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-sm ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500' 
                        : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* iiko Config */}
              <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className="block text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {t('settings.section_iiko')}
                </span>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('settings.field_iiko_uuid')}
                  </label>
                  <input
                    type="text"
                    placeholder="UUID organizație din api-eu.syrve.live"
                    value={editingRestaurant.iiko_restaurant_id || ''}
                    onChange={e => setEditingRestaurant({ ...editingRestaurant, iiko_restaurant_id: e.target.value })}
                    className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-sm ${
                      isDark 
                        ? 'bg-slate-800 border-slate-700 text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-500' 
                        : 'bg-white border-slate-200 text-slate-900 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingRestaurant.is_active || false}
                      onChange={e => setEditingRestaurant({ ...editingRestaurant, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {t('settings.field_active_monitoring')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Working Hours & Telegram Notification Section */}
              <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className="block text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {t('settings.field_working_hours')} & Telegram
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings.field_open_time')}
                    </label>
                    <input
                      type="time"
                      value={editingRestaurant.working_hours_start || '10:00'}
                      onChange={e => setEditingRestaurant({ ...editingRestaurant, working_hours_start: e.target.value })}
                      className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-sm ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings.field_close_time')}
                    </label>
                    <input
                      type="time"
                      value={editingRestaurant.working_hours_end || '22:00'}
                      onChange={e => setEditingRestaurant({ ...editingRestaurant, working_hours_end: e.target.value })}
                      className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-sm ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('settings.field_telegram_group')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('settings.field_telegram_group_placeholder')}
                    value={editingRestaurant.telegram_group_id || ''}
                    onChange={e => setEditingRestaurant({ ...editingRestaurant, telegram_group_id: e.target.value })}
                    className={`w-full px-4 h-10 text-xs rounded-full border outline-none transition-all shadow-sm ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingRestaurant.notification_enabled !== false}
                      onChange={e => setEditingRestaurant({ ...editingRestaurant, notification_enabled: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {t('settings.field_notifications_active')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className={`flex items-center justify-end gap-3 pt-4 border-t ${
                isDark ? 'border-slate-800' : 'border-slate-100'
              }`}>
                <button
                  type="button"
                  onClick={() => setEditingRestaurant(null)}
                  className={`px-5 h-10 rounded-full text-sm font-bold transition-colors ${
                    isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                  <span>{isSaving ? t('common.saving') : t('common.save')}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* RESTAURANT DETAILS MODAL */}
      <RestaurantDetailsModal
        restaurant={selectedRestaurantForDetails}
        isOpen={!!selectedRestaurantForDetails}
        onClose={() => setSelectedRestaurantForDetails(null)}
      />

      {/* WEBHOOK INTEGRATION MODAL */}
      <WebhookIntegrationModal
        isOpen={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        onWebhookTriggered={fetchData}
      />

    </div>
  )
}
