import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { supabase } from './supabase.js'
import { saveLiveChecksCache, loadLiveChecksCache } from '../utils/cache.js'
import { sendTelegramMessage } from '../notifications/telegram.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..', '..', '..')
const TSV_FILE = path.resolve(ROOT_DIR, 'data', 'authoritative_store_ids.tsv')
const AUDIT_FILE = path.resolve(ROOT_DIR, 'data', 'webhook-events-log.json')

class WebhookService {
    constructor() {
        this.storeMappings = []
        this.woltIdMap = new Map() // wolt_venue_id -> storeInfo
        this.boltIdMap = new Map() // bolt_provider_id -> storeInfo
        this.glovoIdMap = new Map() // glovo_store_id -> storeInfo
        this.recentEvents = []     // Last 100 webhook events in memory
        this.stats = {
            wolt: { total: 0, offline_alerts: 0, recovered_alerts: 0, rejection_alerts: 0, reviews: 0, other: 0 },
            bolt: { total: 0, status_changes: 0, orders: 0, other: 0 },
            glovo: { total: 0, status_changes: 0, other: 0 }
        }

        this.loadStoreMappings()
        this.loadAuditLog()
    }

    loadStoreMappings() {
        try {
            if (!fs.existsSync(TSV_FILE)) {
                console.warn('[WEBHOOK] authoritative_store_ids.tsv not found at:', TSV_FILE)
                return
            }

            const content = fs.readFileSync(TSV_FILE, 'utf8')
            const lines = content.split('\n').filter(Boolean)
            if (lines.length < 2) return

            const headers = lines[0].split('\t').map(h => h.trim())
            this.storeMappings = []
            this.woltIdMap.clear()
            this.boltIdMap.clear()
            this.glovoIdMap.clear()

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split('\t')
                const row = {}
                headers.forEach((h, idx) => {
                    row[h] = (cols[idx] || '').trim()
                })

                const woltId = row['WOLT ID']
                const boltId = row['BOLT ID']
                const storeName = row['Store Name']
                const cityCode = row['City Code']
                const deliveryType = row['Delivery Type'] || 'Standard'

                const storeRecord = {
                    cityCode,
                    storeName,
                    address: row['Address'],
                    srl: row['SRL'],
                    glovoId: row['GLOVO Store ID'],
                    deliveryType,
                    woltId: (woltId && woltId !== '-') ? woltId : null,
                    boltId: (boltId && boltId !== '-') ? boltId : null
                }

                this.storeMappings.push(storeRecord)

                if (storeRecord.woltId) {
                    this.woltIdMap.set(storeRecord.woltId.toLowerCase(), storeRecord)
                }
                if (storeRecord.boltId) {
                    this.boltIdMap.set(storeRecord.boltId.toLowerCase(), storeRecord)
                }
                if (storeRecord.glovoId && storeRecord.glovoId !== '-') {
                    this.glovoIdMap.set(storeRecord.glovoId.toString().trim(), storeRecord)
                }
            }

            console.log(`[WEBHOOK] Loaded ${this.storeMappings.length} store mappings (${this.woltIdMap.size} Wolt IDs, ${this.boltIdMap.size} Bolt IDs, ${this.glovoIdMap.size} Glovo IDs)`)
        } catch (err) {
            console.error('[WEBHOOK] Error loading store mappings:', err)
        }
    }

    loadAuditLog() {
        try {
            if (fs.existsSync(AUDIT_FILE)) {
                const data = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'))
                this.recentEvents = Array.isArray(data) ? data.slice(0, 100) : []
            }
        } catch (_) {
            this.recentEvents = []
        }
    }

    saveAuditLog() {
        try {
            fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true })
            fs.writeFileSync(AUDIT_FILE, JSON.stringify(this.recentEvents.slice(0, 100), null, 2))
        } catch (_) {}
    }

    recordEvent(event) {
        const fullEvent = {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            timestamp: new Date().toISOString(),
            ...event
        }
        this.recentEvents.unshift(fullEvent)
        if (this.recentEvents.length > 100) {
            this.recentEvents = this.recentEvents.slice(0, 100)
        }
        this.saveAuditLog()
        return fullEvent
    }

    /**
     * Resolves a restaurant from DB or local cache matching a given Wolt or Bolt identifier
     */
    async resolveRestaurant({ woltVenueId, boltProviderId, externalVenueId, restaurantId }) {
        try {
            // 1. Direct restaurantId match
            if (restaurantId) {
                const { data } = await supabase.from('restaurants').select('*').eq('id', restaurantId).maybeSingle()
                if (data) return data
            }

            // 2. Fetch all active restaurants from Supabase
            const { data: dbRests, error } = await supabase.from('restaurants').select('*').eq('is_active', true)
            const restaurants = (!error && dbRests) ? dbRests : []

            // Match by Wolt Venue ID
            if (woltVenueId) {
                const cleanWoltId = woltVenueId.toLowerCase().trim()

                // Check URL substring in DB
                const matchInUrl = restaurants.find(r => r.wolt_url && r.wolt_url.toLowerCase().includes(cleanWoltId))
                if (matchInUrl) return matchInUrl

                // Check authoritative TSV map
                const tsvRecord = this.woltIdMap.get(cleanWoltId)
                if (tsvRecord) {
                    const matchedByTsv = this._matchRestaurantWithTsvRecord(restaurants, tsvRecord)
                    if (matchedByTsv) return matchedByTsv
                }
            }

            // Match by Bolt Provider ID
            if (boltProviderId) {
                const cleanBoltId = boltProviderId.toLowerCase().trim()

                const matchInUrl = restaurants.find(r => r.bolt_url && r.bolt_url.toLowerCase().includes(cleanBoltId))
                if (matchInUrl) return matchInUrl

                const tsvRecord = this.boltIdMap.get(cleanBoltId)
                if (tsvRecord) {
                    const matchedByTsv = this._matchRestaurantWithTsvRecord(restaurants, tsvRecord)
                    if (matchedByTsv) return matchedByTsv
                }
            }

            // Match by external_venue_id (often iiko organization ID or store code)
            if (externalVenueId) {
                const cleanExtId = externalVenueId.toLowerCase().trim()
                const matchExt = restaurants.find(r => 
                    (r.iiko_restaurant_id && r.iiko_restaurant_id.toLowerCase() === cleanExtId) ||
                    (r.name && r.name.toLowerCase().includes(cleanExtId))
                )
                if (matchExt) return matchExt
            }

            return null
        } catch (err) {
            console.error('[WEBHOOK] Error resolving restaurant:', err)
            return null
        }
    }

    _matchRestaurantWithTsvRecord(restaurants, tsvRecord) {
        const brand = tsvRecord.storeName.toLowerCase()
        const cCode = tsvRecord.cityCode.toUpperCase()
        const addr = (tsvRecord.address || '').toLowerCase()

        return restaurants.find(r => {
            const rName = r.name.toLowerCase()
            const rCity = (r.city || '').toLowerCase()

            // Brand check
            if (brand.includes('poki') && !rName.includes('poki')) return false
            if (brand.includes('love sushi') && !rName.includes('love sushi')) return false
            if (brand.includes('smash me') && !rName.includes('smash me')) return false
            if (brand.includes('roll master') && (rName.includes('poki') || rName.includes('love sushi') || rName.includes('smash me'))) return false

            // City code check
            if (cCode === 'BUC') {
                if (!rName.includes('buc') && !rCity.includes('buc')) return false
                if (addr.includes('halelor') && (rName.includes('unirii') || rName.includes('halelor'))) return true
                if (addr.includes('1 decembrie') && (rName.includes('titan') || rName.includes('1 decembrie'))) return true
                if (addr.includes('ceaikovski') && rName.includes('ceaikovski')) return true
                if (addr.includes('iuliu maniu') && (rName.includes('cora') || rName.includes('lujerului') || rName.includes('maniu'))) return true
                return true
            }

            const cityMap = {
                'BCU': 'bacau', 'BRL': 'braila', 'BRV': 'brasov', 'BTO': 'botosani',
                'CRB': 'balotesti', 'CRV': 'craiova', 'GLT': 'galati', 'PIT': 'pitesti',
                'PTN': 'piatra', 'SBU': 'sibiu', 'SCV': 'suceava', 'TGM': 'mures', 'TUL': 'tulcea',
                'CLJ': 'cluj', 'CTA': 'constanta', 'TIM': 'timisoara', 'ORD': 'oradea', 'IAS': 'iasi'
            }

            const expectedCity = cityMap[cCode]
            if (expectedCity && (rName.includes(expectedCity) || rCity.includes(expectedCity))) {
                return true
            }

            return false
        })
    }

    /**
     * Updates global.liveChecks in memory and saves cache to data/live-checks-cache.json
     */
    updateLiveCheck(restaurantId, platform, { isOpen, status, errorMessage }) {
        if (!global.liveChecks) {
            global.liveChecks = loadLiveChecksCache() || []
        }

        const newCheck = {
            restaurant_id: restaurantId,
            platform,
            checked_at: new Date().toISOString(),
            ui_is_open: isOpen,
            ui_can_order: isOpen,
            ui_is_greyed: !isOpen,
            ui_error_message: errorMessage || null,
            final_status: isOpen ? 'available' : 'unavailable',
            source: 'webhook'
        }

        const idx = global.liveChecks.findIndex(c => c.restaurant_id === restaurantId && c.platform === platform)
        if (idx >= 0) {
            global.liveChecks[idx] = newCheck
        } else {
            global.liveChecks.push(newCheck)
        }

        saveLiveChecksCache(global.liveChecks)
        return newCheck
    }

    /**
     * WOLT WEBHOOK HANDLER
     * Handles:
     * - VENUE_OFFLINE_ALERT_TRIGGERED
     * - VENUE_OFFLINE_ALERT_RECOVERED
     * - REJECTION_ALERT_TRIGGERED
     * - REJECTION_ALERT_RECOVERED
     * - OPENING_HOURS_UPDATED
     * - order.notification
     * - order_review.notification
     */
    async handleWoltWebhook(payload, headers = {}) {
        this.stats.wolt.total++

        const eventType = payload.event_type || payload.type || 'UNKNOWN'
        const venueId = payload.venue_id || payload.order?.venue_id
        const externalVenueId = payload.external_venue_id
        const detectedAt = payload.detected_at || payload.created_at || new Date().toISOString()

        console.log(`[WOLT WEBHOOK] Received: ${eventType} | Venue: ${venueId || externalVenueId || 'N/A'}`)

        const restaurant = await this.resolveRestaurant({
            woltVenueId: venueId,
            externalVenueId
        })

        let actionTaken = 'LOGGED'
        let notificationSent = false

        if (eventType === 'VENUE_OFFLINE_ALERT_TRIGGERED') {
            this.stats.wolt.offline_alerts++
            actionTaken = 'STORE_OFFLINE'

            if (restaurant) {
                this.updateLiveCheck(restaurant.id, 'wolt', {
                    isOpen: false,
                    status: 'unavailable',
                    errorMessage: 'Închis pe Wolt (Notificare Oficială Wolt)'
                })

                // Send Telegram Notification if configured
                const targetChatId = restaurant.telegram_group_id || restaurant.working_hours?.telegram_group_id
                if (targetChatId) {
                    const message = [
                        `🔴 <b>STOP TOTAL — Wolt (Webhook Oficial)</b>`,
                        `📍 <b>${restaurant.name}</b> · ${restaurant.city || ''}`,
                        `⏱ Detectat de Wolt la: ${new Date(detectedAt).toLocaleTimeString('ro-RO')}`,
                        `⚠️ Restaurantul a picat offline în timpul programului de lucru.`,
                        `💸 Calculul pierderilor a fost pornit automat.`
                    ].join('\n')
                    sendTelegramMessage(targetChatId, message)
                    notificationSent = true
                }
            }
        } else if (eventType === 'VENUE_OFFLINE_ALERT_RECOVERED') {
            this.stats.wolt.recovered_alerts++
            actionTaken = 'STORE_RECOVERED'

            if (restaurant) {
                this.updateLiveCheck(restaurant.id, 'wolt', {
                    isOpen: true,
                    status: 'available',
                    errorMessage: null
                })

                const targetChatId = restaurant.telegram_group_id || restaurant.working_hours?.telegram_group_id
                if (targetChatId) {
                    const message = [
                        `🟢 <b>REVENIRE ONLINE — Wolt (Webhook Oficial)</b>`,
                        `📍 <b>${restaurant.name}</b> · ${restaurant.city || ''}`,
                        `⏱ Revenit la: ${new Date(detectedAt).toLocaleTimeString('ro-RO')}`,
                        `✅ Magazinul este din nou activ și primește comenzi.`
                    ].join('\n')
                    sendTelegramMessage(targetChatId, message)
                    notificationSent = true
                }
            }
        } else if (eventType === 'REJECTION_ALERT_TRIGGERED') {
            this.stats.wolt.rejection_alerts++
            actionTaken = 'REJECTION_ALERT'

            if (restaurant) {
                const targetChatId = restaurant.telegram_group_id || restaurant.working_hours?.telegram_group_id
                if (targetChatId) {
                    const message = [
                        `⚠️ <b>ALERTA RESPINGERE COMENZI — Wolt</b>`,
                        `📍 <b>${restaurant.name}</b> · ${restaurant.city || ''}`,
                        `🚨 Locația a respins 3 comenzi consecutive pe Wolt!`,
                        `Verificați de urgență tableta și personalul din bucătărie!`
                    ].join('\n')
                    sendTelegramMessage(targetChatId, message)
                    notificationSent = true
                }
            }
        } else if (eventType === 'order_review.notification') {
            this.stats.wolt.reviews++
            actionTaken = 'REVIEW_RECEIVED'
            console.log(`[WOLT WEBHOOK] New review received for venue ${venueId}: Rating ${payload.review?.goods_review?.rating}/5`)
        } else {
            this.stats.wolt.other++
        }

        const recorded = this.recordEvent({
            platform: 'wolt',
            event_type: eventType,
            venue_id: venueId,
            restaurant_id: restaurant?.id || null,
            restaurant_name: restaurant?.name || null,
            action_taken: actionTaken,
            notification_sent: notificationSent,
            payload_summary: {
                detected_at: detectedAt,
                details: payload.details || {}
            }
        })

        return {
            success: true,
            event_id: recorded.id,
            matched_restaurant: restaurant ? { id: restaurant.id, name: restaurant.name, city: restaurant.city } : null,
            action_taken: actionTaken
        }
    }

    /**
     * BOLT FOOD WEBHOOK HANDLER
     * Handles provider status update:
     * - Provider inactive / paused -> STOP
     * - Provider active -> RECOVERED
     */
    async handleBoltWebhook(payload, headers = {}) {
        this.stats.bolt.total++

        // Optional HMAC signature check if BOLT_WEBHOOK_SECRET is set
        const secretKey = process.env.BOLT_WEBHOOK_SECRET
        const providedSignature = headers['x-server-authorization-hmac-sha256']
        let signatureValid = true

        if (secretKey && providedSignature) {
            try {
                const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload)
                const computed = crypto.createHmac('sha256', secretKey).update(rawBody).digest('hex')
                signatureValid = (computed === providedSignature)
                if (!signatureValid) {
                    console.warn('[BOLT WEBHOOK] Invalid HMAC signature received!')
                }
            } catch (err) {
                console.error('[BOLT WEBHOOK] Signature validation error:', err)
            }
        }

        const providerId = payload.provider_id || payload.store_id || payload.id
        const status = (payload.status || (payload.is_active === false ? 'INACTIVE' : payload.is_active === true ? 'ACTIVE' : '')).toUpperCase()
        const isOffline = status === 'INACTIVE' || status === 'PAUSED' || status === 'CLOSED' || payload.is_active === false
        const isOnline = status === 'ACTIVE' || payload.is_active === true

        console.log(`[BOLT WEBHOOK] Received: Status ${status || 'UPDATE'} | Provider: ${providerId || 'N/A'}`)

        const restaurant = await this.resolveRestaurant({
            boltProviderId: providerId
        })

        let actionTaken = 'LOGGED'
        let notificationSent = false

        if (isOffline) {
            this.stats.bolt.status_changes++
            actionTaken = 'STORE_OFFLINE'

            if (restaurant) {
                this.updateLiveCheck(restaurant.id, 'bolt', {
                    isOpen: false,
                    status: 'unavailable',
                    errorMessage: `Închis pe Bolt Food (${status || 'INACTIVE'})`
                })

                const targetChatId = restaurant.telegram_group_id || restaurant.working_hours?.telegram_group_id
                if (targetChatId) {
                    const message = [
                        `🔴 <b>STOP TOTAL — Bolt Food (Webhook Oficial)</b>`,
                        `📍 <b>${restaurant.name}</b> · ${restaurant.city || ''}`,
                        `⏱ Detectat de Bolt la: ${new Date().toLocaleTimeString('ro-RO')}`,
                        `⚠️ Restaurantul a fost trecut pe inactiv / pauză.`,
                        `💸 Calculul pierderilor a fost pornit automat.`
                    ].join('\n')
                    sendTelegramMessage(targetChatId, message)
                    notificationSent = true
                }
            }
        } else if (isOnline) {
            this.stats.bolt.status_changes++
            actionTaken = 'STORE_RECOVERED'

            if (restaurant) {
                this.updateLiveCheck(restaurant.id, 'bolt', {
                    isOpen: true,
                    status: 'available',
                    errorMessage: null
                })

                const targetChatId = restaurant.telegram_group_id || restaurant.working_hours?.telegram_group_id
                if (targetChatId) {
                    const message = [
                        `🟢 <b>REVENIRE ONLINE — Bolt Food (Webhook Oficial)</b>`,
                        `📍 <b>${restaurant.name}</b> · ${restaurant.city || ''}`,
                        `⏱ Revenit la: ${new Date().toLocaleTimeString('ro-RO')}`,
                        `✅ Magazinul este din nou activ și primește comenzi pe Bolt Food.`
                    ].join('\n')
                    sendTelegramMessage(targetChatId, message)
                    notificationSent = true
                }
            }
        }

        const recorded = this.recordEvent({
            platform: 'bolt',
            event_type: status || 'STATUS_UPDATE',
            provider_id: providerId,
            restaurant_id: restaurant?.id || null,
            restaurant_name: restaurant?.name || null,
            action_taken: actionTaken,
            signature_valid: signatureValid,
            notification_sent: notificationSent,
            payload_summary: payload
        })

        return {
            status: 'ok',
            event_id: recorded.id,
            matched_restaurant: restaurant ? { id: restaurant.id, name: restaurant.name, city: restaurant.city } : null,
            action_taken: actionTaken
        }
    }

    /**
     * GLOVO WEBHOOK HANDLER
     * Handles store open/close events forwarded from Valentin's integration
     */
    async handleGlovoWebhook(payload, headers = {}) {
        this.stats.glovo.total++

        const storeId = (payload.store_id || payload.glovo_id || payload.storeId || payload.id || '').toString()
        const status = (payload.status || (payload.is_open === false ? 'CLOSED' : payload.is_open === true ? 'OPEN' : '')).toUpperCase()
        const isOffline = status === 'CLOSED' || status === 'OFFLINE' || status === 'INACTIVE' || payload.is_open === false
        const isOnline = status === 'OPEN' || status === 'ONLINE' || status === 'ACTIVE' || payload.is_open === true

        console.log(`[GLOVO WEBHOOK] Received: Status ${status || 'UPDATE'} | Store: ${storeId || 'N/A'}`)

        const restaurant = await this.resolveRestaurant({
            glovoStoreId: storeId,
            externalVenueId: payload.external_venue_id || payload.restaurant_name
        })

        let actionTaken = 'LOGGED'
        let notificationSent = false

        if (isOffline) {
            this.stats.glovo.status_changes++
            actionTaken = 'STORE_OFFLINE'

            if (restaurant) {
                this.updateLiveCheck(restaurant.id, 'glovo', {
                    isOpen: false,
                    status: 'unavailable',
                    errorMessage: `Închis pe Glovo (${status || 'CLOSED'})`
                })

                const targetChatId = restaurant.telegram_group_id || restaurant.working_hours?.telegram_group_id
                if (targetChatId) {
                    const message = [
                        `🔴 <b>STOP TOTAL — Glovo (Webhook Valentin)</b>`,
                        `📍 <b>${restaurant.name}</b> · ${restaurant.city || ''}`,
                        `⏱ Detectat de Glovo la: ${new Date().toLocaleTimeString('ro-RO')}`,
                        `⚠️ Locația a fost închisă pe platforma Glovo.`,
                        `💸 Calculul pierderilor a fost pornit automat.`
                    ].join('\n')
                    sendTelegramMessage(targetChatId, message)
                    notificationSent = true
                }
            }
        } else if (isOnline) {
            this.stats.glovo.status_changes++
            actionTaken = 'STORE_RECOVERED'

            if (restaurant) {
                this.updateLiveCheck(restaurant.id, 'glovo', {
                    isOpen: true,
                    status: 'available',
                    errorMessage: null
                })

                const targetChatId = restaurant.telegram_group_id || restaurant.working_hours?.telegram_group_id
                if (targetChatId) {
                    const message = [
                        `🟢 <b>REVENIRE ONLINE — Glovo (Webhook Valentin)</b>`,
                        `📍 <b>${restaurant.name}</b> · ${restaurant.city || ''}`,
                        `⏱ Revenit la: ${new Date().toLocaleTimeString('ro-RO')}`,
                        `✅ Magazinul este din nou deschis pe Glovo.`
                    ].join('\n')
                    sendTelegramMessage(targetChatId, message)
                    notificationSent = true
                }
            }
        }

        const recorded = this.recordEvent({
            platform: 'glovo',
            event_type: status || 'STATUS_UPDATE',
            store_id: storeId,
            restaurant_id: restaurant?.id || null,
            restaurant_name: restaurant?.name || null,
            action_taken: actionTaken,
            notification_sent: notificationSent,
            payload_summary: payload
        })

        return {
            status: 'ok',
            event_id: recorded.id,
            matched_restaurant: restaurant ? { id: restaurant.id, name: restaurant.name, city: restaurant.city } : null,
            action_taken: actionTaken
        }
    }

    /**
     * Webhook Status diagnostic summary
     */
    getStatus() {
        return {
            endpoints: {
                wolt: '/api/webhooks/wolt',
                bolt: '/api/webhooks/bolt',
                glovo: '/api/webhooks/glovo',
                simulate: '/api/webhooks/simulate'
            },
            mapping: {
                total_stores: this.storeMappings.length,
                wolt_mapped_ids: this.woltIdMap.size,
                bolt_mapped_ids: this.boltIdMap.size,
                glovo_mapped_ids: this.glovoIdMap.size
            },
            stats: this.stats,
            recent_events: this.recentEvents.slice(0, 30)
        }
    }
}

export const webhookService = new WebhookService()
