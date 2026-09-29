import { launchBrowser } from '../utils/puppeteer-launch.js'
import { supabase } from '../services/supabase.js'

// City coordinates for Wolt API
const CITY_COORDS = {
    'Bucharest': { lat: 44.4268, lon: 26.1025 },
    'Cluj-Napoca': { lat: 46.7712, lon: 23.6236 },
    'Timisoara': { lat: 45.7489, lon: 21.2087 },
    'Iasi': { lat: 47.1585, lon: 27.6014 },
    'Constanta': { lat: 44.1733, lon: 28.6383 },
    'Brasov': { lat: 45.6427, lon: 25.5887 },
    'Galati': { lat: 45.4353, lon: 28.0080 },
    'Sibiu': { lat: 45.7983, lon: 24.1256 },
    'Pitesti': { lat: 44.8565, lon: 24.8692 },
    'Ploiesti': { lat: 44.9451, lon: 26.0147 },
    'Bacau': { lat: 46.5670, lon: 26.9146 },
    'Suceava': { lat: 47.6508, lon: 26.2539 },
    'Targu Mures': { lat: 46.5386, lon: 24.5544 },
    'Braila': { lat: 45.2692, lon: 27.9574 },
    'Baia Mare': { lat: 47.6669, lon: 23.5847 },
    'Craiova': { lat: 44.3190, lon: 23.7949 },
    'Oradea': { lat: 47.0465, lon: 21.9189 },
    'Arad': { lat: 46.1866, lon: 21.3123 },
}

const CITY_SLUGS = {
    'Bucharest': 'bucharest', 'Cluj-Napoca': 'cluj-napoca', 'Timisoara': 'timisoara',
    'Iasi': 'iasi', 'Constanta': 'constanta', 'Brasov': 'brasov', 'Galati': 'galati',
    'Sibiu': 'sibiu', 'Pitesti': 'pitesti', 'Ploiesti': 'ploiesti', 'Bacau': 'bacau',
    'Suceava': 'suceava', 'Targu Mures': 'targu-mures', 'Braila': 'braila',
    'Baia Mare': 'baia-mare', 'Craiova': 'craiova', 'Oradea': 'oradea', 'Arad': 'arad',
}

// Search term → Wolt tags (always use this for filtering — avoids irrelevant results)
const SEARCH_TAG_MAP = {
    'asian': ['sushi', 'asian', 'japanese', 'chinese', 'thai', 'korean', 'vietnamese', 'ramen', 'wok', 'noodles'],
    'sushi': ['sushi', 'japanese', 'maki', 'asian'],
    'tempura': ['sushi', 'japanese', 'asian', 'maki', 'tempura'],
    'roll': ['sushi', 'japanese', 'maki', 'asian', 'roll'],
    'burger': ['burger', 'hamburger', 'burgers', 'american', 'smashed', 'smash'],
    'burgeri': ['burger', 'hamburger', 'burgers', 'american', 'smashed', 'smash'],
    'smashed': ['burger', 'hamburger', 'burgers', 'american', 'smashed', 'smash'],
    'smash': ['burger', 'hamburger', 'burgers', 'american', 'smashed', 'smash'],
    'pizza': ['pizza', 'italian'],
    'salate': ['salad', 'healthy', 'vegetarian'],
    'paste': ['pasta', 'italian'],
    'grill': ['grill', 'bbq'],
    'pui': ['chicken', 'poultry', 'wings'],
    'vegan': ['vegan', 'vegetarian', 'plant-based'],
    'shaorma': ['shawarma', 'kebab', 'doner', 'shaorma'],
    'indian': ['indian', 'curry'],
    'mexican': ['mexican', 'tacos', 'burrito'],
}

const GLOVO_CAT_MAP = {
    'asian': 'asiatic', 'sushi': 'sushi', 'tempura': 'sushi', 'roll': 'sushi',
    'burger': 'burgeri', 'burgeri': 'burgeri', 'smashed': 'burgeri', 'smash': 'burgeri',
    'pizza': 'pizza', 'grill': 'gratar', 'shaorma': 'shaorma', 'vegan': 'vegan',
    'pui': 'pui', 'salate': 'salate',
}

export class CompetitorScraper {
    constructor() {
        this.shouldStop = false;
    }
    
    stopAllSearches() {
        this.shouldStop = true;
    }

    async getCitiesForBrand(brandId) {
        const { data } = await supabase.from('restaurants')
            .select('city').eq('brand_id', brandId).eq('is_active', true)
        const cities = [...new Set(data?.map(r => r.city).filter(Boolean))]
        console.log(`  → Brand cities (${cities.length}): ${cities.join(', ')}`)
        return cities
    }

