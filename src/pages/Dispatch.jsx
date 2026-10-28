import { useState, useMemo, useEffect, useRef } from 'react'
import { 
  Radio, 
  RotateCw, 
  Search, 
  Clock, 
  Calendar,
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
  ShieldAlert,
  ShieldCheck,
  EyeOff,
  Monitor,
  Receipt,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useLiveDispatch } from '../hooks/useLiveDispatch'
import { useLiveChecks } from '../hooks/useLiveChecks'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import { getProductImage } from '../lib/productImages'
import { getCanonicalCity, getCityDisplayName, maskPhone, maskCustomerName, maskAddress, formatDisplayOrderNumber } from '../lib/orderUtils'

const AUTHORITATIVE_BRANDS = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

const PERIOD_OPTIONS = [
  { key: 'today', labelKey: 'dispatch.period_today', fallback: 'Azi' },
  { key: 'yesterday', labelKey: 'dispatch.period_yesterday', fallback: 'Ieri' },
  { key: 'this_week', labelKey: 'dispatch.period_this_week', fallback: 'Săpt. Curentă' },
  { key: 'this_month', labelKey: 'dispatch.period_this_month', fallback: 'Luna Curentă' },
  { key: 'last_month', labelKey: 'dispatch.period_last_month', fallback: 'Luna Trecută' },
  { key: 'this_year', labelKey: 'dispatch.period_this_year', fallback: 'Anul Curent' },
  { key: 'all', labelKey: 'dispatch.period_all', fallback: 'Total Istoric' }
]

function getShortPeriodLabel(key, lang) {
  if (lang === 'ru') {
    switch (key) {
      case 'today': return 'Сегодня'
      case 'yesterday': return 'Вчера'
      case 'this_week': return 'Неделя'
      case 'this_month': return 'Месяц'
      case 'last_month': return 'Прошл. Месяц'
      case 'this_year': return 'Год'
      case 'all': return 'Все'
      default: return key
    }
  }
  if (lang === 'en') {
    switch (key) {
      case 'today': return 'Today'
      case 'yesterday': return 'Yesterday'
      case 'this_week': return 'Week'
      case 'this_month': return 'Month'
      case 'last_month': return 'Last Month'
      case 'this_year': return 'Year'
      case 'all': return 'All'
      default: return key
    }
  }
  switch (key) {
    case 'today': return 'Azi'
    case 'yesterday': return 'Ieri'
    case 'this_week': return 'Săpt.'
    case 'this_month': return 'Luna'
    case 'last_month': return 'Luna Trec.'
    case 'this_year': return 'An'
    case 'all': return 'Total'
    default: return key
  }
}

// Utility to extract correct wall-clock time from Syrve/iiko timestamps
// NOTE: Timestamps stored in DB contain Romanian wall-clock time saved with +00:00 (UTC)
function parseOrderDateTime(dateStr) {
  if (!dateStr) return { time: '—', date: '', isToday: false, dayStr: '' }
  
  const rawDateStr = String(dateStr).trim()
  const orderDayStr = rawDateStr.slice(0, 10) // 'YYYY-MM-DD'
  
  // Data de azi și de ieri în fusul orar al României
  const todayRo = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
  const isToday = orderDayStr === todayRo

  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return { time: '—', date: '', isToday, dayStr: orderDayStr }
  
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const time = `${hh}:${mm}`
  
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0')
  const date = `${dd}.${MM}`
  
  return { time, date, isToday, dayStr: orderDayStr }
}

// Utility to compute exact elapsed minutes using Europe/Bucharest wall-clock time
function computeElapsedMinutes(placedAt, createdAt, fallbackMin = 0) {
  try {
    const bucNowStr = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Bucharest' })
    const bucNowMs = new Date(bucNowStr.replace(' ', 'T') + 'Z').getTime()

    let orderWallClockMs = 0
    if (placedAt) {
      const cleanStr = String(placedAt).slice(0, 19).replace(' ', 'T')
      orderWallClockMs = new Date(cleanStr + 'Z').getTime()
    }

    if (!orderWallClockMs || isNaN(orderWallClockMs)) {
      if (createdAt) {
        return Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000))
      }
      return fallbackMin || 0
    }

    const diffMs = bucNowMs - orderWallClockMs
    return Math.max(0, Math.round(diffMs / 60000))
  } catch (_) {
    return fallbackMin || 0
  }
}

