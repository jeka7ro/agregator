import { useState, useEffect, useCallback } from 'react'
import { getCanonicalCity } from '../lib/orderUtils'

export const WEATHER_CITIES = [
  { key: 'BUCURESTI', label: 'București', lat: 44.4268, lng: 26.1025 },
  { key: 'CLUJ-NAPOCA', label: 'Cluj-Napoca', lat: 46.7712, lng: 23.5849 },
  { key: 'TIMISOARA', label: 'Timișoara', lat: 45.7489, lng: 21.2087 },
  { key: 'IASI', label: 'Iași', lat: 47.1585, lng: 27.6014 },
  { key: 'CONSTANTA', label: 'Constanța', lat: 44.1782, lng: 28.6534 },
  { key: 'BRASOV', label: 'Brașov', lat: 45.6408, lng: 25.6182 },
  { key: 'CRAIOVA', label: 'Craiova', lat: 44.3188, lng: 23.8165 },
  { key: 'ORADEA', label: 'Oradea', lat: 47.0465, lng: 21.9102 },
  { key: 'SIBIU', label: 'Sibiu', lat: 45.7785, lng: 24.1702 },
  { key: 'GALATI', label: 'Galați', lat: 45.4353, lng: 28.0315 },
  { key: 'BRAILA', label: 'Brăila', lat: 45.2695, lng: 27.9635 },
  { key: 'PITESTI', label: 'Pitești', lat: 44.8522, lng: 24.8785 },
  { key: 'BACAU', label: 'Bacău', lat: 46.5785, lng: 26.9165 },
  { key: 'TARGU MURES', label: 'Târgu Mureș', lat: 46.5332, lng: 24.5914 },
  { key: 'SUCEAVA', label: 'Suceava', lat: 47.6418, lng: 26.2442 },
  { key: 'BOTOSANI', label: 'Botoșani', lat: 47.7422, lng: 26.6495 },
  { key: 'TULCEA', label: 'Tulcea', lat: 45.1787, lng: 28.8051 },
  { key: 'PIATRA NEAMT', label: 'Piatra Neamț', lat: 46.9312, lng: 26.3745 },
  { key: 'BALOTESTI', label: 'Balotești', lat: 44.6145, lng: 26.0772 }
]

const CACHE_KEY = 'ag_network_weather_v1'
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes (0 EUR Open-Meteo direct client cache)

let memoryCache = null

/**
 * Decode WMO Weather Interpretation Code into icon key, severity, and RO/RU/EN labels.
 */
export function decodeWmoWeather(code, isDay = 1, precipitation = 0, windKmh = 0) {
  const c = Number(code)
  const precip = Number(precipitation || 0)
  const wind = Number(windKmh || 0)

  if (c >= 95) {
    return {
      icon: 'storm',
      severity: 'severe',
      label: { ro: 'Furtună', ru: 'Гроза', en: 'Thunderstorm' }
    }
  }
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) {
    return {
      icon: 'snow',
      severity: 'severe',
      label: { ro: 'Ninsoare', ru: 'Снег', en: 'Snow' }
    }
  }
  if (c === 56 || c === 57 || c === 66 || c === 67) {
    return {
      icon: 'snow',
      severity: 'severe',
      label: { ro: 'Polei / Lapoviță', ru: 'Гололёд', en: 'Freezing Rain' }
    }
  }
  if (c === 65 || c === 82 || precip >= 2.0) {
    return {
      icon: 'heavy_rain',
      severity: 'severe',
      label: { ro: 'Ploaie puternică', ru: 'Сильный дождь', en: 'Heavy Rain' }
    }
  }
  if ((c >= 51 && c <= 63) || (c >= 80 && c <= 81) || precip > 0) {
    return {
      icon: 'rain',
      severity: 'rain',
      label: { ro: c <= 55 ? 'Burniță' : 'Ploaie', ru: c <= 55 ? 'Морось' : 'Дождь', en: c <= 55 ? 'Drizzle' : 'Rain' }
    }
  }
  if (c === 45 || c === 48) {
    return {
      icon: 'fog',
      severity: wind >= 35 ? 'rain' : 'normal',
      label: { ro: 'Ceață', ru: 'Туман', en: 'Fog' }
    }
  }
  if (c === 3) {
    return {
      icon: 'cloudy',
      severity: wind >= 38 ? 'rain' : 'normal',
      label: { ro: 'Înnorat', ru: 'Пасмурно', en: 'Overcast' }
    }
  }
  if (c === 1 || c === 2) {
    return {
      icon: 'partly_cloudy',
      severity: wind >= 38 ? 'rain' : 'normal',
      label: { ro: 'Parțial noros', ru: 'Переменная обл.', en: 'Partly Cloudy' }
    }
  }
  return {
    icon: isDay ? 'sun' : 'moon',
    severity: wind >= 38 ? 'rain' : 'normal',
    label: { ro: 'Senin', ru: 'Ясно', en: 'Clear' }
  }
}

