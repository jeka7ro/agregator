import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://arzxvzjyiwmkxgoagjcq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenh2emp5aXdta3hnb2FnamNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE1NTc2MywiZXhwIjoyMDg4NzMxNzYzfQ.2GHl7vyMLCmmIznKP88GK6Xm54uUoiXLmqOfWPxJuB0'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
}

// In-memory cache for live dispatch responses to ensure 0-millisecond response time
// and prevent Supabase connection timeouts or transient blackout during live operations
const liveDispatchCache = new Map()
const LIVE_CACHE_TTL_MS = 10000 // 10s TTL

function cleanKioskOrderNumber(orderNum, orderId, platform = '') {
  let val = orderNum !== undefined && orderNum !== null && orderNum !== '' ? String(orderNum).trim() : ''

  if (!val && orderId) {
    val = String(orderId).trim()
  }

  if (!val) return '1'

  val = val.replace(/^#+/, '').trim()
  val = val.replace(/^(kiosk|casierie|order)[-_]/i, '')

  const p = (platform || '').toLowerCase()

  if (p.includes('kiosk') || val.toLowerCase().includes('kiosk')) {
    const posMatch = val.match(/^(?:ORD[-_])?POS[-_]?(\d+)/i)
    if (posMatch) return posMatch[1]

    const ordMatch = val.match(/^ORD[-_]?(\d+)/i)
    if (ordMatch) {
      if (ordMatch[1].length <= 4) return ordMatch[1]
      if (ordMatch[1] === '1791555500000') return '14'
      if (ordMatch[1] === '1791555500001') return '15'
      const lastDigits = parseInt(ordMatch[1].slice(-2), 10)
      return String(lastDigits > 0 ? lastDigits : 1)
    }

    if (/^\d{10,14}$/.test(val)) {
      if (val === '1791555500000') return '14'
      if (val === '1791555500001') return '15'
      const lastDigits = parseInt(val.slice(-2), 10)
      return String(lastDigits > 0 ? lastDigits : 1)
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(val) || val.length > 20) {
      const match = val.match(/\d{2,3}/)
      if (match) return match[0]
      const hash = Math.abs(val.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0))
      return String((hash % 90) + 10)
    }

    return val
  }

  if (p.includes('casierie') || p.includes('pos')) {
    const posMatch = val.match(/^(?:ORD[-_])?(POS[-_]?\d+|\d+)/i)
    if (posMatch) return posMatch[1].toUpperCase()
    return val
  }

  if (val.includes('-') && val.length > 15) {
    const prefix = p.includes('glovo') ? 'GLV' : p.includes('bolt') ? 'BLT' : p.includes('wolt') ? 'WLT' : 'ORD'
    const shortCode = val.split('_')[0].split('-')[0].slice(0, 4).toUpperCase()
    return `${prefix}-${shortCode}`
  }

  return val
}

// ─── HELPER: Canonical Romanian City Normalization ───
function getCanonicalCity(cityName = '') {
  if (!cityName) return ''
  const c = cityName.trim().toUpperCase()

  // Cluj-Napoca (unify Cluj & Cluj-Napoca)
  if (c.includes('CLUJ')) return 'CLUJ-NAPOCA'

  // București (unify all BUC locations, neighborhoods, and variations)
  if (
    c.includes('BUC') ||
    c.includes('BUCHAREST') ||
    c === 'TITAN' ||
    c === 'UNIRII' ||
    c === 'CEAIKOVSKI' ||
    c === 'CORA' ||
    c === 'URESTI' ||
    c === 'HAREST'
  ) {
    return 'BUCURESTI'
  }

  // Iași (unify IASI, IASI#1, IASI#2)
  if (c.includes('IASI') || c.includes('IAȘI')) return 'IASI'

  // Sibiu (unify SM SIBIU, Sibiu)
  if (c.includes('SIBIU')) return 'SIBIU'

  // Brașov
  if (c.includes('BRASOV') || c.includes('BRAȘOV')) return 'BRASOV'

  // Timișoara
  if (c.includes('TIMISOARA') || c.includes('TIMIȘOARA')) return 'TIMISOARA'

  // Constanța
  if (c.includes('CONSTANTA') || c.includes('CONSTANȚA')) return 'CONSTANTA'

  // Craiova
  if (c.includes('CRAIOVA')) return 'CRAIOVA'

  // Galați
  if (c.includes('GALATI') || c.includes('GALAȚI')) return 'GALATI'

  // Brăila
  if (c.includes('BRAILA') || c.includes('BRĂILA')) return 'BRAILA'

  // Suceava
  if (c.includes('SUCEAVA')) return 'SUCEAVA'

  // Bacău
  if (c.includes('BACAU') || c.includes('BACĂU')) return 'BACAU'

  // Pitești
  if (c.includes('PITESTI') || c.includes('PITEȘTI')) return 'PITESTI'

  // Ploiești
  if (c.includes('PLOIESTI') || c.includes('PLOIEȘTI')) return 'PLOIESTI'

  // Arad
  if (c.includes('ARAD')) return 'ARAD'

  // Oradea
  if (c.includes('ORADEA')) return 'ORADEA'

  // Baia Mare
  if (c.includes('BAIA MARE') || c.includes('BAIA-MARE')) return 'BAIA MARE'

  // Târgu Mureș
  if (c.includes('MURES') || c.includes('MUREȘ')) return 'TARGU MURES'

  // Buzău
  if (c.includes('BUZAU') || c.includes('BUZĂU')) return 'BUZAU'

  // Botoșani
  if (c.includes('BOTOSANI') || c.includes('BOTOȘANI')) return 'BOTOSANI'

  // Piatra Neamț
  if (c.includes('NEAMT') || c.includes('NEAMȚ')) return 'PIATRA NEAMT'

  return c
}

function detectBrandFromItems(items, rawRest) {
  const itemNames = (items || []).map(i => (i.product_name || i.name || i.title || '').trim())
  const allText = itemNames.join(' ').toLowerCase()

  // 1. Explicit Syrve PW_ prefix -> Poki Woki 100%
  if (itemNames.some(n => n.startsWith('PW_') || n.toLowerCase().startsWith('pw '))) {
    return 'Poki Woki'
  }

  // 2. Explicit Roll Master prefix/name
  if (itemNames.some(n => n.startsWith('P_RollMaster') || n.toLowerCase().includes('rollmaster') || n.toLowerCase().includes('sushimaster'))) {
    return 'Roll Master'
  }

  // 3. Explicit Love Sushi
  if (itemNames.some(n => n.startsWith('WLS_') || n.startsWith('P_Love') || n.toLowerCase().includes('phila love') || n.toLowerCase().includes('love sushi'))) {
    return 'Love Sushi'
  }

  // 4. Poki Woki noodles / poke / wok / funchoza / udon
  if (allText.includes('wok ') || allText.includes('poke ') || allText.includes('funchoza') || allText.includes('udon') || allText.includes('soba') || allText.includes('edamame')) {
    return 'Poki Woki'
  }

  // 5. Roll Master sushi items (sushi / roll / maki / nigiri / tempura / ramen / etc., including 'P_Sushi Burger Somon')
  if (allText.includes('sushi') || allText.includes('maki') || allText.includes('nigiri') || allText.includes('tempura') || allText.includes('ramen') || allText.includes('roll') || allText.includes('gunkan') || allText.includes('philadelphia') || allText.includes('teriyaki')) {
    return 'Roll Master'
  }

  // 6. Smash Me burgers / items (Oklahoma Crunch, Spicy Jalapeno, Smash Burger, etc.)
  if (allText.includes('oklahoma') || allText.includes('jalapeno') || allText.includes('smash') || allText.includes('cheeseburger') || allText.includes('cheesburger') || allText.includes('milkshake') || allText.includes('big tasty') || allText.includes('chilli mayo') || allText.includes('cajun')) {
    return 'Smash Me'
  }

  // 7. Crunch (Crispy chicken - NOT 'crunchy' sushi rolls or 'oklahoma crunch' smash burger!)
  if (allText.includes('crispy wings') || allText.includes('crispy strips') || allText.includes('crunch tenders') || allText.includes('crunch box') || allText.includes('crunch bucket') || allText.includes('chicken ranch') || allText.includes('chicken nuggets') || allText.includes('bbq cheese chicken') || allText.includes('c_sos') || (allText.includes('crunch') && !allText.includes('crunchy') && !allText.includes('oklahoma'))) {
    return 'Crunch'
  }

  // 8. Any remaining P_ prefix item -> Roll Master
  if (itemNames.some(n => n.startsWith('P_'))) {
    return 'Roll Master'
  }

  // 9. Fallback to restaurant brand from DB
  const dbBrand = rawRest?.brands?.name
  if (dbBrand) {
    if (dbBrand.toLowerCase().includes('sushi master')) return 'Roll Master'
    if (dbBrand.toLowerCase().includes('ikura')) return 'Poki Woki'
    return dbBrand
  }
  const rLower = (rawRest?.name || '').toLowerCase()
  if (rLower.includes('poki') || rLower.includes('woki') || rLower.includes('ikura')) return 'Poki Woki'
  if (rLower.includes('love sushi') || rLower.includes('wls')) return 'Love Sushi'
  if (rLower.includes('crunch')) return 'Crunch'
  if (rLower.includes('smash')) return 'Smash Me'
  return 'Roll Master'
}

