import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const _custFileDir = (() => {
  try {
    return import.meta?.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd()
  } catch (_) {
    return process.cwd()
  }
})()

const CACHE_PATHS = [
  path.resolve(_custFileDir, '../../../data/customers-cache.json'),
  path.resolve(process.cwd(), 'data/customers-cache.json'),
  path.resolve(_custFileDir, '../../data/customers-cache.json')
]

const REVIEWS_CACHE_PATHS = [
  path.resolve(_custFileDir, '../../../data/reviews-cache.json'),
  path.resolve(process.cwd(), 'data/reviews-cache.json'),
  path.resolve(_custFileDir, '../../data/reviews-cache.json')
]

function resolveCacheFilePath() {
  for (const p of CACHE_PATHS) {
    if (fs.existsSync(p)) return p
  }
  const primary = CACHE_PATHS[0]
  const dir = path.dirname(primary)
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }) } catch (_) {}
  }
  return primary
}

function resolveReviewsCacheFilePath() {
  for (const p of REVIEWS_CACHE_PATHS) {
    if (fs.existsSync(p)) return p
  }
  return null
}

const GENERIC_NAMES = new Set([
  'client',
  'client verificat',
  'client kiosk',
  'kiosk',
  'casierie',
  'anonim',
  'anonymous',
  'guest',
  'glovo',
  'wolt',
  'bolt',
  'bolt food',
  'customer',
  'livrare',
  'delivery'
])

