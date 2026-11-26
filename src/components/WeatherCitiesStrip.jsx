import { useMemo, useState } from 'react'
import {
  Sun,
  Moon,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  RotateCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import { useAuth } from '../lib/AuthContext'
import { useNetworkWeather } from '../hooks/useNetworkWeather'

export function WeatherIcon({ type, size = 16 }) {
  switch (type) {
    case 'storm':
      return <CloudLightning size={size} className="text-rose-500 dark:text-rose-400 shrink-0" />
    case 'snow':
      return <CloudSnow size={size} className="text-sky-500 dark:text-sky-300 shrink-0" />
    case 'heavy_rain':
      return <CloudRain size={size} className="text-blue-600 dark:text-blue-400 shrink-0" />
    case 'rain':
      return <CloudRain size={size} className="text-sky-600 dark:text-sky-400 shrink-0" />
    case 'fog':
      return <CloudFog size={size} className="text-slate-500 dark:text-slate-400 shrink-0" />
    case 'cloudy':
      return <Cloud size={size} className="text-slate-500 dark:text-slate-400 shrink-0" />
    case 'partly_cloudy':
      return <CloudSun size={size} className="text-amber-500 dark:text-amber-400 shrink-0" />
    case 'moon':
      return <Moon size={size} className="text-indigo-500 dark:text-indigo-300 shrink-0" />
    default:
      return <Sun size={size} className="text-amber-500 dark:text-amber-400 shrink-0" />
  }
}

const COLLAPSE_STORAGE_KEY = 'ag_pref_weather_strip_collapsed_v1'

export default function WeatherCitiesStrip({
  selectedCity = 'all',
  onSelectCity = null,
  collapsible = false
}) {
  const { isDark } = useTheme()
  const { language } = useLanguage()
  const { canAccessCity } = useAuth()
  const { cities, updatedAt, loading, error, refreshWeather } = useNetworkWeather()
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'adverse'

  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1'
    } catch (_) {
      return false
    }
  })

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0')
      } catch (_) { }
      return next
    })
  }

  // Respect RBAC scope & prioritize adverse weather (snow/storm/rain) first
  const scopedCities = useMemo(() => {
    const scoped = (cities || []).filter(c => {
      if (typeof canAccessCity === 'function' && !canAccessCity(c.key)) return false
      return true
    })
    const severityRank = { severe: 0, rain: 1, normal: 2 }
    return [...scoped].sort((a, b) => {
      if (selectedCity && selectedCity !== 'all') {
        if (a.key === selectedCity) return -1
        if (b.key === selectedCity) return 1
      }
      const rDiff = (severityRank[a.severity] ?? 2) - (severityRank[b.severity] ?? 2)
      if (rDiff !== 0) return rDiff
      return a.label.localeCompare(b.label, 'ro')
    })
  }, [cities, canAccessCity, selectedCity])

  const summary = useMemo(() => {
    if (scopedCities.length === 0) return null
    const temps = scopedCities.map(c => c.temp).filter(v => typeof v === 'number')
    const minT = temps.length ? Math.min(...temps) : null
    const maxT = temps.length ? Math.max(...temps) : null
    const severeCount = scopedCities.filter(c => c.severity === 'severe').length
    const adverseCount = scopedCities.filter(c => c.severity === 'severe' || c.severity === 'rain').length
    return { minT, maxT, severeCount, adverseCount }
  }, [scopedCities])

  const displayedCities = useMemo(() => {
    if (filterMode === 'adverse' && (summary?.adverseCount || 0) > 0) {
      return scopedCities.filter(c => c.severity === 'severe' || c.severity === 'rain')
    }
    return scopedCities
  }, [scopedCities, filterMode, summary])

  const titleText = language === 'ru'
    ? 'Погода в городах сети'
    : language === 'en'
      ? 'Network Cities Weather'
      : 'Condiții Meteo în Orașele Rețelei'

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleTimeString(language === 'ru' ? 'ru-RU' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <section aria-label={titleText} className="space-y-2">
      {/* External Section Header ABOVE cards — matches Dashboard Row 1/2/3 architecture 1:1 */}
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-[30px]">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <CloudSun size={15} className="text-[#047857] dark:text-[#10B981] shrink-0" />
            <span>{titleText}</span>
          </h3>

          {summary && summary.minT !== null && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
              isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-black/[0.05] text-slate-700'
            }`}>
              {summary.minT === summary.maxT ? `${summary.minT}°C` : `${summary.minT}°C … ${summary.maxT}°C`}
            </span>
          )}

          {summary && summary.severeCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/20">
              <AlertTriangle size={11} className="shrink-0" />
              <span className="tabular-nums">
                {language === 'ru'
                  ? `Сложная погода: ${summary.severeCount}`
                  : language === 'en'
                    ? `Severe: ${summary.severeCount}`
                    : `Vreme severă: ${summary.severeCount}`}
              </span>
            </span>
          )}

          {summary && summary.adverseCount > 0 && summary.severeCount === 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/12 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              <Droplets size={11} className="shrink-0" />
              <span className="tabular-nums">
                {language === 'ru'
                  ? `Осадки: ${summary.adverseCount} гор.`
                  : language === 'en'
                    ? `Rain: ${summary.adverseCount} cities`
                    : `Ploaie: ${summary.adverseCount} orașe`}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {summary && summary.adverseCount > 0 && !collapsed && (
            <div role="group" className="apple-segmented">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`apple-segment !h-[24px] !px-2.5 !text-[11px] ${filterMode === 'all' ? 'apple-segment-active' : ''}`}
              >
                {language === 'ru' ? `Все (${scopedCities.length})` : language === 'en' ? `All (${scopedCities.length})` : `Toate (${scopedCities.length})`}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('adverse')}
                className={`apple-segment !h-[24px] !px-2.5 !text-[11px] ${filterMode === 'adverse' ? 'apple-segment-active' : ''}`}
              >
                {language === 'ru' ? `Осадки (${summary.adverseCount})` : language === 'en' ? `Rain/Snow (${summary.adverseCount})` : `Ploaie/Ninsoare (${summary.adverseCount})`}
              </button>
            </div>
          )}

          {updatedLabel && (
            <span className="text-[11px] tabular-nums text-[#636366] dark:text-[#8E8E93] hidden sm:inline">
              {updatedLabel}
            </span>
          )}

          <button
            type="button"
            onClick={refreshWeather}
            disabled={loading}
            aria-label={language === 'ru' ? 'Обновить погоду' : language === 'en' ? 'Refresh weather' : 'Actualizează meteo'}
            className="apple-btn-secondary !h-7 !w-7 !p-0 justify-center"
          >
            <RotateCw size={12} className={loading ? 'animate-spin text-[#047857] dark:text-[#10B981]' : ''} />
          </button>

          {collapsible && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              className="apple-btn-secondary !h-7 !px-2.5 !text-[11px]"
            >
              <span>{collapsed ? (language === 'ru' ? 'Показать' : language === 'en' ? 'Show' : 'Arată') : (language === 'ru' ? 'Свернуть' : language === 'en' ? 'Hide' : 'Restrânge')}</span>
              {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Ultra-compact 1-line Apple Weather Micro-Chips — ZERO horizontal scrollbar, ~3× more compact! */}
      {!collapsed && (
        error && displayedCities.length === 0 ? (
          <div className={`px-3 py-2 rounded-xl border text-xs ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
          }`}>
            {language === 'ru' ? 'Погода временно недоступна.' : language === 'en' ? 'Weather temporarily unavailable.' : 'Datele meteo nu sunt disponibile momentan.'}
          </div>
        ) : loading && displayedCities.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className={`h-[30px] w-28 rounded-full border animate-pulse ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {displayedCities.map((c) => {
              const isSelected = selectedCity && selectedCity !== 'all' && selectedCity === c.key
              const condText = c.conditionLabel?.[language] || c.conditionLabel?.ro || ''

              const chipStyle = isSelected
                ? 'bg-[#047857] border-[#047857] text-white dark:bg-[#10B981] dark:border-[#10B981] dark:text-slate-950 shadow-xs'
                : c.severity === 'severe'
                  ? isDark
                    ? 'bg-rose-950/35 border-rose-500/35 hover:border-rose-400/60 text-rose-100'
                    : 'bg-rose-50/85 border-rose-200 hover:border-rose-300 text-rose-950'
                  : c.severity === 'rain'
                    ? isDark
                      ? 'bg-sky-950/35 border-sky-500/30 hover:border-sky-400/55 text-sky-100'
                      : 'bg-sky-50/80 border-sky-200 hover:border-sky-300 text-sky-950'
                    : isDark
                      ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-100'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-[#1D1D1F] shadow-2xs'

              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onSelectCity && onSelectCity(isSelected ? 'all' : c.key)}
                  title={`${c.label} · ${condText} · ${c.temp ?? '—'}°C (resimțit ${c.feelsLike ?? '—'}°C) · Vânt ${c.wind} km/h${c.precip > 0 ? ` · ${c.precip} mm` : ''}`}
                  className={`h-[30px] px-2.5 rounded-full border transition-all inline-flex items-center gap-1.5 text-[11.5px] leading-none ${
                    onSelectCity ? 'cursor-pointer' : 'cursor-default'
                  } ${chipStyle}`}
                >
                  <WeatherIcon type={c.icon} size={13} />
                  <span className="font-semibold">{c.label}</span>
                  <span className="font-bold tabular-nums">
                    {c.temp !== null ? `${c.temp}°` : '—'}
                  </span>
                  {c.precip > 0 ? (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${
                      isSelected ? 'opacity-90' : (c.severity === 'severe' ? 'text-rose-700 dark:text-rose-300' : 'text-sky-700 dark:text-sky-300')
                    }`}>
                      <Droplets size={9} />
                      {c.precip}mm
                    </span>
                  ) : c.wind >= 25 ? (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${
                      isSelected ? 'opacity-90' : 'text-amber-700 dark:text-amber-300'
                    }`}>
                      <Wind size={9} />
                      {c.wind}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )
      )}
    </section>
  )
}
