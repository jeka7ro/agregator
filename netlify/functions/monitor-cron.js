import { createClient } from '@supabase/supabase-js'
import restaurantsCacheStatic from '../../data/restaurants-cache.json'
import platformStoreMapStatic from '../../data/platform-store-map.json'
import { runFullLivePlatformScan } from '../../lib/live-platform-checkers.js'

const getEnv = (key) => (typeof Netlify !== 'undefined' && Netlify.env?.get?.(key)) || process.env[key] || ''

export default async function handler() {
  // Respect strict Romania Night Blackout Window (22:00 – 10:00 Europe/Bucharest): 0 night traffic
  const roHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      hour12: false
    }).format(new Date())
  )
  if (roHour < 10 || roHour >= 22) {
    console.log(`[MonitorCron] Outside active RO hours (${roHour}:xx) — skipping scan.`)
    return new Response(JSON.stringify({ skipped: true, roHour }), { status: 200 })
  }

  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')
  const supabaseKey = getEnv('SUPABASE_SERVICE_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY')
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null

  let restaurants = Array.isArray(restaurantsCacheStatic)
    ? restaurantsCacheStatic
    : (Array.isArray(restaurantsCacheStatic?.restaurants) ? restaurantsCacheStatic.restaurants : [])

  if (supabase) {
    try {
      const { data } = await supabase.from('restaurants').select('*').eq('is_active', true)
      if (Array.isArray(data) && data.length > 0) restaurants = data
    } catch (err) {
      console.warn('[MonitorCron] Falling back to static restaurants cache:', err.message)
    }
  }

  const summary = await runFullLivePlatformScan({
    restaurants,
    storeMap: platformStoreMapStatic,
    supabase,
    persistToDb: true,
    notifyTelegram: true,
    budgetMs: 24000
  })

  console.log(
    `[MonitorCron] Done in ${summary.duration_ms}ms: ${summary.valid_checked}/${summary.total_tasks} valid, offline=${summary.offline}, opened=${summary.stop_events_opened}, resolved=${summary.stop_events_resolved}, err=${summary.errors}`
  )

  return new Response(
    JSON.stringify({
      ok: true,
      duration_ms: summary.duration_ms,
      valid_checked: summary.valid_checked,
      total_tasks: summary.total_tasks,
      offline: summary.offline,
      stop_events_opened: summary.stop_events_opened,
      stop_events_resolved: summary.stop_events_resolved,
      errors: summary.errors
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

export const config = {
  schedule: '*/5 * * * *'
}
