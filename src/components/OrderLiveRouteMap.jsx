import { useEffect, useRef, useState, useMemo } from 'react'
import { Store, Bike, MapPin, Navigation, ExternalLink, CheckCircle2, AlertTriangle, ShieldAlert, Maximize2, Minimize2, LocateFixed, X } from 'lucide-react'
import { getBrandInfo, cleanRestaurantName } from './BrandAvatar'
import { getCanonicalCity, getCityDisplayName, formatDisplayOrderNumber, parseDeliveryAddress } from '../lib/orderUtils'

const CITY_COORDS = {
  'BUCURESTI': { lat: 44.4268, lng: 26.1025 },
  'BALOTESTI': { lat: 44.6156, lng: 26.0794 },
  'IASI': { lat: 47.1585, lng: 27.6014 },
  'TIMISOARA': { lat: 45.7489, lng: 21.2087 },
  'CLUJ-NAPOCA': { lat: 46.7712, lng: 23.6236 },
  'BRASOV': { lat: 45.6427, lng: 25.5887 },
  'CONSTANTA': { lat: 44.1735, lng: 28.6315 },
  'ORADEA': { lat: 47.0465, lng: 21.9189 },
  'SUCEAVA': { lat: 47.6514, lng: 26.2556 },
  'BACAU': { lat: 46.5670, lng: 26.9146 },
  'CRAIOVA': { lat: 44.3302, lng: 23.7949 },
  'PITESTI': { lat: 44.8565, lng: 24.8692 },
  'PLOIESTI': { lat: 44.9451, lng: 26.0221 },
  'SIBIU': { lat: 45.7983, lng: 24.1256 },
  'GALATI': { lat: 45.4353, lng: 28.0080 },
  'ARAD': { lat: 46.1866, lng: 21.3123 },
  'TARGU MURES': { lat: 46.5386, lng: 24.5575 },
  'BAIA MARE': { lat: 47.6567, lng: 23.5850 },
  'SATU MARE': { lat: 47.7926, lng: 22.8859 },
  'BUZAU': { lat: 45.1500, lng: 26.8167 }
}

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
  if (cityCanon === 'CONSTANTA') {
    return { lat: 44.1792, lng: 28.6348 }
  }
  const dLat = ((h % 100) / 100 - 0.5) * 0.010
  const dLng = (((h >> 8) % 100) / 100 - 0.5) * 0.014
  return { lat: base.lat + dLat, lng: base.lng + dLng }
}

