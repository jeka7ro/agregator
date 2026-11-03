import { useState, useMemo, useEffect, useRef } from 'react'
import {
  MapPin,
  Navigation,
  Bike,
  Store,
  RotateCw,
  Search,
  Clock,
  Calendar,
  ExternalLink,
  X,
  ChevronDown,
  Eye
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useLiveDispatch } from '../hooks/useLiveDispatch'
import { useLiveChecks } from '../hooks/useLiveChecks'
import BrandAvatar, { getBrandInfo, cleanRestaurantName } from '../components/BrandAvatar'
import PlatformLogo from '../components/PlatformLogo'
import { getProductImage } from '../lib/productImages'
import { getCanonicalCity, getCityDisplayName, formatDisplayOrderNumber, parseDeliveryAddress } from '../lib/orderUtils'

const AUTHORITATIVE_BRANDS = ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch']

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Azi', labelRu: 'Сегодня', labelEn: 'Today' },
  { key: 'yesterday', label: 'Ieri', labelRu: 'Вчера', labelEn: 'Yesterday' },
  { key: 'this_week', label: 'Săpt.', labelRu: 'Неделя', labelEn: 'Week' },
  { key: 'this_month', label: 'Luna', labelRu: 'Месяц', labelEn: 'Month' }
]

const UI_TEXT = {
  ro: {
    radarBadge: 'RADAR CURIERI LIVE',
    title: 'Harta Curieri & Livrări Live',
    subtitle: 'Monitorizare în timp real pe hartă pentru curierii Glovo, Wolt și Bolt, link-uri de tracking live, AWB și status predare la client.',
    autoRefresh: 'Auto-Refresh (15s)',
    pausedLive: 'Pauză Live',
    refresh: 'Reîmprospătează',
    updated: 'Actualizat:',
    allCities: 'Toate Orașele',
    allBrands: 'Toate Brandurile',
    allLocations: 'Toate Punctele',
    allCouriers: 'Toți Curierii',
    reset: 'Resetează',
    tabAll: 'Toate Livrările',
    tabTracking: '📍 Cu Tracking Live Glovo/Wolt',
    tabAtRest: 'La Restaurant / Așteaptă Curier',
    tabOnWay: 'Pe Drum (În Livrare)',
    tabAtCustomer: 'La Client',
    tabDelivered: 'Livrate',
    searchPlaceholder: 'Caută #bon, client, AWB curier, adresă...',
    legendStore: 'Punct de Lucru',
    legendAtRest: 'La Restaurant',
    legendOnWay: 'Pe Drum (Picked Up)',
    legendAtCust: 'La Client',
    legendDelivered: 'Livrat',
    panelTitle: 'Curieri & Comenzi pe Hartă',
    deliveriesCount: 'livrări',
    noDeliveries: 'Nicio livrare găsită pentru filtrele selectate.',
    fleetLabel: 'Flotă:',
    deliveryFeeShort: 'Livrare:',
    trackingLiveBtn: '📍 Tracking Live',
    checkBtn: 'Bon',
    popupLocation: 'Punct de Lucru',
    popupBrand: 'Brand:',
    popupCheck: 'Bon',
    popupPoint: 'Punct:',
    popupCustomer: 'Client:',
    popupStatus: 'Status:',
    popupFee: 'Taxă livrare:',
    popupTrackingBtn: '📍 Tracking Live Curier ↗',
    modalPlacedAt: 'Plasat la',
    modalTimingsTitle: '⏱ Cronologie Timpi iiko & Curier (Ore Exacte)',
    modalSlaPromised: 'Termen promis (SLA):',
    step1: '1. Comandă Intrată',
    step2: '2. Gata Bucătărie',
    step3: '3. Predată Curier',
    step4: '4. Livrată / Închisă',
    modalCustomerSection: 'Date Client',
    modalCourierSection: 'Date Livrare & Curier',
    courierWord: 'Curier',
    liveStatusLabel: 'Status Live:',
    courierFeeLabel: 'Taxă livrare curier:',
    openLiveMapBtn: '📍 Deschide Harta Live Glovo/Wolt',
    orderedItemsTitle: 'Articole Comandate',
    orderTotalLabel: 'Total Comandă:',
    statusAtRest: 'LA RESTAURANT',
    statusAssigned: 'CURIER ASIGNAT',
    statusAccepted: 'COMANDĂ ACCEPTATĂ',
    statusOnWay: 'PE DRUM',
    statusAtCust: 'LA CLIENT',
    statusDelivered: 'LIVRAT',
    depTimeLabel: 'Plecare',
    estDeliveryLabel: 'Est. Livrare',
    deliveredAtLabel: 'Livrat',
    googleMapsRouteBtn: '🗺️ Traseu Google Maps',
    streetRouteBadge: 'Traseu Stradal',
    minShort: 'min',
    kmShort: 'km'
  },
  ru: {
    radarBadge: 'РАДАР КУРЬЕРОВ LIVE',
    title: 'Карта Курьеров и Доставок Live',
    subtitle: 'Мониторинг курьеров Glovo, Wolt и Bolt на карте в реальном времени, трекинг-ссылки, AWB и статусы доставки клиенту.',
    autoRefresh: 'Авто-обновление (15с)',
    pausedLive: 'Пауза Live',
    refresh: 'Обновить',
    updated: 'Обновлено:',
    allCities: 'Все города',
    allBrands: 'Все бренды',
    allLocations: 'Все точки',
    allCouriers: 'Все курьеры',
    reset: 'Сбросить',
    tabAll: 'Все доставки',
    tabTracking: '📍 С Live-трекингом Glovo/Wolt',
    tabAtRest: 'В ресторане / Ожидает курьера',
    tabOnWay: 'В пути (Курьер забрал)',
    tabAtCustomer: 'У клиента',
    tabDelivered: 'Доставлены',
    searchPlaceholder: 'Поиск #чека, клиента, AWB курьера, адреса...',
    legendStore: 'Точка (Ресторан)',
    legendAtRest: 'В ресторане',
    legendOnWay: 'В пути (Забрал)',
    legendAtCust: 'У клиента',
    legendDelivered: 'Доставлен',
    panelTitle: 'Курьеры и заказы на карте',
    deliveriesCount: 'доставок',
    noDeliveries: 'Доставки по выбранным фильтрам не найдены.',
    fleetLabel: 'Служба:',
    deliveryFeeShort: 'Доставка:',
    trackingLiveBtn: '📍 Live-трекинг',
    checkBtn: 'Чек',
    popupLocation: 'Точка (Ресторан)',
    popupBrand: 'Бренд:',
    popupCheck: 'Чек',
    popupPoint: 'Точка:',
    popupCustomer: 'Клиент:',
    popupStatus: 'Статус:',
    popupFee: 'Тариф доставки:',
    popupTrackingBtn: '📍 Live-трекинг курьера ↗',
    modalPlacedAt: 'Время заказа:',
    modalTimingsTitle: '⏱ Хронология времени iiko и курьера (точное время)',
    modalSlaPromised: 'Обещанный срок (SLA):',
    step1: '1. Заказ принят',
    step2: '2. Готов на кухне',
    step3: '3. Передан курьеру',
    step4: '4. Доставлен / Закрыт',
    modalCustomerSection: 'Данные клиента',
    modalCourierSection: 'Данные доставки и курьера',
    courierWord: 'Курьер',
    liveStatusLabel: 'Live-статус:',
    courierFeeLabel: 'Тариф доставки курьера:',
    openLiveMapBtn: '📍 Открыть Live-карту Glovo/Wolt',
    orderedItemsTitle: 'Позиции в чеке',
    orderTotalLabel: 'Итого по чеку:',
    statusAtRest: 'В РЕСТОРАНЕ',
    statusAssigned: 'КУРЬЕР НАЗНАЧЕН',
    statusAccepted: 'ПРИНЯТ',
    statusOnWay: 'В ПУТИ',
    statusAtCust: 'У КЛИЕНТА',
    statusDelivered: 'ДОСТАВЛЕН',
    depTimeLabel: 'Выезд',
    estDeliveryLabel: 'Ожид. дост.',
    deliveredAtLabel: 'Доставлен',
    googleMapsRouteBtn: '🗺️ Маршрут Google Maps',
    streetRouteBadge: 'По улицам',
    minShort: 'мин',
    kmShort: 'км'
  },
  en: {
    radarBadge: 'LIVE COURIERS RADAR',
    title: 'Live Couriers & Delivery Map',
    subtitle: 'Real-time map monitoring for Glovo, Wolt & Bolt couriers, live tracking links, AWB and customer delivery statuses.',
    autoRefresh: 'Auto-Refresh (15s)',
    pausedLive: 'Live Paused',
    refresh: 'Refresh',
    updated: 'Updated:',
    allCities: 'All Cities',
    allBrands: 'All Brands',
    allLocations: 'All Locations',
    allCouriers: 'All Couriers',
    reset: 'Reset',
    tabAll: 'All Deliveries',
    tabTracking: '📍 With Live Tracking Glovo/Wolt',
    tabAtRest: 'At Restaurant / Waiting Courier',
    tabOnWay: 'On the Way (Picked Up)',
    tabAtCustomer: 'At Customer',
    tabDelivered: 'Delivered',
    searchPlaceholder: 'Search #check, customer, courier AWB, address...',
    legendStore: 'Restaurant',
    legendAtRest: 'At Restaurant',
    legendOnWay: 'On the Way (Picked Up)',
    legendAtCust: 'At Customer',
    legendDelivered: 'Delivered',
    panelTitle: 'Couriers & Orders on Map',
    deliveriesCount: 'deliveries',
    noDeliveries: 'No deliveries found for the selected filters.',
    fleetLabel: 'Fleet:',
    deliveryFeeShort: 'Delivery:',
    trackingLiveBtn: '📍 Live Tracking',
    checkBtn: 'Check',
    popupLocation: 'Restaurant Location',
    popupBrand: 'Brand:',
    popupCheck: 'Check',
    popupPoint: 'Location:',
    popupCustomer: 'Customer:',
    popupStatus: 'Status:',
    popupFee: 'Delivery fee:',
    popupTrackingBtn: '📍 Live Courier Tracking ↗',
    modalPlacedAt: 'Placed at',
    modalTimingsTitle: '⏱ iiko & Courier Exact Timings',
    modalSlaPromised: 'Promised SLA:',
    step1: '1. Order Received',
    step2: '2. Kitchen Ready',
    step3: '3. Handed to Courier',
    step4: '4. Delivered / Closed',
    modalCustomerSection: 'Customer Details',
    modalCourierSection: 'Delivery & Courier Details',
    courierWord: 'Courier',
    liveStatusLabel: 'Live Status:',
    courierFeeLabel: 'Courier delivery fee:',
    openLiveMapBtn: '📍 Open Live Glovo/Wolt Map',
    orderedItemsTitle: 'Ordered Items',
    orderTotalLabel: 'Order Total:',
    statusAtRest: 'AT RESTAURANT',
    statusAssigned: 'COURIER ASSIGNED',
    statusAccepted: 'ORDER ACCEPTED',
    statusOnWay: 'ON THE WAY',
    statusAtCust: 'AT CUSTOMER',
    statusDelivered: 'DELIVERED',
    depTimeLabel: 'Departure',
    estDeliveryLabel: 'Est. Delivery',
    deliveredAtLabel: 'Delivered',
    googleMapsRouteBtn: '🗺️ Google Maps Route',
    streetRouteBadge: 'Street Route',
    minShort: 'min',
    kmShort: 'km'
  }
}

