import { launchBrowser } from '../utils/puppeteer-launch.js'
import { supabase } from '../services/supabase.js'
import { CompetitorScraper } from './competitor-scraper.js'

const competitorScraper = new CompetitorScraper()

export class OwnBrandScraper {

    // ─── Scrape ALL own restaurants (all platforms with URLs) ───
    async scrapeAllBrands() {
        console.log('[OwnBrand] Starting full scrape of all own restaurants...')
        const today = new Date().toISOString().split('T')[0]

        // Fetch all active restaurants with their platform URLs
        const { data: restaurants, error } = await supabase
            .from('restaurants')
            .select('id, name, city, brand_id, wolt_url, glovo_url, bolt_url, brands(name, logo_url)')
            .eq('is_active', true)
            .order('brand_id')

        if (error) { console.error('[OwnBrand] DB error:', error.message); return { error: error.message } }

        console.log(`[OwnBrand] Found ${restaurants.length} active restaurants`)

        const results = []
        for (const restaurant of restaurants) {
            const r = await this.scrapeRestaurant(restaurant, today)
            results.push(r)
        }

        const total = results.reduce((s, r) => s + (r.productCount || 0), 0)
        console.log(`[OwnBrand] Done! Total products saved: ${total}`)
        return { success: true, restaurants: results.length, totalProducts: total }
    }

    // ─── Scrape a single restaurant (all available platforms) ───
    async scrapeRestaurant(restaurant, today = null) {
        if (!today) today = new Date().toISOString().split('T')[0]
        const platforms = ['wolt', 'glovo', 'bolt']
        let productCount = 0

        for (const platform of platforms) {
            const url = restaurant[`${platform}_url`]
            if (!url) continue

            console.log(`  [OwnBrand] ${restaurant.name} (${restaurant.city}) on ${platform}...`)
            try {
                let products = []

                if (platform === 'wolt') {
                    products = await competitorScraper.scrapeWoltProducts(url, restaurant.name)
                } else if (platform === 'glovo') {
                    products = await this.scrapeGlovoProducts(url, restaurant.name)
                }
                // Bolt: similar structure to Glovo, placeholder for now

                if (products.length === 0) {
                    console.log(`    → 0 products (may be closed or blocked)`)
                    continue
                }

                // Delete today's existing snapshot for this restaurant+platform (upsert behavior)
                await supabase.from('own_product_snapshots')
                    .delete()
                    .eq('restaurant_id', restaurant.id)
                    .eq('platform', platform)
                    .eq('snapshot_date', today)

                // Insert new snapshot
                const rows = products.map(p => ({
                    restaurant_id: restaurant.id,
                    brand_id: restaurant.brand_id,
                    platform,
                    city: restaurant.city,
                    product_name: p.name,
                    category: p.category || 'Menu',
                    price: p.price || null,
                    image_url: p.image_url || null,
                    description: p.description || null,
                    is_available: true,
                    is_promoted: p.isPromoted || false,
                    snapshot_date: today,
                }))

                const { error: insertErr } = await supabase.from('own_product_snapshots').insert(rows)
                if (insertErr) {
                    console.error(`    [DB Error] ${insertErr.message}`)
                } else {
                    console.log(`    ✓ ${products.length} produse salvate`)
                    productCount += products.length
                }

            } catch (err) {
                console.error(`    [Error] ${restaurant.name} ${platform}: ${err.message}`)
            }
        }

        return { restaurant: restaurant.name, city: restaurant.city, productCount }
    }

