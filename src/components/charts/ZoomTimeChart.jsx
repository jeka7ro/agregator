import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Clock, ZoomIn, ZoomOut, RefreshCw, AlertTriangle, TrendingUp, Info, ExternalLink } from 'lucide-react'
import { useLanguage } from '../../lib/LanguageContext'
import { getApiUrl } from '../../lib/api'
import { cleanRestaurantName } from '../BrandAvatar'

// Monotone / Catmull-Rom to Cubic Bezier curve path
function getCurvedPath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i < points.length - 2 ? points[i + 2] : p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export default function ZoomTimeChart({ restaurants = [], checks = [], isDark = false, isExpanded = false, t }) {
  const { t: contextT, language } = useLanguage()
  const navigate = useNavigate()
  const tr = t || contextT
  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  // Preset: '6h' | '12h' | '24h' | '7d' | '30d'
  const [rangePreset, setRangePreset] = useState('24h')
  // Mini scrubber zoom window: percentages [start%, end%]
  const [scrubberWindow, setScrubberWindow] = useState([0, 100])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [stopEvents, setStopEvents] = useState([])
  const svgRef = useRef(null)

  useEffect(() => {
    let mounted = true
    fetch(getApiUrl('/api/stop-events?limit=150'))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (mounted && d) {
          const list = Array.isArray(d.events) ? d.events : (Array.isArray(d.stop_events) ? d.stop_events : [])
          setStopEvents(list)
        }
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  // Generate timeline data strictly from real checks & real stop_events (NO Math.random)
  const rawTimelineData = useMemo(() => {
    let pointCount = 24
    let intervalHours = 1
    if (rangePreset === '6h') { pointCount = 18; intervalHours = 0.33; }
    else if (rangePreset === '12h') { pointCount = 24; intervalHours = 0.5; }
    else if (rangePreset === '24h') { pointCount = 24; intervalHours = 1; }
    else if (rangePreset === '7d') { pointCount = 28; intervalHours = 6; }
    else if (rangePreset === '30d') { pointCount = 30; intervalHours = 24; }

    const activeRests = (restaurants || []).filter(r => r.is_active !== false)
    const restMap = new Map()
    activeRests.forEach(r => restMap.set(r.id, r))
    const totalActiveLocations = activeRests.length || 52

    // Live currently stopped channels on configured platforms
    const currentStopped = []
    ;(checks || []).forEach(c => {
      const st = String(c.final_status || '').toLowerCase()
      if (st === 'closed' || st === 'offline' || st === 'unavailable' || st === 'error') {
        const r = restMap.get(c.restaurant_id)
        if (!r) return
        const p = String(c.platform || '').toLowerCase()
        const pUrl = p !== 'iiko' ? r[`${p}_url`] : r.iiko_restaurant_id
        if (!pUrl || (p !== 'iiko' && String(pUrl).includes('/search'))) return
        currentStopped.push({
          restaurantId: r.id,
          name: `${cleanRestaurantName(r.name)} (${p.toUpperCase()})`,
          platform: p,
          checkedAt: c.checked_at ? new Date(c.checked_at).getTime() : Date.now(),
          rate: Number(r.revenue_per_hour) || 50
        })
      }
    })

    const now = Date.now()
    const slotMs = intervalHours * 3600 * 1000
    const points = []

    for (let i = pointCount; i >= 0; i--) {
      const slotEnd = now - i * slotMs
      const slotStart = slotEnd - slotMs
      const time = new Date(slotEnd)

      const stoppedInSlotMap = new Map()

      // 1. Check historical stop_events overlapping [slotStart, slotEnd]
      ;(stopEvents || []).forEach(ev => {
        const r = restMap.get(ev.restaurant_id)
        // Respect user city/brand/restaurant scope: if scoped restaurants list is loaded, ignore events outside it
        if (activeRests.length > 0 && !r) return
        const p = String(ev.platform || '').toLowerCase()
        if (r && (p === 'glovo' || p === 'wolt' || p === 'bolt')) {
          const pUrl = r[`${p}_url`]
          if (!pUrl || String(pUrl).includes('/search')) return
        }
        const stMs = ev.stopped_at ? new Date(ev.stopped_at).getTime() : 0
        if (!stMs) return
        const resMs = ev.resumed_at ? new Date(ev.resumed_at).getTime() : (stMs + 2 * 3600 * 1000)
        if (stMs <= slotEnd && resMs >= slotStart) {
          const rName = cleanRestaurantName(r?.name || ev.restaurants?.name || 'Locație')
          const key = `${ev.restaurant_id}_${p}`
          stoppedInSlotMap.set(key, {
            name: `${rName} (${p.toUpperCase()})`,
            loss: Math.round((Number(r?.revenue_per_hour || ev.restaurants?.revenue_per_hour || 50)) * Math.min(1, intervalHours))
          })
        }
      })

      // 2. For the current/latest slot (i === 0), include any live stopped checks
      if (i === 0) {
        currentStopped.forEach(cs => {
          const key = `${cs.restaurantId}_${cs.platform}`
          stoppedInSlotMap.set(key, {
            name: cs.name,
            loss: Math.round(cs.rate * Math.min(1, intervalHours))
          })
        })
      }

      const stoppedItems = Array.from(stoppedInSlotMap.values())
      const incidentCount = stoppedItems.length
      const stoppedNames = stoppedItems.map(s => s.name)
      const lossAmount = stoppedItems.reduce((sum, s) => sum + s.loss, 0)
      const onlineLocations = Math.max(0, totalActiveLocations - incidentCount)
      const uptime = totalActiveLocations > 0
        ? +(Math.max(0, Math.min(100, (onlineLocations / totalActiveLocations) * 100))).toFixed(1)
        : 100

      points.push({
        timestamp: time.toISOString(),
        formattedTime: time.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }),
        formattedDate: time.toLocaleDateString(localeCode, { day: '2-digit', month: 'short' }),
        uptime,
        incidentCount,
        stoppedNames,
        lossAmount,
        activeLocations: onlineLocations,
        totalLocations: totalActiveLocations
      })
    }

    return points
  }, [rangePreset, localeCode, restaurants, checks, stopEvents])

  // Filter timeline based on scrubber window [start%, end%]
  const visibleTimeline = useMemo(() => {
    const total = rawTimelineData.length
    if (total === 0) return []
    const startIdx = Math.floor((scrubberWindow[0] / 100) * total)
    const endIdx = Math.ceil((scrubberWindow[1] / 100) * total)
    return rawTimelineData.slice(Math.max(0, startIdx), Math.min(total, endIdx))
  }, [rawTimelineData, scrubberWindow])

  // SVG coordinate calculations for main chart — Compact laptop height
  const width = 580
  const height = isExpanded ? 240 : 196
  const padding = { top: 16, right: 20, bottom: 26, left: 42 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Map points to SVG coordinates (clamped cleanly to chart vertical domain)
  const svgPoints = useMemo(() => {
    if (visibleTimeline.length === 0) return []
    const minVal = 80 // Scale from 80% to 100% for high dynamic visual resolution
    const maxVal = 100

    return visibleTimeline.map((pt, idx) => {
      const x = padding.left + (idx / (visibleTimeline.length - 1 || 1)) * chartW
      const normY = Math.max(0, Math.min(1, (pt.uptime - minVal) / (maxVal - minVal)))
      const y = padding.top + (1 - normY) * chartH
      return { ...pt, x, y }
    })
  }, [visibleTimeline, chartW, chartH, padding.left, padding.top])

  // Mini-map points (for bottom timeline scrubber)
  const miniPoints = useMemo(() => {
    const miniH = 36
    const minVal = 80
    const maxVal = 100
    return rawTimelineData.map((pt, idx) => {
      const x = (idx / (rawTimelineData.length - 1 || 1)) * width
      const normY = Math.max(0, Math.min(1, (pt.uptime - minVal) / (maxVal - minVal)))
      const y = (1 - normY) * miniH
      return { x, y }
    })
  }, [rawTimelineData, width])

  const curvedLinePath = useMemo(() => getCurvedPath(svgPoints), [svgPoints])
  const areaPath = useMemo(() => {
    if (svgPoints.length === 0) return ''
    const bottomY = padding.top + chartH
    return `${curvedLinePath} L ${svgPoints[svgPoints.length - 1].x.toFixed(1)} ${bottomY} L ${svgPoints[0].x.toFixed(1)} ${bottomY} Z`
  }, [curvedLinePath, svgPoints, padding.top, chartH])

  const miniLinePath = useMemo(() => getCurvedPath(miniPoints), [miniPoints])

  // Average stats
  const stats = useMemo(() => {
    if (visibleTimeline.length === 0) return { avg: 100, min: 100, max: 100, totalLoss: 0 }
    let sum = 0, min = 100, max = 0, loss = 0
    visibleTimeline.forEach(p => {
      sum += p.uptime
      loss += p.lossAmount
      if (p.uptime < min) min = p.uptime
      if (p.uptime > max) max = p.uptime
    })
    return {
      avg: +(sum / visibleTimeline.length).toFixed(1),
      min: +min.toFixed(1),
      max: +max.toFixed(1),
      totalLoss: loss
    }
  }, [visibleTimeline])

  // Mouse hover tracking (properly scales CSS pixel coordinates to SVG viewBox units)
  const handleMouseMove = (e) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    const svgX = (cssX / rect.width) * width
    setMousePos({ x: cssX, y: cssY, containerW: rect.width })

    // Find closest point by scaled SVG X coordinate
    if (svgPoints.length > 0) {
      let closest = svgPoints[0]
      let minDiff = Math.abs(svgPoints[0].x - svgX)
      for (const p of svgPoints) {
        const diff = Math.abs(p.x - svgX)
        if (diff < minDiff) {
          minDiff = diff
          closest = p
        }
      }
      setHoveredPoint(closest)
    }
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  // Interactive Timeline Scrubber & Zoom Drag Handlers
  const trackRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragInfoRef = useRef(null)

  const getPercentageFromX = (clientX) => {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = (x / rect.width) * 100
    return Math.max(0, Math.min(100, pct))
  }

  const handleStartDrag = (mode, e) => {
    e.preventDefault()
    e.stopPropagation()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    dragInfoRef.current = {
      mode,
      startX: clientX,
      initialWindow: [...scrubberWindow],
    }
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (e) => {
      if (!dragInfoRef.current || !trackRef.current) return
      const { mode, startX, initialWindow } = dragInfoRef.current
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const rect = trackRef.current.getBoundingClientRect()
      if (rect.width === 0) return
      const deltaX = clientX - startX
      const deltaPct = (deltaX / rect.width) * 100

      const minSpan = 6 // Minimum 6% window to prevent collapsing

      if (mode === 'move') {
        const span = initialWindow[1] - initialWindow[0]
        let newStart = initialWindow[0] + deltaPct
        let newEnd = initialWindow[1] + deltaPct

        if (newStart < 0) {
          newStart = 0
          newEnd = span
        } else if (newEnd > 100) {
          newEnd = 100
          newStart = 100 - span
        }
        setScrubberWindow([+newStart.toFixed(1), +newEnd.toFixed(1)])
      } else if (mode === 'left') {
        let newStart = Math.min(initialWindow[0] + deltaPct, initialWindow[1] - minSpan)
        newStart = Math.max(0, newStart)
        setScrubberWindow([+newStart.toFixed(1), initialWindow[1]])
      } else if (mode === 'right') {
        let newEnd = Math.max(initialWindow[1] + deltaPct, initialWindow[0] + minSpan)
        newEnd = Math.min(100, newEnd)
        setScrubberWindow([initialWindow[0], +newEnd.toFixed(1)])
      }
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      dragInfoRef.current = null
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('touchmove', handlePointerMove, { passive: false })
    window.addEventListener('touchend', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('touchmove', handlePointerMove)
      window.removeEventListener('touchend', handlePointerUp)
    }
  }, [isDragging])

  // Click or drag down on track to pan, resize, or center
  const handleTrackPointerDown = (e) => {
    if (!trackRef.current) return
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clickPct = getPercentageFromX(clientX)

    const [start, end] = scrubberWindow
    const span = end - start
    const rect = trackRef.current.getBoundingClientRect()
    // 20px threshold for grabbing handles
    const handleThresholdPct = (20 / (rect.width || 500)) * 100

    // 1. Clicked near left handle
    if (Math.abs(clickPct - start) <= handleThresholdPct) {
      handleStartDrag('left', e)
      return
    }

    // 2. Clicked near right handle
    if (Math.abs(clickPct - end) <= handleThresholdPct) {
      handleStartDrag('right', e)
      return
    }

    // 3. Clicked inside active window (< 95% span)
    if (clickPct > start && clickPct < end && span < 95) {
      handleStartDrag('move', e)
      return
    }

    // 4. Clicked outside window OR window is full 100%:
    // Instantly zoom into a 35% window centered at click and start dragging!
    const targetSpan = span >= 95 ? 35 : span
    const half = targetSpan / 2
    let newStart = clickPct - half
    let newEnd = clickPct + half

    if (newStart < 0) {
      newStart = 0
      newEnd = targetSpan
    } else if (newEnd > 100) {
      newEnd = 100
      newStart = 100 - targetSpan
    }

    const updatedWindow = [+newStart.toFixed(1), +newEnd.toFixed(1)]
    setScrubberWindow(updatedWindow)

    dragInfoRef.current = {
      mode: 'move',
      startX: clientX,
      initialWindow: updatedWindow,
    }
    setIsDragging(true)
  }

  // Non-passive wheel zoom attached directly to chart wrapper to avoid browser passive listener warnings
  const chartContainerRef = useRef(null)
  const scrubberWindowRef = useRef(scrubberWindow)
  scrubberWindowRef.current = scrubberWindow

  useEffect(() => {
    const chartEl = chartContainerRef.current
    const trackEl = trackRef.current
    const makeWheelHandler = (measureRef) => (e) => {
      const target = measureRef?.current
      if (!target) return
      e.preventDefault()
      const rect = target.getBoundingClientRect()
      if (!rect.width) return
      const mousePct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))

      const zoomIn = e.deltaY < 0
      const factor = zoomIn ? 0.8 : 1.25
      const win = scrubberWindowRef.current
      const currentSpan = win[1] - win[0]
      const newSpan = Math.max(6, Math.min(100, currentSpan * factor))

      const ratio = (mousePct - win[0]) / (currentSpan || 1)
      let newStart = mousePct - ratio * newSpan
      let newEnd = newStart + newSpan

      if (newStart < 0) {
        newStart = 0
        newEnd = Math.min(100, newSpan)
      }
      if (newEnd > 100) {
        newEnd = 100
        newStart = Math.max(0, 100 - newSpan)
      }

      setScrubberWindow([+newStart.toFixed(1), +newEnd.toFixed(1)])
    }
    const onChartWheel = makeWheelHandler(svgRef)
    const onTrackWheel = makeWheelHandler(trackRef)
    if (chartEl) chartEl.addEventListener('wheel', onChartWheel, { passive: false })
    if (trackEl) trackEl.addEventListener('wheel', onTrackWheel, { passive: false })
    return () => {
      if (chartEl) chartEl.removeEventListener('wheel', onChartWheel)
      if (trackEl) trackEl.removeEventListener('wheel', onTrackWheel)
    }
  }, [])

  return (
    <div 
      className={`relative p-3.5 rounded-2xl border shadow-sm flex-1 flex flex-col justify-between transition-all select-none overflow-hidden ${isExpanded ? 'min-h-[540px]' : 'min-h-[430px]'} h-full ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* SECTION 1: Top Header — Compact Single Row on Laptop */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 truncate">
            <Activity size={14} className="text-[#047857] dark:text-[#10B981] shrink-0" />
            <span className="truncate">{tr('charts.timeline_title', 'Evoluție Uptime & Disponibilitate')}</span>
          </h3>
        </div>

        {/* Range Segmented Control & Secondary Drilldown to Alerts */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="apple-btn-secondary !h-[26px] !px-2 !text-[10.5px]"
            title={language === 'ru' ? 'Открыть журнал остановок и инцидентов' : language === 'en' ? 'Open stops & incidents log' : 'Deschide jurnalul de opriri și alerte'}
          >
            <span>{language === 'ru' ? 'Журнал остановок' : language === 'en' ? 'Outage Log' : 'Jurnal Opriri'}</span>
            <ExternalLink size={10} className="text-[#6E6E73] dark:text-[#8E8E93]" />
          </button>
          <div role="group" className="apple-segmented shrink-0">
            {['6h', '12h', '24h', '7d', '30d'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => { setRangePreset(preset); setScrubberWindow([0, 100]); }}
                className={`apple-segment !h-[23px] !px-2 !text-[10.5px] ${
                  rangePreset === preset ? 'apple-segment-active' : ''
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: 4-Metric Ribbon — Compact Twin of Left Card */}
      <div className="grid grid-cols-4 gap-1.5 my-2 shrink-0">
        <div className={`px-2 py-1.5 rounded-xl border text-center ${
          isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#F5F5F7]/80 border-black/[0.05]'
        }`}>
          <div className="text-[10px] font-medium text-[#515154] dark:text-[#AEAEB2] truncate">
            {tr('charts.ribbon_avg_uptime', 'Medie Uptime')}
          </div>
          <div className="text-[14px] font-semibold text-[#0A7B5C] dark:text-emerald-400 leading-tight mt-0.5 tabular-nums">{stats.avg}%</div>
        </div>
        <div className={`px-2 py-1.5 rounded-xl border text-center ${
          isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#F5F5F7]/80 border-black/[0.05]'
        }`}>
          <div className="text-[10px] font-medium text-[#515154] dark:text-[#AEAEB2] truncate">
            {tr('charts.ribbon_min_uptime', 'Minim Atins')}
          </div>
          <div className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-tight mt-0.5 tabular-nums">{stats.min}%</div>
        </div>
        <div className={`px-2 py-1.5 rounded-xl border text-center ${
          isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#F5F5F7]/80 border-black/[0.05]'
        }`}>
          <div className="text-[10px] font-medium text-[#515154] dark:text-[#AEAEB2] truncate">
            {tr('charts.ribbon_peak_uptime', 'Vârf Activ')}
          </div>
          <div className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-tight mt-0.5 tabular-nums">{stats.max}%</div>
        </div>
        <div className={`px-2 py-1.5 rounded-xl border text-center ${
          isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#F5F5F7]/80 border-black/[0.05]'
        }`}>
          <div className="text-[10px] font-medium text-[#515154] dark:text-[#AEAEB2] truncate">
            {tr('charts.ribbon_loss_est', 'Pierdere Est.')}
          </div>
          <div className={`text-[14px] font-semibold leading-tight mt-0.5 tabular-nums ${stats.totalLoss > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}`}>
            {stats.totalLoss} RON
          </div>
        </div>
      </div>

      {/* Main Interactive SVG Chart */}
      <div 
        ref={chartContainerRef}
        className="relative w-full flex-1 my-auto overflow-hidden flex items-center justify-center"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="cyanAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
              <stop offset="60%" stopColor="#10b981" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>

            <filter id="neonCurveGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines horizontal */}
          {[100, 95, 90, 85, 80].map((val) => {
            const normY = (val - 80) / 20
            const y = padding.top + (1 - normY) * chartH
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isDark ? '#1e293b' : '#f1f5f9'}
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fontWeight="bold"
                  fill={isDark ? '#64748b' : '#94a3b8'}
                >
                  {val}%
                </text>
              </g>
            )
          })}

          {/* Incident Loss Bars (stepped at bottom) */}
          {svgPoints.map((pt, i) => {
            if (pt.incidentCount === 0) return null
            const barH = Math.min(chartH, pt.incidentCount * 14)
            const bottomY = padding.top + chartH
            return (
              <rect
                key={i}
                x={pt.x - 4}
                y={bottomY - barH}
                width="8"
                height={barH}
                rx="3"
                fill="#f43f5e"
                opacity={0.35}
              />
            )
          })}

          {/* Filled Area Gradient */}
          {areaPath && (
            <path d={areaPath} fill="url(#cyanAreaGradient)" />
          )}

          {/* Spline Curve Stroke */}
          {curvedLinePath && (
            <path
              d={curvedLinePath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              filter="url(#neonCurveGlow)"
            />
          )}

          {/* X Axis Time Labels */}
          {svgPoints.filter((_, i) => i % Math.ceil(svgPoints.length / 6) === 0).map((pt, i) => (
            <text
              key={i}
              x={pt.x}
              y={height - 12}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill={isDark ? '#64748b' : '#94a3b8'}
            >
              {rangePreset === '7d' || rangePreset === '30d' ? pt.formattedDate : pt.formattedTime}
            </text>
          ))}

          {/* Interactive Crosshair & Cursor Anchor */}
          {hoveredPoint && (
            <g>
              {/* Vertical Guide Line */}
              <line
                x1={hoveredPoint.x}
                y1={padding.top}
                x2={hoveredPoint.x}
                y2={padding.top + chartH}
                stroke="#06b6d4"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                opacity="0.8"
              />

              {/* Pulsing Beacon on Curve */}
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="7"
                fill="#06b6d4"
                opacity="0.3"
                className="animate-ping"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#06b6d4"
                stroke={isDark ? '#0f172a' : '#ffffff'}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Floating Crosshair Tooltip Card */}
        {hoveredPoint && (
          <div
            className={`absolute pointer-events-none z-50 p-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-75 text-xs ${
              isDark ? 'bg-slate-900/90 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-900'
            }`}
            style={{
              left: `${Math.min(Math.max(mousePos.x - 70, 12), Math.max(12, (mousePos.containerW || width) - 180))}px`,
              top: `${Math.max(hoveredPoint.y - 85, 10)}px`
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-bold text-slate-400 text-[10px]">
                {hoveredPoint.formattedDate} {hoveredPoint.formattedTime}
              </span>
              <span className="font-extrabold text-emerald-500 text-xs">
                {hoveredPoint.uptime}% {tr('charts.tooltip_uptime', 'Uptime')}
              </span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">{tr('charts.tooltip_online_locations', 'Locații Online:')}</span>
                <span className="font-bold">{hoveredPoint.activeLocations} / {hoveredPoint.totalLocations || 52}</span>
              </div>
              {hoveredPoint.incidentCount > 0 ? (
                <div className="space-y-1 pt-0.5">
                  <div className="flex justify-between gap-3 text-rose-500 font-bold">
                    <span>{tr('charts.tooltip_incident_stops', 'Opriri / Incident:')}</span>
                    <span>{hoveredPoint.incidentCount} {tr('charts.locations_suffix', 'locații')} (-{hoveredPoint.lossAmount} RON)</span>
                  </div>
                  {hoveredPoint.stoppedNames?.length > 0 && (
                    <div className="text-[10px] text-rose-400 font-semibold max-w-[220px] leading-tight">
                      {hoveredPoint.stoppedNames.slice(0, 4).join(', ')}
                      {hoveredPoint.stoppedNames.length > 4 ? ` +${hoveredPoint.stoppedNames.length - 4}` : ''}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] text-emerald-500 font-medium">
                  {tr('charts.tooltip_no_incidents', 'Fără incidente raportate')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ZoomCharts Signature: Interactive Bottom Mini-Map / Timeline Scrubber — Compact Laptop Track (h-7) */}
      <div className="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
        <div className="flex items-center justify-between text-[10px] font-medium text-[#636366] dark:text-[#8E8E93] mb-1">
          <span>{tr('charts.timeline_nav_title', 'Navigator timp (Zoom & Pan)')}</span>
          <span className="tabular-nums">
            {tr('charts.window_visible', 'Fereastră: {percent}%').replace('{percent}', Math.round(scrubberWindow[1] - scrubberWindow[0]))}
            {scrubberWindow[1] - scrubberWindow[0] < 99 && visibleTimeline.length > 0 && (
              <span className="text-[#047857] dark:text-[#10B981] font-semibold ml-1.5">
                ({visibleTimeline[0]?.formattedDate} → {visibleTimeline[visibleTimeline.length - 1]?.formattedDate})
              </span>
            )}
          </span>
        </div>

        <div
          ref={trackRef}
          onMouseDown={handleTrackPointerDown}
          onTouchStart={handleTrackPointerDown}
          className="relative h-7 w-full rounded-lg overflow-hidden border border-black/[0.07] dark:border-white/10 bg-[#F5F6F9] dark:bg-white/[0.04] select-none cursor-pointer"
        >
          {/* Mini preview curve */}
          <svg viewBox={`0 0 ${width} 36`} className="w-full h-full opacity-60 pointer-events-none">
            {miniLinePath && (
              <path d={miniLinePath} fill="none" stroke="#047857" strokeWidth="1.5" />
            )}
          </svg>

          {/* Draggable Highlight Window */}
          <div
            onMouseDown={(e) => handleStartDrag('move', e)}
            onTouchStart={(e) => handleStartDrag('move', e)}
            className={`absolute top-0 bottom-0 bg-[#047857]/18 border-x-2 border-[#047857] select-none transition-colors ${
              isDragging ? 'cursor-grabbing bg-[#047857]/28' : 'cursor-grab hover:bg-[#047857]/24'
            }`}
            style={{
              left: `${scrubberWindow[0]}%`,
              width: `${scrubberWindow[1] - scrubberWindow[0]}%`
            }}
          >
            {/* Left handle for resizing */}
            <div
              onMouseDown={(e) => handleStartDrag('left', e)}
              onTouchStart={(e) => handleStartDrag('left', e)}
              className="absolute left-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize z-20 group"
              title={tr('charts.handle_start_tip', 'Trage pentru a ajusta începutul intervalului')}
            >
              <div className="w-1 h-4 rounded-full bg-[#047857] group-hover:scale-125 transition-transform" />
            </div>

            {/* Visual Center Grip */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-45">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-2.5 bg-[#047857] rounded-full" />
                <div className="w-0.5 h-2.5 bg-[#047857] rounded-full" />
              </div>
            </div>

            {/* Right handle for resizing */}
            <div
              onMouseDown={(e) => handleStartDrag('right', e)}
              onTouchStart={(e) => handleStartDrag('right', e)}
              className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize z-20 group"
              title={tr('charts.handle_end_tip', 'Trage pentru a ajusta sfârșitul intervalului')}
            >
              <div className="w-1 h-4 rounded-full bg-[#047857] group-hover:scale-125 transition-transform" />
            </div>
          </div>
        </div>

        {/* Quick Range Slider Buttons */}
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#636366] dark:text-[#8E8E93] gap-2 min-w-0">
          <div className="flex items-center gap-1 min-w-0 truncate">
            <Info size={11} className="shrink-0 opacity-75" />
            <span className="truncate">{tr('charts.timeline_hint', 'Trage mânerele pentru derulare și zoom ore de vârf.')}</span>
          </div>
          <button
            onClick={() => setScrubberWindow([0, 100])}
            className="text-[#047857] dark:text-[#10B981] font-semibold hover:underline cursor-pointer shrink-0 whitespace-nowrap"
          >
            {tr('charts.reset_zoom', 'Reset Zoom (100%)')}
          </button>
        </div>
      </div>
    </div>
  )
}
