import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, RotateCcw } from 'lucide-react'
import { useLanguage } from '../lib/LanguageContext'

const MONTHS_NOMINATIVE = {
  ro: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
}

const MONTHS_GENITIVE = {
  ro: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря']
}

const MONTHS_SHORT = {
  ro: ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
}

const WEEKDAYS_SHORT = {
  ro: ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
}

const pad2 = (n) => String(n).padStart(2, '0')
const toYmd = (y, mZeroIdx, d) => `${y}-${pad2(mZeroIdx + 1)}-${pad2(d)}`

export function getRomaniaTodayYmd() {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
  } catch (_) {
    const now = new Date()
    return toYmd(now.getFullYear(), now.getMonth(), now.getDate())
  }
}

function parseYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m: m - 1, d }
}

function addDaysYmd(ymd, deltaDays) {
  const p = parseYmd(ymd)
  if (!p) return ymd
  const dt = new Date(p.y, p.m, p.d + deltaDays)
  return toYmd(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

function diffDaysInclusive(fromYmd, toYmdVal) {
  const a = parseYmd(fromYmd)
  const b = parseYmd(toYmdVal)
  if (!a || !b) return 0
  const d1 = Date.UTC(a.y, a.m, a.d)
  const d2 = Date.UTC(b.y, b.m, b.d)
  return Math.abs(Math.round((d2 - d1) / 86400000)) + 1
}

export function getPresetRangeYmd(periodKey) {
  const today = getRomaniaTodayYmd()
  const p = parseYmd(today)
  if (!p) return { from: today, to: today }

  if (periodKey === 'today') return { from: today, to: today }
  if (periodKey === 'yesterday') {
    const yDay = addDaysYmd(today, -1)
    return { from: yDay, to: yDay }
  }
  if (periodKey === 'this_week') {
    const dt = new Date(p.y, p.m, p.d)
    const dow = (dt.getDay() + 6) % 7
    const mon = new Date(p.y, p.m, p.d - dow)
    return { from: toYmd(mon.getFullYear(), mon.getMonth(), mon.getDate()), to: today }
  }
  if (periodKey === 'last_month') {
    const first = new Date(p.y, p.m - 1, 1)
    const last = new Date(p.y, p.m, 0)
    return {
      from: toYmd(first.getFullYear(), first.getMonth(), first.getDate()),
      to: toYmd(last.getFullYear(), last.getMonth(), last.getDate())
    }
  }
  if (periodKey === 'this_year') {
    return { from: `${p.y}-01-01`, to: today }
  }
  // this_month or fallback
  return { from: toYmd(p.y, p.m, 1), to: today }
}

export function translateRoDateRange(rangeStr, lang = 'ro') {
  if (!rangeStr) return ''
  if (lang === 'en') {
    return rangeStr
      .replace(/Ianuarie/g, 'January')
      .replace(/Februarie/g, 'February')
      .replace(/Martie/g, 'March')
      .replace(/Aprilie/g, 'April')
      .replace(/Mai/g, 'May')
      .replace(/Iunie/g, 'June')
      .replace(/Iulie/g, 'July')
      .replace(/August/g, 'August')
      .replace(/Septembrie/g, 'September')
      .replace(/Octombrie/g, 'October')
      .replace(/Noiembrie/g, 'November')
      .replace(/Decembrie/g, 'December')
      .replace(/Anul/g, 'Year')
      .replace(/Total Istoric/g, 'All Time')
  }
  if (lang === 'ru') {
    return rangeStr
      .replace(/Ianuarie/g, 'Января')
      .replace(/Februarie/g, 'Февраля')
      .replace(/Martie/g, 'Марта')
      .replace(/Aprilie/g, 'Апреля')
      .replace(/Mai/g, 'Мая')
      .replace(/Iunie/g, 'Июня')
      .replace(/Iulie/g, 'Июля')
      .replace(/August/g, 'Августа')
      .replace(/Septembrie/g, 'Сентября')
      .replace(/Octombrie/g, 'Октября')
      .replace(/Noiembrie/g, 'Ноября')
      .replace(/Decembrie/g, 'Декабря')
      .replace(/Anul/g, 'Год')
      .replace(/Total Istoric/g, 'За всё время')
  }
  return rangeStr
}

export function formatYmdRangeDisplay(fromYmd, toYmdVal, lang = 'ro') {
  const a = parseYmd(fromYmd)
  if (!a) return ''
  const b = parseYmd(toYmdVal || fromYmd) || a
  const months = MONTHS_GENITIVE[lang] || MONTHS_GENITIVE.ro
  const [s, e] = (fromYmd <= (toYmdVal || fromYmd)) ? [a, b] : [b, a]

  if (s.y === e.y && s.m === e.m && s.d === e.d) {
    return `${s.d} ${months[s.m]} ${s.y}`
  }
  if (s.y === e.y && s.m === e.m) {
    return `${s.d} - ${e.d} ${months[s.m]} ${s.y}`
  }
  if (s.y === e.y) {
    return `${s.d} ${months[s.m]} - ${e.d} ${months[e.m]} ${s.y}`
  }
  return `${s.d} ${months[s.m]} ${s.y} - ${e.d} ${months[e.m]} ${e.y}`
}

function formatCompactChipDate(ymd, lang = 'ro') {
  const p = parseYmd(ymd)
  if (!p) return '—'
  const shortMonths = MONTHS_SHORT[lang] || MONTHS_SHORT.ro
  return `${p.d} ${shortMonths[p.m]} ${p.y}`
}

/**
 * Native macOS Tahoe 26 Liquid Glass Calendar & Date-Range Picker
 * Grounded in Apple HIG: popovers.md, pickers.md, liquid-glass.md, accessibility.md
 */
export default function AppleDateRangePicker({
  period,
  customRange,
  displayLabel,
  onSelectRange,
  onSelectPreset,
  defaultPreset = 'today',
  align = 'left',
  variant = 'emerald',
  className = ''
}) {
  const { language } = useLanguage()
  const lang = language === 'ru' || language === 'en' ? language : 'ro'
  const [todayYmd, setTodayYmd] = useState(() => getRomaniaTodayYmd())
  const todayParsed = useMemo(() => parseYmd(todayYmd) || { y: 2026, m: 10, d: 22 }, [todayYmd])

  const [isOpen, setIsOpen] = useState(false)
  const [viewYear, setViewYear] = useState(todayParsed.y)
  const [viewMonth, setViewMonth] = useState(todayParsed.m)
  const [draftFrom, setDraftFrom] = useState(null)
  const [draftTo, setDraftTo] = useState(null)
  const [hoverYmd, setHoverYmd] = useState(null)
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0, width: 320 })

  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)

  const isCustomActive = period === 'custom' && Boolean(customRange?.from)

  const activeRange = useMemo(() => {
    if (isCustomActive) {
      return { from: customRange.from, to: customRange.to || customRange.from }
    }
    return getPresetRangeYmd(period || 'today')
  }, [isCustomActive, customRange?.from, customRange?.to, period, todayYmd])

  const resolvedTriggerText = useMemo(() => {
    if (displayLabel) return displayLabel
    if (isCustomActive) return formatYmdRangeDisplay(customRange.from, customRange.to || customRange.from, lang)
    return formatYmdRangeDisplay(activeRange.from, activeRange.to, lang)
  }, [displayLabel, isCustomActive, customRange?.from, customRange?.to, activeRange.from, activeRange.to, lang])

  const computePopoverPos = useCallback(() => {
    try {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const vw = window.innerWidth || 1280
      const vh = window.innerHeight || 800
      const popW = Math.min(320, vw - 24)
      const estH = 420
      const rawLeft = align === 'right' ? rect.right - popW : rect.left
      const clampedLeft = Math.max(12, Math.min(rawLeft, vw - popW - 12))
      const fitsBelow = rect.bottom + 8 + estH <= vh - 12
      const top = fitsBelow
        ? rect.bottom + 8
        : Math.max(12, rect.top - 8 - estH)
      setPopoverCoords({ top, left: clampedLeft, width: popW })
    } catch (_) { }
  }, [align])

  // Sync calendar view + draft state whenever popover opens
  const openPopover = () => {
    const freshToday = getRomaniaTodayYmd()
    setTodayYmd(freshToday)
    const freshParsed = parseYmd(freshToday) || todayParsed
    const baseFrom = activeRange.from || freshToday
    const baseTo = activeRange.to || baseFrom
    const anchor = parseYmd(baseTo) || parseYmd(baseFrom) || freshParsed
    setViewYear(anchor.y)
    setViewMonth(anchor.m)
    setDraftFrom(baseFrom)
    setDraftTo(baseTo)
    setHoverYmd(null)
    computePopoverPos()
    setIsOpen(true)
  }

  const togglePopover = () => {
    if (isOpen) setIsOpen(false)
    else openPopover()
  }

  // Click-outside (touch + mouse) + Escape dismiss + viewport anchor sync
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e) => {
      const inTrigger = containerRef.current && containerRef.current.contains(e.target)
      const inPopover = popoverRef.current && popoverRef.current.contains(e.target)
      if (!inTrigger && !inPopover) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    const handleReposition = () => computePopoverPos()
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, computePopoverPos])

  const yearOptions = useMemo(() => {
    const startY = Math.min(2023, todayParsed.y - 3, viewYear)
    const endY = Math.max(todayParsed.y + 1, viewYear)
    const arr = []
    for (let yr = startY; yr <= endY; yr++) arr.push(yr)
    return arr
  }, [todayParsed.y, viewYear])

  // Build 42-cell Monday-first calendar grid (6 weeks)
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const prevDate = new Date(viewYear, viewMonth - 1, 1)
    const nextDate = new Date(viewYear, viewMonth + 1, 1)

    const cells = []
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      cells.push({
        ymd: toYmd(prevDate.getFullYear(), prevDate.getMonth(), dayNum),
        day: dayNum,
        inCurrentMonth: false
      })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        ymd: toYmd(viewYear, viewMonth, d),
        day: d,
        inCurrentMonth: true
      })
    }
    let nextDay = 1
    while (cells.length < 42) {
      cells.push({
        ymd: toYmd(nextDate.getFullYear(), nextDate.getMonth(), nextDay),
        day: nextDay,
        inCurrentMonth: false
      })
      nextDay++
    }
    return cells
  }, [viewYear, viewMonth])

  const goPrevMonth = () => {
    const dt = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(dt.getFullYear())
    setViewMonth(dt.getMonth())
  }

  const goNextMonth = () => {
    const dt = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(dt.getFullYear())
    setViewMonth(dt.getMonth())
  }

  const jumpToToday = () => {
    setViewYear(todayParsed.y)
    setViewMonth(todayParsed.m)
    setDraftFrom(todayYmd)
    setDraftTo(todayYmd)
    setHoverYmd(null)
  }

  const handleDayClick = (cell) => {
    // Navigate smoothly if user clicks an adjacent month's muted date
    if (!cell.inCurrentMonth) {
      const parsed = parseYmd(cell.ymd)
      if (parsed) {
        setViewYear(parsed.y)
        setViewMonth(parsed.m)
      }
    }

    // 1st click starts new selection (single day ready immediately); 2nd click completes range
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(cell.ymd)
      setDraftTo(null)
      setHoverYmd(null)
    } else {
      if (cell.ymd < draftFrom) {
        setDraftTo(draftFrom)
        setDraftFrom(cell.ymd)
      } else {
        setDraftTo(cell.ymd)
      }
      setHoverYmd(null)
    }
  }

  const handleDayDoubleClick = (cell) => {
    onSelectRange?.({ from: cell.ymd, to: cell.ymd })
    setIsOpen(false)
  }

  const handleApply = () => {
    if (!draftFrom) return
    const f = draftFrom
    const t = draftTo || draftFrom
    const [orderedFrom, orderedTo] = f <= t ? [f, t] : [t, f]
    onSelectRange?.({ from: orderedFrom, to: orderedTo })
    setIsOpen(false)
  }

  const handleQuickPreset = (presetKey) => {
    if (presetKey === 'last_7_days') {
      const from = addDaysYmd(todayYmd, -6)
      onSelectRange?.({ from, to: todayYmd })
      setIsOpen(false)
      return
    }
    if (presetKey === 'last_30_days') {
      const from = addDaysYmd(todayYmd, -29)
      onSelectRange?.({ from, to: todayYmd })
      setIsOpen(false)
      return
    }
    if (onSelectPreset) {
      onSelectPreset(presetKey)
      setIsOpen(false)
      return
    }
    const r = getPresetRangeYmd(presetKey)
    onSelectRange?.(r)
    setIsOpen(false)
  }

  // Visual preview bounds while selecting 2nd date
  const previewBounds = useMemo(() => {
    if (!draftFrom) return { start: null, end: null, isPreviewing: false }
    if (draftTo) {
      return draftFrom <= draftTo
        ? { start: draftFrom, end: draftTo, isPreviewing: false }
        : { start: draftTo, end: draftFrom, isPreviewing: false }
    }
    if (hoverYmd) {
      return draftFrom <= hoverYmd
        ? { start: draftFrom, end: hoverYmd, isPreviewing: true }
        : { start: hoverYmd, end: draftFrom, isPreviewing: true }
    }
    return { start: draftFrom, end: draftFrom, isPreviewing: false }
  }, [draftFrom, draftTo, hoverYmd])

  const selectedDayCount = useMemo(() => {
    if (!draftFrom) return 0
    return diffDaysInclusive(draftFrom, draftTo || draftFrom)
  }, [draftFrom, draftTo])

  const labels = useMemo(() => {
    if (lang === 'ru') {
      return {
        openCalendar: 'Выбрать дату или период',
        today: 'Сегодня',
        yesterday: 'Вчера',
        last7: '7 дней',
        last30: '30 дней',
        thisMonth: 'Этот месяц',
        lastMonth: 'Прошл. месяц',
        prevMonth: 'Предыдущий месяц',
        nextMonth: 'Следующий месяц',
        pickEndHint: 'Выберите конечную дату или нажмите «Применить» для 1 дня',
        cancel: 'Отмена',
        apply: 'Применить',
        reset: 'Сброс',
        dayWord: (n) => (n === 1 ? '1 день' : n >= 2 && n <= 4 ? `${n} дня` : `${n} дней`)
      }
    }
    if (lang === 'en') {
      return {
        openCalendar: 'Choose date or range',
        today: 'Today',
        yesterday: 'Yesterday',
        last7: 'Last 7d',
        last30: 'Last 30d',
        thisMonth: 'This Month',
        lastMonth: 'Last Month',
        prevMonth: 'Previous month',
        nextMonth: 'Next month',
        pickEndHint: 'Click an end date, or Apply for a single day',
        cancel: 'Cancel',
        apply: 'Apply',
        reset: 'Reset',
        dayWord: (n) => (n === 1 ? '1 day' : `${n} days`)
      }
    }
    return {
      openCalendar: 'Alege data sau intervalul',
      today: 'Azi',
      yesterday: 'Ieri',
      last7: '7 zile',
      last30: '30 zile',
      thisMonth: 'Luna curentă',
      lastMonth: 'Luna trecută',
      prevMonth: 'Luna anterioară',
      nextMonth: 'Luna următoare',
      pickEndHint: 'Alege data de final sau apasă Aplică pentru 1 zi',
      cancel: 'Anulează',
      apply: 'Aplică',
      reset: 'Reset',
      dayWord: (n) => (n === 1 ? '1 zi' : `${n} zile`)
    }
  }, [lang])

  const monthNames = MONTHS_NOMINATIVE[lang] || MONTHS_NOMINATIVE.ro
  const weekdays = WEEKDAYS_SHORT[lang] || WEEKDAYS_SHORT.ro

  // Trigger capsule styles (GetApp.FooD Deep Brand Emerald)
  const triggerClasses = isCustomActive
    ? 'bg-gradient-to-b from-[#059669] to-[#047857] text-white shadow-[0_1px_4px_rgba(4,120,87,0.34)] hover:brightness-105'
    : variant === 'neutral'
      ? 'bg-black/[0.045] dark:bg-white/[0.08] text-[#3A3A3C] dark:text-[#E5E5EA] border border-black/[0.07] dark:border-white/[0.10] hover:bg-[#047857]/12 hover:text-[#047857] dark:hover:bg-[#10B981]/20 dark:hover:text-[#34D399]'
      : 'bg-[#047857]/12 text-[#047857] dark:bg-[#10B981]/18 dark:text-[#34D399] ring-1 ring-[#047857]/20 dark:ring-[#10B981]/25 hover:bg-[#047857]/18 dark:hover:bg-[#10B981]/26'

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      {/* Clickable macOS Date Capsule Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={togglePopover}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={labels.openCalendar}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-all duration-150 select-none ${triggerClasses} ${isOpen ? 'ring-2 ring-[#047857]/45 dark:ring-[#10B981]/50' : ''}`}
      >
        <Calendar size={11.5} className="shrink-0" />
        <span className="tabular-nums">{resolvedTriggerText}</span>
        <ChevronDown size={11} className={`shrink-0 opacity-70 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Apple macOS Tahoe 26 Liquid Glass Calendar Popover (Portaled to body so it never clips) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={labels.openCalendar}
          style={{
            position: 'fixed',
            top: `${popoverCoords.top}px`,
            left: `${popoverCoords.left}px`,
            width: `${popoverCoords.width}px`
          }}
          className="apple-glass-popover z-[120] max-h-[calc(100vh-24px)] overflow-y-auto custom-scrollbar rounded-[22px] p-3.5 text-[#1D1D1F] dark:text-[#F5F5F7] select-none"
        >
          {/* 1. Navigation Header: Prev · Month · Year · Next */}
          <div className="flex items-center justify-between gap-1.5 mb-2.5">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label={labels.prevMonth}
              title={labels.prevMonth}
              className="w-7 h-7 rounded-full inline-flex items-center justify-center bg-black/[0.05] dark:bg-white/[0.09] hover:bg-black/[0.10] dark:hover:bg-white/[0.16] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-1 flex-1 justify-center min-w-0">
              <select
                aria-label="Month"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="h-7 pl-2 pr-1.5 rounded-full text-[12.5px] font-semibold bg-black/[0.045] dark:bg-white/[0.09] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/[0.06] dark:border-white/[0.10] outline-none cursor-pointer transition-colors"
              >
                {monthNames.map((mName, idx) => (
                  <option key={mName} value={idx} className="bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {mName}
                  </option>
                ))}
              </select>

              <select
                aria-label="Year"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="h-7 pl-2 pr-1.5 rounded-full text-[12.5px] font-semibold tabular-nums bg-black/[0.045] dark:bg-white/[0.09] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/[0.06] dark:border-white/[0.10] outline-none cursor-pointer transition-colors"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr} className="bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={goNextMonth}
              aria-label={labels.nextMonth}
              title={labels.nextMonth}
              className="w-7 h-7 rounded-full inline-flex items-center justify-center bg-black/[0.05] dark:bg-white/[0.09] hover:bg-black/[0.10] dark:hover:bg-white/[0.16] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors cursor-pointer shrink-0"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 2. Active Draft Readout Strip (Start → End) + Today Jump */}
          <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 mb-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tabular-nums min-w-0 truncate">
              <span className="text-[#047857] dark:text-[#34D399]">
                {formatCompactChipDate(previewBounds.start || draftFrom, lang)}
              </span>
              {previewBounds.end && previewBounds.end !== previewBounds.start && (
                <>
                  <span className="text-[#8E8E93]">→</span>
                  <span className={previewBounds.isPreviewing ? 'text-[#047857]/70 dark:text-[#34D399]/75' : 'text-[#047857] dark:text-[#34D399]'}>
                    {formatCompactChipDate(previewBounds.end, lang)}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={jumpToToday}
              className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold text-[#047857] dark:text-[#34D399] hover:bg-[#047857]/12 dark:hover:bg-[#10B981]/20 transition-colors cursor-pointer shrink-0"
            >
              {labels.today}
            </button>
          </div>

          {/* 3. Weekday Header (Monday-First) */}
          <div className="grid grid-cols-7 mb-1">
            {weekdays.map((wd, idx) => (
              <div
                key={wd}
                className={`h-6 flex items-center justify-center text-[10.5px] font-semibold ${
                  idx >= 5 ? 'text-[#636366] dark:text-[#AEAEB2]' : 'text-[#48484A] dark:text-[#D1D1D6]'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* 4. Calendar Days Grid */}
          <div
            className="grid grid-cols-7 gap-y-0.5"
            onMouseLeave={() => setHoverYmd(null)}
          >
            {calendarDays.map((cell) => {
              const isToday = cell.ymd === todayYmd
              const isStart = previewBounds.start === cell.ymd
              const isEnd = previewBounds.end === cell.ymd
              const isSingle = isStart && isEnd
              const isInRange = Boolean(
                previewBounds.start &&
                previewBounds.end &&
                cell.ymd > previewBounds.start &&
                cell.ymd < previewBounds.end
              )

              // Continuous deep-emerald liquid band behind range days
              const bandClass = isInRange
                ? 'bg-[#047857]/14 dark:bg-[#10B981]/22'
                : (isStart && !isSingle)
                  ? 'bg-gradient-to-r from-transparent via-[#047857]/14 to-[#047857]/14 dark:via-[#10B981]/22 dark:to-[#10B981]/22 rounded-l-full'
                  : (isEnd && !isSingle)
                    ? 'bg-gradient-to-l from-transparent via-[#047857]/14 to-[#047857]/14 dark:via-[#10B981]/22 dark:to-[#10B981]/22 rounded-r-full'
                    : ''

              return (
                <div key={cell.ymd} className={`relative flex items-center justify-center h-[32px] ${bandClass}`}>
                  <button
                    type="button"
                    onClick={() => handleDayClick(cell)}
                    onDoubleClick={() => handleDayDoubleClick(cell)}
                    onMouseEnter={() => {
                      if (draftFrom && !draftTo) setHoverYmd(cell.ymd)
                    }}
                    aria-pressed={isStart || isEnd}
                    className={`relative w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-[12px] tabular-nums transition-all duration-100 cursor-pointer ${
                      (isStart || isEnd)
                        ? 'bg-gradient-to-b from-[#059669] to-[#047857] text-white font-semibold shadow-[0_2px_8px_rgba(4,120,87,0.40)]'
                        : isInRange
                          ? 'text-[#065F46] dark:text-[#ECFDF5] font-semibold hover:bg-[#047857]/18 dark:hover:bg-[#10B981]/30'
                          : cell.inCurrentMonth
                            ? isToday
                              ? 'text-[#047857] dark:text-[#34D399] font-bold ring-1 ring-[#047857]/50 dark:ring-[#10B981]/50 hover:bg-[#047857]/12'
                              : 'text-[#1D1D1F] dark:text-[#F5F5F7] font-medium hover:bg-black/[0.07] dark:hover:bg-white/[0.12]'
                            : 'text-[#8E8E93]/55 dark:text-[#8E8E93]/45 font-normal hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    {cell.day}
                    {isToday && !(isStart || isEnd) && (
                      <span className="absolute bottom-[3px] w-1 h-1 rounded-full bg-[#047857] dark:bg-[#34D399]" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Selection hint when picking 2nd date */}
          {draftFrom && !draftTo && (
            <div className="mt-2 text-[10.5px] text-center text-[#636366] dark:text-[#AEAEB2] leading-tight">
              {labels.pickEndHint}
            </div>
          )}

          {/* 5. Quick Presets Strip */}
          <div className="mt-2.5 pt-2.5 border-t border-black/[0.07] dark:border-white/[0.09] flex flex-wrap gap-1">
            {[
              { key: 'today', text: labels.today },
              { key: 'yesterday', text: labels.yesterday },
              { key: 'last_7_days', text: labels.last7 },
              { key: 'last_30_days', text: labels.last30 },
              { key: 'this_month', text: labels.thisMonth },
              { key: 'last_month', text: labels.lastMonth }
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => handleQuickPreset(chip.key)}
                className="px-2 py-1 rounded-full text-[10.5px] font-medium bg-black/[0.045] dark:bg-white/[0.08] hover:bg-[#047857]/14 hover:text-[#065F46] dark:hover:bg-[#10B981]/22 dark:hover:text-[#6EE7B7] text-[#48484A] dark:text-[#D1D1D6] transition-colors cursor-pointer"
              >
                {chip.text}
              </button>
            ))}
          </div>

          {/* 6. Action Footer */}
          <div className="mt-3 pt-2.5 border-t border-black/[0.07] dark:border-white/[0.09] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {isCustomActive && onSelectPreset ? (
                <button
                  type="button"
                  onClick={() => {
                    onSelectPreset(defaultPreset || 'today')
                    setIsOpen(false)
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#636366] dark:text-[#AEAEB2] hover:text-[#1D1D1F] dark:hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>{labels.reset}</span>
                </button>
              ) : (
                <span className="text-[11px] font-medium text-[#636366] dark:text-[#AEAEB2] tabular-nums">
                  {selectedDayCount > 0 ? labels.dayWord(selectedDayCount) : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="apple-btn-secondary !h-[28px] !px-3 !text-[11.5px]"
              >
                {labels.cancel}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!draftFrom}
                className="apple-btn-primary !h-[28px] !px-3.5 !text-[11.5px] disabled:opacity-45"
              >
                {labels.apply}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