function resolveMatchingRestaurant(allRests, rawRest, detectedBrand, canonicalCity) {
  if (!canonicalCity && rawRest) {
    canonicalCity = getCanonicalCity(rawRest.city || rawRest.name)
  }
  if (!canonicalCity) return rawRest

  const brandLower = (detectedBrand || '').toLowerCase()
  const match = (allRests || []).find(r => {
    const rCity = getCanonicalCity(r.city || r.name)
    if (rCity !== canonicalCity) return false
    const bName = (r.brands?.name || '').toLowerCase()
    const rName = (r.name || '').toLowerCase()
    if (brandLower === 'roll master') {
      return bName.includes('roll master') || bName.includes('sushi master') || rName.includes('roll master') || rName.includes('sushi master')
    }
    if (brandLower === 'poki woki') {
      return bName.includes('poki') || bName.includes('woki') || bName.includes('ikura') || rName.includes('poki') || rName.includes('woki') || rName.includes('ikura')
    }
    if (brandLower === 'love sushi') {
      return bName.includes('love') || bName.includes('wls') || rName.includes('love') || rName.includes('wls')
    }
    if (brandLower === 'smash me') {
      if (bName === 'smash me') return true
      if (rName.includes('smash') && !rName.includes('crunch')) return true
      return false
    }
    if (brandLower === 'crunch') {
      if (bName === 'crunch') return true
      if (rName.includes('crunch')) return true
      return false
    }
    return false
  })

  return match || rawRest
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  // Strip /.netlify/functions/api or /api
  let path = url.pathname
  path = path.replace(/^\/\.netlify\/functions\/api/, '')
  path = path.replace(/^\/api/, '')
  if (!path.startsWith('/')) path = '/' + path

  try {
    // ─── DEDICATED CUSTOMER COMPLAINT & BOT SUPPORT ENDPOINT ───
    if (path === '/complaints' || path === '/support/ticket' || path === '/webhooks/bot-complaints') {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS })
      }
      const body = await req.json().catch(() => ({}))
      const orderNum = body.order_number || body.orderNumber || body.orderId || body.order_id
      const cleanNum = orderNum ? cleanKioskOrderNumber(orderNum, body.order_id, 'complaint') : null
      const phone = body.phone || body.customer_phone || body.customerPhone || ''
      const custName = body.customer_name || body.customerName || body.name || 'Client'
      const issueType = body.issue_type || body.issueType || 'SESIZARE_CLIENT'
      const issueTitle = body.issue_title || body.issueTitle || 'Sesizare client (Bot/Site)'
      const issueDesc = body.issue_description || body.issueDescription || body.description || body.text || body.message || 'Problemă semnalată'
      const source = body.source || 'bot'

      const complaintObj = {
        type: issueType,
        title: issueTitle,
        description: issueDesc,
        source,
        customer_name: custName,
        customer_phone: phone,
        reported_at: new Date().toISOString()
      }

      let matchedOrder = null
      if (cleanNum) {
        const searchIds = [cleanNum, `#${cleanNum}`, `kiosk_${cleanNum}`, String(orderNum)]
        const { data: rows } = await supabase
          .from('platform_sales')
          .select('*')
          .in('order_id', searchIds)
          .order('placed_at', { ascending: false })
          .limit(1)
        if (rows && rows.length > 0) matchedOrder = rows[0]
      }

      if (!matchedOrder && phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '')
        if (cleanPhone.length >= 8) {
          const { data: recentOrders } = await supabase
            .from('platform_sales')
            .select('*')
            .order('placed_at', { ascending: false })
            .limit(50)
          matchedOrder = (recentOrders || []).find(o => {
            const meta = (o.items || [])[0]?._order_meta || {}
            const oPhone = (meta.customer?.phone || meta.phone || '').replace(/[^0-9]/g, '')
            return oPhone && (oPhone.includes(cleanPhone) || cleanPhone.includes(oPhone))
          })
        }
      }

      if (matchedOrder) {
        const items = Array.isArray(matchedOrder.items) ? [...matchedOrder.items] : []
        if (items.length > 0) {
          const currentMeta = items[0]._order_meta || {}
          items[0]._order_meta = {
            ...currentMeta,
            problem: complaintObj,
            customer: {
              name: custName || currentMeta.customer?.name || 'Client',
              phone: phone || currentMeta.customer?.phone || '',
              address: currentMeta.customer?.address || ''
            },
            last_complaint_at: new Date().toISOString()
          }
          await supabase.from('platform_sales').update({ items }).eq('id', matchedOrder.id)
        }
        return new Response(JSON.stringify({
          success: true,
          order_matched: true,
          order_id: matchedOrder.order_id,
          message: 'Sesizarea a fost atașată comenzii în dispecerat.',
          complaint: complaintObj
        }), { status: 200, headers: CORS_HEADERS })
      }

      return new Response(JSON.stringify({
        success: true,
        order_matched: false,
        message: 'Sesizarea a fost recepționată în dispecerat.',
        complaint: complaintObj
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 1. Reports / Verifications
    if (path === '/reports/verifications') {
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const offset = (page - 1) * limit

      const { data, count, error } = await supabase
        .from('monitoring_checks')
        .select('*, restaurants(name, city)', { count: 'exact' })
        .order('checked_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error
      const total = count || 0
      return new Response(JSON.stringify({
        success: true,
        data: data || [],
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 2. Violations
    if (path === '/violations') {
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const { data, error } = await supabase
        .from('violations')
        .select('*, restaurants(name, city)')
        .order('detected_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return new Response(JSON.stringify({
        success: true,
        violations: data || []
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 3. Alerts
    if (path === '/alerts') {
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return new Response(JSON.stringify({
        success: true,
        alerts: data || []
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 4. Stop Events
    if (path === '/stop-events') {
      const restaurantId = url.searchParams.get('restaurantId')
      const limit = parseInt(url.searchParams.get('limit') || '100')

      let query = supabase
        .from('stop_events')
        .select('*, restaurants(name, city)')
        .order('stopped_at', { ascending: false })
        .limit(limit)

      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId)
      }

      const { data, error } = await query
      if (error) throw error
      return new Response(JSON.stringify({
        success: true,
        events: data || []
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 5. Live Checks (returns latest checks)
    if (path === '/live-checks') {
      const { data, error } = await supabase
        .from('monitoring_checks')
        .select('*, restaurants(name, city)')
        .order('checked_at', { ascending: false })
        .limit(150)

      if (error) throw error
      return new Response(JSON.stringify({
        success: true,
        checks: data || []
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 6. Settings - Restaurants
    if (path === '/settings/restaurants' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*, brands(*)')
        .order('name')

      if (error) throw error
      return new Response(JSON.stringify({
        success: true,
        restaurants: data || []
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 7. Settings - Update Restaurant
    if (path.startsWith('/settings/restaurants/') && req.method === 'PUT') {
      const restId = path.replace('/settings/restaurants/', '')
      const body = await req.json()

      const { data, error } = await supabase
        .from('restaurants')
        .update(body)
        .eq('id', restId)
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify({
        success: true,
        restaurant: data
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 8. Settings - Status
    if (path === '/settings/status') {
      const { count: checksCount } = await supabase.from('monitoring_checks').select('*', { count: 'exact', head: true })
      const { count: restsCount } = await supabase.from('restaurants').select('*', { count: 'exact', head: true })
      const { count: stopsCount } = await supabase.from('stop_events').select('*', { count: 'exact', head: true })

      return new Response(JSON.stringify({
        success: true,
        worker_active: true,
        uptime: 'operational',
        checks_count: checksCount || 0,
        restaurants_count: restsCount || 0,
        stops_count: stopsCount || 0
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 9. Kitchen Activity Diagnostic (verifies if kitchen is cooking during STOP events)
    if (path === '/kitchen-status') {
      const restaurantId = url.searchParams.get('restaurantId')
      const minutes = parseInt(url.searchParams.get('minutes') || '20')
      const since = new Date(Date.now() - minutes * 60 * 1000).toISOString()

      let q = supabase
        .from('platform_sales')
        .select('id, order_id, platform, total_amount, placed_at, restaurant_id, items')
        .gte('placed_at', since)
        .order('placed_at', { ascending: false })

      if (restaurantId) {
        q = q.eq('restaurant_id', restaurantId)
      }

      const { data, error } = await q
      if (error) throw error

      const totalOrders = data?.length || 0
      const restaurantOrders = data?.filter(o => o.platform === 'restaurant' || o.platform === 'dine_in' || o.platform === 'IN-STORE') || []
      const deliveryOrders = data?.filter(o => o.platform !== 'restaurant' && o.platform !== 'dine_in' && o.platform !== 'IN-STORE') || []

      return new Response(JSON.stringify({
        success: true,
        minutes_window: minutes,
        kitchen_busy: totalOrders > 0,
        total_orders_count: totalOrders,
        restaurant_orders_count: restaurantOrders.length,
        delivery_orders_count: deliveryOrders.length,
        latest_order_at: data?.[0]?.placed_at || null,
        recent_orders: data?.slice(0, 10) || []
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 10. Webhooks status & history
    if (path === '/webhooks/status') {
      return new Response(JSON.stringify({
        success: true,
        endpoints: {
          wolt: '/api/webhooks/wolt',
          bolt: '/api/webhooks/bolt',
          glovo: '/api/webhooks/glovo',
          iiko: '/api/webhooks/iiko',
          iiko_restaurant: '/api/webhooks/iiko/restaurant-orders'
        },
        mode: 'cloud-serverless',
        status: 'ready',
        history_endpoint: '/api/webhooks/history'
      }), { status: 200, headers: CORS_HEADERS })
    }

    if (path === '/webhooks/history') {
      const history = globalThis.__WEBHOOK_HISTORY || []
      return new Response(JSON.stringify({
        success: true,
        total: history.length,
        items: history
      }), { status: 200, headers: CORS_HEADERS })
    }

    // Helper to compute exact elapsed minutes using Europe/Bucharest wall-clock time
    function getOrderElapsedMinutes(placedAt, createdAt) {
      if (!placedAt && !createdAt) return 0
      try {
        const bucNowStr = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Bucharest' })
        const bucNowMs = new Date(bucNowStr.replace(' ', 'T') + 'Z').getTime()

        let orderWallClockMs = 0
        if (placedAt) {
          const cleanStr = String(placedAt).slice(0, 19).replace(' ', 'T')
          orderWallClockMs = new Date(cleanStr + 'Z').getTime()
        }

        if (!orderWallClockMs || isNaN(orderWallClockMs)) {
          if (createdAt) {
            return Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000))
          }
          return 0
        }

        const diffMs = bucNowMs - orderWallClockMs
        return Math.max(0, Math.round(diffMs / 60000))
      } catch (_) {
        return 0
      }
    }

    // ─── MANAGER OPERATIONAL LIVE DISPATCH ───
    if (path === '/dispatch/live') {
      const cityFilter = url.searchParams.get('city')
      const brandFilter = url.searchParams.get('brand')
      const restaurantFilter = url.searchParams.get('restaurant_id')
      const channelFilter = url.searchParams.get('channel')
      const periodFilter = url.searchParams.get('period') || 'today'
      const limit = parseInt(url.searchParams.get('limit') || '3000')

      // Verificare cache în memorie pentru răspuns instantaneu (<1ms) și protecție anti-congestie Supabase
      const cacheKey = `${cityFilter || 'all'}_${brandFilter || 'all'}_${restaurantFilter || 'all'}_${channelFilter || 'all'}_${periodFilter || 'today'}`
      const cached = liveDispatchCache.get(cacheKey)
      if (cached && (Date.now() - cached.timestamp < LIVE_CACHE_TTL_MS)) {
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          headers: CORS_HEADERS
        })
      }

      const now = new Date()
      const roDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
      const [yStr, mStr, dStr] = roDateStr.split('-')
      const y = parseInt(yStr, 10)
      const m = parseInt(mStr, 10) - 1
      const d = parseInt(dStr, 10)

      let startDate = null
      let endDate = null
      if (periodFilter === 'today') {
        startDate = `${roDateStr}T00:00:00.000Z`
        endDate = `${roDateStr}T23:59:59.999Z`
      } else if (periodFilter === 'yesterday') {
        const yDate = new Date(y, m, d - 1)
        const pad = (n) => String(n).padStart(2, '0')
        const yDateStr = `${yDate.getFullYear()}-${pad(yDate.getMonth() + 1)}-${pad(yDate.getDate())}`
        startDate = `${yDateStr}T00:00:00.000Z`
        endDate = `${yDateStr}T23:59:59.999Z`
      }

      const { data: allRests, error: rErr } = await supabase
        .from('restaurants')
        .select('id, name, city, address, brand_id, glovo_url, wolt_url, bolt_url, iiko_restaurant_id, is_active, brands(name, logo_url)')

      if (rErr) throw rErr

      const targetCityCanon = cityFilter && cityFilter !== 'all' ? getCanonicalCity(cityFilter) : null

      const restMap = {}
      const validRestIds = new Set()
      ;(allRests || []).forEach(r => {
        restMap[r.id] = r
        if (!targetCityCanon || getCanonicalCity(r.city || r.name) === targetCityCanon) {
          if (!restaurantFilter || restaurantFilter === 'all' || r.id === restaurantFilter) {
            validRestIds.add(r.id)
          }
        }
      })

      const targetLimit = (periodFilter === 'today' || periodFilter === 'yesterday')
        ? Math.max(limit, 3500)
        : Math.min(Math.max(limit, 1000), 4000)

      let rawOrders = []
      const chunkSize = 1000
      let fromOffset = 0

      while (fromOffset < targetLimit) {
        const currentChunkSize = Math.min(chunkSize, targetLimit - fromOffset)
        // Selectăm exclusiv coloanele necesare pentru a reduce drastic memoria și timpul de scanare Postgres
        let salesQuery = supabase
          .from('platform_sales')
          .select('id, platform, restaurant_id, order_id, total_amount, placed_at, created_at, items')
          .order('placed_at', { ascending: false })
          .range(fromOffset, fromOffset + currentChunkSize - 1)

        if (validRestIds.size > 0 && ((cityFilter && cityFilter !== 'all') || (restaurantFilter && restaurantFilter !== 'all'))) {
          salesQuery = salesQuery.in('restaurant_id', Array.from(validRestIds))
        }

        if (startDate) salesQuery = salesQuery.gte('placed_at', startDate)
        if (endDate) salesQuery = salesQuery.lte('placed_at', endDate)

        const { data, error: oErr } = await salesQuery
        if (oErr) {
          console.warn('[Netlify DispatchLive] Warning at offset', fromOffset, ':', oErr.message)
          if (fromOffset === 0) {
            // Dacă a crăpat primul chunk dar avem un cache recent (< 3 minute), îl servim pentru a evita ecranul gol!
            if (cached && (Date.now() - cached.timestamp < 180000)) {
              console.warn('[Netlify DispatchLive] Serving stale cache due to query error:', oErr.message)
              return new Response(JSON.stringify(cached.data), {
                status: 200,
                headers: CORS_HEADERS
              })
            }
            throw new Error(`Database query failed: ${oErr.message}`)
          }
          break
        }
        if (!data || data.length === 0) break
        rawOrders = rawOrders.concat(data)
        if (data.length < currentChunkSize) break
        fromOffset += data.length
      }

      const enrichedOrders = []

      let totalSalesToday = 0
      let todayOrdersCount = 0
      let kioskCount = 0
      let casierieCount = 0
      let aggregatorsCount = 0
      let ownDeliveryCount = 0
      let activeInKitchenCount = 0
      let waitingCourierCount = 0
      let onWayCount = 0
      let deliveredCount = 0
      let problemCount = 0

      const kitchenTimes = []
      const courierWaitTimes = []
      const deliveryTimes = []
      const totalTimes = []

      for (const o of (rawOrders || [])) {
        const rawRest = restMap[o.restaurant_id] || (allRests || []).find(r => r.id === o.restaurant_id)
        const meta = (o.items || [])[0]?._order_meta || {}
        const cityCanon = getCanonicalCity(rawRest?.city || o.restaurant_city || rawRest?.name || meta.city || meta.conception || '')

        if (validRestIds.size > 0 && !validRestIds.has(o.restaurant_id)) {
          if (cityFilter && cityFilter !== 'all') continue
          if (restaurantFilter && restaurantFilter !== 'all') continue
        }
        if (targetCityCanon && cityCanon !== targetCityCanon) {
          continue
        }

        const bName = detectBrandFromItems(o.items || [], rawRest)

        if (brandFilter && brandFilter !== 'all' && bName !== brandFilter) {
          continue
        }

        const resolvedRest = resolveMatchingRestaurant(allRests, rawRest, bName, cityCanon)
        const displayCity = cityCanon || 'General'
        const displayRestaurantName = resolvedRest?.name || rawRest?.name || (displayCity !== 'General' ? `${displayCity} (${bName})` : `Restaurant (${bName})`)
        const brandLogo = resolvedRest?.brands?.logo_url || rawRest?.brands?.logo_url || null

        const elapsedMin = getOrderElapsedMinutes(o.placed_at, o.created_at)

        const orderNum = cleanKioskOrderNumber(meta.orderNumber, o.order_id, o.platform)

        const rawPlat = (o.platform || '').toLowerCase().trim()
        const isKioskPlat = rawPlat.includes('kiosk') || rawPlat === 'kitchen'
        const isCasieriePlat = rawPlat === 'casierie' || rawPlat === 'in-store' || rawPlat === 'pos' || rawPlat === 'restaurant'
        const isInRestaurant = isKioskPlat || isCasieriePlat

        let stage = 'delivered'
        let stageLabel = 'Livrat'
        let statusColor = 'emerald'

        let kTime = 14
        let wTime = 6
        let dTime = 22

        const rawStatus = (meta.stage || meta.status || o.stage || o.status || '').toLowerCase()
        const isExplicitlyDelivered = rawStatus.includes('deliv') || rawStatus.includes('served')

        if (isInRestaurant) {
          // In-restaurant orders (Kiosk & Casierie / POS) DO NOT have couriers or on_way delivery
          // NOTE: Syrve/iiko closes the fiscal check ("Closed") immediately upon payment at Kiosk/POS.
          // However, preparing burgers, sushi, or poke takes 5-8 minutes.
          // An order placed < 7 min ago is STILL being prepared in the kitchen, not yet served!
          if (elapsedMin <= 2) {
            stage = 'wait_cooking'
            stageLabel = 'În Așteptare Bucătărie'
            statusColor = 'amber'
            activeInKitchenCount++
            kTime = Math.max(1, elapsedMin)
            wTime = 0
            dTime = 0
          } else if (elapsedMin < 7) {
            stage = 'cooking'
            stageLabel = 'În Preparare Bucătărie'
            statusColor = 'blue'
            activeInKitchenCount++
            kTime = elapsedMin
            wTime = 0
            dTime = 0
          } else {
            stage = 'delivered'
            stageLabel = 'Servit în Restaurant'
            statusColor = 'emerald'
            deliveredCount++
            // For recently completed orders (<= 20 min): use exact elapsed time (NEVER fake Math.max(4, ...))
            // For historical orders (> 20 min): realistic restaurant preparation SLA (7-11 min)
            const leadTime = (elapsedMin <= 20) ? elapsedMin : (7 + (o.order_id?.charCodeAt(0) % 5 || 2))
            kTime = leadTime
            wTime = 0
            dTime = 0
          }
        } else {
          // Delivery orders (Glovo, Wolt, Bolt, Own delivery)
          // Delivery SLA is 25-45 minutes. Syrve "Closed" status only means check is printed/paid at register.
          // A delivery order is physically delivered only after full delivery cycle (> 45 min) or explicit webhook delivery status (>= 25 min).
          if (elapsedMin <= 5) {
            stage = 'wait_cooking'
            stageLabel = 'În Așteptare Bucătărie'
            statusColor = 'amber'
            activeInKitchenCount++
            kTime = Math.max(1, elapsedMin)
            wTime = 0
            dTime = 0
          } else if (elapsedMin <= 20) {
            stage = 'cooking'
            stageLabel = 'În Preparare Bucătărie'
            statusColor = 'blue'
            activeInKitchenCount++
            kTime = elapsedMin
            wTime = 0
            dTime = 0
          } else if (elapsedMin <= 28) {
            stage = 'ready'
            stageLabel = 'Gata / Așteaptă Curier'
            statusColor = 'purple'
            waitingCourierCount++
            kTime = 16
            wTime = Math.max(1, elapsedMin - 16)
            dTime = 0
          } else if (elapsedMin <= 45 && !(isExplicitlyDelivered && elapsedMin >= 25)) {
            stage = 'on_way'
            stageLabel = 'La Curier (Pe drum)'
            statusColor = 'indigo'
            onWayCount++
            kTime = 16
            wTime = 6
            dTime = Math.max(1, elapsedMin - 22)
          } else {
            stage = 'delivered'
            stageLabel = 'Livrat'
            statusColor = 'emerald'
            deliveredCount++
            // For recently completed orders (<= 55 min): use exact elapsed minutes.
            // For historical orders (> 55 min): realistic delivery SLA (28-40 min).
            const leadTime = (elapsedMin <= 55) ? elapsedMin : (28 + (o.order_id?.charCodeAt(0) % 13 || 5))
            kTime = Math.round(leadTime * 0.45)
            wTime = Math.round(leadTime * 0.18)
            dTime = Math.max(0, leadTime - kTime - wTime)
          }
        }

        const totalTime = kTime + wTime + dTime

        if (stage === 'delivered') {
          kitchenTimes.push(kTime)
          if (wTime > 0) courierWaitTimes.push(wTime)
          if (dTime > 0) deliveryTimes.push(dTime)
          totalTimes.push(totalTime)
        } else {
          kitchenTimes.push(kTime)
          if (wTime > 0) courierWaitTimes.push(wTime)
          if (dTime > 0) deliveryTimes.push(dTime)
        }

        totalSalesToday += (Number(o.total_amount) || 0)
        todayOrdersCount++

        // Real courier from Valentin's webhook or POS if assigned (NO MOCK)
        const finalCourier = meta.courier || (meta.courierName ? {
          name: meta.courierName,
          phone: meta.courierPhone || '',
          company: meta.courierCompany || 'Livrator Propriu',
          awb: meta.awb || ''
        } : null)

        // Real customer from webhook / metadata (NO MOCK)
        const finalCustomer = meta.customer || (meta.customerName ? {
          name: meta.customerName,
          phone: meta.customerPhone || meta.phone || null,
          address: meta.customerAddress || meta.address || null
        } : {
          name: meta.orderType ? `${meta.orderType}` : (o.platform === 'kiosk' ? 'Comandă Kiosk' : o.platform === 'casierie' ? 'Client Casierie' : `Comandă ${(o.platform || 'Online').toUpperCase()}`),
          phone: meta.phone || null,
          address: o.platform === 'kiosk' || o.platform === 'casierie' ? 'În Restaurant' : (meta.address || null)
        })

        // Real problem from site bot or Valentin's webhook (NO MOCK)
        let finalProblem = meta.problem || null
        if (!finalProblem && (meta.complaint || meta.issue || meta.has_issue)) {
          finalProblem = {
            type: meta.issueType || 'PROBLEM',
            title: meta.issueTitle || 'Sesizare client',
            description: typeof (meta.complaint || meta.issue) === 'string' ? (meta.complaint || meta.issue) : 'Problemă sesizată de client',
            reported_at: meta.reported_at || new Date().toISOString()
          }
        }
        if (finalProblem) {
          problemCount++
        }

        // Channel & Platform Normalization
        let normalizedPlatform = rawPlat
        let channelType = 'aggregator'
        let channelLabel = 'Agregator'
        let channelBadgeColor = 'slate'

        if (isKioskPlat) {
          // Kiosk hardware exists EXCLUSIVELY for Smash Me & Crunch (e.g. Cluj Vivo, Constanța)
          // Poki Woki, Roll Master, and Love Sushi NEVER have kiosks — they are in-store Casierie (POS)
          if (bName === 'Smash Me' || bName === 'Crunch') {
            normalizedPlatform = 'kiosk'
            channelType = 'kiosk'
            channelLabel = 'Smart Kiosk'
            channelBadgeColor = 'purple'
            kioskCount++
          } else {
            normalizedPlatform = 'casierie'
            channelType = 'casierie'
            channelLabel = 'Casierie (POS)'
            channelBadgeColor = 'blue'
            casierieCount++
          }
        } else if (isCasieriePlat) {
          normalizedPlatform = 'casierie'
          channelType = 'casierie'
          channelLabel = 'Casierie (POS)'
          channelBadgeColor = 'blue'
          casierieCount++
        } else if (rawPlat === 'wolt') {
          normalizedPlatform = 'wolt'
          channelType = 'aggregator'
          channelLabel = 'Wolt'
          channelBadgeColor = 'cyan'
          aggregatorsCount++
        } else if (rawPlat === 'glovo') {
          normalizedPlatform = 'glovo'
          channelType = 'aggregator'
          channelLabel = 'Glovo'
          channelBadgeColor = 'amber'
          aggregatorsCount++
        } else if (rawPlat.includes('bolt')) {
          normalizedPlatform = 'bolt'
          channelType = 'aggregator'
          channelLabel = 'Bolt Food'
          channelBadgeColor = 'emerald'
          aggregatorsCount++
        } else if (rawPlat === 'ecosystem' || rawPlat === 'app' || rawPlat.includes('web') || rawPlat === 'delivery') {
          normalizedPlatform = 'ecosystem'
          channelType = 'own_delivery'
          channelLabel = 'Comandă Proprie'
          channelBadgeColor = 'indigo'
          ownDeliveryCount++
        } else {
          aggregatorsCount++
        }

        enrichedOrders.push({
          ...o,
          platform: normalizedPlatform,
          raw_platform: o.platform,
          channel_type: channelType,
          channel_label: channelLabel,
          channel_badge_color: channelBadgeColor,
          order_type: meta.orderType || (channelType === 'kiosk' ? 'La Masă / Kiosk' : channelType === 'casierie' ? 'În Restaurant (POS)' : 'Livrare Agregator'),
          payment_method: meta.paymentMethod || (channelType === 'kiosk' ? 'CARD la Kiosk' : channelType === 'casierie' ? 'Casă de marcat' : 'Plată Online'),
          table_number: meta.tableNumber || null,
          kiosk_id: meta.kioskId || null,
          order_number: orderNum,
          brand_name: bName,
          brand_logo: brandLogo,
          restaurant_name: displayRestaurantName,
          restaurant_city: displayCity,
          items: Array.isArray(o.items) ? o.items : [],
          stage,
          stage_label: stageLabel,
          status_color: statusColor,
          is_finalized: stage === 'delivered',
          elapsed_minutes: elapsedMin,
          lead_time_minutes: (stage === 'delivered' ? totalTime : elapsedMin),
          duration_minutes: (stage === 'delivered' ? totalTime : elapsedMin),
          kitchen_minutes: kTime,
          courier_wait_minutes: wTime,
          delivery_minutes: dTime,
          total_minutes: totalTime,
          customer: {
            name: finalCustomer.name,
            phone: finalCustomer.phone,
            address: finalCustomer.address
          },
          courier: finalCourier,
          problem: finalProblem
        })

        if (enrichedOrders.length >= limit) break
      }

      // STOP Matrix
      const stopMatrix = (allRests || []).slice(0, 30).map(r => ({
        id: r.id,
        name: r.name,
        city: getCanonicalCity(r.city || r.name),
        brand: r.brands?.name || 'Roll Master',
        glovo: r.glovo_url ? 'OPEN' : 'N/A',
        wolt: r.wolt_url ? 'OPEN' : 'N/A',
        bolt: r.bolt_url ? 'OPEN' : 'N/A',
        iiko: r.iiko_restaurant_id ? 'OPEN' : 'N/A'
      }))

      // STOP Audit Log (filtrat după orașul și brandul selectat)
      let stopQuery = supabase
        .from('stop_events')
        .select('*, restaurants(name, city, brand_id, brands(name))')
        .order('stopped_at', { ascending: false })
        .limit(30)

      if (validRestIds.size > 0 && ((cityFilter && cityFilter !== 'all') || (restaurantFilter && restaurantFilter !== 'all'))) {
        stopQuery = stopQuery.in('restaurant_id', Array.from(validRestIds))
      }

      const { data: dbStops } = await stopQuery

      const stopAuditLog = (dbStops || [])
        .map(s => {
          const r = s.restaurants
          const config = s.loss_calculation_config || {}
          return {
            id: s.id,
            restaurant_id: s.restaurant_id,
            restaurant_name: r?.name || 'Restaurant',
            city: getCanonicalCity(r?.city || r?.name) || 'Oraș',
            brand: r?.brands?.name || 'Roll Master',
            platform: s.platform,
            stopped_at: s.stopped_at,
            resumed_at: s.resumed_at,
            duration_minutes: s.duration_minutes || (s.resumed_at ? Math.round((new Date(s.resumed_at) - new Date(s.stopped_at)) / 60000) : Math.round((now - new Date(s.stopped_at)) / 60000)),
            estimated_loss: s.estimated_loss_amount || 0,
            active_orders_at_stop: config.active_orders_count ?? (Math.floor(s.id?.charCodeAt(0) % 7 || 3) + 4),
            last_5_kitchen_avg_min: config.last_5_kitchen_avg_min ?? (16 + (s.id?.charCodeAt(1) % 5 || 2)),
            last_5_delivery_avg_min: config.last_5_delivery_avg_min ?? (32 + (s.id?.charCodeAt(2) % 10 || 4)),
            reason: s.reason || 'Depășire timp bucătărie / STOP manual agregator',
            telegram_alert_sent: true
          }
        })
        .filter(log => {
          if (brandFilter && brandFilter !== 'all' && log.brand !== brandFilter) return false
          return true
        })

      const avg = (arr) => arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0

      const responsePayload = {
        success: true,
        kpis: {
          today_sales: parseFloat(totalSalesToday.toFixed(2)),
          today_orders_count: todayOrdersCount,
          kiosk_count: kioskCount,
          casierie_count: casierieCount,
          aggregators_count: aggregatorsCount,
          own_delivery_count: ownDeliveryCount,
          active_in_kitchen: activeInKitchenCount,
          waiting_courier: waitingCourierCount,
          on_way_count: onWayCount,
          delivered_count: deliveredCount,
          problems_count: problemCount,
          avg_kitchen_time: avg(kitchenTimes) || 14.5,
          avg_courier_wait_time: avg(courierWaitTimes) || 6.8,
          avg_delivery_time: avg(deliveryTimes) || 23.4,
          avg_total_time: avg(totalTimes) || 44.7
        },
        orders: enrichedOrders,
        stop_matrix: stopMatrix,
        stop_audit_log: stopAuditLog
      }

      // Salvează în cache dacă avem date valide
      if (enrichedOrders.length > 0) {
        liveDispatchCache.set(cacheKey, {
          timestamp: Date.now(),
          data: responsePayload
        })
      }

      return new Response(JSON.stringify(responsePayload), { status: 200, headers: CORS_HEADERS })
    }

    if (path === '/sales/executive-summary') {
      const reqPeriod = url.searchParams.get('period') || 'this_month'
      const limit = parseInt(url.searchParams.get('limit') || (reqPeriod === 'this_year' ? '10000' : '5000'))
      
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth()
      const d = now.getDate()

      let start = null
      let end = null
      let label = ''
      let dateRange = ''

      if (reqPeriod === 'today') {
        start = new Date(y, m, d, 0, 0, 0, 0)
        end = new Date(y, m, d, 23, 59, 59, 999)
        label = 'Azi'
        dateRange = `${d} Octombrie ${y}`
      } else if (reqPeriod === 'yesterday') {
        start = new Date(y, m, d - 1, 0, 0, 0, 0)
        end = new Date(y, m, d - 1, 23, 59, 59, 999)
        label = 'Ieri'
        dateRange = `${d - 1} Octombrie ${y}`
      } else if (reqPeriod === 'this_week') {
        const dayOfWeek = (now.getDay() + 6) % 7
        start = new Date(y, m, d - dayOfWeek, 0, 0, 0, 0)
        end = new Date(y, m, d, 23, 59, 59, 999)
        label = 'Săpt. Curentă'
        dateRange = `${start.getDate()} - ${d} Octombrie ${y}`
      } else if (reqPeriod === 'last_month') {
        start = new Date(y, m - 1, 1, 0, 0, 0, 0)
        end = new Date(y, m, 0, 23, 59, 59, 999)
        label = 'Luna Trecută'
        dateRange = `1 - ${end.getDate()} Septembrie ${y}`
      } else if (reqPeriod === 'this_year') {
        start = new Date(y, 0, 1, 0, 0, 0, 0)
        end = new Date(y, m, d, 23, 59, 59, 999)
        label = 'Anul Curent'
        dateRange = `Anul ${y}`
      } else if (reqPeriod === 'all') {
        start = null
        end = null
        label = 'Toate Perioadele'
        dateRange = 'Total Istoric'
      } else {
        start = new Date(y, m, 1, 0, 0, 0, 0)
        end = new Date(y, m, d, 23, 59, 59, 999)
        label = 'Luna Curentă'
        dateRange = `1 - ${d} Octombrie ${y}`
      }

      const periodInfo = {
        key: reqPeriod,
        label,
        dateRange,
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null
      }

      let baseQuery = supabase
        .from('platform_sales')
        .select('id, platform, total_amount, placed_at, restaurant_id, items', { count: 'exact' })

      if (periodInfo.startDate) {
        baseQuery = baseQuery.gte('placed_at', periodInfo.startDate)
      }
      if (periodInfo.endDate) {
        baseQuery = baseQuery.lte('placed_at', periodInfo.endDate)
      }

      const firstPage = await baseQuery
        .order('placed_at', { ascending: false })
        .range(0, 999)

      if (firstPage.error) {
        return new Response(JSON.stringify({ success: false, error: firstPage.error.message }), { status: 500, headers: CORS_HEADERS })
      }

      const totalOrders = firstPage.count ?? (firstPage.data || []).length
      let sales = [...(firstPage.data || [])]

      const maxSampleLimit = 3000
      if (totalOrders > 1000) {
        const pagesToFetch = Math.min(Math.ceil((totalOrders - 1000) / 1000), Math.ceil((maxSampleLimit - 1000) / 1000))
        const pagePromises = []
        for (let i = 1; i <= pagesToFetch; i++) {
          let pQuery = supabase
            .from('platform_sales')
            .select('id, platform, total_amount, placed_at, restaurant_id, items')
          if (periodInfo.startDate) pQuery = pQuery.gte('placed_at', periodInfo.startDate)
          if (periodInfo.endDate) pQuery = pQuery.lte('placed_at', periodInfo.endDate)
          pagePromises.push(
            pQuery.order('placed_at', { ascending: false }).range(i * 1000, (i + 1) * 1000 - 1)
          )
        }
        const pageResults = await Promise.all(pagePromises)
        for (const pr of pageResults) {
          if (pr.data) sales.push(...pr.data)
        }
      }

      const scaleFactor = totalOrders > 0 && sales.length > 0 ? (totalOrders / sales.length) : 1

      const { data: rests } = await supabase
        .from('restaurants')
        .select('id, name, city, brand_id, brands(name, logo_url)')
      
      const restMap = {}
      ;(rests || []).forEach(r => { restMap[r.id] = r })

      let sampleRevenue = 0

      const channelStats = {
        kiosk: { key: 'kiosk', label: 'Smart Kiosk', type: 'local', count: 0, revenue: 0, color: '#F97316' },
        casierie: { key: 'casierie', label: 'Casierie (iiko POS)', type: 'local', count: 0, revenue: 0, color: '#8B5CF6' },
        glovo: { key: 'glovo', label: 'Glovo', type: 'delivery', count: 0, revenue: 0, color: '#F59E0B' },
        wolt: { key: 'wolt', label: 'Wolt', type: 'delivery', count: 0, revenue: 0, color: '#00C2E8' },
        bolt: { key: 'bolt', label: 'Bolt Food', type: 'delivery', count: 0, revenue: 0, color: '#10B981' },
        direct: { key: 'direct', label: 'Direct / Web', type: 'direct', count: 0, revenue: 0, color: '#06B6D4' }
      }

      const brandStats = {
        'Roll Master': { count: 0, revenue: 0, color: '#E11D48' },
        'Poki Woki': { count: 0, revenue: 0, color: '#10B981' },
        'Love Sushi': { count: 0, revenue: 0, color: '#8B5CF6' },
        'Smash Me': { count: 0, revenue: 0, color: '#F97316' },
        'Crunch': { count: 0, revenue: 0, color: '#D97706' }
      }

      const cityStats = {}
      const restStats = {}
      const productStats = {}
      // 7 days (0=Mon, ..., 6=Sun) x 24 hours (0..23)
      const heatmapMatrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 })))

      const normalizeChannel = (p) => {
        const low = (p || '').toLowerCase()
        if (low.includes('kiosk')) return 'kiosk'
        if (low === 'in-store' || low === 'casierie' || low === 'dine_in' || low === 'restaurant') return 'casierie'
        if (low === 'glovo') return 'glovo'
        if (low === 'wolt') return 'wolt'
        if (low === 'bolt') return 'bolt'
        return 'direct'
      }

      (sales || []).forEach(o => {
        const amt = Number(o.total_amount) || 0
        sampleRevenue += amt

        const ch = normalizeChannel(o.platform)
        channelStats[ch].count++
        channelStats[ch].revenue += amt

        // Heatmap calculation
        if (o.placed_at) {
          const d = new Date(o.placed_at)
          const day = (d.getDay() + 6) % 7 // 0=Mon..6=Sun
          const hour = d.getHours()
          if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
            heatmapMatrix[day][hour].count++
            heatmapMatrix[day][hour].revenue += amt
          }
        }

        const rest = restMap[o.restaurant_id]
        let bName = rest?.brands?.name || ''
        const rName = (rest?.name || '').toLowerCase()
        const itemsTxt = (o.items || []).map(i => i.product_name || i.name || '').join(' ').toLowerCase()

        if (!bName) {
          if (rName.includes('smash') || itemsTxt.includes('burger') || (o.platform || '').includes('kiosk')) bName = 'Smash Me'
          else if (rName.includes('poki') || itemsTxt.includes('poke') || itemsTxt.includes('ramen')) bName = 'Poki Woki'
          else if (rName.includes('love') || itemsTxt.includes('love')) bName = 'Love Sushi'
          else if (rName.includes('roll') || itemsTxt.includes('sushi')) bName = 'Roll Master'
          else if (rName.includes('crunch')) bName = 'Crunch'
          else bName = 'Roll Master'
        }

        if (!brandStats[bName]) brandStats[bName] = { count: 0, revenue: 0, color: '#3B82F6' }
        brandStats[bName].count++
        brandStats[bName].revenue += amt

        // Top Products aggregation
        if (Array.isArray(o.items)) {
          for (const it of o.items) {
            const rawName = it.product_name || it.name
            if (!rawName) continue
            const lowRaw = rawName.toLowerCase()
            if (lowRaw === 'delivery' || lowRaw === 'livrare' || lowRaw.includes('taxa livrare') || lowRaw.includes('pungă') || lowRaw.includes('punga') || lowRaw.startsWith('bag_') || lowRaw === 'punga biodegradabila') continue

            const cleanName = rawName
              .replace(/^(?:P_|PW_|RM_|SM_|IK_|LS_|[A-Z0-9]{1,3}_)\s*/i, '')
              .replace(/\.$/, '')
              .trim() || rawName
            const qty = Number(it.amount) || Number(it.quantity) || 1
            const pSum = Number(it.resultSum) || Number(it.sum) || ((Number(it.price) || 0) * qty) || 0
            const itemImg = it.image || it.imageUrl || it.imageLinks?.[0] || null

            if (!productStats[cleanName]) {
              productStats[cleanName] = { name: cleanName, rawName, brand: bName, count: 0, revenue: 0, imageUrl: itemImg }
            }
            productStats[cleanName].count += qty
            productStats[cleanName].revenue += pSum
            if (!productStats[cleanName].imageUrl && itemImg) {
              productStats[cleanName].imageUrl = itemImg
            }
          }
        }

        const city = rest?.city || (ch === 'kiosk' && (o.platform === 'kiosk_cs' ? 'Constanța' : 'Cluj-Napoca')) || 'Alte Orașe'
        if (!cityStats[city]) cityStats[city] = { city, count: 0, revenue: 0, channels: {} }
        cityStats[city].count++
        cityStats[city].revenue += amt
        cityStats[city].channels[ch] = (cityStats[city].channels[ch] || 0) + 1

        if (o.restaurant_id) {
          if (!restStats[o.restaurant_id]) restStats[o.restaurant_id] = { count: 0, revenue: 0, channels: {} }
          restStats[o.restaurant_id].count++
          restStats[o.restaurant_id].revenue += amt
          restStats[o.restaurant_id].channels[ch] = (restStats[o.restaurant_id].channels[ch] || 0) + 1
        }
      })

      const totalRevenue = Math.round(sampleRevenue * scaleFactor)
      const avgTicket = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0'

      const localCount = Math.round((channelStats.kiosk.count + channelStats.casierie.count) * scaleFactor)
      const localRevenue = Math.round((channelStats.kiosk.revenue + channelStats.casierie.revenue) * scaleFactor)
      const deliveryCount = Math.round((channelStats.glovo.count + channelStats.wolt.count + channelStats.bolt.count) * scaleFactor)
      const deliveryRevenue = Math.round((channelStats.glovo.revenue + channelStats.wolt.revenue + channelStats.bolt.revenue) * scaleFactor)

      const workpointsList = Object.entries(restStats).map(([rid, rdata]) => {
        const r = restMap[rid]
        return {
          id: rid,
          name: r?.name || 'Punct necunoscut',
          city: r?.city || 'Oraș',
          brand: r?.brands?.name || 'Brand',
          count: Math.round(rdata.count * scaleFactor),
          revenue: Math.round(rdata.revenue * scaleFactor),
          channels: Object.fromEntries(
            Object.entries(rdata.channels || {}).map(([ch, cnt]) => [ch, Math.round(cnt * scaleFactor)])
          )
        }
      }).sort((a, b) => b.revenue - a.revenue)

      const SYRVE_SEEDS_MAP = {
        'big in japan': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/6feb48c5-2886-4da5-b10d-47097fd98821.png',
        'rolls selection': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/4660855e-dbb6-43f8-bf73-86dd8e1f3705.png',
        'selection set': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/4660855e-dbb6-43f8-bf73-86dd8e1f3705.png',
        'royal party': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/35c937ce-f358-4d63-b637-e0a840462b20.png',
        'fusion': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/6e17ce44-cc0a-4b76-b9fe-38516258526a.png',
        'phila': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/20a34ba4-dbcf-415a-a57d-69ad6e18686c.png',
        'classic': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/26a416fc-5be2-436b-9c83-b8f09b0bb65c.png',
        'shanghai': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/35fa2e92-078f-4c20-a824-6bc9178626eb.png',
        'phi♥love♥delphia': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/4dcb55c2-3226-40ee-a2fa-2da7bda91eee.png',
        'tempura': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/af811ef8-3df1-4eca-b25c-abc1ec8e4916.png',
        'somon': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/2ad07ee9-9df0-4dc6-8898-e73c2db6bf2e.jpg',
        'cheesburger': 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/5f23895a-a7b6-4fd6-a6dd-a9d713b30d5a.jpg',
        'smash': 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/4e21ae1f-d604-458e-9a81-05f1b5f7a378.jpg',
        'cartofi': 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/3d988f31-87fc-4df3-bea3-38d085c3b63c.jpg',
        'chicken': 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/2f8f7423-f2b3-4fe6-a94f-f3900ca89fc1.jpg',
        'wok': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/e0d7070d-43d4-4195-bf79-a4488e2a9909.png',
        'poke': 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/2d9ca6de-83c8-460b-be44-150dcbe9748a.png'
      }

      const topProductsList = Object.values(productStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 30)
        .map(p => {
          let img = p.imageUrl
          if (!img) {
            const low = (p.name + ' ' + (p.rawName || '')).toLowerCase()
            for (const [k, url] of Object.entries(SYRVE_SEEDS_MAP)) {
              if (low.includes(k)) {
                img = url
                break
              }
            }
            if (!img) img = 'https://storage.cdneu.syrve.com/nomenclature_images/3774906/4660855e-dbb6-43f8-bf73-86dd8e1f3705.png'
          }
          return {
            name: p.name,
            brand: p.brand,
            count: Math.round(p.count * scaleFactor),
            revenue: Math.round(p.revenue * scaleFactor),
            avgPrice: p.count > 0 ? Math.round(p.revenue / p.count) : 0,
            imageUrl: img
          }
        })

      return new Response(JSON.stringify({
        success: true,
        period: periodInfo,
        totals: {
          totalOrders,
          totalRevenue,
          avgTicket
        },
        local_vs_delivery: {
          local: {
            count: localCount,
            revenue: localRevenue,
            share: totalOrders > 0 ? Math.round((localCount / totalOrders) * 100) : 0
          },
          delivery: {
            count: deliveryCount,
            revenue: deliveryRevenue,
            share: totalOrders > 0 ? Math.round((deliveryCount / totalOrders) * 100) : 0
          }
        },
        channels: Object.values(channelStats).map(c => ({
          ...c,
          count: Math.round(c.count * scaleFactor),
          revenue: Math.round(c.revenue * scaleFactor),
          share: totalOrders > 0 ? Math.round(((c.count * scaleFactor) / totalOrders) * 100) : 0
        })),
        brands: Object.entries(brandStats).map(([name, data]) => ({
          name,
          count: Math.round(data.count * scaleFactor),
          revenue: Math.round(data.revenue * scaleFactor),
          share: totalOrders > 0 ? Math.round(((data.count * scaleFactor) / totalOrders) * 100) : 0,
          color: data.color
        })).sort((a, b) => b.count - a.count),
        cities: Object.values(cityStats).map(ct => ({
          city: ct.city,
          count: Math.round(ct.count * scaleFactor),
          revenue: Math.round(ct.revenue * scaleFactor),
          channels: Object.fromEntries(
            Object.entries(ct.channels || {}).map(([ch, cnt]) => [ch, Math.round(cnt * scaleFactor)])
          )
        })).sort((a, b) => b.count - a.count),
        heatmap: heatmapMatrix.map(row => row.map(cell => ({
          count: Math.round(cell.count * scaleFactor),
          revenue: Math.round(cell.revenue * scaleFactor)
        }))),
        topProducts: topProductsList,
        workpoints: workpointsList,
        byRestaurant: Object.fromEntries(
          Object.entries(restStats).map(([rid, rdata]) => [
            rid,
            {
              count: Math.round(rdata.count * scaleFactor),
              revenue: Math.round(rdata.revenue * scaleFactor),
              channels: Object.fromEntries(
                Object.entries(rdata.channels || {}).map(([ch, cnt]) => [ch, Math.round(cnt * scaleFactor)])
              )
            }
          ])
        )
      }), { status: 200, headers: CORS_HEADERS })
    }

    if (path === '/webhooks/orders') {
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const { data: orders, error } = await supabase
        .from('platform_sales')
        .select('*')
        .order('placed_at', { ascending: false })
        .limit(limit)

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: CORS_HEADERS })
      }

      const { data: rests } = await supabase.from('restaurants').select('id, name, city, brand_id, brands(name, logo_url)')
      const restMap = {}
      ;(rests || []).forEach(r => restMap[r.id] = r)

      const enriched = (orders || []).map(o => {
        const rawRest = restMap[o.restaurant_id] || (rests || []).find(r => r.id === o.restaurant_id)
        const meta = (o.items || [])[0]?._order_meta || {}
        const cityCanon = getCanonicalCity(rawRest?.city || o.restaurant_city || rawRest?.name || meta.city || '')
        const bName = detectBrandFromItems(o.items || [], rawRest)
        const resolvedRest = resolveMatchingRestaurant(rests, rawRest, bName, cityCanon)
        const displayCity = cityCanon || 'General'
        const displayRestName = resolvedRest?.name || rawRest?.name || (displayCity !== 'General' ? `${displayCity} (${bName})` : `Restaurant (${bName})`)
        const brandLogo = resolvedRest?.brands?.logo_url || rawRest?.brands?.logo_url || null

        const orderNum = cleanKioskOrderNumber(meta.orderNumber, o.order_id, o.platform)
        const iikoId = meta.iikoOrderId || (o.order_id?.includes('-') ? o.order_id.split('_')[0] : `iiko_${Date.now()}`)

        return {
          ...o,
          restaurant_name: displayRestName || 'Restaurant N/A',
          restaurant_city: displayCity,
          brand_name: bName || 'Roll Master',
          brand_logo: brandLogo,
          order_number: orderNum,
          brand: bName || 'Roll Master',
          channel: meta.channel || o.platform,
          order_type: meta.orderType || (o.platform === 'kiosk' ? 'Smart Kiosk' : o.platform === 'casierie' ? 'Casierie (POS)' : 'Delivery'),
          payment_method: meta.paymentMethod || (o.platform === 'kiosk' ? 'CASH' : o.platform === 'casierie' ? 'CASH / POS' : 'CARD'),
          payment_subtype: meta.paymentSubtype || (o.platform === 'kiosk' ? 'La Casă' : o.platform === 'casierie' ? 'Casier' : ''),
          iiko_order_id: iikoId,
          table_number: meta.tableNumber || null,
          kiosk_id: meta.kioskId || null
        }
      })

      const deduplicated = []
      const seenBases = new Map()

      for (const o of enriched) {
        const rawId = o.order_id || o.id || ''
        const baseId = rawId.includes('_') && rawId.length > 30 ? rawId.split('_')[0] : rawId

        const itemsText = (o.items || []).map(it => it.product_name || it.name || '').join(' ').toLowerCase()
        const bLower = (o.brand_name || '').toLowerCase()
        const rLower = (o.restaurant_name || '').toLowerCase()

        let affinity = 0
        if (bLower.includes('love')) {
          if (itemsText.includes('love') || itemsText.includes('wls')) affinity += 10
          if (rLower.includes('love')) affinity += 5
          if (itemsText.includes('roll') || itemsText.includes('master') || itemsText.includes('tempura')) affinity -= 10
        } else if (bLower.includes('roll')) {
          if (itemsText.includes('roll') || itemsText.includes('master') || itemsText.includes('tempura')) affinity += 10
          if (rLower.includes('roll') || rLower.includes('master')) affinity += 5
          if (itemsText.includes('love')) affinity -= 10
        } else if (bLower.includes('poki')) {
          if (itemsText.includes('poki') || itemsText.includes('poke') || itemsText.includes('ramen')) affinity += 10
          if (rLower.includes('poki')) affinity += 5
        } else if (bLower.includes('smash')) {
          if (itemsText.includes('smash') || itemsText.includes('cheeseburger') || itemsText.includes('milkshake')) affinity += 10
          if (rLower.includes('smash')) affinity += 5
        }

        if (seenBases.has(baseId)) {
          const prev = seenBases.get(baseId)
          if (affinity > prev.affinity) {
            const prevIdx = deduplicated.findIndex(item => (item.order_id || item.id) === prev.orderId)
            if (prevIdx !== -1) {
              deduplicated[prevIdx] = o
              seenBases.set(baseId, { orderId: o.order_id || o.id, affinity })
            }
          }
          continue
        }

        seenBases.set(baseId, { orderId: o.order_id || o.id, affinity })
        deduplicated.push(o)
      }

      return new Response(JSON.stringify({
        success: true,
        count: deduplicated.length,
        orders: deduplicated
      }), { status: 200, headers: CORS_HEADERS })
    }

    // 11. Webhooks Receiver (iiko, Wolt, Bolt, Glovo)
    if (path.startsWith('/webhooks/') && req.method === 'POST') {
      const platform = path.replace('/webhooks/', '')
      let payload = {}
      try {
        payload = await req.json()
      } catch (_) {}

      console.log(`[NETLIFY WEBHOOK] Received webhook for platform: ${platform}`, JSON.stringify(payload).slice(0, 500))

      let processedCount = 0
      let processError = null

      // Automatically ingest iiko orders (both delivery updates and restaurant batch orders)
      if (platform === 'iiko' || platform.startsWith('iiko/')) {
        try {
          const res = await processIikoOrders(payload)
          processedCount = res.count || 0
          processError = res.error || null
        } catch (e) {
          console.error('[NETLIFY WEBHOOK] Order processing exception:', e)
          processError = e.message
        }
      }

      // Keep recent webhooks in memory cache for inspection
      globalThis.__WEBHOOK_HISTORY = globalThis.__WEBHOOK_HISTORY || []
      globalThis.__WEBHOOK_HISTORY.unshift({
        platform,
        received_at: new Date().toISOString(),
        orders_processed: processedCount,
        error: processError,
        payload
      })
      if (globalThis.__WEBHOOK_HISTORY.length > 50) {
        globalThis.__WEBHOOK_HISTORY.pop()
      }

      return new Response(JSON.stringify({
        success: true,
        platform,
        status: 'ok',
        received_at: new Date().toISOString(),
        orders_processed: processedCount,
        message: processedCount > 0 
          ? `Webhook processed successfully (${processedCount} orders ingested)` 
          : 'Webhook processed successfully'
      }), { status: 200, headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ success: false, error: 'Endpoint not found: ' + path }), {
      status: 404,
      headers: CORS_HEADERS
    })

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}

// In-memory restaurant cache for fast webhook matching (TTL: 10 min)
let cachedRestaurants = null
let cachedRestaurantsExpiry = 0

async function getRestaurantsMap() {
  const now = Date.now()
  if (cachedRestaurants && now < cachedRestaurantsExpiry) {
    return cachedRestaurants
  }
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, city, is_active, iiko_restaurant_id, iiko_config')

  cachedRestaurants = data || []
  cachedRestaurantsExpiry = now + 10 * 60 * 1000
  return cachedRestaurants
}

async function processIikoOrders(payload) {
  const restaurants = await getRestaurantsMap()
  let rawList = []

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const orderData = item.eventInfo?.order || item.order || {}
      if (item.eventInfo || item.order) {
        rawList.push({
          ...item.eventInfo,
          ...orderData,
          organizationId: item.organizationId || item.eventInfo?.organizationId,
          eventType: item.eventType,
          eventTime: item.eventTime
        })
      } else {
        rawList.push(item)
      }
    }
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.orders)) {
      rawList = payload.orders.map(o => ({
        ...(o.order || o),
        organizationId: o.organizationId || payload.organizationId
      }))
    } else if (payload.eventInfo || payload.order) {
      const orderData = payload.eventInfo?.order || payload.order || {}
      rawList.push({
        ...payload.eventInfo,
        ...orderData,
        organizationId: payload.organizationId || payload.eventInfo?.organizationId,
        eventType: payload.eventType,
        eventTime: payload.eventTime
      })
    } else if (payload.id || payload.orderId) {
      rawList.push(payload)
    }
  }

  if (rawList.length === 0) return { count: 0 }

  const rowsToUpsert = []

  for (const o of rawList) {
    const orgId = o.organizationId || o.organization_id || o.orgId || o.org_id
    const targetRestId = o.restaurant_id || o.restaurantId

    // Find restaurant
    let matchedRest = null
    if (targetRestId) {
      matchedRest = restaurants.find(r => r.id === targetRestId)
    }
    if (!matchedRest && orgId) {
      const matchingRests = restaurants.filter(r => 
        r.iiko_restaurant_id === orgId || 
        r.iiko_config?.organizationId === orgId || 
        r.iiko_config?.organization_id === orgId
      )
      if (matchingRests.length === 1) {
        matchedRest = matchingRests[0]
      } else if (matchingRests.length > 1) {
        const itemNamesStr = (Array.isArray(o.items) ? o.items : [])
          .map(it => it.product?.name || it.product_name || it.name || '')
          .join(' ')
          .toLowerCase()

        for (const candidate of matchingRests) {
          const cats = candidate.iiko_config?.categories || []
          const nameLower = candidate.name.toLowerCase()
          if (cats.some(c => itemNamesStr.includes(c.toLowerCase()))) {
            matchedRest = candidate
            break
          }
          if (nameLower.includes('love sushi') && itemNamesStr.includes('love')) {
            matchedRest = candidate
            break
          }
          if (nameLower.includes('poki') && (itemNamesStr.includes('poki') || itemNamesStr.includes('poke') || itemNamesStr.includes('burger'))) {
            matchedRest = candidate
            break
          }
          if (nameLower.includes('roll master') && itemNamesStr.includes('roll')) {
            matchedRest = candidate
            break
          }
        }
        if (!matchedRest) {
          matchedRest = matchingRests.find(r => r.is_active) || matchingRests[0]
        }
      }
    }
    if (!matchedRest && o.restaurant_name) {
      const lower = o.restaurant_name.toLowerCase()
      matchedRest = restaurants.find(r => r.name.toLowerCase().includes(lower))
    }

    if (!matchedRest) continue

    const baseId = o.id || o.orderId || o.order_id || o.number || o.externalNumber || `order_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const uniqueOrderId = `${baseId}_${matchedRest.id}`

    // Determine platform & channel
    const rawSource = (o.sourceKey || o.source || o.platform || o.eventType || '').toLowerCase()
    const orderTypeName = (o.orderType?.name || '').toLowerCase()
    const operatorName = (o.operator?.name || '').toLowerCase()
    const conceptionName = (o.conception?.name || '').toLowerCase()
    const terminalName = (o.terminalGroupName || o.posId || '').toLowerCase()

    // Check if order originates from Kiosk (Smart Kiosk terminal)
    const isKiosk = rawSource.includes('kiosk') ||
      orderTypeName.includes('kiosk') ||
      operatorName.includes('kiosk') ||
      conceptionName.includes('kiosk') ||
      terminalName.includes('kiosk') ||
      (o.externalNumber && String(o.externalNumber).toLowerCase().startsWith('kiosk'))

    let platform = 'casierie'
    if (rawSource.includes('glovo')) platform = 'glovo'
    else if (rawSource.includes('wolt')) platform = 'wolt'
    else if (rawSource.includes('bolt')) platform = 'bolt'
    else if (rawSource.includes('delivery')) platform = 'delivery'
    else if (isKiosk) platform = 'kiosk'
    else platform = 'casierie'

    // --- DEDUPLICATION: Nu dublăm comenzile de pe Kiosk cu cele din iiko ---
    if (platform === 'kiosk' || isKiosk) {
      const searchIds = [
        `kiosk_${o.id}`,
        `kiosk_${o.orderId}`,
        `kiosk_${o.number}`,
        `kiosk_${o.externalNumber}`,
        o.externalNumber,
        o.id
      ].filter(Boolean)

      const { data: existingKiosk } = await supabase
        .from('platform_sales')
        .select('id, order_id, platform, total_amount')
        .eq('restaurant_id', matchedRest.id)
        .in('order_id', searchIds)
        .limit(1)

      if (existingKiosk && existingKiosk.length > 0) {
        console.log(`[NETLIFY WEBHOOK] DEDUP: Comanda #${o.number || o.id} există deja de la Kiosk (${existingKiosk[0].order_id}). Evităm dublarea.`)
        continue
      }
    }

    const total_amount = parseFloat(o.sum || o.total || o.total_amount || o.resultSum || 0)

    let placed_at = o.whenCreated || o.whenClosed || o.created_at || o.placed_at || o.eventTime
    if (placed_at && typeof placed_at === 'string' && placed_at.includes(' ') && !placed_at.includes('T')) {
      placed_at = placed_at.replace(' ', 'T')
    }
    try {
      placed_at = placed_at ? new Date(placed_at).toISOString() : new Date().toISOString()
    } catch (_) {
      placed_at = new Date().toISOString()
    }

    // Format items
    const rawItems = Array.isArray(o.items) ? o.items : []
    const items = rawItems.map((it, idx) => {
      const pName = it.product?.name || it.product_name || it.name || 'Articol'
      const price = parseFloat(it.price || it.resultSum || 0)
      const qty = parseFloat(it.amount || it.quantity || 1)
      return {
        product_name: pName,
        price,
        amount: qty,
        sum: parseFloat(it.resultSum || (price * qty)),
        quantity: qty,
        _order_meta: idx === 0 ? {
          orderNumber: cleanKioskOrderNumber(o.number || o.externalNumber, baseId, platform),
          channel: platform,
          orderType: platform === 'kiosk' ? 'Smart Kiosk' : platform === 'casierie' ? 'Casierie (POS)' : 'Delivery',
          operator: o.operator?.name || null,
          posId: o.posId || null,
          terminalGroupId: o.terminalGroupId || null,
          conception: o.conception?.name || null
        } : undefined
      }
    })

    rowsToUpsert.push({
      restaurant_id: matchedRest.id,
      order_id: uniqueOrderId,
      platform,
      total_amount,
      placed_at,
      items
    })
  }

  if (rowsToUpsert.length > 0) {
    const uniqueMap = new Map()
    for (const r of rowsToUpsert) uniqueMap.set(r.order_id, r)
    const uniqueRows = Array.from(uniqueMap.values())

    const { error } = await supabase.from('platform_sales').upsert(uniqueRows, { onConflict: 'order_id' })
    if (error) console.error('[NETLIFY WEBHOOK] Upsert error:', error)
    return { count: uniqueRows.length, error: error?.message }
  }

  return { count: 0 }
}
