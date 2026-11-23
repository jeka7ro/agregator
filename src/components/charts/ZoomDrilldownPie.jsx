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
  'Eroare': '#E11D48',
  'Smart Kiosk': '#F97316',
  'Smart Kiosk (Local)': '#F97316',
  'Casierie (iiko POS)': '#8B5CF6',
  'Casierie / POS (Local)': '#8B5CF6',
  'Glovo (Delivery)': '#F59E0B',
  'Wolt (Delivery)': '#00C2E8',
  'Bolt Food': '#10B981',
  'Bolt Food (Delivery)': '#10B981',
  'Direct / Web': '#06B6D4'
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
  if (endAngle - startAngle >= 2 * Math.PI - 0.001) {
    endAngle = startAngle + 2 * Math.PI - 0.001
  }
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

export default function ZoomDrilldownPie({ restaurants = [], checks = [], salesData = null, isDark = false, isExpanded = false, t }) {
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
          let hasConfigured = false
          ;['glovo', 'wolt', 'bolt'].forEach(p => {
            if (r[`${p}_url`] && !String(r[`${p}_url`]).includes('/search')) {
              hasConfigured = true
              const chk = checks.find(c => c.restaurant_id === r.id && c.platform === p)
              const st = chk?.final_status?.toLowerCase()
              if (st === 'available' || st === 'open' || st === 'online') isOnline = true
            }
          })
          if (isOnline && hasConfigured) map[b].online++
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
            const hasPlatform = p === 'iiko' ? !!r.iiko_restaurant_id : (!!r[`${p}_url`] && !String(r[`${p}_url`]).includes('/search'))
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
            if (r[`${p}_url`] && !String(r[`${p}_url`]).includes('/search')) {
              const chk = checks.find(c => c.restaurant_id === r.id && c.platform === p)
              const st = chk?.final_status?.toLowerCase()
              if (st === 'available' || st === 'open' || st === 'online') hasOnline = true
              else if (st === 'closed' || chk?.outside_working_hours) hasClosed = true
              else if (st === 'error') hasError = true
              else if (st === 'unavailable') hasStopped = true
            }
          })

          if (hasOnline) { online++; onlineRests.push(r); }
          else if (hasStopped) { stopped++; stoppedRests.push(r); }
          else if (hasClosed) { closed++; closedRests.push(r); }
          else if (hasError) { error++; errorRests.push(r); }
          else { closed++; closedRests.push(r); }
        })

        return [
          { label: tr('charts.status_online', 'Online / Disponibil'), count: online, rests: onlineRests, online, stopped: 0, statusKey: 'online' },
          { label: tr('charts.status_stopped', 'Oprit / STOP Nejustificat'), count: stopped, rests: stoppedRests, online: 0, stopped, statusKey: 'stopped' },
          { label: tr('charts.status_closed', 'Închis Program'), count: closed, rests: closedRests, online: 0, stopped: closed, statusKey: 'closed' },
          { label: tr('charts.status_error', 'Eroare Conexiune'), count: error, rests: errorRests, online: 0, stopped: error, statusKey: 'error' }
        ].filter(item => item.count > 0)
      }

      if (dimension === 'sales_channel') {
        const channels = salesData?.channels || []
        return channels.filter(c => c.count > 0).map(c => {
          const typeBadge = c.type === 'local' ? '(Local)' : '(Delivery)'
          return {
            label: `${c.label} ${typeBadge}`,
            cleanLabel: c.label,
            count: c.count,
            revenue: c.revenue,
            channelKey: c.key,
            type: c.type,
            online: c.count,
            stopped: 0,
            color: c.color
          }
        })
      }
    }

    // Level 1: Drilled into a specific Brand or Platform or Status or Channel
    if (currentDrill.level === 1) {
      if (dimension === 'sales_channel') {
        const chKey = currentDrill.channelKey
        const cities = salesData?.cities || []
        const cityRows = []
        cities.forEach(c => {
          const countInCity = c.channels?.[chKey] || 0
          if (countInCity > 0) {
            cityRows.push({
              label: c.city,
              count: countInCity,
              revenue: Math.round((c.revenue || 0) * (countInCity / (c.count || 1))),
              online: countInCity,
              stopped: 0,
              channelKey: chKey,
              city: c.city
            })
          }
        })
        if (cityRows.length > 0) return cityRows.sort((a, b) => b.count - a.count)

        // Fallback: active restaurants in that channel
        const restList = restaurants.filter(r => r.is_active)
        return restList.slice(0, 8).map(r => ({
          label: r.name,
          count: Math.max(1, Math.round(currentDrill.count / 8)),
          revenue: Math.round((currentDrill.revenue || 0) / 8),
          online: 1,
          stopped: 0,
          rests: [r],
          isLeaf: true
        }))
      }

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
      if (dimension === 'sales_channel') {
        const normCity = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
        const cityName = normCity(currentDrill.city)
        const chKey = currentDrill.channelKey
        const cityRests = restaurants.filter(r => r.is_active && (normCity(r.city) === cityName || normCity(r.name).includes(cityName)))
        const matchedRests = cityRests.length > 0 ? cityRests : restaurants.filter(r => r.is_active).slice(0, 6)
        return matchedRests.map(r => {
          const restEntry = salesData?.byRestaurant?.[r.id]
          const restOrders = restEntry?.channels?.[chKey] ?? Math.max(0, Math.round((currentDrill.count || 0) / (matchedRests.length || 1)))
          const restRev = restEntry?.revenue != null
            ? Math.round(restEntry.revenue)
            : Math.round((currentDrill.revenue || 0) / (matchedRests.length || 1))
          return {
            label: r.name,
            count: restOrders,
            revenue: restRev,
            rests: [r],
            online: 1,
            stopped: 0,
            isLeaf: true
          }
        })
      }

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
  }, [restaurants, checks, dimension, currentDrill, salesData])

  const totalValue = useMemo(() => {
    return sliceData.reduce((acc, curr) => acc + (curr.count || 0), 0)
  }, [sliceData])

  // Aggregate stats for identical 4-box KPI ribbon
  const ribbonStats = useMemo(() => {
    if (dimension === 'sales_channel') {
      const totals = salesData?.totals || {}
      const lvd = salesData?.local_vs_delivery || {}
      const curTotal = sliceData.reduce((acc, curr) => acc + (curr.count || 0), 0)
      const curRevenue = sliceData.reduce((acc, curr) => acc + (curr.revenue || 0), 0)
      return {
        isSales: true,
        total: curTotal || totals.totalOrders || 0,
        revenue: curRevenue ? `${curRevenue.toLocaleString()} RON` : (totals.totalRevenue ? `${totals.totalRevenue.toLocaleString()} RON` : '0 RON'),
        localShare: `${lvd.local?.share ?? 0}%`,
        deliveryShare: `${lvd.delivery?.share ?? 0}%`,
        localCount: lvd.local?.count || 0,
        deliveryCount: lvd.delivery?.count || 0
      }
    }
    let onlineCount = 0
    let stoppedCount = 0
    sliceData.forEach(s => {
      onlineCount += s.online || 0
      stoppedCount += s.stopped || 0
    })
    const total = totalValue || 1
    const pct = Math.round((onlineCount / total) * 100)
    return {
      isSales: false,
      total: totalValue,
      online: onlineCount,
      stopped: stoppedCount,
      rate: pct
    }
  }, [sliceData, totalValue, dimension, salesData])

  // Calculate arc angles
  const slicesWithAngles = useMemo(() => {
    if (totalValue === 0) return []
    let currentAngle = 0
    const padAngle = sliceData.length > 1 ? 0.03 : 0

    return sliceData.map((item, idx) => {
      const portion = item.count / totalValue
      const angleLength = portion * (2 * Math.PI)
      const effPad = Math.min(padAngle, angleLength * 0.4)
      const startAngle = currentAngle + effPad / 2
      const endAngle = currentAngle + angleLength - effPad / 2
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
        title: slice.cleanLabel || slice.label,
        rests: slice.rests,
        color: slice.color,
        channelKey: slice.channelKey || currentDrill?.channelKey,
        city: slice.city || slice.label,
        revenue: slice.revenue,
        count: slice.count
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

  // SVG Geometry — Sized cleanly so full donut + ALL 5 brand rows fit above the fold on laptop!
  const size = isExpanded ? 268 : 210
  const cx = size / 2
  const cy = size / 2
  const outerRadius = isExpanded ? 112 : 88
  const innerRadius = isExpanded ? 66 : 52

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative p-3.5 rounded-2xl border shadow-sm flex flex-col justify-between transition-all select-none overflow-hidden ${isExpanded ? 'h-[540px]' : 'h-[430px]'} ${
        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* SECTION 1: Top Header — Compact Single Row on Laptop */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5 truncate">
            <PieIcon size={14} className="text-[#047857] dark:text-[#10B981] shrink-0" />
            <span className="truncate">{tr('charts.pie_title', 'Distribuție & Structură Rețea')}</span>
          </h3>
        </div>

        {/* Dimension Selector — Apple Segmented Control */}
        {drillStack.length === 0 ? (
          <div role="group" className="apple-segmented shrink-0">
            <button
              type="button"
              onClick={() => { setDimension('brand'); handleReset(); }}
              className={`apple-segment !h-[23px] !px-2 !text-[10.5px] ${dimension === 'brand' ? 'apple-segment-active' : ''}`}
            >
              {tr('charts.dim_brand', 'Branduri')}
            </button>
            <button
              type="button"
              onClick={() => { setDimension('platform'); handleReset(); }}
              className={`apple-segment !h-[23px] !px-2 !text-[10.5px] ${dimension === 'platform' ? 'apple-segment-active' : ''}`}
            >
              {tr('charts.dim_platform', 'Platforme')}
            </button>
            <button
              type="button"
              onClick={() => { setDimension('status'); handleReset(); }}
              className={`apple-segment !h-[23px] !px-2 !text-[10.5px] ${dimension === 'status' ? 'apple-segment-active' : ''}`}
            >
              {tr('charts.dim_status', 'Status')}
            </button>
            <button
              type="button"
              onClick={() => { setDimension('sales_channel'); handleReset(); }}
              className={`apple-segment !h-[23px] !px-2 !text-[10.5px] ${dimension === 'sales_channel' ? 'apple-segment-active' : ''}`}
            >
              {tr('charts.dim_channels', 'Canale Vânzări')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStepBack}
            className="apple-btn-secondary !h-6 !px-2.5 !text-[11px] shrink-0"
          >
            <ArrowLeft size={11} />
            <span>{tr('charts.step_back', 'Înapoi un nivel')}</span>
          </button>
        )}
      </div>

      {/* SECTION 2: 4-Metric Ribbon — Compact Laptop Strip */}
      <div className="grid grid-cols-4 gap-1.5 my-2 shrink-0">
        <div className={`px-2 py-1.5 rounded-xl border text-center ${
          isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#F5F5F7]/80 border-black/[0.05]'
        }`}>
          <div className="text-[10px] font-medium text-[#515154] dark:text-[#AEAEB2] truncate">
            {ribbonStats.isSales ? tr('charts.ribbon_orders', 'Total Comenzi') : tr('charts.ribbon_total_units', 'Total Unități')}
          </div>
          <div className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-tight mt-0.5 tabular-nums">{ribbonStats.total}</div>
        </div>
        <div className={`px-2 py-1.5 rounded-xl border text-center ${
          isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#F5F5F7]/80 border-black/[0.05]'
        }`}>
          <div className="text-[10px] font-medium text-[#515154] dark:text-[#AEAEB2] truncate">
            {ribbonStats.isSales ? tr('charts.ribbon_revenue', 'Vânzări Totale') : tr('charts.ribbon_online', 'Online')}
          </div>
          <div className="text-[14px] font-semibold text-[#0A7B5C] dark:text-emerald-400 leading-tight mt-0.5 truncate tabular-nums">
            {ribbonStats.isSales ? ribbonStats.revenue : ribbonStats.online}
          </div>
        </div>
        <div className={`px-2 py-1.5 rounded-xl border text-center ${
          isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#F5F5F7]/80 border-black/[0.05]'
        }`}>
          <div className="text-[10px] font-medium text-[#515154] dark:text-[#AEAEB2] truncate">
            {ribbonStats.isSales ? tr('charts.ribbon_local_share', 'Local (Kiosk+POS)') : tr('charts.ribbon_stopped', 'Oprite / STOP')}
          </div>
          <div className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-tight mt-0.5 truncate tabular-nums">
            {ribbonStats.isSales ? ribbonStats.localShare : ribbonStats.stopped}
          </div>
        </div>
        <div className={`px-2 py-1.5 rounded-xl border text-center ${
          isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#F5F5F7]/80 border-black/[0.05]'
        }`}>
          <div className="text-[10px] font-medium text-[#515154] dark:text-[#AEAEB2] truncate">
            {ribbonStats.isSales ? tr('charts.ribbon_delivery_share', 'Delivery (Aplicații)') : tr('charts.ribbon_online_rate', 'Rată Online')}
          </div>
          <div className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-tight mt-0.5 truncate tabular-nums">
            {ribbonStats.isSales ? ribbonStats.deliveryShare : `${ribbonStats.rate}%`}
          </div>
        </div>
      </div>

      {/* SECTION 3: Main Visual Area (Balanced Donut + Full Unclipped 5-Brand Legend) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center flex-1 min-h-0 overflow-hidden">
        {/* SVG Donut */}
        <div className="md:col-span-6 flex justify-center items-center relative">
          <svg 
            width={size} 
            height={size} 
            viewBox={`0 0 ${size} ${size}`}
            className="overflow-visible max-w-full h-auto"
          >
            <defs>
              <filter id="pieGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
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

              const explodeDistance = isHovered ? 7 : 0
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
                    stroke={isDark ? '#1C1C1E' : '#ffffff'}
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
                r={innerRadius - 3}
                fill={isDark ? '#1C1C1E' : '#ffffff'}
                stroke={drillStack.length > 0 ? '#047857' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                strokeWidth={drillStack.length > 0 ? 1.5 : 1}
                strokeDasharray={drillStack.length > 0 ? '4 2' : 'none'}
                className="transition-all duration-300"
              />

              {drillStack.length > 0 ? (
                <g className="transition-transform hover:scale-105 select-none" transform={`translate(${cx}, ${cy})`}>
                  <circle r={innerRadius - 10} fill="transparent" />
                  <text y="-9" textAnchor="middle" fill="#047857" fontSize="9" fontWeight="700">
                    {tr('charts.hud_back', '⬅ ÎNAPOI')}
                  </text>
                  <text y="7" textAnchor="middle" fill={isDark ? '#ffffff' : '#1D1D1F'} fontSize="14" fontWeight="800">
                    {totalValue}
                  </text>
                  <text y="19" textAnchor="middle" fill={isDark ? '#8E8E93' : '#636366'} fontSize="8" fontWeight="600">
                    {tr('charts.hud_subunits', 'SUB-UNITĂȚI')}
                  </text>
                </g>
              ) : (
                <g className="select-none" transform={`translate(${cx}, ${cy})`}>
                  <text y="-8" textAnchor="middle" fill={isDark ? '#8E8E93' : '#636366'} fontSize="8.5" fontWeight="600">
                    {tr('charts.hud_total', 'TOTAL')}
                  </text>
                  <text y="11" textAnchor="middle" fill={isDark ? '#ffffff' : '#1D1D1F'} fontSize="18" fontWeight="800">
                    {totalValue}
                  </text>
                  <text y="23" textAnchor="middle" fill={dimension === 'sales_channel' ? '#f59e0b' : '#10b981'} fontSize="8.5" fontWeight="700">
                    {dimension === 'sales_channel' ? 'COMENZI' : tr('charts.hud_locations', 'LOCAȚII')}
                  </text>
                </g>
              )}
            </g>
          </svg>
        </div>

        {/* Interactive Legend List — Compact rows so ALL 5 brands fit without clipping */}
        <div className="md:col-span-6 flex flex-col justify-center space-y-1 max-h-full overflow-y-auto custom-scrollbar pr-0.5">
          {slicesWithAngles.map((slice) => {
            const isHovered = hoveredSlice?.label === slice.label
            return (
              <div
                key={slice.label}
                onClick={() => handleSliceClick(slice)}
                onMouseEnter={() => setHoveredSlice(slice)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`px-2 py-1 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isHovered
                    ? (isDark ? 'bg-white/[0.08] border-[#10B981]/60' : 'bg-[#047857]/[0.06] border-[#047857]/40')
                    : (isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-[#F5F6F9]/80 border-black/[0.05] hover:bg-black/[0.04]')
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {dimension === 'brand' || ['Roll Master', 'Poki Woki', 'Love Sushi', 'Smash Me', 'Crunch'].includes(slice.label) ? (
                    <BrandAvatar brand={slice.label} size={18} className="rounded-full shrink-0" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold truncate text-[#1D1D1F] dark:text-white leading-tight">{slice.label}</div>
                    <div className="text-[9.5px] text-[#636366] dark:text-[#8E8E93] leading-tight truncate tabular-nums">
                      {dimension === 'sales_channel' && slice.revenue ? (
                        <span>{slice.count} · {slice.revenue.toLocaleString()} RON</span>
                      ) : (
                        <span>{slice.online} {tr('charts.legend_online', 'Online')} · {slice.stopped} {tr('charts.legend_stopped', 'Oprite')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                    isDark ? 'bg-white/[0.08] text-slate-200' : 'bg-white text-slate-700 border border-black/[0.07]'
                  }`}>
                    {slice.count}
                  </span>
                  <span className="text-[11px] font-bold min-w-[28px] text-right" style={{ color: slice.color }}>
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
              <span className="text-slate-400">
                {dimension === 'sales_channel' ? tr('charts.ribbon_orders', 'Total Comenzi') : tr('charts.tooltip_total_units', 'Total Unități:')}
              </span>
              <span className="font-bold">{hoveredSlice.count} ({hoveredSlice.percent}%)</span>
            </div>
            {dimension === 'sales_channel' && hoveredSlice.revenue ? (
              <div className="flex justify-between gap-4">
                <span className="text-amber-500 font-semibold">{tr('charts.ribbon_revenue', 'Vânzări:')}</span>
                <span className="font-bold text-amber-500">{hoveredSlice.revenue.toLocaleString()} RON</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-emerald-500 font-semibold">{tr('charts.tooltip_online', 'Online:')}</span>
                  <span className="font-bold text-emerald-500">{hoveredSlice.online}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-rose-500 font-semibold">{tr('charts.tooltip_stopped', 'Oprite:')}</span>
                  <span className="font-bold text-rose-500">{hoveredSlice.stopped}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: Bottom Navigator — Compact Laptop Track (h-7) */}
      <div className="mt-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
        <div className="flex items-center justify-between text-[10px] font-medium text-[#636366] dark:text-[#8E8E93] mb-1">
          <span>{tr('charts.drilldown_nav_title', 'Navigator ierarhie')}</span>
          <span>
            {tr('charts.level_prefix', 'Nivel:')}{' '}
            {drillStack.length === 0 
              ? (dimension === 'brand' 
                  ? tr('charts.level_all_brands', 'Toate Brandurile') 
                  : dimension === 'platform' 
                    ? tr('charts.level_all_platforms', 'Toate Platformele') 
                    : dimension === 'sales_channel'
                      ? tr('charts.level_all_channels', 'Toate Canalele de Vânzări')
                      : tr('charts.level_all_statuses', 'Toate Statusurile')) 
              : drillStack.map(d => d.title).join(' > ')}
          </span>
        </div>

        {/* Proportional Segmented Spectrum Track (h-7 matching right scrubber) */}
        <div className="relative h-7 w-full rounded-lg overflow-hidden border border-black/[0.07] dark:border-white/10 bg-[#F5F6F9] dark:bg-white/[0.04] flex">
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
                  isHovered ? 'brightness-115 saturate-125 z-10' : 'opacity-90 hover:opacity-100'
                }`}
              >
                {slice.percent >= 10 && (
                  <span className="text-[10px] font-bold text-white px-1 truncate drop-shadow-sm select-none tabular-nums">
                    {slice.label} {slice.percent}%
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Action / Reset Row */}
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#636366] dark:text-[#8E8E93] gap-2 min-w-0">
          <div className="flex items-center gap-1 min-w-0 truncate">
            <Info size={11} className="shrink-0 opacity-75" />
            <span className="truncate">{tr('charts.drilldown_hint', 'Click pe o felie pentru explorare în profunzime.')}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-[#047857] dark:text-[#10B981] font-semibold hover:underline cursor-pointer shrink-0 whitespace-nowrap"
          >
            {drillStack.length > 0 ? tr('charts.reset_level', 'Reset Nivel (100%)') : tr('charts.reset_filter', 'Resetare (100%)')}
          </button>
        </div>
      </div>
    </div>
  )
}