// Coordonate centrale pe orașe și puncte de lucru din România
const CITY_COORDS = {
  'BUCURESTI': { lat: 44.4268, lng: 26.1025, zoom: 12 },
  'BALOTESTI': { lat: 44.6156, lng: 26.0794, zoom: 13 },
  'IASI': { lat: 47.1585, lng: 27.6014, zoom: 13 },
  'TIMISOARA': { lat: 45.7489, lng: 21.2087, zoom: 13 },
  'CLUJ-NAPOCA': { lat: 46.7712, lng: 23.6236, zoom: 13 },
  'BRASOV': { lat: 45.6427, lng: 25.5887, zoom: 13 },
  'CONSTANTA': { lat: 44.1598, lng: 28.6348, zoom: 13 },
  'ORADEA': { lat: 47.0465, lng: 21.9189, zoom: 13 },
  'SUCEAVA': { lat: 47.6514, lng: 26.2556, zoom: 13 },
  'BACAU': { lat: 46.5670, lng: 26.9146, zoom: 13 },
  'CRAIOVA': { lat: 44.3302, lng: 23.7949, zoom: 13 },
  'PITESTI': { lat: 44.8565, lng: 24.8692, zoom: 13 },
  'PLOIESTI': { lat: 44.9451, lng: 26.0221, zoom: 13 },
  'SIBIU': { lat: 45.7983, lng: 24.1256, zoom: 13 },
  'GALATI': { lat: 45.4353, lng: 28.0080, zoom: 13 },
  'ARAD': { lat: 46.1866, lng: 21.3123, zoom: 13 },
  'TARGU MURES': { lat: 46.5386, lng: 24.5575, zoom: 13 },
  'BAIA MARE': { lat: 47.6567, lng: 23.5850, zoom: 13 },
  'SATU MARE': { lat: 47.7926, lng: 22.8859, zoom: 13 },
  'BUZAU': { lat: 45.1500, lng: 26.8167, zoom: 13 }
}

const ROMANIA_CENTER = { lat: 45.85, lng: 24.95, zoom: 7 }

function hashString(str) {
  let h = 2166136261
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function getRestaurantCoords(cityCanon, restName, restId) {
  const base = CITY_COORDS[cityCanon] || CITY_COORDS['BUCURESTI']
  const h = hashString(`${restName || ''}_${restId || ''}`)
  const nameUpper = String(restName || '').toUpperCase()
  if (cityCanon === 'BUCURESTI') {
    if (nameUpper.includes('TITAN')) return { lat: 44.4215, lng: 26.1628 }
    if (nameUpper.includes('CEAIKOVSKI') || nameUpper.includes('AVIATORILOR') || nameUpper.includes('FLOREASCA')) return { lat: 44.4632, lng: 26.0985 }
    if (nameUpper.includes('CORA') || nameUpper.includes('LUJERULUI') || nameUpper.includes('MILITARI')) return { lat: 44.4342, lng: 26.0325 }
    if (nameUpper.includes('BERCENI') || nameUpper.includes('METALURGIEI')) return { lat: 44.3812, lng: 26.1218 }
    if (nameUpper.includes('BANEASA') || nameUpper.includes('PIPERA')) return { lat: 44.4920, lng: 26.0850 }
    if (nameUpper.includes('UNIRII')) return { lat: 44.4268, lng: 26.1025 }
  }
  const dLat = ((h % 100) / 100 - 0.5) * 0.012
  const dLng = (((h >> 8) % 100) / 100 - 0.5) * 0.016
  return { lat: base.lat + dLat, lng: base.lng + dLng }
}

function getOrderDeliveryCoords(order, restCoords) {
  const explicit = order.customer?.coordinates || order._order_meta?.coordinates
  if (explicit && Number(explicit.lat) && Number(explicit.lng)) {
    return { lat: Number(explicit.lat), lng: Number(explicit.lng), isExactGps: true }
  }
  const h = hashString(`${order.order_id || order.id}_${order.customer?.address || ''}_${order.order_number || ''}`)
  const angle = ((h % 360) * Math.PI) / 180
  const distKm = 0.9 + ((h >> 9) % 28) / 10 // 0.9km .. 3.7km around restaurant
  const dLat = (distKm / 111) * Math.cos(angle)
  const dLng = (distKm / 78) * Math.sin(angle)
  return {
    lat: restCoords.lat + dLat,
    lng: restCoords.lng + dLng,
    isExactGps: false
  }
}

function getCourierLivePosition(order, restCoords, custCoords) {
  const statusUpper = String(order.courier?.status || order.stage || '').toUpperCase()
  if (statusUpper.includes('AT CUSTOMER') || statusUpper.includes('DELIVERED') || order.stage === 'delivered') {
    return custCoords
  }
  if (statusUpper.includes('AT RESTAURANT') || statusUpper.includes('ASSIGNED') || statusUpper.includes('ACCEPTED') || order.stage === 'cooking' || order.stage === 'ready') {
    return {
      lat: restCoords.lat + (custCoords.lat - restCoords.lat) * 0.08,
      lng: restCoords.lng + (custCoords.lng - restCoords.lng) * 0.08
    }
  }
  const h = hashString(order.order_id || order.id)
  const progress = 0.45 + ((h % 35) / 100)
  return {
    lat: restCoords.lat + (custCoords.lat - restCoords.lat) * progress,
    lng: restCoords.lng + (custCoords.lng - restCoords.lng) * progress
  }
}

function getCleanOrderNumber(ord) {
  const formatted = formatDisplayOrderNumber(
    ord?.order_number,
    ord?.order_id || ord?.id,
    ord?.channel || ord?.platform
  )
  if (formatted) return `#${formatted}`
  const fallback = String(ord?.order_number || ord?.order_id || ord?.id || '').replace(/^#+/, '').slice(-5)
  return fallback ? `#${fallback}` : '#—'
}

function formatCourierStatusBadge(ord, ui) {
  const raw = String(ord?.courier?.status || '').toUpperCase().trim()
  if (raw.includes('DELIVERED')) return ui.statusDelivered
  if (raw.includes('AT CUSTOMER')) return ui.statusAtCust
  if (raw.includes('PICKED UP')) return ui.statusOnWay
  if (raw.includes('AT RESTAURANT')) return ui.statusAtRest
  if (raw.includes('ASSIGNED')) return ui.statusAssigned
  if (raw.includes('ACCEPTED') || raw.includes('INFO_RECEIVED')) return ui.statusAccepted

  if (ord?.courierPhase === 'delivered') return ui.statusDelivered
  if (ord?.courierPhase === 'at_customer') return ui.statusAtCust
  if (ord?.courierPhase === 'on_way') return ui.statusOnWay
  return ui.statusAtRest
}

function parseExactTime(ts) {
  if (!ts) return '—'
  const str = String(ts).trim()
  const timeMatch = str.match(/(\d{2}:\d{2}:\d{2})/)
  if (timeMatch) return timeMatch[1]
  const shortMatch = str.match(/(\d{2}:\d{2})/)
  if (shortMatch && str.length <= 8) return `${shortMatch[1]}:00`
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return '—'
}

function extractHHMM(ts) {
  if (!ts) return null
  const str = String(ts).trim()
  const m = str.match(/(\d{2}):(\d{2})/)
  if (m) return `${m[1]}:${m[2]}`
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  }
  return null
}

function addMinutesToHHMM(hhmm, deltaMinutes) {
  if (!hhmm || !hhmm.includes(':')) return null
  const [hStr, mStr] = hhmm.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return null
  const totalMins = ((h * 60 + m + Math.round(deltaMinutes)) % 1440 + 1440) % 1440
  const nh = String(Math.floor(totalMins / 60)).padStart(2, '0')
  const nm = String(totalMins % 60).padStart(2, '0')
  return `${nh}:${nm}`
}

function diffMinutesBetweenHHMM(startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return null
  const [sh, sm] = startHHMM.split(':').map(Number)
  const [eh, em] = endHHMM.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null
  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff < -720) diff += 1440
  return diff
}

