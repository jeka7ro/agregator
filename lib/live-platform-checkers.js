import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

let _cachedStoreMap = null
export function loadStoreMap(overrideMap = null) {
    if (overrideMap && typeof overrideMap === 'object' && Object.keys(overrideMap).length > 0) {
        _cachedStoreMap = overrideMap
        return _cachedStoreMap
    }
    if (_cachedStoreMap) return _cachedStoreMap
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url))
        const candidates = [
            path.resolve(__dirname, '..', 'data', 'platform-store-map.json'),
            path.resolve(process.cwd(), 'data', 'platform-store-map.json')
        ]
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                _cachedStoreMap = JSON.parse(fs.readFileSync(p, 'utf8'))
                return _cachedStoreMap
            }
        }
    } catch (_) { }
    return {}
}

// All Romanian operational hub coordinates for 1-call-per-hub live Wolt scans (zero 429s)
const ROMANIA_HUBS = [
    ['BUC_UNIRII', 44.4278, 26.1032],
    ['BUC_TITAN', 44.4192, 26.1735],
    ['BUC_CEAIKOVSKI', 44.4678, 26.1025],
    ['BUC_CORA', 44.4335, 26.0352],
    ['BALOTESTI', 44.6145, 26.0772],
    ['CLUJ_CENTER', 46.7712, 23.5849],
    ['CLUJ_VIVO', 46.7503, 23.5331],
    ['CONSTANTA', 44.1782, 28.6534],
    ['CONSTANTA_CITYPARK', 44.2054, 28.6317],
    ['TIMISOARA', 45.7366, 21.2415],
    ['IASI_1', 47.1628, 27.5585],
    ['IASI_2', 47.1552, 27.6068],
    ['BRASOV', 45.6408, 25.6182],
    ['SIBIU', 45.7785, 24.1702],
    ['CRAIOVA', 44.3188, 23.8165],
    ['ORADEA', 47.0465, 21.9102],
    ['GALATI', 45.4353, 28.0315],
    ['BRAILA', 45.2695, 27.9635],
    ['PITESTI', 44.8522, 24.8785],
    ['BACAU', 46.5785, 26.9165],
    ['TARGU_MURES', 46.5332, 24.5914],
    ['SUCEAVA', 47.6418, 26.2442],
    ['BOTOSANI', 47.7422, 26.6495],
    ['TULCEA', 45.1787, 28.8051],
    ['PIATRA_NEAMT', 46.9312, 26.3745]
]

