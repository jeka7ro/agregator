import { launchBrowser } from '../utils/puppeteer-launch.js'
import { supabase } from '../services/supabase.js'
import { retryWithBackoff, platformRateLimiters } from '../utils/retry.js'

/**
 * Wolt Checker - Enhanced with product stops and rating tracking
 * 
 * Uses Puppeteer for browser scraping.
 * 
 * Extracts:
 * - Restaurant open/closed status
 * - Rating (decimal format, e.g. 8.4)
 * - Review count
 * - Delivery time and minimum order
 * - Product availability
 * - Category status
 */
export class WoltChecker {
    constructor() {
        this.platform = 'wolt'
        this.browser = null
    }

    async check(restaurant) {
        if (!restaurant.wolt_url) {
            console.log(`   [Wolt] No URL for ${restaurant.name}`)
            return null
        }

        await platformRateLimiters.wolt.wait()

        return retryWithBackoff(
            () => this._doCheck(restaurant),
            { maxRetries: 2, baseDelay: 2000, label: `Wolt:${restaurant.name}` }
        )
    }

    async _doCheck(restaurant) {
        try {
            console.log(`   [Wolt] Checking ${restaurant.name}...`)

            const startTime = Date.now()

            this.browser = await launchBrowser()

            const page = await this.browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

            await page.goto(restaurant.wolt_url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            })

            const responseTime = Date.now() - startTime
            await new Promise(resolve => setTimeout(resolve, 2000))

            const pageData = await page.evaluate(() => {
                const rawText = document.body.innerText
                const bodyText = rawText.toLowerCase()

                // ─── OPEN/CLOSED DETECTION ───
                const isClosed = bodyText.includes('închis') || bodyText.includes('inchis') || bodyText.includes('closed')
                const hasDeschis = bodyText.includes('deschis') && !isClosed
                const hasDeliveryTime = /\d+[–-]\d+\s*min/i.test(bodyText) || /livrare.*\d+.*min/i.test(bodyText)
                const hasDisponibil = bodyText.includes('disponibil') && !bodyText.includes('indisponibil')
                const hasMinOrder = /comandă minimă/i.test(bodyText)
                const isOpen = (hasDeschis || hasDeliveryTime || hasDisponibil || hasMinOrder) && !isClosed

                // ─── RATING ───
                const ratingMatch = rawText.match(/\b(\d[.,]\d)\b/)
                const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : null

                // Try to get review count
                const reviewMatch = rawText.match(/(\d+)\+?\s*recenzi/i) || rawText.match(/(\d+)\+?\s*review/i)
                const reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : null

                // ─── DELIVERY INFO ───
                const deliveryTimeMatch = rawText.match(/(\d+)[–-](\d+)\s*min/i)
                const deliveryTime = deliveryTimeMatch
                    ? { min: parseInt(deliveryTimeMatch[1]), max: parseInt(deliveryTimeMatch[2]) }
                    : null

                const minOrderMatch = rawText.match(/comandă minimă[:\s]*(\d+[.,]?\d*)\s*(ron|lei)/i)
                const minOrder = minOrderMatch
                    ? parseFloat(minOrderMatch[1].replace(',', '.'))
                    : null

                // ─── SCHEDULE ───
                const scheduleMatch = rawText.match(/[Ss]e deschide[^.\n]+/i)
                const openUntilMatch = rawText.match(/[Dd]eschis până la\s*(\d{1,2}:\d{2})/i)
                const scheduleInfo = scheduleMatch ? scheduleMatch[0].trim() :
                    openUntilMatch ? `Deschis până la ${openUntilMatch[1]}` : null

                // ─── PRODUCT ANALYSIS ───
                const hasMenu = bodyText.includes('ron') || bodyText.includes('lei')
                const indisponibilCount = (bodyText.match(/indisponibil/g) || []).length

                // Count product items
                const productElements = document.querySelectorAll('[data-test-id*="product"], [class*="MenuItem"], [class*="product-card"]')
                const totalVisibleProducts = productElements.length

                // Check for disabled categories
                const disabledCategories = []
                const greyedElements = document.querySelectorAll('[class*="disabled"], [class*="unavailable"]')
                greyedElements.forEach(el => {
                    const text = el.innerText?.trim()
                    if (text && text.length > 1 && text.length < 50) {
                        disabledCategories.push(text)
                    }
                })

                return {
                    isOpen,
                    isClosed,
                    rating,
                    reviewCount,
                    deliveryTime,
                    minOrder,
                    scheduleInfo,
                    hasMenu,
                    product_stops: {
                        total: totalVisibleProducts,
                        stopped: indisponibilCount,
                        stop_percent: totalVisibleProducts > 0 ? (indisponibilCount / totalVisibleProducts) * 100 : 0
                    },
                    disabled_categories: disabledCategories,
                    bodyText: bodyText.substring(0, 500)
                }
            })

            await this.browser.close()
            this.browser = null

            const totalTime = Date.now() - startTime

            // ─── DETERMINE STATUS ───
            let finalStatus = 'unavailable'
            if (pageData.isOpen) {
                finalStatus = 'available'
            } else if (pageData.isClosed) {
                finalStatus = 'closed'
            }

            // ─── SAVE MONITORING CHECK ───
            const checkData = {
                    restaurant_id: restaurant.id,
                    platform: this.platform,
                    checked_at: new Date().toISOString(),
                    ui_is_open: pageData.isOpen,
                    ui_can_order: pageData.isOpen,
                    ui_is_greyed: !pageData.isOpen,
                    ui_error_message: pageData.scheduleInfo || (finalStatus === 'unavailable' ? 'Indisponibil pe Wolt' : finalStatus === 'closed' ? 'Închis conform program' : null),
                    rating: pageData.rating,
                    review_count: pageData.reviewCount,
                    missing_products: pageData.product_stops?.stopped > 0
                        ? [{ count: pageData.product_stops.stopped, type: 'indisponibil' }]
                        : [],
                    disabled_categories: pageData.disabled_categories || [],
                    final_status: finalStatus,
                    raw_data: {
                        ...pageData,
                        response_time_ms: responseTime,
                        total_time_ms: totalTime,
                        url: restaurant.wolt_url
                    }
                }
            
            let { error } = await supabase
                .from('monitoring_checks')
                .insert(checkData)
                .select()
                .single()

            if (error) {
                console.error('   [Wolt] Error saving check (ignored for local UI):', error.message)
            }
            
            // Re-assign data to our full checkData object to guarantee raw_data is always present
            const data = checkData;

            // ─── SAVE RATING HISTORY ───
            if (pageData.rating) {
                await this._saveRatingHistory(restaurant, pageData.rating, pageData.reviewCount)
            }

            // ─── LOG ───
            const statusIcon = finalStatus === 'available' ? '[OK]' : finalStatus === 'closed' ? '[CLOSED]' : '[ERR]'
            console.log(`   [Wolt] ${statusIcon} ${restaurant.name} - ${finalStatus} (${totalTime}ms)`)
            if (pageData.rating) console.log(`   [Wolt] Rating: ${pageData.rating}/10${pageData.reviewCount ? ` (${pageData.reviewCount} reviews)` : ''}`)
            if (pageData.product_stops?.stopped > 0) {
                console.log(`   [Wolt] Products stopped: ${pageData.product_stops.stopped}/${pageData.product_stops.total}`)
            }
            if (pageData.scheduleInfo) console.log(`   [Wolt] Schedule: ${pageData.scheduleInfo}`)

            return data

        } catch (error) {
            console.error(`   [Wolt] Error checking ${restaurant.name}:`, error.message)

            const fallbackCheck = {
                restaurant_id: restaurant.id,
                platform: this.platform,
                checked_at: new Date().toISOString(),
                ui_is_open: false,
                final_status: 'unavailable',
                ui_error_message: 'Indisponibil pe Wolt',
                raw_data: { error: error.message, url: restaurant.wolt_url }
            }

            try {
                await supabase.from('monitoring_checks').insert(fallbackCheck)
            } catch (_) {}

            return fallbackCheck
        } finally {
            if (this.browser) {
                try {
                    await this.browser.close()
                } catch (_) {}
                this.browser = null
            }
        }
    }

    /**
     * Save rating to history, tracking changes over time
     */
    async _saveRatingHistory(restaurant, currentRating, reviewCount) {
        try {
            const { data: prev } = await supabase
                .from('rating_history')
                .select('rating, review_count')
                .eq('restaurant_id', restaurant.id)
                .eq('platform', this.platform)
                .order('recorded_at', { ascending: false })
                .limit(1)
                .single()

            const previousRating = prev?.rating || null
            const previousReviewCount = prev?.review_count || null
            let changeDirection = 'stable'
            if (previousRating !== null) {
                if (currentRating > previousRating) changeDirection = 'up'
                else if (currentRating < previousRating) changeDirection = 'down'
            } else {
                changeDirection = 'initial'
            }

            await supabase.from('rating_history').insert({
                restaurant_id: restaurant.id,
                platform: this.platform,
                rating: currentRating,
                previous_rating: previousRating,
                review_count: reviewCount,
                previous_review_count: previousReviewCount,
                change_direction: changeDirection,
                recorded_at: new Date().toISOString()
            })
        } catch (err) {
            console.error('   [Wolt] Error saving rating history:', err.message)
        }
    }
}