function getOrderDeliveryCoords(order, restCoords, cityCanon) {
  const explicit = order?.customer?.coordinates || order?._order_meta?.coordinates
  if (explicit && Number(explicit.lat) && Number(explicit.lng)) {
    return { lat: Number(explicit.lat), lng: Number(explicit.lng), isExactGps: true }
  }
  const h = hashString(`${order?.order_id || order?.id}_${order?.customer?.address || ''}_${order?.order_number || ''}`)
  // Pentru Constanța păstrăm unghiurile spre interiorul orașului (Nord / Nord-Vest / Vest), niciodată spre Marea Neagră
  const deg = cityCanon === 'CONSTANTA'
    ? (115 + (h % 190)) // 115°..305° (spre vest/nord-vest pe uscat)
    : (h % 360)
  const angle = (deg * Math.PI) / 180
  const distKm = 1.0 + ((h >> 9) % 24) / 10
  const dLat = (distKm / 111) * Math.sin(angle)
  const dLng = (distKm / 78) * Math.cos(angle)
  return {
    lat: restCoords.lat + dLat,
    lng: restCoords.lng + dLng,
    isExactGps: false
  }
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

function buildStreetGridFallbackRoute(restCoords, custCoords, seed = 1) {
  const lat1 = restCoords.lat
  const lng1 = restCoords.lng
  const lat2 = custCoords.lat
  const lng2 = custCoords.lng
  const dLat = lat2 - lat1
  const dLng = lng2 - lng1
  const gridAngle = ((seed % 25) - 12) * (Math.PI / 180)
  const cosA = Math.cos(gridAngle)
  const sinA = Math.sin(gridAngle)
  const u = dLat * cosA + dLng * sinA
  const v = -dLat * sinA + dLng * cosA
  const fromUV = (uStep, vStep) => [
    lat1 + (uStep * cosA - vStep * sinA),
    lng1 + (uStep * sinA + vStep * cosA)
  ]
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

function getPlatformMapBadgeHtml(platform, size = 18) {
  const p = String(platform || '').toLowerCase()
  if (p.includes('glovo')) {
    return `
      <span style="
        width: ${size}px; height: ${size}px; border-radius: 50%;
        background: #FFC244; display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      " title="Glovo">
        <svg viewBox="0 0 24 24" width="${Math.round(size * 0.68)}" height="${Math.round(size * 0.68)}" fill="#00A082">
          <path d="M12.012 0C7.847 0 4.459 3.388 4.459 7.553c0 1.576.494 3.106 1.412 4.4l.211.281 3.93 5.555s.47.775 1.529.775h.941c1.036 0 1.53-.775 1.53-.775l3.93-5.555.187-.28a7.43 7.43 0 0 0 1.412-4.401C19.564 3.388 16.176 0 12.011 0Zm0 3.693a3.837 3.837 0 0 1 3.836 3.836c0 .824-.26 1.578-.73 2.237l-.212.28-2.894 4.095-2.895-4.07-.21-.305a3.848 3.848 0 0 1-.731-2.237 3.837 3.837 0 0 1 3.836-3.836zm-2.117 18.26c0 1.106.893 2.023 2.07 2.047 1.223 0 2.117-.917 2.117-2.059 0-1.14-.894-2.058-2.094-2.058-1.2 0-2.093.917-2.093 2.07z"/>
        </svg>
      </span>
    `
  }
  if (p.includes('wolt')) {
    return `
      <span style="
        width: ${size}px; height: ${size}px; border-radius: 50%;
        background: #00C2E8; color: #ffffff;
        display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0; font-family: system-ui, sans-serif; font-weight: 900;
        font-style: italic; font-size: ${Math.max(7, Math.round(size * 0.44))}px; letter-spacing: -0.4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      " title="Wolt">wolt</span>
    `
  }
  if (p.includes('bolt')) {
    return `
      <span style="
        width: ${size}px; height: ${size}px; border-radius: 50%;
        background: #34D186; display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      " title="Bolt Food">
        <svg viewBox="0 0 256 326" width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.62)}" fill="#22262A">
          <path d="M146.913164,0 L125.011288,98.780726 C142.70058,79.4448787 159.127663,72.299019 180.186309,72.299019 C225.675379,72.299019 256,102.143383 256,156.78784 C256,213.113341 221.042391,285.412745 148.597627,285.412745 C125.432404,285.412745 102.688439,277.006103 89.6315659,258.931608 L85.0262251,280.248197 L0,325.328264 L9.17897315,280.248197 L71.0994728,0 L146.913164,0 Z M143.96464,139.133749 C132.171399,139.133749 122.062907,144.177164 113.218048,153.005635 L101.424807,204.706699 C109.427434,213.533745 121.641791,218.578585 135.11978,218.578585 C159.127663,218.578585 177.659614,198.822477 177.659614,172.761743 C177.659614,152.585232 162.076187,139.133749 143.96464,139.133749 Z"/>
        </svg>
      </span>
    `
  }
  return `
    <span style="
      width: ${size}px; height: ${size}px; border-radius: 50%;
      background: #4f46e5; color: #ffffff;
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    ">
      <svg viewBox="0 0 24 24" width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.62)}" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
    </span>
  `
}

export default function OrderLiveRouteMap({ order, isDark = false, language = 'ro', onOpenCustomerDossier }) {
  const mapContainerRef = useRef(null)
  const leafletMapRef = useRef(null)
  const layerRef = useRef(null)
  const lastFittedKeyRef = useRef(null)
  const onOpenCustomerDossierRef = useRef(onOpenCustomerDossier)
  onOpenCustomerDossierRef.current = onOpenCustomerDossier

  const [streetRoute, setStreetRoute] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAuditPopup, setShowAuditPopup] = useState(false)

  const orderKey = order?.id || order?.order_id || order?.order_number || 'ord'

  const cityCanon = useMemo(() => {
    return getCanonicalCity(order?.cityCanon || order?.restaurant_city || order?.city || order?.restaurant_name || 'BUCURESTI')
  }, [orderKey, order?.cityCanon, order?.restaurant_city, order?.city, order?.restaurant_name])

  const restCoords = useMemo(() => {
    if (order?.restCoords?.lat && order?.restCoords?.lng) {
      return { lat: Number(order.restCoords.lat), lng: Number(order.restCoords.lng) }
    }
    return getRestaurantCoords(cityCanon, order?.restaurant_name, order?.restaurant_id)
  }, [orderKey, cityCanon, order?.restCoords?.lat, order?.restCoords?.lng, order?.restaurant_name, order?.restaurant_id])

  const initialCustCoords = useMemo(() => {
    if (order?.custCoords?.lat && order?.custCoords?.lng) {
      return {
        lat: Number(order.custCoords.lat),
        lng: Number(order.custCoords.lng),
        isExactGps: Boolean(order.custCoords.isExactGps)
      }
    }
    return getOrderDeliveryCoords(order, restCoords, cityCanon)
  }, [orderKey, restCoords, cityCanon, order?.custCoords?.lat, order?.custCoords?.lng, order?.customer?.address])

  const courierPhase = useMemo(() => {
    if (order?.courierPhase) return order.courierPhase
    const rawStatus = String(order?.courier?.status || '').toUpperCase()
    if (rawStatus.includes('DELIVERED') || order?.stage === 'delivered') return 'delivered'
    if (rawStatus.includes('AT CUSTOMER')) return 'at_customer'
    if (rawStatus.includes('PICKED UP') || order?.stage === 'on_way') return 'on_way'
    return 'at_restaurant'
  }, [order?.courierPhase, order?.courier?.status, order?.stage])

  // Geocodare + OSRM Street Route (cu cache în sessionStorage partajat cu Harta Curieri)
  useEffect(() => {
    let cancelled = false
    const orderKey = order?.id || order?.order_id
    if (orderKey) {
      try {
        const cachedRaw = sessionStorage.getItem(`ag_route_v1_${orderKey}`)
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw)
          if (parsed?.coordinates?.length >= 2) {
            setStreetRoute(parsed)
            return
          }
        }
      } catch (_) {}
    }
    setStreetRoute(null)

    ;(async () => {
      let targetCustCoords = initialCustCoords
      try {
        const parsedAddr = parseDeliveryAddress(order?.customer?.address, 'ro')
        const cleanStreet = String(parsedAddr.streetAddress || '')
          .replace(/\b(ROU|Romania|România|\d{6})\b/gi, '')
          .replace(/[;#]/g, ' ')
          .trim()
        const cityName = getCityDisplayName(cityCanon)
        if (!initialCustCoords?.isExactGps && cleanStreet.length >= 4) {
          const q = `${cleanStreet}, ${cityName}, Romania`
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 2200)
          const res = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${restCoords.lat}&lon=${restCoords.lng}&limit=1`,
            { signal: ctrl.signal }
          )
          clearTimeout(timer)
          if (res.ok) {
            const json = await res.json()
            const feat = json?.features?.[0]
            if (feat?.geometry?.coordinates?.length === 2) {
              const [gLng, gLat] = feat.geometry.coordinates
              const dist = haversineDistanceKm(restCoords, { lat: gLat, lng: gLng })
              if (dist >= 0.15 && dist <= 18) {
                targetCustCoords = { lat: gLat, lng: gLng, isExactGps: true }
              }
            }
          }
        }
      } catch (_) {}

      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 2800)
        const url = `https://router.project-osrm.org/route/v1/driving/${restCoords.lng},${restCoords.lat};${targetCustCoords.lng},${targetCustCoords.lat}?overview=full&geometries=geojson`
        const res = await fetch(url, { signal: ctrl.signal })
        clearTimeout(timer)
        if (res.ok) {
          const json = await res.json()
          const route = json?.routes?.[0]
          if (route?.geometry?.coordinates?.length >= 2 && !cancelled) {
            const entry = {
              coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
              distanceKm: Number((route.distance / 1000).toFixed(1)),
              durationMin: Math.max(4, Math.round(route.duration / 60)),
              custCoords: targetCustCoords
            }
            setStreetRoute(entry)
            if (orderKey) {
              try {
                sessionStorage.setItem(`ag_route_v1_${orderKey}`, JSON.stringify(entry))
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    })()

    return () => {
      cancelled = true
    }
  }, [order?.id, order?.order_id, restCoords, initialCustCoords, cityCanon])

  const routeInfo = useMemo(() => {
    const seed = hashString(`${order?.id || order?.order_id}_${order?.order_number || ''}`)
    const custCoords = streetRoute?.custCoords || initialCustCoords
    const routeLatLngs = (streetRoute?.coordinates && streetRoute.coordinates.length >= 2)
      ? streetRoute.coordinates
      : buildStreetGridFallbackRoute(restCoords, custCoords, seed)

    const rawStraightKm = haversineDistanceKm(restCoords, custCoords)
    const distanceKm = streetRoute?.distanceKm
      ? Number(streetRoute.distanceKm)
      : Math.max(0.8, Number((rawStraightKm * 1.34).toFixed(1)))

    const driveMin = streetRoute?.durationMin
      ? Math.max(4, Math.round(streetRoute.durationMin))
      : Math.max(5, Math.round(distanceKm * 2.9 + 3))

    const createdHHMM = extractHHMM(order?.timings?.created_time || order?.exact_timings?.created_at || order?.placed_at)
    const cookedHHMM = extractHHMM(order?.timings?.cooking_completed_time || order?.exact_timings?.cooking_completed_at)
    const sentHHMM = extractHHMM(order?.timings?.sended_time || order?.exact_timings?.sent_at || order?.courier?.pickedUpAt)
    const deliveredHHMM = extractHHMM(order?.timings?.delivered_time || order?.exact_timings?.delivered_at || order?.exact_timings?.closed_at)
    const slaHHMM = extractHHMM(order?.timings?.complete_before_time || order?.exact_timings?.complete_before)

    const isDelivered = courierPhase === 'delivered'
    let depTime = sentHHMM
    let isDepEstimated = false
    if (!depTime) {
      isDepEstimated = true
      if (cookedHHMM) depTime = addMinutesToHHMM(cookedHHMM, 3)
      else if (createdHHMM) depTime = addMinutesToHHMM(createdHHMM, 14)
      else depTime = '—'
    }

    // ─── AUDIT TRASEU & TIMP REAL CURIER VS. TRASEU OPTIM OSRM ───
    const kitchenMin = Math.max(0, Math.round(Number(order?.kitchen_minutes || 0)))
    const rawDelivMin = Number(order?.delivery_minutes || 0)
    const diffSentDeliv = (sentHHMM && deliveredHHMM) ? diffMinutesBetweenHHMM(sentHHMM, deliveredHHMM) : null
    const nowHHMM = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    const elapsedSinceDep = (depTime && depTime !== '—') ? diffMinutesBetweenHHMM(depTime, nowHHMM) : null

    let actualCourierMin = driveMin
    if (rawDelivMin >= 3) {
      actualCourierMin = Math.round(rawDelivMin)
    } else if (diffSentDeliv !== null && diffSentDeliv >= 3 && diffSentDeliv <= 140) {
      actualCourierMin = Math.round(diffSentDeliv)
    } else if ((courierPhase === 'on_way' || courierPhase === 'at_customer') && elapsedSinceDep !== null && elapsedSinceDep > driveMin && elapsedSinceDep <= 120) {
      actualCourierMin = Math.round(elapsedSinceDep)
    }

    const extraCourierMin = courierPhase === 'at_restaurant' ? 0 : Math.max(0, actualCourierMin - driveMin)
    const actualKm = extraCourierMin <= 3
      ? Number(distanceKm.toFixed(1))
      : Number((distanceKm * (1 + Math.min(1.25, extraCourierMin * 0.045)) + Math.min(2.4, extraCourierMin * 0.12)).toFixed(1))
    const extraKm = Math.max(0, Number((actualKm - distanceKm).toFixed(1)))

    const efficiencyPct = (courierPhase === 'at_restaurant' || extraCourierMin <= 2)
      ? 100
      : Math.max(25, Math.min(98, Math.round((driveMin / Math.max(driveMin, actualCourierMin)) * 100)))

    let auditStatus = 'optimal' // 'waiting_pickup' | 'optimal' | 'minor_detour' | 'suboptimal'
    if (courierPhase === 'at_restaurant') {
      auditStatus = 'waiting_pickup'
    } else if (extraCourierMin >= 10) {
      auditStatus = 'suboptimal'
    } else if (extraCourierMin >= 5) {
      auditStatus = 'minor_detour'
    }

    // Traseul urmează întotdeauna geometria stradală reală OSRM (fără bucle geometrice sintetice)
    const detourLatLngs = null

    let estArrTime = null
    if (isDelivered && deliveredHHMM) {
      const diffDeliv = depTime && depTime !== '—' ? diffMinutesBetweenHHMM(depTime, deliveredHHMM) : null
      if (diffDeliv !== null && diffDeliv < 3) estArrTime = addMinutesToHHMM(depTime, actualCourierMin)
      else estArrTime = deliveredHHMM
    } else if (depTime && depTime !== '—') {
      const byDrive = addMinutesToHHMM(depTime, driveMin)
      if (slaHHMM) {
        const diffSla = diffMinutesBetweenHHMM(depTime, slaHHMM)
        estArrTime = (diffSla !== null && diffSla >= 4 && diffSla <= 55) ? slaHHMM : byDrive
      } else {
        estArrTime = byDrive
      }
    } else if (slaHHMM) {
      estArrTime = slaHHMM
    } else {
      estArrTime = '—'
    }

    let progress01 = 0
    if (courierPhase === 'delivered') progress01 = 1
    else if (courierPhase === 'at_customer') progress01 = 0.94
    else if (courierPhase === 'at_restaurant') progress01 = 0
    else {
      const totalTrip = (depTime && estArrTime && depTime !== '—' && estArrTime !== '—')
        ? Math.max(4, diffMinutesBetweenHHMM(depTime, estArrTime) || driveMin)
        : driveMin
      if (elapsedSinceDep !== null && elapsedSinceDep >= 0 && elapsedSinceDep <= totalTrip) {
        progress01 = Math.max(0.28, Math.min(0.88, 0.25 + (elapsedSinceDep / totalTrip) * 0.65))
      } else {
        progress01 = 0.42 + ((seed % 38) / 100)
      }
    }

    const activePathForCourier = detourLatLngs || routeLatLngs
    const { completedLatLngs, remainingLatLngs, courierPos } = splitPathAtProgress(activePathForCourier, progress01)
    const parsedAddr = parseDeliveryAddress(order?.customer?.address, language)
    const cityLabel = getCityDisplayName(cityCanon)
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
      actualCourierMin,
      extraCourierMin,
      actualKm: Number(actualKm).toFixed(1),
      extraKm: Number(extraKm).toFixed(1),
      efficiencyPct,
      auditStatus,
      kitchenMin,
      optimalRouteLatLngs: routeLatLngs,
      hasDetourOnMap: Boolean(detourLatLngs),
      progressPct: Math.round(progress01 * 100),
      completedLatLngs,
      remainingLatLngs,
      courierPos,
      custCoords,
      googleMapsUrl
    }
  }, [orderKey, streetRoute, initialCustCoords, restCoords, courierPhase, language, cityCanon])

  const recenterMap = (animate = true) => {
    if (!leafletMapRef.current || !window.L) return
    const L = window.L
    const allPoints = [
      [restCoords.lat, restCoords.lng],
      [routeInfo.custCoords.lat, routeInfo.custCoords.lng],
      [routeInfo.courierPos.lat, routeInfo.courierPos.lng]
    ]
    if (routeInfo.completedLatLngs?.length) {
      routeInfo.completedLatLngs.forEach(pt => allPoints.push(pt))
    }
    const bounds = L.latLngBounds(allPoints)
    leafletMapRef.current.fitBounds(bounds, { padding: [42, 42], maxZoom: 16, animate })
  }

  // Inițializare hartă Leaflet în modal
  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return
    if (leafletMapRef.current) return

    const L = window.L
    const map = L.map(mapContainerRef.current, {
      center: [restCoords.lat, restCoords.lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: false
    })

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ro', {
      attribution: '&copy; Google Maps · OSRM Street Routing',
      maxZoom: 20
    }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    leafletMapRef.current = map

    setTimeout(() => {
      map.invalidateSize()
    }, 150)

    return () => {
      map.remove()
      leafletMapRef.current = null
    }
  }, [])

  // Gestionare Fullscreen (activare scrollWheelZoom în Fullscreen + redimensionare automată)
  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) return
    if (isFullscreen) {
      map.scrollWheelZoom?.enable()
    } else {
      map.scrollWheelZoom?.disable()
    }
    const timer = setTimeout(() => {
      map.invalidateSize()
      recenterMap(false)
    }, 120)

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        e.stopPropagation()
        setIsFullscreen(false)
      }
    }
    if (isFullscreen) {
      window.addEventListener('keydown', onKeyDown, true)
    }
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [isFullscreen])

  // Randare pini Restaurant, Curier, Client + Traseu Verde/Roșu (FĂRĂ resetarea zoom-ului utilizatorului!)
  useEffect(() => {
    if (!leafletMapRef.current || !layerRef.current || !window.L) return
    const L = window.L
    const layer = layerRef.current
    layer.clearLayers()

    const bInfo = getBrandInfo(order?.brand_name || order?.restaurant_name || 'Roll Master')
    const brandLogoHtml = bInfo?.logo
      ? `<img src="${bInfo.logo}" alt="" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; display: block;" />`
      : ''

    const restIcon = L.divIcon({
      className: 'modal-rest-marker',
      html: `
        <div style="
          position: relative;
          width: 32px; height: 32px; border-radius: 50%;
          background: #0f172a; border: 2.5px solid #10b981;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.45);
        ">
          ${brandLogoHtml}
          <span style="
            position: absolute; bottom: -3px; right: -3px;
            width: 14px; height: 14px; border-radius: 50%;
            background: #10b981; border: 1.5px solid #0f172a;
            display: flex; align-items: center; justify-content: center;
          ">
            <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            </svg>
          </span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    })
    L.marker([restCoords.lat, restCoords.lng], { icon: restIcon }).addTo(layer)

    // Dacă există ocolire semnificativă, desenăm și traseul optim de referință OSRM (albastru-cyan punctat)
    if (routeInfo.hasDetourOnMap && routeInfo.optimalRouteLatLngs?.length >= 2) {
      L.polyline(routeInfo.optimalRouteLatLngs, {
        color: '#0ea5e9',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '5, 6',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(layer)
    }

    // Traseu VERDE / AMBER (Parcurs de curier)
    if (routeInfo.completedLatLngs.length >= 2) {
      L.polyline(routeInfo.completedLatLngs, {
        color: routeInfo.auditStatus === 'suboptimal' ? '#f59e0b' : '#10b981',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(layer)
    }

    // Traseu ROȘU (Rămas până la client)
    if (routeInfo.remainingLatLngs.length >= 2) {
      L.polyline(routeInfo.remainingLatLngs, {
        color: '#ef4444',
        weight: 4.5,
        opacity: 0.9,
        dashArray: '8, 7',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(layer)
    }

    // Pin Client
    const rawClientName = String(order?.customer?.name || '').trim()
    const shortClientLabel = (rawClientName && !rawClientName.toLowerCase().includes('client'))
      ? rawClientName.split(/\s+/)[0].slice(0, 12)
      : (language === 'ru' ? 'КЛИЕНТ' : 'CLIENT')

    const custIcon = L.divIcon({
      className: 'modal-cust-marker',
      html: `
        <div style="
          position: relative;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px 3px 4px; border-radius: 999px;
          background: #0284c7; border: 2px solid #38bdf8;
          color: #ffffff; font-family: system-ui, sans-serif;
          font-size: 9.5px; font-weight: 800; white-space: nowrap;
          box-shadow: 0 4px 12px rgba(2,132,199,0.45);
        ">
          <span style="
            width: 17px; height: 17px; border-radius: 50%;
            background: #0ea5e9; color: #ffffff;
            display: inline-flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          ">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
              <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
          </span>
          <span>${shortClientLabel}</span>
          <span style="
            position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%);
            width: 0; height: 0;
            border-left: 5px solid transparent; border-right: 5px solid transparent;
            border-top: 5px solid #38bdf8;
          "></span>
        </div>
      `,
      iconSize: [82, 28],
      iconAnchor: [41, 28]
    })
    const custMarker = L.marker([routeInfo.custCoords.lat, routeInfo.custCoords.lng], { icon: custIcon }).addTo(layer)
    custMarker.on('click', () => {
      if (onOpenCustomerDossierRef.current) {
        onOpenCustomerDossierRef.current(order)
      }
    })

    // Pin Curier
    const plat = String(order?.courier?.company || order?.platform || 'delivery').toLowerCase()
    const formattedNum = formatDisplayOrderNumber(order?.order_number, order?.order_id || order?.id, order?.channel || order?.platform)
    const displayNum = formattedNum ? `#${formattedNum}` : `#${String(order?.order_number || '').replace(/^#+/, '')}`
    let statusColor = '#10b981'
    if (courierPhase === 'at_customer') statusColor = '#0ea5e9'
    else if (courierPhase === 'at_restaurant') statusColor = '#f59e0b'

    const courierIcon = L.divIcon({
      className: 'modal-courier-marker',
      html: `
        <div style="
          position: relative;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px 3px 4px; border-radius: 999px;
          background: #0f172a; border: 2px solid ${statusColor};
          color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 10.5px; font-weight: 900; white-space: nowrap;
          box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        ">
          ${getPlatformMapBadgeHtml(plat, 18)}
          <span style="display: inline-flex; align-items: center; justify-content: center; color: ${statusColor};">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18.5" cy="17.5" r="3.5"/>
              <circle cx="5.5" cy="17.5" r="3.5"/>
              <circle cx="15" cy="5" r="1"/>
              <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
            </svg>
          </span>
          <span>${displayNum}</span>
          <span style="
            position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%);
            width: 0; height: 0;
            border-left: 5px solid transparent; border-right: 5px solid transparent;
            border-top: 5px solid ${statusColor};
          "></span>
        </div>
      `,
      iconSize: [96, 30],
      iconAnchor: [48, 30]
    })
    L.marker([routeInfo.courierPos.lat, routeInfo.courierPos.lng], { icon: courierIcon }).addTo(layer)

    // Facem fitBounds DOAR o singură dată la deschiderea comenzii (și o dată când sosește ruta OSRM), niciodată peste zoom-ul utilizatorului!
    const fitKey = `${orderKey}_${Boolean(streetRoute)}`
    if (lastFittedKeyRef.current !== fitKey) {
      lastFittedKeyRef.current = fitKey
      recenterMap(false)
    }
  }, [orderKey, restCoords, routeInfo, courierPhase, language, streetRoute])

  const depLabel = language === 'ru' ? 'Выезд' : language === 'en' ? 'Departure' : 'Plecare'
  const estLabel = routeInfo.isDelivered
    ? (language === 'ru' ? 'Доставлен' : language === 'en' ? 'Delivered' : 'Livrat')
    : (language === 'ru' ? 'Ожид. дост.' : language === 'en' ? 'Est. Delivery' : 'Est. Livrare')
  const doneLegend = routeInfo.hasDetourOnMap
    ? (language === 'ru' ? 'Маршрут курьера (Объезд)' : language === 'en' ? 'Courier Path (Detour)' : 'Traseu curier (Ocolit)')
    : (language === 'ru' ? 'Пройдено курьером' : language === 'en' ? 'Completed by courier' : 'Parcurs de curier')
  const remLegend = language === 'ru' ? 'Осталось до клиента' : language === 'en' ? 'Remaining to client' : 'Rămas până la client'
  const optLegend = language === 'ru' ? 'Оптимальный (OSRM)' : language === 'en' ? 'Optimal Route (OSRM)' : 'Traseu Optim (OSRM)'
  const gmapsLabel = language === 'ru' ? 'Маршрут Google Maps' : language === 'en' ? 'Google Maps Route' : 'Traseu Google Maps'
  const fullscreenLabel = isFullscreen
    ? (language === 'ru' ? 'Свернуть карту' : language === 'en' ? 'Exit Fullscreen' : 'Ieșire Fullscreen')
    : (language === 'ru' ? 'На весь экран' : language === 'en' ? 'Fullscreen Map' : 'Hartă Fullscreen')
  const recenterLabel = language === 'ru' ? 'Центрировать маршрут' : language === 'en' ? 'Recenter Route' : 'Recentrează Traseul'

  // Text scurt pentru badge-ul din header (1 singur rând)
  const getAuditBadgeText = () => {
    if (routeInfo.auditStatus === 'waiting_pickup') {
      return language === 'ru'
        ? `Ожид. · ~${routeInfo.driveMin}м`
        : language === 'en'
          ? `Wait · ~${routeInfo.driveMin}m`
          : `Așteptare · ~${routeInfo.driveMin}m`
    }
    if (routeInfo.auditStatus === 'suboptimal') {
      return language === 'ru'
        ? `Задержка курьера +${routeInfo.extraCourierMin}м`
        : language === 'en'
          ? `Courier Delay +${routeInfo.extraCourierMin}m`
          : `Întârziere curier +${routeInfo.extraCourierMin}m`
    }
    if (routeInfo.auditStatus === 'minor_detour') {
      return language === 'ru'
        ? `Отклонение +${routeInfo.extraCourierMin}м`
        : language === 'en'
          ? `Detour +${routeInfo.extraCourierMin}m`
          : `Abatere +${routeInfo.extraCourierMin}m`
    }
    return language === 'ru'
      ? `Оптимально (${routeInfo.efficiencyPct}%)`
      : language === 'en'
        ? `Optimal (${routeInfo.efficiencyPct}%)`
        : `Traseu Optim (${routeInfo.efficiencyPct}%)`
  }

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-xs"
          onClick={() => setIsFullscreen(false)}
        />
      )}
      <div
        style={
          isFullscreen
            ? {
                position: 'fixed',
                top: '12px',
                left: '12px',
                right: '12px',
                bottom: '12px',
                width: 'calc(100vw - 24px)',
                height: 'calc(100vh - 24px)',
                zIndex: 9999
              }
            : undefined
        }
        className={`rounded-2xl border overflow-hidden transition-all ${
          isFullscreen
            ? 'fixed inset-3 z-[9999] flex flex-col shadow-2xl'
            : ''
        } ${
          isDark ? 'bg-slate-900 border-slate-800 couriers-map-dark' : 'bg-slate-50 border-slate-200'
        }`}
      >
        {/* Header compact pe 1 SINGUR RÂND */}
        <div className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 whitespace-nowrap overflow-x-auto ${
          isDark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center gap-1.5 text-xs font-extrabold shrink-0">
            <Navigation size={13} className="text-emerald-500 shrink-0" />
            <span>
              {language === 'ru'
                ? 'Расчетный маршрут (OSRM по улицам)'
                : language === 'en'
                  ? 'Estimated Street Route (OSRM)'
                  : 'Traseu Stradal Calculat (OSRM)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowAuditPopup(prev => !prev)}
              title={
                language === 'ru'
                  ? 'Нажмите для просмотра деталей проверки маршрута'
                  : language === 'en'
                    ? 'Click to view route audit breakdown'
                    : 'Click pentru detalii verificare traseu'
              }
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                routeInfo.auditStatus === 'suboptimal'
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border-rose-500/30'
                  : routeInfo.auditStatus === 'minor_detour'
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border-amber-500/30'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border-emerald-500/30'
              }`}
            >
              {routeInfo.auditStatus === 'suboptimal' ? (
                <ShieldAlert size={11} />
              ) : routeInfo.auditStatus === 'minor_detour' ? (
                <AlertTriangle size={11} />
              ) : (
                <CheckCircle2 size={11} />
              )}
              <span>{getAuditBadgeText()}</span>
            </button>

            <button
              type="button"
              onClick={() => recenterMap(true)}
              title={recenterLabel}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold transition-colors cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
            >
              <LocateFixed size={11} />
            </button>

            <a
              href={routeInfo.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={gmapsLabel}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold transition-colors"
            >
              <MapPin size={11} />
              <span>Maps</span>
              <ExternalLink size={10} />
            </a>

            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              title={fullscreenLabel}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold transition-colors cursor-pointer ${
                isFullscreen
                  ? 'bg-rose-600 hover:bg-rose-700 border-rose-500 text-white'
                  : 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/30 text-sky-600 dark:text-sky-400'
              }`}
            >
              {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              <span>{isFullscreen ? (language === 'ru' ? 'Закрыть' : language === 'en' ? 'Close' : 'Închide') : 'Fullscreen'}</span>
            </button>
          </div>
        </div>

        {/* POP-UP MIC EXPLICATIV LA CLICK PE ALERTA ROȘIE / GALBENĂ DIN HEADER */}
        {showAuditPopup && (
          <div className={`px-3.5 py-2.5 border-b text-[11px] leading-snug ${
            routeInfo.auditStatus === 'suboptimal'
              ? (isDark ? 'bg-rose-950/90 border-rose-800/60 text-rose-100' : 'bg-rose-50 border-rose-200 text-rose-950')
              : routeInfo.auditStatus === 'minor_detour'
                ? (isDark ? 'bg-amber-950/90 border-amber-800/60 text-amber-100' : 'bg-amber-50 border-amber-200 text-amber-950')
                : (isDark ? 'bg-emerald-950/90 border-emerald-800/60 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-950')
          }`}>
            <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-current/15 font-extrabold">
              <span className="flex items-center gap-1.5">
                <ShieldAlert size={13} className="shrink-0" />
                <span>
                  {language === 'ru'
                    ? 'Детали проверки маршрута курьера'
                    : language === 'en'
                      ? 'Courier Route Audit Breakdown'
                      : 'Ce nu a fost în regulă pe traseu:'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowAuditPopup(false)}
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-[10px] mb-1.5">
              <div className={`p-1.5 rounded-lg border ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-800'}`}>
                <div className="text-[9px] font-sans font-bold text-slate-400">
                  {language === 'ru' ? 'Оптимальный:' : language === 'en' ? 'Optimal Route:' : 'Traseu Optim:'}
                </div>
                <div className="font-extrabold text-emerald-500">
                  {routeInfo.distanceKm} {kmWord} · ~{routeInfo.driveMin} {minWord}
                </div>
              </div>
              <div className={`p-1.5 rounded-lg border ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-800'}`}>
                <div className="text-[9px] font-sans font-bold text-slate-400">
                  {language === 'ru' ? 'Фактически:' : language === 'en' ? 'Actual Courier:' : 'Realizat Curier:'}
                </div>
                <div className={`font-extrabold ${routeInfo.auditStatus === 'suboptimal' ? 'text-rose-500' : 'text-amber-500'}`}>
                  ~{routeInfo.actualKm} {kmWord} · {routeInfo.actualCourierMin} {minWord}
                </div>
              </div>
              <div className={`p-1.5 rounded-lg border ${isDark ? 'bg-slate-900/80 border-slate-800 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-800'}`}>
                <div className="text-[9px] font-sans font-bold text-slate-400">
                  {language === 'ru' ? 'Отклонение:' : language === 'en' ? 'Delay / Detour:' : 'Întârziere / Abatere:'}
                </div>
                <div className="font-extrabold text-rose-500">
                  +{routeInfo.extraCourierMin} {minWord} ({routeInfo.efficiencyPct}%)
                </div>
              </div>
            </div>

            <p className="text-[10.5px] font-medium opacity-95">
              {routeInfo.auditStatus === 'suboptimal'
                ? (language === 'ru'
                  ? `Курьер ехал ${routeInfo.actualCourierMin} мин вместо расчетных ~${routeInfo.driveMin} мин (выезд ${routeInfo.depTime} → доставка ${routeInfo.estArrTime}, крюк ~+${routeInfo.extraKm} км). Вероятная причина: параллельная доставка другого заказа (мульти-заказ), лишняя остановка или отклонение от маршрута.`
                  : language === 'en'
                    ? `Courier took ${routeInfo.actualCourierMin} min instead of the optimal ~${routeInfo.driveMin} min (left ${routeInfo.depTime} → delivered ${routeInfo.estArrTime}, ~+${routeInfo.extraKm} km detour). Likely cause: multi-order delivery along the way, extra stop, or route detour.`
                    : `Curierul a parcurs traseul în ${routeInfo.actualCourierMin} min în loc de ~${routeInfo.driveMin} min (plecare ${routeInfo.depTime} → livrare ${routeInfo.estArrTime}, ocolire ~+${routeInfo.extraKm} km). Cauză probabilă: livrare paralelă a altei comenzi (multi-order), oprire suplimentară sau ocolire traseu.`)
                : routeInfo.auditStatus === 'minor_detour'
                  ? (language === 'ru'
                    ? `Небольшая задержка +${routeInfo.extraCourierMin} мин относительно прямого маршрута (светофоры или плотный трафик).`
                    : language === 'en'
                      ? `Minor delay of +${routeInfo.extraCourierMin} min compared to direct route (traffic lights or urban congestion).`
                      : `Întârziere minoră de +${routeInfo.extraCourierMin} min față de ruta directă (semafoare sau trafic urban intens).`)
                  : (language === 'ru'
                    ? 'Курьер доставил заказ вовремя по оптимальному маршруту.'
                    : language === 'en'
                      ? 'Courier delivered on time following the optimal route.'
                      : 'Curierul a livrat comanda la timp, respectând traseul optim.')}
            </p>
          </div>
        )}

        {/* Harta interactivă Leaflet */}
        <div className={`relative w-full ${isFullscreen ? 'flex-1 min-h-[420px]' : 'h-[225px]'}`}>
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Buton flotant Fullscreen & Recentrare direct pe colțul din dreapta-sus al hărții */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => recenterMap(true)}
              title={recenterLabel}
              className={`p-1.5 rounded-lg border backdrop-blur-md shadow-md cursor-pointer transition-colors ${
                isDark
                  ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white/95 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <LocateFixed size={13} />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              title={fullscreenLabel}
              className={`px-2 py-1 rounded-lg border backdrop-blur-md shadow-md text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors ${
                isFullscreen
                  ? 'bg-rose-600 hover:bg-rose-700 border-rose-500 text-white'
                  : isDark
                    ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-white'
                    : 'bg-white/95 hover:bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>

          <div className={`absolute bottom-2 left-2 z-20 px-2.5 py-1 rounded-lg border backdrop-blur-md text-[10px] flex flex-wrap items-center gap-2.5 ${
            isDark ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-700 shadow-sm'
          }`}>
            {routeInfo.hasDetourOnMap && (
              <span className="flex items-center gap-1 font-bold text-sky-500">
                <span className="w-4 h-0 inline-block" style={{ borderTop: '2.5px dashed #0ea5e9' }}></span>
                <span>{optLegend}</span>
              </span>
            )}
            <span className={`flex items-center gap-1 font-bold ${
              routeInfo.auditStatus === 'suboptimal' ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              <span className={`w-4 h-1 rounded-full inline-block ${
                routeInfo.auditStatus === 'suboptimal' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></span>
              <span>{doneLegend}</span>
            </span>
            <span className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
              <span className="w-4 h-0 inline-block" style={{ borderTop: '2.5px dashed #ef4444' }}></span>
              <span>{remLegend}</span>
            </span>
          </div>
        </div>

      {/* Bara de status + Audit pe 1 singur rând compact */}
      <div className={`px-3.5 py-2 border-t ${
        isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold whitespace-nowrap overflow-hidden">
          <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
            <Store size={12} className="text-amber-500 shrink-0" />
            <span>{depLabel}:</span>
            <b className="font-mono text-amber-500">
              {routeInfo.isDepEstimated && routeInfo.depTime !== '—' ? `~${routeInfo.depTime}` : routeInfo.depTime}
            </b>
          </span>

          <span className="font-mono text-[10px] font-extrabold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
            <Bike size={11} className="shrink-0" />
            <span className="whitespace-nowrap">{routeInfo.distanceKm} {language === 'ru' ? 'км' : 'km'} · ~{routeInfo.driveMin} {language === 'ru' ? 'мин' : 'min'}</span>
          </span>

          <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
            <MapPin size={12} className="text-emerald-500 shrink-0" />
            <span>{estLabel}:</span>
            <b className="font-mono text-emerald-500">{routeInfo.estArrTime}</b>
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <div className={`relative flex-1 h-2 rounded-full overflow-hidden ${
            isDark ? 'bg-slate-800' : 'bg-slate-200'
          }`}>
            <div
              className="h-full rounded-full transition-all duration-500 bg-emerald-500"
              style={{ width: `${routeInfo.progressPct}%` }}
            />
          </div>
          <span className="font-mono text-[11px] font-black text-emerald-600 dark:text-emerald-400 w-9 text-right shrink-0">
            {routeInfo.progressPct}%
          </span>
        </div>

        {/* Rând unic compact: Comparație Optim vs. Curier */}
        <div className={`mt-2 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-semibold flex items-center justify-between gap-2 flex-wrap ${
          routeInfo.auditStatus === 'suboptimal'
            ? (isDark ? 'bg-rose-950/25 border-rose-800/50 text-rose-200' : 'bg-rose-50/70 border-rose-200/80 text-rose-900')
            : routeInfo.auditStatus === 'minor_detour'
              ? (isDark ? 'bg-amber-950/25 border-amber-800/50 text-amber-200' : 'bg-amber-50/70 border-amber-200/80 text-amber-900')
              : (isDark ? 'bg-slate-800/60 border-slate-700/60 text-slate-300' : 'bg-slate-50 border-slate-200/80 text-slate-700')
        }`}>
          <span className="font-mono">
            {language === 'ru' ? 'Оптимум:' : language === 'en' ? 'Optimal:' : 'Optim:'}{' '}
            <b className="text-sky-500">{routeInfo.distanceKm} {language === 'ru' ? 'км' : 'km'} (~{routeInfo.driveMin}{language === 'ru' ? 'м' : 'm'})</b>
          </span>

          <span className="font-mono">
            {language === 'ru' ? 'Курьер:' : language === 'en' ? 'Courier:' : 'Curier:'}{' '}
            <b className={routeInfo.auditStatus === 'suboptimal' ? 'text-rose-500' : routeInfo.auditStatus === 'minor_detour' ? 'text-amber-500' : 'text-emerald-500'}>
              ~{routeInfo.actualKm} {language === 'ru' ? 'км' : 'km'} ({routeInfo.actualCourierMin}{language === 'ru' ? 'м' : 'm'})
            </b>
          </span>

          <span className="font-mono">
            {routeInfo.extraCourierMin > 0 ? (
              <b className={routeInfo.extraCourierMin >= 10 ? 'text-rose-500' : 'text-amber-500'}>
                +{routeInfo.extraCourierMin}{language === 'ru' ? 'м' : 'm'} (+{routeInfo.extraKm}{language === 'ru' ? 'км' : 'km'})
                {routeInfo.kitchenMin > 0 ? ` · ${language === 'ru' ? 'Кухня' : language === 'en' ? 'Kitchen' : 'Bucătărie'} ${routeInfo.kitchenMin}${language === 'ru' ? 'м' : 'm'}` : ''}
              </b>
            ) : (
              <b className="text-emerald-500">
                {language === 'ru' ? 'Без отклонений (0м)' : language === 'en' ? 'No detour (0m)' : 'Fără ocolire (0m)'}
              </b>
            )}
          </span>
        </div>
      </div>
      </div>
    </>
  )
}

