import React, { useState, useMemo, useRef } from 'react'
import { ChevronRight, ArrowLeft, Layers, Filter, Sparkles, PieChart as PieIcon, Info } from 'lucide-react'
import { useLanguage } from '../../lib/LanguageContext'
import BrandAvatar from '../BrandAvatar'

// Color palettes inspired by ZoomCharts neon dark/light aesthetic
const BRAND_COLORS = {
  'Roll Master': '#E11D48', // Rose crimson
  'Poki Woki': '#10B981',   // Emerald mint
  'Love Sushi': '#8B5CF6',  // Royal violet
  'Smash Me': '#F97316',    // Electric orange
  'Crunch': '#D97706',      // Golden amber
  'Glovo': '#F59E0B',       // Amber yellow
  'Wolt': '#00C2E8',        // Wolt cyan
  'Bolt': '#10B981',        // Bolt green
  'iiko': '#EF4444',        // Syrve red
  'Online': '#10B981',
  'Oprit': '#F43F5E',
  'Închis': '#64748B',
  'Eroare': '#E11D48'
}

const PALETTE = [
  '#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#F43F5E', 
  '#EC4899', '#3B82F6', '#14B8A6', '#84CC16', '#6366F1'
]

function getColor(label, index) {
  if (BRAND_COLORS[label]) return BRAND_COLORS[label]
  return PALETTE[index % PALETTE.length]
}

function describeArc(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
  const x1 = cx + outerRadius * Math.sin(startAngle)
  const y1 = cy - outerRadius * Math.cos(startAngle)
  const x2 = cx + outerRadius * Math.sin(endAngle)
  const y2 = cy - outerRadius * Math.cos(endAngle)

  const x3 = cx + innerRadius * Math.sin(endAngle)
  const y3 = cy - innerRadius * Math.cos(endAngle)
  const x4 = cx + innerRadius * Math.sin(startAngle)
  const y4 = cy - innerRadius * Math.cos(startAngle)

  const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1'

  return [
    'M', x1.toFixed(2), y1.toFixed(2),
    'A', outerRadius, outerRadius, 0, largeArcFlag, 1, x2.toFixed(2), y2.toFixed(2),
    'L', x3.toFixed(2), y3.toFixed(2),
    'A', innerRadius, innerRadius, 0, largeArcFlag, 0, x4.toFixed(2), y4.toFixed(2),
    'Z'
  ].join(' ')
}

