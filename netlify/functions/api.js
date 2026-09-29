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

    // 9. Webhooks status
    if (path === '/webhooks/status') {
      return new Response(JSON.stringify({
        success: true,
        endpoints: {
          wolt: '/api/webhooks/wolt',
          bolt: '/api/webhooks/bolt',
          glovo: '/api/webhooks/glovo'
        },
        mode: 'cloud-serverless',
        status: 'ready'
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
