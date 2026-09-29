process.env.TZ = 'Europe/Bucharest'
import "./antigravity-worker.js"
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { discoverUrls } from './utils/url-discovery.js'
import { supabase } from './services/supabase.js'
import { GlovoChecker } from './checkers/glovo-checker.js'
import { WoltChecker } from './checkers/wolt-checker.js'
import { BoltChecker } from './checkers/bolt-checker.js'
import { SimpleChecker } from './checkers/simple-checker.js'
import { IikoChecker } from './checkers/iiko-checker.js'
import { LossCalculator } from './services/loss-calculator.js'
import { CompetitorScraper } from './scrapers/competitor-scraper.js'
import { OwnBrandScraper } from './scrapers/own-brand-scraper.js'
import { getSmartSearchWords } from './utils/searchUtils.js'
import { IikoClient } from './services/iiko-client.js'
import { discoverSingleRestaurant } from './utils/auto-discover.js'
import { salesSync } from './services/sales-sync.js'
import { saveLiveChecksCache, loadLiveChecksCache, loadStopEventsCache, loadViolationsCache } from './utils/cache.js'
import { webhookService } from './services/webhook-service.js'
import './index.js' // Start all cron jobs in the background

// --- Prevent Puppeteer / Node crashes on unhandled errors ---
process.on('uncaughtException', (err) => {
    console.error('[API SERVER] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[API SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
});
// -----------------------------------------------------------

const ownBrandScraper = new OwnBrandScraper()

const app = express()
const PORT = process.env.PORT || 3002
const lossCalculator = new LossCalculator()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SYNC_REPORTS_FILE = path.resolve(__dirname, '..', '..', 'data', 'sync-reports.json')

function loadSyncReports() {
    try {
        if (fs.existsSync(SYNC_REPORTS_FILE)) {
            return JSON.parse(fs.readFileSync(SYNC_REPORTS_FILE, 'utf8'))
        }
    } catch (_) {}
    return []
}

function saveSyncReport(report) {
    const reports = loadSyncReports()
    reports.unshift(report) // newest first
    const trimmed = reports.slice(0, 100) // keep last 100 reports
    fs.mkdirSync(path.dirname(SYNC_REPORTS_FILE), { recursive: true })
    fs.writeFileSync(SYNC_REPORTS_FILE, JSON.stringify(trimmed, null, 2))
}

app.use(cors())
app.use(express.json())

// ─── BYPASS Supabase RLS pentru UI ───
app.get('/api/live-checks', (req, res) => {
    res.json({ success: true, checks: global.liveChecks || [] })
})

// ─── OFFICIAL WEBHOOKS (WOLT & BOLT FOOD) ───
// 1. Wolt Webhook receiver (Venue events, order notifications, reviews)
app.post('/api/webhooks/wolt', async (req, res) => {
    try {
        const result = await webhookService.handleWoltWebhook(req.body, req.headers)
        res.status(200).json(result)
    } catch (err) {
        console.error('[API SERVER] Wolt webhook processing error:', err)
        res.status(200).json({ success: false, error: err.message })
    }
})

// 2. Bolt Food Webhook receiver (status_update_url & order notifications)
app.post('/api/webhooks/bolt', async (req, res) => {
    try {
        const result = await webhookService.handleBoltWebhook(req.body, req.headers)
        res.status(200).json(result)
    } catch (err) {
        console.error('[API SERVER] Bolt webhook processing error:', err)
        res.status(200).json({ status: 'ok', error: err.message })
    }
})

// 3. Glovo Webhook receiver (forwarded from Valentin's integration)
app.post('/api/webhooks/glovo', async (req, res) => {
    try {
        const result = await webhookService.handleGlovoWebhook(req.body, req.headers)
        res.status(200).json(result)
    } catch (err) {
        console.error('[API SERVER] Glovo webhook processing error:', err)
        res.status(200).json({ status: 'ok', error: err.message })
    }
})

// 3. Webhook Status & Diagnostics
app.get('/api/webhooks/status', (req, res) => {
    try {
        const status = webhookService.getStatus()
        res.json({ success: true, ...status })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// 4. Webhook Simulator (allows instant testing from dashboard / curl)
app.post('/api/webhooks/simulate', async (req, res) => {
    try {
        const { platform, event_type, venue_id, provider_id, store_id, status, restaurant_id } = req.body
        let result
        if (platform === 'wolt') {
            result = await webhookService.handleWoltWebhook({
                event_type: event_type || 'VENUE_OFFLINE_ALERT_TRIGGERED',
                venue_id: venue_id || '67dafe6e21bfd57729792a5f',
                restaurant_id,
                detected_at: new Date().toISOString()
            }, req.headers)
        } else if (platform === 'bolt') {
            result = await webhookService.handleBoltWebhook({
                provider_id: provider_id || 'HdM0NOW6xt',
                status: status || 'INACTIVE',
                is_active: status === 'ACTIVE',
                restaurant_id
            }, req.headers)
        } else if (platform === 'glovo') {
            result = await webhookService.handleGlovoWebhook({
                store_id: store_id || venue_id || '426935',
                status: status || (event_type === 'CLOSED' ? 'CLOSED' : 'OPEN'),
                is_open: event_type !== 'CLOSED' && status !== 'CLOSED' && status !== 'INACTIVE',
                restaurant_id
            }, req.headers)
        } else {
            return res.status(400).json({ success: false, error: 'Platform must be "wolt", "bolt", or "glovo"' })
        }
        res.json({ success: true, simulation: true, result })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ─── Violations endpoint (Supabase + Local Cache Fallback) ───
app.get('/api/violations', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100
        let { data, error } = await supabase
            .from('violations')
            .select('*, restaurants(name, city)')
            .order('detected_at', { ascending: false })
            .limit(limit)

        if (!data || data.length === 0 || error) {
            const local = loadViolationsCache() || []
            return res.json({ success: true, violations: local.slice(0, limit), source: 'local_cache' })
        }
        res.json({ success: true, violations: data, source: 'database' })
    } catch (err) {
        const local = loadViolationsCache() || []
        res.json({ success: true, violations: local, source: 'fallback_cache' })
    }
})

// ─── Stop Events endpoint (Supabase + Local Cache Fallback) ───
app.get('/api/stop-events', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100
        let { data, error } = await supabase
            .from('stop_events')
            .select('*, restaurants(name, city)')
            .order('stopped_at', { ascending: false })
            .limit(limit)

        if (!data || data.length === 0 || error) {
            const local = loadStopEventsCache() || []
            return res.json({ success: true, stop_events: local.slice(0, limit), source: 'local_cache' })
        }
        res.json({ success: true, stop_events: data, source: 'database' })
    } catch (err) {
        const local = loadStopEventsCache() || []
        res.json({ success: true, stop_events: local, source: 'fallback_cache' })
    }
})


// ─── Image Proxy (evită hotlink protection de pe Wolt/Glovo CDN) ───
app.get('/api/img', async (req, res) => {
    const { url } = req.query
    if (!url || typeof url !== 'string') return res.status(400).end()
    // Allow only known CDN domains
    const allowed = ['wolt.com', 'woltapi.com', 'glovoapp.com', 'deliveryhero.net',
        'fastly.net', 'cloudfront.net', 'imgix.net', 'foodplatform.net', 'storage.googleapis.com',
        'cdn.', 'images.', 'media.', 'img.', 'photos.']
    const isAllowed = allowed.some(d => url.includes(d)) || url.startsWith('https://')
    if (!isAllowed) return res.status(403).end()
    try {
        const REFERERS = {
            wolt: 'https://wolt.com/',
            glovo: 'https://glovoapp.com/',
            bolt: 'https://food.bolt.eu/',
        }
        const ref = url.includes('wolt') ? REFERERS.wolt : url.includes('glovo') ? REFERERS.glovo : REFERERS.bolt
        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36',
                'Referer': ref,
                'Accept': 'image/webp,image/avif,image/*,*/*',
                'Accept-Encoding': 'gzip, deflate, br',
            }
        })
        if (!resp.ok) return res.status(resp.status).end()
        const ct = resp.headers.get('content-type') || 'image/jpeg'
        res.set('Content-Type', ct)
        res.set('Cache-Control', 'public, max-age=86400')
        res.set('Access-Control-Allow-Origin', '*')
        const buf = await resp.arrayBuffer()
        res.send(Buffer.from(buf))
    } catch (err) {
        res.status(502).end()
    }
})

// Checkers
const realCheckers = {
    glovo: new GlovoChecker(),
    wolt: new WoltChecker(),
    bolt: new BoltChecker()
}

const simpleCheckers = {
    glovo: new SimpleChecker('glovo'),
    wolt: new SimpleChecker('wolt'),
    bolt: new SimpleChecker('bolt'),
    iiko: new IikoChecker()
}

function getChecker(platform, usePuppeteer = true) {
    if (usePuppeteer && realCheckers[platform]) {
        return realCheckers[platform]
    }
    return simpleCheckers[platform] || null
}