    // ─── WOLT: REST API (no browser) ───
    async searchWolt(city, searchTerm) {
        const coords = CITY_COORDS[city]
        if (!coords) { console.log(`  [Wolt] No coords for ${city}`); return [] }

        try {
            const res = await fetch(
                `https://restaurant-api.wolt.com/v1/pages/restaurants?lat=${coords.lat}&lon=${coords.lon}`,
                { headers: { 'Accept': 'application/json', 'Accept-Language': 'ro' } }
            )
            if (!res.ok) { console.log(`  [Wolt] ${city}: API ${res.status}`); return [] }

            const d = await res.json()
            const venSection = d.sections?.find(s => s.name === 'restaurants-delivering-venues')
            const allVenues = venSection?.items || []

            // Always use full tag map — avoids irrelevant single-tag matching
            const tagFilter = SEARCH_TAG_MAP[searchTerm.toLowerCase()] || [searchTerm.toLowerCase()]

            const matched = allVenues.filter(item => {
                const v = item.venue
                if (!v) return false
                const name = (v.name || '').toLowerCase()
                const tags = (v.tags || []).map(t => t.toLowerCase())
                return tagFilter.some(tag => tags.some(t => t.includes(tag)) || name.includes(tag))
            })

            const citySlug = CITY_SLUGS[city] || city.toLowerCase()
            const results = matched.map((item, i) => {
                const v = item.venue
                return {
                    name: v.name || 'Unknown',
                    url: v.slug ? `https://wolt.com/ro/rou/${citySlug}/restaurant/${v.slug}` : null,
                    logo_url: v.brand_image?.url || null,
                    rank_position: i + 1,
                    rating: v.rating?.score ? Math.min(parseFloat(v.rating.score), 9.9) : null,
                    delivery_time_min: v.estimate_range?.min || null,
                    delivery_time_max: v.estimate_range?.max || null,
                    delivery_fee: null, is_promoted: false,
                    tags: (v.tags || []).slice(0, 5)
                }
            })

            console.log(`  [Wolt] ${city}: ${results.length} (from ${allVenues.length} total)`)
            return results
        } catch (err) {
            console.error(`  [Wolt] ${city}:`, err.message)
            return []
        }
    }

