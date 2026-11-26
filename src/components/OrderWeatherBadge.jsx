import { useMemo } from 'react'
import { Car, Droplets, Wind } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useOrderWeather } from '../hooks/useNetworkWeather'
import { getCanonicalCity } from '../lib/orderUtils'
import { WeatherIcon } from './WeatherCitiesStrip'

function parseWallClockMs(ts) {
  if (!ts) return null
  const m = String(ts).trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    return Date.UTC(Number(m[1].slice(0, 4)), Number(m[1].slice(5, 7)) - 1, Number(m[1].slice(8, 10)), Number(m[2]), Number(m[3]), Number(m[4] || 0))
  }
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function extractDateYmd(ts) {
  if (!ts) return null
  const m = String(ts).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function medianOf(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function isDeliveryOrder(ord) {
  if (!ord) return false
  const ch = String(ord.channel_type || ord.channel || ord.platform || '').toLowerCase()
  return ch !== 'kiosk' && ch !== 'casierie' && ch !== 'in-store'
}

/**
 * Computes REAL fleet traffic & courier congestion at the exact city of an order.
 * Progressive window: ±45m → ±90m → same-day city → single-order telemetry.
 * 100% real data from already-loaded orders (0 EUR, zero external API calls, works retroactively).
 */
function computeOrderTrafficContext(order, peerOrders, city, restaurantName, timestamp) {
  if (!order || !isDeliveryOrder(order)) return null

  const targetCanon = getCanonicalCity(city || order.cityCanon || order.restaurant_city || restaurantName || '')
  const rawTs = timestamp || order.placed_at || order.created_at
  const targetMs = parseWallClockMs(rawTs)
  const targetYmd = extractDateYmd(rawTs)

  if (Array.isArray(peerOrders) && peerOrders.length >= 2 && targetCanon && targetCanon !== 'NECUNOSCUT' && targetMs) {
    const cityPeers = []
    const cityAllDeliv = []
    const cityAllWait = []

    for (const p of peerOrders) {
      if (!isDeliveryOrder(p)) continue
      const pCity = getCanonicalCity(p.cityCanon || p.restaurant_city || p.restaurant_name || '')
      if (pCity !== targetCanon) continue

      const pRawTs = p.placed_at || p.exact_timings?.created_at || p.created_at
      const pMs = parseWallClockMs(pRawTs)
      const pYmd = extractDateYmd(pRawTs)
      const dMin = Number(p.delivery_minutes || 0)
      const wMin = Number(p.courier_wait_minutes || 0)
      const validDeliv = dMin > 1 && dMin < 120 && !p.timings?.closed_at_handoff
      const validWait = wMin > 0 && wMin < 120

      if (validDeliv) cityAllDeliv.push(dMin)
      if (validWait) cityAllWait.push(wMin)
      cityPeers.push({ pMs, pYmd, dMin, wMin, validDeliv, validWait })
    }

    const baseDeliv = cityAllDeliv.length >= 6 ? medianOf(cityAllDeliv) : 16
    const baseWait = cityAllWait.length >= 6 ? medianOf(cityAllWait) : 8

    const evaluateSubset = (subset, windowTag) => {
      const delivs = subset.filter(x => x.validDeliv).map(x => x.dMin)
      const waits = subset.filter(x => x.validWait).map(x => x.wMin)
      if (delivs.length === 0 && waits.length === 0) return null

      const medDeliv = delivs.length > 0 ? medianOf(delivs) : null
      const medWait = waits.length > 0 ? medianOf(waits) : null
      const delivDeltaPct = (medDeliv !== null && baseDeliv > 0)
        ? Math.round(((medDeliv - baseDeliv) / baseDeliv) * 100)
        : null

      let level = 'light'
      if (
        (medDeliv !== null && (medDeliv >= 26 || (delivDeltaPct !== null && delivDeltaPct >= 35))) ||
        (medWait !== null && (medWait >= 16 || (baseWait > 0 && medWait >= baseWait * 1.55 && medWait >= 12)))
      ) {
        level = 'heavy'
      } else if (
        (medDeliv !== null && (medDeliv >= 19 || (delivDeltaPct !== null && delivDeltaPct >= 15))) ||
        (medWait !== null && medWait >= 10)
      ) {
        level = 'moderate'
      }

      return {
        mode: 'city_fleet',
        windowTag,
        level,
        medDeliv,
        baseDeliv,
        delivDeltaPct,
        medWait,
        sampleCount: subset.length
      }
    }

    // 1. Exact ±45 min window (require >= 2 measured road or wait points)
    const win45 = cityPeers.filter(x => x.pMs && Math.abs(x.pMs - targetMs) <= 45 * 60000)
    if (win45.filter(x => x.validDeliv).length >= 2 || win45.filter(x => x.validWait).length >= 2) {
      const res = evaluateSubset(win45, '±45m')
      if (res) return res
    }

    // 2. Expanded ±90 min window (handles medium cities cleanly like Oradea, Sibiu, Suceava)
    const win90 = cityPeers.filter(x => x.pMs && Math.abs(x.pMs - targetMs) <= 90 * 60000)
    if (win90.filter(x => x.validDeliv).length >= 2 || win90.filter(x => x.validWait).length >= 2) {
      const res = evaluateSubset(win90, '±90m')
      if (res) return res
    }

    // 3. Same-day city fleet fallback (when city has few orders in the immediate 90m window)
    const sameDay = targetYmd ? cityPeers.filter(x => x.pYmd === targetYmd) : cityPeers
    const resDay = evaluateSubset(sameDay.length > 0 ? sameDay : cityPeers, 'day')
    if (resDay) return resDay
  }

  // 4. Honest single-order telemetry fallback (always shows for delivery orders with timings)
  const ownDeliv = Number(order.delivery_minutes || 0)
  const ownWait = Number(order.courier_wait_minutes || 0)
  const hasDeliv = ownDeliv > 1 && ownDeliv < 120 && !order.timings?.closed_at_handoff
  const hasWait = typeof order.courier_wait_minutes === 'number' && ownWait >= 0 && ownWait < 120
  if (!hasDeliv && !hasWait) return null

  let level = 'light'
  if ((hasDeliv && ownDeliv >= 28) || (hasWait && ownWait >= 16)) level = 'heavy'
  else if ((hasDeliv && ownDeliv >= 20) || (hasWait && ownWait >= 10)) level = 'moderate'

  return {
    mode: 'single_order',
    windowTag: 'single',
    level,
    medDeliv: hasDeliv ? ownDeliv : null,
    baseDeliv: null,
    delivDeltaPct: null,
    medWait: hasWait ? ownWait : null,
    sampleCount: 1
  }
}

/**
 * Compact Apple-style Weather + City Traffic Snapshot card inside Order Details modals.
 * - Row 1: Exact Open-Meteo hourly/archive weather for the order's city, date & hour (0 EUR).
 * - Row 2: Real city fleet traffic & courier load around the order's exact time (0 EUR).
 */
export default function OrderWeatherBadge({ city, restaurantName = '', timestamp, order = null, peerOrders = null }) {
  const { isDark } = useTheme()
  const { language } = useLanguage()
  const { weather, loading } = useOrderWeather(city, timestamp, restaurantName)

  const traffic = useMemo(
    () => computeOrderTrafficContext(order, peerOrders, city, restaurantName, timestamp),
    [order, peerOrders, city, restaurantName, timestamp]
  )

  if (loading && !weather && !traffic) {
    return (
      <div className={`h-10 rounded-xl border animate-pulse ${
        isDark ? 'bg-slate-800/40 border-white/[0.06]' : 'bg-slate-50 border-black/[0.06]'
      }`} />
    )
  }

  if (!weather && !traffic) return null

  const condText = weather?.conditionLabel?.[language] || weather?.conditionLabel?.ro || ''
  const isSevere = weather?.severity === 'severe'
  const isRain = weather?.severity === 'rain'

  const containerCls = isSevere
    ? isDark
      ? 'bg-rose-950/35 border-rose-500/35 text-rose-100'
      : 'bg-rose-50/85 border-rose-200 text-rose-950'
    : isRain
      ? isDark
        ? 'bg-sky-950/35 border-sky-500/30 text-sky-100'
        : 'bg-sky-50/85 border-sky-200 text-sky-950'
      : isDark
        ? 'bg-white/[0.03] border-white/[0.08] text-slate-200'
        : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-800'

  const labelTitle = language === 'ru'
    ? 'Погода в момент заказа'
    : language === 'en'
      ? 'Weather at order time'
      : 'Vremea la ora comenzii'

  const feelsLbl = language === 'ru'
    ? 'ощущается'
    : language === 'en'
      ? 'feels'
      : 'resimțit'

  const windowBadge = traffic?.windowTag === '±45m'
    ? (language === 'ru' ? '±45м' : '±45m')
    : traffic?.windowTag === '±90m'
      ? (language === 'ru' ? '±90м' : '±90m')
      : traffic?.windowTag === 'day'
        ? (language === 'ru' ? 'за день' : language === 'en' ? 'same day' : 'pe zi')
        : ''

  const trafficLabels = {
    title: traffic?.mode === 'city_fleet'
      ? (language === 'ru'
        ? `Трафик и курьеры в городе (${windowBadge})`
        : language === 'en'
          ? `City traffic & fleet (${windowBadge})`
          : `Trafic & curieri în oraș (${windowBadge})`)
      : (language === 'ru' ? 'Дорога и подача курьера' : language === 'en' ? 'Road & courier pickup' : 'Drum & preluare curier'),
    levelText: traffic?.level === 'heavy'
      ? (language === 'ru' ? 'Плотный трафик' : language === 'en' ? 'Heavy traffic' : 'Trafic intens')
      : traffic?.level === 'moderate'
        ? (language === 'ru' ? 'Средний трафик' : language === 'en' ? 'Moderate traffic' : 'Trafic moderat')
        : (language === 'ru' ? 'Свободно' : language === 'en' ? 'Light traffic' : 'Trafic lejer'),
    road: language === 'ru' ? 'В пути' : language === 'en' ? 'Road' : 'Drum',
    wait: language === 'ru' ? 'Курьер' : language === 'en' ? 'Wait' : 'Curier',
    orders: language === 'ru' ? 'зак.' : language === 'en' ? 'ord.' : 'com.',
    minShort: language === 'ru' ? 'м' : 'm'
  }

  const trafficTone = traffic?.level === 'heavy'
    ? {
        iconBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
        pill: 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
      }
    : traffic?.level === 'moderate'
      ? {
          iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
          pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        }
      : {
          iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
          pill: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
        }

  return (
    <div className={`px-3.5 py-2.5 rounded-xl border text-[11.5px] space-y-2 ${containerCls}`}>
      {/* ROW 1: WEATHER AT ORDER TIME */}
      {weather && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isSevere
                ? 'bg-rose-500/15'
                : isRain
                  ? 'bg-sky-500/15'
                  : (isDark ? 'bg-white/[0.06]' : 'bg-white border border-black/[0.06]')
            }`}>
              <WeatherIcon type={weather.icon} size={16} />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10.5px] font-medium ${
                  isSevere ? 'text-rose-700 dark:text-rose-300' : isRain ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {labelTitle}
                </span>
                <span className="text-[10.5px] font-semibold tabular-nums opacity-75">
                  · {weather.cityLabel}, {weather.dateYmd.split('-').reverse().join('.')} {weather.exactTime || weather.hourLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[13.5px] font-bold tabular-nums">
                  {weather.temp}°C
                </span>
                <span className="font-semibold">
                  {condText}
                </span>
                <span className="text-[10.5px] opacity-75 tabular-nums">
                  ({feelsLbl} {weather.feelsLike}°C)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold tabular-nums shrink-0">
            {weather.precip > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
                <Droplets size={11} />
                {weather.precip} mm
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
              weather.wind >= 25
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : (isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-black/[0.05] text-slate-600')
            }`}>
              <Wind size={11} />
              {weather.wind} km/h
            </span>
          </div>
        </div>
      )}

      {/* ROW 2: CITY TRAFFIC & FLEET LOAD AT ORDER TIME (0 EUR real fleet telemetry) */}
      {traffic && (
        <div className={`flex flex-wrap items-center justify-between gap-2 ${
          weather ? 'pt-2 border-t border-black/[0.06] dark:border-white/[0.08]' : ''
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${trafficTone.iconBg}`}>
              <Car size={15} />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                  {trafficLabels.title}
                </span>
                {traffic.mode === 'city_fleet' && (
                  <span className="text-[10.5px] font-semibold tabular-nums opacity-75">
                    · {traffic.sampleCount} {trafficLabels.orders}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${trafficTone.pill}`}>
                  {trafficLabels.levelText}
                </span>
                {traffic.delivDeltaPct !== null && Math.abs(traffic.delivDeltaPct) >= 12 && (
                  <span className="text-[11px] font-semibold tabular-nums opacity-80">
                    {traffic.delivDeltaPct > 0 ? `+${traffic.delivDeltaPct}%` : `${traffic.delivDeltaPct}%`} vs {traffic.baseDeliv}{trafficLabels.minShort}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold tabular-nums shrink-0">
            {traffic.medDeliv !== null && (
              <span className={`px-2 py-0.5 rounded-full ${
                isDark ? 'bg-white/[0.06] text-slate-200' : 'bg-black/[0.05] text-slate-700'
              }`}>
                {trafficLabels.road}: {traffic.medDeliv}{trafficLabels.minShort}
              </span>
            )}
            {traffic.medWait !== null && (
              <span className={`px-2 py-0.5 rounded-full ${
                traffic.medWait >= 14
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                  : (isDark ? 'bg-white/[0.06] text-slate-200' : 'bg-black/[0.05] text-slate-700')
              }`}>
                {trafficLabels.wait}: {traffic.medWait}{trafficLabels.minShort}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