// ─── URL Discovery ───
app.post('/api/discover-urls', async (req, res) => {
    try {
        console.log('[API] URL discovery request...')
        const results = await discoverUrls()
        res.json({ success: true, results, count: results.length })
    } catch (error) {
        console.error('[API] Error during URL discovery:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

app.post('/api/auto-discover', async (req, res) => {
    try {
        const { restaurant } = req.body
        if (!restaurant) return res.status(400).json({ success: false, error: 'Restaurant body required' })
        const result = await discoverSingleRestaurant(restaurant)
        res.json(result)
    } catch (error) {
        console.error('[API] Auto-discover err:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// ─── Check single restaurant ───
app.post('/api/check-restaurant', async (req, res) => {
    try {
        const { restaurantId } = req.body
        console.log(`[API] Manual check for: ${restaurantId}`)

        if (!restaurantId) {
            return res.status(400).json({ success: false, error: 'restaurantId is required' })
        }

        const { data: restaurant, error: fetchErr } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .single()

        if (fetchErr || !restaurant) {
            return res.status(404).json({ success: false, error: 'Restaurant not found' })
        }

        console.log(`[API] Checking: ${restaurant.name}...`)

        const platforms = ['glovo', 'wolt', 'bolt', 'iiko']
        const results = []

        for (const platform of platforms) {
            const isConfigured = platform === 'iiko' ? !!restaurant.iiko_restaurant_id : !!restaurant[`${platform}_url`]
            if (!isConfigured) continue

            const checker = getChecker(platform)
            if (!checker) continue

            try {
                const result = await checker.check(restaurant)
                if (result) {
                    
                    results.push(result)
                    console.log(`  ${result.final_status === 'available' ? '[OK]' : '[ERR]'} ${platform}: ${result.final_status}`)
                } else {
                    results.push({ platform, final_status: 'error', error: 'Check responded with null' })
                }
            } catch (err) {
                console.error(`  [ERR] ${platform}: ${err.message}`)
                results.push({ platform, final_status: 'error', error: err.message })
            }
        }

        res.json({
            success: true,
            restaurant: restaurant.name,
            checks: results.length,
            results
        })
    } catch (error) {
        console.error('[API] Error checking restaurant:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// ─── Check ALL restaurants ───
app.post('/api/check-all', async (req, res) => {
    try {
        console.log('[API] Starting check of ALL restaurants...')

        const { data: restaurants, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('is_active', true)

        if (error) throw error

        console.log(`[API] Found ${restaurants.length} active restaurants`)
        
        if (!global.liveChecks) global.liveChecks = []

        // ─── Manual Check Status ───
        global.checkAllStatus = {
            isRunning: true,
            abort: false,
            totalRestaurants: restaurants.length,
            totalChecks: 0, // will count platforms
            current: 0,
            errors: 0,
            offline: 0,
            results: []
        };

        // Return early to the client so it doesn't timeout
        res.json({
            success: true,
            message: 'Check started in background',
            totalRestaurants: restaurants.length
        })

        const allResults = []
        let checked = 0, errors = 0

        for (const restaurant of restaurants) {
            const platforms = ['glovo', 'wolt', 'bolt', 'iiko']
            global.checkAllStatus.totalChecks += platforms.filter(p => p === 'iiko' ? !!restaurant.iiko_restaurant_id : !!restaurant[`${p}_url`]).length;
        }

        for (const restaurant of restaurants) {
            if (global.checkAllStatus?.abort) {
                console.log('[API] Check aborted by user.')
                break
            }

            const platforms = ['glovo', 'wolt', 'bolt', 'iiko']

            for (const platform of platforms) {
                if (global.checkAllStatus?.abort) break
                const isConfigured = platform === 'iiko' ? !!restaurant.iiko_restaurant_id : !!restaurant[`${platform}_url`]
                if (!isConfigured) continue

                const checker = getChecker(platform)
                if (!checker) continue

                try {
                    const result = await checker.check(restaurant)
                    if (result) {
                        const isAvailable = result.final_status === 'available'
                        
                        // Populate global.liveChecks so UI updates
                        const existingIdx = global.liveChecks.findIndex(c => c.restaurant_id === restaurant.id && c.platform === platform)
                        const newCheck = {
                            restaurant_id: restaurant.id,
                            platform: platform,
                            checked_at: new Date().toISOString(),
                            ui_is_open: isAvailable,
                            ui_can_order: isAvailable,
                            ui_is_greyed: !isAvailable,
                            ui_error_message: result.ui_error_message || result.raw_data?.scheduleInfo || null,
                            final_status: result.final_status
                        }
                        
                        if (existingIdx >= 0) {
                            global.liveChecks[existingIdx] = newCheck
                        } else {
                            global.liveChecks.push(newCheck)
                        }
                        saveLiveChecksCache(global.liveChecks)

                        const resItem = {
                            restaurant: restaurant.name,
                            platform,
                            status: result.final_status,
                            url: platform === 'iiko' ? 'API' : restaurant[`${platform}_url`]
                        }
                        
                        allResults.push(resItem)
                        global.checkAllStatus.results.push(resItem)
                        
                        if (!isAvailable) global.checkAllStatus.offline++
                        checked++
                    }
                } catch (err) {
                    errors++
                    global.checkAllStatus.errors++
                    global.checkAllStatus.results.push({ restaurant: restaurant.name, platform, status: 'error', error: err.message })
                    console.error(`  [ERR] ${restaurant.name} - ${platform}: ${err.message}`)
                } finally {
                    global.checkAllStatus.current++
                }

                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        console.log(`[API] Check complete: ${checked} checked, ${errors} errors`)
        if (global.checkAllStatus) {
            global.checkAllStatus.isRunning = false;
        }

    } catch (error) {
        console.error('[API] Error checking all restaurants:', error)
        if (global.checkAllStatus) {
            global.checkAllStatus.isRunning = false;
            global.checkAllStatus.errors++;
        }
    }
})

app.get('/api/check-status', (req, res) => {
    res.json({
        success: true,
        status: global.checkAllStatus || { isRunning: false, totalChecks: 0, current: 0, errors: 0, offline: 0, results: [] }
    })
})

app.post('/api/check-stop', (req, res) => {
    if (global.checkAllStatus) {
        global.checkAllStatus.abort = true
        global.checkAllStatus.isRunning = false
    }
    res.json({ success: true, message: 'Check stopped' })
})


// ─── DIAGNOSTIC: List all iiko groups/categories for a restaurant ───
// Use this to find which parentGroup IDs belong to a specific brand
// Then set iiko_config.allowed_category_ids = ["uuid1", "uuid2"] on that restaurant
app.get('/api/iiko-groups/:restaurantId', async (req, res) => {
    try {
        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', req.params.restaurantId)
            .single()
        if (error || !restaurant) return res.status(404).json({ error: 'Restaurant negăsit' })

        const iikoClient = new IikoClient(restaurant)
        const isAuth = await iikoClient.authenticate()
        if (!isAuth) return res.status(401).json({ error: 'iiko auth eșuat' })

        // Fetch raw nomenclature to get groups
        const apiUrl = iikoClient.apiUrl
        const response = await fetch(`${apiUrl}/api/1/nomenclature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${iikoClient.token}` },
            body: JSON.stringify({ organizationId: iikoClient.config.organization_id })
        })
        const data = await response.json()

        const groups = (data.groups || []).map(g => ({
            id: g.id,
            name: g.name,
            parentId: g.parentGroup || null,
            isDeleted: g.isDeleted || false,
            productCount: (data.products || []).filter(p => p.parentGroup === g.id && !p.isDeleted).length
        })).filter(g => !g.isDeleted && g.productCount > 0)
        .sort((a, b) => b.productCount - a.productCount)

        res.json({
            restaurant: restaurant.name,
            total_groups: groups.length,
            total_products: (data.products || []).filter(p => !p.isDeleted).length,
            current_allowed_category_ids: restaurant.iiko_config?.allowed_category_ids || null,
            groups
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ─── Sync Sales from iiko Deliveries API ───
app.post('/api/sync-sales', (req, res) => {
    if (salesSync.progress && salesSync.progress.isSyncing) {
        return res.status(400).json({ success: false, error: "Sync deja in progress" })
    }
    const daysBack = parseInt(req.body?.days) || 1
    console.log(`[API] Manual sales sync requested for ${daysBack} days`)
    
    // Fire and forget
    salesSync.syncSales(daysBack).catch(e => console.error("Sync background err:", e))
    
    return res.json({ success: true, message: `Sync started for ${daysBack} days in background` })
})

app.get('/api/sync-sales/status', (req, res) => {
    return res.json(salesSync.progress || { isSyncing: false, percent: 0 })
})

// ─── Health + Auto-Sync keepalive ───
// Designed to be pinged by an external cron (cron-job.org / UptimeRobot) every 20 min
// This keeps Render from sleeping AND triggers sync every 4h automatically
let lastAutoSyncAt = 0
app.get('/api/health-sync', (req, res) => {
    const now = Date.now()
    const hoursSinceSync = (now - lastAutoSyncAt) / (1000 * 60 * 60)
    if (!salesSync.progress?.isSyncing && hoursSinceSync >= 4) {
        lastAutoSyncAt = now
        console.log('[HEALTH-SYNC] Triggering auto sales sync (4h interval)...')
        salesSync.syncSales(7).catch(e => console.error('[HEALTH-SYNC] Sync err:', e))
        return res.json({ status: 'ok', action: 'sync_triggered', nextSyncIn: '4h' })
    }
    return res.json({ status: 'ok', action: 'none', hoursSinceLastSync: hoursSinceSync.toFixed(1) })
})

// Auto-sync intern pentru mediul local (rulează la fiecare oră)
setInterval(() => {
    if (!salesSync.progress?.isSyncing) {
        console.log('[AUTO-SYNC] Internal timer triggering sales sync...')
        salesSync.syncSales(2).catch(e => console.error('[AUTO-SYNC] Sync err:', e))
    }
}, 60 * 60 * 1000) // La fiecare oră


// ─── 1:1 SYNC Test (Iiko vs Aggregators) ───
app.post('/api/sync-test-all', async (req, res) => {
    try {
        console.log('[API] Starting Platform Availability Test (Background)...');
        const reportId = `rep_${Date.now()}`;
        
        // Return immediately
        res.json({ success: true, reportId, message: "Test started in background" });

        // Run in background
        (async () => {
            try {
                const { data: restaurants, error } = await supabase.from('restaurants').select('*').eq('is_active', true);
                if (error) return;

                const discrepancies = [];
                let checked = 0;

                for (const restaurant of restaurants) {
                    const platforms = ['glovo', 'wolt', 'bolt'];
                    for (const platform of platforms) {
                        const url = restaurant[`${platform}_url`];
                        if (!url) continue;

                        const checker = getChecker(platform);
                        if (!checker) continue;

                        try {
                            const result = await checker.check(restaurant);
                            if (result && result.final_status) {
                                checked++;
                                if (result.final_status === 'unavailable' || result.final_status === 'closed' || result.final_status === 'error') {
                                    discrepancies.push({
                                        restaurant: restaurant.name,
                                        platform,
                                        type: 'store_closed',
                                        message: `Status: ${result.final_status.toUpperCase()} ${result.scheduleInfo ? '('+result.scheduleInfo+')' : ''}`
                                    });
                                }
                                
                                if (result.stats && result.stats.indisponibilCount > 0) {
                                    discrepancies.push({
                                        restaurant: restaurant.name,
                                        platform,
                                        type: 'items_stopped',
                                        message: `${result.stats.indisponibilCount} produse marcate indisponibil pe ${platform}.`
                                    });
                                }
                            }
                        } catch (e) {
                            discrepancies.push({
                                restaurant: restaurant.name,
                                platform,
                                type: 'error',
                                message: `Eroare la scanare: ${e.message}`
                            });
                        }
                    }
                }

                const report = {
                    id: reportId,
                    created_at: new Date().toISOString(),
                    restaurants_checked: restaurants.length,
                    platforms_checked: checked,
                    discrepancies: discrepancies
                };

                await supabase.from('sync_reports').insert(report);
                console.log(`[API] Background test ${reportId} finished.`);
            } catch (err) {
                console.error("Background sync test failed:", err);
            }
        })();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
})

/**/
app.get('/api/sync-reports', async (req, res) => {
    try {
        const { data, error } = await supabase.from('sync_reports').select('*').order('created_at', { ascending: false }).limit(100);
        if (!error && data) {
            const mappedReports = data.map(r => ({
                id: r.id,
                tested_at: r.created_at,
                total_restaurants: r.restaurants_checked || 0,
                total_discrepancies: (r.discrepancies || []).length,
                results: r.discrepancies || []
            }));
            return res.json({ success: true, reports: mappedReports, count: mappedReports.length });
        }
    } catch (_) {
        // Supabase table absent or connection error, fallback to local file
    }
    const local = loadSyncReports();
    return res.json({ success: true, reports: local, count: local.length });
})

// ─── DELETE a single sync report ───
app.delete('/api/sync-reports/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id)
        const reports = loadSyncReports().filter(r => r.id !== id)
        fs.writeFileSync(SYNC_REPORTS_FILE, JSON.stringify(reports, null, 2))
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// ─── Loss Summary for a restaurant ───
app.get('/api/loss-summary/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params
        const { startDate, endDate } = req.query

        const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const end = endDate || new Date().toISOString()

        const summary = await lossCalculator.getLossSummary(restaurantId, start, end)

        res.json({ success: true, ...summary })
    } catch (error) {
        console.error('[API] Error getting loss summary:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// ─── Active stops ───
app.get('/api/active-stops', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('stop_events')
            .select(`
                *,
                restaurants (name, city, revenue_per_hour)
            `)
            .is('resumed_at', null)
            .order('stopped_at', { ascending: false })

        if (error) throw error

        // Calculate live loss for each active stop
        const stops = (data || []).map(stop => {
            const durationMinutes = (Date.now() - new Date(stop.stopped_at).getTime()) / (1000 * 60)
            const revenuePerHour = stop.restaurants?.revenue_per_hour || 100
            const estimatedLoss = (durationMinutes / 60) * revenuePerHour

            return {
                ...stop,
                duration_minutes: Math.round(durationMinutes),
                estimated_loss: parseFloat(estimatedLoss.toFixed(2))
            }
        })

        res.json({ success: true, stops, count: stops.length })
    } catch (error) {
        console.error('[API] Error getting active stops:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// ─── Rating history for a restaurant ───
app.get('/api/rating-history/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params
        const { platform, limit: limitParam } = req.query
        const limit = parseInt(limitParam) || 50

        let query = supabase
            .from('rating_history')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('recorded_at', { ascending: false })
            .limit(limit)

        if (platform) {
            query = query.eq('platform', platform)
        }

        const { data, error } = await query

        if (error) throw error

        res.json({ success: true, history: data || [], count: (data || []).length })
    } catch (error) {
        console.error('[API] Error getting rating history:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// ─── Radius history for a restaurant ───
app.get('/api/radius-history/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params
        const { platform, limit: limitParam } = req.query
        const limit = parseInt(limitParam) || 50

        let query = supabase
            .from('radius_history')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('recorded_at', { ascending: false })
            .limit(limit)

        if (platform) {
            query = query.eq('platform', platform)
        }

        const { data, error } = await query

        if (error) throw error

        res.json({ success: true, history: data || [], count: (data || []).length })
    } catch (error) {
        console.error('[API] Error getting radius history:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// ─── Violations list ───
app.get('/api/violations', async (req, res) => {
    try {
        const { restaurantId, platform, severity, resolved, limit: limitParam } = req.query
        const limit = parseInt(limitParam) || 50

        let query = supabase
            .from('violations')
            .select('*')
            .order('detected_at', { ascending: false })
            .limit(limit)

        if (restaurantId) query = query.eq('restaurant_id', restaurantId)
        if (platform) query = query.eq('platform', platform)
        if (severity) query = query.eq('severity', severity)
        if (resolved !== undefined) query = query.eq('is_resolved', resolved === 'true')

        const { data, error } = await query

        if (error) throw error

        res.json({ success: true, violations: data || [], count: (data || []).length })
    } catch (error) {
        console.error('[API] Error getting violations:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// ─── Stop events with filters ───
app.get('/api/stop-events', async (req, res) => {
    try {
        const { restaurantId, platform, startDate, endDate, limit: limitParam } = req.query
        const limit = parseInt(limitParam) || 100

        let query = supabase
            .from('stop_events')
            .select(`
                *,
                restaurants (name, city, revenue_per_hour)
            `)
            .order('stopped_at', { ascending: false })
            .limit(limit)

        if (restaurantId) query = query.eq('restaurant_id', restaurantId)
        if (platform) query = query.eq('platform', platform)
        if (startDate) query = query.gte('stopped_at', startDate)
        if (endDate) query = query.lte('stopped_at', endDate)

        const { data, error } = await query

        if (error) throw error

        res.json({ success: true, events: data || [], count: (data || []).length })
    } catch (error) {
        console.error('[API] Error getting stop events:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// ─── Health check ───
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'aggregator-monitor-api',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    })
})

// ─── COMPETITIVE INTELLIGENCE ───
const competitorScraper = new CompetitorScraper()
let competitiveSearchRunning = false

// SSE helper — store active progress streams by searchId
const progressStreams = new Map()

function emitProgress(searchId, event) {
    const key = String(searchId)
    const clients = progressStreams.get(key) || []
    const data = `data: ${JSON.stringify(event)}\n\n`
    clients.forEach(res => {
        try { res.write(data) } catch (_) { }
    })
}

// GET /api/competitive/progress/:searchId  — SSE stream
app.get('/api/competitive/progress/:searchId', (req, res) => {
    const { searchId } = req.params
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    if (!progressStreams.has(searchId)) progressStreams.set(searchId, [])
    progressStreams.get(searchId).push(res)

    req.on('close', () => {
        const list = progressStreams.get(searchId) || []
        progressStreams.set(searchId, list.filter(r => r !== res))
    })
})

// Run a single search (fire-and-forget + SSE progress)
app.post('/api/competitive/run-search', async (req, res) => {
    try {
        const { searchId } = req.body
        if (!searchId) return res.status(400).json({ error: 'searchId required' })

        const { data: search } = await supabase
            .from('competitive_searches')
            .select('*')
            .eq('id', searchId)
            .single()

        if (!search) return res.status(404).json({ error: 'Search config not found' })

        const { data: brands } = await supabase.from('brands').select('name')
        const ourBrandNames = brands?.map(b => b.name) || []

        // Calc total steps for progress
        let cities = search.cities || []
        if (search.auto_cities !== false && search.brand_id) {
            const { data: rests } = await supabase
                .from('restaurants').select('city').eq('brand_id', search.brand_id).eq('is_active', true)
            const autoCities = [...new Set(rests?.map(r => r.city).filter(Boolean))]
            if (autoCities.length > 0) cities = autoCities
        }
        const platforms = (search.platforms || ['glovo', 'wolt', 'bolt'])
        const totalSteps = cities.length * platforms.length

        res.json({ success: true, message: `Starting: "${search.search_term}"`, totalSteps, cities, platforms })

        // Give the UI time to connect to the EventSource before starting
        setTimeout(() => {
            competitorScraper.runSearch(search, ourBrandNames, (event) => {
                emitProgress(searchId, event)
            }).then(() => {
                emitProgress(searchId, { type: 'done', totalSteps })
            }).catch(err => {
                emitProgress(searchId, { type: 'error', message: err.message })
            })
        }, 1500)

    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Run ALL active searches
app.post('/api/competitive/run-all', async (req, res) => {
    if (competitiveSearchRunning) {
        return res.json({ success: false, message: 'Search already running' })
    }
    competitiveSearchRunning = true
    res.json({ success: true, message: 'All competitive searches started' })
    competitorScraper.runAllSearches((event) => {
        if (event.searchId) emitProgress(event.searchId, event)
    })
        .catch(console.error)
        .finally(() => { competitiveSearchRunning = false })
})

// Stop ALL active searches
app.post('/api/competitive/stop-all', async (req, res) => {
    competitorScraper.stopAllSearches()
    res.json({ success: true, message: 'Sending stop signal to scraper...' })
})

// Scrape products for a specific restaurant on-demand
app.post('/api/competitive/scrape-restaurant', async (req, res) => {
    try {
        const { url, name, restaurantId } = req.body
        if (!url || !name) return res.status(400).json({ error: 'url and name required' })
        let products = []
        let platform = 'wolt'
        
        if (url.includes('glovo')) {
            platform = 'glovo'
            products = await competitorScraper.scrapeGlovoProducts(url, name)
        } else {
            platform = 'wolt'
            products = await competitorScraper.scrapeWoltProducts(url, name)
        }

        if (products.length > 0 && restaurantId) {
            const today = new Date().toISOString().split('T')[0]
            await supabase.from('competitor_products').delete().eq('competitor_restaurant_id', restaurantId)
            await supabase.from('competitor_products').insert(
                products.map(p => ({
                    competitor_restaurant_id: restaurantId,
                    category: p.category, product_name: p.name, price: p.price,
                    is_promoted: p.isPromoted || false,
                    image_url: p.image_url || null,
                    description: p.description || null,
                    snapshot_date: today, platform, city: null
                }))
            )
        }
        res.json({ success: true, count: products.length, products, platform })
    } catch (err) {
        console.error('[API] /competitive/scrape-restaurant error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// Get latest results for a search
app.get('/api/competitive/results/:searchId', async (req, res) => {
    try {
        const { searchId } = req.params
        const { limit = 50 } = req.query

        const { data: snapshots } = await supabase
            .from('competitor_snapshots')
            .select(`
                *,
                competitor_restaurants (
                    *,
                    competitor_products (*)
                )
            `)
            .eq('search_id', searchId)
            .order('scraped_at', { ascending: false })
            .limit(parseInt(limit))

        res.json({ success: true, snapshots: snapshots || [] })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Get all search configs
app.get('/api/competitive/searches', async (req, res) => {
    try {
        const { data } = await supabase
            .from('competitive_searches')
            .select('*, brands(name, logo_url)')
            .order('created_at', { ascending: false })
        res.json({ success: true, searches: data || [] })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Create/update search config
app.post('/api/competitive/searches', async (req, res) => {
    try {
        const { id, brand_id, search_term, platforms, cities, notes, is_active, auto_cities, glovo_category, wolt_category } = req.body

        if (id) {
            const { data } = await supabase.from('competitive_searches')
                .update({ brand_id, search_term, platforms, cities, notes, is_active, auto_cities, glovo_category, wolt_category, updated_at: new Date().toISOString() })
                .eq('id', id).select().single()
            res.json({ success: true, search: data })
        } else {
            const { data } = await supabase.from('competitive_searches')
                .insert({ brand_id, search_term, platforms, cities, notes, is_active: true, auto_cities, glovo_category, wolt_category })
                .select().single()
            res.json({ success: true, search: data })
        }
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Get competitor price history — includes restaurant name + category
app.get('/api/competitive/price-history', async (req, res) => {
    try {
        const { product, platform, city, days = 30 } = req.query
        const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

        let query = supabase
            .from('competitor_products')
            .select(`
                product_name, price, category, platform, city, snapshot_date, is_promoted,
                competitor_restaurants ( name, url )
            `)
            .gte('snapshot_date', since)
            .order('snapshot_date', { ascending: false })

        if (product) query = query.ilike('product_name', `%${product}%`)
        if (platform) query = query.eq('platform', platform)
        if (city) query = query.eq('city', city)

        const { data } = await query.limit(500)

        // Flatten: add restaurant_name to each row
        const history = (data || []).map(row => ({
            ...row,
            restaurant_name: row.competitor_restaurants?.name || 'Unknown',
            restaurant_url: row.competitor_restaurants?.url || null,
            competitor_restaurants: undefined
        }))

        res.json({ success: true, history })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ─── Competitive HISTORY: all snapshots with date range filter ───
app.get('/api/competitive/history', async (req, res) => {
    try {
        const { searchId, from, to, city, platform } = req.query
        const since = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
        const until = to || new Date().toISOString().split('T')[0]

        let query = supabase
            .from('competitor_snapshots')
            .select(`
                id, platform, city, snapshot_date, total_results, scraped_at, search_id,
                competitive_searches ( id, search_term, brands ( name, logo_url ) ),
                competitor_restaurants (
                    id, name, url, rank_position, rating, delivery_time_min, delivery_time_max,
                    logo_url,
                    competitor_products ( product_name, price, category )
                )
            `)
            .gte('snapshot_date', since)
            .lte('snapshot_date', until)
            .order('snapshot_date', { ascending: false })

        if (searchId) query = query.eq('search_id', searchId)
        if (city) query = query.eq('city', city)
        if (platform) query = query.eq('platform', platform)

        const { data } = await query.limit(200)
        res.json({ success: true, snapshots: data || [], from: since, to: until })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ─── BRAND STATS: full history for a specific competitor name ───
app.get('/api/competitive/brand-stats', async (req, res) => {
    try {
        const { name, city } = req.query
        if (!name) return res.status(400).json({ error: 'name required' })

        // All appearances of this restaurant (by name, partial match)
        const { data: restaurants } = await supabase
            .from('competitor_restaurants')
            .select(`
                id, name, url, logo_url, rank_position, rating, delivery_time_min, delivery_time_max,
                competitor_snapshots!inner ( platform, city, snapshot_date, search_id ),
                competitor_products ( product_name, price, category, snapshot_date, is_promoted )
            `)
            .ilike('name', `%${name}%`)
            .order('id', { ascending: false })
            .limit(500)

        const appearances = (restaurants || [])
            .filter(r => !city || r.competitor_snapshots?.city === city)
            .map(r => ({
                id: r.id,
                name: r.name,
                url: r.url,
                rank_position: r.rank_position,
                rating: r.rating,
                delivery_time_min: r.delivery_time_min,
                delivery_time_max: r.delivery_time_max,
                platform: r.competitor_snapshots?.platform,
                city: r.competitor_snapshots?.city,
                snapshot_date: r.competitor_snapshots?.snapshot_date,
                products: r.competitor_products || []
            }))
            .sort((a, b) => b.snapshot_date?.localeCompare(a.snapshot_date || '') || 0)

        // Aggregate stats
        const ratings = appearances.filter(a => a.rating).map(a => a.rating)
        const avgRating = ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : null
        const allProducts = appearances.flatMap(a => a.products.map(p => ({ ...p, date: a.snapshot_date, platform: a.platform })))

        // Price history per product name
        const priceHistory = {}
        allProducts.forEach(p => {
            if (!p.product_name || !p.price) return
            if (!priceHistory[p.product_name]) priceHistory[p.product_name] = []
            priceHistory[p.product_name].push({ date: p.date, price: p.price, platform: p.platform })
        })

        // Rank history — grouped by day+platform+city, with all unique ranks per group
        const rankGroups = {}
        appearances.forEach(a => {
            const day = (a.snapshot_date || '').split('T')[0]  // normalize to YYYY-MM-DD
            const key = `${day}|${a.platform}|${a.city}`
            if (!rankGroups[key]) {
                rankGroups[key] = { date: day, platform: a.platform, city: a.city, ranks: [], ratings: [], count: 0 }
            }
            rankGroups[key].count++
            if (a.rank_position && !rankGroups[key].ranks.includes(a.rank_position)) rankGroups[key].ranks.push(a.rank_position)
            if (a.rating && !rankGroups[key].ratings.includes(a.rating)) rankGroups[key].ratings.push(a.rating)
        })
        const rankHistory = Object.values(rankGroups)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(g => ({ ...g, ranks: g.ranks.sort((a, b) => a - b) }))

        res.json({
            success: true,
            name: appearances[0]?.name || name,
            url: appearances[0]?.url,
            logo_url: restaurants?.find(r => r.logo_url)?.logo_url || null,
            avgRating,
            totalAppearances: appearances.length,
            firstSeen: rankHistory[rankHistory.length - 1]?.date,
            lastSeen: rankHistory[0]?.date,
            cities: [...new Set(appearances.map(a => a.city).filter(Boolean))],
            platforms: [...new Set(appearances.map(a => a.platform).filter(Boolean))],
            rankHistory,
            priceHistory,
            appearances,
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ─── All unique competitors aggregated (for Competitors page) ───
app.get('/api/competitors', async (req, res) => {
    try {
        const { searchId, platform, city } = req.query

        let query = supabase
            .from('competitor_restaurants')
            .select(`
                id, name, url, logo_url, rank_position, rating,
                competitor_snapshots!inner ( platform, city, snapshot_date, search_id )
            `)
            .order('id', { ascending: false })
            .limit(2000)

        if (searchId) query = query.eq('competitor_snapshots.search_id', searchId)
        if (platform) query = query.eq('competitor_snapshots.platform', platform)
        if (city) query = query.eq('competitor_snapshots.city', city)

        const { data: rows, error } = await query
        if (error) return res.status(500).json({ error: error.message })

        // Group by normalized name
        const byName = {}
            ; (rows || []).forEach(r => {
                const key = r.name?.toLowerCase().trim()
                if (!key) return
                if (!byName[key]) byName[key] = { name: r.name, appearances: [], logo_url: null }
                const grp = byName[key]
                if (!grp.logo_url && r.logo_url) grp.logo_url = r.logo_url
                grp.appearances.push({
                    rank: r.rank_position, rating: r.rating,
                    platform: r.competitor_snapshots?.platform,
                    city: r.competitor_snapshots?.city,
                    date: r.competitor_snapshots?.snapshot_date,
                    url: r.url,
                    productCount: (r.competitor_products || []).length
                })
            })

        const competitors = Object.values(byName).map(grp => {
            const ranks = grp.appearances.filter(a => a.rank).map(a => a.rank)
            const ratings = grp.appearances.filter(a => a.rating).map(a => a.rating)
            const cities = [...new Set(grp.appearances.map(a => a.city).filter(Boolean))]
            const platforms = [...new Set(grp.appearances.map(a => a.platform).filter(Boolean))]
            const totalProducts = grp.appearances.reduce((s, a) => s + a.productCount, 0)
            const latestUrl = grp.appearances.find(a => a.url)?.url
            return {
                name: grp.name,
                logo_url: grp.logo_url,
                url: latestUrl,
                appearances: grp.appearances.length,
                bestRank: ranks.length ? Math.min(...ranks) : null,
                avgRating: ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : null,
                cities, platforms,
                productCount: totalProducts,
                lastSeen: grp.appearances.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.date
            }
        }).sort((a, b) => (a.bestRank || 999) - (b.bestRank || 999))

        res.json({ success: true, competitors, total: competitors.length })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ─── CSV Export: competitive snapshots ───
app.get('/api/competitive/export-csv', async (req, res) => {
    try {
        const { searchId, from, to, city, platform } = req.query
        const since = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
        const until = to || new Date().toISOString().split('T')[0]

        let query = supabase
            .from('competitor_snapshots')
            .select(`
                id, platform, city, snapshot_date, scraped_at,
                competitor_restaurants (
                    name, url, rank_position, rating, is_promoted,
                    delivery_time_min, delivery_time_max,
                    competitor_products ( product_name, category, price )
                )
            `)
            .gte('snapshot_date', since)
            .lte('snapshot_date', until)
            .order('snapshot_date', { ascending: false })

        if (searchId) query = query.eq('search_id', searchId)
        if (city) query = query.eq('city', city)
        if (platform) query = query.eq('platform', platform)

        const { data } = await query.limit(2000)

        // Flatten to CSV rows
        const rows = []
        for (const snap of (data || [])) {
            for (const r of (snap.competitor_restaurants || [])) {
                if ((r.competitor_products || []).length === 0) {
                    rows.push({
                        data: snap.snapshot_date,
                        platform: snap.platform,
                        oras: snap.city,
                        restaurant: r.name,
                        rank: r.rank_position || '',
                        rating: r.rating || '',
                        promovat: r.is_promoted ? 'Da' : 'Nu',
                        livrare_min: r.delivery_time_min || '',
                        livrare_max: r.delivery_time_max || '',
                        categorie_produs: '',
                        produs: '',
                        pret: '',
                    })
                } else {
                    for (const p of (r.competitor_products || [])) {
                        rows.push({
                            data: snap.snapshot_date,
                            platform: snap.platform,
                            oras: snap.city,
                            restaurant: r.name,
                            rank: r.rank_position || '',
                            rating: r.rating || '',
                            promovat: r.is_promoted ? 'Da' : 'Nu',
                            livrare_min: r.delivery_time_min || '',
                            livrare_max: r.delivery_time_max || '',
                            categorie_produs: p.category || '',
                            produs: p.product_name || '',
                            pret: p.price || '',
                        })
                    }
                }
            }
        }

        const header = ['Data', 'Platforma', 'Oras', 'Restaurant', 'Rank', 'Rating', 'Promovat', 'Livrare min', 'Livrare max', 'Categorie', 'Produs', 'Pret (RON)']
        const csvLines = [header.join(',')]
        for (const row of rows) {
            const values = Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`)
            csvLines.push(values.join(','))
        }

        const filename = `competitive_${since}_${until}.csv`
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.send('\uFEFF' + csvLines.join('\n')) // BOM for Excel UTF-8
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ─── Daily Scheduler: auto-run all active competitive searches ───
let schedulerActive = true
let schedulerHour = 7 // 07:00 default
let lastScheduledRun = null
let nextScheduledRun = null

function computeNextRun(hour) {
    const now = new Date()
    const next = new Date()
    next.setHours(hour, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next
}

async function runAllActiveSearches() {
    console.log('[SCHEDULER] Starting daily competitive run...')
    lastScheduledRun = new Date().toISOString()

    try {
        const { data: searches } = await supabase
            .from('competitive_searches')
            .select('*')
            .eq('is_active', true)

        if (!searches || searches.length === 0) {
            console.log('[SCHEDULER] No active searches found.')
            return { ran: 0, errors: [] }
        }

        const results = []
        const scraper = new CompetitorScraper()

        for (const search of searches) {
            try {
                const cities = search.cities || []
                const platforms = search.platforms || ['wolt', 'glovo']

                for (const city of cities) {
                    for (const platform of platforms) {
                        try {
                            console.log(`[SCHEDULER] ${search.search_term} / ${city} / ${platform}`)
                            const competitors = await scraper.scrape({
                                searchTerm: search.search_term,
                                city,
                                platform,
                                glovoCategory: search.glovo_category,
                                woltCategory: search.wolt_category,
                            })
                            // Save snapshot
                            const { data: snap } = await supabase
                                .from('competitor_snapshots')
                                .insert({
                                    search_id: search.id,
                                    platform,
                                    city,
                                    snapshot_date: new Date().toISOString().split('T')[0],
                                    scraped_at: new Date().toISOString(),
                                })
                                .select('id')
                                .single()

                            if (snap?.id && competitors?.length) {
                                for (const comp of competitors) {
                                    const { data: rest } = await supabase
                                        .from('competitor_restaurants')
                                        .insert({
                                            snapshot_id: snap.id,
                                            name: comp.name,
                                            url: comp.url,
                                            rank_position: comp.rank,
                                            rating: comp.rating,
                                            is_promoted: comp.isPromoted || false,
                                            delivery_time_min: comp.deliveryTimeMin,
                                            delivery_time_max: comp.deliveryTimeMax,
                                        })
                                        .select('id')
                                        .single()

                                    if (rest?.id && comp.products?.length) {
                                        await supabase.from('competitor_products').insert(
                                            comp.products.map(p => ({
                                                competitor_restaurant_id: rest.id,
                                                product_name: p.name,
                                                category: p.category,
                                                price: p.price,
                                            }))
                                        )
                                    }
                                }
                            }
                            results.push({ search: search.search_term, city, platform, count: competitors?.length || 0 })
                        } catch (e) {
                            console.error(`[SCHEDULER] Error: ${e.message}`)
                            results.push({ search: search.search_term, city, platform, error: e.message })
                        }
                    }
                }
                // small delay between searches
                await new Promise(r => setTimeout(r, 2000))
            } catch (e) {
                console.error(`[SCHEDULER] Search ${search.id} error: ${e.message}`)
            }
        }
        console.log(`[SCHEDULER] Done. ${results.length} tasks.`)
        return { ran: results.filter(r => !r.error).length, errors: results.filter(r => r.error).length, results }
    } catch (e) {
        console.error('[SCHEDULER] Fatal error:', e.message)
        return { ran: 0, errors: [e.message] }
    }
}

// Schedule daily run
function scheduleDailyRun() {
    nextScheduledRun = computeNextRun(schedulerHour)
    const delay = nextScheduledRun - Date.now()
    console.log(`[SCHEDULER] Next run scheduled at ${nextScheduledRun.toLocaleString('ro-RO')} (in ${Math.round(delay / 60000)}min)`)
    setTimeout(async () => {
        if (schedulerActive) {
            await runAllActiveSearches()
            scheduleDailyRun() // reschedule for next day
        }
    }, delay)
}

scheduleDailyRun()

// Manual trigger endpoint
app.post('/api/competitive/scheduler/run-now', async (req, res) => {
    try {
        console.log('[SCHEDULER] Manual trigger received')
        res.json({ success: true, message: 'Scheduler pornit. Rulează în background...' })
        await runAllActiveSearches()
    } catch (err) {
        console.error('[SCHEDULER] Error on manual run:', err.message)
    }
})

// Scheduler status
app.get('/api/competitive/scheduler/status', (req, res) => {
    res.json({
        active: schedulerActive,
        hour: schedulerHour,
        lastRun: lastScheduledRun,
        nextRun: nextScheduledRun?.toISOString() || null,
    })
})

// Toggle scheduler on/off
app.post('/api/competitive/scheduler/config', (req, res) => {
    const { active, hour } = req.body
    if (typeof active === 'boolean') schedulerActive = active
    if (typeof hour === 'number' && hour >= 0 && hour <= 23) {
        schedulerHour = hour
        scheduleDailyRun()
    }
    res.json({ success: true, active: schedulerActive, hour: schedulerHour })
})

// ─── DELIVERY ZONE: auto-import all restaurants from DB, geocode and create configs ───
app.post('/api/delivery-zone/import-restaurants', async (req, res) => {
    try {
        const { brand = 'Sushi Master', platform = 'wolt', overwrite = false } = req.body

        // Fetch all active restaurants
        const { data: restaurants, error } = await supabase
            .from('restaurants')
            .select('id, name, city, address, brand_id, brands(name)')
            .eq('is_active', true)
            .order('city')

        if (error) return res.status(500).json({ error: error.message })
        if (!restaurants?.length) return res.json({ success: true, created: 0, message: 'No active restaurants found' })

        // If not overwrite, skip already-configured restaurants
        const { data: existing } = await supabase
            .from('delivery_zone_configs')
            .select('name')

        const existingNames = new Set((existing || []).map(e => e.name))

        let created = 0, skipped = 0, failed = 0
        const results = []

        for (const r of restaurants) {
            const configName = `${r.name} - ${r.city}`
            if (!overwrite && existingNames.has(configName)) { skipped++; continue }

            // Geocode address using Nominatim (free, no API key)
            let lat, lon
            try {
                const query = encodeURIComponent(`${r.address || r.name}, ${r.city}, Romania`)
                const geoRes = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ro`,
                    { headers: { 'User-Agent': 'AggregatorMonitor/1.0' }, signal: AbortSignal.timeout(5000) }
                )
                const geoData = await geoRes.json()
                if (geoData[0]) {
                    lat = parseFloat(geoData[0].lat)
                    lon = parseFloat(geoData[0].lon)
                } else {
                    // Fallback: use city center coordinates
                    const CITY_COORDS = {
                        'Bucharest': [44.4268, 26.1025], 'Cluj-Napoca': [46.7712, 23.6236],
                        'Timisoara': [45.7489, 21.2087], 'Iasi': [47.1585, 27.6014],
                        'Brasov': [45.6427, 25.5887], 'Ploiesti': [44.9451, 26.0147],
                        'Bacau': [46.5670, 26.9146], 'Targu Mures': [46.5386, 24.5544],
                        'Braila': [45.2692, 27.9574], 'Baia Mare': [47.6669, 23.5847],
                        'Sibiu': [45.7983, 24.1256], 'Constanta': [44.1733, 28.6383],
                        'Galati': [45.4353, 28.0080], 'Pitesti': [44.8565, 24.8692],
                        'Craiova': [44.3190, 23.7949],
                    }
                    const cc = CITY_COORDS[r.city]
                    if (cc) { lat = cc[0]; lon = cc[1] } else { failed++; continue }
                }
            } catch { failed++; continue }

            // Build addresses array: 1-5 km offsets in 4 cardinal directions
            // We store the CENTER (restaurant location) as address, the 1-5km offsets are computed at check time
            const addresses = [{
                text: r.address || `${r.name}, ${r.city}`,
                lat, lon,
                source: 'auto'
            }]

            // Generate 1-5km points right away with reverse geocoding
            for (let km = 1; km <= 5; km++) {
                // Approximate 1km = 0.009009 deg lat, roughly correct for Romania
                const ptLat = lat + (km * 0.009009)
                const ptLon = lon // just going north for simplicity on auto-import
                let streetName = `Punct la ${km} km (Auto)`
                try {
                    const rGeo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${ptLat}&lon=${ptLon}&format=json`, { headers: { 'User-Agent': 'AggregatorMonitor/1.0' }, signal: AbortSignal.timeout(3000) })
                    const rd = await rGeo.json()
                    if (rd && rd.address) {
                        let str = rd.address.road || rd.address.pedestrian || ''
                        if (rd.address.house_number) str += ' ' + rd.address.house_number
                        if (!str && rd.address.suburb) str = rd.address.suburb 
                        if (str) streetName = `${str} (~${km}km)`
                    }
                } catch {}
                await new Promise(res => setTimeout(res, 500))

                addresses.push({
                    text: streetName,
                    lat: ptLat,
                    lon: ptLon,
                    geocoding: false,
                    is_auto: true,
                    km_distance: km
                })
            }

            // Upsert config
            const payload = {
                name: configName,
                restaurant_name: r.name,
                brand: r.brands?.name || brand,
                city: r.city,
                address: r.address || `${r.name}, ${r.city}`,
                platform,
                addresses,
                is_active: true,
            }

            if (overwrite && existingNames.has(configName)) {
                const { error: err1 } = await supabase.from('delivery_zone_configs').update(payload).eq('name', configName)
                if (err1) console.error('Update Error:', err1)
            } else {
                const { error: err2 } = await supabase.from('delivery_zone_configs').insert(payload)
                if (err2) {
                    console.error('Insert Error:', err2)
                    failed++
                    continue
                }
            }

            created++
            results.push({ name: configName, lat, lon })

            // Rate limit Nominatim: max 1 req/sec
            await new Promise(r => setTimeout(r, 1100))
        }

        res.json({ success: true, created, skipped, failed, total: restaurants.length, configs: results })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ─── DELIVERY ZONE: check delivery price + time at specific coordinates ───
app.post('/api/delivery-zone/check', async (req, res) => {
    try {
        const { lat, lon, brand, city, platform = 'wolt', km } = req.body
        if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' })

        if (platform === 'wolt') {
            const woltRes = await fetch(
                `https://restaurant-api.wolt.com/v1/pages/restaurants?lat=${lat}&lon=${lon}`,
                { headers: { 'Accept': 'application/json', 'Accept-Language': 'ro' }, signal: AbortSignal.timeout(8000) }
            )
            if (!woltRes.ok) return res.json({ km, lat, lon, available: false, error: `Wolt API ${woltRes.status}` })

            const d = await woltRes.json()
            const venSection = d.sections?.find(s => s.name === 'restaurants-delivering-venues')
            const allVenues = venSection?.items || []

            // Find our brand venue
            const brandLower = (brand || '').toLowerCase()
            const match = allVenues.find(item => {
                const name = (item.venue?.name || '').toLowerCase()
                return name.includes(brandLower) || brandLower.includes(name.split(' ')[0])
            })

            if (!match?.venue) {
                return res.json({ km, lat, lon, available: false, restaurant_name: null, delivery_time_min: null, delivery_time_max: null, delivery_fee: null })
            }

            const v = match.venue
            // estimate_range is a string like "55-65"
            const estParts = typeof v.estimate_range === 'string' ? v.estimate_range.split('-').map(Number) : []
            const deliveryFeeRaw = v.delivery_specs?.delivery_pricing?.fee || v.delivery_price_int
            return res.json({
                km, lat, lon,
                available: true,
                restaurant_name: v.name,
                logo_url: v.brand_image?.url || null,
                delivery_time_min: estParts[0] || null,
                delivery_time_max: estParts[1] || estParts[0] || null,
                delivery_fee: deliveryFeeRaw != null ? (deliveryFeeRaw / 100) : null,
                rating: v.rating?.score || null,
                slug: v.slug || null,
            })
        }

        // Glovo not yet supported for coordinate-based delivery check
        res.json({ km, lat, lon, available: false, error: 'Glovo delivery zone check not yet supported' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ─── POS Products (Fetch menu nomenclature from iiko) ───
app.get('/api/pos/products', async (req, res) => {
    try {
        const { city, brand, restaurant_id } = req.query
        
        let query = supabase.from('restaurants').select('id, name, city, brand:brand_id(name), iiko_config').not('iiko_config', 'is', null).eq('is_active', true)
        
        if (restaurant_id) query = query.eq('id', restaurant_id)
        else {
            if (city && city !== 'all') query = query.eq('city', city)
            if (brand && brand !== 'all') {
                const { data: brandData } = await supabase.from('brands').select('id').eq('name', brand).single()
                if (brandData) query = query.eq('brand_id', brandData.id)
            }
        }
        
        const { data: restaurants, error: dbErr } = await query
        if (dbErr) throw dbErr
        if (!restaurants || restaurants.length === 0) {
            return res.json({ success: true, results: [], message: 'No POS records found for selected filters' })
        }
        
        const results = []
        for (const rest of restaurants) {
            const client = new IikoClient(rest)
            const products = await client.getProducts()
            products.forEach(p => {
                results.push({
                    restaurant_id: rest.id,
                    restaurant_name: rest.name,
                    city: rest.city,
                    brand_name: rest.brand?.name || '',
                    ...p
                })
            })
        }
        res.json({ success: true, results })
    } catch (err) {
        console.error('[API] Error fetching pos products:', err)
        res.status(500).json({ success: false, error: err.message })
    }
})


// ─── POS Discrepancies (Syrve/iiko vs Aggregators) ───
app.get('/api/pos/discrepancies', async (req, res) => {
    try {
        console.log('[API] Checking POS discrepancies...')
        const today = new Date().toISOString().split('T')[0]
        
        // 1. Fetch all configurable restaurants
        const { data: restaurants } = await supabase
            .from('restaurants')
            .select('id, name, city, iiko_config')
            .not('iiko_config', 'is', null)
            .eq('is_active', true)

        if (!restaurants || restaurants.length === 0) {
            return res.json({ success: true, results: [], message: 'No POS records found' })
        }

        const results = []
        for (const rest of restaurants) {
            const client = new IikoClient(rest)
            const stopList = await client.getStopList()
            // Map true POS stopped ids by name loosely
            const posStoppedNames = stopList.map(s => s.name.toLowerCase().trim())
            
            // 2. Fetch today's platform snapshots
            const { data: snaps } = await supabase
                .from('own_product_snapshots')
                .select('product_name, platform, is_available')
                .eq('restaurant_id', rest.id)
                .eq('snapshot_date', today)

            const discrepancies = []
            
            // Only check discrepancies if we have platform snapshots
            if (snaps && snaps.length > 0) {
                // If the item is stopped in POS but active on platform
                posStoppedNames.forEach(posName => {
                    const activeOnPlatforms = snaps.filter(s => 
                        s.is_available && 
                        (s.product_name.toLowerCase().includes(posName) || posName.includes(s.product_name.toLowerCase()))
                    )
                    activeOnPlatforms.forEach(found => {
                        discrepancies.push({
                            type: 'pos_stopped_but_active_on_platform',
                            product_name: found.product_name,
                            platform: found.platform,
                            message: `Stare critică: "${found.product_name}" este OPRIT în casa de marcat, dar clienții îl pot comanda pe ${found.platform.toUpperCase()}.`
                        })
                    })
                })

                // Additional logic: what if it's inactive on platform, but ACTIVE in POS?
                const { data: yesterdaySnaps } = await supabase
                    .from('own_product_snapshots')
                    .select('product_name, platform')
                    .eq('restaurant_id', rest.id)
                    .eq('snapshot_date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
                    
                if (yesterdaySnaps) {
                    const todayKeys = new Set(snaps.map(s => `${s.platform}|${s.product_name}`))
                    const stoppedOnPlatform = yesterdaySnaps.filter(p => !todayKeys.has(`${p.platform}|${p.product_name}`))
                    
                    stoppedOnPlatform.forEach(platStop => {
                        const lcName = platStop.product_name.toLowerCase()
                        const posHasItStopped = posStoppedNames.some(pName => lcName.includes(pName) || pName.includes(lcName))
                        
                        if (!posHasItStopped) {
                            discrepancies.push({
                                type: 'active_in_pos_but_stopped_on_platform',
                                product_name: platStop.product_name,
                                platform: platStop.platform,
                                message: `Nesincronizare: "${platStop.product_name}" este DISPONIBIL în bucătărie, dar manual oprit (inactiv) pe ${platStop.platform.toUpperCase()}.`
                            })
                        }
                    })
                }
            }

            results.push({
                restaurant: rest.name,
                pos_stopped_count: stopList.length,
                pos_stopped_items: posStoppedNames,
                discrepancies
            })
        }

        // ─── Format and Save to History (so it appears in /stop-istoric) ───
        try {
            const historyResults = {}
            let totalMissing = 0

            results.forEach(r => {
                if (r.discrepancies?.length > 0) {
                    // Find restaurant ID by name to keep structure
                    const restObj = restaurants.find(x => x.name === r.restaurant)
                    const rid = restObj?.id || r.restaurant
                    
                    if (!historyResults[rid]) {
                        historyResults[rid] = {
                            name: r.restaurant,
                            city: restObj?.city || 'Necunoscut',
                            byPlatform: {}
                        }
                    }

                    r.discrepancies.forEach(d => {
                        const plat = d.platform || 'glovo'
                        if (!historyResults[rid].byPlatform[plat]) {
                            historyResults[rid].byPlatform[plat] = []
                        }
                        historyResults[rid].byPlatform[plat].push({ name: d.product_name || 'Eroare flux' })
                        totalMissing++
                    })
                }
            })

            // Only insert into history if we actually checked something
            if (results.length > 0) {
                await supabase.from('product_stop_history').insert({
                    reference_date: 'iiko POS (Syrve)',
                    check_date: today,
                    checked_at: new Date().toISOString(),
                    missing_count: totalMissing,
                    restaurant_count: results.length,
                    results: historyResults
                })
            }
        } catch (histErr) {
            console.error('[API POS] Failed to save history:', histErr)
        }

        res.json({ success: true, results })
    } catch (err) {
        console.error('[API POS]', err)
        res.status(500).json({ error: err.message })
    }
})

// ─── AI Chat — răspunsuri bazate pe date reale din Supabase + LLM ───
app.post('/api/ai-chat', async (req, res) => {
    const { message = '', lang = 'ro' } = req.body
    const q = message.toLowerCase().trim()
    const ro = lang !== 'en'

    try {
        if (/invat|inveti|inteligent|idiot|openai|creier|mai destept/i.test(q)) {
             if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
                 return res.json({ reply: "🤖 Salut! Am înțeles comanda. Ca să pot răspunde inteligent la ORICE întrebare ca o mini-versiune a AI-ului care m-a creat, trebuie să pui o cheie `GEMINI_API_KEY=AIzaSy...` sau `OPENAI_API_KEY=sk-...` în fișierul `workers/.env` și să restartezi serverul de backend.\n\n✅ Până atunci, folosesc logica mea programată pentru a răspunde la comenzi de analiză!" });
             } else {
                 return res.json({ reply: "🧠 Sunt online și conectat la creierul meu AI! Acum pot răspunde la orice întrebare!" });
             }
        }

        // ── LLM Real-time Context Fetching ──
        const { data: rests } = await supabase.from('restaurants').select('name, city, is_active')
        const activeCount = rests?.filter(r => r.is_active).length || 0
        const { data: stops } = await supabase.from('stop_events').select('restaurants(name), platform, estimated_loss_amount').is('resumed_at', null)
        const stopCount = stops?.length || 0
        const totalLoss = stops?.reduce((s, l) => s + Number(l.estimated_loss_amount || 0), 0) || 0

        // ── Concurenți / prețuri ──
        if (/(?:concurent|competitor|ieftin|scump|pre[tț]|price|cheaper|sushi|suhsi|shushi|roll|maki|meniu|menu|burger|pizza|wolt|glovo|bolt)/i.test(q) && q.split(' ').length < 15) {
            let searchedKeys = getSmartSearchWords(q).filter(w => w.length > 2 && !['unde', 'gasesc', 'găsesc', 'gsesc', 'caut', 'vreau', 'ce', 'are', 'au', 'arată', 'arata', 'concurent', 'competitor', 'ieftin', 'scump', 'pret', 'preț', 'price', 'cheaper', 'wolt', 'glovo', 'bolt', 'care', 'este', 'cel', 'mai', 'bun', 'un', 'o', 'niște', 'de', 'la', 'pe', 'din', 'any', 'the', 'is', 'how', 'show', 'me'].includes(w))
            
            // Auto-correct spelling
            if (searchedKeys.includes('suhsi') || searchedKeys.includes('shushi')) searchedKeys.push('sushi')

            if (searchedKeys.length > 0) {
                let qryCols = 'platform, product_name, price, city, competitor_restaurants(name, url)';
                let prodsQuery = supabase.from('competitor_products').select(qryCols).order('price', { ascending: true })
                // search all words roughly
                for (let k of searchedKeys) prodsQuery = prodsQuery.ilike('product_name', `%${k}%`)
                
                const { data: prods } = await prodsQuery.limit(20)

                const cheapest = prods?.[0]
                const avgPrice = prods?.length ? (prods.reduce((s, p) => s + Number(p.price || 0), 0) / prods.length).toFixed(2) : null
                
                let ownInfoLine = '';
                let ownQuery = supabase.from('own_product_snapshots').select('product_name, price, city, brands(name)')
                
                // pentru o mai buna acoperire la brandul curent (Sushi Master), eliminam cuvantul "sushi" care lipseste din numele produselor proprii
                const ownSearchKeys = searchedKeys.filter(k => k !== 'sushi' && k !== 'suhsi')
                if (ownSearchKeys.length > 0) {
                    for (let k of ownSearchKeys) ownQuery = ownQuery.ilike('product_name', `%${k}%`)
                } else {
                    for (let k of searchedKeys) ownQuery = ownQuery.ilike('product_name', `%${k}%`)
                }

                let { data: ownProds } = await ownQuery.limit(5)
                if (ownProds && ownProds.length > 0) {
                    let ownList = ownProds.slice(0, 3).map(o => {
                        const bName = (Array.isArray(o.brands) ? o.brands[0]?.name : o.brands?.name) || 'Sushi Master'
                        return `**${o.product_name}** (${o.price} lei de la ${bName} în ${o.city})`
                    }).join(', ')
                    ownInfoLine = `\n\n🎯 **Avem și noi!** Printre brandurile voastre am găsit: ${ownList}.`
                } else {
                    ownInfoLine = `\n\n🎯 Analizând brandurile voastre, se pare că nu aveți un produs exact ca "${searchedKeys.join(' ')}".`
                }

                if (prods && prods.length > 0) {
                    const pListUnique = []
                    const pSet = new Set()
                    for (const p of prods) {
                        const url = p.competitor_restaurants?.url || '#'
                        const brand = p.competitor_restaurants?.name || p.platform
                        const key = p.product_name + url
                        if (!pSet.has(key)) {
                            pSet.add(key)
                            pListUnique.push(`- [${p.product_name}](${url}) de la **${brand}** la ${p.price} lei (${p.city})`)
                            if (pListUnique.length >= 15) break;
                        }
                    }
                    const pList = pListUnique.join('\n')
                    return res.json({ reply: ro
                    ? `🍣 Am găsit ${pListUnique.length} rezultate unice pentru "${searchedKeys.join(' ')}". Cel mai ieftin este **${cheapest.product_name}** la **${cheapest.price} lei** (${cheapest.platform}, în ${cheapest.city}). Preț mediu pe zonă: **${avgPrice} lei**.\n\nIată rezultatele:\n${pList}${ownInfoLine}`
                    : `🍣 Found ${pListUnique.length} unique results for "${searchedKeys.join(' ')}". Cheapest: **${cheapest.product_name}** at **${cheapest.price} RON** (${cheapest.platform}, in ${cheapest.city}). Avg: **${avgPrice} RON**.\n\nResults:\n${pList}${ownInfoLine}`
                    })
                } else {
                    return res.json({ reply: ro
                        ? `🍣 Din păcate nu scanez în acest moment niciun produs concurent care să conțină exact cuvintele "${searchedKeys.join(' ')}".\n\nÎncearcă alte cuvinte sau asigură-te că am date proaspete de pe piață!`
                        : `🍣 Unfortunately I couldn't find any competitor products matching "${searchedKeys.join(' ')}".\n\nTry other keywords!`
                    })
                }
            } else {
                // If it matched the initial regex but we couldn't extract good search keys (or they just typed "concurent")
                const { data: snaps } = await supabase.from('competitor_snapshots').select('platform, total_results').order('scraped_at', { ascending: false }).limit(10)
                const { data: restsComp } = await supabase.from('competitor_restaurants').select('name, rating, rank_position').order('rank_position', { ascending: true }).limit(5)

                const totalCompetitors = snaps?.reduce((s, sn) => s + (sn.total_results || 0), 0) || 0
                const platforms = [...new Set(snaps?.map(s => s.platform) || [])].join(', ')
                const topRest = restsComp?.[0]?.name
                return res.json({ reply: ro
                    ? `🍣 Monitorizez **${totalCompetitors} concurenți** pe **${platforms || 'Wolt, Glovo'}**. ${topRest ? `Top restaurant: **${topRest}**.` : ''}`
                    : `🍣 Tracking **${totalCompetitors} competitors** on **${platforms || 'Wolt, Glovo'}**. ${topRest ? `Top: **${topRest}**.` : ''}`
                })
            }
        }

        // ── Rule-based Answers (Instant response for common platform questions) ──
        if (q.includes('zona de livrare') || q.includes('zone de livrare') || q.includes('zone livrare') || /delivery.*zone/.test(q)) {
            const orasMatch = q.match(/(bucure[sș]ti|bra[sș]ov|cluj|timi[sș]oara|ia[sș]i|constan[tț]a|sibiu)/i);
            const oras = orasMatch ? orasMatch[0] : 'orașul dorit';
            return res.json({ reply: ro ? `📍 Ca să verifici zona de livrare pentru **${oras}**, mergi în meniul la secțiunea **Zone Livrare**.\n\nAcolo vei găsi radarul promoțiilor și diferențele de preț per zone!` : `📍 To check delivery zones, go to the **Delivery Zone** section in the menu.` })
        }

        if (/oprit|offline|stop|inchis|closed|down/i.test(q)) {
            let activeStopsMsg = ''
            if (stopCount > 0) {
                const stopDetails = stops.slice(0, 3).map(s => `- **${s.restaurants?.name || 'Necunoscut'}** pe ${s.platform} (${s.estimated_loss_amount || 0} RON pierderi)`).join('\n')
                activeStopsMsg = `\n\n⚠️ **Avem ${stopCount} restaurante oprite ACUM:**\n${stopDetails}`
            } else {
                activeStopsMsg = `\n\n✅ Totul funcționează normal chiar acum. Nu avem restaurante oprite.`
            }
            return res.json({ reply: `🛑 **Monitorizare Opriri:** \nAplicația verifică ${activeCount} restaurante din 5 în 5 minute.${activeStopsMsg}\n\nPentru detalii complete, mergi la secțiunea **Stop Control** din stânga!` })
        }

        if (/functioneaza|face|work|do/i.test(q)) {
            return res.json({ reply: `Salut! Sistemul face 3 lucruri majore:\n1. 📊 **Prețuri:** Monitorizează concurența.\n2. 🛑 **Disponibilitate:** Verifică opririle pe platforme.\n3. 📍 **Zone:** Analizează metrici locale.\nAlege orice secțiune din meniu!` })
        }

        // ── LLM (Mini-versiune Antigravity) - Gemini / OpenAI / Free Fallback ──
        
        const systemPrompt = `Ești Smart Assistant, creat pentru aplicația de monitorizare food delivery. 
Avem: ${activeCount} restaurante, ${stopCount} opriri active, pierderi ${totalLoss} lei.
Orașele principale: ${[...new Set((rests || []).map(r => r.city))].filter(Boolean).slice(0,5).join(', ')}.

Trebuie să răspunzi inteligent, profesionist dar politicos și direct (cel mai des în română, dar și în engleză dacă ești întrebat) la orice întrebare primești de la utilizator. Ești expert tehnic.
Dacă utilizatorul întreabă ceva general, tehnologic sau din afara platformei (ex: cum funcționează un anumit lucru, glume, o rețetă, cod), răspunde exact ca un asistent general și foarte inteligent. Nu refuza nicio solicitare rezonabilă.`

        if (process.env.GEMINI_API_KEY) {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`
            const body = {
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + '\n\nUser Question:\n' + message }] }
                ]
            }
            const response = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await response.json()
            const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (replyText) {
                return res.json({ reply: replyText })
            }
        } else if (process.env.OPENAI_API_KEY) {
            const openaiUrl = `https://api.openai.com/v1/chat/completions`
            const body = {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]
            }
            const response = await fetch(openaiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify(body) })
            const data = await response.json()
            const replyText = data?.choices?.[0]?.message?.content
            if (replyText) {
                return res.json({ reply: replyText })
            }
        } else {
            // Fără chei API: Folosim model gratuit public (Pollinations AI / OpenAI format) pentru a rezolva "faci tu în locul meu" direct
            const pollinationsUrl = `https://text.pollinations.ai/openai`
            const body = {
                model: 'gemini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]
            }
            try {
                const response = await fetch(pollinationsUrl, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(10000)
                })
                const data = await response.json()
                const replyText = data?.choices?.[0]?.message?.content || (ro ? "Am un mic delay pe conexiunea gratuită. Încearcă din nou." : "Delay on free AI endpoint. Try again.")
                return res.json({ reply: replyText })
            } catch (pollErr) {
                 return res.json({ reply: ro ? "Serverul AI gratuit a picat. E nevoie să pui GEMINI_API_KEY / OPENAI_API_KEY în .env." : "Free AI server down. You need to set GEMINI or OPENAI key." })
            }
        }

    } catch (err) {
        console.error('[AI Chat]', err.message)
        return res.json({ reply: ro ? `🍣 Eroare tehnică, scuze! Încearcă din nou. 🥢` : `🍣 Technical error, sorry! Try again. 🥢` })
    }
})

app.get('/api/reports/verifications', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        // Try Supabase first
        let { data, count, error } = await supabase
            .from('monitoring_checks')
            .select(`
                *,
                restaurants (
                    name,
                    city
                )
            `, { count: 'exact' })
            .order('checked_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (!data || data.length === 0) {
            // Fallback to in-memory liveChecks / cache
            let checks = global.liveChecks || [];
            if (!checks || checks.length === 0) {
                checks = loadLiveChecksCache();
            }
            const { data: rests } = await supabase.from('restaurants').select('id, name, city');
            const restMap = new Map((rests || []).map(r => [r.id, r]));

            const enriched = (checks || []).map((c, idx) => {
                const r = restMap.get(c.restaurant_id) || {};
                return {
                    id: c.id || `chk_${idx}_${c.restaurant_id}_${c.platform}`,
                    checked_at: c.checked_at || new Date().toISOString(),
                    platform: c.platform,
                    final_status: c.final_status || (c.ui_is_open ? 'available' : 'closed'),
                    ui_error_message: c.ui_error_message || (c.final_status === 'error' ? 'Eroare scanare' : null),
                    restaurants: {
                        name: r.name || 'Necunoscut',
                        city: r.city || '-'
                    }
                };
            }).sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));

            const total = enriched.length;
            const pagedData = enriched.slice(offset, offset + limit);

            return res.json({
                success: true,
                data: pagedData,
                total,
                page,
                totalPages: Math.ceil(total / limit) || 1
            });
        }

        res.json({
            success: true,
            data,
            total: count || data.length,
            page,
            totalPages: Math.ceil((count || data.length) / limit) || 1
        });
    } catch (error) {
        console.error('[API] Error fetching verification reports:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PORT is declared at line 37
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API Server running on port ${PORT}`)
    console.log(`[API] Server is listening on 0.0.0.0:${PORT} for Render compatibility`)
    console.log(`  POST /api/own-brands/scrape-all        - Scrape ALL own brand restaurants`)
    console.log(`  POST /api/own-brands/scrape-restaurant  - Scrape ONE restaurant`)
    console.log(`  GET  /api/own-brands/products           - Get products for a restaurant`)
    console.log(`  GET  /api/own-brands/stopped-products   - Detect products on STOP`)
})

// ─────────────────────────────────────────────────────────────────
// OWN BRAND PRODUCTS — Scrape & Monitor
// ─────────────────────────────────────────────────────────────────

// Scrape produse pentru TOATE restaurantele brandurilor proprii
app.post('/api/own-brands/scrape-all', async (req, res) => {
    try {
        console.log('[API] Starting own-brand full product scrape...')
        const result = await ownBrandScraper.scrapeAllBrands()
        res.json(result)
    } catch (err) {
        console.error('[API] own-brands/scrape-all error:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})

// Scrape produse pentru UN singur restaurant (on-demand)
app.post('/api/own-brands/scrape-restaurant', async (req, res) => {
    try {
        const { restaurantId } = req.body
        if (!restaurantId) return res.status(400).json({ success: false, error: 'restaurantId required' })

        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .select('id, name, city, brand_id, wolt_url, glovo_url, bolt_url, brands(name, logo_url)')
            .eq('id', restaurantId)
            .single()

        if (error || !restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' })

        const result = await ownBrandScraper.scrapeRestaurant(restaurant)
        res.json({ success: true, ...result })
    } catch (err) {
        console.error('[API] own-brands/scrape-restaurant error:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})

// Preia produsele scanate pentru un restaurant (cel mai recent snapshot)
app.get('/api/own-brands/products', async (req, res) => {
    try {
        const { restaurant_id, brand_id, platform, date, limit = 200 } = req.query
        const today = date || new Date().toISOString().split('T')[0]

        let query = supabase.from('own_product_snapshots')
            .select(`
                id, product_name, category, price, image_url, description,
                is_available, is_promoted, platform, city, snapshot_date,
                restaurants ( id, name, city, brand_id, brands(name, logo_url) )
            `)
            .eq('snapshot_date', today)
            .order('category')
            .order('product_name')
            .limit(parseInt(limit))

        if (restaurant_id) query = query.eq('restaurant_id', restaurant_id)
        if (brand_id) query = query.eq('brand_id', brand_id)
        if (platform) query = query.eq('platform', platform)

        const { data, error } = await query
        if (error) return res.status(500).json({ success: false, error: error.message })

        // Group by restaurant
        const grouped = {}
        ;(data || []).forEach(p => {
            const rId = p.restaurants?.id || 'unknown'
            if (!grouped[rId]) {
                grouped[rId] = {
                    restaurant_id: rId,
                    restaurant_name: p.restaurants?.name || '?',
                    city: p.city,
                    brand_name: p.restaurants?.brands?.name || '?',
                    logo_url: p.restaurants?.brands?.logo_url || null,
                    platform: p.platform,
                    snapshot_date: p.snapshot_date,
                    products: []
                }
            }
            grouped[rId].products.push({
                id: p.id,
                name: p.product_name,
                category: p.category,
                price: p.price,
                image_url: p.image_url,
                description: p.description,
                is_available: p.is_available,
                is_promoted: p.is_promoted,
            })
        })

        res.json({ success: true, date: today, restaurants: Object.values(grouped) })
    } catch (err) {
        console.error('[API] own-brands/products error:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})

// Detecteaza produsele care au intrat pe STOP (erau ieri, nu sunt azi)
app.get('/api/own-brands/stopped-products', async (req, res) => {
    try {
        const { brand_id } = req.query
        const stopped = await ownBrandScraper.detectStoppedProducts(brand_id || null)
        res.json({ success: true, count: stopped.length, stopped })
    } catch (err) {
        console.error('[API] own-brands/stopped-products error:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/nomenclature?orgId=xxx&server=smashme-co.syrve.online
app.get('/api/nomenclature', async (req, res) => {
    const { orgId, server } = req.query;
    if (!orgId) return res.status(400).json({ error: 'orgId is required' });

    try {
        // Syrve API always uses the same base URL, but we need different API keys per brand
        const isSmash = server && server.includes('smashme')
        const IIKO_BASE = 'https://api-eu.syrve.live/api/1';
        const apiLogin = isSmash
            ? '124d0880f4b44717b69ee21d45fc2656'
            : 'a1fe30cdeb934aa0af01b6a35244b7f0';

        const tokenResp = await fetch(`${IIKO_BASE}/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin })
        });
        if (!tokenResp.ok) return res.status(502).json({ error: 'iiko auth failed' });
        const { token } = await tokenResp.json();

        const nomResp = await fetch(`${IIKO_BASE}/nomenclature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ organizationId: orgId })
        });
        if (!nomResp.ok) return res.status(502).json({ error: 'iiko nomenclature failed' });
        const nomData = await nomResp.json();

        res.json({
            products: (nomData.products || []).filter(p => p.imageLinks?.length > 0 || p.name),
            groups: (nomData.groups || []).filter(g => g.imageLinks?.length > 0 || g.name)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── SETTINGS & MANAGEMENT ENDPOINTS ───

// GET /api/settings/restaurants - List all restaurants with brand name and full configs
app.get('/api/settings/restaurants', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('restaurants')
            .select('*, brands(name)')
            .order('name', { ascending: true })

        if (error) throw error
        res.json({ success: true, count: data.length, restaurants: data })
    } catch (err) {
        console.error('[API] /api/settings/restaurants error:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})

// PUT /api/settings/restaurants/:id - Update restaurant URLs and configuration
app.put('/api/settings/restaurants/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { name, city, address, glovo_url, wolt_url, bolt_url, iiko_restaurant_id, is_active, working_hours, revenue_per_hour } = req.body

        const updatePayload = {}
        if (name !== undefined) updatePayload.name = name
        if (city !== undefined) updatePayload.city = city
        if (address !== undefined) updatePayload.address = address
        if (glovo_url !== undefined) updatePayload.glovo_url = glovo_url || null
        if (wolt_url !== undefined) updatePayload.wolt_url = wolt_url || null
        if (bolt_url !== undefined) updatePayload.bolt_url = bolt_url || null
        if (iiko_restaurant_id !== undefined) updatePayload.iiko_restaurant_id = iiko_restaurant_id || null
        if (is_active !== undefined) updatePayload.is_active = !!is_active
        if (working_hours !== undefined) updatePayload.working_hours = working_hours
        if (revenue_per_hour !== undefined) updatePayload.revenue_per_hour = Number(revenue_per_hour) || 100

        const { data, error } = await supabase
            .from('restaurants')
            .update(updatePayload)
            .eq('id', id)
            .select('*, brands(name)')
            .single()

        if (error) throw error
        res.json({ success: true, restaurant: data })
    } catch (err) {
        console.error('[API] /api/settings/restaurants/:id error:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/telegram/test - Send a test telegram message
app.post('/api/telegram/test', async (req, res) => {
    try {
        const { botToken, chatId, message } = req.body
        const token = botToken || process.env.TELEGRAM_BOT_TOKEN
        if (!token) {
            return res.status(400).json({ success: false, error: 'Telegram Bot Token lipsește.' })
        }
        if (!chatId) {
            return res.status(400).json({ success: false, error: 'Chat ID / ID Grup Telegram lipsește.' })
        }

        const text = message || `🔔 <b>Aggregator 2.0 Test Notificare</b>\n\nConexiunea Telegram Bot a fost verificată cu succes la ${new Date().toLocaleTimeString('ro-RO')}!`
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML'
            })
        })

        const data = await response.json()
        if (!data.ok) {
            return res.status(400).json({ success: false, error: data.description || 'Eroare Telegram API' })
        }

        res.json({ success: true, message: 'Mesaj de test trimis cu succes pe Telegram!', data })
    } catch (err) {
        console.error('[API] /api/telegram/test error:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/stop-events/:id/resolve - Mark a stop event as resolved
app.post('/api/stop-events/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params
        const { reason } = req.body
        const now = new Date().toISOString()

        // Fetch the event to calculate duration
        const { data: stopEvent, error: fetchErr } = await supabase
            .from('stop_events')
            .select('*, restaurants(name, city, revenue_per_hour, working_hours)')
            .eq('id', id)
            .single()

        if (fetchErr || !stopEvent) {
            return res.status(404).json({ success: false, error: 'Evenimentul de stop nu a fost găsit.' })
        }

        const stoppedTime = new Date(stopEvent.stopped_at).getTime()
        const durationMinutes = Math.max(1, Math.round((Date.now() - stoppedTime) / 60000))
        const rate = Number(stopEvent.restaurants?.revenue_per_hour) || 100
        const loss = parseFloat(((durationMinutes / 60) * rate).toFixed(2))

        const { data: updated, error: updateErr } = await supabase
            .from('stop_events')
            .update({
                resumed_at: now,
                duration_minutes: durationMinutes,
                estimated_loss_amount: loss,
                resolved_reason: reason || 'Marcat ca rezolvat din interfață'
            })
            .eq('id', id)
            .select()
            .single()

        if (updateErr) throw updateErr

        // Notify Telegram if telegram_group_id is present
        const telegramId = stopEvent.restaurants?.working_hours?.telegram_group_id || stopEvent.restaurants?.telegram_group_id
        if (telegramId && process.env.TELEGRAM_BOT_TOKEN) {
            const text = `✅ <b>STOP REZOLVAT — ${stopEvent.platform?.toUpperCase()}</b>\n📍 ${stopEvent.restaurants?.name} · ${stopEvent.restaurants?.city}\n⏱ Durată totală downtime: <b>${durationMinutes} min</b>\n💸 Pierdere calculată: <b>${loss} RON</b>\n${reason ? `📝 Notă: ${reason}` : ''}`
            fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'HTML' })
            }).catch(console.error)
        }

        res.json({ success: true, event: updated, duration_minutes: durationMinutes, estimated_loss: loss })
    } catch (err) {
        console.error('[API] /api/stop-events/:id/resolve error:', err.message)
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/settings/trigger-monitoring - Manually start a monitoring cycle
app.post('/api/settings/trigger-monitoring', async (req, res) => {
    try {
        if (global.runMonitoringCycle) {
            global.runMonitoringCycle().catch(err => console.error('[API] Trigger monitoring error:', err))
            return res.json({ success: true, message: 'Ciclu de monitorizare pornit în fundal' })
        }
        res.json({ success: true, message: 'Verificare inițiată' })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// POST /api/settings/trigger-sales-sync - Manually trigger sales sync from iiko
app.post('/api/settings/trigger-sales-sync', async (req, res) => {
    try {
        const days = req.body?.days || 2
        salesSync.syncSales(days).catch(err => console.error('[API] Trigger sales sync error:', err))
        res.json({ success: true, message: `Sincronizare vânzări pentru ultimele ${days} zile pornită în fundal` })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// GET /api/settings/status - System status, active counts, and schedules
app.get('/api/settings/status', async (req, res) => {
    try {
        const { count: totalCount } = await supabase.from('restaurants').select('*', { count: 'exact', head: true })
        const { count: activeCount } = await supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true)

        res.json({
            success: true,
            status: 'online',
            uptime_seconds: Math.floor(process.uptime()),
            total_restaurants: totalCount || 0,
            active_restaurants: activeCount || 0,
            monitoring_schedule: ['11:00', '13:00', '17:00', '18:00', '19:00'],
            sales_sync_schedule: ['04:00', '14:00', '22:00', '23:30'],
            iiko_cloud_api: 'https://api-eu.syrve.live',
            live_checks_cached: (global.liveChecks || []).length
        })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

