import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useAuth } from '../lib/AuthContext'
import PlatformLogo from '../components/PlatformLogo'
import BrandAvatar from '../components/BrandAvatar'
import OrderDetailsModal from '../components/OrderDetailsModal'
import { parseDeliveryAddress, getCityDisplayName } from '../lib/orderUtils'
import { getProductImage } from '../lib/productImages'
import {
  Users,
  Search,
  MapPin,
  Phone,
  Award,
  Repeat,
  ShoppingBag,
  TrendingUp,
  Download,
  RefreshCw,
  Check,
  Copy,
  X,
  ExternalLink,
  Building2,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Star,
  Eye,
  Receipt,
  Edit3,
  MessageSquare,
  Utensils,
  Truck
} from 'lucide-react'

const API_URL = import.meta.env.VITE_WORKER_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3002')

export default function Customers() {
  const { isDark } = useTheme()
  const { language } = useLanguage()
  const { user, canAccessCity, canAccessBrand, hasScopeRestrictions } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const txt = useCallback((ro, ru, en) => {
    if (language === 'ru') return ru
    if (language === 'en') return en
    return ro
  }, [language])

  const formatMoney = (val) => {
    const n = Number(val || 0)
    return `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`
  }

  const initialQuerySearch = searchParams.get('search') || ''

  const [customers, setCustomers] = useState([])
  const [kpis, setKpis] = useState({
    total_customers: 0,
    repeat_customers: 0,
    vip_customers: 0,
    with_phone_count: 0,
    direct_phone_count: 0,
    with_address_count: 0,
    with_reviews_count: 0,
    total_revenue: 0,
    total_orders: 0,
    avg_order_value: 0
  })
  const [cities, setCities] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // Filters, Sorting & Pagination
  const [search, setSearch] = useState(initialQuerySearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuerySearch)
  const [cityFilter, setCityFilter] = useState('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [segmentFilter, setSegmentFilter] = useState(searchParams.get('segment') || 'all')
  const [sortConfig, setSortConfig] = useState({ key: 'last_order', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [totalFiltered, setTotalFiltered] = useState(0)
  const [filteredTotalRevenue, setFilteredTotalRevenue] = useState(0)
  const [filteredTotalOrders, setFilteredTotalOrders] = useState(0)
  const [filteredTotalReviews, setFilteredTotalReviews] = useState(0)

  // UI states
  const [copiedId, setCopiedId] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [selectedOrderModal, setSelectedOrderModal] = useState(null)
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    notes: '',
    is_vip: false
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)

  const closeCustomerModal = useCallback(() => {
    setSelectedCustomer(null)
    if (searchParams.has('open') || searchParams.has('search')) {
      const next = new URLSearchParams(searchParams)
      next.delete('open')
      next.delete('search')
      setSearchParams(next, { replace: true })
      setSearch('')
      setDebouncedSearch('')
    }
  }, [searchParams, setSearchParams])

  const openCustomerModal = useCallback((cust, openEdit = false) => {
    if (!cust) return
    setSelectedCustomer(cust)
    setShowEditPanel(Boolean(openEdit))
    setEditForm({
      name: cust.name || '',
      phone: cust.phone || '',
      city: cust.city || '',
      address: cust.address || '',
      notes: cust.notes || '',
      is_vip: Boolean(cust.is_vip)
    })
  }, [])

  const openOrderDetailsModal = useCallback((cust, ro = null) => {
    if (!cust) return
    const ord = ro || (cust.recent_orders || [])[0] || {}
    let items = Array.isArray(ord.items) && ord.items.length > 0 ? ord.items : []
    if (items.length === 0 && ord.items_summary) {
      const parts = String(ord.items_summary).split(',').map(s => s.trim()).filter(Boolean)
      const totalAmt = Number(ord.total_amount || cust.total_spent || 0)
      const unitFallback = parts.length > 0 ? totalAmt / parts.length : 0
      items = parts.map(p => {
        const m = p.match(/^(\d+)\s*x\s+(.+)$/i)
        const qty = m ? Number(m[1]) : 1
        const name = m ? m[2].trim() : p
        return {
          product_name: name,
          name,
          quantity: qty,
          price: Math.round((unitFallback / qty) * 100) / 100,
          sum: Math.round(unitFallback * 100) / 100
        }
      })
    }

    const firstReview = ord.review || ((cust.reviews || [])[0]
      ? {
          rating: cust.reviews[0].rating,
          max_scale: cust.reviews[0].max_rating,
          max_rating: cust.reviews[0].max_rating,
          comment: cust.reviews[0].comment,
          comment_translations: cust.reviews[0].comment_translations,
          sentiment: cust.reviews[0].sentiment,
          source: (cust.reviews[0].platform || 'google').toUpperCase()
        }
      : null)

    setSelectedOrderModal({
      order_id: ord.order_id || ord.base_uuid || `${ord.order_number || '1'}_${cust.id}`,
      iiko_order_id: ord.base_uuid || ord.order_id || cust.id,
      order_number: ord.order_number || '1',
      placed_at: ord.placed_at || cust.last_order_at,
      total_amount: ord.total_amount ?? cust.total_spent ?? 0,
      platform: ord.platform || (cust.platforms || [])[0] || 'glovo',
      channel: ord.platform || (cust.platforms || [])[0] || 'glovo',
      brand_name: ord.brand_name || (cust.brands || [])[0] || 'Roll Master',
      restaurant_name: ord.restaurant_name || ord.city || cust.city || 'Restaurant',
      city: ord.city || cust.city,
      customer: {
        name: cust.name,
        phone: cust.phone,
        address: ord.address || cust.address
      },
      courier: ord.courier || null,
      timings: ord.timings || null,
      review: firstReview,
      items
    })
  }, [])

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3200)
  }

  useEffect(() => {
    const qParam = searchParams.get('search')
    if (qParam !== null && qParam !== search) {
      setSearch(qParam)
      setDebouncedSearch(qParam)
    }
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 200)
    return () => clearTimeout(t)
  }, [search])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const allowedC = (user?.allowed_cities || ['all']).filter(c => c !== 'all')
      const allowedB = (user?.allowed_brands || ['all']).filter(b => b !== 'all')
      const effectiveCity = (cityFilter === 'all' && allowedC.length === 1) ? allowedC[0] : cityFilter
      const effectiveBrand = (brandFilter === 'all' && allowedB.length === 1) ? allowedB[0] : brandFilter

      const params = new URLSearchParams({
        city: effectiveCity,
        brand: effectiveBrand,
        platform: platformFilter,
        segment: segmentFilter,
        search: debouncedSearch,
        sort: sortConfig.key,
        sort_dir: sortConfig.direction,
        page: String(page),
        limit: String(rowsPerPage)
      })
      const resp = await fetch(`${API_URL}/api/customers?${params.toString()}`)
      const json = await resp.json()
      if (json.success) {
        let list = json.customers || []
        if (hasScopeRestrictions) {
          list = list.filter(c => {
            if (!canAccessCity(c.city)) return false
            if (Array.isArray(c.brands) && c.brands.length > 0 && !c.brands.some(b => canAccessBrand(b))) return false
            return true
          })
        }
        setCustomers(list)
        if (json.kpis) setKpis(json.kpis)
        if (Array.isArray(json.cities)) setCities(json.cities.filter(c => canAccessCity(c)))
        if (Array.isArray(json.brands)) setBrands(json.brands.filter(b => canAccessBrand(b)))
        setTotalPages(json.total_pages || 1)
        setTotalFiltered(hasScopeRestrictions ? list.length : (json.total_filtered || 0))
        setFilteredTotalRevenue(json.filtered_total_revenue ?? json.kpis?.total_revenue ?? 0)
        setFilteredTotalOrders(json.filtered_total_orders ?? json.kpis?.total_orders ?? 0)
        setFilteredTotalReviews(json.filtered_total_reviews ?? 0)

        // Dacă s-a navigat cu ?search=...&open=1, deschidem o singură dată dosarul complet al clientului și curățăm parametrul open=1
        if (searchParams.get('open') === '1' && list.length > 0) {
          openCustomerModal(list[0], false)
          const next = new URLSearchParams(searchParams)
          next.delete('open')
          setSearchParams(next, { replace: true })
        }
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    } finally {
      setLoading(false)
    }
  }, [cityFilter, brandFilter, platformFilter, segmentFilter, debouncedSearch, sortConfig, page, rowsPerPage, searchParams, setSearchParams, openCustomerModal, user, hasScopeRestrictions, canAccessCity, canAccessBrand])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }))
    setPage(1)
  }

  const handleSyncFromOrders = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      await fetch(`${API_URL}/api/dispatch/live?period=yesterday&refresh=1`)
      await fetch(`${API_URL}/api/dispatch/live?period=today&refresh=1`)
      await fetch(`${API_URL}/api/reviews?limit=200`)
      await fetchCustomers()
      showToast(txt('Baza de clienți și recenziile au fost sincronizate!', 'База клиентов и отзывы синхронизированы!', 'Customer database and reviews synced!'))
    } catch (_) {
      showToast(txt('Eroare la sincronizare.', 'Ошибка синхронизации.', 'Sync error.'))
    } finally {
      setSyncing(false)
    }
  }

  const handleCopyPhone = (e, id, phone) => {
    e.stopPropagation()
    if (!phone) return
    navigator.clipboard.writeText(phone)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }

  const handleSaveCustomer = async () => {
    if (!selectedCustomer || savingEdit) return
    setSavingEdit(true)
    try {
      const resp = await fetch(`${API_URL}/api/customers/${encodeURIComponent(selectedCustomer.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      const json = await resp.json()
      if (json.success && json.customer) {
        setSelectedCustomer(json.customer)
        setCustomers(prev => prev.map(c => c.id === json.customer.id ? json.customer : c))
        setShowEditPanel(false)
        showToast(txt('Datele clientului au fost salvate!', 'Данные клиента сохранены!', 'Customer details saved!'))
      }
    } catch (_) {
      showToast(txt('Eroare la salvarea clientului.', 'Ошибка сохранения.', 'Failed to save customer.'))
    } finally {
      setSavingEdit(false)
    }
  }

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams({
        city: cityFilter,
        brand: brandFilter,
        platform: platformFilter,
        segment: segmentFilter,
        search: debouncedSearch,
        sort: sortConfig.key,
        sort_dir: sortConfig.direction,
        page: '1',
        limit: '9999'
      })
      const resp = await fetch(`${API_URL}/api/customers?${params.toString()}`)
      const json = await resp.json()
      const list = json.customers || customers
      const headers = [
        'Nr',
        'Nume Client',
        'Telefon',
        'Tip Telefon',
        'Oras',
        'Strada',
        'Detalii Adresa / Instructiuni',
        'Branduri',
        'Platforme',
        'Nr Comenzi',
        'Nr Recenzii',
        'Nota Medie Recenzii',
        'Total Cheltuit (RON)',
        'Bon Mediu (RON)',
        'Ultima Comanda',
        'VIP',
        'Note'
      ]
      const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
      const rows = list.map((c, idx) => {
        const parsed = parseDeliveryAddress(c.address || '', 'ro')
        return [
          idx + 1,
          c.name || '',
          c.phone || '',
          c.is_direct_phone ? 'Mobil Direct' : 'Centrala Agregator',
          c.city || '',
          parsed.streetAddress || '',
          c.address || '',
          (c.brands || []).join(' | '),
          (c.platforms || []).join(' | '),
          c.orders_count || 1,
          c.reviews_count || (c.reviews || []).length || 0,
          c.avg_rating ? `${c.avg_rating}/5` : '',
          Number(c.total_spent || 0).toFixed(2),
          Number(c.avg_order_value || 0).toFixed(2),
          c.last_order_at ? new Date(c.last_order_at).toLocaleString('ro-RO') : '',
          c.is_vip ? 'DA' : 'NU',
          c.notes || ''
        ].map(escapeCsv).join(',')
      })

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clienti_${cityFilter !== 'all' ? cityFilter.toLowerCase() + '_' : ''}${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast(txt(`Export CSV generat (${list.length} clienți)!`, `CSV экспортирован (${list.length} клиентов)!`, `CSV exported (${list.length} customers)!`))
    } catch (_) {
      showToast(txt('Eroare la exportul CSV.', 'Ошибка экспорта CSV.', 'CSV export failed.'))
    }
  }

  // Page Totals for <tfoot>
  const safePage = Math.max(1, Math.min(page, totalPages || 1))
  const startIndex = (safePage - 1) * rowsPerPage

  const pageTotalRevenue = useMemo(
    () => customers.reduce((sum, c) => sum + Number(c.total_spent || 0), 0),
    [customers]
  )
  const pageTotalOrders = useMemo(
    () => customers.reduce((sum, c) => sum + Number(c.orders_count || 1), 0),
    [customers]
  )
  const pageTotalReviews = useMemo(
    () => customers.reduce((sum, c) => sum + Number(c.reviews_count || (c.reviews || []).length || 0), 0),
    [customers]
  )
  const pageDirectPhones = useMemo(
    () => customers.filter(c => c.is_direct_phone).length,
    [customers]
  )

  const selectedParsedAddr = useMemo(
    () => selectedCustomer ? parseDeliveryAddress(selectedCustomer.address || '', language) : null,
    [selectedCustomer, language]
  )

  return (
    <div className="w-full space-y-3 pb-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2">
          <Check size={15} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ─── 1. TOP HEADER & ACTIONS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20">
            <Users size={17} />
          </div>
          <div>
            <h1 className={`text-base sm:text-lg font-bold tracking-tight uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {txt('Bază de Date Clienți · CRM & Recenzii', 'База Данных Клиентов · CRM и Отзывы', 'Customer Database · CRM & Reviews')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {txt(
                'Clienți reali salvați automat din comenzile Syrve / iiko, Glovo, Wolt, Bolt Food și legați cu recenziile din Reputație',
                'Реальные клиенты из заказов Syrve / iiko, Glovo, Wolt, Bolt Food, связанные с отзывами',
                'Real customers saved from Syrve / iiko, Glovo, Wolt, Bolt Food orders and linked with Reputation reviews'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleSyncFromOrders}
            disabled={syncing}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin text-emerald-500' : ''} />
            <span>
              {syncing
                ? txt('Sincronizare...', 'Синхронизация...', 'Syncing...')
                : txt('Sincronizează Comenzi & Recenzii', 'Синхронизировать Заказы и Отзывы', 'Sync Orders & Reviews')}
            </span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} />
            <span>{txt('Export CSV', 'Экспорт CSV', 'Export CSV')}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. KPI CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
            <span>{txt('Total Clienți Reali', 'Всего Клиентов', 'Total Real Customers')}</span>
            <Users size={15} className="text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {Number(kpis.total_customers || 0).toLocaleString('ro-RO')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {Number(kpis.with_address_count || 0).toLocaleString('ro-RO')} {txt('cu adresă salvată', 'с сохраненным адресом', 'with saved address')}
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
            <span>{txt('Clienți Recurenți (2+)', 'Постоянные (2+)', 'Repeat Customers (2+)')}</span>
            <Repeat size={15} className="text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {Number(kpis.repeat_customers || 0).toLocaleString('ro-RO')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {txt('Comenzi repetate înregistrate', 'Повторные заказы', 'Repeat orders recorded')}
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
            <span>{txt('Clienți VIP', 'VIP Клиенты', 'VIP Customers')}</span>
            <Award size={15} className="text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-500 mt-1 font-mono">
            {Number(kpis.vip_customers || 0).toLocaleString('ro-RO')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {txt('3+ comenzi sau peste 300 RON', '3+ заказов или > 300 RON', '3+ orders or > 300 RON')}
          </div>
        </div>

        <div
          onClick={() => { setSegmentFilter(segmentFilter === 'with_reviews' ? 'all' : 'with_reviews'); setPage(1) }}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            segmentFilter === 'with_reviews'
              ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
              : isDark ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
            <span>{txt('Clienți cu Recenzii', 'Клиенты с Отзывами', 'Customers with Reviews')}</span>
            <MessageSquare size={15} className="text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-500 mt-1 font-mono">
            {Number(kpis.with_reviews_count || 0).toLocaleString('ro-RO')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {txt('Click pentru filtrare recenzii', 'Нажмите для фильтра отзывов', 'Click to filter reviewed customers')}
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border col-span-2 lg:col-span-1 ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400">
            <span>{txt('Valoare Totală Comenzi', 'Общая Сумма Заказов', 'Total Customer Revenue')}</span>
            <TrendingUp size={15} className="text-sky-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {formatMoney(kpis.total_revenue)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {Number(kpis.total_orders || 0).toLocaleString('ro-RO')} {txt('comenzi', 'заказов', 'orders')} · Ø {Number(kpis.avg_order_value || 0).toFixed(2)} RON
          </div>
        </div>
      </div>

      {/* ─── 3. MAIN TABLE CARD (Standard SmartDevize Table & Pagination UI Rules) ─── */}
      <div className={`p-5 rounded-2xl border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        {/* Top Row: Table Title + Count Badge + Rounded Search Input with Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>{txt('Tabel Bază de Date Clienți', 'Таблица Клиентов', 'Customers Database Table')}</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                {totalFiltered} {txt('clienți', 'клиентов', 'customers')}
              </span>
            </h2>
          </div>

          <div className="relative w-full sm:w-80 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                if (searchParams.has('search')) setSearchParams({})
              }}
              placeholder={txt(
                'Caută nume client, telefon, stradă, recenzie sau #bon...',
                'Поиск по имени, телефону, улице, отзыву или #чеку...',
                'Search name, phone, street, review or #order...'
              )}
              className={`w-full pl-9 ${search ? 'pr-24' : 'pr-3'} py-1.5 text-xs font-medium rounded-full border transition-all outline-none ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
            />
            {search && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="bg-emerald-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-tight whitespace-nowrap shadow-xs">
                  {totalFiltered} / {kpis.total_customers}
                </span>
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSearchParams({}); setPage(1) }}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title={txt('Șterge căutarea', 'Очистить поиск', 'Clear search')}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Unified Filter Bar: City, Brand, Segment Tabs & Platform Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Segment Pills */}
            {[
              { id: 'all', label: txt('Toți Clienții', 'Все Клиенты', 'All Customers'), count: kpis.total_customers },
              { id: 'with_reviews', label: txt('Cu Recenzii', 'С Отзывами', 'With Reviews'), count: kpis.with_reviews_count || 0 },
              { id: 'repeat', label: txt('Recurenți (2+)', 'Постоянные (2+)', 'Repeat (2+)'), count: kpis.repeat_customers },
              { id: 'vip', label: txt('VIP', 'VIP', 'VIP'), count: kpis.vip_customers },
              { id: 'direct_phone', label: txt('Mobil Direct', 'Прямой моб.', 'Direct Mobile'), count: kpis.direct_phone_count || kpis.with_phone_count },
              { id: 'with_address', label: txt('Cu Adresă', 'С адресом', 'With Address'), count: kpis.with_address_count }
            ].map(seg => {
              const active = segmentFilter === seg.id
              return (
                <button
                  key={seg.id}
                  onClick={() => { setSegmentFilter(seg.id); setPage(1) }}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDark
                        ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <span>{seg.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    active
                      ? 'bg-white/20 text-white'
                      : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {seg.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Dropdowns: City, Brand, Platform */}
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={cityFilter}
              onChange={e => { setCityFilter(e.target.value); setPage(1) }}
              className={`text-xs font-bold rounded-full px-3 py-1.5 border outline-none cursor-pointer ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">{txt('Toate Orașele', 'Все Города', 'All Cities')}</option>
              {cities.map(c => (
                <option key={c} value={c}>{getCityDisplayName(c)}</option>
              ))}
            </select>

            <select
              value={brandFilter}
              onChange={e => { setBrandFilter(e.target.value); setPage(1) }}
              className={`text-xs font-bold rounded-full px-3 py-1.5 border outline-none cursor-pointer ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">{txt('Toate Brandurile', 'Все Бренды', 'All Brands')}</option>
              {(brands.length > 0 ? brands : ['Roll Master', 'Love Sushi', 'Poki Woki', 'Smash Me', 'Crunch']).map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={platformFilter}
              onChange={e => { setPlatformFilter(e.target.value); setPage(1) }}
              className={`text-xs font-bold rounded-full px-3 py-1.5 border outline-none cursor-pointer ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <option value="all">{txt('Toate Canalele', 'Все Каналы', 'All Channels')}</option>
              <option value="glovo">Glovo</option>
              <option value="wolt">Wolt</option>
              <option value="bolt">Bolt Food</option>
              <option value="google">Google Maps</option>
              <option value="direct">Direct / Web</option>
            </select>

            {(cityFilter !== 'all' || brandFilter !== 'all' || platformFilter !== 'all' || segmentFilter !== 'all' || search) && (
              <button
                onClick={() => {
                  setCityFilter('all')
                  setBrandFilter('all')
                  setPlatformFilter('all')
                  setSegmentFilter('all')
                  setSearch('')
                  setSearchParams({})
                  setPage(1)
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer flex items-center gap-1"
              >
                <X size={11} />
                <span>{txt('Reset', 'Сброс', 'Reset')}</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── TABLE (Compact Single-Line Rows + Sortable Headers + TFOOT Totals) ─── */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs min-w-[1040px]">
            <thead>
              <tr className={`border-b text-[11px] font-bold uppercase tracking-wider select-none ${
                isDark ? 'border-slate-800 text-slate-400 bg-slate-800/40' : 'border-slate-200 text-slate-500 bg-slate-50'
              }`}>
                <th className="py-2.5 px-2 w-10 text-center">
                  {txt('Nr.', '№', '#')}
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-2.5 px-2.5 w-48 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>{txt('Client', 'Клиент', 'Customer')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="py-2.5 px-2.5 w-36 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>{txt('Telefon', 'Телефон', 'Phone')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortConfig.key === 'phone' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('city')}
                  className="py-2.5 px-2.5 w-60 max-w-[240px] cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>{txt('Oraș & Stradă', 'Город и Улица', 'City & Street')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortConfig.key === 'city' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="py-2.5 px-2.5 w-40">
                  {txt('Brand & Canal', 'Бренд и Канал', 'Brand & Channel')}
                </th>
                <th
                  onClick={() => handleSort('orders_count')}
                  className="py-2.5 px-2 w-20 text-center cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>{txt('Comenzi', 'Заказы', 'Orders')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortConfig.key === 'orders_count' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('reviews_count')}
                  className="py-2.5 px-2 w-28 text-center cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>{txt('Recenzii', 'Отзывы', 'Reviews')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortConfig.key === 'reviews_count' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('last_order')}
                  className="py-2.5 px-2.5 w-36 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>{txt('Ultima Comandă', 'Посл. Заказ', 'Last Order')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortConfig.key === 'last_order' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('total_spent')}
                  className="py-2.5 px-2.5 w-32 text-right cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span>{txt('Total', 'Сумма', 'Total')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sortConfig.key === 'total_spent' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="py-2.5 px-2 w-24 text-center">
                  {txt('Detalii', 'Детали', 'Details')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    {txt('Se încarcă baza de date de clienți...', 'Загрузка базы клиентов...', 'Loading customer database...')}
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    {txt('Niciun client găsit conform filtrelor selectate.', 'Клиенты по выбранным фильтрам не найдены.', 'No customers found for the selected filters.')}
                  </td>
                </tr>
              ) : (
                customers.map((cust, idx) => {
                  // Parsăm DOAR strada curată pentru tabel (fără bloc/interfon/instrucțiuni lungi în tabel!)
                  const parsedAddr = parseDeliveryAddress(cust.address || '', language)
                  const cleanStreetOnly = parsedAddr.streetAddress || ''
                  const hasExtraDetails = parsedAddr.buildingDetails.length > 0 || Boolean(parsedAddr.instructions)
                  const isVip = cust.is_vip || (cust.orders_count || 0) >= 3 || (cust.total_spent || 0) >= 300
                  const isRepeat = (cust.orders_count || 0) >= 2
                  const lastOrder = (cust.recent_orders || [])[0]
                  const primaryBrand = (cust.brands || [])[0] || 'Roll Master'
                  const revCount = cust.reviews_count || (cust.reviews || []).length || 0
                  const hasNegRev = cust.has_negative_review || (cust.reviews || []).some(r => r.sentiment === 'negative')

                  return (
                    <tr
                      key={cust.id}
                      onClick={() => openCustomerModal(cust, false)}
                      className={`cursor-pointer transition-colors ${
                        isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-100/90'
                      }`}
                      title={txt('Apasă pentru Dosar Complet Client (Comenzi, Produse, Recenzii și Adresă)', 'Нажмите для Полного Досье Клиента (Заказы, Продукты, Отзывы и Адрес)', 'Click for Full Customer Dossier (Orders, Items, Reviews & Address)')}
                    >
                      {/* Col 1: Nr. Crt. */}
                      <td className="py-2 px-2 w-10 font-semibold text-slate-400 text-center">
                        {startIndex + idx + 1}
                      </td>

                      {/* Col 2: Client Name & VIP/Repeat Badge */}
                      <td className="py-2 px-2.5 w-48 max-w-[200px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {cust.avatar_url ? (
                            <img
                              src={cust.avatar_url}
                              alt={cust.name}
                              referrerPolicy="no-referrer"
                              className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-300 dark:border-slate-700"
                            />
                          ) : null}
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {cust.name || txt('Client Livrare', 'Клиент доставки', 'Delivery Customer')}
                          </span>
                          {isVip && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                              <Star size={9} />
                              VIP
                            </span>
                          )}
                          {isRepeat && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0 font-mono">
                              {cust.orders_count}x
                            </span>
                          )}
                        </div>
                        {cust.notes && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 truncate mt-0.5 flex items-center gap-1">
                            <FileText size={10} className="shrink-0" />
                            <span className="truncate">{cust.notes}</span>
                          </div>
                        )}
                      </td>

                      {/* Col 3: Phone */}
                      <td className="py-2 px-2.5 w-36 whitespace-nowrap">
                        {cust.phone ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Phone size={11} className={cust.is_direct_phone ? 'text-emerald-500 shrink-0' : 'text-slate-400 shrink-0'} />
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                {cust.phone}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyPhone(e, cust.id, cust.phone)}
                                className="p-0.5 rounded text-slate-400 hover:text-emerald-500 cursor-pointer"
                                title={txt('Copiază numărul', 'Скопировать номер', 'Copy phone')}
                              >
                                {copiedId === cust.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              </button>
                            </div>
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                              cust.is_direct_phone
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-500/10 text-slate-400'
                            }`}>
                              {cust.is_direct_phone
                                ? txt('Mobil Direct', 'Прямой моб.', 'Direct Mobile')
                                : txt('Centrală Agregator', 'Колл-центр', 'Aggregator Proxy')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Col 4: City & Clean Single-Line Street Address (Details hidden in Modal!) */}
                      <td className="py-2 px-2.5 w-60 max-w-[240px]">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                            {getCityDisplayName(cust.city || '—')}
                          </span>
                          {hasExtraDetails && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                              {txt('+ detalii în profil', '+ детали в профиле', '+ details in profile')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate mt-0.5">
                          {cleanStreetOnly || (cust.address ? txt('Vezi detalii adresă', 'См. детали адреса', 'View address details') : txt('Fără adresă salvată', 'Адрес не указан', 'No saved address'))}
                        </div>
                      </td>

                      {/* Col 5: Brand & Channel */}
                      <td className="py-2 px-2.5 w-40">
                        <div className="flex items-center gap-2 min-w-0">
                          <BrandAvatar brand={primaryBrand} size={20} />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                              {(cust.brands || []).join(', ') || primaryBrand}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {(cust.platforms || []).map(p => (
                                <span key={p} className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                                  <PlatformLogo platform={p} size={13} />
                                  <span>{p}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Col 6: Orders Count */}
                      <td className="py-2 px-2 w-20 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black font-mono ${
                          isRepeat
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {cust.orders_count || 1}
                        </span>
                      </td>

                      {/* Col 7: Reviews Linked */}
                      <td className="py-2 px-2 w-28 text-center whitespace-nowrap">
                        {revCount > 0 ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black font-mono border ${
                            hasNegRev
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}>
                            <Star size={10} className="fill-current" />
                            <span>{cust.avg_rating || '5.0'}</span>
                            <span className="opacity-75">({revCount})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Col 8: Last Order Date & Clickable #Bon */}
                      <td className="py-2 px-2.5 w-36 whitespace-nowrap">
                        {cust.last_order_at ? (
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                              {new Date(cust.last_order_at).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              {' · '}
                              {new Date(cust.last_order_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {lastOrder && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openOrderDetailsModal(cust, lastOrder)
                                }}
                                className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-black cursor-pointer"
                                title={txt('Vezi Bonul iiko al Comenzii', 'Открыть чек iiko заказа', 'View Order iiko Receipt')}
                              >
                                <Receipt size={10} />
                                <span>#{lastOrder.order_number}</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Col 9: Total Spent (RON) */}
                      <td className="py-2 px-2.5 w-32 text-right whitespace-nowrap font-mono">
                        <div className="font-black text-slate-900 dark:text-white text-xs">
                          {formatMoney(cust.total_spent)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Ø {Number(cust.avg_order_value || cust.total_spent || 0).toFixed(0)} RON
                        </div>
                      </td>

                      {/* Col 10: Action Buttons (Dosar Complet Client + Bon Comandă) */}
                      <td className="py-2 px-2 w-24 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openCustomerModal(cust, false)
                            }}
                            className="px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold transition-colors cursor-pointer inline-flex items-center gap-1"
                            title={txt('Deschide Pagina Full Details a Clientului (Comenzi, Produse, Recenzii, Adresă)', 'Открыть Полное Досье Клиента (Заказы, Продукты, Отзывы, Адрес)', 'Open Customer Full Details (Orders, Items, Reviews, Address)')}
                          >
                            <Eye size={12} />
                            <span>{txt('Detalii', 'Детали', 'Details')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openOrderDetailsModal(cust)
                            }}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isDark
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title={txt('Bon Comandă iiko', 'Чек заказа iiko', 'iiko Order Receipt')}
                          >
                            <Receipt size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* TFOOT TOTALURI (Standard SmartDevize Table & Totals UI Rules) */}
            <tfoot className={`border-t-2 font-bold ${
              isDark ? 'border-slate-700 bg-slate-800/80 text-white' : 'border-slate-300 bg-slate-100/90 text-slate-900'
            }`}>
              <tr>
                <td className="py-2.5 px-2 w-10 text-center text-slate-400 font-bold">
                  Σ
                </td>
                <td className="py-2.5 px-2.5 whitespace-nowrap">
                  <span className="text-xs font-black uppercase tracking-wider">
                    {txt('Total Pagină:', 'Итого стр.:', 'Page Total:')}
                  </span>
                </td>
                <td className="py-2.5 px-2.5 whitespace-nowrap">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {customers.length} {txt('clienți', 'клиентов', 'customers')}
                    {totalPages > 1 && (
                      <span className="text-[11px] font-normal text-slate-400 ml-1">
                        ({txt('din', 'из', 'of')} {totalFiltered})
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-2.5 text-xs text-slate-500 dark:text-slate-400">
                  {pageDirectPhones} {txt('mobil direct pe pagină', 'прямых моб. на стр.', 'direct mobile on page')}
                </td>
                <td className="py-2.5 px-2.5 text-slate-400">
                  —
                </td>
                <td className="py-2.5 px-2 text-center font-mono">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {pageTotalOrders}
                  </div>
                  {totalPages > 1 && (
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Gen: {filteredTotalOrders}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-2 text-center font-mono">
                  <div className="text-xs font-black text-amber-500">
                    {pageTotalReviews}
                  </div>
                  {totalPages > 1 && (
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Gen: {filteredTotalReviews}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-2.5 text-right text-xs font-bold text-slate-500 dark:text-slate-400">
                  {totalPages > 1 ? txt('Total Pagină:', 'Итого стр.:', 'Page Total:') : ''}
                </td>
                <td className="py-2.5 px-2.5 text-right whitespace-nowrap font-mono">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {formatMoney(pageTotalRevenue)}
                  </div>
                  {totalPages > 1 && (
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      Gen: {formatMoney(filteredTotalRevenue)}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-2 text-center text-slate-400">
                  —
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* FOOTER PAGINARE (Standard SmartDevize Table & Pagination UI Rules) */}
        <div className={`-mx-5 -mb-5 mt-3 px-5 py-3.5 border-t flex flex-wrap items-center justify-between gap-3 rounded-b-2xl ${
          isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{txt('Rânduri:', 'Строк:', 'Rows:')}</span>
              <select
                value={rowsPerPage}
                onChange={e => {
                  setRowsPerPage(Number(e.target.value))
                  setPage(1)
                }}
                className={`h-8 px-3 rounded-full border text-xs font-bold outline-none cursor-pointer transition-colors ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={9999}>{txt('Toți', 'Все', 'All')}</option>
              </select>
            </div>
            <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} hidden sm:block`}></div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>{txt('Total:', 'Всего:', 'Total:')}</span>
              <span className="font-bold text-slate-900 dark:text-white">{totalFiltered}</span>
              <span>{txt('înregistrări', 'записей', 'records')}</span>
              <span className="text-slate-400 font-medium ml-1 font-mono">
                ({formatMoney(filteredTotalRevenue)})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="whitespace-nowrap">
              {txt('Pagina', 'Страница', 'Page')}{' '}
              <span className="font-bold text-slate-900 dark:text-white">{totalFiltered === 0 ? 0 : safePage}</span>{' '}
              {txt('din', 'из', 'of')} {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1 || totalFiltered === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages || totalFiltered === 0}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. DOSAR COMPLET CLIENT (360° FULL CUSTOMER DETAILS: PROFIL, ADRESĂ, RECENZII, COMENZI & PRODUSE) ─── */}
      {selectedCustomer && (
        <div
          onClick={closeCustomerModal}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-40 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Top Sticky Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {selectedCustomer.avatar_url ? (
                  <img
                    src={selectedCustomer.avatar_url}
                    alt={selectedCustomer.name}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-2xl object-cover border border-emerald-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 flex items-center justify-center font-black text-sm shrink-0">
                    {String(selectedCustomer.name || 'C').slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black tracking-tight truncate">
                      {selectedCustomer.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                      {getCityDisplayName(selectedCustomer.city || '—')}
                    </span>
                    {(selectedCustomer.is_vip || (selectedCustomer.orders_count || 0) >= 3 || (selectedCustomer.total_spent || 0) >= 300) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <Star size={10} className="fill-current" />
                        <span>VIP</span>
                      </span>
                    )}
                    {(selectedCustomer.reviews_count || (selectedCustomer.reviews || []).length) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <Star size={10} className="fill-current" />
                        <span>★ {selectedCustomer.avg_rating || '5.0'}/5 ({selectedCustomer.reviews_count || (selectedCustomer.reviews || []).length} {txt('recenzii', 'отзывов', 'reviews')})</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap font-mono">
                    {selectedCustomer.phone && (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                        <Phone size={11} className="text-emerald-500" />
                        <span>{selectedCustomer.phone}</span>
                        <span className="text-[10px] font-sans font-semibold text-slate-400">
                          ({selectedCustomer.is_direct_phone ? txt('Mobil Direct', 'Прямой моб.', 'Direct Mobile') : txt('Centrală Agregator', 'Колл-центр', 'Aggregator Proxy')})
                        </span>
                      </span>
                    )}
                    <span>ID: {selectedCustomer.id}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditPanel(prev => !prev)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    showEditPanel
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <Edit3 size={13} />
                  <span>{txt('Editează Profil / Note', 'Редактировать Профиль', 'Edit Profile / Notes')}</span>
                </button>

                <button
                  type="button"
                  onClick={closeCustomerModal}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable Body of Full Customer Dossier */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
              {/* 4 Summary KPI Boxes for this Customer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    {txt('Total Comenzi', 'Всего Заказов', 'Total Orders')}
                  </span>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                    {selectedCustomer.orders_count || 1}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {(selectedCustomer.brands || []).join(', ')}
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    {txt('Total Cheltuit', 'Всего Потрачено', 'Total Spent')}
                  </span>
                  <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatMoney(selectedCustomer.total_spent)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {txt('Bon mediu:', 'Средний чек:', 'Avg order:')} {formatMoney(selectedCustomer.avg_order_value || selectedCustomer.total_spent)}
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    {txt('Recenzii Client', 'Отзывы Клиента', 'Customer Reviews')}
                  </span>
                  <div className="text-lg font-black font-mono text-amber-500 mt-0.5">
                    {(selectedCustomer.reviews || []).length > 0
                      ? `★ ${selectedCustomer.avg_rating || '5.0'} / 5`
                      : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {(selectedCustomer.reviews || []).length} {txt('recenzii înregistrate', 'отзывов в базе', 'recorded reviews')}
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    {txt('Ultima Activitate', 'Последняя Активность', 'Last Activity')}
                  </span>
                  <div className="text-xs font-black font-mono text-slate-900 dark:text-white mt-1">
                    {selectedCustomer.last_order_at ? new Date(selectedCustomer.last_order_at).toLocaleString('ro-RO') : '—'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {(selectedCustomer.platforms || []).map(p => (
                      <span key={p} className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                        <PlatformLogo platform={p} size={12} />
                        <span>{p}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Collapsible Edit Customer Panel */}
              {showEditPanel && (
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-emerald-500/30' : 'bg-emerald-50/40 border-emerald-200'}`}>
                  <div className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                    <Edit3 size={13} />
                    <span>{txt('Editare Date Client & Note CRM', 'Редактирование Данных Клиента и Заметок CRM', 'Edit Customer Details & CRM Notes')}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        {txt('Nume Client', 'Имя Клиента', 'Customer Name')}
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        {txt('Telefon', 'Телефон', 'Phone')}
                      </label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        {txt('Oraș', 'Город', 'City')}
                      </label>
                      <input
                        type="text"
                        value={editForm.city}
                        onChange={e => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.is_vip}
                          onChange={e => setEditForm(prev => ({ ...prev, is_vip: e.target.checked }))}
                        />
                        <Star size={14} />
                        <span>{txt('Client VIP Prioritar', 'Приоритетный VIP клиент', 'Priority VIP Customer')}</span>
                      </label>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      {txt('Adresă Completă', 'Полный Адрес', 'Full Address')}
                    </label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      {txt('Note / Observații Interne Client', 'Внутренние Заметки о Клиенте', 'Internal Customer Notes')}
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder={txt('Adaugă o notă internă pentru acest client...', 'Добавьте заметку об этом клиенте...', 'Add an internal note for this customer...')}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEditPanel(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
                    >
                      {txt('Anulează', 'Отмена', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCustomer}
                      disabled={savingEdit}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} />
                      <span>
                        {savingEdit
                          ? txt('Se salvează...', 'Сохранение...', 'Saving...')
                          : txt('Salvează Datele Clientului', 'Сохранить Данные Клиента', 'Save Customer Details')}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* ─── SECTION 1: FULL DELIVERY ADDRESS DETAILS (Stradă, Bloc, Scară, Etaj, Interfon, Instrucțiuni) ─── */}
              {selectedCustomer.address && selectedParsedAddr && (
                <div className={`p-4 rounded-2xl border ${
                  isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MapPin size={13} className="text-emerald-500" />
                      <span>{txt('Detalii Complete Adresă de Livrare', 'Полные Детали Адреса Доставки', 'Full Delivery Address Details')}</span>
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedParsedAddr.streetAddress || selectedCustomer.address}, ${selectedCustomer.city || ''}, Romania`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <MapPin size={12} />
                      <span>{txt('Deschide în Google Maps', 'Открыть в Google Maps', 'Open in Google Maps')}</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    {selectedParsedAddr.streetAddress || selectedCustomer.address}
                  </div>

                  {selectedParsedAddr.buildingDetails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedParsedAddr.buildingDetails.map((b, i) => (
                        <span
                          key={i}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {b.label}: <strong className="font-mono">{b.value}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedParsedAddr.instructions && (
                    <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                      {selectedParsedAddr.instructions}
                    </div>
                  )}
                </div>
              )}

              {/* ─── SECTION 2: RECENZII LĂSATE DE CLIENT (Reviews Linked to Customer) ─── */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <MessageSquare size={14} className="text-amber-500" />
                    <span>
                      {txt('Recenzii & Feedback Lăsate de Client', 'Отзывы и Оценки Клиента', 'Customer Reviews & Feedback')} ({(selectedCustomer.reviews || []).length})
                    </span>
                  </div>
                </div>

                {(selectedCustomer.reviews || []).length === 0 ? (
                  <div className={`p-3.5 rounded-2xl border text-xs text-slate-400 ${
                    isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200/70'
                  }`}>
                    {txt(
                      'Acest client nu are încă recenzii scrise înregistrate pe Google Maps, Glovo, Wolt sau Bolt Food.',
                      'У этого клиента пока нет зарегистрированных отзывов в Google Maps, Glovo, Wolt или Bolt Food.',
                      'This customer has no recorded reviews on Google Maps, Glovo, Wolt, or Bolt Food yet.'
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(selectedCustomer.reviews || []).map((rev, rIdx) => {
                      const isNeg = rev.sentiment === 'negative'
                      const isPos = rev.sentiment === 'positive'
                      const displayComment =
                        language !== 'ro' && rev.comment_translations?.[language]
                          ? rev.comment_translations[language]
                          : rev.comment

                      return (
                        <div
                          key={rev.id || rIdx}
                          className={`p-4 rounded-2xl border ${
                            isNeg
                              ? 'bg-rose-500/10 border-rose-500/30'
                              : isPos
                                ? isDark ? 'bg-emerald-950/25 border-emerald-800/60' : 'bg-emerald-50/60 border-emerald-200'
                                : isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-amber-50/50 border-amber-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                                isNeg ? 'bg-rose-600 text-white' : isPos ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                              }`}>
                                <Star size={11} className="fill-current" />
                                <span>{rev.rating}/{rev.max_rating || 5}</span>
                              </span>

                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-extrabold uppercase bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700">
                                <PlatformLogo platform={rev.platform || 'google'} size={13} />
                                <span>{rev.platform || 'google'}</span>
                              </span>

                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {rev.restaurant_name || rev.brand_name}
                              </span>

                              {rev.order_id && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-black">
                                  #{rev.order_id}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                              {rev.reviewed_at && (
                                <span>{new Date(rev.reviewed_at).toLocaleString('ro-RO')}</span>
                              )}
                              {rev.review_url && (
                                <a
                                  href={rev.review_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 font-sans font-bold text-[11px]"
                                >
                                  <span>Google Maps</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          </div>

                          {displayComment && (
                            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                              „{displayComment}”
                            </p>
                          )}

                          {Array.isArray(rev.review_photos) && rev.review_photos.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {rev.review_photos.map((photoUrl, pIdx) => (
                                <img
                                  key={pIdx}
                                  src={photoUrl}
                                  alt="Review attachment"
                                  referrerPolicy="no-referrer"
                                  onClick={() => setLightboxPhoto(photoUrl)}
                                  className="w-20 h-20 rounded-xl object-cover border border-slate-300 dark:border-slate-700 cursor-pointer hover:scale-105 transition-transform shadow-xs"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ─── SECTION 3: ISTORIC COMPLET COMENZI, TIMPI IIKO & PRODUSE COMANDATE ─── */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <ShoppingBag size={14} className="text-emerald-500" />
                    <span>
                      {txt('Istoric Complet Comenzi & Produse Comandate', 'Полная История Заказов и Продуктов', 'Full Orders & Ordered Products History')} ({(selectedCustomer.recent_orders || []).length})
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {(selectedCustomer.recent_orders || []).map((ro, idx) => {
                    const roParsedAddr = parseDeliveryAddress(ro.address || selectedCustomer.address || '', language)
                    const roItems = Array.isArray(ro.items) ? ro.items : []
                    const roTimings = ro.timings || {}

                    return (
                      <div
                        key={`${ro.base_uuid || ro.order_number}_${idx}`}
                        className={`p-4 rounded-2xl border ${
                          isDark ? 'bg-slate-800/50 border-slate-700/90' : 'bg-slate-50/90 border-slate-200'
                        }`}
                      >
                        {/* Order Header Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-700/70">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-black border border-emerald-500/30">
                              #{ro.order_number}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold uppercase">
                              <PlatformLogo platform={ro.platform} size={14} />
                              <span>{ro.platform}</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <BrandAvatar brand={ro.brand_name || 'Roll Master'} size={18} />
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {ro.restaurant_name || ro.brand_name}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                              <Clock size={12} />
                              {ro.placed_at ? new Date(ro.placed_at).toLocaleString('ro-RO') : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                              {formatMoney(ro.total_amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => openOrderDetailsModal(selectedCustomer, ro)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                            >
                              <Receipt size={13} />
                              <span>{txt('Bon Complet iiko', 'Полный чек iiko', 'Full iiko Receipt')}</span>
                            </button>
                          </div>
                        </div>

                        {/* iiko Timings & Courier Strip (if available) */}
                        {(roTimings.created_time || roTimings.cooking_completed_time || roTimings.sended_time || roTimings.delivered_time || ro.courier?.name) && (
                          <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-slate-200/60 dark:border-slate-700/50 text-[11px]">
                            <div className="flex flex-wrap items-center gap-3 font-mono">
                              {roTimings.created_time && (
                                <span className="text-slate-500 dark:text-slate-400">
                                  {txt('Intrată:', 'Поступил:', 'Created:')} <strong className="text-slate-900 dark:text-white">{roTimings.created_time}</strong>
                                </span>
                              )}
                              {roTimings.cooking_completed_time && (
                                <span className="text-slate-500 dark:text-slate-400">
                                  {txt('Gata Bucătărie:', 'Готов:', 'Cooked:')} <strong className="text-blue-600 dark:text-blue-400">{roTimings.cooking_completed_time}</strong>
                                </span>
                              )}
                              {roTimings.sended_time && (
                                <span className="text-slate-500 dark:text-slate-400">
                                  {txt('Predată Curier:', 'У курьера:', 'Sent:')} <strong className="text-amber-600 dark:text-amber-400">{roTimings.sended_time}</strong>
                                </span>
                              )}
                              {roTimings.delivered_time && (
                                <span className="text-slate-500 dark:text-slate-400">
                                  {txt('Livrată:', 'Доставлен:', 'Delivered:')} <strong className="text-emerald-600 dark:text-emerald-400">{roTimings.delivered_time}</strong>
                                </span>
                              )}
                            </div>

                            {ro.courier?.name && (
                              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <Truck size={12} />
                                <span>{ro.courier.name}</span>
                                {ro.courier.phone && <span className="font-mono text-slate-400">({ro.courier.phone})</span>}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Ordered Products List with Images, Quantities & Prices */}
                        {roItems.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                            {roItems.map((it, iIdx) => {
                              const pName = it.product_name || it.name || 'Produs'
                              const cleanPName = pName.replace(/^[A-Z0-9]{1,3}_\s*/i, '')
                              const qty = Number(it.quantity || it.amount || 1)
                              const lineSum = Number(it.sum || it.totalPrice || it.price || 0)
                              const pImg = getProductImage(pName, ro.brand_name || 'Roll Master', null)

                              return (
                                <div
                                  key={iIdx}
                                  onClick={() => openOrderDetailsModal(selectedCustomer, ro)}
                                  className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                                    isDark
                                      ? 'bg-slate-900/70 hover:bg-slate-900 border-slate-700/80'
                                      : 'bg-white hover:bg-slate-50 border-slate-200/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <img
                                      src={pImg}
                                      alt={cleanPName}
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                        if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex'
                                      }}
                                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                                    />
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 items-center justify-center text-slate-400 shrink-0 hidden">
                                      <Utensils size={15} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                        {cleanPName}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400">
                                        {qty}x · {lineSum > 0 ? `${lineSum.toFixed(2)} RON` : ''}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 font-mono">
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[11px] font-black">
                                      {qty}x
                                    </span>
                                    {lineSum > 0 && (
                                      <span className="text-xs font-black text-slate-900 dark:text-white">
                                        {lineSum.toFixed(2)} RON
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : ro.items_summary ? (
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-2.5">
                            {ro.items_summary}
                          </div>
                        ) : null}

                        {/* Order Address Line */}
                        {roParsedAddr.streetAddress && (
                          <div className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
                            <Building2 size={11} className="shrink-0 text-slate-400" />
                            <span className="truncate">{roParsedAddr.streetAddress}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. MODAL BON COMPLET IIKO (OrderDetailsModal) ─── */}
      <OrderDetailsModal
        isOpen={Boolean(selectedOrderModal)}
        order={selectedOrderModal}
        onClose={() => setSelectedOrderModal(null)}
      />

      {/* ─── 6. LIGHTBOX PENTRU POZELE DIN RECENZII ─── */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="relative max-w-3xl max-h-[88vh]">
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white border border-slate-700 flex items-center justify-center cursor-pointer"
            >
              <X size={16} />
            </button>
            <img
              src={lightboxPhoto}
              alt="Review zoom"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