function stripEmojis(str = '') {
  return String(str || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeAscii(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeCanonicalCity(rawCity = '', rawRestaurantName = '') {
  const combined = `${normalizeAscii(rawCity)} ${normalizeAscii(rawRestaurantName)}`
  if (combined.includes('george enescu') || combined.includes('suceava')) return 'SUCEAVA'
  if (combined.includes('targu mures') || combined.includes('tirgu mures') || combined.includes('tg mures')) return 'TARGU MURES'
  if (combined.includes('bucuresti') || combined.includes('iuliu maniu') || combined.includes('halelor') || combined.includes('ceaikovski') || combined.includes('baneasa') || combined.includes('pipera')) return 'BUCURESTI'
  if (combined.includes('cluj') || combined.includes('emil isac') || combined.includes('avram iancu') || combined.includes('floresti')) return 'CLUJ'
  if (combined.includes('iasi') || combined.includes('voievozilor')) return 'IASI'
  if (combined.includes('timisoara')) return 'TIMISOARA'
  if (combined.includes('constanta')) return 'CONSTANTA'
  if (combined.includes('brasov')) return 'BRASOV'
  if (combined.includes('sibiu') || combined.includes('mihai viteazu')) return 'SIBIU'
  if (combined.includes('craiova')) return 'CRAIOVA'
  if (combined.includes('oradea')) return 'ORADEA'
  if (combined.includes('pitesti') || combined.includes('teilor')) return 'PITESTI'
  if (combined.includes('galati')) return 'GALATI'
  if (combined.includes('braila')) return 'BRAILA'
  if (combined.includes('bacau')) return 'BACAU'
  if (combined.includes('botosani')) return 'BOTOSANI'
  if (combined.includes('piatra neamt')) return 'PIATRA NEAMT'
  if (combined.includes('ploiesti')) return 'PLOIESTI'
  if (combined.includes('tulcea')) return 'TULCEA'
  if (combined.includes('baia mare')) return 'BAIA MARE'
  const fallback = String(rawCity || 'BUCURESTI').toUpperCase().trim()
  if (fallback.startsWith('CHIJ') || fallback.length > 22) return 'SUCEAVA'
  return fallback
}

function normalizePhone(rawPhone) {
  if (!rawPhone) return ''
  const cleaned = String(rawPhone).replace(/[^\d+]/g, '').trim()
  if (cleaned.length < 6) return ''
  if (cleaned.startsWith('07') && cleaned.length === 10) {
    return `+4${cleaned}`
  }
  if (cleaned.startsWith('407') && cleaned.length === 11) {
    return `+${cleaned}`
  }
  return cleaned
}

function normalizeName(rawName) {
  if (!rawName) return ''
  return String(rawName).replace(/\s+/g, ' ').trim()
}

function isGenericCustomerName(name) {
  if (!name) return true
  const lower = String(name).toLowerCase().trim()
  if (lower.length < 2) return true
  if (GENERIC_NAMES.has(lower)) return true
  if (lower.startsWith('kiosk ') || lower.startsWith('masa ')) return true
  return false
}

// Detectează dacă numărul de telefon este un număr de centrală/proxy al agregatorului (ex: +4037..., +4822..., +400000000000)
function isAggregatorProxyPhone(phone) {
  if (!phone) return true
  const p = String(phone)
  if (
    p.startsWith('+48') ||
    p.startsWith('+4031') ||
    p.startsWith('+4037') ||
    p.startsWith('+4021') ||
    p.includes('0000000')
  ) {
    return true
  }
  return false
}

function makeCustomerKey({ name, phone, city, address }) {
  const normName = normalizeName(name).toLowerCase()
  const normPhone = normalizePhone(phone)
  const normCity = normalizeCanonicalCity(city)
  const cleanAddr = String(address || '')
    .split(/[;,]/)[0]
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32)

  // Dacă are număr personal de mobil (+407...) și nu e număr de centrală
  if (normPhone && !isAggregatorProxyPhone(normPhone)) {
    if (!isGenericCustomerName(normName)) {
      return `ph_${normPhone}_${normName.slice(0, 18)}`
    }
    return `ph_${normPhone}_${normCity}`
  }

  // Pentru clienții ale căror comenzi vin cu număr proxy de centrală sau fără telefon
  if (!isGenericCustomerName(normName)) {
    return `nm_${normCity}_${normName}_${cleanAddr || 'noaddr'}`
  }

  if (cleanAddr && cleanAddr.length >= 5) {
    return `ad_${normCity}_${cleanAddr}`
  }

  return null
}

function hashCustomerId(key) {
  let h = 2166136261
  const s = String(key || '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `cust_${Math.abs(h).toString(36)}`
}

class CustomersService {
  constructor() {
    this.customersByKey = new Map()
    this.customersById = new Map()
    this.dirty = false
    this.lastSavedAt = 0
    this._loadFromDisk()
    this._loadReviewsFromDisk()
  }

  _loadFromDisk() {
    try {
      const filePath = resolveCacheFilePath()
      if (fs.existsSync(filePath)) {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        this.hydrateFromStatic(raw)
      }
    } catch (err) {
      console.warn('[CustomersService] Failed to load customers cache:', err.message)
    }
  }

  _loadReviewsFromDisk() {
    try {
      const revPath = resolveReviewsCacheFilePath()
      if (revPath && fs.existsSync(revPath)) {
        const rawRevs = JSON.parse(fs.readFileSync(revPath, 'utf8'))
        if (Array.isArray(rawRevs) && rawRevs.length > 0) {
          this.ingestReviews(rawRevs)
        }
      }
    } catch (err) {
      console.warn('[CustomersService] Failed to load reviews cache into customers:', err.message)
    }
  }

  hydrateFromStatic(raw) {
    if (!raw || this.customersByKey.size > 0) return
    const list = Array.isArray(raw?.customers) ? raw.customers : (Array.isArray(raw) ? raw : [])
    for (const c of list) {
      if (c && c.key && c.id) {
        c.city = normalizeCanonicalCity(c.city)
        if (!Array.isArray(c.reviews)) c.reviews = []
        c.reviews_count = c.reviews.length
        this.customersByKey.set(c.key, c)
        this.customersById.set(c.id, c)
      }
    }
    if (this.customersByKey.size > 0) {
      console.log(`[CustomersService] Loaded ${this.customersByKey.size} real customers from cache.`)
    }
  }

  saveToDisk(force = false) {
    if (!this.dirty && !force) return
    const now = Date.now()
    if (!force && now - this.lastSavedAt < 5000) return
    try {
      const filePath = resolveCacheFilePath()
      const all = Array.from(this.customersByKey.values()).sort(
        (a, b) => new Date(b.last_order_at || 0) - new Date(a.last_order_at || 0)
      )
      fs.writeFileSync(
        filePath,
        JSON.stringify(
          {
            updated_at: new Date().toISOString(),
            total_customers: all.length,
            customers: all
          },
          null,
          2
        ),
        'utf8'
      )
      this.dirty = false
      this.lastSavedAt = now
    } catch (err) {
      // Pe medii serverless read-only (Netlify), păstrăm în memorie fără eroare fatală
    }
  }

  _findMatchingCustomerForReview(r, city) {
    const allCustomers = Array.from(this.customersByKey.values())
    const revOrderId = String(r.order_id || '').replace(/^#+/, '').trim()
    const revIikoId = String(r.iiko_order_id || '').trim()
    const revPhone = normalizePhone(r.customer_phone || '')
    const rawRevName = normalizeName(r.customer_name || '')
    const normRevName = normalizeAscii(rawRevName)
    const revParts = normRevName.split(/\s+/).filter(Boolean)

    // 1. Match by Order ID / iiko Order UUID
    if (revOrderId || revIikoId) {
      const byOrder = allCustomers.find(c =>
        (c.recent_orders || []).some(ro =>
          (revOrderId && String(ro.order_number || '').replace(/^#+/, '').trim() === revOrderId) ||
          (revIikoId && (ro.order_id === revIikoId || ro.base_uuid === revIikoId))
        )
      )
      if (byOrder) return byOrder
    }

    // 2. Match by Direct Phone
    if (revPhone && !isAggregatorProxyPhone(revPhone)) {
      const byPhone = allCustomers.find(c => c.phone === revPhone)
      if (byPhone) return byPhone
    }

    if (isGenericCustomerName(rawRevName)) return null

    // 3. Exact Name Match in the same City
    const byExactCityName = allCustomers.find(
      c => c.city === city && normalizeAscii(c.name) === normRevName
    )
    if (byExactCityName) return byExactCityName

    // 4. Exact Full Name Match across any City (if full name has 2+ words and >= 8 chars)
    if (revParts.length >= 2 && normRevName.length >= 8) {
      const byExactGlobalName = allCustomers.find(c => normalizeAscii(c.name) === normRevName)
      if (byExactGlobalName) return byExactGlobalName
    }

    // 5. Partial / Abbreviated Name Match in the same City (e.g. "Ioana M." <-> "ioana Mamaliga", "Madalina" <-> "Mădălina Popica")
    const candidates = allCustomers.filter(c => {
      if (c.city !== city) return false
      const cNorm = normalizeAscii(c.name)
      const cParts = cNorm.split(/\s+/).filter(Boolean)
      if (cParts.length === 0) return false

      // Case A: Customer in DB has "FirstName L." and reviewer has "FirstName LastName"
      if (revParts.length >= 2 && cParts.length >= 2) {
        const cFirst = cParts[0]
        const cLastClean = cParts[1].replace(/\./g, '')
        const rFirst = revParts[0]
        const rLastClean = revParts[1].replace(/\./g, '')

        if (cFirst === rFirst && cLastClean.length === 1 && rLastClean.startsWith(cLastClean)) return true
        if (cFirst === rFirst && rLastClean.length === 1 && cLastClean.startsWith(rLastClean)) return true
      }

      // Case B: Customer in DB has single first name (e.g. "Madalina" or "Alexandra") in same city & brand
      if (cParts.length === 1 && cParts[0].length >= 5 && revParts[0] === cParts[0]) {
        return true
      }

      return false
    })

    if (candidates.length > 0) {
      // Preferăm clientul care a comandat de la același brand și are cele mai multe comenzi
      const revBrand = String(r.brand_name || '').toLowerCase()
      candidates.sort((a, b) => {
        const aBrand = (a.brands || []).some(br => br.toLowerCase() === revBrand) ? 1 : 0
        const bBrand = (b.brands || []).some(br => br.toLowerCase() === revBrand) ? 1 : 0
        if (bBrand !== aBrand) return bBrand - aBrand
        return (b.orders_count || 0) - (a.orders_count || 0)
      })
      return candidates[0]
    }

    return null
  }

  ingestReviews(reviews = []) {
    if (!Array.isArray(reviews) || reviews.length === 0) return 0
    let linkedCount = 0

    for (const r of reviews) {
      if (!r) continue
      const rawName = normalizeName(r.customer_name || '')
      const hasOrderId = Boolean(r.order_id || r.iiko_order_id)

      // Ignorăm recenziile anonime de tip "Client Verificat" din rating_monitor dacă nu au order_id
      if (isGenericCustomerName(rawName) && !hasOrderId) continue

      const city = normalizeCanonicalCity(r.city, r.restaurant_name)
      const brandName = r.brand_name || 'Roll Master'
      const restName = r.restaurant_name || city
      const plat = String(r.platform || 'google').toLowerCase().trim()
      const reviewedAt = r.reviewed_at || new Date().toISOString()

      let record = this._findMatchingCustomerForReview(r, city)

      if (!record && !isGenericCustomerName(rawName)) {
        const key = makeCustomerKey({
          name: rawName,
          phone: r.customer_phone || '',
          city,
          address: r.branch_address || ''
        })
        if (!key) continue
        const id = hashCustomerId(key)
        record = this.customersByKey.get(key)
        if (!record) {
          record = {
            id,
            key,
            name: rawName,
            phone: normalizePhone(r.customer_phone || ''),
            is_direct_phone: Boolean(r.customer_phone && !isAggregatorProxyPhone(r.customer_phone)),
            city,
            address: '',
            addresses: [],
            brands: brandName ? [brandName] : [],
            restaurants: restName ? [restName] : [],
            platforms: plat ? [plat] : [],
            orders_count: 0,
            total_spent: 0,
            avg_order_value: 0,
            first_order_at: reviewedAt,
            last_order_at: reviewedAt,
            notes: '',
            is_vip: false,
            avatar_url: r.customer_avatar || null,
            reviews: [],
            reviews_count: 0,
            avg_rating: null,
            has_negative_review: false,
            recent_orders: []
          }
          this.customersByKey.set(key, record)
          this.customersById.set(id, record)
          this.dirty = true
        }
      }

      if (!record) continue

      // Îmbogățim numele clientului dacă în DB era abreviat (ex: "Ioana M." -> "Ioana Mamaliga")
      if (!isGenericCustomerName(rawName) && rawName.length > (record.name || '').length && (record.name.includes('.') || !record.name.includes(' '))) {
        record.name = rawName
        this.dirty = true
      }

      if (r.customer_avatar && !record.avatar_url) {
        record.avatar_url = r.customer_avatar
        this.dirty = true
      }

      if (brandName && !(record.brands || []).includes(brandName)) {
        record.brands = [...(record.brands || []), brandName]
        this.dirty = true
      }
      if (restName && !(record.restaurants || []).includes(restName) && (record.restaurants || []).length < 8) {
        record.restaurants = [...(record.restaurants || []), restName]
        this.dirty = true
      }
      if (plat && !(record.platforms || []).includes(plat)) {
        record.platforms = [...(record.platforms || []), plat]
        this.dirty = true
      }

      if (!Array.isArray(record.reviews)) record.reviews = []

      const cleanComment = stripEmojis(r.comment || '')
      const cleanTranslations = r.comment_translations
        ? {
            ro: stripEmojis(r.comment_translations.ro || cleanComment),
            en: stripEmojis(r.comment_translations.en || cleanComment),
            ru: stripEmojis(r.comment_translations.ru || cleanComment)
          }
        : { ro: cleanComment, en: cleanComment, ru: cleanComment }

      const maxRating = Number(r.max_rating || (plat === 'glovo' ? 10 : 5))
      const rating = Number(r.rating || 5)
      const norm5 = maxRating === 10 ? rating / 2 : rating
      const sentiment = r.sentiment || (norm5 <= 2.5 ? 'negative' : norm5 >= 4 ? 'positive' : 'neutral')

      const revEntry = {
        id: r.id || `rev_${hashCustomerId( `${record.id}_${reviewedAt}_${cleanComment.slice(0, 20)}` )}`,
        platform: plat,
        brand_name: brandName,
        restaurant_name: restName,
        city,
        rating,
        max_rating: maxRating,
        sentiment,
        comment: cleanComment,
        comment_translations: cleanTranslations,
        review_photos: Array.isArray(r.review_photos) ? r.review_photos : [],
        review_url: r.review_url || null,
        order_id: r.order_id || null,
        iiko_order_id: r.iiko_order_id || null,
        reviewed_at: reviewedAt,
        source: r.source || 'platform'
      }

      const existingIdx = record.reviews.findIndex(
        rv =>
          (rv.id && revEntry.id && rv.id === revEntry.id) ||
          (rv.reviewed_at === revEntry.reviewed_at && rv.comment === revEntry.comment)
      )

      if (existingIdx >= 0) {
        record.reviews[existingIdx] = { ...record.reviews[existingIdx], ...revEntry }
      } else {
        record.reviews.push(revEntry)
        this.dirty = true
        linkedCount++
      }

      record.reviews.sort((a, b) => new Date(b.reviewed_at || 0) - new Date(a.reviewed_at || 0))
      record.reviews_count = record.reviews.length

      // Calculăm nota medie normalizată pe scara 1-5
      const sum5 = record.reviews.reduce((acc, rv) => {
        const m = Number(rv.max_rating || 5)
        const val = Number(rv.rating || 5)
        return acc + (m === 10 ? val / 2 : val)
      }, 0)
      record.avg_rating = record.reviews.length > 0 ? Math.round((sum5 / record.reviews.length) * 10) / 10 : null
      record.has_negative_review = record.reviews.some(rv => rv.sentiment === 'negative')

      // Atașăm recenzia și pe comanda corespunzătoare din recent_orders (pentru OrderDetailsModal)
      if (Array.isArray(record.recent_orders) && record.recent_orders.length > 0) {
        const revOrdNum = String(r.order_id || '').replace(/^#+/, '').trim()
        const targetOrder =
          record.recent_orders.find(
            ro =>
              (revOrdNum && String(ro.order_number || '').replace(/^#+/, '').trim() === revOrdNum) ||
              (r.iiko_order_id && (ro.order_id === r.iiko_order_id || ro.base_uuid === r.iiko_order_id))
          ) || record.recent_orders[0]

        if (targetOrder && !targetOrder.review) {
          targetOrder.review = {
            rating: revEntry.rating,
            max_scale: revEntry.max_rating,
            max_rating: revEntry.max_rating,
            comment: revEntry.comment,
            comment_translations: revEntry.comment_translations,
            sentiment: revEntry.sentiment,
            source: revEntry.platform.toUpperCase(),
            reviewed_at: revEntry.reviewed_at,
            review_url: revEntry.review_url,
            review_photos: revEntry.review_photos
          }
          this.dirty = true
        }
      }
    }

    if (this.dirty) {
      this.saveToDisk(false)
    }
    return linkedCount
  }

  ingestOrders(orders = []) {
    if (!Array.isArray(orders) || orders.length === 0) return 0
    let touchedCount = 0

    for (const o of orders) {
      if (!o) continue
      const plat = String(o.platform || o.channel || '').toLowerCase().trim()
      if (plat === 'kiosk' || plat === 'casierie' || plat === 'in-store') continue

      const meta = (o.items || [])[0]?._order_meta || {}
      const custObj = o.customer || meta.customer || {}
      const rawName = normalizeName(custObj.name || meta.customerName || '')
      const rawPhone = normalizePhone(custObj.phone || meta.customerPhone || '')
      const rawAddress = String(custObj.address || meta.customerAddress || '').trim()

      // Ignorăm comenzile care nu au nici nume real, nici telefon, nici adresă de livrare
      if (isGenericCustomerName(rawName) && !rawPhone && !rawAddress) continue

      const city = normalizeCanonicalCity(o.restaurant_city || o.city || meta.city || 'BUCURESTI', o.restaurant_name)
      const key = makeCustomerKey({
        name: rawName,
        phone: rawPhone,
        city,
        address: rawAddress
      })
      if (!key) continue

      const id = hashCustomerId(key)
      let record = this.customersByKey.get(key)
      const placedAt = o.placed_at || o.created_at || new Date().toISOString()
      const amount = Number(o.total_amount || o.sum || 0)
      const brandName = o.brand_name || o.brand || 'Roll Master'
      const restName = o.restaurant_name || city
      const orderNum = String(o.order_number || meta.orderNumber || '').replace(/^#+/, '').trim()
      const orderId = String(o.order_id || o.id || `${orderNum}_${placedAt.slice(0, 10)}`)
      const baseOrderUuid = orderId.includes('_') && orderId.length > 30 ? orderId.split('_')[0] : orderId

      const structuredItems = (o.items || [])
        .map(it => {
          const pName = it.product_name || it.name || ''
          if (!pName) return null
          const qty = Number(it.quantity || it.amount || 1)
          const price = Number(it.price || it.sum || 0)
          const sum = Number(it.sum || it.totalPrice || (qty * price) || 0)
          return {
            product_name: pName,
            name: pName,
            quantity: qty,
            price: Math.round(price * 100) / 100,
            sum: Math.round(sum * 100) / 100
          }
        })
        .filter(Boolean)

      const itemsList = structuredItems
        .map(it => `${it.quantity}x ${it.product_name}`)
        .slice(0, 6)

      const orderTimings = o.timings || meta.timings || null
      const orderCourier = o.courier || meta.courier || null

      if (!record) {
        record = {
          id,
          key,
          name: !isGenericCustomerName(rawName) ? rawName : (rawPhone || 'Client Livrare'),
          phone: rawPhone || '',
          is_direct_phone: Boolean(rawPhone && !isAggregatorProxyPhone(rawPhone)),
          city,
          address: rawAddress || '',
          addresses: rawAddress ? [rawAddress] : [],
          brands: brandName ? [brandName] : [],
          restaurants: restName ? [restName] : [],
          platforms: plat ? [plat] : [],
          orders_count: 0,
          total_spent: 0,
          avg_order_value: 0,
          first_order_at: placedAt,
          last_order_at: placedAt,
          notes: '',
          is_vip: false,
          avatar_url: null,
          reviews: [],
          reviews_count: 0,
          avg_rating: null,
          has_negative_review: false,
          recent_orders: []
        }
        this.customersByKey.set(key, record)
        this.customersById.set(id, record)
      } else {
        if (!isGenericCustomerName(rawName) && (isGenericCustomerName(record.name) || rawName.length > record.name.length)) {
          record.name = rawName
        }
        if (rawPhone && (!record.phone || (!isAggregatorProxyPhone(rawPhone) && isAggregatorProxyPhone(record.phone)))) {
          record.phone = rawPhone
          record.is_direct_phone = !isAggregatorProxyPhone(rawPhone)
        }
        if (rawAddress && (!record.address || rawAddress.length > record.address.length)) {
          record.address = rawAddress
        }
        if (rawAddress && !record.addresses.includes(rawAddress) && record.addresses.length < 5) {
          record.addresses.push(rawAddress)
        }
        if (brandName && !record.brands.includes(brandName)) {
          record.brands.push(brandName)
        }
        if (restName && !record.restaurants.includes(restName) && record.restaurants.length < 8) {
          record.restaurants.push(restName)
        }
        if (plat && !record.platforms.includes(plat)) {
          record.platforms.push(plat)
        }
      }

      // Deduplicare comandă în istoricul clientului
      const existingOrderObj = (record.recent_orders || []).find(ro => {
        if (ro.base_uuid && baseOrderUuid && ro.base_uuid === baseOrderUuid) return true
        if (orderNum && ro.order_number === orderNum && String(ro.placed_at || '').slice(0, 10) === String(placedAt).slice(0, 10)) {
          return true
        }
        return false
      })

      if (existingOrderObj) {
        if ((!existingOrderObj.items || existingOrderObj.items.length === 0) && structuredItems.length > 0) {
          existingOrderObj.items = structuredItems
          this.dirty = true
        }
        if (!existingOrderObj.timings && orderTimings) {
          existingOrderObj.timings = orderTimings
          this.dirty = true
        }
        if (!existingOrderObj.courier && orderCourier) {
          existingOrderObj.courier = orderCourier
          this.dirty = true
        }
        if (!existingOrderObj.order_id && orderId) {
          existingOrderObj.order_id = orderId
          this.dirty = true
        }
      } else {
        record.orders_count = (record.orders_count || 0) + 1
        record.total_spent = Math.round(((record.total_spent || 0) + amount) * 100) / 100
        record.avg_order_value = record.orders_count > 0
          ? Math.round((record.total_spent / record.orders_count) * 100) / 100
          : amount

        if (!record.first_order_at || new Date(placedAt) < new Date(record.first_order_at)) {
          record.first_order_at = placedAt
        }
        if (!record.last_order_at || new Date(placedAt) > new Date(record.last_order_at)) {
          record.last_order_at = placedAt
        }

        record.is_vip = Boolean(record.is_vip || record.orders_count >= 3 || record.total_spent >= 300)

        record.recent_orders = [
          {
            base_uuid: baseOrderUuid,
            order_id: orderId,
            order_number: orderNum || '—',
            placed_at: placedAt,
            total_amount: Math.round(amount * 100) / 100,
            platform: plat || 'delivery',
            brand_name: brandName,
            restaurant_name: restName,
            city,
            address: rawAddress || record.address || '',
            items_summary: itemsList.join(', '),
            items: structuredItems,
            timings: orderTimings,
            courier: orderCourier
          },
          ...(record.recent_orders || [])
        ]
          .sort((a, b) => new Date(b.placed_at || 0) - new Date(a.placed_at || 0))
          .slice(0, 15)

        this.dirty = true
        touchedCount++
      }
    }

    if (this.dirty) {
      this.saveToDisk(false)
    }
    return touchedCount
  }

  updateCustomer(id, patch = {}) {
    const rec = this.customersById.get(id)
    if (!rec) return null
    if (patch.name !== undefined && String(patch.name).trim()) rec.name = String(patch.name).trim()
    if (patch.phone !== undefined) {
      rec.phone = normalizePhone(patch.phone) || String(patch.phone).trim()
      rec.is_direct_phone = Boolean(rec.phone && !isAggregatorProxyPhone(rec.phone))
    }
    if (patch.address !== undefined) rec.address = String(patch.address).trim()
    if (patch.city !== undefined && String(patch.city).trim()) rec.city = normalizeCanonicalCity(patch.city)
    if (patch.notes !== undefined) rec.notes = String(patch.notes).trim()
    if (patch.is_vip !== undefined) rec.is_vip = Boolean(patch.is_vip)

    this.dirty = true
    this.saveToDisk(true)
    return rec
  }

  queryCustomers({
    city = 'all',
    brand = 'all',
    platform = 'all',
    segment = 'all',
    search = '',
    sort = 'last_order',
    sort_dir = 'desc',
    page = 1,
    limit = 25
  } = {}) {
    const all = Array.from(this.customersByKey.values())

    // Calculăm filtrele globale & KPI pe setul selectat de oraș/brand/platformă
    const baseFiltered = all.filter(c => {
      if (city && city !== 'all' && String(c.city || '').toUpperCase() !== String(city).toUpperCase()) {
        return false
      }
      if (brand && brand !== 'all' && !(c.brands || []).some(b => b.toLowerCase() === brand.toLowerCase())) {
        return false
      }
      if (platform && platform !== 'all' && !(c.platforms || []).some(p => p.toLowerCase().includes(platform.toLowerCase()))) {
        return false
      }
      return true
    })

    const kpis = {
      total_customers: baseFiltered.length,
      repeat_customers: baseFiltered.filter(c => (c.orders_count || 0) >= 2).length,
      vip_customers: baseFiltered.filter(c => c.is_vip || (c.orders_count || 0) >= 3 || (c.total_spent || 0) >= 300).length,
      with_phone_count: baseFiltered.filter(c => Boolean(c.phone)).length,
      direct_phone_count: baseFiltered.filter(c => Boolean(c.is_direct_phone)).length,
      with_address_count: baseFiltered.filter(c => Boolean(c.address)).length,
      with_reviews_count: baseFiltered.filter(c => (c.reviews_count || (c.reviews || []).length) > 0).length,
      total_revenue: Math.round(baseFiltered.reduce((acc, c) => acc + Number(c.total_spent || 0), 0) * 100) / 100,
      total_orders: baseFiltered.reduce((acc, c) => acc + Number(c.orders_count || 0), 0)
    }
    kpis.avg_order_value = kpis.total_orders > 0
      ? Math.round((kpis.total_revenue / kpis.total_orders) * 100) / 100
      : 0

    const q = String(search || '').toLowerCase().trim()
    const filtered = baseFiltered.filter(c => {
      if (segment === 'repeat' && (c.orders_count || 0) < 2) return false
      if (segment === 'vip' && !(c.is_vip || (c.orders_count || 0) >= 3 || (c.total_spent || 0) >= 300)) return false
      if (segment === 'direct_phone' && !c.is_direct_phone) return false
      if (segment === 'with_address' && !c.address) return false
      if (segment === 'with_reviews' && (c.reviews_count || (c.reviews || []).length) === 0) return false

      if (q) {
        const matchName = String(c.name || '').toLowerCase().includes(q)
        const matchPhone = String(c.phone || '').toLowerCase().includes(q)
        const matchAddr = String(c.address || '').toLowerCase().includes(q)
        const matchCity = String(c.city || '').toLowerCase().includes(q)
        const matchOrder = (c.recent_orders || []).some(ro => String(ro.order_number || '').toLowerCase().includes(q))
        const matchReview = (c.reviews || []).some(rv => String(rv.comment || '').toLowerCase().includes(q))
        if (!matchName && !matchPhone && !matchAddr && !matchCity && !matchOrder && !matchReview) return false
      }
      return true
    })

    const dir = String(sort_dir || 'desc').toLowerCase() === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      if (sort === 'total_spent') return ((a.total_spent || 0) - (b.total_spent || 0)) * dir
      if (sort === 'orders_count') return ((a.orders_count || 0) - (b.orders_count || 0)) * dir
      if (sort === 'reviews_count') return ((a.reviews_count || (a.reviews || []).length) - (b.reviews_count || (b.reviews || []).length)) * dir
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'ro') * dir
      if (sort === 'city') return String(a.city || '').localeCompare(String(b.city || ''), 'ro') * dir
      if (sort === 'phone') return String(a.phone || '').localeCompare(String(b.phone || ''), 'ro') * dir
      return (new Date(a.last_order_at || 0) - new Date(b.last_order_at || 0)) * dir
    })

    const filteredTotalRevenue = Math.round(filtered.reduce((acc, c) => acc + Number(c.total_spent || 0), 0) * 100) / 100
    const filteredTotalOrders = filtered.reduce((acc, c) => acc + Number(c.orders_count || 0), 0)
    const filteredTotalReviews = filtered.reduce((acc, c) => acc + Number(c.reviews_count || (c.reviews || []).length || 0), 0)

    const citiesSet = new Set()
    const brandsSet = new Set()
    const platformsSet = new Set()
    all.forEach(c => {
      if (c.city) citiesSet.add(c.city)
      ;(c.brands || []).forEach(b => { if (b) brandsSet.add(b) })
      ;(c.platforms || []).forEach(p => { if (p) platformsSet.add(p) })
    })

    const safePage = Math.max(1, parseInt(page, 10) || 1)
    const safeLimit = Math.max(10, Math.min(9999, parseInt(limit, 10) || 25))
    const startIdx = (safePage - 1) * safeLimit
    const items = filtered.slice(startIdx, startIdx + safeLimit)

    return {
      kpis,
      total_filtered: filtered.length,
      filtered_total_revenue: filteredTotalRevenue,
      filtered_total_orders: filteredTotalOrders,
      filtered_total_reviews: filteredTotalReviews,
      page: safePage,
      limit: safeLimit,
      total_pages: Math.max(1, Math.ceil(filtered.length / safeLimit)),
      cities: Array.from(citiesSet).sort(),
      brands: Array.from(brandsSet).sort(),
      platforms: Array.from(platformsSet).sort(),
      customers: items
    }
  }
}

export const customersService = new CustomersService()
export default customersService
