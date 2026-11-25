import React, { useState, useMemo, useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { TrendingUp, TrendingDown, RotateCw, Maximize2, Minimize2, X, Flame, Clock, BarChart3 } from 'lucide-react'
import { useCumulativeHourly } from '../../hooks/useCumulativeHourly'

// Compute clean, human-friendly Y-axis upper bound & ticks (Apple HIG charts.md › Axes)
function computeNiceAxis(maxVal, targetTicks = 4, headroomFactor = 1.15) {
  const safeMax = Math.max(Number(maxVal) || 0, 1) * headroomFactor
  const roughStep = safeMax / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const norm = roughStep / magnitude
  let niceNorm = 1
  if (norm <= 1) niceNorm = 1
  else if (norm <= 1.5) niceNorm = 1.5
  else if (norm <= 2) niceNorm = 2
  else if (norm <= 2.5) niceNorm = 2.5
  else if (norm <= 4) niceNorm = 4
  else if (norm <= 5) niceNorm = 5
  else if (norm <= 8) niceNorm = 8
  else niceNorm = 10

  const step = Math.max(1, niceNorm * magnitude)
  const count = Math.max(3, Math.ceil(safeMax / step))
  const max = count * step
  const ticks = []
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(i * step))
  }
  return { max, ticks }
}

