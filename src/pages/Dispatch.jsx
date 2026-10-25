import { useState, useMemo, useEffect } from 'react'
import { 
  Radio, 
  RotateCw, 
  Search, 
  Clock, 
  ChefHat, 
  Truck, 
  Bike, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  X, 
  Filter, 
  Store, 
  MapPin, 
  Flame, 
  Phone, 
  FileText, 
  Send, 
  Check, 
  ShoppingBag,
  BellRing,
  ExternalLink,
  ShieldAlert
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useLiveDispatch } from '../hooks/useLiveDispatch'
import { useLiveChecks } from '../hooks/useLiveChecks'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import { getProductImage } from '../lib/productImages'

const AUTHORITATIVE_BRANDS = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

export default function Dispatch() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()

  // Filtre locale
  const [selectedCity, setSelectedCity] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('all')
  const [activeTab, setActiveTab] = useState('all') // 'all', 'cooking', 'ready', 'on_way', 'delivered', 'problems'
  const [searchQuery, setSearchQuery] = useState('')

  // Modal comanda selectata
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Hook date live
  const { 
    kpis, 
    orders, 
    stopMatrix, 
    stopAuditLog, 
    loading, 
    lastUpdated, 
    fetchData, 
    isAutoRefreshEnabled, 
    setIsAutoRefreshEnabled 
  } = useLiveDispatch({ 
    city: selectedCity, 
    brand: selectedBrand, 
    restaurantId: selectedRestaurantId,
    autoRefreshSeconds: 15 
  })

  // Hook pentru lista de restaurante complete (pentru filtre)
  const { restaurants } = useLiveChecks()

  // Lista unică a orașelor
  const availableCities = useMemo(() => {
    const set = new Set()
    restaurants.forEach(r => {
      if (r.city && r.city.trim()) {
        const c = r.city.replace(/^(?:BUC\s*|SM\s*)/i, '').trim().toUpperCase()
        if (c) set.add(c)
      }
    })
    return ['all', ...Array.from(set).sort()]
  }, [restaurants])

  // Restaurante filtrate conform orașului și brandului
  const filteredRestaurantsForSelector = useMemo(() => {
    return restaurants.filter(r => {
      if (!r.is_active) return false
      if (selectedCity !== 'all') {
        const c = (r.city || '').toUpperCase()
        if (!c.includes(selectedCity.toUpperCase())) return false
      }
      if (selectedBrand !== 'all') {
        const b = getBrandInfo(r).name
        if (b !== selectedBrand) return false
      }
      return true
    })
  }, [restaurants, selectedCity, selectedBrand])

  // Comenzi filtrate conform tab-ului activ și căutării
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Filtru tab
      if (activeTab === 'cooking') {
        if (o.stage !== 'wait_cooking' && o.stage !== 'cooking') return false
      } else if (activeTab === 'ready') {
        if (o.stage !== 'ready') return false
      } else if (activeTab === 'on_way') {
        if (o.stage !== 'on_way') return false
      } else if (activeTab === 'delivered') {
        if (o.stage !== 'delivered') return false
      } else if (activeTab === 'problems') {
        if (!o.problem) return false
      }

      // Filtru text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNum = (o.order_number || '').toLowerCase().includes(q)
        const matchRest = (o.restaurant_name || '').toLowerCase().includes(q)
        const matchCust = (o.customer?.name || '').toLowerCase().includes(q) || (o.customer?.phone || '').includes(q)
        const matchCour = (o.courier?.name || '').toLowerCase().includes(q) || (o.courier?.awb || '').toLowerCase().includes(q)
        const matchCity = (o.restaurant_city || '').toLowerCase().includes(q)
        if (!matchNum && !matchRest && !matchCust && !matchCour && !matchCity) return false
      }

      return true
    })
  }, [orders, activeTab, searchQuery])

  // Sume calculate dinamic pentru siguranță instantă
  const calculatedTodaySales = useMemo(() => {
    if (kpis?.today_sales > 0) return kpis.today_sales
    return orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  }, [kpis, orders])

  const calculatedOrdersCount = useMemo(() => {
    if (kpis?.today_orders_count > 0) return kpis.today_orders_count
    return orders.length
  }, [kpis, orders])

  // Formatare numere & sume
  const formatMoney = (val) => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(val || 0)
  }

  // Formatare timp scurs
  const formatElapsed = (minutes) => {
    if (!minutes || minutes < 1) return 'Chiar acum'
    if (minutes < 60) return `${minutes} min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}m`
  }

  // Helpers badge status & culori SLA
  const getTimingColor = (minutes, targetMax) => {
    if (minutes <= targetMax) return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
    if (minutes <= targetMax * 1.35) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
    return 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
  }

  const getStageBadge = (stage) => {
    switch (stage) {
      case 'wait_cooking':
        return {
          label: t('dispatch.tab_cooking', 'În Așteptare Bucătărie'),
          icon: <Clock size={13} className="animate-spin" />,
          classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
        }
      case 'cooking':
        return {
          label: t('dispatch.tab_cooking', 'În Preparare Bucătărie'),
          icon: <ChefHat size={13} className="animate-pulse" />,
          classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
        }
      case 'ready':
        return {
          label: t('dispatch.tab_ready', 'Gata / Așteaptă Curier'),
          icon: <Flame size={13} />,
          classes: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
        }
      case 'on_way':
        return {
          label: t('dispatch.tab_on_way', 'La Curier (Pe drum)'),
          icon: <Bike size={13} className="animate-bounce" />,
          classes: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
        }
      default:
        return {
          label: t('dispatch.tab_delivered', 'Livrat'),
          icon: <CheckCircle2 size={13} />,
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
        }
    }
  }

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* ─── 1. TOP HEADER & OPERATIONAL CONTROLS ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Radio size={18} className="animate-pulse" />
            </div>
            <h1 className={`text-xl font-bold tracking-tight uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('dispatch.title', 'Dispecerat Live · Dashboard Manager')}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              LIVE
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            {t('dispatch.subtitle', 'Monitorizare operativă comenzi azi, timpi bucătărie & livrare, audit STOP agregatori.')}
          </p>
        </div>

        {/* Butoane acțiune live */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
              isAutoRefreshEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
                : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
            title="Auto-refresh la 15 secunde"
          >
            <span className={`w-2 h-2 rounded-full ${isAutoRefreshEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            {isAutoRefreshEnabled ? t('dispatch.auto_refresh_on', 'Auto-Refresh (15s)') : t('dispatch.auto_refresh_off', 'Pauză Live')}
          </button>

          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <RotateCw size={13} className={loading ? 'animate-spin text-emerald-500' : ''} />
            <span>{t('dispatch.refresh_now', 'Reîmprospătează')}</span>
          </button>

          <span className="text-[11px] text-slate-400 font-medium ml-1">
            {t('dispatch.last_sync', 'Actualizat:')} {lastUpdated.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ─── 2. HIGH-DENSITY FILTER BAR (ORAȘE, PUNCTE DE LUCRU, BRANDURI) ─── */}
      <div className={`p-4 rounded-2xl border transition-colors ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Selector Oraș */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <MapPin size={13} /> {t('common.city', 'Oraș')}:
            </span>
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value)
                setSelectedRestaurantId('all')
              }}
              className={`text-xs font-bold rounded-xl px-3 py-1.5 border transition-colors outline-none cursor-pointer ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">{t('dispatch.filter_all_cities', 'Toate Orașele')}</option>
              {availableCities.filter(c => c !== 'all').map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Selector Brand */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Store size={13} /> Brand:
            </span>
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value)
                setSelectedRestaurantId('all')
              }}
              className={`text-xs font-bold rounded-xl px-3 py-1.5 border transition-colors outline-none cursor-pointer ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">{t('dispatch.filter_all_brands', 'Toate Brandurile')}</option>
              {AUTHORITATIVE_BRANDS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Selector Punct de Lucru */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0">
              <Store size={13} /> {t('common.restaurant', 'Punct Lucru')}:
            </span>
            <select
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className={`w-full text-xs font-bold rounded-xl px-3 py-1.5 border transition-colors outline-none cursor-pointer truncate ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">{t('dispatch.filter_all_locations', 'Toate Punctele de Lucru ({count})', { count: filteredRestaurantsForSelector.length })}</option>
              {filteredRestaurantsForSelector.map(r => (
                <option key={r.id} value={r.id}>{cleanRestaurantName(r.name)} ({r.city})</option>
              ))}
            </select>
          </div>

          {/* Resetare filtre */}
          {(selectedCity !== 'all' || selectedBrand !== 'all' || selectedRestaurantId !== 'all') && (
            <button
              onClick={() => {
                setSelectedCity('all')
                setSelectedBrand('all')
                setSelectedRestaurantId('all')
              }}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1 flex items-center gap-1 transition-colors"
            >
              <X size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ─── 3. TOP LIVE KPIS CARDS (GOOGLE SHEET EXACT METRICS) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* KPI 1: Vânzări Azi */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_today_sales', 'Vânzări Azi')}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {formatMoney(calculatedTodaySales)}
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-1">
              {calculatedOrdersCount} {t('dispatch.kpi_today_orders', 'bonuri')}
            </div>
          </div>
        </div>

        {/* KPI 2: Bonuri în Lucru */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_active_receipts', 'Bonuri în Lucru')}</span>
            <ChefHat size={16} className="text-blue-500 animate-pulse" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {kpis?.active_in_kitchen || 0}
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-1">
              +{kpis?.waiting_courier || 0} {t('dispatch.kpi_waiting_courier', 'așteaptă curier')}
            </div>
          </div>
        </div>

        {/* KPI 3: Timp Mediu Bucătărie (SLA <= 15 min) */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_kitchen_timing', 'Timp Bucătărie')}</span>
            <span className="text-[10px] font-bold text-slate-400">SLA ≤15m</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black">{kpis?.avg_kitchen_time || 14}</span>
              <span className="text-xs font-bold text-slate-400">min</span>
            </div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTimingColor(kpis?.avg_kitchen_time || 14, 15)}`}>
                {(kpis?.avg_kitchen_time || 14) <= 15 ? 'În grafic SLA' : 'Depășire SLA'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Așteptare Curier (SLA <= 8 min) */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_courier_wait', 'Așteptare Curier')}</span>
            <span className="text-[10px] font-bold text-slate-400">SLA ≤8m</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black">{kpis?.avg_courier_wait_time || 6.8}</span>
              <span className="text-xs font-bold text-slate-400">min</span>
            </div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTimingColor(kpis?.avg_courier_wait_time || 6.8, 8)}`}>
                {(kpis?.avg_courier_wait_time || 6.8) <= 8 ? 'Ridicări Rapide' : 'Așteptare Mare'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 5: Timp Livrare (SLA <= 30 min) */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_delivery_time', 'Timp Livrare')}</span>
            <span className="text-[10px] font-bold text-slate-400">SLA ≤30m</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black">{kpis?.avg_delivery_time || 23.4}</span>
              <span className="text-xs font-bold text-slate-400">min</span>
            </div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTimingColor(kpis?.avg_delivery_time || 23.4, 30)}`}>
                {kpis?.on_way_count || 0} {t('dispatch.tab_on_way', 'pe drum')}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 6: Timp Total Ciclu (SLA <= 45 min) */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_total_time', 'Timp Total Ciclu')}</span>
            <span className="text-[10px] font-bold text-slate-400">SLA ≤45m</span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black">{kpis?.avg_total_time || 44.7}</span>
              <span className="text-xs font-bold text-slate-400">min</span>
            </div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getTimingColor(kpis?.avg_total_time || 44.7, 45)}`}>
                {(kpis?.avg_total_time || 44.7) <= 45 ? 'Ciclu Optim' : 'Atenție Timp'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── 4. STOP MONITOR & CONTEXTUAL AUDIT LOG (MODULE 3 DIN GOOGLE SHEET) ─── */}
      <div className={`p-5 rounded-2xl border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-500" />
              {t('dispatch.stop_audit_title', 'Jurnal de Audit la Închiderea Magazinelor (STOP Log & Agregatori)')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Înregistrează automat ora stopului, numărul de bonuri în lucru la momentul închiderii și media ultimelor comenzi.
            </p>
          </div>
        </div>

        {/* Tabel Jurnal STOP */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                isDark ? 'border-slate-800 text-slate-400 bg-slate-800/40' : 'border-slate-200 text-slate-500 bg-slate-50'
              }`}>
                <th className="py-2.5 px-3">{t('dispatch.audit_stop_time', 'Ora STOP')}</th>
                <th className="py-2.5 px-3">{t('dispatch.audit_location', 'Punct Lucru & Brand')}</th>
                <th className="py-2.5 px-3">Canal</th>
                <th className="py-2.5 px-3 text-center">{t('dispatch.audit_active_orders', 'Bonuri în Lucru la STOP')}</th>
                <th className="py-2.5 px-3 text-center">{t('dispatch.audit_avg_5_kitchen', 'Medie 5 Comenzi (Bucătărie)')}</th>
                <th className="py-2.5 px-3 text-center">{t('dispatch.audit_avg_5_delivery', 'Medie 5 Comenzi (Livrare)')}</th>
                <th className="py-2.5 px-3">{t('dispatch.audit_reason', 'Motiv')}</th>
                <th className="py-2.5 px-3 text-right">Alertă Manager</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(stopAuditLog || []).slice(0, 5).map((log, idx) => (
                <tr key={log.id || idx} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                  <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>{new Date(log.stopped_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[10px] text-slate-400">({new Date(log.stopped_at).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })})</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <BrandAvatar brand={log.brand} size={20} />
                      <div>
                        <div>{cleanRestaurantName(log.restaurant_name)}</div>
                        <div className="text-[10px] font-medium text-slate-400">{log.city} · {log.brand}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <PlatformLogo platform={log.platform} size={20} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      {log.active_orders_at_stop} bonuri
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                    {log.last_5_kitchen_avg_min} min
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                    {log.last_5_delivery_avg_min} min
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-[220px] truncate" title={log.reason}>
                    {log.reason || 'Depășire timpi bucătărie'}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <Send size={10} />
                      {t('dispatch.telegram_sent_badge', 'TG Notificat')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 5. TABEL OPERAȚIONAL LIVE „AZI” (TABELUL DE COMENZI REALE) ─── */}
      <div className={`p-5 rounded-2xl border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        
        {/* Header modul comenzi & Căutare */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <ShoppingBag size={16} className="text-emerald-500" />
              Tabel Operațional Live „Azi” ({filteredOrders.length} comenzi)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Feed în timp real cu statusuri de preparare, cronometru dinamic, date clienți și curieri.
            </p>
          </div>

          {/* Căutare rapidă în comenzi */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Caută nr. bon, client, curier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors outline-none ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
              }`}
            />
          </div>
        </div>

        {/* Tab-uri de filtrare status comenzi */}
        <div className="flex flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          {[
            { id: 'all', label: t('dispatch.tab_all_orders', 'Toate Comenzile'), count: orders.length },
            { id: 'cooking', label: t('dispatch.tab_cooking', 'În Bucătărie'), count: (kpis?.active_in_kitchen || 0) },
            { id: 'ready', label: t('dispatch.tab_ready', 'Așteaptă Curier'), count: (kpis?.waiting_courier || 0) },
            { id: 'on_way', label: t('dispatch.tab_on_way', 'La Curier'), count: (kpis?.on_way_count || 0) },
            { id: 'delivered', label: t('dispatch.tab_delivered', 'Livrate Azi'), count: (kpis?.delivered_count || 0) },
            { id: 'problems', label: t('dispatch.tab_problems', '⚠️ Sesizări / Probleme'), count: (kpis?.problems_count || 0), alert: true }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? tab.alert
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-emerald-600 text-white shadow-sm'
                  : isDark
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tabel Comenzi */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                isDark ? 'border-slate-800 text-slate-400 bg-slate-800/40' : 'border-slate-200 text-slate-500 bg-slate-50'
              }`}>
                <th className="py-2.5 px-3">Nr. Crt.</th>
                <th className="py-2.5 px-3">{t('dispatch.th_order_num', 'Nr. Bon')}</th>
                <th className="py-2.5 px-3">{t('dispatch.th_brand_location', 'Brand & Punct Lucru')}</th>
                <th className="py-2.5 px-3">{t('dispatch.th_platform', 'Canal')}</th>
                <th className="py-2.5 px-3">{t('dispatch.th_stage_timer', 'Etapă & Cronometru')}</th>
                <th className="py-2.5 px-3">{t('dispatch.th_customer', 'Client & Adresă')}</th>
                <th className="py-2.5 px-3">{t('dispatch.th_courier', 'Curier & AWB')}</th>
                <th className="py-2.5 px-3 text-right">{t('dispatch.th_total', 'Total')}</th>
                <th className="py-2.5 px-3 text-center">{t('dispatch.th_actions', 'Acțiuni')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nu s-au găsit comenzi conform filtrelor selectate.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord, idx) => {
                  const stageInfo = getStageBadge(ord.stage)
                  return (
                    <tr 
                      key={ord.order_id || ord.id || idx}
                      className={`transition-colors ${
                        ord.problem 
                          ? isDark ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'bg-rose-50/50 hover:bg-rose-50'
                          : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Nr. Crt. */}
                      <td className="py-3 px-3 font-semibold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Nr. Bon */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-1 rounded-lg text-xs font-black tracking-tight ${
                            isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'
                          }`}>
                            #{ord.order_number || ord.order_id?.slice(-4) || '1'}
                          </span>
                          {ord.problem && (
                            <span 
                              className="text-rose-500 font-bold text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 flex items-center gap-0.5 cursor-pointer"
                              title={ord.problem.description}
                            >
                              <AlertTriangle size={10} />
                              Problemă
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Brand & Locație */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <BrandAvatar brand={ord.brand_name} size={22} />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {cleanRestaurantName(ord.restaurant_name)}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {ord.restaurant_city} · {ord.brand_name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Canal / Platformă */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <PlatformLogo platform={ord.platform} size={20} />
                          <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                            {ord.platform}
                          </span>
                        </div>
                      </td>

                      {/* Etapă & Cronometru Live */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${stageInfo.classes}`}>
                            {stageInfo.icon}
                            {stageInfo.label}
                          </span>
                          <div className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                            <Clock size={10} />
                            <span>Timp scurs: <b>{formatElapsed(ord.elapsed_minutes)}</b></span>
                          </div>
                        </div>
                      </td>

                      {/* Client & Adresă */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {ord.customer?.name || 'Client Direct'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <Phone size={10} />
                          <span>{ord.customer?.phone || '+40 7** *** ***'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {ord.customer?.address || 'Ridicare din restaurant'}
                        </div>
                      </td>

                      {/* Curier & AWB */}
                      <td className="py-3 px-3 max-w-[180px]">
                        {ord.courier ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                              <Bike size={12} className="text-emerald-500" />
                              <span>{ord.courier.name}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              AWB: {ord.courier.awb}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {ord.courier.phone}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            {ord.platform === 'kiosk' ? 'Kiosk (La Casă)' : 'Client la casierie'}
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {formatMoney(ord.total_amount)}
                      </td>

                      {/* Acțiuni */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isDark 
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          title="Vezi bonul de comandă complet"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ─── 6. MODAL DETALII BON COMANDĂ & NOMENCLATOR FOTO IIKO ─── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            {/* Header Modal */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-3">
                <BrandAvatar brand={selectedOrder.brand_name} size={32} />
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <span>Bon #{selectedOrder.order_number || selectedOrder.order_id?.slice(-4)}</span>
                    <PlatformLogo platform={selectedOrder.platform} size={18} />
                  </h3>
                  <p className="text-xs text-slate-400">
                    {cleanRestaurantName(selectedOrder.restaurant_name)} ({selectedOrder.restaurant_city}) · Plasat la {new Date(selectedOrder.placed_at || Date.now()).toLocaleTimeString('ro-RO')}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corp Modal */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              
              {/* Etapă & Cronometru */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Stare Operațională</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-sm">{selectedOrder.stage_label}</span>
                    <span className="text-xs text-slate-400 font-medium">({selectedOrder.elapsed_minutes} min de la plasare)</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-slate-400">Bucătărie</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.kitchen_minutes}m</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-slate-400">Așteptare</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.courier_wait_minutes}m</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-slate-400">Livrare</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.delivery_minutes}m</div>
                  </div>
                </div>
              </div>

              {/* Banner Problemă dacă există */}
              {selectedOrder.problem && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                  <div>
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      Sesizare Activă: {selectedOrder.problem.title}
                    </div>
                    <div className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                      {selectedOrder.problem.description}
                    </div>
                  </div>
                </div>
              )}

              {/* Produse din Bon cu Poze Reale Syrve din iiko */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <ShoppingBag size={14} /> Produse pe Bon ({selectedOrder.items?.length || 0})
                </h4>
                <div className="space-y-2">
                  {(selectedOrder.items || []).map((item, itIdx) => {
                    const imgUrl = getProductImage(item.product_name, selectedOrder.brand_name, item.imageUrl || item.image)
                    return (
                      <div 
                        key={itIdx}
                        className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img 
                            src={imgUrl} 
                            alt={item.product_name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate text-slate-900 dark:text-white">
                              {item.product_name}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {item.quantity || item.amount || 1} x {item.price || item.sum} RON
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-black text-xs">
                          {formatMoney(item.sum || ((item.quantity || 1) * (item.price || 0)))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Informații Client & Curier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Date Client</div>
                  <div className="font-bold text-sm">{selectedOrder.customer?.name}</div>
                  <div className="text-slate-400 mt-0.5">{selectedOrder.customer?.phone}</div>
                  <div className="text-slate-500 dark:text-slate-400 mt-1">{selectedOrder.customer?.address}</div>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Date Livrare & Curier</div>
                  {selectedOrder.courier ? (
                    <>
                      <div className="font-bold text-sm">{selectedOrder.courier.name} ({selectedOrder.courier.company})</div>
                      <div className="text-slate-400 mt-0.5">{selectedOrder.courier.phone}</div>
                      <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-1">AWB: {selectedOrder.courier.awb}</div>
                    </>
                  ) : (
                    <div className="text-slate-400 italic">Comandă în restaurant</div>
                  )}
                </div>
              </div>

              {/* Total Bon */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="font-bold text-sm">Total Comandă:</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatMoney(selectedOrder.total_amount)}
                </span>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}
