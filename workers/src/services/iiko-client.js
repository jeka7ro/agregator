import { supabase } from './supabase.js'

/**
 * iiko Integration Client
 * 
 * Provides interface for fetching restaurant data from iiko POS system:
 * - Product list with categories and prices
 * - Sales data for loss calculation
 * - Product ID mapping (iiko → aggregator)
 * 
 * NOTE: This is a preparatory implementation. Actual API connection
 * requires iiko API credentials configured per restaurant.
 * 
 * Configuration per restaurant (stored in restaurants.iiko_config):
 * {
 *   "api_url": "https://api-eu.iiko.services",
 *   "api_login": "your-login",
 *   "organization_id": "org-uuid",
 *   "terminal_group_id": "terminal-uuid"
 * }
 */
export class IikoClient {
    constructor(restaurant) {
        this.restaurant = restaurant
        this.config = restaurant?.iiko_config || {}
        this.config.organization_id = this.config.organization_id || this.config.organizationId
        this.apiUrl = this.config.api_url || 'https://api-eu.syrve.live'
        this.token = null
        this.tokenExpiry = null
    }

    /**
     * Check if iiko is configured for this restaurant
     */
    isConfigured() {
        return !!(this.config.api_login && (this.config.organization_id || this.config.organizationId))
    }

