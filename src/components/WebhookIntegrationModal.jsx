import React, { useState, useEffect } from 'react'
import { 
  X, 
  Webhook, 
  RefreshCw, 
  Copy, 
  Check, 
  ShoppingBag, 
  TrendingUp, 
  Search, 
  Clock, 
  Layers, 
  Store, 
  Activity,
  Radio,
  ExternalLink,
  CheckCircle2
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import PlatformLogo from './PlatformLogo'
import BrandAvatar, { cleanRestaurantName } from './BrandAvatar'
import OrderDetailsModal from './OrderDetailsModal'
import { getApiUrl } from '../lib/api'
import { formatDisplayOrderNumber } from '../lib/orderUtils'

export default function WebhookIntegrationModal({ isOpen, onClose, onWebhookTriggered }) {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()

  const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'endpoints'
  const [copiedKey, setCopiedKey] = useState(null)
  
  // Live orders data
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeOrderModal, setActiveOrderModal] = useState(null)
  const fetchOrders = () => {
    setLoadingOrders(true)
    fetch(getApiUrl('/api/webhooks/orders?limit=100'))
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.orders)) {
          setOrders(d.orders)
        }
      })
      .catch(console.error)
      .finally(() => setLoadingOrders(false))
  }

  useEffect(() => {
    if (isOpen) {
      fetchOrders()
    }
  }, [isOpen])

  // Auto-refresh orders every 15 seconds if modal is open
  useEffect(() => {
    if (!isOpen || activeTab !== 'orders') return
    const timer = setInterval(() => {
      fetchOrders()
    }, 15000)
    return () => clearInterval(timer)
  }, [isOpen, activeTab])

  if (!isOpen) return null

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  // Official production URL for webhooks
  const webhookBaseUrl = typeof window !== 'undefined' && window.location.hostname.includes('netlify')
    ? window.location.origin
    : 'https://smart-agregator.netlify.app'

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  // Statistics calculation
  const totalRevenue = orders.reduce((acc, o) => acc + (parseFloat(o.total_amount) || 0), 0)
  const glovoCount = orders.filter(o => (o.platform || '').toLowerCase().includes('glovo')).length
  const woltCount = orders.filter(o => (o.platform || '').toLowerCase().includes('wolt')).length
  const boltCount = orders.filter(o => (o.platform || '').toLowerCase().includes('bolt')).length
  const kioskCount = orders.filter(o => (o.platform || '').toLowerCase().includes('kiosk')).length
  const casierieCount = orders.filter(o => {
    const p = (o.platform || '').toLowerCase()
    return p.includes('casierie') || p.includes('pos') || p === 'restaurant' || p === 'in-store'
  }).length
  const totalCount = orders.length || 1
  const glovoPct = Math.round((glovoCount / totalCount) * 100)
  const woltPct = Math.round((woltCount / totalCount) * 100)
  const boltPct = Math.round((boltCount / totalCount) * 100)
  const kioskPct = Math.round((kioskCount / totalCount) * 100)
  const casieriePct = Math.max(0, 100 - (glovoPct + woltPct + boltPct + kioskPct))
  const deliveryTotal = glovoCount + woltCount + boltCount
  const deliveryPct = Math.round((deliveryTotal / totalCount) * 100)
  const localTotal = kioskCount + casierieCount
  const localPct = Math.max(0, 100 - deliveryPct)
  const avgTicket = orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0.00'

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const p = (o.platform || '').toLowerCase()
    if (selectedPlatform === 'glovo' && !p.includes('glovo')) return false
    if (selectedPlatform === 'wolt' && !p.includes('wolt')) return false
    if (selectedPlatform === 'bolt' && !p.includes('bolt')) return false
    if (selectedPlatform === 'kiosk' && !p.includes('kiosk')) return false
    if (selectedPlatform === 'casierie' && (!p.includes('casierie') && !p.includes('pos') && p !== 'restaurant' && p !== 'in-store')) return false
    if (selectedPlatform === 'restaurant' && (p.includes('glovo') || p.includes('wolt') || p.includes('bolt') || p.includes('kiosk'))) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().replace(/^#/, '')
      const matchRest = (o.restaurant_name || '').toLowerCase().includes(q)
      const matchCity = (o.restaurant_city || '').toLowerCase().includes(q)
      const ordNum = formatDisplayOrderNumber(o.order_number, o.order_id, o.platform).toLowerCase()
      const matchNum = ordNum.includes(q)
      const matchId = (o.order_id || '').toLowerCase().includes(q)
      const matchItems = (o.items || []).some(it => (it.product_name || '').toLowerCase().includes(q))
      if (!matchRest && !matchCity && !matchNum && !matchId && !matchItems) return false
    }
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-4xl rounded-3xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        {/* HEADER MODAL */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <Webhook size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {t('webhooks.modal_title', 'Webhooks & Comenzi Live (iiko, Wolt, Bolt, Glovo)')}
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {t('webhooks.ready_badge', 'Live Stream Activ')}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                {t('webhooks.modal_subtitle', 'Flux continuu de comenzi și alerte operaționale în timp real')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/80 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'orders'
                ? 'text-emerald-700 dark:text-emerald-400 font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag size={15} />
            <span>{t('webhooks.tab_orders', 'Comenzi & Vânzări Live')}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-400">
              {orders.length}
            </span>
            {activeTab === 'orders' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-500 rounded-full"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('endpoints')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'endpoints'
                ? 'text-emerald-700 dark:text-emerald-400 font-extrabold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers size={15} />
            <span>{t('webhooks.tab_endpoints', 'Adrese Webhook Oficiale')}</span>
            {activeTab === 'endpoints' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-500 rounded-full"></span>
            )}
          </button>
        </div>

        {/* CONTENT BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-sm flex-1">
          
          {/* TAB 1: COMENZI & VÂNZĂRI LIVE */}
          {activeTab === 'orders' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Top Banner KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800/60 border-slate-700/80 shadow-xs' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('webhooks.orders_today', 'Comenzi Astăzi')}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <ShoppingBag size={16} />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {orders.length} <span className="text-xs font-bold text-slate-400">comenzi</span>
                  </div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 mt-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Bon mediu: <strong>{avgTicket} RON</strong></span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800/60 border-slate-700/80 shadow-xs' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('webhooks.revenue_today', 'Total Vânzări')}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                    {totalRevenue.toLocaleString(localeCode, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold">RON</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    <span>Delivery: <strong>{deliveryPct}%</strong></span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    <span>Local: <strong>{localPct}%</strong></span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800/60 border-slate-700/80 shadow-xs' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('webhooks.channel_lbl', 'Canale Active')}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                      <Layers size={16} />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    5 Canale <span className="text-xs font-bold text-slate-400">active</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span>iiko Cloud & Kiosk Direct Sincronizate</span>
                  </div>
                </div>
              </div>

              {/* Distribuție Canale Vânzare & Filtrare Interactivă */}
              <div className={`p-4 rounded-2xl border transition-all ${isDark ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50/90 border-slate-200/90 shadow-2xs'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-emerald-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      {t('webhooks.distribution_title', 'Distribuție Platforme & Local')}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Delivery: <strong className="text-slate-900 dark:text-white">{deliveryTotal}</strong> com ({deliveryPct}%) • Local: <strong className="text-slate-900 dark:text-white">{localTotal}</strong> com ({localPct}%)</span>
                  </div>
                </div>

                {/* Segmented Proportional Progress Bar */}
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700 shadow-2xs">
                  {glovoPct > 0 && <div style={{ width: `${glovoPct}%` }} className="bg-amber-500 h-full transition-all" title={`Glovo: ${glovoCount} (${glovoPct}%)`} />}
                  {woltPct > 0 && <div style={{ width: `${woltPct}%` }} className="bg-cyan-500 h-full transition-all" title={`Wolt: ${woltCount} (${woltPct}%)`} />}
                  {boltPct > 0 && <div style={{ width: `${boltPct}%` }} className="bg-emerald-500 h-full transition-all" title={`Bolt Food: ${boltCount} (${boltPct}%)`} />}
                  {kioskPct > 0 && <div style={{ width: `${kioskPct}%` }} className="bg-purple-500 h-full transition-all" title={`Smart Kiosk: ${kioskCount} (${kioskPct}%)`} />}
                  {casieriePct > 0 && <div style={{ width: `${casieriePct}%` }} className="bg-blue-500 h-full transition-all" title={`Casierie: ${casierieCount} (${casieriePct}%)`} />}
                </div>

                {/* Interactive Channel Cards / Filter Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3.5">
                  {[
                    { id: 'all', label: t('webhooks.filter_all_short', 'Toate'), count: orders.length, pct: '100%', color: 'emerald' },
                    { id: 'glovo', label: 'Glovo', count: glovoCount, pct: `${glovoPct}%`, color: 'amber', logo: 'glovo' },
                    { id: 'wolt', label: 'Wolt', count: woltCount, pct: `${woltPct}%`, color: 'cyan', logo: 'wolt' },
                    { id: 'bolt', label: 'Bolt Food', count: boltCount, pct: `${boltPct}%`, color: 'emerald', logo: 'bolt' },
                    { id: 'kiosk', label: t('webhooks.filter_kiosk', 'Smart Kiosk'), count: kioskCount, pct: `${kioskPct}%`, color: 'purple', logo: 'kiosk' },
                    { id: 'casierie', label: t('webhooks.filter_casierie', 'Casierie (POS)'), count: casierieCount, pct: `${casieriePct}%`, color: 'blue', logo: 'casierie' }
                  ].map((ch) => {
                    const isSelected = selectedPlatform === ch.id
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedPlatform(ch.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? isDark
                              ? 'bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                              : 'bg-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
                            : isDark
                            ? 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600 text-slate-300'
                            : 'bg-white/80 border-slate-200/90 hover:bg-white hover:border-slate-300 text-slate-700 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {ch.logo ? (
                              <PlatformLogo platform={ch.logo} size={15} />
                            ) : (
                              <Layers size={13} className="text-emerald-500" />
                            )}
                            <span className="text-[11px] font-bold truncate">
                              {ch.label}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          )}
                        </div>
                        <div className="flex items-baseline justify-between gap-1 mt-0.5">
                          <span className={`text-base font-black ${
                            isSelected 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : 'text-slate-900 dark:text-white'
                          }`}>
                            {ch.count}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {ch.pct}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sub-bar: Search, Active Filter indicator & Refresh */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedPlatform !== 'all' && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      <span>Filtru activ: <strong className="capitalize">{selectedPlatform === 'kiosk' ? 'Smart Kiosk' : selectedPlatform === 'casierie' ? 'Casierie' : selectedPlatform}</strong></span>
                      <button 
                        onClick={() => setSelectedPlatform('all')}
                        className="hover:text-red-500 transition-colors ml-1 font-black cursor-pointer"
                        title="Resetează filtru"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Afișare: <strong>{filteredOrders.length}</strong> din <strong>{orders.length}</strong> comenzi
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`relative flex items-center rounded-xl border px-3 py-1.5 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-2xs'
                  }`}>
                    <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                    <input 
                      type="text"
                      placeholder={t('webhooks.search_placeholder', 'Caută restaurant, produs, #com...')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent text-xs font-medium outline-hidden w-40 sm:w-56 placeholder:text-slate-400 text-slate-900 dark:text-white"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-slate-400 hover:text-slate-600 text-xs ml-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    onClick={fetchOrders}
                    disabled={loadingOrders}
                    className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    title={t('webhooks.refresh', 'Actualizează')}
                  >
                    <RefreshCw size={15} className={loadingOrders ? 'animate-spin text-emerald-600' : ''} />
                  </button>
                </div>
              </div>

              {/* Feed Tabelar / Carduri de Comenzi */}
              <div className={`rounded-2xl border overflow-hidden ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
              }`}>
                {filteredOrders.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredOrders.map((ord) => {
                      const p = (ord.platform || 'restaurant').toLowerCase()
                      const placedDate = ord.placed_at ? new Date(ord.placed_at) : null
                      const formattedTime = placedDate ? placedDate.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
                      const itemsPreview = (ord.items || []).filter(i => !i._order_meta).map(i => `${i.amount || i.quantity || 1}x ${i.name || i.product_name}`).join(', ')
                      const brandName = ord.brand_name || ord.brand || ord.restaurant_name || ''
                      const orderNum = formatDisplayOrderNumber(ord.order_number, ord.order_id, ord.platform)

                      return (
                        <div 
                          key={ord.id || ord.order_id} 
                          onClick={() => setActiveOrderModal(ord)}
                          className="p-3.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer group"
                        >
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                            <div className="relative shrink-0 mt-0.5 sm:mt-0">
                              <BrandAvatar brand={brandName} size={38} />
                              <div className="absolute -bottom-1 -right-1 ring-2 ring-white dark:ring-slate-900 rounded-full bg-white dark:bg-slate-900 shadow-xs">
                                <PlatformLogo platform={p} size={15} />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                  {cleanRestaurantName(ord.restaurant_name) || ord.restaurant_name || 'Restaurant N/A'}
                                </span>
                                {orderNum && (
                                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    #{orderNum}
                                  </span>
                                )}
                                {ord.restaurant_city && (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                    {ord.restaurant_city}
                                  </span>
                                )}
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md capitalize ${
                                  p.includes('glovo') 
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                    : p.includes('wolt')
                                    ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300'
                                    : p.includes('bolt')
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                    : p.includes('kiosk')
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                                    : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                  {p === 'bolt' ? 'Bolt Food' : p === 'kiosk' ? 'Smart Kiosk POS' : p}
                                </span>
                              </div>

                              {/* Produse Comandate */}
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate max-w-xl">
                                {itemsPreview ? (
                                  <span>{itemsPreview}</span>
                                ) : (
                                  <span className="italic text-slate-500">Comandă recepționată prin casă / POS</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 sm:text-right">
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                              <Clock size={13} />
                              <span>{formattedTime}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-black text-emerald-700 dark:text-emerald-400">
                                {parseFloat(ord.total_amount || 0).toFixed(2)} RON
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold">
                    <ShoppingBag size={32} className="mx-auto mb-2 opacity-50 text-slate-400" />
                    <span>{t('webhooks.no_orders_yet', 'Nicio comandă recepționată recent.')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ADRESE WEBHOOK OFICIALE (CLARITATE & CONTRAST MAXIM) */}
          {activeTab === 'endpoints' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {t('webhooks.endpoints_configured', 'Adrese Webhook pentru Configurare')}
                </h4>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Server Live Activ
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* iiko Syrve Endpoint */}
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {t('webhooks.iiko_title', 'iiko Cloud / Syrve')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xs">
                    <input
                      type="text"
                      readOnly
                      value={`${webhookBaseUrl}/api/webhooks/iiko`}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white select-all outline-hidden cursor-text"
                    />
                    <button
                      onClick={() => handleCopy(`${webhookBaseUrl}/api/webhooks/iiko`, 'iiko')}
                      className={`px-3 py-1.5 text-xs font-bold shrink-0 flex items-center gap-1.5 rounded-lg transition-all cursor-pointer ${
                        copiedKey === 'iiko' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {copiedKey === 'iiko' ? (
                        <>
                          <Check size={14} />
                          <span>Copiat!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiază</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                    {t('webhooks.iiko_desc', 'Recepționează: comenzi live din agregator (Glovo, Wolt, Bolt), status gătire și articole')}
                  </p>
                </div>

                {/* Wolt Endpoint */}
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0"></span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {t('webhooks.wolt_title', 'Wolt Webhook (Venue Events)')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xs">
                    <input
                      type="text"
                      readOnly
                      value={`${webhookBaseUrl}/api/webhooks/wolt`}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white select-all outline-hidden cursor-text"
                    />
                    <button
                      onClick={() => handleCopy(`${webhookBaseUrl}/api/webhooks/wolt`, 'wolt')}
                      className={`px-3 py-1.5 text-xs font-bold shrink-0 flex items-center gap-1.5 rounded-lg transition-all cursor-pointer ${
                        copiedKey === 'wolt' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {copiedKey === 'wolt' ? (
                        <>
                          <Check size={14} />
                          <span>Copiat!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiază</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                    {t('webhooks.wolt_desc', 'Recepționează: VENUE_OFFLINE_ALERT, REJECTION_ALERT, recenzii')}
                  </p>
                </div>

                {/* Bolt Endpoint */}
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {t('webhooks.bolt_title', 'Bolt Food (status_update_url)')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xs">
                    <input
                      type="text"
                      readOnly
                      value={`${webhookBaseUrl}/api/webhooks/bolt`}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white select-all outline-hidden cursor-text"
                    />
                    <button
                      onClick={() => handleCopy(`${webhookBaseUrl}/api/webhooks/bolt`, 'bolt')}
                      className={`px-3 py-1.5 text-xs font-bold shrink-0 flex items-center gap-1.5 rounded-lg transition-all cursor-pointer ${
                        copiedKey === 'bolt' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {copiedKey === 'bolt' ? (
                        <>
                          <Check size={14} />
                          <span>Copiat!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiază</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                    {t('webhooks.bolt_desc', 'Recepționează: modificări status ACTIVE / INACTIVE')}
                  </p>
                </div>

                {/* Glovo Endpoint */}
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {t('webhooks.glovo_title', 'Glovo Webhook (Store Status)')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xs">
                    <input
                      type="text"
                      readOnly
                      value={`${webhookBaseUrl}/api/webhooks/glovo`}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white select-all outline-hidden cursor-text"
                    />
                    <button
                      onClick={() => handleCopy(`${webhookBaseUrl}/api/webhooks/glovo`, 'glovo')}
                      className={`px-3 py-1.5 text-xs font-bold shrink-0 flex items-center gap-1.5 rounded-lg transition-all cursor-pointer ${
                        copiedKey === 'glovo' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {copiedKey === 'glovo' ? (
                        <>
                          <Check size={14} />
                          <span>Copiat!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiază</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                    {t('webhooks.glovo_desc', 'Recepționează: notificări OPEN / CLOSED direct din integrare')}
                  </p>
                </div>

                {/* Smart Kiosk Endpoint */}
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Smart Kiosk POS (Comenzi Încasate la Kiosk)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xs">
                    <input
                      type="text"
                      readOnly
                      value={`${webhookBaseUrl}/api/webhooks/kiosk`}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white select-all outline-hidden cursor-text"
                    />
                    <button
                      onClick={() => handleCopy(`${webhookBaseUrl}/api/webhooks/kiosk`, 'kiosk')}
                      className={`px-3 py-1.5 text-xs font-bold shrink-0 flex items-center gap-1.5 rounded-lg transition-all cursor-pointer ${
                        copiedKey === 'kiosk' 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {copiedKey === 'kiosk' ? (
                        <>
                          <Check size={14} />
                          <span>Copiat!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiază</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                    Recepționează în timp real toate comenzile achitate la POS-ul din kiosk (card sau cash), produsele și totalul de plată.
                  </p>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Radio size={14} className="text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <span>iiko Cloud Webhook Ingestion Activ</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 transition-colors cursor-pointer"
          >
            {t('webhooks.close', 'Închide')}
          </button>
        </div>
      </div>

      {/* MODAL DETALII COMANDĂ & RETETĂ INGREDIENTE (IDENTIC CU KIOSK ADMIN) */}
      <OrderDetailsModal
        order={activeOrderModal}
        isOpen={!!activeOrderModal}
        onClose={() => setActiveOrderModal(null)}
      />
    </div>
  )
}