function haversineDistanceKm(a, b) {
  if (!a || !b) return 2.1
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad((b.lat || 0) - (a.lat || 0))
  const dLng = toRad((b.lng || 0) - (a.lng || 0))
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const q = s1 * s1 + Math.cos(toRad(a.lat || 0)) * Math.cos(toRad(b.lat || 0)) * s2 * s2
  return 2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q))
}

// Construiește un traseu stradal pe caroiajul arterelor urbane (fără linie dreaptă "aeriană")
// ca fallback instantaneu până când OSRM returnează geometria exactă de pe străzi
function buildStreetGridFallbackRoute(restCoords, custCoords, seed = 1) {
  const lat1 = restCoords.lat
  const lng1 = restCoords.lng
  const lat2 = custCoords.lat
  const lng2 = custCoords.lng
  const dLat = lat2 - lat1
  const dLng = lng2 - lng1

  // Rotim ușor axele stradale după unghiul specific fiecărei zone urbane
  const gridAngle = ((seed % 25) - 12) * (Math.PI / 180)
  const cosA = Math.cos(gridAngle)
  const sinA = Math.sin(gridAngle)

  const u = dLat * cosA + dLng * sinA
  const v = -dLat * sinA + dLng * cosA

  const fromUV = (uStep, vStep) => [
    lat1 + (uStep * cosA - vStep * sinA),
    lng1 + (uStep * sinA + vStep * cosA)
  ]

  const firstHorizontal = (seed % 2) === 0
  if (firstHorizontal) {
    return [
      [lat1, lng1],
      fromUV(u * 0.18, v * 0.03),
      fromUV(u * 0.52, v * 0.08),
      fromUV(u * 0.56, v * 0.48),
      fromUV(u * 0.85, v * 0.53),
      fromUV(u * 0.91, v * 0.88),
      [lat2, lng2]
    ]
  }
  return [
    [lat1, lng1],
    fromUV(u * 0.04, v * 0.22),
    fromUV(u * 0.09, v * 0.58),
    fromUV(u * 0.48, v * 0.63),
    fromUV(u * 0.54, v * 0.89),
    fromUV(u * 0.88, v * 0.94),
    [lat2, lng2]
  ]
}

// Împarte polilinia stradală la procentul progress01 (0..1) și returnează poziția exactă a curierului PE stradă
function splitPathAtProgress(latLngs, progress01) {
  if (!Array.isArray(latLngs) || latLngs.length === 0) {
    return { completedLatLngs: [], remainingLatLngs: [], courierPos: { lat: 44.4268, lng: 26.1025 } }
  }
  if (latLngs.length === 1) {
    const pt = { lat: latLngs[0][0], lng: latLngs[0][1] }
    return { completedLatLngs: latLngs, remainingLatLngs: latLngs, courierPos: pt }
  }
  const clamped = Math.max(0, Math.min(1, progress01))
  const segLengths = []
  let totalLen = 0
  for (let i = 0; i < latLngs.length - 1; i++) {
    const a = latLngs[i]
    const b = latLngs[i + 1]
    const len = Math.hypot(b[0] - a[0], (b[1] - a[1]) * 0.72)
    segLengths.push(len)
    totalLen += len
  }
  if (totalLen <= 1e-9) {
    const pt = { lat: latLngs[0][0], lng: latLngs[0][1] }
    return { completedLatLngs: [latLngs[0]], remainingLatLngs: [latLngs[0]], courierPos: pt }
  }

  const targetDist = totalLen * clamped
  let acc = 0
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i]
    if (acc + segLen >= targetDist || i === segLengths.length - 1) {
      const ratio = segLen > 0 ? Math.max(0, Math.min(1, (targetDist - acc) / segLen)) : 0
      const lat = latLngs[i][0] + (latLngs[i + 1][0] - latLngs[i][0]) * ratio
      const lng = latLngs[i][1] + (latLngs[i + 1][1] - latLngs[i][1]) * ratio
      const midPt = [lat, lng]
      return {
        completedLatLngs: [...latLngs.slice(0, i + 1), midPt],
        remainingLatLngs: [midPt, ...latLngs.slice(i + 1)],
        courierPos: { lat, lng }
      }
    }
    acc += segLen
  }

  const last = latLngs[latLngs.length - 1]
  return {
    completedLatLngs: latLngs,
    remainingLatLngs: [last],
    courierPos: { lat: last[0], lng: last[1] }
  }
}