    /**
     * Authenticate with iiko API and get access token
     */
    async authenticate() {
        if (!this.isConfigured()) {
            console.log(`   [iiko] Not configured for ${this.restaurant.name}`)
            return false
        }

        // Check if existing token is still valid
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return true
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/1/access_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiLogin: this.config.api_login })
            })

            if (!response.ok) {
                throw new Error(`iiko auth failed: ${response.status}`)
            }

            const data = await response.json()
            this.token = data.token
            // iiko tokens typically expire in 15 minutes
            this.tokenExpiry = Date.now() + 14 * 60 * 1000

            return true
        } catch (err) {
            console.error(`   [iiko] Auth error for ${this.restaurant.name}:`, err.message)
            return false
        }
    }

    /**
     * Fetch product list with categories and prices
     * @returns {Array} products with { id, name, category, price, isAvailable }
     */
    async getProducts() {
        if (!await this.authenticate()) return []

        try {
            const response = await fetch(`${this.apiUrl}/api/1/nomenclature`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    organizationId: this.config.organization_id
                })
            })

            if (!response.ok) {
                throw new Error(`iiko nomenclature failed: ${response.status}`)
            }

            const data = await response.json()
            const products = []

            // Map iiko product groups (categories)
            const categoryMap = {}
            for (const group of (data.groups || [])) {
                categoryMap[group.id] = group.name
            }

            // Map products
            for (const product of (data.products || [])) {
                products.push({
                    iiko_id: product.id,
                    name: product.name,
                    category: categoryMap[product.parentGroup] || 'Uncategorized',
                    category_id: product.parentGroup,
                    price: product.sizePrices?.[0]?.price?.currentPrice || 0,
                    is_available: !product.isDeleted,
                    sku: product.code,
                    weight: product.weight,
                    measure_unit: product.measureUnit,
                    image: product.imageLinks?.[0] || null
                })
            }

            return products
        } catch (err) {
            console.error(`   [iiko] Error fetching products for ${this.restaurant.name}:`, err.message)
            return []
        }
    }

    /**
     * Fetch recent sales data
     * @param {string} dateFrom - ISO date (YYYY-MM-DD)
     * @param {string} dateTo - ISO date (YYYY-MM-DD)
     * @returns {Array} sales records
     */
    async getSalesData(dateFrom, dateTo) {
        if (!await this.authenticate()) return []

        try {
            const response = await fetch(`${this.apiUrl}/api/1/deliveries/by_delivery_date_and_status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    organizationIds: [this.config.organization_id],
                    deliveryDateFrom: dateFrom,
                    deliveryDateTo: dateTo,
                    statuses: ['Delivered']
                })
            })

            if (!response.ok) {
                throw new Error(`iiko sales failed: ${response.status}`)
            }

            const data = await response.json()
            const sales = []

            for (const order of (data.deliveryOrders || [])) {
                for (const item of (order.items || [])) {
                    sales.push({
                        order_id: order.id,
                        order_date: order.completionDate || order.deliveryDate,
                        product_id: item.productId,
                        product_name: item.name,
                        quantity: item.amount,
                        price: item.resultSum,
                        total: item.resultSum * item.amount
                    })
                }
            }

            return sales
        } catch (err) {
            console.error(`   [iiko] Error fetching sales for ${this.restaurant.name}:`, err.message)
            return []
        }
    }

    /**
     * Map iiko products to aggregator products
     * Uses name matching since aggregators don't expose iiko IDs
     * 
     * @param {Array} iikoProducts - products from iiko
     * @param {Array} aggregatorProducts - products scraped from aggregator
     * @returns {Array} mapped products with match confidence
     */
    mapProducts(iikoProducts, aggregatorProducts) {
        // ── Normalization helpers ────────────────────────────────────────────
        const EQUIVALENCES = [
            // Romanian ↔ English fish/ingredient names
            ['somon', 'salmon'], ['somn', 'salmon'],
            ['creveti', 'shrimp'], ['creveți', 'shrimp'],
            ['ton', 'tuna'], ['avocado', 'avocado'],
            ['brinza', 'cheese'], ['brânză', 'cheese'], ['branza', 'cheese'],
            ['fume', 'smoked'], ['afumat', 'smoked'],
            ['mare', 'large'], ['mic', 'small'],
            // common typos / abbreviations
            ['phila', 'philadelphia'], ['fil', 'philadelphia'],
            ['mango', 'mango'], ['anghi', 'eel'], ['anghila', 'eel'],
        ]

        function normalize(str) {
            if (!str) return ''
            let s = str.toLowerCase().trim()
            // Remove diacritics
            s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            // Remove special chars except letters/digits/spaces
            s = s.replace(/[^a-z0-9 ]/g, ' ')
            // Apply equivalences (normalize both directions to canonical form)
            for (const [ro, en] of EQUIVALENCES) {
                s = s.replace(new RegExp(`\\b${ro}\\b`, 'g'), en)
            }
            // Collapse multiple spaces
            s = s.replace(/\s+/g, ' ').trim()
            return s
        }

        function similarity(a, b) {
            if (!a || !b) return 0
            const na = normalize(a)
            const nb = normalize(b)
            if (na === nb) return 100

            // Token overlap score (handles word order differences)
            const tokensA = new Set(na.split(' ').filter(t => t.length > 2))
            const tokensB = new Set(nb.split(' ').filter(t => t.length > 2))
            if (tokensA.size === 0 || tokensB.size === 0) return 0

            let overlap = 0
            for (const t of tokensA) {
                if (tokensB.has(t)) overlap++
                // partial: one token includes the other (handles abbreviations)
                else if ([...tokensB].some(tb => tb.includes(t) || t.includes(tb))) overlap += 0.7
            }
            const tokenScore = (overlap / Math.max(tokensA.size, tokensB.size)) * 100

            // Substring containment bonus
            let substringBonus = 0
            if (na.includes(nb) || nb.includes(na)) {
                substringBonus = (Math.min(na.length, nb.length) / Math.max(na.length, nb.length)) * 60
            }

            return Math.min(100, Math.max(tokenScore, substringBonus))
        }
        // ─────────────────────────────────────────────────────────────────────

        const mapped = []
        // Match threshold: 55 points (was 50, slightly tighter to reduce false positives)
        const THRESHOLD = 55

        for (const iikoProduct of iikoProducts) {
            let bestMatch = null
            let bestScore = 0

            for (const aggProduct of aggregatorProducts) {
                const score = similarity(iikoProduct.name, aggProduct.name)
                if (score > bestScore) {
                    bestScore = score
                    bestMatch = aggProduct
                }
            }

            mapped.push({
                iiko_product: iikoProduct,
                aggregator_product: bestScore >= THRESHOLD ? bestMatch : null,
                match_confidence: bestScore,
                is_matched: bestScore >= THRESHOLD
            })
        }

        return mapped
    }

    /**
     * Calculate revenue per hour based on historical iiko sales
     * Updates the restaurant record with calculated revenue
     */
    async calculateRevenuePerHour() {
        // Get last 30 days of sales
        const dateTo = new Date().toISOString().split('T')[0]
        const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        const sales = await this.getSalesData(dateFrom, dateTo)
        if (sales.length === 0) return null

        // Calculate total revenue
        const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)

        // Get working hours per day (approximate 12 hours)
        const workingHoursPerDay = 12
        const daysInPeriod = 30

        const revenuePerHour = totalRevenue / (daysInPeriod * workingHoursPerDay)

        // Update restaurant record
        if (revenuePerHour > 0) {
            await supabase
                .from('restaurants')
                .update({ revenue_per_hour: parseFloat(revenuePerHour.toFixed(2)) })
                .eq('id', this.restaurant.id)
        }

        return {
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            revenuePerHour: parseFloat(revenuePerHour.toFixed(2)),
            salesCount: sales.length,
            period: { from: dateFrom, to: dateTo }
        }
    }

    /**
     * Fetch the active stop list (out of stock items) from the kitchen POS
     * @returns {Array} List of product IDs or names currently stopped
     */
    async getStopList() {
        if (!await this.authenticate()) return []

        try {
            const response = await fetch(`${this.apiUrl}/api/1/stop_lists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    organizationIds: [this.config.organization_id]
                })
            })

            if (!response.ok) {
                throw new Error(`iiko stop_lists failed: ${response.status}`)
            }

            const data = await response.json()
            const stoppedItemIds = new Set()

            if (data.terminalGroupStopLists) {
                for (const tg of data.terminalGroupStopLists) {
                     for (const item of (tg.items || [])) {
                          stoppedItemIds.add(item.productId)
                     }
                }
            }
            
            // Map IDs to names if we have the products array cached or we fetch it
            const products = await this.getProducts()
            const productMap = {}
            for (const p of products) {
                 productMap[p.iiko_id] = p.name
            }

            const stoppedProducts = []
            for (const id of stoppedItemIds) {
                 stoppedProducts.push({
                     iiko_id: id,
                     name: productMap[id] || id,
                     is_stopped_in_pos: true
                 })
            }

            return stoppedProducts
        } catch (err) {
            console.error(`   [iiko] Error fetching stop list for ${this.restaurant.name}:`, err.message)
            return []
        }
    }
}