    // ─── GLOVO: Puppeteer cu URL corect pentru categorii ───
    async searchGlovo(city, searchTerm, glovoCategory = null) {
        // English city slugs (Glovo uses English in URLs)
        const GLOVO_CITY_SLUGS = {
            'Bucharest': 'bucharest', 'Cluj-Napoca': 'cluj-napoca', 'Timisoara': 'timisoara',
            'Iasi': 'iasi', 'Constanta': 'constanta', 'Brasov': 'brasov', 'Galati': 'galati',
            'Sibiu': 'sibiu', 'Pitesti': 'pitesti', 'Ploiesti': 'ploiesti', 'Bacau': 'bacau',
            'Suceava': 'suceava', 'Targu Mures': 'targu-mures', 'Braila': 'braila',
            'Baia Mare': 'baia-mare', 'Craiova': 'craiova', 'Oradea': 'oradea', 'Arad': 'arad',
        }
        // Glovo type IDs for food subcategories (from /categories/mancare_1?type=XXX)
        const GLOVO_TYPE_MAP = {
            'sushi': 'sushi_34702', 'asian': 'asiatica_34834', 'roll': 'sushi_34702',
            'tempura': 'sushi_34702', 'burger': 'burgeri_34789', 'pizza': 'pizza_34701',
            'doner': 'shaorma_35119', 'shaorma': 'shaorma_35119', 'kebab': 'kebab_34699',
            'meniu': 'asiatica_34834', 'menu': 'asiatica_34834', 'chinese': 'chinezeasca_34810',
            'chinezesc': 'chinezeasca_34810', 'paste': 'paste_34881', 'salate': 'salate_35101',
        }

        const citySlug = GLOVO_CITY_SLUGS[city] || city.toLowerCase().replace(/\s+/g, '-').replace(/[ăâ]/g, 'a').replace(/[îâ]/g, 'i').replace(/[șş]/g, 's').replace(/[țţ]/g, 't')
        const term = searchTerm.toLowerCase()
        const typeId = GLOVO_TYPE_MAP[term] || GLOVO_CAT_MAP[term] && GLOVO_TYPE_MAP[GLOVO_CAT_MAP[term]] || 'asiatica_34834'
        const url = `https://glovoapp.com/ro/ro/${citySlug}/categories/mancare_1?type=${typeId}`
        const tagFilter = SEARCH_TAG_MAP[term] || [term]
        const results = []

        const browser = await launchBrowser()
        const page = await browser.newPage()
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36')
        await page.setViewport({ width: 1440, height: 900 })

        try {
            // Load homepage first for session/cookies
            await page.goto('https://glovoapp.com/ro/ro/', { waitUntil: 'domcontentloaded', timeout: 15000 })
            await new Promise(r => setTimeout(r, 1500))

            // Accept cookie consent (blocks the store links)
            await page.evaluate(() => {
                const btns = [...document.querySelectorAll('button')]
                const btn = btns.find(b => /accept|accepta|allow/i.test(b.innerText || ''))
                if (btn) btn.click()
            }).catch(() => {})
            await new Promise(r => setTimeout(r, 800))

            // Navigate directly to category page — NO address needed!
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
            await new Promise(r => setTimeout(r, 3000))

            // Accept again if still shown on category page
            await page.evaluate(() => {
                const btns = [...document.querySelectorAll('button')]
                const btn = btns.find(b => /accept|accepta|allow/i.test(b.innerText || ''))
                if (btn) btn.click()
            }).catch(() => {})
            await new Promise(r => setTimeout(r, 1000))

            // Scroll to load more restaurants
            for (let i = 0; i < 8; i++) {
                await page.evaluate(() => window.scrollBy(0, 700))
                await new Promise(r => setTimeout(r, 400))
            }

            const raw = await page.evaluate(() => {
                const seen = new Set(), list = []
                document.querySelectorAll('a[href*="/stores/"]').forEach(link => {
                    const slug = link.href.match(/\/stores\/([^/?#]+)/)?.[1]
                    if (!slug || seen.has(slug) || slug === 'stores') return
                    seen.add(slug)

                    // Name from slug: "royal-sushi-house" → "Royal Sushi House"
                    const nameFromSlug = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

                    const text = link.innerText || ''
                    const tMatch = text.match(/(\d+)[–\-](\d+)\s*min/i)
                    list.push({
                        name: nameFromSlug, url: link.href, rank_position: list.length + 1,
                        rating: null,
                        delivery_time_min: tMatch ? parseInt(tMatch[1]) : null,
                        delivery_time_max: tMatch ? parseInt(tMatch[2]) : null,
                        delivery_fee: null, is_promoted: false,
                        tags: nameFromSlug.toLowerCase()
                    })
                })
                return list
            })

            console.log(`  [Glovo] ${city}/${searchTerm}: ${raw.length} restaurante (tip=${typeId})`)
            results.push(...raw.map(({ tags, ...r }) => r))

        } catch (err) {
            console.error(`  [Glovo] ${city}:`, err.message.slice(0, 100))
        } finally {
            await browser.close()
        }
        return results
    }


    // ─── Filter own brands ───
    filterOurBrands(restaurants, ourBrandNames) {
        return restaurants.filter(r => {
            const nameLower = r.name.toLowerCase()
            return !ourBrandNames.some(brand => {
                const parts = brand.toLowerCase().split(' ').filter(p => p.length > 2)
                return parts.length > 0 && parts.every(p => nameLower.includes(p))
            })
        })
    }

    // ─── Save to DB ───
    async saveResults(searchId, platform, city, competitors, today) {
        if (!competitors.length) return
        const { data: snapshot, error } = await supabase
            .from('competitor_snapshots')
            .insert({ search_id: searchId, platform, city, snapshot_date: today, total_results: competitors.length })
            .select().single()
        if (error) { console.error('DB snap error:', error.message); return }

        for (const comp of competitors) {
            const { data: rec } = await supabase.from('competitor_restaurants').insert({
                snapshot_id: snapshot.id, name: comp.name, url: comp.url,
                logo_url: comp.logo_url || null,
                rank_position: comp.rank_position, rating: comp.rating,
                delivery_time_min: comp.delivery_time_min, delivery_time_max: comp.delivery_time_max,
                delivery_fee: comp.delivery_fee, is_promoted: comp.is_promoted || false,
                raw_data: { tags: comp.tags, city, platform }
            }).select().single()
            if (!rec) continue

            // Products — scrape for Wolt AND Glovo competitors
            if (comp.url && (platform === 'wolt' || platform === 'glovo')) {
                await new Promise(r => setTimeout(r, 400))
                const products = platform === 'wolt'
                    ? await this.scrapeWoltProducts(comp.url, comp.name)
                    : await this.scrapeGlovoProducts(comp.url, comp.name)
                if (products.length > 0) {
                    await supabase.from('competitor_products').insert(
                        products.map(p => ({
                            competitor_restaurant_id: rec.id, category: p.category,
                            product_name: p.name, price: p.price,
                            is_promoted: p.isPromoted || false,
                            image_url: p.image_url || null,
                            description: p.description || null,
                            snapshot_date: today, platform, city
                        }))
                    )
                    console.log(`    ✓ ${comp.name}: ${products.length} produse [${platform}]`)
                }
            }
        }
    }

    // ─── Scrape Wolt products with images via DOM ───
    async scrapeWoltProducts(url, restaurantName) {
        if (!url) return []
        const browser = await launchBrowser()
        const page = await browser.newPage()
        await page.setViewport({ width: 1440, height: 900 })
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
        const products = []
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 })

            // Accept cookies if dialog present
            try {
                await page.waitForSelector('button', { timeout: 3000 })
                await page.evaluate(() => {
                    const btn = [...document.querySelectorAll('button')].find(b => /permite|allow|accept/i.test(b.innerText || ''))
                    if (btn) btn.click()
                })
            } catch(_) {}
            await new Promise(r => setTimeout(r, 2000))

            // Aggressive scroll to load all lazy items
            let lastHeight = 0
            for (let i = 0; i < 20; i++) {
                await page.evaluate(() => window.scrollBy(0, 600))
                await new Promise(r => setTimeout(r, 300))
                const h = await page.evaluate(() => document.body.scrollHeight)
                if (h === lastHeight && i > 5) break
                lastHeight = h
            }
            await page.evaluate(() => window.scrollTo(0, 0))
            await new Promise(r => setTimeout(r, 800))

            // DOM extraction — handles 2024-2025 Wolt layout
            const domProducts = await page.evaluate(() => {
                const results = []

                // Strategy 1: section-based extraction (most reliable, preserves categories)
                // Wolt renders: <section> or <div> with h2/h3 header + list of items
                const CATEGORY_SELECTORS = [
                    'h2[class*="sc-"]', 'h2[class*="Header"]', 'h2[class*="category"]',
                    'h2[class*="section"]', 'h3[class*="category"]',
                    '[data-test-id="category-header"] h2',
                    '[class*="CategoryHeader"] h2', '[class*="SectionHeader"] h2',
                ]
                const ITEM_SELECTORS = [
                    '[data-test-id="horizontal-item-card"]',
                    '[data-test-id="vertical-item-card"]',
                    '[data-test-id="menu-item"]',
                    '[class*="ItemCard"]:not([class*="skeleton"])',
                    '[class*="itemCard"]:not([class*="skeleton"])',
                    '[class*="menuItem"]',
                    '[class*="MenuItem"]',
                ]

                // Find all category sections
                const categorySections = []
                for (const sel of CATEGORY_SELECTORS) {
                    const headers = document.querySelectorAll(sel)
                    if (headers.length > 0) {
                        headers.forEach(h => {
                            const catName = h.innerText?.trim()
                            if (catName && catName.length > 1 && catName.length < 60) {
                                // Find items in the same section (parent or sibling container)
                                const section = h.closest('section, [class*="Section"], [class*="Category"], [class*="category"]') || h.parentElement
                                categorySections.push({ catName, section })
                            }
                        })
                        if (categorySections.length > 0) break
                    }
                }

                // If we found sections, extract items per category
                if (categorySections.length > 0) {
                    categorySections.forEach(({ catName, section }) => {
                        if (!section) return
                        let items = null
                        for (const sel of ITEM_SELECTORS) {
                            const found = section.querySelectorAll(sel)
                            if (found.length > 0) { items = found; break }
                        }
                        if (!items || items.length === 0) return

                        items.forEach(item => {
                            const extracted = extractItem(item, catName)
                            if (extracted) results.push(extracted)
                        })
                    })
                }

                // Strategy 2: flat list if sections didn't work
                if (results.length === 0) {
                    let items = null
                    for (const sel of ITEM_SELECTORS) {
                        const found = document.querySelectorAll(sel)
                        if (found.length > 2) { items = found; break }
                    }
                    if (items) {
                        // Build category map from headings
                        const headings = [...document.querySelectorAll('h2, h3')].filter(h => {
                            const t = h.innerText?.trim()
                            return t && t.length > 1 && t.length < 60 && !/^\d/.test(t)
                        })
                        items.forEach(item => {
                            // Find nearest heading above this item
                            let category = 'Menu'
                            const itemRect = item.getBoundingClientRect()
                            const itemTop = item.offsetTop
                            let closest = null, closestDist = Infinity
                            headings.forEach(h => {
                                const dist = itemTop - h.offsetTop
                                if (dist > 0 && dist < closestDist) {
                                    closestDist = dist
                                    closest = h
                                }
                            })
                            if (closest) category = closest.innerText?.trim() || 'Menu'
                            const extracted = extractItem(item, category)
                            if (extracted) results.push(extracted)
                        })
                    }
                }

                return results.length > 0 ? results : null

                function extractItem(item, category) {
                    // Name — multiple strategies
                    const nameSelectors = [
                        '[data-test-id="item-name"]', '[class*="itemName"]', '[class*="ItemName"]',
                        '[class*="name"]', 'h3', 'h4', 'strong',
                    ]
                    let name = ''
                    for (const sel of nameSelectors) {
                        const el = item.querySelector(sel)
                        if (el && el.innerText?.trim().length > 1) { name = el.innerText.trim(); break }
                    }
                    if (!name) {
                        // last resort: first non-empty span
                        const spans = item.querySelectorAll('span')
                        for (const s of spans) {
                            const t = s.innerText?.trim()
                            if (t && t.length > 2 && t.length < 80 && !/^\d/.test(t)) { name = t; break }
                        }
                    }
                    if (!name || name.length < 2 || name.length > 100) return null

                    // Price
                    const priceText = item.innerText || ''
                    const priceMatch = priceText.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(RON|lei)/i)
                    if (!priceMatch) return null
                    const price = parseFloat(priceMatch[1].replace(',', '.'))
                    if (!price || price <= 0 || price > 2000) return null

                    // Description
                    const descSelectors = ['[data-test-id="item-description"]', '[class*="description"]', '[class*="Description"]', 'p']
                    let description = null
                    for (const sel of descSelectors) {
                        const el = item.querySelector(sel)
                        if (el && el !== item.querySelector(nameSelectors.find(s => item.querySelector(s)))) {
                            const t = el.innerText?.trim()
                            if (t && t.length > 3 && t !== name) { description = t; break }
                        }
                    }

                    // Image
                    let image_url = null
                    const imgEl = item.querySelector('img')
                    if (imgEl?.src && (imgEl.src.includes('imageproxy') || imgEl.src.includes('wolt') ||
                        imgEl.src.includes('cloudfront') || imgEl.src.includes('cdn') || imgEl.src.startsWith('http'))) {
                        image_url = imgEl.src
                    }
                    if (!image_url) {
                        const bgEls = item.querySelectorAll('[style*="background"]')
                        for (const bgEl of bgEls) {
                            const bg = bgEl.style.backgroundImage || bgEl.style.background
                            const m = bg?.match(/url\(["']?([^"')]+)["']?\)/)
                            if (m && m[1].startsWith('http')) { image_url = m[1]; break }
                        }
                    }

                    const itemText = item.innerText?.toLowerCase() || ''
                    const isPromoted = itemText.includes('promovat') || itemText.includes('reducere') || itemText.includes('discount') ||
                        !!item.querySelector('[class*="promoted"], [class*="Promoted"], [class*="sponsored"], [class*="discount"], [class*="Discount"], [class*="strikethrough"], s, del')
                    
                    // Try to extract discount percentage (e.g. "30% reducere")
                    const discountMatch = (item.innerText || '').match(/(\d{1,2})%\s*(?:reducere|discount|off)/i)
                    const discountPct = discountMatch ? parseInt(discountMatch[1]) : null
                    
                    // Try to find original (strikethrough) price
                    let originalPrice = null
                    const strikeEl = item.querySelector('s, del, [class*="strikethrough"], [class*="oldPrice"], [class*="original"]')
                    if (strikeEl) {
                        const oPriceMatch = strikeEl.innerText?.match(/(\d{1,4}(?:[.,]\d{1,2})?)/)
                        if (oPriceMatch) originalPrice = parseFloat(oPriceMatch[1].replace(',', '.'))
                    }
                    // Also check for a second price in the text (usually the barred one is higher)
                    if (!originalPrice && isPromoted) {
                        const allPrices = [...(item.innerText || '').matchAll(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:RON|lei)/gi)]
                        if (allPrices.length >= 2) {
                            const prices = allPrices.map(m => parseFloat(m[1].replace(',', '.')))
                            originalPrice = Math.max(...prices)
                        }
                    }

                    return { name, price, category, description, image_url, isPromoted, discountPct, originalPrice }
                }
            })