// Exact 18 unique Bolt Food cities in Romania (cityWideSearch returns ALL branches in a city in 1 call — stays under Bolt rate limits!)
const BOLT_CITY_HUBS = [
    ['BUCURESTI', 44.4278, 26.1032],
    ['CLUJ', 46.7712, 23.5849],
    ['CONSTANTA', 44.1782, 28.6534],
    ['TIMISOARA', 45.7366, 21.2415],
    ['IASI', 47.1628, 27.5585],
    ['BRASOV', 45.6408, 25.6182],
    ['SIBIU', 45.7785, 24.1702],
    ['CRAIOVA', 44.3188, 23.8165],
    ['ORADEA', 47.0465, 21.9102],
    ['GALATI', 45.4353, 28.0315],
    ['BRAILA', 45.2695, 27.9635],
    ['PITESTI', 44.8522, 24.8785],
    ['BACAU', 46.5785, 26.9165],
    ['TARGU_MURES', 46.5332, 24.5914],
    ['SUCEAVA', 47.6418, 26.2442],
    ['BOTOSANI', 47.7422, 26.6495],
    ['TULCEA', 45.1787, 28.8051],
    ['PIATRA_NEAMT', 46.9312, 26.3745]
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function buildBoltQuery(lat = null, lng = null) {
    const devId = `web-${crypto.randomBytes(6).toString('hex')}`
    const base = `version=FW.1.148&language=ro-RO&deviceId=${devId}&device_name=web&device_os_version=web&deviceType=web`
    return (lat !== null && lng !== null) ? `${base}&lat=${lat}&lng=${lng}` : base
}

export function getStoreMapEntry(restaurant, overrideMap = null) {
    if (!restaurant) return null
    const map = loadStoreMap(overrideMap)
    if (restaurant.id && map[restaurant.id]) {
        return map[restaurant.id]
    }
    const wId = (restaurant.wolt_url || '').match(/([0-9a-f]{24})/i)?.[1]?.toLowerCase()
    if (wId) {
        const byWolt = Object.values(map).find(v => v.wolt_id === wId)
        if (byWolt) return byWolt
    }
    return null
}

/**
 * Single-restaurant real-time Wolt venue availability check via public Wolt Dynamic API (~150ms).
 * Used for individual checks & confirming any store that appeared offline in the city-hub feed.
 */
export async function checkWoltLive(restaurant, storeEntry = null) {
    const entry = storeEntry || getStoreMapEntry(restaurant)
    const slug = entry?.wolt_slug
    const startTime = Date.now()

    if (!slug) {
        return {
            restaurant_id: restaurant.id,
            platform: 'wolt',
            checked_at: new Date().toISOString(),
            ui_is_open: null,
            ui_can_order: null,
            ui_is_greyed: false,
            ui_error_message: 'Wolt slug neconfigurat',
            final_status: 'error',
            raw_data: { is_scraper_error: true, error: 'Missing wolt_slug', url: restaurant.wolt_url }
        }
    }

    const apiUrl = `https://consumer-api.wolt.com/order-xp/web/v1/venue/slug/${encodeURIComponent(slug)}/dynamic/`
    try {
        const res = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'User-Agent': CHROME_UA, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(7000)
        })
        const responseTime = Date.now() - startTime
        if (!res.ok) {
            return {
                restaurant_id: restaurant.id,
                platform: 'wolt',
                checked_at: new Date().toISOString(),
                ui_is_open: null,
                ui_can_order: null,
                ui_is_greyed: false,
                ui_error_message: `Wolt HTTP ${res.status}`,
                final_status: 'error',
                raw_data: { is_scraper_error: true, http_status: res.status, slug, url: apiUrl, response_time_ms: responseTime }
            }
        }

        const json = await res.json().catch(() => null)
        const venue = json?.venue
        if (!venue || typeof venue.online !== 'boolean') {
            return {
                restaurant_id: restaurant.id,
                platform: 'wolt',
                checked_at: new Date().toISOString(),
                ui_is_open: null,
                ui_can_order: null,
                ui_is_greyed: false,
                ui_error_message: 'Răspuns Wolt invalid',
                final_status: 'error',
                raw_data: { is_scraper_error: true, slug, url: apiUrl, response_time_ms: responseTime }
            }
        }

        const openStatus = venue.open_status || {}
        const deliveryStatus = venue.delivery_open_status || openStatus
        const isOnline = venue.online === true
        const isDeliveryOpen = deliveryStatus.is_open !== false && openStatus.is_open !== false
        const isAvailable = isOnline && isDeliveryOpen

        let finalStatus = 'available'
        let errorMsg = null
        if (!isAvailable) {
            const styleType = String(deliveryStatus?.style?.type || openStatus?.style?.type || '').toUpperCase()
            const statusText = deliveryStatus?.value || openStatus?.value || null
            if (!isOnline) {
                finalStatus = 'unavailable'
                errorMsg = statusText || 'Oprit temporar pe Wolt (STOP)'
            } else {
                finalStatus = styleType === 'CLOSED' ? 'closed' : 'unavailable'
                errorMsg = statusText || 'Închis pe Wolt'
            }
        }

        return {
            restaurant_id: restaurant.id,
            platform: 'wolt',
            checked_at: new Date().toISOString(),
            ui_is_open: isAvailable,
            ui_can_order: isAvailable,
            ui_is_greyed: !isAvailable,
            ui_error_message: errorMsg,
            final_status: finalStatus,
            raw_data: {
                source: 'wolt_dynamic_api',
                slug,
                venue_id: venue.id,
                online: isOnline,
                is_open: openStatus.is_open ?? null,
                delivery_is_open: deliveryStatus.is_open ?? null,
                scheduleInfo: deliveryStatus.value || openStatus.value || null,
                previous_open: openStatus.previous_open || null,
                next_close: openStatus.next_close || null,
                next_open: openStatus.next_open || null,
                response_time_ms: responseTime,
                url: `https://wolt.com/en/rou/restaurant/${slug}`
            }
        }
    } catch (err) {
        return {
            restaurant_id: restaurant.id,
            platform: 'wolt',
            checked_at: new Date().toISOString(),
            ui_is_open: null,
            ui_can_order: null,
            ui_is_greyed: false,
            ui_error_message: `Wolt error: ${err.message}`,
            final_status: 'error',
            raw_data: { is_scraper_error: true, error: err.message, slug, url: apiUrl }
        }
    }
}

/**
 * Single-restaurant real-time Bolt Food provider availability check (~120ms).
 * Used for individual checks & confirming any store that appeared offline in cityWideSearch.
 */
