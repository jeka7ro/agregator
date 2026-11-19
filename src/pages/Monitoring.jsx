import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
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
  Webhook,
  Star,
  Upload,
  Mail,
  Bot,
  Receipt,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ChefHat,
  Bike,
  Copy,
  Check,
  MapPin,
  RotateCcw,
  Download
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useLiveChecks } from '../hooks/useLiveChecks'
import PlatformLogo from '../components/PlatformLogo'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import RestaurantDetailsModal from '../components/RestaurantDetailsModal'
import OrderDetailsModal from '../components/OrderDetailsModal'
import { getApiUrl } from '../lib/api'
import { getCanonicalCity, getCityDisplayName } from '../lib/orderUtils'
import WebhookIntegrationModal from '../components/WebhookIntegrationModal'

function AnimatedNumber({ value }) {
  return <span className="animate-in fade-in slide-in-from-bottom-2 duration-300">{value}</span>
}

function getKitchenZoneKey(name = '', city = '', address = '') {
  const combined = `${name || ''} ${city || ''} ${address || ''}`.toUpperCase()
  if (combined.includes('MURES') || combined.includes('MUREȘ')) return 'TARGU MURES'
  if (combined.includes('BALOTESTI') || combined.includes('BALOTEȘTI')) return 'BALOTESTI'
  if (combined.includes('CEAIKOVSKI') || combined.includes('BUCURESTI-04')) return 'BUC_CEAIKOVSKI'
  if (combined.includes('CORA') || combined.includes('MANIU') || combined.includes('MILITARI') || combined.includes('BUCURESTI-03')) return 'BUC_CORA'
  if (combined.includes('UNIRII') || combined.includes('HALELOR') || combined.includes('BUCURESTI-02')) return 'BUC_UNIRII'
  if (combined.includes('TITAN') || combined.includes('DECEMBRIE 1918 33') || combined.includes('BUCURESTI-01')) return 'BUC_TITAN'
  if (combined.includes('BERCENI')) return 'BUC_BERCENI'
  if (combined.includes('IASI#2') || combined.includes('IASI-02') || combined.includes('VLADIMIRESCU') || combined.includes('VLADIMERESCU')) return 'IASI_2'
  if (combined.includes('IASI#1') || combined.includes('IASI-01') || combined.includes('VOEVOZILOR') || combined.includes('VOIEVOZILOR')) return 'IASI_1'
  return getCanonicalCity(city || name || '')
}