    // ─── Scrape Glovo restaurant products ───
    async scrapeGlovoProducts(url, restaurantName) {
        if (!url) return []
        const browser = await launchBrowser()
        const page = await browser.newPage()
        await page.setViewport({ width: 1440, height: 900 })
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
        const products = []
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 })

            // Accept cookies
            try {
                await page.waitForSelector('button', { timeout: 3000 })
                await page.evaluate(() => {
                    const btn = [...document.querySelectorAll('button')].find(b => /accept|permit|allow|continu/i.test(b.innerText))
                    if (btn) btn.click()
                })
            } catch(_) {}
            await new Promise(r => setTimeout(r, 2000))

            // Scroll to load all products
            let lastH = 0
            for (let i = 0; i < 20; i++) {
                await page.evaluate(() => window.scrollBy(0, 600))
                await new Promise(r => setTimeout(r, 300))
                const h = await page.evaluate(() => document.body.scrollHeight)
                if (h === lastH && i > 5) break
                lastH = h
            }
            await page.evaluate(() => window.scrollTo(0, 0))
            await new Promise(r => setTimeout(r, 800))

            const extracted = await page.evaluate(() => {
                const results = []
                const seen = new Set()

                // Strategy: product cards
                const cardSels = [
                    '[class*="product-card"]', '[class*="ProductCard"]',
                    '[class*="store-product"]', '[class*="item-card"]',
                    'article[class*="product"]', '[data-testid*="product"]'
                ]

                let cards = null
                for (const sel of cardSels) {
                    const found = document.querySelectorAll(sel)
                    if (found.length > 2) { cards = found; break }
                }

                if (!cards || cards.length === 0) return []

                // Find category headers
                const headings = [...document.querySelectorAll('h2, h3, [class*="category-title"], [class*="CategoryTitle"]')]
                    .filter(h => {
                        const t = h.innerText?.trim()
                        return t && t.length > 1 && t.length < 80
                    })

                cards.forEach(card => {
                    // Name
                    const nameEl = card.querySelector('h3, h2, [class*="title"], [class*="name"], [class*="Name"]')
                    const name = nameEl?.innerText?.trim() || ''
                    if (!name || name.length < 2 || seen.has(name)) return
                    seen.add(name)

                    // Price
                    const priceEl = card.querySelector('[class*="price"], [class*="Price"]')
                    const priceText = priceEl?.innerText || ''
                    const priceMatch = priceText.match(/(\d+[,.]?\d*)\s*(RON|lei|€|\$)?/i)
                    const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : null

                    // Image
                    const img = card.querySelector('img')
                    const image_url = img?.src || img?.dataset?.src || null

                    // Description
                    const descEl = card.querySelector('[class*="description"], [class*="Description"], p')
                    const description = descEl?.innerText?.trim()?.slice(0, 200) || null

                    // Category (nearest heading above)
                    let category = 'Menu'
                    const cardTop = card.offsetTop
                    let closest = null, closestDist = Infinity
                    headings.forEach(h => {
                        const dist = cardTop - h.offsetTop
                        if (dist > 0 && dist < closestDist) { closestDist = dist; closest = h }
                    })
                    if (closest) category = closest.innerText?.trim() || 'Menu'

                    results.push({ name, price, image_url, description, category, isPromoted: false })
                })

                return results
            })

            products.push(...extracted)
            console.log(`    [Glovo] ${restaurantName}: ${products.length} produse`)
        } catch (err) {
            console.error(`    [Glovo] ${restaurantName}: ${err.message}`)
        } finally {
            await browser.close()
        }
        return products
    }

    // ─── Get latest snapshot for a restaurant ───
    async getLatestProducts(restaurantId, platform = null) {
        let query = supabase.from('own_product_snapshots')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('snapshot_date', new Date().toISOString().split('T')[0])
            .order('category')

        if (platform) query = query.eq('platform', platform)
        const { data, error } = await query
        return error ? [] : (data || [])
    }

    // ─── Detect products that went on STOP (were available yesterday, not today) ───
    async detectStoppedProducts(brandId = null) {
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

        let todayQuery = supabase.from('own_product_snapshots')
            .select('restaurant_id, platform, product_name')
            .eq('snapshot_date', today)

        let yesterdayQuery = supabase.from('own_product_snapshots')
            .select('restaurant_id, platform, product_name, restaurants(name, city, brand_id, brands(name))')
            .eq('snapshot_date', yesterday)

        if (brandId) {
            todayQuery = todayQuery.eq('brand_id', brandId)
            yesterdayQuery = yesterdayQuery.eq('brand_id', brandId)
        }

        const [{ data: todayProducts }, { data: yesterdayProducts }] = await Promise.all([
            todayQuery, yesterdayQuery
        ])

        if (!todayProducts || !yesterdayProducts) return []

        // Build today's set
        const todaySet = new Set(yesterdayProducts?.map(p => `${p.restaurant_id}|${p.platform}|${p.product_name}`) || [])
        const todayKeys = new Set(todayProducts.map(p => `${p.restaurant_id}|${p.platform}|${p.product_name}`))

        // Products in yesterday but NOT in today = went on stop
        const stopped = (yesterdayProducts || []).filter(p => {
            const key = `${p.restaurant_id}|${p.platform}|${p.product_name}`
            return !todayKeys.has(key)
        })

        return stopped.map(p => ({
            restaurant_name: p.restaurants?.name || '?',
            city: p.restaurants?.city || '?',
            brand_name: p.restaurants?.brands?.name || '?',
            platform: p.platform,
            product_name: p.product_name,
            stopped_since: today,
        }))
    }
}

export const ownBrandScraper = new OwnBrandScraper()