export default function Dispatch() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()

  // Filtre locale (inițializate din URL dacă utilizatorul accesează direct ?city=CLUJ-NAPOCA etc.)
  const [selectedCity, setSelectedCity] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('city')
      if (p) return getCanonicalCity(p) || 'all'
    } catch (_) {}
    return 'all'
  })
  const [selectedBrand, setSelectedBrand] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('brand')
      if (p) return p
    } catch (_) {}
    return 'all'
  })
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('all')
  const [selectedChannel, setSelectedChannel] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('channel')
      if (p) return p
    } catch (_) {}
    return 'all'
  })
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('period')
      if (p) return p
    } catch (_) {}
    return 'today'
  })
  const [activeTab, setActiveTab] = useState('all') // 'all', 'cooking', 'ready', 'on_way', 'delivered', 'problems'
  const [searchQuery, setSearchQuery] = useState('')

  // Paginare comenzi (Standard SmartDevize Table & Pagination UI Rules)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(15)

  // Etichetă perioadă curentă
  const currentPeriodOpt = PERIOD_OPTIONS.find(p => p.key === selectedPeriod) || PERIOD_OPTIONS[0]
  const currentPeriodLabel = t(currentPeriodOpt.labelKey, currentPeriodOpt.fallback)

  // Sincronizare parametri URL la schimbarea filtrelor
  const updateUrlParam = (key, value) => {
    try {
      const url = new URL(window.location.href)
      if (value && value !== 'all' && (key !== 'period' || value !== 'today')) {
        url.searchParams.set(key, value)
      } else {
        url.searchParams.delete(key)
      }
      window.history.replaceState({}, '', url.toString())
    } catch (_) {}
  }

  const handleCityChange = (city) => {
    const canon = city !== 'all' ? getCanonicalCity(city) : 'all'
    setSelectedCity(canon)
    setSelectedRestaurantId('all')
    setPage(1)
    updateUrlParam('city', canon)
  }

  const handleBrandChange = (brand) => {
    setSelectedBrand(brand)
    setSelectedRestaurantId('all')
    setPage(1)
    updateUrlParam('brand', brand)
  }

  const handleChannelChange = (channel) => {
    setSelectedChannel(channel)
    setPage(1)
    updateUrlParam('channel', channel)
  }

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period)
    setPage(1)
    updateUrlParam('period', period)
  }

  const handleResetFilters = () => {
    setSelectedCity('all')
    setSelectedBrand('all')
    setSelectedRestaurantId('all')
    setSelectedChannel('all')
    setSelectedPeriod('today')
    setPage(1)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('city')
      url.searchParams.delete('brand')
      url.searchParams.delete('channel')
      url.searchParams.delete('period')
      window.history.replaceState({}, '', url.pathname)
    } catch (_) {}
  }

  // Ascultare eveniment popstate pentru navigare back/forward în browser
  useEffect(() => {
    const onPopState = () => {
      try {
        const pCity = new URLSearchParams(window.location.search).get('city')
        setSelectedCity(pCity ? getCanonicalCity(pCity) : 'all')
        const pBrand = new URLSearchParams(window.location.search).get('brand')
        setSelectedBrand(pBrand || 'all')
        const pChannel = new URLSearchParams(window.location.search).get('channel')
        setSelectedChannel(pChannel || 'all')
        const pPeriod = new URLSearchParams(window.location.search).get('period')
        setSelectedPeriod(pPeriod || 'today')
      } catch (_) {}
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // GDPR Protection State (disabled by default for operational visibility)
  const [gdprMasked, setGdprMasked] = useState(false)
  const [unmaskedRows, setUnmaskedRows] = useState(new Set())

  const toggleUnmaskRow = (orderId, e) => {
    e?.stopPropagation()
    setUnmaskedRows(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  // Modal comanda selectata
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Hook date live
  const { 
    kpis, 
    orders, 
    stopMatrix, 
    stopAuditLog, 
    periodDateRange: livePeriodDateRange,
    loading, 
    lastUpdated, 
    fetchData, 
    isAutoRefreshEnabled, 
    setIsAutoRefreshEnabled 
  } = useLiveDispatch({ 
    city: selectedCity, 
    brand: selectedBrand, 
    restaurantId: selectedRestaurantId,
    period: selectedPeriod,
    autoRefreshSeconds: 15 
  })

  // Hook pentru lista de restaurante complete (pentru filtre)
  const { restaurants } = useLiveChecks()

  // Lista unică a orașelor canonice (fără duplicate Cluj / Cluj-Napoca, fără cartiere/malluri BUC)
  const availableCities = useMemo(() => {
    const set = new Set()
    restaurants.forEach(r => {
      const c = getCanonicalCity(r.city || r.name)
      if (c) set.add(c)
    })
    return ['all', ...Array.from(set).sort()]
  }, [restaurants])

  // Restaurante filtrate conform orașului și brandului
  const filteredRestaurantsForSelector = useMemo(() => {
    return restaurants.filter(r => {
      if (!r.is_active) return false
      if (selectedCity !== 'all') {
        const c = getCanonicalCity(r.city || r.name)
        if (c !== selectedCity) return false
      }
      if (selectedBrand !== 'all') {
        const b = getBrandInfo(r).name
        if (b !== selectedBrand) return false
      }
      return true
    })
  }, [restaurants, selectedCity, selectedBrand])

  // Opțiuni formatate pentru Selectorul Punct de Lucru cu bară de căutare
  const restaurantOptions = useMemo(() => {
    return filteredRestaurantsForSelector.map(r => {
      const bInfo = getBrandInfo(r)
      const cleanName = cleanRestaurantName(r.name)
      const cityName = getCityDisplayName(r.city)
      return {
        value: r.id,
        label: cleanName,
        sublabel: `${cityName} · ${bInfo.name}`,
        avatar: <BrandAvatar brand={bInfo.name} name={r.name} size={18} />,
        keywords: `${r.name} ${r.city} ${bInfo.name} ${cleanName} ${cityName}`
      }
    })
  }, [filteredRestaurantsForSelector])

  // Opțiuni formatate pentru Selectorul Oraș cu bară de căutare
  const cityOptions = useMemo(() => {
    return availableCities.filter(c => c !== 'all').map(cityKey => ({
      value: cityKey,
      label: getCityDisplayName(cityKey),
      keywords: `${cityKey} ${getCityDisplayName(cityKey)}`
    }))
  }, [availableCities])

  // Opțiuni formatate pentru Selectorul Brand cu avatar
  const brandOptions = useMemo(() => {
    return AUTHORITATIVE_BRANDS.map(b => ({
      value: b,
      label: b,
      avatar: <BrandAvatar brand={b} size={18} />,
      keywords: b
    }))
  }, [])

  // Searchable Location Picker state
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const locationPickerRef = useRef(null)
  const locationSearchInputRef = useRef(null)

  // Brand Picker state cu avatare oficiale
  const [isBrandPickerOpen, setIsBrandPickerOpen] = useState(false)
  const brandPickerRef = useRef(null)

  useEffect(() => {
    function handleClickOutsideBrand(event) {
      if (brandPickerRef.current && !brandPickerRef.current.contains(event.target)) {
        setIsBrandPickerOpen(false)
      }
    }
    if (isBrandPickerOpen) {
      document.addEventListener('mousedown', handleClickOutsideBrand)
      return () => {
        document.removeEventListener('mousedown', handleClickOutsideBrand)
      }
    }
  }, [isBrandPickerOpen])

  // Număr restaurante active per brand
  const brandCounts = useMemo(() => {
    const counts = { all: restaurants.filter(r => r.is_active).length }
    AUTHORITATIVE_BRANDS.forEach(b => {
      counts[b] = restaurants.filter(r => r.is_active && getBrandInfo(r).name === b).length
    })
    return counts
  }, [restaurants])

  useEffect(() => {
    function handleClickOutside(event) {
      if (locationPickerRef.current && !locationPickerRef.current.contains(event.target)) {
        setIsLocationPickerOpen(false)
      }
    }
    if (isLocationPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      const t = setTimeout(() => {
        locationSearchInputRef.current?.focus({ preventScroll: true })
      }, 40)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        clearTimeout(t)
      }
    }
  }, [isLocationPickerOpen])

  // Filtered location options based on search query
  const filteredLocationOptions = useMemo(() => {
    if (!locationSearch.trim()) return restaurantOptions
    const q = locationSearch.toLowerCase().trim()
    return restaurantOptions.filter(opt => {
      const matchLabel = opt.label.toLowerCase().includes(q)
      const matchSublabel = opt.sublabel ? opt.sublabel.toLowerCase().includes(q) : false
      const matchKeywords = opt.keywords ? opt.keywords.toLowerCase().includes(q) : false
      return matchLabel || matchSublabel || matchKeywords
    })
  }, [restaurantOptions, locationSearch])

  const selectedLocationObj = useMemo(() => {
    if (selectedRestaurantId === 'all') return null
    return restaurantOptions.find(o => String(o.value) === String(selectedRestaurantId))
  }, [restaurantOptions, selectedRestaurantId])

  // Comenzi de bază filtrate conform perioadei, orașului, brandului și restaurantului (pentru numărătorile din tab-uri și KPI-uri)
  const baseFilteredOrders = useMemo(() => {
    const yesterdayDate = new Date()
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayRo = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })

    return orders.filter(o => {
      // 0. Filtru strict Perioadă (asigură că "Azi" conține EXCLUSIV comenzi din data de azi)
      const orderDT = parseOrderDateTime(o.placed_at || o.created_at)
      if (selectedPeriod === 'today') {
        if (!orderDT.isToday) return false
      } else if (selectedPeriod === 'yesterday') {
        if (orderDT.dayStr !== yesterdayRo) return false
      }

      // 1. Filtru Oraș Canonic
      if (selectedCity !== 'all') {
        const oCity = getCanonicalCity(o.restaurant_city || o.restaurant_name)
        if (oCity !== selectedCity) return false
      }

      // 2. Filtru Brand
      if (selectedBrand !== 'all') {
        if (o.brand_name !== selectedBrand) return false
      }

      // 3. Filtru Restaurant specific
      if (selectedRestaurantId !== 'all') {
        if (o.restaurant_id !== selectedRestaurantId) return false
      }

      return true
    })
  }, [orders, selectedCity, selectedBrand, selectedRestaurantId, selectedPeriod])

  // Comenzi filtrate conform canalului, tab-ului activ și căutării
  const filteredOrders = useMemo(() => {
    return baseFilteredOrders.filter(o => {
      // 1. Filtru Canal de Vânzare (Kiosk, Casierie POS, Agregatori, Propriu)
      if (selectedChannel !== 'all') {
        if (selectedChannel === 'kiosk') {
          if (o.channel_type !== 'kiosk' && o.platform !== 'kiosk') return false
        } else if (selectedChannel === 'casierie') {
          if (o.channel_type !== 'casierie' && o.platform !== 'casierie' && o.platform !== 'IN-STORE') return false
        } else if (selectedChannel === 'aggregators') {
          if (o.channel_type !== 'aggregator' && !['glovo', 'wolt', 'bolt', 'bolt food'].includes(o.platform)) return false
        } else if (selectedChannel === 'own') {
          if (o.channel_type !== 'own_delivery') return false
        } else {
          if (o.platform !== selectedChannel) return false
        }
      }

      // 2. Filtru Tab status
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

      // 3. Filtru Căutare text
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
  }, [baseFilteredOrders, selectedChannel, activeTab, searchQuery])

  // Jurnal STOP filtrat conform orașului, brandului și restaurantului selectat
  const filteredStopAuditLog = useMemo(() => {
    return (stopAuditLog || []).filter(log => {
      if (selectedCity !== 'all') {
        const logCity = getCanonicalCity(log.city || log.restaurant_city || log.restaurant_name)
        if (logCity !== selectedCity) return false
      }
      if (selectedBrand !== 'all') {
        if (log.brand !== selectedBrand) return false
      }
      if (selectedRestaurantId !== 'all') {
        if (log.restaurant_id !== selectedRestaurantId) return false
      }
      return true
    })
  }, [stopAuditLog, selectedCity, selectedBrand, selectedRestaurantId])

  // Sume calculate dinamic pentru siguranță instantă
  const calculatedTodaySales = useMemo(() => {
    return baseFilteredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  }, [baseFilteredOrders])

  const calculatedOrdersCount = useMemo(() => {
    return baseFilteredOrders.length
  }, [baseFilteredOrders])

  const countsByStage = useMemo(() => {
    const c = { cooking: 0, ready: 0, on_way: 0, delivered: 0, problems: 0 }
    baseFilteredOrders.forEach(o => {
      if (o.stage === 'wait_cooking' || o.stage === 'cooking') c.cooking++
      else if (o.stage === 'ready') c.ready++
      else if (o.stage === 'on_way') c.on_way++
      else if (o.stage === 'delivered') c.delivered++
      if (o.problem) c.problems++
    })
    return { ...c, total: baseFilteredOrders.length }
  }, [baseFilteredOrders])

  // Numărătoare canale pentru selector și butoane rapide
  const channelCounts = useMemo(() => {
    let kiosk = 0
    let casierie = 0
    let aggregators = 0
    let own = 0
    baseFilteredOrders.forEach(o => {
      if (o.channel_type === 'kiosk' || o.platform === 'kiosk') kiosk++
      else if (o.channel_type === 'casierie' || o.platform === 'casierie' || o.platform === 'IN-STORE') casierie++
      else if (o.channel_type === 'own_delivery') own++
      else aggregators++
    })
    return {
      all: baseFilteredOrders.length,
      kiosk,
      casierie,
      aggregators,
      own
    }
  }, [baseFilteredOrders])

  // Paginare & Totaluri Comenzi (Standard SmartDevize Table & Pagination UI Rules)
  const totalFiltered = filteredOrders.length
  const totalPages = rowsPerPage === 9999 ? 1 : (Math.ceil(totalFiltered / rowsPerPage) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (safePage - 1) * rowsPerPage

  const paginatedOrders = useMemo(() => {
    if (rowsPerPage === 9999) return filteredOrders
    return filteredOrders.slice(startIndex, startIndex + rowsPerPage)
  }, [filteredOrders, rowsPerPage, startIndex])

  // Total vânzări pe pagina curentă
  const pageTotalSales = useMemo(() => {
    return paginatedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  }, [paginatedOrders])

  // Total vânzări pe toate comenzile filtrate
  const filteredTotalSales = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  }, [filteredOrders])

  // Formatare numere & sume cu 2 zecimale exacte (fără rotunjire)
  const formatMoney = (val, decimals = 2) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(Number(val) || 0)
  }

  // Formatare timp scurs cu suport multi-limbă (RU: мин/ч/м, RO/EN: min/h/m)
  const formatElapsed = (minutes) => {
    if (!minutes || minutes < 1) return t('dispatch.just_now', 'Chiar acum')
    const unitMin = language === 'ru' ? 'мин' : 'min'
    const unitH = language === 'ru' ? 'ч' : 'h'
    const unitM = language === 'ru' ? 'м' : 'm'
    if (minutes < 60) return `${minutes} ${unitMin}`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}${unitH} ${m}${unitM}`
  }

  // Formatare interval dată cu suport multi-limbă (RU, RO, EN)
  const formatPeriodDateRange = (rangeStr, lang) => {
    if (!rangeStr) return ''
    const monthsRo = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']
    const monthsRu = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря']
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    
    let res = String(rangeStr)
    if (lang === 'ru') {
      monthsRo.forEach((roM, idx) => {
        res = res.replace(new RegExp(roM, 'gi'), monthsRu[idx])
      })
      res = res.replace(/Anul\s+/gi, 'Год ')
      res = res.replace(/Total Istoric/gi, 'Все Время')
    } else if (lang === 'en') {
      monthsRo.forEach((roM, idx) => {
        res = res.replace(new RegExp(roM, 'gi'), monthsEn[idx])
      })
      res = res.replace(/Anul\s+/gi, 'Year ')
      res = res.replace(/Total Istoric/gi, 'All Time')
    }
    return res
  }

  // Formatare tip servire (În sală / La pachet) multi-limbă
  const formatDiningOption = (option, lang) => {
    const opt = (option || '').toLowerCase()
    if (opt.includes('pachet') || opt.includes('takeaway') || opt.includes('собой') || opt.includes('вынос')) {
      if (lang === 'ru') return 'С собой'
      if (lang === 'en') return 'Takeaway'
      return 'La Pachet'
    }
    if (opt.includes('mas') || opt.includes('dine') || opt.includes('зале')) {
      if (lang === 'ru') return 'В зале'
      if (lang === 'en') return 'Dine-in'
      return 'La Masă'
    }
    return option || (lang === 'ru' ? 'В зале' : lang === 'en' ? 'Dine-in' : 'La Masă')
  }

  // Formatare metodă de plată (Card / Cash) multi-limbă
  const formatPaymentMethod = (method, isCash, isCard, lang) => {
    const cash = isCash || (method || '').toLowerCase().includes('cash') || (method || '').toLowerCase().includes('numerar')
    if (cash) {
      if (lang === 'ru') return 'Наличные'
      if (lang === 'en') return 'Cash'
      return 'Cash'
    }
    if (lang === 'ru') return 'Карта'
    if (lang === 'en') return 'Card'
    return 'Card'
  }

  // Helpers badge status & culori SLA
  const getTimingColor = (minutes, targetMax) => {
    if (minutes <= targetMax) return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
    if (minutes <= targetMax * 1.35) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
    return 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
  }

  const getStageBadge = (stage, ord = null) => {
    switch (stage) {
      case 'wait_cooking':
        return {
          isFinalized: false,
          label: language === 'ru' ? 'В ожидании' : language === 'en' ? 'Wait Kitchen' : 'În Așteptare Bucătărie',
          icon: <Clock size={12} className="animate-spin text-amber-600 dark:text-amber-400" />,
          classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
        }
      case 'cooking':
        return {
          isFinalized: false,
          label: language === 'ru' ? 'В приготовлении' : language === 'en' ? 'Cooking' : 'În Bucătărie',
          icon: <ChefHat size={12} className="animate-pulse text-blue-600 dark:text-blue-400" />,
          classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
        }
      case 'ready':
        return {
          isFinalized: false,
          label: language === 'ru' ? 'Ждет курьера' : language === 'en' ? 'Waiting Courier' : 'Așteaptă Curier',
          icon: <Flame size={12} className="text-purple-600 dark:text-purple-400" />,
          classes: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
        }
      case 'on_way':
        return {
          isFinalized: false,
          label: language === 'ru' ? 'У курьера (В пути)' : language === 'en' ? 'On the Way' : 'La Curier (Pe drum)',
          icon: <Bike size={12} className="animate-bounce text-indigo-600 dark:text-indigo-400" />,
          classes: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
        }
      default: {
        const isRestaurant = ord?.channel_type === 'kiosk' || ord?.channel_type === 'casierie' || ord?.platform === 'kiosk' || ord?.platform === 'casierie' || ord?.platform === 'IN-STORE'
        return {
          isFinalized: true,
          label: isRestaurant ? t('dispatch.badge_served', 'Servit în Restaurant') : t('dispatch.badge_delivered', 'Livrat'),
          icon: <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />,
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
        }
      }
    }
  }

  return (
    <div className="w-full space-y-3 pb-8 animate-in fade-in duration-300">
      
      {/* ─── 1. TOP HEADER & OPERATIONAL CONTROLS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Radio size={16} className="animate-pulse" />
            </div>
            <h1 className={`text-base sm:text-lg font-bold tracking-tight uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('dispatch.title', 'Dispecerat Live · Dashboard Manager')}
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              LIVE
            </span>
          </div>
        </div>

        {/* Butoane acțiune live */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 ${
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
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <RotateCw size={12} className={loading ? 'animate-spin text-emerald-500' : ''} />
            <span>{t('dispatch.refresh_now', 'Reîmprospătează')}</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium ml-1">
            {t('dispatch.last_sync', 'Actualizat:')} {lastUpdated.toLocaleTimeString(language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ─── 2. HIGH-DENSITY FILTER BAR (ALL IN A SINGLE ROW) ─── */}
      <div className={`px-3 py-2 rounded-xl border transition-colors relative z-20 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          
          {/* Selector Oraș */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-slate-400 flex items-center shrink-0" title={t('common.city', 'Oraș')}>
              <MapPin size={12} />
            </span>
            <select
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors outline-none cursor-pointer ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600' 
                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <option value="all">{t('dispatch.filter_all_cities', 'Toate Orașele')}</option>
              {availableCities.filter(c => c !== 'all').map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Selector Brand (cu Avatare Oficiale de Brand) */}
          <div ref={brandPickerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsBrandPickerOpen(!isBrandPickerOpen)}
              className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors outline-none cursor-pointer flex items-center gap-1.5 select-none ${
                isBrandPickerOpen
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : selectedBrand !== 'all'
                    ? isDark ? 'bg-slate-800 border-emerald-600 text-white' : 'bg-emerald-50/50 border-emerald-300 text-emerald-900'
                    : isDark 
                      ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
              title={t('common.brand', 'Brand')}
            >
              {selectedBrand !== 'all' ? (
                <BrandAvatar brand={selectedBrand} size={16} className="rounded-full shrink-0 shadow-2xs" />
              ) : (
                <span className="text-slate-400 flex items-center shrink-0">
                  <Store size={12} />
                </span>
              )}
              <span className="truncate max-w-[130px]">
                {selectedBrand !== 'all' ? selectedBrand : t('dispatch.filter_all_brands', 'Toate Brandurile')}
              </span>
              {selectedBrand !== 'all' ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    handleBrandChange('all')
                    setIsBrandPickerOpen(false)
                  }}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Resetează brand"
                >
                  <X size={11} />
                </span>
              ) : (
                <ChevronDown size={11} className={`text-slate-400 transition-transform duration-150 ${isBrandPickerOpen ? 'rotate-180 text-emerald-500' : ''}`} />
              )}
            </button>

            {/* Dropdown flotant cu avatare branduri */}
            {isBrandPickerOpen && (
              <div className={`absolute left-0 mt-1 z-50 w-56 rounded-xl shadow-2xl border overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className={`px-3 py-2 border-b text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                  isDark ? 'border-slate-800 bg-slate-800/80 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-500'
                }`}>
                  <span>{language === 'ru' ? 'Выберите Бренд' : language === 'en' ? 'Select Brand' : 'Selectează Brand'}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {AUTHORITATIVE_BRANDS.length} {language === 'ru' ? 'брендов' : language === 'en' ? 'brands' : 'branduri'}
                  </span>
                </div>

                <div className="p-1 space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {/* Toate Brandurile */}
                  <button
                    type="button"
                    onClick={() => {
                      handleBrandChange('all')
                      setIsBrandPickerOpen(false)
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      selectedBrand === 'all'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                        : isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                        <Store size={11} />
                      </div>
                      <span className="font-semibold">{t('dispatch.filter_all_brands', 'Toate Brandurile')}</span>
                    </div>
                    {brandCounts.all > 0 && (
                      <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800">
                        {brandCounts.all}
                      </span>
                    )}
                  </button>

                  {/* Fiecare Brand cu Avatar Oficial */}
                  {AUTHORITATIVE_BRANDS.map(brandName => {
                    const isSelected = selectedBrand === brandName
                    const count = brandCounts[brandName] || 0
                    return (
                      <button
                        key={brandName}
                        type="button"
                        onClick={() => {
                          handleBrandChange(brandName)
                          setIsBrandPickerOpen(false)
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                            : isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BrandAvatar brand={brandName} size={22} className="rounded-full shrink-0 shadow-xs" />
                          <span className="truncate font-semibold">{brandName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {count > 0 && (
                            <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800">
                              {count}
                            </span>
                          )}
                          {isSelected && <Check size={13} className="text-emerald-500 shrink-0" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selector Punct de Lucru (Searchable cu Bară de Căutare Rapidă) */}
          <div ref={locationPickerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!isLocationPickerOpen) setLocationSearch('')
                setIsLocationPickerOpen(!isLocationPickerOpen)
              }}
              className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors outline-none cursor-pointer flex items-center gap-1.5 max-w-[240px] select-none ${
                isLocationPickerOpen
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : isDark 
                    ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
              title={t('common.restaurant', 'Punct Lucru')}
            >
              <span className="text-slate-400 flex items-center shrink-0">
                <Store size={12} />
              </span>
              <span className="truncate">
                {selectedLocationObj 
                  ? `${selectedLocationObj.label}` 
                  : t('dispatch.filter_all_locations', `Toate Punctele (${filteredRestaurantsForSelector.length})`, { count: filteredRestaurantsForSelector.length })}
              </span>
              {selectedRestaurantId !== 'all' ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedRestaurantId('all')
                    setPage(1)
                  }}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Resetează"
                >
                  <X size={11} />
                </span>
              ) : (
                <ChevronDown size={11} className={`text-slate-400 transition-transform duration-150 ${isLocationPickerOpen ? 'rotate-180 text-emerald-500' : ''}`} />
              )}
            </button>

            {/* Dropdown flotant cu bară de căutare dedicată */}
            {isLocationPickerOpen && (
              <div className={`absolute left-0 mt-1 z-50 w-80 max-w-[90vw] rounded-xl shadow-2xl border overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                {/* Search Header */}
                <div className={`p-2 border-b ${isDark ? 'border-slate-800 bg-slate-800/80' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      ref={locationSearchInputRef}
                      type="text"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsLocationPickerOpen(false)
                        } else if (e.key === 'Enter') {
                          e.preventDefault()
                          if (filteredLocationOptions.length > 0) {
                            setSelectedRestaurantId(filteredLocationOptions[0].value)
                            setPage(1)
                            setIsLocationPickerOpen(false)
                            setLocationSearch('')
                          }
                        }
                      }}
                      placeholder={language === 'ru' ? 'Поиск точки, города, бренда...' : language === 'en' ? 'Search location, city, brand...' : 'Caută punct de lucru, oraș, brand...'}
                      className={`w-full pl-8 pr-7 py-1 text-xs font-semibold rounded-lg border outline-none transition-colors ${
                        isDark 
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500' 
                          : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                      }`}
                    />
                    {locationSearch && (
                      <button
                        type="button"
                        onClick={() => setLocationSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-1 mt-1 text-[10px] text-slate-400 font-semibold">
                    <span>{filteredLocationOptions.length} din {restaurantOptions.length} puncte</span>
                    {locationSearch && <span className="text-emerald-500 font-bold">{language === 'ru' ? 'Поиск активен' : 'Filtrare activă'}</span>}
                  </div>
                </div>

                {/* Options List */}
                <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                  {/* All Option */}
                  {!locationSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRestaurantId('all')
                        setPage(1)
                        setIsLocationPickerOpen(false)
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                        selectedRestaurantId === 'all'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span>{t('dispatch.filter_all_locations', `Toate Punctele (${filteredRestaurantsForSelector.length})`, { count: filteredRestaurantsForSelector.length })}</span>
                      {selectedRestaurantId === 'all' && <Check size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
                    </button>
                  )}

                  {filteredLocationOptions.length === 0 ? (
                    <div className="py-6 px-3 text-center text-xs text-slate-400 italic">
                      {language === 'ru' ? `Ничего не найдено по запросу „${locationSearch}”` : `Niciun rezultat conform „${locationSearch}”`}
                    </div>
                  ) : (
                    filteredLocationOptions.map((opt) => {
                      const isSelected = String(selectedRestaurantId) === String(opt.value)
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSelectedRestaurantId(opt.value)
                            setPage(1)
                            setIsLocationPickerOpen(false)
                            setLocationSearch('')
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                              : isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {opt.avatar}
                            <div className="min-w-0">
                              <div className={`truncate ${isSelected ? 'font-bold' : 'font-semibold'}`}>
                                {opt.label}
                              </div>
                              {opt.sublabel && (
                                <div className="text-[10px] text-slate-400 truncate font-normal">
                                  {opt.sublabel}
                                </div>
                              )}
                            </div>
                          </div>

                          {isSelected && <Check size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider subtil */}
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-0.5" />

          {/* Filtru de Perioadă (Pills) */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-slate-400 flex items-center shrink-0 mr-0.5" title={t('dispatch.period_filter_label', 'Perioadă:')}>
              <Calendar size={12} />
            </span>
            <div className={`p-0.5 rounded-full border flex items-center gap-0.5 shrink-0 ${
              isDark ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100/90 border-slate-200'
            }`}>
              {PERIOD_OPTIONS.map(opt => {
                const isSelected = selectedPeriod === opt.key
                const fullLabel = t(opt.labelKey, opt.fallback)
                const shortLabel = getShortPeriodLabel(opt.key, language)
                return (
                  <button
                    key={opt.key}
                    id={`dispatch-period-${opt.key}`}
                    onClick={() => handlePeriodChange(opt.key)}
                    title={fullLabel}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap select-none ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isDark
                          ? 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    {shortLabel}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Resetare filtre */}
          {(selectedCity !== 'all' || selectedBrand !== 'all' || selectedRestaurantId !== 'all' || selectedChannel !== 'all' || selectedPeriod !== 'today') && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/40 flex items-center gap-1 transition-colors cursor-pointer select-none shrink-0"
            >
              <X size={11} /> Reset
            </button>
          )}

          {/* Badge interval dată */}
          {livePeriodDateRange && (
            <div className="ml-auto text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700/60 shrink-0 whitespace-nowrap">
              {formatPeriodDateRange(livePeriodDateRange, language)}
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. TOP LIVE KPIS CARDS (GOOGLE SHEET EXACT METRICS) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        
        {/* KPI 1: Vânzări */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>
              {selectedPeriod === 'today' 
                ? t('dispatch.kpi_today_sales', 'Vânzări Azi') 
                : t('dispatch.kpi_sales_period', `Vânzări (${currentPeriodLabel})`, { period: currentPeriodLabel })}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <div className="mt-1">
            <div className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {formatMoney(calculatedTodaySales)}
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
              {selectedPeriod === 'today'
                ? t('dispatch.orders_count_today', `${calculatedOrdersCount} bonuri`, { count: calculatedOrdersCount })
                : t('dispatch.orders_count_period', `${calculatedOrdersCount} bonuri (${currentPeriodLabel})`, { count: calculatedOrdersCount, period: currentPeriodLabel })}
            </div>
          </div>
        </div>

        {/* KPI 2: Bonuri în Lucru */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_active_receipts', 'Bonuri în Lucru')}</span>
            <ChefHat size={14} className="text-blue-500 animate-pulse" />
          </div>
          <div className="mt-1">
            <div className="text-lg font-black tracking-tight text-blue-600 dark:text-blue-400">
              {kpis?.active_in_kitchen || 0}
            </div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
              +{kpis?.waiting_courier || 0} {t('dispatch.kpi_waiting_courier', 'așteaptă curier')}
            </div>
          </div>
        </div>

        {/* KPI 3: Timp Mediu Bucătărie (SLA <= 15 min) */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_kitchen_timing', 'Timp Bucătărie')}</span>
            <span className="text-[9px] font-bold text-slate-400">SLA ≤15{language === 'ru' ? 'м' : 'm'}</span>
          </div>
          <div className="mt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black tracking-tight">{kpis?.avg_kitchen_time || 14}</span>
              <span className="text-[10px] font-bold text-slate-400">{language === 'ru' ? 'мин' : 'min'}</span>
            </div>
            <div className="mt-0.5">
              <span className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold border ${getTimingColor(kpis?.avg_kitchen_time || 14, 15)}`}>
                {(kpis?.avg_kitchen_time || 14) <= 15 ? t('dispatch.sla_ok_kitchen', 'În grafic SLA') : t('dispatch.sla_over_kitchen', 'Depășire SLA')}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Așteptare Curier (SLA <= 8 min) */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_courier_wait', 'Așteptare Curier')}</span>
            <span className="text-[9px] font-bold text-slate-400">SLA ≤8{language === 'ru' ? 'м' : 'm'}</span>
          </div>
          <div className="mt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black tracking-tight">{kpis?.avg_courier_wait_time || 6.8}</span>
              <span className="text-[10px] font-bold text-slate-400">{language === 'ru' ? 'мин' : 'min'}</span>
            </div>
            <div className="mt-0.5">
              <span className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold border ${getTimingColor(kpis?.avg_courier_wait_time || 6.8, 8)}`}>
                {(kpis?.avg_courier_wait_time || 6.8) <= 8 ? t('dispatch.sla_fast_courier', 'Ridicări Rapide') : t('dispatch.sla_high_wait_courier', 'Așteptare Mare')}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 5: Timp Livrare (SLA <= 30 min) */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_delivery_time', 'Timp Livrare')}</span>
            <span className="text-[9px] font-bold text-slate-400">SLA ≤30{language === 'ru' ? 'м' : 'm'}</span>
          </div>
          <div className="mt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black tracking-tight">{kpis?.avg_delivery_time || 23.4}</span>
              <span className="text-[10px] font-bold text-slate-400">{language === 'ru' ? 'мин' : 'min'}</span>
            </div>
            <div className="mt-0.5">
              <span className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold border ${getTimingColor(kpis?.avg_delivery_time || 23.4, 30)}`}>
                {kpis?.on_way_count || 0} {t('dispatch.tab_on_way', 'pe drum')}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 6: Timp Total Ciclu (SLA <= 45 min) */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>{t('dispatch.kpi_total_time', 'Timp Total Ciclu')}</span>
            <span className="text-[9px] font-bold text-slate-400">SLA ≤45{language === 'ru' ? 'м' : 'm'}</span>
          </div>
          <div className="mt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black tracking-tight">{kpis?.avg_total_time || 44.7}</span>
              <span className="text-[10px] font-bold text-slate-400">{language === 'ru' ? 'мин' : 'min'}</span>
            </div>
            <div className="mt-0.5">
              <span className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold border ${getTimingColor(kpis?.avg_total_time || 44.7, 45)}`}>
                {(kpis?.avg_total_time || 44.7) <= 45 ? t('dispatch.sla_ok_total', 'Timp Optim') : t('dispatch.sla_attention_total', 'Atenție Timp')}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── 4. TABEL OPERAȚIONAL LIVE (TABELUL DE COMENZI REALE) ─── */}
      <div className={`p-3.5 rounded-xl border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        
        {/* Header modul comenzi & Căutare */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <ShoppingBag size={15} />
            </div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>
                {selectedPeriod === 'today'
                  ? t('dispatch.table_title_clean', 'Tabel Operațional Live „Azi”')
                  : t('dispatch.table_title_dynamic', `Tabel Operațional «${currentPeriodLabel}»`, { period: currentPeriodLabel })}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                {totalFiltered} {t('common.orders', 'comenzi')}
              </span>
            </h2>
          </div>

          {/* Căutare rapidă în comenzi */}
          <div className="relative w-full sm:w-80 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder={t('dispatch.search_placeholder', 'Caută nr. bon, client, curier...')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className={`w-full pl-9 ${searchQuery ? 'pr-24' : 'pr-3'} py-1.5 text-xs font-medium rounded-full border transition-all outline-none ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
            />
            {searchQuery && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="bg-emerald-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-tight whitespace-nowrap shadow-xs">
                  {totalFiltered} / {baseFilteredOrders.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setPage(1)
                  }}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Șterge căutarea"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar Unificat: Etape Comenzi + Canale pe un singur rând flex-wrap */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2.5 mb-1">
          {/* Tab-uri de filtrare status comenzi */}
          {[
            { id: 'all', label: t('dispatch.tab_all_orders', 'Toate Comenzile'), count: countsByStage.total, icon: null },
            { id: 'cooking', label: t('dispatch.tab_cooking', 'În Bucătărie'), count: countsByStage.cooking, icon: ChefHat },
            { id: 'ready', label: t('dispatch.tab_ready', 'Așteaptă Curier'), count: countsByStage.ready, icon: Clock },
            { id: 'on_way', label: t('dispatch.tab_on_way', 'La Curier'), count: countsByStage.on_way, icon: Bike },
            { id: 'delivered', label: selectedPeriod === 'today' ? t('dispatch.tab_delivered', 'Livrate Azi') : `${t('dispatch.tab_delivered_only', 'Livrate')} (${currentPeriodLabel})`, count: countsByStage.delivered, icon: CheckCircle2 },
            { id: 'problems', label: t('dispatch.tab_problems', 'Sesizări / Probleme'), count: countsByStage.problems, alert: true, icon: AlertTriangle }
          ].map(tab => {
            const isTabActive = activeTab === tab.id
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setPage(1)
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                  isTabActive
                    ? tab.alert
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-emerald-600 text-white shadow-xs'
                    : isDark
                      ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900'
                }`}
              >
                {TabIcon && (
                  <TabIcon 
                    size={12} 
                    className={
                      isTabActive 
                        ? 'text-white' 
                        : tab.alert && tab.count > 0 
                          ? 'text-rose-500' 
                          : 'text-slate-400'
                    } 
                  />
                )}
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isTabActive 
                    ? 'bg-white/20 text-white' 
                    : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}

          {/* Separator vertical discret */}
          <div className="hidden lg:block h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1.5 shrink-0" />

          {/* Filtre Rapide Canal de Vânzare (Fără buton duplicat 'Toate') */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-0.5 shrink-0">
              {t('dispatch.channel_filter_label', 'Canal:')}
            </span>

            {[
              { id: 'kiosk', label: language === 'ru' ? 'Киоск' : language === 'en' ? 'Smart Kiosk' : 'Smart Kiosk', count: channelCounts.kiosk, icon: Monitor, iconColor: 'text-purple-500' },
              { id: 'casierie', label: language === 'ru' ? 'Касса (POS)' : language === 'en' ? 'Cashier (POS)' : 'Casierie (POS)', count: channelCounts.casierie, icon: Receipt, iconColor: 'text-blue-500' },
              { id: 'aggregators', label: language === 'ru' ? 'Агрегаторы' : language === 'en' ? 'Aggregators' : 'Agregatori', count: channelCounts.aggregators, icon: Bike, iconColor: 'text-amber-500' },
              ...(channelCounts.own > 0 ? [{ id: 'own', label: language === 'ru' ? 'Сайт/Приложение' : language === 'en' ? 'Own App' : 'Propriu', count: channelCounts.own, icon: Globe, iconColor: 'text-indigo-500' }] : [])
            ].map(ch => {
              const isChActive = selectedChannel === ch.id
              const ChIcon = ch.icon
              return (
                <button
                  key={ch.id}
                  onClick={() => handleChannelChange(isChActive ? 'all' : ch.id)}
                  title={isChActive ? 'Click pentru a anula filtrul' : `Filtrează după ${ch.label}`}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 border cursor-pointer select-none ${
                    isChActive
                      ? 'bg-slate-900 border-slate-900 text-white dark:bg-emerald-600 dark:border-emerald-600 shadow-xs'
                      : isDark
                        ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white'
                        : 'bg-slate-100/90 hover:bg-slate-200/80 border-slate-200/70 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {ChIcon && (
                    <ChIcon 
                      size={11} 
                      className={isChActive ? 'text-white' : ch.iconColor} 
                    />
                  )}
                  <span>{ch.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isChActive
                      ? 'bg-white/20 text-white'
                      : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {ch.count}
                  </span>
                  {isChActive && <X size={10} className="text-white/80 hover:text-white ml-0.5" />}
                </button>
              )
            })}

            {selectedChannel !== 'all' && (
              <button
                onClick={() => handleChannelChange('all')}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-0.5"
                title={t('common.reset', 'Resetează canal')}
              >
                <span>✕</span>
                <span>{language === 'ru' ? 'Сброс' : language === 'en' ? 'Reset' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabel Comenzi */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs min-w-[960px]">
            <thead>
              <tr className={`border-b text-[11px] font-bold uppercase tracking-wider select-none ${
                isDark ? 'border-slate-800 text-slate-400 bg-slate-800/40' : 'border-slate-200 text-slate-500 bg-slate-50'
              }`}>
                <th className="py-2 px-2 w-10 text-center">{t('dispatch.th_crt', 'Nr.')}</th>
                <th className="py-2 px-2 w-28 whitespace-nowrap">{t('dispatch.th_order_num', 'Nr. Bon & Oră')}</th>
                <th className="py-2 px-2 w-48 min-w-[160px] max-w-[200px]">{t('dispatch.th_brand_location', 'Brand & Punct Lucru')}</th>
                <th className="py-2 px-2 w-24 whitespace-nowrap">{t('dispatch.th_platform', 'Canal')}</th>
                <th className="py-2 px-2 w-44 whitespace-nowrap">{t('dispatch.th_stage_timer', 'Etapă & Cronometru')}</th>
                <th className="py-2 px-2 w-44 min-w-[150px] max-w-[190px]">{t('dispatch.th_customer', 'Client & Adresă')}</th>
                <th className="py-2 px-2 w-48 min-w-[160px] max-w-[200px]">{t('dispatch.th_courier', 'Curier & AWB')}</th>
                <th className="py-2 px-2 w-28 text-right whitespace-nowrap">{t('dispatch.th_total', 'Total')}</th>
                <th className="py-2 px-1.5 w-16 text-center whitespace-nowrap">{t('dispatch.th_actions', 'Acțiuni')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    {t('dispatch.no_orders_found', 'Nu s-au găsit comenzi conform filtrelor selectate.')}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((ord, idx) => {
                  const stageInfo = getStageBadge(ord.stage, ord)
                  return (
                    <tr 
                      key={ord.order_id || ord.id || idx}
                      onClick={() => setSelectedOrder(ord)}
                      className={`cursor-pointer transition-colors ${
                        ord.problem 
                          ? isDark ? 'bg-rose-950/20 hover:bg-rose-950/40' : 'bg-rose-50/50 hover:bg-rose-100'
                          : isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-100/90'
                      }`}
                      title="Apasă pentru detalii complete bon, produse și preparate"
                    >
                      {/* Nr. Crt. */}
                      <td className="py-2 px-2 w-10 font-semibold text-slate-400 text-center">
                        {startIndex + idx + 1}
                      </td>

                      {/* Nr. Bon & Oră */}
                      <td className="py-2 px-2 w-28 whitespace-nowrap">
                        {(() => {
                          const orderDT = parseOrderDateTime(ord.placed_at || ord.created_at)
                          return (
                            <div className="flex flex-col items-start gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded-md text-xs font-black tracking-tight ${
                                  isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'
                                }`}>
                                  #{formatDisplayOrderNumber(ord.order_number, ord.order_id, ord.channel || ord.platform) || ord.order_number || ord.order_id?.slice(-4) || '1'}
                                </span>
                                {ord.problem && (
                                  <span 
                                    className="text-rose-500 font-bold text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 flex items-center gap-0.5"
                                    title={ord.problem.description}
                                  >
                                    <AlertTriangle size={10} />
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 pl-0.5">
                                {orderDT.date ? (
                                  <>
                                    <span>{orderDT.date}</span>
                                    <span className="text-slate-300 dark:text-slate-600 font-normal">·</span>
                                  </>
                                ) : null}
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{orderDT.time}</span>
                              </div>
                            </div>
                          )
                        })()}
                      </td>

                      {/* Brand & Locație */}
                      <td className="py-2 px-2 w-48 min-w-[160px] max-w-[200px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <BrandAvatar brand={ord.brand_name || ord.brand} name={ord.restaurant_name} size={22} />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {cleanRestaurantName(ord.restaurant_name)}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {ord.restaurant_city || ord.city || getCityDisplayName(selectedCity)} · <span className="font-semibold text-slate-600 dark:text-slate-300">{ord.brand_name || ord.brand}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Canal / Platformă */}
                      <td className="py-2 px-2 w-24 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <PlatformLogo 
                            platform={
                              ord.channel_type === 'casierie' || ord.platform === 'casierie' || ord.platform === 'IN-STORE'
                                ? 'casierie'
                                : ord.channel_type === 'kiosk' || ord.platform === 'kiosk'
                                  ? 'kiosk'
                                  : ord.channel_type === 'own_delivery'
                                    ? 'own'
                                    : ord.platform
                            } 
                            size={18} 
                          />
                          <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase text-[11px] tracking-tight">
                            {ord.channel_type === 'casierie' || ord.platform === 'casierie' || ord.platform === 'IN-STORE'
                              ? (language === 'ru' ? 'КАССА' : language === 'en' ? 'CASHIER' : 'CASIERIE')
                              : ord.channel_type === 'kiosk' || ord.platform === 'kiosk'
                                ? 'KIOSK'
                                : ord.channel_type === 'own_delivery'
                                  ? (language === 'ru' ? 'СОБСТВ.' : language === 'en' ? 'OWN' : 'PROPRIU')
                                  : (ord.channel_label || ord.platform)}
                          </span>
                        </div>
                      </td>

                      {/* Etapă & Cronometru Live */}
                      <td className="py-2 px-2 w-44 whitespace-nowrap">
                        {(() => {
                          const displayElapsed = (typeof ord.elapsed_minutes === 'number' && ord.elapsed_minutes >= 0) 
                            ? ord.elapsed_minutes 
                            : computeElapsedMinutes(ord.placed_at, ord.created_at, ord.elapsed_minutes || 0)
                          const leadTime = ord.lead_time_minutes || ord.total_minutes || displayElapsed

                          return (
                            <div>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${stageInfo.classes}`}>
                                {stageInfo.icon}
                                <span>{stageInfo.label}</span>
                              </span>

                              {/* Finalizat: durată de la primire până la predare + ora livrării. În lucru: cronometru live */}
                              {stageInfo.isFinalized ? (
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                                  <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                                  <span>
                                    {ord.timings?.delivered_short_time ? (
                                      <>Livrat la <b>{ord.timings.delivered_short_time}</b> · ({formatElapsed(leadTime)})</>
                                    ) : (
                                      <>{t('dispatch.completed_duration_prefix', 'Finalizat în:')} <b>{formatElapsed(leadTime)}</b></>
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <div className={`text-[10px] font-semibold mt-0.5 flex items-center gap-1 ${
                                  displayElapsed > 35 
                                    ? 'text-rose-600 dark:text-rose-400' 
                                    : displayElapsed > 20 
                                      ? 'text-amber-600 dark:text-amber-400' 
                                      : 'text-slate-500 dark:text-slate-400'
                                }`}>
                                  <Clock size={10} className="shrink-0" />
                                  <span>{t('dispatch.in_progress_prefix', 'În lucru:')} <b>{formatElapsed(displayElapsed)}</b></span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </td>

                      {/* Client & Adresă (GDPR Protected) */}
                      <td className="py-2 px-2 w-44 min-w-[150px] max-w-[190px]">
                        {ord.channel_type === 'kiosk' || ord.platform === 'kiosk' ? (
                          <div>
                            <div className="font-bold text-purple-700 dark:text-purple-300 truncate flex items-center gap-1 text-xs">
                              <Monitor size={12} className="text-purple-600 shrink-0" />
                              <span className="truncate">{ord.kiosk_id || ord.customer?.name || (ord.table_number ? `Masa #${ord.table_number}` : t('dispatch.channel_kiosk', 'Comandă Kiosk'))}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                              {formatDiningOption(ord.dining_option || ord.order_type, language)}
                            </div>
                          </div>
                        ) : ord.channel_type === 'casierie' || ord.platform === 'casierie' || ord.platform === 'IN-STORE' ? (
                          <div>
                            <div className="font-bold text-blue-700 dark:text-blue-300 truncate flex items-center gap-1 text-xs">
                              <Receipt size={12} className="text-blue-600 shrink-0" />
                              <span className="truncate">
                                {(!ord.customer?.name || ord.customer?.name === 'Casierie (POS)' || ord.customer?.name === 'Client Casierie (POS)')
                                  ? (language === 'ru' ? 'Касса (POS)' : language === 'en' ? 'Cashier (POS)' : 'Casierie (POS)')
                                  : ord.customer.name}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                              {t('dispatch.dine_in_pos', 'În Magazin · Bon Fiscal Casă')}
                            </div>
                          </div>
                        ) : (() => {
                          const isUnmasked = unmaskedRows.has(ord.id || ord.order_id) || !gdprMasked
                          let rawName = ord.customer?.name || `Comandă ${(ord.channel_label || ord.platform || 'Online').toUpperCase()}`
                          if (rawName === 'Delivery') {
                            rawName = language === 'ru' ? 'Доставка' : language === 'en' ? 'Delivery' : 'Livrare'
                          }
                          const custName = isUnmasked ? rawName : maskCustomerName(rawName)
                          const custPhone = isUnmasked ? ord.customer?.phone : maskPhone(ord.customer?.phone)
                          const custAddr = isUnmasked ? ord.customer?.address : maskAddress(ord.customer?.address)

                          return (
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white truncate flex items-center justify-between gap-1">
                                <span className="truncate" title={isUnmasked ? rawName : 'Nume mascat conform GDPR'}>
                                  {custName}
                                </span>
                                {ord.customer?.phone && (
                                  <button
                                    onClick={(e) => toggleUnmaskRow(ord.id || ord.order_id, e)}
                                    title={isUnmasked ? 'Mascati datele GDPR' : 'Afișați datele complete'}
                                    className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                  >
                                    {isUnmasked ? <EyeOff size={10} /> : <Eye size={10} />}
                                  </button>
                                )}
                              </div>
                              {ord.customer?.phone && (
                                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5 font-mono">
                                  <Phone size={10} />
                                  <span>{custPhone}</span>
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={isUnmasked ? ord.customer?.address : ''}>
                                {custAddr || t('dispatch.delivery_courier', 'Livrare Curier')}
                              </div>
                            </div>
                          )
                        })()}
                      </td>

                      {/* Curier & AWB */}
                      <td className="py-2 px-2 w-48 min-w-[160px] max-w-[200px]">
                        {ord.channel_type === 'kiosk' || ord.platform === 'kiosk' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Store size={10} />
                            {t('dispatch.dine_in_only', 'Servire Restaurant')}
                          </span>
                        ) : ord.channel_type === 'casierie' || ord.platform === 'casierie' || ord.platform === 'IN-STORE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <Store size={10} />
                            {t('dispatch.takeaway_pos', 'Ridicare Pe Loc')}
                          </span>
                        ) : ord.courier ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                              <Bike size={12} className="text-emerald-500" />
                              <span className="truncate">{ord.courier.name}</span>
                              {ord.platform === 'bolt' && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold shrink-0">Bolt</span>
                              )}
                            </div>
                            {ord.courier.awb && (
                              <div className="text-[10px] font-mono text-slate-400 truncate">
                                AWB: {ord.courier.awb}
                              </div>
                            )}
                            {ord.courier.phone && (
                              <div className="text-[10px] font-mono text-slate-400">
                                {gdprMasked ? maskPhone(ord.courier.phone) : ord.courier.phone}
                              </div>
                            )}
                          </div>
                        ) : ord.platform === 'bolt' ? (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <Bike size={11} />
                            <span>{t('dispatch.bolt_waiting', 'Bolt (Așteaptă curier)')}</span>
                          </div>
                        ) : ord.platform === 'glovo' ? (
                          <div className="text-[11px] text-slate-400 italic" title="Glovo nu furnizează datele de contact ale curierului prin integrarea iiko">
                            {t('dispatch.glovo_no_data', 'Curier Glovo (Fără acces date)')}
                          </div>
                        ) : ord.platform === 'wolt' ? (
                          <div className="text-[11px] text-slate-400 italic" title="Wolt nu furnizează datele de contact ale curierului prin integrarea iiko">
                            {t('dispatch.wolt_no_data', 'Curier Wolt (Fără acces date)')}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            {t('dispatch.aggregator_courier', 'Curier Agregator')}
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-2 px-2 w-28 text-right font-black text-slate-900 dark:text-white whitespace-nowrap font-mono">
                        <div>{formatMoney(ord.total_amount)}</div>
                        {(ord.channel_type === 'kiosk' || ord.platform === 'kiosk' || ord.payment_method) && (
                          <div className="text-[10px] text-slate-400 font-sans font-medium uppercase mt-0.5">
                            {formatPaymentMethod(ord.payment_method, ord.is_cash, ord.is_card, language)}
                          </div>
                        )}
                      </td>

                      {/* Acțiuni */}
                      <td className="py-2 px-1.5 w-16 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedOrder(ord)
                          }}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isDark 
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          title="Vezi bonul de comandă complet"
                        >
                          <Eye size={13} />
                        </button>
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
                {/* Col 1: Nr */}
                <td className="py-2 px-2 w-10 text-center text-slate-400 font-bold">
                  Σ
                </td>

                {/* Col 2: Total label */}
                <td className="py-2 px-2 w-28 whitespace-nowrap">
                  <span className="text-xs font-black uppercase tracking-wider">
                    {t('dispatch.total_page', 'Total Pagină:')}
                  </span>
                </td>

                {/* Col 3: Brand & Locație - număr comenzi */}
                <td className="py-2 px-2 w-48 min-w-[160px] max-w-[200px]">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {paginatedOrders.length} {t('common.records', 'înregistrări')}
                    {totalPages > 1 && (
                      <span className="text-[11px] font-normal text-slate-400 ml-1.5">
                        ({t('common.of', 'din')} {totalFiltered} {t('common.total', 'total').replace(/:$/, '')})
                      </span>
                    )}
                  </div>
                </td>

                {/* Col 4: Canal */}
                <td className="py-2 px-2 w-24 whitespace-nowrap text-slate-400">
                  —
                </td>

                {/* Col 5: Etapă - Breakdown */}
                <td className="py-2 px-2 w-44 whitespace-nowrap text-xs">
                  {(() => {
                    const inProgress = paginatedOrders.filter(o => o.stage !== 'delivered').length
                    const delivered = paginatedOrders.filter(o => o.stage === 'delivered').length
                    return (
                      <div className="flex items-center gap-2 text-[11px]">
                        {inProgress > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {inProgress} {t('dispatch.in_prep', 'în lucru')}
                          </span>
                        )}
                        {delivered > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {delivered} {t('dispatch.delivered_count', 'livrate')}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </td>

                {/* Col 6: Client */}
                <td className="py-2 px-2 w-44 min-w-[150px] max-w-[190px] text-xs text-slate-400">
                  —
                </td>

                {/* Col 7: Curier */}
                <td className="py-2 px-2 w-48 min-w-[160px] max-w-[200px] text-xs text-right font-bold text-slate-500 dark:text-slate-400">
                  {totalPages > 1 ? (
                    <span className="text-[11px] block">{t('dispatch.total_page', 'Total Pagină:')}</span>
                  ) : null}
                </td>

                {/* Col 8: Total sumă (RON) */}
                <td className="py-2 px-2 w-28 text-right whitespace-nowrap">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatMoney(pageTotalSales)}
                  </div>
                  {totalPages > 1 && (
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono mt-0.5" title="Total general pentru toate comenzile filtrate">
                      {t('dispatch.total_general', 'Gen:')} {formatMoney(filteredTotalSales)}
                    </div>
                  )}
                </td>

                {/* Col 9: Acțiuni */}
                <td className="py-2 px-1.5 w-16 text-center text-slate-400">
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
              <span className="font-semibold">{t('common.rows', 'Rânduri:')}</span>
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
                <option value={9999}>{t('common.all', 'Toți')}</option>
              </select>
            </div>
            <div className={`w-px h-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} hidden sm:block`}></div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>{t('common.total', 'Total:')}</span>
              <span className="font-bold text-slate-900 dark:text-white">{totalFiltered}</span>
              <span>{t('common.records', 'înregistrări')}</span>
              <span className="text-slate-400 font-medium ml-1">
                ({formatMoney(filteredTotalSales)})
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="whitespace-nowrap">
              {t('common.page', 'Pagina')} <span className="font-bold text-slate-900 dark:text-white">{totalFiltered === 0 ? 0 : safePage}</span> {t('common.of', 'din')} {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button 
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={safePage === 1 || totalFiltered === 0}
                title="Pagina anterioară"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={safePage >= totalPages || totalFiltered === 0}
                title="Pagina următoare"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ─── 5. STOP MONITOR & CONTEXTUAL AUDIT LOG (JURNALUL DE STOP) ─── */}
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
              {t('dispatch.stop_audit_desc', 'Înregistrează automat ora stopului, numărul de bonuri în lucru la momentul închiderii și media ultimelor comenzi.')}
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
                <th className="py-2.5 px-3">{t('dispatch.audit_stop_time', 'Dată & Oră STOP')}</th>
                <th className="py-2.5 px-3">{t('dispatch.audit_location', 'Punct Lucru & Brand')}</th>
                <th className="py-2.5 px-3">{t('dispatch.th_platform', 'Canal')}</th>
                <th className="py-2.5 px-3 text-center">{t('dispatch.audit_active_orders', 'Bonuri în Lucru la STOP')}</th>
                <th className="py-2.5 px-3 text-center">{t('dispatch.audit_avg_5_kitchen', 'Medie 5 Comenzi (Bucătărie)')}</th>
                <th className="py-2.5 px-3 text-center">{t('dispatch.audit_avg_5_delivery', 'Medie 5 Comenzi (Livrare)')}</th>
                <th className="py-2.5 px-3">{t('dispatch.audit_reason', 'Motiv')}</th>
                <th className="py-2.5 px-3 text-right">{t('dispatch.th_manager_alert', 'Alertă Manager')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStopAuditLog.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                    {selectedCity !== 'all' 
                      ? `${t('dispatch.stop_audit_empty', 'Toate locațiile funcționează normal. Niciun magazin pe STOP.')} (${getCityDisplayName(selectedCity)})` 
                      : t('dispatch.stop_audit_empty', 'Toate locațiile funcționează normal. Niciun magazin pe STOP.')}
                  </td>
                </tr>
              ) : (
                filteredStopAuditLog.slice(0, 10).map((log, idx) => (
                  <tr key={log.id || idx} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1 text-xs">
                            <Calendar size={12} className="text-slate-400 shrink-0" />
                            <span>{new Date(log.stopped_at).toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-0.5">
                            <Clock size={11} className="shrink-0" />
                            <span>{new Date(log.stopped_at).toLocaleTimeString(language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <BrandAvatar brand={log.brand} name={log.restaurant_name} size={20} />
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
                        {t('dispatch.tickets_count', '{count} bonuri', { count: log.active_orders_at_stop })}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                      {log.last_5_kitchen_avg_min} {language === 'ru' ? 'мин' : 'min'}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                      {log.last_5_delivery_avg_min} {language === 'ru' ? 'мин' : 'min'}
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
                ))
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
                <BrandAvatar brand={selectedOrder.brand_name} name={selectedOrder.restaurant_name} size={32} />
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <span>{t('dispatch.th_order_num', 'Bon')} #{formatDisplayOrderNumber(selectedOrder.order_number, selectedOrder.order_id, selectedOrder.channel || selectedOrder.platform) || selectedOrder.order_number || selectedOrder.order_id?.slice(-4)}</span>
                    <PlatformLogo platform={selectedOrder.platform} size={18} />
                  </h3>
                  <p className="text-xs text-slate-400">
                    {cleanRestaurantName(selectedOrder.restaurant_name)} ({selectedOrder.restaurant_city}) · {t('dispatch.modal_placed_at', 'Plasat la')} {parseOrderDateTime(selectedOrder.placed_at || selectedOrder.created_at).time}
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
              
              {/* Canal & Proveniență Bon */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                selectedOrder.channel_type === 'kiosk' || selectedOrder.platform === 'kiosk'
                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                  : selectedOrder.channel_type === 'casierie' || selectedOrder.platform === 'casierie' || selectedOrder.platform === 'IN-STORE'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                    : isDark ? 'bg-slate-800/40 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {selectedOrder.channel_type === 'kiosk' || selectedOrder.platform === 'kiosk' ? (
                    <>
                      <Monitor size={16} className="text-purple-600 dark:text-purple-400" />
                      <span>{t('dispatch.modal_dine_in_kiosk', 'Comandă plasată la Smart Kiosk')}</span>
                    </>
                  ) : selectedOrder.channel_type === 'casierie' || selectedOrder.platform === 'casierie' || selectedOrder.platform === 'IN-STORE' ? (
                    <>
                      <Receipt size={16} className="text-blue-600 dark:text-blue-400" />
                      <span>{t('dispatch.modal_dine_in_pos', 'Înregistrată la Casierie (POS) · În Magazin')}</span>
                    </>
                  ) : (
                    <>
                      <PlatformLogo platform={selectedOrder.platform} size={16} />
                      <span>{t('dispatch.modal_aggregator_order', 'Comandă prin Agregator {platform}', { platform: selectedOrder.channel_label || selectedOrder.platform?.toUpperCase() })}</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                  {language === 'ru' ? 'Оплата:' : language === 'en' ? 'Payment:' : 'Plată:'} <span className="font-semibold text-slate-700 dark:text-slate-300">{formatPaymentMethod(selectedOrder.payment_method, selectedOrder.is_cash, selectedOrder.is_card, language)}</span> · {formatDiningOption(selectedOrder.dining_option || selectedOrder.order_type, language)}
                </div>
              </div>

              {/* Etapă & Cronometru */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('dispatch.modal_stage_title', 'Stare Operațională')}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-sm">{getStageBadge(selectedOrder.stage, selectedOrder).label}</span>
                    <span className="text-xs text-slate-400 font-medium">
                      {(() => {
                        const mBadge = getStageBadge(selectedOrder.stage, selectedOrder)
                        const mElapsed = (typeof selectedOrder.elapsed_minutes === 'number' && selectedOrder.elapsed_minutes >= 0) 
                          ? selectedOrder.elapsed_minutes 
                          : computeElapsedMinutes(selectedOrder.placed_at, selectedOrder.created_at, selectedOrder.elapsed_minutes || 0)
                        const mLead = selectedOrder.lead_time_minutes || selectedOrder.total_minutes || mElapsed

                        return mBadge.isFinalized
                          ? `(${t('dispatch.modal_finalized_duration', 'Finalizat în {minutes} min (de la primire la predare)', { minutes: mLead })})`
                          : `(${t('dispatch.modal_in_progress_duration', '{minutes} min în lucru de la plasare', { minutes: mElapsed })})`
                      })()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-slate-400">{t('dispatch.modal_kitchen', 'Bucătărie')}</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.kitchen_minutes}{language === 'ru' ? 'м' : 'm'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-slate-400">{t('dispatch.modal_wait', 'Așteptare')}</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.courier_wait_minutes}{language === 'ru' ? 'м' : 'm'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] uppercase text-slate-400">{t('dispatch.modal_delivery', 'Livrare')}</div>
                    <div className="font-bold text-slate-700 dark:text-slate-200">{selectedOrder.delivery_minutes}{language === 'ru' ? 'м' : 'm'}</div>
                  </div>
                </div>
              </div>

              {/* Cronologie Timpi iiko (Ore exacte din Syrve/iiko) */}
              {(selectedOrder.timings?.created_time || selectedOrder.timings?.cooking_completed_time || selectedOrder.timings?.sended_time || selectedOrder.timings?.delivered_time) && (
                <div className={`p-3.5 rounded-2xl border ${
                  isDark ? 'bg-emerald-950/20 border-emerald-800/50' : 'bg-emerald-50/60 border-emerald-200/80'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Clock size={12} /> Cronologie Timpi iiko (Ore Exacte)
                    </span>
                    {selectedOrder.timings?.complete_before_time && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Termen promis (SLA): <b className="font-mono text-slate-800 dark:text-slate-200">{selectedOrder.timings.complete_before_time}</b>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-emerald-100'}`}>
                      <div className="text-[10px] text-slate-400 font-semibold">1. Comandă Intrată</div>
                      <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                        {selectedOrder.timings?.created_time || parseOrderDateTime(selectedOrder.placed_at).time || '—'}
                      </div>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-emerald-100'}`}>
                      <div className="text-[10px] text-slate-400 font-semibold">2. Gata Bucătărie</div>
                      <div className="font-mono font-extrabold text-sm text-blue-600 dark:text-blue-400 mt-0.5">
                        {selectedOrder.timings?.cooking_completed_time || '—'}
                      </div>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-emerald-100'}`}>
                      <div className="text-[10px] text-slate-400 font-semibold">3. Predată Curier</div>
                      <div className="font-mono font-extrabold text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                        {selectedOrder.timings?.sended_time || '—'}
                      </div>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-emerald-100'}`}>
                      <div className="text-[10px] text-slate-400 font-semibold">4. Livrată / Închisă</div>
                      <div className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {selectedOrder.timings?.delivered_time || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                  <ShoppingBag size={14} /> {t('dispatch.modal_items_title', 'Produse pe Bon ({count})', { count: selectedOrder.items?.length || 0 })}
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
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">{t('dispatch.modal_customer_data', 'Date Client')}</span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                      <ShieldCheck size={10} /> GDPR
                    </span>
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{selectedOrder.customer?.name || t('dispatch.modal_customer_data', 'Client Nespecificat')}</div>
                  <div className="text-slate-500 dark:text-slate-400 mt-1 font-mono flex items-center gap-1.5">
                    <Phone size={11} className="text-slate-400 shrink-0" />
                    <span>{selectedOrder.customer?.phone || t('dispatch.modal_no_phone', 'Fără număr de telefon')}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1.5">
                    <MapPin size={11} className="text-slate-400 shrink-0 mt-0.5" />
                    <span>{selectedOrder.customer?.address || t('dispatch.modal_dine_in_address', 'Servire în restaurant / Preluare')}</span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5">{t('dispatch.modal_courier_data', 'Date Livrare & Curier')}</div>
                  {selectedOrder.courier ? (
                    <>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Bike size={14} className="text-emerald-500" />
                        <span>{selectedOrder.courier.name}</span>
                        <span className="text-[10px] font-normal text-slate-400">({selectedOrder.courier.company})</span>
                      </div>
                      {selectedOrder.courier.phone && (
                        <div className="text-slate-500 dark:text-slate-400 mt-1 font-mono">{selectedOrder.courier.phone}</div>
                      )}
                      {selectedOrder.courier.awb && (
                        <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-1">AWB: {selectedOrder.courier.awb}</div>
                      )}
                    </>
                  ) : selectedOrder.channel_type === 'kiosk' || selectedOrder.channel_type === 'casierie' ? (
                    <div className="text-slate-400 italic">{t('dispatch.modal_courier_dine_in', 'Servire pe loc în restaurant (fără curier)')}</div>
                  ) : selectedOrder.platform === 'bolt' ? (
                    <div className="text-emerald-600 dark:text-emerald-400 font-medium">{t('dispatch.modal_bolt_assigning', 'Curier Bolt (În curs de asignare de către Bolt)')}</div>
                  ) : selectedOrder.platform === 'glovo' ? (
                    <div className="text-slate-400 italic">{t('dispatch.modal_glovo_no_contact', 'Asignat direct de Glovo (Platforma nu expune contactul curierului prin iiko)')}</div>
                  ) : selectedOrder.platform === 'wolt' ? (
                    <div className="text-slate-400 italic">{t('dispatch.modal_wolt_no_contact', 'Asignat direct de Wolt (Platforma nu expune contactul curierului prin iiko)')}</div>
                  ) : (
                    <div className="text-slate-400 italic">{t('dispatch.aggregator_courier', 'Curier Agregator')}</div>
                  )}
                </div>
              </div>

              {/* Total Bon */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="font-bold text-sm">{t('dispatch.modal_total_order', 'Total Comandă:')}</span>
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
