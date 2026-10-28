import React, { useState } from 'react'
import { X, Copy, Check, Utensils } from 'lucide-react'
import { useTheme } from '../lib/ThemeContext'
import { useLanguage } from '../lib/LanguageContext'
import BrandAvatar, { cleanRestaurantName } from './BrandAvatar'
import { formatDisplayOrderNumber } from '../lib/orderUtils'
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

  if (!isOpen || !order) return null

  const localeCode = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'ro-RO'
  const currencyLabel = language === 'ru' ? 'лей' : language === 'en' ? 'RON' : 'lei'

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
  const paymentSubtype = order.payment_subtype || (paymentMethod === 'CASH' ? (language === 'ru' ? 'На кассе' : 'La Casă') : channel === 'casierie' ? 'Casier' : '')
  const iikoId = order.iiko_order_id || order.order_id || '—'

  const placedDate = order.placed_at ? new Date(order.placed_at) : new Date()
  const formattedDate = placedDate.toLocaleString(localeCode, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const rawItems = Array.isArray(order.items) ? order.items : []
  const meta = rawItems[0]?._order_meta || {}
  const items = rawItems.filter(it => it.product_name || it.name || !it._order_meta)
  const timings = order.timings || meta.timings || {}
  const extractTimeStr = (s) => (typeof s === 'string' && s.match(/(\d{2}:\d{2}:\d{2})/)) ? s.match(/(\d{2}:\d{2}:\d{2})/)[1] : s
  const createdTime = timings.created_time || extractTimeStr(timings.whenCreated || timings.when_created)
  const cookedTime = timings.cooking_completed_time || extractTimeStr(timings.whenCookingCompleted || timings.when_cooking_completed)
  const sendedTime = timings.sended_time || extractTimeStr(timings.whenSended || timings.when_sended)
  const deliveredTime = timings.delivered_time || extractTimeStr(timings.whenDelivered || timings.when_delivered || timings.whenClosed || timings.when_closed)
  const customerInfo = order.customer || meta.customer || (meta.customerName ? { name: meta.customerName, phone: meta.customerPhone, address: meta.customerAddress } : null)
  const courierInfo = order.courier || meta.courier || (meta.courierName ? { name: meta.courierName, phone: meta.courierPhone } : null)

  const lbl = {
    timelineTitle: language === 'ru' ? 'Хронология времени iiko (Точное время)' : language === 'en' ? 'iiko Order Timeline (Exact Times)' : 'Cronologie Timpi iiko (Ore Exacte)',
    stepCreated: language === 'ru' ? 'Поступил' : language === 'en' ? 'Created' : 'Intrată',
    stepCooked: language === 'ru' ? 'Готов на кухне' : language === 'en' ? 'Kitchen Ready' : 'Gata Bucătărie',
    stepSent: language === 'ru' ? 'Передан курьеру' : language === 'en' ? 'Handed to Courier' : 'Predată Curier',
    stepDelivered: language === 'ru' ? 'Доставлен / Закрыт' : language === 'en' ? 'Delivered / Closed' : 'Livrată / Închisă',
    client: language === 'ru' ? 'Клиент' : language === 'en' ? 'Customer' : 'Client',
    courier: language === 'ru' ? 'Курьер / Доставка' : language === 'en' ? 'Courier / Fleet' : 'Curier / Flotă',
    pickupCode: language === 'ru' ? 'Код выдачи:' : language === 'en' ? 'Pickup code:' : 'Cod ridicare:',
    reviewTitle: language === 'ru' ? '★ Отзыв клиента' : language === 'en' ? '★ Customer Review' : '★ Recenzie Client',
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

  return (
    <>
      {/* 1. ORDER DETAILS MODAL */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
        <div 
          className={`w-full max-w-lg rounded-3xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}
        >
          {/* HEADER */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('webhooks.order_title', 'Comandă #')}{orderNum}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar text-xs sm:text-sm">
            
            {/* BRAND & IIKO BADGE */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BrandAvatar brand={brandName} size={26} />
                <span className="font-black text-base text-[#E30613] tracking-tight lowercase">
                  {cleanBrand || 'smashme'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>iiko</span>
              </span>
            </div>

            {/* ORDER META INFO */}
            <div className="grid grid-cols-2 gap-y-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <div>
                {t('webhooks.channel_lbl', 'Canal:')} <strong className="text-slate-900 dark:text-white font-extrabold">{channel}</strong>
              </div>
              <div>
                {t('webhooks.order_type_lbl', 'Tip Comandă:')} <strong className="text-slate-900 dark:text-white font-extrabold">{orderType}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span>{t('webhooks.payment_lbl', 'Plată:')}</span>
                <strong className="text-slate-900 dark:text-white font-extrabold">{paymentMethod}</strong>
                {paymentSubtype && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                    {paymentSubtype}
                  </span>
                )}
              </div>
              <div>
                {t('webhooks.datetime_lbl', 'Data/Ora:')} <strong className="text-slate-900 dark:text-white font-extrabold">{formattedDate}</strong>
              </div>
            </div>

            {/* CRONOLOGIE ORE IIKO (DACĂ EXISTĂ) */}
            {(createdTime || cookedTime || sendedTime || deliveredTime) && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-2">
                  {lbl.timelineTitle}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{lbl.stepCreated}</span>
                    <strong className="font-mono font-extrabold text-slate-900 dark:text-white">{createdTime || '—'}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{lbl.stepCooked}</span>
                    <strong className="font-mono font-extrabold text-blue-600 dark:text-blue-400">{cookedTime || '—'}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{lbl.stepSent}</span>
                    <strong className="font-mono font-extrabold text-amber-600 dark:text-amber-400">{sendedTime || '—'}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-emerald-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{lbl.stepDelivered}</span>
                    <strong className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{deliveredTime || '—'}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* CLIENT & CURIER (DACĂ EXISTĂ) */}
            {(customerInfo?.name || courierInfo?.name) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {customerInfo?.name && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">{lbl.client}</span>
                    <div className="font-bold text-slate-900 dark:text-white">{customerInfo.name}</div>
                    {customerInfo.phone && <div className="font-mono text-[11px] text-slate-500 mt-0.5">{customerInfo.phone}</div>}
                    {customerInfo.address && <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={customerInfo.address}>{customerInfo.address}</div>}
                  </div>
                )}
                {courierInfo?.name && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">{lbl.courier}</span>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">{courierInfo.name}</div>
                    {courierInfo.phone && <div className="font-mono text-[11px] text-slate-500 mt-0.5">{courierInfo.phone}</div>}
                    {(meta.pickUpCode || customerInfo?.pickUpCode) && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{lbl.pickupCode} <strong className="font-mono">{meta.pickUpCode || customerInfo?.pickUpCode}</strong></div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* RECENZIE CLIENT ATAȘATĂ (dacă există) */}
            {(order.review || meta.review) && (() => {
              const rev = order.review || meta.review
              const isNeg = rev.sentiment === 'negative'
              const isPos = rev.sentiment === 'positive'
              return (
                <div className={`p-3.5 rounded-2xl border ${
                  isNeg
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
                    : isPos
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                      isNeg ? 'text-rose-600 dark:text-rose-400' : isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {lbl.reviewTitle} ({rev.source || 'Platform'})
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                      isNeg ? 'bg-rose-600 text-white' : isPos ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      ★ {rev.rating}{rev.max_scale === 10 ? '/10' : '/5'}
                    </span>
                  </div>
                  {rev.comment && (
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 italic">
                      „{(lang !== 'ro' && rev.translations?.[lang]) ? rev.translations[lang] : rev.comment}”
                    </p>
                  )}
                </div>
              )
            })()}

            {/* ID COMANDĂ IIKO BOX */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                  {t('webhooks.iiko_order_id_lbl', 'ID COMANDĂ IIKO')}
                </span>
                <p className="text-xs sm:text-sm font-sans font-bold text-slate-900 dark:text-white truncate select-all">
                  {iikoId}
                </p>
              </div>
              <button
                onClick={handleCopyIiko}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                title={t('webhooks.copy_iiko_id', 'Copiază ID iiko')}
              >
                {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>

            {/* SECȚIUNE PRODUSE CU POZE REALE DIN IIKO / SYRVE */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('webhooks.products_lbl', 'PRODUSE')} ({items.length})
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {lbl.clickForDetails}
                </span>
              </div>

              <div className="space-y-2.5">
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
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-extrabold text-slate-400 w-4 text-right shrink-0">
                          {it.index || idx + 1}.
                        </span>

                        <img
                          src={img}
                          alt={cleanName}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex'
                          }}
                          className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-xs border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform"
                        />
                        <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 items-center justify-center text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700 hidden">
                          <Utensils size={20} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {prefix && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                {prefix}
                              </span>
                            )}
                            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {cleanName}
                            </h4>
                          </div>
                          {it.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[230px] mt-0.5">
                              {it.description}
                            </p>
                          )}
                          {it.modifiers && it.modifiers.length > 0 && (
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                              {it.modifiers.join(', ')}
                            </p>
                          )}
                          {it.comment && (
                            <p className="text-[11px] font-semibold italic text-amber-600 dark:text-amber-400 truncate">
                              {it.comment}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <span className="text-xs font-black text-cyan-600 dark:text-cyan-400">
                          {qty}x
                        </span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                          {price} {currencyLabel}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* TOTAL FOOTER */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('webhooks.total_lbl', 'TOTAL')}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {parseFloat(order.total_amount || 0).toLocaleString(localeCode, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencyLabel}
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* 2. PRODUCT DETAILS & INGREDIENTS MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className={`w-full max-w-2xl rounded-3xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            {/* PRODUCT HEADER */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {selectedProduct.name || selectedProduct.product_name || t('webhooks.product_details', 'Detalii Produs')}
              </h3>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* PRODUCT BODY: IMAGE ON LEFT, DESCRIPTION & INGREDIENTS ON RIGHT */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* LEFT: PRODUCT IMAGE (DIRECT DIN IIKO / SYRVE) */}
                <div className="md:w-1/2 shrink-0">
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
                          className="w-full aspect-square object-cover rounded-2xl shadow-md border border-slate-200 dark:border-slate-700"
                        />
                        <div className="w-full aspect-square rounded-2xl bg-slate-100 dark:bg-slate-800 flex-col items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700 gap-2.5 hidden">
                          <Utensils size={48} className="opacity-40" />
                          <span className="text-xs font-semibold text-slate-400">{t('webhooks.no_image', 'Fără imagine în iiko')}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* RIGHT: DESCRIPTION & INGREDIENTS FROM IIKO */}
                <div className="md:w-1/2 space-y-4 text-xs sm:text-sm">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {selectedProduct.description || lbl.defaultDesc}
                  </p>

                  {selectedProduct.ingredients && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                      <h5 className="font-extrabold text-slate-900 dark:text-white mb-1.5 uppercase text-[11px] tracking-wider">
                        {t('webhooks.ingredients_allergens', 'Ingrediente & Alergeni:')}
                      </h5>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                        {selectedProduct.ingredients}
                      </p>
                    </div>
                  )}

                  {selectedProduct.modifiers && selectedProduct.modifiers.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
                      <h5 className="font-extrabold text-slate-900 dark:text-white mb-1.5 uppercase text-[11px] tracking-wider">
                        {t('webhooks.selected_modifiers', 'Modificatori selectați:')}
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProduct.modifiers.map((m, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PRICE & QUANTITY */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      {t('webhooks.qty_lbl', 'Cantitate:')} <strong className="text-slate-900 dark:text-white">{selectedProduct.quantity || selectedProduct.amount || 1}x</strong>
                    </span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
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