export default function Monitoring() {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const navigate = useNavigate()

  const { restaurants, checks, loading, getLatestCheck, fetchData } = useLiveChecks()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeBrand, setActiveBrand] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('brand')
      if (p) return p
    } catch (_) { }
    return 'all'
  })

  const [cityFilter, setCityFilter] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('city')
      if (p && p !== 'all') return getCanonicalCity(p) || 'all'
    } catch (_) { }
    return 'all'
  })

  const handleBrandChange = (brand) => {
    setActiveBrand(brand)
    setPage(1)
    try {
      const next = new URLSearchParams(searchParams)
      if (brand && brand !== 'all') {
        next.set('brand', brand)
      } else {
        next.delete('brand')
      }
      setSearchParams(next, { replace: true })
    } catch (_) { }
  }

  const handleCityChange = (city) => {
    const canon = city && city !== 'all' ? getCanonicalCity(city) : 'all'
    setCityFilter(canon)
    setPage(1)
    try {
      const next = new URLSearchParams(searchParams)
      if (canon && canon !== 'all') {
        next.set('city', canon)
      } else {
        next.delete('city')
      }
      setSearchParams(next, { replace: true })
    } catch (_) { }
  }

  const handleResetMonitoringFilters = () => {
    setActiveBrand('all')
    setCityFilter('all')
    setSearch('')
    setPage(1)
    try {
      const next = new URLSearchParams(searchParams)
      next.delete('brand')
      next.delete('city')
      setSearchParams(next, { replace: true })
    } catch (_) { }
  }

  // Sync with React Router searchParams & central Reset button
  useEffect(() => {
    try {
      const pBrand = searchParams.get('brand') || 'all'
      if (pBrand !== activeBrand) setActiveBrand(pBrand)
      const pCity = searchParams.get('city')
      const nextCity = pCity && pCity !== 'all' ? getCanonicalCity(pCity) : 'all'
      if (nextCity !== cityFilter) setCityFilter(nextCity)
    } catch (_) { }
  }, [searchParams])

  useEffect(() => {
    const onGlobalReset = () => {
      setActiveBrand('all')
      setCityFilter('all')
      setSearch('')
      setPage(1)
    }
    window.addEventListener('global-reset-filters', onGlobalReset)
    return () => window.removeEventListener('global-reset-filters', onGlobalReset)
  }, [])

  // Paginare & Căutare State
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(15)

  // Detalii verificare (Modal) & Dosar Tehnic
  const [selectedCheckDetail, setSelectedCheckDetail] = useState(null)
  const [dossierRestaurant, setDossierRestaurant] = useState(null)
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null)

  // View Mode: 'status' (Status Locații & Ratinguri) | 'zones' (Rază & Zone Livrare)
  const [monitoringTab, setMonitoringTab] = useState('status')
  const [zonesPeriod, setZonesPeriod] = useState('today')
  const [activeMainView, setActiveMainView] = useState('status')
  const [reviewsData, setReviewsData] = useState({ reviews: [], kpis: null, ratings_by_restaurant: {} })
  const [deliveryZonesMap, setDeliveryZonesMap] = useState({})
  const [todayZonesMap, setTodayZonesMap] = useState({})
  const [yesterdayZonesMap, setYesterdayZonesMap] = useState({})
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewFilter, setReviewFilter] = useState('all') // 'all' | 'negative' | 'positive' | 'with_comment' | 'matched'
  const [reviewPlatformFilter, setReviewPlatformFilter] = useState('all')
  const [toastNotice, setToastNotice] = useState(null)
  const fileInputRef = useRef(null)

  // Email & Portal Scraper Modals
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailParsing, setEmailParsing] = useState(false)
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false)
  const [isScrapingPortals, setIsScrapingPortals] = useState(false)
  const [showScraperInfoModal, setShowScraperInfoModal] = useState(false)

  const showToast = useCallback((type, text) => {
    setToastNotice({ type, text })
    setTimeout(() => setToastNotice(null), 5500)
  }, [])

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true)
    try {
      const res = await fetch(getApiUrl('/api/reviews?limit=300'))
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setReviewsData({
            reviews: data.reviews || [],
            kpis: data.kpis || null,
            ratings_by_restaurant: data.ratings_by_restaurant || {}
          })
        }
      }
    } catch (err) {
      console.error('[Monitoring] fetchReviews error:', err)
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(getApiUrl('/api/dispatch/live?period=today&limit=1500')).then(r => (r.ok ? r.json() : null)).catch(() => null),
      fetch(getApiUrl('/api/dispatch/live?period=yesterday&limit=1500')).then(r => (r.ok ? r.json() : null)).catch(() => null)
    ]).then(([tData, yData]) => {
      if (cancelled) return
      const yZones = yData?.delivery_zones || {}
      const tZones = tData?.delivery_zones || {}
      const calibratedToday = {}
      const statusMerged = { ...yZones }

      for (const [k, tz] of Object.entries(tZones)) {
        const yz = yZones[k]
        const maxCap = (tz.platform === 'wolt' && tz.city === 'BUCURESTI') ? 4.0 : 5.5
        const minChokeKm = (tz.platform === 'wolt' && tz.city === 'BUCURESTI') ? 2.38 : 3.2
        const yNorm = yz ? Math.min(maxCap, yz.active_radius_km || 0) : 0
        const normKm = Number(Math.min(maxCap, Math.max(tz.normal_radius_km || 4.5, yNorm, Math.min(maxCap, tz.active_radius_km || 0))).toFixed(2))
        const narrowed = Boolean(tz.orders_count >= 5 && tz.active_radius_km <= minChokeKm && tz.active_radius_km < normKm * 0.68)
        const nextZone = {
          ...tz,
          normal_radius_km: normKm,
          is_narrowed: narrowed,
          narrowed_pct: narrowed ? Math.round(((normKm - tz.active_radius_km) / normKm) * 100) : 0
        }
        calibratedToday[k] = nextZone
        if (!yz || tz.orders_count >= 2) {
          statusMerged[k] = nextZone
        }
      }

      setTodayZonesMap(calibratedToday)
      setYesterdayZonesMap(yZones)
      setDeliveryZonesMap(statusMerged)
    })
    return () => { cancelled = true }
  }, [])

  // MECANISMUL 1: Import Manual din Excel / CSV (handleFileUpload cu XLSX)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (!rawRows || rawRows.length === 0) {
        showToast('error', 'Fișierul Excel/CSV selectat nu conține rânduri valide.')
        return
      }

      const findKey = (obj, candidates) => {
        const keys = Object.keys(obj)
        for (const cand of candidates) {
          const found = keys.find(k => k.toLowerCase().trim().includes(cand))
          if (found) return obj[found]
        }
        return ''
      }

      const parsedReviews = rawRows.map((row) => {
        const rawRating = findKey(row, ['rating', 'score', 'nota', 'notă', 'stars', 'stele', 'evaluare', 'thumbs'])
        let numRating = parseFloat(String(rawRating).replace(',', '.'))
        if (isNaN(numRating)) {
          const strVal = String(rawRating).toLowerCase()
          numRating = (strVal.includes('neg') || strVal.includes('down') || strVal.includes('👎')) ? 2 : 5
        }
        const maxScale = numRating > 5 ? 10 : 5
        const comment = String(findKey(row, ['comment', 'review', 'comentariu', 'feedback', 'text', 'mesaj', 'reason', 'motiv']) || '').trim()
        const orderId = String(findKey(row, ['order_id', 'order id', 'order_code', 'order code', 'comanda', 'comandă', 'bon', 'order number', 'id']) || '').trim()
        const platformRaw = String(findKey(row, ['platform', 'platforma', 'canal', 'source', 'app']) || '').toLowerCase()
        const platform = platformRaw.includes('wolt') ? 'wolt' : platformRaw.includes('bolt') ? 'bolt' : (file.name.toLowerCase().includes('wolt') ? 'wolt' : file.name.toLowerCase().includes('bolt') ? 'bolt' : 'glovo')
        const restName = String(findKey(row, ['restaurant', 'store', 'locatie', 'locație', 'venue', 'branch']) || '').trim()
        const customerName = String(findKey(row, ['customer', 'client', 'author', 'user', 'nume']) || `Client ${platform.toUpperCase()}`).trim()
        const reviewedAt = findKey(row, ['date', 'data', 'created_at', 'reviewed_at', 'time', 'timestamp']) || new Date().toISOString()

        // Sentiment conform regulii (>= 8 pozitiv, <= 5 negativ pe scara 10; >= 4 pozitiv, <= 2 negativ pe scara 5)
        const r10 = maxScale === 10 ? numRating : numRating * 2
        let sentiment = 'neutral'
        if (r10 >= 8) sentiment = 'positive'
        else if (r10 <= 5) sentiment = 'negative'

        return {
          order_id: orderId,
          platform,
          rating: numRating,
          max_scale: maxScale,
          comment,
          sentiment,
          customer_name: customerName,
          restaurant_name: restName,
          reviewed_at: reviewedAt
        }
      })

      const res = await fetch(getApiUrl('/api/reviews/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews: parsedReviews, source: 'excel_import' })
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', `Import Excel finalizat: ${data.inserted || parsedReviews.length} recenzii procesate (${data.matched || 0} legate automat de bonurile din Dispecerat).`)
        fetchReviews()
      } else {
        showToast('error', data.error || 'Eroare la importul fișierului Excel.')
      }
    } catch (err) {
      showToast('error', `Eroare la citirea fișierului Excel/CSV: ${err.message}`)
    }
  }

  // MECANISMUL 2A: Parsare Email Recenzie (jeka7ro@gmail.com)
  const handleParseEmail = async (e) => {
    e.preventDefault()
    if (!emailSubject.trim() && !emailBody.trim()) {
      showToast('error', 'Introdu subiectul sau conținutul emailului de recenzie.')
      return
    }
    setEmailParsing(true)
    try {
      const res = await fetch(getApiUrl('/api/reviews/parse-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject,
          body: emailBody,
          from: 'jeka7ro@gmail.com',
          receivedAt: new Date().toISOString()
        })
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', `Recenzie extrasă din email și salvată (${data.matched > 0 ? 'legată automat de comanda iiko!' : 'fără bon iiko asociat'}).`)
        setEmailSubject('')
        setEmailBody('')
        setShowEmailModal(false)
        fetchReviews()
      } else {
        showToast('error', data.error || 'Eroare la parsarea emailului.')
      }
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setEmailParsing(false)
    }
  }

  // MECANISMUL 2B: Pornire Scrapere Puppeteer B2B (GlovoPartnerScraper & WoltPartnerScraper)
  const handleTriggerPortalScrapers = async () => {
    setIsScrapingPortals(true)
    try {
      const res = await fetch(getApiUrl('/api/reviews/scrape-portals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (data.success) {
        showToast('success', data.message || 'Scanarea portalurilor Glovo Partner & Wolt Merchant a pornit în fundal.')
      } else {
        showToast('error', data.error || 'Eroare la pornirea scraperelor.')
      }
    } catch (err) {
      showToast('error', err.message)
    } finally {
      setTimeout(() => {
        setIsScrapingPortals(false)
        fetchReviews()
      }, 3000)
    }
  }

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

  const availableCities = useMemo(() => {
    const set = new Set()
    restaurants.forEach(r => {
      if (!r.is_active) return
      const c = getCanonicalCity(r.city || r.name)
      if (c) set.add(c)
    })
    return ['all', ...Array.from(set).sort()]
  }, [restaurants])

  const getValidMissingProducts = (list) => {
    if (!Array.isArray(list)) return []
    return list
      .map(mp => typeof mp === 'string' ? mp.trim() : (mp?.name || mp?.product_name || '').trim())
      .filter(name => name && name.toLowerCase() !== 'produs' && name.toLowerCase() !== 'unknown')
  }

  let displayedRestaurants = []
  if (activeBrand === 'all') {
    displayedRestaurants = restaurants.filter(r => r.is_active)
  } else {
    displayedRestaurants = groupedByBrand[activeBrand] || []
  }
  if (cityFilter && cityFilter !== 'all') {
    const targetCityCanon = getCanonicalCity(cityFilter)
    displayedRestaurants = displayedRestaurants.filter(r =>
      getCanonicalCity(r.city || r.name) === targetCityCanon
    )
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

  const zonesList = useMemo(() => {
    const activeMap = zonesPeriod === 'today' ? todayZonesMap : yesterdayZonesMap
    const rawList = Object.values(activeMap || {})
    const q = search.trim().toLowerCase()
    const targetCityCanon = cityFilter && cityFilter !== 'all' ? getCanonicalCity(cityFilter) : null
    return rawList
      .filter(z => {
        if (targetCityCanon && z.city !== targetCityCanon) return false
        if (q) {
          const hay = `${z.hub_label || ''} ${z.city || ''} ${z.platform || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (Boolean(a.is_narrowed) !== Boolean(b.is_narrowed)) return a.is_narrowed ? -1 : 1
        const cityCmp = String(a.hub_label || a.city || '').localeCompare(String(b.hub_label || b.city || ''))
        if (cityCmp !== 0) return cityCmp
        return String(a.platform || '').localeCompare(String(b.platform || ''))
      })
  }, [todayZonesMap, yesterdayZonesMap, zonesPeriod, cityFilter, search])

  const zonesKpis = useMemo(() => {
    const glovoRows = zonesList.filter(z => z.platform === 'glovo')
    const woltRows = zonesList.filter(z => z.platform === 'wolt')
    const avgGlovo = glovoRows.length > 0
      ? (glovoRows.reduce((s, z) => s + (Number(z.active_radius_km) || 0), 0) / glovoRows.length).toFixed(2)
      : '0.00'
    const avgWolt = woltRows.length > 0
      ? (woltRows.reduce((s, z) => s + (Number(z.active_radius_km) || 0), 0) / woltRows.length).toFixed(2)
      : '0.00'
    const totalOrdersGps = zonesList.reduce((s, z) => s + (Number(z.orders_count) || 0), 0)
    const farOrders = zonesList.reduce((s, z) => s + (Number(z.over_4km) || 0), 0)
    const farPct = totalOrdersGps > 0 ? Math.round((farOrders / totalOrdersGps) * 100) : 0
    const narrowedCount = zonesList.filter(z => z.is_narrowed).length
    const sumUnder2 = zonesList.reduce((s, z) => s + (Number(z.under_2km) || 0), 0)
    const sumBetween24 = zonesList.reduce((s, z) => s + (Number(z.between_2_4km) || 0), 0)
    return { avgGlovo, avgWolt, totalOrdersGps, farOrders, farPct, narrowedCount, sumUnder2, sumBetween24 }
  }, [zonesList])

  const handleExportZonesExcel = () => {
    if (zonesList.length === 0) return
    const rows = zonesList.map((z, i) => ({
      '#': i + 1,
      'Хаб / Город': z.hub_label || z.city,
      'Город': z.city,
      'Платформа': (z.platform || '').toUpperCase(),
      'Норма радиуса (км)': z.normal_radius_km,
      'Факт макс. радиус (км)': z.active_radius_km,
      'Средняя дальность (км)': z.avg_distance_km,
      'Заказов <2 км': z.under_2km,
      'Заказов 2-4 км': z.between_2_4km,
      'Заказов 4+ км': z.over_4km,
      'Всего заказов с GPS': z.orders_count,
      'Статус зоны': z.is_narrowed ? `Сужение (-${z.narrowed_pct}%)` : z.orders_count < 5 ? `Мало данных (${z.orders_count})` : 'Полный радиус'
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery Zones')
    XLSX.writeFile(wb, `delivery-zones-radius-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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
    if (isVerifying) {
      setShowReport(true)
      return
    }
    setIsVerifying(true)
    setShowReport(true)
    setVerifyStatus({ isRunning: true, totalChecks: 0, current: 0, errors: 0, offline: 0, results: [] })
    fetch(getApiUrl('/api/check-all'), { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json().catch(() => null)
        if (data?.status) {
          setVerifyStatus(data.status)
          if (!data.status.isRunning) {
            setIsVerifying(false)
            fetchData(true)
          }
        }
      })
      .catch((err) => {
        console.error(err)
        setIsVerifying(false)
      })
  }

  const handleStopVerify = () => {
    fetch(getApiUrl('/api/check-stop'), { method: 'POST' }).catch(console.error)
    setIsVerifying(false)
    setVerifyStatus(prev => prev ? { ...prev, isRunning: false } : null)
  }

  useEffect(() => {
    let interval;
    let consecutiveFailures = 0;
    if (isVerifying) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(getApiUrl('/api/check-status'))
          if (res.ok) {
            consecutiveFailures = 0
            const data = await res.json()
            setVerifyStatus(data.status)
            if (data.status && !data.status.isRunning) {
              setIsVerifying(false)
              fetchData(true)
            }
          } else {
            consecutiveFailures++
            if (consecutiveFailures >= 2) {
              setIsVerifying(false)
              setVerifyStatus(prev => prev ? { ...prev, isRunning: false } : null)
            }
          }
        } catch (err) {
          console.error(err)
          consecutiveFailures++
          if (consecutiveFailures >= 3) {
            setIsVerifying(false)
          }
        }
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [isVerifying, fetchData])

  // Filtered reviews for the Inbox Recenzii & Reputație tab (MUST be before early return!)
  const filteredReviews = useMemo(() => {
    let list = [...(reviewsData.reviews || [])]
    if (activeBrand !== 'all') {
      list = list.filter(rv => {
        if (rv.brand_name && rv.brand_name === activeBrand) return true
        const restObj = restaurants.find(r => r.id === (rv.restaurant_id || rv.location_id)) || { name: rv.restaurant_name }
        return deduceBrandName(restObj) === activeBrand
      })
    }
    if (reviewPlatformFilter !== 'all') {
      list = list.filter(rv => (rv.platform || '').toLowerCase() === reviewPlatformFilter)
    }
    if (reviewFilter === 'negative') {
      list = list.filter(rv => rv.sentiment === 'negative')
    } else if (reviewFilter === 'positive') {
      list = list.filter(rv => rv.sentiment === 'positive')
    } else if (reviewFilter === 'with_comment') {
      list = list.filter(rv => rv.comment && rv.comment.trim().length > 0 && !rv.comment.startsWith('Evaluare publică'))
    } else if (reviewFilter === 'matched') {
      list = list.filter(rv => !!rv.matched_order)
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(rv =>
        (rv.restaurant_name && rv.restaurant_name.toLowerCase().includes(s)) ||
        (rv.city && rv.city.toLowerCase().includes(s)) ||
        (rv.comment && rv.comment.toLowerCase().includes(s)) ||
        (rv.customer_name && rv.customer_name.toLowerCase().includes(s)) ||
        (rv.order_id && String(rv.order_id).toLowerCase().includes(s)) ||
        (rv.matched_order?.order_number && String(rv.matched_order.order_number).toLowerCase().includes(s))
      )
    }
    return list
  }, [reviewsData.reviews, activeBrand, reviewPlatformFilter, reviewFilter, search, restaurants])

  const getRestaurantRating = (restaurantId, platform) => {
    const check = getLatestCheck(restaurantId, platform)
    if (check && check.rating !== undefined && check.rating !== null) {
      return {
        rating: Number(check.rating),
        previous_rating: check.previous_rating !== undefined && check.previous_rating !== null ? Number(check.previous_rating) : null,
        review_count: check.review_count || null,
        change_direction: check.change_direction || 'same'
      }
    }
    const rMap = reviewsData.ratings_by_restaurant?.[restaurantId]?.[platform]
    if (rMap && rMap.rating !== undefined && rMap.rating !== null) {
      return {
        rating: Number(rMap.rating),
        previous_rating: rMap.previous_rating !== undefined && rMap.previous_rating !== null ? Number(rMap.previous_rating) : null,
        review_count: rMap.review_count || null,
        change_direction: rMap.change_direction || 'same'
      }
    }
    return null
  }

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
    <div className="flex flex-col h-full w-full space-y-5">
      {/* Hidden Excel/CSV Input for Mecanismul 1 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Internal Toast Notification Banner (Fără alert/confirm/prompt nativ) */}
      {toastNotice && (
        <div className={`px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${toastNotice.type === 'error'
          ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300'
          : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
          }`}>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            {toastNotice.type === 'error' ? <AlertTriangle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
            <span>{toastNotice.text}</span>
          </div>
          <button onClick={() => setToastNotice(null)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <X size={14} />
          </button>
        </div>
      )}

      {/* HEADER OPERAȚIONAL */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('monitoring.title')}
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full xl:w-auto flex-wrap">
          {/* Selector Oraș */}
          <div className="relative w-full sm:w-52">
            <MapPin className="w-4 h-4 text-emerald-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={cityFilter}
              onChange={(e) => handleCityChange(e.target.value)}
              className={`w-full pl-9 pr-8 h-10 text-xs font-bold rounded-full border outline-none transition-all shadow-xs cursor-pointer ${cityFilter !== 'all'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : isDark
                  ? 'bg-slate-900 border-slate-700 text-white hover:border-slate-600'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                }`}
            >
              <option value="all" className="bg-slate-900 text-white">
                {language === 'ru' ? 'Все города' : language === 'en' ? 'All cities' : 'Toate orașele'}
              </option>
              {availableCities.filter(c => c !== 'all').map(cityKey => (
                <option key={cityKey} value={cityKey} className="bg-slate-900 text-white">
                  {getCityDisplayName(cityKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Căutare */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t('monitoring.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-10 pr-4 h-10 text-sm rounded-full border outline-none transition-all shadow-xs ${isDark
                ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                }`}
            />
          </div>

          {(cityFilter !== 'all' || activeBrand !== 'all' || search.trim() !== '') && (
            <button
              type="button"
              onClick={handleResetMonitoringFilters}
              className="px-3.5 h-10 rounded-full border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>{language === 'ru' ? 'Сбросить' : language === 'en' ? 'Reset' : 'Resetează'}</span>
            </button>
          )}

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
              className="px-5 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none cursor-pointer"
            >
              <Loader2 size={16} className={isVerifying ? "animate-spin" : "hidden"} />
              <span>
                {isVerifying
                  ? `${t('monitoring.scanning')}${verifyStatus?.totalChecks > 0 ? ` (${verifyStatus.current}/${verifyStatus.totalChecks})` : ''}`
                  : t('monitoring.check_status')}
              </span>
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

      {/* VIEW SWITCHER: STATUS VITRINE vs ZONE & RAZA LIVRARE */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className={`inline-flex items-center p-1 rounded-full border shadow-xs ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
          <button
            type="button"
            onClick={() => setMonitoringTab('status')}
            className={`px-4 h-9 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${monitoringTab === 'status'
              ? 'bg-emerald-600 text-white shadow-xs'
              : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Store size={14} />
            <span>
              {language === 'ru'
                ? 'Статус точек и витрин'
                : language === 'en'
                  ? 'Locations & Storefronts'
                  : 'Status Locații & Vitrine'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMonitoringTab('zones')}
            className={`px-4 h-9 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${monitoringTab === 'zones'
              ? 'bg-emerald-600 text-white shadow-xs'
              : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <MapPin size={14} />
            <span>
              {language === 'ru'
                ? 'Зоны и радиус доставки (Статистика)'
                : language === 'en'
                  ? 'Delivery Zones & Radius (Stats)'
                  : 'Rază & Zone Livrare (Statistică)'}
            </span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tabular-nums ${monitoringTab === 'zones'
              ? 'bg-white/20 text-white'
              : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
              }`}>
              {zonesList.length}
            </span>
            {zonesKpis.narrowedCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title={`${zonesKpis.narrowedCount} sujate`} />
            )}
          </button>
        </div>
      </div>

      {monitoringTab === 'zones' ? (
        <div className="space-y-4 flex-1 flex flex-col">
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`px-4 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
              }`}>
              <div className="text-[11px] font-bold text-slate-400 truncate">
                {language === 'ru' ? 'Средний макс. радиус Glovo' : language === 'en' ? 'Avg Max Radius Glovo' : 'Rază medie max Glovo'}
              </div>
              <div className="text-xl font-extrabold mt-0.5 tabular-nums text-amber-500">
                {zonesKpis.avgGlovo} {language === 'ru' ? 'км' : 'km'}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {language === 'ru' ? 'По реальным GPS координатам iiko' : 'Din coordonatele reale GPS iiko'}
              </div>
            </div>

            <div className={`px-4 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
              }`}>
              <div className="text-[11px] font-bold text-slate-400 truncate">
                {language === 'ru' ? 'Средний макс. радиус Wolt' : language === 'en' ? 'Avg Max Radius Wolt' : 'Rază medie max Wolt'}
              </div>
              <div className="text-xl font-extrabold mt-0.5 tabular-nums text-cyan-500">
                {zonesKpis.avgWolt} {language === 'ru' ? 'км' : 'km'}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {language === 'ru' ? 'По реальным GPS координатам iiko' : 'Din coordonatele reale GPS iiko'}
              </div>
            </div>

            <div className={`px-4 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
              }`}>
              <div className="text-[11px] font-bold text-slate-400 truncate">
                {language === 'ru' ? 'Заказов 4+ км (дальняя зона)' : language === 'en' ? 'Orders 4+ km (Far Zone)' : 'Comenzi 4+ km (zonă îndepărtată)'}
              </div>
              <div className="text-xl font-extrabold mt-0.5 tabular-nums text-slate-900 dark:text-white">
                {zonesKpis.farOrders}{' '}
                <span className="text-xs font-bold text-emerald-500">({zonesKpis.farPct}%)</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {language === 'ru' ? `Из ${zonesKpis.totalOrdersGps} заказов с GPS` : `Din ${zonesKpis.totalOrdersGps} comenzi cu GPS`}
              </div>
            </div>

            <div className={`px-4 py-3.5 rounded-2xl border ${zonesKpis.narrowedCount > 0
              ? isDark ? 'bg-rose-950/30 border-rose-800/70' : 'bg-rose-50/70 border-rose-200'
              : isDark ? 'bg-emerald-950/20 border-emerald-800/60' : 'bg-emerald-50/60 border-emerald-200'
              }`}>
              <div className="text-[11px] font-bold text-slate-400 truncate">
                {language === 'ru' ? 'Урезанные зоны сейчас' : language === 'en' ? 'Narrowed Zones Now' : 'Zone îngustate acum'}
              </div>
              <div className={`text-xl font-extrabold mt-0.5 tabular-nums ${zonesKpis.narrowedCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                {zonesKpis.narrowedCount}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {zonesKpis.narrowedCount > 0
                  ? (language === 'ru' ? 'Радиус ниже 68% от нормы хаба' : 'Rază sub 68% din norma punctului')
                  : (language === 'ru' ? 'Все активные зоны в норме' : 'Toate zonele active în normă')}
              </div>
            </div>
          </div>

          {/* Comparative Table Card */}
          <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col flex-1 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
            <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/70'
              }`}>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {language === 'ru'
                  ? '💡 Источник: реальные GPS-координаты клиентов из заказов в iiko/Syrve (воздушный радиус от кухни). Glovo и Wolt передают GPS; Bolt Food скрывает координаты (0, 0).'
                  : language === 'en'
                    ? '💡 Source: live customer GPS coordinates from iiko/Syrve orders (aerial radius per kitchen). Glovo & Wolt send GPS; Bolt Food hides coordinates (0, 0).'
                    : '💡 Sursă: coordonatele GPS reale ale clienților din comenzile iiko/Syrve (rază aeriană per bucătărie). Glovo & Wolt transmit GPS; Bolt Food ascunde coordonatele (0, 0).'}
              </div>
              <div className="flex items-center gap-2">
                <div className={`inline-flex items-center p-0.5 rounded-full border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setZonesPeriod('today')}
                    className={`px-3 h-7 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      zonesPeriod === 'today'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {language === 'ru' ? 'Сегодня' : language === 'en' ? 'Today' : 'Azi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setZonesPeriod('yesterday')}
                    className={`px-3 h-7 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      zonesPeriod === 'yesterday'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {language === 'ru' ? 'Вчера' : language === 'en' ? 'Yesterday' : 'Ieri'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleExportZonesExcel}
                  disabled={zonesList.length === 0}
                  className="px-3.5 h-8 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-40"
                >
                  <Download size={13} />
                  <span>
                    {language === 'ru' ? 'Скачать отчет (Excel)' : language === 'en' ? 'Export Report (Excel)' : 'Exportă Raport Excel'}
                  </span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs min-w-[920px]">
                <thead>
                  <tr className={`border-b text-[11px] font-bold uppercase tracking-wider select-none whitespace-nowrap ${isDark ? 'bg-slate-800/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">{language === 'ru' ? 'Хаб / Город' : 'Hub / Oraș'}</th>
                    <th className="py-2.5 px-3">{language === 'ru' ? 'Платформа' : 'Platformă'}</th>
                    <th className="py-2.5 px-3 text-right">{language === 'ru' ? 'Норма радиуса' : 'Normă rază'}</th>
                    <th className="py-2.5 px-3 text-right">{language === 'ru' ? 'Факт макс. радиус' : 'Max. activ'}</th>
                    <th className="py-2.5 px-3 text-right">{language === 'ru' ? 'Средняя дальность' : 'Medie distanță'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'ru' ? 'Кольца (<2 / 2–4 / 4+ км)' : 'Inele (<2 / 2–4 / 4+ km)'}</th>
                    <th className="py-2.5 px-3 text-right">{language === 'ru' ? 'Заказов GPS' : 'Comenzi GPS'}</th>
                    <th className="py-2.5 px-3 text-right">{language === 'ru' ? 'Статус зоны' : 'Status zonă'}</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                  {zonesList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        {language === 'ru' ? 'Нет данных GPS по выбранным фильтрам.' : 'Nu există date GPS pentru filtrele selectate.'}
                      </td>
                    </tr>
                  ) : zonesList.map((z, idx) => (
                    <tr
                      key={`${z.zone_key || z.city}_${z.platform}_${idx}`}
                      className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/90'}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums font-semibold">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className={z.is_narrowed ? 'text-rose-500 shrink-0' : 'text-emerald-500 shrink-0'} />
                          <span>{z.hub_label || z.city}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <PlatformLogo platform={z.platform} size={13} />
                          <span className="uppercase">{z.platform}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-500 font-semibold">
                        {z.normal_radius_km} {language === 'ru' ? 'км' : 'km'}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-extrabold ${
                        z.is_narrowed
                          ? 'text-rose-600 dark:text-rose-400'
                          : z.orders_count < 5
                            ? 'text-slate-500 dark:text-slate-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                        {z.active_radius_km} {language === 'ru' ? 'км' : 'km'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-700 dark:text-slate-200">
                        {z.avg_distance_km} {language === 'ru' ? 'км' : 'km'}
                      </td>
                      <td className="py-2.5 px-3 text-center tabular-nums whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                          {z.under_2km} / {z.between_2_4km} / <b className="text-emerald-600 dark:text-emerald-400">{z.over_4km}</b>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold">
                        {z.orders_count}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {z.is_narrowed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
                            <AlertTriangle size={11} />
                            <span>
                              {language === 'ru' ? `Сужение -${z.narrowed_pct}%` : `Îngustat -${z.narrowed_pct}%`}
                            </span>
                          </span>
                        ) : z.orders_count < 5 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                            <Clock size={11} />
                            <span>{language === 'ru' ? `Мало данных (${z.orders_count})` : `Puține comenzi (${z.orders_count})`}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 size={11} />
                            <span>{language === 'ru' ? 'Норма (100%)' : 'Normă (100%)'}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {zonesList.length > 0 && (
                  <tfoot>
                    <tr className={`border-t font-extrabold text-[11px] ${isDark ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                      <td className="py-2.5 px-3 text-center text-emerald-500">Σ</td>
                      <td className="py-2.5 px-3" colSpan={3}>
                        {language === 'ru' ? `Итого по ${zonesList.length} активным зонам (хаб × платформа)` : `Total ${zonesList.length} zone active (hub × platformă)`}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        Glovo {zonesKpis.avgGlovo} · Wolt {zonesKpis.avgWolt}
                      </td>
                      <td className="py-2.5 px-3 text-right">—</td>
                      <td className="py-2.5 px-3 text-center tabular-nums">
                        {zonesKpis.sumUnder2} / {zonesKpis.sumBetween24} / {zonesKpis.farOrders}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{zonesKpis.totalOrdersGps}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {zonesKpis.narrowedCount > 0
                          ? <span className="text-rose-500">{zonesKpis.narrowedCount} {language === 'ru' ? 'урезано' : 'îngustate'}</span>
                          : <span className="text-emerald-500">100% OK</span>}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* TABS BRANDURI (DOAR CELE 5 AUTORITARE) */}
          <div className="flex flex-wrap items-center gap-2 w-full">
            {allBrands.map(brand => {
              const isActive = activeBrand === brand;
              const count = brand === 'all' ? displayedRestaurants.length : groupedByBrand[brand]?.length || 0;
              return (
                <button
                  key={brand}
                  onClick={() => handleBrandChange(brand)}
                  className={`px-4 h-9 rounded-full text-xs font-bold transition-all flex items-center gap-2 shadow-xs ${isActive
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
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive
                    ? 'bg-white/20 text-white'
                    : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                    }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* CARD TABEL STATUS & RATINGURI LIVE */}
          <div className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col flex-1 transition-colors ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
            <div className="overflow-x-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className={`text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 select-none border-b ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
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
                      <td className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {startIndex + index + 1}
                      </td>

                      {/* Oraș */}
                      <td className="px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {r.city}
                      </td>

                      {/* Brand Avatar + Nume Locație (FĂRĂ duplicare text brand) */}
                      <td className="px-4 py-2.5">
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
                            className={`p-1.5 rounded-full border transition-colors shrink-0 opacity-70 hover:opacity-100 ${isDark
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
                        const rawPlatUrl = p !== 'iiko' ? r[`${p}_url`] : null;
                        const hasPlatform = (p !== 'iiko' && rawPlatUrl && !String(rawPlatUrl).includes('/search')) || (p === 'iiko' && r.iiko_restaurant_id);
                        if (!hasPlatform) {
                          return (
                            <td key={p} className="px-4 py-2.5 text-center align-middle whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${
                                isDark ? 'bg-slate-800/40 border-slate-800 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                              }`}>
                                {language === 'ru' ? 'Нет канала' : language === 'en' ? 'No channel' : 'Fără canal'}
                              </span>
                            </td>
                          );
                        }

                        const check = getLatestCheck(r.id, p);
                        const outside = !isWithinWorkingHours(r.working_hours);
                        const info = getStatusInfo(check?.final_status, outside);
                        const ratingInfo = p !== 'iiko' ? getRestaurantRating(r.id, p) : null;
                        const validMissingProducts = getValidMissingProducts(check?.missing_products);
                        const rKitchenKey = getKitchenZoneKey(r.name, r.city, r.address);
                        const isSubHub = rKitchenKey.startsWith('BUC_') || rKitchenKey.startsWith('IASI_');
                        const rCityCanon = getCanonicalCity(r.city || r.name || '');
                        const zoneInfo = (p === 'glovo' || p === 'wolt')
                          ? (isSubHub ? deliveryZonesMap[`${rKitchenKey}_${p}`] : (deliveryZonesMap[`${rKitchenKey}_${p}`] || deliveryZonesMap[`${rCityCanon}_${p}`]))
                          : null;

                        return (
                          <td key={p} className="px-4 py-2.5 text-center align-middle whitespace-nowrap">
                            <div className="inline-flex flex-col items-center gap-1">
                              {/* Rând 1: Status + alerte compacte stop-list inline */}
                              <div className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                                <div
                                  onClick={() => {
                                    if (check) setSelectedCheckDetail({ check: { ...check, ...(ratingInfo || {}), missing_products: validMissingProducts }, restaurant: r, platform: p, info, zoneInfo });
                                  }}
                                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap transition-all hover:scale-105 cursor-pointer ${info.badgeClass}`}
                                  title="Apasă pentru mai multe detalii"
                                >
                                  <PlatformLogo platform={p} size={14} className="shrink-0" />
                                  <span className="whitespace-nowrap leading-none">{info.label}</span>
                                </div>

                                {check?.disabled_categories?.length > 0 && (
                                  <span
                                    title={check.disabled_categories.join(', ')}
                                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 cursor-help"
                                  >
                                    {t('monitoring.cat_stop_badge', { count: check.disabled_categories.length })}
                                  </span>
                                )}

                                {validMissingProducts.length > 0 && (
                                  <span
                                    title={validMissingProducts.join(', ')}
                                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 cursor-help"
                                  >
                                    {t('monitoring.missing_badge', { count: validMissingProducts.length })}
                                  </span>
                                )}
                              </div>

                              {/* Rând 2 (maxim 2 rânduri per înregistrare): Control rază & îngustare zonă (GPS comenzi) */}
                              {zoneInfo && zoneInfo.active_radius_km > 0 && (
                                <span
                                  onClick={() => {
                                    if (check) setSelectedCheckDetail({ check: { ...check, ...(ratingInfo || {}), missing_products: validMissingProducts }, restaurant: r, platform: p, info, zoneInfo });
                                  }}
                                  title={
                                    language === 'ru'
                                      ? `Фактический радиус по GPS заказов: макс ${zoneInfo.active_radius_km} км / норма ${zoneInfo.normal_radius_km} км (средняя дальность ${zoneInfo.avg_distance_km} км, ${zoneInfo.orders_count} зак.)`
                                      : `Rază reală GPS comenzi: max ${zoneInfo.active_radius_km} km / normal ${zoneInfo.normal_radius_km} km (medie ${zoneInfo.avg_distance_km} km, ${zoneInfo.orders_count} com.)`
                                  }
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer tabular-nums whitespace-nowrap ${
                                    zoneInfo.is_narrowed
                                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                      : isDark
                                        ? 'bg-slate-800/80 text-slate-300 border-slate-700'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <MapPin size={9} className={zoneInfo.is_narrowed ? 'text-rose-500 shrink-0' : 'text-emerald-500 shrink-0'} />
                                  <span>
                                    {zoneInfo.is_narrowed
                                      ? `${Number(zoneInfo.active_radius_km).toFixed(1)}/${Number(zoneInfo.normal_radius_km).toFixed(1)} км (-${zoneInfo.narrowed_pct}%)`
                                      : `${language === 'ru' ? 'Радиус' : 'Rază'}: ${Number(zoneInfo.active_radius_km).toFixed(1)} км`}
                                  </span>
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Ultima verificare */}
                                    <td className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                                      {(() => {
                                        const checksForR = checks.filter(c => c.restaurant_id === r.id);
                                        if (checksForR.length === 0) return <span className="opacity-40">{t('common.never')}</span>;
                                        const latest = new Date(Math.max(...checksForR.map(c => new Date(c.checked_at).getTime())));
                                        const diffMins = Math.floor((Date.now() - latest.getTime()) / 60000);

                                        if (diffMins < 1) return <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t('common.now')}</span>;
                                        if (diffMins < 60) return `${diffMins}m`;
                                        const isSameDay = latest.toDateString() === new Date().toDateString();
                                        if (!isSameDay) {
                                          return latest.toLocaleString(localeCode, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                                        }
                                        return latest.toLocaleString(localeCode, { hour: '2-digit', minute: '2-digit' });
                                      })()}
                                    </td>
                                  </tr>
                  ))}
                                </tbody>
                              </table>
                            </div>

            {/* FOOTER PAGINARE */ }
                          <div className={`px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
                            }`}>
                            <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                              <div className="flex items-center gap-2">
                                <span>{t('common.rows')}</span>
                                <select
                                  value={rowsPerPage}
                                  onChange={e => setRowsPerPage(Number(e.target.value))}
                                  className={`h-8 px-3 rounded-full border text-xs font-bold outline-none cursor-pointer ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'
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
                                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  onClick={() => setPage(p => p - 1)}
                                  disabled={page === 1 || total === 0}
                                >
                                  <ChevronLeft size={16} />
                                </button>
                                <button
                                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
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
        </>
      )}

                {/* MODAL SCANARE GLOBAL */}
                {showReport && typeof document !== 'undefined' && createPortal(
                  <div
                    onClick={() => {
                      setShowReport(false);
                      if (!isVerifying) setVerifyStatus(null);
                    }}
                    className="fixed inset-0 m-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`rounded-2xl w-full max-w-md shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                    >
                      <div className={`relative p-6 text-center space-y-2.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowReport(false);
                            if (!isVerifying) setVerifyStatus(null);
                          }}
                          aria-label={t('common.close')}
                          className={`absolute top-4 right-4 w-8 h-8 rounded-full border flex items-center justify-center text-slate-400 transition-colors cursor-pointer ${isDark ? 'border-slate-700 hover:bg-slate-800 hover:text-white' : 'border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                            }`}
                        >
                          <X size={16} />
                        </button>

                        <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${isVerifying
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          }`}>
                          {isVerifying ? <Loader2 size={26} className="animate-spin" /> : <CheckCircle2 size={26} />}
                        </div>
                        <h3 className="text-lg font-bold">
                          {isVerifying ? t('monitoring.scan_modal_title_progress') : t('monitoring.scan_modal_title_done')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {isVerifying ? t('monitoring.scan_modal_desc_progress') : t('monitoring.scan_modal_desc_done')}
                        </p>
                      </div>

                      <div className="p-6 overflow-y-auto space-y-3">
                        {verifyStatus && (() => {
                          const pct = verifyStatus.totalChecks > 0
                            ? Math.min(100, Math.max(0, Math.round((verifyStatus.current / verifyStatus.totalChecks) * 100)))
                            : (isVerifying ? 0 : 100);
                          const lastItem = Array.isArray(verifyStatus.results) && verifyStatus.results.length > 0
                            ? verifyStatus.results[verifyStatus.results.length - 1]
                            : null;
                          return (
                            <>
                              {/* Progress Track cleanly contained inside padded modal body */}
                              <div className={`p-3.5 rounded-2xl border space-y-2 ${isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                                    {language === 'ru' ? 'Прогресс проверки' : language === 'en' ? 'Scan progress' : 'Progres verificare'}
                                  </span>
                                  <span className="font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                                    {pct}%
                                  </span>
                                </div>
                                <div className={`w-full h-2.5 rounded-full overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-200/80 border-slate-200'}`}>
                                  <div
                                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                {lastItem && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-full">
                                    {cleanRestaurantName(lastItem.restaurant)} · {String(lastItem.platform || '').toUpperCase()}
                                  </div>
                                )}
                              </div>

                              <div className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
                                }`}>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {t('monitoring.scan_modal_verified')}
                                </span>
                                <span className="text-base font-bold tabular-nums">
                                  <AnimatedNumber value={verifyStatus.current} key={verifyStatus.current} /> / {verifyStatus.totalChecks || '-'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30">
                                <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
                                  {t('monitoring.scan_modal_stopped')}
                                </span>
                                <span className="text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">
                                  <AnimatedNumber value={verifyStatus.offline} key={verifyStatus.offline} />
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className={`p-4 border-t flex items-center justify-between gap-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <div>
                          {isVerifying && (
                            <button
                              type="button"
                              onClick={handleStopVerify}
                              className="px-4 h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            >
                              <XCircle size={14} />
                              <span>{t('monitoring.stop_label')}</span>
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowReport(false);
                            if (!isVerifying) setVerifyStatus(null);
                          }}
                          className={`px-5 h-9 rounded-full text-xs sm:text-sm font-bold transition-colors cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                          {t('common.close')}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {/* MODAL DETALII VERIFICARE */}
                {selectedCheckDetail && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className={`rounded-2xl w-full max-w-lg shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}>

                      {/* Header */}
                      <div className={`px-6 py-5 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
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
                          className={`w-8 h-8 rounded-full border flex items-center justify-center text-slate-500 transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Body */}
                      <div className="p-6 overflow-y-auto space-y-4">

                        {/* Status Principal */}
                        <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'
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
                          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-200'
                            }`}>
                            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                              {t('monitoring.modal_store_open')}
                            </span>
                            <div className={`text-xl font-bold flex items-center gap-2 ${selectedCheckDetail.check.ui_is_open ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {selectedCheckDetail.check.ui_is_open ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                              {selectedCheckDetail.check.ui_is_open ? t('common.yes') : t('common.no')}
                            </div>
                          </div>
                          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-200'
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

                        {/* Confirmare live prin comenzi Syrve */}
                        {selectedCheckDetail.check.live_orders_today > 0 && (
                          <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${isDark ? 'bg-emerald-950/25 border-emerald-800/60' : 'bg-emerald-50/80 border-emerald-200'}`}>
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <div>
                                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                  {language === 'ru'
                                    ? (selectedCheckDetail.check.verified_via === 'kitchen_live_order'
                                      ? 'Подтверждено живыми заказами кухни (Syrve)'
                                      : 'Подтверждено живыми заказами Syrve сегодня')
                                    : language === 'en'
                                      ? 'Verified via live Syrve orders today'
                                      : (selectedCheckDetail.check.verified_via === 'kitchen_live_order'
                                        ? 'Confirmat prin comenzi live ale bucătăriei (Syrve)'
                                        : 'Confirmat prin comenzi live Syrve azi')}
                                </div>
                                <div className="text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                                  {selectedCheckDetail.check.last_order_at && (
                                    <>
                                      {language === 'ru' ? 'Последний заказ:' : language === 'en' ? 'Last order:' : 'Ultima comandă:'}{' '}
                                      {new Date(selectedCheckDetail.check.last_order_at).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold tabular-nums bg-emerald-600 text-white shrink-0">
                              {selectedCheckDetail.check.live_orders_today} {language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.'}
                            </span>
                          </div>
                        )}

                        {/* Контроль зоны и радиуса доставки (GPS заказов) */}
                        {selectedCheckDetail.zoneInfo && (
                          <div className={`p-4 rounded-2xl border space-y-2.5 ${selectedCheckDetail.zoneInfo.is_narrowed
                            ? isDark ? 'bg-rose-950/25 border-rose-800/60' : 'bg-rose-50/70 border-rose-200'
                            : isDark ? 'bg-emerald-950/20 border-emerald-800/50' : 'bg-emerald-50/60 border-emerald-200'
                            }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                <MapPin size={13} />
                                {language === 'ru' ? 'Радиус и зона доставки (GPS заказов)' : language === 'en' ? 'Delivery Zone & Radius (Order GPS)' : 'Rază & Zonă Livrare (GPS Comenzi)'}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${selectedCheckDetail.zoneInfo.is_narrowed
                                ? 'bg-rose-600 text-white'
                                : 'bg-emerald-600 text-white'
                                }`}>
                                {selectedCheckDetail.zoneInfo.is_narrowed
                                  ? (language === 'ru' ? `Сужение -${selectedCheckDetail.zoneInfo.narrowed_pct}%` : `Rază redusă -${selectedCheckDetail.zoneInfo.narrowed_pct}%`)
                                  : (language === 'ru' ? 'Полный радиус (100%)' : 'Rază completă (100%)')}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400 block">{language === 'ru' ? 'Макс. сегодня' : 'Max. azi'}</span>
                                <strong className="tabular-nums font-extrabold text-slate-900 dark:text-white">{selectedCheckDetail.zoneInfo.active_radius_km} км</strong>
                              </div>
                              <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400 block">{language === 'ru' ? 'Средняя дальность' : 'Distanță medie'}</span>
                                <strong className="tabular-nums font-extrabold text-blue-600 dark:text-blue-400">{selectedCheckDetail.zoneInfo.avg_distance_km} км</strong>
                              </div>
                              <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400 block">{language === 'ru' ? 'Норма точки' : 'Rază normală'}</span>
                                <strong className="tabular-nums font-extrabold text-emerald-600 dark:text-emerald-400">{selectedCheckDetail.zoneInfo.normal_radius_km} км</strong>
                              </div>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                              <span>{language === 'ru' ? 'По кольцам дальности:' : 'Pe inele de distanță:'}</span>
                              <span className="tabular-nums font-bold text-slate-700 dark:text-slate-200">
                                &lt;2км: {selectedCheckDetail.zoneInfo.under_2km} · 2–4км: {selectedCheckDetail.zoneInfo.between_2_4km} · 4+км: {selectedCheckDetail.zoneInfo.over_4km}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Rating General din rating_history (dacă există) */}
                        {selectedCheckDetail.check.rating > 0 && (
                          <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-amber-950/20 border-amber-800/50' : 'bg-amber-50/70 border-amber-200'
                            }`}>
                            <div>
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                                Rating General Public ({selectedCheckDetail.platform.toUpperCase()})
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {selectedCheckDetail.check.review_count ? `${selectedCheckDetail.check.review_count} evaluări totale` : 'Extras automat din pagina publică'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-sm font-black flex items-center gap-1">
                                <Star size={14} className="fill-white" />
                                {Number(selectedCheckDetail.check.rating).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        )}

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
                      <div className={`px-6 py-4 border-t flex justify-between items-center gap-4 ${isDark ? 'border-slate-800' : 'border-slate-100'
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

                {/* Modal Detalii Bon iiko (din Recenzii -> Dispecerat) */}
                <OrderDetailsModal
                  order={selectedOrderForModal}
                  isOpen={!!selectedOrderForModal}
                  onClose={() => setSelectedOrderForModal(null)}
                />

                {/* MODAL MECANISMUL 2A: CONECTARE EMAIL (jeka7ro@gmail.com) & PARSARE RECENZIE DIN MAIL */}
                {showEmailModal && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className={`rounded-2xl w-full max-w-xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}>
                      <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Mail size={18} />
                          </div>
                          <div>
                            <h3 className="text-base font-bold">Conectare Email Recenzii (jeka7ro@gmail.com)</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Extrage automat Restaurantul, Platforma, Nota, Comentariul și leagă de Comanda iiko</p>
                          </div>
                        </div>
                        <button onClick={() => setShowEmailModal(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={handleParseEmail} className="p-6 overflow-y-auto space-y-4">
                        {/* Auto-Forwarding Webhook Info */}
                        <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${isDark ? 'bg-slate-800/50 border-slate-700/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold uppercase tracking-wider text-[10px] text-emerald-600 dark:text-emerald-400">
                              ● Cont Conectat: jeka7ro@gmail.com (Glovo / Wolt / Bolt / Google)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/email-review`)
                                setCopiedWebhookUrl(true)
                                setTimeout(() => setCopiedWebhookUrl(false), 2000)
                              }}
                              className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              {copiedWebhookUrl ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                              <span>{copiedWebhookUrl ? 'Copiat!' : 'Copiază Webhook Mail'}</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Poți redirecționa automat emailurile pe <code className="tabular-nums font-bold">/api/webhooks/email-review</code> sau lipi mai jos orice email de recenzie primit pentru asociere instantă cu bonul din iiko:
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                            Subiect Email (ex: „New review on Glovo - Smash Me Constanța - Order #118248”)
                          </label>
                          <input
                            type="text"
                            value={emailSubject}
                            onChange={e => setEmailSubject(e.target.value)}
                            placeholder="Subiectul emailului primit pe jeka7ro@gmail.com..."
                            className={`w-full px-3.5 h-10 rounded-xl border text-xs font-medium outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                              }`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                            Conținutul / Textul Emailului de Recenzie
                          </label>
                          <textarea
                            rows={5}
                            value={emailBody}
                            onChange={e => setEmailBody(e.target.value)}
                            placeholder="Lipește aici corpul emailului (include ID-ul comenzii dacă apare în mail, nota 1-5⭐ sau /și comentariul clientului)..."
                            className={`w-full p-3.5 rounded-xl border text-xs font-medium outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                              }`}
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowEmailModal(false)}
                            className={`px-4 h-10 rounded-full text-xs font-bold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                              }`}
                          >
                            Anulează
                          </button>
                          <button
                            type="submit"
                            disabled={emailParsing}
                            className="px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {emailParsing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                            <span>Extrage Recenzia & Leagă de Bonul iiko</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* MODAL MECANISMUL 2B: SCRAPERE PUPPETEER PORTALURI B2B (GLOVO PARTNER & WOLT MERCHANT) */}
                {showScraperInfoModal && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className={`rounded-2xl w-full max-w-xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}>
                      <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <Bot size={18} />
                          </div>
                          <div>
                            <h3 className="text-base font-bold">Scrapere B2B — Glovo Partner & Wolt Merchant</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Extragere automată recenzii din contul master jeka7ro@gmail.com</p>
                          </div>
                        </div>
                        <button onClick={() => setShowScraperInfoModal(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                          <X size={16} />
                        </button>
                      </div>

                      <div className="p-6 overflow-y-auto space-y-4 text-xs">
                        <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <PlatformLogo platform="glovo" size={15} />
                            <span>1. Glovo Partner (GlovoPartnerScraper)</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            Încarcă sesiunea salvată din <code className="tabular-nums font-bold">glovo-cookies.json</code> pentru bypass 2FA/Cloudflare, accesează <code className="tabular-nums">portal.glovoapp.com/reviews/</code>, extrage recenziile din DOM și calculează sentimentul în română/engleză.
                          </p>
                          <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 tabular-nums text-[11px]">
                            node workers/src/scrapers/glv-init.js
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="font-extrabold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                            <PlatformLogo platform="wolt" size={15} />
                            <span>2. Wolt Merchant (WoltPartnerScraper)</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            Accesează <code className="tabular-nums">merchant.wolt.com/app/experience/search</code> cu <code className="tabular-nums font-bold">jeka7ro@gmail.com</code>, așteaptă confirmarea Magic Link pe email (2 minute) și extrage feedback-ul clienților.
                          </p>
                          <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 tabular-nums text-[11px]">
                            node workers/src/scrapers/run-reputation.js
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowScraperInfoModal(false)
                              fileInputRef.current?.click()
                            }}
                            className="px-4 h-10 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Upload size={14} />
                            <span>Sau Importă Raport Excel/CSV</span>
                          </button>

                          <button
                            type="button"
                            disabled={isScrapingPortals}
                            onClick={() => {
                              handleTriggerPortalScrapers()
                              setShowScraperInfoModal(false)
                            }}
                            className="px-5 h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isScrapingPortals ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                            <span>Pornește Scanarea Portalurilor Acum</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
            )
}