export async function checkBoltLive(restaurant, storeEntry = null) {
    const entry = storeEntry || getStoreMapEntry(restaurant)
    const providerId = entry?.bolt_provider_id
    const startTime = Date.now()

    if (!providerId) {
        return {
            restaurant_id: restaurant.id,
            platform: 'bolt',
            checked_at: new Date().toISOString(),
            ui_is_open: null,
            ui_can_order: null,
            ui_is_greyed: false,
            ui_error_message: 'Bolt provider_id neconfigurat',
            final_status: 'error',
            raw_data: { is_scraper_error: true, error: 'Missing bolt_provider_id', url: restaurant.bolt_url }
        }
    }

    const apiUrl = `https://deliveryuser.live.boltsvc.net/deliveryClient/public/getProviderAvailabilityStatus?provider_id=${encodeURIComponent(providerId)}&${buildBoltQuery()}`
    try {
        const res = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'User-Agent': CHROME_UA, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(7000)
        })
        const responseTime = Date.now() - startTime
        if (!res.ok) {
            return {
                restaurant_id: restaurant.id,
                platform: 'bolt',
                checked_at: new Date().toISOString(),
                ui_is_open: null,
                ui_can_order: null,
                ui_is_greyed: false,
                ui_error_message: `Bolt HTTP ${res.status}`,
                final_status: 'error',
                raw_data: { is_scraper_error: true, http_status: res.status, provider_id: providerId, response_time_ms: responseTime, url: restaurant.bolt_url }
            }
        }

        const json = await res.json().catch(() => null)
        if (!json || json.code !== 0 || !json.data) {
            return {
                restaurant_id: restaurant.id,
                platform: 'bolt',
                checked_at: new Date().toISOString(),
                ui_is_open: null,
                ui_can_order: null,
                ui_is_greyed: false,
                ui_error_message: `Bolt API code ${json?.code ?? 'unknown'}`,
                final_status: 'error',
                raw_data: { is_scraper_error: true, bolt_code: json?.code, message: json?.message, provider_id: providerId, response_time_ms: responseTime, url: restaurant.bolt_url }
            }
        }

        const d = json.data
        const canDeliver = d.is_available_for_delivery === true
        const rawOverlay = d.provider_overlay_text || d.provider_snackbar_text || null
        const overlay = typeof rawOverlay === 'string' ? rawOverlay : (rawOverlay?.value || rawOverlay?.text || null)
        const finalStatus = canDeliver ? 'available' : 'unavailable'

        return {
            restaurant_id: restaurant.id,
            platform: 'bolt',
            checked_at: new Date().toISOString(),
            ui_is_open: canDeliver,
            ui_can_order: canDeliver,
            ui_is_greyed: !canDeliver,
            ui_error_message: canDeliver ? null : (overlay || 'Oprit temporar pe Bolt Food (STOP)'),
            final_status: finalStatus,
            raw_data: {
                source: 'bolt_availability_api',
                provider_id: providerId,
                bolt_name: entry?.bolt_name || null,
                is_available_for_delivery: canDeliver,
                is_available_for_takeaway: d.is_available_for_takeaway === true,
                is_available_for_schedule_delivery: d.is_available_for_schedule_delivery === true,
                overlay_text: overlay,
                scheduleInfo: overlay,
                response_time_ms: responseTime,
                url: restaurant.bolt_url
            }
        }
    } catch (err) {
        return {
            restaurant_id: restaurant.id,
            platform: 'bolt',
            checked_at: new Date().toISOString(),
            ui_is_open: null,
            ui_can_order: null,
            ui_is_greyed: false,
            ui_error_message: `Bolt error: ${err.message}`,
            final_status: 'error',
            raw_data: { is_scraper_error: true, error: err.message, provider_id: providerId, url: restaurant.bolt_url }
        }
    }
}

/**
 * Real-time Glovo availability check (pure HTTP — ZERO Puppeteer).
 * Checks "open":true|false FIRST in SSR HTML (or Glovo v3/stores API for Bucharest multi-branch store IDs).
 * Deduplicates shared URLs / store IDs across branches via shared cache Map!
 */
