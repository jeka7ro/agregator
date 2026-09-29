import { supabase } from '../services/supabase.js'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())
import { GlovoPartnerScraper } from './glovo-partner-scraper.js'
import { WoltPartnerScraper } from './wolt-partner-scraper.js'

export class ReputationScraper {

    async runAllScrapes() {
        console.log('\n🌟 [Reputation] Starting Global Reputation Scan...')
        try {
            // 1. Fetch all restaurants
            const { data: restaurants, error } = await supabase
                .from('restaurants')
                .select('id, brand_id, name')

            if (error || !restaurants || restaurants.length === 0) {
                console.log('   [Reputation] No restaurants configured in restaurants table.')
                return
            }

            console.log(`   [Reputation] Found ${restaurants.length} restaurant(s) to scan.`)

            // PENTRU PĂSTRAREA PERFORMANȚEI EVIDĂM să deschidem Chromex44 de ori
            // Deoarece portalul Glovo/Wolt arată toate locațiile pe un singur master account,
            // vom extrage 1 singură dată pentru întreg contul!
            const firstRest = restaurants[0]
            const glovoLoc = { id: firstRest.id, brand_id: firstRest.brand_id, platform: 'glovo', name: firstRest.name, url: 'https://portal.glovoapp.com/dashboard' }
            const woltLoc = { id: firstRest.id, brand_id: firstRest.brand_id, platform: 'wolt', name: firstRest.name, url: 'https://merchant.wolt.com' }
            
            await this.scrapeLocation(glovoLoc)
            await this.scrapeLocation(woltLoc)

            console.log('✅ [Reputation] Global Reputation Scan completed.\n')

        } catch (err) {
            console.error('❌ [Reputation] Error during reputation scan:', err.message)
        }
    }

    async scrapeLocation(loc) {
        console.log(`   -> Scanning ${loc.platform.toUpperCase()} for "${loc.name}"...`)
        try {
            // PHASE 1: Data extraction
            // Depending on the platform, we hit different APIs:
            let freshReviews = []
            
            if (loc.platform === 'google') {
                freshReviews = await this.mockFetchGoogleAPI(loc)
            } else if (loc.platform === 'facebook') {
                freshReviews = await this.mockFetchFacebookAPI(loc)
            } else if (loc.platform === 'glovo') {
                freshReviews = await this.fetchGlovoReviews(loc)
            } else if (loc.platform === 'wolt') {
                freshReviews = await this.fetchWoltReviews(loc)
            } else {
                freshReviews = await this.mockFetchDeliveryApp(loc)
            }

            if (freshReviews.length === 0) return

            // Sort newest first
            freshReviews.sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))