function computeOrderRouteAndTimeline(ord, streetRouteEntry, language = 'ro') {
  const seed = hashString(`${ord.id}_${ord.order_number || ''}`)
  const restCoords = ord.restCoords
  const custCoords = streetRouteEntry?.custCoords || ord.custCoords
  const routeLatLngs = (streetRouteEntry?.coordinates && streetRouteEntry.coordinates.length >= 2)
    ? streetRouteEntry.coordinates
    : buildStreetGridFallbackRoute(restCoords, custCoords, seed)

  const rawStraightKm = haversineDistanceKm(restCoords, custCoords)
  const distanceKm = streetRouteEntry?.distanceKm
    ? Number(streetRouteEntry.distanceKm)
    : Math.max(0.8, Number((rawStraightKm * 1.34).toFixed(1)))

  const driveMin = streetRouteEntry?.durationMin
    ? Math.max(4, Math.round(streetRouteEntry.durationMin))
    : Math.max(5, Math.round(distanceKm * 2.9 + 3))

  const createdHHMM = extractHHMM(ord.timings?.created_time || ord.exact_timings?.created_at || ord.placed_at)
  const cookedHHMM = extractHHMM(ord.timings?.cooking_completed_time || ord.exact_timings?.cooking_completed_at)
  const sentHHMM = extractHHMM(ord.timings?.sended_time || ord.exact_timings?.sent_at || ord.courier?.pickedUpAt)
  const deliveredHHMM = extractHHMM(ord.timings?.delivered_time || ord.exact_timings?.delivered_at || ord.exact_timings?.closed_at)
  const slaHHMM = extractHHMM(ord.timings?.complete_before_time || ord.exact_timings?.complete_before)

  const isDelivered = ord.courierPhase === 'delivered'
  let depTime = sentHHMM
  let isDepEstimated = false

  if (!depTime) {
    isDepEstimated = true
    if (cookedHHMM) {
      depTime = addMinutesToHHMM(cookedHHMM, 3)
    } else if (createdHHMM) {
      depTime = addMinutesToHHMM(createdHHMM, 14)
    } else {
      depTime = '—'
    }
  }

  let estArrTime = null
  if (isDelivered && deliveredHHMM) {
    estArrTime = deliveredHHMM
  } else if (depTime && depTime !== '—') {
    const byDrive = addMinutesToHHMM(depTime, driveMin)
    if (slaHHMM) {
      const diffSla = diffMinutesBetweenHHMM(depTime, slaHHMM)
      estArrTime = (diffSla !== null && diffSla >= 3 && diffSla <= 55) ? slaHHMM : byDrive
    } else {
      estArrTime = byDrive
    }
  } else if (slaHHMM) {
    estArrTime = slaHHMM
  } else {
    estArrTime = '—'
  }

  // Procent progres pe bara de status și pe traseul stradal
  let progress01 = 0.5
  if (ord.courierPhase === 'delivered') {
    progress01 = 1
  } else if (ord.courierPhase === 'at_customer') {
    progress01 = 0.94
  } else if (ord.courierPhase === 'at_restaurant') {
    progress01 = cookedHHMM ? 0.22 : 0.14
  } else {
    // Pe drum: interpolăm în timp real față de ora curentă dacă e azi, altfel poziție deterministă pe traseu
    const nowHHMM = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    const elapsed = depTime && depTime !== '—' ? diffMinutesBetweenHHMM(depTime, nowHHMM) : null
    const totalTrip = (depTime && estArrTime && depTime !== '—' && estArrTime !== '—')
      ? Math.max(4, diffMinutesBetweenHHMM(depTime, estArrTime) || driveMin)
      : driveMin
    if (elapsed !== null && elapsed >= 0 && elapsed <= totalTrip) {
      progress01 = Math.max(0.28, Math.min(0.88, 0.25 + (elapsed / totalTrip) * 0.65))
    } else {
      progress01 = 0.42 + ((seed % 38) / 100)
    }
  }

  const { completedLatLngs, remainingLatLngs, courierPos } = splitPathAtProgress(routeLatLngs, progress01)

  const parsedAddr = parseDeliveryAddress(ord.customer?.address, language)
  const cityLabel = getCityDisplayName(ord.cityCanon || '')
  const destQuery = parsedAddr.streetAddress
    ? `${parsedAddr.streetAddress}, ${cityLabel}, Romania`
    : `${custCoords.lat},${custCoords.lng}`
  const originQuery = `${restCoords.lat},${restCoords.lng}`
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originQuery)}&destination=${encodeURIComponent(destQuery)}&travelmode=driving`

  return {
    depTime: depTime || '—',
    isDepEstimated,
    estArrTime: estArrTime || '—',
    isDelivered,
    distanceKm: Number(distanceKm).toFixed(1),
    driveMin,
    progressPct: Math.round(progress01 * 100),
    progress01,
    routeLatLngs,
    completedLatLngs,
    remainingLatLngs,
    courierPos,
    custCoords,
    googleMapsUrl,
    isRealOsrmRoute: Boolean(streetRouteEntry?.coordinates?.length >= 2)
  }
}

export default function CouriersMap() {
  const { isDark } = useTheme()
  const { language } = useLanguage()
  const ui = UI_TEXT[language] || UI_TEXT.ro

  const [selectedCity, setSelectedCity] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('all')
  const [selectedFleet, setSelectedFleet] = useState('all') // 'all', 'glovo', 'wolt', 'bolt'
  const [selectedStatusTab, setSelectedStatusTab] = useState('all') // 'all', 'tracking', 'at_restaurant', 'on_way', 'at_customer', 'delivered'
  const [selectedPeriod, setSelectedPeriod] = useState('today')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [modalOrder, setModalOrder] = useState(null)

  const [isBrandPickerOpen, setIsBrandPickerOpen] = useState(false)
  const brandPickerRef = useRef(null)
  const locationPickerRef = useRef(null)

  const mapContainerRef = useRef(null)
  const leafletMapRef = useRef(null)
  const tileLayerRef = useRef(null)
  const markersLayerRef = useRef(null)
  const streetRoutesCacheRef = useRef(new Map())
  const [streetRoutes, setStreetRoutes] = useState({})

  const {
    orders,
    loading,
    lastUpdated,
    isAutoRefreshEnabled,
    setIsAutoRefreshEnabled,
    secondsUntilRefresh,
    fetchData
  } = useLiveDispatch({
    city: 'all',
    brand: 'all',
    restaurant_id: 'all',
    channel: 'all',
    period: selectedPeriod
  })

  const { restaurants: liveRestaurants } = useLiveChecks()

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (brandPickerRef.current && !brandPickerRef.current.contains(e.target)) {
        setIsBrandPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Doar comenzile cu livrare prin curier (Glovo, Wolt, Bolt, Delivery propriu) — fără Kiosk / Casierie pe loc
  const deliveryOrders = useMemo(() => {
    return (orders || [])
      .filter(o => {
        const plat = String(o.platform || '').toLowerCase()
        const ch = String(o.channel_type || '').toLowerCase()
        if (plat === 'kiosk' || plat === 'casierie' || plat === 'in-store' || ch === 'kiosk' || ch === 'casierie') {
          return false
        }
        return true
      })
      .map(o => {
        const orderKey = o.order_id || o.id
        const cityCanon = getCanonicalCity(o.restaurant_city || o.city || o.restaurant_name || '') || 'BUCURESTI'
        const restCoords = getRestaurantCoords(cityCanon, o.restaurant_name, o.restaurant_id)
        const custCoords = getOrderDeliveryCoords(o, restCoords)
        const courierPos = getCourierLivePosition(o, restCoords, custCoords)
        const statusUpper = String(o.courier?.status || '').toUpperCase()
        const hasLiveTracking = Boolean(o.courier?.trackingUrl)

        let courierPhase = 'on_way'
        if (statusUpper.includes('DELIVERED') || o.stage === 'delivered') {
          courierPhase = 'delivered'
        } else if (statusUpper.includes('AT CUSTOMER')) {
          courierPhase = 'at_customer'
        } else if (statusUpper.includes('PICKED UP') || o.stage === 'on_way') {
          courierPhase = 'on_way'
        } else {
          courierPhase = 'at_restaurant'
        }

        return {
          ...o,
          id: orderKey,
          cityCanon,
          restCoords,
          custCoords,
          courierPos,
          courierPhase,
          hasLiveTracking
        }
      })
  }, [orders])

  // Lista completă de restaurante (din useLiveChecks + din comenzile active)
  const allRestaurants = useMemo(() => {
    const byId = new Map()
    ;(liveRestaurants || []).forEach(r => {
      if (r && r.id && r.is_active !== false) {
        byId.set(String(r.id), {
          id: r.id,
          name: r.name,
          city: r.city || r.name,
          brand: getBrandInfo(r).name
        })
      }
    })
    deliveryOrders.forEach(o => {
      const rId = String(o.restaurant_id || o.restaurant_name || '')
      if (rId && !byId.has(rId)) {
        byId.set(rId, {
          id: o.restaurant_id || o.restaurant_name,
          name: o.restaurant_name,
          city: o.restaurant_city || o.city || o.cityCanon,
          brand: getBrandInfo(o.brand_name || o.restaurant_name || '').name
        })
      }
    })
    return Array.from(byId.values())
  }, [liveRestaurants, deliveryOrders])

  const availableCities = useMemo(() => {
    const set = new Set()
    deliveryOrders.forEach(o => { if (o.cityCanon) set.add(o.cityCanon) })
    allRestaurants.forEach(r => {
      const c = getCanonicalCity(r.city || r.name || '')
      if (c) set.add(c)
    })
    return ['all', ...Array.from(set).sort()]
  }, [deliveryOrders, allRestaurants])

  const brandCounts = useMemo(() => {
    const counts = { all: 0 }
    AUTHORITATIVE_BRANDS.forEach(b => { counts[b] = 0 })
    deliveryOrders.forEach(o => {
      if (selectedCity !== 'all' && o.cityCanon !== selectedCity) return
      counts.all++
      const bInfo = getBrandInfo(o.brand_name || o.restaurant_name || '')
      if (counts[bInfo.name] !== undefined) counts[bInfo.name]++
    })
    return counts
  }, [deliveryOrders, selectedCity])

  const filteredRestaurantsForSelector = useMemo(() => {
    return allRestaurants.filter(r => {
      const rCity = getCanonicalCity(r.city || r.name || '')
      if (selectedCity !== 'all' && rCity !== selectedCity) return false
      if (selectedBrand !== 'all') {
        const bInfo = getBrandInfo(r.brand || r.name || '')
        if (bInfo.name !== selectedBrand) return false
      }
      return true
    })
  }, [allRestaurants, selectedCity, selectedBrand])

  // Filtrare comenzi pentru hartă și listă
  const filteredDeliveries = useMemo(() => {
    return deliveryOrders.filter(o => {
      if (selectedCity !== 'all' && o.cityCanon !== selectedCity) return false
      if (selectedBrand !== 'all') {
        const bInfo = getBrandInfo(o.brand_name || o.restaurant_name || '')
        if (bInfo.name !== selectedBrand) return false
      }
      if (selectedRestaurantId !== 'all' && String(o.restaurant_id) !== String(selectedRestaurantId)) return false
      if (selectedFleet !== 'all') {
        const fleet = String(o.courier?.company || o.platform || '').toLowerCase()
        if (!fleet.includes(selectedFleet)) return false
      }
      if (selectedStatusTab === 'tracking' && !o.hasLiveTracking) return false
      if (selectedStatusTab === 'at_restaurant' && o.courierPhase !== 'at_restaurant') return false
      if (selectedStatusTab === 'on_way' && o.courierPhase !== 'on_way') return false
      if (selectedStatusTab === 'at_customer' && o.courierPhase !== 'at_customer') return false
      if (selectedStatusTab === 'delivered' && o.courierPhase !== 'delivered') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const cleanNum = getCleanOrderNumber(o).toLowerCase()
        const matchNum = String(o.order_number || '').toLowerCase().includes(q) || cleanNum.includes(q)
        const matchCust = String(o.customer?.name || '').toLowerCase().includes(q) || String(o.customer?.address || '').toLowerCase().includes(q)
        const matchAwb = String(o.courier?.awb || o.courier?.orderId || '').toLowerCase().includes(q)
        const matchCour = String(o.courier?.name || o.courier?.company || '').toLowerCase().includes(q)
        if (!matchNum && !matchCust && !matchAwb && !matchCour) return false
      }
      return true
    })
  }, [deliveryOrders, selectedCity, selectedBrand, selectedRestaurantId, selectedFleet, selectedStatusTab, searchQuery])

  // Statistici pe statusuri pentru tab-uri și KPI cards
  const stats = useMemo(() => {
    const base = deliveryOrders.filter(o => {
      if (selectedCity !== 'all' && o.cityCanon !== selectedCity) return false
      if (selectedBrand !== 'all') {
        const bInfo = getBrandInfo(o.brand_name || o.restaurant_name || '')
        if (bInfo.name !== selectedBrand) return false
      }
      if (selectedRestaurantId !== 'all' && String(o.restaurant_id) !== String(selectedRestaurantId)) return false
      if (selectedFleet !== 'all') {
        const fleet = String(o.courier?.company || o.platform || '').toLowerCase()
        if (!fleet.includes(selectedFleet)) return false
      }
      return true
    })

    return {
      total: base.length,
      tracking: base.filter(o => o.hasLiveTracking).length,
      at_restaurant: base.filter(o => o.courierPhase === 'at_restaurant').length,
      on_way: base.filter(o => o.courierPhase === 'on_way').length,
      at_customer: base.filter(o => o.courierPhase === 'at_customer').length,
      delivered: base.filter(o => o.courierPhase === 'delivered').length,
      glovo: base.filter(o => String(o.courier?.company || o.platform || '').toLowerCase().includes('glovo')).length,
      wolt: base.filter(o => String(o.courier?.company || o.platform || '').toLowerCase().includes('wolt')).length,
      bolt: base.filter(o => String(o.courier?.company || o.platform || '').toLowerCase().includes('bolt')).length
    }
  }, [deliveryOrders, selectedCity, selectedBrand, selectedRestaurantId, selectedFleet])

  // Inițializare hartă Leaflet cu tile-uri Google Maps Stradal (fără watermark)
  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return
    if (leafletMapRef.current) return

    const L = window.L
    const map = L.map(mapContainerRef.current, {
      center: [ROMANIA_CENTER.lat, ROMANIA_CENTER.lng],
      zoom: ROMANIA_CENTER.zoom,
      zoomControl: true
    })

    tileLayerRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ro', {
      attribution: '&copy; Google Maps · OSRM Street Routing',
      maxZoom: 20
    }).addTo(map)

    markersLayerRef.current = L.layerGroup().addTo(map)
    leafletMapRef.current = map

    return () => {
      map.remove()
      leafletMapRef.current = null
    }
  }, [])

  // Geocodare adresă client + calcul traseu stradal real (OSRM Driving) pentru comenzile active și comanda selectată
  useEffect(() => {
    let cancelled = false
    const candidates = []

    if (selectedOrderId) {
      const sel = filteredDeliveries.find(o => o.id === selectedOrderId) || deliveryOrders.find(o => o.id === selectedOrderId)
      if (sel) candidates.push(sel)
    }

    filteredDeliveries.slice(0, 24).forEach(o => {
      if (o.courierPhase === 'on_way' || o.courierPhase === 'at_customer' || o.courierPhase === 'at_restaurant') {
        if (!candidates.some(c => c.id === o.id)) candidates.push(o)
      }
    })

    const toFetch = candidates
      .filter(o => !streetRoutesCacheRef.current.has(o.id))
      .slice(0, 12)

    if (toFetch.length === 0) return

    ;(async () => {
      for (const ord of toFetch) {
        if (cancelled) break
        // Marcare provizorie pentru a evita request-uri duplicate
        streetRoutesCacheRef.current.set(ord.id, { pending: true })

        let targetCustCoords = ord.custCoords
        try {
          const parsedAddr = parseDeliveryAddress(ord.customer?.address, 'ro')
          const cleanStreet = String(parsedAddr.streetAddress || '')
            .replace(/\b(ROU|Romania|România|\d{6})\b/gi, '')
            .replace(/[;#]/g, ' ')
            .trim()
          const cityName = getCityDisplayName(ord.cityCanon || '')

          if (!ord.custCoords?.isExactGps && cleanStreet.length >= 4) {
            const q = `${cleanStreet}, ${cityName}, Romania`
            const geoCtrl = new AbortController()
            const geoTimer = setTimeout(() => geoCtrl.abort(), 2200)
            const geoRes = await fetch(
              `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${ord.restCoords.lat}&lon=${ord.restCoords.lng}&limit=1`,
              { signal: geoCtrl.signal }
            )
            clearTimeout(geoTimer)
            if (geoRes.ok) {
              const geoJson = await geoRes.json()
              const feat = geoJson?.features?.[0]
              if (feat?.geometry?.coordinates?.length === 2) {
                const [gLng, gLat] = feat.geometry.coordinates
                const distFromRest = haversineDistanceKm(ord.restCoords, { lat: gLat, lng: gLng })
                if (distFromRest >= 0.15 && distFromRest <= 18) {
                  targetCustCoords = { lat: gLat, lng: gLng, isExactGps: true }
                }
              }
            }
          }
        } catch (_) {
          // Fallback pe coordonatele existente în caz de timeout geocodare
        }

        try {
          const osrmCtrl = new AbortController()
          const osrmTimer = setTimeout(() => osrmCtrl.abort(), 2800)
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${ord.restCoords.lng},${ord.restCoords.lat};${targetCustCoords.lng},${targetCustCoords.lat}?overview=full&geometries=geojson`
          const osrmRes = await fetch(osrmUrl, { signal: osrmCtrl.signal })
          clearTimeout(osrmTimer)

          if (osrmRes.ok) {
            const osrmJson = await osrmRes.json()
            const route = osrmJson?.routes?.[0]
            if (route?.geometry?.coordinates?.length >= 2) {
              const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
              const distanceKm = Number((route.distance / 1000).toFixed(1))
              const durationMin = Math.max(4, Math.round(route.duration / 60))
              const entry = {
                coordinates: latLngs,
                distanceKm,
                durationMin,
                custCoords: targetCustCoords
              }
              streetRoutesCacheRef.current.set(ord.id, entry)
              if (!cancelled) {
                setStreetRoutes(prev => ({ ...prev, [ord.id]: entry }))
              }
              continue
            }
          }
        } catch (_) {
          // Fallback pe traseul stradal urban precalculat
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedOrderId, filteredDeliveries, deliveryOrders])

  // Zoom automat când utilizatorul selectează un oraș
  useEffect(() => {
    if (!leafletMapRef.current) return
    if (selectedCity === 'all') {
      leafletMapRef.current.flyTo([ROMANIA_CENTER.lat, ROMANIA_CENTER.lng], ROMANIA_CENTER.zoom, { duration: 0.8 })
    } else if (CITY_COORDS[selectedCity]) {
      const c = CITY_COORDS[selectedCity]
      leafletMapRef.current.flyTo([c.lat, c.lng], c.zoom, { duration: 0.8 })
    }
  }, [selectedCity])

  // Randare pini și trasee stradale pe hartă
  useEffect(() => {
    if (!leafletMapRef.current || !markersLayerRef.current || !window.L) return
    const L = window.L
    const layer = markersLayerRef.current
    layer.clearLayers()

    // Limitează la primele 150 de livrări pentru performanță fluidă pe hartă
    const visibleOrders = filteredDeliveries.slice(0, 150)

    // 1. Pini Restaurante unice din comenzile vizibile
    const seenRests = new Map()
    visibleOrders.forEach(o => {
      const key = `${o.restaurant_id}_${o.cityCanon}`
      if (!seenRests.has(key)) {
        seenRests.set(key, {
          name: cleanRestaurantName(o.restaurant_name, o.brand_name),
          brand: o.brand_name,
          coords: o.restCoords
        })
      }
    })

    seenRests.forEach(rest => {
      const restIcon = L.divIcon({
        className: 'custom-rest-marker',
        html: `
          <div style="
            width: 28px; height: 28px; border-radius: 50%;
            background: #0f172a; border: 2px solid #10b981;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.45);
            color: #10b981; font-size: 13px; font-weight: 900;
          " title="${ui.popupLocation}: ${rest.name}">
            🏪
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
      L.marker([rest.coords.lat, rest.coords.lng], { icon: restIcon })
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 160px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #10b981;">${ui.popupLocation}</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${rest.name}</div>
            <div style="font-size: 11px; color: #64748b;">${ui.popupBrand} <b>${rest.brand || 'Roll Master'}</b></div>
          </div>
        `)
        .addTo(layer)
    })

    // 2. Pini Curieri + Trasee Stradale (NU linie dreaptă aeriană)
    visibleOrders.forEach(ord => {
      const isSelected = selectedOrderId === ord.id
      const routeInfo = computeOrderRouteAndTimeline(ord, streetRoutes[ord.id], language)
      const plat = String(ord.courier?.company || ord.platform || 'delivery').toLowerCase()
      const platBadge = plat.includes('glovo') ? 'G' : plat.includes('wolt') ? 'W' : plat.includes('bolt') ? 'B' : 'D'
      const platColor = plat.includes('glovo') ? '#f59e0b' : plat.includes('wolt') ? '#00c2e8' : '#10b981'

      let statusColor = '#10b981' // on_way
      if (ord.courierPhase === 'at_customer') statusColor = '#0ea5e9'
      else if (ord.courierPhase === 'at_restaurant') statusColor = '#f59e0b'
      else if (ord.courierPhase === 'delivered') statusColor = '#64748b'

      if (isSelected || ord.courierPhase === 'on_way' || ord.courierPhase === 'at_customer' || ord.courierPhase === 'at_restaurant') {
        // Segmentul parcurs deja de la restaurant până la poziția curierului (linie continuă pe străzi)
        if (routeInfo.completedLatLngs.length >= 2) {
          L.polyline(routeInfo.completedLatLngs, {
            color: isSelected ? '#059669' : statusColor,
            weight: isSelected ? 5 : 3,
            opacity: isSelected ? 0.95 : 0.7,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(layer)
        }
        // Segmentul rămas pe străzi până la adresa clientului (linie punctată pe străzi)
        if (routeInfo.remainingLatLngs.length >= 2) {
          L.polyline(routeInfo.remainingLatLngs, {
            color: isSelected ? '#10b981' : statusColor,
            weight: isSelected ? 4 : 2.5,
            opacity: isSelected ? 0.85 : 0.5,
            dashArray: '7, 7',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(layer)
        }

        // Pin Destinație Client (🏠) pentru comanda selectată sau în curs de livrare
        if (isSelected || ord.courierPhase === 'on_way' || ord.courierPhase === 'at_customer') {
          const custIcon = L.divIcon({
            className: 'custom-cust-marker',
            html: `
              <div style="
                width: ${isSelected ? '26px' : '22px'}; height: ${isSelected ? '26px' : '22px'}; border-radius: 50%;
                background: ${isSelected ? '#0284c7' : '#0f172a'}; border: 2px solid #38bdf8;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                font-size: ${isSelected ? '12px' : '10px'};
              " title="${ord.customer?.name || 'Client'}">
                🏠
              </div>
            `,
            iconSize: [isSelected ? 26 : 22, isSelected ? 26 : 22],
            iconAnchor: [isSelected ? 13 : 11, isSelected ? 13 : 11]
          })
          L.marker([routeInfo.custCoords.lat, routeInfo.custCoords.lng], { icon: custIcon }).addTo(layer)
        }
      }

      const displayNum = getCleanOrderNumber(ord)
      const courierIcon = L.divIcon({
        className: 'custom-courier-marker',
        html: `
          <div style="
            position: relative;
            display: inline-flex; align-items: center; gap: 4px;
            padding: 3px 7px; border-radius: 999px;
            background: ${isSelected ? '#059669' : '#0f172a'};
            border: 2px solid ${statusColor};
            color: #ffffff; font-family: ui-monospace, monospace;
            font-size: 10px; font-weight: 800; white-space: nowrap;
            box-shadow: 0 4px 14px rgba(0,0,0,0.45);
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
          ">
            <span style="
              width: 14px; height: 14px; border-radius: 50%;
              background: ${platColor}; color: #0f172a;
              display: inline-flex; align-items: center; justify-content: center;
              font-size: 9px; font-weight: 900;
            ">${platBadge}</span>
            <span>${displayNum}</span>
            ${ord.hasLiveTracking ? '<span style="width:6px;height:6px;border-radius:50%;background:#38bdf8;display:inline-block;"></span>' : ''}
          </div>
        `,
        iconSize: [76, 26],
        iconAnchor: [38, 13]
      })

      // Poziționăm curierul STRICT pe traseul stradal la procentul actual
      const marker = L.marker([routeInfo.courierPos.lat, routeInfo.courierPos.lng], { icon: courierIcon }).addTo(layer)
      marker.on('click', () => {
        setSelectedOrderId(ord.id)
      })

      const trackingBtnHtml = ord.courier?.trackingUrl
        ? `<a href="${ord.courier.trackingUrl}" target="_blank" rel="noopener noreferrer" style="
            display: inline-block; margin-top: 6px; margin-right: 4px; padding: 4px 8px;
            border-radius: 6px; background: #0284c7; color: #fff;
            font-size: 10px; font-weight: 700; text-decoration: none;
          ">${ui.popupTrackingBtn}</a>`
        : ''

      const gmapsBtnHtml = `<a href="${routeInfo.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="
        display: inline-block; margin-top: 6px; padding: 4px 8px;
        border-radius: 6px; background: #059669; color: #fff;
        font-size: 10px; font-weight: 700; text-decoration: none;
      ">${ui.googleMapsRouteBtn} ↗</a>`

      const parsedPopupAddr = parseDeliveryAddress(ord.customer?.address, language)
      const buildingPopupHtml = parsedPopupAddr.buildingDetails.length > 0
        ? `<div style="font-size: 10px; color: #334155; margin-top: 2px;">${parsedPopupAddr.buildingDetails.map(b => `${b.label}: <b>${b.value}</b>`).join(' · ')}</div>`
        : ''
      const instrPopupHtml = parsedPopupAddr.instructions
        ? `<div style="font-size: 10px; background: #fef3c7; color: #92400e; padding: 3px 6px; border-radius: 5px; margin-top: 3px; font-weight: 600;">💬 ${parsedPopupAddr.instructions}</div>`
        : ''

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 235px; line-height: 1.4;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size: 13px; font-weight: 900; color: #0f172a;">${ui.popupCheck} ${displayNum}</span>
            <span style="font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 99px; background: #f1f5f9; color: #334155;">
              ${(ord.courier?.company || ord.platform || '').toUpperCase()}
            </span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 3px;">
            <b>${ui.popupPoint}</b> ${cleanRestaurantName(ord.restaurant_name, ord.brand_name)}
          </div>
          <div style="font-size: 11px; color: #475569;">
            <b>${ui.popupCustomer}</b> ${ord.customer?.name || '—'}
          </div>
          ${parsedPopupAddr.streetAddress ? `<div style="font-size: 11px; color: #64748b;">📍 ${parsedPopupAddr.streetAddress}</div>` : ''}
          ${buildingPopupHtml}
          ${instrPopupHtml}
          <div style="margin-top: 6px; padding: 5px 7px; border-radius: 7px; background: #f8fafc; border: 1px solid #e2e8f0;">
            <div style="display:flex; justify-content:space-between; font-size: 10px; font-weight: 800; color: #334155;">
              <span>🏪 ${ui.depTimeLabel}: <b>${routeInfo.isDepEstimated && routeInfo.depTime !== '—' ? '~' : ''}${routeInfo.depTime}</b></span>
              <span style="color: #059669;">🛵 ${routeInfo.distanceKm} ${ui.kmShort} · ~${routeInfo.driveMin} ${ui.minShort}</span>
              <span>🏠 ${routeInfo.isDelivered ? ui.deliveredAtLabel : ui.estDeliveryLabel}: <b>${routeInfo.estArrTime}</b></span>
            </div>
            <div style="height: 5px; border-radius: 99px; background: #e2e8f0; margin-top: 4px; overflow: hidden;">
              <div style="width: ${routeInfo.progressPct}%; height: 100%; background: ${statusColor}; border-radius: 99px;"></div>
            </div>
          </div>
          ${ord.courier?.awb ? `<div style="font-size: 11px; font-family: monospace; color: #059669; font-weight: 700; margin-top: 3px;">AWB: ${ord.courier.awb}</div>` : ''}
          <div style="font-size: 11px; color: #d97706; font-weight: 700;">${ui.popupStatus} ${formatCourierStatusBadge(ord, ui)}</div>
          ${ord.courier?.deliveryFee ? `<div style="font-size: 11px; color: #475569;">${ui.popupFee} <b>${ord.courier.deliveryFee} RON</b></div>` : ''}
          <div>${trackingBtnHtml}${gmapsBtnHtml}</div>
        </div>
      `)
    })
  }, [filteredDeliveries, selectedOrderId, language, streetRoutes])

  const handleSelectOrderCard = (ord) => {
    setSelectedOrderId(ord.id)
    if (leafletMapRef.current && window.L) {
      const routeInfo = computeOrderRouteAndTimeline(ord, streetRoutes[ord.id], language)
      const bounds = window.L.latLngBounds([
        [ord.restCoords.lat, ord.restCoords.lng],
        [routeInfo.custCoords.lat, routeInfo.custCoords.lng],
        [routeInfo.courierPos.lat, routeInfo.courierPos.lng]
      ])
      leafletMapRef.current.fitBounds(bounds, { padding: [55, 55], maxZoom: 15, animate: true, duration: 0.6 })
    }
  }

  return (
    <div className="space-y-3">
      {/* Dark mode filter for OpenStreetMap tiles without affecting pins or popups */}
      <style>{`
        .couriers-map-dark .leaflet-tile-pane {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
      `}</style>

      {/* ─── 1. HEADER & LIVE SYNC BAR ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Navigation size={11} />
              {ui.radarBadge}
            </span>
            <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {ui.title}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {ui.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer tabular-nums ${
              isAutoRefreshEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
                : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isAutoRefreshEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            {isAutoRefreshEnabled
              ? (language === 'ru'
                  ? `Авто-Обновление (${secondsUntilRefresh}с)`
                  : `Auto-Refresh (${secondsUntilRefresh}s)`)
              : ui.pausedLive}
          </button>

          <button
            onClick={() => fetchData(false)}
            disabled={loading}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <RotateCw size={12} className={loading ? 'animate-spin text-emerald-500' : ''} />
            <span>{ui.refresh}</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium ml-1">
            {ui.updated} {lastUpdated.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ─── 2. BARA DE FILTRE PE ORAȘ, BRAND, PUNCT DE LUCRU, FLOTĂ ȘI PERIOADĂ ─── */}
      <div className={`px-3 py-2 rounded-xl border transition-colors relative z-20 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Selector Oraș */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-slate-400 flex items-center shrink-0">
              <MapPin size={12} />
            </span>
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value)
                setSelectedRestaurantId('all')
              }}
              className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors outline-none cursor-pointer ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <option value="all">{ui.allCities}</option>
              {availableCities.filter(c => c !== 'all').map(city => (
                <option key={city} value={city}>{getCityDisplayName(city)}</option>
              ))}
            </select>
          </div>

          {/* Selector Brand cu Avatare Oficiale */}
          <div ref={brandPickerRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsBrandPickerOpen(!isBrandPickerOpen)}
              className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors outline-none cursor-pointer flex items-center gap-1.5 select-none ${
                selectedBrand !== 'all'
                  ? isDark ? 'bg-slate-800 border-emerald-600 text-white' : 'bg-emerald-50/50 border-emerald-300 text-emerald-900'
                  : isDark
                    ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              {selectedBrand !== 'all' ? (
                <BrandAvatar brand={selectedBrand} size={16} className="rounded-full shrink-0" />
              ) : (
                <Store size={12} className="text-slate-400" />
              )}
              <span>{selectedBrand !== 'all' ? selectedBrand : ui.allBrands}</span>
              {selectedBrand !== 'all' ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedBrand('all')
                    setSelectedRestaurantId('all')
                  }}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                >
                  <X size={11} />
                </span>
              ) : (
                <ChevronDown size={11} className="text-slate-400" />
              )}
            </button>

            {isBrandPickerOpen && (
              <div className={`absolute left-0 mt-1 z-50 w-56 rounded-xl shadow-2xl border overflow-hidden flex flex-col ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBrand('all')
                      setSelectedRestaurantId('all')
                      setIsBrandPickerOpen(false)
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                      selectedBrand === 'all'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                        : isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <span className="font-semibold">{ui.allBrands}</span>
                    <span className="text-[10px] font-mono text-slate-400">{brandCounts.all}</span>
                  </button>
                  {AUTHORITATIVE_BRANDS.map(brandName => (
                    <button
                      key={brandName}
                      type="button"
                      onClick={() => {
                        setSelectedBrand(brandName)
                        setSelectedRestaurantId('all')
                        setIsBrandPickerOpen(false)
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 ${
                        selectedBrand === brandName
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                          : isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BrandAvatar brand={brandName} size={20} className="rounded-full shrink-0" />
                        <span className="font-semibold">{brandName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{brandCounts[brandName] || 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Selector Punct de Lucru */}
          <div ref={locationPickerRef} className="relative shrink-0">
            <select
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors outline-none cursor-pointer max-w-[230px] ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-600'
                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <option value="all">{ui.allLocations} ({filteredRestaurantsForSelector.length})</option>
              {filteredRestaurantsForSelector.map(r => (
                <option key={r.id} value={r.id}>
                  {cleanRestaurantName(r.name, r.brand)} ({getCanonicalCity(r.city || r.name || '')})
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-0.5" />

          {/* Filtru Flotă Curieri (Glovo / Wolt / Bolt) */}
          <div className="flex items-center gap-1 shrink-0">
            {[
              { id: 'all', label: ui.allCouriers, count: stats.total },
              { id: 'glovo', label: 'Glovo', count: stats.glovo, plat: 'glovo' },
              { id: 'wolt', label: 'Wolt', count: stats.wolt, plat: 'wolt' },
              { id: 'bolt', label: 'Bolt Food', count: stats.bolt, plat: 'bolt' }
            ].map(fl => {
              const active = selectedFleet === fl.id
              return (
                <button
                  key={fl.id}
                  onClick={() => setSelectedFleet(active && fl.id !== 'all' ? 'all' : fl.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                    active
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                      : isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {fl.plat && <PlatformLogo platform={fl.plat} size={13} />}
                  <span>{fl.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {fl.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-0.5" />

          {/* Perioadă */}
          <div className="flex items-center gap-1 shrink-0">
            <Calendar size={12} className="text-slate-400" />
            <div className={`p-0.5 rounded-full border flex items-center gap-0.5 ${
              isDark ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100/90 border-slate-200'
            }`}>
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedPeriod(opt.key)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    selectedPeriod === opt.key
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {language === 'ru' ? opt.labelRu : language === 'en' ? opt.labelEn : opt.label}
                </button>
              ))}
            </div>
          </div>

          {(selectedCity !== 'all' || selectedBrand !== 'all' || selectedRestaurantId !== 'all' || selectedFleet !== 'all' || selectedStatusTab !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCity('all')
                setSelectedBrand('all')
                setSelectedRestaurantId('all')
                setSelectedFleet('all')
                setSelectedStatusTab('all')
                setSearchQuery('')
              }}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/40 flex items-center gap-1 cursor-pointer"
            >
              <X size={11} /> {ui.reset}
            </button>
          )}
        </div>
      </div>

      {/* ─── 3. FILTRE STATUS CURIER (TAB-URI OPERAȚIONALE) & CĂUTARE ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: ui.tabAll, count: stats.total },
            { id: 'tracking', label: ui.tabTracking, count: stats.tracking },
            { id: 'at_restaurant', label: ui.tabAtRest, count: stats.at_restaurant },
            { id: 'on_way', label: ui.tabOnWay, count: stats.on_way },
            { id: 'at_customer', label: ui.tabAtCustomer, count: stats.at_customer },
            { id: 'delivered', label: ui.tabDelivered, count: stats.delivered }
          ].map(tab => {
            const active = selectedStatusTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStatusTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isDark
                      ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  active ? 'bg-white/20 text-white' : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Căutare rapidă */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder={ui.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-8 py-1.5 text-xs font-medium rounded-full border outline-none ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-emerald-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ─── 4. SPLIT VIEW: HARTA INTERACTIVĂ (STÂNGA) + LISTA CURIERI LIVE (DREAPTA) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Harta Leaflet */}
        <div className={`lg:col-span-8 rounded-2xl border overflow-hidden relative min-h-[540px] flex flex-col ${
          isDark ? 'bg-slate-900 border-slate-800 couriers-map-dark' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div ref={mapContainerRef} className="w-full flex-1 min-h-[540px] z-10" />

          {/* Legendă flotantă pe hartă */}
          <div className={`absolute bottom-3 left-3 z-20 px-3 py-2 rounded-xl border backdrop-blur-md text-[11px] flex flex-wrap items-center gap-3 ${
            isDark ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-700 shadow-md'
          }`}>
            <span className="flex items-center gap-1.5 font-bold">
              <span>🏪</span> {ui.legendStore}
            </span>
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> {ui.legendAtRest}
            </span>
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> {ui.legendOnWay}
            </span>
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span> {ui.legendAtCust}
            </span>
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span> {ui.legendDelivered}
            </span>
          </div>
        </div>

        {/* Panou lateral cu cardurile curierilor și comenzilor */}
        <div className={`lg:col-span-4 rounded-2xl border flex flex-col max-h-[580px] overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`px-3.5 py-2.5 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50'
          }`}>
            <div className="flex items-center gap-2 font-bold text-xs">
              <Bike size={15} className="text-emerald-500" />
              <span>{ui.panelTitle}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {filteredDeliveries.length} {ui.deliveriesCount}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
            {filteredDeliveries.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {ui.noDeliveries}
              </div>
            ) : (
              filteredDeliveries.slice(0, 80).map(ord => {
                const isSelected = selectedOrderId === ord.id
                const displayNum = getCleanOrderNumber(ord)
                const statusBadge = formatCourierStatusBadge(ord, ui)
                const routeInfo = computeOrderRouteAndTimeline(ord, streetRoutes[ord.id], language)
                const progressColorClass = ord.courierPhase === 'at_customer'
                  ? 'bg-sky-500'
                  : ord.courierPhase === 'on_way'
                    ? 'bg-emerald-500'
                    : ord.courierPhase === 'at_restaurant'
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'

                return (
                  <div
                    key={ord.id}
                    onClick={() => handleSelectOrderCard(ord)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                        : isDark
                          ? 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80'
                          : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PlatformLogo platform={ord.courier?.company?.toLowerCase() || ord.platform} size={18} />
                        <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                          {displayNum}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                          {cleanRestaurantName(ord.restaurant_name, ord.brand_name)}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide shrink-0 ${
                        ord.courierPhase === 'at_customer'
                          ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                          : ord.courierPhase === 'on_way'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : ord.courierPhase === 'at_restaurant'
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                      }`}>
                        {statusBadge}
                      </span>
                    </div>

                    {/* Client & Adresă */}
                    <div className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between">
                      <span className="truncate">{ord.customer?.name || '—'}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {Number(ord.total_amount || 0).toFixed(2)} RON
                      </span>
                    </div>
                    {ord.customer?.address && (() => {
                      const parsedCardAddr = parseDeliveryAddress(ord.customer.address, language)
                      return (
                        <div className="mt-0.5 space-y-1">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={parsedCardAddr.streetAddress}>
                            📍 {parsedCardAddr.streetAddress}
                          </div>
                          {parsedCardAddr.buildingDetails.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {parsedCardAddr.buildingDetails.map((b, bIdx) => (
                                <span
                                  key={bIdx}
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${
                                    isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  {b.label}: <b>{b.value}</b>
                                </span>
                              ))}
                            </div>
                          )}
                          {parsedCardAddr.instructions && (
                            <div className={`px-2 py-1 rounded-lg text-[10px] font-medium border truncate ${
                              isDark ? 'bg-amber-950/30 border-amber-800/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                            }`} title={parsedCardAddr.instructions}>
                              💬 {parsedCardAddr.instructions}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* STATUS BAR: Ora Plecare + Distanță/Timp Traseu Stradal + Ora Estimativă Livrare */}
                    <div className={`mt-2 px-2.5 py-1.5 rounded-xl border ${
                      isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/80'
                    }`}>
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <span>🏪</span>
                          <span>{ui.depTimeLabel}:</span>
                          <b className="font-mono text-amber-500">
                            {routeInfo.isDepEstimated && routeInfo.depTime !== '—' ? `~${routeInfo.depTime}` : routeInfo.depTime}
                          </b>
                        </span>

                        <span className="font-mono text-[9.5px] font-extrabold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20">
                          🛵 {routeInfo.distanceKm} {ui.kmShort} · ~{routeInfo.driveMin} {ui.minShort}
                        </span>

                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <span>{routeInfo.isDelivered ? '✓' : '🏠'}</span>
                          <span>{routeInfo.isDelivered ? ui.deliveredAtLabel : ui.estDeliveryLabel}:</span>
                          <b className="font-mono text-emerald-500">{routeInfo.estArrTime}</b>
                        </span>
                      </div>

                      {/* Bara vizuală de progres pe traseul stradal */}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[9px] leading-none">🏪</span>
                        <div className={`relative flex-1 h-1.5 rounded-full overflow-hidden ${
                          isDark ? 'bg-slate-800' : 'bg-slate-200'
                        }`}>
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${progressColorClass}`}
                            style={{ width: `${routeInfo.progressPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] leading-none">🏠</span>
                      </div>
                    </div>

                    {/* AWB, Taxă livrare & Butoane */}
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {ord.courier?.awb ? (
                          <span>AWB: <b className="text-emerald-500">{ord.courier.awb}</b></span>
                        ) : (
                          <span>{ui.fleetLabel} <b>{(ord.courier?.company || ord.platform || '').toUpperCase()}</b></span>
                        )}
                        {ord.courier?.deliveryFee && (
                          <span className="ml-2">• {ui.deliveryFeeShort} <b>{ord.courier.deliveryFee} RON</b></span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        <a
                          href={routeInfo.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold transition-colors"
                          title="Deschide traseul stradal în Google Maps"
                        >
                          <span>{ui.googleMapsRouteBtn}</span>
                          <ExternalLink size={10} />
                        </a>
                        {ord.courier?.trackingUrl && (
                          <a
                            href={ord.courier.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 border border-sky-500/30 text-[10px] font-extrabold transition-colors"
                          >
                            <span>{ui.trackingLiveBtn}</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setModalOrder(ord)
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold cursor-pointer"
                        >
                          <Eye size={10} />
                          <span>{ui.checkBtn}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── 5. MODAL BON COMPLET + CRONOLOGIE TIMPI IIKO + TRACKING CURIER ─── */}
      {modalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setModalOrder(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isDark ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50'
            }`}>
              <div className="flex items-center gap-3">
                <BrandAvatar brand={modalOrder.brand_name || modalOrder.restaurant_name} size={36} className="rounded-full" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black">
                      {ui.popupCheck} {getCleanOrderNumber(modalOrder)}
                    </span>
                    <PlatformLogo platform={modalOrder.courier?.company?.toLowerCase() || modalOrder.platform} size={18} />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {cleanRestaurantName(modalOrder.restaurant_name, modalOrder.brand_name)} ({modalOrder.cityCanon})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setModalOrder(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Cronologie Timpi iiko + Valentin */}
              <div className={`p-4 rounded-2xl border ${
                isDark ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50/60 border-emerald-200'
              }`}>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2.5 flex items-center justify-between">
                  <span>{ui.modalTimingsTitle}</span>
                  {(modalOrder.timings?.complete_before_time || modalOrder.exact_timings?.complete_before) && (
                    <span className="text-slate-500">
                      {ui.modalSlaPromised} {modalOrder.timings?.complete_before_time || parseExactTime(modalOrder.exact_timings?.complete_before)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400">{ui.step1}</div>
                    <div className="font-mono font-black text-sm mt-0.5">
                      {modalOrder.timings?.created_time || parseExactTime(modalOrder.exact_timings?.created_at || modalOrder.placed_at)}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400">{ui.step2}</div>
                    <div className="font-mono font-black text-sm text-blue-500 mt-0.5">
                      {modalOrder.timings?.cooking_completed_time || parseExactTime(modalOrder.exact_timings?.cooking_completed_at)}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400">{ui.step3}</div>
                    <div className="font-mono font-black text-sm text-amber-500 mt-0.5">
                      {modalOrder.timings?.sended_time || parseExactTime(modalOrder.exact_timings?.sent_at)}
                    </div>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="text-[10px] text-slate-400">{ui.step4}</div>
                    <div className="font-mono font-black text-sm text-emerald-500 mt-0.5">
                      {modalOrder.timings?.delivered_time || parseExactTime(modalOrder.exact_timings?.delivered_at || modalOrder.exact_timings?.closed_at)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Date Client & Date Livrare Curier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{ui.modalCustomerSection}</div>
                  <div className="font-bold text-sm">{modalOrder.customer?.name || '—'}</div>
                  {modalOrder.customer?.phone && (
                    <div className="font-mono text-slate-500 mt-1">📞 {modalOrder.customer.phone}</div>
                  )}
                  {modalOrder.customer?.address && (() => {
                    const parsedModalAddr = parseDeliveryAddress(modalOrder.customer.address, language)
                    return (
                      <div className="mt-1.5 space-y-2">
                        <div className="text-slate-600 dark:text-slate-300 font-medium">
                          📍 {parsedModalAddr.streetAddress}
                        </div>
                        {parsedModalAddr.buildingDetails.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {parsedModalAddr.buildingDetails.map((b, bIdx) => (
                              <span
                                key={bIdx}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                  isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="text-slate-400">{b.label}:</span>
                                <b className="font-mono text-slate-900 dark:text-white">{b.value}</b>
                              </span>
                            ))}
                          </div>
                        )}
                        {parsedModalAddr.instructions && (
                          <div className={`p-2.5 rounded-xl border text-[11px] leading-snug ${
                            isDark ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' : 'bg-amber-50/90 border-amber-200 text-amber-900'
                          }`}>
                            <div className="text-[9px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-0.5">
                              💬 {language === 'ru' ? 'Инструкции курьеру (Примечание):' : language === 'en' ? 'Delivery Instructions (Note):' : 'Instrucțiuni livrare (Notă client):'}
                            </div>
                            <div className="font-semibold">{parsedModalAddr.instructions}</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{ui.modalCourierSection}</div>
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <Bike size={15} className="text-emerald-500" />
                    <span>{modalOrder.courier?.name || `${ui.courierWord} ${(modalOrder.platform || '').toUpperCase()}`}</span>
                    <span className="text-[11px] font-normal text-slate-400">({modalOrder.courier?.company || modalOrder.platform})</span>
                  </div>
                  {modalOrder.courier?.awb && (
                    <div className="font-mono text-emerald-500 font-bold mt-1">AWB: {modalOrder.courier.awb}</div>
                  )}
                  <div className="mt-1">{ui.liveStatusLabel} <b className="font-mono text-amber-500">{formatCourierStatusBadge(modalOrder, ui)}</b></div>
                  {modalOrder.courier?.deliveryFee && (
                    <div className="mt-0.5 text-slate-500">{ui.courierFeeLabel} <b>{modalOrder.courier.deliveryFee} RON</b></div>
                  )}
                  {modalOrder.courier?.trackingUrl && (
                    <a
                      href={modalOrder.courier.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-500 border border-sky-500/30 font-bold text-xs"
                    >
                      <span>{ui.openLiveMapBtn}</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              {/* Produse din comandă */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {ui.orderedItemsTitle} ({(modalOrder.items || []).length})
                </div>
                {(modalOrder.items || []).map((it, idx) => {
                  const pName = it.product_name || it.name || '—'
                  const qty = Number(it.quantity || it.amount || 1)
                  const price = Number(it.price || 0)
                  const img = getProductImage(pName, modalOrder.brand_name)
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {img && (
                          <img src={img} alt={pName} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-800" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{pName}</div>
                          <div className="text-[11px] text-slate-400">{qty} x {price.toFixed(2)} RON</div>
                        </div>
                      </div>
                      <div className="font-mono font-black text-xs shrink-0">
                        {(qty * price).toFixed(2)} RON
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="font-bold text-sm">{ui.orderTotalLabel}</span>
                <span className="text-xl font-black text-emerald-500 font-mono">
                  {Number(modalOrder.total_amount || 0).toFixed(2)} RON
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