function readCachedWeather() {
  if (memoryCache && Date.now() - memoryCache.ts < CACHE_TTL_MS) {
    return memoryCache
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS && Array.isArray(parsed.cities)) {
      memoryCache = parsed
      return parsed
    }
  } catch (_) { }
  return null
}

export function useNetworkWeather() {
  const initial = readCachedWeather()
  const [cities, setCities] = useState(initial?.cities || [])
  const [updatedAt, setUpdatedAt] = useState(initial?.ts || null)
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState(null)

  const fetchWeather = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCachedWeather()
      if (cached) {
        setCities(cached.cities)
        setUpdatedAt(cached.ts)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    setError(null)
    try {
      const lats = WEATHER_CITIES.map(c => c.lat).join(',')
      const lngs = WEATHER_CITIES.map(c => c.lng).join(',')
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&timezone=Europe%2FBucharest`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const list = Array.isArray(json) ? json : [json]

      const mapped = WEATHER_CITIES.map((city, idx) => {
        const cur = list[idx]?.current || {}
        const temp = typeof cur.temperature_2m === 'number' ? Math.round(cur.temperature_2m) : null
        const feelsLike = typeof cur.apparent_temperature === 'number' ? Math.round(cur.apparent_temperature) : null
        const precip = typeof cur.precipitation === 'number' ? Number(cur.precipitation.toFixed(1)) : 0
        const wind = typeof cur.wind_speed_10m === 'number' ? Math.round(cur.wind_speed_10m) : 0
        const isDay = cur.is_day ?? 1
        const wmo = decodeWmoWeather(cur.weather_code, isDay, precip, wind)
        return {
          key: city.key,
          label: city.label,
          lat: city.lat,
          lng: city.lng,
          temp,
          feelsLike,
          precip,
          wind,
          isDay,
          weatherCode: cur.weather_code ?? 0,
          icon: wmo.icon,
          severity: wmo.severity,
          conditionLabel: wmo.label
        }
      })

      const entry = { ts: Date.now(), cities: mapped }
      memoryCache = entry
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
      } catch (_) { }
      setCities(mapped)
      setUpdatedAt(entry.ts)
    } catch (err) {
      setError(err?.message || 'Weather fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWeather(false)
    const id = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        fetchWeather(true)
      }
    }, CACHE_TTL_MS)
    return () => clearInterval(id)
  }, [fetchWeather])

  return { cities, updatedAt, loading, error, refreshWeather: () => fetchWeather(true) }
}

// ─── HISTORICAL / EXACT-HOUR ORDER WEATHER (0 EUR Open-Meteo Hourly + Archive, cached per city+date) ───
const HIST_CACHE_PREFIX = 'ag_hist_weather_v1_'
const histMemCache = new Map()
const histInFlight = new Map()

function resolveWeatherCity(cityInput, fallbackName = '') {
  const candidates = [cityInput, fallbackName].filter(Boolean)
  for (const cand of candidates) {
    const canon = getCanonicalCity(cand)
    if (!canon || canon === 'NECUNOSCUT') continue
    const hit = WEATHER_CITIES.find(c => c.key === canon)
      || WEATHER_CITIES.find(c => canon.includes(c.key) || c.key.includes(canon))
    if (hit) return hit
  }
  return null
}

function parseOrderDateAndHourRo(timestampInput) {
  if (!timestampInput) return null
  const raw = String(timestampInput).trim()
  // iiko / Supabase stores placed_at as Romania local wall-clock time (even when suffixed with "Z"),
  // matching parseOrderDateTime / OrderDetailsModal across the app.
  const wallMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/)
  if (wallMatch) {
    return {
      dateYmd: wallMatch[1],
      hour: Math.min(23, Math.max(0, Number(wallMatch[2]))),
      exactTime: `${wallMatch[2]}:${wallMatch[3]}`
    }
  }
  const dt = new Date(raw)
  if (Number.isNaN(dt.getTime())) return null
  const roWall = dt.toLocaleString('sv-SE', { timeZone: 'Europe/Bucharest' }) // "YYYY-MM-DD HH:MM:SS"
  return {
    dateYmd: roWall.slice(0, 10),
    hour: Math.min(23, Math.max(0, Number(roWall.slice(11, 13)))),
    exactTime: roWall.slice(11, 16)
  }
}

async function fetchCityDayHourly(cityObj, dateYmd) {
  const cacheKey = `${cityObj.key}_${dateYmd}`
  const todayRo = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
  const isToday = dateYmd === todayRo
  const ttlMs = isToday ? 30 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000 // Today: 30m, past days: immutable 30d

  const mem = histMemCache.get(cacheKey)
  if (mem && Date.now() - mem.ts < ttlMs) return mem.hourly

  try {
    const raw = localStorage.getItem(HIST_CACHE_PREFIX + cacheKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.hourly && parsed?.ts && Date.now() - parsed.ts < ttlMs) {
        histMemCache.set(cacheKey, parsed)
        return parsed.hourly
      }
    }
  } catch (_) { }

  if (histInFlight.has(cacheKey)) return histInFlight.get(cacheKey)

  const promise = (async () => {
    try {
      const daysDiff = Math.round((new Date(`${todayRo}T12:00:00Z`) - new Date(`${dateYmd}T12:00:00Z`)) / 86400000)
      if (daysDiff < -1 || daysDiff > 3650) return null
      const baseHost = daysDiff > 55
        ? 'https://archive-api.open-meteo.com/v1/archive'
        : 'https://api.open-meteo.com/v1/forecast'
      const url = `${baseHost}?latitude=${cityObj.lat}&longitude=${cityObj.lng}&hourly=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&start_date=${dateYmd}&end_date=${dateYmd}&timezone=Europe%2FBucharest`
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json()
      const hourly = json?.hourly || null
      if (!hourly?.time) return null

      const entry = { ts: Date.now(), hourly }
      histMemCache.set(cacheKey, entry)
      try {
        // Keep localStorage clean (evict old entries if > 45 cached city-days)
        const keys = Object.keys(localStorage).filter(k => k.startsWith(HIST_CACHE_PREFIX))
        if (keys.length > 45) {
          keys.slice(0, keys.length - 40).forEach(k => localStorage.removeItem(k))
        }
        localStorage.setItem(HIST_CACHE_PREFIX + cacheKey, JSON.stringify(entry))
      } catch (_) { }
      return hourly
    } catch (_) {
      return null
    } finally {
      histInFlight.delete(cacheKey)
    }
  })()

  histInFlight.set(cacheKey, promise)
  return promise
}

export function useOrderWeather(city, timestamp, fallbackName = '') {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cityObj = resolveWeatherCity(city, fallbackName)
    const dtInfo = parseOrderDateAndHourRo(timestamp)
    if (!cityObj || !dtInfo) {
      setWeather(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchCityDayHourly(cityObj, dtInfo.dateYmd).then((hourly) => {
      if (cancelled) return
      setLoading(false)
      if (!hourly || !Array.isArray(hourly.time)) {
        setWeather(null)
        return
      }
      const targetPrefix = `${dtInfo.dateYmd}T${String(dtInfo.hour).padStart(2, '0')}:`
      let idx = hourly.time.findIndex(t => String(t).startsWith(targetPrefix))
      if (idx < 0) idx = Math.min(dtInfo.hour, hourly.time.length - 1)
      if (idx < 0) {
        setWeather(null)
        return
      }
      const tempRaw = hourly.temperature_2m?.[idx]
      const feelsRaw = hourly.apparent_temperature?.[idx]
      const precipRaw = hourly.precipitation?.[idx]
      const windRaw = hourly.wind_speed_10m?.[idx]
      const code = hourly.weather_code?.[idx] ?? 0
      const isDay = hourly.is_day?.[idx] ?? (dtInfo.hour >= 7 && dtInfo.hour <= 19 ? 1 : 0)

      if (typeof tempRaw !== 'number') {
        setWeather(null)
        return
      }

      const precip = typeof precipRaw === 'number' ? Number(precipRaw.toFixed(1)) : 0
      const wind = typeof windRaw === 'number' ? Math.round(windRaw) : 0
      const wmo = decodeWmoWeather(code, isDay, precip, wind)
      setWeather({
        cityLabel: cityObj.label,
        dateYmd: dtInfo.dateYmd,
        hourLabel: `${String(dtInfo.hour).padStart(2, '0')}:00`,
        exactTime: dtInfo.exactTime,
        temp: Math.round(tempRaw),
        feelsLike: typeof feelsRaw === 'number' ? Math.round(feelsRaw) : Math.round(tempRaw),
        precip,
        wind,
        icon: wmo.icon,
        severity: wmo.severity,
        conditionLabel: wmo.label
      })
    })

    return () => { cancelled = true }
  }, [city, timestamp, fallbackName])

  return { weather, loading }
}
