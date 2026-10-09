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

    if (path === '/webhooks/orders') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const { data: orders, error } = await supabase
        .from('platform_sales')
        .select('*')
        .order('placed_at', { ascending: false })
        .limit(limit)

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: CORS_HEADERS })
      }

      const { data: rests } = await supabase.from('restaurants').select('id, name, city')
      const restMap = {}
      ;(rests || []).forEach(r => restMap[r.id] = r)

      const enriched = (orders || []).map(o => ({
        ...o,
        restaurant_name: restMap[o.restaurant_id]?.name || 'Restaurant N/A',
        restaurant_city: restMap[o.restaurant_id]?.city || ''
      }))

      return new Response(JSON.stringify({
        success: true,
        count: enriched.length,
        orders: enriched
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

    // Determine platform
    const rawSource = (o.sourceKey || o.source || o.platform || o.eventType || '').toLowerCase()
    let platform = 'restaurant'
    if (rawSource.includes('glovo')) platform = 'glovo'
    else if (rawSource.includes('wolt')) platform = 'wolt'
    else if (rawSource.includes('bolt')) platform = 'bolt'
    else if (rawSource.includes('delivery')) platform = 'delivery'
    else if (rawSource.includes('table') || rawSource.includes('pos') || rawSource.includes('dine') || rawSource.includes('instore')) platform = 'restaurant'

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
    const items = rawItems.map(it => {
      const pName = it.product?.name || it.product_name || it.name || 'Articol'
      const price = parseFloat(it.price || it.resultSum || 0)
      const qty = parseFloat(it.amount || it.quantity || 1)
      return {
        product_name: pName,
        price,
        amount: qty,
        sum: parseFloat(it.resultSum || (price * qty)),
        quantity: qty
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