            if (domProducts && domProducts.length > 0) {
                products.push(...domProducts)
                const withImages = domProducts.filter(p => p.image_url).length
                console.log(`    ✓ DOM: ${domProducts.length} products (${withImages} with images) from ${restaurantName}`)
            } else {
                // Fallback: text parsing
                const rawText = await page.evaluate(() => document.body.innerText)
                const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 1)
                const SKIP = ['Conectează', 'Creează cont', 'Spune-ne', 'Introdu strada', 'Alege locația',
                    'Detalii restaurant', 'Partener Wolt', 'Instagram', 'Facebook', 'Contact',
                    'Descoperă', 'Urmărește', 'Module cookie', 'Termeni', '© Wolt', 'Blog']
                let currentCategory = 'Menu', menuStarted = false
                for (let i = 0; i < lines.length && products.length < 120; i++) {
                    const line = lines[i]
                    if (SKIP.some(s => line.startsWith(s))) continue
                    if (!menuStarted) {
                        if (line === 'Cele mai comandate' || /^[A-ZĂÎȘȚÂ\s&-]{3,40}$/.test(line)) {
                            menuStarted = true; currentCategory = line
                        }
                        continue
                    }
                    if (/^[A-ZĂÎȘȚÂ\s&-]{3,40}$/.test(line) && !/\d/.test(line)) { currentCategory = line; continue }
                    const priceMatch = line.match(/^(\d{1,4}(?:[.,]\d{1,2})?)\s*(RON|lei)?$/i)
                    if (priceMatch) {
                        const price = parseFloat(priceMatch[1].replace(',', '.'))
                        if (price > 0 && price < 2000) {
                            let nameIdx = i - 1
                            while (nameIdx >= 0 && (lines[nameIdx].startsWith('(') || lines[nameIdx].length > 120 || SKIP.some(s => lines[nameIdx].startsWith(s)))) nameIdx--
                            const productName = lines[nameIdx]
                            if (productName && productName.length > 2 && productName.length < 100 &&
                                !/^(Wolt|©|RON|Deschis|Comandă)/i.test(productName) &&
                                productName !== productName.toUpperCase()) {
                                products.push({ name: productName, price, category: currentCategory, description: null, image_url: null, isPromoted: false })
                            }
                        }
                    }
                }
                console.log(`    → TEXT fallback: ${products.length} products from ${restaurantName}`)
            }
        } catch (err) {
            console.error(`    → Error products ${restaurantName}:`, err.message)
        } finally {
            await browser.close()
        }
        return products.slice(0, 200)
    }

    // ─── Scrape Glovo products via Puppeteer ───
    async scrapeGlovoProducts(url, restaurantName) {
        if (!url) return []
        const browser = await launchBrowser()
        const page = await browser.newPage()
        await page.setViewport({ width: 1440, height: 900 })
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36')
        const products = []
        try {
            // Load homepage first to get session
            await page.goto('https://glovoapp.com/ro/ro/', { waitUntil: 'domcontentloaded', timeout: 10000 })
            await new Promise(r => setTimeout(r, 800))

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
            await new Promise(r => setTimeout(r, 2500))

            // Accept cookies
            await page.evaluate(() => {
                const btn = [...document.querySelectorAll('button')].find(b => /accept|continu|ok|allow/i.test(b.innerText || ''))
                if (btn) btn.click()
            }).catch(() => {})
            await new Promise(r => setTimeout(r, 1000))

            // Extract products DURING scroll (lazy images only load in viewport)
            const STEP = 600, STEPS = 20
            const productMap = new Map() // key: name → prefer entries with image

            const SELECTORS = [
                '[class*="ItemRow"]', '[class*="item-row"]', '[class*="pintxo"]',
                '[class*="product-row"]', '[class*="ProductRow"]',
                '[class*="product-card"]', '[class*="ProductCard"]',
                '[class*="menu-item"]', '[class*="store-product"]',
            ]

            // Helper: extract visible products from current viewport position
            const extractStep = async () => {
                const step = await page.evaluate((SELECTORS) => {
                    const results = []
                    let items = []
                    for (const sel of SELECTORS) {
                        const found = [...document.querySelectorAll(sel)]
                        if (found.length > 2) { items = found; break }
                    }
                    // Last resort: li/article with price + img
                    if (items.length === 0) {
                        items = [...document.querySelectorAll('li, article')].filter(el =>
                            el.innerText?.match(/\d+[.,]\d+\s*(RON|lei)/i) && el.querySelector('img'))
                    }
                    items.forEach(item => {
                        const text = item.innerText || ''
                        const priceMatch = text.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(RON|lei|Lei)/i)
                        if (!priceMatch) return
                        const price = parseFloat(priceMatch[1].replace(',', '.'))
                        if (!price || price <= 0 || price > 1500) return
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 100)
                        const name = lines.find(l => !/^\d+|RON|lei|%|g\b|kg\b|ml\b/i.test(l.slice(0,3)))
                        if (!name || name.length < 3) return

                        // Image: Support modern <picture> tags and lazy-loading
                        let image_url = null
                        const picSource = item.querySelector('picture source')
                        if (picSource && picSource.srcset) {
                            image_url = picSource.srcset.split(',')[0].trim().split(' ')[0]
                        }
                        
                        if (!image_url) {
                            const imgEl = item.querySelector('img')
                            if (imgEl) {
                                const src = imgEl.src
                                const ds = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-original')
                                const ss = imgEl.getAttribute('srcset') || imgEl.getAttribute('data-srcset')
                                const ssFirst = ss ? ss.trim().split(/[,\s]+/).find(p => p.startsWith('http')) : null
                                image_url = (src?.startsWith('http') && !src.includes('1x1') && !src.includes('data:') && !src.includes('placeholder') ? src
                                    : ds?.startsWith('http') ? ds : ssFirst || null)
                            }
                        }

                        // CSS background-image fallback
                        if (!image_url) {
                            for (const el of item.querySelectorAll('[style]')) {
                                const bg = el.style?.backgroundImage || ''
                                const m = bg.match(/url\(['"]?([^'")\s]+)['"]?\)/)
                                if (m?.[1]?.startsWith('http') && !m[1].includes('1x1')) { image_url = m[1]; break }
                            }
                        }

                        let category = 'Menu'
                        const section = item.closest('section, [class*="category"], [class*="Category"]')
                        if (section) {
                            const h = section.querySelector('h2, h3, [class*="title"]')
                            if (h && h.innerText !== name) category = h.innerText?.trim()?.slice(0, 50) || 'Menu'
                        }

                        results.push({ name: name.slice(0, 100), price, category, image_url, isPromoted: false, description: null })
                    })
                    return results
                }, SELECTORS)

                // Merge into map: prefer entry WITH image
                for (const p of step) {
                    const existing = productMap.get(p.name)
                    if (!existing || (!existing.image_url && p.image_url)) {
                        productMap.set(p.name, p)
                    }
                }
            }

            // Initial extract (above the fold)
            await extractStep()

            // Scroll down incrementally, extract at each step
            for (let i = 0; i < STEPS; i++) {
                await page.evaluate((s) => window.scrollBy(0, s), STEP)
                await new Promise(r => setTimeout(r, 500))
                await extractStep()
            }

            const domProducts = [...productMap.values()]
            const withImg = domProducts.filter(p => p.image_url).length
            console.log(`    ✓ Glovo: ${domProducts.length} produse (${withImg} cu imagini) din ${restaurantName}`)


            if (domProducts.length > 0) {
                products.push(...domProducts)
            } else {
                console.log(`    → Glovo: 0 produse din ${restaurantName} (${url.slice(url.lastIndexOf('/')+1)})`)
            }
        } catch (err) {
            console.error(`    → Glovo produse error ${restaurantName}:`, err.message.slice(0, 80))
        } finally {
            await browser.close()
        }
        return products.slice(0, 200)
    }

    // ─── Bolt Food: Puppeteer + intercept XHR ───
    async searchBolt(city, searchTerm) {
        const BOLT_CITIES = {
            'Bucharest':   { lat: 44.4268, lng: 26.1025 },
            'Cluj-Napoca': { lat: 46.7712, lng: 23.6236 },
            'Timisoara':   { lat: 45.7489, lng: 21.2087 },
            'Iasi':        { lat: 47.1585, lng: 27.6014 },
            'Constanta':   { lat: 44.1598, lng: 28.6348 },
            'Brasov':      { lat: 45.6427, lng: 25.5887 },
            'Galati':      { lat: 45.4353, lng: 28.0080 },
            'Sibiu':       { lat: 45.7983, lng: 24.1256 },
            'Pitesti':     { lat: 44.8565, lng: 24.8692 },
            'Ploiesti':    { lat: 44.9401, lng: 26.0218 },
            'Bacau':       { lat: 46.5670, lng: 26.9146 },
            'Suceava':     { lat: 47.6515, lng: 26.2555 },
            'Targu Mures': { lat: 46.5386, lng: 24.5578 },
            'Braila':      { lat: 45.2692, lng: 27.9574 },
            'Baia Mare':   { lat: 47.6567, lng: 23.5849 },
            'Craiova':     { lat: 44.3302, lng: 23.7949 },
            'Oradea':      { lat: 47.0722, lng: 21.9218 },
            'Arad':        { lat: 46.1667, lng: 21.3167 },
        }
        const coords = BOLT_CITIES[city]
        if (!coords) { console.log(`  [Bolt] ${city}: city not configured`); return [] }

        const results = []
        const browser = await launchBrowser({
            args: ['--disable-blink-features=AutomationControlled']
        })
        try {
            const page = await browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1')
            await page.setViewport({ width: 390, height: 844 })

            // Set real GPS coordinates
            await page.setGeolocation({ latitude: coords.lat, longitude: coords.lng, accuracy: 10 })

            // Intercept all JSON API responses from Bolt
            let capturedRestaurants = []
            page.on('response', async (response) => {
                const url = response.url()
                if ((url.includes('bolt.eu') || url.includes('bolt.food')) && url.includes('restaurant')) {
                    try {
                        const ct = response.headers()['content-type'] || ''
                        if (ct.includes('json')) {
                            const json = await response.json().catch(() => null)
                            if (!json) return
                            // Try multiple paths where restaurants might be
                            const rests = json?.data?.restaurants || json?.restaurants
                                || json?.data?.stores || json?.stores
                                || (Array.isArray(json?.data) ? json.data : null)
                                || (Array.isArray(json) ? json : null)
                            if (Array.isArray(rests) && rests.length > capturedRestaurants.length) {
                                capturedRestaurants = rests
                                console.log(`  [Bolt] ${city}: captured ${rests.length} from XHR (${url.slice(url.lastIndexOf('/')+1, url.lastIndexOf('/')+30)})`)
                            }
                        }
                    } catch(_) {}
                }
            })

            await page.goto('https://food.bolt.eu/', { waitUntil: 'domcontentloaded', timeout: 20000 })
            await new Promise(r => setTimeout(r, 1000))

            // Accept cookies/location prompt
            await page.evaluate(() => {
                const btns = [...document.querySelectorAll('button')]
                const btn = btns.find(b => /accept|allow|ok|continu|permit/i.test(b.innerText || ''))
                if (btn) btn.click()
            }).catch(() => {})
            await new Promise(r => setTimeout(r, 500))

            // Grant geolocation and trigger location detection
            const ctx = browser.defaultBrowserContext()
            await ctx.overridePermissions('https://food.bolt.eu', ['geolocation'])
            await page.evaluate(() => {
                const btns = [...document.querySelectorAll('button')]
                const locBtn = btns.find(b => /locat|gps|pozit|cerca|near/i.test(b.innerText || b.getAttribute('aria-label') || ''))
                if (locBtn) locBtn.click()
            }).catch(() => {})

            // Wait for API calls to complete
            await new Promise(r => setTimeout(r, 6000))

            if (capturedRestaurants.length === 0) {
                // Fallback: try direct URL with city
                const citySlug = city.toLowerCase().replace(/[^a-z]/g, '-').replace(/-+/g,'-')
                await page.goto(`https://food.bolt.eu/ro-ro/${citySlug}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
                await new Promise(r => setTimeout(r, 4000))
            }

            if (capturedRestaurants.length > 0) {
                const searchTags = SEARCH_TAG_MAP[searchTerm.toLowerCase()] || [searchTerm.toLowerCase()]
                const filtered = capturedRestaurants.filter(r => {
                    const name = (r.name || r.store_name || '').toLowerCase()
                    const cats = (r.categories || r.tags || []).map(c => typeof c === 'string' ? c : (c.name || '')).join(' ').toLowerCase()
                    return searchTags.some(t => name.includes(t) || cats.includes(t))
                })
                const toProcess = filtered.length ? filtered : capturedRestaurants.slice(0, 8)
                console.log(`  [Bolt] ${city}: ${toProcess.length} relevante (din ${capturedRestaurants.length} total)`)
                toProcess.forEach((r, i) => {
                    const name = r.name || r.store_name || `Bolt-${i}`
                    results.push({
                        name, url: r.url || null, rank_position: i + 1,
                        rating: r.rating?.score || r.rating || null,
                        delivery_time_min: r.delivery_time_estimate?.min || null,
                        delivery_time_max: r.delivery_time_estimate?.max || null,
                        delivery_fee: r.delivery_price || null, is_promoted: r.is_promoted || false,
                    })
                })
            } else {
                console.log(`  [Bolt] ${city}: 0 restaurante captate`)
            }
        } catch (err) {
            console.error(`  [Bolt] ${city}:`, err.message.slice(0, 100))
        } finally {
            await browser.close()
        }
        return results
    }



    // ─── Run ONE search — with onProgress callback ───
    async runSearch(searchConfig, ourBrandNames = [], onProgress = null) {
        this.shouldStop = false;
        const { id: searchId, search_term, platforms, cities, auto_cities, brand_id, glovo_category } = searchConfig
        const today = new Date().toISOString().split('T')[0]

        let citiesToSearch = cities?.length > 0 ? [...cities] : []
        if (auto_cities !== false && brand_id) {
            const brandCities = await this.getCitiesForBrand(brand_id)
            if (brandCities.length > 0) citiesToSearch = brandCities
        }
        if (citiesToSearch.length === 0) citiesToSearch = ['Bucharest']

        // Bolt enabled via Puppeteer (food.bolt.eu)
        const activePlatforms = (platforms?.length > 0 ? platforms : ['wolt', 'glovo', 'bolt'])
        const totalSteps = citiesToSearch.length * activePlatforms.length
        let step = 0

        console.log(`\n🔍 "${search_term}" | ${citiesToSearch.length} cities | ${activePlatforms.join(', ')}`)
        onProgress?.({ searchId, type: 'start', totalSteps, cities: citiesToSearch, platforms: activePlatforms, search_term })

        for (const city of citiesToSearch) {
            if (this.shouldStop) break;
            for (const platform of activePlatforms) {
                if (this.shouldStop) break;
                step++
                const t0 = Date.now()
                console.log(`\n  📍 ${city}/${platform} (${step}/${totalSteps})`)
                onProgress?.({ searchId, type: 'city_start', step, totalSteps, city, platform })

                try {
                    let found = []
                    if (platform === 'wolt') found = await this.searchWolt(city, search_term)
                    else if (platform === 'glovo') found = await this.searchGlovo(city, search_term, glovo_category)
                    else if (platform === 'bolt') found = await this.searchBolt(city, search_term)

                    const competitors = this.filterOurBrands(found, ourBrandNames)
                    await this.saveResults(searchId, platform, city, competitors, today)

                    const elapsed = Math.round((Date.now() - t0) / 1000)
                    onProgress?.({ searchId, type: 'city_done', step, totalSteps, city, platform, found: competitors.length, elapsed })
                } catch (err) {
                    console.error(`  Error ${city}/${platform}:`, err.message)
                    onProgress?.({ searchId, type: 'city_error', step, totalSteps, city, platform, error: err.message })
                }
                await new Promise(r => setTimeout(r, 800))
            }
        }

        console.log(`\n✅ "${search_term}" finalizat${this.shouldStop ? ' (OPRIT)' : ''}`)
        onProgress?.({ searchId, type: this.shouldStop ? 'stopped' : 'done', totalSteps, search_term })
    }

    async runAllSearches(onProgress = null) {
        this.shouldStop = false;
        const { data: searches } = await supabase.from('competitive_searches').select('*').eq('is_active', true)
        if (!searches?.length) { console.log('[Competitor] No active searches'); return }
        const { data: brands } = await supabase.from('brands').select('name')
        const ourBrandNames = brands?.map(b => b.name) || []
        console.log(`\n🤖 ${searches.length} competitive searches...`)
        for (const search of searches) {
            if (this.shouldStop) break;
            await this.runSearch(search, ourBrandNames, onProgress)
        }
        console.log('\n✅ Toate căutările complete' + (this.shouldStop ? ' (OPRIT MANUL)' : ''))
        this.shouldStop = false;
    }
}
