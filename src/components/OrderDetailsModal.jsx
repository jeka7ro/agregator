import React, { useState, useEffect } from 'react'
import { X, Copy, Check, Utensils } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import BrandAvatar, { cleanRestaurantName } from './BrandAvatar'
import OrderLiveRouteMap from './OrderLiveRouteMap'
import { formatDisplayOrderNumber, parseDeliveryAddress, isSafeHttpUrl } from '../lib/orderUtils'
import { getProductImage } from '../lib/productImages'

function formatCleanDishName(rawName = '') {
  const str = String(rawName || '').trim()
  const match = str.match(/^([A-Z0-9]{1,3}_)\s*(.+)$/i)
  if (match) {
    return { prefix: match[1].replace(/_$/, ''), cleanName: match[2] }
  }
  return { prefix: null, cleanName: str || 'Produs' }
}

export default function OrderDetailsModal({ order, isOpen, onClose }) {
  const { isDark } = useTheme()
  const { t, language } = useLanguage()
  const [copied, setCopied] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (selectedProduct) setSelectedProduct(null)
        else onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, selectedProduct, onClose])

  if (!isOpen || !order) return null

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'
  const currencyLabel = 'RON'

  const orderNum = formatDisplayOrderNumber(order.order_number, order.order_id, order.channel || order.platform) || 'N/A'
  const brandName = order.brand_name || order.brand || order.restaurant_name || 'smashme'
  const cleanBrand = cleanRestaurantName(brandName).toLowerCase().replace(/\s+/g, '')
  const channel = order.channel || order.platform || 'kiosk'
  const defaultOrderType = channel === 'kiosk'
    ? 'Smart Kiosk'
    : channel === 'casierie'
      ? (language === 'ru' ? 'На кассе (POS)' : language === 'en' ? 'In-Store (POS)' : 'La Casă (POS)')
      : (language === 'ru' ? 'Доставка' : language === 'en' ? 'Delivery' : 'Livrare')
  const orderType = order.order_type || defaultOrderType
  const paymentMethod = (order.payment_method || (channel === 'kiosk' ? 'CASH' : channel === 'casierie' ? 'POS / CASH' : 'CARD')).toUpperCase()
  const paymentSubtype = order.payment_subtype || (paymentMethod === 'CASH' ? (language === 'ru' ? 'На кассе' : language === 'en' ? 'At Counter' : 'La Casă') : channel === 'casierie' ? (language === 'ru' ? 'Кассир' : language === 'en' ? 'Cashier' : 'Casier') : '')
  const iikoId = order.iiko_order_id || order.order_id || '—'

  const placedDate = order.placed_at ? new Date(order.placed_at) : new Date()
  const formattedDate = placedDate.toLocaleString(localeCode, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC'
  })

  const rawItems = Array.isArray(order.items) ? order.items : []
  const meta = rawItems[0]?._order_meta || {}
  const items = rawItems.filter(it => it.product_name || it.name || !it._order_meta)
  const timings = order.timings || meta.timings || {}
  const extractTimeStr = (s) => {
    if (typeof s !== 'string' || !s.trim()) return s
    const trimmed = s.trim()
    if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
      const d = new Date(trimmed)
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Bucharest', hour12: false })
      }
    }
    return trimmed.match(/(\d{2}:\d{2}:\d{2})/) ? trimmed.match(/(\d{2}:\d{2}:\d{2})/)[1] : s
  }
  const createdTime = timings.created_time || extractTimeStr(timings.whenCreated || timings.when_created)
  const cookedTime = timings.cooking_completed_time || extractTimeStr(timings.whenCookingCompleted || timings.when_cooking_completed)
  const sendedTime = timings.sended_time || extractTimeStr(timings.whenSended || timings.when_sended)
  const arrivedTime = timings.arrived_at_customer_time || extractTimeStr(timings.whenArrivedAtCustomer || timings.when_arrived_at_customer)
  const deliveredTime = order.stage && order.stage !== 'delivered'
    ? null
    : (timings.delivered_time || extractTimeStr(timings.realDeliveredAt || timings.real_delivered_at || timings.whenDelivered || timings.when_delivered || timings.whenClosed || timings.when_closed))
  const hasCourierDelivTime = Boolean(timings.has_courier_delivery_time || timings.real_delivered_at || timings.realDeliveredAt)
  const customerInfo = order.customer || meta.customer || (meta.customerName ? { name: meta.customerName, phone: meta.customerPhone, address: meta.customerAddress } : null)
  const courierInfo = order.courier || meta.courier || (meta.courierName ? { name: meta.courierName, phone: meta.courierPhone } : null)

  const lbl = {
    timelineTitle: hasCourierDelivTime
      ? (language === 'ru' ? 'Хронология времени (iiko + Таблица курьеров)' : language === 'en' ? 'Order Timeline (iiko + Courier Table)' : 'Cronologie Timpi (iiko + Tabel Curieri)')
      : (language === 'ru' ? 'Хронология времени iiko (Точное время)' : language === 'en' ? 'iiko Order Timeline (Exact Times)' : 'Cronologie Timpi iiko (Ore Exacte)'),
    stepCreated: language === 'ru' ? 'Поступил' : language === 'en' ? 'Created' : 'Intrată',
    stepCooked: language === 'ru' ? 'Готов на кухне' : language === 'en' ? 'Kitchen Ready' : 'Gata Bucătărie',
    stepSent: language === 'ru' ? 'Передан курьеру' : language === 'en' ? 'Handed to Courier' : 'Predată Curier',
    stepDelivered: hasCourierDelivTime
      ? (language === 'ru' ? 'Доставлен курьером' : language === 'en' ? 'Delivered by Courier' : 'Livrat de Curier')
      : (language === 'ru' ? 'Доставлен / Закрыт' : language === 'en' ? 'Delivered / Closed' : 'Livrată / Închisă'),
    arrivedAtCustomer: language === 'ru' ? 'У двери клиента:' : language === 'en' ? 'At customer door:' : 'La ușa clientului:',
    deliveryFeeLbl: language === 'ru' ? 'Стоимость доставки:' : language === 'en' ? 'Delivery fee:' : 'Taxă livrare:',
    liveTrackingBtn: language === 'ru' ? 'Трекинг курьера Live ↗' : language === 'en' ? 'Live Courier Tracking ↗' : 'Tracking Live Curier ↗',
    client: language === 'ru' ? 'Клиент' : language === 'en' ? 'Customer' : 'Client',
    courier: language === 'ru' ? 'Курьер / Доставка' : language === 'en' ? 'Courier / Fleet' : 'Curier / Flotă',
    pickupCode: language === 'ru' ? 'Код выдачи:' : language === 'en' ? 'Pickup code:' : 'Cod ridicare:',
    reviewTitle: language === 'ru' ? 'Отзыв клиента' : language === 'en' ? 'Customer Review' : 'Recenzie Client',
    clickForDetails: language === 'ru' ? 'Нажмите для просмотра фото, состава и описания' : language === 'en' ? 'Click for photo, description & ingredients' : 'Click pentru poză mare, ingrediente și detalii',
    defaultDesc: language === 'ru'
      ? 'Свежее блюдо, приготовленное по официальной рецептуре из каталога iiko Cloud.'
      : language === 'en'
        ? 'Fresh dish prepared according to the official recipe synced from iiko Cloud.'
        : 'Preparat proaspăt conform rețetelor oficiale sincronizate din iiko Cloud.'
  }

  const handleCopyIiko = () => {
    if (iikoId && iikoId !== '—') {
      navigator.clipboard.writeText(iikoId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const hasDeliveryMap = channel !== 'kiosk' && channel !== 'casierie' && channel !== 'IN-STORE'
  const totalFormatted = `${parseFloat(order.total_amount || 0).toLocaleString(localeCode, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyLabel}`
  const timelineSteps = [
    { label: lbl.stepCreated, time: createdTime || null, dot: 'bg-slate-700 dark:bg-slate-200', color: 'text-slate-900 dark:text-white' },
    { label: lbl.stepCooked, time: cookedTime || null, dot: 'bg-[#047857] dark:bg-[#10B981]', color: 'text-[#047857] dark:text-[#10B981]' },
    { label: lbl.stepSent, time: sendedTime || null, dot: 'bg-amber-500', color: 'text-amber-600 dark:text-amber-400' },
    { label: lbl.stepDelivered, time: deliveredTime || null, dot: 'bg-emerald-500', color: 'text-emerald-600 dark:text-emerald-400' }
  ]

  return (
    <>
      {/* 1. MACOS TAHOE 26 ORDER INSPECTOR SHEET */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 apple-sheet-backdrop animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`apple-sheet w-full ${hasDeliveryMap ? 'max-w-[1040px]' : 'max-w-2xl'} flex flex-col max-h-[88vh] overflow-hidden`}
        >
          {/* LIQUID GLASS STICKY HEADER */}
          <div className="apple-sheet-header px-5 py-3.5 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <BrandAvatar brand={brandName} size={36} className="rounded-xl shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white tracking-tight">
                    {t('webhooks.order_title', 'Comandă #')}{orderNum}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>iiko</span>
                  </span>
                  {paymentSubtype && (
                    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-500/12 text-amber-700 dark:text-amber-400">
                      {paymentSubtype}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5 tabular-nums">
                  {cleanBrand || 'brand'} · {channel} · {orderType} · {paymentMethod} · {formattedDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 shrink-0">
              <div className="text-right hidden sm:block">
                <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 leading-none">
                  {t('webhooks.total_lbl', 'Total')}
                </div>
                <div className="text-[18px] font-bold tracking-tight tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {totalFormatted}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="apple-sheet-close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 2-COLUMN ADAPTIVE SPLIT BODY */}
          <div className={`flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 ${hasDeliveryMap ? 'lg:grid-cols-12' : ''}`}>
            <div className={`${hasDeliveryMap ? 'lg:col-span-7 lg:overflow-y-auto' : 'overflow-y-auto'} p-4 sm:p-5 space-y-3.5 custom-scrollbar text-xs`}>

              {/* CRONOLOGIE ORE IIKO (4-STEP STEPPER) */}
              {(createdTime || cookedTime || sendedTime || deliveredTime) && (
                <div className="apple-inset-card p-3.5">
                  <div className="text-[12px] font-semibold text-slate-900 dark:text-white pb-2 border-b border-black/[0.06] dark:border-white/[0.07]">
                    {lbl.timelineTitle}
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-3">
                    {timelineSteps.map((s, idx) => (
                      <div key={idx} className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${s.time ? s.dot : 'bg-slate-300 dark:bg-slate-700'}`} />
                          {idx < 3 && (
                            <span className={`h-[1.5px] flex-1 rounded-full ${s.time && timelineSteps[idx + 1]?.time ? 'bg-slate-300 dark:bg-slate-600' : 'bg-black/[0.06] dark:bg-white/[0.07]'}`} />
                          )}
                        </div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block truncate">{s.label}</span>
                        <strong className={`tabular-nums font-semibold text-[12.5px] ${s.time ? s.color : 'text-slate-400 dark:text-slate-600'}`}>
                          {s.time || '—'}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECȚIUNE PRODUSE — macOS Inset Grouped List */}
              <div>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                    {t('webhooks.products_lbl', 'Produse')} ({items.length})
                  </div>
                  <span className="text-[11px] font-medium text-[#047857] dark:text-[#10B981]">
                    {lbl.clickForDetails}
                  </span>
                </div>

                <div className="apple-inset-card divide-y divide-black/[0.06] dark:divide-white/[0.07] overflow-hidden">
                  {items.map((it, idx) => {
                    const qty = it.quantity || it.amount || 1
                    const rawName = it.name || it.product_name || 'Articol'
                    const { prefix, cleanName } = formatCleanDishName(rawName)
                    const price = parseFloat(it.totalPrice || it.sum || it.price || 0).toFixed(2)
                    const img = getProductImage(rawName, brandName, it.image || it.imageUrl || it.imageLinks?.[0] || null)

                    return (
                      <div
                        key={it.id || idx}
                        onClick={() => setSelectedProduct({
                          ...it,
                          name: cleanName,
                          rawName,
                          image: img,
                          imageUrl: img
                        })}
                        className="px-3 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={img}
                            alt={cleanName}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex'
                            }}
                            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-black/[0.07] dark:border-white/10"
                          />
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 items-center justify-center text-slate-400 shrink-0 border border-black/[0.07] dark:border-white/10 hidden">
                            <Utensils size={16} />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-semibold text-[12.5px] text-slate-900 dark:text-white truncate group-hover:text-[#047857] dark:group-hover:text-[#10B981] transition-colors">
                                {cleanName}
                              </h4>
                              {prefix && (
                                <span className="px-1 rounded text-[9.5px] font-medium bg-black/[0.05] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400 shrink-0">
                                  {prefix}
                                </span>
                              )}
                            </div>
                            {it.modifiers && it.modifiers.length > 0 && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {it.modifiers.join(', ')}
                              </p>
                            )}
                            {it.comment && (
                              <p className="text-[11px] italic text-amber-600 dark:text-amber-400 truncate">
                                {it.comment}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 text-right tabular-nums">
                          <span className="text-[11.5px] font-semibold text-[#047857] dark:text-[#10B981]">
                            {qty}×
                          </span>
                          <span className="text-[12.5px] font-semibold text-slate-900 dark:text-white">
                            {price} {currencyLabel}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* CLIENT & CURIER (DACĂ EXISTĂ) */}
              {(customerInfo?.name || courierInfo?.name) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                  {customerInfo?.name && (
                    <div className="apple-inset-card p-3.5">
                      <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">{lbl.client}</span>
                      <div className="font-semibold text-[13.5px] text-slate-900 dark:text-white">{customerInfo.name}</div>
                      {customerInfo.phone && <div className="tabular-nums text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">{customerInfo.phone}</div>}
                      {customerInfo.address && (() => {
                        const parsedModalAddr = parseDeliveryAddress(customerInfo.address, language)
                        return (
                          <div className="mt-1.5 space-y-1.5">
                            <div className="text-[11.5px] text-slate-700 dark:text-slate-200">
                              {parsedModalAddr.streetAddress || customerInfo.address}
                            </div>
                            {parsedModalAddr.buildingDetails.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {parsedModalAddr.buildingDetails.map((b, bIdx) => (
                                  <span
                                    key={bIdx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/10 text-slate-700 dark:text-slate-300"
                                  >
                                    <span className="text-slate-400">{b.label}:</span>
                                    <strong className="tabular-nums text-slate-900 dark:text-white">{b.value}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                            {parsedModalAddr.instructions && (
                              <div className="px-2.5 py-1.5 rounded-lg border-l-[3px] border-amber-500 bg-amber-50/80 dark:bg-amber-950/25 text-amber-900 dark:text-amber-200 text-[11px] leading-snug">
                                {parsedModalAddr.instructions}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                  {courierInfo?.name && (
                    <div className="apple-inset-card p-3.5">
                      <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">{lbl.courier}</span>
                      <div className="font-semibold text-[13.5px] text-slate-900 dark:text-white">
                        {courierInfo.name} {courierInfo.company ? <span className="text-[11px] font-normal text-slate-400">({courierInfo.company})</span> : null}
                      </div>
                      {courierInfo.phone && <div className="tabular-nums text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">{courierInfo.phone}</div>}
                      {(courierInfo.awb || courierInfo.orderId) && (
                        <div className="tabular-nums text-[11.5px] font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                          AWB: {courierInfo.awb || courierInfo.orderId}
                        </div>
                      )}
                      {courierInfo.status && (
                        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Status: <strong className="font-semibold text-amber-600 dark:text-amber-400">{courierInfo.status}</strong>
                        </div>
                      )}
                      {arrivedTime && (
                        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {lbl.arrivedAtCustomer} <strong className="tabular-nums text-[#047857] dark:text-[#10B981]">{arrivedTime}</strong>
                        </div>
                      )}
                      {courierInfo.deliveryFee && (
                        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {lbl.deliveryFeeLbl} <strong className="text-slate-800 dark:text-slate-200">{courierInfo.deliveryFee} RON</strong>
                        </div>
                      )}
                      {isSafeHttpUrl(courierInfo.trackingUrl) && (
                        <a
                          href={courierInfo.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="apple-btn-sm mt-2 text-[#047857] dark:text-[#10B981]"
                        >
                          {lbl.liveTrackingBtn}
                        </a>
                      )}
                      {(meta.pickUpCode || customerInfo?.pickUpCode) && (
                        <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">{lbl.pickupCode} <strong className="tabular-nums text-slate-900 dark:text-white">{meta.pickUpCode || customerInfo?.pickUpCode}</strong></div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* RECENZIE CLIENT ATAȘATĂ */}
              {(order.review || meta.review) && (() => {
                const rev = order.review || meta.review
                const isNeg = rev.sentiment === 'negative'
                const isPos = rev.sentiment === 'positive'
                return (
                  <div className={`p-3 rounded-xl border-l-[3px] ${
                    isNeg
                      ? 'border-l-rose-500 bg-rose-50/60 dark:bg-rose-950/25'
                      : isPos
                        ? 'border-l-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/25'
                        : 'border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/25'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">
                        {lbl.reviewTitle} · {rev.source || 'Platform'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                        isNeg ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400' : isPos ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      }`}>
                        {rev.rating}{rev.max_scale === 10 ? '/10' : '/5'}
                      </span>
                    </div>
                    {rev.comment && (
                      <p className="text-[12px] text-slate-800 dark:text-slate-100 leading-relaxed">
                        „{(language !== 'ro' && (rev.translations?.[language] || rev.comment_translations?.[language])) ? (rev.translations?.[language] || rev.comment_translations?.[language]) : rev.comment}”
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* ID COMANDĂ IIKO — Compact 1-line strip */}
              <div className="apple-inset-card px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2 text-[11.5px]">
                  <span className="font-medium text-slate-500 dark:text-slate-400 shrink-0">iiko ID</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 truncate select-all tabular-nums">{iikoId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyIiko}
                  className="apple-btn-sm !h-6 !px-2 text-slate-600 dark:text-slate-300"
                  title={t('webhooks.copy_iiko_id', 'Copiază ID iiko')}
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* RIGHT LIVE ROUTE MAP PANE */}
            {hasDeliveryMap && (
              <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-black/[0.07] dark:border-white/[0.08] flex flex-col min-h-[340px] lg:min-h-0">
                <OrderLiveRouteMap
                  order={{
                    ...order,
                    customer: customerInfo || order.customer,
                    courier: courierInfo || order.courier
                  }}
                  isDark={isDark}
                  language={language}
                  fillHeight
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. PRODUCT DETAILS & INGREDIENTS SHEET */}
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedProduct(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSelectedProduct(null) }}
          tabIndex={-1}
          className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 apple-sheet-backdrop animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-sheet w-full max-w-2xl flex flex-col max-h-[88vh] overflow-hidden"
          >
            {/* PRODUCT HEADER */}
            <div className="apple-sheet-header px-5 py-3.5 flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white tracking-tight truncate">
                {selectedProduct.name || selectedProduct.product_name || t('webhooks.product_details', 'Detalii Produs')}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Close"
                className="apple-sheet-close"
              >
                <X size={15} />
              </button>
            </div>

            {/* PRODUCT BODY: IMAGE ON LEFT, DESCRIPTION & INGREDIENTS ON RIGHT */}
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex flex-col md:flex-row gap-5">
                
                {/* LEFT: PRODUCT IMAGE (DIRECT DIN IIKO / SYRVE) */}
                <div className="md:w-5/12 shrink-0">
                  {(() => {
                    const bigImg = getProductImage(
                      selectedProduct.rawName || selectedProduct.name || selectedProduct.product_name,
                      brandName,
                      selectedProduct.image || selectedProduct.imageUrl || selectedProduct.imageLinks?.[0]
                    )
                    return (
                      <>
                        <img
                          src={bigImg}
                          alt={selectedProduct.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex'
                          }}
                          className="w-full aspect-square object-cover rounded-[16px] border border-black/[0.08] dark:border-white/10"
                        />
                        <div className="w-full aspect-square rounded-[16px] apple-inset-card flex-col items-center justify-center text-slate-400 gap-2.5 hidden">
                          <Utensils size={42} className="opacity-40" />
                          <span className="text-xs font-medium text-slate-400">{t('webhooks.no_image', 'Fără imagine în iiko')}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* RIGHT: DESCRIPTION & INGREDIENTS FROM IIKO */}
                <div className="md:w-7/12 flex flex-col justify-between gap-4 text-[13px]">
                  <div className="space-y-3">
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedProduct.description || lbl.defaultDesc}
                    </p>

                    {selectedProduct.ingredients && (
                      <div className="apple-inset-card p-3.5">
                        <h5 className="font-semibold text-slate-900 dark:text-white mb-1 text-[12px]">
                          {t('webhooks.ingredients_allergens', 'Ingrediente și alergeni')}
                        </h5>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[12px]">
                          {selectedProduct.ingredients}
                        </p>
                      </div>
                    )}

                    {selectedProduct.modifiers && selectedProduct.modifiers.length > 0 && (
                      <div className="apple-inset-card p-3.5">
                        <h5 className="font-semibold text-slate-900 dark:text-white mb-1.5 text-[12px]">
                          {t('webhooks.selected_modifiers', 'Modificatori selectați')}
                        </h5>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProduct.modifiers.map((m, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#047857]/12 text-[#047857] dark:text-[#10B981]">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PRICE & QUANTITY */}
                  <div className="pt-3 border-t border-black/[0.07] dark:border-white/[0.08] flex items-center justify-between">
                    <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                      {t('webhooks.qty_lbl', 'Cantitate:')} <strong className="text-slate-900 dark:text-white tabular-nums">{selectedProduct.quantity || selectedProduct.amount || 1}×</strong>
                    </span>
                    <span className="text-[20px] font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
                      {parseFloat(selectedProduct.totalPrice || selectedProduct.sum || selectedProduct.price || 0).toFixed(2)} {currencyLabel}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