// Smooth monotonic cubic bezier spline clamped cleanly so curves never overshoot below 0
function buildSmoothSplinePath(pts, baselineY) {
  if (!pts || pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]

    const tension = 0.22
    const cp1x = p1.x + (p2.x - p0.x) * tension
    let cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    let cp2y = p2.y - (p3.y - p1.y) * tension

    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.min(baselineY, Math.max(p1.y, p2.y))
    cp1y = Math.max(minY, Math.min(maxY, cp1y))
    cp2y = Math.max(minY, Math.min(maxY, cp2y))

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function formatCompactMoney(val, allowFullOnWide = false) {
  const num = Math.round(Number(val) || 0)
  if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  if (allowFullOnWide && num < 100000) return num.toLocaleString('ro-RO')
  if (num >= 100000) return `${Math.round(num / 1000)}k`
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(num)
}

function formatAxisMoney(val, currencySuffix) {
  const num = Math.round(Number(val) || 0)
  if (num === 0) return `0 ${currencySuffix}`
  if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  if (num >= 10000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}k`
  return `${num.toLocaleString('ro-RO')} ${currencySuffix}`
}

function formatCompactOrders(val) {
  const num = Math.round(Number(val) || 0)
  if (num >= 100000) return `${Math.round(num / 1000)}k`
  if (num >= 10000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return num.toLocaleString('ro-RO')
}

function boxesOverlap(a, b, pad = 2) {
  if (!a || !b) return false
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  )
}

export default function CumulativeHourlyChart({
  selectedPeriod = 'this_month',
  customRange = null,
  onPeriodChange = null,
  periodOptions = null,
  isDark = false,
  language = 'ro'
}) {
  const uid = useId().replace(/:/g, '')
  const [compareMode, setCompareMode] = useState('primary') // 'none' | 'primary' | 'secondary'
  const [metricMode, setMetricMode] = useState('both') // 'both' | 'ron' | 'orders'
  const [hoverIdx, setHoverIdx] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const plotContainerRef = useRef(null)
  const [measuredWidth, setMeasuredWidth] = useState(980)
  const [viewportH, setViewportH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 900))

  const tr = (ro, en, ru) => (language === 'ru' ? ru : language === 'en' ? en : ro)

  // Reset secondary compare when switching to a period without a secondary option
  useEffect(() => {
    setHoverIdx(null)
    const isSingleDay = selectedPeriod === 'today' || selectedPeriod === 'yesterday' ||
      (selectedPeriod === 'custom' && customRange?.from && customRange.from === (customRange.to || customRange.from))
    if (!isSingleDay) {
      setCompareMode(prev => (prev === 'secondary' ? 'primary' : prev))
    }
  }, [selectedPeriod, customRange?.from, customRange?.to])

  // Escape key & body scroll lock when Fullscreen is active (Apple HIG going-full-screen.md)
  useEffect(() => {
    if (!isFullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isFullscreen])

  // Live width-only ResizeObserver + viewport height listener (zero height-feedback loop!)
  useEffect(() => {
    const el = plotContainerRef.current
    if (!el) return
    const measureWidth = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) {
        setMeasuredWidth(prev => (Math.abs(prev - w) < 6 ? prev : w))
      }
      if (typeof window !== 'undefined') {
        const vh = window.innerHeight
        setViewportH(prev => (Math.abs(prev - vh) < 6 ? prev : vh))
      }
    }
    measureWidth()
    let ro = null
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(measureWidth)
      ro.observe(el)
    }
    window.addEventListener('resize', measureWidth)
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', measureWidth)
    }
  }, [isFullscreen])

  const { data, loading } = useCumulativeHourly({
    period: selectedPeriod,
    customRange,
    compare: compareMode
  })

  const points = data?.points || []
  const primaryOpt = data?.compareOptions?.primary || null
  const secondaryOpt = data?.compareOptions?.secondary || null
  const activeCmpOpt = data?.activeCompareOption || null
  const hasCompare = Boolean(activeCmpOpt && data?.compareMode !== 'none' && data?.summary?.compareRevenue !== null)
  const isSecondary = data?.compareMode === 'secondary'

  // Apple System Blue (primary) + Warm Amber (primary compare) / Soft Violet (secondary -7d)
  const palette = useMemo(() => {
    const cmpBarTop = isSecondary ? (isDark ? '#A78BFA' : '#DDD6FE') : (isDark ? '#FBBF24' : '#FDE68A')
    const cmpBarBot = isSecondary ? (isDark ? '#7C3AED' : '#C4B5FD') : (isDark ? '#D97706' : '#FCD34D')
    const cmpBarStroke = isSecondary ? (isDark ? '#A78BFA' : '#8B5CF6') : (isDark ? '#F59E0B' : '#F59E0B')
    const cmpLine = isSecondary ? (isDark ? '#C4B5FD' : '#7C3AED') : (isDark ? '#FB923C' : '#EA580C')
    const cmpBarText = isSecondary ? (isDark ? '#F5F3FF' : '#5B21B6') : (isDark ? '#FEF3C7' : '#92400E')
    const cmpPillBg = isDark ? 'rgba(24, 24, 27, 0.96)' : 'rgba(255, 255, 255, 0.97)'
    const cmpPillBorder = isSecondary
      ? (isDark ? 'rgba(167,139,250,0.5)' : 'rgba(139,92,246,0.38)')
      : (isDark ? 'rgba(251,146,60,0.5)' : 'rgba(234,88,12,0.32)')

    return {
      baseBarTop: isDark ? '#3B82F6' : '#93C5FD',
      baseBarBot: isDark ? '#1D4ED8' : '#60A5FA',
      baseBarStroke: isDark ? '#60A5FA' : '#3B82F6',
      baseLine: isDark ? '#60A5FA' : '#1D4ED8',
      baseBarText: isDark ? '#EFF6FF' : '#1E3A8A',
      basePillBg: isDark ? 'rgba(24, 24, 27, 0.96)' : 'rgba(255, 255, 255, 0.98)',
      basePillBorder: isDark ? 'rgba(96,165,250,0.52)' : 'rgba(37,99,235,0.35)',
      cmpBarTop,
      cmpBarBot,
      cmpBarStroke,
      cmpLine,
      cmpBarText,
      cmpPillBg,
      cmpPillBorder,
      gridStroke: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      axisText: isDark ? '#98989D' : '#636366',
      surfaceText: isDark ? '#F5F5F7' : '#1D1D1F'
    }
  }, [isDark, isSecondary])

  // Dynamic 1:1 pixel dimensions — width-only inline + viewport-height fullscreen (mathematically zero resize oscillation!)
  const W = isFullscreen
    ? Math.max(600, Math.min(3400, (measuredWidth || 1400) - 32))
    : Math.max(540, Math.min(2400, (measuredWidth || 980) - 24))

  const H = isFullscreen
    ? Math.max(340, Math.min(980, viewportH - 255))
    : Math.max(295, Math.min(395, Math.round(W * 0.27)))

  const isWide = W >= 1380
  const isUltraWide = W >= 2050

  const PAD = {
    top: isFullscreen ? 54 : 44,
    right: isUltraWide ? 78 : (isWide ? 68 : 62),
    bottom: isFullscreen ? 42 : 34,
    left: isUltraWide ? 92 : (isWide ? 82 : 74)
  }
  const plotW = Math.max(200, W - PAD.left - PAD.right)
  const plotH = Math.max(160, H - PAD.top - PAD.bottom)
  const baselineY = PAD.top + plotH

  // Adaptive crisp typography sizes (never enlarged by SVG stretch!)
  const axisFontSize = isUltraWide ? 13 : (isWide ? 12 : 11)
  const pillFontSize = isUltraWide ? 12 : (isWide ? 11 : 10)
  const pillH = isUltraWide ? 22 : (isWide ? 20 : 18)
  const barFontSize = isUltraWide ? 11.5 : (isWide ? 10.5 : 9.5)
  const dotBaseR = isUltraWide ? 6 : (isWide ? 5 : 4.5)
  const lineStrokeW = isUltraWide ? 3.2 : (isWide ? 3 : 2.75)

  const showBars = metricMode === 'both' || metricMode === 'ron'
  const showLines = metricMode === 'both' || metricMode === 'orders'
  const cmdShort = tr('cmd', 'ord', 'зак')

  const chartMath = useMemo(() => {
    const maxRev = Math.max(
      ...points.map(p => Math.max(p.baseRevenue || 0, hasCompare ? (p.compareRevenue || 0) : 0)),
      100
    )
    const maxOrd = Math.max(
      ...points.map(p => Math.max(p.baseOrders || 0, hasCompare ? (p.compareOrders || 0) : 0)),
      4
    )

    const targetTicks = H >= 620 ? 6 : (H >= 430 ? 5 : 4)
    const revAxis = computeNiceAxis(maxRev, targetTicks, showBars && showLines ? 1.42 : 1.18)
    const ordAxis = computeNiceAxis(maxOrd, targetTicks, 1.16)

    const n = Math.max(points.length, 1)
    const slotW = plotW / n
    const barGap = isUltraWide ? 8 : (isWide ? 6 : 4)
    const maxSingleBarW = isUltraWide ? (hasCompare ? 72 : 96) : (isWide ? (hasCompare ? 54 : 74) : (hasCompare ? 38 : 52))
    const barW = Math.max(12, Math.min(maxSingleBarW, hasCompare ? (slotW * 0.72 - barGap) / 2 : slotW * 0.44))

    const yRev = (v) => baselineY - (Math.max(0, Number(v) || 0) / revAxis.max) * plotH
    const yOrd = (v) => baselineY - (Math.max(0, Number(v) || 0) / ordAxis.max) * plotH

    const baseLinePts = []
    const cmpLinePts = []

    const charFactor = pillFontSize * 0.61
    const minSlotForAllPills = isUltraWide ? 84 : (isWide ? 78 : 72)
    const pillStep = slotW < minSlotForAllPills ? 2 : 1

    const computed = points.map((p, idx) => {
      const cx = PAD.left + slotW * (idx + 0.5)
      const baseBarY = yRev(p.baseRevenue)
      const baseBarH = Math.max(0, baselineY - baseBarY)
      const cmpBarY = hasCompare ? yRev(p.compareRevenue) : baselineY
      const cmpBarH = hasCompare ? Math.max(0, baselineY - cmpBarY) : 0

      const baseBarX = hasCompare ? cx + barGap / 2 : cx - barW / 2
      const cmpBarX = cx - barGap / 2 - barW

      const baseOrdY = yOrd(p.baseOrders)
      const cmpOrdY = hasCompare ? yOrd(p.compareOrders) : null

      baseLinePts.push({ x: cx, y: baseOrdY })
      if (hasCompare && cmpOrdY !== null) cmpLinePts.push({ x: cx, y: cmpOrdY })

      const isLast = idx === points.length - 1
      const isHovered = hoverIdx === idx
      const showPillForSlot = showLines && (isHovered || isLast || (idx % pillStep === 0 && (p.baseOrders > 0 || (p.compareOrders || 0) > 0)))

      const basePillText = `${formatCompactOrders(p.baseOrders)} ${cmdShort}`
      const basePillW = Math.max(pillH * 2.5, basePillText.length * charFactor + 14)
      const cmpPillText = hasCompare ? `${formatCompactOrders(p.compareOrders)} ${cmdShort}` : ''
      const cmpPillW = Math.max(pillH * 2.5, cmpPillText.length * charFactor + 14)

      // Strict 2D non-overlapping placement for order pills
      const stackGap = pillH + 4
      let basePillY = baseOrdY - (pillH / 2 + 10)
      let cmpPillY = hasCompare && cmpOrdY !== null ? cmpOrdY - (pillH / 2 + 10) : null

      if (hasCompare && cmpPillY !== null) {
        if (Math.abs(basePillY - cmpPillY) < stackGap) {
          const topAnchor = Math.min(baseOrdY, cmpOrdY)
          if (baseOrdY <= cmpOrdY) {
            basePillY = Math.max(PAD.top - 18, topAnchor - (pillH + 20))
            cmpPillY = basePillY + stackGap
          } else {
            cmpPillY = Math.max(PAD.top - 18, topAnchor - (pillH + 20))
            basePillY = cmpPillY + stackGap
          }
          const lowerPillIsBase = basePillY > cmpPillY
          const lowerPillY = lowerPillIsBase ? basePillY : cmpPillY
          const lowerDotY = Math.max(baseOrdY, cmpOrdY)
          if (Math.abs(lowerPillY - topAnchor) < (pillH / 2 + 5) && lowerDotY < baselineY - (pillH + 24)) {
            if (lowerPillIsBase) basePillY = lowerDotY + (pillH / 2 + 11)
            else cmpPillY = lowerDotY + (pillH / 2 + 11)
          }
        }
      }

      basePillY = Math.max(PAD.top - 20, Math.min(baselineY - pillH / 2 - 4, basePillY))
      if (cmpPillY !== null) cmpPillY = Math.max(PAD.top - 20, Math.min(baselineY - pillH / 2 - 4, cmpPillY))

      const basePillBox = (showPillForSlot && p.baseOrders > 0)
        ? { x: cx - basePillW / 2, y: basePillY - pillH / 2, w: basePillW, h: pillH }
        : null
      const cmpPillBox = (showPillForSlot && hasCompare && (p.compareOrders || 0) > 0 && cmpPillY !== null)
        ? { x: cx - cmpPillW / 2, y: cmpPillY - pillH / 2, w: cmpPillW, h: pillH }
        : null
      const baseDotBox = showLines ? { x: cx - dotBaseR - 3, y: baseOrdY - dotBaseR - 3, w: (dotBaseR + 3) * 2, h: (dotBaseR + 3) * 2 } : null
      const cmpDotBox = (showLines && hasCompare && cmpOrdY !== null) ? { x: cx - dotBaseR - 3, y: cmpOrdY - dotBaseR - 3, w: (dotBaseR + 3) * 2, h: (dotBaseR + 3) * 2 } : null

      // Guaranteed zero-collision placement for bar RON labels
      const allowFullLabels = isFullscreen && barW >= 54
      const baseRevText = formatCompactMoney(p.baseRevenue, allowFullLabels)
      const cmpRevText = hasCompare ? formatCompactMoney(p.compareRevenue, allowFullLabels) : ''
      const textH = barFontSize + 3
      const barCharW = barFontSize * 0.6

      const canFitInsideBar = (barWidth, textStr) => barWidth >= Math.max(24, textStr.length * barCharW + 6)

      let showBaseBarLabel = false
      let baseBarLabelY = baselineY - 9
      if (showBars && p.baseRevenue > 0) {
        if (!showLines) {
          showBaseBarLabel = canFitInsideBar(barW + 10, baseRevText)
          baseBarLabelY = Math.max(PAD.top + 8, baseBarY - 7)
        } else if (baseBarH >= textH + 12 && canFitInsideBar(barW, baseRevText)) {
          baseBarLabelY = baselineY - 9
          const lblW = baseRevText.length * barCharW
          const lblBox = { x: baseBarX + barW / 2 - lblW / 2, y: baseBarLabelY - textH + 2, w: lblW, h: textH }
          const hitsAnything =
            boxesOverlap(lblBox, basePillBox, 3) ||
            boxesOverlap(lblBox, cmpPillBox, 3) ||
            boxesOverlap(lblBox, baseDotBox, 3) ||
            boxesOverlap(lblBox, cmpDotBox, 3)
          showBaseBarLabel = !hitsAnything
        }
      }

      let showCmpBarLabel = false
      let cmpBarLabelY = baselineY - 9
      if (showBars && hasCompare && (p.compareRevenue || 0) > 0) {
        if (!showLines) {
          showCmpBarLabel = canFitInsideBar(barW + 10, cmpRevText)
          cmpBarLabelY = Math.max(PAD.top + 8, cmpBarY - 7)
        } else if (cmpBarH >= textH + 12 && canFitInsideBar(barW, cmpRevText)) {
          cmpBarLabelY = baselineY - 9
          const lblW = cmpRevText.length * barCharW
          const lblBox = { x: cmpBarX + barW / 2 - lblW / 2, y: cmpBarLabelY - textH + 2, w: lblW, h: textH }
          const hitsAnything =
            boxesOverlap(lblBox, basePillBox, 3) ||
            boxesOverlap(lblBox, cmpPillBox, 3) ||
            boxesOverlap(lblBox, baseDotBox, 3) ||
            boxesOverlap(lblBox, cmpDotBox, 3)
          showCmpBarLabel = !hitsAnything
        }
      }

      return {
        ...p,
        idx,
        cx,
        slotW,
        barW,
        baseBarX,
        baseBarY,
        baseBarH,
        cmpBarX,
        cmpBarY,
        cmpBarH,
        baseOrdY,
        cmpOrdY,
        basePillY,
        cmpPillY,
        basePillText,
        basePillW,
        cmpPillText,
        cmpPillW,
        showPillForSlot,
        baseRevText,
        cmpRevText,
        showBaseBarLabel,
        baseBarLabelY,
        showCmpBarLabel,
        cmpBarLabelY
      }
    })

    return {
      revAxis,
      ordAxis,
      computed,
      baseLinePath: buildSmoothSplinePath(baseLinePts, baselineY),
      cmpLinePath: hasCompare ? buildSmoothSplinePath(cmpLinePts, baselineY) : ''
    }
  }, [points, hasCompare, showBars, showLines, hoverIdx, plotW, plotH, baselineY, cmdShort, H, PAD.left, PAD.top, isWide, isUltraWide, isFullscreen, pillFontSize, pillH, barFontSize, dotBaseR])

  // Fullscreen Executive Footer Insights (Peak Hour, Hourly Pace Average, Average Ticket)
  const fullscreenInsights = useMemo(() => {
    if (!points.length) return null
    let peak = points[0]
    for (const p of points) {
      if ((p.baseHourRevenue || 0) > (peak.baseHourRevenue || 0)) peak = p
    }
    const activeHours = Math.max(1, points.filter(p => (p.baseHourOrders || 0) > 0).length)
    const totalRev = Number(data?.summary?.baseRevenue || 0)
    const totalOrd = Number(data?.summary?.baseOrders || 0)
    return {
      peakLabel: peak?.label || '—',
      peakOrders: peak?.baseHourOrders || 0,
      peakRevenue: Math.round(peak?.baseHourRevenue || 0),
      avgRevPerHour: Math.round(totalRev / activeHours),
      avgOrdPerHour: Math.round((totalOrd / activeHours) * 10) / 10,
      avgTicket: totalOrd > 0 ? Math.round(totalRev / totalOrd) : 0
    }
  }, [points, data?.summary?.baseRevenue, data?.summary?.baseOrders])

  const summary = data?.summary || {}
  const baseLabelObj = data?.baseSeriesLabel || { ro: 'Azi', en: 'Today', ru: 'Сегодня' }
  const baseLabel = baseLabelObj[language] || baseLabelObj.ro
  const cmpLabel = activeCmpOpt ? (activeCmpOpt[language] || activeCmpOpt.ro) : ''

  const currencyShort = language === 'ro' ? 'lei' : 'RON'
  const ordersWord = tr('comenzi', 'orders', 'заказов')

  const deltaRev = summary.deltaRevenuePct
  const deltaOrd = summary.deltaOrdersPct
  const hoveredPoint = hoverIdx !== null ? chartMath.computed[hoverIdx] : null

  const badgeText = useMemo(() => {
    if (!data?.periodBadge) return ''
    if (data.isBaseToday) return `${tr('Până la', 'Up to', 'До')} ${data.periodBadge}`
    if (data.periodBadge === 'last_month') return tr('Luna trecută', 'Last month', 'Прошлый месяц')
    return data.periodBadge
  }, [data?.periodBadge, data?.isBaseToday, language])

  const ariaSummary = `${tr('Total Comenzi Cumulat', 'Cumulative Orders & Revenue', 'Накопительный Итог Заказов')}: ${baseLabel} ${Math.round(summary.baseRevenue || 0)} ${currencyShort}, ${summary.baseOrders || 0} ${ordersWord}${hasCompare ? `; ${cmpLabel} ${Math.round(summary.compareRevenue || 0)} ${currencyShort}, ${summary.compareOrders || 0} ${ordersWord}` : ''}.`

  const activeBluePillClass = '!bg-gradient-to-b !from-[#3B82F6] !to-[#2563EB] !text-white !shadow-[0_2px_8px_rgba(37,99,235,0.34)]'

  const chartCardContent = (
    <section
      aria-label={ariaSummary}
      className={
        isFullscreen
          ? `w-full max-w-[3600px] mx-auto h-full flex flex-col rounded-2xl xl:rounded-3xl shadow-2xl border overflow-hidden transition-colors ${
              isDark ? 'bg-[#0F1419] border-white/[0.12] text-[#F5F5F7]' : 'bg-white border-black/[0.10] text-[#1D1D1F]'
            }`
          : `w-full h-full flex flex-col rounded-2xl shadow-sm border transition-colors overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800 text-[#F5F5F7]' : 'bg-white border-slate-200 text-[#1D1D1F]'
            }`
      }
    >
      {/* Header Row — Title + Live Period Totals (Left) & Controls + Fullscreen Button (Right) */}
      <div className={`px-4 ${isFullscreen ? 'py-4 sm:px-6' : 'pt-3.5 pb-2.5'} border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shrink-0 ${
        isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'
      }`}>
        {/* Left: Apple Blue Squircle Icon + Title + Inline Legend Summary */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`${isFullscreen ? 'w-10 h-10 rounded-[12px]' : 'w-9 h-9 rounded-[11px]'} shrink-0 flex items-center justify-center text-white shadow-[0_4px_12px_rgba(37,99,235,0.30)]`}
            style={{ background: 'linear-gradient(155deg, #3B82F6 0%, #2563EB 55%, #1D4ED8 100%)' }}
          >
            <TrendingUp size={isFullscreen ? 20 : 18} strokeWidth={2.25} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`${isFullscreen ? 'text-[16px] sm:text-[18px]' : 'text-[14px]'} font-bold tracking-[-0.015em] text-[#1D1D1F] dark:text-[#F5F5F7]`}>
                {tr('Total Comenzi Cumulat', 'Cumulative Orders & Revenue', 'Накопительный Итог Заказов')}
              </h3>
              {badgeText && (
                <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold tabular-nums ${
                  isDark ? 'bg-white/[0.06] text-[#AEAEB2]' : 'bg-black/[0.045] text-[#636366]'
                }`}>
                  {badgeText}
                </span>
              )}
              {loading && (
                <RotateCw size={12} className="animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
              )}
            </div>

            {/* Inline Comparison Totals (tabular-nums) */}
            <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 ${isFullscreen ? 'text-[13px]' : 'text-[12px]'} tabular-nums`}>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: palette.baseBarStroke }} />
                <span className="text-[#636366] dark:text-[#AEAEB2] font-medium">{baseLabel}:</span>
                <strong className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {(summary.baseRevenue || 0).toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {currencyShort}
                </strong>
                <span className="font-semibold" style={{ color: palette.baseLine }}>
                  · {(summary.baseOrders || 0).toLocaleString('ro-RO')} {ordersWord}
                </span>
              </span>

              {hasCompare && summary.compareRevenue !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: palette.cmpBarStroke }} />
                  <span className="text-[#636366] dark:text-[#AEAEB2] font-medium">{cmpLabel}:</span>
                  <strong className="font-semibold text-[#3A3A3C] dark:text-[#D1D1D6]">
                    {(summary.compareRevenue || 0).toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {currencyShort}
                  </strong>
                  <span className="font-semibold" style={{ color: palette.cmpLine }}>
                    · {(summary.compareOrders || 0).toLocaleString('ro-RO')} {cmdShort}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Period Switcher (in Fullscreen) + Compare + Metric + Fullscreen Toggle + Delta Pills */}
        <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* In Fullscreen mode, keep Dashboard Period selector accessible without exiting (Apple HIG going-full-screen.md) */}
            {isFullscreen && Array.isArray(periodOptions) && typeof onPeriodChange === 'function' && (
              <div role="group" aria-label={tr('Perioadă', 'Period', 'Период')} className="apple-segmented">
                {periodOptions.map(opt => {
                  const isSel = selectedPeriod === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => onPeriodChange(opt.key)}
                      className={`apple-segment !h-[26px] !px-2.5 !text-[11px] ${isSel ? activeBluePillClass : ''}`}
                    >
                      {opt[language] || opt.ro}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Comparison Switcher */}
            {(primaryOpt || secondaryOpt) && (
              <div role="group" aria-label={tr('Comparație perioadă', 'Period comparison', 'Сравнение')} className="apple-segmented">
                <button
                  type="button"
                  onClick={() => setCompareMode('none')}
                  className={`apple-segment ${isFullscreen ? '!h-[26px]' : '!h-[24px]'} !px-2.5 !text-[11px] ${compareMode === 'none' ? activeBluePillClass : ''}`}
                >
                  {tr('Fără', 'Off', 'Без')}
                </button>
                {primaryOpt && (
                  <button
                    type="button"
                    onClick={() => setCompareMode('primary')}
                    title={primaryOpt.title}
                    className={`apple-segment ${isFullscreen ? '!h-[26px]' : '!h-[24px]'} !px-2.5 !text-[11px] tabular-nums ${compareMode === 'primary' ? activeBluePillClass : ''}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: compareMode === 'primary' ? '#FFFFFF' : '#F59E0B' }}
                    />
                    <span>{primaryOpt[language] || primaryOpt.ro}</span>
                  </button>
                )}
                {secondaryOpt && (
                  <button
                    type="button"
                    onClick={() => setCompareMode('secondary')}
                    title={secondaryOpt.title}
                    className={`apple-segment ${isFullscreen ? '!h-[26px]' : '!h-[24px]'} !px-2.5 !text-[11px] tabular-nums ${compareMode === 'secondary' ? activeBluePillClass : ''}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: compareMode === 'secondary' ? '#FFFFFF' : '#8B5CF6' }}
                    />
                    <span>{secondaryOpt[language] || secondaryOpt.ro}</span>
                  </button>
                )}
              </div>
            )}

            {/* Metric Switcher: RON + Cmd | RON | Comenzi */}
            <div role="group" aria-label={tr('Mod afișare', 'Display metric', 'Метрика')} className="apple-segmented">
              <button
                type="button"
                onClick={() => setMetricMode('both')}
                className={`apple-segment ${isFullscreen ? '!h-[26px]' : '!h-[24px]'} !px-2.5 !text-[11px] ${metricMode === 'both' ? activeBluePillClass : ''}`}
              >
                {tr('RON + Cmd', 'RON + Ord', 'RON + Зак')}
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('ron')}
                className={`apple-segment ${isFullscreen ? '!h-[26px]' : '!h-[24px]'} !px-2.5 !text-[11px] ${metricMode === 'ron' ? activeBluePillClass : ''}`}
              >
                RON
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('orders')}
                className={`apple-segment ${isFullscreen ? '!h-[26px]' : '!h-[24px]'} !px-2.5 !text-[11px] ${metricMode === 'orders' ? activeBluePillClass : ''}`}
              >
                {tr('Comenzi', 'Orders', 'Заказы')}
              </button>
            </div>

            {/* Fullscreen Toggle Button (matches ZoomChartsSuite Apple style, Escape to close) */}
            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              aria-label={isFullscreen ? tr('Ieși din ecran complet', 'Exit fullscreen', 'Выйти из полноэкранного режима') : tr('Ecran complet', 'Fullscreen', 'На весь экран')}
              title={isFullscreen ? tr('Ieși din ecran complet (Esc)', 'Exit fullscreen (Esc)', 'Свернуть (Esc)') : tr('Ecran complet (adaptat laptop → 5K ultrawide)', 'Fullscreen (laptop → 5K ultrawide)', 'На весь экран (ноутбук → 5K ultrawide)')}
              className={`apple-btn-secondary ${isFullscreen ? '!h-[30px] !px-2.5 gap-1.5' : '!w-[28px] !h-[28px] !px-0'}`}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 size={13} />
                  <span className="text-[11px] font-semibold hidden sm:inline">Esc</span>
                  <X size={13} className="sm:hidden" />
                </>
              ) : (
                <Maximize2 size={13} />
              )}
            </button>
          </div>

          {/* Delta Percentage Badges */}
          {hasCompare && (deltaRev !== null || deltaOrd !== null) && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums">
              {deltaRev !== null && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                  deltaRev >= 0
                    ? 'bg-emerald-500/12 text-[#047857] dark:bg-emerald-500/18 dark:text-[#34D399]'
                    : 'bg-rose-500/12 text-[#BE123C] dark:bg-rose-500/18 dark:text-[#FB7185]'
                }`}>
                  {deltaRev >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  <span>{deltaRev > 0 ? `+${deltaRev}` : deltaRev}% RON</span>
                </span>
              )}
              {deltaOrd !== null && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                  deltaOrd >= 0
                    ? 'bg-emerald-500/12 text-[#047857] dark:bg-emerald-500/18 dark:text-[#34D399]'
                    : 'bg-rose-500/12 text-[#BE123C] dark:bg-rose-500/18 dark:text-[#FB7185]'
                }`}>
                  {deltaOrd >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  <span>{deltaOrd > 0 ? `+${deltaOrd}` : deltaOrd}% {cmdShort}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chart Body — Measured Live via ResizeObserver for 1:1 Crisp Pixel Geometry */}
      <div
        ref={plotContainerRef}
        className={`relative flex-1 flex flex-col justify-center ${isFullscreen ? 'min-h-[340px] px-4 sm:px-7 py-3' : 'min-h-[295px] px-3 sm:px-4 pt-2 pb-3'}`}
      >
        {loading && points.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center gap-2.5 text-xs font-medium text-[#636366] dark:text-[#AEAEB2]">
            <RotateCw size={15} className="animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
            <span>{tr('Se încarcă ritmul orar cumulat...', 'Loading cumulative hourly pace...', 'Загрузка почасовой динамики...')}</span>
          </div>
        ) : points.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs font-medium text-[#636366] dark:text-[#AEAEB2]">
            {tr('Nu există comenzi înregistrate pentru perioada selectată.', 'No orders recorded for the selected period.', 'За выбранный период заказов нет.')}
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto max-w-full block select-none overflow-visible"
              role="img"
              aria-label={ariaSummary}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id={`baseBar-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.baseBarTop} stopOpacity={isDark ? '0.84' : '0.82'} />
                  <stop offset="100%" stopColor={palette.baseBarBot} stopOpacity={isDark ? '0.42' : '0.35'} />
                </linearGradient>
                <linearGradient id={`cmpBar-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.cmpBarTop} stopOpacity={isDark ? '0.68' : '0.86'} />
                  <stop offset="100%" stopColor={palette.cmpBarBot} stopOpacity={isDark ? '0.30' : '0.36'} />
                </linearGradient>
              </defs>

              {/* Top Axis Legend Labels (RON Left / CMD Right) */}
              {showBars && (
                <g aria-hidden="true">
                  <rect x={PAD.left - 34} y={10} width={10} height={10} rx={2.5} fill={palette.baseBarStroke} />
                  <text x={PAD.left - 20} y={19} fontSize={axisFontSize} fontWeight="700" fill={palette.baseLine}>
                    RON
                  </text>
                </g>
              )}
              {showLines && (
                <g aria-hidden="true">
                  <line x1={W - PAD.right + 4} y1={15} x2={W - PAD.right + 18} y2={15} stroke={palette.baseLine} strokeWidth="2.2" />
                  <circle cx={W - PAD.right + 11} cy={15} r="3.2" fill={isDark ? '#0F172A' : '#FFFFFF'} stroke={palette.baseLine} strokeWidth="2" />
                  <text x={W - PAD.right + 23} y={19} fontSize={axisFontSize} fontWeight="700" fill={palette.baseLine}>
                    {tr('CMD', 'ORD', 'ЗАК')}
                  </text>
                </g>
              )}

              {/* Horizontal Gridlines + Left (RON) & Right (CMD) Y-Axis Ticks */}
              <g aria-hidden="true">
                {chartMath.revAxis.ticks.map((tickVal, idx) => {
                  const ratio = idx / Math.max(1, chartMath.revAxis.ticks.length - 1)
                  const y = baselineY - ratio * plotH
                  const ordTickVal = Math.round(ratio * chartMath.ordAxis.max)
                  return (
                    <g key={`grid-${idx}`}>
                      <line
                        x1={PAD.left}
                        y1={y}
                        x2={W - PAD.right}
                        y2={y}
                        stroke={idx === 0 ? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.15)') : palette.gridStroke}
                        strokeDasharray={idx === 0 ? undefined : '4 4'}
                        strokeWidth={1}
                      />
                      {showBars && (
                        <text
                          x={PAD.left - 10}
                          y={y + 4}
                          textAnchor="end"
                          fontSize={axisFontSize}
                          fontWeight="500"
                          fill={palette.axisText}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatAxisMoney(tickVal, currencyShort)}
                        </text>
                      )}
                      {showLines && (
                        <text
                          x={W - PAD.right + 10}
                          y={y + 4}
                          textAnchor="start"
                          fontSize={axisFontSize}
                          fontWeight="600"
                          fill={palette.baseLine}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatCompactOrders(ordTickVal)}
                        </text>
                      )}
                    </g>
                  )
                })}

                {showBars && (
                  <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={baselineY} stroke={palette.gridStroke} strokeWidth={1} />
                )}
                {showLines && (
                  <line x1={W - PAD.right} y1={PAD.top} x2={W - PAD.right} y2={baselineY} stroke={palette.gridStroke} strokeWidth={1} />
                )}
              </g>

              {/* Hover Vertical Highlight Column */}
              {hoveredPoint && (
                <rect
                  x={hoveredPoint.cx - hoveredPoint.slotW * 0.44}
                  y={PAD.top}
                  width={hoveredPoint.slotW * 0.88}
                  height={plotH}
                  rx={8}
                  fill={isDark ? 'rgba(96, 165, 250, 0.08)' : 'rgba(37, 99, 235, 0.05)'}
                />
              )}

              {/* Cumulative RON Paired Bars */}
              {showBars && chartMath.computed.map((pt) => {
                const isActive = hoverIdx === pt.idx
                return (
                  <g key={`bars-${pt.hour}`}>
                    {hasCompare && pt.cmpBarH > 0 && (
                      <g>
                        <rect
                          x={pt.cmpBarX}
                          y={pt.cmpBarY}
                          width={pt.barW}
                          height={pt.cmpBarH}
                          rx={Math.min(7, pt.barW / 3)}
                          fill={`url(#cmpBar-${uid})`}
                          stroke={palette.cmpBarStroke}
                          strokeOpacity={isActive ? 0.95 : 0.52}
                          strokeWidth={isActive ? 1.5 : 1}
                        />
                        {pt.showCmpBarLabel && (
                          <text
                            x={pt.cmpBarX + pt.barW / 2}
                            y={pt.cmpBarLabelY}
                            textAnchor="middle"
                            fontSize={barFontSize}
                            fontWeight="700"
                            fill={palette.cmpBarText}
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {pt.cmpRevText}
                          </text>
                        )}
                      </g>
                    )}

                    {pt.baseBarH > 0 && (
                      <g>
                        <rect
                          x={pt.baseBarX}
                          y={pt.baseBarY}
                          width={pt.barW}
                          height={pt.baseBarH}
                          rx={Math.min(7, pt.barW / 3)}
                          fill={`url(#baseBar-${uid})`}
                          stroke={palette.baseBarStroke}
                          strokeOpacity={isActive ? 1 : 0.72}
                          strokeWidth={isActive ? 1.6 : 1}
                        />
                        {pt.showBaseBarLabel && (
                          <text
                            x={pt.baseBarX + pt.barW / 2}
                            y={pt.baseBarLabelY}
                            textAnchor="middle"
                            fontSize={barFontSize}
                            fontWeight="700"
                            fill={palette.baseBarText}
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {pt.baseRevText}
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                )
              })}

              {/* Cumulative Orders Smooth Spline Lines */}
              {showLines && hasCompare && chartMath.cmpLinePath && (
                <path
                  d={chartMath.cmpLinePath}
                  fill="none"
                  stroke={palette.cmpLine}
                  strokeWidth={Math.max(2.25, lineStrokeW - 0.5)}
                  strokeDasharray="6 5"
                  strokeLinecap="round"
                />
              )}
              {showLines && chartMath.baseLinePath && (
                <path
                  d={chartMath.baseLinePath}
                  fill="none"
                  stroke={palette.baseLine}
                  strokeWidth={lineStrokeW}
                  strokeLinecap="round"
                />
              )}

              {/* Cumulative Orders Circle Markers & Guaranteed Non-Overlapping Pill Callouts */}
              {showLines && chartMath.computed.map((pt) => {
                const isHovered = hoverIdx === pt.idx
                return (
                  <g key={`pts-${pt.hour}`}>
                    {hasCompare && pt.cmpOrdY !== null && (
                      <>
                        <circle
                          cx={pt.cx}
                          cy={pt.cmpOrdY}
                          r={isHovered ? dotBaseR + 1.4 : dotBaseR - 0.2}
                          fill={isDark ? '#0F172A' : '#FFFFFF'}
                          stroke={palette.cmpLine}
                          strokeWidth="2.3"
                        />
                        {pt.showPillForSlot && (pt.compareOrders || 0) > 0 && (
                          <g transform={`translate(${pt.cx}, ${pt.cmpPillY})`}>
                            <rect
                              x={-pt.cmpPillW / 2}
                              y={-pillH / 2}
                              width={pt.cmpPillW}
                              height={pillH}
                              rx={pillH / 2}
                              fill={palette.cmpPillBg}
                              stroke={palette.cmpPillBorder}
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={pillFontSize * 0.35}
                              textAnchor="middle"
                              fontSize={pillFontSize}
                              fontWeight="700"
                              fill={palette.cmpLine}
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {pt.cmpPillText}
                            </text>
                          </g>
                        )}
                      </>
                    )}

                    <circle
                      cx={pt.cx}
                      cy={pt.baseOrdY}
                      r={isHovered ? dotBaseR + 1.6 : dotBaseR}
                      fill={isDark ? '#0F172A' : '#FFFFFF'}
                      stroke={palette.baseLine}
                      strokeWidth="2.6"
                    />
                    {pt.showPillForSlot && pt.baseOrders > 0 && (
                      <g transform={`translate(${pt.cx}, ${pt.basePillY})`}>
                        <rect
                          x={-pt.basePillW / 2}
                          y={-pillH / 2}
                          width={pt.basePillW}
                          height={pillH}
                          rx={pillH / 2}
                          fill={palette.basePillBg}
                          stroke={palette.basePillBorder}
                          strokeWidth={1.1}
                        />
                        <text
                          x={0}
                          y={pillFontSize * 0.35}
                          textAnchor="middle"
                          fontSize={pillFontSize}
                          fontWeight="700"
                          fill={palette.surfaceText}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {pt.basePillText}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}

              {/* X-Axis Hour Labels */}
              <g aria-hidden="true">
                {chartMath.computed.map((pt) => (
                  <text
                    key={`xlabel-${pt.hour}`}
                    x={pt.cx}
                    y={baselineY + (isFullscreen ? 24 : 20)}
                    textAnchor="middle"
                    fontSize={axisFontSize}
                    fontWeight={hoverIdx === pt.idx ? '700' : '500'}
                    fill={hoverIdx === pt.idx ? palette.surfaceText : palette.axisText}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {pt.label}
                  </text>
                ))}
              </g>

              {/* Full-Height Interactive Scrubbing Hit Zones */}
              {chartMath.computed.map((pt) => (
                <rect
                  key={`hit-${pt.hour}`}
                  x={pt.cx - pt.slotW / 2}
                  y={PAD.top}
                  width={pt.slotW}
                  height={plotH + 26}
                  fill="transparent"
                  className="cursor-pointer outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${pt.label}: ${baseLabel} ${Math.round(pt.baseRevenue)} ${currencyShort}, ${pt.baseOrders} ${ordersWord}${hasCompare ? `; ${cmpLabel} ${Math.round(pt.compareRevenue || 0)} ${currencyShort}, ${pt.compareOrders || 0} ${ordersWord}` : ''}`}
                  onMouseEnter={() => setHoverIdx(pt.idx)}
                  onFocus={() => setHoverIdx(pt.idx)}
                  onBlur={() => setHoverIdx(null)}
                />
              ))}
            </svg>

            {/* Floating Hover Popover Card */}
            {hoveredPoint && (
              <div
                className={`pointer-events-none absolute top-3 z-20 min-w-[232px] rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur-md text-[12px] tabular-nums transition-opacity ${
                  isDark
                    ? 'bg-[#1C1C1E]/95 border-white/[0.12] text-[#F5F5F7]'
                    : 'bg-white/96 border-black/[0.08] text-[#1D1D1F]'
                }`}
                style={{
                  left: hoveredPoint.cx > W * 0.62 ? undefined : `${Math.min(72, Math.max(8, (hoveredPoint.cx / W) * 100 + 2))}%`,
                  right: hoveredPoint.cx > W * 0.62 ? `${Math.min(72, Math.max(6, ((W - hoveredPoint.cx) / W) * 100 + 2))}%` : undefined
                }}
              >
                <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <span className="font-bold text-[12.5px]">
                    {tr('Cumulat până la', 'Cumulative by', 'Накопленно к')} {hoveredPoint.label}
                  </span>
                  {hasCompare && hoveredPoint.compareRevenue > 0 && (() => {
                    const dPct = Math.round(((hoveredPoint.baseRevenue - hoveredPoint.compareRevenue) / hoveredPoint.compareRevenue) * 100)
                    return (
                      <span className={`font-bold text-[11px] ${dPct >= 0 ? 'text-[#047857] dark:text-[#34D399]' : 'text-[#BE123C] dark:text-[#FB7185]'}`}>
                        {dPct > 0 ? `+${dPct}%` : `${dPct}%`}
                      </span>
                    )
                  })()}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 text-[#636366] dark:text-[#AEAEB2]">
                      <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: palette.baseBarStroke }} />
                      {baseLabel}
                    </span>
                    <span className="font-bold">
                      {Math.round(hoveredPoint.baseRevenue).toLocaleString('ro-RO')} {currencyShort} · {hoveredPoint.baseOrders.toLocaleString('ro-RO')} {cmdShort}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#636366] dark:text-[#8E8E93] pl-3.5">
                    +{Math.round(hoveredPoint.baseHourRevenue).toLocaleString('ro-RO')} {currencyShort} · +{hoveredPoint.baseHourOrders.toLocaleString('ro-RO')} {cmdShort} {tr('în ora', 'in hour', 'за час')} {hoveredPoint.label}
                  </div>

                  {hasCompare && (
                    <>
                      <div className="flex items-center justify-between gap-4 pt-1">
                        <span className="inline-flex items-center gap-1.5 text-[#636366] dark:text-[#AEAEB2]">
                          <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: palette.cmpBarStroke }} />
                          {cmpLabel}
                        </span>
                        <span className="font-semibold">
                          {Math.round(hoveredPoint.compareRevenue || 0).toLocaleString('ro-RO')} {currencyShort} · {(hoveredPoint.compareOrders || 0).toLocaleString('ro-RO')} {cmdShort}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#636366] dark:text-[#8E8E93] pl-3.5">
                        +{Math.round(hoveredPoint.compareHourRevenue || 0).toLocaleString('ro-RO')} {currencyShort} · +{(hoveredPoint.compareHourOrders || 0).toLocaleString('ro-RO')} {cmdShort} {tr('în ora', 'in hour', 'за час')} {hoveredPoint.label}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Executive KPI Strip (uses 4K / 5K / Ultrawide vertical room meaningfully) */}
      {isFullscreen && fullscreenInsights && (
        <div className={`px-4 sm:px-6 py-3 border-t grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 tabular-nums ${
          isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-black/[0.06] bg-slate-50/70'
        }`}>
          <div className={`px-3.5 py-2 rounded-xl border flex items-center justify-between gap-3 ${
            isDark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-white border-black/[0.05]'
          }`}>
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-[#636366] dark:text-[#AEAEB2]">
              <Flame size={14} className="text-amber-500 shrink-0" />
              <span>{tr('Ora de vârf', 'Peak hour', 'Час пик')}</span>
            </div>
            <div className="text-right">
              <span className="text-[13px] font-bold">{fullscreenInsights.peakLabel}</span>
              <span className="text-[11.5px] text-[#636366] dark:text-[#AEAEB2] ml-2">
                {fullscreenInsights.peakRevenue.toLocaleString('ro-RO')} {currencyShort} · {fullscreenInsights.peakOrders.toLocaleString('ro-RO')} {cmdShort}
              </span>
            </div>
          </div>

          <div className={`px-3.5 py-2 rounded-xl border flex items-center justify-between gap-3 ${
            isDark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-white border-black/[0.05]'
          }`}>
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-[#636366] dark:text-[#AEAEB2]">
              <Clock size={14} className="text-blue-500 shrink-0" />
              <span>{tr('Medie orară', 'Hourly average', 'Среднее в час')}</span>
            </div>
            <div className="text-right">
              <span className="text-[13px] font-bold">{fullscreenInsights.avgRevPerHour.toLocaleString('ro-RO')} {currencyShort}</span>
              <span className="text-[11.5px] text-[#636366] dark:text-[#AEAEB2] ml-2">
                · {fullscreenInsights.avgOrdPerHour} {cmdShort}/{tr('oră', 'hr', 'ч')}
              </span>
            </div>
          </div>

          <div className={`px-3.5 py-2 rounded-xl border flex items-center justify-between gap-3 ${
            isDark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-white border-black/[0.05]'
          }`}>
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-[#636366] dark:text-[#AEAEB2]">
              <BarChart3 size={14} className="text-emerald-500 shrink-0" />
              <span>{tr('Bon mediu', 'Avg. ticket', 'Средний чек')}</span>
            </div>
            <div className="text-right">
              <span className="text-[13px] font-bold">{fullscreenInsights.avgTicket.toLocaleString('ro-RO')} {currencyShort}</span>
              <span className="text-[11.5px] text-[#636366] dark:text-[#AEAEB2] ml-2">
                / {tr('comandă', 'order', 'заказ')}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  )

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('Total Comenzi Cumulat — Ecran complet', 'Cumulative Orders & Revenue — Fullscreen', 'Накопительный Итог Заказов — Полный экран')}
        className="fixed inset-0 z-[9999] p-2 sm:p-4 xl:p-6 bg-black/55 backdrop-blur-md flex items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsFullscreen(false)
        }}
      >
        {chartCardContent}
      </div>,
      document.body
    )
  }

  return chartCardContent
}