export default function ZoomDrilldownPie({ restaurants = [], checks = [], isDark = false, t }) {
  const { t: contextT } = useLanguage()
  const tr = t || contextT
  // Dimension: 'brand' | 'platform' | 'status'
  const [dimension, setDimension] = useState('brand')
  // Drill path stack
  const [drillStack, setDrillStack] = useState([])
  const [hoveredSlice, setHoveredSlice] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)

  // Current drill level
  const currentDrill = drillStack[drillStack.length - 1] || null

  // Deduce brand from restaurant
  const getBrandName = (r) => {
    if (r.brands?.name) return r.brands.name
    const name = r.name || ''
    if (/roll\s*master/i.test(name)) return 'Roll Master'
    if (/poki\s*woki/i.test(name)) return 'Poki Woki'
    if (/love\s*sushi/i.test(name)) return 'Love Sushi'
    if (/smash\s*me/i.test(name)) return 'Smash Me'
    if (/crunch/i.test(name)) return 'Crunch'
    return tr('charts.other_brands', 'Alte Branduri')
  }

  // Calculate current slice data based on drill level
  const sliceData = useMemo(() => {
    const activeRests = restaurants.filter(r => r.is_active)
    
    // Level 0: Root views
    if (!currentDrill) {
      if (dimension === 'brand') {
        const map = {}
        activeRests.forEach(r => {
          const b = getBrandName(r)
          if (!map[b]) map[b] = { label: b, count: 0, rests: [], online: 0, stopped: 0 }
          map[b].count++
          map[b].rests.push(r)
          
          let isOnline = false
          ;['glovo', 'wolt', 'bolt'].forEach(p => {
            const chk = checks.find(c => c.restaurant_id === r.id && c.platform === p)
            const st = chk?.final_status?.toLowerCase()
            if (st === 'available' || st === 'open' || st === 'online') isOnline = true
          })
          if (isOnline) map[b].online++
          else map[b].stopped++
        })
        return Object.values(map)
      }

      if (dimension === 'platform') {
        const platforms = ['glovo', 'wolt', 'bolt', 'iiko']
        return platforms.map(p => {
          let count = 0
          let online = 0
          let stopped = 0
          const rests = []
          activeRests.forEach(r => {
            const hasPlatform = p === 'iiko' ? !!r.iiko_restaurant_id : !!r[`${p}_url`]
            if (hasPlatform) {
              count++
              rests.push(r)
              const chk = checks.find(c => c.restaurant_id === r.id && c.platform === p)
              const st = chk?.final_status?.toLowerCase()
              if (st === 'available' || st === 'open' || st === 'online') online++
              else stopped++
            }
          })
          const label = p === 'bolt' ? 'Bolt Food' : p === 'iiko' ? 'iiko POS' : p.charAt(0).toUpperCase() + p.slice(1)
          return { label, platformKey: p, count, rests, online, stopped }
        })
      }

      if (dimension === 'status') {
        let online = 0
        let stopped = 0
        let closed = 0
        let error = 0
        const onlineRests = [], stoppedRests = [], closedRests = [], errorRests = []

        activeRests.forEach(r => {
          let hasOnline = false, hasStopped = false, hasClosed = false, hasError = false
          ;['glovo', 'wolt', 'bolt'].forEach(p => {
            if (r[`${p}_url`]) {
              const chk = checks.find(c => c.restaurant_id === r.id && c.platform === p)
              const st = chk?.final_status?.toLowerCase()
              if (st === 'available' || st === 'open' || st === 'online') hasOnline = true
              else if (st === 'closed') hasClosed = true
              else if (st === 'error') hasError = true
              else if (st === 'unavailable') hasStopped = true
            }
          })

          if (hasOnline) { online++; onlineRests.push(r); }
          else if (hasStopped) { stopped++; stoppedRests.push(r); }
          else if (hasClosed) { closed++; closedRests.push(r); }
          else if (hasError) { error++; errorRests.push(r); }
          else { online++; onlineRests.push(r); }
        })

        return [
          { label: tr('charts.status_online', 'Online / Disponibil'), count: online, rests: onlineRests, online, stopped: 0, statusKey: 'online' },
          { label: tr('charts.status_stopped', 'Oprit / STOP Nejustificat'), count: stopped, rests: stoppedRests, online: 0, stopped, statusKey: 'stopped' },
          { label: tr('charts.status_closed', 'Închis Program'), count: closed, rests: closedRests, online: 0, stopped: closed, statusKey: 'closed' },
          { label: tr('charts.status_error', 'Eroare Conexiune'), count: error, rests: errorRests, online: 0, stopped: error, statusKey: 'error' }
        ].filter(item => item.count > 0)
      }
    }

    // Level 1: Drilled into a specific Brand or Platform or Status
    if (currentDrill.level === 1) {
      const parentRests = currentDrill.rests || []
      const cityMap = {}
      parentRests.forEach(r => {
        const city = r.city || tr('charts.other_cities', 'Alte Orașe')
        if (!cityMap[city]) cityMap[city] = { label: city, count: 0, rests: [], online: 0, stopped: 0 }
        cityMap[city].count++
        cityMap[city].rests.push(r)

        let isOnline = false
        ;['glovo', 'wolt', 'bolt'].forEach(p => {
          const chk = checks.find(c => c.restaurant_id === r.id && c.platform === p)
          const st = chk?.final_status?.toLowerCase()
          if (st === 'available' || st === 'open' || st === 'online') isOnline = true
        })
        if (isOnline) cityMap[city].online++
        else cityMap[city].stopped++
      })
      return Object.values(cityMap).sort((a, b) => b.count - a.count)
    }

    // Level 2: Drilled into a City -> list individual restaurants
    if (currentDrill.level === 2) {
      const parentRests = currentDrill.rests || []
      return parentRests.map(r => {
        let isOnline = false
        ;['glovo', 'wolt', 'bolt'].forEach(p => {
          const chk = checks.find(c => c.restaurant_id === r.id && c.platform === p)
          const st = chk?.final_status?.toLowerCase()
          if (st === 'available' || st === 'open' || st === 'online') isOnline = true
        })
        return {
          label: r.name,
          count: 1,
          rests: [r],
          online: isOnline ? 1 : 0,
          stopped: isOnline ? 0 : 1,
          isLeaf: true
        }
      })
    }

    return []
  }, [restaurants, checks, dimension, currentDrill])

  const totalValue = useMemo(() => {
    return sliceData.reduce((acc, curr) => acc + (curr.count || 0), 0)
  }, [sliceData])

  // Aggregate stats for identical 4-box KPI ribbon
  const ribbonStats = useMemo(() => {
    let onlineCount = 0
    let stoppedCount = 0
    sliceData.forEach(s => {
      onlineCount += s.online || 0
      stoppedCount += s.stopped || 0
    })
    const total = totalValue || 1
    const pct = Math.round((onlineCount / total) * 100)
    return {
      total: totalValue,
      online: onlineCount,
      stopped: stoppedCount,
      rate: pct
    }
  }, [sliceData, totalValue])

  // Calculate arc angles
  const slicesWithAngles = useMemo(() => {
    if (totalValue === 0) return []
    let currentAngle = 0
    const padAngle = sliceData.length > 1 ? 0.03 : 0

    return sliceData.map((item, idx) => {
      const portion = item.count / totalValue
      const angleLength = portion * (2 * Math.PI)
      const startAngle = currentAngle + padAngle / 2
      const endAngle = currentAngle + angleLength - padAngle / 2
      const midAngle = (startAngle + endAngle) / 2
      currentAngle += angleLength

      const color = getColor(item.label, idx)
      return {
        ...item,
        portion,
        percent: Math.round(portion * 100),
        startAngle,
        endAngle,
        midAngle,
        color,
        index: idx
      }
    })
  }, [sliceData, totalValue])

  const handleSliceClick = (slice) => {
    if (slice.isLeaf) return
    const nextLevel = (currentDrill?.level || 0) + 1
    if (nextLevel > 2) return

    setDrillStack(prev => [
      ...prev,
      {
        level: nextLevel,
        title: slice.label,
        rests: slice.rests,
        color: slice.color
      }
    ])
    setHoveredSlice(null)
  }

  const handleStepBack = () => {
    setDrillStack(prev => prev.slice(0, -1))
    setHoveredSlice(null)
  }

  const handleReset = () => {
    setDrillStack([])
    setHoveredSlice(null)
  }

  const handleMouseMove = (e) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  // SVG Geometry
  const size = 300
  const cx = size / 2
  const cy = size / 2
  const outerRadius = 125
  const innerRadius = 72

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative p-5 rounded-3xl border shadow-sm flex flex-col justify-between transition-all select-none overflow-hidden h-[540px] ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* SECTION 1: Top Header (Exact height matching right card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 h-[56px] shrink-0">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PieIcon size={16} className="text-emerald-500" />
            <span>{tr('charts.pie_title', 'Distribuție & Structură Rețea')}</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {tr('charts.pie_subtitle', 'Click pe orice felie pentru explorare pe orașe și locații')}
          </p>
        </div>

        {/* Dimension Selector */}
        {drillStack.length === 0 ? (
          <div className={`p-1 rounded-xl border flex items-center gap-1 shrink-0 ${
            isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => { setDimension('brand'); handleReset(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dimension === 'brand' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tr('charts.dim_brand', 'Branduri')}
            </button>
            <button
              onClick={() => { setDimension('platform'); handleReset(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dimension === 'platform' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tr('charts.dim_platform', 'Platforme')}
            </button>
            <button
              onClick={() => { setDimension('status'); handleReset(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dimension === 'status' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tr('charts.dim_status', 'Status')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleStepBack}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ArrowLeft size={13} />
            <span>{tr('charts.step_back', 'Înapoi un nivel')}</span>
          </button>
        )}
      </div>

      {/* SECTION 2: 4-Metric Ribbon (Exact height and layout matching right card) */}
      <div className="grid grid-cols-4 gap-2 my-3 shrink-0">
        <div className={`p-2 rounded-2xl border text-center ${
          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr('charts.ribbon_total_units', 'Total Unități')}
          </div>
          <div className="text-base font-extrabold text-cyan-500 mt-0.5">{ribbonStats.total}</div>
        </div>
        <div className={`p-2 rounded-2xl border text-center ${
          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr('charts.ribbon_online', 'Online')}
          </div>
          <div className="text-base font-extrabold text-emerald-500 mt-0.5">{ribbonStats.online}</div>
        </div>
        <div className={`p-2 rounded-2xl border text-center ${
          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr('charts.ribbon_stopped', 'Oprite / STOP')}
          </div>
          <div className="text-base font-extrabold text-rose-500 mt-0.5">{ribbonStats.stopped}</div>
        </div>
        <div className={`p-2 rounded-2xl border text-center ${
          isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {tr('charts.ribbon_online_rate', 'Rată Online')}
          </div>
          <div className="text-base font-extrabold text-amber-500 mt-0.5">{ribbonStats.rate}%</div>
        </div>
      </div>

      {/* SECTION 3: Main Visual Area (Donut + Side Legend, height matched to right chart) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center flex-1 my-auto overflow-hidden">
        {/* SVG Donut */}
        <div className="md:col-span-7 flex justify-center relative">
          <svg 
            width={size} 
            height={size} 
            viewBox={`0 0 ${size} ${size}`}
            className="overflow-visible"
          >
            <defs>
              <filter id="pieGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background subtle ring */}
            <circle 
              cx={cx} 
              cy={cy} 
              r={outerRadius} 
              fill="none" 
              stroke={isDark ? '#1e293b' : '#f1f5f9'} 
              strokeWidth={outerRadius - innerRadius} 
            />

            {/* Slices */}
            {slicesWithAngles.map((slice) => {
              const isHovered = hoveredSlice?.label === slice.label
              const path = describeArc(cx, cy, innerRadius, outerRadius, slice.startAngle, slice.endAngle)

              const explodeDistance = isHovered ? 10 : 0
              const dx = explodeDistance * Math.sin(slice.midAngle)
              const dy = -explodeDistance * Math.cos(slice.midAngle)

              return (
                <g 
                  key={slice.label}
                  transform={`translate(${dx.toFixed(2)}, ${dy.toFixed(2)})`}
                  className="transition-transform duration-300 ease-out cursor-pointer"
                  onClick={() => handleSliceClick(slice)}
                  onMouseEnter={() => setHoveredSlice(slice)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  <path
                    d={path}
                    fill={slice.color}
                    opacity={hoveredSlice && !isHovered ? 0.45 : 1}
                    filter={isHovered ? 'url(#pieGlow)' : undefined}
                    className="transition-all duration-300 hover:brightness-110"
                    stroke={isDark ? '#0f172a' : '#ffffff'}
                    strokeWidth={2}
                  />
                </g>
              )
            })}

            {/* Center HUD / Back Button */}
            <g 
              className="cursor-pointer"
              onClick={drillStack.length > 0 ? handleStepBack : undefined}
            >
              <circle
                cx={cx}
                cy={cy}
                r={innerRadius - 4}
                fill={isDark ? '#0b1329' : '#ffffff'}
                stroke={drillStack.length > 0 ? '#10b981' : isDark ? '#1e293b' : '#e2e8f0'}
                strokeWidth={drillStack.length > 0 ? 2 : 1}
                strokeDasharray={drillStack.length > 0 ? '4 2' : 'none'}
                className="transition-all duration-300"
              />

              {drillStack.length > 0 ? (
                <g className="transition-transform hover:scale-105 select-none" transform={`translate(${cx}, ${cy})`}>
                  <circle r={innerRadius - 12} fill="transparent" />
                  <text y="-10" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold">
                    {tr('charts.hud_back', '⬅ ÎNAPOI')}
                  </text>
                  <text y="8" textAnchor="middle" fill={isDark ? '#ffffff' : '#0f172a'} fontSize="14" fontWeight="800">
                    {totalValue}
                  </text>
                  <text y="22" textAnchor="middle" fill={isDark ? '#94a3b8' : '#64748b'} fontSize="9" fontWeight="bold">
                    {tr('charts.hud_subunits', 'SUB-UNITĂȚI')}
                  </text>
                </g>
              ) : (
                <g className="select-none" transform={`translate(${cx}, ${cy})`}>
                  <text y="-8" textAnchor="middle" fill={isDark ? '#94a3b8' : '#64748b'} fontSize="9" fontWeight="bold" letterSpacing="1">
                    {tr('charts.hud_total', 'TOTAL')}
                  </text>
                  <text y="14" textAnchor="middle" fill={isDark ? '#ffffff' : '#0f172a'} fontSize="20" fontWeight="900">
                    {totalValue}
                  </text>
                  <text y="28" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">
                    {tr('charts.hud_locations', 'LOCAȚII')}
                  </text>
                </g>
              )}
            </g>
          </svg>
        </div>

        {/* Interactive Legend List */}
        <div className="md:col-span-5 flex flex-col justify-center space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
          {slicesWithAngles.map((slice) => {
            const isHovered = hoveredSlice?.label === slice.label
            return (
              <div
                key={slice.label}
                onClick={() => handleSliceClick(slice)}
                onMouseEnter={() => setHoveredSlice(slice)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isHovered
                    ? (isDark ? 'bg-slate-800 border-emerald-500/80 shadow-md scale-[1.02]' : 'bg-slate-50 border-emerald-500/80 shadow-md scale-[1.02]')
                    : (isDark ? 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70' : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/60')
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {dimension === 'brand' || ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch'].includes(slice.label) ? (
                    <BrandAvatar brand={slice.label} size={22} className="rounded-full shrink-0 shadow-xs" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: slice.color }} />
                  )}
                  <div className="truncate">
                    <div className="text-[11px] font-bold truncate">{slice.label}</div>
                    <div className="text-[9px] text-slate-400 font-medium">
                      {slice.online} {tr('charts.legend_online', 'Online')} • {slice.stopped} {tr('charts.legend_stopped', 'Oprite')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'
                  }`}>
                    {slice.count}
                  </span>
                  <span className="text-[11px] font-black min-w-[32px] text-right" style={{ color: slice.color }}>
                    {slice.percent}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Cursor Tooltip */}
      {hoveredSlice && (
        <div 
          className={`absolute pointer-events-none z-50 p-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-75 text-xs ${
            isDark ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-200 text-slate-900'
          }`}
          style={{
            left: `${Math.max(10, Math.min(mousePos.x + 16, 320))}px`,
            top: `${Math.max(10, mousePos.y - 50)}px`
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredSlice.color }} />
            <span className="font-extrabold text-sm">{hoveredSlice.label}</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">{tr('charts.tooltip_total_units', 'Total Unități:')}</span>
              <span className="font-bold">{hoveredSlice.count} ({hoveredSlice.percent}%)</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-emerald-500 font-semibold">{tr('charts.tooltip_online', 'Online:')}</span>
              <span className="font-bold text-emerald-500">{hoveredSlice.online}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-rose-500 font-semibold">{tr('charts.tooltip_stopped', 'Oprite:')}</span>
              <span className="font-bold text-rose-500">{hoveredSlice.stopped}</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Bottom Navigator (Exact twin of right card's timeline navigator) */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
          <span>{tr('charts.drilldown_nav_title', 'DRILLDOWN NAVIGATOR (Ierarhie & Pondere)')}</span>
          <span>
            {tr('charts.level_prefix', 'Nivel:')}{' '}
            {drillStack.length === 0 
              ? (dimension === 'brand' 
                  ? tr('charts.level_all_brands', 'Toate Brandurile') 
                  : dimension === 'platform' 
                    ? tr('charts.level_all_platforms', 'Toate Platformele') 
                    : tr('charts.level_all_statuses', 'Toate Statusurile')) 
              : drillStack.map(d => d.title).join(' > ')}
          </span>
        </div>

        {/* Proportional Segmented Spectrum Track (h-10 matching right scrubber) */}
        <div className="relative h-10 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex">
          {slicesWithAngles.map((slice, i) => {
            const isHovered = hoveredSlice?.label === slice.label
            return (
              <div
                key={slice.label || i}
                onClick={() => handleSliceClick(slice)}
                onMouseEnter={() => setHoveredSlice(slice)}
                onMouseLeave={() => setHoveredSlice(null)}
                title={`${slice.label}: ${slice.count} ${tr('charts.locations_suffix', 'locații')} (${slice.percent}%)`}
                style={{
                  width: `${Math.max(slice.percent, 2)}%`,
                  backgroundColor: slice.color,
                }}
                className={`h-full transition-all duration-200 cursor-pointer relative flex items-center justify-center overflow-hidden border-r last:border-r-0 border-white/20 dark:border-slate-900/40 ${
                  isHovered ? 'brightness-125 saturate-125 z-10' : 'opacity-85 hover:opacity-100'
                }`}
              >
                {slice.percent >= 10 && (
                  <span className="text-[10px] font-black text-white px-1 truncate drop-shadow-sm select-none">
                    {slice.label} {slice.percent}%
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Action / Reset Row matching right card */}
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <Info size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{tr('charts.drilldown_hint', 'Click pe o felie pentru explorare în profunzime.')}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-emerald-500 font-bold hover:underline cursor-pointer shrink-0 whitespace-nowrap"
          >
            {drillStack.length > 0 ? tr('charts.reset_level', 'Reset Nivel (100%)') : tr('charts.reset_filter', 'Resetare (100%)')}
          </button>
        </div>
      </div>
    </div>
  )
}