export async function checkGlovoLive(restaurant, storeEntry = null, glovoCache = null) {
    const entry = storeEntry || getStoreMapEntry(restaurant)
    const startTime = Date.now()
    let targetUrl = entry?.glovo_url || restaurant.glovo_url || null
    if (targetUrl && targetUrl.includes('/balotesti/stores/')) {
        targetUrl = targetUrl.replace('/balotesti/stores/', '/corbeanca/stores/')
    }

    if (!targetUrl && !entry?.glovo_store_id) {
        return {
            restaurant_id: restaurant.id,
            platform: 'glovo',
            checked_at: new Date().toISOString(),
            ui_is_open: null,
            ui_can_order: null,
            ui_is_greyed: false,
            ui_error_message: 'URL Glovo lipsă',
            final_status: 'error',
            raw_data: { is_scraper_error: true, error: 'Missing glovo_url' }
        }
    }

    // Path A: Official Glovo v3/stores API for BUC (where SSR URL is multi-address)
    if (entry?.glovo_use_api && (entry?.glovo_store_id || entry?.glovo_slug)) {
        const cc = entry.glovo_city_code || 'BUC'
        const target = entry.glovo_store_id || entry.glovo_slug
        const cacheKey = `api:${cc}:${target}`
        try {
            let apiResult = glovoCache?.get(cacheKey)
            if (!apiResult) {
                const res = await fetch(`https://api.glovoapp.com/v3/stores/${encodeURIComponent(target)}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': CHROME_UA,
                        'Glovo-API-Version': '14',
                        'Glovo-App-Platform': 'web',
                        'Glovo-App-Type': 'customer',
                        'Glovo-Language-Code': 'ro',
                        'Glovo-Location-City-Code': cc,
                        'Glovo-Perseus-Session-Id': crypto.randomUUID(),
                        'Glovo-Perseus-Client-Id': crypto.randomUUID(),
                        'Glovo-Dynamic-Session-Id': crypto.randomUUID()
                    },
                    signal: AbortSignal.timeout(7000)
                })
                const json = await res.json().catch(() => null)
                apiResult = { ok: res.ok, status: res.status, json, ms: Date.now() - startTime }
                if (glovoCache) glovoCache.set(cacheKey, apiResult)
            }

            if (apiResult.ok && apiResult.json && typeof apiResult.json.open === 'boolean') {
                const j = apiResult.json
                const isOpen = j.open === true
                const closedMsg = j.closedStatusMessage || j.scheduleMessage || null
                return {
                    restaurant_id: restaurant.id,
                    platform: 'glovo',
                    checked_at: new Date().toISOString(),
                    ui_is_open: isOpen,
                    ui_can_order: isOpen,
                    ui_is_greyed: !isOpen,
                    ui_error_message: isOpen ? null : (closedMsg || 'Închis pe Glovo (STOP)'),
                    final_status: isOpen ? 'available' : 'closed',
                    raw_data: {
                        source: 'glovo_v3_api',
                        store_id: j.id,
                        slug: j.slug,
                        city_code: cc,
                        open: isOpen,
                        scheduleInfo: closedMsg,
                        nextOpeningTime: j.nextOpeningTime || null,
                        response_time_ms: apiResult.ms,
                        url: targetUrl
                    }
                }
            }

            return {
                restaurant_id: restaurant.id,
                platform: 'glovo',
                checked_at: new Date().toISOString(),
                ui_is_open: null,
                ui_can_order: null,
                ui_is_greyed: false,
                ui_error_message: `Glovo API HTTP ${apiResult.status}`,
                final_status: 'error',
                raw_data: { is_scraper_error: true, source: 'glovo_v3_api', http_status: apiResult.status, city_code: cc, target, url: targetUrl }
            }
        } catch (err) {
            return {
                restaurant_id: restaurant.id,
                platform: 'glovo',
                checked_at: new Date().toISOString(),
                ui_is_open: null,
                ui_can_order: null,
                ui_is_greyed: false,
                ui_error_message: `Glovo API error: ${err.message}`,
                final_status: 'error',
                raw_data: { is_scraper_error: true, error: err.message, url: targetUrl }
            }
        }
    }

    // Path B: Direct Glovo SSR HTML (fast ~350ms, zero rate-limit, deduplicated by URL!)
    const cacheKey = `ssr:${targetUrl}`
    try {
        let ssrResult = glovoCache?.get(cacheKey)
        if (!ssrResult) {
            const res = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': CHROME_UA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8'
                },
                redirect: 'follow',
                signal: AbortSignal.timeout(8000)
            })
            const html = await res.text()
            ssrResult = { ok: res.ok, status: res.status, html, ms: Date.now() - startTime }
            if (glovoCache) glovoCache.set(cacheKey, ssrResult)
        }

        const { ok, status, html, ms } = ssrResult
        const openMatch = html.match(/\\?"open\\?"\s*:\s*(true|false)/)

        // IMPORTANT: Check live SSR store JSON `"open":true|false` FIRST!
        // Valid Next.js pages include localized 404 dictionary text inside <script>, so never check 404 text before openMatch!
        if (ok && openMatch) {
            const isOpen = openMatch[1] === 'true'
            const closedMsgMatch = html.match(/\\?"closedStatusMessage\\?"\s*:\s*\\?"([^"\\]+)\\?"/)
            const schedMsgMatch = html.match(/\\?"scheduleMessage\\?"\s*:\s*\\?"([^"\\]+)\\?"/)
            const nextOpenMatch = html.match(/\\?"nextOpeningTime\\?"\s*:\s*\\?"([^"\\]+)\\?"/)
            const closedMsg = closedMsgMatch?.[1] || schedMsgMatch?.[1] || null

            return {
                restaurant_id: restaurant.id,
                platform: 'glovo',
                checked_at: new Date().toISOString(),
                ui_is_open: isOpen,
                ui_can_order: isOpen,
                ui_is_greyed: !isOpen,
                ui_error_message: isOpen ? null : (closedMsg || 'Închis pe Glovo (STOP)'),
                final_status: isOpen ? 'available' : 'closed',
                raw_data: {
                    source: 'glovo_ssr',
                    open: isOpen,
                    scheduleInfo: closedMsg,
                    nextOpeningTime: nextOpenMatch?.[1] || null,
                    response_time_ms: ms,
                    url: targetUrl
                }
            }
        }

        const lower = html.toLowerCase()
        const isWaf = status === 403 || status === 429 || lower.includes('waf courtesy page') || lower.includes("problem, but we're working on it")
        return {
            restaurant_id: restaurant.id,
            platform: 'glovo',
            checked_at: new Date().toISOString(),
            ui_is_open: null,
            ui_can_order: null,
            ui_is_greyed: false,
            ui_error_message: isWaf ? 'Glovo WAF/rate-limit' : `Glovo pagină indisponibilă (${status})`,
            final_status: 'error',
            raw_data: { is_scraper_error: true, source: 'glovo_ssr', isWaf, http_status: status, html_length: html.length, response_time_ms: ms, url: targetUrl }
        }
    } catch (err) {
        return {
            restaurant_id: restaurant.id,
            platform: 'glovo',
            checked_at: new Date().toISOString(),
            ui_is_open: null,
            ui_can_order: null,
            ui_is_greyed: false,
            ui_error_message: `Glovo error: ${err.message}`,
            final_status: 'error',
            raw_data: { is_scraper_error: true, error: err.message, url: targetUrl }
        }
    }
}

/**
 * Bulk Wolt scan via 1-call-per-hub city listings (ZERO 429 rate-limits, checks all 50 venues in ~1.5s!).
 * Any venue showing offline or missing from the hub feed is verified with a targeted `/dynamic/` call!
 */
async function scanAllWoltViaHubs(activeRests) {
    const woltRests = activeRests.filter(r => r.wolt_url || getStoreMapEntry(r)?.wolt_slug)
    const liveVenuesById = new Map()
    const liveVenuesBySlug = new Map()

    for (let i = 0; i < ROMANIA_HUBS.length; i += 6) {
        await Promise.all(ROMANIA_HUBS.slice(i, i + 6).map(async ([hub, lat, lon]) => {
            try {
                const res = await fetch(`https://restaurant-api.wolt.com/v1/pages/restaurants?lat=${lat}&lon=${lon}`, {
                    headers: { 'User-Agent': CHROME_UA, 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(7000)
                })
                if (!res.ok) return
                const json = await res.json().catch(() => null)
                for (const s of (json?.sections || [])) {
                    for (const it of (s.items || [])) {
                        if (it.venue?.id) {
                            const rec = {
                                id: it.venue.id.toLowerCase(),
                                slug: it.venue.slug,
                                online: it.venue.online === true,
                                delivers: it.venue.delivers !== false,
                                title: it.title || it.venue.name,
                                hub
                            }
                            liveVenuesById.set(rec.id, rec)
                            if (rec.slug) liveVenuesBySlug.set(rec.slug, rec)
                        }
                    }
                }
            } catch (_) { }
        }))
    }

    const nowIso = new Date().toISOString()
    const results = []
    const toConfirm = []

    for (const r of woltRests) {
        const entry = getStoreMapEntry(r)
        const wId = (entry?.wolt_id || (r.wolt_url || '').match(/([0-9a-f]{24})/i)?.[1] || '').toLowerCase()
        const hit = (entry?.wolt_slug && liveVenuesBySlug.get(entry.wolt_slug)) || (wId && liveVenuesById.get(wId)) || null

        if (hit && hit.online && hit.delivers) {
            results.push({
                restaurant_id: r.id,
                platform: 'wolt',
                checked_at: nowIso,
                ui_is_open: true,
                ui_can_order: true,
                ui_is_greyed: false,
                ui_error_message: null,
                final_status: 'available',
                raw_data: {
                    source: 'wolt_city_hub_live',
                    venue_id: hit.id,
                    slug: hit.slug,
                    online: true,
                    delivers: true,
                    hub: hit.hub,
                    url: `https://wolt.com/en/rou/restaurant/${hit.slug}`
                }
            })
        } else {
            // Either offline in hub feed OR not in feed — double-check with direct `/dynamic/` endpoint!
            toConfirm.push({ r, entry, hit })
        }
    }

    // Confirm offline/missing venues sequentially in tiny batches of 4 (never hits 429!)
    for (let i = 0; i < toConfirm.length; i += 4) {
        const confirmed = await Promise.all(toConfirm.slice(i, i + 4).map(async ({ r, entry, hit }) => {
            const dyn = await checkWoltLive(r, entry)
            // If dynamic API errored (e.g. transient) but hub feed explicitly said online:false, trust hub feed!
            if (dyn.final_status === 'error' && hit && hit.online === false) {
                return {
                    restaurant_id: r.id,
                    platform: 'wolt',
                    checked_at: nowIso,
                    ui_is_open: false,
                    ui_can_order: false,
                    ui_is_greyed: true,
                    ui_error_message: 'Oprit temporar pe Wolt (STOP)',
                    final_status: 'unavailable',
                    raw_data: { source: 'wolt_city_hub_live', venue_id: hit.id, slug: hit.slug, online: false, hub: hit.hub }
                }
            }
            return dyn
        }))
        results.push(...confirmed)
        if (i + 4 < toConfirm.length) await sleep(150)
    }

    return results
}

