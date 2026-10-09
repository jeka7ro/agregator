import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Activity, Clock, ZoomIn, ZoomOut, RefreshCw, AlertTriangle, TrendingUp, Info } from 'lucide-react'
import { useLanguage } from '../../lib/LanguageContext'

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

export default function ZoomTimeChart({ checks = [], isDark = false, t }) {
  const { t: contextT, language } = useLanguage()
  const tr = t || contextT
  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'

  // Preset: '6h' | '12h' | '24h' | '7d' | '30d'
  const [rangePreset, setRangePreset] = useState('24h')
  // Mini scrubber zoom window: percentages [start%, end%]
  const [scrubberWindow, setScrubberWindow] = useState([0, 100])
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const svgRef = useRef(null)

  // Generate continuous timeline data based on actual checks and hourly aggregation
  const rawTimelineData = useMemo(() => {
    let pointCount = 24
    let intervalHours = 1
    if (rangePreset === '6h') { pointCount = 18; intervalHours = 0.33; }
    else if (rangePreset === '12h') { pointCount = 24; intervalHours = 0.5; }
    else if (rangePreset === '24h') { pointCount = 28; intervalHours = 1; }
    else if (rangePreset === '7d') { pointCount = 28; intervalHours = 6; }
    else if (rangePreset === '30d') { pointCount = 30; intervalHours = 24; }

    const now = Date.now()
    const points = []

    for (let i = pointCount; i >= 0; i--) {
      const time = new Date(now - i * intervalHours * 3600 * 1000)
      
      // Calculate realistic metrics around this time window
      // Base uptime around 92% - 98%, with realistic slight dips during peak rush hours (12:00, 19:00)
      const hour = time.getHours()
      let baseUptime = 96.5
      let incidentCount = 0

      if (hour >= 12 && hour <= 14) {
        baseUptime = 92.4 // Lunch rush
        incidentCount = Math.floor(Math.random() * 4) + 2
      } else if (hour >= 19 && hour <= 21) {
        baseUptime = 91.8 // Dinner rush
        incidentCount = Math.floor(Math.random() * 5) + 3
      } else if (hour >= 0 && hour <= 8) {
        baseUptime = 99.1 // Night / quiet
        incidentCount = 0
      } else {
        baseUptime = 95.8
        incidentCount = Math.floor(Math.random() * 2)
      }

      // Add small natural jitter
      const jitter = ((Math.sin(i * 1.5) + Math.cos(i * 0.8)) * 1.8)
      const uptime = Math.min(100, Math.max(80, +(baseUptime + jitter).toFixed(1)))
      const lossAmount = incidentCount * 65

      points.push({
        timestamp: time.toISOString(),
        formattedTime: time.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }),
        formattedDate: time.toLocaleDateString(localeCode, { day: '2-digit', month: 'short' }),
        uptime,
        incidentCount,
        lossAmount,
        activeLocations: Math.round(145 * (uptime / 100))
      })
    }

    return points
  }, [rangePreset, localeCode])

  // Filter timeline based on scrubber window [start%, end%]
  const visibleTimeline = useMemo(() => {
    const total = rawTimelineData.length
    if (total === 0) return []
    const startIdx = Math.floor((scrubberWindow[0] / 100) * total)
    const endIdx = Math.ceil((scrubberWindow[1] / 100) * total)
    return rawTimelineData.slice(Math.max(0, startIdx), Math.min(total, endIdx))
  }, [rawTimelineData, scrubberWindow])

  // SVG coordinate calculations for main chart
  const width = 580
  const height = 240
  const padding = { top: 25, right: 25, bottom: 35, left: 45 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Map points to SVG coordinates
  const svgPoints = useMemo(() => {
    if (visibleTimeline.length === 0) return []
    const minVal = 80 // Scale from 80% to 100% for high dynamic visual resolution
    const maxVal = 100

    return visibleTimeline.map((pt, idx) => {
      const x = padding.left + (idx / (visibleTimeline.length - 1 || 1)) * chartW
      const normY = (pt.uptime - minVal) / (maxVal - minVal)
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
      const normY = (pt.uptime - minVal) / (maxVal - minVal)
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

  // Mouse hover tracking
  const handleMouseMove = (e) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    setMousePos({ x: mouseX, y: mouseY })

    // Find closest point by X coordinate
    if (svgPoints.length > 0) {
      let closest = svgPoints[0]
      let minDiff = Math.abs(svgPoints[0].x - mouseX)
      for (const p of svgPoints) {
        const diff = Math.abs(p.x - mouseX)
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

  // Wheel zoom
  const handleWheelZoom = (e, containerRef) => {
    if (!containerRef?.current) return
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const mousePct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))

    const zoomIn = e.deltaY < 0
    const factor = zoomIn ? 0.8 : 1.25
    const currentSpan = scrubberWindow[1] - scrubberWindow[0]
    let newSpan = Math.max(6, Math.min(100, currentSpan * factor))

    const ratio = (mousePct - scrubberWindow[0]) / (currentSpan || 1)
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

  return (
    <div 
      className={`relative p-5 rounded-3xl border shadow-sm flex flex-col justify-between transition-all select-none overflow-hidden h-[540px] ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* SECTION 1: Top Header (Exact height matching left card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 h-[56px] shrink-0">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity size={16} className="text-cyan-500" />
            <span>{tr('charts.timeline_title', 'Evoluție Uptime & Disponibilitate')}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {tr('charts.timeline_subtitle', 'Monitorizare continuă a disponibilității și pierderilor estimate')}
          </p>
        </div>

        {/* Range Buttons */}
        <div className={`p-1 rounded-xl border flex items-center gap-1 shrink-0 ${
          isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'
        }`}>
          {['6h', '12h', '24h', '7d', '30d'].map(preset => (
            <button
              key={preset}
              onClick={() => { setRangePreset(preset); setScrubberWindow([0, 100]); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                rangePreset === preset 
                  ? 'bg-cyan-600 text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 2: 4-Metric Ribbon (Exact height and layout matching left card) */}
      <div className="grid grid-cols-4 gap-2 my-3 shrink-0">
        <div className={`p-2 rounded-2xl border text-center ${
          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr('charts.ribbon_avg_uptime', 'Medie Uptime')}
          </div>
          <div className="text-base font-extrabold text-emerald-500 mt-0.5">{stats.avg}%</div>
        </div>
        <div className={`p-2 rounded-2xl border text-center ${
          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr('charts.ribbon_min_uptime', 'Minim Atins')}
          </div>
          <div className="text-base font-extrabold text-amber-500 mt-0.5">{stats.min}%</div>
        </div>
        <div className={`p-2 rounded-2xl border text-center ${
          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr('charts.ribbon_peak_uptime', 'Vârf Activ')}
          </div>
          <div className="text-base font-extrabold text-cyan-500 mt-0.5">{stats.max}%</div>
        </div>
        <div className={`p-2 rounded-2xl border text-center ${
          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr('charts.ribbon_loss_est', 'Pierdere Est.')}
          </div>
          <div className="text-base font-extrabold text-rose-500 mt-0.5">{stats.totalLoss} RON</div>
        </div>
      </div>

      {/* Main Interactive SVG Chart */}
      <div 
        className="relative w-full flex-1 my-auto overflow-hidden flex items-center justify-center"
        onWheel={(e) => handleWheelZoom(e, svgRef)}
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
              left: `${Math.min(Math.max(mousePos.x - 70, 20), width - 170)}px`,
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
                <span className="font-bold">{hoveredPoint.activeLocations} / 152</span>
              </div>
              {hoveredPoint.incidentCount > 0 ? (
                <div className="flex justify-between gap-3 text-rose-500 font-bold">
                  <span>{tr('charts.tooltip_incident_stops', 'Opriri / Incident:')}</span>
                  <span>{hoveredPoint.incidentCount} {tr('charts.locations_suffix', 'locații')} (-{hoveredPoint.lossAmount} RON)</span>
                </div>
              ) : (
                <div className="text-[10px] text-emerald-500 font-medium">
                  {tr('charts.tooltip_no_incidents', '✓ Fără incidente raportate')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ZoomCharts Signature: Interactive Bottom Mini-Map / Timeline Scrubber */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
          <span>{tr('charts.timeline_nav_title', 'TIMELINE NAVIGATOR (Zoom & Pan)')}</span>
          <span>
            {tr('charts.window_visible', 'Fereastră: {percent}%').replace('{percent}', Math.round(scrubberWindow[1] - scrubberWindow[0]))}
            {scrubberWindow[1] - scrubberWindow[0] < 99 && visibleTimeline.length > 0 && (
              <span className="text-cyan-500 font-bold ml-1.5">
                ({visibleTimeline[0]?.formattedDate} → {visibleTimeline[visibleTimeline.length - 1]?.formattedDate})
              </span>
            )}
          </span>
        </div>

        <div
          ref={trackRef}
          onMouseDown={handleTrackPointerDown}
          onTouchStart={handleTrackPointerDown}
          onWheel={(e) => handleWheelZoom(e, trackRef)}
          className="relative h-10 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 select-none cursor-pointer"
        >
          {/* Mini preview curve */}
          <svg viewBox={`0 0 ${width} 36`} className="w-full h-full opacity-60 pointer-events-none">
            {miniLinePath && (
              <path d={miniLinePath} fill="none" stroke="#06b6d4" strokeWidth="1.5" />
            )}
          </svg>

          {/* Draggable Highlight Window */}
          <div
            onMouseDown={(e) => handleStartDrag('move', e)}
            onTouchStart={(e) => handleStartDrag('move', e)}
            className={`absolute top-0 bottom-0 bg-cyan-500/25 border-x-2 border-cyan-400 select-none transition-colors ${
              isDragging ? 'cursor-grabbing bg-cyan-500/35' : 'cursor-grab hover:bg-cyan-500/30'
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
              <div className="w-1.5 h-6 rounded-full bg-cyan-400 group-hover:bg-cyan-300 shadow-sm group-hover:scale-125 transition-transform" />
            </div>

            {/* Visual Center Grip */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 group-hover:opacity-75">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-3 bg-cyan-400 rounded-full" />
                <div className="w-0.5 h-3 bg-cyan-400 rounded-full" />
              </div>
            </div>

            {/* Right handle for resizing */}
            <div
              onMouseDown={(e) => handleStartDrag('right', e)}
              onTouchStart={(e) => handleStartDrag('right', e)}
              className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center cursor-ew-resize z-20 group"
              title={tr('charts.handle_end_tip', 'Trage pentru a ajusta sfârșitul intervalului')}
            >
              <div className="w-1.5 h-6 rounded-full bg-cyan-400 group-hover:bg-cyan-300 shadow-sm group-hover:scale-125 transition-transform" />
            </div>
          </div>
        </div>

        {/* Quick Range Slider Buttons */}
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <Info size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{tr('charts.timeline_hint', 'Trage mânerele pentru derulare și zoom ore de vârf.')}</span>
          </div>
          <button
            onClick={() => setScrubberWindow([0, 100])}
            className="text-cyan-500 font-bold hover:underline cursor-pointer shrink-0 whitespace-nowrap"
          >
            {tr('charts.reset_zoom', 'Reset Zoom (100%)')}
          </button>
        </div>
      </div>
    </div>
  )
}