            for (const review of freshReviews) {
                // Determine Sentiment basic ML (Phase 1)
                const sentiment = this.analyzeSentiment(review.rating, review.comment)
                
                const reviewData = {
                    order_id: review.order_id,
                    location_id: loc.id,
                    platform: loc.platform,
                    rating: review.rating,
                    customer_name: review.customer_name,
                    comment: review.comment,
                    sentiment: sentiment,
                    reviewed_at: review.reviewed_at,
                    platform_url: loc.url || ''
                }

                // Insert into Supabase on conflict do nothing
                const { data: insertedReview, error } = await supabase
                    .from('platform_reviews')
                    .insert(reviewData)
                    .select()
                    .single()

                if (error) {
                    // Ignore duplicate key errors (PGRST116 means zero rows returned in single if not inserted, or 23505 unique constraint)
                    if (error.code !== '23505') {
                        console.error(`      [Reputation DB Error] ${error.message}`)
                    }
                    continue // Skip alerting if it's already in DB
                }

                console.log(`      [Reputation] Inserted new ${sentiment} review (${review.rating}⭐) from ${review.author_name}`)

                // PHASE 1 ALERTING: Rating <= 3 and has text
                if (insertedReview && insertedReview.rating <= 3 && insertedReview.comment && insertedReview.comment.trim().length > 0) {
                    console.log(`      🚨 [Reputation] Found negative review. Alert logic temporarily disabled.`)
                }
            }

        } catch (err) {
            console.error(`   [Reputation] Error scanning location ${loc.id}:`, err.message)
        }
    }

    // Helper to find the telegram group for a brand (assumes brand or restaurant has one)
    async getBrandTelegramGroup(brand_id) {
        // Find the first active restaurant of this brand to borrow its telegram group
        const { data } = await supabase
            .from('restaurants')
            .select('telegram_group_id')
            .eq('brand_id', brand_id)
            .limit(1)
            .single()
        
        return data?.telegram_group_id || null
    }

    analyzeSentiment(rating, text) {
        if (!text) {
            if (rating >= 4) return 'positive'
            if (rating === 3) return 'neutral'
            return 'negative'
        }

        const lowerText = text.toLowerCase()
        
        // MVP: Simple NLP logic based on Romanian/English Keywords (as per Rezumat Executiv)
        const negativeKeywords = ['rece', 'greșit', 'lipsă', 'oribil', 'groaznic', 'nu recomand', 'rude', 'comanda greșită', 'țepari', 'întârziere', 'varsat', 'ars', 'crud', 'defect']
        const positiveKeywords = ['excelent', 'delicios', 'proaspăt', 'rapid', 'recomand', 'perfect', 'bun', 'fierbinte', 'gustos']

        let negativeScore = negativeKeywords.filter(k => lowerText.includes(k)).length
        let positiveScore = positiveKeywords.filter(k => lowerText.includes(k)).length

        if (rating <= 2) negativeScore += 2
        if (rating >= 4) positiveScore += 2

        if (negativeScore > positiveScore) return 'negative'
        if (positiveScore > negativeScore) return 'positive'
        
        return 'neutral'
    }

    // --- REAL SCRAPERS ---
    async fetchGlovoReviews(loc) {
        console.log(`      [Reputation] Launching REAL GlovoPartnerScraper for ${loc.name} ...`)
        const scraper = new GlovoPartnerScraper()
        // Cont real fix programat
        const res = await scraper.scrapeReviews('jeka7ro@gmail.com', '31Martie2026!')
        
        if (res.success && res.data) {
            return res.data.map(r => ({
                order_id: r.orderId,
                rating: parseInt(r.rating) || 5, // Aducem la scară dacă e cazul
                customer_name: 'Client Glovo', 
                comment: r.text || '',
                reviewed_at: r.timestamp || new Date().toISOString()
            }))
        }
        return []
    }

    async fetchWoltReviews(loc) {
        console.log(`      [Reputation] Launching REAL WoltPartnerScraper for ${loc.name} ...`)
        const scraper = new WoltPartnerScraper()
        const res = await scraper.scrapeReviews('jeka7ro@gmail.com')
        
        if (res.success && res.data) {
            return res.data.map(r => ({
                order_id: r.orderId,
                rating: parseInt(r.rating) || 5,
                customer_name: 'Client Wolt',
                comment: r.text || '',
                reviewed_at: r.timestamp || new Date().toISOString()
            }))
        }
        return []
    }

    // --- MOCK API & PUPPETEER SCRAPING ---
    async mockFetchGoogleAPI(loc) {
        return [] // Pending OAuth implementation
    }
    
    async mockFetchFacebookAPI(loc) {
        return [] // Pending Graph API token
    }
    
    async mockFetchDeliveryApp(loc) {
        if (!loc.url) return []
        
        console.log(`      [Reputation] Launching Puppeteer for ${loc.platform} ...`)
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--user-data-dir=/tmp/puppeteer_isolated_profile_' + Date.now()] })
        
        try {
            const page = await browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36')
            await page.goto(loc.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
            await new Promise(r => setTimeout(r, 2000))

            // Fake extraction for demonstration (A real DOM parse requires actual app layout)
            // But this validates the architecture end-to-end
            const scraped = await page.evaluate(() => {
                // If there were actual reviews on page:
                // return [...document.querySelectorAll('.review-card')].map(...)
                return []
            })
            
            await browser.close()
            return scraped
            
        } catch (e) {
            console.error(`      [Reputation Puppeteer Error] ${e.message}`)
            await browser.close()
            return []
        }
    }
}