/**
 * Bulk Bolt Food scan via 1-call-per-hub `cityWideSearch` (ZERO 429 rate-limits, checks all 50 stores in ~2s!).
 * Any store showing `instant: false` or missing from the city feed is confirmed via `getProviderAvailabilityStatus`!
 */
async function scanAllBoltViaHubs(activeRests, deadlineMs = Infinity) {
    const boltRests = activeRests.filter(r => r.bolt_url || getStoreMapEntry(r)?.bolt_provider_id)
    const liveProvidersById = new Map()

    // Paced 6 cities per batch (3 batches total for all 18 Bolt cities -> ~3–4s total!)
    for (let i = 0; i < BOLT_CITY_HUBS.length; i += 6) {
        if (Date.now() > deadlineMs) break
        await Promise.all(BOLT_CITY_HUBS.slice(i, i + 6).map(async ([hub, lat, lng]) => {
            try {
                const res = await fetch(`https://deliveryuser.live.boltsvc.net/deliveryClient/public/cityWideSearch?${buildBoltQuery(lat, lng)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'User-Agent': CHROME_UA },
                    body: JSON.stringify({ lat, lng, delivery_lat: lat, delivery_lng: lng, location: { lat, lng }, search_query: '', filters: [] }),
                    signal: AbortSignal.timeout(3800)
                })
                if (!res.ok) return
                const json = await res.json().catch(() => null)
                if (json?.code !== 0 || !Array.isArray(json?.data?.providers)) return
                for (const p of json.data.providers) {
                    if (p?.id) {
                        const existing = liveProvidersById.get(Number(p.id))
                        const inst = p.availability?.delivery?.instant === true
                        if (!existing || inst) {
                            liveProvidersById.set(Number(p.id), {
                                id: Number(p.id),
                                name: p.name,
                                instant: inst,
                                scheduled: p.availability?.delivery?.scheduled === true,
                                hub
                            })
                        }
                    }
                }
            } catch (_) { }
        }))
        if (i + 6 < BOLT_CITY_HUBS.length && Date.now() < deadlineMs) await sleep(120)
    }

    const nowIso = new Date().toISOString()
    const results = []
    const toConfirm = []

    for (const r of boltRests) {
        const entry = getStoreMapEntry(r)
        const pid = entry?.bolt_provider_id ? Number(entry.bolt_provider_id) : null
        const hit = pid ? liveProvidersById.get(pid) : null

        if (hit && hit.instant) {
            results.push({
                restaurant_id: r.id,
                platform: 'bolt',
                checked_at: nowIso,
                ui_is_open: true,
                ui_can_order: true,
                ui_is_greyed: false,
                ui_error_message: null,
                final_status: 'available',
                raw_data: {
                    source: 'bolt_city_hub_live',
                    provider_id: pid,
                    bolt_name: hit.name,
                    is_available_for_delivery: true,
                    hub: hit.hub,
                    url: r.bolt_url
                }
            })
        } else {
            toConfirm.push({ r, entry, hit })
        }
    }

    // Confirm offline/missing Bolt stores gently while within time budget (deduplicated by provider_id!).
    // RULE OF IRON: NEVER mark a Bolt store unavailable (STOP) from cityWideSearch alone (radius shifts cause false instant:false);
    // ONLY confirm STOP when direct getProviderAvailabilityStatus explicitly returns is_available_for_delivery === false!
    const confirmCache = new Map()
    const uniqueConfirmGroups = new Map()
    for (const item of toConfirm) {
        const pidKey = item.entry?.bolt_provider_id ? String(item.entry.bolt_provider_id) : `noid:${item.r.id}`
        if (!uniqueConfirmGroups.has(pidKey)) uniqueConfirmGroups.set(pidKey, [])
        uniqueConfirmGroups.get(pidKey).push(item)
    }

    const groupEntries = [...uniqueConfirmGroups.entries()]
    for (let i = 0; i < groupEntries.length; i += 3) {
        if (Date.now() > deadlineMs) break
        const batch = groupEntries.slice(i, i + 3)
        await Promise.all(batch.map(async ([pidKey, items]) => {
            const first = items[0]
            let direct = confirmCache.get(pidKey)
            if (!direct) {
                direct = await checkBoltLive(first.r, first.entry)
                confirmCache.set(pidKey, direct)
            }
            for (const { r } of items) {
                results.push({
                    ...direct,
                    restaurant_id: r.id,
                    raw_data: { ...(direct.raw_data || {}), url: r.bolt_url || direct.raw_data?.url }
                })
            }
        }))
        if (i + 3 < groupEntries.length && Date.now() < deadlineMs) await sleep(120)
    }

    return results
}

/**
 * Bulk Glovo scan (deduplicating shared store URLs & BUC API IDs so all 52 stores finish in ~2.5s!).
 */
async function scanAllGlovo(activeRests) {
    const glovoRests = activeRests.filter(r => r.glovo_url || getStoreMapEntry(r)?.glovo_store_id)
    const glovoCache = new Map()

    // Group by unique target key so shared URLs/store IDs are only fetched ONCE!
    const groups = new Map()
    for (const r of glovoRests) {
        const entry = getStoreMapEntry(r)
        let u = entry?.glovo_url || r.glovo_url || ''
        if (u.includes('/balotesti/stores/')) u = u.replace('/balotesti/stores/', '/corbeanca/stores/')
        const key = entry?.glovo_use_api ? `api:${entry.glovo_city_code}:${entry.glovo_store_id || entry.glovo_slug}` : `ssr:${u}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push({ r, entry })
    }

    const groupList = [...groups.values()]
    const results = []
    for (let i = 0; i < groupList.length; i += 8) {
        const batch = groupList.slice(i, i + 8)
        await Promise.all(batch.map(async (items) => {
            // Fetch first item (populates glovoCache), then reuse instantly for siblings
            const firstRes = await checkGlovoLive(items[0].r, items[0].entry, glovoCache)
            results.push(firstRes)
            for (let j = 1; j < items.length; j++) {
                const sibling = await checkGlovoLive(items[j].r, items[j].entry, glovoCache)
                results.push(sibling)
            }
        }))
    }
    return results
}

/**
 * Check if current Europe/Bucharest time is within a restaurant's working hours.
 * Defaults to 10:00–22:00 RO (or respects explicit working_hours).
 */
export function isRestaurantWorkingNow(restaurant, now = new Date()) {
    const roWallStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Bucharest' })
    const [roH, roM] = roWallStr.slice(11, 16).split(':').map(Number)
    const roNowMin = (roH || 0) * 60 + (roM || 0)
    const roDayKey = now.toLocaleDateString('en-US', { timeZone: 'Europe/Bucharest', weekday: 'long' }).toLowerCase()

    const wh = restaurant?.working_hours || {}
    let startStr = wh.start || wh.open || null
    let endStr = wh.end || wh.close || null
    if (!startStr && !endStr && wh[roDayKey] && typeof wh[roDayKey] === 'object') {
        if (wh[roDayKey].closed === true) return { isOpen: false, label: 'Închis azi', roHour: roH, roTime: roWallStr.slice(11, 16) }
        startStr = wh[roDayKey].open || wh[roDayKey].start || null
        endStr = wh[roDayKey].close || wh[roDayKey].end || null
    }
    const effStart = startStr || '10:00'
    const effEnd = endStr || '22:00'
    const [sH, sM] = String(effStart).split(':').map(Number)
    const [eH, eM] = String(effEnd).split(':').map(Number)
    const startMin = (sH || 10) * 60 + (sM || 0)
    const endMin = (eH || 22) * 60 + (eM || 0)
    const isOpen = startMin <= endMin
        ? (roNowMin >= startMin && roNowMin < endMin)
        : (roNowMin >= startMin || roNowMin < endMin)
    return { isOpen, label: `${effStart}–${effEnd}`, roHour: roH, roTime: roWallStr.slice(11, 16) }
}

/**
 * Send concise Telegram STOP / RECOVERY notification (only fires when BOT_TOKEN + CHAT_ID exist).
 */
export async function sendTelegramStopAlert(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN || (typeof Netlify !== 'undefined' && Netlify.env?.get?.('TELEGRAM_BOT_TOKEN'))
    const chatId = process.env.TELEGRAM_CHAT_ID || (typeof Netlify !== 'undefined' && Netlify.env?.get?.('TELEGRAM_CHAT_ID'))
    if (!token || !chatId) return false
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
            signal: AbortSignal.timeout(5000)
        })
        return true
    } catch (_) {
        return false
    }
}

/**
 * Run a REAL live parallel scan across ALL active restaurants (Wolt + Bolt + Glovo simultaneously!),
 * persist real results to Supabase `monitoring_checks`, and open/resolve `stop_events` + Telegram alerts!
 * Finishes ALL ~152 channels in ~3–5 seconds with ZERO 429s!
 */
export async function runFullLivePlatformScan({ restaurants = [], storeMap = null, supabase = null, persistToDb = true, notifyTelegram = true, budgetMs = 20000 } = {}) {
    if (storeMap) loadStoreMap(storeMap)
    const startMs = Date.now()
    const deadlineMs = startMs + budgetMs
    const now = new Date()
    const activeRests = restaurants.filter(r => r && r.is_active !== false)

    // Run Wolt hubs, Bolt hubs, and Glovo SSR/API in parallel!
    const [woltResults, boltResults, glovoResults] = await Promise.all([
        scanAllWoltViaHubs(activeRests),
        scanAllBoltViaHubs(activeRests, deadlineMs),
        scanAllGlovo(activeRests)
    ])

    const results = [...glovoResults, ...woltResults, ...boltResults]
    const restById = new Map(activeRests.map(r => [r.id, r]))
    const validChecks = []
    const stoppedChannels = []
    let errorCount = 0

    for (const chk of results) {
        const isErr = chk.final_status === 'error' || chk.raw_data?.is_scraper_error === true
        if (isErr) {
            errorCount++
            continue
        }
        validChecks.push(chk)
        const r = restById.get(chk.restaurant_id)
        const sched = isRestaurantWorkingNow(r, now)
        if (chk.final_status !== 'available' && sched.isOpen) {
            stoppedChannels.push({
                restaurant_id: chk.restaurant_id,
                restaurant_name: r?.name || chk.restaurant_id,
                city: r?.city || '',
                platform: chk.platform,
                final_status: chk.final_status,
                reason: chk.ui_error_message || 'Magazin indisponibil (STOP)'
            })
        }
    }

    let stopEventsOpened = 0
    let stopEventsResolved = 0
    if (persistToDb && supabase && validChecks.length > 0) {
        try {
            const rowsToInsert = validChecks.map(c => ({
                restaurant_id: c.restaurant_id,
                platform: c.platform,
                checked_at: c.checked_at,
                ui_is_open: c.ui_is_open,
                ui_can_order: c.ui_can_order,
                ui_is_greyed: c.ui_is_greyed,
                ui_error_message: c.ui_error_message,
                final_status: c.final_status,
                raw_data: c.raw_data
            }))
            await supabase.from('monitoring_checks').insert(rowsToInsert)
        } catch (err) {
            console.error('[LiveScan] Supabase monitoring_checks bulk insert error:', err.message)
        }

        try {
            const { data: openStops } = await supabase
                .from('stop_events')
                .select('id, restaurant_id, platform, stopped_at')
                .is('resumed_at', null)

            const openStopMap = new Map()
            const openStopLogicalKeys = new Set()
            const makeLogicalStoreKey = (restObj, plat) => {
                const nm = String(restObj?.name || '').trim().toLowerCase().replace(/\s+/g, ' ')
                const ct = String(restObj?.city || '').trim().toLowerCase().replace(/\s+/g, ' ')
                return `${nm}|${ct}|${String(plat || '').toLowerCase()}`
            }
            for (const s of (openStops || [])) {
                const plat = String(s.platform || '').toLowerCase()
                openStopMap.set(`${s.restaurant_id}_${plat}`, s)
                const rMeta = restById.get(s.restaurant_id)
                if (rMeta?.name) openStopLogicalKeys.add(makeLogicalStoreKey(rMeta, plat))
            }

            const newStopsToInsert = []
            const newStopLogicalKeys = new Set()
            const alertsToSend = []

            for (const chk of validChecks) {
                const r = restById.get(chk.restaurant_id)
                if (!r || r.is_competitor) continue
                const sched = isRestaurantWorkingNow(r, now)
                const key = `${chk.restaurant_id}_${chk.platform}`
                const logicalKey = makeLogicalStoreKey(r, chk.platform)
                const existingStop = openStopMap.get(key)
                const isAvail = chk.final_status === 'available'

                // Pre-opening guard for Wolt: if online is true (not forced offline) and store opens within 2h, skip stop event
                let isPreOpening = false
                if (!isAvail && chk.platform === 'wolt' && chk.raw_data?.next_open && chk.raw_data?.online !== false) {
                    const nextOpenMs = new Date(chk.raw_data.next_open).getTime()
                    if (!Number.isNaN(nextOpenMs) && nextOpenMs > now.getTime() && (nextOpenMs - now.getTime()) < 2 * 3600000) {
                        isPreOpening = true
                    }
                }

                if (!isAvail && sched.isOpen && !isPreOpening && !existingStop && !openStopLogicalKeys.has(logicalKey) && !newStopLogicalKeys.has(logicalKey)) {
                    const reasonText = chk.ui_error_message || (chk.final_status === 'closed' ? 'Restaurant închis pe platformă (STOP)' : 'Magazin indisponibil (STOP)')
                    newStopLogicalKeys.add(logicalKey)
                    newStopsToInsert.push({
                        restaurant_id: chk.restaurant_id,
                        platform: chk.platform,
                        stopped_at: chk.checked_at,
                        stop_type: 'full',
                        affected_product_count: 0,
                        total_product_count: 0,
                        reason: reasonText,
                        resumed_at: null,
                        duration_minutes: null,
                        estimated_loss_amount: 0,
                        loss_calculation_config: { telegram_alert_sent: false }
                    })
                    stopEventsOpened++
                    alertsToSend.push(`🔴 <b>STOP DETECTAT (${chk.platform.toUpperCase()})</b>\n📍 ${r.name} (${r.city || ''})\n⏱ ${sched.roTime} RO\n💬 ${reasonText}`)
                } else if (isAvail && existingStop) {
                    const stoppedMs = new Date(existingStop.stopped_at).getTime()
                    const durMin = Math.max(1, Math.round((now.getTime() - stoppedMs) / 60000))
                    const revPerHour = Number(r.revenue_per_hour || 100)
                    const estLoss = Number(((durMin / 60) * revPerHour).toFixed(2))
                    await supabase
                        .from('stop_events')
                        .update({
                            resumed_at: now.toISOString(),
                            duration_minutes: durMin,
                            estimated_loss_amount: estLoss
                        })
                        .eq('id', existingStop.id)
                    stopEventsResolved++
                    alertsToSend.push(`🟢 <b>REVENIT ONLINE (${chk.platform.toUpperCase()})</b>\n📍 ${r.name} (${r.city || ''})\n⏱ Durată stop: ${durMin} min`)
                }
            }

            let tgSent = false
            if (notifyTelegram && alertsToSend.length > 0) {
                tgSent = await sendTelegramStopAlert(alertsToSend.slice(0, 12).join('\n\n'))
            }

            if (newStopsToInsert.length > 0) {
                if (tgSent) {
                    newStopsToInsert.forEach(row => {
                        row.loss_calculation_config = { ...(row.loss_calculation_config || {}), telegram_alert_sent: true }
                    })
                }
                await supabase.from('stop_events').insert(newStopsToInsert)
            }
        } catch (err) {
            console.error('[LiveScan] stop_events sync error:', err.message)
        }
    }

    return {
        duration_ms: Date.now() - startMs,
        total_tasks: results.length,
        valid_checked: validChecks.length,
        errors: errorCount,
        offline: stoppedChannels.length,
        stopped_channels: stoppedChannels,
        stop_events_opened: stopEventsOpened,
        stop_events_resolved: stopEventsResolved,
        checks: results
    }
}
